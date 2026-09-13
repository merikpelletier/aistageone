import React from 'react';
import {billingUnits} from '../../../supabase/functions/_shared/modelPricing.ts';
const input='mt-1 w-full rounded border border-white/20 bg-neutral-900 p-2 text-white';
const button='rounded border border-white/25 px-3 py-2 text-sm';
function Field({label,...props}){return <label className="block text-sm">{label}<input className={input} {...props}/></label>;}
const newCondition=()=>({parameter:'',operator:'eq',value:''});
const newRule=()=>({label:'',conditions:[newCondition()],unit_price_usd:'',output_unit_price_usd:'',source_url:''});
export default function ModelPricingFields({model,onChange}){
 const pricing=model.capabilities?.pricing||{mode:'fixed',quantity:1000,rules:[]};
 const rules=pricing.rules||[];
 const update=p=>onChange({...model,capabilities:{...model.capabilities,pricing:{...pricing,...p}}});
 const ruleUpdate=(index,value)=>update({rules:rules.map((r,i)=>i===index?{...r,...value}:r)});
 const fields=model.schema?.components?.schemas?.Input?.properties||{};
 const fieldInfo=key=>{let f=fields[key];if(f?.allOf?.length===1)f=f.allOf[0];if(f?.$ref)f=f.$ref.slice(2).split('/').reduce((a,k)=>a?.[k],model.schema);return f||{};};
 const token=model.billing_type==='tokens';
 return <div className="space-y-4 rounded border border-white/15 p-4 md:col-span-2">
  <h4 className="font-medium">Tarification du fournisseur</h4>
  <div className="grid gap-4 md:grid-cols-2">
   <label>Unité de facturation<select className={input} value={model.billing_type||'prediction'} onChange={e=>onChange({...model,billing_type:e.target.value})}>{Object.entries(billingUnits).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   <label>Type de tarif<select className={input} value={pricing.mode} onChange={e=>update({mode:e.target.value,rules:e.target.value==='conditional'&&!rules.length?[newRule()]:rules})}><option value="fixed">Prix fixe</option><option value="conditional">Prix selon les paramètres</option></select></label>
   {['tokens','characters'].includes(model.billing_type)&&<label>Quantité couverte par le prix<select className={input} value={pricing.quantity||1000} onChange={e=>update({quantity:Number(e.target.value)})}><option value="1">1</option><option value="1000">1 000</option><option value="1000000">1 000 000</option></select></label>}
  </div>
  {pricing.mode==='fixed'?<div className="grid gap-4 md:grid-cols-2">
   <Field required={model.enabled} label={token?'Prix des tokens d’entrée (USD)':'Prix par unité (USD)'} type="number" min="0" step="any" value={model.unit_price_usd??''} onChange={e=>onChange({...model,unit_price_usd:e.target.value})}/>
   {token&&<Field required={model.enabled} label="Prix des tokens de sortie (USD)" type="number" min="0" step="any" value={model.output_unit_price_usd??''} onChange={e=>onChange({...model,output_unit_price_usd:e.target.value})}/>}
  </div>:<>
   <p className="text-sm text-white/60">Ajoute une ligne pour chaque tarif. Combine les conditions si le prix dépend de plusieurs paramètres : résolution, qualité, durée, audio… Les paramètres proposés proviennent du modèle importé. Les montants sont à saisir par toi.</p>
   {!Object.keys(fields).length&&<p className="text-amber-200 text-sm">Importe les informations du modèle pour choisir ses paramètres.</p>}
   {rules.map((rule,index)=><fieldset className="space-y-3 rounded border border-white/15 p-3" key={index}>
    <legend className="px-2">Tarif {index+1}</legend>
    <Field label="Libellé (facultatif)" value={rule.label||''} onChange={e=>ruleUpdate(index,{label:e.target.value})}/>
    {rule.conditions.map((condition,ci)=>{
     const f=fieldInfo(condition.parameter),numeric=['number','integer'].includes(f.type);
     const edit=changes=>ruleUpdate(index,{conditions:rule.conditions.map((c,i)=>i===ci?{...c,...changes}:c)});
     return <div className="grid items-end gap-2 md:grid-cols-[1fr_1fr_1fr_auto]" key={ci}>
      <label className="text-sm">{ci?'Et le paramètre':'Paramètre'}<select required className={input} value={condition.parameter} onChange={e=>edit({parameter:e.target.value,operator:'eq',value:''})}><option value="">Choisir…</option>{Object.entries(fields).filter(([key])=>['string','number','integer','boolean'].includes(fieldInfo(key).type)||fieldInfo(key).enum).map(([key,field])=><option value={key} key={key}>{field.title||key} ({key})</option>)}</select></label>
      <label className="text-sm">Condition<select className={input} value={condition.operator} onChange={e=>edit({operator:e.target.value})}><option value="eq">Égal à</option>{numeric&&<><option value="gte">Au moins</option><option value="lte">Au plus</option></>}</select></label>
      <label className="text-sm">Valeur{f.type==='boolean'?<select required className={input} value={String(condition.value)} onChange={e=>edit({value:e.target.value})}><option value="">Choisir…</option><option value="true">Oui</option><option value="false">Non</option></select>:f.enum?<select required className={input} value={condition.value} onChange={e=>edit({value:e.target.value})}><option value="">Choisir…</option>{f.enum.map(v=><option key={String(v)} value={v}>{String(v)}</option>)}</select>:<input required className={input} type={numeric?'number':'text'} step="any" value={condition.value} onChange={e=>edit({value:e.target.value})}/>}</label>
      <button type="button" className={button} aria-label={`Retirer la condition ${ci+1} du tarif ${index+1}`} disabled={rule.conditions.length===1} onClick={()=>ruleUpdate(index,{conditions:rule.conditions.filter((_,i)=>i!==ci)})}>Retirer</button>
     </div>;
    })}
    <button type="button" className={button} onClick={()=>ruleUpdate(index,{conditions:[...rule.conditions,newCondition()]})}>Ajouter une condition</button>
    <div className="grid gap-3 md:grid-cols-2">
     <Field required label={token?'Prix d’entrée (USD)':'Prix par unité (USD)'} type="number" min="0" step="any" value={rule.unit_price_usd??''} onChange={e=>ruleUpdate(index,{unit_price_usd:e.target.value})}/>
     {token&&<Field required label="Prix de sortie (USD)" type="number" min="0" step="any" value={rule.output_unit_price_usd??''} onChange={e=>ruleUpdate(index,{output_unit_price_usd:e.target.value})}/>}
    </div>
    <button type="button" className={button} onClick={()=>update({rules:rules.filter((_,i)=>i!==index)})}>Supprimer ce tarif</button>
   </fieldset>)}
   <button type="button" className={button} onClick={()=>update({rules:[...rules,newRule()]})}>Ajouter un tarif</button>
   <p className="text-xs text-white/60">Une seule ligne doit correspondre à la génération. Si aucune ligne ne correspond, ou si plusieurs se chevauchent, le coût reste inconnu. Aucun prix de remplacement n’est appliqué.</p>
  </>}
 </div>;
}
