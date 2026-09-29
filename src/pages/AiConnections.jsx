import React, { useEffect, useMemo, useState } from 'react';
import { KeyRound, Link2, Loader2, Plug, RefreshCw, Trash2 } from 'lucide-react';
import { supabase } from '@/api/base44Client';

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', capabilities: ['Text', 'Image', 'Speech', 'Transcription'] },
  { id: 'google', name: 'Google', capabilities: ['Text', 'Image', 'Video', 'Audio'] },
  { id: 'anthropic', name: 'Anthropic', capabilities: ['Text', 'Vision'] },
  { id: 'xai', name: 'xAI', capabilities: ['Text', 'Vision', 'Image'] },
  { id: 'mistral', name: 'Mistral', capabilities: ['Text', 'Vision', 'OCR'] },
  { id: 'cohere', name: 'Cohere', capabilities: ['Text', 'Embeddings', 'Rerank'] },
  { id: 'together', name: 'Together AI', capabilities: ['Text', 'Image', 'Embeddings'] },
  { id: 'groq', name: 'Groq', capabilities: ['Text', 'Speech', 'Transcription'] },
  { id: 'elevenlabs', name: 'ElevenLabs', capabilities: ['Speech', 'Voice', 'Audio'] },
  { id: 'stability', name: 'Stability AI', capabilities: ['Image', 'Video'] },
];

const statusLabel = (status) => {
  if (status === 'connected') return 'Connected';
  if (status === 'error') return 'Connection error';
  if (status === 'disabled') return 'Disabled';
  if (status === 'pending') return 'Credential required';
  return 'Not connected';
};

export default function AiConnections({ embedded = false, onClose = null }) {
  const [userId, setUserId] = useState(null);
  const [connections, setConnections] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingProvider, setWorkingProvider] = useState(null);
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    setNotice('');
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth?.user) {
      setNotice('Sign in is required to manage AI connections.');
      setLoading(false);
      return;
    }
    setUserId(auth.user.id);
    const [{ data: connectionRows, error: connectionError }, { data: modelRows, error: modelError }] = await Promise.all([
      supabase.from('ai_user_connection').select('*').eq('user_id', auth.user.id).order('created_at'),
      supabase.from('ai_user_connected_model').select('*').eq('user_id', auth.user.id).order('display_name'),
    ]);
    if (connectionError || modelError) {
      setNotice(connectionError?.message || modelError?.message || 'Unable to load AI connections.');
    }
    setConnections(connectionRows || []);
    setModels(modelRows || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const byProvider = useMemo(() => {
    const map = new Map();
    for (const connection of connections) {
      if (!map.has(connection.provider)) map.set(connection.provider, []);
      map.get(connection.provider).push(connection);
    }
    return map;
  }, [connections]);

  const beginSetup = async (provider) => {
    if (!userId) return;
    setWorkingProvider(provider.id);
    setNotice('');
    const existing = byProvider.get(provider.id)?.[0];
    if (existing) {
      setNotice(existing.status === 'connected'
        ? `${provider.name} is already connected.`
        : `${provider.name} is ready for credential setup.`);
      setWorkingProvider(null);
      return;
    }
    const { error } = await supabase.from('ai_user_connection').insert({
      user_id: userId,
      provider: provider.id,
      connection_name: provider.name,
      auth_mode: 'api_key',
      status: 'pending',
      metadata: { capabilities: provider.capabilities },
    });
    if (error) setNotice(error.message);
    else {
      setNotice(`${provider.name} added. The secure credential step is next.`);
      await load();
    }
    setWorkingProvider(null);
  };

  const removeConnection = async (connection) => {
    setWorkingProvider(connection.provider);
    setNotice('');
    const { error } = await supabase.from('ai_user_connection').delete().eq('id', connection.id).eq('user_id', userId);
    if (error) setNotice(error.message);
    else {
      setNotice('Connection removed.');
      await load();
    }
    setWorkingProvider(null);
  };

  return (
    <div className={`${embedded ? 'h-full overflow-y-auto' : 'min-h-screen'} bg-[#202328] text-white`}>
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 pb-28">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-teal-300">
              <Plug size={15} /> Personal AI
            </div>
            <h1 className="text-2xl font-semibold">My AI Connections</h1>
            <p className="mt-2 max-w-3xl text-sm text-white/60">
              Connect your own AI providers. AISTAGE will only offer your models inside Studio tools that support their capabilities.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={load} className="inline-flex items-center gap-2 border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-white hover:bg-white/10">
              <RefreshCw size={14} /> Refresh
            </button>
            {onClose && <button type="button" onClick={onClose} className="border border-white/15 px-3 py-2 text-xs font-bold">Close</button>}
          </div>
        </div>

        <div className="mb-6 border border-teal-400/20 bg-teal-400/5 p-4">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 shrink-0 text-teal-300" size={18} />
            <div>
              <p className="text-sm font-semibold">Your provider, your billing</p>
              <p className="mt-1 text-xs leading-5 text-white/55">
                Provider charges remain on your own provider account. AISTAGE will keep provider credentials private and use them only through the secure server-side connection layer.
              </p>
            </div>
          </div>
        </div>

        {notice && <div className="mb-5 border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75">{notice}</div>}

        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center gap-3 text-white/60"><Loader2 className="animate-spin" size={20} /> Loading connections…</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {PROVIDERS.map((provider) => {
              const connection = byProvider.get(provider.id)?.[0] || null;
              const providerModels = connection ? models.filter((model) => model.connection_id === connection.id) : [];
              const busy = workingProvider === provider.id;
              return (
                <div key={provider.id} className="border border-white/10 bg-[#17191d] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold">{provider.name}</h2>
                      <p className={`mt-1 text-[11px] font-bold uppercase tracking-wide ${connection?.status === 'connected' ? 'text-emerald-400' : connection ? 'text-amber-300' : 'text-white/35'}`}>
                        {statusLabel(connection?.status)}
                      </p>
                    </div>
                    <div className="flex h-9 w-9 items-center justify-center border border-white/10 bg-white/5 text-sm font-black text-teal-300">
                      {provider.name.slice(0, 2).toUpperCase()}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {provider.capabilities.map((capability) => (
                      <span key={capability} className="border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-white/65">{capability}</span>
                    ))}
                  </div>

                  {connection && (
                    <div className="mt-4 border-t border-white/10 pt-3 text-xs text-white/50">
                      <div className="flex justify-between gap-3"><span>Connection</span><span className="truncate text-white/75">{connection.connection_name}</span></div>
                      <div className="mt-1 flex justify-between gap-3"><span>Models</span><span className="text-white/75">{providerModels.length}</span></div>
                    </div>
                  )}

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => beginSetup(provider)}
                      disabled={busy}
                      className="inline-flex min-h-9 flex-1 items-center justify-center gap-2 bg-teal-500 px-3 text-xs font-bold text-black disabled:opacity-50"
                    >
                      {busy ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
                      {connection ? (connection.status === 'connected' ? 'MANAGE' : 'CONTINUE SETUP') : 'SET UP'}
                    </button>
                    {connection && (
                      <button type="button" onClick={() => removeConnection(connection)} disabled={busy} className="flex h-9 w-9 items-center justify-center border border-white/10 text-white/45 hover:text-red-400 disabled:opacity-50" aria-label={`Remove ${provider.name}`}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
