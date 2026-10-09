import { createClient } from 'npm:@supabase/supabase-js@2.112.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-idempotency-key, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const resolveOutputUrl = (output: any): string => {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return resolveOutputUrl(output[0]);
  if (typeof output?.url === 'function') return output.url();
  if (typeof output?.url === 'string') return output.url;
  return '';
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const replicateToken = Deno.env.get('REPLICATE_API_TOKEN');
  const authorization = req.headers.get('Authorization') || '';

  const scoped = createClient(supabaseUrl, anonKey, {
    global: { headers: authorization ? { Authorization: authorization } : {} },
    auth: { persistSession: false },
  });
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: authData, error: authError } = await scoped.auth.getUser();
  const user = authData.user;
  if (authError || !user?.email) return json({ error: 'Unauthorized' }, 401);
  if (!replicateToken) return json({ error: 'REPLICATE_API_TOKEN not set' }, 503);

  try {
    const body = await req.json();
    const action = String(body.action || 'start');

    if (action === 'list_pending') {
      let query = service
        .from('stage_generation_job')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['starting', 'processing', 'finalizing'])
        .order('created_at', { ascending: false })
        .limit(1);
      if (body.stage_id) query = query.eq('stage_id', String(body.stage_id));
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return json({ job: data || null });
    }

    if (action === 'status') {
      const jobId = String(body.job_id || '');
      if (!jobId) return json({ error: 'job_id is required' }, 400);

      const { data: job, error: jobError } = await service
        .from('stage_generation_job')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', user.id)
        .single();
      if (jobError || !job) return json({ error: 'Stage generation job not found' }, 404);

      if (['succeeded', 'failed', 'canceled'].includes(job.status)) {
        return json({ job });
      }
      if (!job.provider_prediction_id) return json({ job });

      const predictionRes = await fetch(`https://api.replicate.com/v1/predictions/${job.provider_prediction_id}`, {
        headers: { Authorization: `Bearer ${replicateToken}` },
      });
      const prediction = await predictionRes.json();
      if (!predictionRes.ok) throw new Error(prediction?.detail || prediction?.error || 'Unable to read video generation status');

      if (prediction.status === 'failed' || prediction.status === 'canceled') {
        const terminal = prediction.status === 'canceled' ? 'canceled' : 'failed';
        const { data: claimed } = await service
          .from('stage_generation_job')
          .update({
            status: terminal,
            error: String(prediction.error || `Prediction ${terminal}`).slice(0, 2000),
            updated_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id)
          .eq('user_id', user.id)
          .in('status', ['starting', 'processing', 'finalizing'])
          .select('*')
          .maybeSingle();

        if (claimed?.credit_charge_id) {
          await service.rpc('refund_ai_credit_charge', {
            p_charge_id: claimed.credit_charge_id,
            p_error_message: String(prediction.error || `Prediction ${terminal}`).slice(0, 1000),
          });
        }
        const { data: latest } = await service.from('stage_generation_job').select('*').eq('id', job.id).single();
        return json({ job: latest });
      }

      if (prediction.status !== 'succeeded') {
        const { data: updated, error } = await service
          .from('stage_generation_job')
          .update({ status: 'processing', error: null, updated_at: new Date().toISOString() })
          .eq('id', job.id)
          .eq('user_id', user.id)
          .in('status', ['starting', 'processing'])
          .select('*')
          .maybeSingle();
        if (error) throw error;
        return json({ job: updated || job });
      }

      const { data: claimed, error: claimError } = await service
        .from('stage_generation_job')
        .update({ status: 'finalizing', error: null, updated_at: new Date().toISOString() })
        .eq('id', job.id)
        .eq('user_id', user.id)
        .in('status', ['starting', 'processing'])
        .select('*')
        .maybeSingle();
      if (claimError) throw claimError;

      if (!claimed) {
        const { data: latest } = await service.from('stage_generation_job').select('*').eq('id', job.id).single();
        return json({ job: latest });
      }

      try {
        const providerUrl = resolveOutputUrl(prediction.output);
        if (!providerUrl) throw new Error('Video provider returned no output URL');
        const videoRes = await fetch(providerUrl);
        if (!videoRes.ok) throw new Error('Unable to download completed video');
        const blob = await videoRes.blob();
        const objectPath = `${user.id}/${crypto.randomUUID()}.mp4`;
        const { error: uploadError } = await service.storage.from('media').upload(objectPath, blob, {
          contentType: 'video/mp4',
          upsert: false,
        });
        if (uploadError) throw uploadError;
        const { data: publicData } = service.storage.from('media').getPublicUrl(objectPath);
        const fileUrl = publicData.publicUrl;

        const lineageInputs = [claimed.input?.image_url, claimed.input?.video_url]
          .filter((value) => typeof value === 'string' && value.length > 0);
        if (lineageInputs.length) {
          const { error: lineageError } = await service.rpc('inherit_media_product_placements', {
            p_output_url: fileUrl,
            p_input_urls: [...new Set(lineageInputs)],
          });
          if (lineageError) console.error('Stage lineage propagation failed:', lineageError.message);
        }

        if (claimed.credit_charge_id) {
          const { data: completed, error: completeError } = await service.rpc('complete_ai_credit_charge', {
            p_charge_id: claimed.credit_charge_id,
          });
          if (completeError || !completed?.ok) throw new Error(completeError?.message || completed?.code || 'Credit completion failed');
        }

        const { data: finished, error: finishError } = await service
          .from('stage_generation_job')
          .update({
            status: 'succeeded',
            output_url: fileUrl,
            error: null,
            updated_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          })
          .eq('id', claimed.id)
          .select('*')
          .single();
        if (finishError) throw finishError;
        return json({ job: finished });
      } catch (finalizeError) {
        await service.from('stage_generation_job').update({
          status: 'processing',
          error: finalizeError instanceof Error ? finalizeError.message.slice(0, 2000) : 'Finalization failed',
          updated_at: new Date().toISOString(),
        }).eq('id', claimed.id);
        throw finalizeError;
      }
    }

    const {
      prompt = '',
      image_url = null,
      video_url = null,
      duration = 5,
      resolution = '720p',
      aspect_ratio = '16:9',
      engine = 'kling',
      transformation_prompt = null,
      model_key = null,
      stage_id = null,
      style_name = null,
    } = body;

    if (!prompt && !transformation_prompt && !image_url) return json({ error: 'Stage video input is required' }, 400);
    if (video_url) return json({ error: 'Video Reference is not available for Stage generation' }, 409);

    const combinedPrompt = engine === 'kling_morph'
      ? [String(transformation_prompt || '').trim(), String(prompt || '').trim()].filter(Boolean).join(' ')
      : String(prompt || '').trim();

    const rawInput = {
      prompt: combinedPrompt,
      image_url,
      duration,
      resolution: '720p',
      aspect_ratio,
      generate_audio: engine === 'kling_morph',
    };

    const quoteRes = await fetch(`${supabaseUrl}/functions/v1/ai-price-quote`, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service: `generateVideo:${engine}`,
        kind: 'video',
        input: rawInput,
        model_key: model_key || null,
      }),
    });
    const quote = await quoteRes.json();
    if (!quoteRes.ok) return json({ error: quote?.error || 'Unable to price Stage video' }, quoteRes.status);

    const { data: model, error: modelError } = await service
      .from('ai_model_catalog')
      .select('*')
      .eq('model_key', quote.model_key)
      .eq('enabled', true)
      .eq('kind', 'video')
      .eq('provider', 'replicate')
      .single();
    if (modelError || !model) return json({ error: 'Selected Stage video model is unavailable' }, 422);

    const schemaProps = model.schema?.components?.schemas?.Input?.properties || {};
    const providerInput: Record<string, unknown> = {};
    for (const key of Object.keys(schemaProps)) {
      if (quote.provider_input?.[key] !== undefined) providerInput[key] = quote.provider_input[key];
    }

    const required = model.schema?.components?.schemas?.Input?.required || [];
    const missing = required.filter((key: string) => providerInput[key] === undefined);
    if (missing.length) return json({ error: `Selected model is missing required input: ${missing.join(', ')}` }, 422);

    const isAdmin = user.app_metadata?.role === 'admin' ||
      Boolean((Deno.env.get('ADMIN_EMAIL') || '').trim().toLowerCase() === user.email.toLowerCase());

    let chargeId: string | null = null;
    let balanceAfter: number | null = null;
    const idempotencyKey = req.headers.get('x-idempotency-key')?.trim() || crypto.randomUUID();
    if (!isAdmin) {
      const { data: charge, error: chargeError } = await service.rpc('reserve_ai_credit_charge_dynamic', {
        p_user_id: user.id,
        p_user_email: user.email,
        p_tool_id: 'ai_video',
        p_provider: 'replicate',
        p_related_entity: 'stageVideoJob',
        p_idempotency_key: idempotencyKey,
        p_credit_cost: quote.credits,
      });
      if (chargeError) throw chargeError;
      if (!charge?.ok) {
        if (charge?.code === 'insufficient_credits') return json({ error: 'Insufficient credits', required: charge.required, balance: charge.balance }, 402);
        return json({ error: 'Credit reservation failed', code: charge?.code || 'credit_reservation_failed' }, 409);
      }
      chargeId = charge.charge_id || null;
      balanceAfter = charge.balance_after == null ? null : Number(charge.balance_after);
    }

    const { data: job, error: jobError } = await service.from('stage_generation_job').insert({
      user_id: user.id,
      user_email: user.email,
      stage_id: stage_id ? String(stage_id) : null,
      style_name: style_name ? String(style_name) : null,
      status: 'starting',
      engine,
      model_key: quote.model_key,
      prompt: combinedPrompt,
      input: { ...rawInput, video_url: null },
      credit_charge_id: chargeId,
      credit_cost: Number(quote.credits || 0),
      balance_after: balanceAfter,
    }).select('*').single();
    if (jobError) {
      if (chargeId) await service.rpc('refund_ai_credit_charge', { p_charge_id: chargeId, p_error_message: 'Unable to create Stage generation job' });
      throw jobError;
    }

    try {
      const target = model.version_id
        ? 'https://api.replicate.com/v1/predictions'
        : `https://api.replicate.com/v1/models/${model.model_key}/predictions`;
      const payload: Record<string, unknown> = { input: providerInput };
      if (model.version_id) payload.version = model.version_id;
      const predictionRes = await fetch(target, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${replicateToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const prediction = await predictionRes.json();
      if (!predictionRes.ok || !prediction?.id) throw new Error(prediction?.detail || prediction?.error || 'Unable to start Stage video generation');

      const nextStatus = prediction.status === 'succeeded' ? 'processing' : (prediction.status || 'processing');
      const { data: started, error: startError } = await service.from('stage_generation_job').update({
        provider_prediction_id: prediction.id,
        status: ['starting', 'processing'].includes(nextStatus) ? nextStatus : 'processing',
        updated_at: new Date().toISOString(),
      }).eq('id', job.id).select('*').single();
      if (startError) throw startError;
      return json({ job: started }, 202);
    } catch (startError) {
      if (chargeId) await service.rpc('refund_ai_credit_charge', {
        p_charge_id: chargeId,
        p_error_message: startError instanceof Error ? startError.message.slice(0, 1000) : 'Stage generation start failed',
      });
      await service.from('stage_generation_job').update({
        status: 'failed',
        error: startError instanceof Error ? startError.message.slice(0, 2000) : 'Stage generation start failed',
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      }).eq('id', job.id);
      throw startError;
    }
  } catch (error) {
    console.error('Stage video job error:', error);
    return json({ error: error instanceof Error ? error.message : 'Unexpected Stage video error' }, 500);
  }
});