import { installModelControl } from '../_shared/modelControlRuntime.ts';
installModelControl('generateSpeech');
import { serveWithCors } from './_legacy/cors.ts';
import { createCreditBillingContext, withCreditCharge } from '../_shared/credits.ts';
import { quoteAiService } from '../_shared/dynamicAiPrice.ts';

const REPLICATE_API = 'https://api.replicate.com/v1';
const PREVIEW_TEXT = 'In a world of shadows and light, the story begins.';

function replicateHeaders(wait = true) {
  const token = Deno.env.get('REPLICATE_API_TOKEN');
  if (!token) throw new Error('REPLICATE_API_TOKEN is not configured');
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  if (wait) headers.Prefer = 'wait=60';
  return headers;
}

async function readPrediction(response: Response) {
  const prediction = await response.json();
  if (!response.ok) throw new Error(`Replicate error (${response.status}): ${prediction?.error || prediction?.detail || JSON.stringify(prediction)}`);
  return prediction;
}

async function runReplicateModel(modelKey: string, input: Record<string, unknown>) {
  let prediction = await readPrediction(await fetch(`${REPLICATE_API}/models/${modelKey}/predictions`, { method: 'POST', headers: replicateHeaders(true), body: JSON.stringify({ input }) }));
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (prediction.status === 'succeeded') return prediction.output;
    if (prediction.status === 'failed' || prediction.status === 'canceled') throw new Error(`Replicate prediction ${prediction.status}: ${prediction.error || 'unknown error'}`);
    if (!prediction.urls?.get) throw new Error('Replicate returned an incomplete prediction');
    await new Promise(resolve => setTimeout(resolve, 2000));
    prediction = await readPrediction(await fetch(prediction.urls.get, { headers: replicateHeaders(false) }));
  }
  throw new Error('Replicate prediction timed out');
}

function inputSchema(model: any) { return model?.schema?.components?.schemas?.Input?.properties || {}; }
function enumFromSchema(model: any, propertyName: string) {
  const property = inputSchema(model)[propertyName];
  if (!property) return [];
  if (Array.isArray(property.enum)) return property.enum;
  const ref = property?.allOf?.[0]?.['$ref'];
  if (!ref) return [];
  const schemaName = String(ref).split('/').pop();
  return model?.schema?.components?.schemas?.[schemaName]?.enum || [];
}
function defaultFromSchema(model: any, propertyName: string, fallback: any = null) { return inputSchema(model)?.[propertyName]?.default ?? fallback; }

function buildTtsInput(model: any, body: any, sourceText: string) {
  const props = inputSchema(model);
  const input: Record<string, unknown> = {};
  const maxText = model.model_key === 'inworld/realtime-tts-2' ? 2000 : 5000;
  const text = sourceText.slice(0, maxText);
  if (props.prompt) input.prompt = text;
  else if (props.text) input.text = text;
  else throw new Error(`The selected model ${model.model_key} has no supported text input.`);
  if (props.voice) input.voice = body.voice || defaultFromSchema(model, 'voice', 'Rachel');
  if (props.voice_id) input.voice_id = body.voice || defaultFromSchema(model, 'voice_id', 'Ashley');
  const requestedLanguage = typeof body.language_code === 'string' && body.language_code.trim() ? body.language_code.trim() : 'en';
  if (props.language_code) input.language_code = requestedLanguage;
  if (props.language) {
    const languages = enumFromSchema(model, 'language');
    input.language = languages.includes(requestedLanguage) ? requestedLanguage : (languages.includes('auto') ? 'auto' : defaultFromSchema(model, 'language', 'auto'));
  }
  const speed = Number(body.speed), stability = Number(body.stability), similarityBoost = Number(body.similarity_boost), style = Number(body.style);
  if (props.speed && Number.isFinite(speed)) input.speed = Math.min(Number(props.speed.maximum ?? 4), Math.max(Number(props.speed.minimum ?? 0.25), speed));
  if (props.speaking_rate && Number.isFinite(speed)) input.speaking_rate = Math.min(Number(props.speaking_rate.maximum ?? 1.5), Math.max(Number(props.speaking_rate.minimum ?? 0), speed));
  if (props.stability && Number.isFinite(stability)) input.stability = Math.min(1, Math.max(0, stability));
  if (props.similarity_boost && Number.isFinite(similarityBoost)) input.similarity_boost = Math.min(1, Math.max(0, similarityBoost));
  if (props.style && Number.isFinite(style)) input.style = Math.min(1, Math.max(0, style));
  if (props.temperature && Number.isFinite(style)) input.temperature = style <= 0 ? 0 : Math.min(2, Math.max(0, style * 2));
  if (props.audio_format) input.audio_format = 'mp3';
  if (props.sample_rate) input.sample_rate = 48000;
  if (props.text_normalization) input.text_normalization = 'auto';
  return { input, maxText };
}

async function fetchAudioBlob(output: unknown) {
  const audioUrl = Array.isArray(output) ? String(output[0] || '') : String(output || '');
  if (!audioUrl) throw new Error('Replicate returned no speech audio');
  const response = await fetch(audioUrl);
  if (!response.ok) throw new Error(`Unable to download Replicate speech (${response.status})`);
  return await response.blob();
}
function safePart(value: string) { return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'voice'; }
function propsVoices(model: any) {
  const voiceEnums = enumFromSchema(model, 'voice');
  if (voiceEnums.length) return voiceEnums.map(String);
  const props = inputSchema(model);
  if (props.voice_id) {
    const description = String(props.voice_id.description || '');
    const match = description.match(/e\.g\.\s*['\"]([^'\"]+)['\"],\s*['\"]([^'\"]+)['\"],\s*['\"]([^'\"]+)['\"],\s*['\"]([^'\"]+)['\"]/i);
    if (match) return match.slice(1, 5);
  }
  return [];
}
function defaultVoice(model: any) { return String(defaultFromSchema(model, inputSchema(model).voice_id ? 'voice_id' : 'voice', model.model_key === 'inworld/realtime-tts-2' ? 'Ashley' : 'Rachel')); }

serveWithCors(async (req) => {
  try {
    const billing = await createCreditBillingContext(req);
    const user = billing.user;
    const body = await req.json();
    const modelKey = String(body.model_key || 'elevenlabs/v3').trim();
    const { data: model, error: modelError } = await billing.service.from('ai_model_catalog').select('model_key,name,kind,enabled,schema,capabilities').eq('model_key', modelKey).eq('kind', 'speech').eq('enabled', true).maybeSingle();
    if (modelError) throw modelError;
    if (!model) return Response.json({ error: 'Selected speech model is unavailable' }, { status: 400 });

    const voices = propsVoices(model);
    const voice = String(body.voice || defaultVoice(model));
    if (voices.length && !voices.includes(voice)) return Response.json({ error: `Unsupported voice for ${model.name || model.model_key}` }, { status: 400 });

    if (body.preview === true) {
      const { input } = buildTtsInput(model, { ...body, voice, language_code: body.language_code || 'en', speed: 1, stability: 0.5, similarity_boost: 0.75, style: 0 }, PREVIEW_TEXT);
      const cacheDirectory = `voice-previews/${safePart(model.model_key)}`;
      const fileName = `${safePart(voice)}.mp3`;
      const objectPath = `${cacheDirectory}/${fileName}`;
      const { data: cachedFiles, error: listError } = await billing.service.storage.from('media').list(cacheDirectory, { search: fileName, limit: 10 });
      if (listError) throw listError;
      if (!cachedFiles?.some((file: any) => file.name === fileName)) {
        const output = await runReplicateModel(model.model_key, input);
        const blob = await fetchAudioBlob(output);
        const { error: uploadError } = await billing.service.storage.from('media').upload(objectPath, blob, { contentType: 'audio/mpeg', cacheControl: '31536000', upsert: true });
        if (uploadError) throw uploadError;
      }
      const { data } = billing.service.storage.from('media').getPublicUrl(objectPath);
      return Response.json({ file_url: data.publicUrl, model_key: model.model_key, voice, credit_cost: 0, cached_preview: true });
    }

    const text = String(body.text || '');
    if (!text.trim()) return Response.json({ error: 'Text is required' }, { status: 400 });
    const { input, maxText } = buildTtsInput(model, { ...body, voice }, text);
    if (text.length > maxText) return Response.json({ error: `${model.name || model.model_key} supports a maximum of ${maxText.toLocaleString()} characters per generation.` }, { status: 400 });
    const dynamicQuote = await quoteAiService(billing.service, 'generateSpeech', { ...body, text, voice }, model.model_key, 'speech');

    const { result: publicUrl, charge } = await withCreditCharge({ ...billing, toolId: 'tts', provider: 'replicate', relatedEntity: 'generateSpeech', explicitCost: dynamicQuote.credits }, async () => {
      const output = await runReplicateModel(model.model_key, input);
      const blob = await fetchAudioBlob(output);
      const path = `tts/${user.id}/${crypto.randomUUID()}.mp3`;
      const { error: uploadError } = await billing.service.storage.from('media').upload(path, blob, { contentType: 'audio/mpeg', cacheControl: '31536000' });
      if (uploadError) throw uploadError;
      return billing.service.storage.from('media').getPublicUrl(path).data.publicUrl;
    });

    return Response.json({ file_url: publicUrl, url: publicUrl, model_key: model.model_key, model_name: model.name || model.model_key, voice, credit_cost: charge.cost, balance_after: charge.balanceAfter });
  } catch (error) {
    console.error('TTS error:', error instanceof Error ? error.message : String(error));
    return Response.json({ error: error instanceof Error ? error.message : 'Speech generation failed' }, { status: 500 });
  }
});
