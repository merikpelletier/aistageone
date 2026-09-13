import { validateVoice, validateVoiceLanguage } from '../_shared/voiceCatalog.js';
import { installModelControl } from '../_shared/modelControlRuntime.ts';
installModelControl('generate-speech');
import { serveWithCors } from './_legacy/cors.ts';
import { createCreditBillingContext, withCreditCharge } from './_legacy/credits.ts';
import { generateSpeech } from './_legacy/replicateAi.ts';

serveWithCors(async (request) => {
  const billing = await createCreditBillingContext(request);
  const body = await request.json();
  try { validateVoice(body.voice || 'Rachel'); validateVoiceLanguage(body.language_code || 'en'); } catch (error) { return Response.json({ error: error.message }, { status: 400 }); }
  const { result, charge } = await withCreditCharge({
    ...billing,
    toolId: 'tts',
    provider: 'replicate',
    relatedEntity: 'generate_speech',
  }, async () => {
    const blob = await generateSpeech({ text: body.text, voice: body.voice || 'Rachel', languageCode: body.language_code || 'en' });
    const path = `${billing.user.id}/${crypto.randomUUID()}.mp3`;
    const { error } = await billing.service.storage.from('media').upload(path, blob, { contentType: 'audio/mpeg' });
    if (error) throw error;
    const { data } = billing.service.storage.from('media').getPublicUrl(path);
    return data.publicUrl;
  });
  return Response.json({
    url: result,
    file_url: result,
    credit_cost: charge.cost,
    balance_after: charge.balanceAfter,
  });
});
