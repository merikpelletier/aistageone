import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';
import { useAiModelOptions } from '@/hooks/useAiModelOptions';
import { useAiPriceQuote } from '@/hooks/useAiPriceQuote';
import {
  Loader2,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';

const SCENE_TEMPLATES = [
  { id: 'establishing', label: 'Establishing', characters: 0, action: 'establishing composition with clear spatial geography' },
  { id: 'dialogue', label: 'Dialogue', characters: 2, action: 'dialogue blocking with clear eyelines and conversational spacing' },
  { id: 'group', label: 'Group Scene', characters: 4, action: 'group blocking with layered depth and readable relationships' },
  { id: 'walk_run', label: 'Walk / Run', characters: 2, action: 'clear movement path and direction of travel' },
  { id: 'action', label: 'Action', characters: 3, action: 'dynamic action blocking with readable movement lanes' },
  { id: 'product', label: 'Product Placement', characters: 1, action: 'natural product integration with deliberate visibility' },
  { id: 'custom', label: 'Custom', characters: 1, action: 'custom cinematic blocking' },
];

const FRAMING_OPTIONS = [
  'Close-up',
  'Medium close-up',
  'Medium shot',
  'Full shot',
  'Wide shot',
  'Background',
  'Off frame',
];

const IMPORTANCE_OPTIONS = ['Primary', 'Secondary', 'Background'];

const SHOT_PRESETS = [
  { id: 'closeup-1', label: 'Close-up · Character 1', focusIndex: 0, instruction: 'Tight close-up on Character 1. Character 1 is the clear camera subject.' },
  { id: 'closeup-2', label: 'Close-up · Character 2', focusIndex: 1, instruction: 'Tight close-up on Character 2. Character 2 is the clear camera subject.' },
  { id: 'medium', label: 'Medium shot', instruction: 'Medium shot preserving the established scene geography and eyelines.' },
  { id: 'two-shot', label: 'Two-shot', instruction: 'Two-shot showing the two principal visible characters together with clear conversational geography.' },
  { id: 'ots-1', label: 'Over shoulder · Character 1', focusIndex: 0, instruction: 'Over-the-shoulder shot focused on Character 1; the other character may appear only as the near shoulder/foreground shape if appropriate.' },
  { id: 'ots-2', label: 'Over shoulder · Character 2', focusIndex: 1, instruction: 'Over-the-shoulder shot focused on Character 2; the other character may appear only as the near shoulder/foreground shape if appropriate.' },
  { id: 'wide', label: 'Wide shot', instruction: 'Wide shot that preserves the established spatial geography of the scene.' },
  { id: 'insert', label: 'Insert / detail', instruction: 'Insert/detail shot of the most relevant prop, product, hand action, or scene detail. Do not redesign the environment.' },
  { id: 'reverse', label: 'Reverse angle', instruction: 'Reverse-angle coverage of the same established scene, preserving screen direction, identity, wardrobe, set, and eyelines.' },
  { id: 'custom', label: 'Custom framing', instruction: '' },
];

const createCharacter = (index, template = 'custom') => ({
  id: `character-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
  label: `Character ${index + 1}`,
  asset: null,
  position: template === 'dialogue' ? (index === 0 ? 'Seated at the table on the left' : 'Seated on the right, facing Character 1') : '',
  action: '',
  lookAt: template === 'dialogue' ? (index === 0 ? 'Character 2' : 'Character 1') : '',
  shot: 'Medium shot',
  importance: index === 0 ? 'Primary' : 'Secondary',
  note: '',
});

const createElement = (index, kind = 'prop', asset = null) => ({
  id: `element-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
  label: asset?.title || `${kind === 'product' ? 'Product' : 'Prop'} ${index + 1}`,
  kind,
  asset,
  position: '',
  usedBy: '',
  visibility: 'Visible',
  note: '',
});

const getCharacterImage = (asset) => {
  if (asset?.url) return asset.url;
  const raw = asset?.character_photos?.[0];
  if (!raw) return null;
  if (typeof raw === 'string' && /^https?:\/\//i.test(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed?.portrait || parsed?.front || parsed?.profile || parsed?.side || parsed?.back || Object.values(parsed || {}).find((value) => typeof value === 'string') || null;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') return raw?.portrait || raw?.front || raw?.profile || raw?.side || raw?.back || null;
  return null;
};

const getCatalogImages = (asset) => [...new Set([
  asset?.featured_image,
  ...(Array.isArray(asset?.preview_images) ? asset.preview_images : []),
].filter(Boolean))];

const getAssetImage = (asset) => asset?.images?.[0] || asset?.url || asset?.selected_image || asset?.featured_image || null;

function AssetTile({ image, label, selected }) {
  return (
    <div className={`relative aspect-[4/3] w-full overflow-hidden border bg-black ${selected ? 'border-cyan-300' : 'border-white/15'}`}>
      {image ? <img src={image} alt={label || ''} className="block h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-white/30"><Users size={18} /></div>}
      <span className="absolute bottom-0 left-0 right-0 truncate bg-black/80 px-1.5 py-1 text-[9px] font-bold text-white">{label}</span>
    </div>
  );
}

export default function ComposeSceneBuilder({ userEmail, onDone }) {
  const [templateId, setTemplateId] = useState('dialogue');
  const [characters, setCharacters] = useState([createCharacter(0, 'dialogue'), createCharacter(1, 'dialogue')]);
  const [elements, setElements] = useState([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState(null);
  const [vaultFolders, setVaultFolders] = useState([]);
  const [vaultAssets, setVaultAssets] = useState([]);
  const [vaultFolder, setVaultFolder] = useState('all');
  const [shopAssets, setShopAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [categoryId, setCategoryId] = useState('all');
  const [subcategoryId, setSubcategoryId] = useState('all');
  const [shopSearch, setShopSearch] = useState('');
  const [selectedSet, setSelectedSet] = useState(null);
  const [uploadedAsset, setUploadedAsset] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [additionalPrompt, setAdditionalPrompt] = useState('');
  const [masterScene, setMasterScene] = useState(null);
  const [generatedShot, setGeneratedShot] = useState(null);
  const [generatingMaster, setGeneratingMaster] = useState(false);
  const [generatingShot, setGeneratingShot] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [error, setError] = useState('');
  const [vaultOpen, setVaultOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [vaultLoaded, setVaultLoaded] = useState(false);
  const [shopLoaded, setShopLoaded] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [shotPreset, setShotPreset] = useState('closeup-1');
  const [customShot, setCustomShot] = useState('');

  const template = SCENE_TEMPLATES.find((item) => item.id === templateId) || SCENE_TEMPLATES[0];
  const modelInput = useMemo(() => ({ aspect_ratio: aspectRatio, prompt: additionalPrompt || template.action }), [aspectRatio, additionalPrompt, template.action]);
  const { options: modelOptions, loading: modelLoading } = useAiModelOptions({ service: 'replicateGenerate:compose_scene', kind: 'image', input: modelInput, enabled: modelReady });
  const modelKey = selectedModel || modelOptions.find((item) => item.recommended)?.model_key || modelOptions[0]?.model_key || null;
  const { quote, loading: quoteLoading } = useAiPriceQuote({ service: 'replicateGenerate:compose_scene', kind: 'image', input: modelInput, modelKey, enabled: modelReady });

  useEffect(() => {
    const timer = setTimeout(() => setModelReady(true), 400);
    return () => clearTimeout(timer);
  }, []);

  const loadVault = async () => {
    if (!vaultOpen && !vaultLoaded && userEmail) {
      const [folders, assets] = await Promise.all([
        base44.entities.VaultFolder.filter({ user_email: userEmail }, 'order', 100).catch(() => []),
        base44.entities.VaultAsset.filter({ user_email: userEmail, media_type: 'image' }, '-created_date', 300).catch(() => []),
      ]);
      setVaultFolders(folders || []);
      setVaultAssets(assets || []);
      setVaultLoaded(true);
    }
    setVaultOpen((value) => !value);
  };

  const loadShop = async () => {
    if (!shopOpen && !shopLoaded) {
      const [assets, cats, subs] = await Promise.all([
        supabase.from('catalog_asset').select('id,title,description,featured_image,preview_images,category_id,subcategory_id,creator_name,tags').eq('status', 'published').order('title', { ascending: true }).limit(500).then(({ data }) => data || []).catch(() => []),
        supabase.from('asset_category').select('id,key,label_en,label_fr,display_order').eq('is_active', true).order('display_order', { ascending: true }).then(({ data }) => data || []).catch(() => []),
        supabase.from('asset_subcategory').select('id,category_id,key,label_en,label_fr,display_order').eq('is_active', true).order('display_order', { ascending: true }).then(({ data }) => data || []).catch(() => []),
      ]);
      setShopAssets((assets || []).filter((asset) => getCatalogImages(asset).length).flatMap((asset) => getCatalogImages(asset).map((image, index) => ({ ...asset, id: `${asset.id}::${index}`, featured_image: image, preview_images: [image], __source_asset_id: asset.id, __image_index: index }))));
      setCategories(cats || []);
      setSubcategories(subs || []);
      setShopLoaded(true);
    }
    setShopOpen((value) => !value);
  };

  const visibleVaultAssets = useMemo(() => {
    if (vaultFolder === 'all') return vaultAssets;
    if (vaultFolder === 'unfiled') return vaultAssets.filter((asset) => !asset.folder_id);
    return vaultAssets.filter((asset) => asset.folder_id === vaultFolder);
  }, [vaultAssets, vaultFolder]);

  const selectedCategory = categories.find((item) => item.id === categoryId) || null;
  const selectedSubcategories = selectedCategory ? subcategories.filter((item) => item.category_id === selectedCategory.id).sort((a, b) => (a.display_order || 0) - (b.display_order || 0)) : [];

  const filteredShopAssets = useMemo(() => {
    const query = shopSearch.trim().toLowerCase();
    return shopAssets.filter((asset) => {
      if (categoryId !== 'all' && asset.category_id !== categoryId) return false;
      if (subcategoryId !== 'all' && selectedSubcategories.length && asset.subcategory_id !== subcategoryId) return false;
      if (!query) return true;
      return `${asset.title || ''} ${asset.description || ''} ${asset.creator_name || ''} ${(asset.tags || []).join(' ')}`.toLowerCase().includes(query);
    });
  }, [shopAssets, categoryId, subcategoryId, shopSearch, selectedSubcategories]);

  const selectTemplate = (id) => {
    const next = SCENE_TEMPLATES.find((item) => item.id === id) || SCENE_TEMPLATES[0];
    setTemplateId(next.id);
    setCharacters(Array.from({ length: next.characters }, (_, index) => createCharacter(index, next.id)));
    setElements(next.id === 'product' ? [createElement(0, 'product')] : []);
    setSelectedCharacterId(null);
    setMasterScene(null);
    setGeneratedShot(null);
    setError('');
  };

  const updateCharacter = (id, patch) => setCharacters((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const addCharacter = () => setCharacters((items) => [...items, createCharacter(items.length, templateId)]);
  const removeCharacter = (id) => setCharacters((items) => items.filter((item) => item.id !== id).map((item, index) => ({ ...item, label: `Character ${index + 1}` })));

  const assignCharacterAsset = (asset) => {
    if (!selectedCharacterId) {
      setError('Select a character in Scene Blocking first.');
      return;
    }
    updateCharacter(selectedCharacterId, { asset });
    setError('');
  };

  const addElement = (kind, asset = null) => setElements((items) => [...items, createElement(items.length, kind, asset)]);
  const updateElement = (id, patch) => setElements((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const removeElement = (id) => setElements((items) => items.filter((item) => item.id !== id));

  const blockingText = () => characters.map((character) => `${character.label}: where: ${character.position || 'not specified'}; action: ${character.action || 'not specified'}; looks toward: ${character.lookAt || 'not specified'}; framing: ${character.shot}; importance: ${character.importance}${character.note ? `; note: ${character.note}` : ''}`).join(' | ');
  const elementsText = () => elements.map((element) => `${element.label}: where: ${element.position || 'not specified'}; used by: ${element.usedBy || 'nobody specified'}; visibility: ${element.visibility}${element.note ? `; note: ${element.note}` : ''}`).join(' | ');

  const generateMaster = async () => {
    setGeneratingMaster(true);
    setError('');
    try {
      const setRef = getAssetImage(selectedSet);
      const selectedCharacters = characters.filter((character) => character.asset);
      const visibleCharacters = selectedCharacters.filter((character) => character.shot !== 'Off frame');
      const missingRefs = visibleCharacters.filter((character) => !getCharacterImage(character.asset));
      if (missingRefs.length) throw new Error(`Missing character reference image for ${missingRefs.map((character) => character.label).join(', ')}.`);

      const refs = [];
      if (setRef) refs.push(setRef);
      refs.push(...visibleCharacters.map((character) => getCharacterImage(character.asset)).filter(Boolean));

      const identityMap = visibleCharacters.map((character, index) => `${character.label} = ${character.asset?.label || character.asset?.name || `selected character ${index + 1}`}`).join(' | ');
      const offFrameNames = characters.filter((character) => character.shot === 'Off frame').map((character) => character.label);
      const masterPrompt = `COMPOSE SCENE. Template: ${template.label}. ${setRef ? 'The first supplied reference image is the selected Set and is the visual source of truth for location, lighting, palette, atmosphere and style; do not redesign it.' : ''} ${visibleCharacters.length ? `CHARACTER IDENTITY LOCK — MANDATORY. The supplied character reference images ${setRef ? 'after the Set reference ' : ''}correspond to the visible selected characters in Scene Blocking order. Identity mapping: ${identityMap}. Use those exact people. Do not invent, replace, reinterpret, blend, merge, or substitute any selected character. Preserve each visible selected character's facial identity, age presentation, skin tone, hair, body proportions, wardrobe/look, and recognizable physical appearance. Character blocking: ${blockingText()}.` : characters.length ? `Character blocking: ${blockingText()}.` : 'No required performer.'} ${offFrameNames.length ? `OFF FRAME IS ABSOLUTE: ${offFrameNames.join(', ')} remain part of the scene context and eyelines but MUST NOT appear anywhere in the image, including background, reflection, silhouette, shoulder, or partial body.` : ''} ${elements.length ? `Props and products: ${elementsText()}.` : ''} ${additionalPrompt ? `Additional instruction only: ${additionalPrompt}.` : ''} Preserve the established look of the Set while staging the described action clearly.`;

      const result = await base44.functions.invoke('replicateGenerate', {
        method: 'compose_scene',
        prompt: masterPrompt,
        reference_image_urls: refs.slice(0, 3),
        aspect_ratio: aspectRatio,
        model_key: modelKey || undefined,
      });
      if (!result.data?.file_url) throw new Error(result.data?.error || 'Master Scene generation failed.');
      setMasterScene(result.data.file_url);
      setGeneratedShot(null);
      toast.success('Master Scene generated');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Master Scene generation failed.');
    } finally {
      setGeneratingMaster(false);
    }
  };

  const generateShot = async () => {
    if (!masterScene) {
      setError('Generate the Master Scene first.');
      return;
    }
    setGeneratingShot(true);
    setError('');
    try {
      const preset = SHOT_PRESETS.find((item) => item.id === shotPreset) || SHOT_PRESETS[0];
      const setRef = getAssetImage(selectedSet);
      const visibleCharacters = characters.filter((character) => character.asset && character.shot !== 'Off frame');
      const offFrameNames = characters.filter((character) => character.shot === 'Off frame').map((character) => character.label);
      const focusCharacter = Number.isInteger(preset.focusIndex) ? characters[preset.focusIndex] : null;
      const focusRef = focusCharacter?.shot !== 'Off frame' ? getCharacterImage(focusCharacter?.asset) : null;
      const refs = [];
      const guide = [];

      if (setRef) {
        refs.push(setRef);
        guide.push(`Image ${refs.length} is the ORIGINAL SET reference and controls location/look.`);
      }

      if (focusRef) {
        refs.push(focusRef);
        guide.push(`Image ${refs.length} is the ORIGINAL identity/wardrobe reference for ${focusCharacter.label}.`);
        if (refs.length < 3) {
          refs.push(masterScene);
          guide.push(`Image ${refs.length} is the MASTER SCENE and is for spatial continuity/composition only — NEVER use it as the identity reference.`);
        }
      } else if (shotPreset === 'insert') {
        const propRef = elements.map((element) => element.asset?.selected_image || element.asset?.url || getCatalogImages(element.asset)[0]).find(Boolean);
        if (propRef && refs.length < 3) {
          refs.push(propRef);
          guide.push(`Image ${refs.length} is the ORIGINAL prop/product reference.`);
        }
        if (refs.length < 3) {
          refs.push(masterScene);
          guide.push(`Image ${refs.length} is the MASTER SCENE for spatial continuity only.`);
        }
      } else {
        for (const character of visibleCharacters) {
          const ref = getCharacterImage(character.asset);
          if (!ref || refs.length >= 3) continue;
          refs.push(ref);
          guide.push(`Image ${refs.length} is the ORIGINAL identity/wardrobe reference for ${character.label}.`);
        }
        if (refs.length < 3) {
          refs.push(masterScene);
          guide.push(`Image ${refs.length} is the MASTER SCENE for spatial continuity/composition only — NEVER use it as an identity reference.`);
        }
      }

      const shotInstruction = shotPreset === 'custom' ? customShot.trim() : preset.instruction;
      if (!shotInstruction) throw new Error('Describe the custom framing first.');

      const prompt = `GENERATE A NEW CAMERA SHOT OF THE SAME ESTABLISHED SCENE. ${guide.join(' ')} REFERENCE PRIORITY IS STRICT: original character references control face, hair, skin tone, body, wardrobe and recognizable look; the original Set controls the environment; the Master Scene, when supplied, controls ONLY spatial geography, blocking continuity, lighting direction and scene relationship. Never copy a face, wardrobe, or altered appearance from the Master when an original reference is supplied. Do not create a generation chain from a previous generated shot. CAMERA INSTRUCTION: ${shotInstruction} Scene blocking continuity: ${blockingText()}. ${offFrameNames.length ? `OFF FRAME IS ABSOLUTE: ${offFrameNames.join(', ')} may still be looked at or spoken to but MUST NOT be visible anywhere in this shot, including reflection, silhouette, shoulder, background or partial body.` : ''} ${elements.length ? `Props/products continuity: ${elementsText()}.` : ''} ${additionalPrompt ? `Additional instruction: ${additionalPrompt}.` : ''} Preserve the same location, wardrobe, time, lighting logic, screen direction and character relationships unless the camera instruction explicitly requires a new angle.`;

      const result = await base44.functions.invoke('replicateGenerate', {
        method: 'compose_scene',
        prompt,
        reference_image_urls: refs.slice(0, 3),
        aspect_ratio: aspectRatio,
        model_key: modelKey || undefined,
      });
      if (!result.data?.file_url) throw new Error(result.data?.error || 'Shot generation failed.');
      setGeneratedShot(result.data.file_url);
      setSaveOpen(false);
      toast.success('Shot generated');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Shot generation failed.');
    } finally {
      setGeneratingShot(false);
    }
  };

  return (
    <div className="space-y-4 pb-28">
      <section className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-white">AI Model</p>
        <select value={modelKey || ''} onChange={(event) => setSelectedModel(event.target.value || null)} disabled={modelLoading || !modelOptions.length} className="w-full bg-black px-4 py-3 text-sm font-bold text-yellow-400 disabled:opacity-50">
          {modelLoading && <option value="">Loading models…</option>}
          {!modelLoading && !modelOptions.length && <option value="">No model available</option>}
          {modelOptions.map((item) => <option key={item.model_key} value={item.model_key}>{item.name || item.model_key}{item.recommended ? ' — Recommended' : ''}{item.credits ? ` — ${item.credits} credits` : ''}</option>)}
        </select>
        <div className="flex justify-between text-xs text-white/65"><span>AI cost</span><span>{quoteLoading ? 'Calculating…' : quote?.credits ? `${quote.credits} credits` : 'Calculated automatically'}</span></div>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-white">Additional Prompt</p>
        <textarea value={additionalPrompt} onChange={(event) => setAdditionalPrompt(event.target.value)} rows={3} placeholder="Optional extra instruction for this scene — do not redefine the Set look" className="w-full resize-none bg-white/10 px-4 py-3 text-sm text-white" />
        <div className="flex flex-wrap gap-2">{['16:9', '4:3', '9:16', '1:1'].map((ratio) => <button key={ratio} type="button" onClick={() => setAspectRatio(ratio)} className={`px-3 py-2 text-xs font-bold ${aspectRatio === ratio ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white'}`}>{ratio}</button>)}</div>
      </section>

      <section className="space-y-3 border border-cyan-300/35 p-3">
        <div><p className="text-xs font-bold uppercase tracking-wider text-cyan-200">Set — Scene Environment</p><p className="text-[11px] text-white/55">This is the environment used for the scene. Choose one source below.</p></div>
        {selectedSet ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="h-28 w-full overflow-hidden border border-white/15 bg-black sm:w-48">{getAssetImage(selectedSet) ? <img src={getAssetImage(selectedSet)} alt="Selected Set" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-white/35">No preview</div>}</div>
            <div className="min-w-0 flex-1"><p className="text-sm font-bold text-white">{selectedSet.name || selectedSet.title || 'Selected Set'}</p><p className="mt-1 text-[11px] text-white/55">This Set controls the location, lighting, palette, atmosphere and visual style of the scene.</p><button type="button" onClick={() => setSelectedSet(null)} className="mt-3 bg-white/10 px-3 py-2 text-[10px] font-bold text-white">Remove Set</button></div>
          </div>
        ) : <div className="border border-dashed border-white/20 p-4 text-xs text-white/55">No Set selected yet.</div>}
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-3">
            <button type="button" onClick={loadVault} className="bg-white/10 px-3 py-2.5 text-center text-xs font-bold text-white">{vaultOpen ? 'Close Vault' : 'Choose from Vault'}</button>
            <button type="button" onClick={loadShop} className="bg-white/10 px-3 py-2.5 text-center text-xs font-bold text-white">{shopOpen ? 'Close Assets Shop' : 'Choose from Assets Shop'}</button>
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 bg-white/10 px-3 py-2.5 text-xs font-bold text-white"><Upload size={14} /> Upload Image<input type="file" accept="image/*" className="hidden" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; const { file_url } = await base44.integrations.Core.UploadFile({ file }); setUploadedAsset({ id: `upload-${Date.now()}`, name: file.name || 'Uploaded image', url: file_url, images: [file_url], selected_image: file_url, source: 'upload' }); }} /></label>
          </div>
          {uploadedAsset && <div className="border border-white/15 p-2"><div className="flex items-center gap-3"><img src={uploadedAsset.url} alt="Uploaded" className="h-16 w-16 object-cover" /><p className="text-xs font-bold text-white">{uploadedAsset.name}</p></div><div className="mt-2 grid grid-cols-3 gap-1"><button type="button" onClick={() => setSelectedSet({ ...uploadedAsset, name: uploadedAsset.name || 'Uploaded Set' })} className={`py-1.5 text-[9px] font-bold ${getAssetImage(selectedSet) === uploadedAsset.url ? 'bg-cyan-300 text-black' : 'bg-white/10 text-white'}`}>{getAssetImage(selectedSet) === uploadedAsset.url ? 'Selected Set' : 'Use as Set'}</button><button type="button" onClick={() => assignCharacterAsset({ ...uploadedAsset, label: uploadedAsset.name || 'Uploaded character', character_photos: [uploadedAsset.url] })} className={`py-1.5 text-[9px] font-bold ${characters.some((character) => getCharacterImage(character.asset) === uploadedAsset.url) ? 'bg-cyan-300 text-black' : 'bg-white/10 text-white'}`}>{characters.find((character) => getCharacterImage(character.asset) === uploadedAsset.url) ? `Selected ${characters.find((character) => getCharacterImage(character.asset) === uploadedAsset.url).label}` : 'Use as Character'}</button><button type="button" onClick={() => addElement('product', { ...uploadedAsset, selected_image: uploadedAsset.url })} className={`py-1.5 text-[9px] font-bold ${elements.some((element) => (element.asset?.selected_image || element.asset?.url) === uploadedAsset.url) ? 'bg-cyan-300 text-black' : 'bg-white/10 text-white'}`}>{elements.some((element) => (element.asset?.selected_image || element.asset?.url) === uploadedAsset.url) ? 'Added as Prop/Product' : 'Add as Prop / Product'}</button></div></div>}
        </div>
      </section>

      <section className="space-y-2"><p className="text-xs font-bold uppercase tracking-wider text-white">Scene Template</p><div className="flex flex-wrap gap-2">{SCENE_TEMPLATES.map((item) => <button key={item.id} type="button" onClick={() => selectTemplate(item.id)} className={`px-3 py-2 text-xs font-bold ${templateId === item.id ? 'bg-cyan-300 text-black' : 'bg-white/10 text-white'}`}>{item.label}</button>)}</div></section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wider text-white">Scene Blocking</p><p className="text-[11px] text-white/55">Describe where each character is and what they are doing. The selected Set keeps its existing look.</p></div><button type="button" onClick={addCharacter} className="flex items-center gap-1 bg-white/10 px-3 py-2 text-[10px] font-bold text-white"><Plus size={11} /> Add Character</button></div>
        <div className="space-y-3">{characters.map((character) => <div key={character.id} className={`border p-3 ${selectedCharacterId === character.id ? 'border-cyan-300' : 'border-white/10'}`}>
          <div className="flex items-center gap-3"><button type="button" onClick={() => setSelectedCharacterId(character.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><div className="h-14 w-14 shrink-0 overflow-hidden border border-white/15 bg-black">{getCharacterImage(character.asset) ? <img src={getCharacterImage(character.asset)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-white/30"><Users size={18} /></div>}</div><div className="min-w-0"><p className="truncate text-xs font-bold text-white">{character.asset?.label || character.asset?.name || character.label}</p><p className="text-[10px] text-white/45">{character.label}</p></div></button><button type="button" onClick={() => removeCharacter(character.id)} className="text-white/50"><Trash2 size={13} /></button></div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <label className="space-y-1"><span className="text-[10px] font-bold text-white/70">Where is {character.label}?</span><input value={character.position} onChange={(event) => updateCharacter(character.id, { position: event.target.value })} placeholder="e.g. seated at the table on the left" className="w-full bg-black p-2.5 text-xs text-white" /></label>
            <label className="space-y-1"><span className="text-[10px] font-bold text-white/70">What is {character.label} doing?</span><input value={character.action} onChange={(event) => updateCharacter(character.id, { action: event.target.value })} placeholder="e.g. talking calmly, one hand on the table" className="w-full bg-black p-2.5 text-xs text-white" /></label>
            <label className="space-y-1"><span className="text-[10px] font-bold text-white/70">Who or what is {character.label} looking at?</span><input value={character.lookAt} onChange={(event) => updateCharacter(character.id, { lookAt: event.target.value })} placeholder="e.g. Character 2" className="w-full bg-black p-2.5 text-xs text-white" /></label>
            <div className="grid grid-cols-2 gap-2"><label className="space-y-1"><span className="text-[10px] font-bold text-white/70">Framing</span><select value={character.shot} onChange={(event) => updateCharacter(character.id, { shot: event.target.value })} className="w-full bg-black p-2.5 text-xs text-white">{FRAMING_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label><label className="space-y-1"><span className="text-[10px] font-bold text-white/70">Importance</span><select value={character.importance} onChange={(event) => updateCharacter(character.id, { importance: event.target.value })} className="w-full bg-black p-2.5 text-xs text-white">{IMPORTANCE_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label></div>
            <label className="space-y-1 md:col-span-2"><span className="text-[10px] font-bold text-white/70">Additional blocking note</span><input value={character.note} onChange={(event) => updateCharacter(character.id, { note: event.target.value })} placeholder="Optional relationship, gesture or staging detail" className="w-full bg-black p-2.5 text-xs text-white" /></label>
          </div>
        </div>)}</div>
      </section>

      {vaultOpen && <section id="set-vault" className="space-y-2"><p className="text-xs font-bold uppercase tracking-wider text-white">Vault</p><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setVaultFolder('all')} className={`px-3 py-1.5 text-[10px] font-bold ${vaultFolder === 'all' ? 'bg-cyan-300 text-black' : 'bg-white/10 text-white'}`}>All</button><button type="button" onClick={() => setVaultFolder('unfiled')} className={`px-3 py-1.5 text-[10px] font-bold ${vaultFolder === 'unfiled' ? 'bg-cyan-300 text-black' : 'bg-white/10 text-white'}`}>Unfiled</button>{vaultFolders.map((folder) => <button key={folder.id} type="button" onClick={() => setVaultFolder(folder.id)} className={`px-3 py-1.5 text-[10px] font-bold ${vaultFolder === folder.id ? 'bg-cyan-300 text-black' : 'bg-white/10 text-white'}`}>{folder.name}</button>)}</div><div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5 lg:grid-cols-8">{visibleVaultAssets.map((asset) => { const isSet = getAssetImage(selectedSet) === asset.url; const selectedCharacter = characters.find((character) => getCharacterImage(character.asset) === asset.url); const isElement = elements.some((element) => (element.asset?.selected_image || element.asset?.url) === asset.url); return <div key={asset.id} className={`space-y-1 border p-1 ${isSet || selectedCharacter || isElement ? 'border-cyan-300' : 'border-transparent'}`}><AssetTile image={asset.url} label={asset.name || 'Vault image'} selected={!!(isSet || selectedCharacter || isElement)} /><button type="button" onClick={() => setSelectedSet({ ...asset, name: asset.name || 'Vault set', images: [asset.url], source: 'vault' })} className={`w-full py-1 text-[9px] font-bold ${isSet ? 'bg-cyan-300 text-black' : 'bg-white/10 text-white'}`}>{isSet ? 'Selected Set' : 'Use as Set'}</button><button type="button" onClick={() => assignCharacterAsset({ ...asset, label: asset.name || 'Vault character', character_photos: [asset.url] })} className={`w-full py-1 text-[9px] font-bold ${selectedCharacter ? 'bg-cyan-300 text-black' : 'bg-white/10 text-white'}`}>{selectedCharacter ? `Selected ${selectedCharacter.label}` : 'Use as Character'}</button><button type="button" onClick={() => addElement('product', { ...asset, selected_image: asset.url })} className={`w-full py-1 text-[9px] font-bold ${isElement ? 'bg-cyan-300 text-black' : 'bg-white/10 text-white'}`}>{isElement ? 'Added as Prop/Product' : 'Add as Prop / Product'}</button></div>; })}</div></section>}

      {shopOpen && <section id="set-shop" className="space-y-2"><div className="flex items-center gap-2"><ShoppingBag size={14} className="text-cyan-300" /><p className="text-xs font-bold uppercase tracking-wider text-white">Assets Shop</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setCategoryId('all'); setSubcategoryId('all'); }} className={`px-3 py-1.5 text-[10px] font-bold ${categoryId === 'all' ? 'bg-cyan-300 text-black' : 'bg-white/10 text-white'}`}>All</button>{categories.map((category) => <button key={category.id} type="button" onClick={() => { setCategoryId(category.id); setSubcategoryId('all'); }} className={`px-3 py-1.5 text-[10px] font-bold ${categoryId === category.id ? 'bg-cyan-300 text-black' : 'bg-white/10 text-white'}`}>{category.label_en || category.label_fr || category.key}</button>)}</div>{selectedSubcategories.length > 0 && <div className="flex flex-wrap gap-2 border-t border-white/10 pt-2"><button type="button" onClick={() => setSubcategoryId('all')} className={`px-3 py-1.5 text-[10px] font-bold ${subcategoryId === 'all' ? 'bg-cyan-300 text-black' : 'bg-white/10 text-white'}`}>All</button>{selectedSubcategories.map((subcategory) => <button key={subcategory.id} type="button" onClick={() => setSubcategoryId(subcategory.id)} className={`px-3 py-1.5 text-[10px] font-bold ${subcategoryId === subcategory.id ? 'bg-cyan-300 text-black' : 'bg-white/10 text-white'}`}>{subcategory.label_en || subcategory.label_fr || subcategory.key}</button>)}</div>}<div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" /><input value={shopSearch} onChange={(event) => setShopSearch(event.target.value)} placeholder="Search Assets Shop" className="w-full bg-black/50 py-2.5 pl-9 pr-3 text-xs text-white" /></div><div className="grid max-h-[30rem] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 lg:grid-cols-6">{filteredShopAssets.map((asset) => { const image = getCatalogImages(asset)[0]; const isSet = getAssetImage(selectedSet) === image; const selectedCharacter = characters.find((character) => getCharacterImage(character.asset) === image); const isElement = elements.some((element) => (element.asset?.selected_image || element.asset?.url) === image); return <div key={asset.id} className={`space-y-1 border p-1 ${isSet || selectedCharacter || isElement ? 'border-cyan-300' : 'border-white/10'}`}><AssetTile image={image} label={asset.title || 'Asset'} selected={!!(isSet || selectedCharacter || isElement)} /><button type="button" onClick={() => setSelectedSet({ ...asset, name: asset.title || 'Assets Shop Set', images: [image], selected_image: image, source: 'assets-shop' })} className={`w-full py-1 text-[9px] font-bold ${isSet ? 'bg-cyan-300 text-black' : 'bg-white/10 text-white'}`}>{isSet ? 'Selected Set' : 'Use as Set'}</button><button type="button" onClick={() => assignCharacterAsset({ ...asset, url: image, label: asset.title || 'Assets Shop character', character_photos: [image] })} className={`w-full py-1 text-[9px] font-bold ${selectedCharacter ? 'bg-cyan-300 text-black' : 'bg-white/10 text-white'}`}>{selectedCharacter ? `Selected ${selectedCharacter.label}` : 'Use as Character'}</button><button type="button" onClick={() => addElement('product', { ...asset, selected_image: image, url: image })} className={`w-full py-1 text-[9px] font-bold ${isElement ? 'bg-cyan-300 text-black' : 'bg-white/10 text-white'}`}>{isElement ? 'Added as Prop/Product' : 'Add as Prop / Product'}</button></div>; })}</div></section>}

      <section className="space-y-2"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wider text-white">Props / Products</p><div className="flex gap-2"><button type="button" onClick={() => addElement('prop')} className="bg-white/10 px-2 py-1.5 text-[10px] font-bold text-white"><Plus size={11} className="inline" /> Prop</button><button type="button" onClick={() => addElement('product')} className="bg-white/10 px-2 py-1.5 text-[10px] font-bold text-white"><Plus size={11} className="inline" /> Product</button></div></div>{elements.map((element) => <div key={element.id} className="space-y-2 border border-white/10 p-3"><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-white">{element.label}</p><p className="text-[9px] text-white/45">{element.kind}</p></div><button type="button" onClick={() => removeElement(element.id)} className="text-white/50"><Trash2 size={14} /></button></div><div className="grid gap-2 md:grid-cols-3"><label className="space-y-1"><span className="text-[10px] font-bold text-white/70">Where is it?</span><input value={element.position} onChange={(event) => updateElement(element.id, { position: event.target.value })} placeholder="e.g. in the center of the table" className="w-full bg-black p-2.5 text-xs text-white" /></label><label className="space-y-1"><span className="text-[10px] font-bold text-white/70">Who uses or holds it?</span><input value={element.usedBy} onChange={(event) => updateElement(element.id, { usedBy: event.target.value })} placeholder="e.g. Character 1" className="w-full bg-black p-2.5 text-xs text-white" /></label><label className="space-y-1"><span className="text-[10px] font-bold text-white/70">How visible?</span><select value={element.visibility} onChange={(event) => updateElement(element.id, { visibility: event.target.value })} className="w-full bg-black p-2.5 text-xs text-white"><option>Hero / prominent</option><option>Visible</option><option>Natural / subtle</option><option>Background</option></select></label><label className="space-y-1 md:col-span-3"><span className="text-[10px] font-bold text-white/70">Additional instruction</span><input value={element.note} onChange={(event) => updateElement(element.id, { note: event.target.value })} placeholder="Optional placement or interaction detail" className="w-full bg-black p-2.5 text-xs text-white" /></label></div></div>)}</section>

      {error && <p className="border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-300">{error}</p>}

      <button type="button" onClick={generateMaster} disabled={generatingMaster} className="flex w-full items-center justify-center gap-2 border border-cyan-300 py-4 text-sm font-bold text-cyan-200 disabled:opacity-40">{generatingMaster ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {masterScene ? 'Regenerate Master Scene' : 'Generate Master Scene'}</button>

      {masterScene && <div><p className="mb-2 text-xs font-bold uppercase text-white">Master Scene</p><img src={masterScene} alt="Master Scene" className="max-h-[60vh] w-full bg-black object-contain" /><button type="button" onClick={() => setSaveOpen('master')} className="mt-2 w-full bg-white/10 py-3 text-sm font-bold text-white">Save Master to Vault</button></div>}

      {masterScene && <section className="space-y-3 border border-cyan-300/35 p-3"><div><p className="text-xs font-bold uppercase tracking-wider text-cyan-200">Camera / Shots</p><p className="text-[11px] text-white/55">Generate new coverage from the original Set and character references. The Master Scene is used only for spatial continuity when reference capacity allows; it never replaces identity references.</p></div><select value={shotPreset} onChange={(event) => setShotPreset(event.target.value)} className="w-full bg-black p-3 text-xs text-white">{SHOT_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select>{shotPreset === 'custom' && <textarea value={customShot} onChange={(event) => setCustomShot(event.target.value)} rows={2} placeholder="Describe the camera position and framing" className="w-full resize-none bg-black p-3 text-xs text-white" />}<button type="button" onClick={generateShot} disabled={generatingShot} className="flex w-full items-center justify-center gap-2 bg-cyan-300 py-4 text-sm font-bold text-black disabled:opacity-40">{generatingShot ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} Generate Shot</button></section>}

      {generatedShot && !saveOpen && <div><p className="mb-2 text-xs font-bold uppercase text-white">Generated Shot</p><img src={generatedShot} alt="Generated Shot" className="max-h-[65vh] w-full bg-black object-contain" /><button type="button" onClick={() => setSaveOpen('shot')} className="mt-2 w-full bg-yellow-400 py-3 text-sm font-bold text-black">Save to Vault</button></div>}
      {saveOpen && (saveOpen === 'master' ? masterScene : generatedShot) && <SaveToVaultModal userEmail={userEmail} imageUrl={saveOpen === 'master' ? masterScene : generatedShot} mediaType="image" onSaved={(saved) => { const savedUrl = saveOpen === 'master' ? masterScene : generatedShot; setSaveOpen(false); onDone?.(savedUrl, 'image', saved?.id); }} onClose={() => setSaveOpen(false)} />}
    </div>
  );
}
