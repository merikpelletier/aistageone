import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import * as jpeg from 'npm:jpeg-js@0.4.4';
import UPNG from 'npm:upng-js@2.1.0';
import { Buffer } from 'node:buffer';

const REPLICATE_API = 'https://api.replicate.com/v1';

// ── Aspect Ratio Enforcement ──────────────────────────────────────────────────
// Single source of truth for pixel dimensions per ratio.
// seedream-4.5: when size='custom', width/height are honored directly and
// aspect_ratio is ignored — so we ALWAYS send explicit width/height to force
// exact output dimensions regardless of any reference image_input.
const RATIO_DIMENSIONS = {
  '4:3':  { width: 2560, height: 1920 },
  '3:4':  { width: 1920, height: 2560 },
  '16:9': { width: 2560, height: 1440 },
  '9:16': { width: 1440, height: 2560 },
  '1:1':  { width: 2048, height: 2048 },
  '3:2':  { width: 2400, height: 1600 },
  '2:3':  { width: 1600, height: 2400 },
};

// Default fallback when caller omits aspect_ratio — neutral 4:3, never 9:16.
const DEFAULT_IMAGE_RATIO = '4:3';
const DEFAULT_VIDEO_RATIO = '16:9';

// Returns { width, height } for a given ratio string, falling back to 4:3.
function resolveDims(ratio) {
  const dims = RATIO_DIMENSIONS[ratio] || RATIO_DIMENSIONS[DEFAULT_IMAGE_RATIO];
  return { dims, resolvedRatio: RATIO_DIMENSIONS[ratio] ? ratio : DEFAULT_IMAGE_RATIO };
}

// Build the seedream-4.5 input with forced custom dimensions.
function buildSeedreamInput(prompt, imageInput, ratio) {
  const { dims, resolvedRatio } = resolveDims(ratio);
  return {
    prompt,
    image_input: imageInput,
    size: 'custom',
    width: dims.width,
    height: dims.height,
    aspect_ratio: resolvedRatio,
  };
}

function extractUrl(output) {
  if (!output) return null;
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return extractUrl(output[0]);
  if (typeof output === 'object') {
    if (typeof output.url === 'function') return output.url();
    if (typeof output.url === 'string') return output.url;
    if (typeof output.image === 'string') return output.image;
    const strVal = Object.values(output).find(v => typeof v === 'string' && v.startsWith('http'));
    if (strVal) return strVal;
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const TOKEN = Deno.env.get('REPLICATE_API_TOKEN');
    if (!TOKEN) throw new Error('REPLICATE_API_TOKEN not set');

    const pollPrediction = async (predictionId) => {
      for (let i = 0; i < 120; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const res = await fetch(`${REPLICATE_API}/predictions/${predictionId}`, {
          headers: { Authorization: `Bearer ${TOKEN}` },
        });
        const data = await res.json();
        if (data.status === 'succeeded') return data.output;
        if (data.status === 'failed' || data.status === 'canceled') {
          throw new Error(`Prediction ${data.status}: ${data.error}`);
        }
      }
      throw new Error('Prediction timed out');
    };

    const startPrediction = async (versionId, input) => {
      const res = await fetch(`${REPLICATE_API}/predictions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
          Prefer: 'wait=5',
        },
        body: JSON.stringify({ version: versionId, input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`Replicate error (${res.status}): ${data.detail || JSON.stringify(data)}`);
      return data;
    };

    const startModelPrediction = async (modelPath, input) => {
      const res = await fetch(`${REPLICATE_API}/models/${modelPath}/predictions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
          Prefer: 'wait=5',
        },
        body: JSON.stringify({ input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`Replicate error (${res.status}): ${data.detail || JSON.stringify(data)}`);
      return data;
    };

    // Convert any URL to a base64 data URI so Replicate can access it regardless of auth
    const toDataUri = async (url) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Failed to fetch: ${url} (${r.status})`);
      const blob = await r.blob();
      const type = blob.type || 'image/jpeg';
      const buf = new Uint8Array(await blob.arrayBuffer());
      let b64 = '';
      const chunk = 8192;
      for (let i = 0; i < buf.length; i += chunk) {
        b64 += String.fromCharCode(...buf.subarray(i, i + chunk));
      }
      return `data:${type};base64,${btoa(b64)}`;
    };

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { method, photo_url, photo_urls, reference_video_url, reference_image_url, prompt_override, prompt, reference_image_urls, audio_url, aspect_ratio, costume_url } = await req.json();

    if (!method) return Response.json({ error: 'method is required' }, { status: 400 });

    // Get tool pricing
    const toolPricing = await base44.entities.ToolPricing.filter({ tool_id: method, is_active: true }).then(r => r[0]);
    const tokenCost = toolPricing?.token_cost || 0;

    // Admins skip token checks so they can test freely
    const adminEmail = (Deno.env.get('ADMIN_EMAIL') || '').toLowerCase().trim();
    const fullUser = await base44.asServiceRole.entities.User.filter({ email: user.email }).then(r => r[0]).catch(() => null);
    const isAdmin = (fullUser?.role || user.role) === 'admin' || (user.email || '').toLowerCase().trim() === adminEmail;

    // Check user's token balance
    let balance = await base44.entities.UserTokenBalance.filter({ user_email: user.email }).then(r => r[0]);

    if (!balance) {
      balance = await base44.entities.UserTokenBalance.create({
        user_email: user.email,
        balance: 0,
        last_updated: new Date().toISOString()
      });
    }

    // Check if user has enough tokens (admins bypass)
    if (!isAdmin && balance.balance < tokenCost) {
      return Response.json({
        error: 'Insufficient tokens',
        required: tokenCost,
        balance: balance.balance,
        message: `This tool requires ${tokenCost} tokens. Your balance: ${balance.balance} tokens.`
      }, { status: 402 });
    }

    let rawOutput;
    let preUploadedFileUrl = null;
    let composeResolvedRatio = null;
    let composeSentDims = null;

    if (method === 'body_and_voice') {
      if (!photo_url || !reference_video_url) {
        return Response.json({ error: 'photo_url and reference_video_url required' }, { status: 400 });
      }
      const prediction = await startModelPrediction('kwaivgi/kling-v3-omni-video', {
        image: photo_url,
        video: reference_video_url,
      });
      rawOutput = prediction.status === 'succeeded' ? prediction.output : await pollPrediction(prediction.id);

    } else if (method === 'faceswitch') {
      if (!photo_url || !reference_video_url) {
        return Response.json({ error: 'photo_url and reference_video_url required' }, { status: 400 });
      }
      const swapImg = await toDataUri(photo_url);
      const prediction = await startPrediction('278a81e7ebb22db98bcba54de985d22cc1abeead2754eb1f2af717247be69b34', {
        swap_image: swapImg,
        input_image: reference_video_url,
      });
      rawOutput = prediction.status === 'succeeded' ? prediction.output : await pollPrediction(prediction.id);

    } else if (method === 'character_photo') {
      if (!photo_url || !reference_image_url) {
        return Response.json({ error: 'photo_url and reference_image_url required' }, { status: 400 });
      }
      const ratio = aspect_ratio || DEFAULT_IMAGE_RATIO;
      const p = prompt_override || `Image A is the facial identity reference. Image B is the target image. Replace the face in Image B with the face from Image A while keeping Image B's pose, camera angle, framing, glasses, hairstyle, clothing, lighting, background, and photorealistic style. The final result must look like the person from Image A was photographed naturally in the same position and setting as Image B. Preserve realistic skin texture, beard details, facial proportions, shadows, and lens reflections. Do not change the background, outfit, glasses, crop, or overall composition. Output in ${ratio} format.`;
      const input = buildSeedreamInput(p, [photo_url, reference_image_url], ratio);
      const prediction = await startModelPrediction('bytedance/seedream-4.5', input);
      rawOutput = prediction.status === 'succeeded' ? prediction.output : await pollPrediction(prediction.id);

    } else if (method === 'reference_sheet_swap') {
      if (!photo_url || !reference_image_url) {
        return Response.json({ error: 'photo_url and reference_image_url required' }, { status: 400 });
      }
      const ratio = aspect_ratio || DEFAULT_IMAGE_RATIO;
      const p = prompt_override || `Image A is the actor's full-body reference photo. Image B is the character reference sheet image. Replace the entire person in Image B — face, head, neck, body shape, skin tone, and physique — with the person from Image A. Keep exactly: the pose/stance, the full outfit (every garment, fabric, colour, accessory), background, lighting, camera angle, framing, and photorealistic style from Image B. The result must look like the person from Image A is wearing the exact costume from Image B and standing in the exact same pose and scene. Do not change any clothing, props, or background elements. Output in ${ratio} format.`;
      const input = buildSeedreamInput(p, [photo_url, reference_image_url], ratio);
      const prediction = await startModelPrediction('bytedance/seedream-4.5', input);
      rawOutput = prediction.status === 'succeeded' ? prediction.output : await pollPrediction(prediction.id);

    } else if (method === 'character_sheet') {
      // 3-view turnaround reference sheet: generate front, side and back full-body
      // views with FLUX.1 Kontext Pro (a transformation model that can rotate the
      // subject while preserving identity), then composite them side by side.
      const allPhotos = photo_urls || (photo_url ? [photo_url] : []);
      if (!allPhotos || allPhotos.length === 0) {
        return Response.json({ error: 'photo_urls required' }, { status: 400 });
      }
      const primaryPhoto = allPhotos[0];
      if (costume_url) {
        // Single-call concept: Seedream accepts both images and renders the full
        // 3-view turnaround sheet in ONE generation — no separate dress step, no
        // 3x FLUX rotation. One prediction total.
        const userExtra = prompt_override ? ` Additional styling requested by the user — apply to every view: ${prompt_override}.` : '';
        const sheetPrompt = `Image A is the actor. Image B is the costume the actor must wear. Render a professional character turnaround reference sheet: ONE wide image showing THREE full-body views of the SAME person arranged side by side — LEFT is the straight FRONT view, CENTER is the SIDE profile view, RIGHT is the straight BACK view. The person is the actor from Image A (keep their exact face, body shape, skin tone, and hair) wearing the EXACT costume/outfit from Image B (keep every garment, color, fabric, pattern, accessory, and fit as shown in Image B).${userExtra} All three views must show the identical person in the identical costume, including any shoes, earrings, jewelry, hats, or accessories mentioned. Each view: full body head to toe, neutral A-pose with arms slightly away from the body, standing on a clean seamless white studio background with a soft floor shadow. Even studio lighting, photorealistic, natural skin texture. Three figures only, arranged horizontally in one single wide image. No text, no labels, no captions, no extra figures.`;
        const input = buildSeedreamInput(sheetPrompt, [primaryPhoto, costume_url], aspect_ratio || '16:9');
        const prediction = await startModelPrediction('bytedance/seedream-4.5', input);
        const out = prediction.status === 'succeeded' ? prediction.output : await pollPrediction(prediction.id);
        const sheetUrl = extractUrl(out);
        if (!sheetUrl) throw new Error('Character sheet produced no URL');
        const mediaRes = await fetch(sheetUrl);
        const blob = await mediaRes.blob();
        const file = new File([blob], 'character_sheet.jpg', { type: blob.type || 'image/jpeg' });
        const uploaded = await base44.integrations.Core.UploadFile({ file });
        preUploadedFileUrl = uploaded.file_url;
      } else {
        // No costume: single Seedream call — 3-view turnaround from the actor photo only
        const sheetPrompt = `Image A is the actor. Render a professional character turnaround reference sheet: ONE wide image showing THREE full-body views of the SAME person arranged side by side — LEFT is the straight FRONT view, CENTER is the SIDE profile view, RIGHT is the straight BACK view. The person is the actor from Image A (keep their exact face, body shape, skin tone, hair, and outfit). Each view: full body head to toe, neutral A-pose with arms slightly away from the body, standing on a clean seamless white studio background with a soft floor shadow. Even studio lighting, photorealistic, natural skin texture. Three figures only, arranged horizontally in one single wide image. No text, no labels, no captions, no extra figures.`;
        const input = buildSeedreamInput(sheetPrompt, [primaryPhoto], aspect_ratio || '16:9');
        const prediction = await startModelPrediction('bytedance/seedream-4.5', input);
        const out = prediction.status === 'succeeded' ? prediction.output : await pollPrediction(prediction.id);
        const sheetUrl = extractUrl(out);
        if (!sheetUrl) throw new Error('Character sheet produced no URL');
        const mediaRes = await fetch(sheetUrl);
        const blob = await mediaRes.blob();
        const file = new File([blob], 'character_sheet.jpg', { type: blob.type || 'image/jpeg' });
        const uploaded = await base44.integrations.Core.UploadFile({ file });
        preUploadedFileUrl = uploaded.file_url;
      }

    } else if (method === 'animate_image') {
      // Animate a still image into a video using Kling v2.6 image-to-video
      if (!photo_url) {
        return Response.json({ error: 'photo_url required' }, { status: 400 });
      }
      const klingInput = {
        start_image: photo_url,
        prompt: prompt_override || prompt || 'Cinematic subtle natural motion, professional film quality.',
        duration: 5,
        aspect_ratio: aspect_ratio || DEFAULT_VIDEO_RATIO,
      };
      if (audio_url) klingInput.audio_url = audio_url;
      const prediction = await startModelPrediction('kwaivgi/kling-v2.6', klingInput);
      rawOutput = prediction.status === 'succeeded' ? prediction.output : await pollPrediction(prediction.id);

    } else if (method === 'animate_with_reference') {
      // Animate image using a reference video for motion (Kling motion control)
      if (!photo_url || !reference_video_url) {
        return Response.json({ error: 'photo_url and reference_video_url required' }, { status: 400 });
      }
      const klingInput = {
        start_image: photo_url,
        reference_video: reference_video_url,
        duration: 5,
        aspect_ratio: aspect_ratio || DEFAULT_VIDEO_RATIO,
      };
      const prediction = await startModelPrediction('kwaivgi/kling-v2.6-motion-control', klingInput);
      rawOutput = prediction.status === 'succeeded' ? prediction.output : await pollPrediction(prediction.id);

    } else if (method === 'lip_sync') {
      // Add lip sync to a video using audio
      if (!photo_url || !audio_url) {
        return Response.json({ error: 'photo_url and audio_url required' }, { status: 400 });
      }
      const klingInput = {
        video: photo_url,
        audio: audio_url,
      };
      const prediction = await startModelPrediction('kwaivgi/kling-lip-sync', klingInput);
      rawOutput = prediction.status === 'succeeded' ? prediction.output : await pollPrediction(prediction.id);

    } else if (method === 'headshot') {
      // Identity-preserving actor headshot via Google Nano Banana 2
      // (Gemini 3.1 Flash Image). The uploaded portrait is passed as the
      // image_input reference so the model keeps the same person, while the
      // text prompt restyles lighting/background/wardrobe and sets the
      // expression. Nano Banana 2 is conversational/edit-based, so it holds
      // facial identity far better than a text-to-image restyle.
      if (!photo_url) {
        return Response.json({ error: 'photo_url required' }, { status: 400 });
      }
      if (!prompt) {
        return Response.json({ error: 'prompt required' }, { status: 400 });
      }
      const ratio = aspect_ratio || '3:4';
      const prediction = await startModelPrediction('google/nano-banana-2', {
        prompt,
        image_input: [photo_url],
        aspect_ratio: ratio,
        output_format: 'jpg',
      });
      rawOutput = prediction.status === 'succeeded' ? prediction.output : await pollPrediction(prediction.id);

    } else if (method === 'compose_scene') {
      const imgs = reference_image_urls || [];
      if (!prompt && imgs.length === 0) {
        return Response.json({ error: 'prompt or reference_image_urls required' }, { status: 400 });
      }
      const ratio = aspect_ratio || DEFAULT_IMAGE_RATIO;
      const input = buildSeedreamInput(prompt, imgs.slice(0, 3), ratio);
      composeResolvedRatio = input.aspect_ratio;
      composeSentDims = { width: input.width, height: input.height };
      const prediction = await startModelPrediction('bytedance/seedream-4.5', input);
      rawOutput = prediction.status === 'succeeded' ? prediction.output : await pollPrediction(prediction.id);

    } else if (method === 'text_to_video') {
      if (!prompt) return Response.json({ error: 'prompt required' }, { status: 400 });
      const prediction = await startModelPrediction('kwaivgi/kling-v2.6', {
        prompt,
        duration: 5,
        aspect_ratio: aspect_ratio || DEFAULT_VIDEO_RATIO,
      });
      rawOutput = prediction.status === 'succeeded' ? prediction.output : await pollPrediction(prediction.id);

    } else {
      return Response.json({ error: 'Unknown method' }, { status: 400 });
    }

    let file_url;
    if (preUploadedFileUrl) {
      file_url = preUploadedFileUrl;
    } else {
      let outputUrl = extractUrl(rawOutput);
      if (!outputUrl) throw new Error(`No URL in output: ${JSON.stringify(rawOutput)}`);

      // For faceswitch, run GFPGAN face restoration to improve quality
      if (method === 'faceswitch') {
        try {
          const restorePrediction = await startPrediction(
            '0fbacf7afc6c144e5be9767cff80f25aff23e52b0708f17e20f9879b2f21516c',
            { img: outputUrl, scale: 2, version: 'v1.4' }
          );
          const restoredOutput = restorePrediction.status === 'succeeded'
            ? restorePrediction.output
            : await pollPrediction(restorePrediction.id);
          const restoredUrl = extractUrl(restoredOutput);
          if (restoredUrl) outputUrl = restoredUrl;
        } catch (e) {
          console.error('GFPGAN restoration failed, using raw output:', e.message);
        }
      }

      const mediaRes = await fetch(outputUrl);
      if (!mediaRes.ok) throw new Error(`Failed to fetch result: ${mediaRes.status}`);
      const blob = await mediaRes.blob();
      const contentType = blob.type || 'image/jpeg';
      const ext = contentType.includes('image') ? 'jpg' : 'mp4';
      const file = new File([blob], `output.${ext}`, { type: contentType });
      const uploaded = await base44.integrations.Core.UploadFile({ file });
      file_url = uploaded.file_url;
    }

    // Deduct tokens (admins skip deduction)
    let newBalance = balance.balance;
    if (!isAdmin) {
      newBalance = balance.balance - tokenCost;
      await base44.entities.UserTokenBalance.update(balance.id, {
        balance: newBalance,
        last_updated: new Date().toISOString()
      });
      await base44.entities.TokenTransaction.create({
        user_email: user.email,
        transaction_type: 'usage',
        token_amount: -tokenCost,
        balance_after: newBalance,
        related_entity: `replicate_${method}`,
        created_at: new Date().toISOString()
      });
    }

    return Response.json({ file_url, token_cost: tokenCost, balance_after: newBalance, resolved_ratio: composeResolvedRatio, sent_dims: composeSentDims });
  } catch (error) {
    console.error('replicateGenerate error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});