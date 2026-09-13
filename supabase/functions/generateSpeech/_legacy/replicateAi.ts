const REPLICATE_API = 'https://api.replicate.com/v1';
const TEXT_MODELS = [
  'openai/gpt-5-mini',
] as const;
const STORY_TEXT_MODEL = 'meta/llama-4-maverick-instruct';
const SPEECH_MODEL = 'elevenlabs/v3';
const WHISPER_VERSION = '8099696689d249cf8b122d833c36ac3f75505c666a395ca40ef26f68e7d3d16e';

type Prediction = {
  id?: string;
  status?: string;
  output?: unknown;
  error?: unknown;
  detail?: unknown;
  urls?: { get?: string };
};

function apiToken() {
  const token = Deno.env.get('REPLICATE_API_TOKEN');
  if (!token) throw new Error('REPLICATE_API_TOKEN is not configured');
  return token;
}

function headers(preferWait = true) {
  const value: Record<string, string> = {
    Authorization: `Bearer ${apiToken()}`,
    'Content-Type': 'application/json',
  };
  if (preferWait) value.Prefer = 'wait=60';
  return value;
}

async function readPrediction(response: Response) {
  const prediction = await response.json() as Prediction;
  if (!response.ok) {
    throw new Error(`Replicate error (${response.status}): ${prediction.error || prediction.detail || JSON.stringify(prediction)}`);
  }
  return prediction;
}

async function waitForPrediction(initial: Prediction) {
  let prediction = initial;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    if (prediction.status === 'succeeded') return prediction.output;
    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new Error(`Replicate prediction ${prediction.status}: ${prediction.error || 'unknown error'}`);
    }
    if (!prediction.urls?.get) {
      throw new Error(`Replicate returned an incomplete prediction (status: ${prediction.status || 'unknown'})`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2500));
    prediction = await readPrediction(await fetch(prediction.urls.get, { headers: headers() }));
  }
  throw new Error('Replicate prediction timed out');
}

async function runOfficialModel(model: string, input: Record<string, unknown>) {
  const response = await fetch(`${REPLICATE_API}/models/${model}/predictions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ input }),
  });
  return await waitForPrediction(await readPrediction(response));
}

async function runVersion(version: string, input: Record<string, unknown>) {
  const response = await fetch(`${REPLICATE_API}/predictions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ version, input }),
  });
  return await waitForPrediction(await readPrediction(response));
}

function outputText(output: unknown) {
  const text = Array.isArray(output) ? output.join('') : String(output || '');
  if (!text.trim()) throw new Error('Replicate returned no text');
  return text.trim();
}

function parseJson(text: string) {
  const withoutFence = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(withoutFence.slice(start, end + 1));
    throw new Error('Replicate returned invalid JSON');
  }
}

export async function generateText({
  prompt,
  instructions,
  imageUrls = [],
  schema,
  reasoningEffort = 'low',
}: {
  prompt: string;
  instructions?: string;
  imageUrls?: string[];
  schema?: Record<string, unknown>;
  reasoningEffort?: string;
}) {
  const structuredPrompt = schema
    ? `${prompt}\n\nReturn only valid JSON matching this schema exactly:\n${JSON.stringify(schema)}`
    : prompt;
  const input = {
    prompt: structuredPrompt,
    system_prompt: instructions || '',
    image_input: imageUrls.filter(Boolean),
    reasoning_effort: reasoningEffort,
    verbosity: 'low',
    max_completion_tokens: 4000,
  };
  let output: unknown;
  let lastError: unknown;
  for (let attempt = 0; attempt < TEXT_MODELS.length; attempt += 1) {
    try {
      output = await runOfficialModel(TEXT_MODELS[attempt], input);
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      console.warn(`Replicate text attempt ${attempt + 1}/${TEXT_MODELS.length} failed on ${TEXT_MODELS[attempt]}: ${error instanceof Error ? error.message : String(error)}`);
      if (attempt < TEXT_MODELS.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
      }
    }
  }
  if (lastError) throw lastError;
  const text = outputText(output);
  return schema ? parseJson(text) : text;
}

export async function generateStoryText({
  prompt,
  instructions,
}: {
  prompt: string;
  instructions?: string;
}) {
  const output = await runOfficialModel(STORY_TEXT_MODEL, storyTextInput(prompt, instructions));
  return outputText(output);
}

function storyTextInput(prompt: string, instructions?: string) {
  return {
    prompt,
    system_prompt: instructions || '',
    max_tokens: 12000,
    temperature: 0.2,
    top_p: 0.9,
    top_k: 40,
  };
}

export async function startStoryText({
  prompt,
  instructions,
}: {
  prompt: string;
  instructions?: string;
}) {
  const response = await fetch(`${REPLICATE_API}/models/${STORY_TEXT_MODEL}/predictions`, {
    method: 'POST',
    headers: headers(false),
    body: JSON.stringify({ input: storyTextInput(prompt, instructions) }),
  });
  const prediction = await readPrediction(response);
  if (!prediction.id) throw new Error('Replicate returned no prediction id');
  return prediction;
}

export async function pollStoryText(predictionId: string) {
  const prediction = await readPrediction(await fetch(`${REPLICATE_API}/predictions/${predictionId}`, {
    headers: headers(false),
  }));
  if (prediction.status === 'failed' || prediction.status === 'canceled') {
    throw new Error(`Replicate prediction ${prediction.status}: ${prediction.error || 'unknown error'}`);
  }
  return {
    status: prediction.status || 'starting',
    text: prediction.status === 'succeeded' ? outputText(prediction.output) : null,
  };
}

export async function generateSpeech({
  text,
  voice = 'Rachel',
  speed = 1,
  stability = 0.5,
  similarityBoost = 0.75,
  style = 0,
  languageCode = 'en',
}: {
  text: string;
  voice?: string;
  speed?: number;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  languageCode?: string;
}) {
  const output = await runOfficialModel(SPEECH_MODEL, {
    prompt: text.slice(0, 5000),
    voice,
    speed,
    stability,
    similarity_boost: similarityBoost,
    style,
    language_code: languageCode,
  });
  const audioUrl = String(output || '');
  if (!audioUrl) throw new Error('Replicate returned no speech audio');
  const response = await fetch(audioUrl);
  if (!response.ok) throw new Error(`Unable to download Replicate speech (${response.status})`);
  return await response.blob();
}

export async function transcribeAudio(audioUrl: string) {
  const output = await runVersion(WHISPER_VERSION, {
    audio: audioUrl,
    language: 'auto',
    translate: false,
    transcription: 'plain text',
  }) as Record<string, unknown>;
  const text = typeof output?.transcription === 'string' ? output.transcription : '';
  if (!text.trim()) throw new Error('Replicate returned no transcription');
  return text;
}
