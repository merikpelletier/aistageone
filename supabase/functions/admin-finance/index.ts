import { serveWithCors } from '../_shared/adminFinanceCors.ts';
import { authenticated,serviceClient,httpError } from '../_shared/financeRuntime.ts';
import { syncRecentUsage } from '../_shared/financeSync.ts';
import { monthRange,requiredPositive } from '../_shared/financeMath.ts';

const text=(v:unknown,max=1000)=>String(v || '').trim().slice(0,max);
function requiredText(v:unknown,label:string,max=1000){const s=text(v,max);if(!s)throw httpError(label);return s;}
function date(v:unknown){const s=String(v);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||new Date(s).toISOString().slice(0,10)!==s)throw httpError('Date invalide');return s;}
function amount(v:unknown){return requiredPositive(v,'Montant invalide');}
function nonnegative(v:unknown){if(v==null||v==='')throw httpError('Montant requis');const n=Number(v);if(!Number.isFinite(n)||n<0||n>=1e9)throw httpError('Montant invalide');return n;}
function checked(result:any){if(result.error)throw httpError(result.error.message,500);return result.data;}

serveWithCors(async request=>{
  const user=await authenticated(request);
  if(user.app_metadata?.role!=='admin')throw httpError('Accès administrateur requis',403);
  const service=serviceClient();const p=await request.json();
  const action=p.action || 'overview';
  if(action==='save_settings'){
    const values={credit_value_cad:p.credit_value_cad==null||p.credit_value_cad===''?null:amount(p.credit_value_cad),usd_to_cad_rate:p.usd_to_cad_rate==null||p.usd_to_cad_rate===''?null:amount(p.usd_to_cad_rate),quotes_enabled:false,updated_by:user.id,updated_at:new Date().toISOString()};
    if(values.quotes_enabled && (!values.credit_value_cad||!values.usd_to_cad_rate))throw httpError('Renseignez la valeur du crédit et la conversion avant activation.');
    return Response.json(checked(await service.from('ai_finance_settings').update(values).eq('id',true).select().single()));
  }
  if(action==='save_rate'){
    if(user.id!=='fd3ceec1-0d99-4d7e-9793-284e342efe90')throw httpError('Seul Merik peut modifier les tarifs des modèles',403);
    const model=requiredText(p.model_key,'Modèle requis',200);
    if(!/^([a-z0-9_.-]+\/[a-z0-9_.-]+|version:[a-f0-9]{64})$/i.test(model))throw httpError('Identifiant de modèle invalide');
    const existing=checked(await service.from('ai_model_catalog').select('model_key').eq('model_key',model).maybeSingle());
    if(existing)throw httpError('Modifie les tarifs de ce modèle dans l’onglet Modèles IA.');
    const source=new URL(requiredText(p.source_url,'Source officielle requise'));
    if(source.protocol!=='https:' || source.hostname!=='replicate.com')throw httpError('Utilisez une source officielle replicate.com');
    const kind=p.billing_type;
    if(!['prediction','characters','output_seconds','runtime_seconds','tokens'].includes(kind))throw httpError('Unité invalide');
    const max=p.max_runtime_seconds==null||p.max_runtime_seconds===''?null:Number(p.max_runtime_seconds);
    if(max!=null && (!Number.isInteger(max)||max<5||max>240))throw httpError('Temps de calcul : de 5 à 240 secondes');
    if(kind==='runtime_seconds'&&!max)throw httpError('Limite de calcul requise');
    const output=p.output_unit_price_usd==null||p.output_unit_price_usd===''?null:nonnegative(p.output_unit_price_usd);
    if(kind==='tokens'&&output==null)throw httpError('Tarif des unités de sortie requis');
    return Response.json(checked(await service.from('ai_model_rate').upsert({model_key:model,billing_type:kind,unit_price_usd:amount(p.unit_price_usd),output_unit_price_usd:output,max_runtime_seconds:max,source_url:source.href,notes:text(p.notes),quote_enabled:p.quote_enabled===true,updated_at:new Date().toISOString(),updated_by:user.id}).select().single()));
  }
  if(action==='record_entry'){
    if(!['expense','member_payout','income'].includes(p.entry_type)||!['CAD','USD','EUR'].includes(p.currency))throw httpError('Type ou devise invalide');
    return Response.json(checked(await service.from('finance_entry').insert({entry_type:p.entry_type,currency:p.currency,amount:amount(p.amount),occurred_on:date(p.occurred_on),label:requiredText(p.label,'Libellé requis',200),reference:requiredText(p.reference,'Référence du paiement réel requise',200),notes:text(p.notes),created_by:user.id}).select().single()));
  }
  if(action==='confirm_tax'){
    monthRange(p.month);
    const order=checked(await service.from('order').select('id,status').eq('id',p.order_id).single());
    if(!['paid','completed','shipped','delivered'].includes(order.status))throw httpError('La commande doit être payée');
    return Response.json(checked(await service.from('finance_tax_confirmation').insert({order_id:order.id,tax_month:`${p.month}-01`,currency:'CAD',tps:nonnegative(p.tps),tvq:nonnegative(p.tvq),reference:requiredText(p.reference,'Référence du justificatif requise',200),confirmed_by:user.id}).select().single()));
  }
  if(action==='record_tax_deposit'){
    monthRange(p.month);
    return Response.json(checked(await service.rpc('finance_record_tax_deposit',{p_month:`${p.month}-01`,p_date:date(p.deposited_on),p_reference:requiredText(p.reference,'Référence du dépôt requise',200),p_notes:text(p.notes),p_user:user.id})));
  }
  if(action!=='overview')throw httpError('Action inconnue');
  const sync=await syncRecentUsage(service);
  const {start,end}=monthRange(p.month || new Date().toISOString().slice(0,7));
  const month=start.slice(0,7);
  const requests={
    settings:service.from('ai_finance_settings').select('*').eq('id',true).single(),
    rates:service.from('ai_model_rate').select('*').order('model_key'),
    pricing:service.from('tool_pricing').select('id,tool_id,tool_name,token_cost,is_active,category').order('tool_id').limit(501),
    events:service.from('ai_usage_event').select('*').gte('created_at',start).lt('created_at',end).order('created_at',{ascending:false}).limit(501),
    quotes:service.from('ai_quote').select('id,function_name,tool_id,status,credit_price,charged_credits,credit_value_cad,cost_usd,usd_to_cad_rate,created_at,completed_at').gte('created_at',start).lt('created_at',end).order('created_at',{ascending:false}).limit(501),
    charges:service.from('ai_credit_charge').select('id,tool_id,credit_cost,status,created_at').gte('created_at',start).lt('created_at',end).order('created_at',{ascending:false}).limit(501),
    orders:service.from('order').select('id,order_id,total,tps,tvq,status,payment_date,created_date').or(`and(payment_date.gte.${start},payment_date.lt.${end}),and(payment_date.is.null,created_date.gte.${start},created_date.lt.${end})`).order('created_date',{ascending:false}).limit(501),
    tokens:service.from('token_transaction').select('id,transaction_type,token_amount,payment_id,related_entity,created_at,created_date').or(`and(created_at.gte.${start},created_at.lt.${end}),and(created_at.is.null,created_date.gte.${start},created_date.lt.${end})`).order('created_date',{ascending:false}).limit(501),
    sponsors:service.from('sponsor_sale').select('id,bracket_name,total_amount,platform_share,member_share,sale_date,created_date').or(`and(sale_date.gte.${start},sale_date.lt.${end}),and(sale_date.is.null,created_date.gte.${start},created_date.lt.${end})`).order('created_date',{ascending:false}).limit(501),
    assets:service.from('asset_purchase').select('id,total_amount,tax_amount,currency,provider,provider_transaction_id,status,created_at,completed_at').gte('created_at',start).lt('created_at',end).order('created_at',{ascending:false}).limit(501),
    entries:service.from('finance_entry').select('*').gte('occurred_on',start.slice(0,10)).lt('occurred_on',end.slice(0,10)).order('occurred_on',{ascending:false}).limit(501),
    taxConfirmations:service.from('finance_tax_confirmation').select('*').eq('tax_month',`${month}-01`).limit(501),
    deposits:service.from('finance_tax_deposit').select('id,tax_month,tps,tvq,deposited_on,reference,created_at').eq('tax_month',`${month}-01`),
  };
  const output:Record<string,any>={};const truncated:string[]=[];
  await Promise.all(Object.entries(requests).map(async([key,query])=>{const rows=checked(await query);if(Array.isArray(rows)&&rows.length>500){truncated.push(key);output[key]=rows.slice(0,500);}else output[key]=rows;}));
  return Response.json({...output,sync,month,time_zone:'UTC',truncated});
});
