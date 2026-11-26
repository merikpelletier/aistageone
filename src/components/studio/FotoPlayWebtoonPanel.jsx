import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Pause, Play, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useStudioTranslation } from '@/lib/useStudioTranslation';

const moves = [['gentle', 'Gentle zoom'], ['zoom-in', 'Zoom in'], ['zoom-out', 'Zoom out'], ['static', 'Static']];
const defaults = { movement: 'gentle', duration: 5, captionPosition: 'bottom', cameraZoom: 1.05, captionSize: 13, frameZooms: {}, framePositions: {}, stepCamera: {}, captionPositions: {}, supportImages: [] };
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
  const t = useStudioTranslation();
  const [settings, setSettings] = useState(() => ({ ...defaults, ...(segment.webtoon || {}) }));
  const [saving, setSaving] = useState(false);
  const steps = useMemo(() => webtoonSequence(segment, frameCount, portrait), [segment, frameCount, portrait]);
  const active = playback?.playing || false;
  const index = Math.min(playback?.index || 0, Math.max(0, steps.length - 1));
  const current = steps[index];
  const activeFrame = current?.frameIndex ?? 0;
  const stepCamera = settings.stepCamera?.[index] || {};
  const frameZoom = Number(stepCamera.zoom ?? settings.frameZooms?.[activeFrame] ?? settings.cameraZoom ?? 1.05);
  const framePosition = { ...(settings.framePositions?.[activeFrame] || { x: 50, y: 50 }), ...stepCamera };
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
    if (preview && ['movement', 'cameraZoom', 'frameZooms', 'framePositions', 'stepCamera', 'captionSize'].includes(name)) {
      onPlaybackChange({ playing: false, index: playback?.step ? index : 0, step: preview, settings: next });
    } else if (playback?.step) {
      onPlaybackChange({ ...playback, settings: next });
    }
  };
  const editStepCamera = (axis, value) => edit('stepCamera', { ...(settings.stepCamera || {}), [index]: { ...stepCamera, [axis]: Number(value) } });
  const editFrameZoom = (value) => editStepCamera('zoom', value);
  const editFramePosition = (axis, value) => editStepCamera(axis, value);
  const showStep = (i, playing = false) => {
    const next = Math.max(0, Math.min(steps.length - 1, i));
    onPlaybackChange({ playing, index: next, step: steps[next], settings });
  };
  const save = async () => {
    setSaving(true);
    try {
      const result = await onPersist({ webtoon: settings });
      if (!result) throw new Error(t('fotoplay.webtoon.save_failed_detail', 'Webtoon settings could not be saved'));
      toast.success(t('fotoplay.webtoon.saved', 'Webtoon settings saved'));
    } catch (e) { toast.error(e.message || t('fotoplay.webtoon.save_failed', 'Save failed')); }
    finally { setSaving(false); }
  };
  return <section className="min-w-0 space-y-4 text-white">
    <div>
      <h3 className="text-sm font-black text-[#23c7be]">{t('fotoplay.webtoon.title', 'Webtoon · Page camera')}</h3>
      <p className="mt-1 text-xs leading-relaxed text-white/65">{t('fotoplay.webtoon.intro', 'The original page stays in the center. Play moves the camera from frame to frame. Captions replace bubbles during Webtoon reading.')}</p>
    </div>
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase text-white/50">{t('fotoplay.webtoon.section_read', '1 · Read the page')}</p>
      <button type="button" onClick={() => active ? onPlaybackChange({ playing: false, index, step: current, settings }) : showStep(playback?.step ? index : 0, true)} className="flex w-full items-center justify-center gap-2 rounded bg-[#23c7be] px-3 py-3 text-sm font-black text-black">{active ? <Pause size={17}/> : <Play size={17}/>} {active ? t('fotoplay.webtoon.pause', 'Pause reading') : t('fotoplay.webtoon.play', 'Play page')}</button>
      <div className="flex items-center justify-between gap-2">
        <button type="button" className={button} onClick={() => showStep(index - 1)} disabled={index === 0}><ChevronLeft size={15}/> {t('fotoplay.webtoon.previous', 'Previous')}</button>
        <span className="text-center text-xs text-white/60">{steps.length ? index + 1 : 0} / {steps.length}</span>
        <button type="button" className={button} onClick={() => showStep(index + 1)} disabled={index >= steps.length - 1}>{t('fotoplay.webtoon.next', 'Next')} <ChevronRight size={15}/></button>
      </div>
      <button type="button" className={button + ' w-full'} onClick={() => onPlaybackChange({ playing: false, index: 0, step: null, settings })}>{t('fotoplay.webtoon.show_all', 'Show complete page')}</button>
      <p className="text-[11px] text-white/50">{frameCount} {t('fotoplay.webtoon.frames', 'frames in their original layout')} · {steps.filter(s => s.caption).length} {t('fotoplay.webtoon.captions_count', 'caption moments')}</p>
    </div>
    <div className="space-y-2 border-t border-white/10 pt-3">
      <p className="text-[11px] font-bold uppercase text-white/50">{t('fotoplay.webtoon.section_camera', '2 · Camera and captions')}</p>
      <label className="block text-xs text-white/70">{t('fotoplay.webtoon.camera_movement', 'Camera movement')}<select className={field} value={settings.movement} onChange={e => edit('movement', e.target.value)}>{moves.map(([id, label]) => <option key={id} value={id}>{t('fotoplay.webtoon.' + ({gentle:'move_gentle','zoom-in':'move_in','zoom-out':'move_out',static:'move_static'}[id]), label)}</option>)}</select></label>
      <p className="text-xs text-white/65">{t('fotoplay.webtoon.frame', 'Frame')} {activeFrame + 1} {t('fotoplay.webtoon.of', 'of')} {frameCount} · {t('fotoplay.webtoon.caption', 'Caption')} {index + 1} / {steps.length}</p>
      <div className="flex flex-wrap gap-1">{Array.from({ length: frameCount }, (_, frame) => <button key={frame} type="button" onClick={() => showStep(Math.max(0, steps.findIndex(step => step.frameIndex === frame)))} className={`rounded border px-3 py-2 text-xs font-bold ${activeFrame === frame ? 'border-[#23c7be] bg-[#23c7be] text-black' : 'border-white/20 bg-white/5 text-white'}`}>{t('fotoplay.webtoon.frame', 'Frame')} {frame + 1}</button>)}</div>
      <label className="block text-xs text-white/70">{t('fotoplay.webtoon.frame', 'Frame')} {activeFrame + 1} · {t('fotoplay.webtoon.caption', 'Caption')} {index + 1} · {t('fotoplay.webtoon.zoom', 'zoom')} · {frameZoom.toFixed(2)}×<input aria-label={t('fotoplay.webtoon.zoom_accessible', 'Zoom for this frame')} className="mt-2 w-full accent-[#23c7be]" type="range" min="1" max="3.5" step="0.05" value={Math.max(1, Math.min(3.5, frameZoom))} onChange={e => editFrameZoom(e.target.value)}/></label>
      {['x', 'y'].map(axis => <label key={axis} className="block text-xs text-white/70">{t('fotoplay.webtoon.image', 'Image')} · {axis === 'x' ? t('fotoplay.webtoon.horizontal', 'Horizontal') : t('fotoplay.webtoon.vertical', 'Vertical')} · {Math.round(framePosition[axis] ?? 50)}%<input aria-label={t('fotoplay.webtoon.image', 'Image') + ' · ' + (axis === 'x' ? t('fotoplay.webtoon.horizontal', 'Horizontal') : t('fotoplay.webtoon.vertical', 'Vertical'))} className="mt-2 w-full accent-[#23c7be]" type="range" min="0" max="100" step="1" value={framePosition[axis] ?? 50} onChange={e => editFramePosition(axis, e.target.value)}/></label>)}
      <label className="block text-xs text-white/70">{t('fotoplay.webtoon.caption_size', 'Caption size')} · {settings.captionSize ?? 13}px<input aria-label={t('fotoplay.webtoon.caption_size', 'Caption size')} className="mt-2 w-full accent-[#23c7be]" type="range" min="10" max="24" step="1" value={settings.captionSize ?? 13} onChange={e => edit('captionSize', Number(e.target.value))}/></label>
      <label className="block text-xs text-white/70">{t('fotoplay.webtoon.seconds', 'Seconds per caption')}<input className={field} type="number" min="2" max="30" value={settings.duration} onChange={e => edit('duration', clamp(e.target.value, 2, 30))}/></label>
    </div>
    <button type="button" className="flex w-full items-center justify-center gap-2 rounded bg-white px-3 py-3 text-xs font-black text-black disabled:opacity-50" onClick={save} disabled={saving}>{saving ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>} {t('fotoplay.webtoon.save', 'Save Webtoon settings')}</button>
  </section>;
}
