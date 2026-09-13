import { calculateUsageCost,outputCount } from './modelPricing.ts';
export async function syncRecentUsage(service:any) {
 const token=Deno.env.get('REPLICATE_API_TOKEN');
 if(!token)return {warning:'Accès à l’historique Replicate non configuré.'};
 try {
  const response=await fetch('https://api.replicate.com/v1/predictions',{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000)});
  if(!response.ok)return {warning:`Historique Replicate indisponible (${response.status}). Les écritures déjà enregistrées restent accessibles.`};
  const payload=await response.json(); const predictions=Array.isArray(payload.results)?payload.results.slice(0,100):[];
  const [{data:settings},{data:rates,error:rateError}]=await Promise.all([service.from('ai_finance_settings').select('*').eq('id',true).single(),service.from('ai_model_rate').select('*')]);
  if(rateError)throw rateError;
  const {data:catalog,error:catalogError}=await service.from('ai_model_catalog').select('model_key,billing_type,unit_price_usd,output_unit_price_usd,cost_source_url,capabilities');
  if(catalogError)throw catalogError;
  for(const rate of catalog||[]){if(rate.unit_price_usd!=null){const index=(rates||[]).findIndex((r:any)=>r.model_key===rate.model_key);const value={...rate,source_url:rate.cost_source_url,pricing:rate.capabilities?.pricing};if(index>=0)rates[index]=value;else rates.push(value);}}
  const ids=predictions.map((p:any)=>p.id).filter(Boolean);
  if(!ids.length)return {imported:0,checked_at:new Date().toISOString()};
  const {data:old,error:oldError}=await service.from('ai_usage_event').select('*').in('prediction_id',ids);if(oldError)throw oldError;
  const {data:calls,error:callError}=await service.from('ai_model_call').select('prediction_id,model_key,rate_snapshot').in('prediction_id',ids);if(callError)throw callError;
  const submitted=new Map((calls||[]).map((c:any)=>[c.prediction_id,c]));
  const previous=new Map((old||[]).map((e:any)=>[e.prediction_id,e]));
  const number=(v:any)=>v!=null&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
  const events=predictions.filter((p:any)=>p.id).map((p:any)=>{
   const prior:any=previous.get(p.id);const call:any=submitted.get(p.id);const model=call?.model_key || p.model || (p.version?`version:${p.version}`:'unknown');
   const rate=call?.rate_snapshot || prior?.rate_snapshot || (rates||[]).find((r:any)=>r.model_key===model) || null;
   const usage={output_count:outputCount(p.output),runtime_seconds:number(p.metrics?.predict_time),input_tokens:number(p.metrics?.input_token_count),output_tokens:number(p.metrics?.output_token_count),characters:typeof p.input?.text==='string'?p.input.text.length:null,requested_output_seconds:number(p.input?.duration)};
   const {cost,selected}=calculateUsageCost(rate,p,usage);
   const fx=prior?.usd_to_cad_rate || settings?.usd_to_cad_rate || null;
   return {prediction_id:p.id,model_key:model,model_version:p.version||null,status:p.status||'unknown',usage,rate_snapshot:selected||rate,usd_to_cad_rate:fx,cost_usd:cost,cost_cad:cost!=null&&fx?cost*Number(fx):null,created_at:prior?.created_at||p.created_at||new Date().toISOString(),updated_at:new Date().toISOString(),completed_at:p.completed_at||null};
  });
  const {error}=await service.from('ai_usage_event').upsert(events,{onConflict:'prediction_id'});if(error)throw error;
  return {imported:events.length,checked_at:new Date().toISOString(),warning:payload.next?'Collecte limitée aux appels récents disponibles; historique incomplet.':null};
 }catch{return {warning:'La synchronisation Replicate est momentanément indisponible. Les écritures déjà enregistrées restent accessibles.'};}
}
