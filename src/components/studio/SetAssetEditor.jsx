import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Bookmark, Check, Loader2, ShoppingBag, Upload, Sparkles, ImagePlus, Camera, Sun, Moon, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import VaultPickerModal from '@/components/studio/VaultPickerModal';
import ImageCropModal from '@/components/studio/ImageCropModal';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';
import { toast } from 'sonner';

const catalogImages = asset => [...new Set([
  asset?.featured_image,
  ...(Array.isArray(asset?.preview_images) ? asset.preview_images : []),
].filter(Boolean))];

const CREATIVE_PRESETS = ['Cinematic', 'Fashion Editorial', 'Gritty Realism', 'Theatrical', 'Retro', 'Minimalist', 'Luxury', 'Futuristic'];
const ERA_OPTIONS = ['Contemporary', '1940s', '1960s', '1980s', 'Near Future', 'Timeless'];
const LIGHTING_OPTIONS = ['Natural', 'Soft Studio', 'High Contrast', 'Neon', 'Moonlight', 'Overcast'];
const TIME_OPTIONS = ['Dawn', 'Day', 'Golden Hour', 'Dusk', 'Night'];
const WEATHER_OPTIONS = ['Clear', 'Cloudy', 'Rain', 'Snow', 'Fog', 'Storm'];
const REALISM_OPTIONS = ['Photoreal', 'Cinematic', 'Stylized', 'Theatrical'];
const IMAGE_ROLES = ['Hero / Establishing', 'Wide', 'Reverse', 'Left', 'Right', 'Detail', 'Day', 'Night'];

const VISUAL_STYLES = {
  Cinematic: 'radial-gradient(circle at 76% 28%, rgba(35,199,190,.36), transparent 28%), linear-gradient(135deg,#061113 0%,#143238 42%,#050708 100%)',
  'Fashion Editorial': 'linear-gradient(125deg,#0d0d0f 0%,#44464a 46%,#111214 47%,#26282b 100%)',
  'Gritty Realism': 'linear-gradient(150deg,#0d1215 0%,#25333a 30%,#0a0d0f 31%,#17191b 66%,#384047 100%)',
  Theatrical: 'radial-gradient(circle at 58% 24%, rgba(255,255,255,.28), transparent 18%), linear-gradient(90deg,#1a0608,#60131a 48%,#120406)',
  Retro: 'linear-gradient(145deg,#1c1913 0%,#746347 42%,#302919 43%,#0d0d0c 100%)',
  Minimalist: 'linear-gradient(135deg,#0e1012 0%,#24272b 46%,#7d858a 47%,#17191c 62%,#0a0b0c 100%)',
  Luxury: 'radial-gradient(circle at 70% 35%, rgba(196,166,105,.34), transparent 24%), linear-gradient(135deg,#080909 0%,#2f2b24 52%,#080909 100%)',
  Futuristic: 'radial-gradient(circle at 60% 40%, rgba(35,199,190,.4), transparent 20%), linear-gradient(120deg,#05070a,#10252b 50%,#0d1115)',
  Contemporary: 'linear-gradient(150deg,#0d1418,#26505a 45%,#101719 46%,#06090a)',
  '1940s': 'linear-gradient(135deg,#151515,#45413b 42%,#0d0d0d 43%,#292622)',
  '1960s': 'linear-gradient(145deg,#1a1c1d,#596264 42%,#9c927d 43%,#161719)',
  '1980s': 'linear-gradient(150deg,#070a12,#173656 45%,#57162b 70%,#08080d)',
  'Near Future': 'linear-gradient(145deg,#0c1115,#33464e 42%,#0b1114 43%,#53646d)',
  Timeless: 'linear-gradient(140deg,#111315,#44484b 44%,#151719 45%,#2b2e31)',
  Natural: 'linear-gradient(145deg,#101613,#526553 45%,#c7b98f 46%,#252a24)',
  'Soft Studio': 'radial-gradient(circle at 68% 35%, rgba(255,255,255,.5), transparent 20%), linear-gradient(135deg,#0b0c0e,#27292c 60%,#0a0b0c)',
  'High Contrast': 'linear-gradient(135deg,#070707 0%,#0a0a0a 44%,#c8c8c8 45%,#292929 58%,#080808 59%)',
  Neon: 'linear-gradient(90deg,#05080c 0%,#0e1015 44%,#18d7cb 45%,#18d7cb 48%,#0a0c10 49%,#4f193f 100%)',
  Moonlight: 'radial-gradient(circle at 72% 27%,#d6e5ea 0%,#9fb7c1 4%,transparent 5%), linear-gradient(160deg,#050811,#142234 48%,#070a10)',
  Overcast: 'linear-gradient(160deg,#171c20,#596168 42%,#2d3439 62%,#0c1013)',
  Dawn: 'linear-gradient(155deg,#1d2230 0%,#b7704a 48%,#e0b27d 70%,#182027)',
  Day: 'linear-gradient(145deg,#89bccc 0%,#dce6e5 45%,#3f5a62 46%,#101719)',
  'Golden Hour': 'linear-gradient(155deg,#1c2024 0%,#aa5e32 46%,#df9c54 70%,#16191c)',
  Dusk: 'linear-gradient(155deg,#101523,#5a4256 48%,#2e2a3a 70%,#0a0d12)',
  Night: 'radial-gradient(circle at 72% 26%,#d8e5e8 0%,#aabfc8 4%,transparent 5%), linear-gradient(160deg,#03060b,#0d1f31 58%,#05070a)',
  Clear: 'linear-gradient(160deg,#1d4f62,#4f91a5 48%,#b6d0d4 49%,#172126)',
  Cloudy: 'linear-gradient(160deg,#1a2024,#5b666c 48%,#31393e 70%,#101417)',
  Rain: 'repeating-linear-gradient(105deg,rgba(255,255,255,.08) 0 1px,transparent 1px 8px),linear-gradient(160deg,#081017,#1d3945 48%,#0a1116)',
  Snow: 'linear-gradient(160deg,#172027,#95a9af 48%,#dde5e6 49%,#4f5c61 75%,#11181d)',
  Fog: 'linear-gradient(160deg,#131719,#596064 40%,#888f90 55%,#303638 75%,#111416)',
  Storm: 'radial-gradient(circle at 70% 30%,rgba(255,255,255,.5),transparent 4%),linear-gradient(160deg,#080a0d,#252c34 45%,#071019 70%,#020406)',
  Photoreal: 'linear-gradient(145deg,#101214,#495056 42%,#8b9193 43%,#23272b 68%,#0b0d0f)',
  Stylized: 'linear-gradient(135deg,#06141a,#125267 42%,#b14b57 61%,#0d1115)'
};

const fieldPattern = label => new RegExp(`^${label.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}:.*$`, 'mi');
const readBriefField = (text, label) => {
  const match = String(text || '').match(new RegExp(`^${label.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}:\\s*(.*)$`, 'mi'));
  return match?.[1]?.trim() || '';
};
const writeBriefField = (text, label, value) => {
  const clean = String(text || '').trim();
  const line = `${label}: ${value}`;
  if (fieldPattern(label).test(clean)) return clean.replace(fieldPattern(label), line);
  return clean ? `${clean}\n${line}` : line;
};

function OloShopSetPicker({ selectedImages, onToggle, onClose }) {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const { data: categories = [] } = useQuery({
    queryKey: ['olo-asset-categories-for-set-picker'],
    queryFn: async () => {
      const { data, error } = await supabase.from('asset_category').select('id,key,label_en,label_fr,display_order').eq('is_active', true).order('display_order', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
  const { data: assets = [], isLoading, error } = useQuery({
    queryKey: ['olo-assets-for-set-picker'],
    queryFn: async () => {
      const { data, error: catalogError } = await supabase.from('catalog_asset').select('id,title,description,featured_image,preview_images,category_id,creator_name,tags').eq('status', 'published').order('title', { ascending: true }).limit(500);
      if (catalogError) throw catalogError;
      return (data || []).filter(asset => catalogImages(asset).length);
    },
  });
  const filteredAssets = useMemo(() => {
    const term = search.trim().toLowerCase();
    return assets.filter(asset => {
      if (categoryId !== 'all' && asset.category_id !== categoryId) return false;
      const tags = Array.isArray(asset.tags) ? asset.tags.join(' ') : String(asset.tags || '');
      return !term || `${asset.title || ''} ${asset.description || ''} ${asset.creator_name || ''} ${tags}`.toLowerCase().includes(term);
    });
  }, [assets, categoryId, search]);

  return (
    <motion.div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/90 p-3 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[4px] border border-white/10 bg-[#17191d] shadow-2xl" initial={{ y: 24, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 24, scale: 0.98 }} onClick={event => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-white/10 p-5">
          <div><p className="text-xs font-black uppercase tracking-[0.24em] text-[#23c7be]">Assets Shop</p><h3 className="mt-1 text-2xl font-black text-white">Choose set references</h3><p className="mt-1 text-xs text-white/45">Choose images from published Assets Shop items.</p></div>
          <button onClick={onClose} className="rounded-[3px] bg-white/10 p-2 text-white hover:bg-white/20"><X size={19} /></button>
        </header>
        <div className="space-y-3 border-b border-white/10 p-4">
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search Assets Shop" className="w-full rounded-[3px] border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#23c7be]" />
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            <button onClick={() => setCategoryId('all')} className={`flex-shrink-0 rounded-[3px] px-4 py-2 text-xs font-black ${categoryId === 'all' ? 'bg-[#23c7be] text-black' : 'bg-white/[0.06] text-white'}`}>All</button>
            {categories.map(category => <button key={category.id} onClick={() => setCategoryId(category.id)} className={`flex-shrink-0 rounded-[3px] px-4 py-2 text-xs font-black ${categoryId === category.id ? 'bg-[#23c7be] text-black' : 'bg-white/[0.06] text-white'}`}>{category.label_en || category.label_fr || category.key}</button>)}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {isLoading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="animate-spin text-[#23c7be]" /></div>
            : error ? <div className="rounded-[4px] border border-red-400/25 bg-red-400/10 p-8 text-center text-red-100">Assets Shop could not load. Try again.</div>
            : filteredAssets.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filteredAssets.map(asset => {
              const gallery = catalogImages(asset);
              const selectedCount = gallery.filter(url => selectedImages.includes(url)).length;
              return <article key={asset.id} className={`overflow-hidden rounded-[4px] border bg-black transition ${selectedCount ? 'border-[#23c7be]' : 'border-white/10'}`}>
                <div className={`grid gap-1 bg-zinc-900 p-1 ${gallery.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>{gallery.map((url, index) => {
                  const selected = selectedImages.includes(url);
                  const full = !selected && selectedImages.length >= 8;
                  return <button key={`${asset.id}-${url}`} onClick={() => onToggle(url)} disabled={full} className={`group relative aspect-[4/3] overflow-hidden rounded-[3px] border transition ${selected ? 'border-[#23c7be]' : 'border-transparent hover:border-[#23c7be]/60'} ${full ? 'cursor-not-allowed opacity-35' : ''}`} title={`Use image ${index + 1} of ${asset.title || 'this asset'}`}>
                    <img src={url} alt={`${asset.title || 'Assets Shop asset'} · image ${index + 1}`} className="h-full w-full object-contain transition duration-300 group-hover:scale-105" />
                    <span className={`absolute bottom-1.5 right-1.5 rounded-[3px] px-2 py-0.5 text-[9px] font-black ${selected ? 'bg-[#23c7be] text-black' : 'bg-black/80 text-white'}`}>{selected ? 'Selected' : `${index + 1}/${gallery.length}`}</span>
                  </button>;
                })}</div>
                <div className="p-3"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-black text-white">{asset.title || 'Untitled'}</p><span className="flex-shrink-0 text-[10px] font-bold text-[#8ee9e4]">{gallery.length} image{gallery.length === 1 ? '' : 's'}</span></div><p className="mt-1 truncate text-[10px] text-white/40">{asset.creator_name || 'Assets Shop'}{selectedCount ? ` · ${selectedCount} selected` : ''}</p></div>
              </article>;
            })}</div>
            : <div className="flex min-h-64 items-center justify-center rounded-[4px] border border-dashed border-white/15 text-sm text-white/45">No published Assets Shop item matches this search.</div>}
        </div>
        <footer className="flex items-center justify-between border-t border-white/10 p-4"><span className="text-xs font-bold text-white/50">{selectedImages.length}/8 set images selected</span><button onClick={onClose} className="rounded-[3px] bg-[#23c7be] px-6 py-3 text-sm font-black text-black">Done</button></footer>
      </motion.div>
    </motion.div>
  );
}

function ChoiceGroup({ label, options, value, onChange }) {
  return (
    <div className="min-w-0">
      <div className="mb-3 flex items-center gap-3">
        <span className="h-5 w-[3px] bg-[#23c7be] shadow-[0_0_12px_rgba(35,199,190,.7)]" />
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/85">{label}</p>
        <span className="h-px flex-1 bg-gradient-to-r from-white/18 to-transparent" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {options.map(option => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`group relative min-h-[92px] overflow-hidden border text-left transition-all duration-200 ${selected ? 'border-[#23c7be] shadow-[0_0_0_1px_rgba(35,199,190,.28),0_0_24px_rgba(35,199,190,.12)]' : 'border-white/10 hover:border-white/30'}`}
              style={{ background: VISUAL_STYLES[option] || 'linear-gradient(135deg,#111417,#272b2f)' }}
            >
              <span className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
              <span className="absolute inset-x-0 top-0 h-px bg-white/10" />
              <span className={`absolute left-0 top-0 h-full w-[2px] transition ${selected ? 'bg-[#23c7be]' : 'bg-transparent group-hover:bg-white/25'}`} />
              <span className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-2 p-3">
                <span className={`text-[11px] font-black leading-tight ${selected ? 'text-white' : 'text-white/82'}`}>{option}</span>
                {selected && <span className="h-1.5 w-1.5 bg-[#23c7be] shadow-[0_0_8px_rgba(35,199,190,.9)]" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function SetAssetEditor({ asset, userEmail, onClose, embedded = false }) {
  const qc = useQueryClient();
  const [name, setName] = useState(asset?.name || '');
  const [description, setDescription] = useState(asset?.description || '');
  const [tags, setTags] = useState(asset?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [images, setImages] = useState(asset?.images || []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vaultPickerOpen, setVaultPickerOpen] = useState(false);
  const [oloPickerOpen, setOloPickerOpen] = useState(false);
  const [cropSource, setCropSource] = useState(null);
  const [vaultSaveUrl, setVaultSaveUrl] = useState(null);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || images.length >= 8) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setImages(prev => [...prev, file_url]);
      setVaultSaveUrl(file_url);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleVaultSelect = (url) => {
    setVaultPickerOpen(false);
    setCropSource(url);
  };

  const handleOloToggle = (url) => {
    setImages(current => {
      if (current.includes(url)) return current.filter(image => image !== url);
      if (current.length >= 8) { toast.error('A set can contain up to 8 images'); return current; }
      return [...current, url];
    });
  };

  const handleCropConfirm = async (blob) => {
    setUploading(true);
    setCropSource(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: blob });
      setImages(prev => [...prev, file_url]);
      toast.success('Image added to set', { icon: <Check size={16} /> });
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (idx) => setImages(prev => prev.filter((_, i) => i !== idx));
  const addTag = (e) => {
    e.preventDefault();
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  };
  const removeTag = (tag) => setTags(prev => prev.filter(t => t !== tag));
  const setCreativeField = (label, value) => setDescription(prev => writeBriefField(prev, label, value));

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = { user_email: userEmail, name: name.trim(), description: description.trim(), tags, images };
      if (asset?.id) await base44.entities.SetAsset.update(asset.id, data);
      else await base44.entities.SetAsset.create(data);
      qc.invalidateQueries({ queryKey: ['setAssets', userEmail] });
      toast.success(asset?.id ? 'Set updated' : 'Set created');
      onClose();
    } catch (error) {
      console.error('Set save failed', error);
      toast.error('Set could not be saved. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const heroImage = images[0];

  return (
    <motion.div
      className={`fixed z-[100] flex flex-col overflow-y-auto bg-[#202328] text-white ${embedded ? 'top-14 right-0 bottom-[var(--bottom-nav-height)] left-0 lg:left-[var(--studio-toolbar-width)]' : 'inset-0'}`}
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
    >
      <div className="flex min-h-screen flex-col bg-[#202328] text-white">
        <div className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-white/10 bg-[#17191d]/95 px-5 py-3 backdrop-blur">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#23c7be]">Set Designer</p>
            <h2 className="text-xl font-black text-white">{asset?.id ? 'Edit your set' : 'Create a set'}</h2>
          </div>
          {!embedded && <button onClick={onClose} className="border border-white/10 bg-white/[0.04] p-2 text-white hover:bg-white/10"><X size={20} /></button>}
        </div>

        <div className="mx-auto w-full max-w-7xl flex-1 space-y-5 px-4 py-5 pb-28 sm:px-5">
          <section className="overflow-hidden border border-white/10 bg-[#17191d]">
            <div className="grid lg:grid-cols-[1.35fr_0.65fr]">
              <div className="relative min-h-[360px] border-b border-white/10 bg-[#0d0f12] lg:min-h-[520px] lg:border-b-0 lg:border-r">
                {heroImage ? (
                  <img src={heroImage} alt="Set hero reference" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
                    <div className="mb-5 flex h-16 w-16 items-center justify-center border border-[#23c7be]/30 bg-[#23c7be]/10 text-[#23c7be]"><Camera size={28} /></div>
                    <h3 className="text-2xl font-black">Build the world before the shot.</h3>
                    <p className="mt-2 max-w-md text-sm leading-6 text-white/45">Start with a reference image, then define the visual language of the location so every shot belongs to the same world.</p>
                  </div>
                )}
                <div className="absolute left-4 top-4 border border-white/15 bg-black/70 px-3 py-2 backdrop-blur">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#23c7be]">Hero Reference</p>
                  <p className="text-[11px] text-white/65">{heroImage ? 'Image 1 anchors the set' : 'No image selected yet'}</p>
                </div>
                <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
                  {images.length < 8 && <label className="flex cursor-pointer items-center gap-2 bg-[#23c7be] px-4 py-2.5 text-xs font-black text-[#071211] transition hover:bg-[#35d8cf]"><Upload size={14} />Import reference<input type="file" accept="image/*" className="hidden" onChange={handleUpload} /></label>}
                  {images.length < 8 && <button type="button" onClick={() => setVaultPickerOpen(true)} className="flex items-center gap-2 border border-white/15 bg-black/65 px-4 py-2.5 text-xs font-bold text-white backdrop-blur hover:bg-black/80"><Bookmark size={14} />Vault</button>}
                  <button type="button" onClick={() => setOloPickerOpen(true)} className="flex items-center gap-2 border border-[#23c7be]/35 bg-black/65 px-4 py-2.5 text-xs font-bold text-[#8ee9e4] backdrop-blur hover:bg-black/80"><ShoppingBag size={14} />Assets Shop</button>
                </div>
              </div>

              <div className="space-y-5 p-5 sm:p-6">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-[#23c7be]"><Sparkles size={16} /><span className="text-[10px] font-black uppercase tracking-[0.18em]">Creative brief</span></div>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Name this world — e.g. Glass House at Midnight" className="w-full border-0 border-b border-white/15 bg-transparent px-0 py-3 text-2xl font-black text-white outline-none placeholder:text-white/25 focus:border-[#23c7be]" />
                  <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the place as a director would: architecture, atmosphere, story, textures, what the camera should feel..." rows={9} className="mt-4 w-full resize-none border border-white/10 bg-black/25 px-4 py-4 text-sm leading-6 text-white outline-none placeholder:text-white/25 focus:border-[#23c7be]" />
                </div>
                <div className="border-t border-white/10 pt-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">Production tags</p>
                  <form onSubmit={addTag} className="mt-2 flex gap-2">
                    <input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="interior, palace, runway..." className="min-w-0 flex-1 border border-white/10 bg-black/25 px-3 py-2.5 text-xs text-white outline-none placeholder:text-white/25 focus:border-[#23c7be]" />
                    <button type="submit" disabled={!tagInput.trim()} className="border border-white/10 bg-white/[0.05] px-4 py-2.5 text-xs font-bold text-white hover:bg-white/10 disabled:text-white/25">Add</button>
                  </form>
                  {tags.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{tags.map(tag => <span key={tag} className="flex items-center gap-1.5 border border-[#23c7be]/25 bg-[#23c7be]/10 px-2.5 py-1.5 text-[11px] font-medium text-[#8ee9e4]">{tag}<button type="button" onClick={() => removeTag(tag)} className="hover:text-white"><X size={11} /></button></span>)}</div>}
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden border border-white/10 bg-[#111417] shadow-[0_28px_70px_rgba(0,0,0,.24)]">
            <div className="relative border-b border-white/10 px-5 py-6 sm:px-7 sm:py-7">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_35%,rgba(35,199,190,.12),transparent_28%),linear-gradient(120deg,rgba(255,255,255,.025),transparent_50%)]" />
              <div className="relative flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center border border-[#23c7be]/45 bg-[#071618] text-[#23c7be] shadow-[inset_0_0_24px_rgba(35,199,190,.08)]"><Eye size={19} /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#23c7be]">Creative Direction</p>
                  <h3 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-[28px]">Give the set a visual language</h3>
                  <p className="mt-1.5 max-w-2xl text-xs leading-5 text-white/42">Every choice is written into the production brief above, so it stays attached to the set.</p>
                </div>
                <div className="hidden border-l border-white/10 pl-5 text-right lg:block">
                  <p className="text-[9px] font-bold uppercase tracking-[0.34em] text-white/25">AI Stage One</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.24em] text-white/55">Set Designer</p>
                  <span className="mt-3 ml-auto block h-px w-10 bg-[#b9a06a]/70" />
                </div>
              </div>
            </div>
            <div className="grid gap-x-8 gap-y-8 p-5 sm:p-7 xl:grid-cols-2">
              <ChoiceGroup label="Direction" options={CREATIVE_PRESETS} value={readBriefField(description, 'Direction')} onChange={value => setCreativeField('Direction', value)} />
              <ChoiceGroup label="Era" options={ERA_OPTIONS} value={readBriefField(description, 'Era')} onChange={value => setCreativeField('Era', value)} />
              <ChoiceGroup label="Lighting" options={LIGHTING_OPTIONS} value={readBriefField(description, 'Lighting')} onChange={value => setCreativeField('Lighting', value)} />
              <ChoiceGroup label="Time of day" options={TIME_OPTIONS} value={readBriefField(description, 'Time of day')} onChange={value => setCreativeField('Time of day', value)} />
              <ChoiceGroup label="Weather / Atmosphere" options={WEATHER_OPTIONS} value={readBriefField(description, 'Weather')} onChange={value => setCreativeField('Weather', value)} />
              <ChoiceGroup label="Image treatment" options={REALISM_OPTIONS} value={readBriefField(description, 'Image treatment')} onChange={value => setCreativeField('Image treatment', value)} />
            </div>
            <div className="grid gap-4 border-t border-white/10 bg-black/10 p-5 sm:grid-cols-2 sm:p-7">
              <div><label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Architecture / spatial idea</label><input value={readBriefField(description, 'Architecture')} onChange={e => setCreativeField('Architecture', e.target.value)} placeholder="Brutalist atrium, narrow Paris apartment..." className="w-full border border-white/10 bg-[#0c0f11] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#23c7be]" /></div>
              <div><label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Materials / palette</label><input value={readBriefField(description, 'Materials')} onChange={e => setCreativeField('Materials', e.target.value)} placeholder="smoked glass, wet concrete, teal accents..." className="w-full border border-white/10 bg-[#0c0f11] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#23c7be]" /></div>
            </div>
          </section>

          <section className="border border-white/10 bg-[#17191d] p-5 sm:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><div className="flex items-center gap-2 text-[#23c7be]"><ImagePlus size={16} /><p className="text-[10px] font-black uppercase tracking-[0.18em]">Visual Continuity Board</p></div><h3 className="mt-1 text-lg font-black">Eight references, eight production purposes</h3><p className="mt-1 text-xs text-white/40">The order gives each image a role. The first image is the visual anchor for the whole set.</p></div>
              <span className="text-xs font-black text-white/45">{images.length}/8 REFERENCES</span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {IMAGE_ROLES.map((role, idx) => {
                const url = images[idx];
                return (
                  <div key={role} className={`relative aspect-[4/3] overflow-hidden border ${url ? 'border-white/10 bg-black' : 'border-dashed border-white/15 bg-black/15'}`}>
                    {url ? <img src={url} alt={`${role} set reference`} className="h-full w-full object-cover" /> : <div className="flex h-full flex-col items-center justify-center px-3 text-center text-white/25"><Camera size={18} /><span className="mt-2 text-[10px] font-bold">Add reference</span></div>}
                    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-2 bg-black/80 px-2.5 py-2 backdrop-blur"><span className="truncate text-[9px] font-black uppercase tracking-[0.08em] text-white/75">{idx + 1}. {role}</span>{url && <button type="button" onClick={() => removeImage(idx)} className="flex h-5 w-5 flex-shrink-0 items-center justify-center bg-white/10 text-white hover:bg-white/20"><X size={10} /></button>}</div>
                    {url && <button type="button" onClick={() => setVaultSaveUrl(url)} title="Save this image to Vault" className="absolute left-2 top-2 flex h-7 items-center justify-center border border-[#23c7be]/30 bg-black/75 px-2 text-[#8ee9e4]"><Bookmark size={11} /></button>}
                  </div>
                );
              })}
            </div>
            {uploading && <div className="mt-3 flex items-center gap-2 text-xs font-bold text-[#8ee9e4]"><Loader2 size={14} className="animate-spin" />Adding reference...</div>}
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            <div className="border border-white/10 bg-[#17191d] p-4"><Sun size={17} className="text-[#23c7be]" /><p className="mt-3 text-sm font-black">Day / Night continuity</p><p className="mt-1 text-xs leading-5 text-white/40">Use slots 7 and 8 to keep the same environment readable across lighting changes.</p></div>
            <div className="border border-white/10 bg-[#17191d] p-4"><Camera size={17} className="text-[#23c7be]" /><p className="mt-3 text-sm font-black">Camera-ready angles</p><p className="mt-1 text-xs leading-5 text-white/40">Wide, reverse and side references make the location useful beyond a single hero image.</p></div>
            <div className="border border-white/10 bg-[#17191d] p-4"><Moon size={17} className="text-[#23c7be]" /><p className="mt-3 text-sm font-black">One world, many shots</p><p className="mt-1 text-xs leading-5 text-white/40">The brief and reference board stay together as one reusable production set.</p></div>
          </section>
        </div>

        <div className="sticky bottom-0 z-10 border-t border-white/10 bg-[#17191d]/95 px-5 py-3 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
            <p className="hidden text-xs text-white/35 sm:block">{name.trim() ? `${name.trim()} · ${images.length} reference${images.length === 1 ? '' : 's'}` : 'Name your set to create it.'}</p>
            <button onClick={handleSave} disabled={saving || !name.trim()} className="ml-auto min-w-[210px] border border-[#23c7be] bg-[#23c7be] px-5 py-3 text-sm font-black text-[#071211] transition hover:bg-[#35d8cf] disabled:border-white/10 disabled:bg-white/[0.05] disabled:text-white/30">
              {saving ? 'SAVING...' : asset?.id ? 'SAVE SET' : 'CREATE MY SET'}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {vaultPickerOpen && <VaultPickerModal userEmail={userEmail} onSelect={handleVaultSelect} onClose={() => setVaultPickerOpen(false)} />}
        {oloPickerOpen && <OloShopSetPicker selectedImages={images} onToggle={handleOloToggle} onClose={() => setOloPickerOpen(false)} />}
        {cropSource && <ImageCropModal imageUrl={cropSource} onConfirm={handleCropConfirm} onClose={() => setCropSource(null)} />}
        {vaultSaveUrl && <SaveToVaultModal userEmail={userEmail} imageUrl={vaultSaveUrl} mediaType="image" onSaved={() => { setVaultSaveUrl(null); qc.invalidateQueries({ queryKey: ['vaultAssets', userEmail] }); }} onClose={() => setVaultSaveUrl(null)} />}
      </AnimatePresence>
    </motion.div>
  );
}
