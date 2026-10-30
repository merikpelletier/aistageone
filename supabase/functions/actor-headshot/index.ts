import { createClient } from 'npm:@supabase/supabase-js@2.112.2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const withCors = (response: Response) => {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const auth = req.headers.get('Authorization');
    const apiKey = req.headers.get('apikey') || Deno.env.get('SUPABASE_ANON_KEY') || '';
    if (!auth) return withCors(Response.json({ error: 'Unauthorized' }, { status: 401 }));

    const body = await req.json();
    const { photo_url, prompt, aspect_ratio, model_key, ...rest } = body || {};

    if (!photo_url) return withCors(Response.json({ error: 'photo_url required' }, { status: 400 }));
    if (!prompt) return withCors(Response.json({ error: 'prompt required' }, { status: 400 }));

    let finalPrompt = prompt;
    let resolvedPromptKey = null;

    try {
      const { data, error } = await db.rpc('resolve_ai_prompt', {
        p_tool_key: 'actor_designer',
        p_function_key: 'generate_actor_headshot',
        p_model_key: model_key || 'google/nano-banana-2',
        p_context_tags: ['headshot'],
      });
      if (error) throw error;

      const resolved = data?.[0] || null;
      if (resolved?.content) {
        finalPrompt = `${resolved.content}\n\nRequested headshot treatment:\n${prompt}`;
        resolvedPromptKey = resolved.prompt_key;
      }
    } catch (error) {
      console.error('Actor headshot prompt resolution failed; using existing prompt:', error?.message || error);
    }

    const headers: Record<string, string> = {
      Authorization: auth,
      'Content-Type': 'application/json',
    };
    if (apiKey) headers.apikey = apiKey;

    const response = await fetch(`${SUPABASE_URL}/functions/v1/replicateGenerate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...rest,
        method: 'headshot',
        photo_url,
        prompt: finalPrompt,
        aspect_ratio,
        model_key,
      }),
    });

    const text = await response.text();
    let payload;
    try { payload = JSON.parse(text); } catch { payload = { error: text || 'Generation failed' }; }

    if (!response.ok) return withCors(Response.json(payload, { status: response.status }));
    return withCors(Response.json({ ...payload, resolved_prompt_key: resolvedPromptKey }));
  } catch (error) {
    console.error('actor-headshot error:', error?.message || error);
    return withCors(Response.json({ error: error?.message || 'Actor headshot failed' }, { status: 500 }));
  }
});
