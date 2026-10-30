import { serveWithCors } from '../replicateGenerate/_legacy/cors.ts';
import { resolveSystemPrompt, renderSystemPrompt } from '../_shared/promptEngine.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;

serveWithCors(async (req) => {
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      photo_url,
      prompt,
      aspect_ratio,
      model_key,
      ...rest
    } = body || {};

    if (!photo_url) return Response.json({ error: 'photo_url required' }, { status: 400 });
    if (!prompt) return Response.json({ error: 'prompt required' }, { status: 400 });

    let finalPrompt = prompt;
    let resolvedPromptKey = null;

    try {
      const resolved = await resolveSystemPrompt({
        toolKey: 'actor_designer',
        functionKey: 'generate_actor_headshot',
        modelKey: model_key || 'google/nano-banana-2',
        contextTags: ['headshot'],
      });

      if (resolved?.content) {
        const systemGuidance = renderSystemPrompt(resolved);
        finalPrompt = `${systemGuidance}\n\nRequested headshot treatment:\n${prompt}`;
        resolvedPromptKey = resolved.prompt_key;
      }
    } catch (error) {
      console.error('Actor headshot prompt resolution failed; using existing prompt:', error?.message || error);
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/replicateGenerate`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
      },
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

    if (!response.ok) return Response.json(payload, { status: response.status });
    return Response.json({ ...payload, resolved_prompt_key: resolvedPromptKey });
  } catch (error) {
    console.error('actor-headshot error:', error?.message || error);
    return Response.json({ error: error?.message || 'Actor headshot failed' }, { status: 500 });
  }
});
