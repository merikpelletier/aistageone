import { createClient } from 'npm:@supabase/supabase-js@2.112.2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const service = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

const authClient = (request: Request) => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
  { global: { headers: { Authorization: request.headers.get('Authorization') || '' } }, auth: { persistSession: false } }
);

const classifyKind = (provider: string, id: string) => {
  const s = id.toLowerCase();
  if (provider === 'elevenlabs') return 'speech';
  if (provider === 'stability') return 'image';
  if (/whisper|transcrib|speech-to-text/.test(s)) return 'transcription';
  if (/tts|speech|voice/.test(s)) return 'speech';
  if (/music|audio/.test(s)) return 'audio';
  if (/video|veo|sora/.test(s)) return 'video';
  if (/image|imagen|dall-e|flux|stable-diffusion|sdxl/.test(s)) return 'image';
  return 'text';
};

const normalizeModels = (provider: string, rows: any[]) =>
  (rows || []).slice(0, 250).map((row: any) => {
    const key = String(row?.id || row?.name || row?.model || '').trim();
    return {
      key,
      name: String(row?.display_name || row?.displayName || row?.name || row?.id || row?.model || key),
      kind: classifyKind(provider, key),
      metadata: row && typeof row === 'object' ? row : {},
    };
  }).filter((m: any) => m.key);

async function providerRequest(provider: string, token: string) {
  let url = '';
  const headers: Record<string, string> = {};
  switch (provider) {
    case 'openai': url = 'https://api.openai.com/v1/models'; headers.Authorization = `Bearer ${token}`; break;
    case 'google': url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(token)}`; break;
    case 'anthropic': url = 'https://api.anthropic.com/v1/models?limit=100'; headers['x-api-key'] = token; headers['anthropic-version'] = '2023-06-01'; break;
    case 'xai': url = 'https://api.x.ai/v1/models'; headers.Authorization = `Bearer ${token}`; break;
    case 'mistral': url = 'https://api.mistral.ai/v1/models'; headers.Authorization = `Bearer ${token}`; break;
    case 'cohere': url = 'https://api.cohere.com/v1/models'; headers.Authorization = `Bearer ${token}`; break;
    case 'together': url = 'https://api.together.xyz/v1/models'; headers.Authorization = `Bearer ${token}`; break;
    case 'groq': url = 'https://api.groq.com/openai/v1/models'; headers.Authorization = `Bearer ${token}`; break;
    case 'elevenlabs': url = 'https://api.elevenlabs.io/v1/models'; headers['xi-api-key'] = token; break;
    case 'stability': url = 'https://api.stability.ai/v1/user/account'; headers.Authorization = `Bearer ${token}`; break;
    default: return { ok: false, status: 400, models: [], message: 'Unsupported provider.' };
  }
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, status: response.status, models: [], message: [401,403].includes(response.status) ? 'Credential rejected by provider.' : `Provider returned HTTP ${response.status}.` };
    if (provider === 'stability') return { ok: true, status: response.status, accountLabel: payload?.email || payload?.id || null, models: [], message: 'Connection verified.' };
    const rawModels = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.models) ? payload.models : [];
    const models = normalizeModels(provider, rawModels);
    return { ok: true, status: response.status, accountLabel: payload?.email || payload?.organization || payload?.username || null, models, message: `Connection verified. ${models.length} models discovered.` };
  } catch (error) {
    return { ok: false, status: 0, models: [], message: error instanceof Error ? error.message : 'Provider connection failed.' };
  }
}

async function syncModels(db: any, userId: string, connectionId: string, models: any[]) {
  if (!models.length) return;
  const payload = models.map((model) => ({
    user_id: userId, connection_id: connectionId, provider_model_key: model.key,
    display_name: model.name, kind: model.kind, provider_metadata: model.metadata || {},
    verification_status: 'verified', last_verified_at: new Date().toISOString(), enabled: true,
  }));
  const { error } = await db.from('ai_user_connected_model').upsert(payload, { onConflict: 'connection_id,provider_model_key' });
  if (error) throw error;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const scoped = authClient(request);
  const { data: auth, error: authError } = await scoped.auth.getUser();
  if (authError || !auth?.user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
  const db = service();
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || '');
  const connectionId = String(body.connection_id || '');
  if (!connectionId) return Response.json({ error: 'connection_id is required' }, { status: 400, headers: cors });

  const { data: connection } = await db.from('ai_user_connection').select('*').eq('id', connectionId).eq('user_id', auth.user.id).maybeSingle();
  if (!connection) return Response.json({ error: 'Connection not found' }, { status: 404, headers: cors });

  try {
    const metadata = connection.metadata || {};
    if (action === 'save') {
      const credential = String(body.credential || '').trim();
      if (credential.length < 8) return Response.json({ error: 'Credential is too short.' }, { status: 400, headers: cors });
      const { data: ref, error: vaultError } = await db.rpc('ai_vault_put', {
        p_value: credential, p_name: `aistage_ai_${auth.user.id}_${connection.id}`, p_id: metadata.credential_ref || null,
      });
      if (vaultError) throw vaultError;
      await db.from('ai_user_connection').update({ metadata: { ...metadata, credential_ref: ref }, status: 'pending', last_error: null, updated_at: new Date().toISOString() }).eq('id', connection.id);
      const result = await providerRequest(connection.provider, credential);
      await db.from('ai_user_connection').update({ status: result.ok ? 'connected' : 'error', provider_account_label: result.accountLabel || null, last_checked_at: new Date().toISOString(), last_error: result.ok ? null : result.message, updated_at: new Date().toISOString() }).eq('id', connection.id);
      if (result.ok) await syncModels(db, auth.user.id, connection.id, result.models);
      return Response.json({ ...result, credential_saved: true }, { status: result.ok ? 200 : 422, headers: cors });
    }

    if (action === 'test' || action === 'discover') {
      if (!metadata.credential_ref) return Response.json({ error: 'No credential saved.' }, { status: 400, headers: cors });
      const { data: credential, error } = await db.rpc('ai_vault_get', { p_id: metadata.credential_ref });
      if (error || !credential) throw error || new Error('Credential unavailable');
      const result = await providerRequest(connection.provider, credential);
      await db.from('ai_user_connection').update({ status: result.ok ? 'connected' : 'error', provider_account_label: result.accountLabel || connection.provider_account_label || null, last_checked_at: new Date().toISOString(), last_error: result.ok ? null : result.message, updated_at: new Date().toISOString() }).eq('id', connection.id);
      if (result.ok) await syncModels(db, auth.user.id, connection.id, result.models);
      return Response.json(result, { status: result.ok ? 200 : 422, headers: cors });
    }

    if (action === 'remove_credential') {
      if (metadata.credential_ref) await db.rpc('ai_vault_remove', { p_id: metadata.credential_ref });
      const next = { ...metadata }; delete next.credential_ref;
      await db.from('ai_user_connection').update({ metadata: next, status: 'disconnected', provider_account_label: null, last_error: null, updated_at: new Date().toISOString() }).eq('id', connection.id);
      return Response.json({ ok: true }, { headers: cors });
    }

    return Response.json({ error: 'Unsupported action' }, { status: 400, headers: cors });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Connection operation failed.' }, { status: 500, headers: cors });
  }
});
