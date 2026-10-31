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

export async function resolveAIPilotContext({ projectId, toolKey }) {
  const project = String(projectId || '').trim();
  const tool = normalizeAIPilotToolKey(toolKey);

  if (!project) throw new Error('AI Pilot resolver requires a project id.');
  if (!tool) throw new Error('AI Pilot resolver requires a tool key.');

  const { data, error } = await supabase.rpc('resolve_ai_pilot_context', {
    p_project_id: project,
    p_tool_key: tool,
  });

  if (error) throw error;

  if (!data?.active) {
    return {
      active: false,
      project_id: project,
      tool_key: tool,
      blocks: [],
    };
  }

  return {
    ...data,
    tool_key: normalizeAIPilotToolKey(data.tool_key || tool),
    blocks: Array.isArray(data.blocks) ? data.blocks : [],
  };
}
