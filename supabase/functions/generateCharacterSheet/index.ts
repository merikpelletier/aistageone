import { installModelControl } from '../_shared/modelControlRuntime.ts';
installModelControl('generateCharacterSheet');
import { createClientFromRequest } from './_legacy/base44Compat.ts';
import { serveWithCors } from './_legacy/cors.ts';
import {
  completeCreditCharge,
  createCreditBillingContext,
  refundCreditCharge,
  reserveCredits,
} from '../_shared/credits.ts';
import type { CreditCharge, CreditBillingContext } from '../_shared/credits.ts';
import { quoteAiService } from '../_shared/dynamicAiPrice.ts';

const REPLICATE_API = 'https://api.replicate.com/v1';

const RATIO_DIMENSIONS = {
  '4:3':  { width: 2560, height: 1920 },
  '3:4':  { width: 1920, height: 2560 },
  '16:9': { width: 2560, height: 1440 },
  '9:16': { width: 1440, height: 2560 },
  '1:1':  { width: 2048, height: 2048 },
};
const DEFAULT_RATIO = '4:3';

function resolveDims(ratio) {
  const dims = RATIO_DIMENSIONS[ratio] || RATIO_DIMENSIONS[DEFAULT_RATIO];
  return { dims, resolvedRatio: RATIO_DIMENSIONS[ratio] ? ratio : DEFAULT_RATIO };
}

serveWithCors(async (req) => {
  let billing: CreditBillingContext | null = null;
  let creditCharge: CreditCharge | null = null;
  try {
    billing = await createCreditBillingContext(req);
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { source_mode, reference_sheet_url, angle_urls, image_urls, costume_url, look_reference_urls, aspect_ratio, prompt_override, reference_layout_url, accessories, replace_preset, model_key } = await req.json();
    const ratio = aspect_ratio || DEFAULT_RATIO;
    const { dims, resolvedRatio } = resolveDims(ratio);

    const TOKEN = Deno.env.get('REPLICATE_API_TOKEN');
    if (!TOKEN) throw new Error('REPLICATE_API_TOKEN not set');

    const lookReferences = Array.isArray(look_reference_urls) && look_reference_urls.length
      ? look_reference_urls.filter(Boolean)
      : [costume_url].filter(Boolean);

    const dynamicQuote = await quoteAiService(
      billing.service,
      'generateCharacterSheet',
      { aspect_ratio: ratio, prompt: prompt_override || '', image_urls, angle_urls, reference_sheet_url, costume_url, look_reference_urls: lookReferences },
      model_key || null,
      'image'
    );
    creditCharge = await reserveCredits({
      ...billing,
      toolId: 'character_sheet',
      provider: 'replicate',
      relatedEntity: 'character_sheet',
      explicitCost: dynamicQuote.credits,
    });

    const sourceMode = source_mode === 'angles' ? 'angles' : 'sheet';
    const sourceImages = sourceMode === 'sheet'
      ? [reference_sheet_url || (image_urls && image_urls[0])].filter(Boolean)
      : (Array.isArray(angle_urls) && angle_urls.length ? angle_urls : image_urls || []).filter(Boolean);
    if (!sourceImages.length) return Response.json({ error: 'Character source required' }, { status: 400 });

    const imageInput = [...sourceImages, ...lookReferences];
    const firstLookImageNumber = sourceImages.length + 1;
    const lookMapText = lookReferences.length
      ? lookReferences.map((_, index) => `Look Reference ${index + 1} = Image ${firstLookImageNumber + index}.`).join(' ')
      : '';
    const lookFusionInstruction = lookReferences.length
      ? `The supplied look references are styling sources, not identity sources. ${lookMapText} Extract the requested clothing, footwear, hair, accessories, makeup, materials, colors, and styling details from these look references and combine them into ONE coherent final look on the base character. Do not copy the people, faces, bodies, poses, or backgrounds from the look-reference images. Do not average, morph, or randomly blend the references. Treat each look reference as a separate source of specific design elements. Follow the user's styling instructions exactly when they identify which element should come from which Look Reference. When an element is not explicitly assigned, use the distinct compatible design information visible in the supplied look references without replacing the base character's identity.`
      : '';

    const accessoriesText = accessories ? ` User styling instructions: ${accessories}` : '';
    const overrideText = prompt_override ? ` ${prompt_override}` : '';

    // Custom mode: keep the user's custom instruction, but still identify the image roles so multiple look references are usable.
    let prompt;
    if (replace_preset && prompt_override && prompt_override.trim()) {
      const identityMap = sourceMode === 'sheet'
        ? 'Image 1 is the base character reference sheet and the ONLY identity source.'
        : `Images 1 through ${sourceImages.length} are identity references of the SAME base character.`;
      prompt = `${identityMap} ${lookFusionInstruction} User instruction: ${prompt_override.trim()}${accessoriesText}`;
    } else if (sourceMode === 'angles') {
      const lookInstruction = lookReferences.length
        ? lookFusionInstruction
        : 'Preserve the clothing shown in the supplied character angles unless the user instruction requests a change.';
      prompt = `Images 1 through ${sourceImages.length} are separate visual references of the SAME base character. Use all of these identity images together to preserve one exact identity: same face, skin tone, hair, age, body proportions, and recognizable features. Never take identity from any later look-reference image. ${lookInstruction}${accessoriesText}

Create one clean ${resolvedRatio} character reference sheet composed of five consistent views: full-body front, full-body side, full-body back, portrait front, and portrait profile. Use a seamless light grey studio background, even professional lighting, photorealistic rendering, centered subjects, and no text, labels, or borders.${overrideText}`;
    } else if (lookReferences.length) {
      prompt = `Image 1 is the base actor reference sheet, the layout/composition reference, and the ONLY identity source. Preserve the same person's exact identity across all views: same face, skin tone, hair texture, age, body proportions, and overall recognizable appearance. Preserve the same reference-sheet structure, panel disposition, framing, and relative image sizes as Image 1. Never replace the base person's identity with a person shown in any look reference.

${lookFusionInstruction}${accessoriesText}

Generate a clean ${resolvedRatio} character reference sheet with five vertical panels, keeping the same arrangement and proportions as Image 1:
1. full-body front view
2. full-body side view
3. full-body back view
4. portrait front view
5. portrait profile view

The SAME fused final look must appear consistently in every applicable view. Use a seamless light grey studio background, even professional lighting, photorealistic rendering, and consistent appearance across all five views. Keep the subject centered in each panel and preserve the clean reference-sheet look. No text, no labels, no borders.${overrideText}`;
    } else {
      prompt = `Image 1 is the actor reference sheet and also the layout/composition reference. Preserve the same person's exact identity across all views: same face, skin tone, hair texture and hairstyle, age, body proportions, and overall appearance. Preserve the same reference-sheet structure, panel disposition, framing, and relative image sizes as Image 1.${accessoriesText}

Generate a clean ${resolvedRatio} character reference sheet with five vertical panels, keeping the same arrangement and proportions as Image 1:
1. full-body front view
2. full-body side view
3. full-body back view
4. portrait front view
5. portrait profile view

Use a seamless light grey studio background, even professional lighting, photorealistic rendering, and consistent appearance across all five views. Keep the subject centered in each panel and preserve the clean reference-sheet look. No text, no labels, no borders.${overrideText}`;
    }

    const input = {
      prompt,
      image_input: imageInput,
      size: 'custom',
      width: dims.width,
      height: dims.height,
      aspect_ratio: resolvedRatio,
    };

    // Start prediction
    const startRes = await fetch(`${REPLICATE_API}/models/bytedance/seedream-4.5/predictions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        Prefer: 'wait=5',
      },
      body: JSON.stringify({ input }),
    });
    const prediction = await startRes.json();
    if (!startRes.ok) throw new Error(`Replicate error (${startRes.status}): ${prediction.detail || JSON.stringify(prediction)}`);

    // Poll if not immediately done
    let output = prediction.output;
    if (prediction.status !== 'succeeded') {
      for (let i = 0; i < 120; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const pollRes = await fetch(`${REPLICATE_API}/predictions/${prediction.id}`, {
          headers: { Authorization: `Bearer ${TOKEN}` },
        });
        const data = await pollRes.json();
        if (data.status === 'succeeded') { output = data.output; break; }
        if (data.status === 'failed' || data.status === 'canceled') {
          throw new Error(`Prediction ${data.status}: ${data.error}`);
        }
        if (i === 119) throw new Error('Prediction timed out');
      }
    }

    // Extract URL from output
    let outputUrl = null;
    if (typeof output === 'string') outputUrl = output;
    else if (Array.isArray(output)) outputUrl = output[0];
    else if (output && typeof output === 'object') {
      outputUrl = output.url || output.image || Object.values(output).find(v => typeof v === 'string' && v.startsWith('http'));
    }
    if (!outputUrl) throw new Error(`No URL in output: ${JSON.stringify(output)}`);

    // Download and re-upload to Base44 storage
    const mediaRes = await fetch(outputUrl);
    if (!mediaRes.ok) throw new Error(`Failed to fetch result: ${mediaRes.status}`);
    const blob = await mediaRes.blob();
    const contentType = blob.type || 'image/jpeg';
    const file = new File([blob], 'character_sheet.jpg', { type: contentType });
    const uploaded = await base44.integrations.Core.UploadFile({ file });

    await completeCreditCharge(billing.service, creditCharge);

    return Response.json({
      file_url: uploaded.file_url,
      cost: creditCharge.cost,
      newBalance: creditCharge.balanceAfter,
      aspect_ratio: resolvedRatio,
    });
  } catch (error) {
    if (billing) await refundCreditCharge(billing.service, creditCharge, error);
    console.error('generateCharacterSheet error:', error.message);
    throw error;
  }
});
