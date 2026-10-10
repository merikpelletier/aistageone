import React, { useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';
import { useAiModelOptions } from '@/hooks/useAiModelOptions';
import { useAiPriceQuote } from '@/hooks/useAiPriceQuote';
import { Check, Loader2, Plus, Search, ShoppingBag, Sparkles, Trash2, Upload, Users, Wand2, X } from 'lucide-react';
import { toast } from 'sonner';

const TEMPLATES = [
  { id: 'establishing', label: 'Establishing', characters: 0, action: 'establishing composition with clear spatial geography' },
  { id: 'dialogue', label: 'Dialogue', characters: 2, action: 'dialogue blocking with clear eyelines and conversational spacing' },
  { id: 'group', label: 'Group Scene', characters: 4, action: 'group blocking with layered depth and readable relationships' },
  { id: 'walk_run', label: 'Walk / Run', characters: 2, action: 'clear movement path and direction of travel' },
  { id: 'action', label: 'Action', characters: 3, action: 'dynamic action blocking with readable movement lanes' },
  { id: 'product', label: 'Product Placement', characters: 1, action: 'natural product integration with deliberate visibility' },
  { id: 'custom', label: 'Custom', characters: 1, action: 'custom cinematic blocking' },
];

const DEPTHS = ['Foreground', 'Midground', 'Background'];
const ORIENTATIONS = ['Toward camera', 'Face left', 'Face right', 'Face another character', 'Back to camera', 'Three-quarter'];
const ACTIONS = ['Standing', 'Sitting', 'Walking', 'Running', 'Talking', 'Leaning', 'Holding object', 'Custom'];

const makeSlot = (index, templateId = 'custom') => ({
  id: `character-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
  label: `Character ${index + 1}`,
  asset: null,
  x: templateId === 'dialogue' ? (index === 0 ? 30 : 70) : Math.min(85, 20 + index * 18),
  y: 58,
  depth: index > 2 ? 'Background' : 'Midground',
  scale: 100,
  orientation: templateId === 'dialogue' ? (index === 0 ? 'Face right' : 'Face left') : 'Three-quarter',
  action: templateId === 'walk_run' ? 'Walking' : templateId === 'action' ? 'Running' : 'Standing',
  note: '',
});

const makeElement = (index, kind = 'prop', asset = null) => ({
  id: `element-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
  label: asset?.title || `${kind === 'product' ? 'Product' : 'Prop'} ${index + 1}`,
  kind,
  asset,
  x: 72,
  y: 70,
  depth: 'Foreground',
  scale: 75,
  note: '',
});

const getCharacterImage = character => {
  if (character?.url) return character.url;
  const first = character?.character_photos?.[0];
  if (!first) return null;
  if (typeof first === 'string' && /^https?:\/\//i.test(first)) return first;
  if (typeof first === 'string') {
    try {
      const parsed = JSON.parse(first);
      return parsed?.portrait || parsed?.front || parsed?.profile || parsed?.side || parsed?.back || Object.values(parsed || {}).find(v => typeof v === 'string') || null;
    } catch { return null; }
  }
  if (typeof first === 'object') return first?.portrait || first?.front || first?.profile || first?.side || first?.back || null;
  return null;
};

const shopImages = asset => [...new Set([
  asset?.featured_image,
  ...(Array.isArray(asset?.preview_images) ? asset.preview_images : []),
].filter(Boolean))];

function StageMarker({ slot, selected, onSelect, onMove }) {
  const drag = useRef(null);
  const image = getCharacterImage(slot.asset);
  const pointerDown = event => {
    event.preventDefault();
    drag.current = { startX: event.clientX, startY: event.clientY, x: slot.x, y: slot.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onSelect();
  };
  const pointerMove = event => {
    if (!drag.current) return;
    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(4, Math.min(96, drag.current.x + ((event.clientX - drag.current.startX) / rect.width) * 100));
    const y = Math.max(8, Math.min(92, drag.current.y + ((event.clientY - drag.current.startY) / rect.height) * 100));
    onMove(x, y);
  };
  const pointerUp = event => {
    drag.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };
  return (
    <button
      type="button"
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerUp}
      style={{ left: `${slot.x}%`, top: `${slot.y}%`, transform: `translate(-50%,-50%) scale(${Math.max(.55, Math.min(1.35, slot.scale / 100))})` }}
      className={`absolute z-10 flex h-16 w-16 touch-none select-none items-center justify-center overflow-hidden border-2 bg-black/85 ${selected ? 'border-cyan-300' : 'border-white/60'}`}
    >
      {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <Users size={22} className="text-white/70" />}
      <span className="absolute bottom-0 left-0 right-0 bg-black/85 px-1 py-0.5 text-[8px] font-bold text-white">{slot.label}</span>
    </button>
  );
}

function Thumb({ image, label, selected, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`relative h-20 overflow-hidden border ${selected ? 'border-cyan-300' : 'border-white/15'}`}>
      {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-white/30"><Users size={18} /></div>}
      <span className="absolute bottom-0 left-0 right-0 truncate bg-black/80 px-1.5 py-1 text-[9px] font-bold text-white">{label}</span>
    </button>
  );
}

export default function ComposeSceneBuilder({ userEmail, onDone }) {
  const [templateId, setTemplateId] = useState('dialogue');
  const [slots, setSlots] = useState([makeSlot(0, 'dialogue'), makeSlot(1, 'dialogue')]);
  const [elements, setElements] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [sets, setSets] = useState([]);
  const [vaultFolders, setVaultFolders] = useState([]);
  const [vaultAssets, setVaultAssets] = useState([]);
  const [vaultFolder, setVaultFolder] = useState('all');
  const [shopAssets, setShopAssets] = useState([]);
  const [shopCategories, setShopCategories] = useState([]);
  const [shopCategory, setShopCategory] = useState('all');
  const [shopSearch, setShopSearch] = useState('');
  const [selectedSet, setSelectedSet] = useState(null);
  const [uploadedPhoto, setUploadedPhoto] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [prompt, setPrompt] = useState('');
  const [masterUrl, setMasterUrl] = useState(null);
  const [resultUrl, setResultUrl] = useState(null);
  const [generatingMaster, setGeneratingMaster] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [error, setError] = useState('');

  const template = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];
  const selectedSlot = slots.find(slot => slot.id === selectedSlotId) || null;
  const pricingInput = useMemo(() => ({ aspect_ratio: aspectRatio, prompt: prompt || template.action }), [aspectRatio, prompt, template.action]);
  const { options: modelOptions, loading: modelsLoading } = useAiModelOptions({ service: 'replicateGenerate:compose_scene', kind: 'image', input: pricingInput });
  const effectiveModel = selectedModel || modelOptions.find(m => m.recommended)?.model_key || modelOptions[0]?.model_key || null;
  const { quote: priceQuote, loading: priceLoading } = useAiPriceQuote({ service: 'replicateGenerate:compose_scene', kind: 'image', input: pricingInput, modelKey: effectiveModel });

  useEffect(() => {
    if (!userEmail) return;
    Promise.all([
      base44.entities.CharacterSheet.filter({ user_email: userEmail }).catch(() => []),
      base44.entities.SetAsset.filter({ user_email: userEmail }).catch(() => []),
      base44.entities.VaultFolder.filter({ user_email: userEmail }, 'order', 100).catch(() => []),
      base44.entities.VaultAsset.filter({ user_email: userEmail, media_type: 'image' }, '-created_date', 300).catch(() => []),
      supabase.from('catalog_asset').select('id,title,description,featured_image,preview_images,category_id,creator_name,tags').eq('status', 'published').order('title', { ascending: true }).limit(500).then(({ data }) => data || []).catch(() => []),
      supabase.from('asset_category').select('id,key,label_en,label_fr,display_order').eq('is_active', true).order('display_order', { ascending: true }).then(({ data }) => data || []).catch(() => []),
    ]).then(([chars, userSets, folders, vault, shop, categories]) => {
      setCharacters(chars || []);
      setSets(userSets || []);
      setVaultFolders(folders || []);
      setVaultAssets(vault || []);
      setShopAssets((shop || []).filter(asset => shopImages(asset).length));
      setShopCategories(categories || []);
    });
  }, [userEmail]);

  const visibleVaultAssets = useMemo(() => {
    if (vaultFolder === 'all') return vaultAssets;
    if (vaultFolder === 'unfiled') return vaultAssets.filter(asset => !asset.folder_id);
    return vaultAssets.filter(asset => asset.folder_id === vaultFolder);
  }, [vaultAssets, vaultFolder]);

  const visibleShopAssets = useMemo(() => {
    const term = shopSearch.trim().toLowerCase();
    return shopAssets.filter(asset => {
      if (shopCategory !== 'all' && asset.category_id !== shopCategory) return false;
      if (!term) return true;
      return `${asset.title || ''} ${asset.description || ''} ${asset.creator_name || ''} ${(asset.tags || []).join(' ')}`.toLowerCase().includes(term);
    });
  }, [shopAssets, shopCategory, shopSearch]);

  const chooseTemplate = id => {
    const next = TEMPLATES.find(t => t.id === id) || TEMPLATES[0];
    setTemplateId(next.id);
    setSlots(Array.from({ length: next.characters }, (_, index) => makeSlot(index, next.id)));
    setElements(next.id === 'product' ? [makeElement(0, 'product')] : []);
    setSelectedSlotId(null);
    setMasterUrl(null);
    setResultUrl(null);
    setError('');
  };

  const updateSlot = (id, patch) => setSlots(current => current.map(slot => slot.id === id ? { ...slot, ...patch } : slot));
  const addCharacter = () => setSlots(current => [...current, makeSlot(current.length, templateId)]);
  const removeCharacter = id => setSlots(current => current.filter(slot => slot.id !== id).map((slot, index) => ({ ...slot, label: `Character ${index + 1}` })));
  const assignCharacter = asset => {
    if (!selectedSlotId) { setError('Select a character slot in the Master Scene first.'); return; }
    updateSlot(selectedSlotId, { asset });
    setError('');
  };
  const addElement = (kind, asset = null) => setElements(current => [...current, makeElement(current.length, kind, asset)]);
  const updateElement = (id, patch) => setElements(current => current.map(item => item.id === id ? { ...item, ...patch } : item));
  const removeElement = id => setElements(current => current.filter(item => item.id !== id));

  const blockingText = () => slots.map(slot => `${slot.label}: ${slot.action}, ${slot.depth}, x ${Math.round(slot.x)}%, y ${Math.round(slot.y)}%, scale ${slot.scale}%, ${slot.orientation}${slot.note ? `, ${slot.note}` : ''}`).join(' | ');
  const elementText = () => elements.map(item => `${item.label}: ${item.depth}, x ${Math.round(item.x)}%, y ${Math.round(item.y)}%, scale ${item.scale}%${item.note ? `, ${item.note}` : ''}`).join(' | ');

  const generateMaster = async () => {
    setGeneratingMaster(true);
    setError('');
    try {
      const refs = [];
      if (selectedSet?.images?.[0]) refs.push(selectedSet.images[0]);
      if (uploadedPhoto) refs.push(uploadedPhoto);
      const masterPrompt = `MASTER SCENE BLOCKING FRAME. Template: ${template.label}. ${template.action}. ${slots.length ? `Use ${slots.length} neutral performer placeholders. ${blockingText()}.` : 'No required performer.'} ${elements.length ? `Reserve positions for: ${elementText()}.` : ''} ${selectedSet?.name ? `Set: ${selectedSet.name}.` : ''} ${prompt || ''} Keep camera, spatial layout and blocking clear so the placeholders can be replaced later.`;
      const res = await base44.functions.invoke('replicateGenerate', {
        method: 'compose_scene',
        prompt: masterPrompt,
        reference_image_urls: refs.slice(0, 3),
        aspect_ratio: aspectRatio,
        model_key: effectiveModel || undefined,
      });
      if (!res.data?.file_url) throw new Error(res.data?.error || 'Master Scene generation failed.');
      setMasterUrl(res.data.file_url);
      toast.success('Master Scene generated');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Master Scene generation failed.');
    } finally {
      setGeneratingMaster(false);
    }
  };

  const renderFinal = async () => {
    if (!masterUrl) { setError('Generate the Master Scene first.'); return; }
    setRendering(true);
    setError('');
    try {
      let currentUrl = masterUrl;
      const setImage = selectedSet?.images?.[0];
      if (setImage) {
        const res = await base44.functions.invoke('replicateGenerate', {
          method: 'compose_scene',
          prompt: `Keep the Master Scene camera, composition and blocking unchanged. Replace only the generic environment with the supplied set reference. ${prompt || ''}`,
          reference_image_urls: [currentUrl, setImage],
          aspect_ratio: aspectRatio,
          model_key: effectiveModel || undefined,
        });
        if (res.data?.file_url) currentUrl = res.data.file_url;
      }
      for (const slot of slots) {
        const image = getCharacterImage(slot.asset);
        if (!image) continue;
        const res = await base44.functions.invoke('replicateGenerate', {
          method: 'compose_scene',
          prompt: `Keep the scene, set, camera and all other elements unchanged. Replace only ${slot.label} at x ${Math.round(slot.x)}%, y ${Math.round(slot.y)}%, ${slot.depth}, scale ${slot.scale}%, ${slot.orientation}, ${slot.action} with the supplied character reference. Preserve identity. ${slot.note || ''}`,
          reference_image_urls: [currentUrl, image],
          aspect_ratio: aspectRatio,
          model_key: effectiveModel || undefined,
        });
        if (res.data?.file_url) currentUrl = res.data.file_url;
      }
      for (const item of elements) {
        const image = item.asset?.selected_image || item.asset?.url || shopImages(item.asset)[0];
        if (!image) continue;
        const res = await base44.functions.invoke('replicateGenerate', {
          method: 'compose_scene',
          prompt: `Keep the current scene, camera, set and characters unchanged. Add only ${item.label} at x ${Math.round(item.x)}%, y ${Math.round(item.y)}%, ${item.depth}, scale ${item.scale}%. Preserve the supplied object's recognizable design. ${item.note || ''}`,
          reference_image_urls: [currentUrl, image],
          aspect_ratio: aspectRatio,
          model_key: effectiveModel || undefined,
        });
        if (res.data?.file_url) currentUrl = res.data.file_url;
      }
      setResultUrl(currentUrl);
      setShowSave(true);
      toast.success('Final Scene rendered');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Final Scene generation failed.');
    } finally {
      setRendering(false);
    }
  };

  return (
    <div className="space-y-4 pb-28">
      <section className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-white">AI Model</p>
        <select value={effectiveModel || ''} onChange={e => setSelectedModel(e.target.value || null)} disabled={modelsLoading || !modelOptions.length} className="w-full bg-black px-4 py-3 text-sm font-bold text-yellow-400 disabled:opacity-50">
          {modelsLoading && <option value="">Loading models…</option>}
          {!modelsLoading && !modelOptions.length && <option value="">No model available</option>}
          {modelOptions.map(m => <option key={m.model_key} value={m.model_key}>{m.name || m.model_key}{m.recommended ? ' — Recommended' : ''}{m.credits ? ` — ${m.credits} credits` : ''}</option>)}
        </select>
        <div className="flex justify-between text-xs text-white/65"><span>AI cost</span><span>{priceLoading ? 'Calculating…' : priceQuote?.credits ? `${priceQuote.credits} credits` : 'Calculated automatically'}</span></div>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-white">Scene Template</p>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map(item => <button type="button" key={item.id} onClick={() => chooseTemplate(item.id)} className={`px-3 py-2 text-xs font-bold ${templateId === item.id ? 'bg-cyan-300 text-black' : 'bg-white/10 text-white'}`}>{item.label}</button>)}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p className="text-xs font-bold uppercase tracking-wider text-white">Master Scene</p><p className="text-[11px] text-white/55">Drag the character slots to position them.</p></div>
          <button type="button" onClick={generateMaster} disabled={generatingMaster} className="flex items-center gap-2 bg-cyan-300 px-4 py-2.5 text-xs font-bold text-black disabled:opacity-50">{generatingMaster ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Generate Master</button>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
          <div className="relative aspect-video overflow-hidden border border-white/15 bg-black">
            {masterUrl && <img src={masterUrl} alt="Master Scene" className="absolute inset-0 h-full w-full object-cover opacity-55" />}
            {slots.map(slot => <StageMarker key={slot.id} slot={slot} selected={selectedSlotId === slot.id} onSelect={() => setSelectedSlotId(slot.id)} onMove={(x, y) => updateSlot(slot.id, { x, y })} />)}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between"><p className="text-xs font-bold text-white">Characters</p><button type="button" onClick={addCharacter} className="flex items-center gap-1 bg-white/10 px-2 py-1.5 text-[10px] font-bold text-white"><Plus size={11} /> Add</button></div>
            {slots.map(slot => <div key={slot.id} className={`border p-2 ${selectedSlotId === slot.id ? 'border-cyan-300' : 'border-white/10'}`}>
              <div className="flex items-center gap-2"><button type="button" onClick={() => setSelectedSlotId(slot.id)} className="flex-1 text-left text-xs font-bold text-white">{slot.asset?.character_name || slot.asset?.label || slot.label}</button><button type="button" onClick={() => removeCharacter(slot.id)} className="text-white/50"><Trash2 size={13} /></button></div>
              {selectedSlotId === slot.id && <div className="mt-2 grid grid-cols-2 gap-2">
                <select value={slot.depth} onChange={e => updateSlot(slot.id, { depth: e.target.value })} className="bg-black p-2 text-[10px] text-white">{DEPTHS.map(v => <option key={v}>{v}</option>)}</select>
                <select value={slot.orientation} onChange={e => updateSlot(slot.id, { orientation: e.target.value })} className="bg-black p-2 text-[10px] text-white">{ORIENTATIONS.map(v => <option key={v}>{v}</option>)}</select>
                <select value={slot.action} onChange={e => updateSlot(slot.id, { action: e.target.value })} className="bg-black p-2 text-[10px] text-white">{ACTIONS.map(v => <option key={v}>{v}</option>)}</select>
                <label className="flex items-center gap-1 bg-black p-2 text-[10px] text-white">Scale<input type="range" min="55" max="145" value={slot.scale} onChange={e => updateSlot(slot.id, { scale: Number(e.target.value) })} className="min-w-0 flex-1" /></label>
                <input value={slot.note} onChange={e => updateSlot(slot.id, { note: e.target.value })} placeholder="Pose / relation / instruction" className="col-span-2 bg-black p-2 text-[10px] text-white" />
              </div>}
            </div>)}
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-white">Character Library {selectedSlot ? `→ ${selectedSlot.label}` : '— select a Master Scene slot first'}</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
          {characters.map(character => <Thumb key={character.id} image={getCharacterImage(character)} label={character.character_name || 'Character'} selected={selectedSlot?.asset?.id === character.id} onClick={() => assignCharacter(character)} />)}
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-white">Vault</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setVaultFolder('all')} className={`px-3 py-1.5 text-[10px] font-bold ${vaultFolder === 'all' ? 'bg-cyan-300 text-black' : 'bg-white/10 text-white'}`}>All</button>
          <button type="button" onClick={() => setVaultFolder('unfiled')} className={`px-3 py-1.5 text-[10px] font-bold ${vaultFolder === 'unfiled' ? 'bg-cyan-300 text-black' : 'bg-white/10 text-white'}`}>Unfiled</button>
          {vaultFolders.map(folder => <button type="button" key={folder.id} onClick={() => setVaultFolder(folder.id)} className={`px-3 py-1.5 text-[10px] font-bold ${vaultFolder === folder.id ? 'bg-cyan-300 text-black' : 'bg-white/10 text-white'}`}>{folder.name}</button>)}
        </div>
        <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5 lg:grid-cols-8">
          {visibleVaultAssets.map(asset => <div key={asset.id} className="space-y-1"><Thumb image={asset.url} label={asset.name || 'Vault image'} selected={selectedSlot?.asset?.id === asset.id} onClick={() => assignCharacter({ ...asset, label: asset.name || 'Vault character', character_photos: [asset.url] })} /><button type="button" onClick={() => setSelectedSet({ ...asset, name: asset.name || 'Vault set', images: [asset.url] })} className="w-full bg-white/10 py-1 text-[9px] font-bold text-white">Use as Set</button></div>)}
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-white">Sets</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {sets.map(set => <Thumb key={set.id} image={set.images?.[0]} label={set.name || 'Set'} selected={selectedSet?.id === set.id} onClick={() => setSelectedSet(selectedSet?.id === set.id ? null : set)} />)}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 bg-white/10 px-3 py-2 text-xs font-bold text-white"><Upload size={14} /> Upload reference<input type="file" accept="image/*" className="hidden" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; const { file_url } = await base44.integrations.Core.UploadFile({ file }); setUploadedPhoto(file_url); }} /></label>
        {uploadedPhoto && <button type="button" onClick={() => setUploadedPhoto(null)} className="ml-2 inline-flex items-center gap-1 text-xs text-green-300"><Check size={12} /> Reference ready <X size={11} /></button>}
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2"><ShoppingBag size={14} className="text-cyan-300" /><p className="text-xs font-bold uppercase tracking-wider text-white">Assets Shop</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setShopCategory('all')} className={`px-3 py-1.5 text-[10px] font-bold ${shopCategory === 'all' ? 'bg-cyan-300 text-black' : 'bg-white/10 text-white'}`}>All</button>
          {shopCategories.map(cat => <button type="button" key={cat.id} onClick={() => setShopCategory(cat.id)} className={`px-3 py-1.5 text-[10px] font-bold ${shopCategory === cat.id ? 'bg-cyan-300 text-black' : 'bg-white/10 text-white'}`}>{cat.label_en || cat.label_fr || cat.key}</button>)}
        </div>
        <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" /><input value={shopSearch} onChange={e => setShopSearch(e.target.value)} placeholder="Search Assets Shop" className="w-full bg-black/50 py-2.5 pl-9 pr-3 text-xs text-white" /></div>
        <div className="grid max-h-[30rem] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 lg:grid-cols-6">
          {visibleShopAssets.map(asset => {
            const image = shopImages(asset)[0];
            return <div key={asset.id} className="space-y-1 border border-white/10 p-1"><Thumb image={image} label={asset.title || 'Asset'} onClick={() => addElement('product', { ...asset, selected_image: image })} /><button type="button" onClick={() => addElement('product', { ...asset, selected_image: image })} className="w-full bg-cyan-300 py-1 text-[9px] font-bold text-black">Add to Scene</button></div>;
          })}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wider text-white">Props / Products</p><div className="flex gap-2"><button type="button" onClick={() => addElement('prop')} className="bg-white/10 px-2 py-1.5 text-[10px] font-bold text-white"><Plus size={11} className="inline" /> Prop</button><button type="button" onClick={() => addElement('product')} className="bg-white/10 px-2 py-1.5 text-[10px] font-bold text-white"><Plus size={11} className="inline" /> Product</button></div></div>
        {elements.map(item => <div key={item.id} className="grid gap-2 border border-white/10 p-2 md:grid-cols-[140px_1fr_1fr_1fr_auto]">
          <div><p className="text-xs font-bold text-white">{item.label}</p><p className="text-[9px] text-white/45">{item.kind}</p></div>
          <select value={item.depth} onChange={e => updateElement(item.id, { depth: e.target.value })} className="bg-black p-2 text-xs text-white">{DEPTHS.map(v => <option key={v}>{v}</option>)}</select>
          <label className="flex items-center gap-2 bg-black p-2 text-[10px] text-white">X<input type="range" min="5" max="95" value={item.x} onChange={e => updateElement(item.id, { x: Number(e.target.value) })} className="flex-1" /></label>
          <input value={item.note} onChange={e => updateElement(item.id, { note: e.target.value })} placeholder="Placement instruction" className="bg-black p-2 text-xs text-white" />
          <button type="button" onClick={() => removeElement(item.id)} className="text-white/50"><Trash2 size={14} /></button>
        </div>)}
      </section>

      <section className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-white">Prompt</p>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} placeholder="Mood, action, lighting, camera, additional direction…" className="w-full resize-none bg-white/10 px-4 py-3 text-sm text-white" />
        <div className="flex flex-wrap gap-2">{['16:9', '4:3', '9:16', '1:1'].map(ratio => <button type="button" key={ratio} onClick={() => setAspectRatio(ratio)} className={`px-3 py-2 text-xs font-bold ${aspectRatio === ratio ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white'}`}>{ratio}</button>)}</div>
      </section>

      {error && <p className="border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-300">{error}</p>}

      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={generateMaster} disabled={generatingMaster} className="flex items-center justify-center gap-2 border border-cyan-300 py-4 text-sm font-bold text-cyan-200 disabled:opacity-40">{generatingMaster ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {masterUrl ? 'Regenerate Master Scene' : 'Generate Master Scene'}</button>
        <button type="button" onClick={renderFinal} disabled={!masterUrl || rendering} className="flex items-center justify-center gap-2 bg-cyan-300 py-4 text-sm font-bold text-black disabled:opacity-40">{rendering ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} Render Final Scene</button>
      </div>

      {masterUrl && <div><p className="mb-2 text-xs font-bold uppercase text-white">Master Scene</p><img src={masterUrl} alt="Master Scene" className="max-h-[60vh] w-full bg-black object-contain" /></div>}
      {resultUrl && !showSave && <div><p className="mb-2 text-xs font-bold uppercase text-white">Final Scene</p><img src={resultUrl} alt="Final Scene" className="max-h-[65vh] w-full bg-black object-contain" /><button type="button" onClick={() => setShowSave(true)} className="mt-2 w-full bg-yellow-400 py-3 text-sm font-bold text-black">Save to Vault</button></div>}
      {showSave && resultUrl && <SaveToVaultModal userEmail={userEmail} imageUrl={resultUrl} mediaType="image" onSaved={saved => { setShowSave(false); onDone?.(resultUrl, 'image', saved?.id); }} onClose={() => setShowSave(false)} />}
    </div>
  );
}
