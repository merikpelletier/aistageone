import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'npm:@supabase/supabase-js@2.112.2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
const API='https://api.replicate.com/v1';
const adapters:Record<string,(mode:string,imgs:string[],prompt:string)=>Record<string,unknown>>={
 'hyper3d/rodin':(mode,imgs,prompt)=>({tier:'Gen-2',images:mode==='text'?[]:imgs,prompt:prompt||'3D object',geometry_file_format:'glb'}),
 'tencent/hunyuan3d-2mv':(_,imgs)=>({front_image:imgs[0],...(imgs[1]?{back_image:imgs[1]}:{}),...(imgs[2]?{left_image:imgs[2]}:{}),...(imgs[3]?{right_image:imgs[3]}:{}),file_type:'glb'}),
 'tencent/hunyuan-3d-3.1':(mode,imgs,prompt)=>mode==='text'?{prompt}:{image:imgs[0]},
 'fishwowater/trellis2':(_,imgs)=>({image:imgs[0],generate_model:true,generate_video:false}),
 'firtoz/trellis':(_,imgs)=>({images:[imgs[0]],generate_model:true})
};
function glb(v:unknown):string|null {
 if(typeof v==='string')return /\.glb(?:\?|$)/i.test(v)?v:null;
 if(Array.isArray(v)){for(const x of v){const result=glb(x);if(result)return result;}return null;}
 if(v&&typeof v==='object'){for(const x of Object.values(v)){const result=glb(x);if(result)return result;}}
 return null;
}
async function sign(value:string,secret:string){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const buf=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value));
 return [...new Uint8Array(buf)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 try {
  const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),token=Deno.env.get('REPLICATE_API_TOKEN');
  if(!url||!anon||!secret||!token)return reply({error:'Service 3D not configured'},503);
  const auth=req.headers.get('Authorization')||'';
  const scoped=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
  const {data:{user},error:userError}=await scoped.auth.getUser();
  if(userError||!user)return reply({error:'Unauthorized'},401);
  const svc=createClient(url,secret,{auth:{persistSession:false}});
  const body=await req.json();
  if(body.action==='status'){
   const encoded=String(body.job||''),[payload,mac]=encoded.split('.');
   if(!payload||!mac||mac!==await sign(payload,token))return reply({error:'Invalid job token'},403);
   const job=JSON.parse(atob(payload));
   if(job.u!==user.id||Date.now()-job.t>7*86400000||! /^[a-z0-9]+$/i.test(job.id))return reply({error:'Job not available'},403);
   const response=await fetch(`${API}/predictions/${job.id}`,{headers:{Authorization:`Bearer ${token}`}});
   const prediction=await response.json();
   if(!response.ok)return reply({error:prediction.detail||'Unable to inspect prediction'},502);
   if(job.charge&&prediction.status==='succeeded')await svc.rpc('complete_ai_credit_charge',{p_charge_id:job.charge});
   if(job.charge&&['failed','canceled'].includes(prediction.status))await svc.rpc('refund_ai_credit_charge',{p_charge_id:job.charge,p_error_message:String(prediction.error||prediction.status)});
   return reply({status:prediction.status,glb_url:prediction.status==='succeeded'?glb(prediction.output):null,error:prediction.error||null,output_available:!!prediction.output});
  }
  if(body.action!=='start')return reply({error:'Invalid action'},400);
  const mode=String(body.mode||''),modelKey=String(body.model_key||''),prompt=String(body.prompt||'').trim().slice(0,1024);
  if(!['text','image','multi'].includes(mode))return reply({error:'Invalid mode'},400);
  const {data:models,error:modelsError}=await svc.rpc('studio_enabled_3d_models');
  if(modelsError)return reply({error:'Cannot load configured models'},503);
  const model=(models||[]).find((m:any)=>m.model_key===modelKey&&m.capabilities?.inputs?.includes(mode==='multi'?'multi_image':mode));
  if(!model)return reply({error:'Model not enabled for this input mode in Admin'},400);
  if(!adapters[modelKey])return reply({error:'This enabled model needs a verified 3D adapter'},400);
  const images=Array.isArray(body.images)?body.images:[];
  if(images.length>4||images.some((x:unknown)=>x!==null&&x!==''&&(typeof x!=='string'||x.length>5000000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(x))))return reply({error:'Images must be JPG, PNG or WebP under 3.75 MB each'},400);
  const ordered=mode==='multi'?images:mode==='image'?[images[0]]:[];
  if((mode==='image'&&!ordered[0])||(mode==='multi'&&!ordered[0]))return reply({error:'A front/reference image is required'},400);
  if(mode==='text'&&!prompt)return reply({error:'Enter a prompt'},400);
  if(modelKey==='tencent/hunyuan3d-2mv'&&mode!=='multi')return reply({error:'This model requires multi-view input'},400);
  const input=adapters[modelKey](mode,ordered.filter((x:unknown)=>typeof x==='string'&&x),prompt);
  if(modelKey==='tencent/hunyuan3d-2mv'&&mode==='multi'){
    Object.assign(input,{front_image:images[0],...(images[1]?{back_image:images[1]}:{}),...(images[2]?{left_image:images[2]}:{}),...(images[3]?{right_image:images[3]}:{})});
  }
  const adminEmail=(Deno.env.get('ADMIN_EMAIL')||'').toLowerCase().trim();
  const admin=user.app_metadata?.role==='admin'||!!(adminEmail&&user.email?.toLowerCase()===adminEmail);
  let charge:string|null=null;
  if(!admin){
   const {data:rate}=await svc.from('ai_model_catalog').select('unit_price_usd,billing_type').eq('model_key',modelKey).eq('enabled',true).maybeSingle();
   const {data:settings}=await svc.from('credit_economy_settings').select('credit_value_cad,usd_to_cad_rate,cost_buffer_pct').eq('id',true).maybeSingle();
   if(!rate||rate.billing_type!=='prediction'||!settings)return reply({error:'3D billing configuration missing. No charge taken.'},503);
   const credits=Math.ceil(Number(rate.unit_price_usd)*Number(settings.usd_to_cad_rate)*(1+Number(settings.cost_buffer_pct||0)/100)/Number(settings.credit_value_cad));
   if(!Number.isFinite(credits)||credits<1)return reply({error:'Invalid credit pricing'},503);
   const {data:billing,error:billingError}=await svc.rpc('reserve_ai_credit_charge_dynamic',{p_user_id:user.id,p_user_email:user.email,p_tool_id:'generate_3d',p_provider:'replicate',p_related_entity:modelKey,p_idempotency_key:crypto.randomUUID(),p_credit_cost:credits});
   if(billingError||!billing?.ok)return reply({error:billingError?.message||billing?.code||'Credit reservation failed'},402);
   charge=billing.charge_id||null;
  }
  try {
   const modelInfoResponse = await fetch(`${API}/models/${modelKey}`,{headers:{Authorization:`Bearer ${token}`}});
   const modelInfo = await modelInfoResponse.json();
   if(!modelInfoResponse.ok) throw new Error(modelInfo.detail||'Unable to inspect selected 3D model');
   const version = modelInfo.latest_version?.id;
   if(!version) throw new Error('The selected model has no runnable version');
   const response=await fetch(`${API}/predictions`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({version,input})});
   const prediction=await response.json();
   if(!response.ok||!prediction.id)throw new Error(prediction.detail||prediction.error||`Replicate HTTP ${response.status}`);
   const payload=btoa(JSON.stringify({id:prediction.id,u:user.id,t:Date.now(),charge}));
   return reply({job:`${payload}.${await sign(payload,token)}`,status:prediction.status});
  }catch(error){
   if(charge)await svc.rpc('refund_ai_credit_charge',{p_charge_id:charge,p_error_message:String(error).slice(0,1000)});
   throw error;
  }
 }catch(error){console.error('generate-3d',error);return reply({error:error instanceof Error?error.message:'Generation error'},500);}
});
