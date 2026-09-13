const REPLICATE_API = 'https://api.replicate.com/v1';
const TEXT_MODEL = 'openai/gpt-5.6-terra';
const SPEECH_MODEL = 'minimax/speech-2.8-hd';
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

function headers() {
  return {
    Authorization: `Bearer ${apiToken()}`,
    'Content-Type': 'application/json',
    Prefer: 'wait=60',
  };
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
  const output = await runOfficialModel(TEXT_MODEL, {
    prompt: structuredPrompt,
    system_prompt: instructions || '',
    image_input: imageUrls.filter(Boolean),
    reasoning_effort: reasoningEffort,
    verbosity: 'low',
    max_completion_tokens: 4000,
  });
  const text = outputText(output);
  return schema ? parseJson(text) : text;
}

const voiceAliases: Record<string, string> = {
  river: 'Calm_Woman',
  storm: 'Deep_Voice_Man',
  honey: 'Wise_Woman',
  sunny: 'Lively_Girl',
  spark: 'Friendly_Person',
};

export async function generateSpeech({ text, voice = 'river' }: { text: string; voice?: string }) {
  const output = await runOfficialModel(SPEECH_MODEL, {
    text: text.slice(0, 5000),
    voice_id: voiceAliases[voice] || voiceAliases.river,
    audio_format: 'mp3',
    language_boost: 'Automatic',
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
