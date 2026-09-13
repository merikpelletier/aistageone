const OPENAI_API = 'https://api.openai.com/v1';

function apiKey() {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new Error('OPENAI_API_KEY is not configured');
  return key;
}

async function request(path: string, init: RequestInit) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${apiKey()}`);
  const response = await fetch(`${OPENAI_API}${path}`, { ...init, headers });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI error (${response.status}): ${detail.slice(0, 1000)}`);
  }
  return response;
}

function extractText(data: Record<string, unknown>) {
  if (typeof data.output_text === 'string') return data.output_text;
  const output = Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? (item as Record<string, unknown>).content as Array<Record<string, unknown>>
      : [];
    for (const part of content) {
      if ((part.type === 'output_text' || part.type === 'text') && typeof part.text === 'string') {
        return part.text;
      }
    }
  }
  throw new Error('OpenAI returned no text');
}

export async function generateText({
  prompt,
  instructions,
  imageUrls = [],
  schema,
  model = Deno.env.get('OPENAI_TEXT_MODEL') || 'gpt-5.6-terra',
  reasoningEffort = 'low',
}: {
  prompt: string;
  instructions?: string;
  imageUrls?: string[];
  schema?: Record<string, unknown>;
  model?: string;
  reasoningEffort?: string;
}) {
  const content: Array<Record<string, unknown>> = [{ type: 'input_text', text: prompt }];
  imageUrls.filter(Boolean).forEach((imageUrl) => {
    content.push({ type: 'input_image', image_url: imageUrl, detail: 'auto' });
  });

  const body: Record<string, unknown> = {
    model,
    input: [{ role: 'user', content }],
    reasoning: { effort: reasoningEffort },
    store: false,
  };
  if (instructions) body.instructions = instructions;
  if (schema) {
    body.text = {
      format: {
        type: 'json_schema',
        name: 'aistage_response',
        strict: false,
        schema,
      },
    };
  }

  const response = await request('/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = extractText(await response.json());
  if (!schema) return text;
  return JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
}

const voiceAliases: Record<string, string> = {
  river: 'onyx',
  storm: 'echo',
  honey: 'coral',
  sunny: 'nova',
  spark: 'shimmer',
};

export async function generateSpeech({ text, voice = 'river' }: { text: string; voice?: string }) {
  const response = await request('/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: Deno.env.get('OPENAI_SPEECH_MODEL') || 'tts-1',
      voice: voiceAliases[voice] || voice,
      input: text.slice(0, 5000),
      response_format: 'mp3',
    }),
  });
  return await response.blob();
}

export async function transcribeAudio(audioUrl: string) {
  const source = await fetch(audioUrl);
  if (!source.ok) throw new Error(`Unable to download audio (${source.status})`);
  const blob = await source.blob();
  const form = new FormData();
  form.append('file', new File([blob], 'recording.webm', { type: blob.type || 'audio/webm' }));
  form.append('model', Deno.env.get('OPENAI_TRANSCRIBE_MODEL') || 'gpt-4o-transcribe');
  const response = await request('/audio/transcriptions', { method: 'POST', body: form });
  const data = await response.json();
  if (typeof data.text !== 'string') throw new Error('OpenAI returned no transcription');
  return data.text;
}
