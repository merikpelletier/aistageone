import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/base44Client';

const card='border border-white/15 bg-neutral-950 p-5';

function formatBytes(bytes){
  const n=Number(bytes||0);
  if(n<=0)return '0 MB';
  if(n<1024*1024)return `${(n/1024).toFixed(1)} KB`;
  if(n<1024*1024*1024)return `${(n/(1024*1024)).toFixed(2)} MB`;
  return `${(n/(1024*1024*1024)).toFixed(2)} GB`;
}

function formatCredits(value){
  return new Intl.NumberFormat('fr-CA',{maximumFractionDigits:0}).format(Number(value||0));
}

async function loadPreview(){
  const {data,error}=await supabase.rpc('admin_publication_economics_preview');
  if(error)throw error;
  return data;
}

export default function AdminPublicationEconomics(){
  const query=useQuery({queryKey:['admin-publication-economics'],queryFn:loadPreview,retry:false});
  if(query.isLoading)return <p className="text-white/65">Chargement…</p>;
  if(query.error)return <p className="text-red-300">{query.error.message}</p>;

  const data=query.data||{};
  const dossiers=Array.isArray(data.dossiers)?data.dossiers:[];
  const unallocated=data.unallocated||{};
  const billing=unallocated.current_video_billing||{};

  const totalCostCredits=dossiers.reduce((sum,d)=>sum+Number(d.cost_credits||0),0);
  const totalRevenueCredits=dossiers.reduce((sum,d)=>sum+Number(d.revenue_credits||0),0);

  return <div className="space-y-6">
    <div>
      <h2 className="text-2xl font-light tracking-wide">Publication Economics Preview</h2>
      <p className="mt-1 text-sm text-white/55">Vue admin du futur relevé créateur. Lecture seule : aucun débit, aucun paiement et aucune publication ne sont modifiés ici.</p>
    </div>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className={card}><p className="text-xs uppercase tracking-widest text-white/40">Costs</p><p className="mt-2 text-2xl">{formatCredits(totalCostCredits)} crédits</p></div>
      <div className={card}><p className="text-xs uppercase tracking-widest text-white/40">Revenue</p><p className="mt-2 text-2xl">{formatCredits(totalRevenueCredits)} crédits</p></div>
      <div className={card}><p className="text-xs uppercase tracking-widest text-white/40">Net</p><p className="mt-2 text-2xl">{formatCredits(totalRevenueCredits-totalCostCredits)} crédits</p></div>
      <div className={card}><p className="text-xs uppercase tracking-widest text-white/40">Current Vault billing</p><p className="mt-2 text-2xl">{formatCredits(billing.total_credits||0)} crédits</p><p className="mt-1 text-xs text-white/45">{billing.billing_month||'Aucun mois'} · {billing.status||'—'}</p></div>
    </div>

    <div className={card}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <div><p className="text-white/40">Vault sans dossier</p><p className="mt-1 text-lg">{unallocated.vault_assets_without_dossier||0}</p></div>
        <div><p className="text-white/40">Vidéos sans dossier</p><p className="mt-1 text-lg">{unallocated.video_assets_without_dossier||0}</p></div>
        <div><p className="text-white/40">AI charges sans lien</p><p className="mt-1 text-lg">{unallocated.ai_charges_without_dossier_link||0}</p></div>
        <div><p className="text-white/40">Revenus non attribués</p><p className="mt-1 text-lg">{Number(unallocated.subscriptions_without_dossier_allocation||0)+Number(unallocated.donations_without_dossier_allocation||0)}</p></div>
      </div>
    </div>

    <div className="space-y-3">
      {dossiers.map(d=><div key={d.dossier_id} className={card}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/40">{d.status||'dossier'}</p>
            <h3 className="mt-1 text-xl font-light">{d.title||'Sans titre'}</h3>
          </div>
          <div className="grid grid-cols-3 gap-3 text-right min-w-[330px]">
            <div><p className="text-xs text-white/40">Costs</p><p className="mt-1">{formatCredits(d.cost_credits)} cr</p></div>
            <div><p className="text-xs text-white/40">Revenue</p><p className="mt-1">{formatCredits(d.revenue_credits)} cr</p></div>
            <div><p className="text-xs text-white/40">Net</p><p className="mt-1">{formatCredits(d.net_credits)} cr</p></div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div><p className="text-white/40">Images</p><p className="mt-1">{d.image_count||0} · {formatBytes(d.image_bytes)}</p></div>
          <div><p className="text-white/40">Vidéos</p><p className="mt-1">{d.video_count||0} · {(Number(d.video_seconds||0)/60).toFixed(1)} min</p></div>
          <div><p className="text-white/40">Audio</p><p className="mt-1">{d.audio_count||0} · {formatBytes(d.audio_bytes)}</p></div>
          <div><p className="text-white/40">Produits liés</p><p className="mt-1">{d.product_count||0}</p></div>
        </div>
      </div>)}
      {!dossiers.length&&<div className={card}><p className="text-white/60">Aucun dossier trouvé pour ce compte.</p></div>}
    </div>
  </div>;
}
