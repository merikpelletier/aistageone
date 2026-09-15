import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Image as ImageIcon, List, Loader2, Monitor, Music, Pause, Play, Smartphone, Square, Tablet, Volume2 } from 'lucide-react';
import { getPitchTemplate } from './pitchDeckTemplates';
import { usePitchVoiceReader } from '@/hooks/usePitchVoiceReader';

export const mediaUrl = (item) => item?.source_media_url || item?.media_url || item?.file_url || '';
export const mediaThumbnail = (item) => item?.source_thumbnail_url || item?.thumbnail_url || mediaUrl(item);

const isAudio = (url, type) => type === 'audio' || /\.(mp3|wav|m4a|aac|flac|opus|oga)(\?|$)/i.test(url || '');
const isVideo = (url, type) => type === 'video' || /\.(mp4|webm|mov|m4v|ogg|ogv|m3u8)(\?|$)/i.test(url || '') || /player\.api\.video|youtube\.com|youtu\.be|vimeo\.com/i.test(url || '');

function embedUrl(url) {
  const youtube = url?.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^?&/]+)/i);
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;
  const vimeo = url?.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return /player\.api\.video/i.test(url || '') ? url : '';
}

function Media({ url, type, title, className = '' }) {
  if (!url) return <div className={`flex items-center justify-center bg-zinc-900 text-zinc-700 ${className}`}><ImageIcon className="h-10 w-10" /></div>;
  if (isAudio(url, type)) return <div className={`flex items-center gap-3 bg-zinc-900 p-4 ${className}`}><Music className="h-6 w-6 shrink-0 text-emerald-400" /><audio src={url} controls preload="metadata" className="w-full" /></div>;
  if (isVideo(url, type)) {
    const embed = embedUrl(url);
    if (embed) return <iframe src={embed} title={title || 'Pitch video'} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen className={className} />;
    return <video src={url} controls playsInline preload="metadata" className={className} />;
  }
  return <img src={url} alt={title || ''} className={className} />;
}

const variants = {
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 } },
  slide: { initial: { opacity: 0, x: 70 }, animate: { opacity: 1, x: 0 } },
  zoom: { initial: { opacity: 0, scale: 1.1 }, animate: { opacity: 1, scale: 1 } },
  push_in: { initial: { opacity: 0, scale: 1.16 }, animate: { opacity: 1, scale: 1 } },
  pan: { initial: { opacity: 0, x: -80 }, animate: { opacity: 1, x: 0 } },
  reveal: { initial: { opacity: 0, filter: 'blur(14px)' }, animate: { opacity: 1, filter: 'blur(0)' } },
  glitch: { initial: { opacity: 0 }, animate: { opacity: 1, x: [0, -10, 9, -5, 4, 0] } },
};

export default function PitchDeckPreview({ project, sections = [], media = [], characters = [], selectedId, onSelectSection, standalone = false, publicMode = false }) {
  const [current, setCurrent] = useState(0);
  const [device, setDevice] = useState('desktop');
  const [menuOpen, setMenuOpen] = useState(false);
  const visible = useMemo(() => sections.filter((section) => section.is_visible !== false), [sections]);
  const template = getPitchTemplate(project?.selected_template_id);
  const reader = usePitchVoiceReader({
    visibleSections: visible,
    currentIndex: current,
    onSectionChange: setCurrent,
  });

  useEffect(() => {
    const index = visible.findIndex((section) => section.id === selectedId);
    if (index >= 0) setCurrent(index);
  }, [selectedId, visible]);
  useEffect(() => { if (current >= visible.length) setCurrent(Math.max(0, visible.length - 1)); }, [current, visible.length]);

  if (!visible.length) return <div className="flex min-h-[520px] items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-sm text-zinc-500">Add a section to begin your pitch.</div>;

  const section = visible[current];
  const url = mediaUrl(section);
  const title = section.section_type === 'cover' ? (project?.final_title || project?.working_title || section.title) : section.title;
  const subtitle = section.section_type === 'cover' ? (section.subtitle || project?.tagline) : section.subtitle;
  const body = section.body || (section.section_type !== 'cover' ? project?.logline_full : '');
  const layout = section.layout_type || (section.section_type === 'cover' ? 'hero' : 'text');
  const gallery = Array.isArray(section.gallery_media) && section.gallery_media.length ? section.gallery_media : (url ? [url] : []);
  const foreground = template.light ? 'text-zinc-950' : 'text-white';
  const muted = template.light ? 'text-zinc-700' : 'text-zinc-300';
  const width = standalone ? 'w-full' : device === 'mobile' ? 'max-w-[340px]' : device === 'tablet' ? 'max-w-2xl' : 'w-full';
  const height = standalone ? 'min-h-[calc(100dvh-5rem)]' : 'min-h-[560px]';
  const headingStyle = { fontFamily: template.serif ? 'Georgia, serif' : 'inherit' };
  const Text = <div className="relative z-10 space-y-4"><h2 className={`text-3xl font-bold md:text-5xl ${foreground}`} style={headingStyle}>{title || 'Untitled section'}</h2>{subtitle && <p className={`text-lg italic md:text-xl ${muted}`}>{subtitle}</p>}{section.show_text !== false && body && <div className={`pitch-body max-w-3xl text-sm leading-relaxed md:text-base ${muted}`} dangerouslySetInnerHTML={{ __html: body }} />}</div>;

  const render = () => {
    if (layout === 'hero') return <div className={`relative flex ${height} items-center justify-center overflow-hidden px-8 text-center`}><div className="absolute inset-0">{url ? <Media url={url} title={title} className="h-full w-full object-cover" /> : null}</div>{url && <div className="absolute inset-0 bg-black/55" />}{Text}</div>;
    if (layout === 'split') return <div className={`grid ${height} items-center gap-7 p-7 ${device === 'mobile' ? 'grid-cols-1' : 'md:grid-cols-2'}`}><div>{Text}</div><div className="overflow-hidden rounded-xl border border-zinc-700 bg-black"><Media url={url} title={title} className="h-[360px] w-full object-contain" /></div></div>;
    if (layout === 'gallery') return <div className={`${height} p-7`}><div className="mb-6 text-center">{Text}</div><div className="grid grid-cols-2 gap-3 md:grid-cols-3">{(gallery.length ? gallery : media.slice(0, 6).map(mediaUrl)).map((item, index) => <div key={`${item}-${index}`} className="aspect-video overflow-hidden rounded-lg border border-zinc-700 bg-black"><Media url={item} title={title} className="h-full w-full object-cover" /></div>)}</div></div>;
    if (layout === 'video' || layout === 'audio') return <div className={`flex ${height} flex-col p-6`}><div className="mb-4 text-center">{Text}</div><div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-zinc-700 bg-black"><Media url={url} type={layout} title={title} className="h-full max-h-[70vh] w-full object-contain" /></div></div>;
    if (layout === 'banner') return <div className={`${height}`}><Media url={url} title={title} className="h-[45vh] w-full object-cover" /><div className="p-7 text-center">{Text}</div></div>;
    if (layout === 'cards') return <div className={`${height} p-7`}><div className="mb-6 text-center">{Text}</div><div className="grid grid-cols-2 gap-3 md:grid-cols-3">{characters.slice(0, 6).map((character) => <div key={character.id} className="overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900"><Media url={character.source_image_url} title={character.name} className="h-36 w-full object-cover" /><div className="p-3"><p className={`font-bold ${foreground}`}>{character.name}</p><p className={`text-xs ${muted}`}>{character.role}</p></div></div>)}</div></div>;
    if (layout === 'timeline') return <div className={`flex ${height} items-center justify-center p-8`}><div className="w-full max-w-3xl">{Text}<div className="mt-8 space-y-4 border-l border-cyan-500/50 pl-6">{String(body || '').split('\n').filter(Boolean).map((line, index) => <p key={index} className={`relative text-sm ${muted}`}><span className="absolute -left-[30px] top-1 h-3 w-3 rounded-full bg-cyan-400" />{line}</p>)}</div></div></div>;
    return <div className={`flex ${height} items-center justify-center p-10 text-center`}><div className="max-w-3xl">{Text}{url && <div className="mt-8 overflow-hidden rounded-xl"><Media url={url} title={title} className="max-h-72 w-full object-contain" /></div>}</div></div>;
  };

  const go = (index) => { if (index < 0 || index >= visible.length) return; reader.stop(); setCurrent(index); onSelectSection?.(visible[index].id); };

  return <div className="relative">
    {!standalone && <div className="mb-3 flex justify-center gap-1"><button onClick={() => setDevice('desktop')} className={`rounded-md p-2 ${device === 'desktop' ? 'bg-cyan-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}><Monitor size={16} /></button><button onClick={() => setDevice('tablet')} className={`rounded-md p-2 ${device === 'tablet' ? 'bg-cyan-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}><Tablet size={16} /></button><button onClick={() => setDevice('mobile')} className={`rounded-md p-2 ${device === 'mobile' ? 'bg-cyan-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}><Smartphone size={16} /></button></div>}
    <div className={`${width} mx-auto overflow-hidden rounded-xl border border-zinc-700 bg-gradient-to-br ${template.gradient} shadow-2xl`} style={project?.source_custom_background_url ? { backgroundImage: `linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.45)),url(${project.source_custom_background_url})`, backgroundSize: 'cover' } : undefined}>
      <motion.div key={section.id} initial={(variants[section.transition_type] || variants.fade).initial} animate={(variants[section.transition_type] || variants.fade).animate} transition={{ duration: .55 }}>{render()}</motion.div>
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-zinc-400">
      <button onClick={() => go(current - 1)} disabled={current === 0} aria-label="Previous section" className="rounded-full border border-zinc-700 p-2 disabled:opacity-25"><ChevronLeft size={18} /></button>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button onClick={() => setMenuOpen(!menuOpen)} className="inline-flex h-9 items-center gap-2 rounded-full border border-zinc-700 px-3 text-xs"><List size={15} /> {current + 1} / {visible.length}</button>
        {(standalone || publicMode) && section.narration_audio_url && (
          reader.isReading
            ? <button onClick={reader.toggle} aria-label={reader.isPaused ? 'Resume narration' : 'Pause narration'} title="Pause narration" className="inline-flex h-9 items-center gap-2 rounded-full border border-cyan-400 bg-cyan-500 px-3 text-xs font-bold text-white">{reader.isPaused ? <Play size={15} /> : <Pause size={15} />} {reader.isPaused ? 'RESUME' : 'PAUSE'}</button>
            : <button onClick={reader.toggle} aria-label="Play narration" title="Play narration" className="inline-flex h-9 items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-3 text-xs font-bold text-cyan-300">{reader.isGenerating ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} PLAY</button>
        )}
      </div>
      <button onClick={() => go(current + 1)} disabled={current === visible.length - 1} aria-label="Next section" className="rounded-full border border-zinc-700 p-2 disabled:opacity-25"><ChevronRight size={18} /></button>
    </div>
    {(standalone || publicMode) && reader.error && <p className="mt-2 text-center text-xs text-red-400">{reader.error}</p>}
    {menuOpen && <div className="absolute bottom-12 left-1/2 z-40 w-72 -translate-x-1/2 rounded-xl border border-zinc-700 bg-zinc-950 p-2 shadow-2xl">{visible.map((item, index) => <button key={item.id} onClick={() => { go(index); setMenuOpen(false); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs ${index === current ? 'bg-cyan-500/15 text-cyan-300' : 'text-zinc-300 hover:bg-zinc-800'}`}><span className="text-zinc-600">{index + 1}</span><span className="truncate">{item.title || item.section_type}</span></button>)}</div>}
  </div>;
}
