import { AsyncLocalStorage } from 'node:async_hooks';
import { createClient } from 'npm:@supabase/supabase-js@2.112.2';
import { serviceKey,routeKey,validateChoice,adaptInput,fail } from './modelControlPolicy.ts';
const nativeFetch=globalThis.fetch.bind(globalThis);
const contexts=new AsyncLocalStorage<any>();
const db=()=>createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false},global:{fetch:nativeFetch}});
export async function assertServiceEnabled(){
 const context=contexts.getStore();if(!context)fail('Contexte IA manquant');
 const body=await context.requestBody;
 const {data,error}=await db().from('ai_model_assignment').select('route_key').eq('service',serviceKey(context.slug,body)).eq('enabled',true).limit(1);
 if(error||!data?.length)fail('Ce service attend le choix de modèle de Merik. Aucun crédit débité.');
}
export function installModelControl(slug:string){
 const serve=Deno.serve.bind(Deno);
 (Deno as any).serve=(...args:any[])=>{
  const index=typeof args[0]==='function'?0:1;const handler=args[index];
  args[index]=(request:Request,info:any)=>{
   const requestBody=request.clone().json().catch(()=>({}));
   return contexts.run({id:crypto.randomUUID(),slug,requestBody,failed:false},()=>handler(request,info));
  };
 return (serve as any)(...args);
 };
 globalThis.fetch=async(input:any,init?:RequestInit)=>{
  const inputUrl=typeof input==='string'||input instanceof URL?String(input):input.url;
  const url=new URL(inputUrl);
  const method=String(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
  if(url.hostname==='api.openai.com'||url.hostname==='api.anthropic.com'||url.hostname==='generativelanguage.googleapis.com')fail('Ce fournisseur direct ne dispose pas d’un raccordement approuvé dans le contrôle des modèles');
  if(url.hostname!=='api.replicate.com'||method!=='POST'||!url.pathname.endsWith('/predictions')){
   const response=await nativeFetch(input,init);
   if(url.hostname==='api.replicate.com'&&method==='GET'&&url.pathname.includes('/predictions/')){
    const result=await response.clone().json().catch(()=>({}));const context=contexts.getStore();
    if(context&&['failed','canceled'].includes(result.status))context.failed=true;
   }
   return response;
  }
  const request=new Request(input,init);
  const context=contexts.getStore();if(!context)fail('Contexte du service IA manquant');
  if(context.failed)fail('La génération précédente a échoué. Aucun remplacement automatique autorisé.');
  const body=await request.clone().json();const source=url.pathname.match(/\/models\/(.+)\/predictions$/)?.[1] || `version:${body.version}`;
  const original=await context.requestBody;const service=serviceKey(slug,original);const key=routeKey(service,source);
  const client=db();
  const {data:assignment,error}=await client.from('ai_model_assignment').select('*').eq('route_key',key).maybeSingle();
  if(error)fail('Contrôle des modèles indisponible',503);
  const {data:model,error:me}=assignment?.model_key?await client.from('ai_model_catalog').select('*').eq('model_key',assignment.model_key).maybeSingle():{data:null,error:null};
  if(me)fail('Catalogue des modèles indisponible',503);
  let providerInput;
  try{validateChoice(assignment,model);providerInput=adaptInput(body.input,assignment,model);}catch(e){context.failed=true;throw e;}
  const {data:call,error:ce}=await client.from('ai_model_call').insert({route_key:key,request_id:context.id,model_key:model.model_key,assignment_revision:assignment.revision,rate_snapshot:{billing_type:model.billing_type,unit_price_usd:model.unit_price_usd,output_unit_price_usd:model.output_unit_price_usd,source_url:model.cost_source_url},status:'starting'}).select('id').single();
  if(ce)fail('Journal des appels indisponible; aucun appel envoyé',503);
  const target=model.version_id?'https://api.replicate.com/v1/predictions':`https://api.replicate.com/v1/models/${model.model_key}/predictions`;
  const payload={...body,input:providerInput};delete payload.version;if(model.version_id)payload.version=model.version_id;
  try{
   const response=await nativeFetch(target,{method:'POST',headers:request.headers,body:JSON.stringify(payload),signal:request.signal});
   const prediction=await response.clone().json().catch(()=>({}));
   if(!response.ok||prediction.status==='failed'||prediction.status==='canceled')context.failed=true;
   await client.from('ai_model_call').update({status:prediction.status||(response.ok?'submitted':'failed'),prediction_id:prediction.id||null}).eq('id',call.id);
   return response;
  }catch(e){context.failed=true;await client.from('ai_model_call').update({status:'transport_error'}).eq('id',call.id);throw e;}
 };
}
