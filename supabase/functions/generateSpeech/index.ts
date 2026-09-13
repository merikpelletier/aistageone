import { VOICE_NAMES, validateVoiceLanguage } from '../_shared/voiceCatalog.js';
import { installModelControl } from '../_shared/modelControlRuntime.ts';
installModelControl('generateSpeech');
import { createClientFromRequest } from './_legacy/base44Compat.ts';
import { serveWithCors } from './_legacy/cors.ts';
import { createCreditBillingContext, withCreditCharge } from './_legacy/credits.ts';
import { generateSpeech } from './_legacy/replicateAi.ts';

const PREVIEW_TEXT = 'In a world of shadows and light, the story begins.';
const PREVIEW_CACHE_DIRECTORY = 'voice-previews/elevenlabs-v3-v1';
const ELEVENLABS_VOICES = new Set(VOICE_NAMES);

serveWithCors(async (req) => {
  try {
    const billing = await createCreditBillingContext(req);
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const {
      text,
      voice = 'Rachel',
      speed = 1,
      stability = 0.5,
      similarity_boost = 0.75,
      style = 0,
      language_code = 'en',
      preview = false,
    } = await req.json();

    if (!ELEVENLABS_VOICES.has(voice)) return Response.json({ error: 'Unsupported voice' }, { status: 400 });
    try { validateVoiceLanguage(language_code); } catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
    if (preview === true) {
      if (!ELEVENLABS_VOICES.has(voice)) {
        return Response.json({ error: 'Unsupported ElevenLabs voice' }, { status: 400 });
      }

      const fileName = `${voice}.mp3`;
      const objectPath = `${PREVIEW_CACHE_DIRECTORY}/${fileName}`;
      const { data: cachedFiles, error: listError } = await billing.service.storage
        .from('media')
        .list(PREVIEW_CACHE_DIRECTORY, { search: fileName, limit: 10 });
      if (listError) throw listError;

      if (!cachedFiles?.some((file) => file.name === fileName)) {
        const blob = await generateSpeech({ text: PREVIEW_TEXT, voice, languageCode: 'en' });
        const { error: uploadError } = await billing.service.storage
          .from('media')
          .upload(objectPath, blob, { contentType: 'audio/mpeg', cacheControl: '31536000', upsert: true });
        if (uploadError) throw uploadError;
      }

      const { data } = billing.service.storage.from('media').getPublicUrl(objectPath);
      return Response.json({
        file_url: data.publicUrl,
        credit_cost: 0,
        cached_preview: true,
      });
    }

    if (!text?.trim()) return Response.json({ error: 'Text is required' }, { status: 400 });

    const parsedSpeed = Number(speed);
    const parsedStability = Number(stability);
    const parsedSimilarityBoost = Number(similarity_boost);
    const parsedStyle = Number(style);

    const { result: res, charge } = await withCreditCharge({
      ...billing,
      toolId: 'tts',
      provider: 'replicate',
      relatedEntity: 'generateSpeech',
    }, () => base44.asServiceRole.integrations.Core.GenerateSpeech({
        text: text.slice(0, 5000),
        voice,
        speed: Number.isFinite(parsedSpeed) ? Math.min(1.2, Math.max(0.7, parsedSpeed)) : 1,
        stability: Number.isFinite(parsedStability) ? Math.min(1, Math.max(0, parsedStability)) : 0.5,
        similarityBoost: Number.isFinite(parsedSimilarityBoost) ? Math.min(1, Math.max(0, parsedSimilarityBoost)) : 0.75,
        style: Number.isFinite(parsedStyle) ? Math.min(1, Math.max(0, parsedStyle)) : 0,
        languageCode: typeof language_code === 'string' && language_code.trim() ? language_code.trim() : 'en',
      }));

    return Response.json({
      file_url: res.url || res.file_url,
      url: res.url || res.file_url,
      credit_cost: charge.cost,
      balance_after: charge.balanceAfter,
    });
  } catch (error) {
    console.error('TTS error:', error.message);
    throw error;
  }
});
