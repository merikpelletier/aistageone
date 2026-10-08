import React, { useState, useRef, useEffect } from 'react';
import { Plus, ChevronDown, X, Film } from 'lucide-react';

export default function EpisodesTabBar({
  episodes,
  activeEpisodeId,
  selectEpisode,
  deleteEpisode,
  createEpisode,
  isEpisodeLocked
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  const active = episodes.find(e => e.id === activeEpisodeId);
  const activeLabel = active?.episode_title?.trim() || (active ? `Timeline ${episodes.indexOf(active) + 1}` : 'Select a timeline…');

  return (
    <div className="flex flex-shrink-0 items-center gap-2 border-b border-white/10 bg-[#202328] px-5 py-3 md:px-6">
      <div ref={wrapRef} className="relative min-w-0 flex-1">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex w-full items-center gap-2 rounded-[3px] border border-white/10 bg-[#17191d] px-4 py-3 text-sm font-bold text-white transition hover:border-[#23c7be]/35 hover:bg-[#1d2126]"
        >
          <Film size={14} className="flex-shrink-0 text-[#23c7be]" />
          <span className="min-w-0 flex-1 truncate text-left">{activeLabel}</span>
          {isEpisodeLocked && <span className="flex-shrink-0 text-white/45">🔒</span>}
          <ChevronDown size={16} className={`flex-shrink-0 text-white/45 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-[4px] border border-white/10 bg-[#17191d] shadow-2xl">
            <div className="max-h-64 overflow-y-auto py-1" style={{ scrollbarWidth: 'thin' }}>
              {episodes.length === 0 ? (
                <p className="px-4 py-3 text-xs text-white/45">No timelines yet — tap “New”.</p>
              ) : (
                episodes.map((ep, idx) => {
                  const isActive = ep.id === activeEpisodeId;
                  const label = ep.episode_title?.trim() || `Timeline ${idx + 1}`;
                  return (
                    <div key={ep.id} className={`mx-1 flex items-center gap-2 rounded-[3px] border px-3 py-2.5 transition-colors ${isActive ? 'border-[#23c7be]/35 bg-[#23c7be]/10' : 'border-transparent hover:bg-white/[0.04]'}`}>
                      <button onClick={() => { selectEpisode(ep); setOpen(false); }} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                        {ep.poster_image ? <img src={ep.poster_image} alt="" className="h-8 w-8 flex-shrink-0 rounded-[3px] object-cover" /> : <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[3px] bg-white/[0.05]"><Film size={14} className="text-white/35" /></div>}
                        <span className={`truncate text-sm ${isActive ? 'font-black text-[#8ee9e4]' : 'font-medium text-white'}`}>{label}</span>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); deleteEpisode(ep.id); }} className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[3px] text-white/40 transition hover:bg-red-500/10 hover:text-red-300" title="Delete timeline"><X size={14} /></button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      <button onClick={createEpisode} className="flex flex-shrink-0 items-center gap-1.5 rounded-[3px] border border-[#23c7be]/35 bg-[#23c7be]/10 px-4 py-3 text-xs font-black text-[#8ee9e4] transition hover:bg-[#23c7be]/15" title="Start a new timeline">
        <Plus size={14} /> New
      </button>
    </div>
  );
}