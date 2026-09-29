import { VOICE_NAMES, validateVoiceLanguage } from '../_shared/voiceCatalog.js';
import { installModelControl } from '../_shared/modelControlRuntime.ts';
installModelControl('regenerateNarration');
import { createClientFromRequest } from './_legacy/base44Compat.ts';
import { serveWithCors } from './_legacy/cors.ts';
import { createCreditBillingContext, withCreditCharge } from '../_shared/credits.ts';
import { quoteAiService } from '../_shared/dynamicAiPrice.ts';

serveWithCors(async (req) => {
  try {
    const billing = await createCreditBillingContext(req);
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { block_id, voice, language_code, model_key, model_keys } = await req.json();
    if (!block_id || !voice) {
      return Response.json({ error: 'block_id and voice are required' }, { status: 400 });
    }

    const VALID_VOICES = VOICE_NAMES;
    if (!VALID_VOICES.includes(voice)) {
      return Response.json({ error: 'Invalid voice' }, { status: 400 });
    }

    const block = await base44.entities.StoryBlock.get(block_id);
    if (!block) return Response.json({ error: 'Block not found' }, { status: 404 });

    // Verify ownership via session
    const session = await base44.entities.StorySession.get(block.session_id);
    if (!session || session.user_email !== user.email) {
      return Response.json({ error: 'Not your block' }, { status: 403 });
    }

    const language = language_code || session.narrator_language || 'en';
    try { validateVoiceLanguage(language); } catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
    const segments = block.segment_instructions || [];
    const hasNarration = segments.some((segment) => Boolean(segment?.narration_text || segment?.dialogue));
    const narrationText = segments.map((segment) => [segment?.narration_text, segment?.dialogue].filter(Boolean).join(' ')).filter(Boolean).join(' ');
    const narrationModelKey = model_keys?.speech || model_key || null;
    const narrationQuote = hasNarration
      ? await quoteAiService(
          billing.service,
          'regenerateNarration',
          { text: narrationText, voice, language_code: language },
          narrationModelKey,
          'speech',
        )
      : null;
    const generated = hasNarration
      ? await withCreditCharge({
          ...billing,
          toolId: 'tts',
          provider: 'replicate',
          relatedEntity: `story_block_${block_id}_narration`,
          explicitCost: narrationQuote?.credits ?? 0,
        }, async () => {
          const urls = [];
          for (let i = 0; i < segments.length; i++) {
            const ttsText = [segments[i]?.narration_text, segments[i]?.dialogue].filter(Boolean).join(' ');
            if (ttsText) {
              const speechRes = await base44.integrations.Core.GenerateSpeech({ text: ttsText, voice, languageCode: language });
              urls[i] = speechRes?.url || '';
            } else {
              urls[i] = '';
            }
          }
          return urls;
        })
      : { result: [], charge: { cost: 0, balanceAfter: null } };
    const narrationUrls = generated.result;

    await base44.entities.StoryBlock.update(block_id, { narration_audio_urls: narrationUrls });

    // Update session voice so future blocks use the new voice
    await base44.entities.StorySession.update(block.session_id, { narrator_voice: voice, narrator_language: language }).catch(() => {});

    return Response.json({
      block_id,
      narration_audio_urls: narrationUrls,
      voice,
      credit_cost: generated.charge.cost,
      balance_after: generated.charge.balanceAfter,
    });
  } catch (error) {
    throw error;
  }
});
