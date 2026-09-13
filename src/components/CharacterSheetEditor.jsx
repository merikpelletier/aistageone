import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight, BadgeCheck, Bookmark, Coins, ImagePlus, Library, Loader2,
  Search, Shirt, Store, Upload, UserRound, WandSparkles, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import VaultDrawer from '@/components/VaultDrawer';

const PHOTO_SLOTS = [
  { key: 'front', label: 'Full front', hint: 'Neutral pose', short: 'FRONT', guide: '/actor-guides/front.webp', accent: 'border-[#ff7868]' },
  { key: 'back', label: 'Full back', hint: 'Clothing details', short: 'BACK', guide: '/actor-guides/back.webp', accent: 'border-[#e7ae46]' },
  { key: 'side', label: 'Side view', hint: 'Body profile', short: 'SIDE', guide: '/actor-guides/side.webp', accent: 'border-[#39c1b6]' },
  { key: 'portrait', label: 'Portrait', hint: 'Face and expression', short: 'FACE', guide: '/actor-guides/portrait.webp', accent: 'border-[#a86ce5]' },
  { key: 'profile', label: 'Face profile', hint: 'Facial structure', short: 'PROFILE', guide: '/actor-guides/profile.webp', accent: 'border-[#3f8df4]' },
];
const RATIOS = ['4:3', '3:4', '16:9', '9:16', '1:1'];
const RATIO_VALUES = { '4:3': 4 / 3, '3:4': 3 / 4, '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1 };

const closestRatio = (width, height) => {
  const value = width / height;
  return RATIOS.reduce((best, ratio) => (
    Math.abs(Math.log(value / RATIO_VALUES[ratio])) < Math.abs(Math.log(value / RATIO_VALUES[best])) ? ratio : best
  ), RATIOS[0]);
};

function parseSavedDesign(sheet) {
  const raw = sheet?.character_photos;
  if (!Array.isArray(raw) || !raw.length) return { photos: {}, design: {} };
  try {
    const parsed = JSON.parse(raw[0]);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const photos = Object.fromEntries(
        PHOTO_SLOTS.map(({ key }) => [key, parsed[key]]).filter(([, value]) => Boolean(value)),
      );
      return { photos, design: parsed._design || {} };
    }
  } catch {
    // Older records can contain direct image URLs.
  }
  return {
    photos: Object.fromEntries(
      raw.slice(0, PHOTO_SLOTS.length).map((url, index) => [PHOTO_SLOTS[index].key, url]).filter(([, value]) => Boolean(value)),
    ),
    design: {},
  };
}

const catalogImages = (asset) => [...new Set([
  asset?.featured_image,
  ...(Array.isArray(asset?.preview_images) ? asset.preview_images : []),
].filter(Boolean))];
const catalogImage = (asset) => catalogImages(asset)[0] || null;
const categoryText = (category) => `${category?.key || ''} ${category?.label_en || ''} ${category?.label_fr || ''}`.toLowerCase();
const purposePattern = (purpose) => purpose === 'costume'
  ? /(costume|clothing|clothes|wardrobe|outfit|vêtement|vetement|tenue)/i
  : /(actor|character|acteur|personnage|cast)/i;

function SourceButton({ icon: Icon, label, onClick, tone }) {
  const style = tone === 'shop'
    ? 'border-cyan-300/25 bg-cyan-300/[0.06] text-cyan-100 hover:border-cyan-300/60'
    : 'border-amber-300/25 bg-amber-300/[0.06] text-amber-100 hover:border-amber-300/60';
  return (
    <button type="button" onClick={onClick} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-black transition ${style}`}>
      <Icon size={15} />{label}
    </button>
  );
}

function AssetPicker({
  picker, onClose, onSelect, vaultAssets, catalogAssets, categories,
  loadingCatalog, catalogError, onManageVault,
}) {
  const [source, setSource] = useState(picker.source || 'vault');
  const [search, setSearch] = useState('');
  const [catalogCategoryKey, setCatalogCategoryKey] = useState('actor');
  const pattern = purposePattern(picker.purpose);
  const categoryById = useMemo(() => new Map(categories.map((item) => [item.id, item])), [categories]);
  const referenceCategories = useMemo(() => categories.filter((item) => ['actor', 'character'].includes(item.key)), [categories]);
  const matchingCategoryIds = useMemo(
    () => new Set(categories.filter((item) => pattern.test(categoryText(item))).map((item) => item.id)),
    [categories, pattern],
  );
  const items = useMemo(() => {
    const term = search.trim().toLowerCase();
    const pool = source === 'vault'
      ? vaultAssets.filter((asset) => asset.media_type === 'image')
      : catalogAssets.filter((asset) => {
        const text = `${asset.title || ''} ${asset.description || ''} ${(asset.tags || []).join(' ')}`;
        const categoryMatch = picker.purpose === 'costume'
          ? (matchingCategoryIds.size ? matchingCategoryIds.has(asset.category_id) : pattern.test(text))
          : categoryById.get(asset.category_id)?.key === catalogCategoryKey;
        return categoryMatch && catalogImages(asset).length;
      });
    return pool.filter((asset) => !term || `${asset.name || ''} ${asset.title || ''} ${asset.actor_name || ''} ${asset.creator_name || ''} ${(asset.tags || []).join(' ')} ${categoryText(categoryById.get(asset.category_id))}`.toLowerCase().includes(term));
  }, [catalogAssets, catalogCategoryKey, categoryById, matchingCategoryIds, pattern, picker.purpose, search, source, vaultAssets]);

  return (
    <motion.div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/85 p-3 backdrop-blur-md"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
    >
      <motion.div
        className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-white/15 bg-[#101012] shadow-2xl"
        initial={{ y: 24, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 24, scale: 0.98 }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-white/10 p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-300">Choose a source</p>
            <h3 className="mt-1 text-2xl font-black text-white">{picker.purpose === 'costume' ? 'Find a costume' : picker.purpose === 'sheet' ? 'Choose a complete reference sheet' : `Add ${picker.label}`}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><X size={19} /></button>
        </header>
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row">
          <div className="grid grid-cols-2 gap-2 sm:w-80">
            <button type="button" onClick={() => setSource('vault')} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black ${source === 'vault' ? 'bg-amber-300 text-black' : 'bg-white/[0.06] text-white'}`}><Library size={17} />My Vault</button>
            <button type="button" onClick={() => setSource('shop')} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black ${source === 'shop' ? 'bg-cyan-300 text-black' : 'bg-white/[0.06] text-white'}`}><Store size={17} />OLOShop</button>
          </div>
          <label className="flex flex-1 items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-4">
            <Search size={17} className="text-white/45" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search actors, characters or costumes" className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-white/30" />
          </label>
        </div>
        {source === 'shop' && picker.purpose !== 'costume' && (
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 sm:px-6">
            <span className="mr-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/35">Category</span>
            {referenceCategories.map((category) => {
              const count = catalogAssets.filter((asset) => asset.category_id === category.id && catalogImages(asset).length).length;
              const active = catalogCategoryKey === category.key;
              return <button type="button" key={category.id} onClick={() => { setCatalogCategoryKey(category.key); setSearch(''); }} className={`rounded-full px-4 py-2 text-xs font-black transition ${active ? 'bg-cyan-300 text-black' : 'bg-white/[0.06] text-white/60 hover:text-white'}`}>{category.key === 'actor' ? 'Actors' : 'Characters'} <span className="ml-1 opacity-60">{count}</span></button>;
            })}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {source === 'shop' && loadingCatalog ? (
            <div className="flex h-52 items-center justify-center"><Loader2 className="animate-spin text-cyan-300" /></div>
          ) : source === 'shop' && catalogError ? (
            <div className="rounded-2xl border border-red-400/25 bg-red-400/10 p-8 text-center text-red-100">OLOShop could not load. Try again.</div>
          ) : items.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((asset) => {
                const images = source === 'vault' ? [asset.url] : catalogImages(asset);
                const category = categoryById.get(asset.category_id);
                return (
                  <article key={`${source}-${asset.id}`} className="overflow-hidden rounded-2xl border border-white/10 bg-black transition hover:border-amber-300/50">
                    <div className={`grid gap-1 bg-zinc-900 p-1 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      {images.map((image, index) => (
                        <button
                          type="button"
                          key={`${asset.id}-${image}`}
                          onClick={() => onSelect({ url: image, title: `${asset.title || asset.name || 'Reference'} ${index + 1}`, source, sourceAssetId: source === 'shop' ? asset.id : null })}
                          className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-black"
                          title={picker.purpose === 'sheet' ? `Use image ${index + 1} as the complete reference sheet` : `Use image ${index + 1}`}
                        >
                          <img src={image} alt={`${asset.title || asset.name || ''} ${index + 1}`} className="h-full w-full object-contain transition duration-300 group-hover:scale-105" />
                          {images.length > 1 && <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/80 px-2 py-0.5 text-[9px] font-black text-white">{index + 1}/{images.length}</span>}
                        </button>
                      ))}
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-black text-white">{asset.title || asset.name || 'Untitled'}</p>
                      <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wider text-white/40">{source === 'shop' ? (category?.label_en || category?.label_fr || 'OLOShop') : 'My Vault'}</p>
                      {picker.purpose === 'sheet' && <p className="mt-2 text-[11px] leading-relaxed text-cyan-100/65">Choose the gallery image that contains the complete character sheet.</p>}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 text-center">
              <ImagePlus size={28} className="text-white/25" />
              <p className="mt-3 font-bold text-white">No matching images</p>
              <p className="mt-1 text-sm text-white/45">{source === 'vault' ? 'Add images to your Vault or choose OLOShop.' : 'No published OLOShop asset matches this selection.'}</p>
            </div>
          )}
        </div>
        {source === 'vault' && (
          <footer className="border-t border-white/10 p-4">
            <button type="button" onClick={onManageVault} className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-amber-300"><Bookmark size={15} />Manage my Vault</button>
          </footer>
        )}
      </motion.div>
    </motion.div>
  );
}

function StepTitle({ number, title, description }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-300 text-sm font-black text-black">{number}</span>
      <div><h3 className="text-lg font-black">{title}</h3><p className="text-sm text-white/40">{description}</p></div>
    </div>
  );
}

export default function CharacterSheetEditor({ sheet, userEmail, onClose }) {
  const queryClient = useQueryClient();
  const initial = useMemo(() => parseSavedDesign(sheet), [sheet]);
  const [name, setName] = useState(sheet?.character_name || '');
  const [bio, setBio] = useState(sheet?.character_bio || '');
  const [traits, setTraits] = useState(Array.isArray(sheet?.character_traits) ? sheet.character_traits.join(', ') : '');
  const [photos, setPhotos] = useState(initial.photos);
  const [photoSources, setPhotoSources] = useState(initial.design.photo_sources || {});
  const [sourceMode, setSourceMode] = useState(initial.design.source_sheet_url ? 'sheet' : 'angles');
  const [sourceSheet, setSourceSheet] = useState(initial.design.source_sheet_url ? {
    url: initial.design.source_sheet_url,
    title: initial.design.source_sheet_title || 'Reference sheet',
    source: initial.design.source_sheet_source || 'vault',
    sourceAssetId: initial.design.source_sheet_asset_id || null,
  } : null);
  const [costume, setCostume] = useState(initial.design.costume_url ? {
    url: initial.design.costume_url,
    title: initial.design.costume_title || 'Selected costume',
    source: initial.design.costume_source || 'vault',
    sourceAssetId: initial.design.costume_source_asset_id || null,
  } : null);
  const [accessories, setAccessories] = useState(initial.design.accessories || sheet?.notes || '');
  const [transformationPrompt, setTransformationPrompt] = useState(initial.design.transformation_prompt || '');
  const [replacePreset, setReplacePreset] = useState(Boolean(initial.design.replace_preset));
  const [referenceLayout] = useState(initial.design.reference_layout_url || null);
  const [aspectRatio, setAspectRatio] = useState(initial.design.aspect_ratio || '4:3');
  const [detectedRatio, setDetectedRatio] = useState(null);
  const [generatedSheet, setGeneratedSheet] = useState(sheet?.voice_sample_url || null);
  const [uploading, setUploading] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tokenCost, setTokenCost] = useState(10);
  const [picker, setPicker] = useState(null);
  const [vaultOpen, setVaultOpen] = useState(false);

  useEffect(() => {
    if (sourceMode !== 'sheet' || !sourceSheet?.url || typeof window === 'undefined') {
      setDetectedRatio(null);
      return undefined;
    }
    let active = true;
    const image = new window.Image();
    image.onload = () => {
      if (!active || !image.naturalWidth || !image.naturalHeight) return;
      const ratio = closestRatio(image.naturalWidth, image.naturalHeight);
      setAspectRatio(ratio);
      setDetectedRatio(ratio);
    };
    image.onerror = () => { if (active) setDetectedRatio(null); };
    image.src = sourceSheet.url;
    return () => { active = false; };
  }, [sourceMode, sourceSheet?.url]);

  const { data: vaultAssets = [], refetch: refetchVault } = useQuery({
    queryKey: ['vaultAssetsForCharacterDesigner', userEmail],
    queryFn: () => base44.entities.VaultAsset.filter({ user_email: userEmail }, '-created_date', 300),
    enabled: Boolean(userEmail),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ['olo-asset-categories-for-character-designer'],
    queryFn: async () => {
      const { data, error } = await supabase.from('asset_category').select('id,key,label_en,label_fr').eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
  });
  const { data: catalogAssets = [], isLoading: loadingCatalog, error: catalogError } = useQuery({
    queryKey: ['olo-character-designer-assets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('catalog_asset')
        .select('id,title,description,featured_image,preview_images,category_id,creator_name,tags')
        .eq('status', 'published')
        .order('title', { ascending: true })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });
  useQuery({
    queryKey: ['character-sheet-price'],
    queryFn: async () => {
      const prices = await base44.entities.ToolPricing.filter({ tool_id: 'character_sheet', is_active: true });
      if (prices[0]) setTokenCost(prices[0].token_cost);
      return prices[0] || null;
    },
  });

  const photoCount = PHOTO_SLOTS.filter(({ key }) => photos[key]).length;
  const hasCharacterSource = sourceMode === 'sheet' ? Boolean(sourceSheet?.url) : photoCount > 0;
  const preview = generatedSheet || sourceSheet?.url || photos.front || photos.portrait || Object.values(photos)[0] || null;
  const completion = [Boolean(name.trim()), hasCharacterSource, Boolean(costume || accessories.trim() || transformationPrompt.trim()), Boolean(generatedSheet)].filter(Boolean).length;

  const uploadImage = async (event, target) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(target);
    try {
      const { file_url: url } = await base44.integrations.Core.UploadFile({ file });
      if (target === 'costume') setCostume({ url, title: file.name, source: 'upload', sourceAssetId: null });
      else if (target === 'sourceSheet') {
        setSourceSheet({ url, title: file.name, source: 'upload', sourceAssetId: null });
        setSourceMode('sheet');
        setGeneratedSheet(null);
      }
      else {
        setPhotos((current) => ({ ...current, [target]: url }));
        setPhotoSources((current) => ({ ...current, [target]: { source: 'upload' } }));
      }
    } catch (error) {
      toast.error(error.message || 'Upload failed');
    } finally {
      setUploading(null);
      event.target.value = '';
    }
  };

  const selectAsset = (asset) => {
    if (picker.purpose === 'costume') setCostume(asset);
    else if (picker.purpose === 'sheet') {
      setSourceSheet(asset);
      setSourceMode('sheet');
      setGeneratedSheet(null);
    }
    else {
      setPhotos((current) => ({ ...current, [picker.slot]: asset.url }));
      setPhotoSources((current) => ({
        ...current,
        [picker.slot]: { source: asset.source, source_asset_id: asset.sourceAssetId, title: asset.title },
      }));
    }
    setPicker(null);
  };

  const generate = async () => {
    if (!hasCharacterSource) return toast.error(sourceMode === 'sheet' ? 'Choose a complete reference sheet' : 'Add at least one angle');
    setGenerating(true);
    try {
      const angleUrls = PHOTO_SLOTS.map(({ key }) => photos[key]).filter(Boolean);
      const response = await base44.functions.invoke('generateCharacterSheet', {
        source_mode: sourceMode,
        reference_sheet_url: sourceMode === 'sheet' ? sourceSheet.url : null,
        angle_urls: sourceMode === 'angles' ? angleUrls : [],
        image_urls: sourceMode === 'sheet' ? [sourceSheet.url] : angleUrls,
        costume_url: costume?.url || null,
        aspect_ratio: aspectRatio,
        reference_layout_url: referenceLayout,
        accessories,
        prompt_override: transformationPrompt.trim() || undefined,
        replace_preset: replacePreset && Boolean(transformationPrompt.trim()),
      });
      if (!response.data?.file_url) throw new Error(response.data?.error || 'Generation failed');
      setGeneratedSheet(response.data.file_url);
      toast.success('Character created');
    } catch (error) {
      toast.error(error.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (!name.trim()) return toast.error('Give your character a name');
    if (!preview) return toast.error('Add at least one image');
    setSaving(true);
    try {
      const design = {
        photo_sources: photoSources,
        source_mode: sourceMode,
        source_sheet_url: sourceSheet?.url || null,
        source_sheet_title: sourceSheet?.title || null,
        source_sheet_source: sourceSheet?.source || null,
        source_sheet_asset_id: sourceSheet?.sourceAssetId || null,
        costume_url: costume?.url || null,
        costume_title: costume?.title || null,
        costume_source: costume?.source || null,
        costume_source_asset_id: costume?.sourceAssetId || null,
        reference_layout_url: referenceLayout,
        accessories,
        transformation_prompt: transformationPrompt.trim(),
        replace_preset: replacePreset,
        aspect_ratio: aspectRatio,
      };
      const data = {
        user_email: userEmail,
        character_name: name.trim(),
        character_bio: bio.trim(),
        character_traits: traits.split(',').map((value) => value.trim()).filter(Boolean),
        character_photos: [JSON.stringify({ ...photos, _design: design })],
        voice_sample_url: generatedSheet || '',
        notes: accessories.trim(),
      };
      const savedCharacter = sheet?.id
        ? await base44.entities.CharacterSheet.update(sheet.id, data)
        : await base44.entities.CharacterSheet.create(data);
      const existingVaultAsset = vaultAssets.find((asset) => asset.url === preview && asset.asset_category === 'character');
      const primarySourceId = photoSources.front?.source_asset_id || photoSources.portrait?.source_asset_id || '';
      const vaultData = {
        name: name.trim(),
        actor_name: name.trim(),
        url: preview,
        media_type: 'image',
        asset_category: 'character',
        tags: data.character_traits,
        aspect_ratio: generatedSheet ? aspectRatio : undefined,
        source_asset_id: generatedSheet ? savedCharacter.id : primarySourceId,
      };
      if (existingVaultAsset) await base44.entities.VaultAsset.update(existingVaultAsset.id, vaultData);
      else await base44.entities.VaultAsset.create({ user_email: userEmail, ...vaultData });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['characterSheet', userEmail] }),
        queryClient.invalidateQueries({ queryKey: ['vaultAssetsForCharacterDesigner', userEmail] }),
      ]);
      toast.success('Character saved to your Vault');
      onClose();
    } catch (error) {
      toast.error(error.message || 'Character could not be saved');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <motion.div className="fixed inset-0 z-[1000] flex flex-col overflow-hidden bg-[#09090b] text-white" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 18 }}>
      <header className="relative shrink-0 overflow-hidden border-b border-white/10 bg-black px-4 py-4 sm:px-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(251,191,36,0.18),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(34,211,238,0.12),transparent_30%)]" />
        <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-300 text-black"><UserRound size={22} /></div>
            <div><p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-300">Actor studio</p><h2 className="text-xl font-black sm:text-2xl">Design a complete character</h2></div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-white/10 bg-white/[0.06] p-2.5 hover:bg-white/15"><X size={19} /></button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 pb-32 lg:grid-cols-[340px_minmax(0,1fr)] lg:px-7">
          <aside className="lg:sticky lg:top-6 lg:h-fit">
            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#121214] shadow-2xl">
              <div className="relative aspect-[3/4] bg-[linear-gradient(145deg,#232329,#0f0f12)]">
                {preview ? <img src={preview} alt={name || 'Character preview'} className="h-full w-full object-contain" /> : (
                  <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                    <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]"><UserRound size={44} className="text-white/20" /></div>
                    <p className="mt-5 text-lg font-black">Your character appears here</p>
                    <p className="mt-2 text-sm leading-relaxed text-white/40">Add a reference from your device, your Vault or OLOShop.</p>
                  </div>
                )}
                {generatedSheet && <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-emerald-400 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-black"><BadgeCheck size={14} />Generated</div>}
              </div>
              <div className="p-5">
                <div className="flex items-end justify-between">
                  <div><p className="text-xs font-black uppercase tracking-[0.2em] text-white/35">Character</p><p className="mt-1 truncate text-2xl font-black">{name || 'Untitled'}</p></div>
                  <span className="text-sm font-black text-amber-300">{completion}/4</span>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-cyan-300 transition-all" style={{ width: `${completion * 25}%` }} /></div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] font-black uppercase tracking-wider">
                  <span className="rounded-xl bg-white/[0.05] px-2 py-2 text-white/55">{sourceMode === 'sheet' ? (sourceSheet ? 'Full sheet' : 'No sheet') : `${photoCount} angles`}</span>
                  <span className="rounded-xl bg-white/[0.05] px-2 py-2 text-white/55">{costume ? 'Costume' : 'No costume'}</span>
                  <span className="rounded-xl bg-white/[0.05] px-2 py-2 text-white/55">{aspectRatio}</span>
                </div>
              </div>
            </div>
          </aside>

          <main className="space-y-5">
            <section className="rounded-[28px] border border-white/10 bg-[#121214] p-5 sm:p-7">
              <StepTitle number="1" title="Identity" description="Name the character and define who they are." />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-black uppercase tracking-wider text-white/60">Character name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Vesper, The Oracle..." className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3.5 text-base font-bold normal-case tracking-normal text-white outline-none placeholder:text-white/20 focus:border-amber-300/60" /></label>
                <label className="text-xs font-black uppercase tracking-wider text-white/60">Traits<input value={traits} onChange={(event) => setTraits(event.target.value)} placeholder="Bold, mysterious, loyal" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3.5 text-base font-bold normal-case tracking-normal text-white outline-none placeholder:text-white/20 focus:border-amber-300/60" /></label>
              </div>
              <label className="mt-4 block text-xs font-black uppercase tracking-wider text-white/60">Character direction<textarea value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Background, personality, age, energy, distinctive features..." rows={3} className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black/35 px-4 py-3.5 text-sm font-semibold normal-case tracking-normal text-white outline-none placeholder:text-white/20 focus:border-amber-300/60" /></label>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-[#121214] p-5 sm:p-7">
              <StepTitle number="2" title="Character source" description="Transform a complete reference sheet, or create one from separate angles." />
              <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/30 p-1.5">
                <button type="button" onClick={() => setSourceMode('sheet')} className={`rounded-xl px-4 py-3 text-sm font-black ${sourceMode === 'sheet' ? 'bg-cyan-300 text-black' : 'text-white/55 hover:text-white'}`}>Transform a reference sheet</button>
                <button type="button" onClick={() => setSourceMode('angles')} className={`rounded-xl px-4 py-3 text-sm font-black ${sourceMode === 'angles' ? 'bg-amber-300 text-black' : 'text-white/55 hover:text-white'}`}>Create one from angles</button>
              </div>
              {sourceMode === 'sheet' ? (
                <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-cyan-300/30 bg-black/35">
                    {sourceSheet ? (
                      <><img src={sourceSheet.url} alt={sourceSheet.title} className="h-full w-full object-contain" /><button type="button" onClick={() => setSourceSheet(null)} className="absolute right-2 top-2 rounded-full bg-black/75 p-1.5"><X size={14} /></button></>
                    ) : <div className="flex h-full flex-col items-center justify-center px-6 text-center"><ImagePlus size={34} className="text-cyan-200/30" /><p className="mt-3 text-sm font-black">Complete character sheet</p><p className="mt-1 text-xs text-white/35">One composed image containing all character views.</p></div>}
                  </div>
                  <div className="flex flex-col justify-center">
                    <p className="text-sm leading-relaxed text-white/55">This sheet becomes the character base. Actor Studio will transform it with the selected wardrobe and your prompt while preserving the character across every view.</p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-3 text-xs font-black hover:border-white/35"><Upload size={15} />Upload<input type="file" accept="image/*" className="hidden" onChange={(event) => uploadImage(event, 'sourceSheet')} /></label>
                      <SourceButton icon={Library} label="My Vault" tone="vault" onClick={() => setPicker({ purpose: 'sheet', label: 'reference sheet', source: 'vault' })} />
                      <SourceButton icon={Store} label="OLOShop" tone="shop" onClick={() => setPicker({ purpose: 'sheet', label: 'reference sheet', source: 'shop' })} />
                    </div>
                  </div>
                </div>
              ) : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                {PHOTO_SLOTS.map((slot) => (
                  <div key={slot.key} className={`overflow-hidden rounded-2xl border bg-black/30 ${slot.accent}`}>
                    <div className="relative aspect-[3/4] overflow-hidden bg-[#111216]">
                      {photos[slot.key] ? (
                        <><img src={photos[slot.key]} alt={slot.label} className="h-full w-full object-contain" /><button type="button" onClick={() => {
                          setPhotos((current) => { const next = { ...current }; delete next[slot.key]; return next; });
                          setPhotoSources((current) => { const next = { ...current }; delete next[slot.key]; return next; });
                        }} className="absolute right-2 top-2 rounded-full bg-black/75 p-1.5"><X size={13} /></button></>
                      ) : (
                        <div className="group/guide relative h-full">
                          <img src={slot.guide} alt={`Guide ${slot.label}`} className="h-full w-full object-contain" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                          <div className="absolute inset-x-0 bottom-3 flex justify-center">
                            <span className="rounded-full border border-white/20 bg-black/65 px-3 py-1 text-[9px] font-black tracking-[0.24em] text-white/85 backdrop-blur-sm">{slot.short}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-black">{slot.label}</p><p className="text-[11px] text-white/35">{slot.hint}</p>
                      <div className="mt-3 grid grid-cols-3 gap-1.5">
                        <label title="Upload" className="flex cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] py-2 hover:bg-white/10">{uploading === slot.key ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}<input type="file" accept="image/*" className="hidden" onChange={(event) => uploadImage(event, slot.key)} /></label>
                        <button type="button" title="My Vault" onClick={() => setPicker({ purpose: 'reference', slot: slot.key, label: slot.label, source: 'vault' })} className="flex items-center justify-center rounded-lg border border-amber-300/20 bg-amber-300/[0.06] py-2 text-amber-200 hover:border-amber-300/60"><Library size={14} /></button>
                        <button type="button" title="OLOShop" onClick={() => setPicker({ purpose: 'reference', slot: slot.key, label: slot.label, source: 'shop' })} className="flex items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06] py-2 text-cyan-200 hover:border-cyan-300/60"><Store size={14} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>}
            </section>

            <section className="rounded-[28px] border border-white/10 bg-[#121214] p-5 sm:p-7">
              <StepTitle number="3" title="Wardrobe and details" description="Build the character's recognizable silhouette." />
              <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 bg-black/35">
                  {costume ? (
                    <><img src={costume.url} alt={costume.title} className="h-full w-full object-cover" /><button type="button" onClick={() => setCostume(null)} className="absolute right-2 top-2 rounded-full bg-black/75 p-1.5"><X size={14} /></button><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black p-3 pt-10"><p className="truncate text-xs font-black">{costume.title}</p></div></>
                  ) : <div className="flex h-full flex-col items-center justify-center"><Shirt size={32} className="text-white/20" /><p className="mt-2 text-xs font-bold text-white/35">Optional costume</p></div>}
                </div>
                <div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-3 text-xs font-black hover:border-white/35"><Upload size={15} />Upload<input type="file" accept="image/*" className="hidden" onChange={(event) => uploadImage(event, 'costume')} /></label>
                    <SourceButton icon={Library} label="My Vault" tone="vault" onClick={() => setPicker({ purpose: 'costume', label: 'costume', source: 'vault' })} />
                    <SourceButton icon={Store} label="OLOShop" tone="shop" onClick={() => setPicker({ purpose: 'costume', label: 'costume', source: 'shop' })} />
                  </div>
                  <label className="mt-4 block text-xs font-black uppercase tracking-wider text-white/60">Accessories and styling<textarea value={accessories} onChange={(event) => setAccessories(event.target.value)} placeholder="Silver earrings, worn leather boots, black gloves..." rows={3} className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-semibold normal-case tracking-normal text-white outline-none placeholder:text-white/20 focus:border-amber-300/60" /></label>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-wider text-white/60">Transformation prompt</p>
                    <button type="button" onClick={() => setReplacePreset((value) => !value)} className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${replacePreset ? 'bg-cyan-300 text-black' : 'bg-white/10 text-white/60'}`}>{replacePreset ? 'Custom prompt' : 'Add to preset'}</button>
                  </div>
                  <textarea value={transformationPrompt} onChange={(event) => setTransformationPrompt(event.target.value)} placeholder={replacePreset ? 'Write the complete transformation instruction...' : 'Describe how you want to transform the character...'} rows={3} className="mt-2 w-full resize-none rounded-2xl border border-cyan-300/20 bg-black/35 px-4 py-3.5 text-sm font-semibold text-white outline-none placeholder:text-white/20 focus:border-cyan-300/60" />
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-amber-300/20 bg-[linear-gradient(145deg,rgba(251,191,36,0.09),rgba(18,18,20,1)_45%)] p-5 sm:p-7">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <StepTitle number="4" title="Create the character" description="Generate a consistent reference sheet from your selections." />
                  <div className="flex flex-wrap items-center gap-2">{RATIOS.map((ratio) => <button type="button" key={ratio} onClick={() => { setAspectRatio(ratio); setDetectedRatio(null); }} className={`rounded-xl px-3 py-2 text-xs font-black ${aspectRatio === ratio ? 'bg-white text-black' : 'bg-white/[0.06] text-white/60 hover:text-white'}`}>{ratio}</button>)}{detectedRatio && <span className="rounded-full bg-cyan-300/15 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-cyan-200">Detected from reference</span>}</div>
                </div>
                <button type="button" onClick={generate} disabled={!hasCharacterSource || generating} className="flex min-w-64 items-center justify-center gap-3 rounded-2xl bg-amber-300 px-6 py-4 font-black text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-35">
                  {generating ? <Loader2 size={19} className="animate-spin" /> : <WandSparkles size={19} />}
                  {generating ? 'Creating character...' : generatedSheet ? 'Generate again' : sourceMode === 'sheet' ? 'Transform character' : 'Create reference sheet'}
                  <span className="rounded-full bg-black/15 px-2.5 py-1 text-xs"><Coins size={11} className="mr-1 inline" />{tokenCost}</span>
                </button>
              </div>
            </section>
          </main>
        </div>
      </div>

      <footer className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-black/90 px-4 py-4 backdrop-blur-xl sm:px-7">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <p className="hidden text-sm text-white/45 sm:block">The character and its final visual will be available in your Vault.</p>
          <button type="button" onClick={save} disabled={saving || !name.trim() || !preview} className="ml-auto flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-400 px-6 py-3.5 font-black text-black disabled:cursor-not-allowed disabled:opacity-35">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Bookmark size={18} />}{saving ? 'Saving...' : 'Save character to Vault'}<ArrowRight size={17} />
          </button>
        </div>
      </footer>

      <AnimatePresence>{picker && (
        <AssetPicker
          picker={picker} onClose={() => setPicker(null)} onSelect={selectAsset}
          vaultAssets={vaultAssets} catalogAssets={catalogAssets} categories={categories}
          loadingCatalog={loadingCatalog} catalogError={catalogError}
          onManageVault={() => { setPicker(null); setVaultOpen(true); }}
        />
      )}</AnimatePresence>
      <VaultDrawer open={vaultOpen} onClose={() => { setVaultOpen(false); refetchVault(); }} />
    </motion.div>,
    document.body,
  );
}
