import React, { useState } from 'react';
import { supabase } from '@/api/base44Client';
import { ChevronDown, ChevronRight, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import AIPilotDirectionEditorBase from './AIPilotDirectionEditorBase';
import ScenarioSceneComposer from './ScenarioSceneComposer';

const CONTROL_CLASS = 'bg-black/20 border-white/15 text-white placeholder:text-white/25 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[var(--studio-accent)]';
const PRIMARY_BUTTON_CLASS = 'bg-[var(--studio-accent)] text-[#071211] border border-[var(--studio-accent)] hover:bg-[var(--studio-accent-hover)] hover:border-[var(--studio-accent-hover)]';
const SECONDARY_BUTTON_CLASS = 'bg-white/[0.04] text-white border border-white/15 hover:bg-white/[0.08] hover:border-white/25';
const REMOVE_BUTTON_CLASS = 'h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-md bg-transparent border-0 p-0 cursor-pointer hover:bg-white/[0.06]';

const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizePrompts = (content, prefix) => {
  if (Array.isArray(content?.prompts)) {
    return content.prompts.map((item, index) => ({
      id: item?.id || `${prefix}-${index + 1}`,
      name: item?.name || '',
      text: item?.text || '',
    }));
  }

  return String(content?.text || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({
      id: `${prefix}-legacy-${index + 1}`,
      name: '',
      text: line,
    }));
};

function PromptCollectionEditor({ block, setBlock, readOnly, onSave, saving }) {
  const isAction = block.block_key === 'action-prompts';
  const prefix = isAction ? 'action-prompt' : 'blocking-prompt';
  const singularLabel = isAction ? 'Action Prompt' : 'Blocking Prompt';
  const pluralLabel = isAction ? 'Action Prompts' : 'Blocking Prompts';
  const prompts = normalizePrompts(block.content || {}, prefix);
  const [expandedPromptId, setExpandedPromptId] = useState(null);

  const updatePrompts = (nextPrompts) => {
    setBlock({
      ...block,
      content: {
        ...(block.content || {}),
        text: '',
        prompts: nextPrompts,
      },
    });
  };

  const addPrompt = () => {
    const id = makeId(prefix);
    updatePrompts([...prompts, { id, name: '', text: '' }]);
    setExpandedPromptId(id);
  };

  const updatePrompt = (id, patch) => {
    updatePrompts(prompts.map((prompt) => prompt.id === id ? { ...prompt, ...patch } : prompt));
  };

  const removePrompt = (id) => {
    updatePrompts(prompts.filter((prompt) => prompt.id !== id));
    if (expandedPromptId === id) setExpandedPromptId(null);
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg text-white">{pluralLabel}</div>
          <div className="text-xs text-white/40 mt-1">Each prompt is stored and selectable as an independent AI Pilot component.</div>
        </div>
        {!readOnly && <Button size="sm" className={SECONDARY_BUTTON_CLASS} onClick={addPrompt}><Plus size={14} className="mr-1.5" /> Add {singularLabel}</Button>}
      </div>

      {!prompts.length && (
        <div className="border border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-white/35">
          No {pluralLabel.toLowerCase()} yet.
        </div>
      )}

      <div className="space-y-1.5">
        {prompts.map((prompt, index) => {
          const expanded = expandedPromptId === prompt.id;
          return (
            <div key={prompt.id} className="border border-white/10 bg-black/20">
              <div className="flex items-center gap-2 min-h-11 px-2">
                <button
                  type="button"
                  className="flex flex-1 min-w-0 items-center gap-2 text-left py-2"
                  onClick={() => setExpandedPromptId(expanded ? null : prompt.id)}
                >
                  {expanded ? <ChevronDown size={16} className="text-white/50 shrink-0" /> : <ChevronRight size={16} className="text-white/50 shrink-0" />}
                  <span className="text-sm text-white truncate">{prompt.name || `${singularLabel} ${index + 1}`}</span>
                  {!expanded && prompt.text && <span className="hidden md:block text-xs text-white/30 truncate">{prompt.text}</span>}
                </button>
                {!readOnly && <button type="button" className={REMOVE_BUTTON_CLASS} onClick={() => removePrompt(prompt.id)} title={`Remove ${singularLabel.toLowerCase()}`} aria-label={`Remove ${singularLabel.toLowerCase()}`}><Trash2 size={16} /></button>}
              </div>

              {expanded && (
                <div className="border-t border-white/10 p-3 space-y-3">
                  <label className="space-y-2 block">
                    <span className="text-xs text-white/55">Name</span>
                    <Input
                      className={CONTROL_CLASS}
                      disabled={readOnly}
                      placeholder={isAction ? 'e.g. Runway entrance, Confrontation, Reveal' : 'e.g. Two-shot confrontation, Group entrance, Cross-room movement'}
                      value={prompt.name || ''}
                      onChange={(event) => updatePrompt(prompt.id, { name: event.target.value })}
                    />
                  </label>

                  <label className="space-y-2 block">
                    <span className="text-xs text-white/55">Prompt</span>
                    <Textarea
                      className={CONTROL_CLASS}
                      rows={5}
                      disabled={readOnly}
                      placeholder={isAction ? 'Describe the reusable action direction.' : 'Describe the reusable staging, placement and movement direction.'}
                      value={prompt.text || ''}
                      onChange={(event) => updatePrompt(prompt.id, { text: event.target.value })}
                    />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!readOnly && <div className="flex justify-end"><Button className={PRIMARY_BUTTON_CLASS} onClick={onSave} disabled={saving}><Save size={15} className="mr-2" /> {saving ? 'Saving…' : `Save ${pluralLabel}`}</Button></div>}
    </div>
  );
}


const SHOT_TYPES = ['Establishing', 'Wide Shot', 'Full Shot', 'Medium Shot', 'Medium Close-Up', 'Close-Up', 'Extreme Close-Up', 'Two Shot', 'Over-the-Shoulder', 'POV', 'Insert / Detail', 'Reaction Shot'];
const CLIP_DURATIONS = [5, 10, 15, 20, 25, 30];
const EPISODE_COUNT = 9;
const VIDEO_PARTS = [
  ['setup', 'Scene 1 · Setup', 'Introduce the situation'],
  ['development', 'Scene 2 · Development', 'Develop the action'],
  ['turn', 'Scene 3 · Turning Point', 'Introduce a change or escalation'],
  ['hook', 'Scene 4 · Hook', 'End with a payoff or forward hook'],
];

function ScenarioEditor({ block, setBlock, readOnly, onSave, saving, availableCharacters = [], availableSets = [], availableLooks = [] }) {
  const content = block.content || {};
  const stored = Array.isArray(content.scenarios) ? content.scenarios : [];
  const episodes = Array.from({ length: EPISODE_COUNT }, (_, index) => stored[index] || { id: `episode-${index + 1}`, title: '', premise: '', outline: '', scene_ideas: '', creative_options: '', parts: {} });
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [generating, setGenerating] = useState('');
  const [generationError, setGenerationError] = useState('');
  const updateContent = (patch) => setBlock({ ...block, content: { ...content, ...patch } });
  const updateEpisode = (index, patch) => updateContent({
    scenarios: [...episodes.map((ep, i) => i === index ? { ...ep, ...patch } : ep), ...stored.slice(EPISODE_COUNT)],
  });
  const toggleSceneResource = (episodeIndex, partKey, field, resourceId) => {
    const episode = episodes[episodeIndex];
    const sceneResources = episode.scene_resources || {};
    const scene = sceneResources[partKey] || {};
    const selected = Array.isArray(scene[field]) ? scene[field] : [];
    const next = selected.includes(resourceId)
      ? selected.filter((id) => id !== resourceId)
      : [...selected, resourceId];
    updateEpisode(episodeIndex, {
      scene_resources: {
        ...sceneResources,
        [partKey]: { ...scene, [field]: next },
      },
    });
  };
  const resourcePicker = (episode, episodeIndex, partKey, field, label, options) => {
    const selected = episode.scene_resources?.[partKey]?.[field] || [];
    return (
      <div className="space-y-2">
        <div className="text-xs text-white/65">{label}</div>
        <div className="flex flex-wrap gap-2">
          {options.length ? options.map((option) => (
            <label key={option.id} className={`inline-flex items-center gap-2 border px-3 py-2 text-xs cursor-pointer ${selected.includes(option.id) ? 'border-[var(--studio-accent)] bg-white/[0.08] text-white' : 'border-white/15 text-white/60'}`}>
              <input type="checkbox" disabled={readOnly} checked={selected.includes(option.id)} onChange={() => toggleSceneResource(episodeIndex, partKey, field, option.id)} className="accent-teal-400" />
              {option.name}
            </label>
          )) : <span className="text-xs text-white/35">No {label.toLowerCase()} in this AI Pilot.</span>}
        </div>
      </div>
    );
  };
  const applyPartPatch = (episodeIndex, key, field, value) => {
    setBlock((current) => {
      const currentContent = current.content || {};
      const currentEpisodes = Array.isArray(currentContent.scenarios) ? [...currentContent.scenarios] : [];
      const original = currentEpisodes[episodeIndex] || { id: `episode-${episodeIndex + 1}`, parts: {} };
      currentEpisodes[episodeIndex] = { ...original, [field]: { ...(original[field] || {}), [key]: value } };
      return { ...current, content: { ...currentContent, scenarios: currentEpisodes } };
    });
  };
  const updateShots = (episodeIndex, key, shots) => applyPartPatch(episodeIndex, key, 'shot_plans', shots);
  const updateShotById = (episodeIndex, key, shotId, patch) => {
    setBlock((current) => {
      const currentContent = current.content || {};
      const scenarios = [...(currentContent.scenarios || [])];
      const episode = scenarios[episodeIndex] || { id: `episode-${episodeIndex + 1}` };
      const plans = episode.shot_plans || {};
      scenarios[episodeIndex] = {
        ...episode,
        shot_plans: {
          ...plans,
          [key]: (plans[key] || []).map((item) => item.id === shotId ? { ...item, ...patch } : item),
        },
      };
      return { ...current, content: { ...currentContent, scenarios } };
    });
  };
  const proposeDialogue = async (episodeIndex, key, shot) => {
    const ep = episodes[episodeIndex];
    if (shot.dialogue && !window.confirm('Replace the dialogue draft for this shot?')) return;
    const selected = ep.scene_resources?.[key]?.character_ids || [];
    const names = availableCharacters.filter((item) => selected.includes(item.id)).map((item) => item.name);
    setGenerationError('');
    setGenerating(`dialogue-${shot.id}`);
    try {
      const { data, error } = await supabase.functions.invoke('invoke-llm', { body: {
        instructions: 'You are an experienced screenwriter. Draft natural, concise dialogue for exactly ONE shot. Respect the shot duration and allow time for action. Use only selected speakers, preserve story and character identities. If this shot calls for silence, return an empty dialogue. Output dialogue with speaker labels only, no explanations.',
        prompt: `Series brief: ${content.creative_brief || ''}\nEpisode: ${ep.title || ''}\nPremise: ${ep.premise || ''}\nScene (${key}): ${ep.parts?.[key] || ''}\nShot framing: ${shot.shot_type || ''}\nShot length: ${shot.duration || 5} seconds\nShot action: ${shot.action || ''}\nCamera / blocking: ${shot.camera || ''}\nAvailable speakers: ${names.join(', ') || 'No characters selected; output no dialogue.'}\nProduce dialogue ONLY for this specific shot, not the entire segment.`,
      } });
      if (error) throw error;
      const result = typeof data === 'string' ? data : data?.text || data?.output;
      if (typeof result !== 'string') throw new Error('The text model did not return a dialogue draft.');
      updateShotById(episodeIndex, key, shot.id, { dialogue: result.trim() });
    } catch (error) { setGenerationError(error.message || 'Unable to propose shot dialogue.'); }
    finally { setGenerating(''); }
  };
  const proposeShots = async (episodeIndex, key) => {
    const ep = episodes[episodeIndex];
    const existing = ep.shot_plans?.[key] || [];
    if (existing.length && !window.confirm('Replace the existing shot plan for this part?')) return;
    const selected = ep.scene_resources?.[key] || {};
    const characters = availableCharacters.filter((item) => (selected.character_ids || []).includes(item.id)).map((item) => item.name);
    const sets = availableSets.filter((item) => (selected.set_ids || []).includes(item.id));
    setGenerationError('');
    setGenerating(`shots-${episodeIndex}-${key}`);
    try {
      const schema = { type: 'object', properties: { shots: { type: 'array', items: { type: 'object', properties: { shot_type: { type: 'string' }, duration: { type: 'integer' }, action: { type: 'string' }, camera: { type: 'string' } }, required: ['shot_type', 'duration', 'action', 'camera'] } } }, required: ['shots'] };
      const { data, error } = await supabase.functions.invoke('invoke-llm', { body: {
        instructions: 'You are a film director preparing a practical video shot list. No music inside clips. Use one stable framing per 5–30 second clip. All existing sets are LOCKED production assets: never invent, embellish, substitute, redesign or describe new scenery. Describe only framing, camera direction and character action inside the chosen sets. Never invent characters. Return JSON only.',
        response_json_schema: schema,
        prompt: `Produce 2 to 6 video clips for this scene, total approximately 30 seconds. Allowed shot types: ${SHOT_TYPES.join(', ')}. Allowed durations: ${CLIP_DURATIONS.join(', ')} seconds. Episode: ${ep.title || ''}. Story: ${ep.outline || ''}. Scene: ${ep.parts?.[key] || ''}. Characters: ${characters.join(', ') || 'none selected'}. Existing locked sets: ${sets.map((set) => `${set.name}: ${set.description || ''}`).join(' | ') || 'none selected'}. Do not invent any environmental details. Preserve the scene's exact narrative, original sets and casting.`,
      } });
      if (error) throw error;
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      if (!Array.isArray(parsed?.shots) || !parsed.shots.length) throw new Error('The text model returned no valid shot plan.');
      const shots = parsed.shots.slice(0, 6).map((item) => ({
        id: makeId('shot'),
        shot_type: SHOT_TYPES.includes(item.shot_type) ? item.shot_type : 'Medium Shot',
        duration: CLIP_DURATIONS.includes(Number(item.duration)) ? Number(item.duration) : 5,
        action: String(item.action || ''),
        camera: String(item.camera || ''),
        dialogue: '',
        set_id: sets.length === 1 ? sets[0].id : '',
        storyboard_url: '',
      }));
      updateShots(episodeIndex, key, shots);
    } catch (error) { setGenerationError(error.message || 'Unable to propose a shot plan.'); }
    finally { setGenerating(''); }
  };
  const generateStoryboardFrame = async (episodeIndex, key, shot) => {
    const ep = episodes[episodeIndex];
    const shotAction = String(shot.action || '').trim();
    const shotCamera = String(shot.camera || '').trim();
    if (!shotAction) {
      setGenerationError('Describe the specific action for this shot before generating its storyboard.');
      return;
    }
    const resources = ep.scene_resources?.[key] || {};
    const eligibleSets = availableSets.filter((item) => (resources.set_ids || []).includes(item.id));
    const set = shot.set_id ? eligibleSets.find((item) => item.id === shot.set_id) : (eligibleSets.length === 1 ? eligibleSets[0] : null);
    if (!set) {
      setGenerationError('Select a specific existing set for this shot before generating an illustration.');
      return;
    }
    const getUrls = (value) => (Array.isArray(value) ? value : [])
      .map((item) => typeof item === 'string' ? item : item?.url)
      .filter((url) => typeof url === 'string' && url.trim());
    const linked = set.linked_set;
    if (set.my_set_id && !linked) {
      setGenerationError('The linked My Set is unavailable. Reconnect it before generating this shot.');
      return;
    }
    const sheetViews = (linked?.reference_sheet?.views || []).map((view) => view?.url).filter(Boolean);
    const studioViews = (linked?.images || []).filter((url) => typeof url === 'string' && url.trim());
    const setReferences = [...new Set([...studioViews, ...sheetViews, ...getUrls(set.reference_images)])];
    const selectedViewUrl = shot.set_view_reference_url || '';
    if (linked && !selectedViewUrl) {
      setGenerationError('Choose a Camera View from the linked My Set before generating. Automatic mixed-angle references are disabled for linked Sets.');
      return;
    }
    if (selectedViewUrl && !/^https?:\/\//i.test(selectedViewUrl)) {
      setGenerationError('The selected Camera View is invalid. Choose a saved Set view again.');
      return;
    }
    const setViewReferences = selectedViewUrl ? [selectedViewUrl] : setReferences.slice(0, 1);
    const viewNames = ['Hero', 'Wide', 'Reverse', 'Left', 'Right', 'Detail', 'Day', 'Night'];
    const selectedViewIndex = studioViews.indexOf(selectedViewUrl);
    const selectedViewName = selectedViewIndex >= 0 ? viewNames[selectedViewIndex] || 'Custom View' : 'Saved Camera View';
    const sheetElements = (linked?.reference_sheet?.extracted_elements || []).filter((element) => element?.image_url);
    const selectedElementUrls = Array.isArray(shot.set_element_reference_urls) ? shot.set_element_reference_urls : [];
    const selectedElements = selectedElementUrls.map((url) => sheetElements.find((item) => item.image_url === url))
      .filter(Boolean);
    const elementReferences = selectedElementUrls.filter((url) => typeof url === 'string' && url.trim());
    if (!setViewReferences.length) {
      setGenerationError('This shot needs an existing Set reference image or a saved Set Reference Sheet.');
      return;
    }
    const eligibleCharacters = availableCharacters.filter((item) => (resources.character_ids || []).includes(item.id));
    const visibleCharacters = eligibleCharacters.filter((item) => (Array.isArray(shot.character_ids) ? shot.character_ids : eligibleCharacters.map((person) => person.id)).includes(item.id));
    const characterReferences = visibleCharacters.map((character) => ({
      character,
      urls: getUrls(character.reference_images),
      selectedUrl: shot.character_reference_urls?.[character.id] || '',
      selectedName: (Array.isArray(character.reference_images) ? character.reference_images : [])
        .find((image) => (typeof image === 'string' ? image : image?.url) === shot.character_reference_urls?.[character.id])?.name || '',
    }));
    if (characterReferences.some(({ urls }) => !urls.length)) {
      setGenerationError('A visible character has no reference image. Add one in AI Pilot Characters first.');
      return;
    }
    if (characterReferences.some(({ urls, selectedUrl }) => !selectedUrl || !urls.includes(selectedUrl))) {
      setGenerationError('Select a reference image for every visible character in this shot.');
      return;
    }
    // Every supplied image must have an explicit role in the same sequence sent to the model.
    // Names and database IDs alone do not tell an image model which picture depicts whom.
    const referenceEntries = [
      ...setViewReferences.map((url) => ({ url, kind: 'set', name: selectedViewName })),
      ...selectedElementUrls.map((url) => ({
        url, kind: 'prop',
        name: sheetElements.find((item) => item.image_url === url)?.name || 'Selected set object',
      })),
      ...characterReferences.map(({ character, selectedUrl, selectedName }) => ({
        url: selectedUrl, kind: 'character', name: character.name,
        look: selectedName || 'Unlabeled reference',
      })),
    ];
    const referenceUrls = referenceEntries.map((item) => item.url);
    if (new Set(referenceUrls).size !== referenceUrls.length) {
      setGenerationError('Two reference roles point to the same image. Select a distinct reference image for each character or set object before generating.');
      return;
    }
    const references = referenceUrls;
    if (references.length > 14) {
      setGenerationError('Too many visual references for one storyboard. Select fewer Set Reference Sheet elements; no references were silently discarded.');
      return;
    }
    const referenceManifest = referenceEntries.map((entry, index) => {
      const imageNumber = index + 1;
      if (entry.kind === 'set') return `IMAGE ${imageNumber}: SET CAMERA VIEW (${entry.name}). This image determines the environment, camera direction, perspective and architecture; it is not a character or accessory reference.`;
      if (entry.kind === 'prop') return `IMAGE ${imageNumber}: PHYSICAL SET OBJECT — ${entry.name}. Use this object's exact appearance if it is visible in the selected shot. Do not reinterpret it as the entire location.`;
      return `IMAGE ${imageNumber}: CHARACTER — ${entry.name}; SELECTED REFERENCE / LOOK — ${entry.look}. This image belongs ONLY to ${entry.name}; preserve the face, hair, outfit and body appearance shown. Never use this image for another character.`;
    }).join('\n');
    // Translate natural character names only in the outgoing generation prompt.
    // Stored Scenario text and the author's wording remain unchanged.
    const characterImageIds = referenceEntries
      .map((entry, index) => ({ ...entry, imageNumber: index + 1 }))
      .filter((entry) => entry.kind === 'character' && entry.name?.trim());
    const namesByLength = [...characterImageIds].sort((a, b) => b.name.length - a.name.length);
    const escapedNames = namesByLength.map((entry) => Array.from(entry.name)
      .map((char) => '[](){}.*+?^$|'.includes(char) || char.charCodeAt(0) === 92 ? String.fromCharCode(92) + char : char)
      .join(''));
    const characterNamePattern = escapedNames.length
      ? new RegExp(`(^|[^\\p{L}\\p{N}_])(${escapedNames.join('|')})(?=$|[^\\p{L}\\p{N}_])`, 'giu')
      : null;
    const identifyCharacters = (value) => {
      const source = String(value || '');
      if (!characterNamePattern) return source;
      return source.replace(characterNamePattern, (match, prefix, name) => {
        const found = namesByLength.find((entry) => entry.name.toLocaleLowerCase() === name.toLocaleLowerCase());
        return found ? `${prefix}${name} (IMAGE ${found.imageNumber})` : match;
      });
    };
    setGenerationError('');
    setGenerating(`frame-${shot.id}`);
    try {
      const prompt = [
        'STORYBOARD FOR ONE SPECIFIC SHOT. Follow the existing set and the exact selected reference image for each visible character. Do not invent or redesign scenery or wardrobe.',
        `FIXED SET (mandatory, not a suggestion): ${set.name}. ${linked?.description || set.description || ''}`,
        'REFERENCE IMAGE INDEX — THE NUMBER IS THE EXACT POSITION IN THE ATTACHED IMAGE ARRAY (starting at 1). Use this mapping rather than guessing identity from names, IDs or file URLs:',
        referenceManifest,
        'CAMERA / SET HIERARCHY: IMAGE 1 is the ONLY spatial authority for the environment and camera position. All subsequent images are props and character identity references — NOT alternate camera angles.',
        ...(selectedViewUrl ? [
          `LOCKED CAMERA VIEW: ${selectedViewName}. Preserve the SAME viewing direction, visible architecture, perspective, foreground, background and left/right relationships as reference image 1.`,
          'Do not reverse the viewpoint, turn the camera toward the opposite wall, switch to the building façade, invent another entrance or move the set to satisfy the action.',
          'If the described action occurs elsewhere or conflicts with the locked camera view, stage only the visible portion of that action from this viewpoint. Never relocate the camera or redesign the environment.',
        ] : [
          'Use reference image 1 as the authoritative set viewpoint, without combining or inventing alternate angles.',
        ]),
        ...(selectedElements.length ? [
          'LOCKED SET OBJECTS: Preserve the exact selected object references using the numbered IMAGE INDEX above. Never redesign or substitute them.',
        ] : []),
        `Position inside this locked set: ${identifyCharacters(shot.set_position || 'Use the exact area appropriate to the camera direction; do not invent a new area')}.`,
        `SHOT FRAMING: ${shot.shot_type || 'Medium Shot'}.`,
        `SHOT CAMERA AND COMPOSITION (subject framing and blocking only; may NOT change the locked viewpoint): ${identifyCharacters(shotCamera || 'Eye level, static')}.`,
        `EXACT MOMENT AND ACTION: ${identifyCharacters(shotAction)}.`,
        ...characterReferences.map(({ character }) =>
          `VISIBLE CHARACTER IN THE ACTION: ${character.name}. Bind this name only to its assigned CHARACTER IMAGE in the image index above. No swapping faces, outfits or character identities.`),
        'Only depict the specified shot action and the listed visible characters, in the selected set. Never add unspecified characters, costumes, furniture or architecture.',
        'The locked Set camera view controls viewpoint and perspective. Shot camera and framing text controls only the visible subjects within that view. Never let shot text override the Set view.',
        'ONE 16:9 cinematic pencil-sketch storyboard panel, not photorealistic. No text, labels, grids or montage.',
      ].join('\n');
      const { data, error } = await supabase.functions.invoke('generate-image', { body: {
        prompt, reference_image_urls: references, aspect_ratio: '16:9',
      } });
      if (error) throw error;
      const url = data?.url || data?.file_url;
      if (!url) throw new Error('The image service did not return an image.');
      setBlock((current) => {
        const nextContent = current.content || {};
        const nextEpisodes = [...(nextContent.scenarios || [])];
        const original = nextEpisodes[episodeIndex] || {};
        const plans = original.shot_plans || {};
        nextEpisodes[episodeIndex] = { ...original, shot_plans: { ...plans, [key]: (plans[key] || []).map((item) => item.id === shot.id ? { ...item, storyboard_url: url } : item) } };
        return { ...current, content: { ...nextContent, scenarios: nextEpisodes } };
      });
    } catch (error) { setGenerationError(error.message || 'Unable to generate storyboard image.'); }
    finally { setGenerating(''); }
  };
  const shotPlanner = (episode, episodeIndex, key) => {
    const shots = episode.shot_plans?.[key] || [];
    const updateShot = (id, patch) => updateShots(episodeIndex, key, shots.map((shot) => shot.id === id ? { ...shot, ...patch } : shot));
    const busy = Boolean(generating);
    const resources = episode.scene_resources?.[key] || {};
    const eligibleSets = availableSets.filter((item) => (resources.set_ids || []).includes(item.id));
    const eligibleCharacters = availableCharacters.filter((item) => (resources.character_ids || []).includes(item.id));
    return (
      <div className="space-y-3 border border-white/10 bg-white/[0.02] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><div className="text-sm text-white">Shot Plan · Scene Descriptions</div><div className="text-[11px] text-white/40">Existing shot details, camera direction, positioning, references and dialogues remain editable.</div></div>
          {!readOnly && <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={() => proposeShots(episodeIndex, key)}>Propose Shots</Button>
          </div>}
        </div>
        {shots.map((shot, shotIndex) => (
          <div key={shot.id} className="border border-white/10 p-3 space-y-2">
            <div className="flex justify-between items-center text-xs text-white/65"><span>Shot {shotIndex + 1}</span>{!readOnly && <button type="button" onClick={() => updateShots(episodeIndex, key, shots.filter((item) => item.id !== shot.id))} aria-label="Remove shot"><Trash2 size={14} /></button>}</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-white/60">Framing
                <select value={shot.shot_type || 'Medium Shot'} disabled={readOnly} onChange={(event) => updateShot(shot.id, { shot_type: event.target.value })} className="block mt-1 w-full min-h-9 bg-black border border-white/20 text-white px-2">
                  {SHOT_TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
              <label className="text-xs text-white/60">Clip duration
                <select value={shot.duration || 5} disabled={readOnly} onChange={(event) => updateShot(shot.id, { duration: Number(event.target.value) })} className="block mt-1 w-full min-h-9 bg-black border border-white/20 text-white px-2">
                  {CLIP_DURATIONS.map((duration) => <option key={duration} value={duration}>{duration} sec</option>)}
                </select>
              </label>
            </div>
            <div className="space-y-3 border border-white/10 bg-black/20 p-3">
              <label className="block text-xs text-white/60">Locked Set for this shot
                <select value={shot.set_id || (eligibleSets.length === 1 ? eligibleSets[0].id : '')} disabled={readOnly} onChange={(event) => updateShot(shot.id, { set_id: event.target.value, set_view_reference_url: '', set_element_reference_urls: [] })} className="block mt-1 w-full min-h-9 bg-black border border-white/20 text-white px-2">
                  <option value="">Select an existing set</option>
                  {eligibleSets.map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}
                </select>
              </label>
              {(() => {
                const selectedSetId = shot.set_id || (eligibleSets.length === 1 ? eligibleSets[0].id : '');
                const selectedSet = eligibleSets.find((item) => item.id === selectedSetId);
                const linked = selectedSet?.linked_set;
                if (!selectedSet) return null;
                const viewLabels = ['Hero', 'Wide', 'Reverse', 'Left', 'Right', 'Detail', 'Day', 'Night'];
                const mainViews = (Array.isArray(linked?.images) ? linked.images : [])
                  .map((image, index) => ({ url: typeof image === 'string' ? image : image?.url, label: viewLabels[index] || `View ${index + 1}` }));
                const sheetViews = (linked?.reference_sheet?.views || []).map((image, index) => ({
                  url: typeof image === 'string' ? image : image?.url,
                  label: image?.name || image?.label || `Reference Sheet View ${index + 1}`,
                }));
                const pilotViews = (selectedSet.reference_images || []).map((image, index) => ({
                  url: typeof image === 'string' ? image : image?.url,
                  label: image?.name || image?.label || `AI Pilot Set Reference ${index + 1}`,
                }));
                const views = [...new Map([...mainViews, ...sheetViews, ...pilotViews].filter(view => typeof view.url === 'string' && view.url.trim()).map(view => [view.url, view])).values()];
                const items = (linked?.reference_sheet?.extracted_elements || []).filter((element) => element?.image_url);
                const chosenUrls = Array.isArray(shot.set_element_reference_urls) ? shot.set_element_reference_urls : [];
                return <div className="space-y-2 border border-white/15 bg-white/[0.02] p-3">
                  <div className="text-xs font-semibold text-white/70">Set references · {linked?.name || selectedSet.name}</div>
                  <div className="space-y-2 border-b border-white/10 pb-3">
                    <p className="text-xs font-semibold text-white/70">Camera view for this shot</p>
                    <p className="text-[11px] text-white/45">Select the exact camera view for this shot. This view controls the generated composition.</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {views.map((view) => {
                        const selected = shot.set_view_reference_url === view.url;
                        return <button type="button" key={view.url} disabled={readOnly}
                          aria-pressed={selected}
                          onClick={() => updateShot(shot.id, { set_view_reference_url: view.url })}
                          className={`min-w-0 border p-2 text-left ${selected ? 'border-[var(--studio-accent)] bg-white/[0.07]' : 'border-white/15 hover:border-white/40'}`}>
                          <img src={view.url} alt={view.label + ' Set view'} className="h-24 w-full bg-black object-contain" />
                          <span className="mt-1 block text-xs text-white">{view.label}{selected ? ' ✓' : ''}</span>
                        </button>;
                      })}
                    </div>
                    {!views.length && <p className="text-xs text-white/45">No saved views on this Set yet.</p>}
                    {!!views.length && !shot.set_view_reference_url && <p className="text-[11px] text-amber-300">Choose a Camera View to generate the scene.</p>}
                  </div>
                  <p className="text-[11px] text-white/45">Select reference objects for this shot. Existing selected images are preserved.</p>
                  {!items.length ? <p className="text-xs text-white/45">This linked Set has no saved reference elements yet. Its principal views remain available.</p> :
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {items.map((element, index) => {
                        const checked = chosenUrls.includes(element.image_url);
                        return <label key={element.id || index} className={`cursor-pointer overflow-hidden border p-2 ${checked ? 'border-[var(--studio-accent)] bg-white/[0.07]' : 'border-white/15'}`}>
                          <div className="flex items-start gap-1.5 text-[11px] text-white/75">
                            <input type="checkbox" disabled={readOnly} checked={checked} onChange={(event) => {
                              const urls = event.target.checked
                                ? [...chosenUrls, element.image_url]
                                : chosenUrls.filter((url) => url !== element.image_url);
                              updateShot(shot.id, { set_element_reference_urls: [...new Set(urls)] });
                            }} />
                            <span className="min-w-0 break-words">{element.name || 'Reference element'}</span>
                          </div>
                          <img src={element.image_url} alt={element.name || 'Set reference'} className="mt-2 h-24 w-full bg-black object-contain" />
                        </label>;
                      })}
                    </div>}
                </div>;
              })()}
              <label className="block text-xs text-white/60">Position within selected set
                <Input className={CONTROL_CLASS + ' mt-1'} disabled={readOnly} value={shot.set_position || ''} onChange={(event) => updateShot(shot.id, { set_position: event.target.value })} placeholder="e.g. By the entrance" />
              </label>
              <div className="text-xs text-white/60">Visible Characters · Identified Look per Shot</div>
              {eligibleCharacters.map((character) => {
                const included = Array.isArray(shot.character_ids) ? shot.character_ids.includes(character.id) : true;
                const images = (Array.isArray(character.reference_images) ? character.reference_images : [])
                  .map((image, index) => ({
                    url: typeof image === 'string' ? image : image?.url,
                    name: typeof image === 'string' ? '' : String(image?.name || '').trim(),
                    index,
                  }))
                  .filter((image) => image.url);
                const chosenUrl = shot.character_reference_urls?.[character.id] || '';
                return (
                  <div key={character.id} className="space-y-2 border-b border-white/10 pb-3">
                    <label className="flex items-center gap-2 text-xs text-white/70">
                      <input type="checkbox" disabled={readOnly} checked={included} onChange={(event) => updateShot(shot.id, {
                        character_ids: event.target.checked
                          ? [...(Array.isArray(shot.character_ids) ? shot.character_ids : eligibleCharacters.map((item) => item.id)), character.id].filter((id, index, all) => all.indexOf(id) === index)
                          : (Array.isArray(shot.character_ids) ? shot.character_ids : eligibleCharacters.map((item) => item.id)).filter((id) => id !== character.id),
                      })} />
                      {character.name}
                    </label>
                    {included && (images.length ? (
                      <div className="flex flex-wrap gap-2">
                        {images.map(({ url, name, index }) => (
                          <button key={`${character.id}-${index}-${url}`} type="button" disabled={readOnly}
                            aria-label={`Select ${character.name} — ${name || `Reference ${index + 1}`}`}
                            aria-pressed={chosenUrl === url}
                            onClick={() => updateShot(shot.id, { character_reference_urls: { ...(shot.character_reference_urls || {}), [character.id]: url } })}
                            title={`${character.name} — ${name || `Reference ${index + 1}`}`}
                            className={`relative w-32 min-h-36 flex flex-col overflow-hidden border-2 bg-black text-left ${chosenUrl === url ? 'border-[var(--studio-accent)]' : 'border-white/20 hover:border-white/60'}`}>
                            <img src={url} alt={`${character.name} — ${name || `Reference ${index + 1}`}`} className="h-28 w-full object-contain" />
                            <span className="block w-full px-1.5 py-1 text-[10px] leading-4 text-white/80 break-words">{name || `Reference ${index + 1} (unnamed)`}</span>
                            {chosenUrl === url && <span className="absolute top-1 right-1 rounded-full bg-[var(--studio-accent)] text-black text-xs font-bold px-1.5">✓</span>}
                          </button>
                        ))}
                      </div>
                    ) : <div className="text-xs text-white/40">No reference photos. Add them under AI Pilot → Characters.</div>)}
                  </div>
                );
              })}
              {!eligibleCharacters.length && <div className="text-xs text-white/40">Choose characters for this segment first.</div>}
              {(() => {
                const selectedSet = eligibleSets.find((item) => item.id === (shot.set_id || (eligibleSets.length === 1 ? eligibleSets[0].id : '')));
                const linked = selectedSet?.linked_set;
                const viewNames = ['Hero', 'Wide', 'Reverse', 'Left', 'Right', 'Detail', 'Day', 'Night'];
                const studioViews = (linked?.images || []).filter((url) => typeof url === 'string' && url.trim());
                const selectedView = shot.set_view_reference_url || '';
                const selectedViewIndex = studioViews.indexOf(selectedView);
                const fallbackSetUrl = (selectedSet?.reference_images || []).map((image) => typeof image === 'string' ? image : image?.url).find(Boolean) || '';
                const setUrl = selectedView || (linked ? '' : (studioViews[0] || fallbackSetUrl));
                const selectedElements = (shot.set_element_reference_urls || []).map((url) => ({
                  url, kind: 'SET OBJECT', name: (linked?.reference_sheet?.extracted_elements || []).find((element) => element.image_url === url)?.name || 'Selected Set object',
                }));
                const visibleCharacters = eligibleCharacters.filter((person) => !Array.isArray(shot.character_ids) || shot.character_ids.includes(person.id));
                const selectedPeople = visibleCharacters.map((person) => {
                  const url = shot.character_reference_urls?.[person.id] || '';
                  const image = (person.reference_images || []).find((ref) => (typeof ref === 'string' ? ref : ref?.url) === url);
                  return { url, kind: 'CHARACTER', name: person.name, look: (typeof image === 'object' && image?.name) || 'Unlabeled look' };
                });
                const entries = [
                  ...(setUrl ? [{ url: setUrl, kind: 'SET CAMERA VIEW', name: selectedView ? (viewNames[selectedViewIndex] || 'Selected View') : 'Default Set reference' }] : []),
                  ...selectedElements,
                  ...selectedPeople.filter((person) => person.url),
                ];
                const missing = [
                  ...(!setUrl ? ['Camera View / Set image'] : []),
                  ...selectedPeople.filter((person) => !person.url).map((person) => person.name),
                ];
                const mapText = entries.map((entry, index) => `IMAGE ${index + 1} — ${entry.kind}: ${entry.name}${entry.look ? ` — ${entry.look}` : ''}`).join('\n');
                return <div className="space-y-2 border border-[var(--studio-accent)]/50 bg-white/[0.03] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">Reference IDs for this shot</p>
                    <button type="button" disabled={!entries.length} onClick={() => navigator.clipboard.writeText(mapText)}
                      className="border border-white/20 px-3 py-1.5 text-xs text-white hover:border-white/60 disabled:opacity-40">Copy reference IDs</button>
                  </div>
                  <p className="text-[11px] text-white/55">These references guide the scene generation. Set objects and hero looks retain their identities; numbering updates when selections change.</p>
                  {!!missing.length && <p className="text-xs text-amber-300">Select the missing references: {missing.join(', ')}</p>}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {entries.map((entry, index) => (
                      <div key={`${entry.url}-${index}`} className="flex items-center gap-2 border border-white/15 bg-black/30 p-2">
                        <img src={entry.url} alt={entry.name} className="h-20 w-16 shrink-0 bg-black object-contain" />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[var(--studio-accent)]">IMAGE {index + 1}</p>
                          <p className="text-[10px] text-white/60">{entry.kind}</p>
                          <p className="break-words text-xs text-white">{entry.name}</p>
                          {entry.look && <p className="break-words text-[11px] text-white/65">{entry.look}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                  {!entries.length && <p className="text-xs text-white/50">No selected references yet.</p>}
                </div>;
              })()}
            </div>
            <label className="text-xs text-white/60 block">Action
              <Textarea className={CONTROL_CLASS} rows={2} disabled={readOnly} value={shot.action || ''} onChange={(event) => updateShot(shot.id, { action: event.target.value })} />
            </label>
            <label className="text-xs text-white/60 block">Camera / positioning
              <Textarea className={CONTROL_CLASS} rows={2} disabled={readOnly} value={shot.camera || ''} onChange={(event) => updateShot(shot.id, { camera: event.target.value })} />
            </label>
            <div className="space-y-2 border border-white/10 bg-white/[0.02] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><div className="text-xs text-white">Shot Dialogue</div><div className="text-[11px] text-white/40">Dialogue belongs to this shot and must fit its duration. Editable or optional.</div></div>
                {!readOnly && <Button type="button" size="sm" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={() => proposeDialogue(episodeIndex, key, shot)}>{generating === `dialogue-${shot.id}` ? 'Generating…' : 'Propose Dialogue'}</Button>}
              </div>
              <Textarea className={CONTROL_CLASS} rows={3} disabled={readOnly} value={shot.dialogue || ''} onChange={(event) => updateShot(shot.id, { dialogue: event.target.value })} placeholder="Dialogue for this shot (optional)" />
            </div>
            <ScenarioSceneComposer
              shot={shot}
              episode={episode}
              partKey={key}
              selectedSet={eligibleSets.find((item) => item.id === (shot.set_id || (eligibleSets.length === 1 ? eligibleSets[0].id : '')))}
              visibleCharacters={eligibleCharacters.filter((person) => !Array.isArray(shot.character_ids) || shot.character_ids.includes(person.id))}
              readOnly={readOnly}
              onShotChange={(patch) => updateShotById(episodeIndex, key, shot.id, patch)}
            />
          </div>
        ))}
        {!readOnly && <div className="flex justify-end pt-2">
          <Button type="button" size="sm" className={SECONDARY_BUTTON_CLASS} onClick={() => updateShots(episodeIndex, key, [...shots, { id: makeId('shot'), shot_type: 'Medium Shot', duration: 5, action: '', camera: '', dialogue: '', storyboard_url: '' }])}><Plus size={13} className="mr-1" /> Add Shot</Button>
        </div>}
      </div>
    );
  };
  const input = (label, value, onChange, rows = 4, placeholder = '') => (
    <label className="block space-y-2">
      <span className="text-xs text-white/55">{label}</span>
      <Textarea className={CONTROL_CLASS} rows={rows} disabled={readOnly} placeholder={placeholder} value={value || ''} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <div className="text-lg text-white">Season Scenario</div>
        <p className="mt-1 text-xs text-white/45">One central theme develops through nine episodes or chapters and affects the lives of the characters. The creator chooses the production format.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="border border-white/10 bg-white/[0.03] p-3"><div className="text-2xl text-white">9</div><div className="text-xs text-white/50">Episodes / chapters per season</div></div>
        <div className="border border-white/10 bg-white/[0.03] p-3"><div className="text-2xl text-white">4</div><div className="text-xs text-white/50">Scene composition slots per episode</div></div>
        <div className="border border-white/10 bg-white/[0.03] p-3"><div className="text-2xl text-white">Set + Cast</div><div className="text-xs text-white/50">Real production references</div></div>
      </div>
      {input('Central Theme / Creative Brief', content.creative_brief, (value) => updateContent({ creative_brief: value }), 5, 'The central season theme and how it affects the characters.')}
      <div className="border border-white/10 bg-white/[0.02] p-3 text-sm text-white/60">
        <div className="font-medium text-white">Production format guidance</div>
        <p className="mt-2">Compose each scene from an existing Set camera view, cast references, background actors and placement directions. FotoPlay retains nine image/dialogue segments per chapter; Shoot manages video clips separately.</p>
        <p className="mt-2 text-xs text-white/45">Existing shot descriptions, camera directions, references and dialogues remain editable. Only storyboard illustration controls are hidden; scene generators are added separately.</p>
      </div>
      <div>
        <div className="text-sm text-white">Season Episodes (9)</div>
        <p className="mt-1 text-xs text-white/40">Define the episode and compose each scene with selected production references, independent of video clip durations.</p>
      </div>
      <div className="space-y-2">
        {episodes.map((episode, index) => {
          const expanded = expandedIndex === index;
          return (
            <div key={episode.id || index} className="border border-white/10 bg-black/20">
              <button type="button" onClick={() => setExpandedIndex(expanded ? null : index)} className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left">
                {expanded ? <ChevronDown size={16} className="shrink-0 text-white/50" /> : <ChevronRight size={16} className="shrink-0 text-white/50" />}
                <span className="shrink-0 text-xs font-semibold text-[var(--studio-accent)]">EP {index + 1}</span>
                <span className="min-w-0 truncate text-sm text-white">{episode.title || 'Untitled episode'}</span>
              </button>
              {expanded && <div className="space-y-4 border-t border-white/10 p-3">
                <label className="block space-y-2">
                  <span className="text-xs text-white/55">Episode / Chapter Title</span>
                  <Input className={CONTROL_CLASS} disabled={readOnly} value={episode.title || ''} onChange={(e) => updateEpisode(index, { title: e.target.value })} />
                </label>
                {input('Premise / Conflict', episode.premise, (value) => updateEpisode(index, { premise: value }), 3)}
                {input('Story Development', episode.outline, (value) => updateEpisode(index, { outline: value }), 5, 'How the season theme changes the situation and affects the characters in this episode.')}
                <div className="space-y-3 border border-white/10 p-3">
                  <div className="text-sm text-white">Scene Composition</div>
                  {VIDEO_PARTS.map(([key, label, helper]) => (
                    <div key={key} className="space-y-3 border-b border-white/10 pb-4 last:border-b-0 last:pb-0">
                      <label className="block space-y-1.5">
                        <span className="text-xs text-white/65">{label}</span>
                        <span className="block text-[11px] text-white/35">{helper}</span>
                        <Textarea className={CONTROL_CLASS} rows={3} disabled={readOnly} value={episode.parts?.[key] || ''} onChange={(e) => updateEpisode(index, { parts: { ...(episode.parts || {}), [key]: e.target.value } })} placeholder="What happens in this scene?" />
                      </label>
                      {resourcePicker(episode, index, key, 'character_ids', 'Characters', availableCharacters)}
                      {resourcePicker(episode, index, key, 'set_ids', 'Sets', availableSets)}
                      {shotPlanner(episode, index, key)}
}
                    </div>
                  ))}
                </div>
                {input('Scene Inspirations', episode.scene_ideas, (value) => updateEpisode(index, { scene_ideas: value }), 4)}
                {input('Creative Variations', episode.creative_options, (value) => updateEpisode(index, { creative_options: value }), 3)}
              </div>}
            </div>
          );
        })}
      </div>
      {generationError && <div role="alert" className="text-sm text-red-300 border border-red-400/30 p-3">{generationError}</div>}
    </div>
  );
}

export default function AIPilotDirectionEditor(props) {
  const blockKey = props.block?.block_key;
  if (blockKey === 'scenario') return <ScenarioEditor {...props} />;
  if (blockKey === 'action-prompts' || blockKey === 'blocking-prompts') {
    return <PromptCollectionEditor {...props} />;
  }
  return <AIPilotDirectionEditorBase {...props} />;
}
