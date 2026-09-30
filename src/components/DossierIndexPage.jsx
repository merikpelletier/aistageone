import React from 'react';

const PAGE_META = {
  cover: { icon: '🖼️', label: 'Cover' },
  text: { icon: '📝', label: 'Story' },
  image: { icon: '🖼️', label: 'Gallery' },
  video: { icon: '🎬', label: 'Video' },
  mixed: { icon: '📰', label: 'Feature' },
  join_cast: { icon: '🎭', label: 'Join the Cast' },
  episode: { icon: '🎬', label: 'Episode' },
  series: { icon: '📺', label: 'Series' },
  production_kit: { icon: '🎞️', label: 'Production Kit' },
  member_episodes: { icon: '🌟', label: 'Member Episodes' },
  block_player: { icon: '▶', label: 'Player' },
  contest: { icon: '🏆', label: 'Contest' },
};

export default function DossierIndexPage({ page, pages, dossier, onNavigate }) {
  const entries = (pages || []).filter((item) => item.id !== page?.id && item.page_type !== 'index');

  return (
    <div className="absolute inset-0 bg-black overflow-y-auto pointer-events-auto">
      <div className="max-w-6xl mx-auto px-5 md:px-10 pt-24 pb-28">
        <div className="border-b border-white/20 pb-7 mb-7">
          <p className="text-white/50 text-xs uppercase tracking-[0.28em] mb-3">Dossier Index</p>
          <h2 className="text-white text-3xl md:text-5xl font-extralight tracking-wide">
            {page?.title || dossier?.title || 'Contents'}
          </h2>
          {page?.content && (
            <div
              className="text-white/70 text-sm md:text-base leading-relaxed mt-4 max-w-3xl"
              dangerouslySetInnerHTML={{ __html: page.content }}
            />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/15 border border-white/15">
          {entries.map((item, index) => {
            const meta = PAGE_META[item.page_type] || { icon: '📄', label: item.page_type || 'Page' };
            const thumb = item.media_url_landscape || item.media_url || (item.page_type === 'cover' ? dossier?.cover_image_landscape || dossier?.cover_image : '');
            const title = item.episode_title || item.title || meta.label;
            const description = item.episode_description || item.content || '';

            return (
              <button
                key={item.id || index}
                type="button"
                onClick={() => onNavigate?.(item)}
                className="group text-left bg-neutral-950 hover:bg-neutral-900 transition-colors min-h-44 flex flex-col"
              >
                {thumb ? (
                  <div className="h-36 w-full overflow-hidden bg-black">
                    {item.page_type === 'video' || /\.(mp4|webm|ogg)(\?|$)/i.test(thumb) ? (
                      <video src={thumb} muted playsInline preload="metadata" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    ) : (
                      <img src={thumb} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                ) : (
                  <div className="h-24 flex items-center justify-center border-b border-white/10 text-3xl">{meta.icon}</div>
                )}

                <div className="p-4 flex-1">
                  <div className="flex items-center gap-2 text-white/45 text-[11px] uppercase tracking-[0.18em] mb-2">
                    <span>{meta.icon}</span>
                    <span>{meta.label}</span>
                  </div>
                  <h3 className="text-white text-lg font-light leading-tight">{title}</h3>
                  {description && (
                    <p className="text-white/55 text-xs leading-relaxed mt-2 line-clamp-2">
                      {String(description).replace(/<[^>]*>/g, ' ')}
                    </p>
                  )}
                </div>
                <div className="px-4 pb-4 text-white/50 text-xs tracking-widest group-hover:text-white transition-colors">
                  OPEN →
                </div>
              </button>
            );
          })}
        </div>

        {entries.length === 0 && (
          <div className="border border-white/15 p-8 text-white/50 text-sm text-center">No public pages yet.</div>
        )}
      </div>
    </div>
  );
}
