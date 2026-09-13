import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/base44Client';

const fieldClass='mt-1 w-full rounded border border-white/20 bg-neutral-900 p-2 text-white';
const buttonClass='rounded bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-40';
const cash=(n,currency='CAD')=>n==null?'Inconnu':new Intl.NumberFormat('fr-CA',{style:'currency',currency,maximumFractionDigits:4}).format(Number(n));
const dateLabel=v=>v?new Date(v).toLocaleString('fr-CA',{timeZone:'UTC'}):'—';

async function requestFinance(body){
  const {data,error}=await supabase.functions.invoke('admin-finance',{body});
  if(error){let message=error.message;try{message=(await error.context.json()).error||message;}catch{/* Keep transport error. */}throw new Error(message);}
  return data;
}
function Field({label,...props}){return <label className="text-sm text-white/70">{label}<input className={fieldClass} {...props}/></label>;}
function Panel({title,children}){return <section className="space-y-4 rounded-lg border border-white/15 bg-neutral-950 p-5"><h3 className="text-lg font-medium">{title}</h3>{children}</section>;}
function RecordForm({title,fields,action,mutate,pending,extra={}}){
  return <Panel title={title}><form onSubmit={e=>{e.preventDefault();mutate({action,...Object.fromEntries(new FormData(e.currentTarget)),...extra});}} className="grid gap-3 md:grid-cols-3">{fields.map(f=><Field key={f.name} required {...f}/>)}<div className="self-end"><button disabled={pending} className={buttonClass}>Enregistrer</button></div></form></Panel>;
}
function CostSettings({data,mutate,pending}){
  const [settings,setSettings]=useState(data.settings);
  const [rate,setRate]=useState({model_key:'',billing_type:'prediction',unit_price_usd:'',source_url:'',notes:'',quote_enabled:false});
  return <>
    <Panel title="Réglages AISTAGE.ONE">
      <p className="text-sm text-white/60">Les coûts Replicate sont en USD. Le taux de conversion et la valeur nette du crédit servent aux estimations administratives.</p>
      <form onSubmit={e=>{e.preventDefault();mutate({action:'save_settings',...settings});}} className="grid gap-4 md:grid-cols-3">
        <Field label="Valeur nette d’un crédit (CAD)" type="number" min="0.000001" step="any" value={settings.credit_value_cad??''} onChange={e=>setSettings({...settings,credit_value_cad:e.target.value})}/>
        <Field label="1 USD = … CAD" type="number" min="0.000001" step="any" value={settings.usd_to_cad_rate??''} onChange={e=>setSettings({...settings,usd_to_cad_rate:e.target.value})}/>
        <button disabled={pending} className={`${buttonClass} self-end`}>Enregistrer les réglages</button>
      </form>
      <p className="text-xs text-white/50">Ces réglages servent au suivi des coûts. Ils ne modifient pas les prix facturés aux membres.</p>
    </Panel>
    <Panel title="Tarifs Replicate">
      <p className="text-sm text-white/60">Les modèles du catalogue et leurs tarifs selon paramètres se gèrent dans l’onglet Modèles IA. Ce formulaire concerne uniquement les anciens modèles hors catalogue.</p>
      <label className="block text-sm">Modifier un tarif existant<select className={fieldClass} value={rate.model_key} onChange={e=>setRate(data.rates.find(r=>r.model_key===e.target.value)||{model_key:'',billing_type:'prediction',unit_price_usd:'',source_url:'',quote_enabled:false})}><option value="">Nouveau tarif</option>{data.rates.map(r=><option key={r.model_key}>{r.model_key}</option>)}</select></label>
      <form onSubmit={e=>{e.preventDefault();mutate({action:'save_rate',...rate});}} className="grid gap-3 md:grid-cols-3">
        <Field required label="Identifiant du modèle" value={rate.model_key} placeholder="elevenlabs/v3" onChange={e=>setRate({...rate,model_key:e.target.value})}/>
        <label className="text-sm text-white/70">Facturation<select className={fieldClass} value={rate.billing_type} onChange={e=>setRate({...rate,billing_type:e.target.value})}>{[['prediction','Par prédiction'],['characters','Par 1 000 caractères'],['output_seconds','Par seconde produite'],['runtime_seconds','Par seconde de calcul'],['tokens','Par 1 000 unités texte']].map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
        <Field required label="Prix unitaire USD" type="number" min="0.000000001" step="any" value={rate.unit_price_usd} onChange={e=>setRate({...rate,unit_price_usd:e.target.value})}/>
        {rate.billing_type==='tokens'&&<Field required label="Prix des 1 000 unités de sortie USD" type="number" min="0" step="any" value={rate.output_unit_price_usd??''} onChange={e=>setRate({...rate,output_unit_price_usd:e.target.value})}/>}
        {rate.billing_type==='runtime_seconds'&&<Field required label="Limite de calcul (5 à 240 secondes)" type="number" min="5" max="240" value={rate.max_runtime_seconds??''} onChange={e=>setRate({...rate,max_runtime_seconds:e.target.value})}/>}
        <Field required label="Source officielle Replicate" type="url" value={rate.source_url} onChange={e=>setRate({...rate,source_url:e.target.value})}/>
        <Field label="Notes et variantes couvertes" value={rate.notes??''} onChange={e=>setRate({...rate,notes:e.target.value})}/>
        <label className="flex gap-2 text-sm md:col-span-3"><input type="checkbox" checked={rate.quote_enabled} onChange={e=>setRate({...rate,quote_enabled:e.target.checked})}/>Tarif vérifié et suffisamment prudent pour toutes les options accessibles de ce modèle.</label>
        <button disabled={pending} className={buttonClass}>Enregistrer le tarif</button>
      </form>
    </Panel>
    <Panel title="Tarifs actuels"><div className="grid gap-2 md:grid-cols-3">{data.pricing.map(p=><div key={p.id} className="rounded border border-white/10 p-3"><p>{p.tool_name||p.tool_id}</p><p className="text-sm text-white/60">{p.is_active?`${p.token_cost??'—'} crédits`:'Inactif'}</p></div>)}</div></Panel>
  </>;
}
export default function AdminFinance({section='transactions'}){
  const [month,setMonth]=useState(new Date().toISOString().slice(0,7));
  const [notice,setNotice]=useState('');const qc=useQueryClient();
  const query=useQuery({queryKey:['admin-finance',month],queryFn:()=>requestFinance({action:'overview',month}),retry:false});
  const mutation=useMutation({mutationFn:requestFinance,onSuccess:()=>{setNotice('Enregistré.');qc.invalidateQueries({queryKey:['admin-finance']});},onError:()=>setNotice('')});
  const mutate=p=>{setNotice('');mutation.mutate(p);};const data=query.data;
  if(query.isLoading)return <p className="p-8 text-white">Chargement du registre…</p>;
  if(query.error)return <p role="alert" className="p-8 text-red-300">{query.error.message}</p>;
  const events=data.events || [];const quotes=data.quotes || [];
  const unknown=events.filter(e=>e.cost_usd==null).length;
  const knownUsd=events.reduce((s,e)=>s+Number(e.cost_usd||0),0);
  const credits=quotes.filter(q=>q.status==='succeeded').reduce((s,q)=>s+Number(q.charged_credits),0)+(data.charges||[]).filter(c=>c.status==='consumed').reduce((s,c)=>s+Number(c.credit_cost),0);
  const revenue=quotes.filter(q=>q.status==='succeeded').reduce((s,q)=>s+Number(q.charged_credits)*Number(q.credit_value_cad),0);
  const canCompare=!data.truncated.length&&!unknown&&!data.charges.length&&events.length>0&&events.every(e=>e.cost_cad!=null&&['succeeded','failed','canceled'].includes(e.status))&&quotes.every(q=>['succeeded','failed'].includes(q.status)&&events.some(e=>e.quote_id===q.id));
  const margin=canCompare?revenue-events.reduce((s,e)=>s+Number(e.cost_cad),0):null;
  const rows=[
    ...data.orders.map(o=>({key:`order:${o.id}`,date:o.payment_date||o.created_date,type:'Commande',label:o.order_id||o.id,amount:o.total,currency:null,status:o.status,tax:`TPS ${o.tps??'—'} / TVQ ${o.tvq??'—'} — à vérifier`})),
    ...data.tokens.map(t=>({key:`token:${t.id}`,date:t.created_at||t.created_date,type:'Crédits',label:t.related_entity||t.payment_id||t.id,credits:t.token_amount,status:t.transaction_type})),
    ...data.sponsors.map(s=>({key:`sponsor:${s.id}`,date:s.sale_date||s.created_date,type:'Commandite',label:s.bracket_name||s.id,amount:s.total_amount,currency:null,status:'Vente déclarée — encaissement à vérifier'})),
    ...data.assets.map(a=>({key:`asset:${a.id}`,date:a.completed_at||a.created_at,type:'Actif numérique',label:a.provider_transaction_id||a.id,amount:a.total_amount,currency:a.currency,status:a.status})),
    ...data.entries.map(e=>({key:`entry:${e.id}`,date:e.occurred_on,type:{expense:'Dépense',member_payout:'Paiement membre',income:'Encaissement'}[e.entry_type],label:`${e.label} · ${e.reference}`,amount:e.amount*(e.entry_type==='income'?1:-1),currency:e.currency,status:'Enregistré'})),
  ].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  return <div className="space-y-6 text-white">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-2xl font-light">{section==='costs'?'Coûts et revenus IA':'Transactions'}</h2><p className="mt-1 text-sm text-white/50">AISTAGE.ONE · période en UTC</p></div><Field label="Mois" type="month" value={month} onChange={e=>setMonth(e.target.value)}/></div>
    {data.truncated.length>0&&<p role="alert" className="text-amber-300">Vue limitée à 500 lignes par registre. Les totaux affichés sont partiels.</p>}
    {mutation.error&&<p role="alert" className="text-red-300">{mutation.error.message}</p>}{notice&&<p role="status" className="text-green-300">{notice}</p>}
    {section==='costs'?<>
      <div className="grid gap-3 md:grid-cols-4">{[['Coûts USD connus',cash(knownUsd,'USD')],['Crédits consommés',credits],['Coûts inconnus',unknown],['Marge estimée CAD',margin==null?'Non déterminable':cash(margin)]].map(([label,value])=><Panel key={label} title={label}><p className="text-2xl">{value}</p></Panel>)}</div>
      <p className="text-sm text-white/60">Les coûts sont des estimations, conservées avec leur tarif et leur conversion. Les crédits ne sont pas des encaissements. Un historique incomplet empêche le calcul d’une marge globale fiable.</p>
      <p className="text-sm text-white/60">Les appels récents disponibles chez Replicate sont importés à l’ouverture du registre. Les générations antérieures à cette collecte peuvent manquer. {data.sync?.warning}</p><CostSettings key={data.settings.updated_at} data={data} mutate={mutate} pending={mutation.isPending}/>
      <Panel title="Appels Replicate"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr>{['Date UTC','Outil','Modèle','Durée calcul','Coût USD','État'].map(h=><th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{events.map(e=><tr key={e.prediction_id} className="border-t border-white/10"><td className="p-3">{dateLabel(e.created_at)}</td><td className="p-3">{e.tool_id||e.function_name||'Interne'}</td><td className="p-3">{e.model_key}</td><td className="p-3">{e.usage?.runtime_seconds==null?'—':`${e.usage.runtime_seconds} s`}</td><td className="p-3">{cash(e.cost_usd,'USD')}</td><td className="p-3">{e.status}</td></tr>)}</tbody></table>{!events.length&&<p className="p-5 text-white/60">Aucun appel enregistré pour cette période.</p>}</div></Panel>
    </>:<>
      <p className="text-sm text-white/60">Les commandes, crédits, commandites et achats numériques sont présentés séparément pour éviter de compter deux fois une vente. La devise des anciennes commandes n’est pas renseignée. Leurs taxes doivent être vérifiées sur les justificatifs.</p>
      <Panel title="Registre"><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead><tr>{['Date UTC','Type','Référence','Montant','État / taxes'].map(h=><th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.key} className="border-t border-white/10"><td className="p-3">{dateLabel(r.date)}</td><td className="p-3">{r.type}</td><td className="max-w-sm break-words p-3">{r.label}</td><td className="whitespace-nowrap p-3">{r.credits!=null?`${r.credits} crédits`:r.currency?cash(r.amount,r.currency):`${r.amount??'—'} · devise non renseignée`}</td><td className="p-3">{r.status}{r.tax&&<p className="text-xs text-amber-200">{r.tax}</p>}</td></tr>)}</tbody></table>{!rows.length&&<p className="p-5 text-white/60">Aucune transaction pour ce mois.</p>}</div></Panel>
      <Panel title="Enregistrer un mouvement réel"><p className="text-sm text-white/60">Cette action inscrit un paiement ou une dépense déjà effectué. Elle ne transfère aucun argent. Ne ressaisissez pas une vente déjà présente ci-dessus.</p><form className="grid gap-3 md:grid-cols-3" onSubmit={e=>{e.preventDefault();mutate({action:'record_entry',...Object.fromEntries(new FormData(e.currentTarget))});}}><label>Type<select name="entry_type" className={fieldClass}><option value="expense">Dépense</option><option value="member_payout">Paiement à un membre</option><option value="income">Autre encaissement</option></select></label><label>Devise<select name="currency" className={fieldClass}><option>CAD</option><option>USD</option><option>EUR</option></select></label><Field required name="amount" label="Montant" type="number" min="0.01" step="0.01"/><Field required name="occurred_on" label="Date du mouvement" type="date"/><Field required name="label" label="Libellé"/><Field required name="reference" label="Référence / justificatif"/><Field name="notes" label="Notes"/><button disabled={mutation.isPending} className={`${buttonClass} self-end`}>Enregistrer</button></form></Panel>
      <RecordForm title="Confirmer les taxes d’une commande CAD" action="confirm_tax" fields={[{name:'order_id',label:'Identifiant interne de la commande'},{name:'tps',label:'TPS du justificatif',type:'number',min:'0',step:'0.01'},{name:'tvq',label:'TVQ du justificatif',type:'number',min:'0',step:'0.01'},{name:'reference',label:'Référence du justificatif'}]} mutate={mutate} pending={mutation.isPending} extra={{month}}/>
      <Panel title="Taxes confirmées pour le mois"><p>TPS : {cash(data.taxConfirmations.reduce((s,t)=>s+Number(t.tps),0))} · TVQ : {cash(data.taxConfirmations.reduce((s,t)=>s+Number(t.tvq),0))}</p><p className="text-sm text-white/60">Uniquement les montants confirmés ci-dessus; les taxes non vérifiées sont exclues. Les instantanés des dépôts sont conservés.</p>{data.deposits.map(d=><p key={d.id}>Dépôt du {d.deposited_on} · {d.reference} · TPS {cash(d.tps)} · TVQ {cash(d.tvq)}</p>)}</Panel>
      {!data.deposits.length&&<RecordForm title="Consigner un dépôt de taxes effectué" action="record_tax_deposit" fields={[{name:'deposited_on',label:'Date du dépôt',type:'date'},{name:'reference',label:'Référence du dépôt'},{name:'notes',label:'Notes'}]} mutate={mutate} pending={mutation.isPending} extra={{month}}/>}
    </>}
  </div>;
}
