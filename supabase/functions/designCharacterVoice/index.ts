import { installModelControl } from './_shared/modelControlRuntime.ts';
installModelControl('designCharacterVoice');
import { createCreditBillingContext, withCreditCharge } from './_shared/credits.ts';
import { quoteAiService } from './_shared/dynamicAiPrice.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-idempotency-key', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }); }
function headers(wait = true) { const token = Deno.env.get('REPLICATE_API_TOKEN'); if (!token) throw new Error('REPLICATE_API_TOKEN is not configured'); return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(wait ? { Prefer: 'wait=60' } : {}) }; }

async function runConfiguredPrediction(modelKey: string, input: Record<string, unknown>) {
  const parts = modelKey.split('/');
  if (parts.length !== 2) throw new Error('Invalid Replicate model key: ' + modelKey);
  const modelResponse = await fetch('https://api.replicate.com/v1/models/' + parts[0] + '/' + parts[1], { headers: headers(false) });
  const modelData = await modelResponse.json();
  if (!modelResponse.ok) throw new Error('Replicate model lookup failed (' + modelResponse.status + '): ' + (modelData?.detail || modelData?.error || JSON.stringify(modelData)));
  const versionId = modelData?.latest_version?.id;
  if (typeof versionId !== 'string' || !versionId) throw new Error('Replicate did not return a published version for ' + modelKey);
  const response = await fetch('https://api.replicate.com/v1/predictions', { method: 'POST', headers: headers(), body: JSON.stringify({ version: modelKey + ':' + versionId, input }) });
  let prediction = await response.json();
  if (!response.ok) throw new Error('Configured model request failed (' + response.status + '): ' + (prediction?.detail || prediction?.error || JSON.stringify(prediction)));
  for (let i = 0; i < 30; i++) {
    if (prediction.status === 'succeeded') return prediction.output;
    if (['failed', 'canceled'].includes(prediction.status)) throw new Error('Configured model ' + prediction.status + ': ' + (prediction.error || 'unknown error'));
    if (!prediction.urls?.get) throw new Error('Configured model returned an incomplete prediction.');
    await new Promise(resolve => setTimeout(resolve, 2000));
    const poll = await fetch(prediction.urls.get, { headers: headers(false) });
    prediction = await poll.json();
    if (!poll.ok) throw new Error('Configured model polling failed (' + poll.status + ').');
  }
  throw new Error('Configured model prediction timed out.');
}
async function runVoiceDesign(modelKey: string, input: Record<string, unknown>) {
  const output = await runConfiguredPrediction(modelKey, input);
  const candidates = Array.isArray(output) ? output : [output];
  const url = candidates.find((value: any) => typeof value === 'string' && /^https?:/.test(value))
    || candidates.map((value: any) => value && typeof value === 'object' ? (value.audio || value.audio_url || value.url) : null).find((value: any) => typeof value === 'string' && /^https?:/.test(value));
  if (typeof url !== 'string' || !/^https?:/.test(url)) throw new Error('Configured speech model returned no audio URL.');
  return url;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const billing = await createCreditBillingContext(req);
    const body = await req.json();
    const french = /^fr(?:[-_]|$)/i.test(String(body.language || ''));
    const standalone = body.standalone === true;
    let characterId = String(body.character_id || '').trim();
    let characterName = '';
    let description = '';

    if (standalone) {
      description = String(body.voice_prompt || '').trim();
      characterName = String(body.name || '').trim();
      if (description.length < 20 || description.length > 2000) return json({ error: 'Voice description must contain between 20 and 2000 characters.' }, 400);
    } else {
      if (!characterId) return json({ error: 'character_id is required' }, 400);
      const { data: character, error } = await billing.service.from('ai_pilot_characters').select('id,role_name,voice_apparent_age,voice_gender,voice_accent,voice_accent_fr,voice_timbre_texture,voice_pitch,voice_personality_expressiveness').eq('id', characterId).single();
      if (error || !character) return json({ error: 'Character not found.' }, 404);
      characterName = character.role_name || '';
      description = [
        character.voice_apparent_age && 'Apparent age: ' + character.voice_apparent_age,
        character.voice_gender && 'Vocal gender: ' + character.voice_gender,
        character.voice_accent && 'Accent: ' + character.voice_accent,
        character.voice_timbre_texture && 'Timbre and texture: ' + character.voice_timbre_texture,
        character.voice_pitch && 'Pitch and register: ' + character.voice_pitch,
        character.voice_personality_expressiveness && 'Personality and expressiveness: ' + character.voice_personality_expressiveness,
      ].filter(Boolean).join('. ').trim();
    }

    if (body.action === 'design') {
      if (description.length < 20) return json({ error: 'Complete the voice description with at least 20 characters first.' }, 400);
      const text = String(body.preview_text || (french
        ? `Je suis ${characterName || 'votre personnage'}. Voici ma voix. Chaque mot exprime ma personnalité, mon histoire et mes intentions. Écoutez attentivement le son, le rythme et le caractère de ma voix.`
        : `I am ${characterName || 'your character'}. This is how I speak. Every word carries my personality, my history, and my intentions. Listen closely to the sound, rhythm, and character of my voice.`)).trim();
      if (text.length < 1 || text.length > 1000) return json({ error: 'Preview text must contain between 1 and 1000 characters.' }, 400);
      const modelInput: Record<string, unknown> = { prompt: [description, 'Speak the following exact dialogue in this voice: "' + text + '"', 'Natural human phrasing and pronunciation. Clean studio recording, no music, no background noise.'].join('. ') };
      const quote = await quoteAiService(billing.service, 'designCharacterVoice', modelInput, body.model_key || undefined, 'speech');
      const result = await withCreditCharge({ ...billing, toolId: 'tts', provider: 'replicate', relatedEntity: 'designCharacterVoice', explicitCost: quote.credits }, async () => {
        const audio_url = await runVoiceDesign(quote.model_key, modelInput);
        return { proposal: 1, audio_url, media_type: 'audio/mpeg', preview_text: text, language: french ? 'fr' : 'en' };
      });
      return json({ preview: result.result, character_name: characterName, model_key: quote.model_key, credit_cost: result.charge.cost, balance_after: result.charge.balanceAfter });
    }

    if (body.action === 'save') {
      const audioUrl = String(body.audio_url || '').trim();
      const sampleText = String(body.preview_text || '').trim();
      if (!/^https?:\/\//.test(audioUrl) || !sampleText) return json({ error: 'A generated audio sample and its text are required.' }, 400);
      const audio = await fetch(audioUrl);
      if (!audio.ok) throw new Error(`Unable to download generated voice sample (${audio.status}).`);
      const folder = standalone ? 'studio-voices' : 'ai-pilot-voices';
      const owner = standalone ? billing.user.id : characterId;
      const path = `${folder}/${billing.user.id}/${owner}/${crypto.randomUUID()}.mp3`;
      const { error: uploadError } = await billing.service.storage.from('media').upload(path, await audio.blob(), { contentType: audio.headers.get('content-type') || 'audio/mpeg', cacheControl: '31536000', upsert: true });
      if (uploadError) throw uploadError;
      const url = billing.service.storage.from('media').getPublicUrl(path).data.publicUrl;

      if (standalone) {
        const { data: asset, error: assetError } = await billing.service.from('vault_asset').insert({
          user_email: billing.user.email, created_by: billing.user.email, created_by_id: billing.user.id,
          name: String(body.name || '').trim() || 'Custom voice', url, media_type: 'audio', asset_category: 'reference', folder_id: null,
        }).select('id,name,url,media_type,asset_category,folder_id').single();
        if (assetError) throw assetError;
        return json({ vault_asset: asset, voice_sample_url: url, language: french ? 'fr' : 'en' });
      }

      const { data: updated, error: updateError } = await billing.service.from('ai_pilot_characters')
        .update(french ? { voice_sample_url_fr: url, voice_sample_text_fr: sampleText } : { voice_sample_url: url, voice_sample_text: sampleText, voice_id: null })
        .eq('id', characterId)
        .select('id,role_name,voice_sample_url,voice_sample_text,voice_sample_url_fr,voice_sample_text_fr')
        .single();
      if (updateError) throw updateError;
      return json({ character: updated, voice_sample_url: url, language: french ? 'fr' : 'en' });
    }
    return json({ error: 'Unsupported action. Use design or save.' }, 400);
  } catch (error) {
    console.error('designCharacterVoice error', error);
    const status = typeof (error as any)?.status === 'number' ? (error as any).status : 500;
    return json({ error: error instanceof Error ? error.message : 'Voice design failed.' }, status);
  }
});
