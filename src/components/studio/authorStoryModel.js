import { base44 } from '@/api/base44Client';
export { VOICE_NAMES as AUTHOR_VOICES } from '@/lib/voiceCatalog.js';

export const IMAGE_TYPES = ['Wide shot', 'Full shot', 'Medium shot', 'Close-up', 'Detail shot', 'Aerial view', 'Other'];
export const TIME_OPTIONS = ['Dawn', 'Morning', 'Afternoon', 'Evening', 'Night', 'Late night'];
export const IMAGE_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3', '21:9'];

// FotoPlay frame generation is intentionally structured around cast directions.
// The existing workspace still owns the UI/state. This runtime layer only:
// 1) builds the hidden final image instruction deterministically from the existing
//    shot / ambience / cast-direction fields instead of asking a second LLM to
//    rewrite them;
// 2) maps supplied reference-image positions back to named characters at the
//    final GenerateImage call; and
// 3) removes redundant free-form fields from the visible FotoPlay frame workflow
//    without deleting legacy data.
const FOTOPLAY_VISUAL_MARKER = 'Create one precise English image prompt for ONLY this segment.';
const structuredPromptContexts = new Map();

const safeJson = (value, fallback = {}) => {
  try { return JSON.parse(value); } catch { return fallback; }
};

const promptSection = (prompt, startLabel, endLabel) => {
  const start = prompt.indexOf(startLabel);
  if (start < 0) return '';
  const from = start + startLabel.length;
  const end = endLabel ? prompt.indexOf(endLabel, from) : -1;
  return prompt.slice(from, end >= 0 ? end : undefined).trim();
};

const cleanText = (value) => typeof value === 'string' ? value.trim() : '';

function buildFotoPlayFrameInstruction(prompt) {
  const project = safeJson(promptSection(prompt, 'PROJECT:', '\nSEGMENT:'), {});
  const segment = safeJson(promptSection(prompt, 'SEGMENT:', '\nINHERITED:'), {});
  const directions = safeJson(promptSection(prompt, 'DIRECTIONS:', null), {});
  const characters = Array.isArray(project.characters) ? project.characters : [];
  const characterById = new Map(characters.map((character) => [character.id, character]));
  const selectedCharacterIds = Array.isArray(segment.character_ids) ? segment.character_ids : [];

  const castLines = selectedCharacterIds.map((id) => {
    const character = characterById.get(id) || { id, name: id };
    const direction = directions?.[id] || {};
    const parts = [
      cleanText(direction.position) && `Position/blocking: ${cleanText(direction.position)}`,
      cleanText(direction.action) && `Action: ${cleanText(direction.action)}`,
      cleanText(direction.expression) && `Expression/attitude: ${cleanText(direction.expression)}`,
      cleanText(direction.gaze) && `Gaze/interaction: ${cleanText(direction.gaze)}`,
    ].filter(Boolean);
    return `${character.name || id}: ${parts.length ? parts.join('; ') : 'Present in the frame; preserve the selected identity reference.'}`;
  });

  const ambience = [
    ...(Array.isArray(segment.time_periods) ? segment.time_periods : []),
    cleanText(segment.environment_direction),
    cleanText(segment.exact_area),
    cleanText(segment.fixed_set_elements),
  ].filter(Boolean).join('; ');

  const camera = [cleanText(segment.camera_angle), cleanText(segment.focus_direction)].filter(Boolean).join('; ');
  const shot = cleanText(segment.image_type) || 'Cinematic production still';

  const finalPrompt = [
    `SHOT: ${shot}`,
    ambience ? `AMBIENCE / BACKGROUND: ${ambience}` : '',
    camera ? `CAMERA: ${camera}` : '',
    castLines.length ? `CHARACTER DIRECTIONS — MANDATORY:\n${castLines.join('\n')}` : '',
    castLines.length > 1 ? 'INTERACTION LOCK — MANDATORY: Keep every named character attached to their own action, position, expression and gaze. Do not swap actions, expressions, positions, wardrobe or identity between characters.' : '',
    'REFERENCE LOCK — MANDATORY: Preserve the supplied actor identities and the selected production location. Character reference images define identity and current approved look; do not redesign them unless a new look reference has already been created and selected.',
    'Render one live-action cinematic production still with photographic realism. Do not add unselected people, text, captions, borders or graphic-design elements.',
  ].filter(Boolean).join('\n\n');

  structuredPromptContexts.set(finalPrompt, { project, segment, directions });
  if (structuredPromptContexts.size > 40) structuredPromptContexts.delete(structuredPromptContexts.keys().next().value);
  return { character_directions: directions, final_prompt: finalPrompt };
}

function referenceIdentityMap(context, referenceUrls) {
  if (!context || !Array.isArray(referenceUrls) || !referenceUrls.length) return '';
  const { project, segment } = context;
  const characters = Array.isArray(project?.characters) ? project.characters : [];
  const characterById = new Map(characters.map((character) => [character.id, character]));
  const selectedCharacterIds = Array.isArray(segment?.character_ids) ? segment.character_ids : [];
  const explicitMap = segment?.character_reference_images && typeof segment.character_reference_images === 'object'
    ? segment.character_reference_images
    : {};

  const lines = selectedCharacterIds.map((id) => {
    const character = characterById.get(id) || { id, name: id };
    const explicit = Array.isArray(explicitMap[id]) ? explicitMap[id] : [];
    const fallback = [
      character.active_look_reference_url,
      character.image_url,
      ...(Array.isArray(character.look_reference_images) ? character.look_reference_images : []),
      ...(Array.isArray(character.reference_images) ? character.reference_images : []),
    ].filter(Boolean);
    const candidates = explicit.length ? explicit : fallback;
    const positions = [...new Set(candidates.map((url) => referenceUrls.indexOf(url)).filter((index) => index >= 0).map((index) => index + 1))];
    return positions.length ? `${character.name || id} = supplied reference image${positions.length > 1 ? 's' : ''} #${positions.join(', #')}` : '';
  }).filter(Boolean);

  if (!lines.length) return '';
  return `REFERENCE IDENTITY MAP — MANDATORY:\n${lines.join('\n')}\nUse each mapped reference only for that named character. Never transfer one actor's face, body, wardrobe or identity to another actor.`;
}

function installFotoPlayStructuredPromptRuntime() {
  const core = base44?.integrations?.Core;
  if (!core || core.__fotoplayStructuredPromptRuntime) return;

  const originalInvokeLLM = typeof core.InvokeLLM === 'function' ? core.InvokeLLM.bind(core) : null;
  const originalGenerateImage = typeof core.GenerateImage === 'function' ? core.GenerateImage.bind(core) : null;
  if (!originalInvokeLLM || !originalGenerateImage) return;

  core.InvokeLLM = async (args = {}) => {
    const prompt = String(args?.prompt || '');
    if (prompt.includes(FOTOPLAY_VISUAL_MARKER) && prompt.includes('\nDIRECTIONS:')) {
      try { return buildFotoPlayFrameInstruction(prompt); }
      catch (error) { console.warn('FotoPlay structured frame prompt fallback:', error); }
    }
    return originalInvokeLLM(args);
  };

  core.GenerateImage = async (args = {}) => {
    const prompt = String(args?.prompt || '');
    let matchedPrompt = '';
    let context = null;
    for (const [candidate, candidateContext] of structuredPromptContexts.entries()) {
      if (prompt.includes(candidate)) { matchedPrompt = candidate; context = candidateContext; break; }
    }
    if (!matchedPrompt || !context) return originalGenerateImage(args);

    const identityMap = referenceIdentityMap(context, args.reference_image_urls);
    const nextPrompt = identityMap ? `${identityMap}\n\n${prompt}` : prompt;
    return originalGenerateImage({ ...args, prompt: nextPrompt });
  };

  core.__fotoplayStructuredPromptRuntime = true;
}

function installFotoPlayFrameUiCleanup() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const apply = () => {
    // Story beat is legacy in the structured frame workflow. Preserve its stored
    // value, but do not ask the author to repeat scene action here.
    document.querySelectorAll('textarea[placeholder="What happens and changes?"]').forEach((element) => {
      element.style.display = 'none';
      const section = element.closest('section');
      const heading = section?.querySelector('h4');
      if (heading?.textContent?.includes('1 · Action and narration')) heading.textContent = '1 · Narration';
    });

    // The final image instruction is now assembled from structured fields and
    // remains internal. Existing saved values are not deleted.
    document.querySelectorAll('textarea[placeholder="Final editable image prompt"], textarea[placeholder="Shared visual direction for every panel in this segment"]').forEach((element) => {
      element.style.display = 'none';
    });

    // One optional free-form look instruction remains for Create & use look.
    // Empty legacy look sub-fields are hidden; non-empty legacy values remain
    // visible so an existing project can still inspect or clear them safely.
    document.querySelectorAll('input[placeholder="Appearance"]').forEach((element) => {
      element.placeholder = 'New look instruction for Create & use look (optional)';
    });
    ['Clothes or costume', 'Injuries, blood, dirt, damage', 'Hair, makeup, accessories', 'Physical/emotional state'].forEach((placeholder) => {
      document.querySelectorAll(`input[placeholder="${placeholder}"]`).forEach((element) => {
        if (!element.value) element.style.display = 'none';
      });
    });

    document.querySelectorAll('input[placeholder="Light, weather, atmosphere"]').forEach((element) => {
      element.placeholder = 'Ambience / background';
    });

    // Keep the existing button and persistence path, but make its purpose clear:
    // it assembles the structured fields; it is no longer a free-form prompt writer.
    document.querySelectorAll('button').forEach((button) => {
      const label = button.textContent || '';
      if (label.includes('Build visual instruction')) {
        const price = label.includes('·') ? ` ·${label.split('·').slice(1).join('·')}` : '';
        button.textContent = `Apply frame directions${price}`;
      }
      if (label.includes('Build shared visual direction')) {
        const price = label.includes('·') ? ` ·${label.split('·').slice(1).join('·')}` : '';
        button.textContent = `Apply frame directions${price}`;
      }
    });
  };

  const start = () => {
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}

installFotoPlayStructuredPromptRuntime();
installFotoPlayFrameUiCleanup();

export const emptyProductionSettings = () => ({
  narrator_voice: '',
  narrator_language: 'en',
  narrator_locked: false,
});

export const newSegment = (number) => ({
  id: crypto.randomUUID(),
  number,
  summary: '',
  narration_text: '',
  narrator_voice: '',
  narration_versions: [],
  image_type: 'Wide shot',
  character_ids: [],
  location_ids: [],
  time_periods: [],
  transition_notes: '',
  exact_area: '',
  environment_direction: '',
  fixed_set_elements: '',
  location_reference_images: {},
  character_directions: {},
  character_reference_images: {},
  character_generated_reference_images: {},
  camera_angle: '',
  camera_composition: '',
  foreground_background: '',
  focus_direction: '',
  continuity_match: '',
  intentional_changes: '',
  forbidden_elements: '',
  image_instruction: '',
  image_url: '',
  image_versions: [],
  image_source_instruction: '',
  image_source_aspect_ratio: '',
  text_boxes: [],
  text_overlay_source_url: '',
  text_overlay_applied_signature: '',
  comic_panels: [],
  comic_page_source: '',
  visual_format: 'single',
  comic_panel_count: 1,
  narration_url: '',
  audio_versions: [],
  audio_source_text: '',
  audio_voice: '',
  audio_stale: false,
  status: 'draft',
});

export const normalizeSegment = (segment, index) => ({
  ...newSegment(index + 1),
  ...segment,
  number: index + 1,
  character_ids: Array.isArray(segment?.character_ids) ? segment.character_ids : [],
  location_ids: Array.isArray(segment?.location_ids) ? segment.location_ids : [],
  time_periods: Array.isArray(segment?.time_periods) ? segment.time_periods : [],
  narration_versions: Array.isArray(segment?.narration_versions) ? segment.narration_versions : [],
  image_versions: Array.isArray(segment?.image_versions) ? segment.image_versions : [],
  text_boxes: Array.isArray(segment?.text_boxes) ? segment.text_boxes : [],
  audio_versions: Array.isArray(segment?.audio_versions) ? segment.audio_versions : [],
  character_directions: segment?.character_directions && typeof segment.character_directions === 'object'
    ? segment.character_directions
    : {},
  character_reference_images: segment?.character_reference_images && typeof segment.character_reference_images === 'object'
    ? segment.character_reference_images
    : {},
  character_generated_reference_images: segment?.character_generated_reference_images && typeof segment.character_generated_reference_images === 'object'
    ? segment.character_generated_reference_images
    : {},
  location_reference_images: segment?.location_reference_images && typeof segment.location_reference_images === 'object'
    ? segment.location_reference_images
    : {},
  comic_panels: Array.isArray(segment?.comic_panels) ? segment.comic_panels : [],
  visual_format: segment?.visual_format === 'comic' ? 'comic' : 'single',
  comic_panel_count: segment?.visual_format === 'single'
    ? 1
    : ([1, 2, 3, 4].includes(Number(segment?.comic_panel_count)) ? Number(segment.comic_panel_count) : 3),
});

export const normalizeChapter = (chapter, index) => {
  const existing = Array.isArray(chapter?.segments) ? chapter.segments.slice(0, 9) : [];
  while (existing.length < 9) existing.push(newSegment(existing.length + 1));
  return {
    id: chapter?.id || crypto.randomUUID(),
    number: index + 1,
    title: chapter?.title || `Chapter ${index + 1}`,
    creation_mode: chapter?.creation_mode || 'manual',
    topic_id: chapter?.topic_id || null,
    brief: chapter?.brief || '',
    source_excerpt: chapter?.source_excerpt || '',
    image_aspect_ratio: chapter?.image_aspect_ratio || '16:9',
    master_reference_url: chapter?.master_reference_url || '',
    master_reference_source: chapter?.master_reference_source || '',
    master_reference_label: chapter?.master_reference_label || '',
    appearance_continuity: chapter?.appearance_continuity && typeof chapter.appearance_continuity === 'object'
      ? chapter.appearance_continuity
      : {},
    segments: existing.map(normalizeSegment),
  };
};

export const normalizeAuthorProject = (row = {}) => ({
  title: '', genre: '', story_description: '', tone_rules: '', story_rules: '', cover_image: '',
  author_name: '', contributors: [],
  characters: [], locations: [], topics: [], chapters: [], status: 'draft',
  production_settings: emptyProductionSettings(),
  ...row,
  characters: Array.isArray(row.characters) ? row.characters : [],
  locations: Array.isArray(row.locations) ? row.locations : [],
  topics: Array.isArray(row.topics) ? row.topics : [],
  chapters: Array.isArray(row.chapters) ? row.chapters.map(normalizeChapter) : [],
  contributors: Array.isArray(row.contributors) ? row.contributors : [],
  production_settings: { ...emptyProductionSettings(), ...(row.production_settings || {}) },
});

export const newChapter = (count, mode, topicId) => normalizeChapter({
  id: crypto.randomUUID(),
  number: count + 1,
  title: `Chapter ${count + 1}`,
  creation_mode: mode,
  topic_id: topicId || null,
  segments: Array.from({ length: 9 }, (_, index) => newSegment(index + 1)),
}, count);

export function saveVersion(list, value, extra = {}) {
  if (!value) return Array.isArray(list) ? list : [];
  const next = [...(Array.isArray(list) ? list : []), { value, saved_at: new Date().toISOString(), ...extra }];
  return next.slice(-20);
}

export function selectedItems(ids, items) {
  return (ids || []).map((id) => items.find((item) => item.id === id)).filter(Boolean);
}
