import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import CampaignBanner from '@/components/CampaignBanner';

function FeaturedDossierCard({ dossier, ratingsMap, commentsMap, campaignsMap }) {
  const campaign = campaignsMap?.[dossier.id];
  return (
    <Link
      to={`/Magazine?dossier=${dossier.id}`}
      className="block group relative w-full"
    >
      <div className="aspect-[16/9] md:aspect-[16/8] overflow-hidden rounded-lg bg-black/20 relative">
        {dossier.cover_image ? (
          <img
            src={dossier.cover_image_landscape || dossier.cover_image}
            alt={dossier.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-black/30">
            <span className="text-white text-lg font-medium text-center px-2">{dossier.title}</span>
          </div>
        )}
        {campaign && <CampaignBanner campaign={campaign} />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <p className="text-white text-xl md:text-2xl font-bold leading-tight line-clamp-2">{dossier.title}</p>
          {dossier.category && (
            <p className="text-white/60 text-xs uppercase tracking-wide mt-1">{dossier.category}</p>
          )}
          <div className="flex gap-3 text-white/80 text-xs mt-2">
            {ratingsMap[dossier.id]?.count > 0 && (
              <span>⭐ {ratingsMap[dossier.id].avg.toFixed(1)}</span>
            )}
            {commentsMap[dossier.id] > 0 && (
              <span>💬 {commentsMap[dossier.id]}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function DossierCard({ dossier, ratingsMap, commentsMap, campaignsMap }) {
  const campaign = campaignsMap?.[dossier.id];
  return (
    <Link
      to={`/Magazine?dossier=${dossier.id}`}
      className="flex-shrink-0 w-28 md:w-32 group relative"
    >
      <div className="aspect-[2/3] overflow-hidden rounded-sm bg-black/20 relative">
        {dossier.cover_image ? (
          <img
            src={dossier.cover_image}
            alt={dossier.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-black/30">
            <span className="text-white text-xs text-center px-2">{dossier.title}</span>
          </div>
        )}
        {campaign && <CampaignBanner campaign={campaign} />}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-start justify-end p-2">
          <p className="text-white text-xs font-medium leading-tight line-clamp-2 mb-1">{dossier.title}</p>
          <div className="flex gap-2 text-white text-xs">
            {ratingsMap[dossier.id]?.count > 0 && (
              <span>⭐ {ratingsMap[dossier.id].avg.toFixed(1)}</span>
            )}
            {commentsMap[dossier.id] > 0 && (
              <span>💬 {commentsMap[dossier.id]}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function DossierGallery({ dossiers, ratingsMap = {}, commentsMap = {}, label, campaignsMap = {} }) {
  const scrollRef = useRef(null);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
  };

  if (!dossiers || dossiers.length === 0) return null;

  const [featured, ...rest] = dossiers;

  return (
    <div className="mb-4 space-y-4">
      {label && <h2 className="text-white text-lg font-bold px-0">{label}</h2>}

      {/* Featured (latest) — large */}
      <FeaturedDossierCard
        dossier={featured}
        ratingsMap={ratingsMap}
        commentsMap={commentsMap}
        campaignsMap={campaignsMap}
      />

      {/* Remaining — small horizontal scroll */}
      {rest.length > 0 && (
        <div className="relative group/row">
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-0 bottom-0 z-10 w-8 flex items-center justify-center bg-gradient-to-r from-black/80 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity"
          >
            <ChevronLeft size={18} className="text-white" />
          </button>

          <div
            ref={scrollRef}
            className="flex gap-2 overflow-x-auto"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {rest.map(d => (
              <DossierCard
                key={d.id}
                dossier={d}
                ratingsMap={ratingsMap}
                commentsMap={commentsMap}
                campaignsMap={campaignsMap}
              />
            ))}
          </div>

          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-0 bottom-0 z-10 w-8 flex items-center justify-center bg-gradient-to-l from-black/80 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity"
          >
            <ChevronRight size={18} className="text-white" />
          </button>
        </div>
      )}
    </div>
  );
}