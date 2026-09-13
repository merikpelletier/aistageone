import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Film, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function EpisodeMetadataDisplay({ 
  posterImage, 
  seriesDesc, 
  authorName, 
  publicationDate,
  episodeTitle,
  episodeDesc,
  category,
  isLocked,
  onTitleChange,
  onDescChange,
  onSeriesChange,
  onAuthorChange,
  onPubDateChange,
  onCategoryChange,
  onPosterChange,
  onSave,
  saving
}) {
  const { data: categories = [] } = useQuery({
    queryKey: ['dossierCategories'],
    queryFn: () => base44.entities.DossierCategory.list('name'),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="space-y-4">
      <p className="text-white text-xs uppercase tracking-widest font-semibold">EPISODE</p>

      {/* Category */}
      <div>
        <p className="text-white text-[10px] uppercase tracking-widest mb-1">Category</p>
        <select
          value={category || ''}
          onChange={e => onCategoryChange?.(e.target.value)}
          onBlur={onSave}
          disabled={isLocked}
          className={`w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-white/20 ${isLocked ? 'opacity-50 cursor-not-allowed' : ''} ${!category ? 'text-white/30' : ''}`}
        >
          <option value="">Select a category…</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.name} className="text-white">{cat.name}</option>
          ))}
        </select>
      </div>
      
      {/* Poster Image */}
      <div>
        <p className="text-white text-[10px] uppercase tracking-widest mb-2">Poster Image</p>
        {posterImage ? (
          <div className="relative w-32 h-48 rounded-xl overflow-hidden">
            <img src={posterImage} alt="Poster" className="w-full h-full object-cover" />
            <button
              onClick={() => onPosterChange?.(null)}
              className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center"
            >
              <X size={12} className="text-white" />
            </button>
          </div>
        ) : (
          <label className="w-32 h-48 border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-white/40 transition-colors">
            <Film size={24} className="text-white" />
            <span className="text-white text-xs">Upload</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async e => {
                const file = e.target.files[0];
                if (file) {
                  const { file_url } = await base44.integrations.Core.UploadFile({ file });
                  onPosterChange?.(file_url);
                }
              }}
            />
          </label>
        )}
      </div>
      
      {/* Series Description */}
      <div>
        <p className="text-white text-[10px] uppercase tracking-widest mb-1">Series Description</p>
        <textarea
          value={seriesDesc || ''}
          onChange={e => onSeriesChange?.(e.target.value)}
          onBlur={onSave}
          placeholder="Describe the series…"
          rows={2}
          disabled={isLocked}
          className={`w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/20 resize-none ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
      </div>
      
      <div className="flex items-center gap-2">
        <input
          value={episodeTitle}
          onChange={e => onTitleChange(e.target.value)}
          placeholder="Episode title…"
          disabled={isLocked}
          className={`flex-1 bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/20 ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        <button
          onClick={onSave}
          disabled={isLocked || !episodeTitle?.trim()}
          className="px-6 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-xl text-white text-sm font-semibold transition-colors"
        >
          {saving ? '...' : 'Save'}
        </button>
      </div>
      <textarea
        value={episodeDesc}
        onChange={e => onDescChange(e.target.value)}
        onBlur={onSave}
        placeholder="Episode description…"
        rows={2}
        disabled={isLocked}
        className={`w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/20 ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
      />
      
      {/* Author & Publication Date */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
        <div>
          <p className="text-white text-[10px] uppercase tracking-widest mb-1">Author</p>
          <input
            value={authorName || ''}
            onChange={e => onAuthorChange?.(e.target.value)}
            onBlur={onSave}
            placeholder="Author name"
            disabled={isLocked}
            className={`w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/20 ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
        </div>
        <div>
          <p className="text-white text-[10px] uppercase tracking-widest mb-1">Publication Date</p>
          <input
            type="date"
            value={publicationDate || ''}
            onChange={e => onPubDateChange?.(e.target.value)}
            onBlur={onSave}
            disabled={isLocked}
            className={`w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/20 ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
        </div>
      </div>
    </div>
  );
}