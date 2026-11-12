import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Pause, Play, Save, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const moves = [['gentle', 'Gentle zoom'], ['zoom-in', 'Zoom in'], ['zoom-out', 'Zoom out'], ['static', 'Static']];
const defaults = { movement: 'gentle', duration: 5, captionPosition: 'bottom', cameraZoom: 1.2, captionSize: 13, supportImages: [] };
const field = 'w-full min-w-0 rounded border border-white/20 bg-[#20242a] px-2 py-2 text-xs text-white';
const button = 'inline-flex min-h-9 items-center justify-center gap-2 rounded border border-white/20 px-3 py-2 text-xs font-bold disabled:opacity-40';
const clamp = (v, min, max) => Math.max(min, Math.min(max, Number(v) || min));

export function webtoonSequence(segment, frameCount, portrait) {
  const count = Math.max(1, frameCount);
  const boxes = (Array.isArray(segment.text_boxes) ? segment.text_boxes : [])
    .filter(item => typeof item.text === 'string' && item.text.trim());
  const captions = boxes.length ? boxes : (segment.narration_text?.trim()
    ? [{ id: 'narration', text: segment.narration_text, x: 0, y: 0, width: 0, height: 0 }] : []);
  const grouped = Array.from({ length: count }, () => []);
  captions.forEach((box, idx) => {
    const coordinate = portrait ? Number(box.y ?? 0) + Number(box.height ?? 0) / 2 : Number(box.x ?? 0) + Number(box.width ?? 0) / 2;
    const frameIndex = boxes.length ? clamp(Math.floor(coordinate / 100 * count), 0, count - 1) : 0;
    const words = box.text.trim().split(/\s+/); let part = '';
    const chunks = [];
    for (const word of words) {
      if (part && (part + ' ' + word).length > 100) { chunks.push(part); part = word; }
      else part = part ? part + ' ' + word : word;
    }
    if (part) chunks.push(part);
    chunks.forEach((text, partIndex) => grouped[frameIndex].push({ text, id: (box.id || idx) + '-' + partIndex }));
  });
  return grouped.flatMap((parts, frameIndex) => parts.length
    ? parts.map((caption) => ({ frameIndex, caption: caption.text }))
    : [{ frameIndex, caption: '' }]);
}

export default function FotoPlayWebtoonPanel({ segment, frameCount = 1, portrait = false, onPersist, playback, onPlaybackChange }) {
  const [settings, setSettings] = useState(() => ({ ...defaults, ...(segment.webtoon || {}) }));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const steps = useMemo(() => webtoonSequence(segment, frameCount, portrait), [segment, frameCount, portrait]);
  const active = playback?.playing || false;
  const index = Math.min(playback?.index || 0, Math.max(0, steps.length - 1));
  const current = steps[index];
  useEffect(() => { setSettings({ ...defaults, ...(segment.webtoon || {}) }); }, [segment.id, segment.webtoon]);
  useEffect(() => {
    if (!active || !steps.length) return undefined;
    const timer = window.setTimeout(() => {
      if (index >= steps.length - 1) onPlaybackChange({ playing: false, index, step: current, settings });
      else onPlaybackChange({ playing: true, index: index + 1, step: steps[index + 1], settings });
    }, clamp(settings.duration, 2, 30) * 1000);
    return () => window.clearTimeout(timer);
  }, [active, index, steps, settings, onPlaybackChange]);
  const edit = (name, value) => {
    const next = { ...settings, [name]: value };
    setSettings(next);
    // Update the parent only from the user's event, never inside React's state updater.
    // Show the first frame when adjusting camera or caption controls before playback.
    const preview = playback?.step || steps[0] || null;
    if (preview && ['movement', 'cameraZoom', 'captionSize', 'captionPosition'].includes(name)) {
      onPlaybackChange({ playing: false, index: playback?.step ? index : 0, step: preview, settings: next });
    } else if (playback?.step) {
      onPlaybackChange({ ...playback, settings: next });
    }
  };
  const showStep = (i, playing = false) => {
    const next = Math.max(0, Math.min(steps.length - 1, i));
    onPlaybackChange({ playing, index: next, step: steps[next], settings });
  };
  const save = async () => {
    setSaving(true);
    try {
      const result = await onPersist({ webtoon: settings });
      if (!result) throw new Error('Webtoon settings could not be saved');
      toast.success('Webtoon settings saved');
    } catch (e) { toast.error(e.message || 'Save failed'); }
    finally { setSaving(false); }
  };
  const addImage = (url) => { if (!url?.trim()) return; edit('supportImages', [...(settings.supportImages || []), { id: crypto.randomUUID(), url: url.trim() }]); setNewImageUrl(''); };
  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const response = await base44.integrations.Core.UploadFile({ file });
      if (!response?.file_url) throw new Error('Upload failed');
      addImage(response.file_url);
    } catch (e) { toast.error(e.message || 'Upload failed'); }
    finally { setUploading(false); }
  };
  return <section className="min-w-0 space-y-4 text-white">
    <div>
      <h3 className="text-sm font-black text-[#23c7be]">Webtoon · Page camera</h3>
      <p className="mt-1 text-xs leading-relaxed text-white/65">The original page stays in the center. Play moves the camera from frame to frame. Captions replace bubbles during Webtoon reading.</p>
    </div>
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase text-white/50">1 · Read the page</p>
      <button type="button" onClick={() => active ? onPlaybackChange({ playing: false, index, step: current, settings }) : showStep(playback?.step ? index : 0, true)} className="flex w-full items-center justify-center gap-2 rounded bg-[#23c7be] px-3 py-3 text-sm font-black text-black">{active ? <Pause size={17}/> : <Play size={17}/>} {active ? 'Pause reading' : 'Play page'}</button>
      <div className="flex items-center justify-between gap-2">
        <button type="button" className={button} onClick={() => showStep(index - 1)} disabled={index === 0}><ChevronLeft size={15}/> Previous</button>
        <span className="text-center text-xs text-white/60">{steps.length ? index + 1 : 0} / {steps.length}</span>
        <button type="button" className={button} onClick={() => showStep(index + 1)} disabled={index >= steps.length - 1}>Next <ChevronRight size={15}/></button>
      </div>
      <button type="button" className={button + ' w-full'} onClick={() => onPlaybackChange({ playing: false, index: 0, step: null, settings })}>Show complete page</button>
      <p className="text-[11px] text-white/50">{frameCount} frames in their original layout · {steps.filter(s => s.caption).length} caption moments</p>
    </div>
    <div className="space-y-2 border-t border-white/10 pt-3">
      <p className="text-[11px] font-bold uppercase text-white/50">2 · Camera and captions</p>
      <label className="block text-xs text-white/70">Camera movement<select className={field} value={settings.movement} onChange={e => edit('movement', e.target.value)}>{moves.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label className="block text-xs text-white/70">Camera zoom · {Number(settings.cameraZoom ?? 1.2).toFixed(2)}×<input aria-label="Camera zoom" className="mt-2 w-full accent-[#23c7be]" type="range" min="1" max="2.5" step="0.05" value={settings.cameraZoom ?? 1.2} onChange={e => edit('cameraZoom', Number(e.target.value))}/></label>
      <label className="block text-xs text-white/70">Caption size · {settings.captionSize ?? 13}px<input aria-label="Caption size" className="mt-2 w-full accent-[#23c7be]" type="range" min="10" max="24" step="1" value={settings.captionSize ?? 13} onChange={e => edit('captionSize', Number(e.target.value))}/></label>
      <label className="block text-xs text-white/70">Seconds per caption<input className={field} type="number" min="2" max="30" value={settings.duration} onChange={e => edit('duration', clamp(e.target.value, 2, 30))}/></label>
      <label className="block text-xs text-white/70">Caption position<select className={field} value={settings.captionPosition} onChange={e => edit('captionPosition', e.target.value)}><option value="bottom">Bottom</option><option value="middle">Middle</option><option value="top">Top</option></select></label>
    </div>
    <div className="space-y-2 border-t border-white/10 pt-3">
      <p className="text-[11px] font-bold uppercase text-white/50">3 · Additional images (optional)</p>
      {(settings.supportImages || []).map((image, i) => <div className="flex min-w-0 gap-2" key={image.id || i}><span className="min-w-0 flex-1 truncate rounded bg-white/5 p-2 text-xs">Image {i+1}</span><button type="button" className={button} onClick={() => edit('supportImages', settings.supportImages.filter((_, j) => j !== i))} aria-label="Remove image"><Trash2 size={15}/></button></div>)}
      <div className="flex min-w-0 flex-wrap gap-2"><input value={newImageUrl} onChange={e => setNewImageUrl(e.target.value)} placeholder="Existing image URL" className={field + ' flex-1'} /><button type="button" className={button} disabled={!newImageUrl.trim()} onClick={() => addImage(newImageUrl)}>Add</button><label className={button + ' cursor-pointer'}><ImagePlus size={15}/>{uploading ? 'Uploading' : 'Upload'}<input type="file" className="hidden" accept="image/*" disabled={uploading} onChange={e => { upload(e.target.files?.[0]); e.target.value = ''; }}/></label></div>
      <p className="text-[11px] text-white/45">Saved separately from your original page. Additional images are not yet included in the automatic camera path.</p>
    </div>
    <button type="button" className="flex w-full items-center justify-center gap-2 rounded bg-white px-3 py-3 text-xs font-black text-black disabled:opacity-50" onClick={save} disabled={saving}>{saving ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>} Save Webtoon settings</button>
  </section>;
}
