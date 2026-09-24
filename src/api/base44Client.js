import { supabase } from '@/api/supabaseClient';

export { supabase } from '@/api/supabaseClient';

function snakeCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function throwIfError(error) {
  if (error) {
    const wrapped = new Error(error.message || 'Erreur Supabase');
    wrapped.code = error.code;
    wrapped.status = error.status;
    throw wrapped;
  }
}

function applyFilters(query, filters = {}) {
  return Object.entries(filters).reduce((current, [field, value]) => {
    const column = snakeCase(field);
    if (value === null) return current.is(column, null);
    if (Array.isArray(value)) return current.contains(column, value);
    return current.eq(column, value);
  }, query);
}

function applyOrdering(query, sort) {
  if (!sort) return query.order('created_date', { ascending: false });
  const descending = sort.startsWith('-');
  const column = snakeCase(descending ? sort.slice(1) : sort);
  return query.order(column, { ascending: !descending, nullsFirst: false });
}

async function currentUserMetadata() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return {};
  return {
    created_by_id: data.user.id,
  };
}

const ENTITY_TABLE_OVERRIDES = {
  Product: 'products',
  ShopSection: 'shop_sections',
  ShopSettings: 'shop_settings',
};

function createEntityClient(entityName) {
  const table = ENTITY_TABLE_OVERRIDES[entityName] || snakeCase(entityName);

  return {
    async list(sort, limit = 100) {
      let query = supabase.from(table).select('*');
      query = applyOrdering(query, sort);
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      throwIfError(error);
      return data || [];
    },

    async filter(filters = {}, sort, limit = 100) {
      let query = supabase.from(table).select('*');
      query = applyFilters(query, filters);
      query = applyOrdering(query, sort);
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      throwIfError(error);
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .single();
      throwIfError(error);
      return data;
    },

    async create(values) {
      const metadata = await currentUserMetadata();
      const payload = { ...metadata, ...values };
      const { data, error } = await supabase
        .from(table)
        .insert(payload)
        .select('*')
        .single();
      throwIfError(error);
      return data;
    },

    async update(id, values) {
      const { data, error } = await supabase
        .from(table)
        .update(values)
        .eq('id', id)
        .select('*')
        .single();
      throwIfError(error);
      return data;
    },

    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      throwIfError(error);
      return true;
    },

    async deleteMany(filters = {}) {
      let query = supabase.from(table).delete();
      query = applyFilters(query, filters);
      const { error } = await query;
      throwIfError(error);
      return true;
    },

    async bulkUpdate(updates) {
      const { data, error } = await supabase
        .from(table)
        .upsert(updates, { onConflict: 'id' })
        .select('*');
      throwIfError(error);
      return data || [];
    },
  };
}

const entities = new Proxy(
  {},
  {
    get(cache, entityName) {
      if (!cache[entityName]) {
        cache[entityName] = createEntityClient(String(entityName));
      }
      return cache[entityName];
    },
  },
);

async function mapUser(user) {
  if (!user) return null;
  const { data: profiles } = await supabase
    .from('member_profile')
    .select('*')
    .or(`auth_user_id.eq.${user.id},user_email.eq.${user.email}`)
    .limit(1);
  const profile = profiles?.[0] || null;
  return {
    id: user.id,
    email: user.email,
    full_name: profile?.display_name || user.user_metadata?.full_name || user.user_metadata?.name || '',
    ...user.user_metadata,
    role: user.app_metadata?.role || 'user',
    profile,
  };
}

const auth = {
  async isAuthenticated() {
    const { data } = await supabase.auth.getSession();
    return Boolean(data.session);
  },

  async me() {
    const { data, error } = await supabase.auth.getUser();
    throwIfError(error);
    if (!data.user) throw new Error('Authentification requise');
    return await mapUser(data.user);
  },

  redirectToLogin(returnUrl = window.location.href) {
    const target = encodeURIComponent(returnUrl);
    window.location.assign(`/Login?returnTo=${target}`);
  },

  async logout(returnUrl) {
    const { error } = await supabase.auth.signOut();
    throwIfError(error);
    if (returnUrl) window.location.assign('/');
  },
};

const idempotentFunctions = new Set([
  'agent-conversations',
  'generate-image',
  'generate-speech',
  'generateSpeech',
  'generateCharacterSheet',
  'generateVideo',
  'generateStoryBlock',
  'invoke-llm',
  'mixAudioVideo',
  'proposeStoryArc',
  'regenerateNarration',
  'replicateGenerate',
  'transcribe-audio',
]);

async function invokeFunction(name, payload) {
  const headers = idempotentFunctions.has(name)
    ? { 'x-idempotency-key': crypto.randomUUID() }
    : undefined;
  const { data, error } = await supabase.functions.invoke(name, {
    body: payload || {},
    headers,
  });
  if (error) {
    let serverMessage = '';
    try {
      const response = error.context;
      if (response && typeof response.json === 'function' && !response.bodyUsed) {
        const details = await response.json();
        serverMessage = details?.error || details?.message || '';
      }
    } catch {
      // Keep the Supabase message when the response body is not JSON.
    }
    const fallbackMessage = /body is unusable/i.test(error.message || '')
      ? 'La génération n’a pas pu démarrer. Aucun crédit débité.'
      : (error.message || 'Erreur Supabase');
    const wrapped = new Error(serverMessage || fallbackMessage);
    wrapped.code = error.code;
    wrapped.status = error.status || error.context?.status;
    throw wrapped;
  }
  return { data };
}

const functions = {
  invoke: invokeFunction,
};

async function saveAdminStoryTheme(id, values) {
  const { data, error } = await supabase.rpc('admin_save_story_theme', {
    theme_id: id || null,
    theme_values: values,
  });
  throwIfError(error);
  return data;
}

async function saveAdminStoryCharacter(id, values) {
  const { data, error } = await supabase.rpc('admin_save_story_character', {
    character_id: id || null,
    character_values: values,
  });
  throwIfError(error);
  return data;
}

async function setAdminStoryThemeCharacters(id, characterIds) {
  const { data, error } = await supabase.rpc('admin_set_story_theme_characters', {
    theme_id: id,
    character_ids: characterIds,
  });
  throwIfError(error);
  return data;
}

async function saveAdminStorySet(id, values) {
  const { data, error } = await supabase.rpc('admin_save_story_set', {
    set_id: id || null,
    set_values: values,
  });
  throwIfError(error);
  return data;
}

async function setAdminStoryThemeSets(id, setIds) {
  const { data, error } = await supabase.rpc('admin_set_story_theme_sets', {
    theme_id: id,
    set_ids: setIds,
  });
  throwIfError(error);
  return data;
}

async function saveAdminStartingTopic(id, values) {
  const { data, error } = await supabase.rpc('admin_save_starting_topic', {
    topic_id: id || null,
    topic_values: values,
  });
  throwIfError(error);
  return data;
}

async function deleteAdminStoryTheme(id) {
  const { error } = await supabase.rpc('admin_delete_story_theme', { theme_id: id });
  throwIfError(error);
}

async function deleteAdminStartingTopic(id) {
  const { error } = await supabase.rpc('admin_delete_starting_topic', { topic_id: id });
  throwIfError(error);
}

async function deleteAdminStoryCharacter(id) {
  const { error } = await supabase.rpc('admin_delete_story_character', { character_id: id });
  throwIfError(error);
}

async function deleteAdminStorySet(id) {
  const { error } = await supabase.rpc('admin_delete_story_set', { set_id: id });
  throwIfError(error);
}

async function setAdminStoryThemeMedia(id, mediaUrls) {
  const { data, error } = await supabase.rpc('admin_set_story_theme_media', {
    theme_id: id,
    media_urls: mediaUrls,
  });
  throwIfError(error);
  return data;
}

async function markPrivateMessageRead(id) {
  const { data, error } = await supabase.rpc('member_mark_private_message_read', {
    message_id: id,
  });
  throwIfError(error);
  return data;
}

async function deleteTemporaryProfile(id) {
  const { error } = await supabase.rpc('member_delete_temporary_profile', {
    profile_id: id,
  });
  throwIfError(error);
}

async function invokeCoreFunction(name, payload) {
  const result = await invokeFunction(name, payload);
  return result.data;
}

const coreIntegrations = {
  async UploadFile({ file }) {
    const { data: userData } = await supabase.auth.getUser();
    const owner = userData.user?.id || 'public';
    const extension = file.name?.split('.').pop() || 'bin';
    const objectPath = `${owner}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from('media').upload(objectPath, file, {
      cacheControl: '3600',
      upsert: false,
    });
    throwIfError(error);
    const { data } = supabase.storage.from('media').getPublicUrl(objectPath);
    return { file_url: data.publicUrl };
  },
  GenerateImage: (payload) => invokeCoreFunction('generate-image', payload),
  GenerateSpeech: (payload) => invokeCoreFunction('generateSpeech', payload),
  InvokeLLM: (payload) => invokeCoreFunction('invoke-llm', payload),
  SendEmail: (payload) => invokeCoreFunction('send-email', payload),
  TranscribeAudio: (payload) => invokeCoreFunction('transcribe-audio', payload),
};

const conversationSubscribers = new Map();

function publishConversation(conversation) {
  if (!conversation?.id) return conversation;
  const subscribers = conversationSubscribers.get(conversation.id);
  subscribers?.forEach((callback) => callback(conversation));
  return conversation;
}

const agents = {
  listConversations: (payload) => invokeFunction('agent-conversations', { action: 'list', ...payload }).then((result) => result.data),
  createConversation: (payload) => invokeFunction('agent-conversations', { action: 'create', ...payload }).then((result) => publishConversation(result.data)),
  addMessage: (conversation, message) => invokeFunction('agent-conversations', {
    action: 'message',
    conversation_id: conversation.id,
    message,
  }).then((result) => publishConversation(result.data)),
  getConversation: (conversationId) => invokeFunction('agent-conversations', {
    action: 'get',
    conversation_id: conversationId,
  }).then((result) => result.data),
  subscribeToConversation(conversationId, callback) {
    const subscribers = conversationSubscribers.get(conversationId) || new Set();
    subscribers.add(callback);
    conversationSubscribers.set(conversationId, subscribers);
    return () => {
      subscribers.delete(callback);
      if (subscribers.size === 0) conversationSubscribers.delete(conversationId);
    };
  },
};

export const base44 = {
  auth,
  entities,
  functions,
  admin: {
    saveStoryTheme: saveAdminStoryTheme,
    saveStoryCharacter: saveAdminStoryCharacter,
    setStoryThemeCharacters: setAdminStoryThemeCharacters,
    saveStorySet: saveAdminStorySet,
    setStoryThemeSets: setAdminStoryThemeSets,
    saveStartingTopic: saveAdminStartingTopic,
    deleteStoryTheme: deleteAdminStoryTheme,
    deleteStartingTopic: deleteAdminStartingTopic,
    deleteStoryCharacter: deleteAdminStoryCharacter,
    deleteStorySet: deleteAdminStorySet,
    setStoryThemeMedia: setAdminStoryThemeMedia,
  },
  member: {
    markPrivateMessageRead,
    deleteTemporaryProfile,
  },
  integrations: { Core: coreIntegrations },
  agents,
};
