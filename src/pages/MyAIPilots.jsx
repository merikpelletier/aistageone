import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bot, ChevronDown, ChevronLeft, ChevronUp, Loader2, Plus, Trash2, Users, MapPin, FileText, Layers, Upload, X, Music2 } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { useStudioTranslation } from '@/lib/useStudioTranslation';
import { getPlatformLanguage } from '@/lib/translationDictionary';

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
  const t = useStudioTranslation();
  return <div className="space-y-3">{Object.entries(value || {}).filter(([, entry]) => !isEmpty(entry)).map(([key, entry]) => (
    <div key={key}>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">{t(humanize(key), humanize(key))}</p>
      <ContentValue value={entry} />
    </div>
  ))}</div>;
}

function PilotLooks({ content }) {
  const t = useStudioTranslation();
  const looks = Array.isArray(content?.looks) ? content.looks : [];
  if (!looks.length) return <p className="text-sm text-white/45">{t("No looks available.", "No looks available.")}</p>;
  return <div className="grid gap-4 md:grid-cols-2">
    {looks.map((look, index) => {
      const images = Array.isArray(look.result_images) ? look.result_images.map((entry) => typeof entry === 'string' ? entry : entry?.url).filter(Boolean) : [];
      const details = Object.fromEntries(Object.entries(look).filter(([key, value]) => !['id', 'name', 'result_images'].includes(key) && !isEmpty(value)));
      return <div key={look.id || index} className="overflow-hidden border border-white/10 bg-[#111418]">
        <div className="border-b border-white/10 p-3"><p className="text-base font-semibold text-white">{look.name || t('Unnamed Look', 'Unnamed Look')}</p>{look.type && <p className="mt-1 text-xs capitalize text-[#23c7be]">{t(String(look.type).replaceAll('_', ' '), String(look.type).replaceAll('_', ' '))}</p>}</div>
        {images.length > 0 && <div className="grid grid-cols-2 gap-2 p-3">{images.map((url, i) => <a key={i} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden bg-black/50" title={t("Open look result", "Open look result")}><img src={url} alt={`${look.name || 'Look'} result ${i + 1}`} className="aspect-[3/4] w-full object-contain" loading="lazy" /></a>)}</div>}
        <details className="group border-t border-white/10" open={!images.length}>
          <summary className="flex cursor-pointer list-none items-center justify-between p-3 text-sm font-semibold text-[#23c7be]">{t("Look details", "Look details")} <ChevronDown size={16} className="group-open:rotate-180" /></summary>
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
  const t = useStudioTranslation();
  if (!Array.isArray(items) || !items.length) return null;
  return <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
    {items.map((item, index) => {
      const url = typeof item === 'string' ? item : item?.url;
      const kind = item?.type || 'image';
      if (!url) return null;
      return <div key={index} className="min-w-0 overflow-hidden border border-white/10 bg-black/30">
        {kind === 'video' ? <video src={url} controls preload="metadata" className="aspect-video w-full object-contain" /> :
          kind === 'audio' ? <div className="p-3"><Music2 size={20} className="mb-2 text-[#23c7be]" /><audio src={url} controls className="w-full" /></div> :
          <a href={url} target="_blank" rel="noreferrer" title={t("Open full image", "Open full image")}><img src={url} alt={item?.name || t('AI Pilot reference', 'AI Pilot reference')} loading="lazy" className="aspect-[3/4] w-full object-cover" /></a>}
        <p className="truncate px-2 py-1.5 text-xs text-white/55">{item?.name || t('Reference media', 'Reference media')}</p>
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
const VIDEO_PART_LABELS = [['setup','Scene 1 · Setup'], ['development','Scene 2 · Development'], ['turn','Scene 3 · Turning point'], ['hook','Scene 4 · Hook']];

function ScenarioGuide({ content, sets = [], extensions = [], userSets = [], onSaveShotReferences, savingShot = '' }) {
  const t = useStudioTranslation();
  const [format, setFormat] = useState('fotoplay');
  const episodes = Array.from({ length: 9 }, (_, index) => (Array.isArray(content?.scenarios) ? content.scenarios[index] : null) || {});
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-white/10 p-2"><div className="text-xl font-bold text-white">9</div><div className="text-[11px] text-white/45">{t("Episodes / chapters", "Episodes / chapters")}</div></div>
        <div className="rounded-lg border border-white/10 p-2"><div className="text-xl font-bold text-white">4</div><div className="text-[11px] text-white/45">{t("Scenes / episode", "Scenes / episode")}</div></div>
        <div className="rounded-lg border border-white/10 p-2"><div className="text-xl font-bold text-white">{t("Set + Cast", "Set + Cast")}</div><div className="text-[11px] text-white/45">{t("Production references", "Production references")}</div></div>
      </div>
      {content?.creative_brief && <div><div className="text-xs font-bold text-cyan-300">{t("Season theme / Creative brief", "Season theme / Creative brief")}</div><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/75">{content.creative_brief}</p></div>}
      <label className="block space-y-2">
        <span className="text-xs font-bold text-white/70">{t("Choose a production format to view guidance", "Choose a production format to view guidance")}</span>
        <select className="w-full rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-white" value={format} onChange={(event) => setFormat(event.target.value)}>
          <option value="fotoplay">FotoPlay</option>
          <option value="audio">{t("Audio drama", "Audio drama")}</option>
          <option value="ebook">{t("E-book", "E-book")}</option>
          <option value="video">{t("Video (Shoot / Timeline)", "Video (Shoot / Timeline)")}</option>
        </select>
      </label>
      <p className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-3 text-sm leading-relaxed text-white/70">{t(FORMAT_GUIDANCE[format], FORMAT_GUIDANCE[format])}</p>
      <div className="space-y-2">
        {episodes.map((episode,index) => (
          <details key={episode.id || index} className="rounded-lg border border-white/10 bg-black/30 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-white">{t('Episode','Episode')} {index + 1}{episode.title ? ` · ${episode.title}` : ''}</summary>
            <div className="mt-3 space-y-3">
              {episode.premise && <div><p className="text-xs font-bold text-white/50">{t("Premise / conflict", "Premise / conflict")}</p><p className="mt-1 whitespace-pre-wrap text-sm text-white/75">{episode.premise}</p></div>}
              {episode.outline && <div><p className="text-xs font-bold text-white/50">{t("Story development", "Story development")}</p><p className="mt-1 whitespace-pre-wrap text-sm text-white/75">{episode.outline}</p></div>}
              <div className="space-y-2">
                <p className="text-xs font-bold text-cyan-300">{t("Episode structure", "Episode structure")}</p>
                {VIDEO_PART_LABELS.map(([key, label]) => (
                  <div key={key} className="border-l-2 border-cyan-400/30 pl-3">
                    <div className="text-xs font-semibold text-white/70">{t(label, label)}</div>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-white/60">{episode.parts?.[key] || t('Develop this part from the episode premise and story direction.', 'Develop this part from the episode premise and story direction.')}</p>
                  </div>
                ))}
              </div>
              {VIDEO_PART_LABELS.map(([partKey, label]) => {
                const scene = episode.scene_compositions?.[partKey];
                if (!scene) return null;
                const location = sets.find(item => item.id === scene.set_id);
                return <div key={partKey} className="space-y-2 border border-white/10 bg-white/[0.02] p-3">
                  <p className="text-sm font-semibold text-cyan-200">{t(label, label)} · {t('Composed scene', 'Composed scene')}</p>
                  {scene.generated_image && <img src={scene.generated_image} alt={label + ' composed production scene'} className="aspect-video w-full max-w-lg bg-black object-contain" />}
                  {location && <p className="text-xs text-white/65">{t('Set','Set')}: {location.name}</p>}
                  {scene.set_view_url && <img src={scene.set_view_url} alt={t('Selected set camera view', 'Selected set camera view')} className="h-28 max-w-xs object-contain bg-black" />}
                  {scene.background_placement && <p className="whitespace-pre-wrap text-xs text-white/65"><strong>{t("Background:", "Background:")}</strong> {scene.background_placement}</p>}
                  {scene.blocking && <p className="whitespace-pre-wrap text-xs text-white/65"><strong>{t("Blocking:", "Blocking:")}</strong> {scene.blocking}</p>}
                  {scene.props && <p className="whitespace-pre-wrap text-xs text-white/65"><strong>{t("Props:", "Props:")}</strong> {scene.props}</p>}
                  {scene.action && <p className="whitespace-pre-wrap text-xs text-white/65"><strong>{t("Action:", "Action:")}</strong> {scene.action}</p>}
                </div>;
              })}
              {format === 'fotoplay' && <p className="text-xs text-white/50">{t("Develop this chapter across nine FotoPlay segments, following the episode direction above.", "Develop this chapter across nine FotoPlay segments, following the episode direction above.")}</p>}
              {episode.scene_ideas && <div><p className="text-xs font-bold text-white/50">{t("Scene inspirations", "Scene inspirations")}</p><p className="mt-1 whitespace-pre-wrap text-sm text-white/70">{episode.scene_ideas}</p></div>}
              {episode.creative_options && <div><p className="text-xs font-bold text-white/50">{t("Creative variations", "Creative variations")}</p><p className="mt-1 whitespace-pre-wrap text-sm text-white/70">{episode.creative_options}</p></div>}
              {!episode.title && !episode.premise && !episode.outline && <p className="text-xs text-white/35">{t("No specific story direction has been provided for this episode yet.", "No specific story direction has been provided for this episode yet.")}</p>}
            </div>
          </details>
        ))}
      </div>
      {content?.creative_freedom && <div><div className="text-xs font-bold text-cyan-300">{t("Freedom to create", "Freedom to create")}</div><p className="mt-2 whitespace-pre-wrap text-sm text-white/70">{content.creative_freedom}</p></div>}
      <p className="text-xs text-white/35">{t("This format choice changes the guidance displayed here; it does not generate content or charge credits.", "This format choice changes the guidance displayed here; it does not generate content or charge credits.")}</p>
    </div>
  );
}

function PilotDetails({ access, user, onMessage, userSets = [] }) {
  const t = useStudioTranslation();
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
      onMessage(t('Personal Set link saved.', 'Personal Set link saved.'));
    } catch (error) { onMessage(error.message || t('Could not link My Set.', 'Could not link My Set.')); }
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
    } catch (error) { onMessage(error.message || t('Could not save shot references.', 'Could not save shot references.')); }
    finally { setSavingShot(''); }
  };


  const addMutation = useMutation({
    mutationFn: async () => {
      if (!draft.name.trim()) throw new Error(t('Add a name first.', 'Add a name first.'));
      setUploading(Boolean(files.length));
      try {
        const media = [];
        for (const file of files) {
          if (!/^(image|video|audio)\//.test(file.type)) throw new Error(t('Only images, video and audio files are supported.', 'Only images, video and audio files are supported.'));
          if (file.size > PILOT_FILE_LIMIT) throw new Error(t('Each media file must be 50 MB or smaller.', 'Each media file must be 50 MB or smaller.'));
          const base = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0,70) || 'media';
          const extension = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
          const path = user.id + '/ai-pilots/member-additions/' + access.id + '/' + Date.now() + '-' + crypto.randomUUID() + '-' + base + '.' + extension;
          const { error: uploadError } = await supabase.storage.from('media').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
          if (uploadError) throw uploadError;
          const { data } = supabase.storage.from('media').getPublicUrl(path);
          if (!data?.publicUrl) throw new Error(t('Unable to obtain media URL.', 'Unable to obtain media URL.'));
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
      onMessage(t('Personal addition saved.', 'Personal addition saved.'));
      await queryClient.invalidateQueries({ queryKey: ['my-ai-pilots', user.id] });
    },
    onError: (error) => onMessage(error?.message || t('Unable to save this addition.', 'Unable to save this addition.')),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('member_ai_pilot_extensions').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      onMessage(t('Personal addition removed.', 'Personal addition removed.'));
      await queryClient.invalidateQueries({ queryKey: ['my-ai-pilots', user.id] });
    },
    onError: (error) => onMessage(error?.message || t('Unable to remove this addition.', 'Unable to remove this addition.')),
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
  )) : <p className="py-8 text-sm text-white/45">{t("No direction available in this section.", "No direction available in this section.")}</p>;
  return (
    <div className="mt-5 border-t border-white/10 pt-5">
      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => setActiveSection(id)} className={`inline-flex items-center gap-2 border px-3 py-2.5 text-xs font-semibold transition-colors ${activeSection === id ? 'border-[#23c7be] bg-[#23c7be]/10 text-[#23c7be]' : 'border-white/10 bg-white/[0.03] text-white/65 hover:border-white/25 hover:text-white'}`}><Icon size={15} />{t(label,label)}</button>)}
      </div>
      <div className="min-h-[160px] max-w-5xl">
        {activeSection === 'overview' && <div className="space-y-3">{access.pilot?.description && <div className="border border-white/10 bg-[#171b20] p-4"><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#23c7be]">{t("Series Overview", "Series Overview")}</p><p className="whitespace-pre-wrap text-sm leading-relaxed text-white/75">{access.pilot.description}</p></div>}</div>}
        {activeSection === 'scenario' && <div className="space-y-3">{renderBlocks(scenarioBlocks)}</div>}
        {activeSection === 'characters' && <div className="grid gap-3 md:grid-cols-2">{characters.length ? characters.map((character) => <details key={character.id} className="group border border-white/10 bg-[#171b20] p-4"><summary className="flex cursor-pointer list-none items-center gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden bg-black/40">{(character.reference_images || []).length ? <img src={typeof character.reference_images[0] === 'string' ? character.reference_images[0] : character.reference_images[0]?.url} alt="" className="h-full w-full object-cover" /> : <Users size={20} className="text-white/30" />}</div><div className="min-w-0 flex-1"><p className="font-semibold text-white">{character.role_name}</p><p className="line-clamp-1 text-xs text-white/45">{character.narrative_function || character.description}</p></div><ChevronDown size={15} className="text-[#23c7be] group-open:rotate-180" /></summary><div className="mt-3 border-t border-white/10 pt-3"><ContentObject value={{ description: character.description, narrative_function: character.narrative_function, personality: character.personality, behavior: character.behavior, visual_identity: character.visual_identity, wardrobe_look: character.wardrobe_look, continuity_locks: character.continuity_locks, production_notes: character.production_notes }} /></div></details>) : <p className="text-sm text-white/45">{t("No characters in this Pilot.", "No characters in this Pilot.")}</p>}</div>}
        {activeSection === 'sets' && <div className="grid gap-4 lg:grid-cols-2"><div><p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#23c7be]">{t('Locations','Locations')} · {locations.length}</p><div className="space-y-2">{locations.map((location) => <details key={location.id} className="border border-white/10 bg-[#171b20] p-3"><summary className="cursor-pointer text-sm font-semibold text-white">{location.name}</summary><p className="mt-2 whitespace-pre-wrap text-sm text-white/65">{location.description}</p></details>)}{!locations.length && <p className="text-sm text-white/45">{t("No locations added.", "No locations added.")}</p>}</div></div><div><p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#23c7be]">{t('Sets','Sets')} · {sets.length}</p><div className="space-y-2">{sets.map((set) => {
                const override = (access.extensions || []).find(entry => entry.extension_type === 'set' && entry.operation === 'replace' && entry.target_item_id === set.id);
                const linkedId = override?.content?.my_set_id ?? set.my_set_id ?? '';
                const linked = userSets.find(item => item.id === linkedId);
                const sheetItems = (linked?.reference_sheet?.extracted_elements || []).filter(item => item.image_url);
                return <details key={set.id} className="border border-white/10 bg-[#171b20] p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-white">{set.name}</summary>
                  {set.description && <p className="mt-2 whitespace-pre-wrap text-sm text-white/65">{set.description}</p>}
                  <label className="mt-3 block text-xs text-white/65">{t('My Set for this AI Pilot', 'My Set for this AI Pilot')}
                    <select value={linkedId && userSets.some(item => item.id === linkedId) ? linkedId : ''}
                      disabled={savingSet === set.id}
                      onChange={event => saveSetLink(set.id, event.target.value)}
                      className="mt-2 w-full border border-white/20 bg-[#151719] p-2 text-sm text-white">
                      <option value="">{t("No personal Set linked", "No personal Set linked")}</option>
                      {userSets.map(item => <option key={item.id} value={item.id}>{item.name || t('Unnamed Set', 'Unnamed Set')}</option>)}
                    </select>
                  </label>
                  {linked ? <div className="mt-3 space-y-2">
                    <p className="text-xs text-[#23c7be]">{t('My Sets','My Sets')} · {linked.name} · {sheetItems.length} {t('reference elements','reference elements')}</p>
                    {!!(linked.images || []).filter(Boolean).length && <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-white/60">{t("Camera Views", "Camera Views")}</p>
                      <div className="grid grid-cols-2 gap-2">{linked.images.map((url, index) => url ? <div key={index} className="border border-white/10 bg-black p-2">
                        <img src={url} alt={t(['Hero','Wide','Reverse','Left','Right','Detail','Day','Night'][index] || 'Set view', ['Hero','Wide','Reverse','Left','Right','Detail','Day','Night'][index] || 'Set view')} className="h-24 w-full object-contain" />
                        <p className="mt-1 text-[11px] text-white/65">{t(['Hero','Wide','Reverse','Left','Right','Detail','Day','Night'][index] || 'View', ['Hero','Wide','Reverse','Left','Right','Detail','Day','Night'][index] || 'View')}</p>
                      </div> : null)}</div>
                    </div>}
                    {!!sheetItems.length && <div className="grid grid-cols-2 gap-2">{sheetItems.map((item,index) =>
                      <div key={item.id || index} className="border border-white/10 bg-black p-2"><img src={item.image_url} alt={item.name} className="h-24 w-full object-contain" /><p className="mt-1 truncate text-[11px] text-white/65">{item.name}</p></div>)}</div>}
                  </div> : <p className="mt-2 text-[11px] text-white/45">{t("Connect a Set from My Sets to use your personal Reference Sheet. The published AI Pilot remains unchanged.", "Connect a Set from My Sets to use your personal Reference Sheet. The published AI Pilot remains unchanged.")}</p>}
                  {Array.isArray(set.reference_images) && set.reference_images.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{set.reference_images.map((image,index) =>
                    <img key={index} src={typeof image === 'string' ? image : image?.url} alt={t('Original AI Pilot set', 'Original AI Pilot set')} className="h-20 w-28 object-contain bg-black" />)}</div>}
                </details>;
              })}{!sets.length && <p className="text-sm text-white/45">{t("No sets added.", "No sets added.")}</p>}</div></div></div>}
        {activeSection === 'direction' && <div className="space-y-3">{renderBlocks(directionBlocks)}</div>}
        {activeSection === 'additions' && <div className="max-w-5xl space-y-5">
          <div><h3 className="text-lg font-semibold text-white">{t("My Additions", "My Additions")}</h3><p className="mt-1 text-sm text-white/50">{t("Your personal characters, sets and directions do not change the published AI Pilot.", "Your personal characters, sets and directions do not change the published AI Pilot.")}</p></div>
          <div className="grid gap-3 lg:grid-cols-2">
            {(access.extensions || []).map((extension) => {
              const content = extension.content || {};
              const { media, description, notes, ...details } = content;
              return <div key={extension.id} className="border border-white/10 bg-[#171b20] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="text-xs uppercase tracking-wider text-[#23c7be]">{t(humanize(extension.extension_type), humanize(extension.extension_type))}</p><h4 className="mt-1 font-semibold text-white">{extension.name}</h4></div>
                  <button type="button" onClick={() => { if (window.confirm(t('Remove this personal addition?', 'Remove this personal addition?'))) deleteMutation.mutate(extension.id); }} disabled={deleteMutation.isPending} className="text-red-300 hover:text-red-200" aria-label={t('Remove', 'Remove') + ' ' + extension.name}><Trash2 size={16} /></button>
                </div>
                <AdditionMedia items={media} />
                <div className="mt-3 space-y-2 text-sm text-white/70">
                  {description && <p className="whitespace-pre-wrap">{description}</p>}
                  {(notes || Object.values(details).some(Boolean)) && <details className="border-t border-white/10 pt-3"><summary className="cursor-pointer text-xs font-semibold text-[#23c7be]">{t("View production details", "View production details")}</summary><div className="mt-3"><ContentObject value={{ ...details, notes }} /></div></details>}
                </div>
              </div>;
            })}
          </div>
          {!(access.extensions || []).length && <p className="text-sm text-white/45">{t("No personal additions yet.", "No personal additions yet.")}</p>}
          <div className="space-y-4 border border-[#23c7be]/25 bg-[#111b1e] p-4 sm:p-5">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-[#23c7be]">{t("Add to My AI Pilot", "Add to My AI Pilot")}</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2"><span className="text-xs font-semibold text-white/65">{t("Addition type", "Addition type")}</span>
                <select value={draft.extension_type} onChange={(event) => setDraft((current) => ({ ...current, extension_type: event.target.value, details: {} }))} className="w-full border border-white/20 bg-[#15191e] px-3 py-3 text-sm text-white">
                  {EXTENSION_TYPES.map(([value, label]) => <option key={value} value={value}>{t(label, label)}</option>)}
                </select>
              </label>
              <label className="block space-y-2"><span className="text-xs font-semibold text-white/65">{t("Name *", "Name *")}</span>
                <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder={t('Name your addition', 'Name your addition')} className="w-full border border-white/20 bg-[#15191e] px-3 py-3 text-sm text-white placeholder:text-white/35" />
              </label>
            </div>
            <label className="block space-y-2"><span className="text-xs font-semibold text-white/65">{t("Description", "Description")}</span><textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} rows={3} placeholder={t('Describe this character, set or production element', 'Describe this character, set or production element')} className="w-full border border-white/20 bg-[#15191e] px-3 py-3 text-sm text-white" /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              {(EXTENSION_FIELDS[draft.extension_type] || []).map(([key, label]) => <label key={key} className="block space-y-2"><span className="text-xs font-semibold text-white/65">{t(label, label)}</span><textarea value={draft.details[key] || ''} onChange={(event) => setDraft((current) => ({ ...current, details: { ...current.details, [key]: event.target.value } }))} rows={2} className="w-full border border-white/20 bg-[#15191e] px-3 py-3 text-sm text-white" /></label>)}
            </div>
            <label className="block space-y-2"><span className="text-xs font-semibold text-white/65">{t("Direction / notes for AI tools", "Direction / notes for AI tools")}</span><textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} rows={3} placeholder={t('How should the AI use this addition?', 'How should the AI use this addition?')} className="w-full border border-white/20 bg-[#15191e] px-3 py-3 text-sm text-white" /></label>
            <div className="border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="text-sm font-semibold text-white">{t("Reference media", "Reference media")}</p><p className="mt-1 text-xs text-white/50">{t("Images, video or audio — especially for characters and sets. Maximum 50 MB per file.", "Images, video or audio — especially for characters and sets. Maximum 50 MB per file.")}</p></div>
                <label className="inline-flex cursor-pointer items-center gap-2 border border-white/20 bg-white/[0.05] px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"><Upload size={16}/> Add media
                  <input type="file" className="hidden" accept={ACCEPTED_PILOT_MEDIA} multiple disabled={uploading || addMutation.isPending} onChange={(event) => { const incoming = Array.from(event.target.files || []); event.target.value = ''; if (incoming.some((file) => !/^(image|video|audio)\//.test(file.type) || file.size > PILOT_FILE_LIMIT)) { onMessage(t('Use image, video or audio files, maximum 50 MB each.', 'Use image, video or audio files, maximum 50 MB each.')); return; } setFiles((current) => [...current, ...incoming]); }} />
                </label>
              </div>
              {files.length > 0 && <div className="mt-3 space-y-2">{files.map((file, index) => <div key={index} className="flex items-center justify-between gap-2 border border-white/10 bg-black/30 px-3 py-2 text-xs"><span className="min-w-0 truncate text-white/70">{file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB</span><button type="button" aria-label={t('Remove', 'Remove') + ' ' + file.name} onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} className="shrink-0 text-white/55 hover:text-white"><X size={15} /></button></div>)}</div>}
            </div>
            <Button type="button" onClick={() => addMutation.mutate()} disabled={addMutation.isPending || uploading || !draft.name.trim()} className="w-full bg-[#23c7be] text-black hover:bg-[#23c7be]/85"><Plus size={16} className="mr-2"/>{addMutation.isPending ? t('Saving addition…','Saving addition…') : t('Add to My AI Pilot','Add to My AI Pilot')}</Button>
          </div>
        </div>}
      </div>
    </div>
  );
}

export default function MyAIPilots({ embedded = false }) {
  const t = useStudioTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoadingAuth } = useAuth();
  const [expanded, setExpanded] = useState({});
  const [selectedUniverse, setSelectedUniverse] = useState(null);
  const [previewUniverse, setPreviewUniverse] = useState(null);
  const [message, setMessage] = useState('');
  const ui = (english, french) => t(english, getPlatformLanguage() === 'fr' ? french : english);

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

  const selected = library.find((access) => access.id === selectedUniverse);
  const locale = getPlatformLanguage();
  const getVisuals = (access) => {
    const content = (access.blocks || []).find((block) => block.block_key === 'universe-presentation')?.content || {};
    return { ...content.locales?.en, ...content.locales?.[locale] };
  };
  const getTitle = (access) => getVisuals(access).title || access.presentation?.title || access.pilot?.name || 'AI Pilot';
  const getDescription = (access) => getVisuals(access).tagline || access.presentation?.description || access.pilot?.description || '';
  const getImage = (access, format = 'hero') => {
    const visuals = getVisuals(access);
    const original = access.presentation?.featured_image || access.pilot?.cover_url || access.presentation?.preview_images?.[0] || '';
    return (format === 'card' ? visuals.card_image || visuals.hero_image : visuals.hero_image || visuals.card_image) || original;
  };
  const getSynopsis = (access) => {
    const direction = (access.blocks || []).find((block) => block.block_key === 'series-direction')?.content || {};
    return getVisuals(access).synopsis || direction.synopsis || direction.series_synopsis || direction.premise || access.presentation?.description || access.pilot?.description || '';
  };

  return (
    <div className={`${embedded ? 'min-h-full' : 'min-h-screen'} bg-[#090b0e] pb-20 text-white`}>
      <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:py-8">
        {!embedded && <button type="button" onClick={() => navigate('/MemberDashboard')} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-white/60 hover:text-white"><ChevronLeft size={18} /> {t('Account', 'Account')}</button>}
        {(libraryError || message) && <div role="status" className={`mb-5 border p-4 text-sm ${libraryError ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100'}`}>{libraryError?.message || message}</div>}

        {!selected ? (
          <>
            <header className="mb-6 border-b border-white/10 pb-5 sm:mb-7 sm:pb-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#23c7be]">AISTAGE.ONE / AI PILOTS</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">{ui('Explore the universes', 'Explorez les univers')}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">{ui('Discover evolving creative worlds and choose the story you want to explore.', 'Découvrez des univers créatifs évolutifs et choisissez l’histoire que vous souhaitez explorer.')}</p>
            </header>

            {library.length === 0 ? (
              <div className="border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center">
                <Bot className="mx-auto text-white/25" size={46} />
                <h2 className="mt-4 text-xl font-semibold">{t('No AI Pilot in your library', 'No AI Pilot in your library')}</h2>
                <p className="mt-2 text-sm text-white/45">{t('AI Pilots acquired or granted to your account will appear here.', 'AI Pilots acquired or granted to your account will appear here.')}</p>
                <Button type="button" onClick={() => navigate('/Catalog')} className="mt-6 bg-[#23c7be] text-black hover:bg-[#23c7be]/85">{t('Browse Assets Shop', 'Browse Assets Shop')}</Button>
              </div>
            ) : (
              <>
                {(() => {
                  const featured = library.find((entry) => /front row sins/i.test(entry.pilot?.name || entry.presentation?.title || '')) || library[0];
                  const active = library.find((entry) => entry.id === previewUniverse) || featured;
                  const activeIndex = library.findIndex((entry) => entry.id === active.id);
                  const image = getImage(active);
                  const cardImage = getImage(active, 'card');
                  const enter = () => { setSelectedUniverse(active.id); setExpanded((current) => ({ ...current, [active.id]: false })); };
                  const changeSelection = (direction) => setPreviewUniverse(library[(activeIndex + direction + library.length) % library.length].id);
                  const visuals = getVisuals(active);
                  return <section aria-label={ui('Universe selection', 'Sélection des univers')} className="relative isolate min-h-[660px] overflow-hidden border border-white/15 bg-[#060a0e] shadow-[0_30px_90px_rgba(0,0,0,0.6)] sm:min-h-[710px] lg:min-h-[min(780px,calc(100vh-130px))]">
                    <div key={active.id} className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
                      {image ? <img src={image} alt="" className="h-full w-full scale-110 animate-[universe-reveal_900ms_ease-out_both] object-cover opacity-40 blur-[5px]" /> : <div className="h-full w-full bg-[radial-gradient(ellipse_at_65%_40%,#17313a,#06090c_70%)]" />}
                    </div>
                    <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(3,7,11,0.98)_0%,rgba(3,7,11,0.88)_37%,rgba(3,7,11,0.12)_100%)]" />
                    <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(0deg,#05090d_0%,transparent_35%,rgba(0,0,0,0.35)_100%)]" />
                    <div className="pointer-events-none absolute inset-0 -z-10 opacity-40" style={{backgroundImage: 'linear-gradient(rgba(114,218,211,0.055) 1px,transparent 1px),linear-gradient(90deg,rgba(114,218,211,0.055) 1px,transparent 1px)',backgroundSize:'72px 72px',maskImage:'linear-gradient(90deg,transparent,black)'}} />
                    <div className="pointer-events-none absolute left-[70%] top-[42%] -z-10 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#68cec5]/20 shadow-[0_0_110px_rgba(35,199,190,0.14),inset_0_0_90px_rgba(35,199,190,0.06)]" />
                    {cardImage && <div key={'art-'+active.id} className="pointer-events-none absolute inset-y-[12%] right-[2%] hidden w-[48%] items-center justify-center lg:flex">
                      <img src={cardImage} alt="" className="max-h-full max-w-full animate-[universe-reveal_750ms_ease-out_both] object-contain drop-shadow-[0_25px_55px_rgba(0,0,0,0.75)]" />
                    </div>}
                    <div className="relative flex min-h-[660px] flex-col sm:min-h-[710px] lg:min-h-[min(780px,calc(100vh-130px))]">
                      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/20 px-5 py-4 backdrop-blur-sm sm:px-8">
                        <div className="flex items-center gap-3"><span className="h-2 w-2 rotate-45 bg-[#23c7be] shadow-[0_0_16px_#23c7be]" /><span className="text-xs font-black uppercase tracking-[0.27em] text-white">AI PILOTS</span><span className="hidden text-[10px] uppercase tracking-[0.2em] text-white/40 sm:inline">/ {ui('World selection', 'Sélection des mondes')}</span></div>
                        <span className="font-mono text-xs tracking-[0.18em] text-white/55">{String(activeIndex+1).padStart(2,'0')} <span className="text-white/30">/</span> {String(library.length).padStart(2,'0')}</span>
                      </div>
                      <div className="relative flex flex-1 flex-col lg:flex-row">
                        <nav aria-label={ui('Choose a universe', 'Choisissez un univers')} className="order-2 flex gap-2 overflow-x-auto border-t border-white/10 bg-black/45 p-3 lg:order-1 lg:w-[220px] lg:shrink-0 lg:flex-col lg:gap-1 lg:overflow-y-auto lg:border-r lg:border-t-0 lg:p-4">
                          <p className="mb-3 hidden px-3 pt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 lg:block">{ui('Destinations', 'Destinations')}</p>
                          {library.map((entry,index) => <button type="button" key={entry.id} aria-current={entry.id === active.id ? 'true' : undefined} onClick={() => setPreviewUniverse(entry.id)} className={`group flex min-w-[180px] items-center gap-3 border-l-2 p-2.5 text-left transition-all duration-200 lg:min-w-0 lg:w-full ${entry.id === active.id ? 'border-[#23c7be] bg-[#23c7be]/15 text-white shadow-[inset_0_0_28px_rgba(35,199,190,0.07)]' : 'border-transparent bg-black/20 text-white/55 hover:border-white/40 hover:bg-white/10 hover:text-white'}`}>
                            <span className="font-mono text-[10px] text-[#70d9d0]">{String(index+1).padStart(2,'0')}</span>
                            <span className="min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-[0.08em]">{getTitle(entry)}</span>
                            {entry.id === active.id && <ChevronDown size={14} className="-rotate-90 text-[#23c7be]" />}
                          </button>)}
                        </nav>
                        <div className="order-1 relative flex flex-1 flex-col justify-end px-6 pb-8 pt-16 sm:px-10 sm:pb-12 lg:order-2 lg:px-14 lg:pb-16">
                          <div className="max-w-xl animate-[universe-reveal_650ms_ease-out_both]" key={'copy-'+active.id}>
                            <div className="mb-5 flex items-center gap-3"><span className="h-px w-9 bg-[#23c7be]" /><p className="text-[10px] font-black uppercase tracking-[0.26em] text-[#73e5da]">{ui('World available', 'Monde disponible')} <span className="text-white/40">/ {String(activeIndex+1).padStart(2,'0')}</span></p></div>
                            {visuals.logo_image ? <img src={visuals.logo_image} alt={getTitle(active)} className="mb-6 max-h-32 max-w-[90%] object-contain object-left" /> : <h2 className="max-w-xl text-4xl font-black uppercase leading-[0.97] tracking-[-0.045em] text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)] sm:text-6xl xl:text-7xl">{getTitle(active)}</h2>}
                            {getDescription(active) && <p className="mt-6 max-w-md border-l-2 border-[#23c7be]/65 pl-4 text-sm leading-relaxed text-white/80 sm:text-base">{getDescription(active)}</p>}
                            <button type="button" onClick={enter} className="group mt-9 inline-flex min-h-14 items-center gap-8 border border-[#23c7be] bg-[#23c7be] px-7 py-3 text-sm font-black uppercase tracking-[0.11em] text-[#061012] shadow-[0_0_36px_rgba(35,199,190,0.15)] transition-all hover:gap-11 hover:bg-[#83e9df] hover:shadow-[0_0_50px_rgba(35,199,190,0.28)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{ui('Enter the universe', 'Entrer dans l’univers')} <ChevronDown className="-rotate-90" size={20}/></button>
                          </div>
                          <div className="mt-10 flex items-center justify-between gap-4 border-t border-white/15 pt-5 sm:mt-14">
                            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">{ui('Select your destination', 'Choisissez votre destination')}</span>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => changeSelection(-1)} aria-label={ui('Previous universe', 'Univers précédent')} className="flex h-10 w-10 items-center justify-center border border-white/25 bg-black/40 text-white transition-colors hover:border-[#23c7be] hover:text-[#23c7be]"><ChevronLeft size={20}/></button>
                              <button type="button" onClick={() => changeSelection(1)} aria-label={ui('Next universe', 'Univers suivant')} className="flex h-10 w-10 items-center justify-center border border-white/25 bg-black/40 text-white transition-colors hover:border-[#23c7be] hover:text-[#23c7be]"><ChevronDown size={20} className="-rotate-90"/></button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>;
                })()}
                <style>{`@keyframes universe-reveal {from {opacity:0;transform:translateY(14px) scale(1.015)} to {opacity:1;transform:translateY(0) scale(1)}} @media (prefers-reduced-motion:reduce) { .animate-\\[universe-reveal_650ms_ease-out_both\\], .animate-\\[universe-reveal_750ms_ease-out_both\\], .animate-\\[universe-reveal_900ms_ease-out_both\\] {animation:none!important} }`}</style>
              </>
            )}
          </>
        ) : (
          <>
            <button type="button" onClick={() => { setSelectedUniverse(null); setExpanded((current) => ({ ...current, [selected.id]: false })); }} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white"><ChevronLeft size={18} /> {ui('All universes', 'Tous les univers')}</button>
            <section className="relative isolate overflow-hidden border border-white/10 bg-[#14191e]">
              {getImage(selected) && <img src={getImage(selected)} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-50" />}
              <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0b0e12] via-[#0b0e12]/90 to-[#0b0e12]/25 sm:bg-gradient-to-r sm:from-[#0b0e12] sm:via-[#0b0e12]/90 sm:to-[#0b0e12]/35" />
              <div className="flex min-h-[340px] flex-col justify-end p-5 sm:min-h-[440px] sm:p-10 lg:p-14">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#71e0d8]">AI PILOT / {ui('Universe', 'Univers')}</p>
                <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">{getTitle(selected)}</h1>
                {getSynopsis(selected) && <div className="mt-5 max-w-2xl"><h2 className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#71e0d8]">{ui('Synopsis', 'Synopsis')}</h2><p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80 sm:text-base">{getSynopsis(selected)}</p></div>}
                {selected.presentation?.creator_name && <p className="mt-4 text-xs text-white/50">{selected.presentation.creator_name}</p>}
                <div className="mt-7 flex flex-wrap gap-3">
                  <Button type="button" onClick={() => setExpanded((current) => ({ ...current, [selected.id]: !current[selected.id] }))} className="min-h-11 bg-[#23c7be] px-6 font-semibold text-black hover:bg-[#23c7be]/85">{expanded[selected.id] ? ui('Close universe', 'Fermer l’univers') : ui('Enter the universe', 'Entrer dans l’univers')} <ChevronDown size={17} className={`ml-2 ${expanded[selected.id] ? 'rotate-180' : '-rotate-90'}`} /></Button>
                </div>
              </div>
            </section>
            {expanded[selected.id] && <section className="mt-5 border border-white/10 bg-[#111418] p-4 sm:p-6"><PilotDetails access={selected} user={user} onMessage={setMessage} userSets={mySets} /></section>}
          </>
        )}
      </main>
    </div>
  );
}
