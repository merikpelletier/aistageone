export const billingUnits = {
 prediction:'Par génération', output_images:'Par image produite', output_videos:'Par vidéo produite',
 output_seconds:'Par seconde produite', runtime_seconds:'Par seconde de calcul',
 characters:'Par caractères', tokens:'Par tokens (entrée et sortie)',
};
const amount=(v:any)=>{if(v==null||v===''||typeof v==='boolean'||!Number.isFinite(Number(v))||Number(v)<0||Number(v)>=1000000)throw Error('Renseigne un tarif valide en USD.');return Number(v);};
function fieldSchema(model:any,key:string){let f=model.schema?.components?.schemas?.Input?.properties?.[key];if(f?.allOf?.length===1)f=f.allOf[0];if(f?.$ref)f=f.$ref.slice(2).split('/').reduce((a:any,k:string)=>a?.[k],model.schema);return f;}
export function normalizePricing(model:any){
 const p=model.capabilities?.pricing||{mode:'fixed'};
 if(!(model.billing_type in billingUnits))throw Error('Unité de facturation invalide.');
 const quantity=['tokens','characters'].includes(model.billing_type)?Number(p.quantity||1000):1;
 if(![1,1000,1000000].includes(quantity))throw Error('Quantité de facturation invalide.');
 if(!['fixed','conditional'].includes(p.mode))throw Error('Mode de tarification invalide.');
 if(p.mode==='fixed')return {mode:'fixed',quantity};
 if(!Array.isArray(p.rules)||!p.rules.length||p.rules.length>100)throw Error('Ajoute au moins une ligne de tarif.');
 const signatures=new Set();
 const rules=p.rules.map((r:any)=>{
  if(!Array.isArray(r.conditions)||!r.conditions.length||r.conditions.length>10)throw Error('Chaque tarif doit préciser ses conditions.');
  const conditions=r.conditions.map((c:any)=>{
   const parameter=String(c.parameter||'').trim(),f=fieldSchema(model,parameter);
   if(!f)throw Error('Choisis un paramètre déclaré par le modèle.');
   if(!['eq','gte','lte'].includes(c.operator))throw Error('Comparaison invalide.');
   let value:any=c.value;if(value==null||value==='')throw Error('Renseigne la valeur de chaque condition.');
   if(f.type==='boolean'){if(![true,false,'true','false'].includes(value))throw Error('Choisis Oui ou Non.');value=value===true||value==='true';}
   else if(['number','integer'].includes(f.type)||c.operator!=='eq'){value=Number(value);if(!Number.isFinite(value))throw Error('Valeur numérique invalide.');}
   else value=String(value);
   if(c.operator!=='eq'&&!['number','integer'].includes(f.type))throw Error('Les bornes sont réservées aux paramètres numériques.');
   if(f.enum&&!f.enum.includes(value))throw Error('Valeur non admise par le modèle.');
   return {parameter,operator:c.operator,value};
  });
  const signature=JSON.stringify([...conditions].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
  if(signatures.has(signature))throw Error('Deux lignes ont les mêmes conditions.');signatures.add(signature);
  return {label:String(r.label||'').slice(0,200),conditions,unit_price_usd:amount(r.unit_price_usd),output_unit_price_usd:model.billing_type==='tokens'?amount(r.output_unit_price_usd):null,source_url:r.source_url||`https://replicate.com/${model.model_key}`};
 });
 return {mode:'conditional',quantity,rules};
}
export function resolveTariff(rate:any,input:any){
 if(!rate)return null;
 const pricing=rate.pricing||rate.capabilities?.pricing;
 if(pricing?.mode!=='conditional')return rate.unit_price_usd==null?null:rate;
 const matches=(pricing.rules||[]).filter((r:any)=>r.conditions?.length&&r.conditions.every((c:any)=>{
  const value=input?.[c.parameter];if(value==null)return false;
  if(c.operator==='eq')return typeof c.value==='boolean'?value===c.value:String(value)===String(c.value);
  if(typeof value==='boolean'||value===''||!Number.isFinite(Number(value)))return false;
  return c.operator==='gte'?Number(value)>=Number(c.value):c.operator==='lte'?Number(value)<=Number(c.value):false;
 }));
 if(matches.length!==1)return null;
 return {...rate,...matches[0],pricing,matched_conditions:matches[0].conditions};
}
export function outputCount(output:any){
 if(typeof output==='string'&&output.length)return 1;
 if(Array.isArray(output)&&output.length&&output.every(v=>typeof v==='string'&&v.length))return output.length;
 return null;
}
export function calculateUsageCost(rate:any,p:any,usage:any){
 const selected=resolveTariff(rate,p.input);if(!selected)return {cost:null,selected:null};
 const unit=Number(selected.unit_price_usd);if(!Number.isFinite(unit)||unit<0)return {cost:null,selected:null};
 const quantity=selected.pricing?.quantity||selected.capabilities?.pricing?.quantity||1000;
 let cost=null;
 if(['succeeded','failed','canceled'].includes(p.status)&&selected.billing_type==='runtime_seconds'&&usage.runtime_seconds!=null)cost=usage.runtime_seconds*unit;
 else if(p.status==='succeeded'){
  if(selected.billing_type==='prediction')cost=unit;
  if(['output_images','output_videos'].includes(selected.billing_type)&&usage.output_count!=null)cost=usage.output_count*unit;
  if(selected.billing_type==='characters'&&usage.characters!=null)cost=usage.characters*unit/quantity;
  if(selected.billing_type==='output_seconds'&&usage.requested_output_seconds!=null)cost=usage.requested_output_seconds*unit;
  if(selected.billing_type==='tokens'&&usage.input_tokens!=null&&usage.output_tokens!=null&&selected.output_unit_price_usd!=null)cost=(usage.input_tokens*unit+usage.output_tokens*Number(selected.output_unit_price_usd))/quantity;
 }
 return {cost:cost==null?null:Math.round(cost*1e12)/1e12,selected};
}
