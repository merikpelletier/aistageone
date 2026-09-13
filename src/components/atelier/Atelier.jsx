import React, { useEffect, useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Type, Image as ImageIcon, Save, Download, LayoutTemplate, FolderOpen, ArrowUp, ArrowDown, Wand2, Eye, EyeOff, AlignCenter, AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter, Square, Copy as CopyIcon, Lock, Unlock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import AtelierLayer from '@/components/atelier/AtelierLayer';
import AtelierAssetPicker from '@/components/atelier/AtelierAssetPicker';
import AtelierGenerateModal from '@/components/atelier/AtelierGenerateModal';

const CANVAS = {
  portrait: { w: 360, h: 540 },
  landscape: { w: 640, h: 360 },
  square: { w: 600, h: 600 },
};

const TEMPLATES = [
  { key: 'cover', label: 'Cover', canvas: 'portrait' },
  { key: 'portrait_full', label: 'Portrait', canvas: 'portrait' },
  { key: 'spread', label: 'Spread', canvas: 'landscape' },
  { key: 'grid', label: 'Grid', canvas: 'square' },
];

const FONTS = [
  { label: 'Georgia', value: 'Georgia, "Times New Roman", serif', kind: 'Serif' },
  { label: 'Garamond', value: '"EB Garamond", Garamond, "Palatino Linotype", serif', kind: 'Serif' },
  { label: 'Palatino', value: '"Palatino Linotype", "Book Antiqua", Palatino, serif', kind: 'Serif' },
  { label: 'Times', value: '"Times New Roman", Times, serif', kind: 'Serif' },
  { label: 'Inter', value: 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif', kind: 'Sans' },
  { label: 'Helvetica', value: '"Helvetica Neue", Helvetica, Arial, sans-serif', kind: 'Sans' },
  { label: 'Trebuchet', value: '"Trebuchet MS", "Lucida Sans Unicode", sans-serif', kind: 'Sans' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif', kind: 'Sans' },
  { label: 'Impact', value: 'Impact, "Haettenschweiler", "Arial Narrow Bold", sans-serif', kind: 'Display' },
  { label: 'Copperplate', value: '"Copperplate", "Copperplate Gothic Light", "Papyrus", fantasy', kind: 'Display' },
  { label: 'Courier', value: '"Courier New", Courier, monospace', kind: 'Mono' },
  { label: 'Brush', value: '"Brush Script MT", "Lucida Handwriting", cursive', kind: 'Script' },
];

function templateLayers(template, canvas) {
  const { w, h } = CANVAS[canvas];
  if (template === 'cover') return [
    { id: 't1', type: 'text', content: 'TITLE', x: 20, y: 40, w: w - 40, h: 90, zIndex: 3, fontSize: 48, color: '#ffffff', fontWeight: 800, align: 'center', fontFamily: 'Georgia, serif' },
    { id: 't2', type: 'text', content: 'Subtitle', x: 20, y: 140, w: w - 40, h: 40, zIndex: 3, fontSize: 18, color: '#fde047', fontWeight: 600, align: 'center', fontFamily: 'Georgia, serif' },
  ];
  if (template === 'portrait_full') return [
    { id: 'cap', type: 'text', content: 'Caption', x: 20, y: h - 70, w: w - 40, h: 40, zIndex: 3, fontSize: 16, color: '#ffffff', fontWeight: 600, align: 'center', fontFamily: 'Georgia, serif' },
  ];
  if (template === 'spread') return [
    { id: 'h', type: 'text', content: 'HEADLINE', x: w / 2 - 140, y: 16, w: 280, h: 50, zIndex: 3, fontSize: 30, color: '#ffffff', fontWeight: 800, align: 'center', fontFamily: 'Georgia, serif' },
  ];
  if (template === 'grid') return [
    { id: 'g', type: 'text', content: 'Caption', x: 20, y: h - 50, w: w - 40, h: 30, zIndex: 3, fontSize: 14, color: '#ffffff', fontWeight: 600, align: 'center', fontFamily: 'Georgia, serif' },
  ];
  return [];
}

const uid = () => Math.random().toString(36).slice(2, 9);

const loadExportImage = (url) => new Promise((resolve, reject) => {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error(`Unable to load image: ${url}`));
  image.src = url;
});

function wrapExportText(ctx, text, maxWidth, letterSpacing = 0) {
  const widthOf = (value) => ctx.measureText(value).width + Math.max(0, value.length - 1) * letterSpacing;
  return String(text || '').split('\n').flatMap((paragraph) => {
    if (!paragraph) return [''];
    const words = paragraph.split(/\s+/); const lines = []; let line = '';
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (line && widthOf(candidate) > maxWidth) { lines.push(line); line = word; }
      else line = candidate;
    });
    if (line) lines.push(line);
    return lines;
  });
}

function drawExportText(ctx, text, x, y, letterSpacing) {
  if (!letterSpacing) { ctx.fillText(text, x, y); return; }
  const widths = [...text].map((character) => ctx.measureText(character).width);
  const total = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, text.length - 1) * letterSpacing;
  let cursor = ctx.textAlign === 'center' ? x - total / 2 : ctx.textAlign === 'right' ? x - total : x;
  ctx.save(); ctx.textAlign = 'left';
  [...text].forEach((character, index) => { ctx.fillText(character, cursor, y); cursor += widths[index] + letterSpacing; });
  ctx.restore();
}

async function renderPageToCanvas(page) {
  const bounds = CANVAS[page.canvas]; const scale = 2;
  const output = document.createElement('canvas'); output.width = bounds.w * scale; output.height = bounds.h * scale;
  const ctx = output.getContext('2d'); ctx.scale(scale, scale); ctx.fillStyle = page.background_color || '#111111'; ctx.fillRect(0, 0, bounds.w, bounds.h);
  if (document.fonts?.ready) await document.fonts.ready;
  if (page.background_url) {
    const image = await loadExportImage(page.background_url); const ratio = Math.max(bounds.w / image.naturalWidth, bounds.h / image.naturalHeight);
    const width = image.naturalWidth * ratio; const height = image.naturalHeight * ratio;
    ctx.drawImage(image, (bounds.w - width) / 2, (bounds.h - height) / 2, width, height);
  }
  const layers = [...page.layers].filter((layer) => !layer.hidden).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  for (const layer of layers) {
    ctx.save(); ctx.globalAlpha = layer.opacity ?? 1; const centerX = layer.x + layer.w / 2; const centerY = layer.y + layer.h / 2;
    ctx.translate(centerX, centerY); ctx.rotate((layer.rotation || 0) * Math.PI / 180); ctx.translate(-centerX, -centerY);
    if (layer.type === 'image') {
      const image = await loadExportImage(layer.url); const fit = layer.objectFit || 'cover'; const ratio = fit === 'contain' ? Math.min(layer.w / image.naturalWidth, layer.h / image.naturalHeight) : Math.max(layer.w / image.naturalWidth, layer.h / image.naturalHeight);
      const width = image.naturalWidth * ratio; const height = image.naturalHeight * ratio;
      ctx.beginPath(); if (ctx.roundRect && layer.radius) ctx.roundRect(layer.x, layer.y, layer.w, layer.h, layer.radius); else ctx.rect(layer.x, layer.y, layer.w, layer.h); ctx.clip();
      ctx.drawImage(image, layer.x + (layer.w - width) / 2, layer.y + (layer.h - height) / 2, width, height);
    } else {
      const size = Number(layer.fontSize) || 18; const spacing = Number(layer.letterSpacing) || 0; const content = layer.uppercase ? String(layer.content || '').toUpperCase() : String(layer.content || '');
      ctx.font = `${Number(layer.fontWeight) || 700} ${size}px ${layer.fontFamily || 'Georgia, serif'}`; ctx.fillStyle = layer.color || '#ffffff'; ctx.textAlign = layer.align || 'center'; ctx.textBaseline = 'middle';
      const lines = wrapExportText(ctx, content, layer.w, spacing); const lineHeight = size * 1.1; const firstY = layer.y + layer.h / 2 - ((lines.length - 1) * lineHeight) / 2;
      const textX = ctx.textAlign === 'left' ? layer.x : ctx.textAlign === 'right' ? layer.x + layer.w : layer.x + layer.w / 2;
      lines.forEach((line, index) => drawExportText(ctx, line, textX, firstY + index * lineHeight, spacing));
    }
    ctx.restore();
  }
  return output;
}

export default function Atelier({ user, onClose }) {
  const qc = useQueryClient();
  const canvasRef = useRef(null);
  const [page, setPage] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!page || !selectedId || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      const layer = page.layers.find((item) => item.id === selectedId);
      if (!layer) return;
      if ((event.key === 'Delete' || event.key === 'Backspace') && !layer.locked) { event.preventDefault(); deleteLayer(selectedId); return; }
      if (layer.locked || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault(); const step = event.shiftKey ? 10 : 1;
      updateLayer(selectedId, { x: Math.max(0, Math.min(CANVAS[page.canvas].w - layer.w, layer.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0))), y: Math.max(0, Math.min(CANVAS[page.canvas].h - layer.h, layer.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0))) });
    };
    window.addEventListener('keydown', onKeyDown); return () => window.removeEventListener('keydown', onKeyDown);
  }, [page, selectedId]);

  const { data: saved = [] } = useQuery({
    queryKey: ['magazinePages', user?.email],
    queryFn: () => base44.entities.MagazinePage.filter({ user_email: user.email }, '-updated_date'),
    enabled: !!user?.email,
  });

  const newPage = (templateKey) => {
    const t = TEMPLATES.find(t => t.key === templateKey);
    setPage({ title: 'Untitled', template: templateKey, canvas: t.canvas, background_url: '', background_color: '#111111', layers: templateLayers(templateKey, t.canvas) });
  };

  const openPage = (p) => {
    setPage({ id: p.id, title: p.title, template: p.template, canvas: p.canvas, background_url: p.background_url || '', background_color: p.background_color || '#111111', layers: p.layers || [] });
  };

  const updateLayer = (id, patch) => setPage(p => ({ ...p, layers: p.layers.map(l => l.id === id && !l.locked ? { ...l, ...patch } : l) }));
  const deleteLayer = (id) => { setPage(p => ({ ...p, layers: p.layers.filter(l => l.id !== id) })); setSelectedId(current => current === id ? null : current); };
  const duplicateLayer = (id) => {
    const copyId = uid();
    setPage(p => {
      const src = p.layers.find(l => l.id === id);
      if (!src) return p;
      const bounds = CANVAS[p.canvas];
      const copy = { ...src, id: copyId, x: Math.min(bounds.w - src.w, src.x + 16), y: Math.min(bounds.h - src.h, src.y + 16), zIndex: (Math.max(0, ...p.layers.map(l => l.zIndex || 0)) + 1), locked: false };
      return { ...p, layers: [...p.layers, copy] };
    });
    setSelectedId(copyId);
  };
  const toggleVisible = (id) => setPage(p => ({ ...p, layers: p.layers.map(l => l.id === id ? { ...l, hidden: !l.hidden } : l) }));
  const toggleLocked = (id) => setPage(p => ({ ...p, layers: p.layers.map(l => l.id === id ? { ...l, locked: !l.locked } : l) }));
  const addImage = (url, opts = {}) => {
    const id = uid();
    setPage(p => {
      const { w, h } = CANVAS[p.canvas];
      const cover = opts.cover;
      const layer = {
        id, type: 'image', url,
        x: cover ? 0 : 30, y: cover ? 0 : 30,
        w: cover ? w : 160, h: cover ? h : 200,
        zIndex: (Math.max(0, ...p.layers.map(l => l.zIndex || 0)) + 1), objectFit: 'cover', opacity: 1, rotation: 0, radius: 0, locked: false,
      };
      return { ...p, layers: [...p.layers, layer] };
    });
    setSelectedId(id);
    setShowPicker(false);
    setShowGenerate(false);
  };
  const addText = () => {
    const id = uid();
    setPage(p => ({ ...p, layers: [...p.layers, { id, type: 'text', content: 'New text', x: 40, y: 40, w: Math.min(240, CANVAS[p.canvas].w - 80), h: 60, zIndex: (Math.max(0, ...p.layers.map(l => l.zIndex || 0)) + 1), fontSize: 24, color: '#ffffff', fontWeight: 700, align: 'center', fontFamily: 'Georgia, serif', opacity: 1, rotation: 0, locked: false }] }));
    setSelectedId(id);
  };
  const reorder = (id, dir) => setPage(p => {
    const ordered = [...p.layers].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)); const index = ordered.findIndex(l => l.id === id); const target = dir === 'up' ? index + 1 : index - 1;
    if (index < 0 || target < 0 || target >= ordered.length) return p;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    const zIndex = Object.fromEntries(ordered.map((layer, order) => [layer.id, order + 1]));
    return { ...p, layers: p.layers.map(l => ({ ...l, zIndex: zIndex[l.id] })) };
  });
  const centerLayer = (axis) => {
    if (!selectedId) return;
    const { w, h } = CANVAS[page.canvas];
    const l = page.layers.find(x => x.id === selectedId);
    if (!l) return;
    if (axis === 'h') updateLayer(selectedId, { x: Math.round((w - l.w) / 2) });
    if (axis === 'v') updateLayer(selectedId, { y: Math.round((h - l.h) / 2) });
  };

  const handleSave = async () => {
    if (!page.title.trim()) { toast.error('Add a title'); return; }
    setSaving(true);
    try {
      const payload = { user_email: user.email, title: page.title.trim(), template: page.template, canvas: page.canvas, background_url: page.background_url || null, background_color: page.background_color || '#111111', layers: page.layers };
      if (page.id) await base44.entities.MagazinePage.update(page.id, payload);
      else { const created = await base44.entities.MagazinePage.create(payload); setPage({ ...page, id: created.id }); }
      qc.invalidateQueries({ queryKey: ['magazinePages', user.email] });
      toast.success('Page saved');
    } catch { toast.error('Save failed'); }
    setSaving(false);
  };

  const handleExport = async () => {
    if (!canvasRef.current) return;
    setSelectedId(null);
    try {
      const canvas = await renderPageToCanvas(page);
      const link = document.createElement('a');
      link.download = `${(page.title || 'page').replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch { toast.error('Export failed (image may be protected)'); }
  };

  // ── Browser (no page selected) ──
  if (!page) {
    return (
      <div className="min-h-screen bg-zinc-900 pb-20">
        <div className="px-5 pt-12 pb-4">
          <button onClick={onClose} className="flex items-center gap-2 text-white text-sm font-bold mb-6 hover:text-yellow-400"><ChevronLeft size={20} /> Studio</button>
          <h1 className="text-white text-4xl font-bold tracking-tight">Atelier</h1>
          <p className="text-white/60 text-sm font-semibold mt-1">Compose magazine pages from your vault or generate fresh images</p>
        </div>
        <div className="px-5">
          <p className="text-white text-sm font-bold tracking-widest uppercase mb-3">New page — choose a template</p>
          <div className="grid grid-cols-2 gap-3 mb-8">
            {TEMPLATES.map(t => (
              <button key={t.key} onClick={() => newPage(t.key)} className="bg-black rounded-2xl p-5 text-left hover:scale-[1.02] transition-transform shadow-lg">
                <LayoutTemplate className="text-yellow-400 mb-2" size={24} />
                <p className="text-white font-bold">{t.label}</p>
                <p className="text-white/50 text-xs capitalize">{t.canvas}</p>
              </button>
            ))}
          </div>
          <p className="text-white text-sm font-bold tracking-widest uppercase mb-3 flex items-center gap-2"><FolderOpen size={14} /> My pages ({saved.length})</p>
          {saved.length === 0 ? (
            <p className="text-white/50 text-sm">No saved pages yet — pick a template above.</p>
          ) : (
            <div className="space-y-2">
              {saved.map(p => (
                <button key={p.id} onClick={() => openPage(p)} className="w-full bg-black rounded-2xl p-4 flex items-center justify-between hover:bg-neutral-800 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-16 bg-neutral-800 rounded-lg overflow-hidden flex items-center justify-center">
                      {p.background_url ? <img src={p.background_url} alt="" className="w-full h-full object-cover" /> : <LayoutTemplate size={18} className="text-yellow-400" />}
                    </div>
                    <div className="text-left">
                      <p className="text-white font-bold">{p.title}</p>
                      <p className="text-white/50 text-xs capitalize">{p.template} · {p.canvas} · {p.layers?.length || 0} layers</p>
                    </div>
                  </div>
                  <ChevronLeft size={18} className="text-white/40 rotate-180" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Editor ──
  const { w, h } = CANVAS[page.canvas];
  const selected = page.layers.find(l => l.id === selectedId);

  return (
    <div className="min-h-screen bg-zinc-900 pb-32">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-black px-4 py-3 flex items-center gap-3">
        <button onClick={() => { setPage(null); setSelectedId(null); }} className="flex items-center gap-1.5 text-white text-sm font-bold hover:text-yellow-400">
          <ChevronLeft size={20} /> Pages
        </button>
        <input
          value={page.title}
          onChange={e => setPage({ ...page, title: e.target.value })}
          className="flex-1 bg-white/10 border border-white/15 rounded-lg px-3 py-2 text-white text-sm font-bold focus:outline-none focus:border-yellow-400"
          placeholder="Page title"
        />
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 bg-yellow-400 text-black rounded-lg text-sm font-bold disabled:opacity-50">
          {saving ? '…' : <><Save size={15} /> Save</>}
        </button>
        <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 bg-white/10 text-white rounded-lg text-sm font-bold">
          <Download size={15} /> PNG
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 px-4 pt-4">
        {/* Canvas */}
        <div className="flex-1 flex justify-center">
          <div
            ref={canvasRef}
            onPointerDown={() => setSelectedId(null)}
            className="relative shadow-2xl rounded-lg overflow-hidden"
            style={{ width: w, height: h, background: page.background_url ? `url(${page.background_url}) center/cover` : (page.background_color || '#111111') }}
          >
            {!page.background_url && page.layers.length === 0 && (
              <p className="absolute inset-0 flex items-center justify-center text-white/30 text-xs text-center px-6">Add an image or text from the toolbar</p>
            )}
            {page.layers.filter(l => !l.hidden).map(l => (
              <AtelierLayer key={l.id} layer={l} selected={l.id === selectedId} canvasWidth={w} canvasHeight={h} onSelect={setSelectedId} onChange={updateLayer} onDelete={deleteLayer} onDuplicate={duplicateLayer} />
            ))}
          </div>
        </div>

        {/* Side panel */}
        <div className="lg:w-64 space-y-3">
          {/* Add */}
          <div className="bg-black rounded-2xl p-3 space-y-2">
            <p className="text-white/50 text-xs uppercase tracking-wider font-bold">Add</p>
            <button onClick={() => setShowPicker(true)} className="w-full flex items-center gap-2 px-3 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm font-semibold"><ImageIcon size={15} /> Image from vault</button>
            <button onClick={() => setShowGenerate(true)} className="w-full flex items-center gap-2 px-3 py-2.5 bg-yellow-400/20 hover:bg-yellow-400/30 rounded-lg text-yellow-400 text-sm font-semibold"><Wand2 size={15} /> Generate image</button>
            <button onClick={addText} className="w-full flex items-center gap-2 px-3 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm font-semibold"><Type size={15} /> Text layer</button>
          </div>

          {/* Background */}
          <div className="bg-black rounded-2xl p-3 space-y-2">
            <p className="text-white/50 text-xs uppercase tracking-wider font-bold">Background</p>
            <button onClick={() => setShowBgPicker(true)} className="w-full flex items-center gap-2 px-3 py-2.5 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm font-semibold"><ImageIcon size={15} /> {page.background_url ? 'Change image' : 'Image bg'}</button>
            {page.background_url && <button onClick={() => setPage({ ...page, background_url: '' })} className="w-full flex items-center gap-2 px-3 py-2.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/70 text-xs font-semibold">Remove bg image</button>}
            <div className="flex items-center gap-2">
              <span className="text-white/50 text-xs">Color</span>
              <input type="color" value={page.background_color || '#111111'} onChange={e => setPage({ ...page, background_color: e.target.value })} className="w-8 h-8 rounded bg-transparent border border-white/15" />
            </div>
          </div>

          {/* Layers list */}
          <div className="bg-black rounded-2xl p-3 space-y-1.5">
            <p className="text-white/50 text-xs uppercase tracking-wider font-bold mb-1">Layers ({page.layers.length})</p>
            {page.layers.length === 0 && <p className="text-white/30 text-xs">None yet</p>}
            {[...page.layers].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0)).map(l => (
              <div key={l.id} onClick={() => setSelectedId(l.id)} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer ${selectedId === l.id ? 'bg-yellow-400/20 border border-yellow-400/40' : 'hover:bg-white/5'}`}>
                <button onClick={(e) => { e.stopPropagation(); toggleVisible(l.id); }} className="text-white/60 hover:text-white">
                  {l.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); toggleLocked(l.id); }} className="text-white/60 hover:text-white" aria-label={l.locked ? 'Unlock layer' : 'Lock layer'}>
                  {l.locked ? <Lock size={12} /> : <Unlock size={12} />}
                </button>
                <span className="text-white/30 text-[10px] w-4">{l.type === 'image' ? 'IMG' : 'TXT'}</span>
                <span className="text-white text-xs flex-1 truncate">{l.type === 'image' ? (l.url.split('/').pop().slice(0, 16)) : (l.content || 'Text').slice(0, 18)}</span>
                <button onClick={(e) => { e.stopPropagation(); if (!l.locked) deleteLayer(l.id); }} disabled={l.locked} className="text-red-400 hover:text-red-300 disabled:opacity-20" aria-label="Delete layer"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>

          {/* Selected layer controls */}
          {selected && (
            <div className="bg-black rounded-2xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-white/50 text-xs uppercase tracking-wider font-bold">{selected.type === 'image' ? 'Image' : 'Text'}</p>
                <div className="flex gap-1">
                  <button onClick={() => reorder(selected.id, 'up')} className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded flex items-center justify-center"><ArrowUp size={13} className="text-white" /></button>
                  <button onClick={() => reorder(selected.id, 'down')} className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded flex items-center justify-center"><ArrowDown size={13} className="text-white" /></button>
                  <button onClick={() => duplicateLayer(selected.id)} className="w-7 h-7 bg-white/10 hover:bg-white/20 rounded flex items-center justify-center"><CopyIcon size={13} className="text-white" /></button>
                  <button onClick={() => toggleLocked(selected.id)} className={`w-7 h-7 rounded flex items-center justify-center ${selected.locked ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white hover:bg-white/20'}`} aria-label={selected.locked ? 'Unlock layer' : 'Lock layer'}>{selected.locked ? <Lock size={13} /> : <Unlock size={13} />}</button>
                  <button onClick={() => deleteLayer(selected.id)} disabled={selected.locked} className="w-7 h-7 bg-red-500/20 hover:bg-red-500/35 rounded flex items-center justify-center disabled:opacity-20" aria-label="Delete layer"><Trash2 size={13} className="text-red-300" /></button>
                </div>
              </div>

              {/* Common: opacity, rotation, center */}
              <div className="flex items-center gap-2">
                <span className="text-white/50 text-xs w-12">Opacity</span>
                <input type="range" min={0} max={1} step={0.05} value={selected.opacity ?? 1} onChange={e => updateLayer(selected.id, { opacity: Number(e.target.value) })} className="flex-1" />
                <span className="text-white text-xs w-8">{Math.round((selected.opacity ?? 1) * 100)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/50 text-xs w-12">Rotate</span>
                <input type="range" min={-180} max={180} value={selected.rotation || 0} onChange={e => updateLayer(selected.id, { rotation: Number(e.target.value) })} className="flex-1" />
                <span className="text-white text-xs w-10">{selected.rotation || 0}°</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => centerLayer('h')} className="flex-1 py-1.5 bg-white/10 text-white rounded text-xs flex items-center justify-center gap-1"><AlignHorizontalJustifyCenter size={12} /> Center H</button>
                <button onClick={() => centerLayer('v')} className="flex-1 py-1.5 bg-white/10 text-white rounded text-xs flex items-center justify-center gap-1"><AlignVerticalJustifyCenter size={12} /> Center V</button>
              </div>

              {/* Image controls */}
              {selected.type === 'image' && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-white/50 text-xs w-12">Fit</span>
                    <div className="flex gap-1 flex-1">
                      {['cover', 'contain'].map(f => (
                        <button key={f} onClick={() => updateLayer(selected.id, { objectFit: f })} className={`flex-1 py-1.5 rounded text-xs capitalize ${selected.objectFit === f ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white'}`}>{f}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/50 text-xs w-12">Radius</span>
                    <input type="range" min={0} max={60} value={selected.radius || 0} onChange={e => updateLayer(selected.id, { radius: Number(e.target.value) })} className="flex-1" />
                    <span className="text-white text-xs w-8">{selected.radius || 0}</span>
                  </div>
                </>
              )}

              {/* Text controls */}
              {selected.type === 'text' && (
                <>
                  <textarea
                    value={selected.content || ''}
                    onChange={e => updateLayer(selected.id, { content: e.target.value })}
                    rows={2}
                    disabled={selected.locked}
                    className="w-full bg-white/10 border border-white/15 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-yellow-400 resize-none"
                  />
                  <p className="text-[10px] text-white/40">Select the text on the page and type directly. Use the yellow handle to move it.</p>
                  <div className="flex items-center gap-2">
                    <span className="text-white/50 text-xs w-12">Size</span>
                    <input type="range" min={8} max={72} value={selected.fontSize || 18} onChange={e => updateLayer(selected.id, { fontSize: Number(e.target.value) })} className="flex-1" />
                    <span className="text-white text-xs w-7">{selected.fontSize || 18}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/50 text-xs w-12">Color</span>
                    <input type="color" value={selected.color || '#ffffff'} onChange={e => updateLayer(selected.id, { color: e.target.value })} className="w-8 h-8 rounded bg-transparent border border-white/15" />
                  </div>
                  <div>
                    <p className="text-white/50 text-xs mb-1">Font</p>
                    <div className="grid grid-cols-3 gap-1.5 max-h-32 overflow-y-auto pr-1">
                      {FONTS.map(f => (
                        <button key={f.value} onClick={() => updateLayer(selected.id, { fontFamily: f.value })} style={{ fontFamily: f.value }} className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs leading-none ${selected.fontFamily === f.value ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white'}`}>
                          <span>{f.label}</span>
                          <span className="text-[8px] opacity-60">{f.kind}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {[400, 700, 800].map(wt => (
                      <button key={wt} onClick={() => updateLayer(selected.id, { fontWeight: wt })} className={`flex-1 py-1.5 rounded text-xs ${selected.fontWeight === wt ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white'}`}>{wt === 400 ? 'Light' : wt === 700 ? 'Bold' : 'Black'}</button>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    {['left', 'center', 'right'].map(a => (
                      <button key={a} onClick={() => updateLayer(selected.id, { align: a })} className={`flex-1 py-1.5 rounded text-xs capitalize ${selected.align === a ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white'}`}>{a}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/50 text-xs w-12">Letter</span>
                    <input type="range" min={-2} max={12} step={0.5} value={selected.letterSpacing || 0} onChange={e => updateLayer(selected.id, { letterSpacing: Number(e.target.value) })} className="flex-1" />
                    <span className="text-white text-xs w-8">{selected.letterSpacing || 0}</span>
                  </div>
                  <button onClick={() => updateLayer(selected.id, { uppercase: !selected.uppercase })} className={`w-full py-1.5 rounded text-xs font-semibold ${selected.uppercase ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white'}`}>UPPERCASE</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 inset-x-0 bg-black border-t border-white/10 px-4 py-3 flex justify-center gap-3 z-30">
        <button onClick={() => setShowPicker(true)} className="flex items-center gap-1.5 px-4 py-2.5 bg-white/10 text-white rounded-xl text-sm font-bold"><ImageIcon size={16} /> Vault</button>
        <button onClick={() => setShowGenerate(true)} className="flex items-center gap-1.5 px-4 py-2.5 bg-yellow-400 text-black rounded-xl text-sm font-bold"><Wand2 size={16} /> Generate</button>
        <button onClick={addText} className="flex items-center gap-1.5 px-4 py-2.5 bg-white/10 text-white rounded-xl text-sm font-bold"><Type size={16} /> Text</button>
      </div>

      {showPicker && <AtelierAssetPicker userEmail={user?.email} onSelect={addImage} onClose={() => setShowPicker(false)} />}
      {showGenerate && <AtelierGenerateModal userEmail={user?.email} canvasRatio={page.canvas === 'landscape' ? '16:9' : page.canvas === 'square' ? '1:1' : '2:3'} onSelect={addImage} onClose={() => setShowGenerate(false)} />}
      {showBgPicker && (
        <AtelierAssetPicker
          userEmail={user?.email}
          onSelect={(url) => { setPage({ ...page, background_url: url }); setShowBgPicker(false); }}
          onClose={() => setShowBgPicker(false)}
        />
      )}
    </div>
  );
}
