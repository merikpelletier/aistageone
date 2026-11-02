import { supabase } from '@/api/supabaseClient';

const COLLECTION_ALIASES = {
  looks: 'look',
  sets: 'set',
  locations: 'location',
  music_pieces: 'music_piece',
  character_styles: 'character_style',
  characters: 'character',
};

const singularize = (key) => {
  if (COLLECTION_ALIASES[key]) return COLLECTION_ALIASES[key];
  if (key.endsWith('ies')) return `${key.slice(0, -3)}y`;
  if (key.endsWith('s')) return key.slice(0, -1);
  return key;
};

const isSelectableItem = (value) => value && typeof value === 'object' && !Array.isArray(value) && (value.id || value.name || value.title || value.label);

const displayName = (item, fallback) => item?.name || item?.title || item?.label || fallback;

function extractBlockComponents(block, pilotName, access) {
  const results = [];
  const content = block?.content || {};

  if (block?.block_key === 'action-prompts' || block?.block_key === 'blocking-prompts') {
    const componentType = block.block_key === 'action-prompts' ? 'action_prompt' : 'blocking_prompt';
    const lines = String(content.text || '').split(/\n+/).map((line) => line.trim()).filter(Boolean);
    return lines.map((line, index) => ({
      key: `published:${block.id}:line:${index}`,
      source_kind: 'published',
      component_type: componentType,
      source_item_id: `line:${index}`,
      label: line,
      data: {},
      pilot: {
        id: access.ai_pilot_id,
        name: pilotName,
        member_ai_pilot_id: access.id,
        version_id: access.version_id,
      },
      block: {
        id: block.id,
        key: block.block_key,
        title: block.title,
        tool_targets: block.tool_targets || [],
      },
    }));
  }

  Object.entries(content).forEach(([key, value]) => {
    if (!Array.isArray(value)) return;

    value.forEach((item, index) => {
      if (!isSelectableItem(item)) return;
      const componentType = singularize(key);
      const sourceItemId = String(item.id || `${block.id}:${key}:${index}`);
      results.push({
        key: `published:${block.id}:${sourceItemId}`,
        source_kind: 'published',
        component_type: componentType,
        source_item_id: sourceItemId,
        label: displayName(item, `${block.title} ${index + 1}`),
        data: item,
        pilot: {
          id: access.ai_pilot_id,
          name: pilotName,
          member_ai_pilot_id: access.id,
          version_id: access.version_id,
        },
        block: {
          id: block.id,
          key: block.block_key,
          title: block.title,
          tool_targets: block.tool_targets || [],
        },
      });
    });
  });

  if (results.length === 0) {
    const scalarContent = Object.entries(content).filter(([, value]) => value !== null && value !== undefined && value !== '' && !Array.isArray(value));
    if (scalarContent.length) {
      results.push({
        key: `published:${block.id}`,
        source_kind: 'published',
        component_type: block.block_key,
        source_item_id: null,
        label: block.title,
        data: content,
        pilot: {
          id: access.ai_pilot_id,
          name: pilotName,
          member_ai_pilot_id: access.id,
          version_id: access.version_id,
        },
        block: {
          id: block.id,
          key: block.block_key,
          title: block.title,
          tool_targets: block.tool_targets || [],
        },
      });
    }
  }

  return results;
}

export async function getAIPilotComponentLibrary({ userId, componentType, toolKey } = {}) {
  if (!userId) return [];

  const { data: accessRows, error: accessError } = await supabase
    .from('member_ai_pilots')
    .select('*')
    .eq('user_id', userId)
    .order('granted_at', { ascending: false });
  if (accessError) throw accessError;
  if (!accessRows?.length) return [];

  const pilotIds = [...new Set(accessRows.map((row) => row.ai_pilot_id).filter(Boolean))];
  const versionIds = [...new Set(accessRows.map((row) => row.version_id).filter(Boolean))];
  const memberIds = accessRows.map((row) => row.id);

  const [pilotsResult, blocksResult, extensionsResult] = await Promise.all([
    supabase.from('ai_pilots').select('id,name,cover_url').in('id', pilotIds),
    supabase.from('ai_pilot_blocks').select('*').in('version_id', versionIds).eq('is_active', true).order('sort_order', { ascending: true }),
    supabase.from('member_ai_pilot_extensions').select('*').in('member_ai_pilot_id', memberIds).eq('is_active', true).order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
  ]);

  for (const result of [pilotsResult, blocksResult, extensionsResult]) if (result.error) throw result.error;

  const pilotMap = new Map((pilotsResult.data || []).map((pilot) => [pilot.id, pilot]));
  const accessByVersion = new Map(accessRows.map((access) => [access.version_id, access]));
  const published = [];

  (blocksResult.data || []).forEach((block) => {
    const access = accessByVersion.get(block.version_id);
    if (!access) return;
    const pilotName = pilotMap.get(access.ai_pilot_id)?.name || 'AI Pilot';
    published.push(...extractBlockComponents(block, pilotName, access));
  });

  const accessById = new Map(accessRows.map((access) => [access.id, access]));
  const personal = (extensionsResult.data || []).map((extension) => {
    const access = accessById.get(extension.member_ai_pilot_id);
    const pilot = access ? pilotMap.get(access.ai_pilot_id) : null;
    return {
      key: `member_extension:${extension.id}`,
      source_kind: 'member_extension',
      component_type: extension.extension_type,
      source_item_id: extension.id,
      member_extension_id: extension.id,
      label: extension.name,
      data: extension.content || {},
      pilot: {
        id: access?.ai_pilot_id,
        name: pilot?.name || 'AI Pilot',
        member_ai_pilot_id: extension.member_ai_pilot_id,
        version_id: access?.version_id,
      },
      block: null,
      tool_targets: extension.tool_targets || [],
      personal: true,
    };
  });

  return [...published, ...personal].filter((component) => {
    if (componentType && component.component_type !== componentType) return false;
    const targets = component.block?.tool_targets || component.tool_targets || [];
    if (toolKey && targets.length > 0 && !targets.includes(toolKey)) return false;
    return true;
  });
}

export async function getAIPilotSelections({ userId, projectId, toolKey } = {}) {
  if (!userId || !projectId) return [];
  let query = supabase
    .from('ai_pilot_component_selections')
    .select('*')
    .eq('user_id', userId)
    .eq('project_id', String(projectId))
    .eq('is_active', true)
    .order('selected_at', { ascending: true });
  if (toolKey) query = query.eq('tool_key', toolKey);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function selectAIPilotComponent({ userId, projectId, toolKey, slotKey, component }) {
  if (!userId || !projectId || !component?.pilot?.member_ai_pilot_id || !component?.pilot?.id || !component?.pilot?.version_id) {
    throw new Error('Incomplete AI Pilot component selection.');
  }

  const payload = {
    user_id: userId,
    project_id: String(projectId),
    tool_key: toolKey || null,
    slot_key: slotKey || null,
    component_type: component.component_type,
    source_kind: component.source_kind,
    member_ai_pilot_id: component.pilot.member_ai_pilot_id,
    ai_pilot_id: component.pilot.id,
    version_id: component.pilot.version_id,
    block_id: component.block?.id || null,
    source_item_id: component.source_item_id || null,
    member_extension_id: component.member_extension_id || null,
    label: component.label || null,
    metadata: {
      pilot_name: component.pilot.name,
      block_key: component.block?.key || null,
      component: component.data || {},
    },
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('ai_pilot_component_selections').insert(payload).select('*').single();
  if (error) throw error;
  return data;
}

export async function removeAIPilotSelection({ userId, selectionId }) {
  if (!userId || !selectionId) return;
  const { error } = await supabase
    .from('ai_pilot_component_selections')
    .delete()
    .eq('id', selectionId)
    .eq('user_id', userId);
  if (error) throw error;
}
