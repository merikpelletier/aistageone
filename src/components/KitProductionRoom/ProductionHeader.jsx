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
    <div className="px-6 pt-10 pb-4 border-b border-white/10 flex-shrink-0 bg-black">
      <p className="text-white text-[10px] uppercase tracking-widest font-semibold mb-1">MY PRODUCTION</p>
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="text-white hover:text-white flex-shrink-0">
          <ChevronLeft size={24} />
        </button>
        <input
          value={productionName}
          onChange={e => setProductionName(e.target.value)}
          onBlur={() => {}}
          placeholder={kitPage?.title || 'Name your production…'}
          className="flex-1 min-w-0 bg-transparent text-white text-base font-semibold placeholder-white/30 focus:outline-none"
        />
        {saving && <Loader2 size={16} className="text-white animate-spin flex-shrink-0" />}
        {hasBlocks && (
          <button
            onClick={onPreview}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-white/10 border border-white/20 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-colors"
          >
            <Eye size={14} />
            Preview
          </button>
        )}
        {hasBlocks && (
          <button
            onClick={onPublish}
            className="flex-shrink-0 px-5 py-2 bg-yellow-400 hover:bg-yellow-300 text-black text-xs font-bold rounded-xl transition-colors"
          >
            Publish →
          </button>
        )}
      </div>
    </div>
  );
}