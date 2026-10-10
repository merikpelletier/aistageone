import React, { useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';
import { useAiModelOptions } from '@/hooks/useAiModelOptions';
import { useAiPriceQuote } from '@/hooks/useAiPriceQuote';
import { Check, ChevronDown, ImagePlus, Loader2, Plus, ShoppingBag, Sparkles, Trash2, Upload, Users, Wand2, X } from 'lucide-react';
import { toast } from 'sonner';

const TEMPLATES = [
  { id: 'establishing', label: 'Establishing', desc: 'Introduce the location and spatial geography.', characters: 0, action: 'establishing composition, strong geography, readable foreground midground and background' },
  { id: 'dialogue', label: 'Dialogue', desc: 'Conversation with flexible character count.', characters: 2, action: 'dialogue blocking, clear eyelines, natural conversational spacing' },
  { id: 'group_dialogue', label: 'Group Scene', desc: 'Conversation, meeting or group interaction.', characters: 4, action: 'group blocking with layered depth and clear sightlines between participants' },
  { id: 'walk_run', label: 'Walk / Run', desc: 'Movement through the environment.', characters: 2, action: 'movement corridor, clear direction of travel, dynamic depth and camera path' },
  { id: 'action', label: 'Action', desc: 'Chase, confrontation or physical action.', characters: 3, action: 'dynamic action blocking, readable movement lanes, tension and spatial continuity' },
  { id: 'product', label: 'Product Placement', desc: 'Build the scene around a product or sponsor asset.', characters: 1, action: 'natural product integration, believable staging, product visible without looking pasted into the scene' },
  { id: 'custom', label: 'Custom', desc: 'Build the blocking yourself.', characters: 1, action: 'custom cinematic blocking' },
];

const POSITIONS = ['Foreground', 'Midground', 'Background'];
const ORIENTATIONS = ['Toward camera', 'Face left', 'Face right', 'Face another character', 'Back to camera', 'Three-quarter'];
const ACTIONS = ['Standing', 'Sitting', 'Walking', 'Running', 'Leaning', 'Talking', 'Holding object', 'Custom'];

const makeSlot = (index, templateId = 'custom') => ({
  id: `character-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
  label: `Character ${index + 1}`,
  asset: null,
  x: templateId === 'dialogue' ? (index === 0 ? 30 : 70) : Math.min(85, 20 + index * 18),
  y: templateId === 'walk_run' ? 60 : 58,
  depth: index > 2 ? 'Background' : 'Midground',
  scale: 100,
  orientation: templateId === 'dialogue' ? (index === 0 ? 'Face right' : 'Face left') : 'Three-quarter',
  action: templateId === 'walk_run' ? 'Walking' : templateId === 'action' ? 'Running' : 'Standing',
  note: '',
});

const makeElement = (index, kind = 'prop') => ({
  id: `element-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
  label: kind === 'product' ? `Product ${index + 1}` : `Prop ${index + 1}`,
  kind,
  asset: null,
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
      return parsed?.portrait || parsed?.front || parsed?.profile || parsed?.side || parsed?.back || null;
    } catch { return null; }
  }
  return null;
};

const assetImages = asset => [...new Set([asset?.featured_image, ...(Array.isArray(asset?.preview_images) ? asset.preview_images : [])].filter(Boolean))];

function SelectCard({ selected, image, label, onClick, compact = false }) {
  return <button type="button" onClick={onClick} className={`relative overflow-hidden border text-left transition ${compact ? 'h-20' : 'h-28'} ${selected ? 'border-[#23c7be] bg-[#23c7be]/10' : 'border-white/10 bg-white/[0.04] hover:border-white/30'}`}>
    {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 flex items-center justify-center text-white/20"><ImagePlus size={20} /></div>}
    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
    <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-2 p-2"><span className="truncate text-[10px] font-black text-white">{label}</span>{selected && <Check size={12} className="text-[#23c7be]" />}</div>
  </button>;
}

function StageMarker({ slot, selected, onSelect, onMove }) {
  const drag = useRef(null);
  const handlePointerDown = event => {
    event.preventDefault();
    drag.current = { startX: event.clientX, startY: event.clientY, x: slot.x, y: slot.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onSelect();
  };
  const handlePointerMove = event => {
    if (!drag.current) return;
    const parent = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!parent) return;
    const dx = ((event.clientX - drag.current.startX) / parent.width) * 100;
    const dy = ((event.clientY - drag.current.startY) / parent.height) * 100;
    onMove(Math.max(4, Math.min(96, drag.current.x + dx)), Math.max(8, Math.min(92, drag.current.y + dy)));
  };
  const handlePointerUp = event => { drag.current = null; event.currentTarget.releasePointerCapture?.(event.pointerId); };
  const image = slot.asset ? getCharacterImage(slot.asset) || slot.asset.selected_image || slot.asset.url : null;
  return <button type="button" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} style={{ left: `${slot.x}%`, top: `${slot.y}%`, transform: `translate(-50%,-50%) scale(${Math.max(.55, Math.min(1.35, slot.scale / 100))})` }} className={`absolute z-10 flex h-16 w-16 touch-none select-none items-center justify-center overflow-hidden border-2 bg-black/80 shadow-xl ${selected ? 'border-[#23c7be]' : 'border-white/50'}`}>
    {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <Users size={22} className="text-white/70" />}
    <span className="absolute bottom-0 left-0 right-0 bg-black/80 px-1 py-0.5 text-[8px] font-black text-white">{slot.label}</span>
  </button>;
}

export default function ComposeSceneBuilder({ userEmail, onDone }) {
  const [templateId, setTemplateId] = useState('dialogue');
  const [slots, setSlots] = useState([makeSlot(0, 'dialogue'), makeSlot(1, 'dialogue')]);
  const [elements, setElements] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [sets, setSets] = useState([]);
  const [vaultAssets, setVaultAssets] = useState([]);
  const [catalog, setCatalog] = useState([]);
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
  const [openPanel, setOpenPanel] = useState('templates');
  const [error, setError] = useState('');

  const template = TEMPLATES.find(item => item.id === templateId) || TEMPLATES[0];
  const pricingInput = useMemo(() => ({ aspect_ratio: aspectRatio, prompt: prompt || template.action }), [aspectRatio, prompt, template.action]);
  const { options: modelOptions, loading: modelsLoading } = useAiModelOptions({ service: 'replicateGenerate:compose_scene', kind: 'image', input: pricingInput });
  const effectiveModel = selectedModel || modelOptions.find(item => item.recommended)?.model_key || modelOptions[0]?.model_key || null;
  const { quote: priceQuote, loading: priceLoading } = useAiPriceQuote({ service: 'replicateGenerate:compose_scene', kind: 'image', input: pricingInput, modelKey: effectiveModel });

  useEffect(() => {
    if (!userEmail) return;
    Promise.all([
      base44.entities.CharacterSheet.filter({ user_email: userEmail }).catch(() => []),
      base44.entities.SetAsset.filter({ user_email: userEmail }).catch(() => []),
      base44.entities.VaultAsset.filter({ user_email: userEmail, media_type: 'image' }, '-created_date', 200).catch(() => []),
      supabase.from('catalog_asset').select('id,title,description,featured_image,preview_images,category_id,creator_name,tags').eq('status', 'published').order('title', { ascending: true }).limit(300).then(({ data }) => data || []).catch(() => []),
    ]).then(([chars, userSets, vault, shop]) => {
      setCharacters(chars || []); setSets(userSets || []); setVaultAssets(vault || []); setCatalog((shop || []).filter(item => assetImages(item).length));
    });
  }, [userEmail]);

  const chooseTemplate = nextId => {
    const next = TEMPLATES.find(item => item.id === nextId) || TEMPLATES[0];
    setTemplateId(next.id);
    setSlots(Array.from({ length: next.characters }, (_, index) => makeSlot(index, next.id)));
    setElements(next.id === 'product' ? [makeElement(0, 'product')] : []);
    setSelectedSlotId(null);
    setMasterUrl(null);
    setResultUrl(null);
    setError('');
  };

  const addCharacter = () => setSlots(current => [...current, makeSlot(current.length, templateId)]);
  const removeCharacter = id => setSlots(current => current.filter(slot => slot.id !== id).map((slot, index) => ({ ...slot, label: `Character ${index + 1}` })));
  const updateSlot = (id, patch) => setSlots(current => current.map(slot => slot.id === id ? { ...slot, ...patch } : slot));
  const selectedSlot = slots.find(slot => slot.id === selectedSlotId) || null;
  const setSlotAsset = character => { if (!selectedSlotId) return; updateSlot(selectedSlotId, { asset: character }); };
  const addElement = kind => setElements(current => [...current, makeElement(current.length, kind)]);
  const updateElement = (id, patch) => setElements(current => current.map(item => item.id === id ? { ...item, ...patch } : item));
  const removeElement = id => setElements(current => current.filter(item => item.id !== id));

  const blockingDescription = () => slots.map(slot => `${slot.label}: ${slot.action}, ${slot.depth}, horizontal position ${Math.round(slot.x)}%, vertical position ${Math.round(slot.y)}%, scale ${slot.scale}%, orientation ${slot.orientation}${slot.note ? `, ${slot.note}` : ''}`).join(' | ');
  const elementDescription = () => elements.map(item => `${item.label} (${item.kind}): ${item.depth}, horizontal position ${Math.round(item.x)}%, vertical position ${Math.round(item.y)}%, scale ${item.scale}%${item.note ? `, ${item.note}` : ''}`).join(' | ');

  const generateMaster = async () => {
    setGeneratingMaster(true); setError('');
    try {
      const setName = selectedSet?.name || 'a production-ready environment';
      const masterPrompt = `MASTER SCENE / BLOCKING FRAME. Scene template: ${template.label}. Purpose: ${template.action}. Build a clean cinematic composition that establishes camera angle, spatial geography and blocking positions before final identities are inserted. ${slots.length ? `Include ${slots.length} neutral non-identifiable performer placeholders. Blocking: ${blockingDescription()}.` : 'No required performer placeholders.'} ${elements.length ? `Reserve clear composition positions for these elements: ${elementDescription()}.` : ''} Environment: ${setName}. ${prompt || ''} Keep the composition readable and production practical. Do not invent recognizable celebrity faces or brands.`;
      const refs = [];
      if (selectedSet?.images?.[0]) refs.push(selectedSet.images[0]);
      if (uploadedPhoto) refs.push(uploadedPhoto);
      const res = await base44.functions.invoke('replicateGenerate', { method: 'compose_scene', prompt: masterPrompt, reference_image_urls: refs.slice(0, 3), aspect_ratio: aspectRatio, model_key: effectiveModel || undefined });
      if (!res.data?.file_url) throw new Error(res.data?.error || 'Master Scene generation failed.');
      setMasterUrl(res.data.file_url);
      toast.success('Master Scene generated');
    } catch (err) { setError(err?.response?.data?.error || err?.message || 'Master Scene generation failed.'); }
    finally { setGeneratingMaster(false); }
  };

  const renderFinal = async () => {
    if (!masterUrl) { setError('Generate the Master Scene first.'); return; }
    setRendering(true); setError('');
    try {
      let currentUrl = masterUrl;
      const setImage = selectedSet?.images?.[0];
      if (setImage) {
        const res = await base44.functions.invoke('replicateGenerate', { method: 'compose_scene', prompt: `Keep the Master Scene camera, blocking and composition unchanged. Replace the generic environment with the supplied set reference. Preserve all performer positions and empty reserved product/prop positions. ${prompt || ''}`, reference_image_urls: [currentUrl, setImage], aspect_ratio: aspectRatio, model_key: effectiveModel || undefined });
        if (res.data?.file_url) currentUrl = res.data.file_url;
      }
      for (const slot of slots) {
        const image = getCharacterImage(slot.asset);
        if (!image) continue;
        const identity = slot.asset?.character_name || slot.asset?.label || slot.label;
        const res = await base44.functions.invoke('replicateGenerate', { method: 'compose_scene', prompt: `Preserve the current scene, set, camera and every existing person. Replace only ${slot.label} at horizontal ${Math.round(slot.x)}%, vertical ${Math.round(slot.y)}%, ${slot.depth}, scale ${slot.scale}%, ${slot.orientation}, action ${slot.action} with the supplied character reference (${identity}). Preserve that character's identity and appearance. Do not move other characters or objects. ${slot.note || ''}`, reference_image_urls: [currentUrl, image], aspect_ratio: aspectRatio, model_key: effectiveModel || undefined });
        if (res.data?.file_url) currentUrl = res.data.file_url;
      }
      for (const item of elements) {
        const image = item.asset?.selected_image || item.asset?.url || assetImages(item.asset)[0];
        if (!image) continue;
        const res = await base44.functions.invoke('replicateGenerate', { method: 'compose_scene', prompt: `Preserve the current scene, camera, set and all characters. Add or replace only ${item.label} (${item.kind}) at horizontal ${Math.round(item.x)}%, vertical ${Math.round(item.y)}%, ${item.depth}, scale ${item.scale}%. Preserve the supplied object's recognizable design and proportions. Integrate it naturally into the lighting and perspective. ${item.note || ''}`, reference_image_urls: [currentUrl, image], aspect_ratio: aspectRatio, model_key: effectiveModel || undefined });
        if (res.data?.file_url) currentUrl = res.data.file_url;
      }
      setResultUrl(currentUrl); setShowSave(true);
      toast.success('Final Scene rendered');
    } catch (err) { setError(err?.response?.data?.error || err?.message || 'Final Scene generation failed.'); }
    finally { setRendering(false); }
  };

  return <div className="space-y-5 pb-28 lg:pb-32">
    <section className="space-y-2 border border-white/10 bg-[#111417] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#23c7be]">AI Model</p>
      <select value={effectiveModel || ''} onChange={event => setSelectedModel(event.target.value || null)} disabled={modelsLoading || !modelOptions.length} className="w-full border border-white/10 bg-black px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#23c7be]">
        {modelsLoading && <option value="">Loading models…</option>}
        {!modelsLoading && !modelOptions.length && <option value="">No model available</option>}
        {modelOptions.map(model => <option key={model.model_key} value={model.model_key}>{model.name || model.model_key}{model.recommended ? ' — Recommended' : ''}{model.credits ? ` — ${model.credits} credits` : ''}</option>)}
      </select>
      <div className="flex items-center justify-between text-xs text-white/55"><span>AI cost</span><span>{priceLoading ? 'Calculating…' : priceQuote?.credits ? `${priceQuote.credits} credits / generation` : 'Calculated automatically'}</span></div>
    </section>

    <section className="border border-white/10 bg-[#17191d]">
      <button type="button" onClick={() => setOpenPanel(openPanel === 'templates' ? null : 'templates')} className="flex w-full items-center justify-between p-4 text-left"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#23c7be]">1 · Scene Template</p><h3 className="mt-1 text-lg font-black text-white">{template.label}</h3></div><ChevronDown size={18} className={`text-white/60 transition ${openPanel === 'templates' ? 'rotate-180' : ''}`} /></button>
      {openPanel === 'templates' && <div className="grid gap-2 border-t border-white/10 p-4 sm:grid-cols-2 lg:grid-cols-4">{TEMPLATES.map(item => <button key={item.id} type="button" onClick={() => chooseTemplate(item.id)} className={`min-h-28 border p-3 text-left ${templateId === item.id ? 'border-[#23c7be] bg-[#23c7be]/10' : 'border-white/10 bg-black/20 hover:border-white/30'}`}><p className="font-black text-white">{item.label}</p><p className="mt-1 text-xs leading-5 text-white/45">{item.desc}</p><p className="mt-3 text-[9px] font-bold uppercase tracking-wider text-[#8ee9e4]">{item.characters ? `${item.characters}+ character slots` : 'Characters optional'}</p></button>)}</div>}
    </section>

    <section className="border border-white/10 bg-[#17191d] p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#23c7be]">2 · Master Scene</p><h3 className="mt-1 text-lg font-black text-white">Block the scene before replacing the elements</h3><p className="mt-1 text-xs text-white/45">Drag character markers to position them. This composition becomes the master frame.</p></div><button type="button" onClick={generateMaster} disabled={generatingMaster} className="flex items-center gap-2 bg-[#23c7be] px-4 py-2.5 text-xs font-black text-black disabled:opacity-50">{generatingMaster ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}GENERATE MASTER</button></div>
      <div className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
        <div className="relative aspect-video overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_50%_42%,rgba(35,199,190,.10),transparent_32%),linear-gradient(180deg,#11161a,#07090b)]">
          {masterUrl && <img src={masterUrl} alt="Master Scene" className="absolute inset-0 h-full w-full object-cover opacity-55" />}
          <div className="absolute inset-x-0 bottom-[28%] border-t border-white/10" /><div className="absolute inset-x-0 bottom-[52%] border-t border-white/10" />
          {slots.map(slot => <StageMarker key={slot.id} slot={slot} selected={selectedSlotId === slot.id} onSelect={() => setSelectedSlotId(slot.id)} onMove={(x, y) => updateSlot(slot.id, { x, y })} />)}
          {elements.map(item => <button key={item.id} type="button" style={{ left: `${item.x}%`, top: `${item.y}%`, transform: 'translate(-50%,-50%)' }} className="absolute z-10 flex h-11 w-11 items-center justify-center border-2 border-[#b9a06a] bg-black/80 text-[#b9a06a]"><ShoppingBag size={16} /></button>)}
          <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 text-[9px] font-bold text-white/55">DRAG CHARACTER MARKERS · CLICK TO EDIT</div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wider text-white/70">Characters</p><button type="button" onClick={addCharacter} className="flex items-center gap-1 border border-white/15 px-2 py-1.5 text-[10px] font-black text-white"><Plus size={11} /> ADD CHARACTER</button></div>
          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">{slots.map(slot => <div key={slot.id} className={`border p-3 ${selectedSlotId === slot.id ? 'border-[#23c7be] bg-[#23c7be]/5' : 'border-white/10 bg-black/20'}`}><div className="flex items-center gap-2"><button type="button" onClick={() => setSelectedSlotId(slot.id)} className="min-w-0 flex-1 text-left"><p className="truncate text-xs font-black text-white">{slot.asset?.character_name || slot.asset?.label || slot.label}</p><p className="text-[9px] text-white/40">X {Math.round(slot.x)} · Y {Math.round(slot.y)} · {slot.depth}</p></button><button type="button" onClick={() => removeCharacter(slot.id)} className="p-1 text-white/35 hover:text-white"><Trash2 size={13} /></button></div>{selectedSlotId === slot.id && <div className="mt-3 grid gap-2 sm:grid-cols-2"><select value={slot.depth} onChange={e => updateSlot(slot.id, { depth: e.target.value })} className="bg-black px-2 py-2 text-[10px] text-white">{POSITIONS.map(value => <option key={value}>{value}</option>)}</select><select value={slot.orientation} onChange={e => updateSlot(slot.id, { orientation: e.target.value })} className="bg-black px-2 py-2 text-[10px] text-white">{ORIENTATIONS.map(value => <option key={value}>{value}</option>)}</select><select value={slot.action} onChange={e => updateSlot(slot.id, { action: e.target.value })} className="bg-black px-2 py-2 text-[10px] text-white">{ACTIONS.map(value => <option key={value}>{value}</option>)}</select><label className="flex items-center gap-2 bg-black px-2 py-2 text-[10px] text-white">Scale<input type="range" min="55" max="145" value={slot.scale} onChange={e => updateSlot(slot.id, { scale: Number(e.target.value) })} className="min-w-0 flex-1" /></label><input value={slot.note} onChange={e => updateSlot(slot.id, { note: e.target.value })} placeholder="Pose / relation / instruction" className="bg-black px-2 py-2 text-[10px] text-white sm:col-span-2" /></div>}</div>)}</div>
        </div>
      </div>
    </section>

    <section className="border border-white/10 bg-[#17191d] p-4">
      <div className="mb-4"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#23c7be]">3 · Replace Elements</p><h3 className="mt-1 text-lg font-black text-white">Assign your real characters, set, props and products</h3><p className="mt-1 text-xs text-white/45">Select a character slot above, then choose the person who should occupy it.</p></div>
      <div className="space-y-5">
        <div><p className="mb-2 text-xs font-black uppercase tracking-wider text-white/70">Character Library {selectedSlot ? `→ ${selectedSlot.label}` : '— select a slot first'}</p><div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">{characters.map(character => <SelectCard key={character.id} selected={selectedSlot?.asset?.id === character.id} image={getCharacterImage(character)} label={character.character_name || 'Character'} onClick={() => setSlotAsset(character)} compact />)}</div></div>
        {vaultAssets.length > 0 && <div><p className="mb-2 text-xs font-black uppercase tracking-wider text-white/70">Vault Images</p><div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5 lg:grid-cols-8">{vaultAssets.slice(0, 80).map(asset => <SelectCard key={asset.id} selected={selectedSlot?.asset?.id === asset.id} image={asset.url} label={asset.name || 'Vault image'} onClick={() => setSlotAsset({ ...asset, label: asset.name || 'Vault character', character_photos: [asset.url] })} compact />)}</div></div>}
        <div><p className="mb-2 text-xs font-black uppercase tracking-wider text-white/70">Set</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">{sets.map(set => <SelectCard key={set.id} selected={selectedSet?.id === set.id} image={set.images?.[0]} label={set.name || 'Set'} onClick={() => setSelectedSet(selectedSet?.id === set.id ? null : set)} />)}</div></div>
        <div className="flex flex-wrap gap-2"><label className="flex cursor-pointer items-center gap-2 border border-white/15 bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-white"><Upload size={14} /> Upload set / master reference<input type="file" accept="image/*" className="hidden" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; const { file_url } = await base44.integrations.Core.UploadFile({ file }); setUploadedPhoto(file_url); }} /></label>{uploadedPhoto && <button type="button" onClick={() => setUploadedPhoto(null)} className="flex items-center gap-2 border border-[#23c7be]/30 px-3 py-2 text-xs text-[#8ee9e4]"><Check size={13} /> Uploaded reference <X size={12} /></button>}</div>
      </div>
    </section>

    <section className="border border-white/10 bg-[#17191d] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#23c7be]">4 · Props & Product Placement</p><p className="mt-1 text-xs text-white/45">Optional. Add as many scene elements as needed and position them independently.</p></div><div className="flex gap-2"><button type="button" onClick={() => addElement('prop')} className="border border-white/15 px-3 py-2 text-[10px] font-black text-white"><Plus size={11} className="inline" /> PROP</button><button type="button" onClick={() => addElement('product')} className="border border-[#b9a06a]/40 px-3 py-2 text-[10px] font-black text-[#d9c28e]"><Plus size={11} className="inline" /> PRODUCT</button></div></div>
      {elements.length > 0 && <div className="space-y-3">{elements.map(item => <div key={item.id} className="grid gap-2 border border-white/10 bg-black/20 p-3 md:grid-cols-[150px_1fr_1fr_1fr_auto]"><div><p className="text-xs font-black text-white">{item.label}</p><p className="text-[9px] uppercase text-[#b9a06a]">{item.kind}</p></div><select value={item.depth} onChange={e => updateElement(item.id, { depth: e.target.value })} className="bg-black px-2 py-2 text-xs text-white">{POSITIONS.map(value => <option key={value}>{value}</option>)}</select><label className="flex items-center gap-2 bg-black px-2 py-2 text-[10px] text-white">X<input type="range" min="5" max="95" value={item.x} onChange={e => updateElement(item.id, { x: Number(e.target.value) })} className="min-w-0 flex-1" /></label><input value={item.note} onChange={e => updateElement(item.id, { note: e.target.value })} placeholder="Placement instruction" className="bg-black px-3 py-2 text-xs text-white" /><button type="button" onClick={() => removeElement(item.id)} className="p-2 text-white/40 hover:text-white"><Trash2 size={14} /></button><div className="md:col-span-5"><div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-10">{catalog.slice(0, 50).map(asset => { const image = assetImages(asset)[0]; return <SelectCard key={`${item.id}-${asset.id}`} selected={item.asset?.id === asset.id} image={image} label={asset.title || 'Asset'} onClick={() => updateElement(item.id, { asset: { ...asset, selected_image: image } })} compact />; })}</div></div></div>)}</div>}
    </section>

    <section className="border border-white/10 bg-[#17191d] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#23c7be]">5 · Existing Compose Controls</p>
      <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_auto]">
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} placeholder="Mood, action, lighting, camera, additional direction…" className="w-full resize-none border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-[#23c7be]" />
        <div><p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-white/45">Aspect Ratio</p><div className="flex gap-2">{['16:9','4:3','9:16','1:1'].map(ratio => <button key={ratio} type="button" onClick={() => setAspectRatio(ratio)} className={`px-3 py-2 text-xs font-black ${aspectRatio === ratio ? 'bg-[#23c7be] text-black' : 'bg-white/10 text-white'}`}>{ratio}</button>)}</div></div>
      </div>
    </section>

    {error && <div className="border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-300">{error}</div>}
    <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={generateMaster} disabled={generatingMaster} className="flex items-center justify-center gap-2 border border-[#23c7be] bg-[#23c7be]/10 py-4 text-sm font-black text-[#8ee9e4] disabled:opacity-50">{generatingMaster ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {masterUrl ? 'REGENERATE MASTER SCENE' : 'GENERATE MASTER SCENE'}</button><button type="button" onClick={renderFinal} disabled={!masterUrl || rendering} className="flex items-center justify-center gap-2 bg-[#23c7be] py-4 text-sm font-black text-black disabled:opacity-35">{rendering ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} RENDER FINAL SCENE</button></div>
    {masterUrl && <section className="border border-white/10 bg-[#111417] p-4"><p className="mb-2 text-[10px] font-black uppercase tracking-wider text-[#23c7be]">Master Scene</p><img src={masterUrl} alt="Master Scene" className="max-h-[60vh] w-full bg-black object-contain" /></section>}
    {resultUrl && !showSave && <section className="border border-white/10 bg-[#111417] p-4"><p className="mb-2 text-[10px] font-black uppercase tracking-wider text-[#23c7be]">Final Scene</p><img src={resultUrl} alt="Final Scene" className="max-h-[65vh] w-full bg-black object-contain" /><button type="button" onClick={() => setShowSave(true)} className="mt-3 w-full bg-[#23c7be] py-3 text-sm font-black text-black">SAVE TO VAULT</button></section>}
    {showSave && resultUrl && <SaveToVaultModal userEmail={userEmail} imageUrl={resultUrl} mediaType="image" onSaved={saved => { setShowSave(false); onDone?.(resultUrl, 'image', saved?.id); }} onClose={() => setShowSave(false)} />}
  </div>;
}
