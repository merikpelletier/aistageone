import { createClient } from 'npm:@supabase/supabase-js@2.112.2';
import { createCreditBillingContext, reserveCredits, completeCreditCharge } from '../generateSpeech/_legacy/credits.ts';
import { AUDIO_TOOLS, audioInput, publicAudioJob } from './studioAudioInput.js';
import { validateChoice, adaptInput } from './modelControlPolicy.ts';

const TABLE = 'studio_audio_job';
const API = 'https://api.replicate.com/v1';
const fail = (message: string, status = 503): never => { throw Object.assign(new Error(message), { status }); };
const check = (result: any) => { if (result.error) throw result.error; return result.data; };
const secret = () => crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
const headers = () => {
  const token = Deno.env.get('REPLICATE_API_TOKEN');
  if (!token) fail('Audio provider is not configured');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
};
async function save(db: any, id: string, fields: any) {
  return check(await db.from(TABLE).update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id).select().single());
}
async function refund(db: any, job: any, message: string) {
  if (job.charge?.id) {
    const result = check(await db.rpc('refund_ai_credit_charge', { p_charge_id: job.charge.id, p_error_message: message }));
    if (result?.ok === false) fail('Credit refund pending; retry status');
  }
  return save(db, job.id, { status: 'failed', error: message });
}
// Only an authenticated owner or an unguessable per-job callback can reach this.
// Always fetch the prediction from Replicate; never trust webhook output URLs.
async function settle(db: any, job: any) {
  if (['succeeded', 'failed'].includes(job.status) || !job.prediction_id) return job;
  const response = await fetch(`${API}/predictions/${encodeURIComponent(job.prediction_id)}`, { headers: headers(), signal: AbortSignal.timeout(20000) });
  if (!response.ok) fail('Unable to check audio generation; retry status');
  const prediction = await response.json();
  if (!['succeeded', 'failed', 'canceled'].includes(prediction.status)) return job;
  // Atomic claim prevents simultaneous polling/webhook from finalizing twice.
  const stale = new Date(Date.now() - 180000).toISOString();
  const claimed = check(await db.from(TABLE).update({ status: 'finalizing', updated_at: new Date().toISOString() })
    .eq('id', job.id).or(`status.eq.processing,status.eq.submitting,and(status.eq.finalizing,updated_at.lt.${stale})`).select().maybeSingle());
  if (!claimed) return job;
  try {
    if (prediction.status !== 'succeeded') return await refund(db, claimed, 'Audio generation failed. Credits refunded.');
    const output = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
    if (typeof output !== 'string') return await refund(db, claimed, 'The model did not return an audio file.');
    const url = new URL(output);
    if (url.protocol !== 'https:' || !(url.hostname === 'replicate.delivery' || url.hostname.endsWith('.replicate.delivery'))) {
      return await refund(db, claimed, 'Unsupported provider file host.');
    }
    const file = await fetch(url, { signal: AbortSignal.timeout(90000), redirect: 'error' });
    if (!file.ok) fail('Audio file could not be saved; retry status');
    const blob = await file.blob();
    if (!blob.size || blob.size > 50 * 1024 * 1024) return await refund(db, claimed, 'Audio exceeds the supported file size. Credits refunded.');
    const mime = claimed.format === 'wav' ? 'audio/wav' : 'audio/mpeg';
    const path = `studio-audio/${claimed.user_id}/${claimed.id}.${claimed.format}`;
    check(await db.storage.from('media').upload(path, blob, { contentType: mime, upsert: true }));
    const { data } = db.storage.from('media').getPublicUrl(path);
    // File is durable before charging is completed. Both operations are retryable.
    await completeCreditCharge(db, claimed.charge);
    return await save(db, claimed.id, { status: 'succeeded', file_url: data.publicUrl, error: null });
  } catch (error) {
    await save(db, claimed.id, { status: 'processing', error: 'Saving or billing pending. Check status again; do not regenerate.' });
    throw error;
  }
}

export function audioHandler(tool: 'music' | 'sound_fx') {
  return async (req: Request) => {
    if (req.method !== 'POST') return Response.json({ error: 'POST required' }, { status: 405 });
    const callback = new URL(req.url).searchParams.get('callback');
    if (callback) {
      const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
      const job = check(await db.from(TABLE).select('*').eq('callback_token', callback).eq('tool', tool).maybeSingle());
      if (!job) fail('Unauthorized callback', 401);
      const payload = await req.json();
      // Recover an accepted POST whose response was lost: the secret callback
      // binds the result to this job; authenticate it with Replicate before use.
      if (!job.prediction_id) {
        if (typeof payload.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(payload.id)) fail('Invalid callback', 400);
        if (!job.charge) fail('Reservation not persisted yet');
        job.prediction_id = payload.id;
        await save(db, job.id, { prediction_id: payload.id, status: 'processing' });
      }
      if (payload.id !== job.prediction_id) fail('Prediction mismatch', 403);
      const result = await settle(db, job);
      if (!['succeeded', 'failed'].includes(result.status)) fail('Finalization pending');
      return Response.json({ ok: true });
    }
    const billing = await createCreditBillingContext(req);
    const db = billing.service;
    const body = await req.json();
    if (body.action === 'config') {
      const assignment = check(await db.from('ai_model_assignment').select('model_key,enabled').eq('route_key', `${AUDIO_TOOLS[tool].service}|${AUDIO_TOOLS[tool].model}`).maybeSingle());
      const pricing = check(await db.from('tool_pricing').select('token_cost,is_active').eq('tool_id', tool).limit(1).maybeSingle());
      return Response.json({ model: assignment?.model_key || AUDIO_TOOLS[tool].model,
        credit_cost: pricing?.token_cost ?? null, ready: Boolean(assignment?.enabled && pricing?.is_active && pricing.token_cost != null) });
    }
    if (body.action === 'list') {
      const jobs = check(await db.from(TABLE).select('*').eq('user_id', billing.user.id).eq('tool', tool)
        .order('created_at', { ascending: false }).limit(30));
      return Response.json({ jobs: jobs.map(publicAudioJob) });
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id || '')) fail('Invalid request ID', 400);
    const existing = check(await db.from(TABLE).select('*').eq('id', body.id).eq('user_id', billing.user.id).eq('tool', tool).maybeSingle());
    if (body.action === 'status') {
      if (!existing) fail('Audio generation not found', 404);
      return Response.json({ job: publicAudioJob(await settle(db, existing)) });
    }
    if (body.action !== 'start') fail('Unknown action', 400);
    if (existing) return Response.json({ job: publicAudioJob(existing) });
    const input = audioInput(tool, body);
    // Validate the selected Admin model before reserving credits.
    const assignment = check(await db.from('ai_model_assignment').select('*').eq('route_key', `${AUDIO_TOOLS[tool].service}|${AUDIO_TOOLS[tool].model}`).maybeSingle());
    const model = assignment?.model_key ? check(await db.from('ai_model_catalog').select('*').eq('model_key', assignment.model_key).maybeSingle()) : null;
    validateChoice(assignment, model);
    adaptInput(input, assignment, model);
    const providerHeaders = headers();
    const format = input.audio_format || input.output_format;
    const record = {
      id: body.id, user_id: billing.user.id, tool, input, format,
      title: String(body.title || AUDIO_TOOLS[tool].label).slice(0, 120),
      callback_token: secret(), status: 'submitting',
    };
    const inserted = await db.from(TABLE).insert(record).select().single();
    if (inserted.error?.code === '23505') fail('Request already submitted. Check status.', 409);
    let job = check(inserted);
    try {
      const charge = await reserveCredits({ ...billing, idempotencyKey: body.id, toolId: tool, provider: 'replicate', relatedEntity: `${AUDIO_TOOLS[tool].service}:${body.id}` });
      job = { ...job, charge };
      await save(db, job.id, { charge });
    } catch (error) {
      await refund(db, job, 'Generation did not start. ' + (error as Error).message);
      throw error;
    }
    const webhook = new URL(`${Deno.env.get('SUPABASE_URL')}/functions/v1/${AUDIO_TOOLS[tool].service}`);
    webhook.searchParams.set('callback', job.callback_token);
    try {
      const response = await fetch(`${API}/models/${AUDIO_TOOLS[tool].model}/predictions`, {
        method: 'POST', headers: providerHeaders, signal: AbortSignal.timeout(25000),
        body: JSON.stringify({ input, webhook: webhook.href, webhook_events_filter: ['completed'] }),
      });
      if (!response.ok) {
        // A 5xx is ambiguous: never submit a second paid request automatically.
        if (response.status >= 500) fail('Provider response uncertain. The saved request will be reconciled by its callback.');
        return Response.json({ job: publicAudioJob(await refund(db, job, 'Provider rejected the request. Credits refunded.')) });
      }
      const prediction = await response.json();
      if (!prediction.id) fail('Provider response missing its ID. Do not regenerate.');
      // A fast callback may already have finished. Never reopen a completed
      // or refunded job when the original POST response arrives afterwards.
      check(await db.from(TABLE).update({ prediction_id: prediction.id, status: 'processing', error: null, updated_at: new Date().toISOString() })
        .eq('id', job.id).eq('status', 'submitting'));
      job = check(await db.from(TABLE).select('*').eq('id', job.id).single());
      return Response.json({ job: publicAudioJob(await settle(db, job)) });
    } catch (error) {
      // Model-control validation errors occur before provider submission.
      if ((error as any).status === 409) return Response.json({ job: publicAudioJob(await refund(db, job, (error as Error).message)) });
      // Do not overwrite a callback that may already have saved the result.
      check(await db.from(TABLE).update({ error: 'Submission or saving pending. Check status; do not regenerate.' }).eq('id', job.id).in('status', ['submitting', 'processing']));
      throw error;
    }
  };
}
