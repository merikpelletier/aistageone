import React from 'react';
import { ChevronLeft, Loader2, Eye } from 'lucide-react';

export default function ProductionHeader({ 
  productionName, 
  setProductionName, 
  kitPage, 
  saving, 
  onClose, 
  onPublish,
  onPreview,
  hasBlocks,
  dossier
}) {
  return (
    <div className="flex-shrink-0 border-b border-white/10 bg-[#17191d] px-5 py-4 md:px-6">
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[3px] border border-white/10 bg-white/[0.04] text-white/65 transition hover:bg-white/10 hover:text-white">
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 text-[9px] font-black uppercase tracking-[0.22em] text-[#23c7be]">My Production</p>
          <input
            value={productionName}
            onChange={e => setProductionName(e.target.value)}
            onBlur={() => {}}
            placeholder={kitPage?.title || 'Name your production…'}
            className="w-full min-w-0 bg-transparent text-lg font-black text-white outline-none placeholder:text-white/25 md:text-xl"
          />
        </div>
        {saving && <Loader2 size={16} className="flex-shrink-0 animate-spin text-[#23c7be]" />}
        {hasBlocks && (
          <button
            onClick={onPreview}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-[3px] border border-white/15 bg-white/[0.04] px-4 py-2.5 text-xs font-black text-white transition hover:bg-white/10"
          >
            <Eye size={14} />
            Preview
          </button>
        )}
        {hasBlocks && (
          <button
            onClick={onPublish}
            className="flex-shrink-0 rounded-[3px] border border-[#23c7be] bg-[#23c7be] px-5 py-2.5 text-xs font-black text-[#071211] transition hover:bg-[#35d8cf]"
          >
            Publish →
          </button>
        )}
      </div>
    </div>
  );
}