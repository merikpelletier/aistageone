import React, { useMemo, useState } from 'react';
import { Bookmark, Check, ImagePlus, Loader2, ShoppingBag, Trash2, Upload, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { useQuery } from '@tanstack/react-query';
import VaultPickerModal from '@/components/studio/VaultPickerModal';
import { toast } from 'sonner';

const ROLE_OPTIONS = [
  ['product_placement', 'Product Placement'],
  ['sponsor_product', 'Sponsor Product'],
  ['hero_prop', 'Hero Prop'],
  ['set_dressing', 'Set Dressing'],
  ['furniture', 'Furniture'],
  ['background_object', 'Background Object'],
  ['signage_branding', 'Signage / Branding'],
  ['other', 'Other'],
];
const PRIORITY_OPTIONS = [['required', 'Required'], ['preferred', 'Preferred'], ['optional', 'Optional']];
const VISIBILITY_OPTIONS = [['prominent', 'Prominent'], ['clearly_visible', 'Clearly Visible'], ['natural', 'Natural'], ['subtle', 'Subtle']];
const PLACEMENT_OPTIONS = [
  ['foreground', 'Foreground'], ['midground', 'Midground'], ['background', 'Background'], ['table', 'Table'], ['counter', 'Counter'], ['shelf', 'Shelf'], ['wall_display', 'Wall / Display'], ['floor', 'Floor'], ['entrance', 'Entrance'], ['window_area', 'Window Area'], ['custom', 'Custom'],
];
const SCALE_OPTIONS = [['real_world', 'Real-world Scale'], ['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']];

const makeElement = (imageUrl, name = '') => ({
  id: crypto.randomUUID(),
  image_url: imageUrl,
  name,
  role: 'set_dressing',
  priority: 'preferred',
  visibility: 'natural',
  placement: 'midground',
  scale: 'real_world',
  instruction: '',
});

const catalogImages = asset => [...new Set([
  asset?.featured_image,
  ...(Array.isArray(asset?.preview_images) ? asset.preview_images : []),
].filter(Boolean))];

function AssetsShopPicker({ onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['composition-elements-assets-shop'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('catalog_asset')
        .select('id,title,description,featured_image,preview_images,creator_name,tags')
        .eq('status', 'published')
        .order('title', { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data || []).filter(asset => catalogImages(asset).length);
    },
  });
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return assets.filter(asset => {
      if (!term) return true;
      const tags = Array.isArray(asset.tags) ? asset.tags.join(' ') : String(asset.tags || '');
      return `${asset.title || ''} ${asset.description || ''} ${asset.creator_name || ''} ${tags}`.toLowerCase().includes(term);
    });
  }, [assets, search]);

  return (
    <motion.div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/90 p-3 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden border border-white/10 bg-[#17191d]" initial={{ y: 20 }} animate={{ y: 0 }} exit={{ y: 20 }} onClick={event => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-white/10 p-5">
          <div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#23c7be]">Assets Shop</p><h3 className="mt-1 text-xl font-black text-white">Choose a composition element</h3></div>
          <button type="button" onClick={onClose} className="border border-white/10 bg-white/[0.05] p-2 text-white"><X size={18} /></button>
        </header>
        <div className="border-b border-white/10 p-4"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search products, props, furniture..." className="w-full border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#23c7be]" /></div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {isLoading ? <div className="flex min-h-56 items-center justify-center"><Loader2 className="animate-spin text-[#23c7be]" /></div> : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(asset => catalogImages(asset).map((url, index) => (
                <button key={`${asset.id}-${index}`} type="button" onClick={() => onSelect(url, asset.title || '')} className="overflow-hidden border border-white/10 bg-black text-left hover:border-[#23c7be]/60">
                  <div className="aspect-[4/3] bg-[#0b0d0f]"><img src={url} alt={asset.title || 'Asset'} className="h-full w-full object-contain" /></div>
                  <div className="p-3"><p className="truncate text-xs font-black text-white">{asset.title || 'Untitled asset'}</p><p className="mt-1 text-[10px] text-white/35">Image {index + 1} of {catalogImages(asset).length}</p></div>
                </button>
              )))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.14em] text-white/40">{label}</span>
      <select value={value} onChange={event => onChange(event.target.value)} className="w-full border border-white/10 bg-[#0c0f11] px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-[#23c7be]">
        {options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
      </select>
    </label>
  );
}

export default function CompositionElementsPanel({ userEmail, elements, setElements }) {
  const [uploading, setUploading] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);

  const addElement = (url, suggestedName = '') => setElements(current => [...current, makeElement(url, suggestedName)]);
  const updateElement = (id, patch) => setElements(current => current.map(item => item.id === id ? { ...item, ...patch } : item));
  const removeElement = id => setElements(current => current.filter(item => item.id !== id));

  const handleUpload = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (!file_url) throw new Error('Upload returned no file URL');
      addElement(file_url, file.name.replace(/\.[^.]+$/, ''));
      toast.success('Composition element added');
    } catch (error) {
      console.error('Composition element upload failed', error);
      toast.error(error?.message || 'Element could not be uploaded.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <section className="border border-white/10 bg-[#17191d] p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#23c7be]"><ImagePlus size={16} /><p className="text-[10px] font-black uppercase tracking-[0.18em]">Composition Elements</p></div>
          <h3 className="mt-1 text-lg font-black text-white">Products, props and visual elements inside the set</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-white/40">These images are not set references. They are objects the AI should include in the generated composition, including product placement and sponsor items.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex cursor-pointer items-center gap-2 border border-white/15 bg-white/[0.04] px-3 py-2.5 text-[10px] font-black text-white hover:bg-white/[0.08]"><Upload size={13} />{uploading ? 'UPLOADING...' : 'IMPORT IMAGE'}<input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} /></label>
          <button type="button" onClick={() => setVaultOpen(true)} className="flex items-center gap-2 border border-white/15 bg-white/[0.04] px-3 py-2.5 text-[10px] font-black text-white hover:bg-white/[0.08]"><Bookmark size={13} />FROM VAULT</button>
          <button type="button" onClick={() => setShopOpen(true)} className="flex items-center gap-2 border border-[#23c7be]/35 bg-[#23c7be]/10 px-3 py-2.5 text-[10px] font-black text-[#8ee9e4] hover:bg-[#23c7be]/15"><ShoppingBag size={13} />FROM ASSETS SHOP</button>
        </div>
      </div>

      {elements.length === 0 ? (
        <div className="mt-5 border border-dashed border-white/15 bg-black/15 px-5 py-8 text-center text-xs text-white/35">No composition elements yet. Add a product, prop or object only when it should appear inside the generated set.</div>
      ) : (
        <div className="mt-5 space-y-4">
          {elements.map((item, index) => (
            <article key={item.id} className="border border-white/10 bg-[#111417] p-4">
              <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
                <div className="relative aspect-square overflow-hidden border border-white/10 bg-black"><img src={item.image_url} alt={item.name || `Composition element ${index + 1}`} className="h-full w-full object-contain" /><span className="absolute left-2 top-2 bg-black/80 px-2 py-1 text-[9px] font-black text-[#8ee9e4]">ELEMENT {index + 1}</span></div>
                <div className="min-w-0 space-y-4">
                  <div className="flex gap-2">
                    <input value={item.name || ''} onChange={event => updateElement(item.id, { name: event.target.value })} placeholder="Element name — e.g. UNRULED perfume" className="min-w-0 flex-1 border border-white/10 bg-black/25 px-3 py-2.5 text-sm font-black text-white outline-none placeholder:text-white/25 focus:border-[#23c7be]" />
                    <button type="button" onClick={() => removeElement(item.id)} className="flex h-10 w-10 items-center justify-center border border-red-400/20 bg-red-400/[0.06] text-red-200 hover:bg-red-400/10" title="Remove element"><Trash2 size={15} /></button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <SelectField label="Role" value={item.role} options={ROLE_OPTIONS} onChange={value => updateElement(item.id, { role: value })} />
                    <SelectField label="Priority" value={item.priority} options={PRIORITY_OPTIONS} onChange={value => updateElement(item.id, { priority: value })} />
                    <SelectField label="Visibility" value={item.visibility} options={VISIBILITY_OPTIONS} onChange={value => updateElement(item.id, { visibility: value })} />
                    <SelectField label="Placement" value={item.placement} options={PLACEMENT_OPTIONS} onChange={value => updateElement(item.id, { placement: value })} />
                    <SelectField label="Scale" value={item.scale} options={SCALE_OPTIONS} onChange={value => updateElement(item.id, { scale: value })} />
                  </div>
                  <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.14em] text-white/40">Placement Instructions</span><textarea value={item.instruction || ''} onChange={event => updateElement(item.id, { instruction: event.target.value })} rows={3} placeholder="Example: Place the bottle on the black marble pedestal near the window. Keep the label facing camera without making the scene look like an advertisement." className="w-full resize-none border border-white/10 bg-black/25 px-3 py-3 text-xs leading-5 text-white outline-none placeholder:text-white/25 focus:border-[#23c7be]" /></label>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <AnimatePresence>
        {vaultOpen && <VaultPickerModal userEmail={userEmail} onSelect={url => { addElement(url); setVaultOpen(false); }} onClose={() => setVaultOpen(false)} />}
        {shopOpen && <AssetsShopPicker onSelect={(url, title) => { addElement(url, title); setShopOpen(false); }} onClose={() => setShopOpen(false)} />}
      </AnimatePresence>
    </section>
  );
}
