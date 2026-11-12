import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Play, Save, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const movements = [
  ['static', 'Static'],
  ['zoom-in', 'Zoom in'],
  ['zoom-out', 'Zoom out'],
  ['pan-left', 'Pan left'],
  ['pan-right', 'Pan right'],
  ['pan-up', 'Pan up'],
  ['pan-down', 'Pan down'],
];
const defaults = { movement: 'static', duration: 7, focusX: 50, focusY: 50, captionPosition: 'bottom', supportImages: [] };
const clamp = (number, min, max) => Math.max(min, Math.min(max, Number(number) || 0));
const cameraFrames = {
  static: ['scale(1)', 'scale(1)'],
  'zoom-in': ['scale(1)', 'scale(1.22)'],
  'zoom-out': ['scale(1.22)', 'scale(1)'],
  'pan-left': ['scale(1.22) translateX(7%)', 'scale(1.22) translateX(-7%)'],
  'pan-right': ['scale(1.22) translateX(-7%)', 'scale(1.22) translateX(7%)'],
  'pan-up': ['scale(1.22) translateY(7%)', 'scale(1.22) translateY(-7%)'],
  'pan-down': ['scale(1.22) translateY(-7%)', 'scale(1.22) translateY(7%)'],
};
const field = 'w-full rounded-lg border border-white/20 bg-zinc-900 px-3 py-2 text-sm text-white';
const button = 'rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-40';

export default function FotoPlayWebtoonPanel({ segment, onPersist }) {
  const stored = segment.webtoon || {};
  const [settings, setSettings] = useState(() => ({ ...defaults, ...stored }));
  const [captionIndex, setCaptionIndex] = useState(0);
  const [supportIndex, setSupportIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  useEffect(() => {
    setSettings({ ...defaults, ...(segment.webtoon || {}) });
    setCaptionIndex(0);
    setSupportIndex(-1);
    setPlaying(false);
  }, [segment.id, segment.webtoon]);
  const captions = useMemo(() => {
    const existing = (Array.isArray(segment.text_boxes) ? segment.text_boxes : [])
      .filter(box => typeof box.text === 'string' && box.text.trim())
      .map(box => ({ id: box.id, text: box.text.trim() }));
    return existing.length ? existing : (segment.narration_text?.trim()
      ? [{ id: 'narration', text: segment.narration_text.trim() }] : []);
  }, [segment.text_boxes, segment.narration_text]);
  // Keep existing authored text intact, but present long passages in readable mobile-sized captions.
  const captionPages = useMemo(() => captions.flatMap((caption, captionNumber) => {
    const words = caption.text.split(/\s+/).filter(Boolean);
    const pages = []; let line = '';
    for (const word of words) {
      if (line && (line + ' ' + word).length > 95) { pages.push(line); line = word; }
      else line = line ? line + ' ' + word : word;
    }
    if (line) pages.push(line);
    return pages.map((text, part) => ({ id: caption.id, captionNumber, part, text }));
  }), [captions]);
  const supportImages = Array.isArray(settings.supportImages) ? settings.supportImages : [];
  const sourceImage = segment.text_overlay_source_url || segment.image_url;
  const shownImage = supportIndex >= 0 ? supportImages[supportIndex]?.url : sourceImage;
  const position = settings.captionPosition === 'top' ? 'top-3' : settings.captionPosition === 'middle' ? 'top-1/2 -translate-y-1/2' : 'bottom-3';
  const duration = clamp(settings.duration, 2, 30);
  const frames = cameraFrames[settings.movement] || cameraFrames.static;
  const edit = (field, value) => setSettings(current => ({ ...current, [field]: value }));
  const save = async () => {
    setSaving(true);
    try {
      const result = await onPersist({ webtoon: settings });
      if (!result) throw new Error('Unable to save Webtoon settings');
      toast.success('Webtoon presentation saved');
    } catch (error) {
      toast.error(error.message || 'Webtoon save failed');
    } finally { setSaving(false); }
  };
  const addImage = (url) => {
    if (!url?.trim()) return;
    edit('supportImages', [...supportImages, { id: crypto.randomUUID(), url: url.trim() }]);
    setNewImageUrl('');
  };
  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const response = await base44.integrations.Core.UploadFile({ file });
      if (!response?.file_url) throw new Error('Image upload failed');
      addImage(response.file_url);
    } catch (error) {
      toast.error(error.message || 'Image upload failed');
    } finally { setUploading(false); }
  };
  const resetAnimation = () => { setPlaying(false); setCycle(value => value + 1); requestAnimationFrame(() => setPlaying(true)); };
  return <section className="mt-4 rounded-2xl border border-white/15 bg-zinc-950 p-3 text-white sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="text-base font-bold">Webtoon · Mobile presentation</h3>
        <p className="mt-1 text-xs text-white/55">Separate from Classic. Existing text, voice and publication are unchanged.</p></div>
      <button type="button" onClick={save} disabled={saving} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-black disabled:opacity-50">{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Webtoon</button>
    </div>
    <div className="mt-3 flex min-w-0 flex-col gap-3">
      <div className="order-2 min-w-0 space-y-3">
        <div className="grid min-w-0 grid-cols-2 gap-2">
          <label className="text-xs text-white/70">Camera movement
            <select className={field} value={settings.movement} onChange={e => edit('movement', e.target.value)}>{movements.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select>
          </label>
          <label className="text-xs text-white/70">Duration (seconds)
            <input className={field} type="number" min="2" max="30" value={settings.duration} onChange={e => edit('duration', clamp(e.target.value, 2, 30))} />
          </label>
          <label className="text-xs text-white/70">Caption position
            <select className={field} value={settings.captionPosition} onChange={e => edit('captionPosition', e.target.value)}><option value="bottom">Bottom</option><option value="middle">Middle</option><option value="top">Top</option></select>
          </label>
          <label className="text-xs text-white/70">Focus X ({settings.focusX}%)
            <input className="block w-full accent-white" type="range" min="0" max="100" value={settings.focusX} onChange={e => edit('focusX', Number(e.target.value))} />
          </label>
          <label className="text-xs text-white/70">Focus Y ({settings.focusY}%)
            <input className="block w-full accent-white" type="range" min="0" max="100" value={settings.focusY} onChange={e => edit('focusY', Number(e.target.value))} />
          </label>
        </div>
        <div className="rounded-xl border border-white/10 p-3">
          <p className="mb-1 text-xs font-bold">1 · Captions ({captions.length})</p><p className="mb-2 text-[11px] text-white/55">Select a line to see it on the image. Long lines are divided automatically for mobile; the original text is unchanged.</p>
          {captions.length ? <div className="space-y-1">{captions.map((caption, index) => <button key={caption.id || index} type="button" onClick={() => { setSupportIndex(-1); setCaptionIndex(Math.max(0, captionPages.findIndex(page => page.captionNumber === index))); }} className={"block w-full min-w-0 overflow-hidden break-words rounded-lg p-2 text-left text-xs " + (captionPages[captionIndex]?.captionNumber === index && supportIndex < 0 ? "bg-white/20" : "bg-white/5")}><span className="mr-2 opacity-50">{index + 1}.</span><span className="line-clamp-2">{caption.text}</span></button>)}</div> : <p className="text-xs text-white/50">Add narration or dialogue boxes in Classic; Webtoon reuses them.</p>}
        </div>
        <div className="rounded-xl border border-white/10 p-3">
          <p className="mb-2 text-xs font-bold">3 · Support images (optional)</p>
          {supportImages.map((image, index) => <div key={image.id || index} className="mb-2 flex items-center gap-2"><button type="button" onClick={() => setSupportIndex(index)} className="min-w-0 flex-1 truncate rounded-lg bg-white/10 px-2 py-2 text-left text-xs">Slide {index + 1}</button><button type="button" aria-label="Remove support slide" className={button} onClick={() => { edit('supportImages', supportImages.filter((_, i) => i !== index)); setSupportIndex(-1); }}><Trash2 size={14} /></button></div>)}
          <div className="flex flex-wrap gap-2"><input aria-label="Support image URL" placeholder="Existing image URL" value={newImageUrl} onChange={e => setNewImageUrl(e.target.value)} className={`${field} min-w-0 flex-1`} /><button type="button" disabled={!newImageUrl.trim()} onClick={() => addImage(newImageUrl)} className={button}>Add</button><label className={`${button} inline-flex cursor-pointer items-center gap-1`}><ImagePlus size={14}/>{uploading ? 'Uploading' : 'Upload'}<input type="file" accept="image/*" disabled={uploading} className="hidden" onChange={e => { upload(e.target.files?.[0]); e.target.value = ''; }} /></label></div>
          <p className="mt-2 text-[11px] text-white/50">Add and save slides without changing the original shot image.</p>
        </div>
      </div>
      <div className="order-1 mx-auto w-full max-w-[245px] min-w-0">
        <p className="mb-2 text-center text-xs font-bold text-white/80">2 · Mobile preview</p><div className="relative aspect-[9/16] overflow-hidden rounded-xl border border-white/15 bg-black">
          {shownImage ? <img key={`${shownImage}-${cycle}-${playing}`} src={shownImage} alt="Webtoon camera preview" className="absolute h-full w-full object-cover" style={{ objectPosition: `${settings.focusX}% ${settings.focusY}%`, transformOrigin: `${settings.focusX}% ${settings.focusY}%`, animation: playing && settings.movement !== 'static' ? `fotoplay-webtoon-camera ${duration}s ease-in-out both` : 'none', '--webtoon-from': frames[0], '--webtoon-to': frames[1] }} /> : <p className="absolute inset-0 flex items-center justify-center text-sm text-white/50">No image yet</p>}
          {supportIndex < 0 && captionPages[captionIndex] && <div className={"pointer-events-none absolute inset-x-2 max-h-[46%] overflow-hidden break-words rounded-md bg-black/75 px-2 py-2 text-center text-xs font-semibold leading-snug text-white shadow-lg " + position}>{captionPages[captionIndex].text}</div>}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => { setSupportIndex(-1); setCaptionIndex(index => Math.max(0, index - 1)); }} disabled={supportIndex < 0 && captionIndex === 0} className={button}><ChevronLeft size={15}/></button>
          <button type="button" onClick={resetAnimation} className={`${button} flex items-center gap-1`}><Play size={14}/> Preview camera</button>
          <button type="button" onClick={() => { setSupportIndex(-1); setCaptionIndex(index => Math.min(captionPages.length - 1, index + 1)); }} disabled={captionPages.length === 0 || (captionIndex >= captionPages.length - 1 && supportIndex < 0)} className={button}><ChevronRight size={15}/></button>
        </div>
        <p className="mt-2 text-center text-[11px] text-white/50">{supportIndex >= 0 ? "Support image " + (supportIndex + 1) : captionPages.length ? "Caption " + (captionIndex + 1) + " / " + captionPages.length : "No captions yet"} · Fixed-image camera only</p>
      </div>
    </div>
    <style>{`@keyframes fotoplay-webtoon-camera { from { transform: var(--webtoon-from); } to { transform: var(--webtoon-to); } } @media (prefers-reduced-motion: reduce) { .fotoplay-webtoon-camera { animation: none !important; } }`}</style>
  </section>;
}
