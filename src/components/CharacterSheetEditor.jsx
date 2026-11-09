import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, BadgeCheck, Bookmark, Coins, Folder, ImagePlus, Library, Loader2,
  Search, Shirt, Store, Upload, UserRound, WandSparkles, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import VaultDrawer from '@/components/VaultDrawer';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';
import { useAiPriceQuote } from '@/hooks/useAiPriceQuote';
import { useAiModelOptions } from '@/hooks/useAiModelOptions';

const DEFAULT_ACTOR_SHEET_PATH = '/actor-guides/neutral-base.webp';

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
const categoryText = (category) => `${category?.key || ''} ${category?.label_en || ''} ${category?.label_fr || ''}`.toLowerCase();
const purposePattern = (purpose) => purpose === 'costume'
  ? /(costume|clothing|clothes|wardrobe|outfit|vêtement|vetement|tenue)/i
  : /(actor|character|acteur|personnage|cast)/i;

function SourceButton({ icon: Icon, label, onClick, tone }) {
  const style = tone === 'shop'
    ? 'border-cyan-300/25 bg-cyan-300/[0.06] text-cyan-100 hover:border-cyan-300/60'
    : 'border-amber-300/25 bg-amber-300/[0.06] text-amber-100 hover:border-amber-300/60';
  return (
    <button type="button" onClick={onClick} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-black transition lg:shrink-0 lg:whitespace-nowrap lg:rounded-md lg:px-3 lg:py-2 ${style}`}>
      <Icon size={15} className="shrink-0" />{label}
    </button>
  );
}

function AssetPicker({
  picker, onClose, onSelect, vaultAssets, catalogAssets, categories, subcategories,
  pilotLibrary = [], loadingPilots = false, pilotError = null,
  loadingCatalog, catalogError, onManageVault, userEmail, embedded = false,
}) {
  const source = picker.source || 'vault';
  const [activeVaultFolderId, setActiveVaultFolderId] = useState(null);
  const { data: vaultFolders = [], isLoading: vaultFoldersLoading, error: vaultFoldersError } = useQuery({
    queryKey: ['vaultFoldersForCharacterDesigner', userEmail],
    queryFn: () => base44.entities.VaultFolder.filter({ user_email: userEmail }, 'order', null),
    enabled: source === 'vault' && Boolean(userEmail),
  });
  const vaultImages = vaultAssets.filter((asset) => asset.media_type === 'image');
  const vaultFoldersWithAssets = vaultFolders.map((folder) => ({
    ...folder,
    count: vaultImages.filter((asset) => asset.folder_id === folder.id).length,
  }));
  const unfiledCount = vaultImages.filter((asset) => !asset.folder_id).length;
  const [search, setSearch] = useState('');
  const [pilotFilter, setPilotFilter] = useState('all');
  const pattern = purposePattern(picker.purpose);
  const initialCategoryId = useMemo(() => {
    if (picker.purpose === 'look') return 'all';
    if (picker.purpose === 'costume') return categories.find((item) => pattern.test(categoryText(item)))?.id || 'all';
    return categories.find((item) => item.key === 'actor')?.id || categories.find((item) => item.key === 'character')?.id || 'all';
  }, [categories, pattern, picker.purpose]);
  const [catalogCategoryId, setCatalogCategoryId] = useState(initialCategoryId);
  const [catalogSubcategoryId, setCatalogSubcategoryId] = useState('all');
  const categoryById = useMemo(() => new Map(categories.map((item) => [item.id, item])), [categories]);
  const activeSubcategories = useMemo(
    () => catalogCategoryId === 'all' ? [] : subcategories.filter((item) => item.category_id === catalogCategoryId),
    [catalogCategoryId, subcategories],
  );
  const items = useMemo(() => {
    const term = search.trim().toLowerCase();
    const pilotAssets = pilotLibrary.filter((pilot) => pilotFilter === 'all' || pilot.id === pilotFilter).flatMap((pilot) =>
      (picker.purpose === 'look' ? pilot.looks : pilot.characters).filter((item) => item.images?.length).map((item) => ({
        id: pilot.id + ':' + item.id, title: item.name, pilot_name: pilot.name,
        origin: item.source, images: item.images, character: picker.purpose === 'look' ? null : item,
      }))
    );
    const pool = source === 'vault' ? vaultImages.filter((asset) => activeVaultFolderId === 'unfiled' ? !asset.folder_id : asset.folder_id === activeVaultFolderId)
      : source === 'pilot' ? pilotAssets
      : catalogAssets.filter((asset) => (
        catalogImages(asset).length
        && (catalogCategoryId === 'all' || asset.category_id === catalogCategoryId)
        && (catalogSubcategoryId === 'all' || asset.subcategory_id === catalogSubcategoryId)
      ));
    return pool.filter((asset) => !term || `${asset.name || ''} ${asset.title || ''} ${asset.actor_name || ''} ${asset.creator_name || ''} ${(asset.tags || []).join(' ')} ${categoryText(categoryById.get(asset.category_id))}`.toLowerCase().includes(term));
  }, [catalogAssets, catalogCategoryId, catalogSubcategoryId, categoryById, search, source, vaultImages, activeVaultFolderId, pilotLibrary, pilotFilter, picker.purpose]);

  return (
    <motion.div
      className={`fixed z-[220] flex items-center justify-center bg-black/85 p-3 backdrop-blur-md ${embedded ? 'top-14 right-0 bottom-[64px] left-0 lg:bottom-0 lg:left-[var(--studio-toolbar-width)]' : 'inset-0'}`}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
    >
      <motion.div
        className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] lg:max-h-[94vh] lg:max-w-7xl border border-white/15 bg-[#101012] shadow-2xl"
        initial={{ y: 24, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 24, scale: 0.98 }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-white/10 p-5 lg:px-4 lg:py-2">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-300 lg:hidden">Browse references</p>
            <h3 className="mt-1 text-2xl font-black text-white lg:mt-0 lg:text-lg">{picker.purpose === 'look' ? 'Add to character look' : picker.purpose === 'costume' ? 'Find a costume' : picker.purpose === 'sheet' ? 'Choose a complete reference sheet' : `Add ${picker.label}`}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close picker" className="flex items-center justify-center rounded-full bg-white/10 p-2 text-white hover:bg-white/20 lg:!h-7 lg:!w-7 lg:!min-h-0 lg:!min-w-0 lg:!shrink-0 lg:!p-0 lg:!bg-transparent lg:hover:!bg-white/10"><X size={19} className="lg:!h-3.5 lg:!w-3.5" /></button>
        </header>
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row lg:items-center lg:gap-3 lg:px-4 lg:py-2">
          <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-4 lg:px-3">
            <Search size={17} className="text-white/45" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search actors, characters or costumes" className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-white/30 lg:py-2" />
          </label>
          {source === 'shop' && (
            <div className="hidden shrink-0 items-center gap-2 lg:flex">
              <label className="sr-only" htmlFor="actor-asset-category">Category</label>
              <select id="actor-asset-category" value={catalogCategoryId} onChange={(event) => { setCatalogCategoryId(event.target.value); setCatalogSubcategoryId('all'); setSearch(''); }} className="w-40 min-w-0 rounded-lg border border-white/15 bg-black px-2 py-2 text-xs font-semibold text-white">
                <option value="all">All categories</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.label_en || category.label_fr || category.key}</option>)}
              </select>
              {activeSubcategories.length > 0 && <>
                <label className="sr-only" htmlFor="actor-asset-subcategory">Subcategory</label>
                <select id="actor-asset-subcategory" value={catalogSubcategoryId} onChange={(event) => setCatalogSubcategoryId(event.target.value)} className="w-40 min-w-0 rounded-lg border border-white/15 bg-black px-2 py-2 text-xs font-semibold text-white">
                  <option value="all">All subcategories</option>
                  {activeSubcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.label_en || subcategory.label_fr || subcategory.key}</option>)}
                </select>
              </>}
            </div>
          )}
        </div>
        {source === 'pilot' && <div className="border-b border-white/10 px-4 py-3 sm:px-6">
          <label className="flex items-center gap-3 text-xs font-bold text-white/65">AI Pilot
            <select value={pilotFilter} onChange={(event) => setPilotFilter(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black px-3 py-2 text-sm text-white">
              <option value="all">All my AI Pilots</option>
              {pilotLibrary.map((pilot) => <option key={pilot.id} value={pilot.id}>{pilot.name}</option>)}
            </select>
          </label>
        </div>}
        {source === 'shop' && (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3 sm:px-6 lg:hidden">
              <span className="mr-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/35">Category</span>
              <button type="button" onClick={() => { setCatalogCategoryId('all'); setCatalogSubcategoryId('all'); setSearch(''); }} className={`rounded-full px-4 py-2 text-xs font-black transition lg:shrink-0 lg:whitespace-nowrap lg:px-3 lg:py-1.5 ${catalogCategoryId === 'all' ? 'bg-cyan-300 text-black' : 'bg-white/[0.06] text-white/60 hover:text-white'}`}>All</button>
              {categories.map((category) => {
                const count = catalogAssets.filter((asset) => asset.category_id === category.id && catalogImages(asset).length).length;
                const active = catalogCategoryId === category.id;
                return <button type="button" key={category.id} onClick={() => { setCatalogCategoryId(category.id); setCatalogSubcategoryId('all'); setSearch(''); }} className={`rounded-full px-4 py-2 text-xs font-black transition lg:shrink-0 lg:whitespace-nowrap lg:px-3 lg:py-1.5 ${active ? 'bg-cyan-300 text-black' : 'bg-white/[0.06] text-white/60 hover:text-white'}`}>{category.label_en || category.label_fr || category.key} <span className="ml-1 opacity-60">{count}</span></button>;
              })}
            </div>
            {activeSubcategories.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3 sm:px-6 lg:hidden">
                <span className="mr-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/35">Subcategory</span>
                <button type="button" onClick={() => setCatalogSubcategoryId('all')} className={`rounded-full px-4 py-2 text-xs font-black transition lg:shrink-0 lg:whitespace-nowrap lg:px-3 lg:py-1.5 ${catalogSubcategoryId === 'all' ? 'bg-cyan-300 text-black' : 'bg-white/[0.06] text-white/60 hover:text-white'}`}>All</button>
                {activeSubcategories.map((subcategory) => {
                  const count = catalogAssets.filter((asset) => asset.subcategory_id === subcategory.id && catalogImages(asset).length).length;
                  const active = catalogSubcategoryId === subcategory.id;
                  return <button type="button" key={subcategory.id} onClick={() => setCatalogSubcategoryId(subcategory.id)} className={`rounded-full px-4 py-2 text-xs font-black transition lg:shrink-0 lg:whitespace-nowrap lg:px-3 lg:py-1.5 ${active ? 'bg-cyan-300 text-black' : 'bg-white/[0.06] text-white/60 hover:text-white'}`}>{subcategory.label_en || subcategory.label_fr || subcategory.key} <span className="ml-1 opacity-60">{count}</span></button>;
                })}
              </div>
            )}
          </>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-4">
          {source === 'vault' && vaultFoldersLoading ? (
            <div className="flex h-52 items-center justify-center"><Loader2 className="animate-spin text-cyan-300" /></div>
          ) : source === 'vault' && vaultFoldersError ? (
            <div className="p-6 text-sm text-red-300">Could not load Vault folders: {vaultFoldersError.message}</div>
          ) : source === 'vault' && activeVaultFolderId === null ? (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-white/75">My Vault · Folders</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                {vaultFoldersWithAssets.map((folder) => (
                  <button key={folder.id} type="button" onClick={() => { setActiveVaultFolderId(folder.id); setSearch(''); }}
                    className="flex min-h-24 flex-col items-start justify-between gap-3 rounded-lg border border-white/15 bg-white/[0.04] p-3 text-left transition hover:border-cyan-300/50 hover:bg-white/[0.08]">
                    <Folder size={23} className="text-cyan-300" />
                    <span className="max-w-full truncate text-sm font-semibold text-white">{folder.name}</span>
                    <span className="text-xs text-white/45">{folder.count} images</span>
                  </button>
                ))}
                {unfiledCount > 0 && (
                  <button type="button" onClick={() => { setActiveVaultFolderId('unfiled'); setSearch(''); }}
                    className="flex min-h-24 flex-col items-start justify-between gap-3 rounded-lg border border-white/15 bg-white/[0.04] p-3 text-left transition hover:border-cyan-300/50 hover:bg-white/[0.08]">
                    <Folder size={23} className="text-white/65" />
                    <span className="text-sm font-semibold text-white">Unfiled</span>
                    <span className="text-xs text-white/45">{unfiledCount} images</span>
                  </button>
                )}
              </div>
              {!vaultFoldersWithAssets.length && !unfiledCount && <div className="text-sm text-white/45">No folders or images in your Vault.</div>}
            </div>
          ) : (
            <>
              {source === 'vault' && <button type="button" onClick={() => { setActiveVaultFolderId(null); setSearch(''); }}
                className="mb-4 flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white">
                <ArrowLeft size={16} /> My Vault / {activeVaultFolderId === 'unfiled' ? 'Unfiled' : vaultFolders.find((folder) => folder.id === activeVaultFolderId)?.name || 'Folder'}
              </button>}
              {source === 'pilot' && loadingPilots ? (
            <div className="flex h-52 items-center justify-center"><Loader2 className="animate-spin text-cyan-300" /></div>
          ) : source === 'pilot' && pilotError ? (
            <div className="p-8 text-center text-red-300">{pilotError.message}</div>
          ) : source === 'shop' && loadingCatalog ? (
            <div className="flex h-52 items-center justify-center"><Loader2 className="animate-spin text-cyan-300" /></div>
          ) : source === 'shop' && catalogError ? (
            <div className="rounded-2xl border border-red-400/25 bg-red-400/10 p-8 text-center text-red-100">OLOShop could not load. Try again.</div>
          ) : items.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-2 xl:grid-cols-5 2xl:grid-cols-6">
              {items.map((asset) => {
                const images = source === 'vault' ? [asset.url] : source === 'pilot' ? asset.images : catalogImages(asset);
                const category = categoryById.get(asset.category_id);
                return (
                  <article key={`${source}-${asset.id}`} className="overflow-hidden rounded-2xl border border-white/10 bg-black transition lg:rounded-lg hover:border-amber-300/50">
                    <div className={`grid gap-1 bg-zinc-900 p-1 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      {images.map((image, index) => (
                        <button
                          type="button"
                          key={`${asset.id}-${image}`}
                          onClick={() => onSelect({ url: image, title: `${asset.title || asset.name || 'Reference'} ${index + 1}`, source, sourceAssetId: source === 'shop' ? asset.id : null, character: source === 'pilot' ? asset.character : null })}
                          className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-black lg:rounded-sm"
                          title={picker.purpose === 'sheet' ? `Use image ${index + 1} as the complete reference sheet` : `Use image ${index + 1}`}
                        >
                          <img src={image} alt={`${asset.title || asset.name || ''} ${index + 1}`} className="h-full w-full object-contain transition duration-300 group-hover:scale-105" />
                          {images.length > 1 && <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/80 px-2 py-0.5 text-[9px] font-black text-white">{index + 1}/{images.length}</span>}
                        </button>
                      ))}
                    </div>
                    <div className="p-3 lg:p-2">
                      <p className="truncate text-sm font-black text-white lg:text-xs">{asset.title || asset.name || 'Untitled'}</p>
                      <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wider text-white/40">{source === 'pilot' ? `${asset.pilot_name} · ${asset.origin}` : source === 'shop' ? (category?.label_en || category?.label_fr || 'OLOShop') : 'My Vault'}</p>
                      {picker.purpose === 'sheet' && <p className="mt-2 text-[11px] leading-relaxed text-cyan-100/65 lg:hidden">Choose the gallery image that contains the complete character sheet.</p>}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 text-center">
              <ImagePlus size={28} className="text-white/25" />
              <p className="mt-3 font-bold text-white">No matching images</p>
              <p className="mt-1 text-sm text-white/45">{source === 'vault' ? 'Add images to your Vault or choose Assets Shop.' : source === 'pilot' ? 'No matching character or look images in your AI Pilots.' : 'No published Assets Shop asset matches this selection.'}</p>
            </div>
          )}
            </>
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

const PROMPT_TEMPLATES = [
  {
    key: 'face_swap',
    label: 'Face Swap',
    prompt: 'Replace the character’s face with the face from the STEP 3 reference image.\nUse the STEP 3 face reference as the new facial identity.\nDo not preserve the original face from the character sheet.\nKeep the original body, pose, age, clothing, proportions, and background unchanged.\nApply the new face consistently across all views.',
  },
  {
    key: 'wardrobe_change',
    label: 'Wardrobe Change',
    prompt: 'Use the STEP 3 reference image as the clothing reference.\nKeep the character’s identity, face, body, age, pose, and proportions unchanged.\nReplace only the clothing and related accessories.\nApply the new wardrobe consistently across all views.',
  },
  {
    key: 'hair_change',
    label: 'Hair Change',
    prompt: 'Use the STEP 3 reference image as the hairstyle reference.\nKeep the character’s face, body, age, clothing, pose, and proportions unchanged.\nChange only the hairstyle and hair color.\nApply the new hairstyle consistently across all views.',
  },
  {
    key: 'full_look',
    label: 'Full Look Transformation',
    prompt: 'Use the STEP 3 reference images as the visual design references.\nPreserve the character’s core identity and body proportions.\nCombine the selected clothing, hair, footwear, accessories, makeup and styling details into one coherent look and apply it consistently across all views.',
  },
];

function StepTitle({ number, title, description }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-300 text-sm font-black text-black">{number}</span>
      <div><h3 className="text-lg font-black">{title}</h3><p className="text-sm text-white/40">{description}</p></div>
    </div>
  );
}

export default function CharacterSheetEditor({ sheet, userEmail, onClose, onOpenBackgroundGroup, embedded = false }) {
  const queryClient = useQueryClient();
  const initial = useMemo(() => parseSavedDesign(sheet), [sheet]);
  const [name, setName] = useState(sheet?.character_name || '');
  const [bio, setBio] = useState(sheet?.character_bio || '');
  const [traits, setTraits] = useState(Array.isArray(sheet?.character_traits) ? sheet.character_traits.join(', ') : '');
  const [photos, setPhotos] = useState(initial.photos);
  const [photoSources, setPhotoSources] = useState(initial.design.photo_sources || {});
  const [sourceMode, setSourceMode] = useState(initial.design.source_sheet_url || !sheet ? 'sheet' : 'angles');
  const [sourceSheet, setSourceSheet] = useState(() => initial.design.source_sheet_url ? {
    url: initial.design.source_sheet_url,
    title: initial.design.source_sheet_title || 'Reference sheet',
    source: initial.design.source_sheet_source || 'vault',
    sourceAssetId: initial.design.source_sheet_asset_id || null,
  } : !sheet ? {
    url: typeof window !== 'undefined' ? new URL(DEFAULT_ACTOR_SHEET_PATH, window.location.origin).href : DEFAULT_ACTOR_SHEET_PATH,
    title: 'Neutral mannequin reference',
    source: 'default',
    sourceAssetId: null,
  } : null);
  const [lookReferences, setLookReferences] = useState(() => {
    if (Array.isArray(initial.design.look_references) && initial.design.look_references.length) return initial.design.look_references.filter((item) => item?.url);
    if (initial.design.costume_url) return [{
      url: initial.design.costume_url,
      title: initial.design.costume_title || 'Selected look reference',
      source: initial.design.costume_source || 'vault',
      sourceAssetId: initial.design.costume_source_asset_id || null,
    }];
    return [];
  });
  const [accessories, setAccessories] = useState(initial.design.accessories || sheet?.notes || '');
  const [characterDescription, setCharacterDescription] = useState(initial.design.character_description || '');
  const [transformationPrompt, setTransformationPrompt] = useState(initial.design.transformation_prompt || '');
  const [replacePreset, setReplacePreset] = useState(Boolean(initial.design.replace_preset));
  const [referenceLayout] = useState(initial.design.reference_layout_url || null);
  const [aspectRatio, setAspectRatio] = useState(initial.design.aspect_ratio || '4:3');
  const [detectedRatio, setDetectedRatio] = useState(null);
  const [generatedSheet, setGeneratedSheet] = useState(sheet?.voice_sample_url || null);
  const [uploading, setUploading] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState(null);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [showSaveVault, setShowSaveVault] = useState(false);
  const [savedCharacterId, setSavedCharacterId] = useState(sheet?.id || null);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [promptIdeaCategory, setPromptIdeaCategory] = useState('character-type');
  const [promptIdeaSource, setPromptIdeaSource] = useState('ideas');
  const [promptHistory, setPromptHistory] = useState([]);
  const [generationHistory, setGenerationHistory] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const { data: pilotLibrary = [], isLoading: pilotsLoading, error: pilotsError } = useQuery({
    queryKey: ['actor-ai-pilots', userEmail],
    enabled: Boolean(userEmail),
    queryFn: async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const userId = auth?.user?.id;
      if (!userId) return [];
      const { data: accesses, error: accessError } = await supabase.from('member_ai_pilots')
        .select('id,ai_pilot_id,version_id').eq('user_id', userId);
      if (accessError) throw accessError;
      if (!accesses?.length) return [];
      const ids = [...new Set(accesses.map((a) => a.ai_pilot_id))];
      const { data: pilots, error: pilotError } = await supabase.from('ai_pilots')
        .select('id,name,current_published_version_id').in('id', ids);
      if (pilotError) throw pilotError;
      const versions = [...new Set(accesses.map((a) => pilots?.find((p) => p.id === a.ai_pilot_id)?.current_published_version_id || a.version_id).filter(Boolean))];
      const [actors, looks, additions] = await Promise.all([
        versions.length ? supabase.from('ai_pilot_characters').select('*').in('version_id', versions).eq('is_active', true) : Promise.resolve({ data: [], error: null }),
        versions.length ? supabase.from('ai_pilot_blocks').select('version_id,content').in('version_id', versions).eq('is_active', true).eq('block_key', 'looks') : Promise.resolve({ data: [], error: null }),
        supabase.from('member_ai_pilot_extensions').select('*').eq('user_id', userId).eq('is_active', true).in('member_ai_pilot_id', accesses.map((a) => a.id)),
      ]);
      const failed = [actors, looks, additions].find((r) => r.error);
      if (failed) throw failed.error;
      const images = (arr) => (Array.isArray(arr) ? arr : []).map((v) => typeof v === 'string' ? v : v?.url).filter(Boolean);
      const extraImages = (item) => images((item.content?.media || []).filter((v) => v.type === 'image' || v.mime_type?.startsWith('image/')));
      return accesses.map((access) => {
        const pilot = pilots?.find((p) => p.id === access.ai_pilot_id);
        const versionId = pilot?.current_published_version_id || access.version_id;
        const own = (additions.data || []).filter((a) => a.member_ai_pilot_id === access.id && a.operation === 'add');
        const characters = (actors.data || []).filter((a) => a.version_id === versionId).map((a) => ({
          id: 'official:' + a.id, source: 'Official', name: a.role_name,
          bio: [a.description, a.narrative_function, a.behavior, a.visual_identity, a.continuity_locks].filter(Boolean).join('\n\n'),
          traits: a.personality || '', images: images(a.reference_images),
        })).concat(own.filter((a) => a.extension_type === 'character_style').map((a) => ({
          id: 'personal:' + a.id, source: 'Personal', name: a.name,
          bio: [a.content?.description, a.content?.appearance, a.content?.behavior, a.content?.continuity, a.content?.notes].filter(Boolean).join('\n\n'),
          traits: a.content?.personality || '', images: extraImages(a),
        })));
        const looksList = (looks.data || []).filter((b) => b.version_id === versionId).flatMap((b) => (Array.isArray(b.content?.looks) ? b.content.looks : []).map((l, i) => ({
          ...l, id: 'official:' + (l.id || i), source: 'Official', images: images(l.result_images),
        }))).concat(own.filter((a) => a.extension_type === 'look').map((a) => ({
          ...a.content, id: 'personal:' + a.id, name: a.name, source: 'Personal', images: extraImages(a),
        })));
        return { id: access.id, name: pilot?.name || 'AI Pilot', characters, looks: looksList };
      });
    },
  });

  const pricingInput = {
    aspect_ratio: aspectRatio,
    prompt: transformationPrompt.trim() || characterDescription.trim() || undefined,
  };
  const { options: modelOptions, loading: modelsLoading } = useAiModelOptions({
    service: 'generateCharacterSheet',
    kind: 'image',
    input: pricingInput,
  });
  const effectiveModel = selectedModel || modelOptions.find(m => m.recommended)?.model_key || modelOptions[0]?.model_key || null;
  const { quote: priceQuote, loading: priceLoading } = useAiPriceQuote({
    service: 'generateCharacterSheet',
    kind: 'image',
    input: pricingInput,
    modelKey: effectiveModel,
  });

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

  useEffect(() => {
    if (!templateMenuOpen || typeof window === 'undefined') return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setTemplateMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [templateMenuOpen]);

  const { data: vaultAssets = [], refetch: refetchVault } = useQuery({
    queryKey: ['vaultAssetsForCharacterDesigner', userEmail],
    queryFn: () => base44.entities.VaultAsset.filter({ user_email: userEmail }, '-created_date', null),
    enabled: Boolean(userEmail),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ['olo-asset-categories-for-character-designer'],
    queryFn: async () => {
      const { data, error } = await supabase.from('asset_category').select('id,key,label_en,label_fr,display_order').eq('is_active', true).order('display_order', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
  const { data: subcategories = [] } = useQuery({
    queryKey: ['olo-asset-subcategories-for-character-designer'],
    queryFn: async () => {
      const { data, error } = await supabase.from('asset_subcategory').select('id,category_id,key,label_en,label_fr,display_order').eq('is_active', true).order('display_order', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
  const { data: catalogAssets = [], isLoading: loadingCatalog, error: catalogError } = useQuery({
    queryKey: ['olo-character-designer-assets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('catalog_asset')
        .select('id,title,description,featured_image,preview_images,category_id,subcategory_id,creator_name,tags')
        .eq('status', 'published')
        .order('title', { ascending: true })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });
  const { data: promptIdeas = [], isLoading: promptIdeasLoading } = useQuery({
    queryKey: ['actor-prompt-ideas'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('studio_prompt_ideas', { p_tool_key: 'actor' });
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(userEmail),
  });
  useQuery({
    queryKey: ['character-sheet-price'],
    queryFn: async () => {
      const prices = await base44.entities.ToolPricing.filter({ tool_id: 'character_sheet', is_active: true });
      if (prices[0]) setTokenCost(prices[0].token_cost);
      return prices[0] || null;
    },
  });

  const promptIdeaCategories = useMemo(() => {
    const seen = new Map();
    promptIdeas.forEach((idea) => {
      if (!seen.has(idea.category_slug)) seen.set(idea.category_slug, idea.category_name);
    });
    return [...seen.entries()].map(([slug, name]) => ({ slug, name: slug === 'character-type' ? 'Actor Style' : name }));
  }, [promptIdeas]);
  const visiblePromptIdeas = useMemo(
    () => promptIdeas.filter((idea) => idea.category_slug === promptIdeaCategory),
    [promptIdeas, promptIdeaCategory],
  );

  const photoCount = PHOTO_SLOTS.filter(({ key }) => photos[key]).length;
  const hasCharacterSource = sourceMode === 'sheet' ? Boolean(sourceSheet?.url) : sourceMode === 'description' ? Boolean(characterDescription.trim()) : photoCount > 0;
  const preview = generatedSheet || sourceSheet?.url || photos.front || photos.portrait || Object.values(photos)[0] || null;
  const completion = [Boolean(name.trim()), hasCharacterSource, Boolean(lookReferences.length || accessories.trim() || transformationPrompt.trim()), Boolean(generatedSheet)].filter(Boolean).length;

  const addLookReference = (asset) => {
    if (!asset?.url) return;
    setLookReferences((current) => current.some((item) => item.url === asset.url) ? current : [...current, asset]);
  };


  const addPilotTransformation = (look) => {
    const lines = Object.entries(look).filter(([key, value]) =>
      !['id', 'source', 'name', 'images', 'media', 'result_images', 'can_combine'].includes(key) &&
      typeof value === 'string' && value.trim()
    ).map(([key, value]) => key.replace(/_/g, ' ') + ': ' + value.trim());
    const instruction = ['Transform the character using this look while preserving identity and proportions.',
      look.name ? 'Look: ' + look.name : '', ...lines].filter(Boolean).join('\n');
    if (transformationPrompt.includes(instruction)) return;
    setPromptHistory((history) => [...history, transformationPrompt]);
    setTransformationPrompt((current) => [current.trim(), instruction].filter(Boolean).join('\n\n'));
    setLookReferences((current) => {
      const existing = new Set(current.map((image) => image.url));
      return [...current, ...(look.images || []).filter((url) => !existing.has(url))
        .map((url, index) => ({ url, title: (look.name || 'AI Pilot look') + ' ' + (index + 1), source: 'ai_pilot', sourceAssetId: null }))];
    });
    toast.success('AI Pilot transformation and available references added.');
  };

  const addPromptIdea = (idea) => {
    const text = idea?.content?.trim();
    if (!text) return;
    const current = transformationPrompt;
    const existing = current.trim();
    if (existing.includes(text)) return;
    setPromptHistory((history) => [...history, current]);
    setTransformationPrompt(existing ? `${existing}\n${text}` : text);
  };

  const undoLastChange = () => {
    if (generationHistory.length) {
      const previous = generationHistory[generationHistory.length - 1];
      setSourceSheet(previous.sourceSheet);
      setGeneratedSheet(previous.generatedSheet);
      setSourceMode(previous.sourceMode);
      setTransformationPrompt(previous.transformationPrompt);
      setGenerationHistory((history) => history.slice(0, -1));
      setPromptHistory([]);
      return;
    }
    if (!promptHistory.length) return;
    const previous = promptHistory[promptHistory.length - 1];
    setTransformationPrompt(previous);
    setPromptHistory((history) => history.slice(0, -1));
  };

  const uploadImage = async (event, target) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(target);
    try {
      const { file_url: url } = await base44.integrations.Core.UploadFile({ file });
      if (target === 'look') addLookReference({ url, title: file.name, source: 'upload', sourceAssetId: null });
      else if (target === 'sourceSheet') {
        setSourceSheet({ url, title: file.name, source: 'upload', sourceAssetId: null });
        setSourceMode('sheet');
        setGeneratedSheet(null);
        setGenerationHistory([]);
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
    if (asset.source === 'pilot' && asset.character && picker.purpose === 'sheet') {
      setName(asset.character.name || '');
      setBio(asset.character.bio || '');
      setTraits(asset.character.traits || '');
    }
    if (picker.purpose === 'look') addLookReference(asset);
    else if (picker.purpose === 'sheet') {
      setSourceSheet(asset);
      setSourceMode('sheet');
      setGeneratedSheet(null);
      setGenerationHistory([]);
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

  const generateSourceFromDescription = async () => {
    if (!characterDescription.trim()) return toast.error('Describe your character first');
    setGenerating(true);
    try {
      const sourcePrompt = `Photorealistic single character reference image, ${aspectRatio}. Character description: ${characterDescription.trim()}. Full-body, centered subject, seamless light grey studio background, even professional lighting, photorealistic rendering, no text, labels, or borders.`;
      const response = await base44.functions.invoke('generateCharacterSheet', {
        source_mode: 'angles',
        angle_urls: [],
        image_urls: [],
        costume_url: null,
        aspect_ratio: aspectRatio,
        reference_layout_url: referenceLayout,
        accessories: '',
        character_description: characterDescription.trim(),
        prompt_override: sourcePrompt,
        replace_preset: true,
        model_key: effectiveModel || undefined,
      });
      if (!response.data?.file_url) throw new Error(response.data?.error || 'Generation failed');
      setSourceSheet({ url: response.data.file_url, title: 'Generated from description', source: 'generated', sourceAssetId: null });
      setSourceMode('sheet');
      setGeneratedSheet(null);
      toast.success('Character source generated. Now create the reference sheet below.');
    } catch (error) {
      toast.error(error.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const generate = async () => {
    if (!hasCharacterSource) return toast.error(sourceMode === 'sheet' ? 'Choose a complete reference sheet' : sourceMode === 'description' ? 'Describe your character first' : 'Add at least one angle');
    if (sourceMode === 'description') return generateSourceFromDescription();
    setGenerating(true);
    try {
      const angleUrls = PHOTO_SLOTS.map(({ key }) => photos[key]).filter(Boolean);
      const primarySourceUrls = sourceMode === 'sheet' ? [sourceSheet.url] : angleUrls;
      const lookReferenceUrls = lookReferences.map((item) => item.url).filter(Boolean);
      const response = await base44.functions.invoke('generateCharacterSheet', {
        source_mode: sourceMode,
        reference_sheet_url: sourceMode === 'sheet' ? sourceSheet.url : null,
        angle_urls: sourceMode === 'angles' ? angleUrls : [],
        image_urls: [...primarySourceUrls, ...lookReferenceUrls],
        costume_url: lookReferenceUrls[0] || null,
        look_reference_urls: lookReferenceUrls,
        aspect_ratio: aspectRatio,
        reference_layout_url: referenceLayout,
        accessories,
        prompt_override: transformationPrompt.trim() || undefined,
        replace_preset: replacePreset && Boolean(transformationPrompt.trim()),
        model_key: effectiveModel || undefined,
      });
      if (!response.data?.file_url) throw new Error(response.data?.error || 'Generation failed');
      setGenerationHistory((history) => [...history, {
        sourceSheet,
        generatedSheet,
        sourceMode,
        transformationPrompt,
      }]);
      setGeneratedSheet(response.data.file_url);
      setSourceSheet({ url: response.data.file_url, title: 'Generated result', source: 'generated', sourceAssetId: null });
      setSourceMode('sheet');
      setTransformationPrompt('');
      setPromptHistory([]);
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
      const firstLookReference = lookReferences[0] || null;
      const design = {
        photo_sources: photoSources,
        source_mode: sourceMode,
        source_sheet_url: sourceSheet?.url || null,
        source_sheet_title: sourceSheet?.title || null,
        source_sheet_source: sourceSheet?.source || null,
        source_sheet_asset_id: sourceSheet?.sourceAssetId || null,
        look_references: lookReferences,
        costume_url: firstLookReference?.url || null,
        costume_title: firstLookReference?.title || null,
        costume_source: firstLookReference?.source || null,
        costume_source_asset_id: firstLookReference?.sourceAssetId || null,
        reference_layout_url: referenceLayout,
        accessories,
        transformation_prompt: transformationPrompt.trim(),
        replace_preset: replacePreset,
        aspect_ratio: aspectRatio,
        character_description: characterDescription.trim(),
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
      setSavedCharacterId(savedCharacter?.id || sheet?.id || null);
      await queryClient.invalidateQueries({ queryKey: ['characterSheet', userEmail] });
      setShowSaveVault(true);
    } catch (error) {
      toast.error(error.message || 'Character could not be saved');
    } finally {
      setSaving(false);
    }
  };

  const handleVaultSaved = async (savedAsset) => {
    try {
      const primarySourceId = photoSources.front?.source_asset_id || photoSources.portrait?.source_asset_id || '';
      await base44.entities.VaultAsset.update(savedAsset.id, {
        actor_name: name.trim(),
        asset_category: 'character',
        tags: traits.split(',').map((value) => value.trim()).filter(Boolean),
        aspect_ratio: generatedSheet ? aspectRatio : undefined,
        source_asset_id: generatedSheet ? savedCharacterId : primarySourceId,
      });
      await queryClient.invalidateQueries({ queryKey: ['vaultAssetsForCharacterDesigner', userEmail] });
      setShowSaveVault(false);
      toast.success('Character saved to your Vault');
    } catch (error) {
      toast.error(error.message || 'Character could not be finalized in your Vault');
    }
  };

  return createPortal(
    <motion.div className={`fixed z-[1000] flex flex-col overflow-hidden bg-[#09090b] text-white ${embedded ? 'top-14 right-0 bottom-[64px] left-0 lg:bottom-0 lg:left-[var(--studio-toolbar-width)]' : 'inset-0'}`} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 18 }}>
      <header className="relative shrink-0 overflow-hidden border-b border-white/10 bg-black px-4 py-4 sm:px-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(251,191,36,0.18),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(34,211,238,0.12),transparent_30%)]" />
        <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-300 text-black"><UserRound size={22} /></div>
            <div><p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-300">Actor studio</p><h2 className="text-xl font-black sm:text-2xl">Design a complete character</h2></div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenBackgroundGroup && <button type="button" onClick={onOpenBackgroundGroup}
              className="border border-cyan-300/60 bg-cyan-300/15 px-4 py-2.5 text-xs font-black text-cyan-200 hover:bg-cyan-300/25">
              BACKGROUND GROUP · 6 ACTORS
            </button>}
            {!embedded && <button type="button" onClick={onClose} className="rounded-full border border-white/10 bg-white/[0.06] p-2.5 hover:bg-white/15"><X size={19} /></button>}
          </div>
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
                  <span className="rounded-xl bg-white/[0.05] px-2 py-2 text-white/55">{lookReferences.length ? `${lookReferences.length} look refs` : 'No look refs'}</span>
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
              <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-cyan-300/30 bg-black/35">
                  {sourceSheet ? (
                    <><img src={sourceSheet.url} alt={sourceSheet.title} className="h-full w-full object-contain" /><button type="button" onClick={() => setSourceSheet(null)} className="absolute right-2 top-2 rounded-full bg-black/75 p-1.5"><X size={14} /></button></>
                  ) : <div className="flex h-full flex-col items-center justify-center px-6 text-center"><ImagePlus size={34} className="text-cyan-200/30" /><p className="mt-3 text-sm font-black">Complete character sheet</p><p className="mt-1 text-xs text-white/35">One composed image containing all character views.</p></div>}
                </div>
                <div className="flex flex-col justify-center">
                  <p className="text-sm leading-relaxed text-white/55">This sheet becomes the character base. Actor Studio will transform it with the selected wardrobe and your prompt while preserving the character across every view.</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-3 text-xs font-black hover:border-white/35 lg:shrink-0 lg:whitespace-nowrap lg:rounded-md lg:px-3 lg:py-2"><Upload size={15} />Upload<input type="file" accept="image/*" className="hidden" onChange={(event) => uploadImage(event, 'sourceSheet')} /></label>
                    <SourceButton icon={Library} label="My Vault" tone="vault" onClick={() => setPicker({ purpose: 'sheet', label: 'reference sheet', source: 'vault' })} />
                    <SourceButton icon={Store} label="Assets Shop" tone="shop" onClick={() => setPicker({ purpose: 'sheet', label: 'reference sheet', source: 'shop' })} />
                    <SourceButton icon={WandSparkles} label="AI Pilot" tone="shop" onClick={() => setPicker({ purpose: 'sheet', label: 'reference sheet', source: 'pilot' })} />
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-white/10 bg-[#121214] p-5 sm:p-7">
              <StepTitle number="3" title="Character design" description="Combine multiple references into one character look" />
              <div className="space-y-4">
                {lookReferences.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {lookReferences.map((item, index) => (
                      <div key={`${item.url}-${index}`} className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/35">
                        <div className="aspect-[4/3] bg-black"><img src={item.url} alt={item.title || `Look reference ${index + 1}`} className="h-full w-full object-contain" /></div>
                        <button type="button" onClick={() => setLookReferences((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="absolute right-2 top-2 rounded-full bg-black/80 p-1.5 text-white"><X size={14} /></button>
                        <div className="p-3"><p className="truncate text-xs font-black text-white">{item.title || `Look reference ${index + 1}`}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-white/35">Reference {index + 1}</p></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/25 px-6 text-center"><Shirt size={32} className="text-white/20" /><p className="mt-3 text-sm font-black text-white">Build a combined look</p><p className="mt-1 text-xs text-white/35">Add clothing, shoes, hair, accessories, makeup or other visual references.</p></div>
                )}
                <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-3 text-xs font-black hover:border-white/35 lg:shrink-0 lg:whitespace-nowrap lg:rounded-md lg:px-3 lg:py-2"><Upload size={15} />Add upload<input type="file" accept="image/*" className="hidden" onChange={(event) => uploadImage(event, 'look')} /></label>
                  <SourceButton icon={Library} label="Add from Vault" tone="vault" onClick={() => setPicker({ purpose: 'look', label: 'look reference', source: 'vault' })} />
                  <SourceButton icon={Store} label="Add from Assets Shop" tone="shop" onClick={() => setPicker({ purpose: 'look', label: 'look reference', source: 'shop' })} />
                  <SourceButton icon={WandSparkles} label="Add from AI Pilot" tone="shop" onClick={() => setPicker({ purpose: 'look', label: 'look reference', source: 'pilot' })} />
                </div>
                <label className="block text-xs font-black uppercase tracking-wider text-white/60">Accessories and styling<textarea value={accessories} onChange={(event) => setAccessories(event.target.value)} placeholder="Explain how to combine the selected references — e.g. use the dress from reference 1, shoes from reference 2, hairstyle from reference 3..." rows={3} className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-semibold normal-case tracking-normal text-white outline-none placeholder:text-white/20 focus:border-amber-300/60" /></label>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-wider text-white/60">Transformation prompt</p>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={undoLastChange} disabled={!generationHistory.length && !promptHistory.length} className="rounded-lg bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-30">Undo</button>
                    <div className="relative">
                      <button type="button" onClick={() => setTemplateMenuOpen((value) => !value)} className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white/60 hover:text-white"><WandSparkles size={12} />Prompt ideas</button>
                      {templateMenuOpen && <button type="button" aria-label="Close prompt ideas" onClick={() => setTemplateMenuOpen(false)} className="fixed inset-0 z-10 cursor-default" />}
                      {templateMenuOpen && (
                        <div className="absolute right-0 z-20 mt-2 w-[min(90vw,34rem)] overflow-hidden rounded-2xl border border-white/15 bg-[#161618] shadow-2xl">
                          <div className="flex items-start justify-between gap-3 border-b border-white/10 p-3">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">Creative ideas</p>
                              <p className="mt-1 text-xs text-white/40">Choose one or combine several. They are added to your prompt.</p>
                            </div>
                            <button type="button" onClick={() => setTemplateMenuOpen(false)} className="rounded-full bg-white/10 p-1.5 text-white/60 hover:bg-white/20 hover:text-white" aria-label="Close prompt ideas"><X size={15} /></button>
                          </div>
                          <div className="flex gap-2 border-b border-white/10 p-3">
                            <button type="button" onClick={() => setPromptIdeaSource('ideas')} className={`rounded-lg px-3 py-2 text-xs font-bold ${promptIdeaSource === 'ideas' ? 'bg-cyan-300 text-black' : 'bg-white/[0.06] text-white/70'}`}>Prompt Ideas</button>
                            <button type="button" onClick={() => setPromptIdeaSource('pilot')} className={`rounded-lg px-3 py-2 text-xs font-bold ${promptIdeaSource === 'pilot' ? 'bg-cyan-300 text-black' : 'bg-white/[0.06] text-white/70'}`}>My AI Pilots</button>
                          </div>
                          {promptIdeaSource === 'pilot' ? (
                            <div className="max-h-80 space-y-3 overflow-y-auto p-3">
                              {pilotLibrary.flatMap((pilot) => pilot.looks.map((look) => ({ pilot, look }))).length ? pilotLibrary.flatMap((pilot) => pilot.looks.map((look) => ({ pilot, look }))).map(({ pilot, look }) => (
                                <button type="button" key={pilot.id + ':' + look.id} onClick={() => { addPilotTransformation(look); setTemplateMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-2 text-left hover:border-cyan-300/50">
                                  {look.images?.[0] ? <img src={look.images[0]} alt="" className="h-16 w-14 shrink-0 rounded-lg object-cover" /> : <div className="flex h-16 w-14 shrink-0 items-center justify-center rounded-lg bg-white/5"><WandSparkles size={18} className="text-white/35" /></div>}
                                  <span className="min-w-0"><span className="block text-sm font-bold text-white">{look.name || 'Transformation look'}</span><span className="mt-1 block text-xs text-white/45">{pilot.name} · {look.source}</span></span>
                                </button>
                              )) : <p className="py-5 text-center text-sm text-white/45">No transformation looks available in your AI Pilots.</p>}
                            </div>
                          ) : promptIdeasLoading ? (
                            <div className="flex items-center justify-center gap-2 p-5 text-xs font-bold text-white/50"><Loader2 size={15} className="animate-spin" />Loading ideas…</div>
                          ) : promptIdeas.length ? (
                            <>
                              <div className="flex flex-wrap gap-2 border-b border-white/10 p-3">
                                {promptIdeaCategories.map((category) => (
                                  <button
                                    type="button"
                                    key={category.slug}
                                    onClick={() => setPromptIdeaCategory(category.slug)}
                                    className={`shrink-0 rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-wider ${promptIdeaCategory === category.slug ? 'bg-cyan-300 text-black' : 'bg-white/[0.06] text-white/60 hover:text-white'}`}
                                  >
                                    {category.name}
                                  </button>
                                ))}
                              </div>
                              <div className="grid max-h-64 gap-2 overflow-y-auto p-3 sm:grid-cols-2">
                                {visiblePromptIdeas.map((idea) => (
                                  <button
                                    type="button"
                                    key={idea.prompt_id}
                                    onClick={() => { addPromptIdea(idea); setTemplateMenuOpen(false); }}
                                    title={idea.content}
                                    className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-left text-xs font-bold text-white/80 transition hover:border-cyan-300/40 hover:bg-cyan-300/[0.06] hover:text-white"
                                  >
                                    {idea.name}
                                  </button>
                                ))}
                              </div>
                            </>
                          ) : (
                            <div className="p-5 text-center text-xs text-white/45">No prompt ideas available.</div>
                          )}
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => setReplacePreset((value) => !value)} className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${replacePreset ? 'bg-cyan-300 text-black' : 'bg-white/10 text-white/60'}`}>{replacePreset ? 'Custom prompt' : 'Add to preset'}</button>
                  </div>
                </div>
                <textarea value={transformationPrompt} onChange={(event) => { setTransformationPrompt(event.target.value); setPromptHistory([]); }} placeholder={replacePreset ? 'Write the complete transformation instruction...' : 'Describe how you want to transform the character...'} rows={3} className="w-full resize-none rounded-2xl border border-cyan-300/20 bg-black/35 px-4 py-3.5 text-sm font-semibold text-white outline-none placeholder:text-white/20 focus:border-cyan-300/60" />
              </div>
            </section>

            <section className="rounded-[28px] border border-amber-300/20 bg-[linear-gradient(145deg,rgba(251,191,36,0.09),rgba(18,18,20,1)_45%)] p-5 sm:p-7">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <StepTitle number="4" title="Create the character" description="Generate a consistent reference sheet from your selections." />
                  <div className="mb-3"><p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/45">AI Model</p><select value={effectiveModel || ''} onChange={(event) => setSelectedModel(event.target.value || null)} disabled={modelsLoading || modelOptions.length === 0} className="w-full rounded-xl bg-black px-3 py-3 text-sm font-black text-amber-300 disabled:opacity-50">{modelsLoading && <option value="">Loading models…</option>}{!modelsLoading && modelOptions.length === 0 && <option value="">No model available</option>}{modelOptions.map((model) => <option key={model.model_key} value={model.model_key}>{model.name || model.model_key}{model.recommended ? ' — Recommended' : ''}{model.credits ? ` — ${model.credits} credits` : ''}</option>)}</select></div><div className="flex flex-wrap items-center gap-2">{RATIOS.map((ratio) => <button type="button" key={ratio} onClick={() => { setAspectRatio(ratio); setDetectedRatio(null); }} className={`rounded-xl px-3 py-2 text-xs font-black ${aspectRatio === ratio ? 'bg-white text-black' : 'bg-white/[0.06] text-white/60 hover:text-white'}`}>{ratio}</button>)}{detectedRatio && <span className="rounded-full bg-cyan-300/15 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-cyan-200">Detected from reference</span>}</div>
                </div>
                <button type="button" onClick={generate} disabled={!hasCharacterSource || generating} className="flex min-w-64 items-center justify-center gap-3 rounded-2xl bg-amber-300 px-6 py-4 font-black text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-35">
                  {generating ? <Loader2 size={19} className="animate-spin" /> : <WandSparkles size={19} />}
                  {generating ? 'Creating character...' : generatedSheet ? 'Generate again' : sourceMode === 'sheet' ? 'Transform character' : 'Create reference sheet'}
                  <span className="rounded-full bg-black/15 px-2.5 py-1 text-xs"><Coins size={11} className="mr-1 inline" />{priceLoading ? '…' : priceQuote?.credits || 'auto'}</span>
                </button>
              </div>
            </section>
          </main>
        </div>
      </div>

      <footer className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-black/90 px-4 py-4 backdrop-blur-xl sm:px-7">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <p className="hidden text-sm text-white/45 sm:block">Choose the Vault folder when you save. Actor stays open after saving.</p>
          <button type="button" onClick={save} disabled={saving || !name.trim() || !preview} className="ml-auto flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-300 to-yellow-400 px-6 py-3.5 font-black text-black disabled:cursor-not-allowed disabled:opacity-35">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Bookmark size={18} />}{saving ? 'Preparing...' : 'Save character to Vault'}<ArrowRight size={17} />
          </button>
        </div>
      </footer>

      <AnimatePresence>{picker && (
        <AssetPicker
          picker={picker} onClose={() => setPicker(null)} onSelect={selectAsset}
          vaultAssets={vaultAssets} catalogAssets={catalogAssets} categories={categories} subcategories={subcategories} userEmail={userEmail}
          pilotLibrary={pilotLibrary} loadingPilots={pilotsLoading} pilotError={pilotsError}
          loadingCatalog={loadingCatalog} catalogError={catalogError}
          onManageVault={() => { setPicker(null); setVaultOpen(true); }}
          embedded={embedded}
        />
      )}</AnimatePresence>
      <VaultDrawer open={vaultOpen} onClose={() => { setVaultOpen(false); refetchVault(); }} />
      {showSaveVault && preview && (
        <SaveToVaultModal
          userEmail={userEmail}
          imageUrl={preview}
          mediaType="image"
          onSaved={handleVaultSaved}
          onClose={() => setShowSaveVault(false)}
        />
      )}
    </motion.div>,
    document.body,
  );
}