import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, Loader2, Share2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/api/base44Client';
import PitchDeckPreview from '@/components/pitch/PitchDeckPreview';

async function loadPublicPitch(slug) {
  const { data, error } = await supabase.rpc('get_public_pitch', { p_slug: slug });
  if (error) throw error;
  return data;
}

export default function PitchDeckShare() {
  const [params] = useSearchParams();
  const slug = params.get('slug');
  const [copied, setCopied] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ['public-pitch', slug],
    queryFn: () => loadPublicPitch(slug),
    enabled: Boolean(slug),
    retry: false,
  });

  const title = data?.project?.final_title || data?.project?.working_title || 'Pitch deck';

  useEffect(() => {
    if (data?.project) document.title = `${title} Â· AISTAGE.ONE`;
  }, [data?.project, title]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-cyan-400"><Loader2 className="h-9 w-9 animate-spin" /></div>;
  if (!slug || error || !data?.project) return <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-8 text-center text-white"><div><p className="text-[11px] font-bold tracking-[.28em] text-cyan-400">OLO PITCH BUILDER</p><h1 className="mt-4 text-3xl font-bold">Pitch unavailable</h1><p className="mt-2 text-sm text-zinc-500">This link is private, unpublished or no longer available.</p></div></div>;

  return <main className="min-h-screen bg-zinc-950 text-white">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-3 md:px-6">
      <div className="min-w-0"><p className="text-[9px] font-bold tracking-[.25em] text-cyan-400">OLO PITCH BUILDER</p><h1 className="truncate text-sm font-semibold text-zinc-200">{title}</h1></div>
      <button onClick={copyLink} className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20">{copied ? <Copy size={14} /> : <Share2 size={14} />}{copied ? 'LINK COPIED' : 'SHARE'}</button>
    </header>
    <section className="p-2 md:p-4"><PitchDeckPreview project={data.project} sections={data.sections || []} media={data.media || []} characters={data.characters || []} standalone publicMode /></section>
  </main>;
}

