import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Bookmark, Check, Loader2, ShoppingBag, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import VaultPickerModal from '@/components/studio/VaultPickerModal';
import ImageCropModal from '@/components/studio/ImageCropModal';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';
import { toast } from 'sonner';

const catalogImages = asset => [...new Set([
  asset?.featured_image,
  ...(Array.isArray(asset?.preview_images) ? asset.preview_images : []),
].filter(Boolean))];

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
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setImages(prev => [...prev, file_url]);
    setUploading(false);
    setVaultSaveUrl(file_url);
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
    const { file_url } = await base44.integrations.Core.UploadFile({ file: blob });
    setImages(prev => [...prev, file_url]);
    setUploading(false);
    toast.success('Image added to set', { icon: <Check size={16} /> });
  };

  const removeImage = (idx) => setImages(prev => prev.filter((_, i) => i !== idx));

  const addTag = (e) => {
    e.preventDefault();
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  };

  const removeTag = (tag) => setTags(prev => prev.filter(t => t !== tag));

  const handleSave = async () => {
    setSaving(true);
    const data = { user_email: userEmail, name, description, tags, images };
    if (asset?.id) {
      await base44.entities.SetAsset.update(asset.id, data);
    } else {
      await base44.entities.SetAsset.create(data);
    }
    qc.invalidateQueries({ queryKey: ['setAssets', userEmail] });
    setSaving(false);
    toast.success(asset?.id ? 'Set updated' : 'Set created');
    onClose();
  };

  return (
    <motion.div
      className={`fixed z-[100] flex flex-col overflow-y-auto bg-[#202328] text-white ${embedded ? 'top-14 right-0 bottom-[var(--bottom-nav-height)] left-0 lg:left-[var(--studio-toolbar-width)]' : 'inset-0'}`}
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
    >
      <div className="flex min-h-screen flex-col bg-[#202328] text-white">
        <div className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-white/10 bg-[#17191d] px-5 py-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#23c7be]">Set Studio</p>
            <h2 className="text-xl font-black text-white">{asset?.id ? 'Edit Set' : 'New Set'}</h2>
          </div>
          {!embedded && <button onClick={onClose} className="rounded-[3px] border border-white/10 bg-white/[0.04] p-2 text-white hover:bg-white/10"><X size={20} /></button>}
        </div>

        <div className="mx-auto flex-1 w-full max-w-6xl space-y-4 px-5 py-5 pb-28">
          <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
            <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.12em] text-white/55">Set Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Gothic Manor, Tropical Beach..." className="w-full rounded-[3px] border border-white/15 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#23c7be]" />
          </section>

          <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
            <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.12em] text-white/55">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Atmosphere, style, lighting, era..." rows={3} className="w-full resize-none rounded-[3px] border border-white/15 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#23c7be]" />
          </section>

          <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
            <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.12em] text-white/55">Tags</label>
            <form onSubmit={addTag} className="mb-2 flex gap-2">
              <input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Add a tag..." className="flex-1 rounded-[3px] border border-white/15 bg-black/25 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#23c7be]" />
              <button type="submit" disabled={!tagInput.trim()} className="rounded-[3px] border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/10 disabled:text-white/30">Add</button>
            </form>
            {tags.length > 0 && <div className="flex flex-wrap gap-2">{tags.map(tag => <span key={tag} className="flex items-center gap-1.5 rounded-[3px] border border-[#23c7be]/25 bg-[#23c7be]/10 px-3 py-1.5 text-xs font-medium text-[#8ee9e4]">{tag}<button onClick={() => removeTag(tag)} className="hover:text-white"><X size={11} /></button></span>)}</div>}
          </section>

          <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><label className="block text-[11px] font-black uppercase tracking-[0.12em] text-white/55">Set Images ({images.length}/8)</label><p className="mt-1 text-xs text-white/40">Add up to 8 reference images for this set or location.</p></div>
              <div className="flex flex-wrap gap-2">
                {images.length < 8 && <label className="flex cursor-pointer items-center gap-2 rounded-[3px] bg-[#23c7be] px-4 py-2 text-xs font-black text-black transition hover:bg-[#35d8cf]"><Upload size={14} />Import Image<input type="file" accept="image/*" className="hidden" onChange={handleUpload} /></label>}
                {images.length < 8 && <button onClick={() => setVaultPickerOpen(true)} className="flex items-center gap-2 rounded-[3px] border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-bold text-white hover:bg-white/10"><Bookmark size={14} />From Vault</button>}
                <button onClick={() => setOloPickerOpen(true)} className="flex items-center gap-2 rounded-[3px] border border-[#23c7be]/30 bg-[#23c7be]/10 px-4 py-2 text-xs font-bold text-[#8ee9e4] hover:bg-[#23c7be]/15"><ShoppingBag size={14} />Assets Shop</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {images.map((url, idx) => <div key={idx} className="relative overflow-hidden rounded-[4px] border border-white/10 bg-white/[0.03]"><img src={url} alt="" className="h-auto w-full object-cover" /><button onClick={() => removeImage(idx)} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-[3px] bg-black/75 hover:bg-black"><X size={10} /></button><button onClick={() => setVaultSaveUrl(url)} title="Save this image to Vault" className="absolute bottom-1 left-1 flex h-6 items-center justify-center rounded-[3px] border border-[#23c7be]/30 bg-black/75 px-2 text-[#8ee9e4]"><Bookmark size={11} /></button></div>)}
              {uploading && <div className="flex aspect-square items-center justify-center rounded-[4px] border border-dashed border-white/20"><Loader2 size={20} className="animate-spin text-[#23c7be]" /></div>}
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 z-10 border-t border-white/10 bg-[#17191d]/95 px-5 py-3 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl justify-end">
            <button onClick={handleSave} disabled={saving || !name} className="min-w-[180px] rounded-[3px] border border-[#23c7be] bg-[#23c7be] px-5 py-3 text-sm font-black text-[#071211] transition hover:bg-[#35d8cf] disabled:border-white/10 disabled:bg-white/[0.05] disabled:text-white/30">
              {saving ? 'Saving...' : 'Save Set'}
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
