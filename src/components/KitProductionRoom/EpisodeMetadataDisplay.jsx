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

  const uploadPoster = async (file) => {
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onPosterChange?.(file_url);
  };

  return (
    <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#23c7be]">Episode</p>
          <p className="mt-1 text-sm text-white/40">Publication details and episode identity</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative h-[72px] w-[48px] flex-shrink-0 overflow-hidden rounded-[3px] border border-white/10 bg-black/30">
            {posterImage ? (
              <img src={posterImage} alt="Poster" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[#23c7be]/70"><Film size={18} /></div>
            )}
            {posterImage && !isLocked && (
              <button onClick={() => onPosterChange?.(null)} className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-[2px] bg-black/80 text-white/70 hover:text-white" title="Remove poster">
                <X size={10} />
              </button>
            )}
          </div>

          {!isLocked && (
            <label className="cursor-pointer rounded-[3px] border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase tracking-wide text-white/65 transition hover:border-[#23c7be]/40 hover:text-white">
              {posterImage ? 'Change poster' : 'Add poster'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadPoster(e.target.files?.[0])} />
            </label>
          )}

          {isLocked && <span className="rounded-[3px] border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white/45">Locked</span>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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
          <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/45">Episode Title</p>
          <input
            value={episodeTitle}
            onChange={e => onTitleChange(e.target.value)}
            placeholder="Episode title…"
            disabled={isLocked}
            className={fieldClass}
          />
        </div>
      </div>

      <div className="mt-4">
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

      <div className="mt-4">
        <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/45">Episode Description</p>
        <textarea
          value={episodeDesc}
          onChange={e => onDescChange(e.target.value)}
          onBlur={onSave}
          placeholder="Episode description…"
          rows={3}
          disabled={isLocked}
          className={`${fieldClass} resize-none`}
        />
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={onSave}
          disabled={isLocked || !episodeTitle?.trim()}
          className="min-w-[110px] rounded-[3px] border border-[#23c7be] bg-[#23c7be] px-5 py-3 text-sm font-black text-[#071211] transition hover:bg-[#35d8cf] disabled:border-white/10 disabled:bg-white/[0.05] disabled:text-white/30"
        >
          {saving ? 'Saving…' : 'Save Episode'}
        </button>
      </div>

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