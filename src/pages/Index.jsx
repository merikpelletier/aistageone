import React, { useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ChevronDown, Play, Sparkles } from 'lucide-react';
import TopBanner from '@/components/TopBanner';

const CLASS_ORDER = ['Videos', 'Story', 'Assets', 'Kits', 'Merchandise'];
const CLASS_ACCENTS = {
  Videos: 'bg-red-600',
  Story: 'bg-purple-600',
  Assets: 'bg-blue-600',
  Kits: 'bg-green-600',
  Merchandise: 'bg-orange-500',
};
const DESKTOP_SIZE_PATTERN = ['large', 'small', 'medium', 'small', 'medium', 'small', 'small', 'medium'];
const DESKTOP_COLUMN_SPANS = { small: 1, medium: 2, large: 3 };
const FALLBACK_FILLERS = Array.from({ length: 64 }, (_, index) => ({
  id: `fallback-${index}`,
  label: 'Coming soon',
  size: index % 9 === 0 ? 'medium' : 'small',
  isFallback: true,
}));

function DossierCard({ dossier }) {
  const img = dossier.cover_image;
  const isStoryTemplate = dossier.class === 'Story' && !!dossier.cover_template_image;

  if (isStoryTemplate) {
    return (
      <Link to={`${createPageUrl('Magazine')}?dossier=${dossier.id}`} className="group/card relative block">
        <div className="aspect-[9/16] overflow-hidden rounded-md bg-black relative border border-white/15 shadow-md group-hover/card:border-2 group-hover/card:border-red-600 group-hover/card:shadow-xl group-hover/card:scale-105 transition-all duration-200">
          <img src={dossier.cover_template_image} alt="" className="absolute inset-0 w-full h-full object-contain" />
          {img && <div className="absolute left-[8%] right-[8%] top-[9%] bottom-[27%] flex items-center justify-center overflow-hidden"><img src={img} alt={dossier.title} className="w-full h-full object-cover" /></div>}
          {!dossier.hide_text_on_cover && <div className="absolute top-0 left-0 right-0 px-2 pt-2 text-center"><p className="text-white text-xl font-black uppercase tracking-wide leading-tight line-clamp-2 drop-shadow-[0_1px_6px_rgba(0,0,0,0.95)]">{dossier.title}</p></div>}
        </div>
      </Link>
    );
  }

  return (
    <Link to={`${createPageUrl('Magazine')}?dossier=${dossier.id}`} className="group/card relative block">
      <div className="aspect-[9/16] overflow-hidden rounded-md bg-black relative border border-white/15 shadow-md group-hover/card:border-2 group-hover/card:border-red-600 group-hover/card:shadow-xl group-hover/card:scale-105 transition-all duration-200">
        {img ? <><img src={img} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-xl" /><img src={img} alt={dossier.title} className="relative h-full w-full object-contain" /></> : <div className="w-full h-full flex items-center justify-center bg-black p-3"><span className="text-white text-sm font-extrabold text-center uppercase tracking-wide leading-tight">{dossier.title}</span></div>}
        {!dossier.hide_text_on_cover && <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black via-black/90 to-transparent pb-14 pt-2.5 px-2.5"><p className="text-white text-xl font-black uppercase leading-none tracking-tight line-clamp-3 drop-shadow-[0_2px_6px_rgba(0,0,0,1)]" style={{ WebkitTextStroke: '1.5px #FFC107' }}>{dossier.title}</p></div>}
      </div>
    </Link>
  );
}

function CollapsibleCategory({ label, dossiers, accentClass, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-2">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 py-2">
        <span className={`w-1 h-4 ${accentClass} rounded-full`} />
        <h3 className="text-white text-sm font-bold flex-1 text-left">{label}</h3>
        <span className="text-white/40 text-[10px] font-bold">{dossiers.length}</span>
        <ChevronDown size={16} className={`text-white/60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className={`grid gap-2 pb-2 ${dossiers.length <= 1 ? 'grid-cols-1' : dossiers.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>{dossiers.map(d => <DossierCard key={d.id} dossier={d} />)}</div>}
    </div>
  );
}

function ClassSection({ classLabel, dossiers, categories }) {
  if (dossiers.length === 0) return null;
  const accentClass = CLASS_ACCENTS[classLabel] || 'bg-black';
  const categorized = categories.map(cat => ({ label: cat.name, dossiers: dossiers.filter(d => d.category === cat.name) })).filter(row => row.dossiers.length > 0);
  const knownCategoryNames = categories.map(c => c.name);
  const uncategorized = dossiers.filter(d => !d.category || !knownCategoryNames.includes(d.category));
  return (
    <div className="break-inside-avoid mb-6">
      <div className="flex items-center gap-2 mb-2"><h2 className="text-white text-lg font-extrabold tracking-wide uppercase">{classLabel}</h2><span className={`px-2 py-0.5 ${accentClass} text-white text-[10px] font-bold rounded-full`}>{dossiers.length}</span><div className="flex-1 h-px bg-white/20" /></div>
      <div className="px-1">
        {categorized.map(row => <CollapsibleCategory key={row.label} label={row.label} dossiers={row.dossiers} accentClass={accentClass} defaultOpen />)}
        {uncategorized.length > 0 && <CollapsibleCategory label="Others" dossiers={uncategorized} accentClass={accentClass} defaultOpen={categorized.length === 0} />}
      </div>
    </div>
  );
}

function DesktopMasonryItem({ size, children, className = '', real = false }) {
  const ref = useRef(null);
  const columnSpan = DESKTOP_COLUMN_SPANS[size] || 1;
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const updateSpan = () => {
      const height = element.getBoundingClientRect().width * 16 / 9;
      element.style.height = `${height}px`;
      element.style.gridRowEnd = `span ${Math.ceil((height + 12) / 13)}`;
    };
    updateSpan();
    const observer = new ResizeObserver(updateSpan);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <article ref={ref} data-real-tile={real ? 'true' : undefined} style={{ gridColumnEnd: `span ${columnSpan}` }} className={`relative min-w-0 overflow-hidden rounded-2xl bg-neutral-950 ${className}`}>{children}</article>;
}

function DesktopDossierTile({ dossier, size }) {
  const videoRef = useRef(null);
  const media = dossier.cover_video || null;
  const image = dossier.cover_image || dossier.cover_template_image || null;
  const accent = CLASS_ACCENTS[dossier.class] || 'bg-yellow-400';
  const startPreview = () => videoRef.current?.play().catch(() => {});
  const stopPreview = () => { if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; } };
  return (
    <DesktopMasonryItem real size={size} className="group border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,.35)] transition duration-500 hover:-translate-y-1 hover:border-white/30 hover:shadow-[0_24px_80px_rgba(0,0,0,.7)]">
      <Link to={`${createPageUrl('Magazine')}?dossier=${dossier.id}`} onMouseEnter={startPreview} onMouseLeave={stopPreview} className="absolute inset-0 block bg-black">
        {image && <img src={image} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-35 blur-2xl" />}
        {media ? <video ref={videoRef} src={media} poster={image || undefined} muted loop playsInline preload="metadata" className="relative h-full w-full object-contain" /> : image ? <img src={image} alt={dossier.title} className="relative h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center p-6 text-center text-white/60">{dossier.title}</div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/5 to-transparent opacity-90" />
        <div className="absolute inset-x-0 bottom-0 p-3 md:p-4">
          <div className="mb-2 flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full ${accent}`} /><span className="text-[9px] font-black uppercase tracking-[.18em] text-white/60">{dossier.class || dossier.category || 'AISTAGE.ONE'}</span></div>
          {!dossier.hide_text_on_cover && <h2 className={`${size === 'small' ? 'text-sm' : size === 'medium' ? 'text-xl' : 'text-3xl'} font-black leading-tight text-white drop-shadow-lg`}>{dossier.title}</h2>}
          {size !== 'small' && dossier.subtitle && <p className="mt-1 line-clamp-2 text-xs text-white/65">{dossier.subtitle}</p>}
          {media && <span className="mt-3 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-white/70"><Play size={10} fill="currentColor" /> Preview</span>}
        </div>
      </Link>
    </DesktopMasonryItem>
  );
}

function DesktopFillerTile({ filler }) {
  const videoRef = useRef(null);
  const startPreview = () => videoRef.current?.play().catch(() => {});
  const stopPreview = () => videoRef.current?.pause();
  const content = (
    <div onMouseEnter={startPreview} onMouseLeave={stopPreview} className="absolute inset-0 bg-black">
      {filler.media_type === 'video' && filler.media_url ? <video ref={videoRef} src={filler.media_url} poster={filler.poster_url || undefined} muted loop playsInline preload="metadata" className="h-full w-full object-contain" /> : filler.media_url ? <img src={filler.media_url} alt={filler.label || 'Coming soon'} className="h-full w-full object-contain" /> : <div className="flex h-full flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_30%_20%,rgba(255,214,0,.25),transparent_35%),radial-gradient(circle_at_70%_75%,rgba(220,38,38,.22),transparent_38%),#090909] p-5 text-center"><Sparkles className="text-yellow-400" size={22} /><span className="text-xs font-black uppercase tracking-[.22em] text-white/70">{filler.label || 'Coming soon'}</span></div>}
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
    </div>
  );
  return <DesktopMasonryItem size={filler.size || 'small'} className="home-filler opacity-80">{filler.link_url ? <a href={filler.link_url} className="absolute inset-0 block">{content}</a> : content}</DesktopMasonryItem>;
}

function DesktopMasonry({ dossiers, fillers }) {
  const containerRef = useRef(null);
  const [realContentHeight, setRealContentHeight] = useState(null);
  useEffect(() => {
    setRealContentHeight(null);
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => {
      const element = containerRef.current;
      if (!element) return;
      const realTiles = [...element.querySelectorAll('[data-real-tile]')];
      const bottom = realTiles.reduce((max, tile) => Math.max(max, tile.offsetTop + tile.offsetHeight), 0);
      setRealContentHeight(bottom || null);
    }));
    return () => cancelAnimationFrame(frame);
  }, [dossiers]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !realContentHeight) return undefined;
    const fillerTiles = [...container.querySelectorAll('.home-filler')];
    fillerTiles.forEach(tile => { tile.style.display = ''; });
    let frame;
    const hideOverflowingFillers = () => {
      let changed = false;
      fillerTiles.forEach(tile => {
        if (tile.style.display !== 'none' && tile.offsetTop + tile.offsetHeight > realContentHeight + 1) {
          tile.style.display = 'none';
          changed = true;
        }
      });
      if (changed) frame = requestAnimationFrame(hideOverflowingFillers);
    };
    frame = requestAnimationFrame(hideOverflowingFillers);
    return () => cancelAnimationFrame(frame);
  }, [fillers, realContentHeight]);

  return (
    <section className="hidden lg:block px-5 pb-8 pt-5 xl:px-7">
      <div ref={containerRef} className="grid grid-cols-8 auto-rows-[1px] grid-flow-dense gap-3 overflow-hidden" style={realContentHeight ? { height: `${realContentHeight}px` } : undefined}>
        {dossiers.map((dossier, index) => <DesktopDossierTile key={dossier.id} dossier={dossier} size={dossier.homepage_size || DESKTOP_SIZE_PATTERN[index % DESKTOP_SIZE_PATTERN.length]} />)}
        {realContentHeight && fillers.map(filler => <DesktopFillerTile key={filler.id} filler={filler} />)}
      </div>
    </section>
  );
}

export default function Index() {
  const { data: dossiers = [], isLoading } = useQuery({ queryKey: ['dossiers', 'published'], queryFn: () => base44.entities.Dossier.filter({ status: 'published' }, 'order'), staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false });
  const { data: categories = [] } = useQuery({ queryKey: ['dossierCategories'], queryFn: () => base44.entities.DossierCategory.list('name'), staleTime: 5 * 60 * 1000 });
  const { data: configuredFillers = [] } = useQuery({
    queryKey: ['homeFillers'],
    queryFn: async () => { try { return await base44.entities.HomeFiller.filter({ is_active: true }, 'display_order', 50); } catch { return []; } },
    staleTime: 5 * 60 * 1000,
  });

  const fillers = useMemo(() => [...configuredFillers, ...FALLBACK_FILLERS], [configuredFillers]);
  if (isLoading) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;

  const restDossiers = dossiers.slice(1);
  const classSections = CLASS_ORDER.map(classLabel => ({ classLabel, dossiers: restDossiers.filter(d => d.class === classLabel) }));
  const noClass = restDossiers.filter(d => !d.class);

  return (
    <div className="min-h-screen bg-black pb-24">
      <TopBanner dossiers={dossiers} />
      <div className="pt-4 px-4 columns-1 sm:columns-2 gap-4 lg:hidden">
        {classSections.map(section => <ClassSection key={section.classLabel} classLabel={section.classLabel} dossiers={section.dossiers} categories={categories} />)}
        {noClass.length > 0 && <ClassSection classLabel="Others" dossiers={noClass} categories={categories} />}
      </div>
      <DesktopMasonry dossiers={restDossiers} fillers={fillers} />
      {dossiers.length === 0 && <div className="flex items-center justify-center py-20"><p className="text-white/50 text-sm">Aucun contenu disponible</p></div>}
    </div>
  );
}
