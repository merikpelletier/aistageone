import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { useAiModelOptions } from '@/hooks/useAiModelOptions';
import { useAiPriceQuote } from '@/hooks/useAiPriceQuote';

const FIELD = 'w-full min-h-10 border border-white/20 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-teal-400';
const VIEWS = ['Hero', 'Wide', 'Reverse', 'Left', 'Right', 'Detail', 'Day', 'Night'];
const getImages = images => (Array.isArray(images) ? images : []).map(image => typeof image === 'string' ? image : image?.url).filter(Boolean);
const GROUP_TAG = 'background-group-data:';
function readGroup(asset) {
  try {
    const tag = (asset.style_tags || []).find(t => typeof t === 'string' && t.startsWith(GROUP_TAG));
    return tag ? JSON.parse(decodeURIComponent(tag.slice(GROUP_TAG.length))) : {};
  } catch { return {}; }
}
const defaultPlan = { set_id: '', set_view_url: '', background_group_id: '', background_placement: '', character_ids: [], character_refs: {}, blocking: '', props: '', atmosphere: '', action: '', generated_image: '' };

export default function ScenarioSceneComposer({ episode, partKey, availableSets = [], availableCharacters = [], readOnly, onChange }) {
  const plan = { ...defaultPlan, ...(episode.scene_compositions?.[partKey] || {}) };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = availableSets.find(item => item.id === plan.set_id);
  const setData = set?.linked_set;
  const selectableViews = useMemo(() => {
    if (!set) return [];
    const main = (setData?.images || []).map((url, index) => ({ label: VIEWS[index] || 'View ' + (index + 1), url })).filter(v => v.url);
    const variants = Object.entries(setData?.reference_sheet?.view_variants || {}).flatMap(([name, value]) => value?.night ? [{ label: name + ' · Night', url: value.night }] : []);
    const zone = (setData?.reference_sheet?.zone_shots || []).flatMap(v => [
      ...(v.day ? [{ label: (v.label || 'Zone Shot') + ' · Day', url: v.day }] : []),
      ...(v.night ? [{ label: (v.label || 'Zone Shot') + ' · Night', url: v.night }] : []),
    ]);
    return [...main, ...variants, ...zone, ...(!setData ? getImages(set.reference_images).map((url, i) => ({ label: 'Pilot reference ' + (i + 1), url })) : [])];
  }, [set]);
  const { data: backgroundGroups = [] } = useQuery({
    queryKey: ['ai-pilot-scenario-background-groups'],
    queryFn: async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user?.email) return [];
      const assets = await base44.entities.VaultAsset.filter({ user_email: user.email }, '-created_date', null);
      return (assets || []).filter(a => a.asset_category === 'background_group');
    },
  });
  const group = backgroundGroups.find(a => a.id === plan.background_group_id);
  const people = availableCharacters.filter(c => plan.character_ids.includes(c.id));
  const selectedCharacterRefs = people.map(person => ({
    name: person.name, id: person.id,
    url: plan.character_refs?.[person.id] || '',
  }));
  const prompt = [
    'COMPOSE ONE PRODUCTION SCENE — not a storyboard, illustration sheet or shot list. Produce one coherent cinematic environment image.',
    'The first image is the exact existing Set camera view. It is LOCKED for architecture, furniture, geography, angle, atmosphere and light; never replace, mirror or redesign it.',
    set ? 'LOCATION: ' + set.name + '.' : '',
    plan.atmosphere ? 'ATMOSPHERE: ' + plan.atmosphere + '.' : '',
    group ? 'The next numbered reference is the six-person Background Group reference sheet. It contains BG-01 through BG-06. Introduce these as natural background actors, not as a visible grid. Do NOT copy their numerical labels into the scene. Preserve identities and wardrobe of these extras.' : '',
    group && plan.background_placement ? 'BACKGROUND EXTRAS PLACEMENT AND ACTION: ' + plan.background_placement + '.' : '',
    people.length ? 'Visible hero cast: ' + people.map(c => c.name).join(', ') + '. Each hero must match their individually selected identity/look reference. Do not swap or invent actors.' : '',
    plan.blocking ? 'HERO BLOCKING: ' + plan.blocking + '.' : '',
    plan.props ? 'PROPS AND PLACEMENT: ' + plan.props + '.' : '',
    plan.action ? 'SCENE ACTION: ' + plan.action + '.' : '',
    'Only include specified cast and extras. Preserve the set and do not create signage, labels, captions, panel borders or text.',
  ].filter(Boolean).join('\n');
  const { options: models = [], loading: modelLoading } = useAiModelOptions({
    service: 'replicateGenerate:compose_scene', kind: 'image', input: { aspect_ratio: '16:9', prompt },
  });
  const [selectedModel, setSelectedModel] = useState('');
  const modelKey = selectedModel || models.find(m => m.recommended)?.model_key || models[0]?.model_key || null;
  const { quote } = useAiPriceQuote({ service: 'replicateGenerate:compose_scene', kind: 'image', input: { aspect_ratio: '16:9', prompt }, modelKey });
  const patch = changes => onChange({ ...plan, ...changes });
  const generate = async () => {
    if (!plan.set_view_url) return setError('Select a saved camera view from the Set first.');
    if (people.some(p => !plan.character_refs?.[p.id])) return setError('Choose a specific reference for each selected hero.');
    const references = [plan.set_view_url, ...(group ? [group.url] : []), ...selectedCharacterRefs.map(p => p.url)];
    if (references.length > 3) return setError('The current image generator accepts a maximum of three references (Set + Background Group + heroes). Reduce the selection; no references will be silently omitted.');
    setError('');
    setBusy(true);
    try {
      const result = await base44.functions.invoke('replicateGenerate', {
        method: 'compose_scene', reference_image_urls: references, prompt, aspect_ratio: '16:9',
        model_key: modelKey || undefined,
      });
      if (!result.data?.file_url) throw new Error(result.data?.error || 'Scene generation failed');
      patch({ generated_image: result.data.file_url });
    } catch (e) { setError(e.message || 'Scene generation failed'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-4 border border-teal-400/25 bg-[#15191b] p-4">
    <div><h4 className="text-sm font-bold text-teal-200">Compose Scene</h4><p className="mt-1 text-xs text-white/45">Build the scene from your actual Set, supporting cast and production references. Saved compositions remain linked to this episode.</p></div>
    <label className="block space-y-1 text-xs text-white/60">Set location
      <select className={FIELD} disabled={readOnly} value={plan.set_id} onChange={e => patch({ set_id: e.target.value, set_view_url: '', generated_image: '' })}>
        <option value="">Select existing Set</option>
        {availableSets.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
      </select>
    </label>
    {!!set && <div className="space-y-2"><p className="text-xs font-bold text-white/70">Choose the exact camera view · Day / Night / Zone Shots</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {selectableViews.map(v => <button key={v.url + v.label} disabled={readOnly} type="button" onClick={() => patch({ set_view_url: v.url, generated_image: '' })}
          className={`border p-2 text-left ${plan.set_view_url === v.url ? 'border-teal-400 bg-teal-400/10' : 'border-white/15'}`}>
          <img src={v.url} alt="" className="aspect-video w-full bg-black object-contain" />
          <span className="mt-1 block text-xs text-white">{v.label}</span>
        </button>)}
      </div>
      {!selectableViews.length && <p className="text-xs text-amber-300">This Set has no accessible reference views.</p>}
    </div>}
    <label className="block space-y-1 text-xs text-white/60">Background Group · from My Vault
      <select disabled={readOnly} className={FIELD} value={plan.background_group_id} onChange={e => patch({ background_group_id: e.target.value, generated_image: '' })}>
        <option value="">No background extras</option>
        {backgroundGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
      </select>
    </label>
    {group && <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
      <img src={group.url} alt={group.name} className="w-full border border-white/10 bg-white object-contain"/>
      <div className="space-y-2">
        <p className="text-xs text-white/50">{(readGroup(group).ids || ['BG-01','BG-02','BG-03','BG-04','BG-05','BG-06']).join(' · ')}</p>
        <label className="block text-xs text-white/60">Where do the extras stand, sit, and what do they do?
          <textarea className={FIELD + ' mt-1'} rows={4} disabled={readOnly} value={plan.background_placement} onChange={e => patch({ background_placement: e.target.value })} placeholder="BG-01 and BG-02 seated by the windows; BG-03 at reception; the remaining extras walking in the background." />
        </label>
      </div>
    </div>}
    <div className="space-y-2"><p className="text-xs font-bold text-white/70">Visible principal actors · select exact looks</p>
      <div className="flex flex-wrap gap-2">
        {availableCharacters.map(person => <label key={person.id} className="flex items-center gap-2 border border-white/15 px-2 py-1.5 text-xs text-white/70">
          <input type="checkbox" disabled={readOnly} checked={plan.character_ids.includes(person.id)} onChange={e => patch({
            character_ids: e.target.checked ? [...plan.character_ids, person.id] : plan.character_ids.filter(id => id !== person.id),
          })}/>{person.name}
        </label>)}
      </div>
      {people.map(person => {
        const refs = getImages(person.reference_images);
        return <div key={person.id} className="space-y-1">
          <p className="text-xs text-white/60">{person.name} — reference look</p>
          <div className="flex flex-wrap gap-2">{refs.map((url, i) => <button key={url} type="button" disabled={readOnly} onClick={() => patch({ character_refs: { ...plan.character_refs, [person.id]: url } })}
            className={`border p-1 ${plan.character_refs[person.id] === url ? 'border-teal-400' : 'border-white/20'}`}>
            <img src={url} alt={person.name + ' reference ' + (i+1)} className="h-24 w-20 object-contain bg-black"/>
          </button>)}
          {!refs.length && <p className="text-xs text-amber-300">No saved look references in AI Pilot Characters.</p>}</div>
        </div>;
      })}
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      {[
        ['atmosphere', 'Lighting / Atmosphere', 'Describe lighting and mood only; keep Set geometry unchanged'],
        ['blocking', 'Principal actors · Positions', 'Position and eyelines for each selected hero'],
        ['props', 'Props / Objects', 'Props from the established set and placement'],
        ['action', 'Scene Action', 'What happens in this composed scene'],
      ].map(([key,label,hint]) => <label key={key} className="block text-xs text-white/60">{label}
        <textarea rows={3} disabled={readOnly} value={plan[key]} onChange={e => patch({ [key]: e.target.value })}
          placeholder={hint} className={FIELD + ' mt-1'} />
      </label>)}
    </div>
    {!!plan.generated_image && <figure><img src={plan.generated_image} alt="Composed production scene" className="w-full max-w-2xl aspect-video bg-black object-contain border border-teal-400/30"/><figcaption className="mt-1 text-xs text-white/40">Composed scene image · stored with the scenario after Save</figcaption></figure>}
    {!readOnly && <div className="flex flex-wrap items-center gap-3">
      <select value={modelKey || ''} onChange={e => setSelectedModel(e.target.value)} className={FIELD + ' max-w-xs'} disabled={modelLoading}>
        <option value="">Select image model</option>
        {models.map(m => <option key={m.model_key} value={m.model_key}>{m.name || m.model_key}</option>)}
      </select>
      <button disabled={busy || !modelKey} type="button" onClick={generate} className="border border-teal-400 bg-teal-400/20 px-4 py-2 text-xs font-bold text-teal-100 disabled:opacity-40">
        {busy ? 'COMPOSING...' : 'GENERATE COMPOSED SCENE'}{quote?.credits ? ' · ' + quote.credits + ' credits' : ''}
      </button>
    </div>}
    {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
  </div>;
}
