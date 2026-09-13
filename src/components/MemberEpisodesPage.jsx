import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Play, User } from 'lucide-react';

function MediaThumb({ url, onClick }) {
  if (!url) return null;
  const isVideo = url.match(/\.(mp4|webm|ogg)$/i);
  return (
    <div className="relative w-full cursor-pointer" style={{ aspectRatio: '9/16' }} onClick={onClick}>
      {isVideo ? (
        <video src={url} className="w-full h-full object-cover rounded-lg" playsInline />
      ) : (
        <img src={url} alt="" className="w-full h-full object-cover rounded-lg" />
      )}
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
          <Play size={28} className="text-white" fill="white" />
        </div>
      )}
    </div>
  );
}

function EpisodeCard({ entry, onMediaClick }) {
  const blocks = (entry.blocks || []).filter(b => b.media_url);
  const firstMedia = blocks[0]?.media_url;

  return (
    <div className="bg-white/5 rounded-xl overflow-hidden border border-white/10">
      {firstMedia && (
        <div className="w-full" style={{ maxHeight: '45vh' }}>
          <MediaThumb url={firstMedia} onClick={() => onMediaClick(firstMedia)} />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
            <User size={14} className="text-white" />
          </div>
          <p className="text-white text-xs truncate">{entry.user_email}</p>
        </div>
        {entry.episode_title && (
          <p className="text-white font-light tracking-wide text-sm mb-1">{entry.episode_title}</p>
        )}
        {entry.episode_description && (
          <p className="text-white text-xs leading-relaxed line-clamp-2">{entry.episode_description}</p>
        )}
        {blocks.length > 1 && (
          <div className="mt-3 grid grid-cols-3 gap-1">
            {blocks.slice(1, 4).map((b, i) => (
              <MediaThumb key={i} url={b.media_url} onClick={() => onMediaClick(b.media_url)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CastCard({ entry, episodePages, onMediaClick }) {
  // Find the episode page this timeline belongs to
  const episodePage = episodePages.find(p => p.id === entry.episode_page_id);
  const overrides = (entry.block_overrides || []).filter(b => b.user_media_url && b.status !== 'pending');
  const firstMedia = entry.character_photo_url || overrides[0]?.user_media_url;

  return (
    <div className="bg-white/5 rounded-xl overflow-hidden border border-white/10">
      {firstMedia && (
        <div className="w-full" style={{ maxHeight: '45vh' }}>
          <MediaThumb url={firstMedia} onClick={() => onMediaClick(firstMedia)} />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
            <User size={14} className="text-white" />
          </div>
          <p className="text-white text-xs truncate">{entry.user_email}</p>
        </div>
        {episodePage && (
          <p className="text-white font-light tracking-wide text-sm mb-1">
            {episodePage.episode_title || episodePage.title || 'Episode'}
          </p>
        )}
        {entry.selected_method && (
          <p className="text-white text-xs">{entry.selected_method.replace(/_/g, ' ')}</p>
        )}
        {overrides.length > 1 && (
          <div className="mt-3 grid grid-cols-3 gap-1">
            {overrides.slice(1, 4).map((b, i) => (
              <MediaThumb key={i} url={b.user_media_url} onClick={() => onMediaClick(b.user_media_url)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MemberEpisodesPage({ page, dossier, pages }) {
  const [fullscreen, setFullscreen] = useState(null);

  const { data: kitProductions = [] } = useQuery({
    queryKey: ['kitProductions', dossier?.id],
    queryFn: () => base44.entities.TimelineStory.filter({ dossier_id: dossier?.id, is_published: true }),
    enabled: !!dossier?.id,
  });

  const episodePages = (pages || []).filter(p => p.page_type === 'episode');
  const episodePageIds = episodePages.map(p => p.id);

  const { data: allTimelines = [] } = useQuery({
    queryKey: ['userTimelines', dossier?.id],
    queryFn: async () => {
      if (!episodePageIds.length) return [];
      // Fetch published timelines for all episode pages of this dossier
      const results = await Promise.all(
        episodePageIds.map(id => base44.entities.UserTimeline.filter({ episode_page_id: id, is_published: true }))
      );
      return results.flat();
    },
    enabled: episodePageIds.length > 0,
  });

  const hasContent = kitProductions.length > 0 || allTimelines.length > 0;

  return (
    <div className="absolute inset-0 flex flex-col overflow-y-auto pointer-events-auto bg-black">
      <div className="px-6 pt-6 pb-4 flex-shrink-0">
        <p className="text-white text-xs tracking-widest uppercase mb-1">Community</p>
        <h2 className="text-white text-2xl font-extralight tracking-wider">
          {page?.title || 'Member Episodes'}
        </h2>
        {page?.content && (
          <p className="text-white text-sm font-light mt-2">{page.content}</p>
        )}
      </div>

      {!hasContent ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white/20 text-sm">No member episodes yet.</p>
        </div>
      ) : (
        <div className="px-4 pb-24 space-y-4">
          {allTimelines.map((entry) => (
            <CastCard
              key={entry.id}
              entry={entry}
              episodePages={episodePages}
              onMediaClick={setFullscreen}
            />
          ))}
          {kitProductions.map((entry) => (
            <EpisodeCard
              key={entry.id}
              entry={entry}
              onMediaClick={setFullscreen}
            />
          ))}
        </div>
      )}

      {/* Fullscreen media */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center" onClick={() => setFullscreen(null)}>
          {fullscreen.match(/\.(mp4|webm|ogg)$/i) ? (
            <video src={fullscreen} controls autoPlay playsInline className="w-full h-full object-contain" onClick={e => e.stopPropagation()} />
          ) : (
            <img src={fullscreen} alt="" className="w-full h-full object-contain" />
          )}
          <button className="absolute top-4 right-4 text-white bg-white/10 rounded-full w-10 h-10 flex items-center justify-center text-xl">✕</button>
        </div>
      )}
    </div>
  );
}