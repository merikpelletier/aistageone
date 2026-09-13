import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Film, Image as ImageIcon, Loader2, Music, Pencil } from 'lucide-react';
import { supabase } from '@/api/base44Client';
import PitchDeckPreview, { mediaThumbnail, mediaUrl } from '@/components/pitch/PitchDeckPreview';

async function loadPitchDeck(projectId) {
  const results = await Promise.all([
    supabase.from('pitch_project').select('*').eq('id', projectId).single(),
    supabase.from('pitch_section').select('*').eq('pitch_project_id', projectId).order('order_index'),
    supabase.from('pitch_media').select('*').eq('pitch_project_id', projectId).order('display_order'),
    supabase.from('pitch_character').select('*').eq('pitch_project_id', projectId).order('display_order'),
  ]);
  const error = results.map((result) => result.error).find(Boolean);
  if (error) throw error;
  return { project: results[0].data, sections: results[1].data || [], media: results[2].data || [], characters: results[3].data || [] };
}

export default function PitchDeckDetail() {
  const [params] = useSearchParams();
  const projectId = params.get('id');
  const { data, isLoading, error } = useQuery({ queryKey: ['pitch-deck', projectId], queryFn: () => loadPitchDeck(projectId), enabled: Boolean(projectId) });

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-zinc-950"><Loader2 className="h-8 w-8 animate-spin text-cyan-400" /></div>;
  if (!projectId || error || !data?.project) return <div className="min-h-screen bg-zinc-950 p-8 text-white"><Link to="/PitchDecks" className="inline-flex items-center gap-2 text-cyan-400"><ArrowLeft size={18} /> PITCH DECKS</Link><p className="mt-12 border-l-4 border-cyan-500 bg-zinc-900 p-6">This private pitch deck is unavailable.</p></div>;

  return <div className="min-h-screen bg-zinc-950 pb-20 text-white">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-4"><div className="flex items-center gap-4"><Link to="/PitchDecks" className="inline-flex items-center gap-2 text-sm font-bold text-cyan-400"><ArrowLeft size={18} /> PITCH DECKS</Link><Link to="/Studio?tab=tools" className="text-xs text-zinc-500 hover:text-white">STUDIO TOOLS</Link></div><Link to={`/PitchDeckEditor?id=${encodeURIComponent(projectId)}`} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-xs font-bold"><Pencil size={14} /> EDIT</Link></header>
    <main className="mx-auto max-w-[1500px] p-4"><div className="mb-4"><p className="text-[10px] font-bold tracking-[.25em] text-cyan-400">OLO PITCH BUILDER</p><h1 className="mt-1 text-2xl font-bold">{data.project.final_title || data.project.working_title}</h1></div><PitchDeckPreview project={data.project} sections={data.sections} media={data.media} characters={data.characters} standalone />
      {data.media.length > 0 && <section className="mt-10 border-t border-zinc-800 pt-7"><div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-cyan-400">Media library</p><h2 className="mt-1 text-2xl font-bold">Images, videos and audio</h2></div><span className="text-sm text-zinc-500">{data.media.length} media</span></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.media.map((item) => { const url = mediaUrl(item); const Icon = item.media_type === 'video' ? Film : item.media_type === 'audio' ? Music : ImageIcon; return <article key={item.id} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"><div className="flex aspect-video items-center justify-center bg-black">{item.media_type === 'video' ? <video src={url} controls playsInline preload="metadata" className="h-full w-full object-contain" /> : item.media_type === 'audio' ? <div className="w-full p-5"><Music className="mx-auto mb-4 text-emerald-400" /><audio src={url} controls className="w-full" /></div> : mediaThumbnail(item) ? <img src={mediaThumbnail(item)} alt={item.title || ''} className="h-full w-full object-cover" /> : <Icon className="text-zinc-700" />}</div><div className="p-3"><p className="truncate text-sm font-bold">{item.title || 'Untitled media'}</p><p className="mt-1 text-[10px] uppercase text-zinc-600">{item.media_type}</p></div></article>; })}</div></section>}
    </main>
  </div>;
}

