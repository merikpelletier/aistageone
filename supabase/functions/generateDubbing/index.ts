import { installModelControl } from '../_shared/modelControlRuntime.ts';
installModelControl('generateDubbing');

import { serveWithCors } from '../_shared/cors.ts';
import { createCreditBillingContext, reserveCredits, completeCreditCharge, refundCreditCharge } from '../_shared/credits.ts';
import { quoteAiService } from '../_shared/dynamicAiPrice.ts';

const API = 'https://api.replicate.com/v1';
const serviceName = 'generateDubbing';

function asError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
function predictionUrl(id: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw Error('Invalid prediction id');
  return `${API}/predictions/${id}`;
}
async function predictionRequest(url: string, init?: RequestInit) {
  const token = Deno.env.get('REPLICATE_API_TOKEN');
  if (!token) throw Error('Replicate connection is not configured');
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(result.detail || result.error || `Prediction request failed (${response.status})`);
  return result;
}
function outputUrl(output: unknown) {
  const value = Array.isArray(output) ? output[0] : output;
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof (value as any).url === 'string') return (value as any).url;
  return null;
}

serveWithCors(async request => {
  let billing;
  try {
    billing = await createCreditBillingContext(request);
    const body = await request.json();
    const action = String(body.action || 'start');
    const db = billing.service;
    const userId = billing.user.id;

    if (action === 'start') {
      const videoUrl = String(body.video_url || '');
      const language = String(body.target_language || '');
      const modelKey = String(body.model_key || '').trim().toLowerCase();
      const duration = Number(body.duration_seconds);
      const sourceLanguage = String(body.source_language || 'auto');
      if (!/^https:\/\//i.test(videoUrl) || !/^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(language) ||
          !/^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$|^auto$/.test(sourceLanguage) ||
          !Number.isFinite(duration) || duration <= 0 || duration > 14400 || !modelKey) {
        return Response.json({ error: 'Video, languages, duration and selected model are required' }, { status: 400 });
      }

      // Price and eligibility always come from the platform's central Admin model registry.
      const quote = await quoteAiService(db, serviceName,
        { duration_seconds: duration, source_url: videoUrl, target_language: language },
        modelKey, 'speech');
      const charge = await reserveCredits({
        ...billing, toolId: 'dubbing', provider: 'replicate',
        relatedEntity: serviceName, explicitCost: quote.credits,
      });
      try {
        // The modelControlRuntime intercepts the request, validates the approved
        // Admin route and dynamically selects the catalog model and schema.
        const prediction = await predictionRequest(`${API}/models/${modelKey}/predictions`, {
          method: 'POST',
          body: JSON.stringify({
            input: {
              source_url: videoUrl,
              target_language: language,
              source_language: sourceLanguage,
              ...(body.cloning_strength == null ? {} : { cloning_strength: Number(body.cloning_strength) }),
            },
          }),
        });
        if (!prediction.id) throw Error('The model returned no prediction id');
        const { data, error } = await db.from('dubbing_jobs').insert({
          user_id: userId,
          model_key: quote.model_key,
          source_video_url: videoUrl,
          target_language: language,
          source_language: sourceLanguage,
          duration_seconds: duration,
          prediction_id: prediction.id,
          status: 'processing',
          credit_charge_id: charge.id,
          credit_cost: charge.cost,
        }).select('id').single();
        if (error || !data) throw Error(error?.message || 'Cannot save dubbing job');
        return Response.json({ job_id: data.id, status: 'processing', credit_cost: charge.cost });
      } catch (error) {
        await refundCreditCharge(db, charge, error);
        throw error;
      }
    }

    if (action === 'latest') {
      const { data: job, error } = await db.from('dubbing_jobs')
        .select('id,model_key,source_video_url,source_language,target_language,duration_seconds,status,audio_url,final_video_url,updated_at')
        .eq('user_id', userId)
        .in('status', ['processing', 'audio_ready', 'completed'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return Response.json({ job: job || null });
    }

    if (!['status', 'finish'].includes(action)) {
      return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
    const jobId = String(body.job_id || '');
    if (!/^[0-9a-f-]{36}$/i.test(jobId)) return Response.json({ error: 'Invalid job id' }, { status: 400 });
    const { data: job, error: jobError } = await db.from('dubbing_jobs').select('*')
      .eq('id', jobId).eq('user_id', userId).maybeSingle();
    if (jobError || !job) return Response.json({ error: 'Dubbing job not found' }, { status: 404 });

    if (action === 'finish') {
      if (job.status !== 'audio_ready' && job.status !== 'completed') {
        return Response.json({ error: 'Dubbing audio is not ready' }, { status: 409 });
      }
      const finalVideo = String(body.final_video_url || '');
      if (!/^https:\/\//i.test(finalVideo)) return Response.json({ error: 'Final video URL is required' }, { status: 400 });
      const { error } = await db.from('dubbing_jobs').update({
        final_video_url: finalVideo,
        audio_url: null,
        status: 'completed',
        updated_at: new Date().toISOString(),
      }).eq('id', jobId).eq('user_id', userId);
      if (error) throw error;
      return Response.json({ status: 'completed', file_url: finalVideo, credit_cost: job.credit_cost });
    }

    if (job.status === 'audio_ready' || job.status === 'completed') {
      return Response.json({
        status: job.status,
        audio_url: job.status === 'audio_ready' ? job.audio_url : null,
        file_url: job.final_video_url || null,
        credit_cost: job.credit_cost,
      });
    }
    if (job.status === 'failed') {
      return Response.json({ status: 'failed', error: job.error_message || 'Dubbing failed' });
    }

    const prediction = await predictionRequest(predictionUrl(job.prediction_id));
    if (prediction.status === 'succeeded') {
      const audioUrl = outputUrl(prediction.output);
      if (!audioUrl || !/^https:\/\//i.test(audioUrl)) throw Error('The dubbing model returned no audio file');
      if (job.credit_charge_id) {
        await completeCreditCharge(db, { id: job.credit_charge_id, cost: Number(job.credit_cost), balanceAfter: null, bypassed: false });
      }
      const { error } = await db.from('dubbing_jobs').update({
        status: 'audio_ready',
        audio_url: audioUrl,
        updated_at: new Date().toISOString(),
      }).eq('id', jobId).eq('user_id', userId);
      if (error) throw error;
      return Response.json({ status: 'audio_ready', audio_url: audioUrl, credit_cost: job.credit_cost });
    }
    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      const message = String(prediction.error || 'Dubbing failed');
      if (job.credit_charge_id) await refundCreditCharge(db, { id: job.credit_charge_id, cost: Number(job.credit_cost), balanceAfter: null, bypassed: false }, new Error(message));
      await db.from('dubbing_jobs').update({ status: 'failed', error_message: message, updated_at: new Date().toISOString() }).eq('id', jobId).eq('user_id', userId);
      return Response.json({ status: 'failed', error: message });
    }
    return Response.json({ status: 'processing', credit_cost: job.credit_cost });
  } catch (error) {
    console.error('generateDubbing:', asError(error));
    return Response.json({ error: asError(error) }, { status: 422 });
  }
});
