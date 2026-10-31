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

export function normalizeAIPilotToolKey(toolKey) {
  const normalized = String(toolKey || '').trim().toLowerCase();
  return TOOL_ALIASES[normalized] || normalized;
}

export function blockTargetsTool(block, toolKey) {
  const tool = normalizeAIPilotToolKey(toolKey);
  const targets = Array.isArray(block?.tool_targets) ? block.tool_targets : [];
  if (targets.length === 0) return true;

  return targets.some((target) => {
    const normalizedTarget = String(target || '').trim().toLowerCase();
    return normalizedTarget === '*' || normalizeAIPilotToolKey(normalizedTarget) === tool;
  });
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

export async function resolveAIPilotContext({ projectId, toolKey }) {
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

  const blocks = orderAIPilotBlocks((blocksResult.data || []).filter((block) => blockTargetsTool(block, tool)));

  return {
    active: true,
    project_id: project,
    tool_key: tool,
    assignment_id: assignment.id,
    activated_at: assignment.activated_at,
    pilot: pilotResult.data,
    version: versionResult.data,
    blocks,
  };
}
