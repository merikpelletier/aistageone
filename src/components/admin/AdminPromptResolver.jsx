import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { supabase } from '@/api/base44Client';

const field = 'w-full rounded border border-white/15 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-white/40';
const box = 'rounded border border-white/10 bg-neutral-950 p-4';
const button = 'inline-flex items-center justify-center gap-2 rounded bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-40';

async function loadData() {
  const { data, error } = await supabase
    .from('ai_prompt_library')
    .select('id,prompt_key,name,function_key,context_tags,is_active,priority,version')
    .order('priority')
    .order('name');
  if (error) throw error;
  return data || [];
}

export default function AdminPromptResolver() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['admin-prompt-resolver'], queryFn: loadData, retry: false });
  const [selectedId, setSelectedId] = useState('');
  const [functionKey, setFunctionKey] = useState('');
  const [contextTags, setContextTags] = useState('');
  const [notice, setNotice] = useState('');

  const prompts = query.data || [];
  const selected = useMemo(() => prompts.find((item) => item.id === selectedId) || null, [prompts, selectedId]);

  const choosePrompt = (id) => {
    setSelectedId(id);
    const prompt = prompts.find((item) => item.id === id);
    setFunctionKey(prompt?.function_key || '');
    setContextTags((prompt?.context_tags || []).join(', '));
    setNotice('');
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error('Choisis un prompt.');
      const tags = contextTags.split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
      const cleanFunction = functionKey.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
      const { error } = await supabase
        .from('ai_prompt_library')
        .update({ function_key: cleanFunction, context_tags: tags, updated_at: new Date().toISOString() })
        .eq('id', selectedId);
      if (error) throw error;
    },
    onSuccess: () => {
      setNotice('Routage du prompt enregistré.');
      qc.invalidateQueries({ queryKey: ['admin-prompt-resolver'] });
      qc.invalidateQueries({ queryKey: ['admin-prompt-library'] });
    },
    onError: (error) => setNotice(error.message),
  });

  if (query.isLoading) return <p className="text-white/60">Chargement du routage…</p>;
  if (query.error) return <p className="text-red-300">{query.error.message}</p>;

  return <div className="space-y-6 text-white">
    <div>
      <h2 className="text-2xl font-light">Prompt Routing</h2>
      <p className="mt-2 max-w-4xl text-sm text-white/55">Définit la fonction et les contextes d’un prompt. Le moteur de résolution reste côté serveur et n’est pas exposé directement au navigateur.</p>
    </div>

    {notice && <p className="rounded border border-white/15 p-3 text-sm text-white/70">{notice}</p>}

    <section className={`${box} space-y-4`}>
      <h3 className="text-lg">Routage d’un prompt</h3>
      <label className="block text-sm">
        <span className="mb-1 block text-white/55">Prompt</span>
        <select className={field} value={selectedId} onChange={(event) => choosePrompt(event.target.value)}>
          <option value="">Choisir un prompt</option>
          {prompts.map((prompt) => <option key={prompt.id} value={prompt.id}>{prompt.name} · {prompt.prompt_key}</option>)}
        </select>
      </label>

      {selected && <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-white/55">Fonction</span>
          <input className={field} placeholder="image_to_video" value={functionKey} onChange={(event) => setFunctionKey(event.target.value)} />
          <span className="mt-1 block text-xs text-white/35">Vide = prompt générique pour l’outil ou le modèle auquel il est associé.</span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-white/55">Contextes requis</span>
          <input className={field} placeholder="portrait, cinematic, 9x16" value={contextTags} onChange={(event) => setContextTags(event.target.value)} />
          <span className="mt-1 block text-xs text-white/35">Tous ces tags devront être présents dans le contexte de l’appel pour rendre le prompt candidat.</span>
        </label>
      </div>}

      <button className={button} disabled={!selectedId || save.isPending} onClick={() => save.mutate()}>
        <Save size={15} />Enregistrer le routage
      </button>
    </section>

    <section className={`${box} text-sm text-white/55`}>
      <p>Le resolver central est réservé au serveur. Les outils pourront l’appeler avec : outil, fonction, modèle et contexte. Aucun outil de production n’est encore branché dessus.</p>
    </section>
  </div>;
}
