import { createClient } from 'npm:@supabase/supabase-js@2.112.2';

const nativeFetch = globalThis.fetch.bind(globalThis);

const db = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false }, global: { fetch: nativeFetch } },
);

export type PromptResolutionRequest = {
  toolKey?: string | null;
  functionKey?: string | null;
  modelKey?: string | null;
  contextTags?: string[];
};

export type ResolvedPrompt = {
  id: string;
  prompt_key: string;
  name: string;
  content: string;
  variables: string[];
  version: number;
  function_key: string;
  context_tags: string[];
  matched_tool: boolean;
  matched_model: boolean;
  matched_function: boolean;
  match_score: number;
};

export async function resolveSystemPrompt({
  toolKey = null,
  functionKey = null,
  modelKey = null,
  contextTags = [],
}: PromptResolutionRequest): Promise<ResolvedPrompt | null> {
  const { data, error } = await db().rpc('resolve_ai_prompt', {
    p_tool_key: toolKey,
    p_function_key: functionKey,
    p_model_key: modelKey,
    p_context_tags: contextTags,
  });

  if (error) throw new Error(`Prompt resolution failed: ${error.message}`);
  return data?.[0] ?? null;
}

export function renderSystemPrompt(prompt: ResolvedPrompt, values: Record<string, unknown> = {}) {
  return String(prompt.content || '').replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) return match;
    const value = values[key];
    return value == null ? '' : String(value);
  });
}
