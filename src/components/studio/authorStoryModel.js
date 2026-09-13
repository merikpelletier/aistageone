export { VOICE_NAMES as AUTHOR_VOICES } from '@/lib/voiceCatalog.js';

export const IMAGE_TYPES = ['Wide shot', 'Full shot', 'Medium shot', 'Close-up', 'Detail shot', 'Aerial view', 'Other'];
export const TIME_OPTIONS = ['Dawn', 'Morning', 'Afternoon', 'Evening', 'Night', 'Late night'];
export const IMAGE_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3', '21:9'];

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
  comic_panel_count: 3,
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
  comic_panel_count: [2, 3, 4].includes(Number(segment?.comic_panel_count)) ? Number(segment.comic_panel_count) : 3,
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
  characters: [], locations: [], topics: [], chapters: [], status: 'draft',
  production_settings: emptyProductionSettings(),
  ...row,
  characters: Array.isArray(row.characters) ? row.characters : [],
  locations: Array.isArray(row.locations) ? row.locations : [],
  topics: Array.isArray(row.topics) ? row.topics : [],
  chapters: Array.isArray(row.chapters) ? row.chapters.map(normalizeChapter) : [],
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
