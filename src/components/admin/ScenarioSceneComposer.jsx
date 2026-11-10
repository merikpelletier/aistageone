import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { useAiModelOptions } from '@/hooks/useAiModelOptions';
import { useAiPriceQuote } from '@/hooks/useAiPriceQuote';

const FIELD = 'w-full min-h-9 border border-white/20 bg-black/40 px-3 py-2 text-xs text-white';
const imageUrl = entry => typeof entry === 'string' ? entry : entry?.url || entry?.image_url || '';
const BG_IDS = ['BG-01', 'BG-02', 'BG-03', 'BG-04', 'BG-05', 'BG-06'];
const ASSET_TYPES = [
  ['background_actors', 'Background actors · 6-person sheet'],
  ['prop', 'Prop / Object'],
  ['vehicle', 'Vehicle'],
  ['set_object', 'Set object'],
  ['crowd', 'Crowd'],
  ['other', 'Other image'],
];
const getActors = ref => Array.isArray(ref.actors) ? ref.actors : [];
const getActiveActors = ref => getActors(ref).filter(actor => actor.selected);
const cellIndex = id => BG_IDS.indexOf(id);
// Isolate an actual character reference rather than sending the entire 6-person sheet.
// The original sheet is never modified. If browser image access is restricted, fail
// before starting the paid model request rather than silently sending the wrong actor.
async function isolateBackgroundActor(sourceUrl, actorId) {
  const index = cellIndex(actorId);
  if (index < 0) throw new Error('Unknown background actor: ' + actorId);
  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('Cannot open background sheet to isolate ' + actorId));
    image.src = sourceUrl;
  });
  const width = image.naturalWidth / 3;
  const height = image.naturalHeight / 2;
  if (!width || !height) throw new Error('Invalid background actor sheet.');
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot isolate background actor without an image canvas.');
  ctx.drawImage(image, (index % 3) * width, Math.floor(index / 3) * height, width, height, 0, 0, canvas.width, canvas.height);
  try {
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch {
    throw new Error('The Vault image does not permit cropping. No image generation was started; save individual character references or enable image access before retrying.');
  }
}
function ActorCell({ url, actorId }) {
  const index = cellIndex(actorId);
  return <div className="relative aspect-[2/3] w-full overflow-hidden bg-white">
    <img src={url} alt={actorId} className="absolute max-w-none" style={{
      width: '300%', height: '200%', left: -(index % 3) * 100 + '%',
      top: -Math.floor(index / 3) * 100 + '%',
    }} />
  </div>;
}
export default function ScenarioSceneComposer({ shot, episode, partKey, selectedSet, visibleCharacters = [], readOnly, onShotChange }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [vaultOpen, setVaultOpen] = useState(false);
  const [folderId, setFolderId] = useState('all');
  const [search, setSearch] = useState('');
  const [placingId, setPlacingId] = useState('');
  const [composing, setComposing] = useState(false);
  const [promptError, setPromptError] = useState('');
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
  const updateSelectedAsset = (id, transform) => onShotChange({
    vault_scene_refs: selectedAssets.map(ref => ref.id === id ? transform(ref) : ref),
  });
  const toggleAsset = asset => {
    if (selectedAssets.some(ref => ref.id === asset.id)) {
      onShotChange({ vault_scene_refs: selectedAssets.filter(ref => ref.id !== asset.id) });
      if (placingId === asset.id || placingId.startsWith(asset.id + ':')) setPlacingId('');
    } else {
      const isBackground = asset.asset_category === 'background_group';
      onShotChange({ vault_scene_refs: [...selectedAssets, {
        id: asset.id, url: asset.url, name: asset.name || 'Vault reference',
        type: isBackground ? 'background_actors' : 'other',
        actors: isBackground ? BG_IDS.map(id => ({ id, selected: false, direction: '', position: null })) : [],
        direction: '',
      }] });
    }
  };
  const assetType = ref => ref.type || (ref.asset_category === 'background_group' ? 'background_actors' : 'other');
  const setType = (ref, type) => updateSelectedAsset(ref.id, previous => ({
    ...previous, type,
    actors: type === 'background_actors' && !getActors(previous).length
      ? BG_IDS.map(id => ({ id, selected: false, direction: '', position: null }))
      : getActors(previous),
  }));
  const updateAsset = (id, direction) => updateSelectedAsset(id, ref => ({ ...ref, direction }));
  const updateActor = (id, actorId, changes) => updateSelectedAsset(id, ref => ({
    ...ref, actors: BG_IDS.map(bg => {
      const previous = getActors(ref).find(actor => actor.id === bg) || { id: bg, selected: false, direction: '', position: null };
      return bg === actorId ? { ...previous, ...changes } : previous;
    }),
  }));
  const positionAsset = (key, position) => {
    const separator = key.lastIndexOf(':BG-');
    if (separator >= 0) {
      const refId = key.slice(0, separator);
      const actorId = key.slice(separator + 1);
      updateActor(refId, actorId, { position });
    } else {
      updateSelectedAsset(key, ref => ({ ...ref, position }));
    }
  };
  const positionKey = (ref, actor) => actor ? ref.id + ':' + actor.id : ref.id;
  const placementItems = selectedAssets.flatMap(ref => assetType(ref) === 'background_actors'
    ? getActiveActors(ref).map(actor => ({
      key: positionKey(ref, actor), name: actor.id + ' · ' + ref.name,
      position: actor.position, direction: actor.direction,
    }))
    : [{ key: ref.id, name: ref.name, position: ref.position, direction: ref.direction }]);
  const describePosition = position => {
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return '';
    const horizontal = position.x < 35 ? 'left' : position.x > 65 ? 'right' : 'center';
    const vertical = position.y < 35 ? 'background / upper frame' : position.y > 65 ? 'foreground / lower frame' : 'middle of the frame';
    return horizontal + ', ' + vertical + ' (frame position ' + Math.round(position.x) + '% across, ' + Math.round(position.y) + '% down)';
  };
  const clickSetPosition = event => {
    if (!placingId || readOnly) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = {
      x: Math.round(Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100))),
      y: Math.round(Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100))),
    };
    positionAsset(placingId, position);
  };
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
    shot.dialogue && 'AUTHORED DIALOGUE CONTEXT ONLY (do not draw text): ' + shot.dialogue + '.',
    shot.direction_sequence && 'ORDERED ACTION AND DIALOGUE SEQUENCE (PRODUCTION TIMING): ' + shot.direction_sequence,
  ].filter(Boolean).join('\n');
  const setElements = selectedSet?.linked_set?.reference_sheet?.extracted_elements || [];
  const baseEntries = [
    { url: setView, label: 'SET CAMERA VIEW — authoritative framing, geography and architecture' },
    ...setObjects.map(url => ({ url, label: 'SET OBJECT — ' + (setElements.find(item => item.image_url === url)?.name || 'selected object') })),
    ...selectedAssets.filter(ref => ref.url).flatMap(ref => assetType(ref) === 'background_actors'
      ? getActiveActors(ref).map(actor => ({
        url: ref.url, actorId: actor.id,
        label: 'INDIVIDUAL BACKGROUND ACTOR ' + actor.id + ' from ' + ref.name + ' (isolated source panel, not a group sheet)'
          + (actor.position ? '; POSITION: ' + describePosition(actor.position) : '')
          + (actor.direction ? '; ACTION: ' + actor.direction : ''),
      }))
      : [{ url: ref.url, label: ASSET_TYPES.find(([key]) => key === assetType(ref))?.[1] || 'Asset'
        + ' — ' + (ref.name || 'Reference')
        + (ref.position ? '; POSITION: ' + describePosition(ref.position) : '')
        + (ref.direction ? '; ACTION: ' + ref.direction : '') }]),
  ].filter(entry => entry.url);
  const suggestedBasePrompt = [
    'Generate ONE image of the selected Set camera view with only the explicitly selected background actors and scene objects, and no principal heroes.',
    'Use the following exact image references in order:',
    ...baseEntries.map((entry, index) => 'IMAGE ' + (index + 1) + ': ' + entry.label),
    context.split('\n').filter(line => !line.startsWith('ORDERED ACTION AND DIALOGUE SEQUENCE (PRODUCTION TIMING):') && !line.startsWith('SHOT FRAMING:')).join('\n'),
    'BASE IMAGE FRAMING: Keep the selected Set camera view and its original spatial composition. This base image is not a Close-Up, Medium Shot, or other hero shot type.',
    'Lock the selected Set view. Include ONLY the selected Vault assets and selected background actors, at their specified positions, with their specified actions. The Set itself may contain its existing furnishings and architecture.',
    'Do not add principal characters, even if mentioned in the script or blocking. Do not invent people or add unselected extras, bystanders, photographers, camera operators, film crew, production crew, lighting technicians, boom microphones, cameras, tripods, or filming equipment.',
    'Do not render dialogue, captions, text, storyboard panels or labels.',
  ].filter(Boolean).join('\n');
  const suggestedPreviewPrompt = [
    'Generate ONE cinematic image showing the SAME scene with its selected principal actors.',
    'IMAGE 1 is the actual generated base scene. Preserve its setting, architecture, lighting, props and spatial relationships. It establishes the viewpoint, not the final framing distance of the actors.',
    ...heroes.map((hero, index) => 'IMAGE ' + (index + 2) + ': ' + hero.name + ' — exact identity and wardrobe/look ' + (hero.look || 'from reference') + '.'),
    context,
    'Add only the selected heroes. Apply the selected shot type to the visible subjects, adjusting their on-screen scale and crop while keeping the existing set, angle and continuity. Do not replace existing extras.',
    'Make a single seamless image, without text, labels or storyboard panels.',
  ].filter(Boolean).join('\n');
  const basePrompt = typeof shot.base_image_prompt === 'string' && shot.base_image_prompt.trim() ? shot.base_image_prompt : suggestedBasePrompt;
  // The selected shot type controls the HERO preview only. Protect base-scene generation
  // even if an older saved base prompt contains instructions for the hero's framing.
  const effectiveBasePrompt = basePrompt + '\n\n' +
    'BASE SCENE ONLY: Preserve the selected Set camera view and framing. Do not apply the current shot type to this base image. Include only explicitly selected background actors and Vault assets in their directed positions. Do not add principal heroes, unselected people, production crew, film equipment or any other invented participants. Any scene context about a film production is narrative context, not permission to show a crew.';
  const previewPrompt = shot.hero_composition_prompt ?? suggestedPreviewPrompt;
  // The shot's live framing always takes priority over previously saved prompt text.
  // Never erase user-authored prompts or previously generated images when framing changes.
  const framingDirective = [
    'MANDATORY CURRENT SHOT FRAMING: ' + (shot.shot_type || 'Medium Shot') + '.',
    'SHOT TYPE sets subject scale, visible body portion, crop and composition, including Close-Up, Medium Close-Up, Wide, Two Shot, Over-the-Shoulder, POV, reaction and detail shots.',
    'SET CAMERA VIEW is the source of truth for location identity, architecture, spatial orientation, lighting and background continuity — not a requirement to preserve a wide or full-body crop.',
    'Reframe within that established view as needed for the selected shot type; do not invent a new camera angle, location, character, wardrobe or props.',
    'If saved prompt instructions conflict with this current shot type, obey the CURRENT SHOT FRAMING directive.',
  ].join('\n');
  const effectivePreviewPrompt = previewPrompt + '\n\n' + framingDirective;
  const productionTarget = shot.production_target || 'fotoplay';
  const productionPrompt = shot.production_prompt || '';
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
      const isolated = await Promise.all(baseEntries.map(async entry =>
        entry.actorId ? isolateBackgroundActor(entry.url, entry.actorId) : entry.url
      ));
      const url = await generateImage(isolated, effectiveBasePrompt);
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
      const url = await generateImage([baseImage, ...heroes.map(hero => hero.url)], effectivePreviewPrompt);
      onShotChange({ hero_preview_url: url });
      await generateProductionPrompt(url);
    } catch (e) { setError(e.message || 'Hero preview generation failed'); }
    finally { setBusy(''); }
  };
  const generateProductionPrompt = async (visualUrl = previewImage) => {
    if (!baseImage) return setPromptError('Generate the base scene first.');
    if (!heroes.length || heroes.some(hero => !hero.url)) return setPromptError('Select exact looks for the heroes first.');
    setPromptError('');
    setBusy('prompt');
    try {
      const instructions = productionTarget === 'shoot'
        ? 'Write ONE concise but detailed production-ready VIDEO GENERATION PROMPT for a Shoot clip. Preserve exact existing scene composition, selected hero looks and blocking. Specify the camera, staging, motion, action and dialogue context without embedding music. Do not invent sets, characters or wardrobe. Output ONLY the video prompt, without explanations.'
        : 'Write ONE concise but detailed production-ready IMAGE GENERATION PROMPT for FotoPlay. Preserve exact existing scene composition, character identity and wardrobe, framing, positions, action and props. No video motion, music or invented characters or sets. Output ONLY the image prompt, without explanations.';
      const { data, error: llmError } = await supabase.functions.invoke('invoke-llm', { body: {
        instructions,
        prompt: ['Destination: ' + productionTarget.toUpperCase(), 'Existing scene: ' + context, 'Base generation prompt: ' + basePrompt,
          'Hero composition: ' + effectivePreviewPrompt,
          'Selected hero references: ' + heroes.map(hero => hero.name + ' = ' + (hero.look || 'selected look') + ' (' + hero.url + ')').join(' | '),
          'Base image reference: ' + baseImage,
          visualUrl && 'Hero validation image reference: ' + visualUrl,
          'Selected set view: ' + setView,
          'Current shot framing directive: ' + framingDirective,
          'Set objects: ' + setObjects.join(', '),
          'Other Vault references: ' + baseEntries.slice(1).map(entry => entry.label + ' (' + entry.url + ')').join(' | '),
          shot.dialogue && 'Dialogue supplied by author: ' + shot.dialogue,
          shot.direction_sequence && 'AUTHOR-REVIEWED ORDER AND TIMING OF ACTION AND VOICES: ' + shot.direction_sequence,
        ].filter(Boolean).join('\n'),
      } });
      if (llmError) throw llmError;
      const response = typeof data === 'string' ? data : data?.text || data?.output;
      if (typeof response !== 'string' || !response.trim()) throw new Error('The text model returned no production prompt.');
      onShotChange({ production_prompt: response.trim(), production_target: productionTarget });
    } catch (e) { setPromptError(e.message || 'Production prompt generation failed'); }
    finally { setBusy(''); }
  };
  return <div className="space-y-3 border border-teal-400/30 bg-teal-400/[0.03] p-3">
    <div className="text-sm font-semibold text-teal-200">Scene image generators</div>
    <section className="space-y-3 border border-white/15 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-white/80">Base scene assembly · My Vault ({selectedAssets.length} sources selected)</p>
        {!readOnly && <button type="button" onClick={() => setVaultOpen(!vaultOpen)} className="border border-teal-400/60 px-3 py-2 text-xs font-semibold text-teal-200">{vaultOpen ? 'Close Vault' : 'Add images from My Vault'}</button>}
      </div>
      <label className="block space-y-1 text-xs text-white/70">Additional scene elements / instructions
        <textarea className={FIELD + ' w-full'} rows={2} disabled={readOnly} value={shot.additional_scene_elements || ''} onChange={e => onShotChange({ additional_scene_elements: e.target.value })} placeholder="Photographers by the entrance, limousine at the curb…" />
      </label>
      {!!selectedAssets.length && <div className="space-y-2 border border-white/15 p-3">
        <p className="text-xs font-semibold text-white">Visual placement on the selected Set view</p>
        <p className="text-xs text-white/55">Choose individual actors or props below. Use Place on Set and click the desired spot on the existing camera view. Positions guide the generated merge.</p>
        {setView ? <div className="relative mx-auto w-full max-w-3xl overflow-hidden border border-white/20 bg-black">
          <img src={setView} alt="Selected Set camera view for placing scene references" draggable={false} className="block w-full" />
          <div role={placingId ? 'button' : 'presentation'} tabIndex={placingId && !readOnly ? 0 : undefined} aria-label={placingId ? 'Click to place selected Vault image on the Set' : undefined}
            onClick={clickSetPosition}
            onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && placingId) { event.preventDefault(); positionAsset(placingId, { x: 50, y: 50 }); } }}
            className={`absolute inset-0 ${placingId ? 'cursor-crosshair' : 'pointer-events-none'}`}>
            {placementItems.filter(item => item.position && Number.isFinite(item.position.x) && Number.isFinite(item.position.y)).map((item, index) => <div key={item.key}
              className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded border px-1.5 py-1 text-[10px] font-bold shadow-lg ${placingId === item.key ? 'border-teal-300 bg-black/90 text-teal-200' : 'border-white/60 bg-black/80 text-white'}`}
              style={{ left: item.position.x + '%', top: item.position.y + '%' }} title={item.name + ' · ' + describePosition(item.position)}>
              <span className="rounded bg-teal-500 px-1 text-black">{index + 1}</span><span className="max-w-28 truncate">{item.name}</span>
            </div>)}
          </div>
        </div> : <p className="text-xs text-amber-300">Select a Set camera view above to position the images visually.</p>}
      </div>}
      {selectedAssets.length > 0 && <div className="space-y-2">
        {selectedAssets.map((ref, index) => <div key={ref.id} className="space-y-3 border border-white/15 p-3">
          <div className="flex flex-wrap items-start gap-3">
            <img src={ref.url} alt={ref.name} className="h-28 w-28 shrink-0 bg-black object-contain" />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-xs font-semibold text-white">{index + 1}. {ref.name}</p>
              <label className="block space-y-1 text-xs text-white/70">Image type
                <select className={FIELD + ' w-full'} value={assetType(ref)} disabled={readOnly} onChange={event => setType(ref, event.target.value)}>
                  {ASSET_TYPES.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
                </select>
              </label>
              {assetType(ref) !== 'background_actors' && <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {!readOnly && <button type="button" onClick={() => setPlacingId(placingId === ref.id ? '' : ref.id)} className={`border px-2 py-1 text-xs ${placingId === ref.id ? 'border-teal-400 text-teal-200' : 'border-white/30 text-white'}`}>{placingId === ref.id ? 'Placing…' : ref.position ? 'Move on Set' : 'Place on Set'}</button>}
                  <span className="text-[11px] text-white/50">{ref.position ? describePosition(ref.position) : 'Not positioned yet'}</span>
                </div>
                <textarea className={FIELD + ' w-full'} disabled={readOnly} rows={2} value={ref.direction || ''} onChange={event => updateAsset(ref.id, event.target.value)} placeholder="Placement and action of this asset" />
              </div>}
            </div>
            {!readOnly && <button type="button" onClick={() => {
              onShotChange({ vault_scene_refs: selectedAssets.filter(item => item.id !== ref.id) });
              if (placingId === ref.id || placingId.startsWith(ref.id + ':')) setPlacingId('');
            }} className="border border-white/25 px-2 py-1 text-xs text-white">Remove</button>}
          </div>
          {assetType(ref) === 'background_actors' && <div className="space-y-2">
            <p className="text-xs text-white/65">Choose the individual actors from this six-person sheet. Only selected figures will be isolated and sent to the scene generator.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {BG_IDS.map(id => {
                const actor = getActors(ref).find(item => item.id === id) || { id, selected: false, direction: '', position: null };
                return <div key={id} className={`space-y-2 border p-2 ${actor.selected ? 'border-teal-400/70 bg-teal-400/[0.06]' : 'border-white/15'}`}>
                  <label className="flex items-center gap-2 text-xs text-white">
                    <input type="checkbox" disabled={readOnly} checked={!!actor.selected} onChange={event => updateActor(ref.id, id, { selected: event.target.checked })} />
                    {id}
                  </label>
                  <ActorCell url={ref.url} actorId={id} />
                  {actor.selected && <div className="space-y-2">
                    <button type="button" disabled={readOnly} onClick={() => setPlacingId(placingId === positionKey(ref, actor) ? '' : positionKey(ref, actor))}
                      className={`w-full border px-2 py-1 text-xs ${placingId === positionKey(ref, actor) ? 'border-teal-400 text-teal-200' : 'border-white/30 text-white'}`}>
                      {placingId === positionKey(ref, actor) ? 'Placing…' : actor.position ? 'Move on Set' : 'Place on Set'}
                    </button>
                    <p className="text-[11px] text-white/50">{actor.position ? describePosition(actor.position) : 'Not positioned yet'}</p>
                    <textarea className={FIELD + ' w-full'} disabled={readOnly} rows={2} value={actor.direction || ''}
                      onChange={event => updateActor(ref.id, id, { direction: event.target.value })} placeholder="Action / orientation" />
                  </div>}
                </div>;
              })}
            </div>
          </div>}
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
        <p className="text-xs text-white/50">Select as many images as needed. Click a selected image again to remove it.</p>
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
    <label className="block space-y-1 text-xs text-white/70">Base scene · Image generation prompt
      <textarea className={FIELD + ' w-full'} rows={6} disabled={readOnly} value={basePrompt} onChange={e => onShotChange({ base_image_prompt: e.target.value })} />
    </label>
    <div className="grid gap-3 md:grid-cols-2">
      <figure className="space-y-1"><figcaption className="text-xs font-semibold text-white">Base scene · no heroes</figcaption>
        {baseImage ? <img src={baseImage} className="w-full aspect-video bg-black object-contain" alt="Base scene without heroes" /> : <div className="flex aspect-video items-center justify-center border border-white/15 text-xs text-white/40">No base image</div>}
      </figure>
      <figure className="space-y-1"><figcaption className="text-xs font-semibold text-white">Validation · with heroes</figcaption>
        {previewImage ? <img src={previewImage} className="w-full aspect-video bg-black object-contain" alt="AI-generated validation scene with heroes" /> : <div className="flex aspect-video items-center justify-center border border-white/15 text-xs text-white/40">No validation image</div>}
      </figure>
    </div>
    <label className="block space-y-1 text-xs text-white/70">Heroes · Composition / validation image prompt
      <textarea className={FIELD + ' w-full'} rows={5} disabled={readOnly} value={previewPrompt} onChange={e => onShotChange({ hero_composition_prompt: e.target.value })} />
    </label>
    <section className="space-y-2 border border-white/15 p-3">
      <div className="text-xs font-semibold text-white">Production prompt · for Shoot or FotoPlay</div>
      <label className="block space-y-1 text-xs text-white/70">Production tool
        <select className={FIELD} disabled={readOnly} value={productionTarget} onChange={e => onShotChange({ production_target: e.target.value, production_prompt: '' })}>
          <option value="fotoplay">FotoPlay · Image</option>
          <option value="shoot">Shoot · Video</option>
        </select>
      </label>
      <textarea className={FIELD + ' w-full'} rows={7} disabled={readOnly} value={productionPrompt} onChange={e => onShotChange({ production_prompt: e.target.value })} placeholder="Generate the production prompt from this scene and the selected heroes, then edit it here." />
      {!readOnly && <button type="button" disabled={!!busy || !baseImage || !heroes.length} onClick={() => generateProductionPrompt()} className="border border-white/30 px-3 py-2 text-xs text-white disabled:opacity-40">
        {busy === 'prompt' ? 'Generating production prompt…' : 'Generate / Update Production Prompt'}
      </button>}
      {promptError && <p role="alert" className="text-xs text-red-300">{promptError}</p>}
    </section>
    {!readOnly && <div className="flex flex-wrap items-center gap-2">
      <select className={FIELD + ' max-w-xs'} value={modelKey || ''} disabled={modelLoading} onChange={e => setSelectedModel(e.target.value)}>
        <option value="">Select image model</option>
        {models.map(model => <option key={model.model_key} value={model.model_key}>{model.name || model.model_key}</option>)}
      </select>
      <button type="button" className="border border-teal-400 px-3 py-2 text-xs font-semibold text-teal-200 disabled:opacity-40" disabled={!!busy || !modelKey} onClick={generateBase}>
        {busy === 'base' ? 'Generating base…' : 'Generate Base Scene'}{quote?.credits ? ' · ' + quote.credits + ' credits' : ''}
      </button>
      <button type="button" className="border border-white/30 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40" disabled={!!busy || !modelKey || !baseImage || !heroes.length} onClick={generatePreview}>
        {busy === 'preview' ? 'Generating hero scene and production prompt…' : 'Generate Hero Scene + Production Prompt'}
      </button>
    </div>}
    {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
  </div>;
}
