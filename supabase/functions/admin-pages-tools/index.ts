import { createClient } from 'npm:@supabase/supabase-js@2.112.2';
import { serveWithCors } from '../_shared/adminFinanceCors.ts';
import { MODEL_OWNER, fail } from '../_shared/modelControlPolicy.ts';

const ALLOWED_MODELS = new Set(['anthropic/claude-sonnet-5', 'meta/codellama-70b-instruct']);
const cleanText = (value: unknown, max = 20_000) => String(value || '').trim().slice(0, max);
const plainObject = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

function serviceClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
}

async function identity(request: Request) {
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: request.headers.get('Authorization') || '' } }, auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) fail('Connexion requise', 401);
  if (data.user.app_metadata?.role !== 'admin') fail('Accès administrateur requis', 403);
  return data.user;
}

async function runCoder(model: string, prompt: string) {
  const token = Deno.env.get('REPLICATE_API_TOKEN');
  if (!token) fail('Replicate is not configured', 503);
  const response = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'wait=60' },
    body: JSON.stringify({ input: { prompt, system_prompt: 'You are the basic AISTAGE.ONE admin coder. Return only the requested JSON. Make one minimal targeted change and preserve existing behavior.', max_tokens: 6000, temperature: 0.1 } }),
  });
  let prediction = await response.json();
  if (!response.ok) fail(`Replicate error (${response.status}): ${prediction?.detail || prediction?.error || 'request failed'}`, 502);
  for (let attempt = 0; !['succeeded', 'failed', 'canceled'].includes(prediction.status) && attempt < 24; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const poll = await fetch(prediction.urls?.get || `https://api.replicate.com/v1/predictions/${prediction.id}`, { headers: { Authorization: `Bearer ${token}` } });
    prediction = await poll.json();
  }
  if (prediction.status !== 'succeeded') fail(`Replicate prediction ${prediction.status || 'timed out'}: ${prediction.error || ''}`, 502);
  return (Array.isArray(prediction.output) ? prediction.output.join('') : String(prediction.output || '')).trim();
}

function parseProposal(raw: string) {
  const unfenced = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start < 0 || end <= start) fail('The coder returned an invalid proposal', 502);
  try { return plainObject(JSON.parse(unfenced.slice(start, end + 1))); }
  catch { fail('The coder returned invalid JSON', 502); }
}

serveWithCors(async (request) => {
  const body = await request.json();
  const action = cleanText(body.action, 50);
  const service = serviceClient();

  if (action === 'runtime') {
    const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: request.headers.get('Authorization') || '' } }, auth: { persistSession: false },
    });
    const { data: runtimeIdentity } = await authClient.auth.getUser();
    const authenticated = Boolean(runtimeIdentity.user);
    const { data, error } = await service.from('admin_surface_setting').select('surface_type,surface_key,visible,active,look,configuration');
    if (error) fail('Runtime settings unavailable', 500);
    const settings = (data || []).map((item) => ({ ...item, configuration: item.surface_key === 'agent_bar' ? {
      pages: item.configuration?.pages || [], position: item.configuration?.position || 'top', label: item.configuration?.label || 'Production Assistant',
      placeholder: item.configuration?.placeholder || 'Ask the AI...', agent_name: item.configuration?.agent_name || 'production_assistant',
      ...(authenticated ? { model: item.configuration?.model || '', prompt: item.configuration?.prompt || '', permissions: item.configuration?.permissions || [], actions: item.configuration?.actions || [] } : {}),
    } : item.configuration }));
    return Response.json({ settings });
  }

  const user = await identity(request);
  if (action === 'overview') {
    const [settings, changes] = await Promise.all([
      service.from('admin_surface_setting').select('*').order('surface_type').order('label'),
      service.from('admin_code_change').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    if (settings.error || changes.error) fail('Admin settings unavailable', 500);
    return Response.json({ settings: settings.data || [], changes: changes.data || [] });
  }

  if (action === 'save') {
    const setting = plainObject(body.setting);
    const surfaceType = cleanText(setting.surface_type, 10);
    const surfaceKey = cleanText(setting.surface_key, 100);
    if (!['page', 'tool'].includes(surfaceType) || !surfaceKey) fail('Invalid surface', 400);
    if (surfaceKey === 'agent_bar' && user.id !== MODEL_OWNER) {
      const { data: existing } = await service.from('admin_surface_setting').select('configuration').eq('surface_type', surfaceType).eq('surface_key', surfaceKey).maybeSingle();
      if ((existing?.configuration?.model || '') !== (plainObject(setting.configuration).model || '')) fail('Only Merik can choose the Agent Bar model', 403);
    }
    const value = { surface_type: surfaceType, surface_key: surfaceKey, label: cleanText(setting.label, 200), route: cleanText(setting.route, 300) || null,
      visible: setting.visible !== false, active: setting.active !== false, look: plainObject(setting.look), configuration: plainObject(setting.configuration), updated_at: new Date().toISOString(), updated_by: user.id };
    const { data, error } = await service.from('admin_surface_setting').upsert(value, { onConflict: 'surface_type,surface_key' }).select().single();
    if (error) fail(error.message, 500);
    return Response.json(data);
  }

  if (action === 'analyze') {
    if (user.id !== MODEL_OWNER) fail('Only Merik can use the coder', 403);
    const model = cleanText(body.model, 150).toLowerCase();
    const requestedPrompt = cleanText(body.prompt, 12_000);
    if (!ALLOWED_MODELS.has(model)) fail('Unsupported coder model', 400);
    if (!requestedPrompt) fail('Describe the requested change', 400);
    const surface = plainObject(body.surface);
    const setting = plainObject(body.setting);
    const sourceFiles = Array.isArray(surface.source_files) ? surface.source_files.map((item) => cleanText(item, 300)).filter(Boolean).slice(0, 12) : [];
    const coderPrompt = `Selected AISTAGE.ONE surface:\n${JSON.stringify({ type: surface.type, key: surface.key, label: surface.label, route: surface.route, source_files: sourceFiles })}\n\nCurrent database-driven settings:\n${JSON.stringify(setting)}\n\nRequested change:\n${requestedPrompt}\n\nReturn only JSON with this exact shape: {"title":"short title","summary":"what changes and why","files":["only files from source_files"],"patch":"a concise unified diff or implementation note","look_patch":{},"configuration_patch":{}}. Use look_patch/configuration_patch only when the request can be applied safely through existing admin settings. Never invent product behavior, files, services, secrets or autonomous infrastructure.`;
    const proposal = parseProposal(await runCoder(model, coderPrompt));
    const proposedChanges = { look_patch: plainObject(proposal.look_patch), configuration_patch: plainObject(proposal.configuration_patch) };
    const hasRuntimePatch = Object.keys(proposedChanges.look_patch).length > 0 || Object.keys(proposedChanges.configuration_patch).length > 0;
    const safeFiles = (Array.isArray(proposal.files) ? proposal.files : []).map((item) => cleanText(item, 300)).filter((item) => sourceFiles.includes(item));
    const { data, error } = await service.from('admin_code_change').insert({ surface_type: cleanText(surface.type, 10), surface_key: cleanText(surface.key, 100), requested_prompt: requestedPrompt,
      model_key: model, title: cleanText(proposal.title, 200), summary: cleanText(proposal.summary, 10_000), files: safeFiles, patch: cleanText(proposal.patch, 50_000), proposed_changes: proposedChanges, created_by: user.id }).select().single();
    if (error) fail(error.message, 500);
    return Response.json({ ...data, has_runtime_patch: hasRuntimePatch });
  }

  if (action === 'apply') {
    if (user.id !== MODEL_OWNER) fail('Only Merik can approve coder changes', 403);
    const changeId = cleanText(body.change_id, 100);
    const { data: change, error } = await service.from('admin_code_change').select('*').eq('id', changeId).single();
    if (error || !change) fail('Change not found', 404);
    if (change.status !== 'review') fail('This change has already been reviewed', 409);
    const proposed = plainObject(change.proposed_changes);
    const lookPatch = plainObject(proposed.look_patch);
    const configurationPatch = plainObject(proposed.configuration_patch);
    const runtimeApplied = Object.keys(lookPatch).length > 0 || Object.keys(configurationPatch).length > 0;
    if (runtimeApplied) {
      const { data: current } = await service.from('admin_surface_setting').select('*').eq('surface_type', change.surface_type).eq('surface_key', change.surface_key).maybeSingle();
      if (!current) fail('Save this surface once before applying generated settings', 409);
      const { error: updateError } = await service.from('admin_surface_setting').update({ look: { ...plainObject(current.look), ...lookPatch }, configuration: { ...plainObject(current.configuration), ...configurationPatch }, updated_at: new Date().toISOString(), updated_by: user.id }).eq('surface_type', change.surface_type).eq('surface_key', change.surface_key);
      if (updateError) fail(updateError.message, 500);
    }
    const status = runtimeApplied ? 'applied' : 'approved';
    const { data: reviewed, error: reviewError } = await service.from('admin_code_change').update({ status, reviewed_at: new Date().toISOString(), reviewed_by: user.id }).eq('id', change.id).select().single();
    if (reviewError) fail(reviewError.message, 500);
    return Response.json({ change: { ...reviewed, has_runtime_patch: runtimeApplied }, runtime_applied: runtimeApplied });
  }

  fail('Unknown action', 400);
});
