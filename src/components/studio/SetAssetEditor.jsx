import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Bookmark, Check, Loader2, ShoppingBag, Upload, Sparkles, ImagePlus, Camera, Sun, Moon, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import VaultPickerModal from '@/components/studio/VaultPickerModal';
import ImageCropModal from '@/components/studio/ImageCropModal';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';
import SetGeneratorPanel from '@/components/studio/SetGeneratorPanel';
import { toast } from 'sonner';
import SET_DESIGNER_IMAGES from '@/setDesignerImages/all';

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
          const imageSrc = SET_DESIGNER_IMAGES[label]?.[option];
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`group relative min-h-[92px] overflow-hidden border bg-black text-left transition-all duration-200 ${selected ? 'border-[#23c7be] shadow-[0_0_0_1px_rgba(35,199,190,.28),0_0_24px_rgba(35,199,190,.12)]' : 'border-white/10 hover:border-white/30'}`}
            >
              {imageSrc && <img src={imageSrc} alt={`${label}: ${option}`} className="absolute inset-0 h-full w-full object-cover" />}
              <span className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
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

export default function SetAssetEditor({ asset, userEmail, onClose, onSaved, embedded = false }) {
  const qc = useQueryClient();
  const [projectId, setProjectId] = useState(asset?.id || null);
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
      const payload = {
        user_email: userEmail,
        name: name.trim(),
        description: description.trim(),
        tags,
        images,
        updated_date: new Date().toISOString(),
      };

      let saved;
      if (projectId) {
        const { data, error } = await supabase
          .from('set_designer_project')
          .update(payload)
          .eq('id', projectId)
          .select('*')
          .single();
        if (error) throw error;
        saved = data;
      } else {
        const { data, error } = await supabase
          .from('set_designer_project')
          .insert(payload)
          .select('*')
          .single();
        if (error) throw error;
        saved = data;
        setProjectId(data.id);
      }

      qc.invalidateQueries({ queryKey: ['setDesignerProjects'] });
      onSaved?.(saved);
      toast.success(projectId ? 'Set updated' : 'Set saved');
    } catch (error) {
      console.error('Set Designer project save failed', error);
      toast.error(error?.message || 'Set could not be saved. Try again.');
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
            <h2 className="text-xl font-black text-white">{projectId ? 'Edit your set' : 'Create a set'}</h2>
          </div>
          <button onClick={onClose} className="border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-white hover:bg-white/10">{embedded ? 'MY SETS' : <X size={20} />}</button>
        </div>

        <div className="mx-auto w-full max-w-7xl flex-1 space-y-5 px-4 py-5 pb-28 sm:px-5">
          <SetGeneratorPanel name={name} description={description} images={images} setImages={setImages} />

          <section className="overflow-hidden border border-white/10 bg-[#17191d]">
            <div className="grid lg:grid-cols-[1.35fr_0.65fr]">
              <div className="relative min-h-[360px] border-b border-white/10 bg-[#0d0f12] lg:min-h-[520px] lg:border-b-0 lg:border-r">
                {heroImage ? (
                  <img src={heroImage} alt="Set hero reference" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
                    <div className="mb-5 flex h-16 w-16 items-center justify-center border border-[#23c7be]/30 bg-[#23c7be]/10 text-[#23c7be]"><Camera size={28} /></div>
                    <h3 className="text-2xl font-black">Build the world before the shot.</h3>
                    <p className="mt-2 max-w-md text-sm leading-6 text-white/45">Start from scratch or use references, then define the visual language of the location so every shot belongs to the same world.</p>
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
              {saving ? 'SAVING...' : 'SAVE SET'}
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
