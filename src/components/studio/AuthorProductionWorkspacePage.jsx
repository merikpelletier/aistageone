import React, { useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { toast } from 'sonner';
import {
  ArrowLeft, Check, Clock3, Download, ExternalLink, Eye, Image as ImageIcon, Loader2, MapPin,
  MessageSquareText, Mic2, PanelLeft, Play, Rocket, Save, Sparkles, Store, Type, Upload,
  UserRound, Users, Volume2, Wand2, X, FolderOpen,
  Film, Trash2, RotateCcw,
} from 'lucide-react';
import VoicePicker from './VoicePicker';
import VaultPickerModal from './VaultPickerModal';
import StoryImageAdjustment from './StoryImageAdjustment';
import StoryImageFileActions from './StoryImageFileActions';
import { FotoPlayExportModal, FotoPlayPreviewModal, FotoPlayPublishModal } from './FotoPlayProjectActions';
import { IMAGE_RATIOS, IMAGE_TYPES, TIME_OPTIONS, normalizeSegment, selectedItems } from './authorStoryModel';
import { adjustmentFingerprint, adjustmentRecord } from './storyImageAdjustment';

const dark = 'w-full border border-white/15 bg-[#20242a] px-3 py-2.5 text-sm font-semibold text-white placeholder:text-white/35 focus:border-[#23c7be] focus:outline-none';
const action = 'inline-flex items-center justify-center gap-2 border border-white/10 px-3 py-2.5 text-xs font-black disabled:cursor-not-allowed disabled:opacity-35';
const uniqueImages = (values) => [...new Set(values.filter((value) => typeof value === 'string' && value.trim()))];
const assetGallery = (item, catalogGalleries) => uniqueImages([item?.active_look_reference_url, item?.image_url, ...(Array.isArray(item?.look_reference_images) ? item.look_reference_images : []), ...(Array.isArray(item?.reference_images) ? item.reference_images : []), ...(catalogGalleries[item?.image_source_id] || [])]);
const normalizedTextBoxes = (boxes) => (Array.isArray(boxes) ? boxes : []).map((box) => ({
  id: box.id || crypto.randomUUID(), type: box.type === 'dialogue' ? 'dialogue' : 'narration', text: box.text || '',
  x: Number.isFinite(Number(box.x)) ? Number(box.x) : 8, y: Number.isFinite(Number(box.y)) ? Number(box.y) : 8,
  width: Number.isFinite(Number(box.width)) ? Number(box.width) : 42, height: Number.isFinite(Number(box.height)) ? Number(box.height) : 16,
  font_size: Number.isFinite(Number(box.font_size)) ? Number(box.font_size) : 26,
  tail_side: ['top', 'right', 'bottom', 'left'].includes(box.tail_side) ? box.tail_side : 'bottom',
  tail_position: Number.isFinite(Number(box.tail_position)) ? Math.max(10, Math.min(90, Number(box.tail_position))) : 50,
  tail_size: Number.isFinite(Number(box.tail_size)) ? Math.max(10, Math.min(50, Number(box.tail_size))) : 22,
}));

function comicPageSignature(chapter, panels) {
  return JSON.stringify({ ratio: chapter.image_aspect_ratio || '16:9', panels: panels.map((panel) => panel.image_url || '') });
}

function flattenLeaves(panel) {
  if (!panel?.split) return [panel];
  return [...flattenLeaves(panel.split.a), ...flattenLeaves(panel.split.b)];
}

async function drawCoverImage(ctx, source, slot, posX = 50, posY = 50) {
  const response = await fetch(source);
  if (!response.ok) throw new Error('Unable to load a panel image');
  const bitmap = await createImageBitmap(await response.blob());
  const scale = Math.max(slot.w / bitmap.width, slot.h / bitmap.height);
  const dw = bitmap.width * scale; const dh = bitmap.height * scale;
  const x = slot.x + (slot.w - dw) * (Number(posX) / 100);
  const y = slot.y + (slot.h - dh) * (Number(posY) / 100);
  ctx.drawImage(bitmap, x, y, dw, dh); bitmap.close();
}

async function drawPanelTree(ctx, panel, slot, gutter) {
  if (!panel?.split) {
    if (!panel?.image_url) return;
    ctx.save(); ctx.beginPath(); ctx.rect(slot.x, slot.y, slot.w, slot.h); ctx.clip();
    await drawCoverImage(ctx, panel.image_url, slot, panel.position_x ?? 50, panel.position_y ?? 50);
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

function drawDialogueTailCanvas(ctx, box, x, y, w, h) {
  const side = box.tail_side || 'bottom';
  const position = (box.tail_position || 50) / 100;
  const scale = Math.max(10, Math.min(50, Number(box.tail_size) || 22)) / 22;
  const short = 18 * scale;
  const long = 24 * scale;
  let a; let tip; let b;
  if (side === 'top') { const cx = x + w * position; a = [cx - short * .5, y]; tip = [cx, y - long]; b = [cx + short * .5, y]; }
  else if (side === 'right') { const cy = y + h * position; a = [x + w, cy - short * .5]; tip = [x + w + long, cy]; b = [x + w, cy + short * .5]; }
  else if (side === 'left') { const cy = y + h * position; a = [x, cy - short * .5]; tip = [x - long, cy]; b = [x, cy + short * .5]; }
  else { const cx = x + w * position; a = [cx - short * .5, y + h]; tip = [cx, y + h + long]; b = [cx + short * .5, y + h]; }
  ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...tip); ctx.lineTo(...b); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = Math.max(2, ctx.canvas.width * .002); ctx.lineJoin = 'round'; ctx.stroke();
}

async function addTextBoxesToFile(file, boxes) {
  if (!boxes.length) return file;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0); bitmap.close();
  normalizedTextBoxes(boxes).forEach((box) => {
    const x = canvas.width * box.x / 100; const y = canvas.height * box.y / 100;
    const w = canvas.width * box.width / 100; const h = canvas.height * box.height / 100;
    if (box.type === 'dialogue') drawDialogueTailCanvas(ctx, box, x, y, w, h);
    ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = '#111'; ctx.lineWidth = Math.max(2, canvas.width * 0.002); ctx.strokeRect(x, y, w, h);
    const size = Math.max(14, canvas.width * box.font_size / 1400); ctx.font = `600 ${size}px Arial, sans-serif`; ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const lines = wrapLines(ctx, box.text || (box.type === 'dialogue' ? 'Dialogue' : 'Narration'), w * 0.94);
    const lineHeight = size * 1.08; const visible = lines.slice(0, Math.max(1, Math.floor(h / lineHeight)));
    const start = y + Math.max(4, (h - visible.length * lineHeight) / 2);
    visible.forEach((line, index) => ctx.fillText(line, x + w / 2, start + index * lineHeight));
  });
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(new File([blob], `fotoplay-final-${crypto.randomUUID()}.png`, { type: 'image/png' })) : reject(new Error('Unable to render page text')), 'image/png', 0.95));
}

function DialogueTail({ side = 'bottom', position = 50, size = 22 }) {
  const scale = Math.max(10, Math.min(50, Number(size) || 22)) / 22;
  const short = 18 * scale; const long = 24 * scale;
  const common = { position: 'absolute', pointerEvents: 'none', zIndex: 0 }; let style; let viewBox; let points; let edge;
  if (side === 'top') { style = { ...common, left: `${position}%`, bottom: 'calc(100% - 1px)', width: short, height: long, transform: 'translateX(-50%)' }; viewBox = '0 0 18 24'; points = '5,23 13,23 9,1'; edge = '5,23 9,1 13,23'; }
  else if (side === 'right') { style = { ...common, left: 'calc(100% - 1px)', top: `${position}%`, width: long, height: short, transform: 'translateY(-50%)' }; viewBox = '0 0 24 18'; points = '1,5 1,13 23,9'; edge = '1,5 23,9 1,13'; }
  else if (side === 'left') { style = { ...common, right: 'calc(100% - 1px)', top: `${position}%`, width: long, height: short, transform: 'translateY(-50%)' }; viewBox = '0 0 24 18'; points = '23,5 23,13 1,9'; edge = '23,5 1,9 23,13'; }
  else { style = { ...common, left: `${position}%`, top: 'calc(100% - 1px)', width: short, height: long, transform: 'translateX(-50%)' }; viewBox = '0 0 18 24'; points = '5,1 13,1 9,23'; edge = '5,1 9,23 13,1'; }
  return <svg aria-hidden="true" viewBox={viewBox} style={style} className="overflow-visible"><polygon points={points} fill="white" /><polyline points={edge} fill="none" stroke="#111" strokeWidth="2" strokeLinejoin="round" /></svg>;
}

function PanelTreePreview({ panel }) {
  if (!panel?.split) return panel?.image_url ? <img src={panel.image_url} alt="" className="h-full w-full object-cover" style={{ objectPosition: `${panel.position_x ?? 50}% ${panel.position_y ?? 50}%` }} /> : <div className="flex h-full w-full items-center justify-center text-white/25"><ImageIcon size={28} /></div>;
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
  const [rw, rh] = String(ratio || '16:9').split(':').map(Number); const landscape = rw >= rh;
  const items = normalizedTextBoxes(boxes);
  useEffect(() => { if (!ref.current) return undefined; const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width || 900)); observer.observe(ref.current); return () => observer.disconnect(); }, []);
  useEffect(() => {
    const move = (event) => {
      const state = drag.current; const frame = ref.current; if (!state || !frame) return;
      const rect = frame.getBoundingClientRect(); const dx = (event.clientX - state.x) / rect.width * 100; const dy = (event.clientY - state.y) / rect.height * 100;
      const next = state.mode === 'move'
        ? { ...state.box, x: Math.max(0, Math.min(100 - state.box.width, state.box.x + dx)), y: Math.max(0, Math.min(100 - state.box.height, state.box.y + dy)) }
        : { ...state.box, width: Math.max(18, Math.min(100 - state.box.x, state.box.width + dx)), height: Math.max(8, Math.min(100 - state.box.y, state.box.height + dy)) };
      onBoxesChange(items.map((box) => box.id === state.id ? next : box));
    };
    const stop = () => { drag.current = null; };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop); window.addEventListener('pointercancel', stop);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); };
  }, [items, onBoxesChange]);
  const begin = (event, box, mode) => { if (!textMode) return; event.preventDefault(); event.stopPropagation(); setSelectedBox(box.id); drag.current = { id: box.id, box: { ...box }, x: event.clientX, y: event.clientY, mode }; };
  const pageWidth = `min(100%, calc((100vh - 330px) * ${(rw || 16) / (rh || 9)}))`;
  return <div ref={ref} className="relative mx-auto overflow-hidden border border-white/15 bg-[#090b0d] shadow-[0_30px_80px_rgba(0,0,0,.45)]" style={{ aspectRatio: `${rw || 16} / ${rh || 9}`, width: pageWidth, maxHeight: 'calc(100vh - 330px)' }} onPointerDown={() => textMode && setSelectedBox('')}>
    <div className="absolute inset-0 grid gap-[6px] p-[6px]" style={landscape ? { gridTemplateColumns: `repeat(${panels.length},minmax(0,1fr))` } : { gridTemplateRows: `repeat(${panels.length},minmax(0,1fr))` }}>
      {panels.map((panel, index) => <button type="button" key={panel.id || index} onClick={(event) => { event.stopPropagation(); onSelectPanel(index); }} className={`relative min-h-0 min-w-0 overflow-hidden bg-black text-left transition ${selectedPanel === index ? 'ring-4 ring-[#23c7be] ring-inset' : 'ring-1 ring-white/10 ring-inset'}`}><PanelTreePreview panel={panel} /><span className={`absolute left-2 top-2 px-2 py-1 text-[10px] font-black ${selectedPanel === index ? 'bg-[#23c7be] text-black' : 'bg-black/70 text-white'}`}>FRAME {index + 1}</span></button>)}
    </div>
    {items.map((box) => <div key={box.id} onPointerDown={(event) => { event.stopPropagation(); textMode && setSelectedBox(box.id); }} className={`absolute z-20 bg-white text-black shadow-lg ${textMode && selectedBox === box.id ? 'ring-3 ring-[#23c7be]' : 'ring-1 ring-black/70'}`} style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.width}%`, height: `${box.height}%`, fontSize: `${Math.max(9, width * box.font_size / 1400)}px` }}>
      {box.type === 'dialogue' && <DialogueTail side={box.tail_side} position={box.tail_position} size={box.tail_size} />}
      <div className="relative z-10 flex h-full items-center justify-center overflow-hidden px-1 text-center font-semibold leading-[1.06] whitespace-pre-wrap">{box.text || (box.type === 'dialogue' ? 'Dialogue' : 'Narration')}</div>
      {textMode && selectedBox === box.id && <><button type="button" onPointerDown={(event) => begin(event, box, 'move')} className="absolute -top-7 left-0 z-30 bg-[#23c7be] px-2 py-1 text-[9px] font-black text-black">MOVE</button><button type="button" onPointerDown={(event) => begin(event, box, 'resize')} className="absolute -bottom-2 -right-2 z-30 h-6 w-6 bg-[#23c7be] text-xs font-black text-black">↘</button><button type="button" aria-label="Delete text block" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onBoxesChange(items.filter((item) => item.id !== box.id)); setSelectedBox(''); }} className="absolute -top-7 right-0 z-30 flex h-6 w-6 items-center justify-center bg-red-500 text-white"><Trash2 size={12} /></button></>}
    </div>)}
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
  return <ComicPageWorkspace {...props} />;
}

function ComicPageWorkspace({ user, project, setProject, activeChapterId, setActiveChapterId, saving, onBack, onEditSetup, onSave }) {
  const [selectedId, setSelectedId] = useState(''); const [tool, setTool] = useState('panel'); const [selectedPanel, setSelectedPanel] = useState(0);
  const [busy, setBusy] = useState(''); const [notice, setNotice] = useState(''); const [pricing, setPricing] = useState({}); const [catalogGalleries, setCatalogGalleries] = useState({});
  const [showMasterVault, setShowMasterVault] = useState(false); const [showMasterShop, setShowMasterShop] = useState(false); const masterUploadRef = useRef(null);
  const [showPreview, setShowPreview] = useState(false); const [showExport, setShowExport] = useState(false); const [showPublish, setShowPublish] = useState(false); const [publishing, setPublishing] = useState(false);
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
  const refs = uniqueImages([active.master_reference_url, ...locations.flatMap((item) => selectedRefs(item, 'location_reference_images')), ...characters.flatMap((item) => selectedRefs(item, 'character_reference_images'))]).slice(0, 14);
  const toggle = (field, id) => change({ [field]: segment[field].includes(id) ? segment[field].filter((item) => item !== id) : [...segment[field], id] });
  const updatePanel = (index, values) => change({ comic_panels: panels.map((panel, panelIndex) => panelIndex === index ? { ...panel, ...values } : panel), comic_page_source: '' });
  const selected = panels[selectedPanel] || panels[0];
  const allLeavesReady = panels.every((panel) => flattenLeaves(panel).every((leaf) => leaf?.image_url));
  const framePrompt = (panel, index) => `Create one photorealistic live-action cinematic production still. Preserve the supplied people and exact location references. FRAME ${index + 1}/${panelCount}. Shot: ${panel.shot}. Action and composition: ${panel.prompt}. Do not add text, captions, borders, speech bubbles, illustration or graphic-novel styling.`;
  const generatePanel = async (index) => { const panel = panels[index]; if (!panel?.prompt?.trim()) return toast.error('Write the frame prompt first'); setBusy(`panel-${index}`); try { const response = await base44.integrations.Core.GenerateImage({ prompt: framePrompt(panel, index), reference_image_urls: refs, aspect_ratio: '1:1' }); if (!response?.file_url) throw new Error('No image returned'); const next = panels.map((item, i) => i === index ? { ...item, image_url: response.file_url, source_prompt: item.prompt } : item); await persist({ comic_panels: next, comic_page_source: '', status: 'draft' }); setNotice(`Frame ${index + 1} generated.`); } catch (error) { toast.error(error.message || 'Frame generation failed'); } finally { setBusy(''); } };
  const uploadPanel = async (index, file) => { if (!file) return; setBusy(`upload-${index}`); try { const uploaded = await base44.integrations.Core.UploadFile({ file }); const next = panels.map((item, i) => i === index ? { ...item, image_url: uploaded.file_url, source_prompt: item.prompt } : item); await persist({ comic_panels: next, comic_page_source: '', status: 'draft' }); } catch (error) { toast.error(error.message || 'Upload failed'); } finally { setBusy(''); } };
  const planPanels = async () => { if (!segment.image_instruction?.trim()) return toast.error('Build the shared visual direction first'); setBusy('plan'); try { const response = await base44.integrations.Core.InvokeLLM({ prompt: `Plan exactly ${panelCount} distinct cinematic frames for this one segment. Shared direction: ${segment.image_instruction}. Story beat: ${segment.summary}. Narration: ${segment.narration_text}. Return JSON with panels, each containing beat, shot and prompt.`, response_json_schema: { type: 'object', properties: { panels: { type: 'array', minItems: panelCount, maxItems: panelCount, items: { type: 'object', properties: { beat: { type: 'string' }, shot: { type: 'string' }, prompt: { type: 'string' } }, required: ['beat', 'shot', 'prompt'] } } }, required: ['panels'] } }); const value = typeof response === 'string' ? JSON.parse(response) : response; const result = value?.panels ? value : value?.response?.panels ? value.response : value; if (!result?.panels?.length) throw new Error('No frame plan returned'); await persist({ comic_panels: result.panels.map((item, index) => ({ ...panels[index], ...item, image_url: panels[index]?.prompt === item.prompt ? panels[index]?.image_url : '', source_prompt: panels[index]?.prompt === item.prompt ? panels[index]?.source_prompt : '' })), comic_page_source: '', status: 'draft' }); setNotice('Frame plan updated.'); } catch (error) { toast.error(error.message || 'Unable to plan frames'); } finally { setBusy(''); } };
  const buildDirection = async () => { setBusy('direction'); try { const response = await base44.integrations.Core.InvokeLLM({ prompt: `Write one precise English shared visual direction for this FotoPlay segment. Story: ${project.story_description}. Segment: ${segment.summary}. Narration: ${segment.narration_text}. Selected characters: ${characters.map((c) => c.name).join(', ')}. Selected locations: ${locations.map((l) => l.name).join(', ')}. Preserve exact identities and locations.`, response_json_schema: { type: 'object', properties: { final_prompt: { type: 'string' } }, required: ['final_prompt'] } }); const result = typeof response === 'string' ? JSON.parse(response) : response; const finalPrompt = result?.final_prompt || result?.response?.final_prompt; if (!finalPrompt) throw new Error('No direction returned'); await persist({ image_instruction: finalPrompt, status: 'draft' }); } catch (error) { toast.error(error.message || 'Direction failed'); } finally { setBusy(''); } };
  const syncPage = async () => { if (!allLeavesReady) throw new Error('Every current frame needs an image'); let file = await assembleComicPage(panels, active.image_aspect_ratio || '16:9'); file = await addTextBoxesToFile(file, boxes); const uploaded = await base44.integrations.Core.UploadFile({ file }); await persist({ image_url: uploaded.file_url, comic_page_source: comicPageSignature(active, panels), image_source_aspect_ratio: active.image_aspect_ratio || '16:9', text_overlay_source_url: '', text_overlay_applied_signature: JSON.stringify(boxes), status: 'draft' }); return uploaded.file_url; };
  const generateAudio = async () => { if (!segment.narrator_voice) return toast.error('Choose a voice first'); if (!segment.narration_text?.trim()) return toast.error('Add narration first'); setBusy('audio'); try { const response = await base44.functions.invoke('generateSpeech', { text: segment.narration_text, voice: segment.narrator_voice, language_code: segment.narrator_language || project.production_settings?.narrator_language || 'en' }); await persist({ narration_url: response.data.file_url, audio_source_text: segment.narration_text, audio_voice: segment.narrator_voice, audio_stale: false, status: 'draft' }); } catch (error) { toast.error(error.message || 'Audio generation failed'); } finally { setBusy(''); } };
  const generateCurrent = async () => { if (!allLeavesReady) { const missing = panels.findIndex((panel) => !flattenLeaves(panel).every((leaf) => leaf?.image_url)); setSelectedPanel(Math.max(0, missing)); setTool('panel'); return toast.error(`Frame ${missing + 1} still needs an image`); } setBusy('sync'); try { await syncPage(); if (!segment.narration_url || segment.audio_stale || segment.audio_source_text !== segment.narration_text || segment.audio_voice !== segment.narrator_voice) await generateAudio(); setNotice('The current page and audio are synchronized.'); } catch (error) { toast.error(error.message || 'Unable to synchronize the page'); } finally { setBusy(''); } };
  const approve = async () => { if (!segment.narrator_voice) return toast.error('Choose a voice first'); if (!allLeavesReady) return toast.error('Every frame needs an image'); setBusy('approve'); try { await syncPage(); if (!segment.narration_url || segment.audio_stale || segment.audio_source_text !== segment.narration_text || segment.audio_voice !== segment.narrator_voice) await generateAudio(); const continuity = { ...(active.appearance_continuity || {}) }; for (const id of segment.character_ids) { const value = segment.character_directions?.[id] || {}; if (value.continuity_scope === 'carry') continuity[id] = value; } await persist({ status: 'approved' }, { appearance_continuity: continuity }); if (segment.number < 9) setSelectedId(active.segments[segment.number].id); setNotice(`Segment ${segment.number} approved.`); } catch (error) { toast.error(error.message || 'Approval failed'); } finally { setBusy(''); } };
  const selectMaster = async (url, source, label) => { if (!url) return; await persist({}, { master_reference_url: url, master_reference_source: source, master_reference_label: label }); setShowMasterVault(false); setShowMasterShop(false); };
  const uploadMaster = async (event) => { const file = event.target.files?.[0]; if (!file) return; const result = await base44.integrations.Core.UploadFile({ file }); await selectMaster(result.file_url, 'upload', file.name || 'Uploaded image'); event.target.value = ''; };
  const applyAdjustment = async ({ target, url, instruction, reference, restore, fingerprint }) => { const currentFingerprint = adjustmentFingerprint(segment, active.image_aspect_ratio || '16:9'); if (fingerprint !== currentFingerprint) throw new Error('The image changed while the adjustment was prepared'); const original = segment.image_adjustments?.[target.key]?.original; if (restore && !original) throw new Error('No original is available'); const values = { status: 'draft' }; if (target.panelIndex !== null) { const panel = panels[target.panelIndex]; const next = panels.map((item, index) => index === target.panelIndex ? { ...panel, ...(restore ? { image_url: original.image_url, source_prompt: original.source_prompt } : { image_url: url }) } : item); values.comic_panels = next; values.comic_page_source = ''; } else values.image_url = restore ? original.image_url : url; if (!restore) values.image_adjustments = adjustmentRecord(segment, target, url, instruction, reference); await persist(values); };
  const createLook = async (character) => { const current = { ...(active.appearance_continuity?.[character.id] || {}), ...(segment.character_directions?.[character.id] || {}) }; const description = [current.look, current.costume, current.injuries, current.hair_makeup_accessories, current.physical_state].filter(Boolean).join('; '); if (!description) return toast.error('Describe the look first'); const identity = selectedRefs(character, 'character_reference_images'); if (!identity.length) return toast.error('Choose an identity reference'); setBusy(`look-${character.id}`); try { const response = await base44.integrations.Core.GenerateImage({ prompt: `Preserve exactly the same person in the supplied identity references. Create a clean photorealistic production reference with these look changes only: ${description}. Neutral background, no text.`, reference_image_urls: identity, aspect_ratio: '3:4' }); const next = withSegment({ character_reference_images: { ...segment.character_reference_images, [character.id]: [response.file_url] }, character_generated_reference_images: { ...segment.character_generated_reference_images, [character.id]: uniqueImages([...(segment.character_generated_reference_images?.[character.id] || []), response.file_url]) } }); next.characters = next.characters.map((item) => item.id === character.id ? { ...item, active_look_reference_url: response.file_url, look_reference_images: uniqueImages([...(item.look_reference_images || []), response.file_url]) } : item); setProject(next); await onSave(next, { silent: true }); } catch (error) { toast.error(error.message || 'Unable to create look'); } finally { setBusy(''); } };
  const publishProject = async (publication) => {
    if (!project.id) return toast.error('Save the project before publishing');
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

  const leftTools = [{ key: 'story', label: 'Story & narration', icon: Type }, { key: 'cast', label: 'Set & cast', icon: Users }, { key: 'references', label: 'References & looks', icon: UserRound }, { key: 'direction', label: 'Visual direction', icon: Film }, { key: 'adjust', label: 'Adjust image', icon: Wand2 }];
  const rightTools = [{ key: 'panel', label: 'Selected frame', icon: PanelLeft }, { key: 'text', label: 'Text boxes', icon: MessageSquareText }, { key: 'voice', label: 'Voice & audio', icon: Mic2 }, { key: 'master', label: 'Sequence master', icon: Eye }, { key: 'files', label: 'Files', icon: FolderOpen }, { key: 'approve', label: 'Generate & approve', icon: Check }];
  const selectedSide = leftTools.some((item) => item.key === tool) ? 'left' : 'right';
  const setToolOpen = (key) => setTool((current) => current === key ? '' : key);
  const updateTextBox = (id, values) => change({ text_boxes: boxes.map((box) => box.id === id ? { ...box, ...values } : box) });
  const deleteTextBox = (id) => change({ text_boxes: boxes.filter((box) => box.id !== id) });

  const drawer = tool ? <div className={`absolute top-0 z-40 h-full w-[430px] max-w-[calc(100%-130px)] overflow-y-auto border-white/10 shadow-2xl ${selectedSide === 'left' ? 'left-[62px] border-r' : 'right-[62px] border-l'}`} style={{ backgroundColor: '#111418' }}><div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 px-4 py-3" style={{ backgroundColor: '#111418' }}><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#23c7be]">FotoPlay tool</p><p className="font-black">{[...leftTools, ...rightTools].find((item) => item.key === tool)?.label}</p></div><button onClick={() => setTool('')} className="p-2 text-white/70"><X size={18} /></button></div><div className="space-y-5 p-4" style={{ backgroundColor: '#111418' }}>
    {tool === 'story' && <><textarea value={segment.summary || ''} onChange={(event) => change({ summary: event.target.value })} rows={3} className={dark} placeholder="What happens in this segment?" /><textarea value={segment.narration_text || ''} onChange={(event) => change({ narration_text: event.target.value, audio_stale: Boolean(segment.narration_url) })} rows={8} className={dark} placeholder="Narration and dialogue" /></>}
    {tool === 'cast' && <><ChoiceGrid title="Set" icon={MapPin} items={project.locations} selected={segment.location_ids} onToggle={(id) => toggle('location_ids', id)} /><ChoiceGrid title="Characters" icon={Users} items={project.characters} selected={segment.character_ids} onToggle={(id) => toggle('character_ids', id)} /><div className="flex flex-wrap gap-2">{TIME_OPTIONS.map((time) => <button type="button" key={time} onClick={() => toggle('time_periods', time)} className={`border px-3 py-2 text-xs font-black ${segment.time_periods.includes(time) ? 'border-[#23c7be] bg-[#23c7be] text-black' : 'border-white/10 bg-[#1b1f24]'}`}><Clock3 size={12} className="mr-1 inline" />{time}</button>)}</div></>}
    {tool === 'references' && <><div className="space-y-3">{locations.map((location) => <ReferencePicker key={location.id} title={`${location.name} · set references`} images={assetGallery(location, catalogGalleries)} selected={selectedRefs(location, 'location_reference_images')} onChange={(images) => change({ location_reference_images: { ...segment.location_reference_images, [location.id]: images }, comic_page_source: '' })} />)}</div>{characters.map((character) => { const value = { ...(active.appearance_continuity?.[character.id] || {}), ...(segment.character_directions?.[character.id] || {}) }; const set = (field, next) => change({ character_directions: { ...segment.character_directions, [character.id]: { ...(segment.character_directions?.[character.id] || {}), [field]: next } } }); return <div key={character.id} className="border border-white/10 bg-[#181c21] p-3"><div className="mb-3 flex items-center gap-3"><img src={character.active_look_reference_url || character.image_url} alt="" className="h-12 w-12 object-cover" /><div><p className="font-black">{character.name}</p><p className="text-[10px] text-white/40">Active reference</p></div></div><ReferencePicker title="Identity references" images={assetGallery(character, catalogGalleries)} selected={selectedRefs(character, 'character_reference_images')} onChange={(images) => change({ character_reference_images: { ...segment.character_reference_images, [character.id]: images }, comic_page_source: '' })} /><div className="mt-3 grid grid-cols-2 gap-2"><input className={dark} value={value.look || ''} onChange={(e) => set('look', e.target.value)} placeholder="Appearance" /><input className={dark} value={value.costume || ''} onChange={(e) => set('costume', e.target.value)} placeholder="Costume" /><input className={dark} value={value.hair_makeup_accessories || ''} onChange={(e) => set('hair_makeup_accessories', e.target.value)} placeholder="Hair / makeup" /><input className={dark} value={value.physical_state || ''} onChange={(e) => set('physical_state', e.target.value)} placeholder="State" /><input className={dark} value={value.position || ''} onChange={(e) => set('position', e.target.value)} placeholder="Position" /><input className={dark} value={value.expression || ''} onChange={(e) => set('expression', e.target.value)} placeholder="Expression" /></div><button onClick={() => createLook(character)} disabled={busy === `look-${character.id}`} className={`${action} mt-3 w-full bg-[#23c7be] text-black`}>{busy === `look-${character.id}` ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Create & use look · {pricing.compose_scene ?? '—'}</button></div>; })}</>}
    {tool === 'direction' && <><div className="grid grid-cols-2 gap-2"><label className="text-[10px] font-black uppercase text-white/45">Panels<select value={panelCount} onChange={(event) => change({ comic_panel_count: Number(event.target.value), comic_page_source: '' })} className={`${dark} mt-1`}>{[2,3,4].map((count) => <option key={count} className="text-black" value={count}>{count}</option>)}</select></label><label className="text-[10px] font-black uppercase text-white/45">Page ratio<select value={active.image_aspect_ratio || '16:9'} onChange={(event) => setProject((current) => ({ ...current, chapters: current.chapters.map((chapter) => chapter.id === active.id ? { ...chapter, image_aspect_ratio: event.target.value } : chapter) }))} className={`${dark} mt-1`}>{IMAGE_RATIOS.map((ratio) => <option key={ratio} className="text-black">{ratio}</option>)}</select></label></div><input value={segment.exact_area || ''} onChange={(e) => change({ exact_area: e.target.value })} className={dark} placeholder="Exact set area" /><input value={segment.environment_direction || ''} onChange={(e) => change({ environment_direction: e.target.value })} className={dark} placeholder="Light, weather, atmosphere" /><input value={segment.fixed_set_elements || ''} onChange={(e) => change({ fixed_set_elements: e.target.value })} className={dark} placeholder="Fixed set elements" /><textarea value={segment.image_instruction || ''} onChange={(e) => change({ image_instruction: e.target.value, comic_page_source: '' })} rows={8} className={dark} placeholder="Shared visual direction for the page" /><button onClick={buildDirection} disabled={busy === 'direction'} className={`${action} w-full bg-[#23c7be] text-black`}>{busy === 'direction' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Build shared direction · {pricing.ai_text ?? '—'}</button></>}
    {tool === 'adjust' && <StoryImageAdjustment userEmail={user?.email || ''} imageName={`${project.title} - Segment ${segment.number}`} segment={segment} ratio={active.image_aspect_ratio || '16:9'} panelRatio="1:1" price={pricing.compose_scene} busy={busy} setBusy={setBusy} onApply={applyAdjustment} referenceImages={refs} />}
    {tool === 'panel' && selected && <><div className="flex items-center justify-between"><p className="font-black text-[#23c7be]">Frame {selectedPanel + 1}</p><button onClick={planPanels} disabled={busy === 'plan'} className={`${action} bg-[#1b1f24]`}>{busy === 'plan' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Plan all · {pricing.ai_text ?? '—'}</button></div><input value={selected.beat || ''} onChange={(e) => updatePanel(selectedPanel, { beat: e.target.value })} className={dark} placeholder="Story beat" /><select value={selected.shot || 'Medium shot'} onChange={(e) => updatePanel(selectedPanel, { shot: e.target.value })} className={dark}>{IMAGE_TYPES.map((type) => <option key={type} className="text-black">{type}</option>)}</select><textarea value={selected.prompt || ''} onChange={(e) => updatePanel(selectedPanel, { prompt: e.target.value })} rows={8} className={dark} placeholder="Action and composition for this frame" /><button onClick={() => generatePanel(selectedPanel)} disabled={busy === `panel-${selectedPanel}`} className={`${action} w-full bg-[#23c7be] text-black`}>{busy === `panel-${selectedPanel}` ? <Loader2 size={14} className="animate-spin" /> : selected.image_url ? <RotateCcw size={14} /> : <ImageIcon size={14} />} {selected.image_url ? 'Regenerate frame' : 'Generate frame'} · {pricing.compose_scene ?? '—'}</button><label className={`${action} w-full cursor-pointer bg-[#1b1f24]`}><Upload size={14} /> Upload frame<input type="file" className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; uploadPanel(selectedPanel, file); }} /></label>{selected.image_url && <button onClick={() => selectMaster(selected.image_url, 'panel', `Segment ${segment.number} · frame ${selectedPanel + 1}`)} className={`${action} w-full bg-[#1b1f24]`}>Use selected frame as sequence master</button>}</>}
    {tool === 'text' && <><div className="border border-white/10 bg-[#181c21] p-3"><p className="text-xs text-white/65">Add a block, then move and resize it directly on the page. Select a dialogue block to control its pointer.</p><div className="mt-3 flex gap-2"><button onClick={() => change({ text_boxes: [...boxes, { id: crypto.randomUUID(), type: 'narration', text: segment.narration_text || '', x: 6, y: 6, width: 42, height: 16, font_size: 26, tail_side: 'bottom', tail_position: 50, tail_size: 22 }] })} className={`${action} flex-1 bg-white text-black`}><Type size={14} /> Narration</button><button onClick={() => change({ text_boxes: [...boxes, { id: crypto.randomUUID(), type: 'dialogue', text: '', x: 48, y: 60, width: 36, height: 14, font_size: 26, tail_side: 'bottom', tail_position: 50, tail_size: 22 }] })} className={`${action} flex-1 bg-white text-black`}><MessageSquareText size={14} /> Dialogue</button></div></div>{boxes.map((box, index) => <div key={box.id} className="space-y-3 border border-white/10 bg-[#181c21] p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-black uppercase text-[#23c7be]">{box.type === 'dialogue' ? 'Dialogue' : 'Narration'} {index + 1}</p><button onClick={() => deleteTextBox(box.id)} className="flex items-center gap-1 bg-red-500/20 px-2 py-1 text-[10px] font-black text-red-200"><Trash2 size={12} /> Delete block</button></div><div className="grid grid-cols-[130px_1fr] gap-2"><select value={box.type} onChange={(e) => updateTextBox(box.id, { type: e.target.value })} className={dark}><option className="text-black" value="narration">Narration</option><option className="text-black" value="dialogue">Dialogue</option></select><textarea value={box.text} onChange={(e) => updateTextBox(box.id, { text: e.target.value })} rows={3} className={dark} /></div><label className="block text-[10px] font-black uppercase text-white/50">Text size · {box.font_size}<input type="range" min="16" max="50" value={box.font_size} onChange={(e) => updateTextBox(box.id, { font_size: Number(e.target.value) })} className="mt-2 w-full accent-[#23c7be]" /></label>{box.type === 'dialogue' && <div className="space-y-3 border-t border-white/10 pt-3"><div><p className="mb-2 text-[10px] font-black uppercase text-white/50">Pointer side</p><div className="grid grid-cols-4 gap-2">{['top','right','bottom','left'].map((side) => <button key={side} onClick={() => updateTextBox(box.id, { tail_side: side })} className={`${action} ${box.tail_side === side ? 'bg-[#23c7be] text-black' : 'bg-[#242930] text-white'}`}>{side}</button>)}</div></div><label className="block text-[10px] font-black uppercase text-white/50">Pointer position · {box.tail_position}%<input type="range" min="10" max="90" value={box.tail_position} onChange={(e) => updateTextBox(box.id, { tail_position: Number(e.target.value) })} className="mt-2 w-full accent-[#23c7be]" /></label><label className="block text-[10px] font-black uppercase text-white/50">Pointer size · {box.tail_size}%<input type="range" min="10" max="50" value={box.tail_size} onChange={(e) => updateTextBox(box.id, { tail_size: Number(e.target.value) })} className="mt-2 w-full accent-[#23c7be]" /></label></div>}</div>)}</>}
    {tool === 'voice' && <><VoicePicker value={segment.narrator_voice || ''} onChange={(value) => change({ narrator_voice: value, audio_stale: Boolean(segment.narration_url) })} language={segment.narrator_language || project.production_settings?.narrator_language || 'en'} onLanguageChange={(value) => change({ narrator_language: value, audio_stale: Boolean(segment.narration_url) })} disabled={Boolean(busy)} />{segment.narration_url && <audio controls src={segment.narration_url} className="w-full" />}<button onClick={generateAudio} disabled={busy === 'audio'} className={`${action} w-full bg-[#23c7be] text-black`}><Volume2 size={14} /> {segment.narration_url ? 'Regenerate' : 'Generate'} audio · {pricing.tts ?? '—'}</button></>}
    {tool === 'master' && <><div className="flex items-center gap-3 border border-white/10 bg-[#181c21] p-3">{active.master_reference_url ? <img src={active.master_reference_url} alt="" className="h-20 w-20 object-cover" /> : <div className="h-20 w-20 bg-[#242930]" />}<div><p className="font-black text-[#23c7be]">Sequence master</p><p className="text-xs text-white/45">{active.master_reference_label || 'No master selected'}</p></div></div><div className="grid grid-cols-2 gap-2"><button onClick={() => setShowMasterVault(true)} className={`${action} bg-white text-black`}>Vault</button><label className={`${action} cursor-pointer bg-[#1b1f24]`}><Upload size={14} /> Upload<input ref={masterUploadRef} type="file" accept="image/*" className="hidden" onChange={uploadMaster} /></label><button onClick={() => setShowMasterShop(true)} className={`${action} bg-[#1b1f24]`}><Store size={14} /> Assets Shop</button>{active.master_reference_url && <button onClick={() => persist({}, { master_reference_url: '', master_reference_source: '', master_reference_label: '' })} className={`${action} bg-red-500/20 text-red-200`}>Clear</button>}</div></>}
    {tool === 'files' && <><p className="text-xs font-black uppercase text-white/45">Selected frame</p><StoryImageFileActions url={selected?.image_url} userEmail={user?.email || ''} name={`${project.title} - Segment ${segment.number} - Frame ${selectedPanel + 1}`} ratio="1:1" /><p className="pt-2 text-xs font-black uppercase text-white/45">Final page</p><StoryImageFileActions url={segment.image_url} userEmail={user?.email || ''} name={`${project.title} - Segment ${segment.number}`} ratio={active.image_aspect_ratio || '16:9'} /></>}
    {tool === 'approve' && <><div className="border border-white/10 bg-[#181c21] p-3"><p className="font-black">Segment {segment.number}</p><p className="mt-1 text-xs text-white/50">{allLeavesReady ? 'All current frames have images.' : 'One or more frames still need images.'}</p><p className="mt-1 text-xs text-white/50">{segment.narrator_voice ? `Voice: ${segment.narrator_voice}` : 'Voice not selected.'}</p></div><button onClick={generateCurrent} disabled={Boolean(busy)} className={`${action} w-full bg-[#23c7be] text-black`}><Play size={14} /> Synchronize current segment</button>{segment.status === 'approved' ? <button onClick={() => change({ status: 'draft' })} className={`${action} w-full bg-[#1b1f24]`}>Unlock segment</button> : <button onClick={approve} disabled={Boolean(busy)} className={`${action} w-full bg-emerald-400 text-black`}><Check size={14} /> Approve segment {segment.number}</button>}</>}
  </div></div> : null;

  return <div className="mx-auto w-full max-w-[1900px] px-3 pb-6 lg:px-4">
    <header className="mb-3 flex flex-wrap items-center gap-3 border-b border-black/10 bg-white px-2 py-2 text-black"><button onClick={onBack} className="flex h-10 w-10 items-center justify-center bg-black text-white"><ArrowLeft size={18} /></button><div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.16em] text-black/45">FotoPlay page editor</p><h2 className="truncate text-lg font-black">{project.title} · Chapter {active.number} · Segment {segment.number}</h2></div><button onClick={onEditSetup} className="border border-black/15 px-3 py-2 text-xs font-black">Story / cast</button><button onClick={() => setShowPreview(true)} className="flex items-center gap-2 border border-black/15 px-3 py-2 text-xs font-black"><Eye size={15} /> Preview</button><button onClick={() => setShowExport(true)} className="flex items-center gap-2 border border-black/15 px-3 py-2 text-xs font-black"><Download size={15} /> Export</button>{project.published_dossier_id && <a href={`/Magazine?dossier=${encodeURIComponent(project.published_dossier_id)}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 border border-emerald-600 bg-emerald-600 px-3 py-2 text-xs font-black text-white"><ExternalLink size={15} /> Published</a>}<button onClick={() => setShowPublish(true)} disabled={publishing} className="flex items-center gap-2 bg-[#23c7be] px-3 py-2 text-xs font-black text-black">{publishing ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />} {project.published_dossier_id ? 'Republish' : 'Publish'}</button><button onClick={() => onSave(project)} disabled={saving} className="flex items-center gap-2 bg-black px-3 py-2 text-xs font-black text-white">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save</button></header>
    <div className="mb-3 flex gap-2 overflow-x-auto bg-black/5 p-2">{project.chapters.map((chapter) => <button key={chapter.id} onClick={() => setActiveChapterId(chapter.id)} className={`shrink-0 border px-3 py-2 text-xs font-black ${chapter.id === activeChapterId ? 'border-black bg-black text-white' : 'border-black/10 bg-white'}`}>Chapter {chapter.number}</button>)}</div>
    <div className="mb-3 grid grid-cols-9 gap-1 bg-[#111418] p-2">{active.segments.map((item, index) => <button key={item.id} disabled={index > currentIndex} onClick={() => setSelectedId(item.id)} className={`h-8 border text-xs font-black ${item.status === 'approved' ? 'border-emerald-400 bg-emerald-400 text-black' : item.id === segment.id ? 'border-[#23c7be] bg-[#23c7be] text-black' : index > currentIndex ? 'border-white/5 text-white/20' : 'border-white/15 text-white/70'}`}>{item.status === 'approved' ? <Check size={13} className="mx-auto" /> : item.number}</button>)}</div>
    {notice && <div className="mb-3 flex items-center justify-between border border-[#23c7be]/30 bg-[#102826] px-3 py-2 text-xs font-bold text-[#bffaf5]"><span>{notice}</span><button onClick={() => setNotice('')}><X size={14} /></button></div>}
    <div className="relative h-[calc(100vh-230px)] min-h-[520px] overflow-hidden border border-white/10 bg-[#0d1013] text-white">
      <div className="grid h-full grid-cols-[62px_minmax(0,1fr)_62px]">
        <aside className="z-30 flex flex-col items-center gap-2 border-r border-white/10 bg-[#0b0d10] py-3">{leftTools.map((item) => <ToolButton key={item.key} tool={item} active={tool === item.key} onClick={() => setToolOpen(item.key)} />)}</aside>
        <main className="flex min-w-0 flex-col items-center justify-center overflow-hidden p-4"><div className="mb-3 flex w-full max-w-[1100px] items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-[#23c7be]">Working page</p><p className="text-xs text-white/45">Click a frame, then choose a tool. The whole page stays visible while you work.</p></div><span className="border border-white/10 bg-[#16191d] px-2 py-1 text-[10px] font-black text-white/50">{active.image_aspect_ratio || '16:9'} · {panelCount} frames</span></div><PageCanvas panels={panels} ratio={active.image_aspect_ratio || '16:9'} selectedPanel={selectedPanel} onSelectPanel={(index) => { setSelectedPanel(index); if (!tool) setTool('panel'); }} boxes={boxes} textMode={tool === 'text'} onBoxesChange={(next) => change({ text_boxes: next })} /></main>
        <aside className="z-30 flex flex-col items-center gap-2 border-l border-white/10 bg-[#0b0d10] py-3">{rightTools.map((item) => <ToolButton key={item.key} tool={item} active={tool === item.key} onClick={() => setToolOpen(item.key)} />)}</aside>
      </div>{drawer}
    </div>
    {showMasterVault && <VaultPickerModal userEmail={user?.email || ''} allowUpload onSelect={(url) => selectMaster(url, 'vault', 'Vault image')} onClose={() => setShowMasterVault(false)} />}
    {showMasterShop && <OloShopPicker onSelect={(url, label) => selectMaster(url, 'assets_shop', label)} onClose={() => setShowMasterShop(false)} />}
    {showPreview && <FotoPlayPreviewModal project={project} activeChapterId={activeChapterId} onClose={() => setShowPreview(false)} />}
    {showExport && <FotoPlayExportModal project={project} activeChapterId={activeChapterId} onClose={() => setShowExport(false)} />}
    {showPublish && <FotoPlayPublishModal user={user} project={project} publishing={publishing} onClose={() => setShowPublish(false)} onPublish={publishProject} />}
  </div>;
}
