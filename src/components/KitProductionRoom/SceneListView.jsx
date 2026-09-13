import React from 'react';
import { Film, Trash2, Mic } from 'lucide-react';

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
  return (
    <div className="space-y-6">
      {sortedBlocks.map((block, idx) => (
        <div key={block.id} className="space-y-3">
          {/* Scene header */}
          <div className="flex items-center gap-3">
            <label className="text-white text-xs uppercase tracking-widest font-semibold whitespace-nowrap">SCENE {idx + 1}</label>
            <input
              value={block.title || ''}
              onChange={(e) => onBlockTitleChange?.(block.id, e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Name this scene..."
              className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/20"
            />
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (!production) return;
                const newBlocks = (production.blocks || []).map(b => b.id === block.id ? { ...b, title: block.title || '' } : b);
                await persist(newBlocks, block.id);
              }}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-white text-sm font-semibold transition-colors"
            >
              {savedBlockId === block.id ? '✓ Saved' : (savingBlockId === block.id ? '...' : 'Save')}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); deleteBlock(block.id); }}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-all"
            >
              <Trash2 size={18} />
            </button>
          </div>
          {/* Scene card */}
          <div
            onClick={() => handleViewBlock(block)}
            className="relative rounded-xl overflow-hidden bg-[#1a1a1a] border border-white/10 cursor-pointer group min-h-[200px]"
          >
            {block.media_url ? (
              block.media_type === 'video' || block.media_url.match(/\.(mp4|webm|ogg|mov)$/i) ? (
                <video src={block.media_url} className="w-full h-full object-cover" />
              ) : block.media_type === 'audio' ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-red-600/20 flex items-center justify-center">
                    <Mic size={24} className="text-red-400" />
                  </div>
                  <span className="text-white text-sm">Audio</span>
                </div>
              ) : (
                <img src={block.media_url} alt="" className="w-full h-full object-cover" />
              )
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 py-12">
                <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center">
                  <Film size={24} className="text-white" />
                </div>
                <span className="text-white text-sm">Empty - Click to edit</span>
              </div>
            )}
            {block.media_url && (
              <div className="absolute top-4 right-4 flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewBlock(block);
                  }}
                  className="px-4 py-2 bg-white/90 hover:bg-white rounded-lg text-black text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Film size={12} />
                  View
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}