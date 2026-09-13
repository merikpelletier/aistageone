import { createClient, SupabaseClient, User } from 'npm:@supabase/supabase-js@2';
import { generateSpeech, generateStoryText, generateText, pollStoryText, startStoryText, transcribeAudio } from './replicateAi.ts';
import { agentPrompts } from './generatedAgentPrompts.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function snakeCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function normalizeValues(values: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [snakeCase(key), value]));
}

function applyFilters(query: any, filters: Record<string, unknown> = {}) {
  return Object.entries(filters).reduce((current, [field, value]) => {
    const column = snakeCase(field);
    if (value === null) return current.is(column, null);
    if (Array.isArray(value)) return current.contains(column, value);
    return current.eq(column, value);
  }, query);
}

function applyOrdering(query: any, sort?: string) {
  if (!sort) return query.order('created_date', { ascending: false });
  const descending = sort.startsWith('-');
  return query.order(snakeCase(descending ? sort.slice(1) : sort), { ascending: !descending });
}

function throwIfError(error: any) {
  if (error) throw new Error(error.message || 'Supabase operation failed');
}

function mapAuthUser(user: User | null) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
    role: user.app_metadata?.role || 'user',
  };
}

function createEntityClient(
  client: SupabaseClient,
  entityName: string,
  currentUser: () => Promise<User | null>,
) {
  if (entityName === 'User') {
    return {
      async filter(filters: Record<string, unknown> = {}) {
        const user = await currentUser();
        if (!user) return [];
        if (filters.email && String(filters.email).toLowerCase() !== user.email?.toLowerCase()) return [];
        return [mapAuthUser(user)];
      },
      async get(id: string) {
        const user = await currentUser();
        return user?.id === id ? mapAuthUser(user) : null;
      },
    };
  }

  const table = snakeCase(entityName);
  return {
    async filter(filters: Record<string, unknown> = {}, sort?: string, limit = 100) {
      let query = client.from(table).select('*');
      query = applyFilters(query, filters);
      query = applyOrdering(query, sort);
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      throwIfError(error);
      return data || [];
    },
    async list(sort?: string, limit = 100) {
      let query = applyOrdering(client.from(table).select('*'), sort);
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      throwIfError(error);
      return data || [];
    },
    async get(id: string) {
      const { data, error } = await client.from(table).select('*').eq('id', id).single();
      throwIfError(error);
      return data;
    },
    async create(values: Record<string, unknown>) {
      const user = await currentUser();
      const payload = normalizeValues({
        created_by_id: user?.id,
        created_by: user?.email,
        ...values,
      });
      const { data, error } = await client.from(table).insert(payload).select('*').single();
      throwIfError(error);
      return data;
    },
    async update(id: string, values: Record<string, unknown>) {
      const { data, error } = await client
        .from(table)
        .update(normalizeValues(values))
        .eq('id', id)
        .select('*')
        .single();
      throwIfError(error);
      return data;
    },
    async delete(id: string) {
      const { error } = await client.from(table).delete().eq('id', id);
      throwIfError(error);
      return true;
    },
  };
}

function entityProxy(client: SupabaseClient, currentUser: () => Promise<User | null>) {
  return new Proxy({}, {
    get(cache: Record<string, unknown>, name: string) {
      if (!cache[name]) cache[name] = createEntityClient(client, name, currentUser);
      return cache[name];
    },
  });
}

async function uploadFile(client: SupabaseClient, user: User | null, file: File) {
  const extension = file.name?.split('.').pop() || file.type?.split('/').pop() || 'bin';
  const objectPath = `${user?.id || 'service'}/${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage.from('media').upload(objectPath, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  throwIfError(error);
  const { data } = client.storage.from('media').getPublicUrl(objectPath);
  return { file_url: data.publicUrl, url: data.publicUrl };
}

async function sendEmail() {
  throw new Error('Email provider is not configured yet');
}

async function processAgentMessage(
  service: SupabaseClient,
  conversation: any,
  message: Record<string, unknown>,
) {
  const messages = [...(conversation.messages || []), {
    id: crypto.randomUUID(),
    role: message.role || 'user',
    content: message.content || '',
    created_at: new Date().toISOString(),
  }];
  const prompt = messages
    .slice(-12)
    .map((item: any) => `${item.role === 'assistant' ? 'Assistant' : 'User'}: ${item.content}`)
    .join('\n\n');
  const isStoryAgent = conversation.agent_name === 'story_orchestrator';
  const instructions = agentPrompts[conversation.agent_name] || agentPrompts.production_assistant;
  const answer = isStoryAgent
    ? await generateStoryText({ instructions, prompt })
    : await generateText({
        instructions,
        prompt,
        imageUrls: Array.isArray(message.file_urls) ? message.file_urls as string[] : [],
        reasoningEffort: 'low',
      });
  messages.push({
    id: crypto.randomUUID(),
    role: 'assistant',
    content: typeof answer === 'string' ? answer : JSON.stringify(answer),
    created_at: new Date().toISOString(),
  });
  const { data, error } = await service
    .from('ai_conversation')
    .update({ messages, updated_at: new Date().toISOString() })
    .eq('id', conversation.id)
    .select('*')
    .single();
  throwIfError(error);
  return data;
}

async function startStoryAgentMessage(
  service: SupabaseClient,
  conversation: any,
  message: Record<string, unknown>,
) {
  const messages = [...(conversation.messages || []), {
    id: crypto.randomUUID(),
    role: message.role || 'user',
    content: message.content || '',
    created_at: new Date().toISOString(),
  }];
  const prompt = messages
    .slice(-12)
    .map((item: any) => `${item.role === 'assistant' ? 'Assistant' : 'User'}: ${item.content}`)
    .join('\n\n');
  const prediction = await startStoryText({
    instructions: agentPrompts.story_orchestrator,
    prompt,
  });
  if (prediction.status === 'succeeded' && prediction.output) {
    messages.push({
      id: crypto.randomUUID(),
      role: 'assistant',
      content: Array.isArray(prediction.output) ? prediction.output.join('') : String(prediction.output),
      created_at: new Date().toISOString(),
    });
  }
  const metadata = prediction.status === 'succeeded'
    ? (conversation.metadata || {})
    : { ...(conversation.metadata || {}), replicate_prediction_id: prediction.id };
  const { data, error } = await service.from('ai_conversation').update({
    messages,
    metadata,
    updated_at: new Date().toISOString(),
  }).eq('id', conversation.id).select('*').single();
  throwIfError(error);
  return data;
}

async function pollStoryAgentMessage(service: SupabaseClient, conversation: any) {
  const predictionId = conversation.metadata?.replicate_prediction_id;
  if (!predictionId) return conversation;
  const result = await pollStoryText(String(predictionId));
  if (result.status !== 'succeeded' || !result.text) return conversation;
  const messages = [...(conversation.messages || []), {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: result.text,
    created_at: new Date().toISOString(),
  }];
  const { replicate_prediction_id: _completedPrediction, ...metadata } = conversation.metadata || {};
  const { data, error } = await service.from('ai_conversation').update({
    messages,
    metadata,
    updated_at: new Date().toISOString(),
  }).eq('id', conversation.id).select('*').single();
  throwIfError(error);
  return data;
}

export function createClientFromRequest(request: Request) {
  const authorization = request.headers.get('Authorization') || '';
  const scoped = createClient(supabaseUrl, anonKey, {
    global: { headers: authorization ? { Authorization: authorization } : {} },
    auth: { persistSession: false },
  });
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  let userPromise: Promise<User | null> | null = null;
  const currentUser = () => {
    if (!userPromise) {
      userPromise = scoped.auth.getUser().then(({ data }) => data.user || null).catch(() => null);
    }
    return userPromise;
  };

  const scopedEntities = entityProxy(scoped, currentUser);
  const serviceEntities = entityProxy(service, currentUser);
  const integrations = {
    Core: {
      UploadFile: async ({ file }: { file: File }) => uploadFile(service, await currentUser(), file),
      GenerateSpeech: async (payload: { text: string; voice?: string; speed?: number; stability?: number; similarityBoost?: number; style?: number; languageCode?: string }) => {
        const blob = await generateSpeech(payload);
        return await uploadFile(service, await currentUser(), new File([blob], 'speech.mp3', { type: 'audio/mpeg' }));
      },
      InvokeLLM: async (payload: any) => generateText({
        prompt: payload.prompt,
        imageUrls: payload.file_urls || [],
        schema: payload.response_json_schema,
      }),
      TranscribeAudio: async ({ audio_url }: { audio_url: string }) => transcribeAudio(audio_url),
      SendEmail: sendEmail,
    },
  };

  const agents = {
    async createConversation(payload: Record<string, unknown>) {
      const user = await currentUser();
      if (!user) throw new Error('Unauthorized');
      const { data, error } = await service.from('ai_conversation').insert({
        user_id: user.id,
        agent_name: payload.agent_name,
        metadata: payload.metadata || {},
      }).select('*').single();
      throwIfError(error);
      return data;
    },
    async getConversation(id: string) {
      const user = await currentUser();
      if (!user) throw new Error('Unauthorized');
      const { data, error } = await service.from('ai_conversation')
        .select('*').eq('id', id).eq('user_id', user.id).single();
      throwIfError(error);
      return data;
    },
    async addMessage(conversation: any, message: Record<string, unknown>) {
      const current = await this.getConversation(conversation.id);
      return await processAgentMessage(service, current, message);
    },
    async startMessage(conversation: any, message: Record<string, unknown>) {
      const current = await this.getConversation(conversation.id);
      if (current.agent_name !== 'story_orchestrator') {
        return await processAgentMessage(service, current, message);
      }
      return await startStoryAgentMessage(service, current, message);
    },
    async pollMessage(conversation: any) {
      const current = await this.getConversation(conversation.id);
      if (current.agent_name !== 'story_orchestrator') return current;
      return await pollStoryAgentMessage(service, current);
    },
  };

  const client = {
    auth: {
      async me() {
        const user = await currentUser();
        if (!user) throw new Error('Unauthorized');
        return mapAuthUser(user);
      },
    },
    entities: scopedEntities,
    integrations,
    agents,
  };

  return {
    ...client,
    asServiceRole: {
      ...client,
      entities: serviceEntities,
      integrations,
    },
  };
}
