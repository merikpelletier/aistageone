import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/base44Client';

const inputClass='mt-1 w-full border border-white/20 bg-neutral-900 px-3 py-2 text-white';
const cardClass='border border-white/15 bg-neutral-950 p-5';

async function request(body){
  const {data,error}=await supabase.functions.invoke('admin-video-billing',{body});
  if(error){let message=error.message;try{message=(await error.context.json()).error||message;}catch{}throw new Error(message);}
  return data;
}

function Field({label,...props}){
  return <label className="text-sm text-white/70">{label}<input className={inputClass} {...props}/></label>;
}

export default function AdminVideoBilling(){
  const qc=useQueryClient();
  const query=useQuery({queryKey:['admin-video-billing'],queryFn:()=>request({action:'overview'}),retry:false});
  const [notice,setNotice]=useState('');
  const mutation=useMutation({mutationFn:request,onSuccess:()=>{setNotice('Enregistré.');qc.invalidateQueries({queryKey:['admin-video-billing']});},onError:()=>setNotice('')});
  if(query.isLoading)return <p className="text-white/70">Chargement…</p>;
  if(query.error)return <p className="text-red-300">{query.error.message}</p>;

  const data=query.data;
  const initial=data.settings;
  return <VideoBillingForm key={initial.updated_at} initial={initial} economy={data.economy} mutation={mutation} notice={notice}/>;
}

function VideoBillingForm({initial,economy,mutation,notice}){
  const [s,setS]=useState(initial);
  const creditValue=Number(economy?.credit_value_cad||0.01);
  const fx=Number(economy?.usd_to_cad_rate||1.43);
  const providerStorageCad=Number(s.provider_storage_usd_per_1000_minutes||0)*fx;
  const providerDeliveryCad=Number(s.provider_delivery_usd_per_1000_minutes||0)*fx;
  const storageRevenueCad=1000*Number(s.storage_credits_per_minute_month||0)*creditValue;
  const viewingCreditsPer1000=1000/Number(s.viewing_minutes_per_credit||1);
  const viewingRevenueCad=viewingCreditsPer1000*creditValue;
  const storageMargin=storageRevenueCad-providerStorageCad;
  const viewingMargin=viewingRevenueCad-providerDeliveryCad;

  const save=(e)=>{
    e.preventDefault();
    mutation.mutate({
      action:'save_settings',
      creator_access_monthly_cad:s.creator_access_monthly_cad,
      storage_credits_per_minute_month:s.storage_credits_per_minute_month,
      viewing_minutes_per_credit:s.viewing_minutes_per_credit,
      provider_storage_usd_per_1000_minutes:s.provider_storage_usd_per_1000_minutes,
      provider_delivery_usd_per_1000_minutes:s.provider_delivery_usd_per_1000_minutes,
      target_margin_pct:s.target_margin_pct,
    });
  };

  const cad=(n)=>new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD',maximumFractionDigits:2}).format(Number(n||0));

  return <div className="space-y-5">
    <div>
      <h2 className="text-2xl font-light tracking-wide">Video Billing</h2>
      <p className="mt-1 text-sm text-white/55">Tarification AISTAGE.ONE pour l’accès créateur, le stockage vidéo et les minutes visionnées.</p>
    </div>

    <form onSubmit={save} className={`${cardClass} grid gap-4 md:grid-cols-2 xl:grid-cols-3`}>
      <Field label="Creator Access mensuel (CAD)" type="number" min="0" step="0.01" value={s.creator_access_monthly_cad} onChange={e=>setS({...s,creator_access_monthly_cad:e.target.value})}/>
      <Field label="Stockage — crédits / minute / mois" type="number" min="0.0001" step="0.0001" value={s.storage_credits_per_minute_month} onChange={e=>setS({...s,storage_credits_per_minute_month:e.target.value})}/>
      <Field label="Visionnement — minutes / crédit" type="number" min="0.0001" step="0.0001" value={s.viewing_minutes_per_credit} onChange={e=>setS({...s,viewing_minutes_per_credit:e.target.value})}/>
      <Field label="Cloudflare stockage USD / 1000 min" type="number" min="0" step="0.0001" value={s.provider_storage_usd_per_1000_minutes} onChange={e=>setS({...s,provider_storage_usd_per_1000_minutes:e.target.value})}/>
      <Field label="Cloudflare delivery USD / 1000 min" type="number" min="0" step="0.0001" value={s.provider_delivery_usd_per_1000_minutes} onChange={e=>setS({...s,provider_delivery_usd_per_1000_minutes:e.target.value})}/>
      <Field label="Marge cible (%)" type="number" min="0" max="500" step="0.1" value={s.target_margin_pct} onChange={e=>setS({...s,target_margin_pct:e.target.value})}/>
      <div className="md:col-span-2 xl:col-span-3 flex items-center gap-4">
        <button disabled={mutation.isPending} className="bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50">Enregistrer</button>
        {notice&&<span className="text-sm text-white/55">{notice}</span>}
      </div>
    </form>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className={cardClass}><p className="text-xs uppercase tracking-widest text-white/40">Accès mensuel</p><p className="mt-2 text-2xl">{cad(s.creator_access_monthly_cad)}</p></div>
      <div className={cardClass}><p className="text-xs uppercase tracking-widest text-white/40">Stockage vendu / 1000 min</p><p className="mt-2 text-2xl">{cad(storageRevenueCad)}</p><p className="mt-1 text-xs text-white/45">Coût estimé {cad(providerStorageCad)} · marge {cad(storageMargin)}</p></div>
      <div className={cardClass}><p className="text-xs uppercase tracking-widest text-white/40">Visionnement vendu / 1000 min</p><p className="mt-2 text-2xl">{cad(viewingRevenueCad)}</p><p className="mt-1 text-xs text-white/45">Coût estimé {cad(providerDeliveryCad)} · marge {cad(viewingMargin)}</p></div>
      <div className={cardClass}><p className="text-xs uppercase tracking-widest text-white/40">Règle utilisateur</p><p className="mt-2 text-lg">1 crédit = {Number(s.viewing_minutes_per_credit||0)} min vues</p><p className="mt-1 text-xs text-white/45">Stockage : {Number(s.storage_credits_per_minute_month||0)} crédit/min/mois</p></div>
    </div>

    <div className={cardClass}>
      <p className="text-sm text-white/70">Modèle actif</p>
      <p className="mt-2 text-white">Les auteurs-producteurs gardent leurs revenus. AISTAGE.ONE facture l’accès mensuel et l’infrastructure réellement consommée.</p>
      <p className="mt-2 text-xs text-white/45">La facturation automatique des minutes commencera quand Cloudflare Stream sera connecté et que ses statistiques d’usage seront synchronisées.</p>
    </div>
  </div>;
}
