import React, { useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { toast } from 'sonner';
import {
  ArrowLeft, Check, Clock3, Eye, Image as ImageIcon, Loader2, MapPin,
  MessageSquareText, Mic2, PanelLeft, Play, Save, Sparkles, Store, Type, Upload,
  UserRound, Users, Volume2, Wand2, X, FolderOpen, Settings2,
  Film, Trash2, RotateCcw,
} from 'lucide-react';
import VoicePicker from './VoicePicker';
import VaultPickerModal from './VaultPickerModal';
import StoryImageAdjustment from './StoryImageAdjustment';
import StoryImageFileActions from './StoryImageFileActions';
import { IMAGE_RATIOS, IMAGE_TYPES, TIME_OPTIONS, normalizeSegment, selectedItems } from './authorStoryModel';
import { adjustmentFingerprint, adjustmentRecord } from './storyImageAdjustment';
import { DIALOGUE_ARROW_PRESETS, DEFAULT_DIALOGUE_ARROW_PRESET, FixedDialogueArrow, defaultDialogueArrowForLegacySide, drawFixedDialogueArrow } from './fixedDialogueArrows';

const dark = 'w-full border border-white/15 bg-[#20242a] px-3 py-2.5 text-sm font-semibold text-white placeholder:text-white/35 focus:border-[#23c7be] focus:outline-none';
const action = 'inline-flex items-center justify-center gap-2 border border-white/10 px-3 py-2.5 text-xs font-black disabled:cursor-not-allowed disabled:opacity-35';
const uniqueImages = (values) => [...new Set(values.filter((value) => typeof value === 'string' && value.trim()))];
const assetGallery = (item, catalogGalleries) => uniqueImages([item?.active_look_reference_url, item?.image_url, ...(Array.isArray(item?.look_reference_images) ? item.look_reference_images : []), ...(Array.isArray(item?.reference_images) ? item.reference_images : []), ...(catalogGalleries[item?.image_source_id] || [])]);
const DIALOGUE_ARROW_PRESET_IDS = new Set(DIALOGUE_ARROW_PRESETS.map((preset) => preset.id));
const normalizePointerPath = (points) => (Array.isArray(points) ? points : []).map((point) => ({ x: Number(point?.x), y: Number(point?.y) })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)).map((point) => ({ x: Math.max(0, Math.min(100, point.x)), y: Math.max(0, Math.min(100, point.y)) }));
const normalizedTextBoxes = (boxes) => (Array.isArray(boxes) ? boxes : []).map((box) => ({
  ...box,
  id: box.id || crypto.randomUUID(), type: box.type === 'dialogue' ? 'dialogue' : 'narration', text: box.text || '',
  x: Number.isFinite(Number(box.x)) ? Number(box.x) : 8, y: Number.isFinite(Number(box.y)) ? Number(box.y) : 8,
  width: Number.isFinite(Number(box.width)) ? Number(box.width) : 42, height: Number.isFinite(Number(box.height)) ? Number(box.height) : 16,
  font_size: Number.isFinite(Number(box.font_size)) ? Number(box.font_size) : 26,
  arrow_preset: Array.isArray(box.pointer_path) ? (DIALOGUE_ARROW_PRESET_IDS.has(box.arrow_preset) ? box.arrow_preset : null) : (DIALOGUE_ARROW_PRESET_IDS.has(box.arrow_preset) ? box.arrow_preset : defaultDialogueArrowForLegacySide(box.tail_side)),
  arrow_position: Number.isFinite(Number(box.arrow_position)) ? Math.max(10, Math.min(90, Number(box.arrow_position))) : (Number.isFinite(Number(box.tail_position)) ? Math.max(10, Math.min(90, Number(box.tail_position))) : 50),
  pointer_path: normalizePointerPath(box.pointer_path),
}));

function pointerControlPoints(box, points) {
  const clean = normalizePointerPath(points);
  if (box?.pointer_shape === 'triangle' && clean.length >= 3) return [clean[0], clean[1], clean[2]];
  const x = Number(box?.x) || 0; const y = Number(box?.y) || 0;
  const w = Math.max(1, Number(box?.width) || 1); const h = Math.max(1, Number(box?.height) || 1);
  const baseY = Math.max(0, Math.min(100, y + h));
  const centerX = Math.max(0, Math.min(100, x + w * 0.5));
  const halfBase = Math.max(1.8, Math.min(5, w * 0.12));
  const left = { x: Math.max(0, Math.min(100, centerX - halfBase)), y: baseY };
  const right = { x: Math.max(0, Math.min(100, centerX + halfBase)), y: baseY };
  const legacyTip = clean.length ? clean[clean.length - 1] : null;
  const tip = legacyTip || { x: Math.max(0, Math.min(100, centerX + Math.min(10, w * 0.25))), y: Math.max(0, Math.min(100, baseY + 18)) };
  return [left, right, tip];
}

function DialoguePointerPath({ points, box }) {
  const triangle = pointerControlPoints(box, points);
  return <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <polygon points={`${triangle[0].x},${triangle[0].y} ${triangle[1].x},${triangle[1].y} ${triangle[2].x},${triangle[2].y}`} fill="#fff" stroke="#111" strokeWidth="0.45" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
  </svg>;
}

function drawDialoguePointerCanvas(ctx, box, points, canvasWidth, canvasHeight) {
  const triangle = pointerControlPoints(box, points);
  const px = (point) => ({ x: point.x * canvasWidth / 100, y: point.y * canvasHeight / 100 });
  const [a, b, c] = triangle.map(px);
  ctx.save();
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath();
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.strokeStyle = '#111'; ctx.lineWidth = Math.max(2, canvasWidth * 0.0015); ctx.lineJoin = 'round'; ctx.stroke();
  ctx.restore();
}

function comicPageSignature(chapter, panels) {
  return JSON.stringify({ ratio: chapter.image_aspect_ratio || '16:9', panels: panels.map((panel) => panel.image_url || '') });
}

function flattenLeaves(panel) {
  if (!panel?.split) return [panel];
  return [...flattenLeaves(panel.split.a), ...flattenLeaves(panel.split.b)];
}

async function drawCoverImage(ctx, source, slot, posX = 50, posY = 50, zoom = 100) {
  const response = await fetch(source);
  if (!response.ok) throw new Error('Unable to load a panel image');
  const bitmap = await createImageBitmap(await response.blob());
  const scale = Math.max(slot.w / bitmap.width, slot.h / bitmap.height) * Math.max(0.5, Number(zoom) / 100);
  const dw = bitmap.width * scale; const dh = bitmap.height * scale;
  const x = slot.x + (slot.w - dw) * (Number(posX) / 100) + ((Number(posX) - 50) / 500) * dw;
  const y = slot.y + (slot.h - dh) * (Number(posY) / 100);
  ctx.drawImage(bitmap, x, y, dw, dh); bitmap.close();
}

async function drawPanelTree(ctx, panel, slot, gutter) {
  if (!panel?.split) {
    if (!panel?.image_url) return;
    ctx.save(); ctx.beginPath(); ctx.rect(slot.x, slot.y, slot.w, slot.h); ctx.clip();
    await drawCoverImage(ctx, panel.image_url, slot, panel.position_x ?? 50, panel.position_y ?? 50, panel.zoom ?? 100);
    ctx.restore();
    return;
  }
  const r = Math.max(0.08, Math.min(0.92, Number(panel.split.ratio) || 0.5));
  if (panel.split.direction === 'vertical') {
    const half = gutter / 2;
    await drawPanelTree(ctx, panel.split.a, { x: slot.x, y: slot.y, w: slot.w * r - half, h: slot.h }, gutter);
    await drawPanelTree(ctx, panel.split.b, { x: slot.x + slot.w * r + half, y: slot.y, w: slot.w * (1 - r) - half, h: slot.h }, gutter);
  } else {
    const half = gutter / 2;
    await drawPanelTree(ctx, panel.split.a, { x: slot.x, y: slot.y, w: slot.w, h: slot.h * r - half }, gutter);
    await drawPanelTree(ctx, panel.split.b, { x: slot.x, y: slot.y + slot.h * r + half, w: slot.w, h: slot.h * (1 - r) - half }, gutter);
  }
}

async function assembleComicPage(panels, ratio) {
  const [rw, rh] = String(ratio || '16:9').split(':').map(Number);
  const landscape = rw >= rh;
  const width = landscape ? 1800 : Math.round(1800 * rw / rh);
  const height = landscape ? Math.round(1800 * rh / rw) : 1800;
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#080a0c'; ctx.fillRect(0, 0, width, height);
  const gutter = 14;
  if (landscape) {
    const cell = (width - gutter * (panels.length + 1)) / panels.length;
    for (let i = 0; i < panels.length; i += 1) await drawPanelTree(ctx, panels[i], { x: gutter + i * (cell + gutter), y: gutter, w: cell, h: height - gutter * 2 }, gutter);
  } else {
    const cell = (height - gutter * (panels.length + 1)) / panels.length;
    for (let i = 0; i < panels.length; i += 1) await drawPanelTree(ctx, panels[i], { x: gutter, y: gutter + i * (cell + gutter), w: width - gutter * 2, h: cell }, gutter);
  }
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(new File([blob], `fotoplay-page-${crypto.randomUUID()}.png`, { type: 'image/png' })) : reject(new Error('Unable to assemble page')), 'image/png', 0.95));
}

function wrapLines(ctx, text, maxWidth) {
  const paragraphs = String(text || '').split(/\n/); const lines = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean); let line = '';
    if (!words.length) { lines.push(''); continue; }
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxWidth) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
  }
  return lines;
}

async function addTextBoxesToFile(file, boxes) {
  if (!boxes.length) return file;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0); bitmap.close();
  for (const box of normalizedTextBoxes(boxes)) {
    const x = canvas.width * box.x / 100; const y = canvas.height * box.y / 100;
    const w = canvas.width * box.width / 100; const h = canvas.height * box.height / 100;
    if (box.type === 'dialogue') {
      drawDialoguePointerCanvas(ctx, box, box.pointer_path, canvas.width, canvas.height);
    }
    ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = '#111'; ctx.lineWidth = Math.max(2, canvas.width * 0.002); ctx.strokeRect(x, y, w, h);
    const size = Math.max(14, canvas.width * box.font_size / 1400); ctx.font = `600 ${size}px Arial, sans-serif`; ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const lines = wrapLines(ctx, box.text || (box.type === 'dialogue' ? 'Dialogue' : 'Narration'), w * 0.94);
    const lineHeight = size * 1.08; const visible = lines.slice(0, Math.max(1, Math.floor(h / lineHeight)));
    const start = y + Math.max(4, (h - visible.length * lineHeight) / 2);
    visible.forEach((line, index) => ctx.fillText(line, x + w / 2, start + index * lineHeight));
  }
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(new File([blob], `fotoplay-final-${crypto.randomUUID()}.png`, { type: 'image/png' })) : reject(new Error('Unable to render page text')), 'image/png', 0.95));
}

function PanelTreePreview({ panel }) {
  if (!panel?.split) return panel?.image_url ? <img src={panel.image_url} alt="" className="h-full w-full object-cover" style={{ objectPosition: `${panel.position_x ?? 50}% ${panel.position_y ?? 50}%`, transform: `translateX(${(Number(panel.position_x ?? 50) - 50) / 5}%) scale(${Math.max(0.5, Number(panel.zoom ?? 100) / 100)})`, transformOrigin: `${panel.position_x ?? 50}% ${panel.position_y ?? 50}%` }} /> : <div className="flex h-full w-full items-center justify-center text-white/25"><ImageIcon size={28} /></div>;
  const vertical = panel.split.direction === 'vertical'; const r = Math.max(8, Math.min(92, Number(panel.split.ratio || 0.5) * 100));
  return <div className={`flex h-full w-full ${vertical ? 'flex-row' : 'flex-col'}`}>
    <div className="min-h-0 min-w-0 overflow-hidden" style={vertical ? { width: `${r}%` } : { height: `${r}%` }}><PanelTreePreview panel={panel.split.a} /></div>
    <div className="min-h-0 min-w-0 flex-1 overflow-hidden border-l border-t border-black"><PanelTreePreview panel={panel.split.b} /></div>
  </div>;
}

function PageCanvas({ panels, ratio, selectedPanel, onSelectPanel, boxes, textMode, onBoxesChange }) {
  const ref = useRef(null); const drag = useRef(null);
  const [selectedBox, setSelectedBox] = useState('');
  const [width, setWidth] = useState(900);
  const pointerPointsRef = useRef([]); const pointerDragRef = useRef(null); const [drawingBoxId, setDrawingBoxId] = useState(''); const [pointerDraft, setPointerDraft] = useState([]);
  const [rw, rh] = String(ratio || '16:9').split(':').map(Number); const landscape = rw >= rh;
  const items = normalizedTextBoxes(boxes);
  const editingBox = items.find((box) => box.id === drawingBoxId);
  useEffect(() => { if (!ref.current) return undefined; const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width || 900)); observer.observe(ref.current); return () => observer.disconnect(); }, []);
  useEffect(() => {
    const move = (event) => {
      const state = drag.current; const frame = ref.current; if (!state || !frame || drawingBoxId) return;
      const rect = frame.getBoundingClientRect(); const dx = (event.clientX - state.x) / rect.width * 100; const dy = (event.clientY - state.y) / rect.height * 100;
      const next = state.mode === 'move'
        ? { ...state.box, x: Math.max(0, Math.min(100 - state.box.width, state.box.x + dx)), y: Math.max(0, Math.min(100 - state.box.height, state.box.y + dy)) }
        : { ...state.box, width: Math.max(18, Math.min(100 - state.box.x, state.box.width + dx)), height: Math.max(8, Math.min(100 - state.box.y, state.box.height + dy)) };
      onBoxesChange(items.map((box) => box.id === state.id ? next : box));
    };
    const stop = () => { drag.current = null; };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop); window.addEventListener('pointercancel', stop);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); };
  }, [items, onBoxesChange, drawingBoxId]);
  const begin = (event, box, mode) => { if (!textMode || drawingBoxId) return; event.preventDefault(); event.stopPropagation(); setSelectedBox(box.id); drag.current = { id: box.id, box: { ...box }, x: event.clientX, y: event.clientY, mode }; };
  const pointFromEvent = (event) => { const rect = ref.current?.getBoundingClientRect(); if (!rect) return null; return { x: Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)), y: Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100)) }; };
  const startPointerHandle = (event, index) => { if (!drawingBoxId) return; event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture?.(event.pointerId); pointerDragRef.current = { index, pointerId: event.pointerId }; };
  const movePointerHandle = (event) => { const dragState = pointerDragRef.current; if (!drawingBoxId || !dragState) return; event.preventDefault(); const point = pointFromEvent(event); if (!point) return; const next = [...pointerPointsRef.current]; next[dragState.index] = point; pointerPointsRef.current = next; setPointerDraft(next); onBoxesChange(items.map((box) => box.id === drawingBoxId ? { ...box, pointer_path: next, pointer_shape: 'triangle', arrow_preset: null, arrow_position: 50 } : box)); };
  const finishPointerHandle = (event) => { if (!pointerDragRef.current) return; movePointerHandle(event); pointerDragRef.current = null; };
  const pageWidth = `min(100%, calc((100vh - 330px) * ${(rw || 16) / (rh || 9)}))`;
  return <div ref={ref} className="relative mx-auto overflow-hidden border border-white/15 bg-[#090b0d] shadow-[0_30px_80px_rgba(0,0,0,.45)]" style={{ aspectRatio: `${rw || 16} / ${rh || 9}`, width: pageWidth, maxHeight: 'calc(100vh - 330px)' }} onPointerDown={() => textMode && !drawingBoxId && setSelectedBox('')}>
    <div className="absolute inset-0 grid gap-[6px] p-[6px]" style={landscape ? { gridTemplateColumns: `repeat(${panels.length},minmax(0,1fr))` } : { gridTemplateRows: `repeat(${panels.length},minmax(0,1fr))` }}>
      {panels.map((panel, index) => <button type="button" key={panel.id || index} onClick={(event) => { if (drawingBoxId) return; event.stopPropagation(); onSelectPanel(index); }} className={`relative min-h-0 min-w-0 overflow-hidden bg-black text-left transition ${selectedPanel === index ? 'ring-4 ring-[#23c7be] ring-inset' : 'ring-1 ring-white/10 ring-inset'}`}><PanelTreePreview panel={panel} /><span className={`absolute left-2 top-2 px-2 py-1 text-[10px] font-black ${selectedPanel === index ? 'bg-[#23c7be] text-black' : 'bg-black/70 text-white'}`}>FRAME {index + 1}</span></button>)}
    </div>
    <div className="pointer-events-none absolute inset-0 z-10">{items.map((box) => box.type === 'dialogue' && box.id !== drawingBoxId ? <DialoguePointerPath key={`pointer-${box.id}`} points={box.pointer_path} box={box} frameWidth={width} /> : null)}</div>
    {items.map((box) => <div key={box.id} onPointerDown={(event) => { event.stopPropagation(); if (drawingBoxId) return; if (textMode) setSelectedBox(box.id); }} className={`absolute z-20 bg-white text-black shadow-lg ${textMode && selectedBox === box.id ? 'ring-3 ring-[#23c7be]' : 'ring-1 ring-black/70'}`} style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.width}%`, height: `${box.height}%`, fontSize: `${width * box.font_size / 1400}px` }}>
      {box.type === 'dialogue' && box.pointer_path?.length < 2 && box.arrow_preset && <FixedDialogueArrow presetId={box.arrow_preset} position={box.arrow_position} frameWidth={width} />}
      <div className="relative z-10 flex h-full items-center justify-center overflow-hidden px-1 text-center font-semibold leading-[1.06] whitespace-pre-wrap">{box.text || (box.type === 'dialogue' ? 'Dialogue' : 'Narration')}</div>
      {textMode && selectedBox === box.id && !drawingBoxId && <><button type="button" onPointerDown={(event) => begin(event, box, 'move')} className="absolute -top-7 left-0 z-30 bg-[#23c7be] px-2 py-1 text-[9px] font-black text-black">MOVE</button>{box.type === 'dialogue' && <><button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); const points = pointerControlPoints(box, box.pointer_path); pointerPointsRef.current = points; setPointerDraft(points); setDrawingBoxId(box.id); onBoxesChange(items.map((item) => item.id === box.id ? { ...item, pointer_path: points, pointer_shape: 'triangle', arrow_preset: null, arrow_position: 50 } : item)); }} className="absolute -bottom-7 left-0 z-30 bg-white px-2 py-1 text-[9px] font-black text-black">EDIT TRIANGLE</button><button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onBoxesChange(items.map((item) => item.id === box.id ? { ...item, pointer_path: [], arrow_preset: null, arrow_position: 50 } : item)); }} className="absolute -bottom-7 left-16 z-30 bg-[#242930] px-2 py-1 text-[9px] font-black text-white">CLEAR</button></>}<button type="button" onPointerDown={(event) => begin(event, box, 'resize')} className="absolute -bottom-2 -right-2 z-30 h-6 w-6 bg-[#23c7be] text-xs font-black text-black">↘</button><button type="button" aria-label="Delete text block" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onBoxesChange(items.filter((item) => item.id !== box.id)); setSelectedBox(''); }} className="absolute -top-7 right-0 z-30 flex h-6 w-6 items-center justify-center bg-red-500 text-white"><Trash2 size={12} /></button></>}
    </div>)}
    {drawingBoxId && editingBox && <div className="absolute inset-0 z-40 touch-none" onPointerDown={(event) => { if (event.target === event.currentTarget) { pointerDragRef.current = null; pointerPointsRef.current = []; setPointerDraft([]); setDrawingBoxId(''); } }} onPointerMove={movePointerHandle} onPointerUp={finishPointerHandle} onPointerCancel={finishPointerHandle}>
      <DialoguePointerPath points={pointerDraft} box={editingBox} frameWidth={width} />
      {pointerDraft.map((point, index) => <button type="button" key={`pointer-handle-${index}`} aria-label={index === 0 ? 'Arrow anchor' : index === 1 ? 'Arrow curve' : 'Arrow tip'} onPointerDown={(event) => startPointerHandle(event, index)} className={`absolute z-50 h-5 w-5 -translate-x-1/2 -translate-y-1/2 border-2 shadow-lg ${index === 0 ? 'border-white bg-black' : index === 1 ? 'border-black bg-[#23c7be]' : 'border-white bg-red-500'}`} style={{ left: `${point.x}%`, top: `${point.y}%` }} />)}
      <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 bg-[#23c7be] px-3 py-1.5 text-[10px] font-black uppercase text-black shadow-lg">Drag the 3 reference points · click outside to finish</div>
    </div>}
  </div>;
}

function ToolButton({ tool, active, onClick }) {
  const Icon = tool.icon;
  return <button type="button" onClick={onClick} title={tool.label} aria-label={tool.label} className={`flex h-12 w-12 items-center justify-center border transition ${active ? 'border-[#23c7be] bg-[#23c7be] text-black' : 'border-white/10 bg-[#16191d] text-white/70 hover:border-white/30 hover:text-white'}`}><Icon size={19} /></button>;
}

function ChoiceGrid({ title, icon: Icon, items, selected, onToggle }) {
  return <div><div className="mb-2 flex items-center gap-2 text-[#23c7be]"><Icon size={14} /><p className="text-xs font-black uppercase">{title}</p></div><div className="grid grid-cols-2 gap-2">{items.map((item) => <button key={item.id} type="button" onClick={() => onToggle(item.id)} className={`flex items-center gap-2 border p-2 text-left ${selected.includes(item.id) ? 'border-[#23c7be] bg-[#23c7be]/15' : 'border-white/10 bg-white/5'}`}><div className="flex h-9 w-9 items-center justify-center overflow-hidden bg-white/10">{item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-cover" /> : <Icon size={15} />}</div><span className="min-w-0 flex-1 truncate text-xs font-black">{item.name}</span>{selected.includes(item.id) && <Check size={13} className="text-[#23c7be]" />}</button>)}</div></div>;
}

function ReferencePicker({ title, images, selected, onChange }) {
  const toggle = (url) => { if (selected.includes(url)) onChange(selected.filter((item) => item !== url)); else if (selected.length < 3) onChange([...selected, url]); else toast.error('Select up to 3 reference images'); };
  return <div className="border border-white/10 bg-[#181c21] p-3"><div className="mb-2 flex justify-between gap-2"><p className="text-[11px] font-black uppercase text-[#23c7be]">{title}</p><span className="text-[10px] text-white/45">{selected.length}/3</span></div><div className="grid grid-cols-3 gap-2">{images.map((url, index) => <button type="button" key={`${url}-${index}`} onClick={() => toggle(url)} className={`relative aspect-square overflow-hidden border-2 ${selected.includes(url) ? 'border-[#23c7be]' : 'border-transparent opacity-60'}`}><img src={url} alt="" className="h-full w-full object-cover" />{selected.includes(url) && <span className="absolute right-1 top-1 bg-[#23c7be] p-1 text-black"><Check size={10} /></span>}</button>)}</div></div>;
}

function OloShopPicker({ onSelect, onClose }) {
  const [assets, setAssets] = useState([]); const [loading, setLoading] = useState(true);
  useEffect(() => { supabase.from('catalog_asset').select('id,title,featured_image,preview_images').eq('status', 'published').order('title').limit(300).then(({ data, error }) => { if (error) throw error; setAssets(data || []); }).catch((error) => toast.error(error.message || 'Unable to load Assets Shop')).finally(() => setLoading(false)); }, []);
  const images = assets.flatMap((asset) => uniqueImages([asset.featured_image, ...(Array.isArray(asset.preview_images) ? asset.preview_images : [])]).map((url, index) => ({ id: `${asset.id}-${index}`, url, label: asset.title || 'Assets Shop image' })));
  return <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/90 p-4"><div className="max-h-[86vh] w-full max-w-5xl overflow-y-auto border border-white/15 bg-[#111418] p-4 text-white"><div className="mb-4 flex items-center justify-between"><h3 className="font-black">Assets Shop images</h3><button onClick={onClose}><X /></button></div>{loading ? <Loader2 className="mx-auto my-20 animate-spin text-[#23c7be]" /> : <div className="grid grid-cols-3 gap-3 md:grid-cols-5">{images.map((item) => <button key={item.id} onClick={() => onSelect(item.url, item.label)} className="overflow-hidden border border-white/10 bg-[#1a1e23]"><img src={item.url} alt="" className="aspect-square w-full object-cover" /><p className="truncate p-2 text-xs font-bold">{item.label}</p></button>)}</div>}</div></div>;
}

export default function AuthorProductionWorkspacePage(props) {
  const { project } = props;
  const active = project.chapters.find((chapter) => chapter.id === props.activeChapterId);
  const currentIndex = active ? Math.max(0, active.segments.findIndex((segment) => segment.status !== 'approved')) : 0;
  const current = active?.segments[currentIndex < 0 ? 8 : currentIndex];
  if (!current) return <div className="min-h-[70vh] bg-[#202328] text-white flex items-center justify-center px-6"><div className="text-center"><p className="text-xs font-black uppercase tracking-[.18em] text-[#23c7be]">FotoPlay</p><p className="mt-2 text-sm font-semibold text-white/60">Select a project to open the current workspace.</p></div></div>;
  return <ComicPageWorkspace {...props} onClassic={() => {}} />;
}

function ComicPageWorkspace({ user, project, setProject, activeChapterId, setActiveChapterId, saving, onBack, onEditSetup, onSave, onClassic }) {
  const [selectedId, setSelectedId] = useState(''); const [tool, setTool] = useState('panel'); const [selectedPanel, setSelectedPanel] = useState(0);
  const [busy, setBusy] = useState(''); const [notice, setNotice] = useState(''); const [pricing, setPricing] = useState({}); const [catalogGalleries, setCatalogGalleries] = useState({});
  const [showMasterVault, setShowMasterVault] = useState(false); const [showMasterShop, setShowMasterShop] = useState(false); const masterUploadRef = useRef(null);
  const active = useMemo(() => project.chapters.find((chapter) => chapter.id === activeChapterId), [project.chapters, activeChapterId]);
  const firstOpen = active?.segments.findIndex((segment) => segment.status !== 'approved') ?? 0; const currentIndex = firstOpen < 0 ? 8 : firstOpen;
  useEffect(() => { if (!active) return; const selected = active.segments.find((item) => item.id === selectedId); if (!selected || selected.number > currentIndex + 1) setSelectedId(active.segments[currentIndex].id); }, [active, currentIndex, selectedId]);
  const selectedIndex = Math.max(0, active?.segments.findIndex((segment) => segment.id === selectedId) ?? currentIndex); const segment = active?.segments[selectedIndex];
  useEffect(() => { setSelectedPanel((value) => Math.min(value, Math.max(0, Number(segment?.comic_panel_count || 3) - 1))); }, [segment?.id, segment?.comic_panel_count]);
  useEffect(() => { base44.entities.ToolPricing.filter({ is_active: true }).then((rows) => setPricing(Object.fromEntries(rows.map((row) => [row.tool_id, row.token_cost])))).catch(() => {}); }, []);
  useEffect(() => { const ids = [...new Set([...project.characters, ...project.locations].map((item) => item.image_source_id).filter(Boolean))]; if (!ids.length) return setCatalogGalleries({}); supabase.from('catalog_asset').select('id,featured_image,preview_images').in('id', ids).then(({ data }) => setCatalogGalleries(Object.fromEntries((data || []).map((item) => [item.id, uniqueImages([item.featured_image, ...(item.preview_images || [])])])))); }, [project.characters, project.locations]);
  if (!active || !segment) return null;
  const withSegment = (values, chapterValues = {}) => ({ ...project, chapters: project.chapters.map((chapter) => chapter.id === activeChapterId ? { ...chapter, ...chapterValues, segments: chapter.segments.map((item, index) => item.id === segment.id ? normalizeSegment({ ...item, ...values }, index) : item) } : chapter) });
  const change = (values) => setProject(withSegment({ ...values, status: values.status || 'draft' }));
  const persist = async (values, chapterValues = {}) => { const next = withSegment(values, chapterValues); setProject(next); return onSave(next, { silent: true }); };
  const panelCount = Number(segment.comic_panel_count || 3); const panels = Array.from({ length: panelCount }, (_, index) => ({ id: `panel-${index + 1}`, beat: '', shot: IMAGE_TYPES[Math.min(index, IMAGE_TYPES.length - 1)], prompt: '', image_url: '', source_prompt: '', ...(segment.comic_panels?.[index] || {}) }));
  const boxes = normalizedTextBoxes(segment.text_boxes); const characters = selectedItems(segment.character_ids, project.characters); const locations = selectedItems(segment.location_ids, project.locations);
  const selectedRefs = (item, field) => { const gallery = assetGallery(item, catalogGalleries); const explicit = Array.isArray(segment[field]?.[item.id]) ? segment[field][item.id].filter((url) => gallery.includes(url)) : []; return explicit.length ? explicit : gallery.slice(0, 1); };
  const rawReferenceEntries = [
    ...(active.master_reference_url ? [{ url: active.master_reference_url, label: 'Sequence master' }] : []),
    ...locations.flatMap((item) => selectedRefs(item, 'location_reference_images').map((url) => ({ url, label: `Location: ${item.name}` }))),
    ...characters.flatMap((item) => selectedRefs(item, 'character_reference_images').map((url) => ({ url, label: `Character identity: ${item.name}` }))),
  ];
  const referenceEntries = rawReferenceEntries.reduce((items, entry) => {
    const existing = items.find((item) => item.url === entry.url);
    if (existing) existing.labels.push(entry.label);
    else items.push({ url: entry.url, labels: [entry.label] });
    return items;
  }, []).slice(0, 14);
  const refs = referenceEntries.map((item) => item.url);
  const referenceEntriesForPanel = (panel) => panel?.frame_type === 'establishing' ? referenceEntries.filter((item) => !item.labels.some((label) => label.startsWith('Character identity:'))) : referenceEntries;
  const frameCharacterDirections = (panel) => {
    if (panel?.frame_type === 'establishing') return '';
    return characters.map((character) => {
      const value = { ...(active.appearance_continuity?.[character.id] || {}), ...(segment.character_directions?.[character.id] || {}) };
      const details = [value.look && `Appearance: ${value.look}`, value.action && `Action: ${value.action}`, value.position && `Position: ${value.position}`, value.expression && `Expression: ${value.expression}`, (value.gaze || value.interaction) && `Gaze/interaction: ${value.gaze || value.interaction}`].filter(Boolean);
      return details.length ? `${character.name}: ${details.join('; ')}` : character.name;
    }).join('\n');
  };
  const toggle = (field, id) => change({ [field]: segment[field].includes(id) ? segment[field].filter((item) => item !== id) : [...segment[field], id] });
  const updatePanel = (index, values) => change({ comic_panels: panels.map((panel, panelIndex) => panelIndex === index ? { ...panel, ...values } : panel), comic_page_source: '' });
  const selected = panels[selectedPanel] || panels[0];
  const allLeavesReady = panels.every((panel) => flattenLeaves(panel).every((leaf) => leaf?.image_url));
  const framePrompt = (panel, index) => {
    const entries = referenceEntriesForPanel(panel);
    const manifest = entries.map((item, refIndex) => `Reference ${refIndex + 1}: ${item.labels.join(' | ')}`).join('\n');
    const frameType = panel?.frame_type === 'establishing' ? 'Establishing' : 'Characters';
    const characterDirections = frameCharacterDirections(panel);
    const locationChanges = locations.map((location) => { const value = segment.location_changes?.[location.id]?.trim(); return value ? `${location.name}: ${value}` : ''; }).filter(Boolean).join('\n');
    const environment = [segment.exact_area && `Exact set area: ${segment.exact_area}`, locationChanges && `Location additions / changes:\n${locationChanges}`, segment.environment_direction && `Environment: ${segment.environment_direction}`, segment.fixed_set_elements && `Fixed set elements: ${segment.fixed_set_elements}`, segment.image_instruction && `Shared visual direction: ${segment.image_instruction}`].filter(Boolean).join('\n');
    const storyBeat = panel?.beat || segment.summary || '';
    return `Create one photorealistic live-action cinematic production still. Frame type: ${frameType}.\n${panel?.frame_type === 'establishing' ? 'Build the image around the location, environment and atmosphere. Do not use character identity references and do not introduce identifiable principal cast members unless the story beat explicitly requires them.' : 'Preserve each named character only from that character\'s own identity references. Do not transfer facial features, age, clothing or identity between characters.'}\nUse the supplied reference images according to this exact mapping:\n${manifest || 'No reference images supplied.'}\n${environment}${environment ? '\n' : ''}${characterDirections}${characterDirections ? '\n' : ''}${storyBeat ? `Story beat: ${storyBeat}\n` : ''}FRAME ${index + 1}/${panelCount}. Shot: ${panel.shot}. Do not add text, captions, borders, speech bubbles, illustration or graphic-novel styling.`;
  };
  const generatePanel = async (index) => { const panel = panels[index]; const prompt = framePrompt(panel, index); const frameRefs = referenceEntriesForPanel(panel).map((item) => item.url); setBusy(`panel-${index}`); try { const response = await base44.integrations.Core.GenerateImage({ prompt, reference_image_urls: frameRefs, aspect_ratio: '1:1' }); if (!response?.file_url) throw new Error('No image returned'); const next = panels.map((item, i) => i === index ? { ...item, image_url: response.file_url, source_prompt: prompt } : item); await persist({ comic_panels: next, comic_page_source: '', status: 'draft' }); setNotice(`Frame ${index + 1} generated.`); } catch (error) { toast.error(error.message || 'Frame generation failed'); } finally { setBusy(''); } };
  const uploadPanel = async (index, file) => { if (!file) return; setBusy(`upload-${index}`); try { const uploaded = await base44.integrations.Core.UploadFile({ file }); const next = panels.map((item, i) => i === index ? { ...item, image_url: uploaded.file_url, source_prompt: item.prompt } : item); await persist({ comic_panels: next, comic_page_source: '', status: 'draft' }); } catch (error) { toast.error(error.message || 'Upload failed'); } finally { setBusy(''); } };
  const planPanels = async () => { if (!segment.image_instruction?.trim()) return toast.error('Build the shared visual direction first'); setBusy('plan'); try { const response = await base44.integrations.Core.InvokeLLM({ prompt: `Plan exactly ${panelCount} distinct cinematic frames for this one segment. Shared direction: ${segment.image_instruction}. Story beat: ${segment.summary}. Narration: ${segment.narration_text}. Return JSON with panels, each containing beat, shot and prompt.`, response_json_schema: { type: 'object', properties: { panels: { type: 'array', minItems: panelCount, maxItems: panelCount, items: { type: 'object', properties: { beat: { type: 'string' }, shot: { type: 'string' }, prompt: { type: 'string' }...