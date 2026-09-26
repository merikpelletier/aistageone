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
      <motion.div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-cyan-300/25 bg-[#101012] shadow-2xl" initial={{ y: 24, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 24, scale: 0.98 }} onClick={event => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-white/10 p-5">
          <div><p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">OLOSHOP Inventory</p><h3 className="mt-1 text-2xl font-black text-white">Choose set references</h3><p className="mt-1 text-xs text-white/45">Every image attached to each published asset is available.</p></div>
          <button onClick={onClose} className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><X size={19} /></button>
        </header>
        <div className="space-y-3 border-b border-white/10 p-4">
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search OLOSHOP inventory" className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300" />
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            <button onClick={() => setCategoryId('all')} className={`flex-shrink-0 rounded-full px-4 py-2 text-xs font-black ${categoryId === 'all' ? 'bg-cyan-300 text-black' : 'bg-white/[0.06] text-white'}`}>All</button>
            {categories.map(category => <button key={category.id} onClick={() => setCategoryId(category.id)} className={`flex-shrink-0 rounded-full px-4 py-2 text-xs font-black ${categoryId === category.id ? 'bg-cyan-300 text-black' : 'bg-white/[0.06] text-white'}`}>{category.label_en || category.label_fr || category.key}</button>)}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {isLoading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="animate-spin text-cyan-300" /></div>
            : error ? <div className="rounded-2xl border border-red-400/25 bg-red-400/10 p-8 text-center text-red-100">OLOSHOP could not load. Try again.</div>
            : filteredAssets.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filteredAssets.map(asset => {
              const gallery = catalogImages(asset);
              const selectedCount = gallery.filter(url => selectedImages.includes(url)).length;
              return <article key={asset.id} className={`overflow-hidden rounded-2xl border-2 bg-black transition ${selectedCount ? 'border-cyan-300' : 'border-white/10'}`}>
                <div className={`grid gap-1 bg-zinc-900 p-1 ${gallery.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>{gallery.map((url, index) => {
                  const selected = selectedImages.includes(url);
                  const full = !selected && selectedImages.length >= 8;
                  return <button key={`${asset.id}-${url}`} onClick={() => onToggle(url)} disabled={full} className={`group relative aspect-[4/3] overflow-hidden rounded-lg border-2 transition ${selected ? 'border-cyan-300' : 'border-transparent hover:border-cyan-300/60'} ${full ? 'cursor-not-allowed opacity-35' : ''}`} title={`Use image ${index + 1} of ${asset.title || 'this asset'}`}>
                    <img src={url} alt={`${asset.title || 'OLOSHOP asset'} · image ${index + 1}`} className="h-full w-full object-contain transition duration-300 group-hover:scale-105" />
                    <span className={`absolute bottom-1.5 right-1.5 rounded-full px-2 py-0.5 text-[9px] font-black ${selected ? 'bg-cyan-300 text-black' : 'bg-black/80 text-white'}`}>{selected ? 'Selected' : `${index + 1}/${gallery.length}`}</span>
                  </button>;
                })}</div>
                <div className="p-3"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-black text-white">{asset.title || 'Untitled'}</p><span className="flex-shrink-0 text-[10px] font-bold text-cyan-200/70">{gallery.length} image{gallery.length === 1 ? '' : 's'}</span></div><p className="mt-1 truncate text-[10px] text-white/40">{asset.creator_name || 'OLOSHOP'}{selectedCount ? ` · ${selectedCount} selected` : ''}</p></div>
              </article>;
            })}</div>
            : <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-white/15 text-sm text-white/45">No published OLOSHOP asset matches this search.</div>}
        </div>
        <footer className="flex items-center justify-between border-t border-white/10 p-4"><span className="text-xs font-bold text-white/50">{selectedImages.length}/8 set images selected</span><button onClick={onClose} className="rounded-xl bg-cyan-300 px-6 py-3 text-sm font-black text-black">Done</button></footer>
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
  const [cropSource, setCropSource] = useState(null); // url to crop
  const [vaultSaveUrl, setVaultSaveUrl] = useState(null); // url pending save-to-vault

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
      className={`fixed z-[100] flex flex-col bg-black text-white overflow-y-auto ${embedded ? 'top-14 right-0 bottom-[64px] left-0 lg:bottom-0 lg:left-[var(--studio-toolbar-width)]' : 'inset-0'}`}
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
    >
      <div className="flex flex-col bg-black text-white min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-[calc(52px+env(safe-area-inset-top)+12px)] pb-3 border-b border-white/10 sticky top-0 bg-black z-10">
          <h2 className="text-white text-lg font-light tracking-widest">
            {asset?.id ? 'Edit Set' : 'New Set'}
          </h2>
          {!embedded && <button onClick={onClose} className="p-2 text-white hover:text-white/80"><X size={20} /></button>}
        </div>

        <div className="flex-1 px-5 py-6 space-y-5 pb-24">

          {/* Name */}
          <div>
            <label className="text-white text-xs uppercase tracking-widest mb-1.5 block">Set Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Gothic Manor, Tropical Beach..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/30"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-white text-xs uppercase tracking-widest mb-1.5 block">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Atmosphere, style, lighting, era..."
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/30 resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="text-white text-xs uppercase tracking-widest mb-1.5 block">Tags</label>
            <form onSubmit={addTag} className="flex gap-2 mb-2">
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                placeholder="Add a tag..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/30"
              />
              <button
                type="submit"
                disabled={!tagInput.trim()}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white text-sm rounded-xl transition-colors"
              >
                Add
              </button>
            </form>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400/15 text-yellow-400 rounded-full text-xs font-medium">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-yellow-200">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Images */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-white text-xs uppercase tracking-widest">
                Sets ({images.length}/8)
              </label>
              <div className="flex flex-wrap justify-end gap-2">
                {images.length < 8 && <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-yellow-400 px-4 py-2 text-xs font-bold text-black transition-colors hover:bg-yellow-300"><Upload size={14} />Import Image<input type="file" accept="image/*" className="hidden" onChange={handleUpload} /></label>}
                {images.length < 8 && <button onClick={() => setVaultPickerOpen(true)} className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-white/20"><Bookmark size={14} />From Vault</button>}
                <button onClick={() => setOloPickerOpen(true)} className="flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-xs font-bold text-black transition-colors hover:bg-cyan-200"><ShoppingBag size={14} />OLOSHOP</button>
              </div>
            </div>
            <p className="text-white/50 text-xs mb-4 leading-relaxed">Add up to 8 set/location images. Import an image, choose from your Vault, or select any image from an OLOSHOP asset gallery.</p>
            <div className="grid grid-cols-3 gap-2 auto-rows-[minmax(0,auto)]">
              {images.map((url, idx) => (
                <div key={idx} className="relative rounded-xl overflow-hidden bg-white/5">
                  <img src={url} alt="" className="w-full h-auto object-cover" />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center hover:bg-black/90 transition-colors"
                  >
                    <X size={10} className="text-white" />
                  </button>
                  <button
                    onClick={() => setVaultSaveUrl(url)}
                    title="Save this image to Vault"
                    className="absolute bottom-1 left-1 h-6 px-2 bg-yellow-400 text-black rounded-full flex items-center justify-center hover:bg-yellow-300 transition-colors"
                  >
                    <Bookmark size={11} />
                  </button>
                </div>
              ))}
              {uploading && <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-white/20"><Loader2 size={20} className="animate-spin text-white" /></div>}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 px-5 py-6 bg-black border-t border-white/10 z-10">
          <button
            onClick={handleSave}
            disabled={saving || !name}
            className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold tracking-widest rounded-xl transition-colors"
          >
            {saving ? 'Saving...' : 'Save Set'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {vaultPickerOpen && (
          <VaultPickerModal
            userEmail={userEmail}
            onSelect={handleVaultSelect}
            onClose={() => setVaultPickerOpen(false)}
          />
        )}
        {oloPickerOpen && <OloShopSetPicker selectedImages={images} onToggle={handleOloToggle} onClose={() => setOloPickerOpen(false)} />}
        {cropSource && (
          <ImageCropModal
            imageUrl={cropSource}
            onConfirm={handleCropConfirm}
            onClose={() => setCropSource(null)}
          />
        )}
        {vaultSaveUrl && (
          <SaveToVaultModal
            userEmail={userEmail}
            imageUrl={vaultSaveUrl}
            mediaType="image"
            onSaved={() => { setVaultSaveUrl(null); qc.invalidateQueries({ queryKey: ['vaultAssets', userEmail] }); }}
            onClose={() => setVaultSaveUrl(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
