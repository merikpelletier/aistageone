import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Replicate from 'npm:replicate@0.33.0';

Deno.serve(async (req) => {
  try {
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

    // Token check
    const toolPricing = await base44.entities.ToolPricing.filter({ tool_id: 'ai_video', is_active: true }).then(r => r[0]);
    const tokenCost = toolPricing?.token_cost || 0;
    const adminEmail = (Deno.env.get('ADMIN_EMAIL') || '').toLowerCase().trim();
    const fullUser = await base44.asServiceRole.entities.User.filter({ email: user.email }).then(r => r[0]).catch(() => null);
    const isAdmin = (fullUser?.role || user.role) === 'admin' || (user.email || '').toLowerCase().trim() === adminEmail;
    let balance = await base44.entities.UserTokenBalance.filter({ user_email: user.email }).then(r => r[0]);
    if (!balance) {
      balance = await base44.entities.UserTokenBalance.create({ user_email: user.email, balance: 0, last_updated: new Date().toISOString() });
    }
    if (!isAdmin && balance.balance < tokenCost) {
      return Response.json({ error: 'Insufficient tokens', required: tokenCost, balance: balance.balance, message: `This tool requires ${tokenCost} tokens. Your balance: ${balance.balance} tokens.` }, { status: 402 });
    }

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
      if (video_url) {
        input.video = video_url;
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

    // Deduct tokens (admins skip)
    let newBalance = balance.balance;
    if (!isAdmin) {
      newBalance = balance.balance - tokenCost;
      await base44.entities.UserTokenBalance.update(balance.id, { balance: newBalance, last_updated: new Date().toISOString() });
      await base44.entities.TokenTransaction.create({ user_email: user.email, transaction_type: 'usage', token_amount: -tokenCost, balance_after: newBalance, related_entity: 'generateVideo', created_at: new Date().toISOString() });
    }

    return Response.json({ file_url });
  } catch (error) {
    console.error('Video generation error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});