import { installModelControl } from '../_shared/modelControlRuntime.ts';
installModelControl('generate-image');
import { serveWithCors } from './_legacy/cors.ts';
import { createCreditBillingContext, withCreditCharge } from './_legacy/credits.ts';

const REPLICATE_API = 'https://api.replicate.com/v1';

async function toDataUri(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'AISTAGE.ONE Story Blocks/1.0',
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    },
  });
  if (!response.ok) throw new Error(`Unable to read reference image (${response.status})`);
  const blob = await response.blob();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return `data:${blob.type || 'image/jpeg'};base64,${btoa(binary)}`;
}

serveWithCors(async (request) => {
  const token = Deno.env.get('REPLICATE_API_TOKEN');
  if (!token) throw new Error('REPLICATE_API_TOKEN is not configured');
  const billing = await createCreditBillingContext(request);
  const body = await request.json();
  const referenceUrls = Array.isArray(body.reference_image_urls)
    ? body.reference_image_urls.filter(Boolean).slice(0, 14)
    : [];
  const { result: output, charge } = await withCreditCharge({
    ...billing,
    toolId: 'compose_scene',
    provider: 'replicate',
    relatedEntity: 'generate_image',
  }, async () => {
    const referenceImages = await Promise.all(referenceUrls.map(toDataUri));
    const response = await fetch(`${REPLICATE_API}/models/google/nano-banana-2/predictions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'wait=60' },
      body: JSON.stringify({ input: { prompt: body.prompt, image_input: referenceImages, aspect_ratio: body.aspect_ratio || '1:1', resolution: '2K', output_format: 'jpg' } }),
    });
    const prediction = await response.json();
    if (!response.ok) throw new Error(prediction.detail || 'Replicate generation failed');

    let completed = prediction;
    for (let attempt = 0; completed.status !== 'succeeded' && attempt < 24; attempt++) {
      if (completed.status === 'failed' || completed.status === 'canceled') {
        throw new Error(completed.error || `Replicate generation ${completed.status}`);
      }
      if (!completed.id) throw new Error('Replicate returned no prediction ID');
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const pollResponse = await fetch(`${REPLICATE_API}/predictions/${completed.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      completed = await pollResponse.json();
      if (!pollResponse.ok) throw new Error(completed.detail || `Replicate polling failed (${pollResponse.status})`);
    }

    if (completed.status !== 'succeeded') throw new Error('Replicate image generation timed out');
    const outputUrl = Array.isArray(completed.output) ? completed.output[0] : completed.output;
    if (!outputUrl || typeof outputUrl !== 'string') throw new Error('Replicate returned no image URL');

    const mediaResponse = await fetch(outputUrl);
    if (!mediaResponse.ok) throw new Error(`Unable to download generated image (${mediaResponse.status})`);
    const blob = await mediaResponse.blob();
    const objectPath = `${billing.user.id}/${crypto.randomUUID()}.jpg`;
    const { error: uploadError } = await billing.service.storage.from('media').upload(objectPath, blob, {
      contentType: blob.type || 'image/jpeg',
      upsert: false,
    });
    if (uploadError) throw new Error(`Unable to save generated image: ${uploadError.message}`);
    const { data: publicData } = billing.service.storage.from('media').getPublicUrl(objectPath);
    return publicData.publicUrl;
  });
  return Response.json({
    url: output,
    file_url: output,
    credit_cost: charge.cost,
    balance_after: charge.balanceAfter,
  });
});

