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
// lucataco/video-audio-merge — replace_audio=true replaces the original soundtrack with the dubbed audio.
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

    const body = await req.clone().json();
    const { audio_url, video_url } = body;
    const source_video_url = body.source_video_url;
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
          replace_audio: true,
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

    // Stream fetches the rendered MP4 directly from Replicate. No file is loaded
    // into the Edge Function and no Supabase Storage file-size limit is involved.
    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const streamToken = Deno.env.get('CLOUDFLARE_STREAM_API_TOKEN');
    if (!accountId || !streamToken) throw new Error('Cloudflare Stream not configured for dubbing output');
    const copyRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/copy`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${streamToken}`,
        'Content-Type': 'application/json',
        'Upload-Creator': user.id,
      },
      body: JSON.stringify({ url: outputUrl, meta: { name: 'AISTAGE.ONE dubbed video' } }),
    });
    const copyData = await copyRes.json().catch(() => null);
    if (!copyRes.ok || !copyData?.success || !copyData?.result?.uid) {
      throw new Error(`Cloudflare dubbing output import failed: ${copyData?.errors?.[0]?.message || copyRes.status}`);
    }
    const uid = String(copyData.result.uid);
    const { data: asset, error: assetError } = await billing.service.from('video_asset').insert({
      owner_id: user.id,
      provider: 'cloudflare_stream',
      provider_video_id: uid,
      source_type: 'import',
      source_url: source_video_url || video_url,
      status: 'processing',
      storage_billing_started_at: new Date().toISOString(),
    }).select('id').single();
    if (assetError || !asset) throw new Error(`Could not register dubbed video: ${assetError?.message}`);

    // The new Stream asset is resolved asynchronously by dubbing-cloudflare-media.
    // Preserve product-placement lineage once the final playback URL is available.
    await completeCreditCharge(billing.service, creditCharge);
    return Response.json({
      output_asset_id: asset.id,
      status: 'processing',
      credit_cost: creditCharge.cost,
      balance_after: creditCharge.balanceAfter,
    });
  } catch (error) {
    if (billing) await refundCreditCharge(billing.service, creditCharge, error);
    console.error('mixAudioVideo error:', error.message);
    throw error;
  }
});
