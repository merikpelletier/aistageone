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
import { quoteAiService } from '../_shared/dynamicAiPrice.ts';
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
      reference_image_urls = [],
      video_url = null,
      duration = 5,
      resolution = '720p',
      aspect_ratio = '16:9',
      use_as_reference = false,
      generate_audio = false,
      engine = 'video',
      transformation_prompt = null,
      model_key = null
    } = await req.json();

    const references = Array.isArray(reference_image_urls)
      ? [...new Set(reference_image_urls.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))].slice(0, 7)
      : [];

    const rawPrompt = String(prompt || '');
    const mappedBasePrompt = references.length
      ? rawPrompt.replace(/\bImage\s+([1-7])\b/gi, '<<<image_$1>>>')
      : rawPrompt;

    const isShootRequest = references.length > 0 && /SAME SCENE CONTINUITY/i.test(rawPrompt);
    const hasSetReference = /<<<image_1>>>\s*=\s*SET/i.test(mappedBasePrompt);
    const shootDirectives = isShootRequest
      ? [
          'AISTAGE.ONE SHOOT — STRICT CONTINUITY RULES.',
          'REFERENCE IMAGES OVERRIDE EVERY TEXTUAL DESCRIPTION IF THERE IS ANY CONFLICT.',
          hasSetReference
            ? '<<<image_1>>> IS THE IMMUTABLE SET REFERENCE. Reproduce the same architecture, room geometry, wall and floor materials, openings, doors, windows, fixed props, spatial layout and overall visual identity. Do NOT redesign, replace, reinterpret, modernize, stylize or invent a different environment. Change only camera framing and performer action required by this shot.'
            : '',
          'Each remaining referenced character image is an identity lock. Preserve the exact person, face, age, body type, hair, wardrobe and distinguishing features. Do not merge identities or substitute a different performer.',
          'Do not let later descriptive prose override these reference locks.',
        ].filter(Boolean).join(' ')
      : '';
    const mappedPrompt = shootDirectives ? `${shootDirectives} ${mappedBasePrompt}` : mappedBasePrompt;

    if (!mappedPrompt && !image_url && !references.length && !video_url) {
      return Response.json({ error: 'Prompt or image reference is required' }, { status: 400 });
    }

    if (video_url) {
      return Response.json({
        error: 'Video Reference is temporarily unavailable while its approved Replicate model is being restored.',
      }, { status: 409 });
    }

    const mode = resolution === '480p' ? 'standard' : 'pro';
    const audioEnabled = engine === 'kling_morph' ? true : Boolean(generate_audio);
    const quoteInput = {
      prompt: mappedPrompt,
      image_url,
      reference_images: references.length ? references : undefined,
      video_url,
      duration,
      resolution,
      mode,
      aspect_ratio,
      generate_audio: audioEnabled,
    };

    const dynamicQuote = await quoteAiService(
      billing.service,
      `generateVideo:${engine}`,
      quoteInput,
      model_key || null,
      'video'
    );

    creditCharge = await reserveCredits({
      ...billing,
      toolId: 'ai_video',
      provider: 'replicate',
      relatedEntity: 'generateVideo',
      explicitCost: dynamicQuote.credits,
    });

    const replicate = new Replicate({ auth: TOKEN });
    const encoder = new TextEncoder();

    const resolveOutputUrl = (output: any): string =>
      typeof output === 'string' ? output :
      typeof output?.url === 'function' ? output.url() :
      output?.url || String(output);

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        const heartbeat = setInterval(() => {
          if (!closed) controller.enqueue(encoder.encode(' '.repeat(2048)));
        }, 20000);

        (async () => {
          try {
            let videoOutputUrl: string;

            if (engine === 'kling_morph') {
              if (!image_url) throw new Error('image_url is required for kling_morph');
              const stylePrompt = (transformation_prompt || '').trim();
              const actionPrompt = mappedPrompt.trim();
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
              const klingInput: any = {
                prompt: mappedPrompt,
                duration: [5, 10].includes(duration) ? duration : 5,
                cfg_scale: 0.85,
                negative_prompt: 'blurry, distorted face, deformed, low quality, watermark',
              };
              if (image_url) {
                if (use_as_reference) {
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
              const input: any = {
                prompt: mappedPrompt,
                duration: Math.max(3, Math.min(15, Number(duration) || 5)),
                mode,
                aspect_ratio,
                generate_audio: audioEnabled,
              };

              if (references.length) {
                input.reference_images = references;
              } else if (image_url) {
                if (use_as_reference) input.reference_images = [image_url];
                else input.start_image = image_url;
              }

              const output = await replicate.run('kwaivgi/kling-v3-omni-video', { input });
              videoOutputUrl = resolveOutputUrl(output);
            }

            const videoRes = await fetch(videoOutputUrl);
            if (!videoRes.ok) throw new Error('Failed to fetch video');
            const blob = await videoRes.blob();
            const file = new File([blob], 'video.mp4', { type: 'video/mp4' });
            const { file_url } = await base44.integrations.Core.UploadFile({ file });

            const lineageInputs = [image_url, ...references, video_url].filter((value) => typeof value === 'string' && value.length > 0);
            if (lineageInputs.length > 0) {
              const { error: lineageError } = await billing!.service.rpc('inherit_media_product_placements', {
                p_output_url: file_url,
                p_input_urls: [...new Set(lineageInputs)],
              });
              if (lineageError) console.error('Product placement lineage propagation failed:', lineageError.message);
            }

            await completeCreditCharge(billing!.service, creditCharge!);

            controller.enqueue(encoder.encode(JSON.stringify({
              file_url,
              credit_cost: creditCharge!.cost,
              balance_after: creditCharge!.balanceAfter,
            })));
          } catch (error) {
            if (billing) await refundCreditCharge(billing.service, creditCharge, error);
            console.error('Video generation error:', error instanceof Error ? error.message : String(error));
            controller.enqueue(encoder.encode(JSON.stringify({
              error: error instanceof Error ? error.message : 'Video generation failed',
            })));
          } finally {
            closed = true;
            clearInterval(heartbeat);
            controller.close();
          }
        })();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    if (billing) await refundCreditCharge(billing.service, creditCharge, error);
    console.error('Video generation error:', error instanceof Error ? error.message : String(error));
    throw error;
  }
});