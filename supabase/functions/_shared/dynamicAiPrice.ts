import { resolveTariff } from './modelPricing.ts';

const PRIMARY_KIND:Record<string,string>={
  'replicateGenerate:body_and_voice':'video',
  'replicateGenerate:faceswitch':'processing',
  'replicateGenerate:character_photo':'image',
  'replicateGenerate:reference_sheet_swap':'image',
  'replicateGenerate:character_sheet':'image',
  'replicateGenerate:animate_image':'video',
  'replicateGenerate:animate_with_reference':'video',
  'replicateGenerate:lip_sync':'video',
  'replicateGenerate:headshot':'image',
  'replicateGenerate:compose_scene':'image',
  'replicateGenerate:text_to_video':'video',
};

const firstNumber=(input:any,keys:string[])=>{
  for(const k of keys){const n=Number(input?.[k]);if(Number.isFinite(n)&&n>0)return n;}
  return null;
};
const textLength=(input:any)=>{
  for(const k of ['text','prompt','input','script'])if(typeof input?.[k]==='string'&&input[k].length)return input[k].length;
  return null;
};

export async function quoteAiService(serviceClient:any,service:string,rawInput:any={},requestedModel?:string|null,kind?:string|null){
  const preferredKind=kind||PRIMARY_KIND[service]||null;
  let q=serviceClient.from('ai_model_route_option')
    .select('route_key,service,kind,model_key,enabled,recommended,display_order,input_mapping,defaults')
    .eq('service',service).eq('enabled',true);
  if(preferredKind)q=q.eq('kind',preferredKind);
  const {data:options,error}=await q.order('recommended',{ascending:false}).order('display_order',{ascending:true});
  if(error)throw new Error(error.message);
  let option=(options||[]).find((o:any)=>requestedModel&&o.model_key===requestedModel)
    ||(options||[]).find((o:any)=>o.recommended)
    ||(options||[])[0];
  if(!option)throw new Error('Aucun modèle tarifable pour ce service');

  const {data:model,error:modelError}=await serviceClient.from('ai_model_catalog').select('*').eq('model_key',option.model_key).eq('enabled',true).maybeSingle();
  if(modelError||!model)throw new Error(modelError?.message||'Modèle tarifable introuvable');

  const props=model.schema?.components?.schemas?.Input?.properties||{};
  const providerInput:any={...rawInput};
  for(const [key,field] of Object.entries(props)){
    const source=option.input_mapping?.[key]||key;
    if(providerInput[key]===undefined&&rawInput?.[source]!==undefined)providerInput[key]=rawInput[source];
    if(providerInput[key]===undefined&&option.defaults?.[key]!==undefined)providerInput[key]=option.defaults[key];
    if(providerInput[key]===undefined&&(field as any)?.default!==undefined)providerInput[key]=(field as any).default;
  }
  if(providerInput.generate_audio===undefined&&rawInput?.audio_url!==undefined)providerInput.generate_audio=Boolean(rawInput.audio_url);
  if(providerInput.duration===undefined&&rawInput?.duration!==undefined)providerInput.duration=rawInput.duration;
  if(providerInput.resolution===undefined&&rawInput?.resolution!==undefined)providerInput.resolution=rawInput.resolution;
  const selected=resolveTariff(model,providerInput);
  if(!selected)throw new Error('Le tarif de ce modèle ne peut pas être déterminé avec ces paramètres');

  const unit=Number(selected.unit_price_usd);
  if(!Number.isFinite(unit)||unit<0)throw new Error('Tarif fournisseur invalide');
  let providerCostUsd:number|null=null;
  let estimated=false;
  const billing=selected.billing_type;

  if(billing==='prediction')providerCostUsd=unit;
  else if(billing==='output_seconds'){
    const seconds=firstNumber(providerInput,['duration','duration_seconds','seconds','video_length','length']);
    if(seconds==null)throw new Error('Durée requise pour calculer le prix');
    providerCostUsd=seconds*unit;
  }else if(billing==='runtime_seconds'){
    const seconds=firstNumber(providerInput,['duration','duration_seconds','seconds','video_length','length']);
    if(seconds==null)throw new Error('Durée requise pour estimer le prix');
    providerCostUsd=seconds*unit;estimated=true;
  }else if(billing==='output_images'||billing==='output_videos'){
    const count=firstNumber(providerInput,['num_outputs','number_of_images','num_images','count'])||1;
    providerCostUsd=count*unit;
  }else if(billing==='characters'){
    const chars=textLength(providerInput);
    if(chars==null)throw new Error('Texte requis pour calculer le prix');
    const quantity=Number(selected.pricing?.quantity||selected.capabilities?.pricing?.quantity||1000);
    providerCostUsd=chars*unit/quantity;
  }else if(billing==='tokens'){
    const chars=textLength(providerInput);
    if(chars==null)throw new Error('Texte requis pour estimer le prix');
    const quantity=Number(selected.pricing?.quantity||selected.capabilities?.pricing?.quantity||1000);
    const inputTokens=Math.max(1,Math.ceil(chars/4));
    const outputTokens=firstNumber(providerInput,['max_output_tokens','max_tokens'])||inputTokens;
    const out=Number(selected.output_unit_price_usd);
    if(!Number.isFinite(out)||out<0)throw new Error('Tarif de sortie manquant');
    providerCostUsd=(inputTokens*unit+outputTokens*out)/quantity;estimated=true;
  }else throw new Error('Mode de facturation non pris en charge');

  const {data:settings,error:settingsError}=await serviceClient.from('credit_economy_settings').select('credit_value_cad,usd_to_cad_rate,cost_buffer_pct').eq('id',true).single();
  if(settingsError||!settings)throw new Error(settingsError?.message||'Conversion crédits indisponible');
  const fx=Number(settings.usd_to_cad_rate),value=Number(settings.credit_value_cad),buffer=Number(settings.cost_buffer_pct||0);
  if(!(fx>0)||!(value>0))throw new Error('Conversion crédits invalide');
  const costCad=providerCostUsd*fx;
  const bufferedCad=costCad*(1+buffer/100);
  const credits=Math.max(1,Math.ceil(bufferedCad/value));

  return {
    service,model_key:model.model_key,model_name:model.name||model.model_key,billing_type:billing,
    provider_input:providerInput,provider_cost_usd:providerCostUsd,cost_cad:costCad,
    buffer_pct:buffer,credit_value_cad:value,usd_to_cad_rate:fx,credits,estimated,
    tariff_label:selected.label||null,source_url:selected.source_url||model.cost_source_url||null,
  };
}
