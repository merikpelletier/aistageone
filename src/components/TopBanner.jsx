import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Search, Play, Flame, Clock } from 'lucide-react';

export default function TopBanner({ dossiers }) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('popular');

  // Pick a promo video — first dossier with a landscape or portrait video
  const promoDossier = useMemo(
    () => dossiers.find(d => d.cover_video_landscape || d.cover_video) || dossiers[0],
    [dossiers]
  );
  const promoVideo = promoDossier?.cover_video_landscape || promoDossier?.cover_video;
  const promoImage = promoDossier?.cover_image_landscape || promoDossier?.cover_image;

  // Sort for tabs
  const popularDossiers = useMemo(
    () => [...dossiers].sort((a, b) => (b.order || 0) - (a.order || 0)).slice(0, 4),
    [dossiers]
  );
  const recentDossiers = useMemo(
    () => [...dossiers].sort((a, b) => new Date(b.approved_at || 0) - new Date(a.approved_at || 0)).slice(0, 4),
    [dossiers]
  );

  const tabList = tab === 'popular' ? popularDossiers : recentDossiers;

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return tabList;
    const q = search.toLowerCase();
    return dossiers.filter(d =>
      (d.title || '').toLowerCase().includes(q) ||
      (d.category || '').toLowerCase().includes(q) ||
      (d.subtitle || '').toLowerCase().includes(q)
    ).slice(0, 4);
  }, [search, tabList, dossiers]);

  return (
    <div className="flex w-full" style={{ height: '45vh', minHeight: '300px' }}>
      {/* === LEFT: Promo video === */}
      <div className="relative w-1/2 overflow-hidden bg-black">
        {promoVideo ? (
          <video
            src={promoVideo}
            autoPlay
            muted
            loop
            playsInline
            poster={promoImage}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : promoImage ? (
          <img src={promoImage} alt={promoDossier?.title} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Play size={40} className="text-white/30" />
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/60 pointer-events-none" />
        {promoDossier && (
          <Link
            to={`${createPageUrl('Magazine')}?dossier=${promoDossier.id}`}
            className="absolute bottom-4 left-4 right-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm text-white px-4 py-2 rounded font-bold text-sm hover:bg-black/80 transition"
          >
            <Play size={16} fill="white" />
            <span className="truncate">{promoDossier.title}</span>
          </Link>
        )}
      </div>

      {/* === RIGHT: Black search + menu panel === */}
      <div className="w-1/2 bg-black flex flex-col p-4 gap-3 border-l border-white/10">
        {/* Search bar */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search content..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-white text-sm placeholder-white/40 focus:outline-none focus:border-red-600/50 transition"
          />
        </div>

        {/* Menu tabs — stacked on mobile, row on larger */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => setTab('popular')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition ${
              tab === 'popular' ? 'bg-red-600 text-white' : 'bg-white/10 text-white/60 hover:text-white'
            }`}
          >
            <Flame size={12} />
            Popular
          </button>
          <button
            onClick={() => setTab('recent')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition ${
              tab === 'recent' ? 'bg-red-600 text-white' : 'bg-white/10 text-white/60 hover:text-white'
            }`}
          >
            <Clock size={12} />
            Recent
          </button>
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filtered.length === 0 ? (
            <p className="text-white/40 text-xs text-center py-6">No results</p>
          ) : (
            filtered.map(d => (
              <Link
                key={d.id}
                to={`${createPageUrl('Magazine')}?dossier=${d.id}`}
                className="flex items-center gap-2 group/search bg-white/5 hover:bg-white/10 rounded-lg p-1.5 transition"
              >
                <div className="w-10 h-10 rounded overflow-hidden bg-white/10 flex-shrink-0">
                  {d.cover_image && <img src={d.cover_image} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white text-xs font-bold truncate">{d.title}</p>
                  {d.category && <p className="text-white/40 text-[10px]">{d.category}</p>}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}