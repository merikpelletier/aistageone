import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Play, Save } from 'lucide-react';
import { supabase } from '@/api/base44Client';
import { ADMIN_TOOL_SURFACES } from '@/config/adminSurfaces';

const field = 'w-full rounded border border-white/15 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-white/40';
const box = 'rounded border border-white/10 bg-neutral-950 p-4';
const button = 'inline-flex items-center justify-center gap-2 rounded bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-40';
const secondary = 'inline-flex items-center justify-center gap-2 rounded border border-white/20 px-3 py-2 text-sm text-white hover:bg-white/5 disabled:opacity-40';

async function loadData() {
  const [prompts, models] = await Promise.all([
    supabase.from('ai_prompt_library').select('id,prompt_key,name,function_key,context_tags,is_active,priority,version').order('priority').order('name'),
    supabase.from('ai_model_catalog').select('model_key,name,enabled').order('name'),
  ]);
  if (prompts.error) throw prompts.error;
  if (models.error) throw models.error;
  return { prompts: prompts.data || [], models: models.data || [] };
}

export default function AdminPromptResolver() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['admin-prompt-resolver'], queryFn: loadData, retry: false });
  const [selectedId, setSelectedId] = useState('');
  const [functionKey, setFunctionKey] = useState('');
  const [contextTags, setContextTags] = useState('');
  const [toolKey, setToolKey] = useState('');
  const [modelKey, setModelKey] = useState('');
  const [previewTags, setPreviewTags] = useState('');
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState('');

  const prompts = query.data?.prompts || [];
  const models = query.data?.models || [];
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
      const { error } = await supabase.from('ai_prompt_library').update({ function_key: cleanFunction, context_tags: tags, updated_at: new Date().toISOString() }).eq('id', selectedId);
      if (error) throw error;
    },
    onSuccess: () => {
      setNotice('Routage du prompt enregistré.');
      qc.invalidateQueries({ queryKey: ['admin-prompt-resolver'] });
      qc.invalidateQueries({ queryKey: ['admin-prompt-library'] });
    },
    onError: (error) => setNotice(error.message),
  });

  const preview = useMutation({
    mutationFn: async () => {
      const tags = previewTags.split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
      const { data, error } = await supabase.rpc('resolve_ai_prompt', {
        p_tool_key: toolKey || null,
        p_function_key: functionKey || null,
        p_model_key: modelKey || null,
        p_context_tags: tags,
      });
      if (error) throw error;
      return data?.[0] || null;
    },
    onSuccess: (data) => { setResult(data); setNotice(''); },
    onError: (error) => { setResult(null); setNotice(error.message); },
  });

  if (query.isLoading) return <p className="text-white/60">Chargement du routage…</p>;
  if (query.error) return <p className="text-red-300">{query.error.message}</p>;

  return <div className="space-y-6 text-white">
    <div><h2 className="text-2xl font-light">Prompt Routing</h2><p className="mt-2 max-w-4xl text-sm text-white/55">Définit la fonction et les contextes d’un prompt, puis vérifie quel prompt le moteur sélectionnerait. Aucun outil de production n’est encore connecté à ce moteur.</p></div>
    {notice && <p className="rounded border border-white/15 p-3 text-sm text-white/70">{notice}</p>}

    <section className={`${box} space-y-4`}>
      <h3 className="text-lg">Routage d’un prompt</h3>
      <label className="block text-sm"><span className="mb-1 block text-white/55">Prompt</span><select className={field} value={selectedId} onChange={(event) => choosePrompt(event.target.value)}><option value="">Choisir un prompt</option>{prompts.map((prompt) => <option key={prompt.id} value={prompt.id}>{prompt.name} · {prompt.prompt_key}</option>)}</select></label>
      {selected && <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm"><span className="mb-1 block text-white/55">Fonction</span><input className={field} placeholder="image_to_video" value={functionKey} onChange={(event) => setFunctionKey(event.target.value)} /><span className="mt-1 block text-xs text-white/35">Vide = prompt générique pour l’outil/modèle associé.</span></label>
        <label className="block text-sm"><span className="mb-1 block text-white/55">Contextes requis</span><input className={field} placeholder="portrait, cinematic, 9x16" value={contextTags} onChange={(event) => setContextTags(event.target.value)} /><span className="mt-1 block text-xs text-white/35">Tous ces tags doivent être présents pour que ce prompt soit candidat.</span></label>
      </div>}
      <button className={button} disabled={!selectedId || save.isPending} onClick={() => save.mutate()}><Save size={15} />Enregistrer le routage</button>
    </section>

    <section className={`${box} space-y-4`}>
      <div><h3 className="text-lg">Tester la résolution</h3><p className="text-xs text-white/40">Le test appelle exactement le resolver central utilisé côté serveur.</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm"><span className="mb-1 block text-white/55">Outil</span><select className={field} value={toolKey} onChange={(event) => setToolKey(event.target.value)}><option value="">Aucun / générique</option>{ADMIN_TOOL_SURFACES.map((tool) => <option key={tool.key} value={tool.key}>{tool.label} · {tool.key}</option>)}</select></label>
        <label className="block text-sm"><span className="mb-1 block text-white/55">Modèle</span><select className={field} value={modelKey} onChange={(event) => setModelKey(event.target.value)}><option value="">Aucun / générique</option>{models.map((model) => <option key={model.model_key} value={model.model_key}>{model.name}{model.enabled ? '' : ' · désactivé'}</option>)}</select></label>
        <label className="block text-sm"><span className="mb-1 block text-white/55">Fonction</span><input className={field} placeholder="image_to_video" value={functionKey} onChange={(event) => setFunctionKey(event.target.value)} /></label>
        <label className="block text-sm"><span className="mb-1 block text-white/55">Contextes disponibles</span><input className={field} placeholder="portrait, cinematic, 9x16" value={previewTags} onChange={(event) => setPreviewTags(event.target.value)} /></label>
      </div>
      <button className={secondary} disabled={preview.isPending} onClick={() => preview.mutate()}><Play size={15} />Tester</button>
      {result ? <div className="rounded border border-green-400/25 bg-green-400/5 p-4 text-sm"><div className="font-medium text-green-200">{result.name}</div><div className="mt-1 font-mono text-xs text-white/45">{result.prompt_key}</div><div className="mt-3 text-white/65">Score {result.match_score} · outil {result.matched_tool ? 'exact' : 'générique'} · fonction {result.matched_function ? 'exacte' : 'générique'} · modèle {result.matched_model ? 'exact' : 'générique'} · v{result.version}</div></div> : !preview.isPending && <p className="text-sm text-white/35">Aucun résultat testé pour l’instant.</p>}
    </section>
  </div>;
}
