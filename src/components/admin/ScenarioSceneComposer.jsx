import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { useAiModelOptions } from '@/hooks/useAiModelOptions';
import { useAiPriceQuote } from '@/hooks/useAiPriceQuote';

const FIELD = 'w-full min-h-9 border border-white/20 bg-black/40 px-3 py-2 text-xs text-white';
const imageUrl = entry => typeof entry === 'string' ? entry : entry?.url || entry?.image_url || '';
export default function ScenarioSceneComposer({ shot, episode, partKey, selectedSet, visibleCharacters = [], readOnly, onShotChange }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [vaultOpen, setVaultOpen] = useState(false);
  const [folderId, setFolderId] = useState('all');
  const [search, setSearch] = useState('');
  const legacyScene = episode.scene_compositions?.[partKey] || {};
  const selectedAssets = Array.isArray(shot.vault_scene_refs) ? shot.vault_scene_refs : [];
  const { data: vault = { assets: [], folders: [] }, isLoading: loadingVault, error: vaultError } = useQuery({
    queryKey: ['ai-pilot-scene-vault-images'],
    queryFn: async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user?.email) return { assets: [], folders: [] };
      const [assets, folders] = await Promise.all([
        base44.entities.VaultAsset.filter({ user_email: user.email, media_type: 'image' }, '-created_date', null),
        base44.entities.VaultFolder.filter({ user_email: user.email }, 'order', null),
      ]);
      return { assets: (assets || []).filter(asset => asset.url), folders: folders || [] };
    },
    enabled: vaultOpen,
  });
  const visibleAssets = vault.assets.filter(asset =>
    (folderId === 'all' || (folderId === 'unfiled' ? !asset.folder_id : asset.folder_id === folderId))
    && (!search.trim() || (asset.name || '').toLowerCase().includes(search.trim().toLowerCase()))
  );
  const toggleAsset = asset => onShotChange({ vault_scene_refs: selectedAssets.some(ref => ref.id === asset.id)
    ? selectedAssets.filter(ref => ref.id !== asset.id)
    : [...selectedAssets, { id: asset.id, url: asset.url, name: asset.name || 'Vault reference', direction: '' }] });
  const updateAsset = (id, direction) => onShotChange({ vault_scene_refs: selectedAssets.map(ref => ref.id === id ? { ...ref, direction } : ref) });
  const setView = shot.set_view_reference_url || (!selectedSet?.linked_set ? imageUrl(selectedSet?.reference_images?.[0]) : '');
  const setObjects = (Array.isArray(shot.set_element_reference_urls) ? shot.set_element_reference_urls : []).filter(Boolean);
  const heroes = visibleCharacters.map(character => {
    const url = shot.character_reference_urls?.[character.id] || '';
    const image = (character.reference_images || []).find(ref => imageUrl(ref) === url);
    return { name: character.name || character.role_name, url, look: typeof image === 'string' ? '' : image?.name || '' };
  });
  const firstShot = episode.shot_plans?.[partKey]?.[0]?.id === shot.id;
  const baseImage = shot.base_scene_url || (firstShot ? legacyScene.generated_image : '') || '';
  const previewImage = shot.hero_preview_url || (firstShot ? legacyScene.hero_preview_image : '') || '';
  const sceneDescription = episode.parts?.[partKey] || '';
  const context = [
    sceneDescription && 'SCENE DESCRIPTION: ' + sceneDescription,
    'SHOT FRAMING: ' + (shot.shot_type || 'Unspecified') + '.',
    shot.set_position && 'POSITION IN SET: ' + shot.set_position + '.',
    shot.action && 'SHOT ACTION: ' + shot.action + '.',
    shot.camera && 'CAMERA AND BLOCKING: ' + shot.camera + '.',
    selectedSet && 'SET: ' + selectedSet.name + '.',
    shot.additional_scene_elements && 'ADDITIONAL SCENE ELEMENTS: ' + shot.additional_scene_elements + '.',
    shot.dialogue && 'DIALOGUE CONTEXT ONLY (do not draw text): ' + shot.dialogue + '.',
  ].filter(Boolean).join('\n');
  const setElements = selectedSet?.linked_set?.reference_sheet?.extracted_elements || [];
  const baseEntries = [
    { url: setView, label: 'SET CAMERA VIEW — authoritative framing, geography and architecture' },
    ...setObjects.map(url => ({ url, label: 'SET OBJECT — ' + (setElements.find(item => item.image_url === url)?.name || 'selected object') })),
    ...selectedAssets.filter(ref => ref.url).map(ref => ({ url: ref.url, label: 'VAULT ASSET — ' + (ref.name || 'Reference') + (ref.direction ? '; PLACEMENT / ACTION: ' + ref.direction : '') })),
  ].filter(entry => entry.url);
  const basePrompt = [
    'Generate ONE cinematic production scene image with no principal heroes visible.',
    'Use the following exact image references in order:',
    ...baseEntries.map((entry, index) => 'IMAGE ' + (index + 1) + ': ' + entry.label),
    context,
    'Lock the selected Set view. Include each selected Vault asset in its described position and role, whether a limousine, photographer, extra or prop.',
    'Leave space for the principal actors but DO NOT draw or add them, even if mentioned in the script or blocking.',
    'Do not render dialogue, captions, text, storyboard panels or labels.',
  ].filter(Boolean).join('\n');
  const previewPrompt = [
    'Generate ONE cinematic image showing the SAME scene with its selected principal actors.',
    'IMAGE 1 is the actual generated base scene. Preserve its exact camera view, setting, extras, props and lighting.',
    ...heroes.map((hero, index) => 'IMAGE ' + (index + 2) + ': ' + hero.name + ' — exact identity and wardrobe/look ' + (hero.look || 'from reference') + '.'),
    context,
    'Add only the selected heroes. Follow the recorded positions and camera directions; do not replace existing extras.',
    'Make a single seamless image, without text, labels or storyboard panels.',
  ].filter(Boolean).join('\n');
  const { options: models = [], loading: modelLoading } = useAiModelOptions({
    service: 'replicateGenerate:compose_scene', kind: 'image', input: { aspect_ratio: '16:9', prompt: basePrompt },
  });
  const modelKey = selectedModel || models.find(model => model.recommended)?.model_key || models[0]?.model_key || null;
  const { quote } = useAiPriceQuote({ service: 'replicateGenerate:compose_scene', kind: 'image', input: { aspect_ratio: '16:9', prompt: basePrompt }, modelKey });
  const generateImage = async (references, prompt) => {
    const result = await base44.functions.invoke('replicateGenerate', {
      method: 'compose_scene', reference_image_urls: references, prompt, aspect_ratio: '16:9', model_key: modelKey || undefined,
    });
    if (!result.data?.file_url) throw new Error(result.data?.error || 'Image generation failed');
    return result.data.file_url;
  };
  const generateBase = async () => {
    if (!setView) return setError('Select the Set camera view above.');
    if (!modelKey) return setError('Select an image model.');
    setError('');
    setBusy('base');
    try {
      const url = await generateImage(baseEntries.map(entry => entry.url), basePrompt);
      onShotChange({ base_scene_url: url, hero_preview_url: '' });
    } catch (e) { setError(e.message || 'Base scene generation failed'); }
    finally { setBusy(''); }
  };
  const generatePreview = async () => {
    if (!baseImage) return setError('Generate the base scene first.');
    if (!heroes.length) return setError('Select at least one character above.');
    if (heroes.some(hero => !hero.url)) return setError('Choose a look reference for every selected character above.');
    if (!modelKey) return setError('Select an image model.');
    setError('');
    setBusy('preview');
    try {
      const url = await generateImage([baseImage, ...heroes.map(hero => hero.url)], previewPrompt);
      onShotChange({ hero_preview_url: url });
    } catch (e) { setError(e.message || 'Hero preview generation failed'); }
    finally { setBusy(''); }
  };
  return <div className="space-y-3 border border-teal-400/30 bg-teal-400/[0.03] p-3">
    <div className="text-sm font-semibold text-teal-200">Scene image generators</div>
    <section className="space-y-3 border border-white/15 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-white/80">Scene references · My Vault</p>
        {!readOnly && <button type="button" onClick={() => setVaultOpen(!vaultOpen)} className="border border-teal-400/60 px-3 py-2 text-xs font-semibold text-teal-200">{vaultOpen ? 'Close Vault' : 'Add images from My Vault'}</button>}
      </div>
      <label className="block space-y-1 text-xs text-white/70">Additional scene elements / instructions
        <textarea className={FIELD + ' w-full'} rows={2} disabled={readOnly} value={shot.additional_scene_elements || ''} onChange={e => onShotChange({ additional_scene_elements: e.target.value })} placeholder="Photographers by the entrance, limousine at the curb…" />
      </label>
      {selectedAssets.length > 0 && <div className="space-y-2">
        {selectedAssets.map(ref => <div key={ref.id} className="flex items-start gap-3 border border-white/15 p-2">
          <img src={ref.url} alt={ref.name} className="h-24 w-24 shrink-0 bg-black object-contain" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-semibold text-white">{ref.name}</p>
            <textarea className={FIELD + ' w-full'} disabled={readOnly} rows={2} value={ref.direction || ''} onChange={e => updateAsset(ref.id, e.target.value)} placeholder="Where this asset appears and what it does in the scene" />
          </div>
          {!readOnly && <button type="button" onClick={() => onShotChange({ vault_scene_refs: selectedAssets.filter(item => item.id !== ref.id) })} className="border border-white/25 px-2 py-1 text-xs text-white">Remove</button>}
        </div>)}
      </div>}
      {vaultOpen && <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setFolderId('all')} className={FIELD}>All</button>
          <button type="button" onClick={() => setFolderId('unfiled')} className={FIELD}>Unfiled</button>
          {vault.folders.map(folder => <button type="button" key={folder.id} onClick={() => setFolderId(folder.id)} className={FIELD + (folderId === folder.id ? ' border-teal-400' : '')}>{folder.name}</button>)}
        </div>
        <input className={FIELD + ' w-full'} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search images, props, photographers, vehicles…" />
        {loadingVault && <p className="text-xs text-white/50">Loading Vault images…</p>}
        {vaultError && <p role="alert" className="text-xs text-red-300">Unable to load Vault: {vaultError.message}</p>}
        <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 lg:grid-cols-5">
          {visibleAssets.map(asset => {
            const checked = selectedAssets.some(ref => ref.id === asset.id);
            return <button type="button" key={asset.id} onClick={() => toggleAsset(asset)} aria-pressed={checked} className={`border p-2 text-left ${checked ? 'border-teal-400 bg-teal-400/10' : 'border-white/20'}`}>
              <img src={asset.url} alt={asset.name || 'Vault image'} className="h-28 w-full bg-black object-contain" />
              <span className="mt-1 block break-words text-xs text-white">{asset.name || 'Vault image'}{checked ? ' ✓' : ''}</span>
            </button>;
          })}
        </div>
        {!loadingVault && !vaultError && !visibleAssets.length && <p className="text-xs text-white/45">No matching images in this Vault folder.</p>}
      </div>}
    </section>
    <div className="grid gap-3 md:grid-cols-2">
      <figure className="space-y-1"><figcaption className="text-xs font-semibold text-white">Base scene · no heroes</figcaption>
        {baseImage ? <img src={baseImage} className="w-full aspect-video bg-black object-contain" alt="Base scene without heroes" /> : <div className="flex aspect-video items-center justify-center border border-white/15 text-xs text-white/40">No base image</div>}
      </figure>
      <figure className="space-y-1"><figcaption className="text-xs font-semibold text-white">Validation · with heroes</figcaption>
        {previewImage ? <img src={previewImage} className="w-full aspect-video bg-black object-contain" alt="AI-generated validation scene with heroes" /> : <div className="flex aspect-video items-center justify-center border border-white/15 text-xs text-white/40">No validation image</div>}
      </figure>
    </div>
    {!readOnly && <div className="flex flex-wrap items-center gap-2">
      <select className={FIELD + ' max-w-xs'} value={modelKey || ''} disabled={modelLoading} onChange={e => setSelectedModel(e.target.value)}>
        <option value="">Select image model</option>
        {models.map(model => <option key={model.model_key} value={model.model_key}>{model.name || model.model_key}</option>)}
      </select>
      <button type="button" className="border border-teal-400 px-3 py-2 text-xs font-semibold text-teal-200 disabled:opacity-40" disabled={!!busy || !modelKey} onClick={generateBase}>
        {busy === 'base' ? 'Generating base…' : 'Generate Base Scene'}{quote?.credits ? ' · ' + quote.credits + ' credits' : ''}
      </button>
      <button type="button" className="border border-white/30 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40" disabled={!!busy || !modelKey || !baseImage || !heroes.length} onClick={generatePreview}>
        {busy === 'preview' ? 'Generating validation…' : 'Generate Preview With Heroes'}
      </button>
    </div>}
    {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
  </div>;
}
