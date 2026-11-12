import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, X, Maximize2 } from 'lucide-react';

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Number(n) || lo));
const firstImage = (panel) => panel?.image_url || (panel?.split && (firstImage(panel.split.a) || firstImage(panel.split.b))) || '';
function FrameImage({ panel }) {
  if (panel?.split) {
    const vertical = panel.split.direction === 'vertical';
    const percent = clamp(Number(panel.split.ratio || 0.5) * 100, 8, 92);
    return <div className={'flex h-full w-full ' + (vertical ? 'flex-row' : 'flex-col')}>
      <div className="min-h-0 min-w-0 overflow-hidden" style={vertical ? { width: percent + '%' } : { height: percent + '%' }}><FrameImage panel={panel.split.a} /></div>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden"><FrameImage panel={panel.split.b} /></div>
    </div>;
  }
  return panel?.image_url
    ? <img src={panel.image_url} alt="" className="h-full w-full object-cover" style={{ objectPosition: (panel.position_x ?? 50) + '% ' + (panel.position_y ?? 50) + '%', transform: 'scale(' + clamp(Number(panel.zoom ?? 100) / 100, 0.5, 2) + ')' }} />
    : <div className="h-full w-full bg-black/70" />;
}
function sequence(block) {
  const info = block.webtoon || {};
  const frames = Array.isArray(info.frames) && info.frames.length
    ? info.frames : [{ id: block.id, image_url: info.source_image_url || block.reference_media?.[0] }];
  const boxes = Array.isArray(info.text_boxes) ? info.text_boxes.filter(b => typeof b.text === 'string' && b.text.trim()) : [];
  const captions = boxes.length ? boxes : info.narration_text?.trim() ? [{ text: info.narration_text }] : [];
  const grouped = frames.map(() => []);
  captions.forEach((box) => {
    const center = info.portrait ? Number(box.y || 0) + Number(box.height || 0) / 2 : Number(box.x || 0) + Number(box.width || 0) / 2;
    const idx = boxes.length ? clamp(Math.floor(center / 100 * frames.length), 0, frames.length - 1) : 0;
    const words = box.text.trim().split(/\s+/);
    let part = '';
    for (const word of words) {
      if (part && (part + ' ' + word).length > 100) { grouped[idx].push(part); part = word; }
      else part = part ? part + ' ' + word : word;
    }
    if (part) grouped[idx].push(part);
  });
  const steps = grouped.flatMap((lines, frameIndex) => lines.length ? lines.map(caption => ({ frameIndex, caption })) : [{ frameIndex, caption: '' }]);
  // Supporting images follow the page's main frames without altering their order.
  (Array.isArray(info.supportImages) ? info.supportImages : []).forEach(img => {
    if (img?.url) steps.push({ frameIndex: 0, caption: '', supportUrl: img.url });
  });
  return { frames, steps };
}
function TypeCaption({ value }) {
  const [length, setLength] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setLength(value.length); return undefined; }
    setLength(0);
    const delay = Math.max(15, Math.min(40, Math.floor(3000 / Math.max(value.length, 1))));
    const timer = window.setInterval(() => setLength(n => {
      if (n >= value.length) { window.clearInterval(timer); return n; }
      return n + 1;
    }), delay);
    return () => window.clearInterval(timer);
  }, [value]);
  return <span aria-label={value}>{value.slice(0, length)}</span>;
}
export default function PublishedWebtoonReader({ blocks = [], onClose, onClassic }) {
  const sorted = useMemo(() => [...blocks].sort((a,b) => (a.order || 0) - (b.order || 0)), [blocks]);
  const [blockIndex, setBlockIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [audioFinished, setAudioFinished] = useState(false);
  const audio = useRef(null);
  const block = sorted[blockIndex];
  const config = block?.webtoon || {};
  const { frames, steps } = useMemo(() => block ? sequence(block) : { frames: [], steps: [] }, [block]);
  const step = stepIndex >= 0 ? steps[stepIndex] : null;
  const frame = frames[step?.frameIndex || 0];
  const frameUrl = step?.supportUrl || firstImage(frame);
  const ratio = String(config.image_aspect_ratio || block?.image_aspect_ratio || '16:9').split(':').map(Number);
  const portrait = (ratio[0] || 16) < (ratio[1] || 9);
  const zoom = step ? clamp(config.frameZooms?.[step.frameIndex] ?? config.cameraZoom ?? 1.05, 1, 3.5) : 1;
  const count = Math.max(1, frames.length);
  const centerX = portrait ? 0.5 : ((step?.frameIndex || 0) + 0.5) / count;
  const centerY = portrait ? ((step?.frameIndex || 0) + 0.5) / count : 0.5;
  const transform = step && !step.supportUrl
    ? 'translate(' + ((0.5-centerX)*zoom*100) + '%, ' + ((0.5-centerY)*zoom*100) + '%) scale(' + zoom + ')'
    : 'none';
  const position = config.captionPositions?.[stepIndex] || { x: 50, y: 70 };
  const nextBlock = () => {
    if (blockIndex < sorted.length - 1) { setBlockIndex(n => n + 1); setStepIndex(0); setAudioFinished(false); }
    else { setPlaying(false); setStepIndex(-1); }
  };
  const advance = () => {
    if (stepIndex < steps.length - 1) setStepIndex(n => n + 1);
    else if (!block?.narration_audio || audioFinished) nextBlock();
  };
  useEffect(() => {
    if (!playing || stepIndex < 0) return undefined;
    const timer = window.setTimeout(advance, clamp(config.duration ?? 5, 2, 30) * 1000);
    return () => window.clearTimeout(timer);
  }, [playing, blockIndex, stepIndex, config.duration, audioFinished]);
  useEffect(() => {
    if (!audio.current) return;
    if (!playing) audio.current.pause();
    else audio.current.play().catch(() => setPlaying(false));
  }, [playing, blockIndex]);
  const start = () => { if (stepIndex < 0) setStepIndex(0); setPlaying(true); audio.current?.play().catch(() => setPlaying(false)); };
  const back = () => { setPlaying(false); if (stepIndex > 0) setStepIndex(n => n - 1); else if (blockIndex > 0) { setBlockIndex(n => n - 1); setStepIndex(0); } };
  useEffect(() => { setAudioFinished(false); }, [blockIndex]);
  if (!block) return null;
  return <div className="fixed inset-0 z-[320] overflow-hidden bg-black text-white" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
    {step && frameUrl && <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true"><img src={frameUrl} alt="" className="h-full w-full object-cover" style={{ filter: 'blur(24px) brightness(.6)', transform: 'scale(1.14)' }} /></div>}
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
      <div className="relative flex h-full w-full items-center justify-center transition-transform duration-700 ease-in-out" style={{ transform }}>
        {step?.supportUrl ? <img src={step.supportUrl} alt="" className="max-h-[90%] max-w-[90%] object-contain" />
          : <div className="relative w-[min(94vw,1000px)] max-h-[90vh] overflow-hidden bg-black/60" style={{ aspectRatio: (ratio[0] || 16) + ' / ' + (ratio[1] || 9), maxWidth: 'min(94vw, calc(86vh * ' + ((ratio[0] || 16)/(ratio[1] || 9)) + '))' }}>
            <div className="absolute inset-0 grid gap-[4px] p-[4px]" style={portrait ? { gridTemplateRows: 'repeat(' + count + ',minmax(0,1fr))' } : { gridTemplateColumns: 'repeat(' + count + ',minmax(0,1fr))' }}>
              {frames.map((item,i) => <div key={item.id || i} className="min-h-0 min-w-0 overflow-hidden"><FrameImage panel={item}/></div>)}
            </div>
          </div>}
      </div>
    </div>
    {step?.caption && <div key={blockIndex + '-' + stepIndex} className="pointer-events-none absolute z-20 w-max max-w-[min(78%,360px)] rounded bg-black/75 px-3 py-2 text-center font-medium leading-snug shadow-lg" style={{ left: clamp(position.x,10,90)+'%', top: clamp(position.y,10,90)+'%', transform:'translate(-50%,-50%)', fontSize:clamp(config.captionSize ?? 13,10,24)+'px' }}><TypeCaption value={step.caption}/></div>}
    {block.narration_audio && <audio ref={audio} key={block.id} src={block.narration_audio} preload="metadata" onEnded={() => { setAudioFinished(true); if (stepIndex >= steps.length - 1 && playing) nextBlock(); }} />}
    <div className="absolute left-3 right-3 top-3 z-30 flex items-center justify-between gap-2" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex min-w-0 gap-2 rounded-full bg-black/70 p-1 text-xs font-bold"><button onClick={onClassic} className="rounded-full px-3 py-2 text-white/70">Classic</button><span className="rounded-full bg-white px-3 py-2 text-black">Webtoon</span></div>
      <button onClick={onClose} aria-label="Close reader" className="rounded-full bg-black/70 p-3"><X size={20}/></button>
    </div>
    <div className="absolute bottom-3 left-1/2 z-30 flex max-w-[95vw] -translate-x-1/2 items-center gap-2 rounded-full bg-black/75 px-2 py-2" style={{ marginBottom:'env(safe-area-inset-bottom)' }}>
      <button onClick={back} aria-label="Previous caption" className="rounded-full p-2"><ChevronLeft size={20}/></button>
      <button onClick={() => playing ? setPlaying(false) : start()} aria-label={playing ? 'Pause' : 'Play'} className="rounded-full bg-white p-2 text-black">{playing ? <Pause size={19}/> : <Play size={19}/>}</button>
      <button onClick={() => { setPlaying(false); advance(); }} aria-label="Next caption" className="rounded-full p-2"><ChevronRight size={20}/></button>
      <button onClick={() => { setPlaying(false); setStepIndex(-1); }} aria-label="Show complete page" className="rounded-full p-2"><Maximize2 size={17}/></button>
      <span className="whitespace-nowrap pr-2 text-xs text-white/70">{blockIndex + 1}/{sorted.length} · {Math.max(0,stepIndex + 1)}/{steps.length}</span>
    </div>
  </div>;
}
