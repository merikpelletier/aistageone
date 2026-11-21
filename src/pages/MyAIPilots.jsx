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

function PilotDetails({ access, user, onMessage, userSets = [], initialSection = 'overview', hideTabs = false, onOpenStoryTool }) {
  const t = useStudioTranslation();
  const queryClient = useQueryClient();
  const emptyDraft = () => ({ extension_type: 'character_style', name: '', description: '', notes: '', details: {} });
  const [draft, setDraft] = useState(emptyDraft);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [activeSection, setActiveSection] = useState(initialSection);
  const [storyCategory, setStoryCategory] = useState('characters');
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
          extension_type: selectedStoryGroup.types.includes(draft.extension_type) ? draft.extension_type : selectedStoryGroup.type,
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
      setDraft((current) => ({ ...emptyDraft(), extension_type: current.extension_type }));
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
    ['additions', 'My Story', Plus],
  ];
  const storyGroups = [
    { id: 'characters', title: 'My Characters', description: 'Create your lead and supporting cast.', icon: Users, types: ['character_style', 'look'], type: 'character_style' },
    { id: 'locations', title: 'My Locations', description: 'Build the places where your story takes place.', icon: MapPin, types: ['location', 'set'], type: 'location' },
    { id: 'episodes', title: 'My Episodes', description: 'Organize the episodes of your branch.', icon: Layers, types: ['episode', 'scene'], type: 'episode' },
    { id: 'other', title: 'Other Additions', description: 'Keep your existing music and creative directions.', icon: Plus, types: ['music_piece', 'visual_direction'], type: 'music_piece' },
  ];
  const selectedStoryGroup = storyGroups.find((group) => group.id === storyCategory) || storyGroups[0];
  const storyAdditions = (access.extensions || []).filter((entry) => storyCategory === 'other' ? (entry.operation !== 'add' || !storyGroups.slice(0, 3).some((group) => group.types.includes(entry.extension_type))) : (entry.operation === 'add' && selectedStoryGroup.types.includes(entry.extension_type)));
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
      {!hideTabs && <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map(([id, label, Icon]) => <button key={id} type="button" onClick={() => setActiveSection(id)} className={`inline-flex items-center gap-2 border px-3 py-2.5 text-xs font-semibold transition-colors ${activeSection === id ? 'border-[#23c7be] bg-[#23c7be]/10 text-[#23c7be]' : 'border-white/10 bg-white/[0.03] text-white/65 hover:border-white/25 hover:text-white'}`}><Icon size={15} />{t(label,label)}</button>)}
      </div>}
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
          <div><h3 className="text-lg font-semibold text-white">{t('My Story', 'My Story')}</h3><p className="mt-1 text-sm text-white/50">{t('Build your own branch with characters, locations and episodes. The official series remains unchanged.', 'Build your own branch with characters, locations, scenes and episodes. The official series remains unchanged.')}</p></div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {storyGroups.slice(0,3).map(({id,title,icon:Icon,types,type}) => <button key={id} type="button" onClick={() => { setStoryCategory(id); setDraft({ ...emptyDraft(), extension_type: type }); setFiles([]); }} className={`flex min-h-[92px] flex-col items-start justify-between border p-3 text-left transition-colors lg:min-h-0 lg:h-12 lg:flex-row lg:items-center lg:justify-start lg:gap-3 lg:px-3 lg:py-2 ${storyCategory === id ? 'border-[#23c7be] bg-[#23c7be]/10 text-white' : 'border-white/10 bg-white/[0.025] text-white/70 hover:bg-white/[0.06]'}`}>
              <Icon size={17} className={`shrink-0 ${storyCategory === id ? 'text-[#23c7be]' : 'text-white/55'}`} />
              <span className="flex w-full items-end justify-between gap-2 text-xs font-semibold lg:items-center lg:font-medium"><span>{t(title,title)}</span><span className="text-xs text-white/40">{(access.extensions || []).filter((entry) => entry.operation === 'add' && types.includes(entry.extension_type)).length}</span></span>
            </button>)}
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div><h4 className="font-semibold text-white">{t(selectedStoryGroup.title, selectedStoryGroup.title)}</h4><p className="mt-1 text-xs text-white/50">{t(selectedStoryGroup.description, selectedStoryGroup.description)}</p></div>
            <button type="button" className="shrink-0 text-xs text-white/55 underline hover:text-white" onClick={() => { setStoryCategory('other'); setDraft({ ...emptyDraft(), extension_type: 'music_piece' }); setFiles([]); }}>{t('Other Additions','Other Additions')}</button>
          </div>
          {onOpenStoryTool && storyCategory !== 'other' && <div className="flex flex-wrap items-center gap-2 border border-white/10 bg-[#171b20] p-3">
            <p className="mr-auto text-xs text-white/60">{t('Create with AISTAGE.ONE tools', 'Create with AISTAGE.ONE tools')}</p>
            {(storyCategory === 'characters' ? [['actor', 'Open Actor']] : storyCategory === 'locations' ? [['set', 'Open Set Designer']] : [['fotoplay', 'Open FotoPlay'], ['shoot', 'Open Shoot']]).map(([tool,label]) => (
              <Button key={tool} type="button" className="border border-[#23c7be]/60 bg-[#23c7be]/10 text-[#7ce8df] hover:bg-[#23c7be]/20" onClick={() => onOpenStoryTool(tool, { pilotId: access.pilot?.id, accessId: access.id, category: storyCategory })}>{t(label,label)}</Button>
            ))}
          </div>}
          <div className="grid gap-3 lg:grid-cols-2">
            {storyAdditions.map((extension) => {
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
          {!storyAdditions.length && <p className="text-sm text-white/45">{t('Nothing created in this section yet.', 'Nothing created in this section yet.')}</p>}
          <div className="space-y-4 border border-[#23c7be]/25 bg-[#111b1e] p-4 sm:p-5">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-[#23c7be]">{t('Create', 'Create')} · {t(selectedStoryGroup.title,selectedStoryGroup.title)}</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2"><span className="text-xs font-semibold text-white/65">{t("Addition type", "Addition type")}</span>
                <select value={selectedStoryGroup.types.includes(draft.extension_type) ? draft.extension_type : selectedStoryGroup.type} onChange={(event) => setDraft((current) => ({ ...current, extension_type: event.target.value, details: {} }))} className="w-full border border-white/20 bg-[#15191e] px-3 py-3 text-sm text-white">
                  {[...EXTENSION_TYPES.filter(([value]) => selectedStoryGroup.types.includes(value)), ...selectedStoryGroup.types.filter((value) => value !== 'scene' && !EXTENSION_TYPES.some(([type]) => type === value)).map((value) => [value, value === 'scene' ? 'Scene' : 'Episode'])].map(([value, label]) => <option key={value} value={value}>{t(label, label)}</option>)}
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

export default function MyAIPilots({ embedded = false, onOpenStoryTool }) {
  const t = useStudioTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoadingAuth } = useAuth();
  const [expanded, setExpanded] = useState({});
  const [selectedUniverse, setSelectedUniverse] = useState(null);
  const [previewUniverse, setPreviewUniverse] = useState(null);
  const [universeSection, setUniverseSection] = useState(null);
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
  const getImage = (access, format = 'banner') => {
    const visuals = getVisuals(access);
    const cover = access.pilot?.cover_url || access.presentation?.featured_image || access.presentation?.preview_images?.[0] || '';
    if (format === 'card') return visuals.card_image || cover;
    if (format === 'background') return visuals.background_type === 'color' ? '' : (visuals.background_image || '');
    return visuals.hero_image || '';
  };
  const getBackgroundStyle = (access) => {
    const visuals = getVisuals(access);
    const color = /^#[0-9a-fA-F]{6}$/.test(visuals.background_color || '') ? visuals.background_color : '#090b0e';
    const image = getImage(access, 'background');
    return image && visuals.background_type !== 'color' ? { backgroundColor: color, backgroundImage: `url("${image.replace(/["\\]/g, '')}")`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'scroll' } : { backgroundColor: color };
  };
  const getSynopsis = (access) => {
    const direction = (access.blocks || []).find((block) => block.block_key === 'series-direction')?.content || {};
    return getVisuals(access).synopsis || direction.synopsis || direction.series_synopsis || direction.premise || access.presentation?.description || access.pilot?.description || '';
  };

  return (
    <div className="min-h-screen w-full pb-20 text-white" style={selected ? getBackgroundStyle(selected) : { backgroundColor: '#05080d' }}>
      <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:py-8">
        {!embedded && <button type="button" onClick={() => navigate('/MemberDashboard')} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-white/60 hover:text-white"><ChevronLeft size={18} /> {t('Account', 'Account')}</button>}
        {(libraryError || message) && <div role="status" className={`mb-5 border p-4 text-sm ${libraryError ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100'}`}>{libraryError?.message || message}</div>}

        {!selected ? (
          <>
            <header className="sr-only">
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
                  const image = getImage(active, 'background');
                  const cardImage = getImage(active, 'card');
                  const enter = () => { setSelectedUniverse(active.id); setExpanded((current) => ({ ...current, [active.id]: false })); };
                  const changeSelection = (direction) => setPreviewUniverse(library[(activeIndex + direction + library.length) % library.length].id);
                  const visuals = getVisuals(active);
                  const relativeIndex = (index) => {
                    const offset = (index - activeIndex + library.length) % library.length;
                    return offset > library.length / 2 ? offset - library.length : offset;
                  };
                  return <section aria-label={ui('Universe selection', 'Sélection des univers')} className="relative isolate min-h-[660px] overflow-hidden bg-[#05080d] text-white lg:min-h-0">
                    <div className="pointer-events-none absolute inset-0 -z-30">
                      <div className="h-full w-full bg-[radial-gradient(ellipse_at_75%_85%,rgba(46,66,70,0.22),transparent_55%),linear-gradient(125deg,#020508,#0b1116_65%,#05070a)]" />
                    </div>
                    <div className="pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(0deg,#030608_0%,rgba(3,6,8,0.25)_42%,rgba(3,6,8,0.82)_100%)]" />
                    <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_50%_45%,transparent_5%,rgba(0,0,0,0.7)_100%)]" />
                    <div className="pointer-events-none absolute inset-0 -z-10 opacity-25" style={{backgroundImage:'linear-gradient(90deg,transparent 49.9%,rgba(75,234,218,0.12) 50%,transparent 50.1%)',backgroundSize:'70px 100%'}} />
                    <div className="flex min-h-[660px] flex-col lg:min-h-[480px]">
                      <header className="flex items-center justify-between gap-4 px-5 pb-4 pt-6 sm:px-10 sm:pt-8 lg:px-8 lg:pb-2 lg:pt-5">
                        <div className="flex items-center gap-3">
                          <span className="relative flex h-8 w-8 items-center justify-center border border-[#6fece1]/65 bg-[#24c8bd]/15"><span className="h-2.5 w-2.5 rotate-45 bg-[#7cf5eb] shadow-[0_0_17px_#4dd9cf]"/></span>
                          <div><p className="text-sm font-black uppercase tracking-[0.25em] text-white">AI PILOTS</p><p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-white/45">{ui('World selection', 'Sélection des mondes')}</p></div>
                        </div>
                        <div className="font-mono text-xs tracking-[0.2em] text-white/65">{String(activeIndex+1).padStart(2,'0')} <span className="text-[#65dcd2]">/</span> {String(library.length).padStart(2,'0')}</div>
                      </header>
                      <div className="flex flex-1 flex-col items-center justify-center px-3 pb-4 pt-3 sm:px-8 lg:hidden">
                        <div className="text-center">
                          <p className="text-[10px] font-black uppercase tracking-[0.32em] text-[#8df5e9]">{ui('Choose your story', 'Choisissez votre histoire')}</p>
                          <div className="mx-auto mt-3 h-px w-24 bg-gradient-to-r from-transparent via-[#57dbd0] to-transparent" />
                        </div>
                        <div className="relative mt-4 flex h-[310px] w-full max-w-[1100px] items-center justify-center sm:h-[400px] lg:h-[450px]" style={{perspective:'1100px'}}>
                          {library.map((entry,index) => {
                            const offset = relativeIndex(index);
                            const chosen = offset === 0;
                            const visible = Math.abs(offset) <= 2;
                            const art = getImage(entry,'card');
                            const translation = `translateX(${offset * 75}%) translateZ(${chosen ? '65px' : '-185px'}) rotateY(${offset * -20}deg) scale(${chosen ? 1 : 0.78})`;
                            return <button key={entry.id} type="button" onClick={() => { if (chosen) enter(); else setPreviewUniverse(entry.id); }} aria-label={chosen ? ui('Enter the universe','Entrer dans l’univers') + ': ' + getTitle(entry) : getTitle(entry)} aria-current={chosen ? 'true' : undefined} className={`absolute left-1/2 top-1/2 flex h-[255px] w-[185px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden border text-left shadow-[0_30px_75px_rgba(0,0,0,0.8)] transition-[transform,opacity,border-color] duration-500 ease-out sm:h-[355px] sm:w-[258px] lg:h-[390px] lg:w-[280px] ${chosen ? 'border-[#91f5e9] bg-[#112027] shadow-[0_0_0_1px_rgba(94,240,225,0.65),0_25px_85px_rgba(0,0,0,0.9),0_0_45px_rgba(35,199,190,0.15)]' : 'border-white/25 bg-[#0b1118] hover:border-white/70'}`}
                              style={{transform:`translate(-50%, -50%) ${translation}`,opacity:visible ? chosen ? 1 : 0.55 : 0,pointerEvents:visible ? 'auto' : 'none',zIndex:10-Math.abs(offset)}}>
                              {art ? <img src={art} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" /> : <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(ellipse_at_top,#254853,#090d12)]"><Bot size={58} className="text-white/20" /></div>}
                              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20" />
                              <div className="relative mt-auto p-3 sm:p-4">
                                <span className="text-[9px] font-bold uppercase tracking-[0.19em] text-[#77eadf]">{ui('Universe', 'Univers')} {String(index+1).padStart(2,'0')}</span>
                                <h3 className="mt-1 line-clamp-2 text-lg font-black uppercase leading-tight drop-shadow-[0_3px_8px_black] sm:text-xl">{getTitle(entry)}</h3>
                              </div>
                              {chosen && <span className="absolute right-2 top-2 border border-[#7befdf] bg-black/70 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#91f6e9]">{ui('Selected', 'Sélectionné')}</span>}
                            </button>;
                          })}
                          {library.length > 1 && <>
                            <button type="button" onClick={() => changeSelection(-1)} aria-label={ui('Previous universe','Univers précédent')} className="absolute bottom-0 left-2 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-black/65 text-white backdrop-blur hover:border-[#83f0e5] hover:text-[#83f0e5] sm:bottom-auto sm:left-4"><ChevronLeft size={25}/></button>
                            <button type="button" onClick={() => changeSelection(1)} aria-label={ui('Next universe','Univers suivant')} className="absolute bottom-0 right-2 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-black/65 text-white backdrop-blur hover:border-[#83f0e5] hover:text-[#83f0e5] sm:bottom-auto sm:right-4"><ChevronDown size={25} className="-rotate-90"/></button>
                          </>}
                        </div>
                        <div key={'world-title-'+active.id} className="relative z-30 mt-3 w-full max-w-3xl animate-[world-fade_500ms_ease-out_both] px-3 text-center">
                          {visuals.logo_image ? <img src={visuals.logo_image} alt={getTitle(active)} className="mx-auto max-h-16 max-w-[70%] object-contain" /> : <h2 className="text-3xl font-black uppercase tracking-[-0.035em] drop-shadow-[0_3px_18px_black] sm:text-4xl">{getTitle(active)}</h2>}
                          {getDescription(active) && <p className="mx-auto mt-2 line-clamp-2 max-w-lg text-sm leading-relaxed text-white/75">{getDescription(active)}</p>}
                          <button type="button" onClick={enter} className="group mx-auto mt-5 inline-flex min-h-14 items-center gap-8 border border-[#95f3e7] bg-[#23c7be] px-8 py-3 text-sm font-black uppercase tracking-[0.12em] text-[#041011] shadow-[0_0_35px_rgba(35,199,190,0.28)] transition-all hover:scale-[1.04] hover:bg-[#96f7e9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{ui('Enter the universe', 'Entrer dans l’univers')} <ChevronDown size={19} className="-rotate-90"/></button>
                        </div>
                      </div>
                      <div className="relative hidden min-h-[390px] flex-1 overflow-hidden lg:flex">
                        <div className="pointer-events-none absolute inset-0">
                          <div className="h-full w-full bg-[radial-gradient(ellipse_at_70%_70%,rgba(36,88,88,0.15),transparent_62%),linear-gradient(110deg,#030608,#10151b)]" />
                          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,5,8,0.95)_0%,rgba(2,5,8,0.75)_26%,rgba(2,5,8,0.30)_55%,rgba(2,5,8,0.50)_100%)]"/>
                        </div>
                        <nav aria-label={ui('Universe selection','Sélection des univers')} className="relative z-20 flex w-[31%] min-w-[250px] max-w-[355px] flex-col gap-3 border-r border-white/10 bg-black/50 px-5 py-5 xl:px-7">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7ce8df]">{ui('Choose your story','Choisissez votre histoire')}</p>
                          <div className="max-h-[238px] min-h-0 space-y-1 overflow-y-auto pr-1">
                            {library.map((entry,index) => {
                              const chosen = entry.id === active.id;
                              return <button key={entry.id} type="button" onClick={() => setPreviewUniverse(entry.id)} aria-current={chosen ? 'true' : undefined} className={`group flex w-full min-h-[53px] items-center gap-3 border-l-2 px-3 py-2 text-left transition-colors ${chosen ? 'border-[#6fece1] bg-white/10 text-white' : 'border-transparent text-white/65 hover:border-white/40 hover:bg-white/[0.06] hover:text-white'}`}>
                                <span className={`font-mono text-[10px] ${chosen ? 'text-[#7ce8df]' : 'text-white/35'}`}>{String(index + 1).padStart(2,'0')}</span>
                                {getImage(entry,'card') && <img src={getImage(entry,'card')} alt="" className="h-11 w-8 shrink-0 object-cover" loading="lazy" />}
                                <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold">{getTitle(entry)}</span>{getDescription(entry) && <span className="mt-0.5 block truncate text-[10px] font-normal text-white/45">{getDescription(entry)}</span>}</span>
                                {chosen && <ChevronDown size={14} className="-rotate-90 text-[#7ce8df]"/>}
                              </button>;
                            })}
                          </div>
                          <button type="button" onClick={enter} className="inline-flex min-h-10 items-center justify-between gap-3 border border-[#6fece1]/60 bg-[#23c7be]/15 px-4 text-left text-[11px] font-bold uppercase tracking-[0.07em] text-[#9cf8ed] transition-colors hover:bg-[#23c7be]/25">{ui('Enter the universe','Entrer dans l’univers')}<ChevronDown size={16} className="-rotate-90"/></button>
                        </nav>
                        <div className="relative z-10 flex min-w-0 flex-1 items-center justify-center overflow-hidden px-5 py-5">
                          {cardImage && <div key={'art-'+active.id} className="pointer-events-none relative z-10 flex h-[330px] w-full max-w-[255px] items-center justify-center">
                            <img src={cardImage} alt={getTitle(active)} className="max-h-full max-w-full animate-[world-fade_700ms_ease-out_both] object-contain shadow-[0_16px_48px_rgba(0,0,0,0.65)]" />
                          </div>}
                        </div>
                      </div>
                      <footer className="flex items-center justify-between gap-3 border-t border-white/15 bg-black/45 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-white/55 sm:px-10">
                        <span>{ui('Explore · Create · Participate', 'Explorer · Créer · Participer')}</span>
                        <span>{ui('AI Pilots Worlds', 'Univers AI Pilots')}</span>
                      </footer>
                    </div>
                  </section>;
                })()}
                <style>{`@keyframes world-fade {from {opacity:0} to {opacity:1}} @media (prefers-reduced-motion:reduce) { .animate-\\[universe-reveal_650ms_ease-out_both\\], .animate-\\[universe-reveal_750ms_ease-out_both\\], .animate-\\[universe-reveal_900ms_ease-out_both\\] {animation:none!important} }`}</style>
              </>
            )}
          </>
        ) : (
          <>
            {(() => {
              const background = getImage(selected);
              const logo = getVisuals(selected).logo_image;
              const sections = [
                ['overview', ui('Explore universe', 'Explorer l’univers')],
                ['scenario', ui('Episodes & story', 'Épisodes et histoire')],
                ['characters', ui('Characters', 'Personnages')],
                ['sets', ui('Locations & sets', 'Lieux et décors')],
                ['direction', ui('Creative direction', 'Direction artistique')],
                ['additions', ui('My Story', 'Mon histoire')],
              ];
              const chooseSection = (section) => { setUniverseSection(section); setExpanded((current) => ({ ...current, [selected.id]: true })); };
              const back = () => { setSelectedUniverse(null); setUniverseSection(null); setExpanded((current) => ({ ...current, [selected.id]: false })); };
              return <div className="relative isolate h-[270px] w-full overflow-hidden border border-white/10 bg-[#100f10] text-white sm:h-[290px] lg:h-[310px]">
                {background ? <img src={background} alt="" className="pointer-events-none absolute inset-0 -z-30 h-full w-full object-cover object-center" /> : <div className="pointer-events-none absolute inset-0 -z-30 bg-[radial-gradient(ellipse_at_75%_35%,#384047,#14171b_60%,#07090b)]" />}
                <div className="pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(5,6,8,0.9)_0%,rgba(5,6,8,0.6)_28%,rgba(5,6,8,0.06)_73%)]" />
                <div className="pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(0deg,rgba(0,0,0,0.7)_0%,transparent_32%,rgba(0,0,0,0.2)_100%)]" />
                <div className="relative flex h-full items-start justify-between gap-3 px-4 py-3 sm:px-7 sm:py-4 lg:px-9">
                  <div className="w-[200px] shrink-0 sm:w-[240px]">
                    <p className="mb-2 text-[10px] font-medium tracking-[0.12em] text-white/65">AISTAGE.ONE / AI PILOTS</p>
                    <nav aria-label={ui('Universe menu', 'Menu de l’univers')} className="flex flex-col items-start gap-0.5">
                      {sections.map(([id,label]) => <button key={id} type="button" onClick={() => chooseSection(id)}
                        className={`group min-h-7 w-full max-w-[240px] border-l-2 px-2 py-1 text-left text-[11px] font-medium uppercase tracking-[0.06em] transition-all duration-200 sm:text-xs ${universeSection === id ? 'border-[#23c7be] bg-white/90 text-black' : 'border-transparent text-white/90 hover:border-white/80 hover:bg-white/15 hover:text-white'}`}>
                        {label}
                      </button>)}
                      <button type="button" onClick={() => navigate('/Salons?section=aipilots&pilotId=' + encodeURIComponent(selected.ai_pilot_id))} className="group min-h-7 w-full max-w-[240px] border-l-2 border-transparent px-2 py-1 text-left text-[11px] font-medium uppercase tracking-[0.06em] text-white/90 transition-all hover:border-white/80 hover:bg-white/15 hover:text-white sm:text-xs">{t('social.pilots.openCommunity', ui('Community', 'Communauté'))}</button>
                      <button type="button" onClick={back} className="mt-1 min-h-7 w-full max-w-[240px] border-l-2 border-transparent px-2 py-1 text-left text-[11px] font-medium uppercase tracking-[0.06em] text-white/85 transition-all hover:border-white/80 hover:bg-white/15 sm:text-xs">{ui('Back to universes', 'Retour aux univers')}</button>
                    </nav>
                  </div>
                  <div className="mt-auto mb-2 ml-auto flex max-w-[55%] flex-col items-end text-right">
                    {logo ? <img src={logo} alt={getTitle(selected)} className="max-h-20 max-w-full object-contain object-right drop-shadow-[0_4px_18px_rgba(0,0,0,0.9)]" /> : <h1 className="text-xl font-bold uppercase leading-tight tracking-[-0.02em] drop-shadow-[0_4px_22px_rgba(0,0,0,0.9)] sm:text-2xl lg:text-3xl">{getTitle(selected)}</h1>}
                    {getDescription(selected) && <p className="mt-1 max-w-[340px] truncate text-[11px] font-normal tracking-wide text-white/85 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] sm:text-xs" title={getDescription(selected)}>{getDescription(selected)}</p>}
                  </div>
                </div>
              </div>;
            })()}
            {universeSection && <section id="universe-content" className="mt-4 border border-white/10 bg-[#111418] p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3"><h2 className="text-lg font-semibold text-white">{ui('Universe', 'Univers')} / {getTitle(selected)}</h2><button type="button" onClick={() => setUniverseSection(null)} className="text-sm text-white/60 hover:text-white">{ui('Close', 'Fermer')} <X size={16} className="inline" /></button></div>
              <PilotDetails key={selected.id + ':' + universeSection} access={selected} user={user} onMessage={setMessage} userSets={mySets} initialSection={universeSection} hideTabs onOpenStoryTool={onOpenStoryTool} />
            </section>}
          </>
        )}
      </div>
    </div>
  );
}
