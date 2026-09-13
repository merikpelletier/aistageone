import { installModelControl } from '../_shared/modelControlRuntime.ts';
installModelControl('generateVideo');
import { createClientFromRequest } from '../_shared/base44Compat.ts';
import { serveWithCors } from '../_shared/cors.ts';
import {
  completeCreditCharge,
  createCreditBillingContext,
  refundCreditCharge,
  reserveCredits,
} from '../_shared/credits.ts';
import type { CreditCharge, CreditBillingContext } from '../_shared/credits.ts';
import Replicate from 'npm:replicate@0.33.0';

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

    const { 
      prompt,
      image_url = null,
      video_url = null,
      duration = 5,
      resolution = '720p',
      aspect_ratio = '16:9',
      use_as_reference = false,
      engine = 'seedance',
      transformation_prompt = null
    } = await req.json();

    if (!prompt && !image_url && !video_url) {
      return Response.json({ error: 'Prompt, image_url, or video_url is required' }, { status: 400 });
    }

    if (video_url) {
      return Response.json({
        error: 'Video Reference is temporarily unavailable while its approved Replicate model is being restored.',
      }, { status: 409 });
    }

    creditCharge = await reserveCredits({
      ...billing,
      toolId: 'ai_video',
      provider: 'replicate',
      relatedEntity: 'generateVideo',
    });

    const replicate = new Replicate({ auth: TOKEN });

    const resolveOutputUrl = (output: any): string =>
      typeof output === 'string' ? output :
      typeof output?.url === 'function' ? output.url() :
      output?.url || String(output);

    let videoOutputUrl: string;

    if (engine === 'kling_morph') {
      // Single-pass Kling v2.6 generation with NATIVE audio: the user's photo
      // is the start frame (so their real face is preserved), the prompt drives
      // the on-screen transformation (drink potion → transform into a drag
      // queen), and generate_audio produces the synchronized "I am stunning!"
      // dialogue + sound effects in the same pass — no separate audio step.
      // (kwaivgi/kling-v2.6 on Replicate does not support end_image, so we do
      // not pre-restyle with Kontext — that also keeps identity intact.)
      if (!image_url) throw new Error('image_url is required for kling_morph');
      const stylePrompt = (transformation_prompt || '').trim();
      const actionPrompt = (prompt || '').trim();
      const combinedPrompt = [stylePrompt, actionPrompt].filter(Boolean).join(' ');
      if (!combinedPrompt) throw new Error('transformation_prompt or prompt is required for kling_morph');
      const morphOutput: any = await replicate.run('kwaivgi/kling-v2.6', {
        input: {
          prompt: combinedPrompt,
          start_image: image_url,
          duration: [5, 10].includes(duration) ? duration : 5,
          generate_audio: true,
          negative_prompt: 'blurry, distorted face, deformed, low quality, watermark',
        },
      });
      videoOutputUrl = resolveOutputUrl(morphOutput);
    } else if (engine === 'kling') {
      // Kling v1.6 Standard — strong identity preservation from a start frame
      // plus high prompt adherence for styling transformations (e.g. drag queen).
      // aspect_ratio is ignored when start_image is provided, so callers pre-crop.
      const klingInput: any = {
        prompt: prompt || '',
        duration: [5, 10].includes(duration) ? duration : 5,
        cfg_scale: 0.85,
        negative_prompt: 'blurry, distorted face, deformed, low quality, watermark',
      };
      if (image_url) {
        if (use_as_reference) {
          // Pass the photo as a scene-element reference so the model composes a
          // NEW scene from the prompt (allowing wardrobe/makeup/wig changes)
          // while keeping the subject's identity — instead of locking the
          // photo as the literal first frame, which blocks restyling.
          klingInput.reference_images = [image_url];
          klingInput.aspect_ratio = aspect_ratio;
        } else {
          klingInput.start_image = image_url;
        }
      } else {
        klingInput.aspect_ratio = aspect_ratio;
      }
      const output = await replicate.run('kwaivgi/kling-v1.6-standard', { input: klingInput });
      videoOutputUrl = resolveOutputUrl(output);
    } else {
      // Seedance 1.5 Lite — fast, affordable video generation.
      // Reference-image mode (identity-guided scene generation) requires 720p:
      // 480p is rejected as invalid input, 1080p disallows reference images.
      const effResolution = use_as_reference ? '720p' : resolution;
      const input: any = {
        prompt: prompt || '',
        duration,
        resolution: effResolution,
        aspect_ratio,
      };

      if (image_url) {
        if (use_as_reference) {
          // Pass as a reference image so the model composes a NEW scene from the
          // prompt while keeping the subject's identity — instead of merely
          // animating the photo as a first frame. (Not compatible with 1080p.)
          if (resolution !== '1080p') {
            input.reference_images = [image_url];
          } else {
            input.image = image_url;
          }
        } else {
          input.image = image_url;
        }
      }
      const output = await replicate.run('bytedance/seedance-1-lite', { input });
      videoOutputUrl = resolveOutputUrl(output);
    }

    // Download and re-upload to Base44 storage
    const videoRes = await fetch(videoOutputUrl);
    if (!videoRes.ok) throw new Error('Failed to fetch video');
    const blob = await videoRes.blob();
    const file = new File([blob], 'video.mp4', { type: 'video/mp4' });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    await completeCreditCharge(billing.service, creditCharge);

    return Response.json({
      file_url,
      credit_cost: creditCharge.cost,
      balance_after: creditCharge.balanceAfter,
    });
  } catch (error) {
    if (billing) await refundCreditCharge(billing.service, creditCharge, error);
    console.error('Video generation error:', error.message);
    throw error;
  }
});
