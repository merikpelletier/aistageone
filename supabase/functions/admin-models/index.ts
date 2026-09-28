import { createClient } from 'npm:@supabase/supabase-js@2.112.2';
import { serveWithCors } from '../_shared/adminFinanceCors.ts';
import { MODEL_OWNER,BLOCKED_MODEL,fail } from '../_shared/modelControlPolicy.ts';
import { normalizePricing } from '../_shared/modelPricing.ts';
import { importModel } from '../_shared/modelImport.ts';
import { checkReplicateConnection } from '../_shared/providerConnection.ts';

const connectionReady=checkReplicateConnection().catch(()=>null);
const positive=(v:any)=>v==null||v===''?null:Number(v);
const jsonObject=(v:any)=>v&&typeof v==='object'&&!Array.isArray(v);

serveWithCors(async request=>{
 const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:request.headers.get('Authorization')||''}},auth:{persistSession:false}});
 const {data:identity,error}=await client.auth.getUser();
 if(error||!identity.user)fail('Connexion requise',401);
 if(identity.user.id!==MODEL_OWNER)fail('Seul Merik peut gérer les modèles IA',403);
 const p=await request.json();

 if(p.action==='overview'){
  const [models,assignments,routeOptions,audit,calls]=await Promise.all([
   client.from('ai_model_catalog').select('*').order('model_key',{ascending:true}).limit(1000),
   client.from('ai_model_assignment').select('*').order('route_key',{ascending:true}).limit(1000),
   client.rpc('admin_ai_model_route_options'),
   client.from('ai_model_audit').select('*').order('created_at',{ascending:false}).limit(100),
   client.from('ai_model_call').select('*').order('created_at',{ascending:false}).limit(100)
  ]);
  if(models.error||assignments.error||routeOptions.error||audit.error||calls.error)fail('Lecture du registre impossible',500);
  const connection=await checkReplicateConnection();
  return Response.json({models:models.data,assignments:assignments.data,route_options:routeOptions.data||[],audit:audit.data,calls:calls.data,owner:true,connection});
 }

 if(p.action==='import_model'){
  await connectionReady;
  try{return Response.json(await importModel(p.model_key,Deno.env.get('REPLICATE_API_TOKEN')));}
  catch(e){fail(e instanceof Error?e.message:'Import impossible',422);}
 }

 if(p.action==='save_model'){
  const m=p.model;
  const key=String(m.model_key||'').trim().toLowerCase();
  if(key===BLOCKED_MODEL)fail('Seedream 4.5 est interdit');
  const value={...m,unit_price_usd:positive(m.unit_price_usd),output_unit_price_usd:positive(m.output_unit_price_usd),cost_checked_at:m.unit_price_usd!==''&&m.unit_price_usd!=null?new Date().toISOString():null};
  value.cost_source_url=m.cost_source_url||`https://replicate.com/${key}`;
  let pricing;
  try{pricing=normalizePricing(m);}catch(e){fail(e instanceof Error?e.message:'Tarification invalide',422);}
  value.capabilities={...m.capabilities,pricing};
  if(pricing.mode==='conditional'){
   value.unit_price_usd=Math.min(...pricing.rules.map((r:any)=>r.unit_price_usd));
   value.output_unit_price_usd=m.billing_type==='tokens'?Math.min(...pricing.rules.map((r:any)=>r.output_unit_price_usd)):null;
   value.cost_source_url=pricing.rules[0].source_url;
   value.cost_checked_at=new Date().toISOString();
  }
  if(value.unit_price_usd!=null&&(!Number.isFinite(value.unit_price_usd)||value.unit_price_usd<0))fail('Tarif invalide');
  if(value.enabled&&!value.schema?.components?.schemas?.Input)fail('Importez les informations du modèle avant activation');
  if(value.billing_type==='tokens'&&value.enabled&&value.output_unit_price_usd==null)fail('Tarif des unités de sortie requis');
  const {data,error}=await client.rpc('ai_model_save',{p_entity:'model',p_key:key,p_value:value,p_revision:m.revision||0});
  if(error)fail(error.message);
  return Response.json(data);
 }

 if(p.action==='save_assignment'){
  const a=p.assignment;
  if(!jsonObject(a.input_mapping)||!jsonObject(a.defaults))fail('Correspondances invalides');
  const {data,error}=await client.rpc('ai_model_save',{p_entity:'assignment',p_key:a.route_key,p_value:a,p_revision:a.revision});
  if(error)fail(error.message);
  return Response.json(data);
 }

 if(p.action==='save_route_option'){
  const o=p.option||{};
  const routeKey=String(o.route_key||'');
  const modelKey=String(o.model_key||'').trim().toLowerCase();
  if(!routeKey||!modelKey)fail('Étape et modèle requis',422);
  if(modelKey===BLOCKED_MODEL)fail('Seedream 4.5 est interdit',422);
  const [{data:route,error:routeError},{data:model,error:modelError}]=await Promise.all([
   client.from('ai_model_assignment').select('route_key,service,kind,input_mapping,defaults').eq('route_key',routeKey).maybeSingle(),
   client.from('ai_model_catalog').select('model_key,kind,enabled').eq('model_key',modelKey).maybeSingle()
  ]);
  if(routeError||!route)fail('Étape IA introuvable',404);
  if(modelError||!model)fail('Modèle introuvable',404);
  if(!model.enabled)fail('Active d’abord ce modèle dans le catalogue',422);
  if(model.kind!==route.kind)fail('Le type du modèle ne correspond pas à cette étape',422);
  if(!jsonObject(o.input_mapping??route.input_mapping)||!jsonObject(o.defaults??route.defaults))fail('Correspondances invalides',422);
  const creditCost=o.credit_cost===''||o.credit_cost==null?null:Number(o.credit_cost);
  if(creditCost!=null&&(!Number.isInteger(creditCost)||creditCost<0))fail('Le coût en crédits doit être un entier positif ou nul',422);
  const value={
   route_key:route.route_key,service:route.service,kind:route.kind,model_key:model.model_key,
   enabled:o.enabled!==false,recommended:Boolean(o.recommended),credit_cost:creditCost,
   display_order:Number.isFinite(Number(o.display_order))?Number(o.display_order):0,
   input_mapping:o.input_mapping??route.input_mapping??{},defaults:o.defaults??route.defaults??{}
  };
  const {data,error}=await client.rpc('admin_ai_model_route_option_save',{p_value:value});
  if(error)fail(error.message,500);
  return Response.json(data);
 }

 if(p.action==='delete_route_option'){
  const routeKey=String(p.route_key||'');
  const modelKey=String(p.model_key||'').trim().toLowerCase();
  if(!routeKey||!modelKey)fail('Étape et modèle requis',422);
  const {error}=await client.rpc('admin_ai_model_route_option_delete',{p_route_key:routeKey,p_model_key:modelKey});
  if(error)fail(error.message,500);
  return Response.json({ok:true});
 }

 fail('Action inconnue');
});