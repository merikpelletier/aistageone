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

  // Close the dropdown when clicking outside
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
    <div className="flex items-center gap-2 px-6 py-3 border-b border-white/10 flex-shrink-0 bg-black">
      {/* Dropdown selector */}
      <div ref={wrapRef} className="relative flex-1 min-w-0">
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white text-sm font-semibold hover:bg-white/10 transition-colors"
        >
          <Film size={14} className="text-white/60 flex-shrink-0" />
          <span className="flex-1 min-w-0 truncate text-left">{activeLabel}</span>
          {isEpisodeLocked && <span className="flex-shrink-0">🔒</span>}
          <ChevronDown size={16} className={`text-white/60 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#141414] border border-white/15 rounded-xl shadow-2xl overflow-hidden">
            <div className="max-h-64 overflow-y-auto py-1" style={{ scrollbarWidth: 'thin' }}>
              {episodes.length === 0 ? (
                <p className="px-4 py-3 text-white/50 text-xs">No timelines yet — tap “New”.</p>
              ) : (
                episodes.map((ep, idx) => {
                  const isActive = ep.id === activeEpisodeId;
                  const label = ep.episode_title?.trim() || `Timeline ${idx + 1}`;
                  return (
                    <div
                      key={ep.id}
                      className={`flex items-center gap-2 px-3 py-2.5 mx-1 rounded-lg transition-colors ${isActive ? 'bg-yellow-400/15' : 'hover:bg-white/5'}`}
                    >
                      <button
                        onClick={() => { selectEpisode(ep); setOpen(false); }}
                        className="flex-1 min-w-0 text-left flex items-center gap-2"
                      >
                        {ep.poster_image ? (
                          <img src={ep.poster_image} alt="" className="w-8 h-8 rounded-md object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-md bg-white/10 flex items-center justify-center flex-shrink-0">
                            <Film size={14} className="text-white/40" />
                          </div>
                        )}
                        <span className={`truncate text-sm ${isActive ? 'text-yellow-400 font-bold' : 'text-white font-medium'}`}>{label}</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteEpisode(ep.id); }}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                        title="Delete timeline"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* New button */}
      <button
        onClick={createEpisode}
        className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-yellow-400 text-black hover:bg-yellow-300 transition-all shadow-md"
        title="Start a new timeline"
      >
        <Plus size={14} /> New
      </button>
    </div>
  );
}