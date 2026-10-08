import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Film, Trash2, Mic, Save, Eye } from 'lucide-react';

export default function SceneListView({
  sortedBlocks,
  handleViewBlock,
  deleteBlock,
  savingBlockId,
  savedBlockId,
  persist,
  production,
  onBlockTitleChange
}) {
  const railRef = useRef(null);
  const scrollRail = (direction) => {
    railRef.current?.scrollBy({ left: direction * 760, behavior: 'smooth' });
  };

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#23c7be]">Story Blocks</p>
          <p className="mt-1 text-xs text-white/35">Scenes run from left to right.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollRail(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-[3px] border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10 hover:text-white"
            title="Previous scenes"
          >
            <ChevronLeft size={17} />
          </button>
          <button
            type="button"
            onClick={() => scrollRail(1)}
            className="flex h-9 w-9 items-center justify-center rounded-[3px] border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10 hover:text-white"
            title="Next scenes"
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>

      <div ref={railRef} className="w-full overflow-x-scroll overscroll-x-contain pb-3 [scrollbar-color:#23c7be_#17191d] [scrollbar-width:thin]">
        <div className="flex min-w-max items-start gap-4 pr-4">
          {sortedBlocks.map((block, idx) => (
            <article
              key={block.id}
              className="w-[300px] flex-shrink-0 overflow-hidden rounded-[4px] border border-white/10 bg-[#17191d] md:w-[340px] lg:w-[360px]"
            >
              <div className="border-b border-white/10 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#23c7be]">Scene {idx + 1}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewBlock(block);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/10 hover:text-white"
                      title="View scene"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!production) return;
                        const newBlocks = (production.blocks || []).map((item) => item.id === block.id ? { ...item, title: block.title || '' } : item);
                        await persist(newBlocks, block.id);
                      }}
                      className="flex h-8 items-center justify-center gap-1.5 rounded-[3px] border border-[#23c7be]/30 bg-[#23c7be]/10 px-2.5 text-[10px] font-black text-[#8ee9e4] hover:bg-[#23c7be]/15"
                    >
                      <Save size={13} />
                      {savedBlockId === block.id ? 'Saved' : savingBlockId === block.id ? '...' : 'Save'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteBlock(block.id); }}
                      className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-red-400/20 bg-red-400/5 text-red-300 hover:bg-red-400/10"
                      title="Delete scene"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <input
                  value={block.title || ''}
                  onChange={(e) => onBlockTitleChange?.(block.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Name this scene..."
                  className="w-full rounded-[3px] border border-white/10 bg-black/20 px-3 py-2 text-sm font-bold text-white outline-none placeholder:text-white/25 focus:border-[#23c7be]/50"
                />
              </div>

              <button
                type="button"
                onClick={() => handleViewBlock(block)}
                className="relative block h-[220px] w-full overflow-hidden bg-black text-left"
              >
                {block.media_url ? (
                  block.media_type === 'video' || block.media_url.match(/\.(mp4|webm|ogg|mov)$/i) ? (
                    <video src={block.media_url} className="h-full w-full object-contain bg-black" />
                  ) : block.media_type === 'audio' ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-white/65">
                      <div className="flex h-12 w-12 items-center justify-center rounded-[3px] border border-[#23c7be]/25 bg-[#23c7be]/10">
                        <Mic size={22} className="text-[#23c7be]" />
                      </div>
                      <span className="text-xs font-bold">Audio block</span>
                    </div>
                  ) : (
                    <img src={block.media_url} alt="" className="h-full w-full object-cover" />
                  )
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-white/40">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[3px] border border-white/10 bg-white/[0.03]">
                      <Film size={22} />
                    </div>
                    <span className="text-xs font-bold">Click to edit scene</span>
                  </div>
                )}
              </button>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}