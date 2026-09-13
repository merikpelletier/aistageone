import { createClient } from 'npm:@supabase/supabase-js@2.112.2';
import { serveWithCors } from '../_shared/adminFinanceCors.ts';
import { MODEL_OWNER,BLOCKED_MODEL,fail } from '../_shared/modelControlPolicy.ts';
import { normalizePricing } from '../_shared/modelPricing.ts';
import { importModel } from '../_shared/modelImport.ts';
import { checkReplicateConnection } from '../_shared/providerConnection.ts';
// A read-only startup health check verifies the configured credential without generating media.
const connectionReady=checkReplicateConnection().catch(()=>null);
const positive=(v:any)=>v==null||v===''?null:Number(v);
serveWithCors(async request=>{
 const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:request.headers.get('Authorization')||''}},auth:{persistSession:false}});
 const {data:identity,error}=await client.auth.getUser();if(error||!identity.user)fail('Connexion requise',401);if(identity.user.id!==MODEL_OWNER)fail('Seul Merik peut gérer les modèles IA',403);
 const p=await request.json();
 if(p.action==='overview'){
  const results=await Promise.all(['ai_model_catalog','ai_model_assignment','ai_model_audit','ai_model_call'].map((t,i)=>client.from(t).select('*').order(i<2?(i===0?'model_key':'route_key'):'created_at',{ascending:i<2}).limit(i<2?1000:100)));
  if(results.some(r=>r.error))fail('Lecture du registre impossible',500);
  const connection=await checkReplicateConnection();
  return Response.json({models:results[0].data,assignments:results[1].data,audit:results[2].data,calls:results[3].data,owner:true,connection});
 }
 if(p.action==='import_model'){
  await connectionReady;
  try{return Response.json(await importModel(p.model_key,Deno.env.get('REPLICATE_API_TOKEN')));}catch(e){fail(e instanceof Error?e.message:'Import impossible',422);}
 }
 if(p.action==='save_model'){
  const m=p.model;const key=String(m.model_key||'').trim().toLowerCase();if(key===BLOCKED_MODEL)fail('Seedream 4.5 est interdit');
  const value={...m,unit_price_usd:positive(m.unit_price_usd),output_unit_price_usd:positive(m.output_unit_price_usd),cost_checked_at:m.unit_price_usd!==''&&m.unit_price_usd!=null?new Date().toISOString():null};
  // Keep an internal model reference for existing snapshots; the owner need not supply a link.
  value.cost_source_url=m.cost_source_url||`https://replicate.com/${key}`;
  let pricing;try{pricing=normalizePricing(m);}catch(e){fail(e instanceof Error?e.message:'Tarification invalide',422);}
  value.capabilities={...m.capabilities,pricing};
  if(pricing.mode==='conditional'){
   // Compatibility reference for the existing model gate; never used as a fallback tariff.
   value.unit_price_usd=Math.min(...pricing.rules.map((r:any)=>r.unit_price_usd));
   value.output_unit_price_usd=m.billing_type==='tokens'?Math.min(...pricing.rules.map((r:any)=>r.output_unit_price_usd)):null;
   value.cost_source_url=pricing.rules[0].source_url;value.cost_checked_at=new Date().toISOString();
  }
  if(value.unit_price_usd!=null&&(!Number.isFinite(value.unit_price_usd)||value.unit_price_usd<0))fail('Tarif invalide');
  if(value.enabled&&!value.schema?.components?.schemas?.Input)fail('Importez les informations du modèle avant activation');
  if(value.billing_type==='tokens'&&value.enabled&&value.output_unit_price_usd==null)fail('Tarif des unités de sortie requis');
  const {data,error}=await client.rpc('ai_model_save',{p_entity:'model',p_key:key,p_value:value,p_revision:m.revision||0});if(error)fail(error.message);return Response.json(data);
 }
 if(p.action==='save_assignment'){
  const a=p.assignment;if(typeof a.input_mapping!=='object'||Array.isArray(a.input_mapping)||typeof a.defaults!=='object'||Array.isArray(a.defaults))fail('Correspondances invalides');
  const {data,error}=await client.rpc('ai_model_save',{p_entity:'assignment',p_key:a.route_key,p_value:a,p_revision:a.revision});if(error)fail(error.message);return Response.json(data);
 }
 fail('Action inconnue');
});
