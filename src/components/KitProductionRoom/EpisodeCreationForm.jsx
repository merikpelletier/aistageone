import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Film, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function EpisodeCreationForm({ 
  episodeTitle, 
  setEpisodeTitle, 
  episodeDesc, 
  setEpisodeDesc,
  seriesDesc,
  setSeriesDesc,
  posterImage,
  setPosterImage,
  authorName,
  setAuthorName,
  publicationDate,
  setPublicationDate,
  category,
  setCategory,
  onCreate,
  isLocked 
}) {
  const { data: categories = [] } = useQuery({
    queryKey: ['dossierCategories'],
    queryFn: () => base44.entities.DossierCategory.list('name'),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="space-y-3">
      <p className="text-white text-xs uppercase tracking-widest font-semibold">New Episode</p>

      {/* Category */}
      <div>
        <p className="text-white text-xs uppercase tracking-widest font-semibold mb-1">Category</p>
        <select
          value={category || ''}
          onChange={e => setCategory(e.target.value)}
          disabled={isLocked}
          className={`w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-white/20 ${isLocked ? 'opacity-50 cursor-not-allowed' : ''} ${!category ? 'text-white/30' : ''}`}
        >
          <option value="">Select a category…</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.name} className="text-white">{cat.name}</option>
          ))}
        </select>
      </div>
      
      {/* Poster Image */}
      <div>
        <p className="text-white text-xs uppercase tracking-widest font-semibold mb-2">Poster Image</p>
        <div className="flex items-center gap-3">
          {posterImage ? (
            <div className="relative w-24 h-36 rounded-xl overflow-hidden">
              <img src={posterImage} alt="Poster" className="w-full h-full object-cover" />
              <button onClick={() => setPosterImage(null)} className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center">
                <X size={12} className="text-white" />
              </button>
            </div>
          ) : (
            <label className="w-24 h-36 border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-white/40 transition-colors">
              <Film size={24} className="text-white" />
              <span className="text-white text-xs">Upload</span>
              <input type="file" accept="image/*" className="hidden" onChange={async e => {
                const file = e.target.files[0];
                if (file) {
                  const { file_url } = await base44.integrations.Core.UploadFile({ file });
                  setPosterImage(file_url);
                }
              }} />
            </label>
          )}
        </div>
      </div>

      {/* Series Description */}
      <div>
        <p className="text-white text-xs uppercase tracking-widest font-semibold mb-1">Series Description</p>
        <textarea
          value={seriesDesc}
          onChange={e => setSeriesDesc(e.target.value)}
          placeholder="Describe the series…"
          rows={2}
          className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/20 resize-none"
        />
      </div>

      <input
        value={episodeTitle}
        onChange={e => setEpisodeTitle(e.target.value)}
        placeholder="Episode title…"
        disabled={isLocked}
        className={`w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/20 ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
      />
      <textarea
        value={episodeDesc}
        onChange={e => setEpisodeDesc(e.target.value)}
        placeholder="Episode description…"
        rows={2}
        disabled={isLocked}
        className={`w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/20 resize-none ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
      />
      
      {/* Author */}
      <div>
        <p className="text-white text-xs uppercase tracking-widest font-semibold mb-1">Author</p>
        <input
          value={authorName}
          onChange={e => setAuthorName(e.target.value)}
          placeholder="Author name"
          disabled={isLocked}
          className={`w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/20 ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
      </div>
      
      {/* Publication Date */}
      <div>
        <p className="text-white text-xs uppercase tracking-widest font-semibold mb-1">Publication Date</p>
        <input
          type="date"
          value={publicationDate}
          onChange={e => setPublicationDate(e.target.value)}
          disabled={isLocked}
          className={`w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/20 ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
      </div>
      
      <button 
        onClick={onCreate} 
        className="w-full py-3 bg-red-600 hover:bg-red-500 rounded-xl text-white text-sm font-semibold transition-colors"
        disabled={isLocked}
      >
        <Plus size={16} className="inline mr-2" />
        Create Episode
      </button>
    </div>
  );
}