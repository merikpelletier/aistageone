import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/base44Client';
import { Film, RefreshCw } from 'lucide-react';

function formatDuration(seconds) {
  if (!Number.isFinite(Number(seconds))) return '—';
  const total = Math.round(Number(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function AdminVideoLibrary() {
  const query = useQuery({
    queryKey: ['stream-video-library'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('video_asset')
        .select('*')
        .neq('status', 'deleted')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      <section className="border border-white/10 bg-neutral-950 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><Film size={18} /><h2 className="text-xl font-light">Cloudflare Stream</h2></div>
            <p className="mt-1 text-sm text-white/50">Technical monitoring of videos uploaded from AISTAGE.ONE creator workflows.</p>
          </div>
          <button type="button" onClick={() => query.refetch()} className="min-h-10 px-3 border border-white/15 text-sm flex items-center gap-2 hover:bg-white/5"><RefreshCw size={14} />Refresh</button>
        </div>
        {query.isLoading ? <p className="text-sm text-white/50">Loading…</p> : query.error ? <p className="text-sm text-red-300">{query.error.message}</p> : !query.data?.length ? <p className="text-sm text-white/45">No Stream videos yet.</p> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {query.data.map(video => (
              <article key={video.id} className="border border-white/10 bg-black p-3 space-y-3">
                <div className="aspect-video bg-neutral-900 overflow-hidden flex items-center justify-center">
                  {video.player_url ? (
                    <iframe src={video.player_url} title="Cloudflare Stream video" className="h-full w-full border-0" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowFullScreen />
                  ) : video.thumbnail_url ? (
                    <img src={video.thumbnail_url} alt="" className="h-full w-full object-cover" />
                  ) : <Film size={28} className="text-white/25" />}
                </div>
                <div className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-white">{video.provider_video_id}</p>
                    <p className="text-xs text-white/45">{formatDuration(video.duration_seconds)} · {video.status}</p>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider border border-white/10 px-2 py-1">Stream</span>
                </div>
                {video.playback_url && <button type="button" onClick={() => navigator.clipboard?.writeText(video.playback_url)} className="w-full min-h-10 border border-white/15 text-xs hover:bg-white/5">Copy HLS URL</button>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
