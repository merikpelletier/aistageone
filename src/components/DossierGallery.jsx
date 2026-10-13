import React from 'react';
import { Link } from 'react-router-dom';
import { Edit3 } from 'lucide-react';
import CampaignBanner from '@/components/CampaignBanner';

function DossierCard({ dossier, ratingsMap, commentsMap, campaignsMap, ownerMode = false }) {
  const campaign = campaignsMap?.[dossier.id];

  return (
    <div className="group relative block min-w-0 flex-1 basis-[46%] sm:basis-[30%] md:basis-[22%] lg:basis-[13%]">
      <Link to={`/Magazine?dossier=${dossier.id}`} className="block">
        <div className="relative aspect-[2/3] overflow-hidden bg-neutral-950 border border-white/10 lg:aspect-[4/5]">
          {dossier.cover_image ? (
            <img src={dossier.cover_image} alt={dossier.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-neutral-900 px-3 text-center text-sm text-white/70 lg:text-[0.72vw]">{dossier.title}</div>
          )}

          {campaign && <CampaignBanner campaign={campaign} />}

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent px-3 pb-3 pt-10 lg:px-[4%] lg:pb-[4%] lg:pt-[14%]">
            <p className="text-sm font-semibold leading-tight text-white line-clamp-2 lg:text-[0.78vw]">{dossier.title}</p>
            {dossier.category && <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/55 line-clamp-1 lg:text-[0.52vw] lg:mt-[1%]">{dossier.category}</p>}
            <div className="mt-2 flex gap-3 text-[10px] text-white/60 lg:mt-[2%] lg:gap-[5%] lg:text-[0.52vw]">
              {ratingsMap[dossier.id]?.count > 0 && <span>★ {ratingsMap[dossier.id].avg.toFixed(1)}</span>}
              {commentsMap[dossier.id] > 0 && <span>Comments {commentsMap[dossier.id]}</span>}
            </div>
          </div>
        </div>
      </Link>

      {ownerMode && dossier.production_id && (
        <Link
          to={`/MyProjects?project=${dossier.production_id}`}
          className="absolute right-2 top-2 z-20 flex items-center gap-1.5 border border-white/25 bg-black/85 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white hover:border-white/60"
          onClick={(e) => e.stopPropagation()}
        >
          <Edit3 size={11} /> Edit
        </Link>
      )}
    </div>
  );
}

export default function DossierGallery({ dossiers, ratingsMap = {}, commentsMap = {}, label, campaignsMap = {}, ownerMode = false }) {
  if (!dossiers || dossiers.length === 0) return null;

  return (
    <div className="mb-4 lg:mb-[1vw] w-full">
      {label && <h2 className="mb-3 text-white text-lg font-bold lg:mb-[0.7%] lg:text-[1vw]">{label}</h2>}
      <div className="flex flex-wrap w-full gap-3 lg:gap-[0.8vw]">
        {dossiers.map(dossier => (
          <DossierCard key={dossier.id} dossier={dossier} ratingsMap={ratingsMap} commentsMap={commentsMap} campaignsMap={campaignsMap} ownerMode={ownerMode} />
        ))}
      </div>
    </div>
  );
}
