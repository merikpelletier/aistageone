import React, { useState } from 'react';
import { supabase } from '@/api/base44Client';
import { ChevronDown, ChevronRight, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import AIPilotDirectionEditorBase from './AIPilotDirectionEditorBase';

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
  ['setup', 'Part 1 · Setup', '0–30 seconds · Establish the situation'],
  ['development', 'Part 2 · Development', '30–60 seconds · Develop the conflict'],
  ['turn', 'Part 3 · Turning Point', '60–90 seconds · Introduce a change or escalation'],
  ['hook', 'Part 4 · Hook', '90–120 seconds · End with a payoff or forward hook'],
];

function ScenarioEditor({ block, setBlock, readOnly, onSave, saving, availableCharacters = [], availableSets = [] }) {
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
    const sets = availableSets.filter((item) => (selected.set_ids || []).includes(item.id)).map((item) => item.name);
    setGenerationError('');
    setGenerating(`shots-${episodeIndex}-${key}`);
    try {
      const schema = { type: 'object', properties: { shots: { type: 'array', items: { type: 'object', properties: { shot_type: { type: 'string' }, duration: { type: 'integer' }, action: { type: 'string' }, camera: { type: 'string' } }, required: ['shot_type', 'duration', 'action', 'camera'] } } }, required: ['shots'] };
      const { data, error } = await supabase.functions.invoke('invoke-llm', { body: {
        instructions: 'You are a film director preparing a practical video shot list. No music inside clips. Use one stable framing per video clip, with shots between 5 and 30 seconds. Never invent cast members or locations. Return JSON only.',
        response_json_schema: schema,
        prompt: `Produce 2 to 6 video clips for this scene, total approximately 30 seconds. Allowed shot types: ${SHOT_TYPES.join(', ')}. Allowed durations: ${CLIP_DURATIONS.join(', ')} seconds. Episode: ${ep.title || ''}. Story: ${ep.outline || ''}. Scene: ${ep.parts?.[key] || ''}. Characters: ${characters.join(', ') || 'none selected'}. Sets: ${sets.join(', ') || 'none selected'}. Preserve the scene's exact narrative and casting.`,
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
    const references = [
      ...availableCharacters.filter((item) => (resources.character_ids || []).includes(item.id)),
      ...availableSets.filter((item) => (resources.set_ids || []).includes(item.id)),
    ].flatMap((item) => Array.isArray(item.reference_images) ? item.reference_images : [])
      .map((item) => typeof item === 'string' ? item : item?.url).filter(Boolean).slice(0, 14);
    setGenerationError('');
    setGenerating(`frame-${shot.id}`);
    try {
      const prompt = [
        'CREATE EXACTLY ONE FRAME FROM THE SPECIFIC SHOT INSTRUCTIONS BELOW. This is a single camera setup, NOT a montage, sequence, scene overview, or general illustration of the episode.',
        'MANDATORY COMPOSITION AND FRAMING (higher priority than reference-image composition):',
        `Camera framing: ${shot.shot_type || 'Medium Shot'}.`,
        `Camera angle, positioning and composition: ${shotCamera || 'Eye-level, static composition appropriate to the specified framing.'}.`,
        `EXACT ACTION AND MOMENT TO DEPICT: ${shotAction}.`,
        'Depict only the precise moment described in EXACT ACTION. Frame the subjects according to Camera framing and Camera angle, positioning and composition. Do not portray other actions or moments from the overall scene.',
        `Eligible scene characters (include only those required for this specific shot): ${availableCharacters.filter((item) => (resources.character_ids || []).includes(item.id)).map((item) => item.name).join(', ') || 'none selected'}.`,
        `Eligible set references: ${availableSets.filter((item) => (resources.set_ids || []).includes(item.id)).map((item) => item.name).join(', ') || 'not selected'}.`,
        'Reference images establish ONLY the appearance of characters, wardrobe, props and environment. Never copy their camera angle, subject placement, pose or framing when these conflict with the shot instructions.',
        'Style: clean expressive monochrome pencil-sketch cinematic storyboard illustration, not photorealistic. Exactly one panel, 16:9. No grid, multiple panels, captions, lettering, logos or unrelated activity.',
      ].join('\\n');
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
    return (
      <div className="space-y-3 border border-white/10 bg-white/[0.02] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><div className="text-sm text-white">Shoot · Shot Plan / Storyboard</div><div className="text-[11px] text-white/40">Multiple independent shots per segment, each with its own framing and 5–30 second duration. Storyboard images are previews only, never production references.</div></div>
          {!readOnly && <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={() => proposeShots(episodeIndex, key)}>Propose Shots</Button>
            <Button type="button" size="sm" className={SECONDARY_BUTTON_CLASS} onClick={() => updateShots(episodeIndex, key, [...shots, { id: makeId('shot'), shot_type: 'Medium Shot', duration: 5, action: '', camera: '', dialogue: '', storyboard_url: '' }])}><Plus size={13} className="mr-1" /> Add Shot</Button>
          </div>}
        </div>
        {shots.map((shot, shotIndex) => (
          <div key={shot.id} className="border border-white/10 p-3 space-y-2">
            <div className="flex justify-between items-center text-xs text-white/65"><span>Shot {shotIndex + 1}</span>{!readOnly && <button type="button" onClick={() => updateShots(episodeIndex, key, shots.filter((item) => item.id !== shot.id))} aria-label="Remove shot"><Trash2 size={14} /></button>}</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-white/60">Framing
                <select value={shot.shot_type || 'Medium Shot'} disabled={readOnly} onChange={(event) => updateShot(shot.id, { shot_type: event.target.value, storyboard_url: '' })} className="block mt-1 w-full min-h-9 bg-black border border-white/20 text-white px-2">
                  {SHOT_TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
              <label className="text-xs text-white/60">Clip duration
                <select value={shot.duration || 5} disabled={readOnly} onChange={(event) => updateShot(shot.id, { duration: Number(event.target.value) })} className="block mt-1 w-full min-h-9 bg-black border border-white/20 text-white px-2">
                  {CLIP_DURATIONS.map((duration) => <option key={duration} value={duration}>{duration} sec</option>)}
                </select>
              </label>
            </div>
            <label className="text-xs text-white/60 block">Action
              <Textarea className={CONTROL_CLASS} rows={2} disabled={readOnly} value={shot.action || ''} onChange={(event) => updateShot(shot.id, { action: event.target.value, storyboard_url: '' })} />
            </label>
            <label className="text-xs text-white/60 block">Camera / positioning
              <Textarea className={CONTROL_CLASS} rows={2} disabled={readOnly} value={shot.camera || ''} onChange={(event) => updateShot(shot.id, { camera: event.target.value, storyboard_url: '' })} />
            </label>
            <div className="space-y-2 border border-white/10 bg-white/[0.02] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><div className="text-xs text-white">Shot Dialogue</div><div className="text-[11px] text-white/40">Dialogue belongs to this shot and must fit its duration. Editable or optional.</div></div>
                {!readOnly && <Button type="button" size="sm" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={() => proposeDialogue(episodeIndex, key, shot)}>{generating === `dialogue-${shot.id}` ? 'Generating…' : 'Propose Dialogue'}</Button>}
              </div>
              <Textarea className={CONTROL_CLASS} rows={3} disabled={readOnly} value={shot.dialogue || ''} onChange={(event) => updateShot(shot.id, { dialogue: event.target.value })} placeholder="Dialogue for this shot (optional)" />
            </div>
            {shot.storyboard_url ? <img src={shot.storyboard_url} alt={`Illustrated storyboard shot ${shotIndex + 1}`} className="w-full max-w-md aspect-video object-contain bg-black border border-white/10" /> : <div className="w-full max-w-md aspect-video bg-black/40 border border-dashed border-white/15 flex items-center justify-center text-xs text-white/35">Illustrated preview not generated</div>}
            {!readOnly && <Button size="sm" type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={() => generateStoryboardFrame(episodeIndex, key, shot)}>{generating === `frame-${shot.id}` ? 'Generating…' : shot.storyboard_url ? 'Regenerate Illustration' : 'Generate Illustration'}</Button>}
          </div>
        ))}
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
        <div className="border border-white/10 bg-white/[0.03] p-3"><div className="text-2xl text-white">120s</div><div className="text-xs text-white/50">Recommended video episode</div></div>
        <div className="border border-white/10 bg-white/[0.03] p-3"><div className="text-2xl text-white">4 × 30s</div><div className="text-xs text-white/50">Individually publishable video parts</div></div>
      </div>
      {input('Central Theme / Creative Brief', content.creative_brief, (value) => updateContent({ creative_brief: value }), 5, 'The central season theme and how it affects the characters.')}
      <div className="border border-white/10 bg-white/[0.02] p-3 text-sm text-white/60">
        <div className="font-medium text-white">Production format guidance</div>
        <p className="mt-2">FotoPlay: nine image/dialogue segments per chapter. Audio drama and e-book: adapt the nine-chapter story to narration or text without fixed running time. Video: 120 seconds per episode, planned as four 30-second parts; Shoot and Timeline may extend the result.</p>
        <p className="mt-2 text-xs text-white/45">Video generation costs more. Plan reusable assets, images, narration and editing separately from newly generated video footage. This is guidance, not a credit estimate.</p>
      </div>
      <div>
        <div className="text-sm text-white">Season Episodes (9)</div>
        <p className="mt-1 text-xs text-white/40">Define each episode's narrative development. The four short-video parts guide the pacing without locking audio, e-book or FotoPlay into video timing.</p>
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
                  <div className="text-sm text-white">Video Breakdown · 4 × 30 seconds</div>
                  {VIDEO_PARTS.map(([key, label, helper]) => (
                    <div key={key} className="space-y-3 border-b border-white/10 pb-4 last:border-b-0 last:pb-0">
                      <label className="block space-y-1.5">
                        <span className="text-xs text-white/65">{label}</span>
                        <span className="block text-[11px] text-white/35">{helper}</span>
                        <Textarea className={CONTROL_CLASS} rows={3} disabled={readOnly} value={episode.parts?.[key] || ''} onChange={(e) => updateEpisode(index, { parts: { ...(episode.parts || {}), [key]: e.target.value } })} placeholder="Optional dramatic beats or shots for this part" />
                      </label>
                      {resourcePicker(episode, index, key, 'character_ids', 'Characters', availableCharacters)}
                      {resourcePicker(episode, index, key, 'set_ids', 'Sets', availableSets)}
                      {shotPlanner(episode, index, key)}
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
      {input('Freedom to Create', content.creative_freedom, (value) => updateContent({ creative_freedom: value }), 3, 'What the user may reinterpret or invent while preserving the series narrative framework.')}
      {!readOnly && <div className="flex justify-end"><Button className={PRIMARY_BUTTON_CLASS} onClick={onSave} disabled={saving}><Save size={15} className="mr-2" /> {saving ? 'Saving…' : 'Save Scenario'}</Button></div>}
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
