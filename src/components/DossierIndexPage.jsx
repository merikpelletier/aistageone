import React from 'react';

function isVideoUrl(url = '') {
  return /\.(mp4|webm|ogg)(\?|$)/i.test(url);
}

const PAGE_LABELS = {
  cover: 'Cover',
  text: 'Story',
  image: 'Gallery',
  video: 'Series Teaser',
  mixed: 'Feature',
  join_cast: 'Join the Cast',
  episode: 'Episode',
  series: 'Series',
  production_kit: 'Production Kit',
  member_episodes: 'Member Episodes',
  block_player: 'Episode',
  contest: 'Open Call',
};

function plainText(value = '') {
  return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function DossierIndexPage({ page, pages, dossier, onNavigate }) {
  const entries = Array.from(
    new Map(
      (pages || [])
        .filter((item) => item && item.id && item.page_type !== 'index' && item.id !== page?.id)
        .map((item) => [item.id, item])
    ).values()
  );

  return (
    <div className="absolute inset-0 bg-black overflow-y-auto pointer-events-auto">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8 md:px-10 lg:px-14 pt-20 md:pt-24 pb-28 md:pb-32">
        <header className="mb-10 md:mb-14">
          <div className="flex items-end justify-between gap-6 border-b border-white/20 pb-6 md:pb-8">
            <div>
              <p className="text-white/40 text-[10px] md:text-xs uppercase tracking-[0.34em] mb-3">
                {dossier?.title || 'Dossier'}
              </p>
              <h2 className="text-white text-5xl md:text-7xl lg:text-8xl font-extralight tracking-[-0.04em] leading-[0.9]">
                {page?.title || 'Contents'}
              </h2>
            </div>
            <div className="hidden md:block text-white/35 text-xs tracking-[0.28em] uppercase pb-1">
              {String(entries.length).padStart(2, '0')} entries
            </div>
          </div>

          {page?.content && (
            <div
              className="text-white/60 text-sm md:text-base leading-relaxed mt-5 md:mt-6 max-w-2xl"
              dangerouslySetInnerHTML={{ __html: page.content }}
            />
          )}
        </header>

        <div className="divide-y divide-white/15 border-y border-white/15">
          {entries.map((item, index) => {
            const sourceMedia = item.media_url_landscape || item.media_url || '';
            const sourceIsVideo = item.page_type === 'video' || isVideoUrl(sourceMedia);
            const fallbackPoster = (item.images || []).find((url) => url && !isVideoUrl(url))
              || dossier?.cover_image_landscape
              || dossier?.cover_image
              || '';
            const thumb = sourceIsVideo
              ? fallbackPoster
              : (sourceMedia || (item.page_type === 'cover' ? dossier?.cover_image_landscape || dossier?.cover_image : ''));
            const title = item.episode_title || item.title || PAGE_LABELS[item.page_type] || 'Untitled';
            const typeLabel = PAGE_LABELS[item.page_type] || item.page_type || 'Page';
            const description = plainText(item.episode_description || item.content || '');
            const number = String(index + 1).padStart(2, '0');

            return (
              <button
                key={item.id || index}
                type="button"
                onClick={() => onNavigate?.(item)}
                className="group w-full text-left py-5 md:py-7 grid grid-cols-[48px_minmax(0,1fr)] md:grid-cols-[72px_220px_minmax(0,1fr)_36px] lg:grid-cols-[88px_280px_minmax(0,1fr)_44px] gap-x-4 md:gap-x-6 items-center"
              >
                <div className="self-start md:self-center pt-1 md:pt-0">
                  <span className="text-white/30 text-sm md:text-base font-light tracking-[0.16em]">
                    {number}
                  </span>
                </div>

                <div className="col-start-2 md:col-start-2 row-start-1 md:row-auto">
                  <div className="relative aspect-[16/10] overflow-hidden bg-neutral-900">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="w-full h-full object-cover opacity-85 transition-transform duration-500 group-hover:scale-[1.02] group-hover:opacity-100"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center border border-white/10">
                        <span className="text-white/25 text-[10px] uppercase tracking-[0.28em]">{typeLabel}</span>
                      </div>
                    )}
                    {sourceIsVideo && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-10 h-10 md:w-12 md:h-12 border border-white/55 bg-black/40 flex items-center justify-center">
                          <span className="text-white text-sm translate-x-[1px]">▶</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="col-start-2 md:col-start-3 row-start-2 md:row-auto mt-4 md:mt-0 min-w-0">
                  <div className="text-white/40 text-[10px] uppercase tracking-[0.28em] mb-2">
                    {typeLabel}
                  </div>
                  <h3 className="text-white text-2xl md:text-3xl lg:text-4xl font-extralight leading-[1.05] tracking-[-0.02em]">
                    {title}
                  </h3>
                  {description && (
                    <p className="text-white/50 text-sm leading-relaxed mt-3 line-clamp-2 max-w-2xl">
                      {description}
                    </p>
                  )}
                </div>

                <div className="hidden md:flex md:col-start-4 items-center justify-end text-white/35 group-hover:text-white transition-colors">
                  <span className="text-2xl font-extralight">→</span>
                </div>
              </button>
            );
          })}
        </div>

        {entries.length === 0 && (
          <div className="border-y border-white/15 py-12 text-white/40 text-sm text-center uppercase tracking-[0.2em]">
            No public pages yet
          </div>
        )}
      </div>
    </div>
  );
}
