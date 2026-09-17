import VoicePicker from '@/components/studio/VoicePicker.jsx';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { ArrowLeft, Check, Clock3, Download, ExternalLink, Eye, Film, GripHorizontal, Image as ImageIcon, Images, Loader2, MapPin, MessageSquareText, Mic2, Play, Plus, Rocket, RotateCcw, Save, Search, Sparkles, Store, Trash2, Type, Upload, UserRound, Users, Volume2, X } from 'lucide-react';
import { toast } from 'sonner';
import { IMAGE_RATIOS, IMAGE_TYPES, TIME_OPTIONS, newChapter, normalizeSegment, saveVersion, selectedItems } from './authorStoryModel';
import VaultPickerModal from './VaultPickerModal';
import StoryImageAdjustment from './StoryImageAdjustment.jsx';
import StoryImageFileActions from './StoryImageFileActions.jsx';
import { adjustmentFingerprint, adjustmentRecord } from './storyImageAdjustment.js';
import { completedExportChapters, exportAnimatedVideo, exportSlideshowZip, supportedMp4Type } from './storyExport';

const input = 'w-full rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-black placeholder:text-black/35 focus:outline-none';
const dark = 'w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-sm font-semibold text-white placeholder:text-white/30 focus:border-yellow-400 focus:outline-none';
const action = 'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black disabled:cursor-not-allowed disabled:opacity-35';
const segmentSchema = { type: 'object', properties: { summary: { type: 'string' }, narration_text: { type: 'string' }, image_type: { type: 'string' }, character_ids: { type: 'array', items: { type: 'string' } }, location_ids: { type: 'array', items: { type: 'string' } }, time_periods: { type: 'array', items: { type: 'string' } }, transition_notes: { type: 'string' } }, required: ['summary', 'narration_text', 'image_type', 'character_ids', 'location_ids', 'time_periods', 'transition_notes'] };
const visualSchema = { type: 'object', properties: { character_directions: { type: 'object' }, final_prompt: { type: 'string' } }, required: ['character_directions', 'final_prompt'] };
const comicSchema = (count) => ({ type: 'object', properties: { panels: { type: 'array', minItems: count, maxItems: count, items: { type: 'object', properties: { beat: { type: 'string' }, shot: { type: 'string' }, prompt: { type: 'string' } }, required: ['beat', 'shot', 'prompt'] } } }, required: ['panels'] });
const unwrap = (value) => { if (!value) return null; if (typeof value === 'object') return value; try { return JSON.parse(value); } catch { return null; } };
const context = (project) => JSON.stringify({ title: project.title, genre: project.genre, story_definition: project.story_description, tone: project.tone_rules, rules: project.story_rules, characters: project.characters.map(({ id, name, description }) => ({ id, name, description })), locations: project.locations.map(({ id, name, description }) => ({ id, name, description })) });
const uniqueImages = (values) => [...new Set(values.filter((value) => typeof value === 'string' && value.trim()))];
const assetGallery = (item, catalogGalleries) => uniqueImages([item?.active_look_reference_url, item?.image_url, ...(Array.isArray(item?.look_reference_images) ? item.look_reference_images : []), ...(Array.isArray(item?.reference_images) ? item.reference_images : []), ...(catalogGalleries[item?.image_source_id] || [])]);

function comicPageSignature(segment, chapter, panels) { return JSON.stringify({ ratio: chapter.image_aspect_ratio || '16:9', count: segment.comic_panel_count, panels: panels.map((panel) => panel.image_url || '') }); }
function closestPanelRatio(pageRatio, count) { const [width, height] = pageRatio.split(':').map(Number); const target = width > height ? (width / count) / height : height > width ? width / (height / count) : 1; return IMAGE_RATIOS.reduce((best, ratio) => { const [rw, rh] = ratio.split(':').map(Number); return Math.abs(Math.log(rw / rh / target)) < Math.abs(Math.log(best.value / target)) ? { label: ratio, value: rw / rh } : best; }, { label: '1:1', value: 1 }).label; }
function comicSlots(count, width, height, gutter) {
  const innerW = width - gutter * 2; const innerH = height - gutter * 2;
  if (width > height) { const cellW = innerW / count; return Array.from({ length: count }, (_, index) => ({ x: gutter + index * cellW, y: gutter, w: cellW - gutter, h: innerH })); }
  if (height > width) { const cellH = innerH / count; return Array.from({ length: count }, (_, index) => ({ x: gutter, y: gutter + index * cellH, w: innerW, h: cellH - gutter })); }
  const columns = 2; const rows = Math.ceil(count / columns); const cellW = innerW / columns; const cellH = innerH / rows;
  return Array.from({ length: count }, (_, index) => ({ x: gutter + (index % columns) * cellW, y: gutter + Math.floor(index / columns) * cellH, w: cellW - gutter, h: cellH - gutter }));
}

// A panel may carry a `split` node describing a real structural division into two
// independent child panels: { direction: 'vertical'|'horizontal', ratio: 0..1, a, b }.
// `flattenPanelLeaves` walks that tree and returns every leaf panel with its exact
// slot rectangle (relative to the parent slot), so generation, uploading and final
// assembly all operate on the same real geometry.
function flattenPanelLeaves(panel, slot, gutter, path = []) {
  if (!panel?.split) return [{ panel: { ...panel, position_x: Number.isFinite(Number(panel?.position_x)) ? Number(panel.position_x) : 50, position_y: Number.isFinite(Number(panel?.position_y)) ? Number(panel.position_y) : 50 }, slot, path }];
  const { direction, ratio, a, b } = panel.split;
  const r = Math.max(0.08, Math.min(0.92, Number(ratio) || 0.5));
  const half = gutter / 2;
  if (direction === 'vertical') {
    const aw = slot.w * r - half; const bw = slot.w * (1 - r) - half;
    const slotA = { x: slot.x, y: slot.y, w: aw, h: slot.h };
    const slotB = { x: slot.x + slot.w * r + half, y: slot.y, w: bw, h: slot.h };
    return [...flattenPanelLeaves(a, slotA, gutter, [...path, 'a']), ...flattenPanelLeaves(b, slotB, gutter, [...path, 'b'])];
  }
  const ah = slot.h * r - half; const bh = slot.h * (1 - r) - half;
  const slotA = { x: slot.x, y: slot.y, w: slot.w, h: ah };
  const slotB = { x: slot.x, y: slot.y + slot.h * r + half, w: slot.w, h: bh };
  return [...flattenPanelLeaves(a, slotA, gutter, [...path, 'a']), ...flattenPanelLeaves(b, slotB, gutter, [...path, 'b'])];
}
function splitPanelSlots(panels, width, height, gutter) {
  const slots = comicSlots(panels.length, width, height, gutter);
  return panels.flatMap((panel, index) => flattenPanelLeaves(panel, slots[index], gutter, [index]));
}
async function drawLayerImage(ctx, url, slot, posX, posY) {
  const response = await fetch(url); if (!response.ok) throw new Error('Unable to load panel image');
  const bitmap = await createImageBitmap(await response.blob());
  const scale = Math.max(slot.w / bitmap.width, slot.h / bitmap.height); const dw = bitmap.width * scale; const dh = bitmap.height * scale;
  const px = Number.isFinite(Number(posX)) ? Number(posX) : 50; const py = Number.isFinite(Number(posY)) ? Number(posY) : 50;
  const offsetX = slot.x + (slot.w - dw) * (px / 100); const offsetY = slot.y + (slot.h - dh) * (py / 100);
  ctx.drawImage(bitmap, offsetX, offsetY, dw, dh); bitmap.close();
}
async function assembleComicPage(panels, ratio) {
  const [rw, rh] = ratio.split(':').map(Number); const landscape = rw >= rh;
  const width = landscape ? 1600 : Math.round(1600 * rw / rh); const height = landscape ? Math.round(1600 * rh / rw) : 1600;
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
  const slots = comicSlots(panels.length, width, height, 18);
  for (let index = 0; index < panels.length; index++) {
    const panel = panels[index]; const slot = slots[index];
    if (panel?.split) {
      const { direction, ratio: splitRatio, a, b } = panel.split;
      const r = Math.max(0.08, Math.min(0.92, Number(splitRatio) || 0.5));
      if (a?.image_url) { ctx.save(); ctx.beginPath(); ctx.rect(slot.x, slot.y, slot.w, slot.h); ctx.clip(); await drawLayerImage(ctx, a.image_url, slot, a.position_x, a.position_y); ctx.restore(); }
      if (b?.image_url) {
        ctx.save(); ctx.beginPath(); ctx.rect(slot.x, slot.y, slot.w, slot.h); ctx.clip();
        if (direction === 'vertical') { ctx.beginPath(); ctx.rect(slot.x + slot.w * r, slot.y, slot.w * (1 - r), slot.h); ctx.clip(); }
        else { ctx.beginPath(); ctx.rect(slot.x, slot.y + slot.h * r, slot.w, slot.h * (1 - r)); ctx.clip(); }
        await drawLayerImage(ctx, b.image_url, slot, b.position_x, b.position_y);
        ctx.restore();
      }
      continue;
    }
    if (!panel.image_url) continue;
    ctx.save(); ctx.beginPath(); ctx.rect(slot.x, slot.y, slot.w, slot.h); ctx.clip();
    await drawLayerImage(ctx, panel.image_url, slot, panel.position_x, panel.position_y);
    ctx.restore();
  }
  const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Unable to assemble comic page')), 'image/png', 0.95));
  return new File([blob], `comic-page-${crypto.randomUUID()}.png`, { type: 'image/png' });
}

// Read/write a leaf panel inside a possibly-split panel tree by its leaf path
// (e.g. ['a'] or ['b','a']). The top-level panel array index is handled by the caller.
function readLeaf(panel, path) {
  let node = panel;
  for (const step of path) node = node.split[step];
  return node;
}
function writeLeaf(panel, path, values) {
  if (!path.length) return { ...panel, ...values };
  const [step, ...rest] = path;
  const child = writeLeaf(panel.split[step], rest, values);
  return { ...panel, split: { ...panel.split, [step]: child } };
}
function splitPanel(panel, direction) {
  const a = { beat: panel.beat, shot: panel.shot, prompt: panel.prompt, image_url: panel.image_url, source_prompt: panel.source_prompt };
  const b = { beat: '', shot: panel.shot, prompt: '', image_url: '', source_prompt: '' };
  return { ...panel, split: { direction, ratio: 0.5, a, b } };
}
function unsplitPanel(panel, keep = 'a') {
  const kept = panel.split?.[keep]; if (!kept) return panel;
  return { ...panel, ...kept, split: undefined };
}

// Visible UI for the existing structural split tree. Operates purely on the
// panel object passed in and reports the updated panel via onUpdate; it never
// creates a second splitting system and reuses splitPanel/unsplitPanel as-is.
function PanelLeafEditor({ panel, path, direction, ratio, disabled, onUpdate, renderLeaf, label }) {
  const containerRef = useRef(null);
  const dragRef = useRef(null);
  const imageDragRef = useRef(null);
  const layerPositions = {
    a: { x: Number.isFinite(Number(panel?.split?.a?.position_x)) ? Number(panel.split.a.position_x) : 50, y: Number.isFinite(Number(panel?.split?.a?.position_y)) ? Number(panel.split.a.position_y) : 50 },
    b: { x: Number.isFinite(Number(panel?.split?.b?.position_x)) ? Number(panel.split.b.position_x) : 50, y: Number.isFinite(Number(panel?.split?.b?.position_y)) ? Number(panel.split.b.position_y) : 50 },
  };
  const beginImageDrag = (event, layerKey) => {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const start = layerPositions[layerKey] || { x: 50, y: 50 };
    imageDragRef.current = { layerKey, startX: event.clientX, startY: event.clientY, start, rectWidth: rect.width, rectHeight: rect.height };
    const move = (moveEvent) => {
      const drag = imageDragRef.current;
      if (!drag) return;
      const dxPercent = ((moveEvent.clientX - drag.startX) / drag.rectWidth) * 100;
      const dyPercent = ((moveEvent.clientY - drag.startY) / drag.rectHeight) * 100;
      const nextX = drag.start.x + dxPercent;
      const nextY = drag.start.y + dyPercent;
      onUpdate({ ...panel, split: { ...panel.split, [drag.layerKey]: { ...panel.split[drag.layerKey], position_x: nextX, position_y: nextY } } });
    };
    const stop = () => { imageDragRef.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop); window.addEventListener('pointercancel', stop);
  };
  if (!panel?.split) {
    return <div className="space-y-2">
      {label && <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-300">{label}</p>}
      {renderLeaf(panel, path)}
      <div className="flex gap-2">
        <button type="button" disabled={disabled} onClick={() => onUpdate(splitPanel(panel, 'vertical'))} className={`${action} flex-1 bg-white/10 text-white`}>Split vertical</button>
        <button type="button" disabled={disabled} onClick={() => onUpdate(splitPanel(panel, 'horizontal'))} className={`${action} flex-1 bg-white/10 text-white`}>Split horizontal</button>
      </div>
    </div>;
  }
  const isVertical = panel.split.direction === 'vertical';
  const currentRatio = Math.max(0.08, Math.min(0.92, Number(panel.split.ratio) || 0.5));
  const begin = (event) => {
    if (disabled) return;
    event.preventDefault();
    dragRef.current = { startX: event.clientX, startY: event.clientY, ratio: currentRatio };
    const move = (moveEvent) => {
      const drag = dragRef.current; const container = containerRef.current;
      if (!drag || !container) return;
      const rect = container.getBoundingClientRect();
      const delta = isVertical ? (moveEvent.clientX - drag.startX) / rect.width : (moveEvent.clientY - drag.startY) / rect.height;
      const nextRatio = Math.max(0.08, Math.min(0.92, drag.ratio + delta));
      onUpdate({ ...panel, split: { ...panel.split, ratio: nextRatio } });
    };
    const stop = () => { dragRef.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop); window.addEventListener('pointercancel', stop);
  };
  const ratioALabel = Math.round(currentRatio * 100);
  const ratioBLabel = 100 - ratioALabel;
  const clipPath = isVertical ? `inset(0 0 0 ${ratioALabel}%)` : `inset(${ratioALabel}% 0 0 0)`;
  return <div className="space-y-2">
    <div ref={containerRef} className="relative overflow-hidden rounded-xl border border-yellow-400/20 bg-black/30">
      <div className="relative w-full overflow-hidden bg-white/5" style={{ aspectRatio: String(ratio || '1:1').replace(':', ' / ') }}>
        {panel.split.a?.image_url ? <img src={panel.split.a.image_url} alt="Panel A" onPointerDown={(event) => beginImageDrag(event, 'a')} className="absolute inset-0 h-full w-full cursor-move object-cover" style={{ objectPosition: `${layerPositions.a.x}% ${layerPositions.a.y}%` }} /> : <div className="absolute inset-0 flex items-center justify-center text-white/25"><ImageIcon /></div>}
        {panel.split.b?.image_url && <img src={panel.split.b.image_url} alt="Panel B" onPointerDown={(event) => beginImageDrag(event, 'b')} className="absolute inset-0 h-full w-full cursor-move object-cover" style={{ clipPath, objectPosition: `${layerPositions.b.x}% ${layerPositions.b.y}%` }} />}
        <button type="button" aria-label="Drag to resize split" onPointerDown={begin} disabled={disabled} className={`absolute z-10 flex items-center justify-center bg-fuchsia-500 text-white shadow-[0_0_0_2px_rgba(0,0,0,0.6)] hover:bg-fuchsia-400 ${isVertical ? 'inset-y-0 w-5 cursor-col-resize rounded-lg' : 'inset-x-0 h-5 cursor-row-resize rounded-lg'}`} style={isVertical ? { left: `calc(${currentRatio * 100}% - 10px)` } : { top: `calc(${currentRatio * 100}% - 10px)` }}>
          <span className={`pointer-events-none select-none whitespace-nowrap text-[9px] font-black ${isVertical ? '[writing-mode:vertical-rl]' : ''}`}>{ratioALabel} / {ratioBLabel}</span>
        </button>
      </div>
      <div className={`flex ${isVertical ? 'flex-row' : 'flex-col'} gap-0 p-2`}>
        <div className={isVertical ? 'min-w-0' : 'min-h-0'} style={isVertical ? { width: `${currentRatio * 100}%` } : { height: 'auto' }}>
          <PanelLeafEditor panel={panel.split.a} path={[...path, 'a']} label="Panel A" ratio={ratio} disabled={disabled} onUpdate={(nextChild) => onUpdate({ ...panel, split: { ...panel.split, a: nextChild } })} renderLeaf={renderLeaf} />
        </div>
        <div className={isVertical ? 'min-w-0 flex-1' : 'min-h-0'} style={!isVertical ? {} : {}}>
          <PanelLeafEditor panel={panel.split.b} path={[...path, 'b']} label="Panel B" ratio={ratio} disabled={disabled} onUpdate={(nextChild) => onUpdate({ ...panel, split: { ...panel.split, b: nextChild } })} renderLeaf={renderLeaf} />
        </div>
      </div>
    </div>
    <div className="flex gap-2">
      <button type="button" disabled={disabled} onClick={() => onUpdate(unsplitPanel(panel, 'a'))} className={`${action} flex-1 bg-red-500/70 text-white`}>Unsplit · keep left/top (A)</button>
      <button type="button" disabled={disabled} onClick={() => onUpdate(unsplitPanel(panel, 'b'))} className={`${action} flex-1 bg-red-500/70 text-white`}>Unsplit · keep right/bottom (B)</button>
    </div>
  </div>;
}

const normalizedTextBoxes = (boxes) => (Array.isArray(boxes) ? boxes : []).map((box) => ({
  id: box.id || crypto.randomUUID(), type: box.type === 'dialogue' ? 'dialogue' : 'narration', text: box.text || '',
  x: Number.isFinite(Number(box.x)) ? Number(box.x) : 8, y: Number.isFinite(Number(box.y)) ? Number(box.y) : 8,
  width: Number.isFinite(Number(box.width)) ? Number(box.width) : 42, height: Number.isFinite(Number(box.height)) ? Number(box.height) : 20,
  font_size: Number.isFinite(Number(box.font_size)) ? Number(box.font_size) : 26,
  tail_side: ['top', 'right', 'bottom', 'left'].includes(box.tail_side) ? box.tail_side : 'bottom',
  tail_position: Number.isFinite(Number(box.tail_position)) ? Math.max(10, Math.min(90, Number(box.tail_position))) : 50,
  tail_size: Number.isFinite(Number(box.tail_size)) ? Math.max(10, Math.min(50, Number(box.tail_size))) : 22,
}));
const textBoxSignature = (source, boxes) => JSON.stringify({ source, boxes: normalizedTextBoxes(boxes).map(({ id: _id, ...box }) => box) });
function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + width, y, x + width, y + height, r); ctx.arcTo(x + width, y + height, x, y + height, r); ctx.arcTo(x, y + height, x, y, r); ctx.arcTo(x, y, x + width, y, r); ctx.closePath();
}
function drawWrappedText(ctx, text, x, y, maxWidth, maxHeight, fontSize) {
  const lineHeight = fontSize * 1.08; const paragraphs = String(text || '').split(/\n/); const lines = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean); let line = '';
    if (!words.length) { lines.push(''); continue; }
    for (const word of words) { const candidate = line ? `${line} ${word}` : word; if (line && ctx.measureText(candidate).width > maxWidth) { lines.push(line); line = word; } else line = candidate; }
    if (line) lines.push(line);
  }
  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight)); const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines) visible[maxLines - 1] = `${visible[maxLines - 1].replace(/\s+\S*$/, '')}…`;
  const startY = y + Math.max(0, (maxHeight - visible.length * lineHeight) / 2); ctx.textAlign = 'center';
  visible.forEach((line, index) => ctx.fillText(line, x + maxWidth / 2, startY + index * lineHeight));
}
function drawDialogueTail(ctx, box, x, y, width, height, lineWidth) {
  const side = box.tail_side || 'bottom'; const position = (box.tail_position || 50) / 100; const size = Math.max(12, Math.min(width, height) * (box.tail_size || 22) / 100); let baseA; let tip; let baseB;
  if (side === 'top') { const cx = x + width * position; baseA = [cx - size * 0.18, y]; tip = [cx, y - size]; baseB = [cx + size * 0.18, y]; }
  else if (side === 'right') { const cy = y + height * position; baseA = [x + width, cy - size * 0.18]; tip = [x + width + size, cy]; baseB = [x + width, cy + size * 0.18]; }
  else if (side === 'left') { const cy = y + height * position; baseA = [x, cy - size * 0.18]; tip = [x - size, cy]; baseB = [x, cy + size * 0.18]; }
  else { const cx = x + width * position; baseA = [cx - size * 0.18, y + height]; tip = [cx, y + height + size]; baseB = [cx + size * 0.18, y + height]; }
  ctx.beginPath(); ctx.moveTo(...baseA); ctx.lineTo(...tip); ctx.lineTo(...baseB); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(...baseA); ctx.lineTo(...tip); ctx.lineTo(...baseB); ctx.lineWidth = lineWidth; ctx.strokeStyle = '#111'; ctx.stroke();
}
async function composeTextBoxes(imageUrl, boxes) {
  const response = await fetch(imageUrl); if (!response.ok) throw new Error('Unable to load the image for text editing');
  const bitmap = await createImageBitmap(await response.blob()); const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0); bitmap.close();
  for (const box of normalizedTextBoxes(boxes)) {
    const x = canvas.width * box.x / 100; const y = canvas.height * box.y / 100; const width = canvas.width * box.width / 100; const height = canvas.height * box.height / 100;
    ctx.save(); roundedRect(ctx, x, y, width, height, 0); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = Math.max(2, canvas.width * 0.002); ctx.strokeStyle = '#111'; ctx.stroke();
    if (box.type === 'dialogue') drawDialogueTail(ctx, box, x, y, width, height, ctx.lineWidth);
    roundedRect(ctx, x, y, width, height, 0); ctx.clip();
    const padding = Math.max(3, width * 0.01); const fontSize = Math.max(12, canvas.width * box.font_size / 1300); ctx.font = `600 ${fontSize}px Arial, sans-serif`; ctx.fillStyle = '#111'; ctx.textBaseline = 'top'; drawWrappedText(ctx, box.text, x + padding, y + padding, width - padding * 2, height - padding * 2, fontSize); ctx.restore();
  }
  const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Unable to save text on the image')), 'image/png', 0.95));
  return new File([blob], `story-image-text-${crypto.randomUUID()}.png`, { type: 'image/png' });
}

export default function AuthorProductionWorkspace({ user, project, setProject, activeChapterId, setActiveChapterId, saving, onBack, onEditSetup, onSave }) {
  const adjustmentProjectRef = useRef(project);
  adjustmentProjectRef.current = project;
  const [pricing, setPricing] = useState({});
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [catalogGalleries, setCatalogGalleries] = useState({});
  const active = useMemo(() => project.chapters.find((chapter) => chapter.id === activeChapterId), [project.chapters, activeChapterId]);
  const firstOpen = active?.segments.findIndex((segment) => segment.status !== 'approved') ?? 0;
  const currentIndex = firstOpen < 0 ? 8 : firstOpen;
  const selectedIndex = Math.max(0, active?.segments.findIndex((segment) => segment.id === selectedId) ?? 0);
  const segment = active?.segments[selectedIndex];
  const approved = active?.segments.filter((item) => item.status === 'approved').length || 0;

  useEffect(() => { base44.entities.ToolPricing.filter({ is_active: true }).then((rows) => setPricing(Object.fromEntries(rows.map((row) => [row.tool_id, row.token_cost])))).catch(() => toast.error('Unable to load generation prices')); }, []);
  useEffect(() => {
    const sourceIds = [...new Set([...project.characters, ...project.locations].map((item) => item.image_source_id).filter(Boolean))];
    if (!sourceIds.length) { setCatalogGalleries({}); return; }
    supabase.from('catalog_asset').select('id,featured_image,preview_images').in('id', sourceIds).then(({ data, error }) => {
      if (error) throw error;
      setCatalogGalleries(Object.fromEntries((data || []).map((item) => [item.id, uniqueImages([item.featured_image, ...(Array.isArray(item.preview_images) ? item.preview_images : [])])])));
    }).catch((error) => toast.error(error.message || 'Unable to load reference images'));
  }, [project.characters, project.locations]);
  useEffect(() => { if (!active) return; const selected = active.segments.find((item) => item.id === selectedId); if (!selected || selected.number > currentIndex + 1) setSelectedId(active.segments[currentIndex].id); }, [active, currentIndex, selectedId]);

  const withSegment = (id, values, chapterValues = {}) => ({ ...project, chapters: project.chapters.map((chapter) => chapter.id === activeChapterId ? { ...chapter, ...chapterValues, segments: chapter.segments.map((item, index) => item.id === id ? normalizeSegment({ ...item, ...values }, index) : item) } : chapter) });
  const updateSegment = (id, values) => setProject(withSegment(id, values));
  const persistSegment = async (id, values, chapterValues = {}) => { const next = withSegment(id, values, chapterValues); setProject(next); return onSave(next, { silent: true }); };
  const persistImageAdjustment = async (chapterId, segmentId, values, fingerprint) => {
    const current = adjustmentProjectRef.current;
    const chapter = current.chapters.find((item) => item.id === chapterId);
    const target = chapter?.segments.find((item) => item.id === segmentId);
    if (!target || adjustmentFingerprint(target, chapter.image_aspect_ratio || '16:9') !== fingerprint) throw new Error('The image changed while the adjustment was being prepared. Nothing was replaced.');
    const updated = { ...current, chapters: current.chapters.map((item) => item.id !== chapterId ? item : { ...item, segments: item.segments.map((entry) => entry.id === segmentId ? { ...entry, ...values } : entry) }) };
    const saved = await onSave(updated, { silent: true });
    if (!saved) throw new Error('The adjustment could not be saved. Retry accepting the candidate.');
    return saved;
  };
  const persistCharacterLook = async (segmentId, characterId, imageUrl, segmentValues) => {
    const next = withSegment(segmentId, segmentValues);
    next.characters = next.characters.map((character) => character.id === characterId ? { ...character, active_look_reference_url: imageUrl, look_reference_images: uniqueImages([...(Array.isArray(character.look_reference_images) ? character.look_reference_images : []), imageUrl]) } : character);
    setProject(next);
    return onSave(next, { silent: true });
  };
  const updateChapter = (updater) => setProject((current) => ({ ...current, chapters: current.chapters.map((chapter) => chapter.id === activeChapterId ? updater(chapter) : chapter) }));

  const addChapter = () => { const chapter = newChapter(project.chapters.length, 'manual', null); setProject((current) => ({ ...current, chapters: [...current.chapters, chapter] })); setActiveChapterId(chapter.id); setSelectedId(chapter.segments[0].id); };
  const previewVoice = async (voice) => { setBusy(`voice-${voice}`); try { const response = await base44.functions.invoke('generateSpeech', { voice, preview: true }); await new Audio(response.data.file_url).play(); } catch (error) { toast.error(error.message || 'Voice preview failed'); } finally { setBusy(''); } };

  const draftCurrent = async () => {
    if (!active?.brief?.trim() && !active?.source_excerpt?.trim()) return toast.error('Add the chapter brief or source excerpt first');
    const target = active.segments[currentIndex];
    setBusy('segment-draft');
    try {
      const previous = currentIndex ? active.segments[currentIndex - 1] : null;
      const prompt = `Draft ONLY current segment ${target.number}. Do not outline, predict or prepare later segments. Use only supplied IDs. Write production-ready English and respect continuity.\nPROJECT:${context(project)}\nCHAPTER:${JSON.stringify({ title: active.title, brief: active.brief, source: active.source_excerpt })}\nPREVIOUS APPROVED:${JSON.stringify(previous?.status === 'approved' ? previous : null)}\nINHERITED APPEARANCE:${JSON.stringify(active.appearance_continuity || {})}`;
      const result = unwrap(await base44.integrations.Core.InvokeLLM({ prompt, response_json_schema: segmentSchema }));
      if (!result?.summary) throw new Error('No current segment returned');
      const characters = new Set(project.characters.map((item) => item.id)); const locations = new Set(project.locations.map((item) => item.id));
      const saved = await persistSegment(target.id, { ...result, character_ids: (result.character_ids || []).filter((id) => characters.has(id)), location_ids: (result.location_ids || []).filter((id) => locations.has(id)), status: 'draft' });
      setSelectedId(target.id); setNotice(saved ? `Segment ${target.number} drafted and saved.` : `Segment ${target.number} drafted but not saved.`);
    } catch (error) { toast.error(error.message || 'Unable to draft current segment'); } finally { setBusy(''); }
  };

  const approveSegment = async (values) => {
    if (segment.number !== currentIndex + 1) return toast.error('Approve the current segment first');
    const continuity = { ...(active.appearance_continuity || {}) };
    for (const id of segment.character_ids) { const value = values.character_directions?.[id] || {}; if (value.continuity_scope === 'carry') continuity[id] = { look: value.look || '', costume: value.costume || '', injuries: value.injuries || '', hair_makeup_accessories: value.hair_makeup_accessories || '', physical_state: value.physical_state || '', continuity_scope: 'carry' }; }
    const saved = await persistSegment(segment.id, { ...values, status: 'approved' }, { appearance_continuity: continuity });
    if (segment.number < 9) setSelectedId(active.segments[segment.number].id);
    setNotice(saved ? `Segment ${segment.number} approved and saved. The next segment is unlocked.` : `Segment ${segment.number} approved but not saved.`);
  };

  const publishProject = async (publication) => {
    if (!project.id) return toast.error('Save the project before publishing');
    const readyChapters = project.chapters.filter((chapter) => chapter.segments.length === 9 && chapter.segments.every((item) => item.status === 'approved' && item.image_url && item.narration_url));
    if (!readyChapters.length) return toast.error('Complete and approve all 9 segments of at least one chapter first');
    setPublishing(true);
    try {
      const response = await base44.functions.invoke('publishAuthorStory', { project_id: project.id, ...publication });
      const published = { ...project, status: 'published', published_dossier_id: response.data.dossier_id };
      setProject(published);
      setShowPublish(false);
      toast.success(response.data.republished ? 'Story Block republished' : 'Story Block published');
      window.open(`/Magazine?dossier=${encodeURIComponent(response.data.dossier_id)}`, '_blank', 'noopener,noreferrer');
    } catch (error) { toast.error(error.message || 'Publication failed'); }
    finally { setPublishing(false); }
  };

  return <div className="mx-auto w-full max-w-[1800px] px-5 pb-28 lg:px-10">
    <header className="mb-6 flex flex-wrap items-center gap-3"><button onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black text-yellow-400"><ArrowLeft size={20} /></button><div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-widest text-black/55">Private author project</p><h2 className="truncate text-2xl font-black lg:text-4xl">{project.title}</h2></div><button onClick={onEditSetup} className="hidden rounded-2xl bg-black/10 px-4 py-3 text-sm font-black md:block">Story, cast & locations</button><button onClick={() => setShowPreview(true)} className="flex items-center gap-2 rounded-2xl border-2 border-black px-4 py-3 text-sm font-black"><Eye size={17} /> Preview</button><button onClick={() => setShowExport(true)} className="flex items-center gap-2 rounded-2xl border-2 border-black bg-white px-4 py-3 text-sm font-black"><Download size={17} /> Export</button>{project.published_dossier_id && <a href={`/Magazine?dossier=${encodeURIComponent(project.published_dossier_id)}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-2xl bg-green-600 px-4 py-3 text-sm font-black text-white"><ExternalLink size={17} /> Open published</a>}<button onClick={() => setShowPublish(true)} disabled={publishing} className="flex items-center gap-2 rounded-2xl bg-yellow-400 px-4 py-3 text-sm font-black text-black">{publishing ? <Loader2 size={17} className="animate-spin" /> : <Rocket size={17} />} {project.published_dossier_id ? 'Republish' : 'Publish'}</button><button onClick={() => onSave(project)} disabled={saving} className="flex items-center gap-2 rounded-2xl bg-black px-4 py-3 text-sm font-black text-yellow-400">{saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />} Save</button></header>
    <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]"><aside className="rounded-3xl bg-black/5 p-4"><h3 className="mb-3 text-sm font-black uppercase">Chapters</h3><div className="space-y-2">{project.chapters.map((chapter) => <button key={chapter.id} onClick={() => setActiveChapterId(chapter.id)} className={`flex w-full gap-3 rounded-xl p-3 text-left text-sm font-black ${chapter.id === activeChapterId ? 'bg-black text-yellow-400' : 'bg-white'}`}><span>{chapter.number}</span><span className="truncate">{chapter.title}</span></button>)}</div><button onClick={addChapter} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-xs font-black"><Plus size={15} /> New chapter</button></aside>
      <main>{!active ? <div className="rounded-3xl bg-black/5 p-16 text-center font-black">Create a chapter</div> : <section className="overflow-hidden rounded-[2rem] bg-black text-white"><div className="border-b border-white/10 p-5"><div className="flex gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400 font-black text-black">{active.number}</span><input value={active.title} onChange={(event) => updateChapter((chapter) => ({ ...chapter, title: event.target.value }))} className="min-w-0 flex-1 rounded-xl bg-white/10 px-3 text-lg font-black" /><span className="rounded-xl bg-black px-3 py-3 text-xs font-black text-yellow-400">{approved}/9 APPROVED</span></div><div className="mt-4 grid gap-3 xl:grid-cols-2"><textarea value={active.brief} onChange={(event) => updateChapter((chapter) => ({ ...chapter, brief: event.target.value }))} rows={4} className={dark} placeholder="Chapter brief" /><textarea value={active.source_excerpt} onChange={(event) => updateChapter((chapter) => ({ ...chapter, source_excerpt: event.target.value }))} rows={4} className={dark} placeholder="Optional source excerpt" /></div><div className="mt-3 flex flex-wrap items-end gap-3"><label className="min-w-40"><span className="mb-1 block text-[11px] font-black uppercase text-yellow-400">Image ratio · entire chapter</span><select value={active.image_aspect_ratio || '16:9'} onChange={(event) => updateChapter((chapter) => ({ ...chapter, image_aspect_ratio: event.target.value, segments: chapter.segments.map((item) => item.visual_format === 'comic' ? { ...item, comic_page_source: '', text_overlay_source_url: '', text_overlay_applied_signature: '' } : item) }))} className={dark}>{IMAGE_RATIOS.map((ratio) => <option key={ratio} className="text-black" value={ratio}>{ratio}</option>)}</select></label><button onClick={draftCurrent} disabled={busy === 'segment-draft' || approved === 9} className={`${action} bg-yellow-400 text-black`}>{busy === 'segment-draft' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Draft current segment {currentIndex + 1}</button><span className="pb-2 text-xs text-white/45">The image ratio applies to all 9 segments · {pricing.ai_text ?? '—'} credit</span></div>
        <div className="mt-4 grid grid-cols-9 gap-2">{active.segments.map((item, index) => <button key={item.id} disabled={index > currentIndex} onClick={() => setSelectedId(item.id)} className={`rounded-xl border py-2 text-xs font-black ${item.status === 'approved' ? 'border-green-400 bg-green-400 text-black' : item.id === segment?.id ? 'border-yellow-400 bg-yellow-400 text-black' : index > currentIndex ? 'border-white/5 bg-white/5 text-white/20' : 'border-yellow-400/40 text-yellow-400'}`}>{item.status === 'approved' ? <Check size={14} className="mx-auto" /> : item.number}</button>)}</div>{notice && <div className="mt-3 flex justify-between rounded-xl bg-green-400/10 p-3 text-xs font-bold text-green-200"><span>{notice}</span><button onClick={() => setNotice('')}><X size={14} /></button></div>}</div>
        {segment && <div className="p-4 lg:p-6"><SegmentDirector key={segment.id} userEmail={user?.email || ''} project={project} chapter={active} segment={segment} previous={selectedIndex ? active.segments[selectedIndex - 1] : null} isCurrent={selectedIndex === currentIndex} pricing={pricing} busy={busy} setBusy={setBusy} previewVoice={previewVoice} catalogGalleries={catalogGalleries} onChange={(values) => updateSegment(segment.id, values)} onPersist={(values, chapterValues = {}) => persistSegment(segment.id, values, chapterValues)} onPersistCharacterLook={(characterId, imageUrl, values) => persistCharacterLook(segment.id, characterId, imageUrl, values)} onPersistAdjustment={(values, fingerprint) => persistImageAdjustment(active.id, segment.id, values, fingerprint)} onApprove={approveSegment} /></div>}
      </section>}</main></div>
    {showPreview && <AuthorPreviewModal project={project} onClose={() => setShowPreview(false)} />}
    {showExport && <AuthorExportModal project={project} activeChapterId={activeChapterId} onClose={() => setShowExport(false)} />}
    {showPublish && <AuthorPublishModal user={user} project={project} publishing={publishing} onClose={() => setShowPublish(false)} onPublish={publishProject} />}
  </div>;
}

function AuthorPublishModal({ user, project, publishing, onClose, onPublish }) {
  const readyChapters = useMemo(() => project.chapters.filter((chapter) => chapter.segments.length === 9 && chapter.segments.every((segment) => segment.status === 'approved' && segment.image_url && segment.narration_url)), [project.chapters]);
  const [selectedIds, setSelectedIds] = useState(() => readyChapters.map((chapter) => chapter.id));
  const [title, setTitle] = useState(project.title || '');
  const [description, setDescription] = useState(project.story_description || '');
  const [authorName, setAuthorName] = useState(user?.full_name || user?.email || project.created_by || '');
  const [dossierClass, setDossierClass] = useState('Story');
  const [category, setCategory] = useState(project.genre || '');
  const [categories, setCategories] = useState([]);
  const [contentRating, setContentRating] = useState('');
  const [originalLanguage, setOriginalLanguage] = useState('en');
  const [confirmed, setConfirmed] = useState(false);
  const [coverImage, setCoverImage] = useState(project.cover_image || readyChapters[0]?.segments[0]?.image_url || '');
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef(null);
  useEffect(() => { base44.entities.DossierCategory.list('order', 50).then((rows) => setCategories(rows.map((row) => row.name).filter(Boolean))).catch(() => setCategories([])); }, []);
  const selectedChapters = readyChapters.filter((chapter) => selectedIds.includes(chapter.id));
  const coverOptions = [project.cover_image, ...selectedChapters.flatMap((chapter) => chapter.segments.map((segment) => segment.image_url))].filter((url, index, rows) => url && rows.indexOf(url) === index);
  const toggleChapter = (id) => setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const uploadCover = async (event) => { const file = event.target.files?.[0]; if (!file) return; setUploading(true); try { const result = await base44.integrations.Core.UploadFile({ file }); setCoverImage(result.file_url); } catch (error) { toast.error(error.message || 'Cover upload failed'); } finally { setUploading(false); if (fileInput.current) fileInput.current.value = ''; } };
  const canPublish = selectedIds.length > 0 && title.trim() && authorName.trim() && dossierClass && contentRating && originalLanguage && confirmed;
  const submit = () => onPublish({ chapter_ids: selectedIds, title: title.trim(), description: description.trim(), author_name: authorName.trim(), dossier_class: dossierClass, category: category.trim(), cover_image: coverImage, content_rating: contentRating, original_language: originalLanguage, public_promo_confirmed: confirmed });
  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-3"><div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-yellow-400 p-5 text-black shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-widest">Publish to Magazine</p><h3 className="mt-1 text-2xl font-black">Story details</h3></div><button onClick={onClose} className="rounded-full bg-black p-2 text-yellow-400"><X size={19} /></button></div>
    <div className="mt-5 space-y-4"><div><p className="mb-2 text-xs font-black uppercase">Chapters to publish *</p><div className="space-y-2">{readyChapters.map((chapter) => <button key={chapter.id} onClick={() => toggleChapter(chapter.id)} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left font-black ${selectedIds.includes(chapter.id) ? 'bg-black text-yellow-400' : 'bg-white'}`}><span className="flex h-5 w-5 items-center justify-center rounded border">{selectedIds.includes(chapter.id) && <Check size={14} />}</span><span className="flex-1">Chapter {chapter.number} · {chapter.title}</span><span className="text-xs">9 segments</span></button>)}</div>{!readyChapters.length && <p className="rounded-xl bg-red-100 p-3 text-sm font-black text-red-700">Complete and approve all 9 segments of at least one chapter.</p>}</div>
      <label><span className="mb-1 block text-xs font-black uppercase">Public title *</span><input value={title} onChange={(event) => setTitle(event.target.value)} className={input} /></label>
      <label><span className="mb-1 block text-xs font-black uppercase">Public author name *</span><input value={authorName} onChange={(event) => setAuthorName(event.target.value)} className={input} /></label>
      <div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1 block text-xs font-black uppercase">Class *</span><select value={dossierClass} onChange={(event) => setDossierClass(event.target.value)} className={input}>{['Story', 'Videos', 'Assets', 'Kits', 'Merchandise'].map((value) => <option key={value}>{value}</option>)}</select></label><label><span className="mb-1 block text-xs font-black uppercase">Category</span><select value={category} onChange={(event) => setCategory(event.target.value)} className={input}><option value="">Select category</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></label></div>
      <input value={category} onChange={(event) => setCategory(event.target.value)} className={input} placeholder="…or type a custom category" />
      <div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1 block text-xs font-black uppercase">Content rating *</span><select value={contentRating} onChange={(event) => setContentRating(event.target.value)} className={input}><option value="">Choose rating</option><option value="all">All audiences</option><option value="13+">13+</option><option value="18+">18+</option></select></label><label><span className="mb-1 block text-xs font-black uppercase">Original language *</span><select value={originalLanguage} onChange={(event) => setOriginalLanguage(event.target.value)} className={input}><option value="en">English</option><option value="fr">French</option><option value="es">Spanish</option></select></label></div>
      <label><span className="mb-1 block text-xs font-black uppercase">Public description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className={input} /></label>
      <div><div className="mb-2 flex items-center justify-between"><span className="text-xs font-black uppercase">Cover image</span><><button onClick={() => fileInput.current?.click()} disabled={uploading} className={`${action} bg-black text-yellow-400`}>{uploading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />} Upload cover</button><input ref={fileInput} type="file" accept="image/*" onChange={uploadCover} className="hidden" /></></div><div className="grid grid-cols-4 gap-2">{coverOptions.slice(0, 12).map((url) => <button key={url} onClick={() => setCoverImage(url)} className={`aspect-[3/4] overflow-hidden rounded-xl border-4 ${coverImage === url ? 'border-black' : 'border-transparent opacity-70'}`}><img src={url} alt="" className="h-full w-full object-cover" /></button>)}</div>{coverImage && !coverOptions.includes(coverImage) && <img src={coverImage} alt="Selected cover" className="mt-2 h-28 rounded-xl object-cover" />}</div>
      <label className="flex items-start gap-3 rounded-xl bg-white p-4"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 h-4 w-4" /><span className="text-sm font-bold">I confirm that this Story Block may be published publicly in the AISTAGE.ONE Magazine.</span></label>
      <div className="flex justify-end gap-3"><button onClick={onClose} className={`${action} bg-black/10`}>Cancel</button><button disabled={!canPublish || publishing} onClick={submit} className={`${action} bg-black text-yellow-400`}>{publishing ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />} {project.published_dossier_id ? 'Republish Story Block' : 'Publish Story Block'}</button></div>
    </div></div></div>;
}

function AuthorExportModal({ project, activeChapterId, onClose }) {
  const readyChapters = useMemo(() => completedExportChapters(project), [project]);
  const [selectedIds, setSelectedIds] = useState(() => readyChapters.some((chapter) => chapter.id === activeChapterId) ? [activeChapterId] : readyChapters.map((chapter) => chapter.id));
  const [task, setTask] = useState(''); const [progress, setProgress] = useState(0); const [progressLabel, setProgressLabel] = useState('');
  const chapters = readyChapters.filter((chapter) => selectedIds.includes(chapter.id)); const mp4Supported = Boolean(supportedMp4Type());
  const toggle = (id) => setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const report = (label, value) => { setProgressLabel(label); setProgress(Math.max(0, Math.min(1, value))); };
  const run = async (kind) => {
    if (!chapters.length) return toast.error('Select at least one completed chapter');
    setTask(kind); setProgress(0); setProgressLabel(kind === 'video' ? 'Preparing animated video' : 'Preparing slideshow');
    try {
      if (kind === 'video') await exportAnimatedVideo(project, chapters, report); else await exportSlideshowZip(project, chapters, report);
      toast.success(kind === 'video' ? 'Animated MP4 downloaded' : 'Slideshow ZIP downloaded');
    } catch (error) { toast.error(error.message || 'Export failed'); setProgressLabel(error.message || 'Export failed'); }
    finally { setTask(''); }
  };
  return <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/90 p-3"><div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-[#0c0c0c] p-6 text-white shadow-[0_30px_90px_rgba(0,0,0,0.6)]"><div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4"><div><p className="text-xs font-black uppercase tracking-widest text-yellow-400">Additional exports</p><h3 className="mt-1 text-2xl font-black text-white">Export Story Block</h3><p className="mt-2 text-sm text-white/60">These downloads never replace or modify the original Story Block.</p></div><button onClick={onClose} disabled={Boolean(task)} className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 disabled:opacity-35"><X size={19} /></button></div>
    <div className="mt-6"><p className="mb-2 text-xs font-black uppercase tracking-widest text-white/50">Completed chapters to include</p><div className="space-y-2">{readyChapters.map((chapter) => <button key={chapter.id} onClick={() => toggle(chapter.id)} disabled={Boolean(task)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left font-black transition ${selectedIds.includes(chapter.id) ? 'border-yellow-400/40 bg-white/[0.06] text-white' : 'border-white/10 bg-white/[0.04] text-white/60 hover:border-white/20'}`}><span className={`flex h-5 w-5 items-center justify-center rounded border ${selectedIds.includes(chapter.id) ? 'border-yellow-400 bg-transparent text-yellow-400' : 'border-white/25'}`}>{selectedIds.includes(chapter.id) && <Check size={14} />}</span><span className="flex-1">Chapter {chapter.number} · {chapter.title}</span><span className={`text-xs font-bold ${selectedIds.includes(chapter.id) ? 'text-yellow-400/70' : 'text-white/40'}`}>9 segments</span></button>)}</div>{!readyChapters.length && <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm font-bold text-amber-200">Complete and approve all 9 images and narrations in a chapter before exporting it.</p>}</div>
    <div className="mt-6 grid gap-4 md:grid-cols-2"><section className="flex flex-col rounded-2xl border border-yellow-400/25 bg-gradient-to-b from-yellow-400/[0.08] to-transparent p-5"><Film className="text-yellow-400" size={22} /><h4 className="mt-3 text-lg font-black text-white">Animated video</h4><p className="mt-2 text-sm leading-relaxed text-white/65">Camera movement on each final image, soft transitions and synchronized narration. The MP4 is created locally and downloaded directly.</p><p className="mt-3 text-xs font-black uppercase tracking-wide text-emerald-300">No AI generation · no AISTAGE storage</p>{!mp4Supported && <p className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/10 p-2 text-xs font-bold text-amber-200">Local MP4 recording is not available in this browser. Use the current desktop version of Edge, Chrome or Safari.</p>}<button onClick={() => run('video')} disabled={Boolean(task) || !chapters.length || !mp4Supported} className={`${action} mt-4 w-full bg-yellow-400 text-black shadow-[0_6px_20px_rgba(250,204,21,0.25)] transition hover:brightness-105`}>{task === 'video' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Download animated MP4</button><p className="mt-2 text-[11px] text-white/45">Rendering takes approximately the full narration duration. Keep this window open.</p></section>
      <section className="flex flex-col rounded-2xl border border-teal-300/25 bg-gradient-to-b from-teal-300/[0.08] to-transparent p-5"><Images className="text-teal-300" size={22} /><h4 className="mt-3 text-lg font-black text-white">Slideshow / carousel</h4><p className="mt-2 text-sm leading-relaxed text-white/65">Numbered final images for reading, printing or social carousels, plus matching narration files and a Story Block manifest.</p><p className="mt-3 text-xs font-black uppercase tracking-wide text-emerald-300">No AI generation · no AISTAGE storage</p><button onClick={() => run('slides')} disabled={Boolean(task) || !chapters.length} className={`${action} mt-4 w-full bg-teal-300 text-black shadow-[0_6px_20px_rgba(94,234,212,0.25)] transition hover:brightness-105`}>{task === 'slides' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Download slideshow ZIP</button></section></div>
    {(task || progressLabel) && <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-3"><div className="flex justify-between text-xs font-black text-white/80"><span>{progressLabel}</span><span>{Math.round(progress * 100)}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-yellow-400 to-teal-300 transition-[width]" style={{ width: `${progress * 100}%` }} /></div></div>}
  </div></div>;
}

function AuthorPreviewModal({ project, onClose }) {
  const slides = project.chapters.flatMap((chapter) => chapter.segments.filter((segment) => segment.image_url || segment.narration_url).map((segment) => ({ chapter, segment })));
  const [index, setIndex] = useState(0);
  const current = slides[index];
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3 lg:p-8"><div className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-zinc-950 text-white shadow-2xl"><div className="flex items-center justify-between border-b border-white/10 p-4"><div><p className="text-xs font-black uppercase tracking-widest text-yellow-400">Story Block Preview</p><h3 className="text-xl font-black">{project.title}</h3></div><button onClick={onClose} className="rounded-xl bg-white/10 p-3"><X size={20} /></button></div>{!current ? <div className="p-16 text-center"><p className="text-lg font-black">Nothing to preview yet</p><p className="mt-2 text-sm text-white/50">Generate an image or audio for the first segment.</p></div> : <div className="min-h-0 overflow-y-auto"><div className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.7fr)]"><div className="flex min-h-80 items-center justify-center bg-black">{current.segment.image_url ? <img src={current.segment.image_url} alt="" className="max-h-[70vh] w-full object-contain" /> : <div className="text-white/30">No image</div>}</div><div className="flex flex-col p-5"><p className="text-xs font-black uppercase text-yellow-400">Chapter {current.chapter.number} · Segment {current.segment.number}</p><h4 className="mt-2 text-lg font-black">{current.chapter.title}</h4><p className="mt-4 text-sm leading-relaxed text-white/80">{current.segment.narration_text || current.segment.summary}</p>{current.segment.narration_url && <audio key={current.segment.narration_url} controls autoPlay src={current.segment.narration_url} className="mt-5 w-full" />}<div className="mt-auto flex items-center justify-between gap-3 pt-6"><button disabled={index === 0} onClick={() => setIndex((value) => value - 1)} className={`${action} bg-white/10`}>Previous</button><span className="text-xs font-black text-white/50">{index + 1} / {slides.length}</span><button disabled={index === slides.length - 1} onClick={() => setIndex((value) => value + 1)} className={`${action} bg-yellow-400 text-black`}>Next</button></div></div></div></div>}</div></div>;
}

function DialogueTail({ side = 'bottom', position = 50, size = 22 }) {
  const scale = Math.max(10, Math.min(50, Number(size) || 22)) / 22; const short = 18 * scale; const long = 24 * scale;
  const common = { position: 'absolute', pointerEvents: 'none', zIndex: 0 }; let style; let viewBox; let points; let edge;
  if (side === 'top') { style = { ...common, left: `${position}%`, bottom: 'calc(100% - 1px)', width: short, height: long, transform: 'translateX(-50%)' }; viewBox = '0 0 18 24'; points = '5,23 13,23 9,1'; edge = '5,23 9,1 13,23'; }
  else if (side === 'right') { style = { ...common, left: 'calc(100% - 1px)', top: `${position}%`, width: long, height: short, transform: 'translateY(-50%)' }; viewBox = '0 0 24 18'; points = '1,5 1,13 23,9'; edge = '1,5 23,9 1,13'; }
  else if (side === 'left') { style = { ...common, right: 'calc(100% - 1px)', top: `${position}%`, width: long, height: short, transform: 'translateY(-50%)' }; viewBox = '0 0 24 18'; points = '23,5 23,13 1,9'; edge = '23,5 1,9 23,13'; }
  else { style = { ...common, left: `${position}%`, top: 'calc(100% - 1px)', width: short, height: long, transform: 'translateX(-50%)' }; viewBox = '0 0 18 24'; points = '5,1 13,1 9,23'; edge = '5,1 9,23 13,1'; }
  return <svg aria-hidden="true" viewBox={viewBox} style={style} className="overflow-visible"><polygon points={points} fill="white" /><polyline points={edge} fill="none" stroke="#111" strokeWidth="2" strokeLinejoin="round" /></svg>;
}

function fittedTextBoxHeight(box, frameWidth, ratio) {
  const [rw, rh] = String(ratio || '16:9').split(':').map(Number); const frameHeight = frameWidth * (rh || 9) / (rw || 16);
  const boxWidth = frameWidth * box.width / 100; const fontSize = Math.max(9, frameWidth * box.font_size / 1300); const lineHeight = fontSize * 1.08; const padding = Math.max(2, boxWidth * 0.01);
  const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); ctx.font = `600 ${fontSize}px Arial, sans-serif`; const maxWidth = Math.max(20, boxWidth - padding * 2); let lineCount = 0;
  for (const paragraph of String(box.text || (box.type === 'dialogue' ? 'Dialogue' : 'Narration')).split(/\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean); if (!words.length) { lineCount += 1; continue; } let line = '';
    for (const word of words) { const candidate = line ? `${line} ${word}` : word; if (line && ctx.measureText(candidate).width > maxWidth) { lineCount += 1; line = word; } else line = candidate; }
    if (line) lineCount += 1;
  }
  return Math.min(100 - box.y, (Math.max(1, lineCount) * lineHeight + padding * 2) / frameHeight * 100);
}

function ImageTextBoxEditor({ imageUrl, ratio, boxes, defaultNarration, onChange, disabled }) {
  const frameRef = useRef(null); const changeRef = useRef(onChange); const dragRef = useRef(null);
  const [selectedId, setSelectedId] = useState(''); const [frameWidth, setFrameWidth] = useState(800);
  const items = normalizedTextBoxes(boxes); const selected = items.find((box) => box.id === selectedId);
  const fitKey = items.map((box) => `${box.id}:${box.text}:${box.width}:${box.font_size}:${box.y}`).join('|');
  changeRef.current = onChange;
  useEffect(() => { const frame = frameRef.current; if (!frame) return undefined; const observer = new ResizeObserver(([entry]) => setFrameWidth(entry.contentRect.width || 800)); observer.observe(frame); return () => observer.disconnect(); }, []);
  useEffect(() => { if (disabled || !frameWidth || !items.length) return; let changed = false; const fitted = items.map((box) => { const height = fittedTextBoxHeight(box, frameWidth, ratio); if (Math.abs(height - box.height) < 0.25) return box; changed = true; return { ...box, height }; }); if (changed) changeRef.current(fitted); }, [disabled, fitKey, frameWidth, ratio]);
  useEffect(() => {
    const move = (event) => { const drag = dragRef.current; const frame = frameRef.current; if (!drag || !frame) return; const rect = frame.getBoundingClientRect(); const dx = (event.clientX - drag.startX) / rect.width * 100; const dy = (event.clientY - drag.startY) / rect.height * 100; let next;
      if (drag.mode === 'move') next = { ...drag.box, x: Math.max(0, Math.min(100 - drag.box.width, drag.box.x + dx)), y: Math.max(0, Math.min(100 - drag.box.height, drag.box.y + dy)) };
      else next = { ...drag.box, width: Math.max(18, Math.min(100 - drag.box.x, drag.box.width + dx)) };
      changeRef.current(items.map((box) => box.id === drag.id ? next : box));
    };
    const stop = () => { dragRef.current = null; };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop); window.addEventListener('pointercancel', stop);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); };
  }, [items]);
  const begin = (event, box, mode) => { if (disabled) return; event.preventDefault(); event.stopPropagation(); setSelectedId(box.id); dragRef.current = { id: box.id, mode, startX: event.clientX, startY: event.clientY, box: { ...box } }; };
  const replace = (id, values) => changeRef.current(items.map((box) => box.id === id ? { ...box, ...values } : box));
  const add = (type) => { const index = items.length; const next = { id: crypto.randomUUID(), type, text: type === 'narration' ? (defaultNarration || '') : '', x: 6 + index * 3 % 28, y: 6 + index * 4 % 45, width: 42, height: 20, font_size: 26, tail_side: 'bottom', tail_position: 50, tail_size: 22 }; changeRef.current([...items, next]); setSelectedId(next.id); };
  return <div className="p-3"><div className="mb-3 flex flex-wrap items-center gap-2"><button type="button" onClick={() => add('narration')} disabled={disabled} className={`${action} bg-white text-black`}><Type size={14} /> Add narration box</button><button type="button" onClick={() => add('dialogue')} disabled={disabled} className={`${action} bg-white text-black`}><MessageSquareText size={14} /> Add dialogue box</button><span className="text-[11px] text-white/45">Drag the yellow handle to move · drag the corner to resize</span></div>
    <div ref={frameRef} className="relative mx-auto w-full touch-none overflow-hidden bg-white/5" style={{ aspectRatio: String(ratio || '16:9').replace(':', ' / ') }} onPointerDown={() => setSelectedId('')}>
      {imageUrl ? <img src={imageUrl} alt="Text layout preview" className="absolute inset-0 h-full w-full object-contain" draggable={false} /> : <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs font-bold text-white/35">Prepare narration and dialogue boxes now. The generated image will appear behind them.</div>}
      {items.map((box) => <div key={box.id} onPointerDown={(event) => { event.stopPropagation(); setSelectedId(box.id); }} className={`absolute select-none bg-white text-black shadow-lg ${selectedId === box.id ? 'ring-4 ring-yellow-400' : 'ring-1 ring-black/70'}`} style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.width}%`, height: `${box.height}%`, fontSize: `${Math.max(9, frameWidth * box.font_size / 1300)}px` }}>
        {box.type === 'dialogue' && <DialogueTail side={box.tail_side} position={box.tail_position} size={box.tail_size} />}
        <div className="relative z-10 flex h-full items-center justify-center overflow-hidden p-[1%] text-center font-semibold leading-[1.08] whitespace-pre-wrap">{box.text || (box.type === 'dialogue' ? 'Dialogue' : 'Narration')}</div>
        {!disabled && <><button type="button" aria-label="Move text box" onPointerDown={(event) => begin(event, box, 'move')} className="absolute -top-3 left-2 flex h-6 items-center gap-1 rounded-full bg-yellow-400 px-2 text-[9px] font-black text-black shadow"><GripHorizontal size={12} /> MOVE</button><button type="button" aria-label="Resize text box" onPointerDown={(event) => begin(event, box, 'resize')} className="absolute -bottom-2 -right-2 h-6 w-6 cursor-nwse-resize rounded-sm border-2 border-black bg-yellow-400 text-black">↘</button></>}
      </div>)}
    </div>
    {selected && !disabled && <div className="mt-3 grid gap-2 rounded-xl border border-yellow-400/30 bg-white/5 p-3 sm:grid-cols-[150px_minmax(0,1fr)_140px_auto]"><select value={selected.type} onChange={(event) => replace(selected.id, { type: event.target.value })} className={dark}><option className="text-black" value="narration">Narration</option><option className="text-black" value="dialogue">Dialogue</option></select><textarea value={selected.text} onChange={(event) => replace(selected.id, { text: event.target.value })} rows={2} className={input} placeholder="Text shown on the image" /><label className="text-[10px] font-black uppercase text-white/50">Text size<input type="range" min="18" max="50" value={selected.font_size} onChange={(event) => replace(selected.id, { font_size: Number(event.target.value) })} className="mt-2 w-full accent-yellow-400" /></label><button type="button" onClick={() => { changeRef.current(items.filter((box) => box.id !== selected.id)); setSelectedId(''); }} className={`${action} bg-red-500 text-white`}><Trash2 size={14} /> Delete</button>{selected.type === 'dialogue' && <div className="col-span-full grid gap-3 rounded-xl bg-black/35 p-3 sm:grid-cols-3"><div><p className="mb-2 text-[10px] font-black uppercase text-white/50">Pointer side</p><div className="flex flex-wrap gap-2">{['top', 'right', 'bottom', 'left'].map((side) => <button type="button" key={side} onClick={() => replace(selected.id, { tail_side: side })} className={`${action} ${selected.tail_side === side ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white'}`}>{side}</button>)}</div></div><label className="text-[10px] font-black uppercase text-white/50">Pointer position<input type="range" min="10" max="90" value={selected.tail_position} onChange={(event) => replace(selected.id, { tail_position: Number(event.target.value) })} className="mt-3 w-full accent-yellow-400" /></label><label className="text-[10px] font-black uppercase text-white/50">Pointer size · {selected.tail_size}%<input type="range" min="10" max="50" value={selected.tail_size} onChange={(event) => replace(selected.id, { tail_size: Number(event.target.value) })} className="mt-3 w-full accent-yellow-400" /></label></div>}</div>}
  </div>;
}

function SegmentDirector({ userEmail, project, chapter, segment, previous, isCurrent, pricing, busy, setBusy, previewVoice, catalogGalleries, onChange, onPersist, onPersistCharacterLook, onPersistAdjustment, onApprove }) {
  const [narrationMode, setNarrationMode] = useState('draft'); const [notice, setNotice] = useState(''); const [showMasterVault, setShowMasterVault] = useState(false); const [showMasterShop, setShowMasterShop] = useState(false); const masterUploadRef = useRef(null);
  const characters = selectedItems(segment.character_ids, project.characters); const locations = selectedItems(segment.location_ids, project.locations); const voice = segment.narrator_voice || ''; const actionBusy = busy.startsWith(`${segment.id}-`);
  const toggle = (field, id) => onChange({ [field]: segment[field].includes(id) ? segment[field].filter((item) => item !== id) : [...segment[field], id], status: 'draft' });
  const allowed = () => isCurrent || (toast.error('Approve the current segment before producing another one'), false);
  const isComic = segment.visual_format === 'comic';
  const panelCount = Number(segment.comic_panel_count || 3);
  const panelRatio = closestPanelRatio(chapter.image_aspect_ratio || '16:9', panelCount);
  const comicPanels = Array.from({ length: panelCount }, (_, index) => ({ id: `panel-${index + 1}`, beat: '', shot: IMAGE_TYPES[Math.min(index, IMAGE_TYPES.length - 1)], prompt: '', image_url: '', source_prompt: '', ...(segment.comic_panels?.[index] || {}) }));
  const comicSignature = comicPageSignature(segment, chapter, comicPanels);
  const textBoxes = normalizedTextBoxes(segment.text_boxes);
  const textSource = segment.text_overlay_source_url || segment.image_url;
  const textSignature = textBoxSignature(textSource, textBoxes);
  const overlayReady = textBoxes.length ? segment.text_overlay_applied_signature === textSignature : !segment.text_overlay_source_url;
  const characterGallery = (item) => uniqueImages([...assetGallery(item, catalogGalleries), ...(segment.character_generated_reference_images?.[item.id] || [])]);
  const selectedReferences = (item, field) => {
    const gallery = field === 'character_reference_images' ? characterGallery(item) : assetGallery(item, catalogGalleries);
    const explicit = Array.isArray(segment[field]?.[item.id]) ? segment[field][item.id].filter((url) => gallery.includes(url)) : [];
    return explicit.length ? explicit : gallery.slice(0, 1);
  };
  const locationReferences = locations.map((item) => ({ item, images: selectedReferences(item, 'location_reference_images') })).filter(({ images }) => images.length);
  const characterReferences = characters.map((item) => ({ item, images: selectedReferences(item, 'character_reference_images') })).filter(({ images }) => images.length);
  const referenceUrls = uniqueImages([chapter.master_reference_url, ...locationReferences.flatMap(({ images }) => images), ...characterReferences.flatMap(({ images }) => images)]).slice(0, 14);
  const locationLock = locationReferences.length ? `IMMUTABLE LOCATION REFERENCES — MANDATORY: ${locationReferences.map(({ item, images }) => `${images.length} supplied reference image${images.length === 1 ? '' : 's'} show the exact production location "${item.name}"${item.description ? ` (${item.description})` : ''}`).join('; ')}. Reproduce each selected location as the same physical place. Preserve its architecture, geometry, room proportions, walls, floors, ceilings, doors, windows, openings, stairs, permanent fixtures, materials, colors and spatial relationships. Never redesign, replace, extend, simplify, modernize or invent the location. A different camera position is allowed only inside this unchanged set.` : '';
  const masterLock = chapter.master_reference_url ? `SEQUENCE MASTER REFERENCE — MANDATORY: the first supplied reference image is the author-selected visual master for this chapter. Preserve its character identity, wardrobe, physical appearance, set, lighting, color treatment and photographic language wherever those elements remain present. Use the current frame instruction only to change the requested action and composition. Do not reinterpret or replace the master.` : '';
  const createCharacterReference = async (character) => {
    if (!allowed()) return;
    const direction = { ...(chapter.appearance_continuity?.[character.id] || {}), ...(segment.character_directions?.[character.id] || {}) };
    const requestedLook = [direction.look, direction.costume, direction.injuries, direction.hair_makeup_accessories, direction.physical_state].filter(Boolean).join('; ');
    if (!requestedLook) return toast.error('Describe the new appearance, clothes, hair, makeup or physical state first');
    const identityReferences = selectedReferences(character, 'character_reference_images').slice(0, 3);
    if (!identityReferences.length) return toast.error('Select at least one identity reference first');
    setBusy(`${segment.id}-reference-${character.id}`);
    try {
      const prompt = `Edit the supplied character reference images to create a new production reference for ${character.name}. Preserve exactly the same person's facial identity, age, ethnicity, body proportions and recognizable features. Apply only these requested look changes: ${requestedLook}. Show the resulting costume, hair, makeup, accessories, injuries and physical condition clearly. Create a clean photorealistic live-action reference image with the face unobstructed and the body visible enough to guide later scene generation. Use a simple neutral background. Do not add another person, text, labels, panels or graphic-design elements.`;
      const response = await base44.integrations.Core.GenerateImage({ prompt, reference_image_urls: identityReferences, aspect_ratio: '3:4' });
      if (!response?.file_url) throw new Error('No edited reference image returned');
      const generated = uniqueImages([...(segment.character_generated_reference_images?.[character.id] || []), response.file_url]);
      await onPersistCharacterLook(character.id, response.file_url, { character_generated_reference_images: { ...segment.character_generated_reference_images, [character.id]: generated }, character_reference_images: { ...segment.character_reference_images, [character.id]: [response.file_url] }, image_source_instruction: '', comic_page_source: '', comic_panels: segment.comic_panels.map((panel) => ({ ...panel, source_prompt: '' })), status: 'draft' });
      setNotice(`${character.name}'s new look was added to the character images and set as the active reference for the rest of the series.`);
    } catch (error) { toast.error(error.message || 'Unable to create the new look reference'); }
    finally { setBusy(''); }
  };
  // Assembly describes the rendered panel URLs and layout, not editable planning text.
  // Keep its signature so editing/restoring a prompt cannot invalidate an unchanged page.
  const updateComicPanel = (index, values) => onChange({ comic_panels: comicPanels.map((panel, panelIndex) => panelIndex === index ? { ...panel, ...values } : panel), status: 'draft' });
  const selectSequenceMaster = async (url, source, label) => {
    if (!url) return;
    const saved = await onPersist({}, { master_reference_url: url, master_reference_source: source, master_reference_label: label });
    if (!saved) { toast.error('Unable to save the sequence master. Please try again.'); return; }
    setShowMasterVault(false);
    setShowMasterShop(false);
    setNotice(`${label} is now the sequence master for this chapter. You can replace it at any time.`);
  };
  const clearSequenceMaster = async () => {
    const saved = await onPersist({}, { master_reference_url: '', master_reference_source: '', master_reference_label: '' });
    if (!saved) { toast.error('Unable to clear the sequence master. Please try again.'); return; }
    setNotice('The sequence master was cleared.');
  };
  const uploadSequenceMaster = async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    setBusy(`${segment.id}-master-upload`);
    try { const result = await base44.integrations.Core.UploadFile({ file }); await selectSequenceMaster(result.file_url, 'upload', file.name || 'Uploaded image'); }
    catch (error) { toast.error(error.message || 'Unable to upload the sequence master'); }
    finally { setBusy(''); if (masterUploadRef.current) masterUploadRef.current.value = ''; }
  };

  const applyImageAdjustment = async ({ target, url, instruction, reference, restore, fingerprint }) => {
    const record = segment.image_adjustments?.[target.key];
    const original = record?.original;
    if (restore && !original) throw new Error('No original image is available.');
    const values = { status: 'draft' };
    if (target.panelIndex !== null) {
      const panel = comicPanels[target.panelIndex];
      const restored = restore ? { image_url: original.image_url, source_prompt: original.source_prompt } : { image_url: url };
      const panels = comicPanels.map((item, index) => index === target.panelIndex ? { ...panel, ...restored } : item);
      values.comic_panels = panels;
      values.comic_page_source = '';
      // Reassemble from existing panels only; no other panel is sent to the AI.
      if (segment.image_url && panels.every((item) => item.image_url)) {
        const page = await assembleComicPage(panels, chapter.image_aspect_ratio || '16:9');
        const uploaded = await base44.integrations.Core.UploadFile({ file: page });
        if (!uploaded?.file_url) throw new Error('Unable to save the updated page.');
        values.image_url = uploaded.file_url;
        values.text_overlay_source_url = '';
        values.text_overlay_applied_signature = '';
        values.comic_page_source = comicPageSignature(segment, chapter, panels);
      }
    } else if (restore) {
      const snapshot = { ...original };
      delete snapshot.source_url;
      Object.assign(values, snapshot);
    } else {
      values.image_url = url;
      values.text_overlay_source_url = '';
      values.text_overlay_applied_signature = '';
    }
    // Keep editable text outside the AI request and reapply it with the existing renderer.
    if (values.image_url && textBoxes.length && (target.panelIndex !== null || !restore)) {
      const source = values.image_url;
      const file = await composeTextBoxes(source, textBoxes);
      const uploaded = await base44.integrations.Core.UploadFile({ file });
      if (!uploaded?.file_url) throw new Error('Unable to save the image with its text.');
      values.image_url = uploaded.file_url;
      values.text_overlay_source_url = source;
      values.text_overlay_applied_signature = textBoxSignature(source, textBoxes);
    }
    if (!restore) values.image_adjustments = adjustmentRecord(segment, target, url, instruction, reference);
    await onPersistAdjustment(values, fingerprint);
    setNotice(restore ? 'Original restored. Other images and audio are unchanged.' : 'Adjustment accepted and saved. The original remains available.');
  };

  const assistNarration = async () => { if (!allowed()) return; setBusy(`${segment.id}-narration`); try { const prompt = `Write production-ready English narration for ONLY this segment. Mode: ${narrationMode}. Never add unselected people, places or facts.\nPROJECT:${context(project)}\nPREVIOUS:${JSON.stringify(previous?.status === 'approved' ? previous : null)}\nCURRENT:${JSON.stringify({ summary: segment.summary, narration: segment.narration_text, character_ids: segment.character_ids, location_ids: segment.location_ids })}`; const result = unwrap(await base44.integrations.Core.InvokeLLM({ prompt, response_json_schema: { type: 'object', properties: { narration_text: { type: 'string' } }, required: ['narration_text'] } })); if (!result?.narration_text) throw new Error('No narration returned'); await onPersist({ narration_versions: saveVersion(segment.narration_versions, segment.narration_text), narration_text: result.narration_text, audio_stale: Boolean(segment.narration_url), status: 'draft' }); setNotice('Narration created and saved.'); } catch (error) { toast.error(error.message || 'Narration assistance failed'); } finally { setBusy(''); } };
  const buildVisual = async () => { if (!allowed()) return; if (!locations.length) return toast.error('Select the set first'); setBusy(`${segment.id}-visual`); try { const directions = Object.fromEntries(characters.map((character) => [character.id, { ...(chapter.appearance_continuity?.[character.id] || {}), ...(segment.character_directions[character.id] || {}) }])); const prompt = `Create one precise English image prompt for ONLY this segment. Existing actor and set images are immutable reference anchors; preserve identity and environment. Include costume, injuries, hair/makeup/accessories, state, position, action, expression and gaze. Never add unselected elements.\nPROJECT:${context(project)}\nSEGMENT:${JSON.stringify(segment)}\nINHERITED:${JSON.stringify(chapter.appearance_continuity || {})}\nDIRECTIONS:${JSON.stringify(directions)}`; const result = unwrap(await base44.integrations.Core.InvokeLLM({ prompt, response_json_schema: visualSchema })); if (!result?.final_prompt) throw new Error('No visual instruction returned'); await onPersist({ image_instruction: result.final_prompt, character_directions: { ...segment.character_directions, ...(result.character_directions || {}) }, status: 'draft' }); setNotice('Visual instruction created and saved.'); } catch (error) { toast.error(error.message || 'Visual instruction failed'); } finally { setBusy(''); } };
  const planComicPanels = async () => { if (!allowed()) return; if (!segment.image_instruction.trim()) return toast.error('Build the shared visual direction first'); setBusy(`${segment.id}-comic-plan`); try { const prompt = `Plan exactly ${panelCount} distinct live-action cinematic frames for this single Story Block segment. Each frame must advance the same segment through a different visual beat. Use the selected cast and set only. Preserve identity, costumes, injuries, lighting, photographic realism and continuity. Return an English beat, shot and complete image prompt for each frame. The prompts must describe realistic film production stills only: never illustration, cartoon, graphic-novel art, ink drawing, cel shading, speech bubbles, captions, lettering or borders. Page layout is handled separately and must never influence the visual style.\nPROJECT:${context(project)}\nSHARED VISUAL DIRECTION:${segment.image_instruction}\nSEGMENT:${JSON.stringify({ summary: segment.summary, narration: segment.narration_text, characters: characters.map(({ id, name, description }) => ({ id, name, description })), locations: locations.map(({ id, name, description }) => ({ id, name, description })) })}`; const result = unwrap(await base44.integrations.Core.InvokeLLM({ prompt, response_json_schema: comicSchema(panelCount) })); if (!result?.panels || result.panels.length !== panelCount) throw new Error(`The AI did not return ${panelCount} panels`); const nextPanels = result.panels.map((panel, index) => { const previousPanel = comicPanels[index]; return { ...previousPanel, beat: panel.beat, shot: panel.shot, prompt: panel.prompt, image_url: previousPanel.prompt === panel.prompt ? previousPanel.image_url : '', source_prompt: previousPanel.prompt === panel.prompt ? previousPanel.source_prompt : '' }; }); await onPersist({ comic_panels: nextPanels, comic_page_source: '', status: 'draft' }); setNotice(`${panelCount}-panel comic plan created and saved.`); } catch (error) { toast.error(error.message || 'Comic panel planning failed'); } finally { setBusy(''); } };
  const framePrompt = (panel, index) => `${masterLock}\n\n${locationLock}\n\nAUTHOR'S INSTRUCTION FOR THIS FRAME — FOLLOW THIS AS THE PRIMARY AND AUTHORITATIVE ACTION, COMPOSITION AND CONTENT:\n${panel.prompt}\n\nFRAME ${index + 1}/${panelCount}. Shot: ${panel.shot}. Render one live-action cinematic production still with photographic realism, faithful to the supplied actor references and the immutable location reference. Do not import the action or composition from another frame. The multi-frame page is only a layout assembled later. Do not use illustration, cartoon, graphic-novel, inked, painted or cel-shaded styling. Do not add a border, caption, speech bubble or lettering.`;
  const generateComicPanel = async (index) => { if (!allowed()) return; const panel = comicPanels[index]; if (!panel.prompt.trim()) return toast.error(`Write or plan panel ${index + 1} first`); if (!locationReferences.length) return toast.error('The selected location needs a reference image'); setBusy(`${segment.id}-panel-${index}`); try { const response = await base44.integrations.Core.GenerateImage({ prompt: framePrompt(panel, index), reference_image_urls: referenceUrls, aspect_ratio: panelRatio }); if (!response?.file_url) throw new Error('No panel image returned'); const nextPanels = comicPanels.map((item, panelIndex) => panelIndex === index ? { ...item, image_url: response.file_url, source_prompt: item.prompt } : item); await onPersist({ comic_panels: nextPanels, comic_page_source: '', status: 'draft' }); setNotice(`Panel ${index + 1} generated and saved.`); } catch (error) { toast.error(error.message || `Panel ${index + 1} generation failed`); } finally { setBusy(''); } };
  const generateMissingPanels = async () => { if (!allowed()) return; if (!locationReferences.length) return toast.error('The selected location needs a reference image'); if (comicPanels.some((panel) => !panel.prompt.trim())) return toast.error('Plan or write every panel first'); const missing = comicPanels.map((panel, index) => ({ panel, index })).filter(({ panel }) => !panel.image_url || panel.source_prompt !== panel.prompt); if (!missing.length) return toast.info('All panel images match their prompts'); setBusy(`${segment.id}-comic-all`); try { const nextPanels = [...comicPanels]; for (const { panel, index } of missing) { const response = await base44.integrations.Core.GenerateImage({ prompt: framePrompt(panel, index), reference_image_urls: referenceUrls, aspect_ratio: panelRatio }); if (!response?.file_url) throw new Error(`No image returned for panel ${index + 1}`); nextPanels[index] = { ...panel, image_url: response.file_url, source_prompt: panel.prompt }; } await onPersist({ comic_panels: nextPanels, comic_page_source: '', status: 'draft' }); setNotice(`${missing.length} panel image${missing.length === 1 ? '' : 's'} generated and saved.`); } catch (error) { toast.error(error.message || 'Comic panel generation failed'); } finally { setBusy(''); } };
  const uploadComicPanelImage = async (index, file) => { if (!allowed()) return; if (!file) return; setBusy(`${segment.id}-panel-upload-${index}`); try { const uploaded = await base44.integrations.Core.UploadFile({ file }); if (!uploaded?.file_url) throw new Error('Unable to upload the panel image'); const panel = comicPanels[index]; const nextPanels = comicPanels.map((item, panelIndex) => panelIndex === index ? { ...item, image_url: uploaded.file_url, source_prompt: panel.prompt } : item); await onPersist({ comic_panels: nextPanels, comic_page_source: '', status: 'draft' }); setNotice(`Panel ${index + 1} image uploaded and saved.`); } catch (error) { toast.error(error.message || `Panel ${index + 1} upload failed`); } finally { setBusy(''); } };
  const assembleComic = async () => { if (!allowed()) return; if (comicPanels.some((panel) => !panel.image_url || panel.source_prompt !== panel.prompt)) return toast.error('Generate every current panel before assembling the page'); setBusy(`${segment.id}-comic-assemble`); try { const file = await assembleComicPage(comicPanels, chapter.image_aspect_ratio || '16:9'); const uploaded = await base44.integrations.Core.UploadFile({ file }); await onPersist({ image_versions: saveVersion(segment.image_versions, segment.image_url, { instruction: segment.image_source_instruction, aspect_ratio: segment.image_source_aspect_ratio }), image_url: uploaded.file_url, image_source_instruction: segment.image_instruction, image_source_aspect_ratio: chapter.image_aspect_ratio || '16:9', comic_page_source: comicSignature, text_overlay_source_url: '', text_overlay_applied_signature: '', status: 'draft' }); setNotice('Comic page assembled and saved as the final segment image.'); } catch (error) { toast.error(error.message || 'Comic page assembly failed'); } finally { setBusy(''); } };
  const generateImage = async (force = false) => { if (!allowed()) return; if (!segment.image_instruction.trim()) return toast.error('Create the visual instruction first'); if (!locationReferences.length) return toast.error('The selected location needs a reference image'); const imageRatio = chapter.image_aspect_ratio || '16:9'; if (!force && segment.image_url && segment.image_source_instruction === segment.image_instruction && segment.image_source_aspect_ratio === imageRatio) return; setBusy(`${segment.id}-image`); try { const response = await base44.integrations.Core.GenerateImage({ prompt: `${masterLock}\n\n${locationLock}\n\nAUTHOR'S INSTRUCTION FOR THIS IMAGE — FOLLOW THIS FOR THE ACTION AND COMPOSITION:\n${segment.image_instruction}`, reference_image_urls: referenceUrls, aspect_ratio: imageRatio }); if (!response?.file_url) throw new Error('No image returned'); await onPersist({ image_versions: saveVersion(segment.image_versions, segment.image_url, { instruction: segment.image_source_instruction, aspect_ratio: segment.image_source_aspect_ratio }), image_url: response.file_url, image_source_instruction: segment.image_instruction, image_source_aspect_ratio: imageRatio, text_overlay_source_url: '', text_overlay_applied_signature: '', status: 'draft' }); setNotice(`Image generated in ${imageRatio} and saved for this segment.`); } catch (error) { toast.error(error.message || 'Image generation failed'); } finally { setBusy(''); } };
  const applyTextBoxes = async () => { if (!allowed()) return; if (!segment.image_url) return toast.error('Generate or assemble the image first'); if (!textBoxes.length) { if (!segment.text_overlay_source_url) return toast.info('There is no text box to remove'); await onPersist({ image_url: segment.text_overlay_source_url, text_overlay_source_url: '', text_overlay_applied_signature: '', status: 'draft' }); setNotice('All text boxes were removed from the final image.'); return; } setBusy(`${segment.id}-text-boxes`); try { const source = segment.text_overlay_source_url || segment.image_url; const file = await composeTextBoxes(source, textBoxes); const uploaded = await base44.integrations.Core.UploadFile({ file }); await onPersist({ image_url: uploaded.file_url, text_overlay_source_url: source, text_overlay_applied_signature: textBoxSignature(source, textBoxes), status: 'draft' }); setNotice('Text boxes were saved on the final image.'); } catch (error) { toast.error(error.message || 'Unable to save text on the image'); } finally { setBusy(''); } };
  const generateAudio = async (force = false) => { if (!allowed()) return; if (!voice) return toast.error('Choose this segment’s voice'); if (!segment.narration_text.trim()) return toast.error('Add narration first'); if (!force && segment.narration_url && segment.audio_source_text === segment.narration_text && segment.audio_voice === voice && (segment.audio_language || 'en') === (segment.narrator_language || project.production_settings?.narrator_language || 'en') && !segment.audio_stale) return; setBusy(`${segment.id}-audio`); try { const response = await base44.functions.invoke('generateSpeech', { text: segment.narration_text, voice, language_code: segment.narrator_language || project.production_settings?.narrator_language || 'en' }); if (!response.data?.file_url) throw new Error('No audio returned'); await onPersist({ audio_versions: saveVersion(segment.audio_versions, segment.narration_url, { voice: segment.audio_voice, text: segment.audio_source_text }), narration_url: response.data.file_url, audio_source_text: segment.narration_text, audio_voice: voice, audio_language: segment.narrator_language || project.production_settings?.narrator_language || 'en', audio_stale: false, status: 'draft' }); setNotice('Audio generated and saved for this segment.'); } catch (error) { toast.error(error.message || 'Audio generation failed'); } finally { setBusy(''); } };
  const baseImageReady = isComic
    ? Boolean(segment.image_url && segment.comic_page_source === comicSignature && segment.image_source_aspect_ratio === (chapter.image_aspect_ratio || '16:9'))
    : Boolean(segment.image_url && segment.image_source_instruction === segment.image_instruction && segment.image_source_aspect_ratio === (chapter.image_aspect_ratio || '16:9'));
  const pendingPanel = isComic ? comicPanels.findIndex((panel) => !panel.image_url || panel.source_prompt !== panel.prompt) : -1;
  const approvalIssue = !voice ? 'Choose this segment’s voice.'
    : pendingPanel >= 0 ? `Panel ${pendingPanel + 1} is missing or its image direction changed. Restore the direction used for that image or regenerate only this panel.`
    : !baseImageReady ? (isComic ? 'Assemble final page: the page is missing or its layout/images changed. No AI credit is needed.' : 'The image is missing or does not match the current direction and format.')
    : !overlayReady ? 'Save text on final image: the current text boxes have not been saved. No AI credit is needed.'
    : !segment.narration_url ? 'Generate this segment’s audio.'
    : segment.audio_stale || segment.audio_source_text !== segment.narration_text || segment.audio_voice !== voice ? 'The narration or voice changed. Restore the recorded version or regenerate only the audio.'
    : '';
  const ready = !approvalIssue;
  const generateAll = async () => { if (!segment.image_instruction.trim() || !segment.narration_text.trim() || !voice) return toast.error('Complete image direction, narration and voice'); if (isComic) { if (comicPanels.some((panel) => !panel.prompt.trim())) return toast.error('Plan every comic panel first'); if (comicPanels.some((panel) => !panel.image_url || panel.source_prompt !== panel.prompt)) return generateMissingPanels(); if (!baseImageReady) return assembleComic(); } else if (!baseImageReady) return generateImage(); if (!overlayReady) return toast.error('Save the text boxes on the final image first'); if (!segment.narration_url || segment.audio_source_text !== segment.narration_text || segment.audio_voice !== voice || segment.audio_stale) return generateAudio(); return toast.info('This segment is ready for approval'); };

  return <article className="rounded-2xl border border-white/10 bg-white/5 p-4 lg:p-6"><div className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400 font-black text-black">{segment.number}</span><div><h3 className="font-black">Segment {segment.number} · {isCurrent ? 'CURRENT' : 'APPROVED'}</h3><p className="text-xs text-white/45">Action → set/cast → image direction → voice/audio → approve</p></div></div>{notice && <div className="mb-4 flex justify-between rounded-xl bg-green-400/10 p-3 text-xs font-bold text-green-200"><span>{notice}</span><button onClick={() => setNotice('')}><X size={14} /></button></div>}
    <div className="space-y-6"><Section title="1 · Action and narration"><textarea value={segment.summary} onChange={(event) => onChange({ summary: event.target.value, status: 'draft' })} rows={3} className={input} placeholder="What happens and changes?" /><textarea value={segment.narration_text} onChange={(event) => onChange({ narration_text: event.target.value, audio_stale: Boolean(segment.narration_url), status: 'draft' })} rows={6} className={`${input} mt-3`} placeholder="Narration and dialogue" /><div className="mt-3 flex gap-2"><select value={narrationMode} onChange={(event) => setNarrationMode(event.target.value)} className={input}><option value="draft">Draft</option><option value="rewrite">Rewrite</option><option value="shorten">Shorten</option><option value="expand">Expand</option><option value="intensity">Increase intensity</option><option value="check">Check continuity</option></select><button onClick={assistNarration} disabled={!isCurrent || actionBusy} className={`${action} bg-yellow-400 text-black`}><Sparkles size={14} /> Assist · {pricing.ai_text ?? '—'}</button></div></Section>
      <Section title="2 · Select set and cast"><ChoiceGrid title="Set" icon={MapPin} items={project.locations} selected={segment.location_ids} onToggle={(id) => toggle('location_ids', id)} /><div className="mt-4"><ChoiceGrid title="Characters" icon={Users} items={project.characters} selected={segment.character_ids} onToggle={(id) => toggle('character_ids', id)} /></div><div className="mt-4 flex flex-wrap gap-2">{TIME_OPTIONS.map((time) => <button key={time} onClick={() => toggle('time_periods', time)} className={`rounded-xl px-3 py-2 text-xs font-black ${segment.time_periods.includes(time) ? 'bg-yellow-400 text-black' : 'bg-white/10'}`}><Clock3 size={12} className="mr-1 inline" />{time}</button>)}</div></Section>
      <Section title="3 · Direct the final image">
        <div className="mb-4 grid gap-3 sm:grid-cols-2"><label><span className="mb-1 block text-[11px] font-black uppercase text-white/50">Visual format for this segment</span><select value={segment.visual_format || 'single'} onChange={(event) => onChange({ visual_format: event.target.value, image_source_instruction: '', comic_page_source: '', status: 'draft' })} className={dark}><option className="text-black" value="single">Single image</option><option className="text-black" value="comic">Comic page</option></select></label>{isComic && <label><span className="mb-1 block text-[11px] font-black uppercase text-white/50">Panels in this segment</span><select value={panelCount} onChange={(event) => onChange({ comic_panel_count: Number(event.target.value), comic_page_source: '', status: 'draft' })} className={dark}>{[2, 3, 4].map((count) => <option className="text-black" key={count} value={count}>{count} panels</option>)}</select></label>}</div>
        <div className="grid gap-3 lg:grid-cols-3"><input value={segment.exact_area} onChange={(event) => onChange({ exact_area: event.target.value, status: 'draft' })} className={dark} placeholder="Exact set area" /><input value={segment.environment_direction} onChange={(event) => onChange({ environment_direction: event.target.value, status: 'draft' })} className={dark} placeholder="Light, weather, atmosphere" /><input value={segment.fixed_set_elements} onChange={(event) => onChange({ fixed_set_elements: event.target.value, status: 'draft' })} className={dark} placeholder="Fixed set elements" /></div>
        {locations.length > 0 && <div className="mt-4 grid gap-3 xl:grid-cols-2">{locations.map((location) => <ReferenceImagePicker key={location.id} title={`${location.name} · set references`} images={assetGallery(location, catalogGalleries)} selected={selectedReferences(location, 'location_reference_images')} onChange={(images) => onChange({ location_reference_images: { ...segment.location_reference_images, [location.id]: images }, image_source_instruction: '', comic_page_source: '', comic_panels: segment.comic_panels.map((panel) => ({ ...panel, source_prompt: '' })), status: 'draft' })} />)}</div>}
        {characters.length > 0 && <div className="mt-4 grid gap-3 xl:grid-cols-2">{characters.map((character) => <CharacterDirection key={character.id} character={character} inherited={chapter.appearance_continuity?.[character.id] || {}} value={segment.character_directions[character.id] || {}} referenceImages={characterGallery(character)} selectedReferences={selectedReferences(character, 'character_reference_images')} creatingReference={busy === `${segment.id}-reference-${character.id}`} referencePrice={pricing.compose_scene} onCreateReference={() => createCharacterReference(character)} onReferencesChange={(images) => onChange({ character_reference_images: { ...segment.character_reference_images, [character.id]: images }, image_source_instruction: '', comic_page_source: '', comic_panels: segment.comic_panels.map((panel) => ({ ...panel, source_prompt: '' })), status: 'draft' })} onChange={(value) => onChange({ character_directions: { ...segment.character_directions, [character.id]: value }, status: 'draft' })} />)}</div>}
        <div className="mt-4 grid gap-3 lg:grid-cols-3"><select value={segment.image_type} onChange={(event) => onChange({ image_type: event.target.value, status: 'draft' })} className={dark}>{IMAGE_TYPES.map((type) => <option className="text-black" key={type}>{type}</option>)}</select><input value={segment.camera_angle} onChange={(event) => onChange({ camera_angle: event.target.value, status: 'draft' })} className={dark} placeholder="Camera angle and composition" /><input value={segment.focus_direction} onChange={(event) => onChange({ focus_direction: event.target.value, status: 'draft' })} className={dark} placeholder="Focus and depth" /></div>
        <textarea value={segment.image_instruction} onChange={(event) => onChange({ image_instruction: event.target.value, comic_page_source: '', status: 'draft' })} rows={6} className={`${input} mt-4`} placeholder={isComic ? 'Shared visual direction for every panel in this segment' : 'Final editable image prompt'} />
        <button onClick={buildVisual} disabled={!isCurrent || actionBusy} className={`${action} mt-2 bg-yellow-400 text-black`}><Sparkles size={14} /> Build {isComic ? 'shared visual direction' : 'visual instruction'} · {pricing.ai_text ?? '—'}</button>
      </Section>
      <StoryImageAdjustment userEmail={userEmail} imageName={`${project.title || 'FotoPlay'} - Segment ${segment.number}`} segment={segment} ratio={chapter.image_aspect_ratio || '16:9'} panelRatio={panelRatio} price={pricing.compose_scene} busy={busy} setBusy={setBusy} onApply={applyImageAdjustment} referenceImages={uniqueImages([...referenceUrls, ...(chapter.segments || []).flatMap((item) => [item.text_overlay_source_url || item.image_url, ...(item.comic_panels || []).map((panel) => panel.image_url)])])} />
      {isComic && <section className="rounded-2xl border border-yellow-400/30 bg-yellow-400/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="text-sm font-black uppercase text-yellow-400">Comic page · {panelCount} panels</h4><p className="text-xs text-white/45">Landscape chapters place panels in one horizontal row. Portrait chapters stack them in one vertical column.</p></div><button onClick={planComicPanels} disabled={!isCurrent || actionBusy} className={`${action} bg-yellow-400 text-black`}><Sparkles size={14} /> Plan {panelCount} panels · {pricing.ai_text ?? '—'}</button></div>
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-yellow-400/25 bg-black/50 p-3">
          {chapter.master_reference_url ? <img src={chapter.master_reference_url} alt="Current sequence master" className="h-20 w-20 rounded-xl border-2 border-yellow-400 object-cover" /> : <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-white/25 bg-white/5"><ImageIcon className="text-white/25" /></div>}
          <div className="min-w-52 flex-1"><p className="text-xs font-black uppercase text-yellow-400">Sequence master · entire chapter</p><p className="mt-1 text-xs text-white/55">{chapter.master_reference_url ? `${chapter.master_reference_label || 'Selected image'} guides the following panels and segments.` : 'Choose a generated panel or an image from the Vault to lock visual continuity.'}</p></div>
          <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setShowMasterVault(true)} disabled={!isCurrent || actionBusy} className={`${action} bg-white text-black`}>Vault</button><button type="button" onClick={() => masterUploadRef.current?.click()} disabled={!isCurrent || actionBusy} className={`${action} bg-white/10 text-white`}><Upload size={14} /> Upload</button><input ref={masterUploadRef} type="file" accept="image/*" className="hidden" onChange={uploadSequenceMaster} /><button type="button" onClick={() => setShowMasterShop(true)} disabled={!isCurrent || actionBusy} className={`${action} bg-cyan-300 text-black`}><Store size={14} /> OLO Shop</button>{chapter.master_reference_url && <button type="button" onClick={clearSequenceMaster} disabled={!isCurrent || actionBusy} className={`${action} bg-red-500 text-white`}><Trash2 size={14} /> Clear</button>}</div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">{comicPanels.map((panel, index) => <div key={panel.id} className={`overflow-hidden rounded-2xl border bg-black ${chapter.master_reference_url === panel.image_url ? 'border-yellow-400' : 'border-white/10'}`}><div className="relative flex aspect-square items-center justify-center bg-white/5">{panel.image_url ? <><img src={panel.image_url} alt={`Panel ${index + 1}`} className="h-full w-full object-cover" />{chapter.master_reference_url === panel.image_url && <span className="absolute left-3 top-3 rounded-full bg-yellow-400 px-3 py-1 text-[10px] font-black text-black">SEQUENCE MASTER</span>}</> : <div className="text-center text-white/25"><ImageIcon className="mx-auto mb-2" /><p className="text-xs font-black">Panel {index + 1}</p></div>}</div><div className="space-y-2 p-3"><StoryImageFileActions url={panel.image_url} userEmail={userEmail} name={`${project.title || 'FotoPlay'} - Chapter ${chapter.number} - Segment ${segment.number} - Panel ${index + 1}`} ratio={panelRatio} />{panel.image_url && <button type="button" onClick={() => selectSequenceMaster(panel.image_url, 'panel', `Segment ${segment.number} · panel ${index + 1}`)} disabled={!isCurrent || actionBusy || chapter.master_reference_url === panel.image_url} className={`${action} w-full ${chapter.master_reference_url === panel.image_url ? 'bg-yellow-400/20 text-yellow-300' : 'bg-white/10 text-white'}`}>{chapter.master_reference_url === panel.image_url ? 'Current sequence master' : 'Use as sequence master'}</button>}<input value={panel.beat} onChange={(event) => updateComicPanel(index, { beat: event.target.value })} className={dark} placeholder={`Panel ${index + 1} story beat`} /><select value={panel.shot} onChange={(event) => updateComicPanel(index, { shot: event.target.value })} className={dark}>{IMAGE_TYPES.map((type) => <option className="text-black" key={type}>{type}</option>)}</select><PanelLeafEditor panel={panel} path={[index]} ratio={panelRatio} disabled={!isCurrent || actionBusy} onUpdate={(nextPanel) => updateComicPanel(index, nextPanel)} renderLeaf={(leaf, leafPath) => {
                const applyLeaf = (values) => { const nextValue = leafPath.length === 1 ? { ...panel, ...values } : writeLeaf(panel, leafPath.slice(1), values); updateComicPanel(index, nextValue); };
                const leafBusyKey = `${segment.id}-panel-${index}-${leafPath.join('-')}`;
                return <div className="space-y-2 rounded-xl border border-fuchsia-500/25 bg-black/40 p-2">
                  <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-white/5">{leaf.image_url ? <img src={leaf.image_url} alt="Leaf panel" className="h-full w-full object-cover" /> : <ImageIcon className="text-white/25" />}</div>
                  <textarea value={leaf.prompt || ''} onChange={(event) => applyLeaf({ prompt: event.target.value })} rows={4} className={dark} placeholder="Specific look, action and composition for this panel" />
                  <div className="flex gap-2">
                    <button type="button" onClick={async () => { if (!leaf.prompt?.trim()) return toast.error('Write a prompt for this part first'); if (!locationReferences.length) return toast.error('The selected location needs a reference image'); setBusy(leafBusyKey); try { const response = await base44.integrations.Core.GenerateImage({ prompt: framePrompt({ ...panel, prompt: leaf.prompt, shot: panel.shot }, index), reference_image_urls: referenceUrls, aspect_ratio: panelRatio }); if (!response?.file_url) throw new Error('No image returned'); applyLeaf({ image_url: response.file_url, source_prompt: leaf.prompt }); } catch (error) { toast.error(error.message || 'Generation failed'); } finally { setBusy(''); } }} disabled={!isCurrent || busy === leafBusyKey || !leaf.prompt?.trim()} className={`${action} flex-1 bg-yellow-400 text-black`}>{busy === leafBusyKey ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />} Generate</button>
                    <label className={`${action} flex-1 cursor-pointer bg-white/10 text-white`}>{busy === `${leafBusyKey}-upload` ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload<input type="file" accept="image/*" className="hidden" disabled={!isCurrent} onChange={async (event) => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; setBusy(`${leafBusyKey}-upload`); try { const uploaded = await base44.integrations.Core.UploadFile({ file }); if (!uploaded?.file_url) throw new Error('Upload failed'); applyLeaf({ image_url: uploaded.file_url, source_prompt: leaf.prompt }); } catch (error) { toast.error(error.message || 'Upload failed'); } finally { setBusy(''); } }} /></label>
                  </div>
                </div>;
              }} /><button onClick={() => generateComicPanel(index)} disabled={!isCurrent || actionBusy} className={`${action} w-full bg-yellow-400 text-black`}>{busy === `${segment.id}-panel-${index}` ? <Loader2 size={14} className="animate-spin" /> : panel.image_url ? <RotateCcw size={14} /> : <ImageIcon size={14} />} {panel.image_url ? 'Regenerate panel' : 'Generate panel'} · {pricing.compose_scene ?? '—'}</button><label className={`${action} w-full cursor-pointer bg-white/10 text-white`}>{busy === `${segment.id}-panel-upload-${index}` ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload panel image · no AI credit<input type="file" accept="image/*" className="hidden" disabled={!isCurrent || actionBusy} onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadComicPanelImage(index, file); event.target.value = ''; }} /></label></div></div>)}</div>
        <div className="mt-4 flex flex-wrap items-center gap-3"><button onClick={generateMissingPanels} disabled={!isCurrent || actionBusy} className={`${action} bg-yellow-400 text-black`}>{busy === `${segment.id}-comic-all` ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />} Generate missing panels · up to {panelCount * Number(pricing.compose_scene || 0) || '—'} credits</button><button onClick={assembleComic} disabled={!isCurrent || actionBusy} className={`${action} bg-yellow-400 text-black`}>{busy === `${segment.id}-comic-assemble` ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {baseImageReady ? 'Reassemble final page' : 'Assemble final page'} · no AI credit</button><span className="text-xs text-white/45">Final ratio: {chapter.image_aspect_ratio || '16:9'} · automatic {Number((chapter.image_aspect_ratio || '16:9').split(':')[0]) > Number((chapter.image_aspect_ratio || '16:9').split(':')[1]) ? 'horizontal row' : 'vertical column'}</span></div>
      </section>}
      <div className="grid gap-4 xl:grid-cols-2"><section className="overflow-hidden rounded-2xl bg-black">{segment.image_url || !isComic ? <ImageTextBoxEditor imageUrl={textSource} ratio={chapter.image_aspect_ratio || '16:9'} boxes={textBoxes} defaultNarration={segment.narration_text} disabled={!isCurrent || actionBusy} onChange={(nextBoxes) => onChange({ text_boxes: nextBoxes, text_overlay_applied_signature: '', status: 'draft' })} /> : <div className="flex min-h-64 items-center justify-center bg-white/5"><ImageIcon className="text-white/25" /></div>}<div className="flex flex-wrap gap-2 p-3"><StoryImageFileActions url={segment.image_url} userEmail={userEmail} name={`${project.title || 'FotoPlay'} - Chapter ${chapter.number} - Segment ${segment.number}`} ratio={chapter.image_aspect_ratio || '16:9'} />{isComic ? <button onClick={assembleComic} disabled={!isCurrent || actionBusy} className={`${action} bg-yellow-400 text-black`}>{busy === `${segment.id}-comic-assemble` ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />} {baseImageReady ? 'Reassemble final page' : (segment.image_url ? 'Reassemble comic page' : 'Assemble comic page')} · no AI credit</button> : <button onClick={() => generateImage(Boolean(segment.image_url))} disabled={!isCurrent || actionBusy} className={`${action} bg-yellow-400 text-black`}>{busy === `${segment.id}-image` ? <Loader2 size={14} className="animate-spin" /> : segment.image_url ? <RotateCcw size={14} /> : <ImageIcon size={14} />} {segment.image_url ? 'Regenerate' : 'Generate'} image · {chapter.image_aspect_ratio || '16:9'} · {pricing.compose_scene ?? '—'}</button>}
{isComic && <button onClick={assembleComic} disabled={!isCurrent || actionBusy} className={`${action} bg-yellow-400 text-black`}>{busy === `${segment.id}-comic-assemble` ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Force rebuild from current panels · no AI credit</button>}{segment.image_url && <button onClick={applyTextBoxes} disabled={!isCurrent || actionBusy || overlayReady} className={`${action} bg-white text-black`}>{busy === `${segment.id}-text-boxes` ? <Loader2 size={14} className="animate-spin" /> : <Type size={14} />} {textBoxes.length ? 'Save text on final image' : 'Remove text from final image'} · no AI credit</button>}<p className="w-full text-[11px] text-white/40">{isComic ? `${panelCount}-panel comic page` : 'Single image'} · Nano Banana 2 · chapter image ratio {chapter.image_aspect_ratio || '16:9'} · existing references preserved · {segment.image_versions.length} previous versions{textBoxes.length ? ` · ${textBoxes.length} text box${textBoxes.length === 1 ? '' : 'es'}${overlayReady ? ' saved' : ' not yet saved'}` : ''}</p></div></section>
        <section className="rounded-2xl bg-black p-4"><div className="mb-3 flex items-center gap-2 text-yellow-400"><Mic2 size={16} /><h4 className="text-xs font-black uppercase">4 · Voice for this segment</h4></div><VoicePicker value={voice} onChange={(value) => onChange({ narrator_voice: value, audio_stale: Boolean(segment.narration_url), status: 'draft' })} language={segment.narrator_language || project.production_settings?.narrator_language || 'en'} onLanguageChange={(value) => onChange({ narrator_language: value, audio_stale: Boolean(segment.narration_url), status: 'draft' })} disabled={!isCurrent || actionBusy} />{segment.narration_url ? <audio controls src={segment.narration_url} className="mt-4 w-full" /> : <div className="mt-4 flex h-20 items-center justify-center rounded-xl bg-white/5 text-xs text-white/35">Audio for this segment only</div>}{segment.audio_stale && <p className="mt-2 text-xs font-bold text-orange-300">Text or voice changed; regenerate this segment’s audio.</p>}<button onClick={() => generateAudio(Boolean(segment.narration_url))} disabled={!isCurrent || actionBusy} className={`${action} mt-3 bg-yellow-400 text-black`}><Volume2 size={14} /> {segment.narration_url ? 'Regenerate' : 'Generate'} audio · {pricing.tts ?? '—'}</button></section></div>
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/5 p-4"><div><p className="font-black">5 · Preview and approve</p><p className="text-xs text-white/45">{ready ? 'Image and audio match the current direction.' : approvalIssue}</p></div><div className="flex gap-2">{segment.status === 'approved' ? <button onClick={() => onChange({ status: 'draft' })} className={`${action} bg-white/10`}>Unlock</button> : <><button onClick={generateAll} disabled={!isCurrent || actionBusy} className={`${action} bg-yellow-400 text-black`}><Play size={14} /> Generate current segment</button><button onClick={() => ready ? onApprove(segment) : toast.error(approvalIssue)} disabled={!isCurrent || actionBusy} className={`${action} bg-green-400 text-black`}><Check size={14} /> Approve segment {segment.number}</button></>}</div></section>
    </div>{showMasterVault && <VaultPickerModal userEmail={userEmail} allowUpload onSelect={(url) => selectSequenceMaster(url, 'vault', 'Vault image')} onClose={() => setShowMasterVault(false)} />}{showMasterShop && <OloShopImagePicker onSelect={(url, label) => selectSequenceMaster(url, 'olo_shop', label)} onClose={() => setShowMasterShop(false)} />}</article>;
}

function OloShopImagePicker({ onSelect, onClose }) {
  const [assets, setAssets] = useState([]); const [loading, setLoading] = useState(true); const [search, setSearch] = useState('');
  useEffect(() => {
    supabase.from('catalog_asset').select('id,title,featured_image,preview_images,creator_name').eq('status', 'published').order('title', { ascending: true }).limit(500)
      .then(({ data, error }) => { if (error) throw error; setAssets(data || []); })
      .catch((error) => toast.error(error.message || 'Unable to load OLO Shop'))
      .finally(() => setLoading(false));
  }, []);
  const choices = useMemo(() => assets.flatMap((asset) => uniqueImages([asset.featured_image, ...(Array.isArray(asset.preview_images) ? asset.preview_images : [])]).map((url, index) => ({ id: `${asset.id}-${index}`, url, label: asset.title || 'OLO Shop image', creator: asset.creator_name || '' }))).filter((item) => `${item.label} ${item.creator}`.toLowerCase().includes(search.trim().toLowerCase())), [assets, search]);
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-cyan-300/30 bg-zinc-950 text-white shadow-2xl"><div className="flex items-center gap-3 border-b border-white/10 p-4"><Store className="text-cyan-300" size={20} /><div className="flex-1"><p className="font-black">Select from OLO Shop</p><p className="text-xs text-white/45">Choose any published shop image as the chapter sequence master.</p></div><button type="button" onClick={onClose} className="rounded-xl bg-white/10 p-2"><X size={18} /></button></div><div className="border-b border-white/10 p-4"><label className="flex items-center gap-2 rounded-xl bg-white px-3 text-black"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search OLO Shop" className="w-full py-3 text-sm font-semibold outline-none" /></label></div><div className="overflow-y-auto p-4">{loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-cyan-300" /></div> : choices.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{choices.map((item) => <button type="button" key={item.id} onClick={() => onSelect(item.url, `OLO Shop · ${item.label}`)} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-left hover:border-cyan-300"><img src={item.url} alt={item.label} className="aspect-square w-full object-cover" /><div className="p-2"><p className="truncate text-xs font-black">{item.label}</p>{item.creator && <p className="truncate text-[10px] text-white/40">{item.creator}</p>}</div></button>)}</div> : <p className="py-20 text-center text-sm font-semibold text-white/45">No OLO Shop image matches this search.</p>}</div></div></div>;
}

function Section({ title, children }) { return <section><h4 className="mb-3 text-xs font-black uppercase text-yellow-400">{title}</h4>{children}</section>; }
function CharacterDirection({ character, inherited, value, referenceImages, selectedReferences, creatingReference, referencePrice, onCreateReference, onReferencesChange, onChange }) {
  const merged = { ...inherited, ...value };
  const set = (field, next) => onChange({ ...value, [field]: next });
  return <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
    <div className="mb-3 flex items-center gap-3">{character.active_look_reference_url || character.image_url ? <img src={character.active_look_reference_url || character.image_url} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <UserRound />}<div><p className="text-sm font-black">{character.name}</p><p className="text-[11px] text-white/40">Active reference preserved through the series</p></div></div>
    <ReferenceImagePicker title="Reference images for this segment" images={referenceImages} selected={selectedReferences} onChange={onReferencesChange} compact />
    <div className="mt-3 grid gap-2 sm:grid-cols-2"><input value={merged.look || ''} onChange={(event) => set('look', event.target.value)} className={dark} placeholder="Appearance" /><input value={merged.costume || ''} onChange={(event) => set('costume', event.target.value)} className={dark} placeholder="Clothes or costume" /><input value={merged.injuries || ''} onChange={(event) => set('injuries', event.target.value)} className={dark} placeholder="Injuries, blood, dirt, damage" /><input value={merged.hair_makeup_accessories || ''} onChange={(event) => set('hair_makeup_accessories', event.target.value)} className={dark} placeholder="Hair, makeup, accessories" /><input value={merged.physical_state || ''} onChange={(event) => set('physical_state', event.target.value)} className={dark} placeholder="Physical/emotional state" /><input value={value.position || ''} onChange={(event) => set('position', event.target.value)} className={dark} placeholder="Position" /><input value={value.action || ''} onChange={(event) => set('action', event.target.value)} className={dark} placeholder="Action" /><input value={value.expression || ''} onChange={(event) => set('expression', event.target.value)} className={dark} placeholder="Expression" /><input value={value.gaze || ''} onChange={(event) => set('gaze', event.target.value)} className={dark} placeholder="Gaze" /><select value={value.continuity_scope || 'segment'} onChange={(event) => set('continuity_scope', event.target.value)} className={dark}><option className="text-black" value="segment">This segment only</option><option className="text-black" value="carry">Carry appearance forward</option></select></div>
    <button type="button" onClick={onCreateReference} disabled={creatingReference} className={`${action} mt-3 w-full bg-yellow-400 text-black`}>{creatingReference ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Create and use new look reference · {referencePrice ?? '—'}</button>
    <p className="mt-2 text-[10px] text-white/40">Creates a new image from the selected identity references and look settings, adds it to this character's gallery, and keeps it active for the following chapters.</p>
  </div>;
}
function ReferenceImagePicker({ title, images, selected, onChange, compact = false }) { const toggle = (url) => { if (selected.includes(url)) { if (selected.length === 1) return toast.error('Keep at least one reference image'); onChange(selected.filter((item) => item !== url)); return; } if (selected.length >= 3) return toast.error('Select up to 3 reference images'); onChange([...selected, url]); }; return <div className={`rounded-xl border border-yellow-400/20 bg-black/30 ${compact ? 'p-2' : 'p-3'}`}><div className="mb-2 flex items-center justify-between gap-2"><p className="text-[11px] font-black uppercase text-yellow-400">{title}</p><span className="text-[10px] font-bold text-white/40">{selected.length}/3 selected</span></div>{images.length ? <div className="grid grid-cols-3 gap-2">{images.map((url, index) => <button key={url} type="button" onClick={() => toggle(url)} className={`relative aspect-square overflow-hidden rounded-lg border-2 ${selected.includes(url) ? 'border-yellow-400' : 'border-transparent opacity-65'}`}><img src={url} alt={`${title} ${index + 1}`} className="h-full w-full object-cover" />{selected.includes(url) && <span className="absolute right-1 top-1 rounded-full bg-yellow-400 p-1 text-black"><Check size={10} /></span>}</button>)}</div> : <p className="text-xs font-semibold text-white/40">No reference image available. Add images in the project foundation.</p>}<p className="mt-2 text-[10px] text-white/40">Selected images are sent directly to the image generator.</p></div>; }
function ChoiceGrid({ title, icon: Icon, items, selected, onToggle }) { return <div><div className="mb-2 flex items-center gap-2 text-yellow-400"><Icon size={14} /><p className="text-xs font-black uppercase">{title}</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{items.map((item) => <button key={item.id} onClick={() => onToggle(item.id)} className={`flex items-center gap-2 rounded-xl border p-2 text-left ${selected.includes(item.id) ? 'border-yellow-400 bg-yellow-400/15' : 'border-white/10 bg-white/5'}`}><div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-yellow-400 text-black">{item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-cover" /> : <Icon size={15} />}</div><span className="flex-1 truncate text-xs font-black">{item.name}</span>{selected.includes(item.id) && <Check size={13} className="text-yellow-400" />}</button>)}</div></div>; }
