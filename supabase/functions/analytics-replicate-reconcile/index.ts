import { createClient } from 'npm:@supabase/supabase-js@2.112.2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:cors});
const terminal=new Set(['starting','processing','succeeded','failed','canceled','aborted']);
const metric=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
 try{
 const url=Deno.env.get('SUPABASE_URL')!, key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const auth=req.headers.get('Authorization')||'';
 const scoped=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
 const {data,error}=await scoped.auth.getUser();
 if(error||data.user?.app_metadata?.role!=='admin')return reply({error:'admin_required'},403);
 const token=Deno.env.get('REPLICATE_API_TOKEN');if(!token)return reply({error:'provider_not_configured'},503);
 const db=createClient(url,key,{auth:{persistSession:false}});
 const {data:rows,error:pendingError}=await db.rpc('analytics_pending_predictions',{p_limit:30});
 if(pendingError)throw pendingError;
 let checked=0,unavailable=0,errors=0;
 for(let i=0;i<(rows||[]).length;i+=5){
 await Promise.all(rows.slice(i,i+5).map(async(row:{prediction_id:string})=>{
 const id=row.prediction_id;
 if(!/^[a-zA-Z0-9_-]{1,128}$/.test(id)){errors++;return;}
 try{
 const res=await fetch('https://api.replicate.com/v1/predictions/'+encodeURIComponent(id),{method:'GET',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});
 if(res.status===429||res.status>=500){errors++;return;}
 const pred=res.ok?await res.json():null;
 if(res.ok&&(pred?.id!==id||!terminal.has(pred?.status))){errors++;return;}
 const {error:saveError}=await db.from('analytics_ai_prediction_observation').upsert({prediction_id:id,observed_at:new Date().toISOString(),provider_status:pred?.status??null,http_status:res.status,predict_seconds:metric(pred?.metrics?.predict_time),total_seconds:metric(pred?.metrics?.total_time)},{onConflict:'prediction_id'});
 if(saveError){errors++;return;}
 if(res.ok)checked++;else unavailable++;
 }catch{errors++;}
 }));
 }
 return reply({checked,unavailable,errors,selected:(rows||[]).length});
 }catch{return reply({error:'reconciliation_failed'},500);}
});
