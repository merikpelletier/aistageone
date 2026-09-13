import { createClient } from 'npm:@supabase/supabase-js@2.112.2';
import { serveWithCors } from '../_shared/adminFinanceCors.ts';
import { MODEL_OWNER, fail } from '../_shared/modelControlPolicy.ts';

const ALLOWED_MODELS = new Set(['anthropic/claude-sonnet-5', 'meta/codellama-70b-instruct']);
const GITHUB_REPOSITORY = 'merikpelletier/aistageone';
const GITHUB_BRANCH = 'main';
type FileReplacement = { find: string; replace: string };
type FileChange = { path: string; replacements: FileReplacement[] };
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

function decodeBase64(value: string) {
  const binary = atob(value.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function github(path: string, init: RequestInit = {}) {
  const token = Deno.env.get('GITHUB_TOKEN');
  if (!token) fail('GitHub is not configured for the coder', 503);
  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) fail(`GitHub error (${response.status}): ${result?.message || 'request failed'}`, 502);
  return result;
}

const githubFilePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

async function readGithubFile(path: string, ref = GITHUB_BRANCH) {
  const file = await github(`/contents/${githubFilePath(path)}?ref=${encodeURIComponent(ref)}`);
  if (file?.type !== 'file' || !file?.content) fail(`GitHub source file unavailable: ${path}`, 502);
  return { path, sha: String(file.sha || ''), content: decodeBase64(String(file.content)) };
}

function safeFileChanges(value: unknown, allowedFiles: string[]): FileChange[] {
  if (!Array.isArray(value)) return [];
  const changes: FileChange[] = [];
  for (const entry of value.slice(0, 6)) {
    const item = plainObject(entry);
    const path = cleanText(item.path, 300);
    if (!allowedFiles.includes(path)) continue;
    const replacements: FileReplacement[] = [];
    for (const replacement of Array.isArray(item.replacements) ? item.replacements.slice(0, 20) : []) {
      const pair = plainObject(replacement);
      const find = String(pair.find || '').slice(0, 30_000);
      const replace = String(pair.replace || '').slice(0, 30_000);
      if (find) replacements.push({ find, replace });
    }
    if (replacements.length) changes.push({ path, replacements });
  }
  return changes;
}

async function commitFileChanges(fileChanges: FileChange[], title: string) {
  const reference = await github(`/git/ref/heads/${GITHUB_BRANCH}`);
  const parentSha = cleanText(reference?.object?.sha, 100);
  if (!parentSha) fail('GitHub main branch is unavailable', 502);
  const parent = await github(`/git/commits/${parentSha}`);
  const baseTree = cleanText(parent?.tree?.sha, 100);
  if (!baseTree) fail('GitHub source tree is unavailable', 502);

  const tree = [];
  for (const rawChange of fileChanges) {
    const path = cleanText(rawChange.path, 300);
    const source = await readGithubFile(path, parentSha);
    let content = source.content;
    for (const rawReplacement of Array.isArray(rawChange.replacements) ? rawChange.replacements : []) {
      const replacement = plainObject(rawReplacement);
      const find = String(replacement.find || '');
      const replace = String(replacement.replace || '');
      const matches = find ? content.split(find).length - 1 : 0;
      if (matches !== 1) fail(`Cannot safely apply ${path}: expected one exact match, found ${matches}`, 409);
      content = content.replace(find, replace);
    }
    if (content === source.content) fail(`No source change produced for ${path}`, 409);
    const blob = await github('/git/blobs', { method: 'POST', body: JSON.stringify({ content, encoding: 'utf-8' }) });
    tree.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  const nextTree = await github('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: baseTree, tree }) });
  const commit = await github('/git/commits', { method: 'POST', body: JSON.stringify({ message: `Admin coder: ${cleanText(title, 160) || 'targeted change'}`, tree: nextTree.sha, parents: [parentSha] }) });
  await github(`/git/refs/heads/${GITHUB_BRANCH}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
  return { commit_sha: commit.sha, commit_url: `https://github.com/${GITHUB_REPOSITORY}/commit/${commit.sha}`, repository: GITHUB_REPOSITORY, branch: GITHUB_BRANCH };
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
    const sourceFiles = Array.isArray(surface.source_files) ? surface.source_files.map((item) => cleanText(item, 300)).filter(Boolean).slice(0, 6) : [];
    if (!sourceFiles.length) fail('No source files are registered for this surface', 400);
    const sourceContext = await Promise.all(sourceFiles.map((path) => readGithubFile(path)));
    const coderPrompt = `Selected AISTAGE.ONE surface:\n${JSON.stringify({ type: surface.type, key: surface.key, label: surface.label, route: surface.route, source_files: sourceFiles })}\n\nCurrent database-driven settings:\n${JSON.stringify(setting)}\n\nCurrent GitHub source files:\n${sourceContext.map((file) => `--- ${file.path}\n${file.content}`).join('\n\n')}\n\nRequested change:\n${requestedPrompt}\n\nReturn only JSON with this exact shape: {"title":"short title","summary":"what changes and why","files":["only changed files from source_files"],"patch":"a concise human-readable review diff","look_patch":{},"configuration_patch":{},"file_changes":[{"path":"one exact source_files path","replacements":[{"find":"exact existing source text occurring once","replace":"complete replacement text"}]}]}. Use look_patch/configuration_patch only for existing database-driven settings. Use file_changes for source-code changes. Every find value must be copied exactly from the supplied current source and occur once. Keep the change minimal. Never invent files, services, secrets or autonomous infrastructure.`;
    const proposal = parseProposal(await runCoder(model, coderPrompt));
    const fileChanges = safeFileChanges(proposal.file_changes, sourceFiles);
    const proposedChanges = { look_patch: plainObject(proposal.look_patch), configuration_patch: plainObject(proposal.configuration_patch), file_changes: fileChanges };
    const hasRuntimePatch = Object.keys(proposedChanges.look_patch).length > 0 || Object.keys(proposedChanges.configuration_patch).length > 0;
    const safeFiles = [...new Set(fileChanges.map((item) => item.path))];
    const { data, error } = await service.from('admin_code_change').insert({ surface_type: cleanText(surface.type, 10), surface_key: cleanText(surface.key, 100), requested_prompt: requestedPrompt,
      model_key: model, title: cleanText(proposal.title, 200), summary: cleanText(proposal.summary, 10_000), files: safeFiles, patch: cleanText(proposal.patch, 50_000), proposed_changes: proposedChanges, created_by: user.id }).select().single();
    if (error) fail(error.message, 500);
    return Response.json({ ...data, has_runtime_patch: hasRuntimePatch, has_code_patch: fileChanges.length > 0 });
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
    const fileChanges = safeFileChanges(proposed.file_changes, Array.isArray(change.files) ? change.files : []);
    const runtimeApplied = Object.keys(lookPatch).length > 0 || Object.keys(configurationPatch).length > 0;
    if (!runtimeApplied && !fileChanges.length) fail('This proposal has no applicable change', 409);
    const githubResult = fileChanges.length ? await commitFileChanges(fileChanges, change.title) : null;
    if (runtimeApplied) {
      const { data: current } = await service.from('admin_surface_setting').select('*').eq('surface_type', change.surface_type).eq('surface_key', change.surface_key).maybeSingle();
      if (!current) fail('Save this surface once before applying generated settings', 409);
      const { error: updateError } = await service.from('admin_surface_setting').update({ look: { ...plainObject(current.look), ...lookPatch }, configuration: { ...plainObject(current.configuration), ...configurationPatch }, updated_at: new Date().toISOString(), updated_by: user.id }).eq('surface_type', change.surface_type).eq('surface_key', change.surface_key);
      if (updateError) fail(updateError.message, 500);
    }
    const status = 'applied';
    const completedChanges = { ...proposed, ...(githubResult ? { result: githubResult } : {}) };
    const { data: reviewed, error: reviewError } = await service.from('admin_code_change').update({ status, proposed_changes: completedChanges, reviewed_at: new Date().toISOString(), reviewed_by: user.id }).eq('id', change.id).select().single();
    if (reviewError) fail(reviewError.message, 500);
    return Response.json({ change: { ...reviewed, has_runtime_patch: runtimeApplied, has_code_patch: fileChanges.length > 0 }, runtime_applied: runtimeApplied, github: githubResult });
  }

  fail('Unknown action', 400);
});
