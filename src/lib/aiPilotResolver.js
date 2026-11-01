import { supabase } from '@/api/supabaseClient';

const TOOL_ALIASES = {
  shoot: 'ai_video',
  video: 'ai_video',
  compose_scene: 'compose',
  'compose-scene': 'compose',
  text_to_speech: 'tts',
  'text-to-speech': 'tts',
  soundfx: 'sound_fx',
  'sound-fx': 'sound_fx',
  lipsync: 'lip_sync',
  'lip-sync': 'lip_sync',
};

export const AI_PILOT_TOOL_KEYS = [
  'fotoplay',
  'actor',
  'set',
  'compose',
  'ai_video',
  'lip_sync',
  'dubbing',
  'tts',
  'music',
  'sound_fx',
  'timeline',
  'layout',
  'pitch',
];

export const AI_PILOT_DEFAULT_ROUTES = {
  theme_bible: ['fotoplay', 'compose', 'ai_video', 'music', 'sound_fx', 'pitch'],
  look_bible: ['fotoplay', 'actor', 'set', 'compose', 'ai_video', 'layout', 'pitch'],
  production_direction: ['fotoplay', 'set', 'compose', 'ai_video', 'timeline', 'layout', 'pitch'],
  performance_direction: ['actor', 'compose', 'ai_video', 'dubbing', 'lip_sync'],
  voice_dialogue_direction: ['fotoplay', 'compose', 'ai_video', 'dubbing', 'tts', 'lip_sync'],
  music_direction: ['music', 'fotoplay', 'ai_video', 'timeline'],
  sound_direction: ['sound_fx', 'fotoplay', 'ai_video', 'timeline', 'dubbing'],
  episode_structure: ['fotoplay', 'timeline', 'pitch'],
  continuity_rules: ['fotoplay', 'actor', 'set', 'compose', 'ai_video', 'dubbing', 'tts', 'lip_sync', 'timeline', 'layout'],
  assets: ['actor', 'set', 'compose', 'ai_video', 'layout'],
  tool_direction: [],
  prompt_override: [],
  custom: [],
};

export function normalizeAIPilotToolKey(toolKey) {
  const normalized = String(toolKey || '').trim().toLowerCase();
  return TOOL_ALIASES[normalized] || normalized;
}

export function blockTargetsTool(block, toolKey) {
  const tool = normalizeAIPilotToolKey(toolKey);
  const explicitTargets = Array.isArray(block?.tool_targets)
    ? block.tool_targets.map(normalizeAIPilotToolKey).filter(Boolean)
    : [];

  if (explicitTargets.length > 0) {
    return explicitTargets.includes('*') || explicitTargets.includes(tool);
  }

  const defaultTargets = AI_PILOT_DEFAULT_ROUTES[block?.block_type] || [];
  return defaultTargets.includes(tool);
}

export function orderAIPilotBlocks(blocks = []) {
  return [...blocks].sort((a, b) => {
    const priorityDelta = Number(a?.priority ?? 100) - Number(b?.priority ?? 100);
    if (priorityDelta !== 0) return priorityDelta;

    const sortDelta = Number(a?.sort_order ?? 0) - Number(b?.sort_order ?? 0);
    if (sortDelta !== 0) return sortDelta;

    return String(a?.block_key || '').localeCompare(String(b?.block_key || ''));
  });
}

function normalizeProductionEntries(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
}

function scopeSeriesDirection(block, { locationId, setId }) {
  if (block?.block_key !== 'series-direction') {
    return { block, location: null, set: null };
  }

  const content = block.content && typeof block.content === 'object' ? block.content : {};
  const locations = normalizeProductionEntries(content.locations);
  const sets = normalizeProductionEntries(content.sets);
  const selectedSet = setId ? sets.find((item) => item.id === setId) || null : null;
  const selectedLocation = locationId
    ? locations.find((item) => item.id === locationId) || null
    : selectedSet?.location_id
      ? locations.find((item) => item.id === selectedSet.location_id) || null
      : null;

  if (!locationId && !setId) {
    return { block, location: null, set: null };
  }

  return {
    block: {
      ...block,
      content: {
        ...content,
        locations: selectedLocation ? [selectedLocation] : [],
        sets: selectedSet ? [selectedSet] : [],
      },
    },
    location: selectedLocation,
    set: selectedSet,
  };
}

export async function resolveAIPilotContext({ projectId, toolKey, locationId, setId }) {
  const project = String(projectId || '').trim();
  const tool = normalizeAIPilotToolKey(toolKey);

  if (!project) throw new Error('AI Pilot resolver requires a project id.');
  if (!tool) throw new Error('AI Pilot resolver requires a tool key.');

  const { data: assignment, error: assignmentError } = await supabase
    .from('ai_pilot_project_assignments')
    .select('id, ai_pilot_id, version_id, project_id, activated_at')
    .eq('project_id', project)
    .eq('is_active', true)
    .maybeSingle();

  if (assignmentError) throw assignmentError;

  if (!assignment) {
    return {
      active: false,
      project_id: project,
      tool_key: tool,
      blocks: [],
      production_selection: { location: null, set: null },
    };
  }

  const [pilotResult, versionResult, blocksResult] = await Promise.all([
    supabase
      .from('ai_pilots')
      .select('id, pilot_key, name, description, category, tags, cover_url')
      .eq('id', assignment.ai_pilot_id)
      .single(),
    supabase
      .from('ai_pilot_versions')
      .select('id, version_number, schema_version, published_at')
      .eq('id', assignment.version_id)
      .single(),
    supabase
      .from('ai_pilot_blocks')
      .select('id, block_key, block_type, title, content, tool_targets, priority, sort_order')
      .eq('version_id', assignment.version_id)
      .eq('is_active', true),
  ]);

  if (pilotResult.error) throw pilotResult.error;
  if (versionResult.error) throw versionResult.error;
  if (blocksResult.error) throw blocksResult.error;

  const routedBlocks = orderAIPilotBlocks((blocksResult.data || []).filter((block) => blockTargetsTool(block, tool)));
  let selectedLocation = null;
  let selectedSet = null;

  const blocks = routedBlocks.map((block) => {
    const scoped = scopeSeriesDirection(block, { locationId, setId });
    if (scoped.location) selectedLocation = scoped.location;
    if (scoped.set) selectedSet = scoped.set;
    return scoped.block;
  });

  return {
    active: true,
    project_id: project,
    tool_key: tool,
    assignment_id: assignment.id,
    activated_at: assignment.activated_at,
    pilot: pilotResult.data,
    version: versionResult.data,
    production_selection: {
      location: selectedLocation,
      set: selectedSet,
    },
    blocks,
  };
}
