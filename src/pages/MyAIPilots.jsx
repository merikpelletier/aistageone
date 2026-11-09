import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bot, ChevronDown, ChevronLeft, ChevronUp, Loader2, Plus, Trash2, Users, MapPin, FileText, Layers, Upload, X, Music2 } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';

const EXTENSION_TYPES = [
  ['character_style', 'Character / Character Style'],
  ['look', 'Look'],
  ['set', 'Set'],
  ['location', 'Location'],
  ['music_piece', 'Music Piece'],
  ['visual_direction', 'Visual Direction'],
];

const humanize = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const isEmpty = (value) => value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0) || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value || {}).length === 0);

function ContentValue({ value }) {
  if (isEmpty(value)) return null;
  if (Array.isArray(value)) {
    return <div className="mt-2 space-y-2">{value.map((item, index) => (
      <div key={item?.id || index} className="rounded-xl border border-white/10 bg-black/40 p-3">
        {typeof item === 'object' && item !== null ? <ContentObject value={item} /> : <p className="text-sm text-white/70">{String(item)}</p>}
      </div>
    ))}</div>;
  }
  if (typeof value === 'object') return <ContentObject value={value} />;
  return <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/70">{String(value)}</p>;
}

function ContentObject({ value }) {
  return <div className="space-y-3">{Object.entries(value || {}).filter(([, entry]) => !isEmpty(entry)).map(([key, entry]) => (
    <div key={key}>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">{humanize(key)}</p>
      <ContentValue value={entry} />
    </div>
  ))}</div>;
}

function PilotLooks({ content }) {
  const looks = Array.isArray(content?.looks) ? content.looks : [];
  if (!looks.length) return <p className="text-sm text-white/45">No looks available.</p>;
  return <div className="grid gap-4 md:grid-cols-2">
    {looks.map((look, index) => {
      const images = Array.isArray(look.result_images) ? look.result_images.map((entry) => typeof entry === 'string' ? entry : entry?.url).filter(Boolean) : [];
      const details = Object.fromEntries(Object.entries(look).filter(([key, value]) => !['id', 'name', 'result_images'].includes(key) && !isEmpty(value)));
      return <div key={look.id || index} className="overflow-hidden border border-white/10 bg-[#111418]">
        <div className="border-b border-white/10 p-3"><p className="text-base font-semibold text-white">{look.name || 'Unnamed Look'}</p>{look.type && <p className="mt-1 text-xs capitalize text-[#23c7be]">{String(look.type).replaceAll('_', ' ')}</p>}</div>
        {images.length > 0 && <div className="grid grid-cols-2 gap-2 p-3">{images.map((url, i) => <a key={i} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden bg-black/50" title="Open look result"><img src={url} alt={`${look.name || 'Look'} result ${i + 1}`} className="aspect-[3/4] w-full object-contain" loading="lazy" /></a>)}</div>}
        <details className="group border-t border-white/10" open={!images.length}>
          <summary className="flex cursor-pointer list-none items-center justify-between p-3 text-sm font-semibold text-[#23c7be]">Look details <ChevronDown size={16} className="group-open:rotate-180" /></summary>
          <div className="border-t border-white/10 p-3"><ContentObject value={details} /></div>
        </details>
      </div>;
    })}
  </div>;
}


const EXTENSION_FIELDS = {
  character_style: [['role', 'Character / Role'], ['appearance', 'Visual identity / appearance'], ['personality', 'Personality & behavior'], ['wardrobe', 'Wardrobe / styling'], ['voice', 'Voice / performance direction'], ['continuity', 'Continuity rules']],
  look: [['type', 'Look type'], ['colors', 'Colors / palette'], ['costume', 'Costume / garment'], ['hair', 'Hair'], ['makeup', 'Makeup'], ['style_notes', 'Style notes']],
  set: [['location', 'Associated location'], ['environment', 'Environment / architecture'], ['lighting', 'Lighting'], ['atmosphere', 'Atmosphere'], ['continuity', 'Visual continuity']],
  location: [['environment', 'Location description'], ['time_period', 'Period / time of day'], ['atmosphere', 'Atmosphere'], ['visual_rules', 'Visual rules']],
  music_piece: [['genre', 'Genre / style'], ['tempo', 'Tempo / rhythm'], ['mood', 'Mood'], ['instrumentation', 'Instrumentation'], ['lyrics', 'Lyrics / vocal direction']],
  visual_direction: [['style', 'Visual style'], ['camera', 'Camera / framing'], ['lighting', 'Lighting'], ['composition', 'Composition'], ['constraints', 'Continuity constraints']],
};
const ACCEPTED_PILOT_MEDIA = 'image/*,video/*,audio/*';
const PILOT_FILE_LIMIT = 50 * 1024 * 1024;
function AdditionMedia({ items = [] }) {
  if (!Array.isArray(items) || !items.length) return null;
  return <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
    {items.map((item, index) => {
      const url = typeof item === 'string' ? item : item?.url;
      const kind = item?.type || 'image';
      if (!url) return null;
      return <div key={index} className="min-w-0 overflow-hidden border border-white/10 bg-black/30">
        {kind === 'video' ? <video src={url} controls preload="metadata" className="aspect-video w-full object-contain" /> :
          kind === 'audio' ? <div className="p-3"><Music2 size={20} className="mb-2 text-[#23c7be]" /><audio src={url} controls className="w-full" /></div> :
          <a href={url} target="_blank" rel="noreferrer" title="Open full image"><img src={url} alt={item?.name || 'AI Pilot reference'} loading="lazy" className="aspect-[3/4] w-full object-cover" /></a>}
        <p className="truncate px-2 py-1.5 text-xs text-white/55">{item?.name || 'Reference media'}</p>
      </div>;
    })}
  </div>;
}

const FORMAT_GUIDANCE = {
  fotoplay: 'FotoPlay · Nine visual/dialogue segments per chapter. The nine-season-chapter structure is separate from the nine segments inside each FotoPlay chapter.',
  audio: 'Audio drama · Adapt the episode to narration, voices, music and sound effects. No fixed duration is imposed.',
  ebook: 'E-book · Adapt the episode into written scenes or chapters, with optional illustrations. No fixed duration is imposed.',
  video: 'Video · Aim for 120 seconds per episode, divided into four publishable 30-second parts. Shoot and Timeline can extend the final runtime. Budget for newly generated AI footage independently of total timeline length.',
};
const VIDEO_PART_LABELS = [['setup','0–30s · Setup'], ['development','30–60s · Development'], ['turn','60–90s · Turning point'], ['hook','90–120s · Hook']];

function ScenarioGuide({ content, sets = [], extensions = [], userSets = [], onSaveShotReferences, savingShot = '' }) {
  const [format, setFormat] = useState('fotoplay');
  const episodes = Array.from({ length: 9 }, (_, index) => (Array.isArray(content?.scenarios) ? content.scenarios[index] : null) || {});
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-white/10 p-2"><div className="text-xl font-bold text-white">9</div><div className="text-[11px] text-white/45">Episodes / chapters</div></div>
        <div className="rounded-lg border border-white/10 p-2"><div className="text-xl font-bold text-white">120s</div><div className="text-[11px] text-white/45">Video episode target</div></div>
        <div className="rounded-lg border border-white/10 p-2"><div className="text-xl font-bold text-white">4 × 30s</div><div className="text-[11px] text-white/45">Video shorts</div></div>
      </div>
      {content?.creative_brief && <div><div className="text-xs font-bold text-cyan-300">Season theme / Creative brief</div><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/75">{content.creative_brief}</p></div>}
      <label className="block space-y-2">
        <span className="text-xs font-bold text-white/70">Choose a production format to view guidance</span>
        <select className="w-full rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-white" value={format} onChange={(event) => setFormat(event.target.value)}>
          <option value="fotoplay">FotoPlay</option>
          <option value="audio">Audio drama</option>
          <option value="ebook">E-book</option>
          <option value="video">Video (Shoot / Timeline)</option>
        </select>
      </label>
      <p className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-3 text-sm leading-relaxed text-white/70">{FORMAT_GUIDANCE[format]}</p>
      <div className="space-y-2">
        {episodes.map((episode,index) => (
          <details key={episode.id || index} className="rounded-lg border border-white/10 bg-black/30 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-white">Episode {index + 1}{episode.title ? ` · ${episode.title}` : ''}</summary>
            <div className="mt-3 space-y-3">
              {episode.premise && <div><p className="text-xs font-bold text-white/50">Premise / conflict</p><p className="mt-1 whitespace-pre-wrap text-sm text-white/75">{episode.premise}</p></div>}
              {episode.outline && <div><p className="text-xs font-bold text-white/50">Story development</p><p className="mt-1 whitespace-pre-wrap text-sm text-white/75">{episode.outline}</p></div>}
              <div className="space-y-2">
                <p className="text-xs font-bold text-cyan-300">Episode structure</p>
                {VIDEO_PART_LABELS.map(([key, label]) => (
                  <div key={key} className="border-l-2 border-cyan-400/30 pl-3">
                    <div className="text-xs font-semibold text-white/70">{format === 'video' ? label : label.split(' · ')[1]}</div>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-white/60">{episode.parts?.[key] || 'Develop this part from the episode premise and story direction.'}</p>
                  </div>
                ))}
              </div>
              {format === 'video' && VIDEO_PART_LABELS.map(([partKey]) => (episode.shot_plans?.[partKey] || []).map((shot, index) => {
                const resources = episode.scene_resources?.[partKey] || {};
                const eligible = sets.filter(set => (resources.set_ids || []).includes(set.id));
                const selected = eligible.find(set => set.id === shot.set_id) || (eligible.length === 1 ? eligible[0] : null);
                const memberLink = extensions.find(entry => entry.extension_type === 'set' && entry.operation === 'replace' && entry.target_item_id === selected?.id);
                const resolved = userSets.find(project => project.id === memberLink?.content?.my_set_id) || userSets.find(project => project.id === selected?.my_set_id);
                const shotItems = (resolved?.reference_sheet?.extracted_elements || []).filter(item => item.image_url);
                const override = extensions.find(entry => entry.extension_type === 'set_reference' && entry.target_item_id === shot.id);
                const urls = Array.isArray(override?.content?.reference_urls) ? override.content.reference_urls : (shot.set_element_reference_urls || []);
                return <div key={shot.id || index} className="mt-2 space-y-2 border border-white/10 bg-white/[0.02] p-3">
                  <div className="text-xs font-semibold text-white">Shot {index+1} · {shot.shot_type || 'Shot'}{selected?.name ? ` · ${selected.name}` : ''}</div>
                  {shot.action && <p className="text-xs text-white/60">{shot.action}</p>}
                  {shotItems.length ? <>
                    <p className="text-[11px] text-white/45">Select visual references from your linked My Set. Saved only for your AI Pilot.</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{shotItems.map(item => {
                      const checked = urls.includes(item.image_url);
                      return <label key={item.id || item.image_url} className={`cursor-pointer border p-2 ${checked ? 'border-[#23c7be]' : 'border-white/15'}`}>
                        <input type="checkbox" checked={checked} disabled={savingShot === shot.id} onChange={event => {
                          const next = event.target.checked ? [...urls,item.image_url] : urls.filter(url => url !== item.image_url);
                          onSaveShotReferences(shot.id, selected.id, [...new Set(next)]);
                        }} />
                        <img src={item.image_url} alt={item.name || 'Reference'} className="mt-2 h-20 w-full bg-black object-contain" />
                        <span className="block truncate text-[11px] text-white/70">{item.name || 'Reference'}</span>
                      </label>;
                    })}</div>
                  </> : <p className="text-[11px] text-white/40">To select shot references, connect a My Set with a saved Reference Sheet in Sets & Locations.</p>}
                </div>;
              }))}
              {format === 'fotoplay' && <p className="text-xs text-white/50">Develop this chapter across nine FotoPlay segments, following the episode direction above.</p>}
              {episode.scene_ideas && <div><p className="text-xs font-bold text-white/50">Scene inspirations</p><p className="mt-1 whitespace-pre-wrap text-sm text-white/70">{episode.scene_ideas}</p></div>}
              {episode.creative_options && <div><p className="text-xs font-bold text-white/50">Creative variations</p><p className="mt-1 whitespace-pre-wrap text-sm text-white/70">{episode.creative_options}</p></div>}
              {!episode.title && !episode.premise && !episode.outline && <p className="text-xs text-white/35">No specific story direction has been provided for this episode yet.</p>}
            </div>
          </details>
        ))}
      </div>
      {content?.creative_freedom && <div><div className="text-xs font-bold text-cyan-300">Freedom to create</div><p className="mt-2 whitespace-pre-wrap text-sm text-white/70">{content.creative_freedom}</p></div>}
      <p className="text-xs text-white/35">This format choice changes the guidance displayed here; it does not generate content or charge credits.</p>
    </div>
  );
}

function PilotDetails({ access, user, onMessage, userSets = [] }) {
  const queryClient = useQueryClient();
  const emptyDraft = () => ({ extension_type: 'character_style', name: '', description: '', notes: '', details: {} });
  const [draft, setDraft] = useState(emptyDraft);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  const [savingSet, setSavingSet] = useState('');
  const [savingShot, setSavingShot] = useState('');
  const saveSetLink = async (setId, mySetId) => {
    setSavingSet(setId);
    try {
      const previous = (access.extensions || []).find(entry => entry.extension_type === 'set' && entry.operation === 'replace' && entry.target_item_id === setId);
      if (previous) {
        const { error } = await supabase.from('member_ai_pilot_extensions').update({
          content: { ...(previous.content || {}), my_set_id: mySetId },
          is_active: true,
        }).eq('id', previous.id).eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('member_ai_pilot_extensions').insert({
          member_ai_pilot_id: access.id, user_id: user.id,
          extension_type: 'set', operation: 'replace', target_item_id: setId,
          name: 'My Set Link', content: { my_set_id: mySetId },
        });
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ['my-ai-pilots', user.id] });
      onMessage('Personal Set link saved.');
    } catch (error) { onMessage(error.message || 'Could not link My Set.'); }
    finally { setSavingSet(''); }
  };

  const saveShotReferences = async (shotId, setId, urls) => {
    setSavingShot(shotId);
    try {
      const previous = (access.extensions || []).find(entry => entry.extension_type === 'set_reference' && entry.target_item_id === shotId);
      const payload = { source_set_id: setId, reference_urls: urls };
      if (previous) {
        const { error } = await supabase.from('member_ai_pilot_extensions').update({ content: payload })
          .eq('id', previous.id).eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('member_ai_pilot_extensions').insert({
          member_ai_pilot_id: access.id, user_id: user.id,
          extension_type: 'set_reference', operation: 'replace', target_item_id: shotId,
          name: 'Shot Set References', content: payload,
        });
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ['my-ai-pilots', user.id] });
    } catch (error) { onMessage(error.message || 'Could not save shot references.'); }
    finally { setSavingShot(''); }
  };


  const addMutation = useMutation({
    mutationFn: async () => {
      if (!draft.name.trim()) throw new Error('Add a name first.');
      setUploading(Boolean(files.length));
      try {
        const media = [];
        for (const file of files) {
          if (!/^(image|video|audio)\//.test(file.type)) throw new Error('Only images, video and audio files are supported.');
          if (file.size > PILOT_FILE_LIMIT) throw new Error('Each media file must be 50 MB or smaller.');
          const base = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0,70) || 'media';
          const extension = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
          const path = user.id + '/ai-pilots/member-additions/' + access.id + '/' + Date.now() + '-' + crypto.randomUUID() + '-' + base + '.' + extension;
          const { error: uploadError } = await supabase.storage.from('media').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
          if (uploadError) throw uploadError;
          const { data } = supabase.storage.from('media').getPublicUrl(path);
          if (!data?.publicUrl) throw new Error('Unable to obtain media URL.');
          media.push({ name: file.name, url: data.publicUrl, type: file.type.split('/')[0], mime_type: file.type });
        }
        const { error } = await supabase.from('member_ai_pilot_extensions').insert({
          member_ai_pilot_id: access.id,
          user_id: user.id,
          extension_type: draft.extension_type,
          name: draft.name.trim(),
          content: { description: draft.description.trim(), notes: draft.notes.trim(), ...draft.details, media },
          operation: 'add',
        });
        if (error) throw error;
      } finally {
        setUploading(false);
      }
    },
    onSuccess: async () => {
      setDraft(emptyDraft());
      setFiles([]);
      onMessage('Personal addition saved.');
      await queryClient.invalidateQueries({ queryKey: ['my-ai-pilots', user.id] });
    },
    onError: (error) => onMessage(error?.message || 'Unable to save this addition.'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('member_ai_pilot_extensions').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      onMessage('Personal addition removed.');
      await queryClient.invalidateQueries({ queryKey: ['my-ai-pilots', user.id] });
    },
    onError: (error) => onMessage(error?.message || 'Unable to remove this addition.'),
  });


  const blocks = access.blocks || [];
  const characters = access.characters || [];
  const series = blocks.find((item) => item.block_key === 'series-direction')?.content || {};
  const locations = Array.isArray(series.locations) ? series.locations : [];
  const sets = Array.isArray(series.sets) ? series.sets : [];
  const tabs = [
    ['overview', 'Overview', FileText],
    ['scenario', 'Scenario', FileText],
    ['characters', 'Characters', Users],
    ['sets', 'Sets & Locations', MapPin],
    ['direction', 'Creative Direction', Layers],
    ['additions', 'My Additions', Plus],
  ];
  const scenarioBlocks = blocks.filter((item) => item.block_key === 'scenario');
  const directionBlocks = blocks.filter((item) => !['series-direction', 'scenario'].includes(item.block_key));
  const renderBlocks = (items) => items.length ? items.map((block) => (
    <details key={block.id} className="group border border-white/10 bg-[#171b20]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-semibold text-white hover:bg-white/[0.04]">
        {block.title || humanize(block.block_key)}<ChevronDown size={16} className="text-[#23c7be] group-open:rotate-180" />
      </summary>
      <div className="border-t border-white/10 p-4">{block.block_key === 'scenario' ? <ScenarioGuide content={block.content || {}} sets={sets} extensions={access.extensions || []} userSets={userSets} onSaveShotReferences={saveShotReferences} savingShot={savingShot} /> : block.block_key === 'looks' ? <PilotLooks content={block.content || {}} /> : <ContentObject value={block.content || {}} />}</div>
    </details>
  )) : <p className="py-8 text-sm text-white/45">No direction available in this section.</p>;
  return (
    <div className="mt-5 border-t border-white/10 pt-5">
      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => setActiveSection(id)} className={`inline-flex items-center gap-2 border px-3 py-2.5 text-xs font-semibold transition-colors ${activeSection === id ? 'border-[#23c7be] bg-[#23c7be]/10 text-[#23c7be]' : 'border-white/10 bg-white/[0.03] text-white/65 hover:border-white/25 hover:text-white'}`}><Icon size={15} />{label}</button>)}
      </div>
      <div className="min-h-[160px] max-w-5xl">
        {activeSection === 'overview' && <div className="space-y-3">{access.pilot?.description && <div className="border border-white/10 bg-[#171b20] p-4"><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#23c7be]">Series Overview</p><p className="whitespace-pre-wrap text-sm leading-relaxed text-white/75">{access.pilot.description}</p></div>}</div>}
        {activeSection === 'scenario' && <div className="space-y-3">{renderBlocks(scenarioBlocks)}</div>}
        {activeSection === 'characters' && <div className="grid gap-3 md:grid-cols-2">{characters.length ? characters.map((character) => <details key={character.id} className="group border border-white/10 bg-[#171b20] p-4"><summary className="flex cursor-pointer list-none items-center gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden bg-black/40">{(character.reference_images || []).length ? <img src={typeof character.reference_images[0] === 'string' ? character.reference_images[0] : character.reference_images[0]?.url} alt="" className="h-full w-full object-cover" /> : <Users size={20} className="text-white/30" />}</div><div className="min-w-0 flex-1"><p className="font-semibold text-white">{character.role_name}</p><p className="line-clamp-1 text-xs text-white/45">{character.narrative_function || character.description}</p></div><ChevronDown size={15} className="text-[#23c7be] group-open:rotate-180" /></summary><div className="mt-3 border-t border-white/10 pt-3"><ContentObject value={{ description: character.description, narrative_function: character.narrative_function, personality: character.personality, behavior: character.behavior, visual_identity: character.visual_identity, wardrobe_look: character.wardrobe_look, continuity_locks: character.continuity_locks, production_notes: character.production_notes }} /></div></details>) : <p className="text-sm text-white/45">No characters in this Pilot.</p>}</div>}
        {activeSection === 'sets' && <div className="grid gap-4 lg:grid-cols-2"><div><p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#23c7be]">Locations · {locations.length}</p><div className="space-y-2">{locations.map((location) => <details key={location.id} className="border border-white/10 bg-[#171b20] p-3"><summary className="cursor-pointer text-sm font-semibold text-white">{location.name}</summary><p className="mt-2 whitespace-pre-wrap text-sm text-white/65">{location.description}</p></details>)}{!locations.length && <p className="text-sm text-white/45">No locations added.</p>}</div></div><div><p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#23c7be]">Sets · {sets.length}</p><div className="space-y-2">{sets.map((set) => {
                const override = (access.extensions || []).find(entry => entry.extension_type === 'set' && entry.operation === 'replace' && entry.target_item_id === set.id);
                const linkedId = override?.content?.my_set_id ?? set.my_set_id ?? '';
                const linked = userSets.find(item => item.id === linkedId);
                const sheetItems = (linked?.reference_sheet?.extracted_elements || []).filter(item => item.image_url);
                return <details key={set.id} className="border border-white/10 bg-[#171b20] p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-white">{set.name}</summary>
                  {set.description && <p className="mt-2 whitespace-pre-wrap text-sm text-white/65">{set.description}</p>}
                  <label className="mt-3 block text-xs text-white/65">My Set for this AI Pilot
                    <select value={linkedId && userSets.some(item => item.id === linkedId) ? linkedId : ''}
                      disabled={savingSet === set.id}
                      onChange={event => saveSetLink(set.id, event.target.value)}
                      className="mt-2 w-full border border-white/20 bg-[#151719] p-2 text-sm text-white">
                      <option value="">No personal Set linked</option>
                      {userSets.map(item => <option key={item.id} value={item.id}>{item.name || 'Unnamed Set'}</option>)}
                    </select>
                  </label>
                  {linked ? <div className="mt-3 space-y-2">
                    <p className="text-xs text-[#23c7be]">My Sets · {linked.name} · {sheetItems.length} reference elements</p>
                    {!!sheetItems.length && <div className="grid grid-cols-2 gap-2">{sheetItems.map((item,index) =>
                      <div key={item.id || index} className="border border-white/10 bg-black p-2"><img src={item.image_url} alt={item.name} className="h-24 w-full object-contain" /><p className="mt-1 truncate text-[11px] text-white/65">{item.name}</p></div>)}</div>}
                  </div> : <p className="mt-2 text-[11px] text-white/45">Connect a Set from My Sets to use your personal Reference Sheet. The published AI Pilot remains unchanged.</p>}
                  {Array.isArray(set.reference_images) && set.reference_images.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{set.reference_images.map((image,index) =>
                    <img key={index} src={typeof image === 'string' ? image : image?.url} alt="Original AI Pilot set" className="h-20 w-28 object-contain bg-black" />)}</div>}
                </details>;
              })}{!sets.length && <p className="text-sm text-white/45">No sets added.</p>}</div></div></div>}
        {activeSection === 'direction' && <div className="space-y-3">{renderBlocks(directionBlocks)}</div>}
        {activeSection === 'additions' && <div className="max-w-5xl space-y-5">
          <div><h3 className="text-lg font-semibold text-white">My Additions</h3><p className="mt-1 text-sm text-white/50">Your personal characters, sets and directions do not change the published AI Pilot.</p></div>
          <div className="grid gap-3 lg:grid-cols-2">
            {(access.extensions || []).map((extension) => {
              const content = extension.content || {};
              const { media, description, notes, ...details } = content;
              return <div key={extension.id} className="border border-white/10 bg-[#171b20] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="text-xs uppercase tracking-wider text-[#23c7be]">{humanize(extension.extension_type)}</p><h4 className="mt-1 font-semibold text-white">{extension.name}</h4></div>
                  <button type="button" onClick={() => { if (window.confirm('Remove this personal addition?')) deleteMutation.mutate(extension.id); }} disabled={deleteMutation.isPending} className="text-red-300 hover:text-red-200" aria-label={'Remove ' + extension.name}><Trash2 size={16} /></button>
                </div>
                <AdditionMedia items={media} />
                <div className="mt-3 space-y-2 text-sm text-white/70">
                  {description && <p className="whitespace-pre-wrap">{description}</p>}
                  {(notes || Object.values(details).some(Boolean)) && <details className="border-t border-white/10 pt-3"><summary className="cursor-pointer text-xs font-semibold text-[#23c7be]">View production details</summary><div className="mt-3"><ContentObject value={{ ...details, notes }} /></div></details>}
                </div>
              </div>;
            })}
          </div>
          {!(access.extensions || []).length && <p className="text-sm text-white/45">No personal additions yet.</p>}
          <div className="space-y-4 border border-[#23c7be]/25 bg-[#111b1e] p-4 sm:p-5">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-[#23c7be]">Add to My AI Pilot</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2"><span className="text-xs font-semibold text-white/65">Addition type</span>
                <select value={draft.extension_type} onChange={(event) => setDraft((current) => ({ ...current, extension_type: event.target.value, details: {} }))} className="w-full border border-white/20 bg-[#15191e] px-3 py-3 text-sm text-white">
                  {EXTENSION_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="block space-y-2"><span className="text-xs font-semibold text-white/65">Name *</span>
                <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Name your addition" className="w-full border border-white/20 bg-[#15191e] px-3 py-3 text-sm text-white placeholder:text-white/35" />
              </label>
            </div>
            <label className="block space-y-2"><span className="text-xs font-semibold text-white/65">Description</span><textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} rows={3} placeholder="Describe this character, set or production element" className="w-full border border-white/20 bg-[#15191e] px-3 py-3 text-sm text-white" /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              {(EXTENSION_FIELDS[draft.extension_type] || []).map(([key, label]) => <label key={key} className="block space-y-2"><span className="text-xs font-semibold text-white/65">{label}</span><textarea value={draft.details[key] || ''} onChange={(event) => setDraft((current) => ({ ...current, details: { ...current.details, [key]: event.target.value } }))} rows={2} className="w-full border border-white/20 bg-[#15191e] px-3 py-3 text-sm text-white" /></label>)}
            </div>
            <label className="block space-y-2"><span className="text-xs font-semibold text-white/65">Direction / notes for AI tools</span><textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} rows={3} placeholder="How should the AI use this addition?" className="w-full border border-white/20 bg-[#15191e] px-3 py-3 text-sm text-white" /></label>
            <div className="border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="text-sm font-semibold text-white">Reference media</p><p className="mt-1 text-xs text-white/50">Images, video or audio — especially for characters and sets. Maximum 50 MB per file.</p></div>
                <label className="inline-flex cursor-pointer items-center gap-2 border border-white/20 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"><Upload size={16}/> Add media
                  <input type="file" className="hidden" accept={ACCEPTED_PILOT_MEDIA} multiple disabled={uploading || addMutation.isPending} onChange={(event) => { const incoming = Array.from(event.target.files || []); event.target.value = ''; if (incoming.some((file) => !/^(image|video|audio)\//.test(file.type) || file.size > PILOT_FILE_LIMIT)) { onMessage('Use image, video or audio files, maximum 50 MB each.'); return; } setFiles((current) => [...current, ...incoming]); }} />
                </label>
              </div>
              {files.length > 0 && <div className="mt-3 space-y-2">{files.map((file, index) => <div key={index} className="flex items-center justify-between gap-2 border border-white/10 bg-black/30 px-3 py-2 text-xs"><span className="min-w-0 truncate text-white/70">{file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB</span><button type="button" aria-label={'Remove ' + file.name} onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} className="shrink-0 text-white/55 hover:text-white"><X size={15} /></button></div>)}</div>}
            </div>
            <Button type="button" onClick={() => addMutation.mutate()} disabled={addMutation.isPending || uploading || !draft.name.trim()} className="w-full bg-[#23c7be] text-black hover:bg-[#23c7be]/85"><Plus size={16} className="mr-2"/>{addMutation.isPending ? 'Saving addition…' : 'Add to My AI Pilot'}</Button>
          </div>
        </div>}
      </div>
    </div>
  );
}

export default function MyAIPilots({ embedded = false }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoadingAuth } = useAuth();
  const [expanded, setExpanded] = useState({});
  const [message, setMessage] = useState('');

  const { data: library = [], isLoading: libraryLoading, error: libraryError } = useQuery({
    queryKey: ['my-ai-pilots', user?.id],
    enabled: Boolean(user?.id),
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    queryFn: async () => {
      const { data: accessRows, error: accessError } = await supabase.from('member_ai_pilots').select('*').eq('user_id', user.id).order('granted_at', { ascending: false });
      if (accessError) throw accessError;
      if (!accessRows?.length) return [];

      const pilotIds = [...new Set(accessRows.map((row) => row.ai_pilot_id).filter(Boolean))];
      const memberIds = accessRows.map((row) => row.id);
      const assetIds = [...new Set(accessRows.map((row) => row.source_asset_id).filter(Boolean))];

      const [pilotsResult, versionsResult, extensionsResult, assetsResult] = await Promise.all([
        supabase.from('ai_pilots').select('*').in('id', pilotIds),
        supabase.from('ai_pilot_versions').select('*').in('ai_pilot_id', pilotIds).eq('is_published', true).order('version_number', { ascending: false }),
        supabase.from('member_ai_pilot_extensions').select('*').in('member_ai_pilot_id', memberIds).eq('is_active', true).order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
        assetIds.length ? supabase.from('catalog_asset').select('id,title,description,featured_image,preview_images,creator_name,tags').in('id', assetIds) : Promise.resolve({ data: [], error: null }),
      ]);
      for (const result of [pilotsResult, versionsResult, extensionsResult, assetsResult]) if (result.error) throw result.error;

      const latestPublishedByPilot = new Map();
      (versionsResult.data || []).forEach((version) => {
        if (!latestPublishedByPilot.has(version.ai_pilot_id)) latestPublishedByPilot.set(version.ai_pilot_id, version);
      });
      const versionMap = new Map((versionsResult.data || []).map((version) => [version.id, version]));
      const resolvedVersionIds = [...new Set(accessRows.map((access) => latestPublishedByPilot.get(access.ai_pilot_id)?.id || access.version_id).filter(Boolean))];
      const [blocksResult, charactersResult] = await Promise.all([
        resolvedVersionIds.length ? supabase.from('ai_pilot_blocks').select('*').in('version_id', resolvedVersionIds).eq('is_active', true).order('sort_order', { ascending: true }) : Promise.resolve({ data: [], error: null }),
        resolvedVersionIds.length ? supabase.from('ai_pilot_characters').select('*').in('version_id', resolvedVersionIds).eq('is_active', true).order('sort_order', { ascending: true }) : Promise.resolve({ data: [], error: null }),
      ]);
      if (blocksResult.error) throw blocksResult.error;
      if (charactersResult.error) throw charactersResult.error;

      const pilotMap = new Map((pilotsResult.data || []).map((pilot) => [pilot.id, pilot]));
      const assetMap = new Map((assetsResult.data || []).map((asset) => [String(asset.id), asset]));
      const blocksByVersion = new Map();
      (blocksResult.data || []).forEach((block) => { if (!blocksByVersion.has(block.version_id)) blocksByVersion.set(block.version_id, []); blocksByVersion.get(block.version_id).push(block); });
      const charactersByVersion = new Map();
      (charactersResult.data || []).forEach((character) => { if (!charactersByVersion.has(character.version_id)) charactersByVersion.set(character.version_id, []); charactersByVersion.get(character.version_id).push(character); });
      const extensionsByMember = new Map();
      (extensionsResult.data || []).forEach((extension) => { if (!extensionsByMember.has(extension.member_ai_pilot_id)) extensionsByMember.set(extension.member_ai_pilot_id, []); extensionsByMember.get(extension.member_ai_pilot_id).push(extension); });

      return accessRows.map((access) => {
        const resolvedVersion = latestPublishedByPilot.get(access.ai_pilot_id) || versionMap.get(access.version_id) || null;
        const resolvedVersionId = resolvedVersion?.id || access.version_id;
        return {
          ...access,
          version_id: resolvedVersionId,
          pilot: pilotMap.get(access.ai_pilot_id) || null,
          version: resolvedVersion,
          presentation: assetMap.get(String(access.source_asset_id)) || null,
          blocks: blocksByVersion.get(resolvedVersionId) || [],
          characters: charactersByVersion.get(resolvedVersionId) || [],
          extensions: extensionsByMember.get(access.id) || [],
        };
      });
    },
  });

  const { data: mySets = [] } = useQuery({
    queryKey: ['my-ai-pilots-my-sets', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from('set_designer_project')
        .select('id,name,description,images,reference_sheet,updated_date')
        .eq('created_by_id', user.id)
        .order('updated_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchOnWindowFocus: true,
  });

  if (isLoadingAuth || libraryLoading) return <div className={`${embedded ? 'min-h-full' : 'min-h-screen'} bg-black flex items-center justify-center`}><Loader2 className="animate-spin text-white" size={34} /></div>;

  return (
    <div className={`${embedded ? 'min-h-full' : 'min-h-screen'} bg-black pb-20 text-white`}>
      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        {!embedded && <button type="button" onClick={() => navigate('/MemberDashboard')} className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-white/60 hover:text-white"><ChevronLeft size={18} /> Account</button>}
        <div className="mb-8 flex flex-col gap-3 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-400">AISTAGE.ONE Direction System</p><h1 className="mt-2 text-4xl font-light tracking-tight">My AI Pilots</h1><p className="mt-2 max-w-2xl text-sm text-white/50">View the published Pilot and add your own production elements.</p></div>
          <Button type="button" variant="outline" onClick={() => navigate('/Catalog')} className="border-white/20 bg-white/[0.03] text-white hover:bg-white/10">Browse Assets Shop</Button>
        </div>
        {(libraryError || message) && <div className={`mb-5 border p-4 text-sm ${libraryError ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100'}`}>{libraryError?.message || message}</div>}
        {library.length === 0 ? <div className="border border-dashed border-white/15 px-6 py-16 text-center"><Bot className="mx-auto text-white/25" size={46} /><h2 className="mt-4 text-xl font-light">No AI Pilot in your library</h2><p className="mt-2 text-sm text-white/40">AI Pilots acquired or granted to your account will appear here.</p><Button type="button" onClick={() => navigate('/Catalog')} className="mt-6">Browse Assets Shop</Button></div> : (
          <div className="space-y-4">{library.map((access) => {
            const title = access.presentation?.title || access.pilot?.name || 'AI Pilot';
            const description = access.presentation?.description || access.pilot?.description || '';
            const image = access.presentation?.featured_image || access.pilot?.cover_url || '';
            const series = (access.blocks || []).find((block) => block.block_key === 'series-direction')?.content || {};
            const locationCount = (series.locations || []).length + (series.sets || []).length;
            return <section key={access.id} className="overflow-hidden border border-white/10 bg-[#111418]">
              <div className="grid gap-5 p-4 sm:grid-cols-[120px_minmax(0,1fr)] sm:p-5 lg:grid-cols-[140px_minmax(0,1fr)]">
                <div className="aspect-[3/4] overflow-hidden bg-[#20242a]">{image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Bot size={38} className="text-white/25" /></div>}</div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45"><span>Version {access.version?.version_number || '?'}</span><span>·</span><span>{humanize(access.access_source)}</span>{access.presentation?.creator_name && <><span>·</span><span>{access.presentation.creator_name}</span></>}</div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{title}</h2>
                  {description && <p className="mt-2 line-clamp-3 max-w-2xl text-sm leading-relaxed text-white/60">{description}</p>}
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/55"><span className="border border-white/10 bg-white/[0.04] px-2.5 py-1.5">{(access.characters || []).length} Characters</span><span className="border border-white/10 bg-white/[0.04] px-2.5 py-1.5">{locationCount} Sets & Locations</span><span className="border border-white/10 bg-white/[0.04] px-2.5 py-1.5">{(access.blocks || []).length} Direction Sections</span></div>
                  <button type="button" onClick={() => setExpanded((current) => ({ ...current, [access.id]: !current[access.id] }))} className="mt-4 inline-flex items-center gap-2 border border-[#23c7be]/50 bg-[#23c7be]/10 px-3 py-2 text-sm font-semibold text-[#23c7be]">{expanded[access.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}{expanded[access.id] ? 'Close Pilot' : 'Open Pilot'}</button>
                </div>

              </div>
              {expanded[access.id] && <div className="border-t border-white/10 px-4 pb-5 sm:px-5"><PilotDetails access={access} user={user} onMessage={setMessage} userSets={mySets} /></div>}
            </section>;
          })}</div>
        )}
      </main>
    </div>
  );
}