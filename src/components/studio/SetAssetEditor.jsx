import React, { useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Bookmark, Check, Loader2, ShoppingBag, Upload, Sparkles, ImagePlus, Camera, Sun, Moon, Eye, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import VaultPickerModal from '@/components/studio/VaultPickerModal';
import ImageCropModal from '@/components/studio/ImageCropModal';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';
import SetGeneratorPanel from '@/components/studio/SetGeneratorPanel';
import CompositionElementsPanel from '@/components/studio/CompositionElementsPanel';
import { toast } from 'sonner';
import { useStudioTranslation } from '@/lib/useStudioTranslation';
import SET_DESIGNER_IMAGES from '@/setDesignerImages/all';
import { useAiModelOptions } from '@/hooks/useAiModelOptions';
import { useAiPriceQuote } from '@/hooks/useAiPriceQuote';

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

function OloShopSetPicker({ selectedImages = [], onToggle, onSelect, onClose }) {
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
                  const selected = !onSelect && selectedImages.includes(url);
                  const full = !onSelect && !selected && selectedImages.filter(Boolean).length >= 8;
                  return <button key={`${asset.id}-${url}`} onClick={() => onSelect ? onSelect(url, asset.title) : onToggle(url)} disabled={full} className={`group relative aspect-[4/3] overflow-hidden rounded-[3px] border transition ${selected ? 'border-[#23c7be]' : 'border-transparent hover:border-[#23c7be]/60'} ${full ? 'cursor-not-allowed opacity-35' : ''}`} title={`Use image ${index + 1} of ${asset.title || 'this asset'}`}>
                    <img src={url} alt={`${asset.title || 'Assets Shop asset'} · image ${index + 1}`} className="h-full w-full object-contain transition duration-300 group-hover:scale-105" />
                    <span className={`absolute bottom-1.5 right-1.5 rounded-[3px] px-2 py-0.5 text-[9px] font-black ${selected ? 'bg-[#23c7be] text-black' : 'bg-black/80 text-white'}`}>{selected ? 'Selected' : `${index + 1}/${gallery.length}`}</span>
                  </button>;
                })}</div>
                <div className="p-3"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-black text-white">{asset.title || 'Untitled'}</p><span className="flex-shrink-0 text-[10px] font-bold text-[#8ee9e4]">{gallery.length} image{gallery.length === 1 ? '' : 's'}</span></div><p className="mt-1 truncate text-[10px] text-white/40">{asset.creator_name || 'Assets Shop'}{selectedCount ? ` · ${selectedCount} selected` : ''}</p></div>
              </article>;
            })}</div>
            : <div className="flex min-h-64 items-center justify-center rounded-[4px] border border-dashed border-white/15 text-sm text-white/45">No published Assets Shop item matches this search.</div>}
        </div>
        <footer className="flex items-center justify-between border-t border-white/10 p-4"><span className="text-xs font-bold text-white/50">{onSelect ? 'Choose one image to add to the Reference Sheet' : `${selectedImages.filter(Boolean).length}/8 set images selected`}</span><button onClick={onClose} className="rounded-[3px] bg-[#23c7be] px-6 py-3 text-sm font-black text-black">Done</button></footer>
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
  const t = useStudioTranslation();
  const qc = useQueryClient();
  const [projectId, setProjectId] = useState(asset?.id || null);
  const [name, setName] = useState(asset?.name || '');
  const [description, setDescription] = useState(asset?.description || '');
  const [tags, setTags] = useState(asset?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [images, setImages] = useState(asset?.images || []);
  const [viewVariants, setViewVariants] = useState(asset?.reference_sheet?.view_variants || {});
  const [zoneShots, setZoneShots] = useState(Array.isArray(asset?.reference_sheet?.zone_shots) ? asset.reference_sheet.zone_shots : []);
  const [compositionElements, setCompositionElements] = useState(Array.isArray(asset?.composition_elements) ? asset.composition_elements : []);
  const [referenceSheet, setReferenceSheet] = useState(asset?.reference_sheet || null);
  const [detectedElements, setDetectedElements] = useState([]);
  const [extracting, setExtracting] = useState(false);
  const [referenceUploadingId, setReferenceUploadingId] = useState(null);
  const [savedReferenceDraft, setSavedReferenceDraft] = useState(Array.isArray(asset?.reference_sheet?.extracted_elements) ? asset.reference_sheet.extracted_elements : []);
  const [editingSavedReferenceId, setEditingSavedReferenceId] = useState(null);
  const [enhanceReferenceId, setEnhanceReferenceId] = useState(null);
  const [enhancePrompt, setEnhancePrompt] = useState('');
  const [enhanceModelKey, setEnhanceModelKey] = useState('');
  const [enhancingImage, setEnhancingImage] = useState(false);
  const [referenceSource, setReferenceSource] = useState(null);
  const [newReferencePrompt, setNewReferencePrompt] = useState('');
  const [newReferenceModel, setNewReferenceModel] = useState('');
  const [newReferenceGenerating, setNewReferenceGenerating] = useState(false);
  const [newReferenceUploading, setNewReferenceUploading] = useState(false);
  const [referencesDirty, setReferencesDirty] = useState(false);
  const enhanceTarget = savedReferenceDraft.find(item => item.id === enhanceReferenceId);
  const enhanceInput = useMemo(() => ({
    prompt: enhancePrompt || 'Enhance detail while preserving the original object, colors, shape and composition.',
    reference_image_urls: enhanceTarget?.image_url ? [enhanceTarget.image_url] : [],
    aspect_ratio: '1:1',
  }), [enhancePrompt, enhanceTarget?.image_url]);
  const { options: enhanceModels, loading: enhanceModelsLoading } = useAiModelOptions({
    service: 'replicateGenerate:compose_scene', kind: 'image',
    input: enhanceInput, enabled: Boolean(enhanceReferenceId),
  });
  const chosenEnhanceModel = enhanceModelKey || enhanceModels.find(model => model.recommended)?.model_key || enhanceModels[0]?.model_key || '';
  const { quote: enhanceQuote, loading: enhancePriceLoading } = useAiPriceQuote({
    service: 'replicateGenerate:compose_scene', kind: 'image',
    input: enhanceInput, modelKey: chosenEnhanceModel,
    enabled: Boolean(enhanceReferenceId && chosenEnhanceModel),
  });
  const newReferenceInput = useMemo(() => ({
    prompt: newReferencePrompt, aspect_ratio: '1:1', reference_image_urls: [],
  }), [newReferencePrompt]);
  const { options: newReferenceModels, loading: newReferenceModelsLoading } = useAiModelOptions({
    service: 'replicateGenerate:compose_scene', kind: 'image', input: newReferenceInput,
    enabled: referenceSource === 'prompt' && Boolean(newReferencePrompt.trim()),
  });
  const chosenNewReferenceModel = newReferenceModel || newReferenceModels.find(model => model.recommended)?.model_key || newReferenceModels[0]?.model_key || '';
  const { quote: newReferenceQuote, loading: newReferencePriceLoading } = useAiPriceQuote({
    service: 'replicateGenerate:compose_scene', kind: 'image', input: newReferenceInput,
    modelKey: chosenNewReferenceModel, enabled: referenceSource === 'prompt' && Boolean(chosenNewReferenceModel && newReferencePrompt.trim()),
  });
  const selectionStartRef = useRef(null);
  const [selectionPreview, setSelectionPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vaultPickerOpen, setVaultPickerOpen] = useState(false);
  const [oloPickerOpen, setOloPickerOpen] = useState(false);
  const [cropSource, setCropSource] = useState(null);
  const [vaultSaveUrl, setVaultSaveUrl] = useState(null);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || images.filter(Boolean).length >= 8) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setImages(prev => {
        const next = [...prev];
        const emptyIndex = next.findIndex(value => !value);
        if (emptyIndex >= 0) next[emptyIndex] = file_url;
        else next.push(file_url);
        return next.slice(0, 8);
      });
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
      if (current.includes(url)) return current.map(image => image === url ? null : image);
      if (current.filter(Boolean).length >= 8) { toast.error('A set can contain up to 8 images'); return current; }
      const next = [...current];
      const emptyIndex = next.findIndex(value => !value);
      if (emptyIndex >= 0) next[emptyIndex] = url;
      else next.push(url);
      return next.slice(0, 8);
    });
  };

  const handleCropConfirm = async (blob) => {
    setUploading(true);
    setCropSource(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: blob });
      setImages(prev => {
        const next = [...prev];
        const emptyIndex = next.findIndex(value => !value);
        if (emptyIndex >= 0) next[emptyIndex] = file_url;
        else next.push(file_url);
        return next.slice(0, 8);
      });
      toast.success('Image added to set', { icon: <Check size={16} /> });
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (idx) => setImages(prev => {
    const next = [...prev];
    next[idx] = null;
    return next;
  });
  const addTag = (e) => {
    e.preventDefault();
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  };
  const removeTag = (tag) => setTags(prev => prev.filter(t => t !== tag));
  const setCreativeField = (label, value) => setDescription(prev => writeBriefField(prev, label, value));

  const pointerPosition = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1000, Math.round((event.clientX - rect.left) * 1000 / rect.width))),
      Math.max(0, Math.min(1000, Math.round((event.clientY - rect.top) * 1000 / rect.height))),
    ];
  };

  const beginSelection = (event) => {
    if (!images[0] || extracting || saving || event.button !== 0) return;
    const point = pointerPosition(event);
    selectionStartRef.current = point;
    setSelectionPreview([point[0], point[1], point[0], point[1]]);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveSelection = (event) => {
    if (!selectionStartRef.current) return;
    const [x, y] = pointerPosition(event);
    const [sx, sy] = selectionStartRef.current;
    setSelectionPreview([Math.min(sx,x), Math.min(sy,y), Math.max(sx,x), Math.max(sy,y)]);
  };

  const finishSelection = (event) => {
    if (!selectionStartRef.current) return;
    const [x, y] = pointerPosition(event);
    const [sx, sy] = selectionStartRef.current;
    selectionStartRef.current = null;
    setSelectionPreview(null);
    const bbox = [Math.min(sx,x), Math.min(sy,y), Math.max(sx,x), Math.max(sy,y)];
    if (bbox[2]-bbox[0] < 15 || bbox[3]-bbox[1] < 15) return;
    setReferencesDirty(true);
    setDetectedElements(current => [...current, {
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      name: '', role: 'set_dressing', placement: '',
      bbox, source_image_url: images[0], image_url: '', included: true,
    }]);
  };

  const addExternalReference = (url, proposedName = 'New Reference') => {
    if (!url) return;
    setSavedReferenceDraft(current => [...current, {
      id: `external-${crypto.randomUUID()}`,
      name: String(proposedName || 'New Reference').slice(0, 140),
      image_url: url, source_image_url: url, role: 'set_dressing', placement: '',
      replacement: true, included: true,
    }]);
    setReferencesDirty(true);
    setReferenceSource(null);
    toast.success('Reference added to the sheet. Save changes to keep it.');
  };

  const uploadExternalReference = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Choose an image.');
    setNewReferenceUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (!file_url) throw new Error('Upload returned no image.');
      addExternalReference(file_url, file.name.replace(/\\.[^.]+$/, ''));
    } catch (error) { toast.error(error.message || 'Could not upload reference.'); }
    finally { setNewReferenceUploading(false); }
  };

  const generateExternalReference = async () => {
    if (!newReferencePrompt.trim() || !chosenNewReferenceModel || !newReferenceQuote?.credits) return toast.error('Enter a prompt and choose a priced image model.');
    if (!window.confirm(`Generate one reference for ${newReferenceQuote.credits} credits?`)) return;
    setNewReferenceGenerating(true);
    try {
      const result = await base44.functions.invoke('replicateGenerate', {
        method: 'compose_scene', model_key: chosenNewReferenceModel,
        prompt: `Create a single clean, high-quality production reference image of the following set element: ${newReferencePrompt.trim()}. Isolate the specified subject clearly on a neutral grey studio background. No unrelated objects, no people, no text.`,
        reference_image_urls: [], aspect_ratio: '1:1',
      });
      if (result.data?.error) throw new Error(result.data.error);
      if (!result.data?.file_url) throw new Error('Image model returned no file.');
      addExternalReference(result.data.file_url, newReferencePrompt.trim().slice(0, 100));
      setNewReferencePrompt('');
    } catch (error) { toast.error(error.message || 'Could not generate reference.'); }
    finally { setNewReferenceGenerating(false); }
  };

  const updateSavedReference = (id, patch) => {
    setSavedReferenceDraft(current => current.map(item => item.id === id ? { ...item, ...patch } : item));
    setReferencesDirty(true);
  };

  const saveSavedReferences = async (entries = savedReferenceDraft) => {
    if (!referenceSheet) return;
    if (entries.some(item => !item.name?.trim() || !item.image_url)) return toast.error('Each saved reference needs a name and image.');
    const sheet = { ...referenceSheet, extracted_elements: entries, updated_at: new Date().toISOString() };
    const saved = await handleSave(sheet);
    if (saved) {
      setSavedReferenceDraft(entries);
      setReferencesDirty(false);
      toast.success('Saved references updated.');
    }
  };

  const cropSavedReference = async (file) => {
    if (!editingSavedReferenceId) return;
    setReferenceUploadingId(editingSavedReferenceId);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (!file_url) throw new Error('Edited image upload failed.');
      updateSavedReference(editingSavedReferenceId, { image_url: file_url, replacement: true });
      setEditingSavedReferenceId(null);
      toast.success('Image crop ready. Save Reference Sheet to keep it.');
    } catch (error) { toast.error(error.message || 'Could not crop reference image.'); }
    finally { setReferenceUploadingId(null); }
  };

  const enhanceSavedReference = async () => {
    const target = savedReferenceDraft.find(item => item.id === enhanceReferenceId);
    if (!target?.image_url || !chosenEnhanceModel || !enhancePrompt.trim() || !enhanceQuote?.credits) return toast.error('Select an image model, enter the edit direction and confirm the price.');
    if (!window.confirm(`Generate an enhanced version for ${enhanceQuote.credits} credits? The saved original will remain unchanged until you save.`)) return;
    setEnhancingImage(true);
    try {
      const res = await base44.functions.invoke('replicateGenerate', {
        method: 'compose_scene',
        model_key: chosenEnhanceModel,
        prompt: `IMAGE-TO-IMAGE REFINEMENT. The supplied reference image is the mandatory source. Edit ONLY the pictured object according to the following instruction: ${enhancePrompt.trim()}. Preserve the original object's identity, geometry, structure, colors and composition unless the instruction specifically requests a change. Do not introduce unrelated objects, scenery, people or text.`,
        reference_image_urls: [target.image_url],
        aspect_ratio: '1:1',
      });
      if (res.data?.error) throw new Error(res.data.error);
      if (!res.data?.file_url) throw new Error('No edited image returned.');
      updateSavedReference(enhanceReferenceId, { image_url: res.data.file_url, replacement: true });
      setEnhanceReferenceId(null);
      setEnhancePrompt('');
      toast.success('Enhanced draft ready. Save Reference Sheet to keep it.');
    } catch (error) { toast.error(error.message || 'Could not enhance reference image.'); }
    finally { setEnhancingImage(false); }
  };

  const cropObject = async (source, bbox, index) => {
    const response = await fetch(source);
    if (!response.ok) throw new Error('The source image could not be loaded for extraction.');
    const bitmap = await createImageBitmap(await response.blob());
    try {
      const [l,t,r,b] = bbox;
      const x = Math.floor(bitmap.width * l / 1000);
      const y = Math.floor(bitmap.height * t / 1000);
      const w = Math.min(bitmap.width-x, Math.max(1, Math.ceil(bitmap.width * (r-l)/1000)));
      const h = Math.min(bitmap.height-y, Math.max(1, Math.ceil(bitmap.height * (b-t)/1000)));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas cropping unavailable.');
      context.drawImage(bitmap, x, y, w, h, 0, 0, w, h);
      const blob = await new Promise((resolve,reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Crop failed')), 'image/png'));
      const { file_url } = await base44.integrations.Core.UploadFile({ file: new File([blob], `set-object-${index}.png`, { type:'image/png' }) });
      if (!file_url) throw new Error('Extracted object could not be stored.');
      return file_url;
    } finally { bitmap.close(); }
  };

  const buildReferenceSheet = () => {
    const views = IMAGE_ROLES.map((role, index) => ({ role, url: images[index] })).filter((item) => Boolean(item.url));
    if (!views.length) throw new Error('Add at least one set reference image before creating the sheet.');
    const elements = compositionElements.filter((item) => item?.image_url || item?.name).map((item) => ({
      id: item.id, image_url: item.image_url || '', name: item.name || '',
      role: item.role || '', priority: item.priority || '', placement: item.placement || '',
      scale: item.scale || '', instruction: item.instruction || '',
    }));
    return {
      version: 1,
      created_at: new Date().toISOString(),
      name: name.trim(),
      description: description.trim(),
      views,
      composition_elements: elements,
      extracted_elements: savedReferenceDraft,
    };
  };

  const createReferenceSheet = async () => {
    if (!name.trim()) return toast.error('Name the Set first.');
    if (!images[0]) return toast.error('Add a Hero reference first.');
    setExtracting(true);
    try {
      const chosen = detectedElements.filter(item => item.included !== false);
      if (chosen.some(item => item.source_image_url !== images[0] && !item.replacement && !item.image_url))
        throw new Error('A reference has a different source image. Select it again.');
      if (!chosen.length) throw new Error('Select at least one object from the image first.');
      if (chosen.some(item => !item.name?.trim())) throw new Error('Name each selected element before saving.');
      const extracted = [];
      for (let index = 0; index < chosen.length; index++) {
        const item = chosen[index];
        if (!Array.isArray(item.bbox) || item.bbox.length !== 4 || item.bbox.some(v => !Number.isFinite(v)) ||
          item.bbox[2] <= item.bbox[0] || item.bbox[3] <= item.bbox[1]) throw new Error('Invalid bounding box; correct the selected element.');
        const url = item.image_url && (item.source_image_url === images[0] || item.replacement)
          ? item.image_url : await cropObject(images[0], item.bbox, index);
        extracted.push({ ...item, source_image_url: images[0], image_url: url });
      }
      // Existing saved references (including their edited images) are authoritative.
      // New selections are added without regenerating or replacing old crops.
      const existing = savedReferenceDraft;
      const existingIds = new Set(existing.map(item => item.id));
      const additions = extracted.filter(item => !existingIds.has(item.id));
      const sheet = { ...buildReferenceSheet(), extracted_elements: [...existing, ...additions] };
      const saved = await handleSave(sheet);
      if (saved) { setDetectedElements([]); setReferencesDirty(false); }
    } catch (error) { toast.error(error.message || 'Reference sheet extraction failed.'); }
    finally { setExtracting(false); }
  };

  const handleSave = async (newSheet = null) => {
    setSaving(true);
    try {
      const payload = {
        user_email: userEmail,
        name: name.trim(),
        description: description.trim(),
        tags,
        images,
        composition_elements: compositionElements,
        reference_sheet: { ...(newSheet?.version === 1 ? newSheet : referenceSheet || {}), view_variants: viewVariants, zone_shots: zoneShots },
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

      if (newSheet?.version === 1) { setReferenceSheet(newSheet); setSavedReferenceDraft(Array.isArray(newSheet.extracted_elements) ? newSheet.extracted_elements : []); }
      qc.invalidateQueries({ queryKey: ['setDesignerProjects'] });
      onSaved?.(saved);
      toast.success(newSheet?.version === 1 ? 'Set reference sheet created and saved' : projectId ? 'Set updated' : 'Set saved');
      return saved;
    } catch (error) {
      console.error('Set Designer project save failed', error);
      toast.error(error?.message || 'Set could not be saved. Try again.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const downloadImage = async (url, role) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Download failed (${response.status})`);
      const blob = await response.blob();
      const extension = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
      const safeSetName = (name.trim() || 'set').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'set';
      const safeRole = String(role || 'image').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'image';
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${safeSetName}-${safeRole}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Set image download failed', error);
      toast.error('Image could not be downloaded.');
    }
  };

  const heroImage = images[0];
  const referenceCount = images.filter(Boolean).length;

  return (
    <motion.div
      className={`fixed z-[100] flex flex-col overflow-y-auto bg-[#202328] text-white ${embedded ? 'top-14 right-0 bottom-[var(--bottom-nav-height)] left-0 lg:left-[var(--studio-toolbar-width)]' : 'inset-0'}`}
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
    >
      <div className="flex min-h-screen flex-col bg-[#202328] text-white">
        <div className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-white/10 bg-[#17191d]/95 px-5 py-3 backdrop-blur">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#23c7be]">{t('setdesigner.workspace.brand', 'Set Designer')}</p>
            <h2 className="text-xl font-black text-white">{projectId ? t('setdesigner.editor.edit', 'Edit your set') : t('setdesigner.editor.create', 'Create a set')}</h2>
          </div>
          <button onClick={onClose} className="border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-white hover:bg-white/10">{embedded ? t('setdesigner.editor.my_sets', 'My Sets') : <X size={20} />}</button>
        </div>

        <div className="mx-auto w-full max-w-7xl flex-1 space-y-5 px-4 py-5 pb-28 sm:px-5">
          <SetGeneratorPanel name={name} description={description} images={images} setImages={setImages} viewVariants={viewVariants} setViewVariants={setViewVariants} zoneShots={zoneShots} setZoneShots={setZoneShots} compositionElements={compositionElements} />

          <details key={heroImage ? 'master-ready' : 'master-empty'} defaultOpen={!heroImage} className="border border-white/10 bg-[#17191d]">
            <summary className="cursor-pointer p-4 text-sm font-black uppercase tracking-wider text-[#23c7be]">Master Set Details & Creative Direction — {heroImage ? 'Expand to edit' : 'Required for creation'}</summary>
          <section className="overflow-hidden border-t border-white/10 bg-[#17191d]">
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
                  {referenceCount < 8 && <label className="flex cursor-pointer items-center gap-2 bg-[#23c7be] px-4 py-2.5 text-xs font-black text-[#071211] transition hover:bg-[#35d8cf]"><Upload size={14} />Import reference<input type="file" accept="image/*" className="hidden" onChange={handleUpload} /></label>}
                  {referenceCount < 8 && <button type="button" onClick={() => setVaultPickerOpen(true)} className="flex items-center gap-2 border border-white/15 bg-black/65 px-4 py-2.5 text-xs font-bold text-white backdrop-blur hover:bg-black/80"><Bookmark size={14} />Vault</button>}
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
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.24em] text-white/55">{t('setdesigner.workspace.brand', 'Set Designer')}</p>
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

          </details>

          <CompositionElementsPanel userEmail={userEmail} elements={compositionElements} setElements={setCompositionElements} />

          <section className="border border-white/10 bg-[#17191d] p-5 sm:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><div className="flex items-center gap-2 text-[#23c7be]"><ImagePlus size={16} /><p className="text-[10px] font-black uppercase tracking-[0.18em]">Visual Continuity Board</p></div><h3 className="mt-1 text-lg font-black">Eight references, eight production purposes</h3><p className="mt-1 text-xs text-white/40">The order gives each image a role. The first image is the visual anchor for the whole set.</p></div>
              <span className="text-xs font-black text-white/45">{referenceCount}/8 REFERENCES</span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {IMAGE_ROLES.map((role, idx) => {
                const url = images[idx];
                return (
                  <div key={role} className={`relative aspect-[4/3] overflow-hidden border ${url ? 'border-white/10 bg-black' : 'border-dashed border-white/15 bg-black/15'}`}>
                    {url ? <img src={url} alt={`${role} set reference`} className="h-full w-full object-cover" /> : <div className="flex h-full flex-col items-center justify-center px-3 text-center text-white/25"><Camera size={18} /><span className="mt-2 text-[10px] font-bold">Add reference</span></div>}
                    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-2 bg-black/80 px-2.5 py-2 backdrop-blur"><span className="truncate text-[9px] font-black uppercase tracking-[0.08em] text-white/75">{idx + 1}. {role}</span>{url && <button type="button" onClick={() => removeImage(idx)} className="flex h-5 w-5 flex-shrink-0 items-center justify-center bg-white/10 text-white hover:bg-white/20"><X size={10} /></button>}</div>
                    {url && <div className="absolute left-2 top-2 flex gap-1.5">
                      <button type="button" onClick={() => downloadImage(url, role)} className="flex h-7 items-center gap-1 border border-white/20 bg-black/80 px-2 text-[9px] font-black text-white backdrop-blur hover:bg-black"><Download size={11} />DOWNLOAD</button>
                      <button type="button" onClick={() => setVaultSaveUrl(url)} className="flex h-7 items-center gap-1 border border-[#23c7be]/35 bg-black/80 px-2 text-[9px] font-black text-[#8ee9e4] backdrop-blur hover:bg-black"><Bookmark size={11} />VAULT</button>
                    </div>}
                  </div>
                );
              })}
            </div>
            {uploading && <div className="mt-3 flex items-center gap-2 text-xs font-bold text-[#8ee9e4]"><Loader2 size={14} className="animate-spin" />Adding reference...</div>}
          </section>

          <section className="border border-white/10 bg-[#17191d] p-4 sm:p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#23c7be]">Set Reference Sheet</p>
            <h3 className="mt-1 text-lg font-bold text-white">Select exactly what you want to extract</h3>
            <p className="mt-1 text-xs text-white/50">Draw a rectangle on the Hero image to add a new element. Already saved references keep their edited images and can be changed separately below.</p>
            {images[0] ? (
              <div className="mt-4">
                <div
                  role="group" aria-label="Select object regions on the set image"
                  className="relative w-full max-w-5xl cursor-crosshair select-none overflow-hidden border border-white/20 bg-black"
                  style={{ touchAction: 'none' }}
                  onPointerDown={beginSelection}
                  onPointerMove={moveSelection}
                  onPointerUp={finishSelection}
                  onPointerCancel={() => { selectionStartRef.current=null; setSelectionPreview(null); }}
                >
                  <img src={images[0]} alt="Hero set reference: drag to select an object" className="block h-auto w-full pointer-events-none" draggable={false} />
                  {detectedElements.filter(item => item.included !== false && item.source_image_url === images[0]).map((item, i) => {
                    const [l,t,r,b] = item.bbox || [0,0,0,0];
                    return <div key={item.id} className="pointer-events-none absolute border border-[#23c7be]/65 bg-[#23c7be]/10" style={{
                      left:`${l/10}%`,top:`${t/10}%`,width:`${(r-l)/10}%`,height:`${(b-t)/10}%`,
                    }}><span className="absolute left-0 top-0 bg-black/80 px-1 text-[10px] text-white">{item.name || `Selection ${i+1}`}</span></div>;
                  })}
                  {selectionPreview && <div className="pointer-events-none absolute border-2 border-[#23c7be] bg-[#23c7be]/20" style={{
                    left:`${selectionPreview[0]/10}%`,top:`${selectionPreview[1]/10}%`,
                    width:`${(selectionPreview[2]-selectionPreview[0])/10}%`,height:`${(selectionPreview[3]-selectionPreview[1])/10}%`,
                  }} />}
                </div>
                <p className="mt-2 text-xs text-white/45">Select only NEW objects here. Existing saved references and their edits are preserved below.</p>
              </div>
            ) : <p className="mt-3 text-xs text-white/45">Add a Hero set image to begin selecting objects.</p>}
            {!!detectedElements.length && <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-white/65">{detectedElements.length} selected regions</p>
                <button type="button" onClick={() => {
                  if (window.confirm('Clear the current selections? The saved reference sheet will remain unchanged until you save.')) {
                    setDetectedElements([]); setReferencesDirty(true);
                  }
                }} className="border border-white/15 px-3 py-1.5 text-xs text-white/70 hover:text-white">Clear selections</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {detectedElements.map((item, index) => {
                  const [l,t,r,b] = item.bbox || [0,0,1000,1000];
                  return <div key={item.id} className={`space-y-2 border border-white/15 p-3 ${item.included === false ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs text-white"><input type="checkbox" checked={item.included !== false} onChange={event => { setReferencesDirty(true); setDetectedElements(current => current.map(el => el.id === item.id ? { ...el, included: event.target.checked } : el)); }} /> Include</label>
                      <button type="button" onClick={() => { setReferencesDirty(true); setDetectedElements(current => current.filter(el => el.id !== item.id)); }} className="text-xs text-red-300/75 hover:text-red-300">Remove</button>
                    </div>
                    <input value={item.name} placeholder={`Name selection ${index+1}`} aria-label={`Selection ${index+1} name`} onChange={event => { setReferencesDirty(true); setDetectedElements(current => current.map(el => el.id === item.id ? { ...el, name: event.target.value } : el)); }} className="w-full border border-white/15 bg-black px-2 py-2 text-xs text-white" />
                    <p className="text-[11px] text-white/45">Area in original image</p>
                    <div className="relative aspect-video overflow-hidden bg-black">
                      <img src={item.source_image_url || images[0]} alt={item.name || 'Selected area'} className="h-full w-full object-fill" />
                      <div className="pointer-events-none absolute border-2 border-[#23c7be]" style={{left:`${l/10}%`,top:`${t/10}%`,width:`${(r-l)/10}%`,height:`${(b-t)/10}%`}} />
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {['L','T','R','B'].map((label, coordinate) => <label key={label} className="text-[10px] text-white/45">{label}<input type="number" min="0" max="1000" value={item.bbox?.[coordinate] ?? 0} onChange={event => { setReferencesDirty(true); setDetectedElements(current => current.map(el => el.id === item.id ? { ...el, bbox: el.bbox.map((v,i) => i===coordinate ? Math.max(0,Math.min(1000,Number(event.target.value))) : v), image_url:'', replacement:false } : el)); }} className="mt-1 w-full border border-white/15 bg-black px-1 py-1 text-xs text-white" /></label>)}
                    </div>
                  </div>;
                })}
              </div>
              <button type="button" onClick={createReferenceSheet} disabled={extracting || saving || Boolean(referenceUploadingId) || !detectedElements.some(item => item.included !== false)}
                className="inline-flex items-center gap-2 bg-[#23c7be] px-4 py-2.5 text-xs font-bold text-[#071211] disabled:opacity-40">
                {extracting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                Add Selected References
              </button>
            </div>}
            {referenceSheet && <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-white/70">Saved Reference Sheet · {savedReferenceDraft.length} objects</p>
                  <p className="mt-1 text-xs text-white/40">Edit each saved image here, not in the object selection above. Changes are saved only when you confirm.</p>
                </div>
                <button type="button" onClick={() => saveSavedReferences()} disabled={saving || Boolean(referenceUploadingId) || !referencesDirty}
                  className="bg-[#23c7be] px-3 py-2 text-xs font-bold text-black disabled:opacity-40">
                  {saving ? 'Saving…' : 'Save Reference Sheet Changes'}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                <span className="mr-2 text-xs font-semibold text-white/65">Add Reference</span>
                <label className="cursor-pointer border border-white/20 px-3 py-2 text-xs text-white hover:bg-white/10">
                  {newReferenceUploading ? 'Uploading…' : 'Upload'}
                  <input type="file" accept="image/*" disabled={newReferenceUploading || saving} className="hidden" onChange={uploadExternalReference} />
                </label>
                <button type="button" onClick={() => setReferenceSource('vault')} className="border border-white/20 px-3 py-2 text-xs text-white hover:bg-white/10">My Vault</button>
                <button type="button" onClick={() => setReferenceSource('shop')} className="border border-white/20 px-3 py-2 text-xs text-white hover:bg-white/10">Assets Shop</button>
                <button type="button" onClick={() => { setReferenceSource(current => current === 'prompt' ? null : 'prompt'); setNewReferenceModel(''); }} className="border border-[#23c7be]/50 px-3 py-2 text-xs text-[#8ee9e4] hover:bg-[#23c7be]/10">Create with Prompt</button>
              </div>
              {referenceSource === 'prompt' && <div className="space-y-3 border border-white/15 bg-black/25 p-4">
                <label className="block text-xs text-white/60">Describe the new object or reference
                  <textarea rows={3} value={newReferencePrompt} onChange={event => setNewReferencePrompt(event.target.value)} placeholder="A white porcelain place setting, silver flatware, neutral grey backdrop…" className="mt-2 w-full border border-white/20 bg-black p-3 text-sm text-white" />
                </label>
                <label className="block text-xs text-white/60">Image model
                  <select value={chosenNewReferenceModel} onChange={event => setNewReferenceModel(event.target.value)} className="mt-2 w-full border border-white/20 bg-black p-3 text-sm text-white">
                    {newReferenceModelsLoading && <option value="">Loading models…</option>}
                    {!newReferenceModelsLoading && !newReferenceModels.length && <option value="">No image model available</option>}
                    {newReferenceModels.map(model => <option key={model.model_key} value={model.model_key}>{model.name || model.model_key}</option>)}
                  </select>
                </label>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-white/50">Generation cost: {newReferencePriceLoading ? 'Calculating…' : newReferenceQuote?.credits ? `${newReferenceQuote.credits} credits` : 'Unavailable'}</span>
                  <button type="button" onClick={generateExternalReference} disabled={newReferenceGenerating || newReferencePriceLoading || !newReferenceQuote?.credits || !chosenNewReferenceModel || !newReferencePrompt.trim()} className="bg-[#23c7be] px-4 py-2.5 text-xs font-bold text-black disabled:opacity-40">
                    {newReferenceGenerating ? 'Generating…' : 'Generate Reference'}
                  </button>
                </div>
              </div>}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {savedReferenceDraft.map((item,index) => <div key={item.id || index} className="min-w-0 space-y-2 border border-white/15 bg-black/25 p-3">
                  <div className="aspect-[4/3] bg-black">
                    <img src={item.image_url} alt={item.name} className="h-full w-full object-contain" />
                  </div>
                  <input aria-label={`Reference ${index+1} name`} value={item.name || ''} onChange={event => updateSavedReference(item.id, { name: event.target.value })}
                    className="w-full border border-white/15 bg-black px-2 py-2 text-xs font-semibold text-white" />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setEditingSavedReferenceId(item.id)} className="border border-white/20 px-2 py-1.5 text-xs text-white hover:bg-white/10">Crop / Reframe</button>
                    <button type="button" onClick={() => { setEnhanceReferenceId(item.id); setEnhancePrompt('Improve sharpness, clarity and fine detail without changing the actual object or its design.'); setEnhanceModelKey(''); }}
                      className="border border-[#23c7be]/50 px-2 py-1.5 text-xs text-[#8ee9e4] hover:bg-[#23c7be]/10">AI Edit / Enhance</button>
                    <button type="button" onClick={() => { if (window.confirm(`Remove ${item.name || 'this reference'} from the saved reference sheet?`)) { setSavedReferenceDraft(current => current.filter(el => el.id !== item.id)); setReferencesDirty(true); } }}
                      className="border border-red-400/20 px-2 py-1.5 text-xs text-red-300 hover:bg-red-500/10">Remove</button>
                  </div>
                </div>)}
              </div>
              {referencesDirty && <p className="text-xs text-[#8ee9e4]">You have unsaved changes to the reference sheet.</p>}
            </div>}
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            <div className="border border-white/10 bg-[#17191d] p-4"><Sun size={17} className="text-[#23c7be]" /><p className="mt-3 text-sm font-black">Day / Night continuity</p><p className="mt-1 text-xs leading-5 text-white/40">Use slots 7 and 8 to keep the same environment readable across lighting changes.</p></div>
            <div className="border border-white/10 bg-[#17191d] p-4"><Camera size={17} className="text-[#23c7be]" /><p className="mt-3 text-sm font-black">Camera-ready angles</p><p className="mt-1 text-xs leading-5 text-white/40">Wide, reverse and side references make the location useful beyond a single hero image.</p></div>
            <div className="border border-white/10 bg-[#17191d] p-4"><Moon size={17} className="text-[#23c7be]" /><p className="mt-3 text-sm font-black">One world, many shots</p><p className="mt-1 text-xs leading-5 text-white/40">The brief and reference board stay together as one reusable production set.</p></div>
          </section>
        </div>

        <div className="sticky bottom-0 z-10 border-t border-white/10 bg-[#17191d]/95 px-5 py-3 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
            <p className="hidden text-xs text-white/35 sm:block">{name.trim() ? `${name.trim()} · ${referenceCount} reference${referenceCount === 1 ? '' : 's'} · ${compositionElements.length} composition element${compositionElements.length === 1 ? '' : 's'}` : t('setdesigner.editor.name_required', 'Name your set to create it.')}</p>
            <button onClick={() => handleSave()} disabled={saving || !name.trim()} className="ml-auto min-w-[210px] border border-[#23c7be] bg-[#23c7be] px-5 py-3 text-sm font-black text-[#071211] transition hover:bg-[#35d8cf] disabled:border-white/10 disabled:bg-white/[0.05] disabled:text-white/30">
              {saving ? t('setdesigner.editor.saving', 'Saving...') : t('setdesigner.editor.save', 'Save Set')}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {vaultPickerOpen && <VaultPickerModal userEmail={userEmail} onSelect={handleVaultSelect} onClose={() => setVaultPickerOpen(false)} />}
        {referenceSource === 'vault' && <VaultPickerModal userEmail={userEmail} onSelect={url => addExternalReference(url, 'Vault Reference')} onClose={() => setReferenceSource(null)} />}
        {referenceSource === 'shop' && <OloShopSetPicker onSelect={addExternalReference} onClose={() => setReferenceSource(null)} />}
        {oloPickerOpen && <OloShopSetPicker selectedImages={images.filter(Boolean)} onToggle={handleOloToggle} onClose={() => setOloPickerOpen(false)} />}
        {cropSource && <ImageCropModal imageUrl={cropSource} onConfirm={handleCropConfirm} onClose={() => setCropSource(null)} />}
        {editingSavedReferenceId && savedReferenceDraft.find(item => item.id === editingSavedReferenceId)?.image_url && (
          <ImageCropModal imageUrl={savedReferenceDraft.find(item => item.id === editingSavedReferenceId).image_url}
            onConfirm={cropSavedReference} onClose={() => setEditingSavedReferenceId(null)} />
        )}
        {enhanceReferenceId && (
          <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/85 p-4" onClick={() => !enhancingImage && setEnhanceReferenceId(null)}>
            <div className="w-full max-w-2xl space-y-4 border border-white/20 bg-[#17191d] p-5 text-white" onClick={event => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-bold">Edit saved reference with AI</h3>
                <button type="button" onClick={() => setEnhanceReferenceId(null)} disabled={enhancingImage} aria-label="Close AI editor"><X size={18}/></button>
              </div>
              {enhanceTarget?.image_url && <img src={enhanceTarget.image_url} alt={enhanceTarget.name} className="mx-auto max-h-48 w-full object-contain" />}
              <label className="block text-xs text-white/60">Editing direction
                <textarea rows={3} value={enhancePrompt} onChange={event => setEnhancePrompt(event.target.value)} className="mt-2 w-full border border-white/20 bg-black/30 p-3 text-sm text-white"/>
              </label>
              <label className="block text-xs text-white/60">AI image model
                <select value={chosenEnhanceModel} onChange={event => setEnhanceModelKey(event.target.value)}
                  className="mt-2 w-full border border-white/20 bg-black/30 p-3 text-sm text-white">
                  {enhanceModelsLoading && <option value="">Loading…</option>}
                  {!enhanceModelsLoading && !enhanceModels.length && <option value="">No image model available</option>}
                  {enhanceModels.map(model => <option key={model.model_key} value={model.model_key}>{model.name || model.model_key}</option>)}
                </select>
              </label>
              <p className="text-xs text-white/60">Cost: {enhancePriceLoading ? 'Calculating…' : enhanceQuote?.credits ? `${enhanceQuote.credits} credits` : 'Unavailable'}. The original remains saved until you approve the result.</p>
              <button type="button" onClick={enhanceSavedReference}
                disabled={enhancingImage || enhancePriceLoading || !enhanceQuote?.credits || !chosenEnhanceModel || !enhancePrompt.trim()}
                className="w-full bg-[#23c7be] px-4 py-3 text-sm font-bold text-black disabled:opacity-40">
                {enhancingImage ? 'Generating…' : 'Generate edited image'}
              </button>
            </div>
          </div>
        )}

        {vaultSaveUrl && <SaveToVaultModal userEmail={userEmail} imageUrl={vaultSaveUrl} mediaType="image" onSaved={() => { setVaultSaveUrl(null); qc.invalidateQueries({ queryKey: ['vaultAssets', userEmail] }); }} onClose={() => setVaultSaveUrl(null)} />}
      </AnimatePresence>
    </motion.div>
  );
}
