import { installModelControl } from '../_shared/modelControlRuntime.ts';
installModelControl('mixAudioVideo');
import { createClientFromRequest } from '../_shared/base44Compat.ts';
import { serveWithCors } from '../_shared/cors.ts';
import {
  completeCreditCharge,
  createCreditBillingContext,
  refundCreditCharge,
  reserveCredits,
} from '../_shared/credits.ts';
import type { CreditCharge, CreditBillingContext } from '../_shared/credits.ts';

const REPLICATE_API = 'https://api.replicate.com/v1';
// lucataco/video-audio-merge — replace_audio=false mixes the voice with the video's original audio.
const MODEL_VERSION = '8c3d57c9c9a1aaa05feabafbcd2dff9f68a5cb394e54ec020c1c2dcc42bde109';

serveWithCors(async (req) => {
  let billing: CreditBillingContext | null = null;
  let creditCharge: CreditCharge | null = null;
  try {
    billing = await createCreditBillingContext(req);
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const TOKEN = Deno.env.get('REPLICATE_API_TOKEN');
    if (!TOKEN) throw new Error('REPLICATE_API_TOKEN not set');

    const { audio_url, video_url } = await req.json();
    if (!audio_url || !video_url) {
      return Response.json({ error: 'audio_url and video_url required' }, { status: 400 });
    }

    creditCharge = await reserveCredits({
      ...billing,
      toolId: 'dubbing',
      provider: 'replicate',
      relatedEntity: 'mixAudioVideo',
    });

    const startRes = await fetch(`${REPLICATE_API}/predictions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        Prefer: 'wait=5',
      },
      body: JSON.stringify({
        version: MODEL_VERSION,
        input: {
          audio_file: audio_url,
          video_file: video_url,
          replace_audio: false,
          audio_volume: 1.0,
        },
      }),
    });

    let predData = await startRes.json();
    if (!startRes.ok) throw new Error(`Replicate error (${startRes.status}): ${predData.detail || JSON.stringify(predData)}`);

    for (let i = 0; i < 60; i++) {
      if (predData.status === 'succeeded') break;
      if (predData.status === 'failed' || predData.status === 'canceled') {
        throw new Error(`Prediction ${predData.status}: ${predData.error}`);
      }
      await new Promise(r => setTimeout(r, 5000));
      const pollRes = await fetch(`${REPLICATE_API}/predictions/${predData.id}`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      predData = await pollRes.json();
    }
    if (predData.status !== 'succeeded') throw new Error('Prediction timed out');

    const output = predData.output;
    const outputUrl = typeof output === 'string' ? output
      : (output?.url ? (typeof output.url === 'function' ? output.url() : output.url) : null)
      || (Array.isArray(output) ? output[0] : null);
    if (!outputUrl) throw new Error(`No URL in output: ${JSON.stringify(output)}`);

    const mediaRes = await fetch(outputUrl);
    if (!mediaRes.ok) throw new Error(`Failed to fetch result: ${mediaRes.status}`);
    const blob = await mediaRes.blob();
    const file = new File([blob], 'dubbed_video.mp4', { type: 'video/mp4' });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    await completeCreditCharge(billing.service, creditCharge);
    return Response.json({
      file_url,
      credit_cost: creditCharge.cost,
      balance_after: creditCharge.balanceAfter,
    });
  } catch (error) {
    if (billing) await refundCreditCharge(billing.service, creditCharge, error);
    console.error('mixAudioVideo error:', error.message);
    throw error;
  }
});
