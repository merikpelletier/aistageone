import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Film, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ProjectCreditsFields from '@/components/studio/ProjectCreditsFields';

export default function EpisodeMetadataDisplay({ 
  posterImage, 
  seriesDesc, 
  authorName, 
  contributors,
  publicationDate,
  episodeTitle,
  episodeDesc,
  category,
  isLocked,
  onTitleChange,
  onDescChange,
  onSeriesChange,
  onAuthorChange,
  onContributorsChange,
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

  const fieldClass = `w-full rounded-[3px] border border-white/15 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#23c7be] ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`;

  return (
    <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4 md:p-5">
      <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#23c7be]">Episode</p>
          <p className="mt-1 text-sm text-white/40">Publication details and episode identity</p>
        </div>
        {isLocked && <span className="rounded-[3px] border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white/45">Locked</span>}
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px]">
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/45">Category</p>
            <select
              value={category || ''}
              onChange={e => onCategoryChange?.(e.target.value)}
              onBlur={onSave}
              disabled={isLocked}
              className={`${fieldClass} ${!category ? 'text-white/35' : ''}`}
            >
              <option value="">Select a category…</option>
              {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
            </select>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/45">Series Description</p>
            <textarea
              value={seriesDesc || ''}
              onChange={e => onSeriesChange?.(e.target.value)}
              onBlur={onSave}
              placeholder="Describe the series…"
              rows={3}
              disabled={isLocked}
              className={`${fieldClass} resize-none`}
            />
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/45">Poster Image</p>
          {posterImage ? (
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[3px] border border-white/10 bg-black">
              <img src={posterImage} alt="Poster" className="h-full w-full object-cover" />
              {!isLocked && (
                <button onClick={() => onPosterChange?.(null)} className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-[3px] bg-black/75 text-white/70 hover:text-white">
                  <X size={12} />
                </button>
              )}
            </div>
          ) : (
            <label className={`flex aspect-[2/3] w-full flex-col items-center justify-center gap-2 rounded-[3px] border border-dashed border-white/15 bg-black/20 transition ${isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-[#23c7be]/50 hover:bg-black/30'}`}>
              <Film size={24} className="text-[#23c7be]" />
              <span className="text-xs font-bold text-white/55">Upload poster</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={isLocked}
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
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <input
          value={episodeTitle}
          onChange={e => onTitleChange(e.target.value)}
          placeholder="Episode title…"
          disabled={isLocked}
          className={fieldClass}
        />
        <button
          onClick={onSave}
          disabled={isLocked || !episodeTitle?.trim()}
          className="min-w-[110px] rounded-[3px] border border-[#23c7be] bg-[#23c7be] px-5 py-3 text-sm font-black text-[#071211] transition hover:bg-[#35d8cf] disabled:border-white/10 disabled:bg-white/[0.05] disabled:text-white/30"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <textarea
        value={episodeDesc}
        onChange={e => onDescChange(e.target.value)}
        onBlur={onSave}
        placeholder="Episode description…"
        rows={3}
        disabled={isLocked}
        className={`${fieldClass} mt-3 resize-none`}
      />

      <div className="mt-4 border-t border-white/10 pt-4">
        <ProjectCreditsFields
          dark
          disabled={isLocked}
          authorName={authorName}
          onAuthorChange={onAuthorChange}
          contributors={contributors || []}
          onContributorsChange={onContributorsChange}
        />
      </div>

      <div className="mt-4 border-t border-white/10 pt-4">
        <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/45">Publication Date</p>
        <input
          type="date"
          value={publicationDate || ''}
          onChange={e => onPubDateChange?.(e.target.value)}
          onBlur={onSave}
          disabled={isLocked}
          className={fieldClass}
        />
      </div>
    </section>
  );
}