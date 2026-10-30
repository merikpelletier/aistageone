import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, FolderPlus, Plus, Save, Search } from 'lucide-react';
import { supabase } from '@/api/base44Client';
import { ADMIN_TOOL_SURFACES } from '@/config/adminSurfaces';

const field = 'w-full rounded border border-white/15 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-white/40';
const box = 'rounded border border-white/10 bg-neutral-950 p-4';
const button = 'inline-flex items-center justify-center gap-2 rounded bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-40';
const secondary = 'inline-flex items-center justify-center gap-2 rounded border border-white/20 px-3 py-2 text-sm text-white hover:bg-white/5 disabled:opacity-40';

const emptyCategory = { id: null, parent_id: null, name: '', slug: '', description: '', sort_order: 0, is_active: true };
const emptyPrompt = {
  id: null,
  prompt_key: '',
  name: '',
  category_id: '',
  description: '',
  content: '',
  variables: [],
  priority: 100,
  version: 1,
  is_active: true,
  notes: '',
  tool_keys: [],
  model_keys: [],
};

const slugify = (value) => value
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

async function loadLibrary() {
  const [categoriesResult, promptsResult, toolsResult, modelsLinksResult, modelsResult] = await Promise.all([
    supabase.from('prompt_categories').select('*').order('sort_order').order('name'),
    supabase.from('ai_prompt_library').select('*').order('priority').order('name'),
    supabase.from('ai_prompt_tools').select('prompt_id,tool_key'),
    supabase.from('ai_prompt_models').select('prompt_id,model_key'),
    supabase.from('ai_model_catalog').select('model_key,name,kind,provider,enabled').order('kind').order('name'),
  ]);
  for (const result of [categoriesResult, promptsResult, toolsResult, modelsLinksResult, modelsResult]) {
    if (result.error) throw result.error;
  }
  const toolMap = toolsResult.data.reduce((acc, row) => {
    (acc[row.prompt_id] ||= []).push(row.tool_key);
    return acc;
  }, {});
  const modelMap = modelsLinksResult.data.reduce((acc, row) => {
    (acc[row.prompt_id] ||= []).push(row.model_key);
    return acc;
  }, {});
  return {
    categories: categoriesResult.data,
    prompts: promptsResult.data.map((prompt) => ({
      ...prompt,
      tool_keys: toolMap[prompt.id] || [],
      model_keys: modelMap[prompt.id] || [],
    })),
    models: modelsResult.data,
  };
}

function MultiChoice({ items, selected, onChange, emptyText }) {
  if (!items.length) return <p className="text-sm text-white/45">{emptyText}</p>;
  return <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
    {items.map((item) => {
      const checked = selected.includes(item.value);
      return <label key={item.value} className={`flex cursor-pointer items-start gap-3 rounded border p-3 text-sm ${checked ? 'border-white/40 bg-white/10' : 'border-white/10 bg-black/20'}`}>
        <input
          type="checkbox"
          className="mt-0.5"
          checked={checked}
          onChange={() => onChange(checked ? selected.filter((value) => value !== item.value) : [...selected, item.value])}
        />
        <span className="min-w-0"><span className="block text-white">{item.label}</span>{item.detail && <span className="block truncate text-xs text-white/40">{item.detail}</span>}</span>
      </label>;
    })}
  </div>;
}

export default function AdminPromptLibrary() {
  const qc = useQueryClient();
  const [section, setSection] = useState('categories');
  const [categoryDraft, setCategoryDraft] = useState(emptyCategory);
  const [promptDraft, setPromptDraft] = useState(emptyPrompt);
  const [expandedRoots, setExpandedRoots] = useState({});
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const query = useQuery({ queryKey: ['admin-prompt-library'], queryFn: loadLibrary, retry: false });

  const saveCategory = useMutation({
    mutationFn: async (draft) => {
      const payload = {
        parent_id: draft.parent_id || null,
        name: draft.name.trim(),
        slug: (draft.slug || slugify(draft.name)).trim(),
        description: draft.description || '',
        sort_order: Number(draft.sort_order) || 0,
        is_active: draft.is_active !== false,
        updated_at: new Date().toISOString(),
      };
      if (!payload.name || !payload.slug) throw new Error('Le nom et la clé de catégorie sont requis.');
      const request = draft.id
        ? supabase.from('prompt_categories').update(payload).eq('id', draft.id)
        : supabase.from('prompt_categories').insert(payload);
      const { error: saveError } = await request;
      if (saveError) throw saveError;
    },
    onSuccess: () => {
      setCategoryDraft(emptyCategory);
      setNotice('Catégorie enregistrée.');
      setError('');
      qc.invalidateQueries({ queryKey: ['admin-prompt-library'] });
    },
    onError: (mutationError) => { setError(mutationError.message); setNotice(''); },
  });

  const savePrompt = useMutation({
    mutationFn: async (draft) => {
      const payload = {
        prompt_key: draft.prompt_key.trim(),
        name: draft.name.trim(),
        category_id: draft.category_id || null,
        description: draft.description || '',
        content: draft.content || '',
        variables: draft.variables,
        priority: Number(draft.priority) || 0,
        version: Math.max(1, Number(draft.version) || 1),
        is_active: draft.is_active !== false,
        notes: draft.notes || '',
        updated_at: new Date().toISOString(),
      };
      if (!payload.prompt_key || !payload.name) throw new Error('Le nom et la clé du prompt sont requis.');
      let promptId = draft.id;
      if (promptId) {
        const { error: updateError } = await supabase.from('ai_prompt_library').update(payload).eq('id', promptId);
        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase.from('ai_prompt_library').insert(payload).select('id').single();
        if (insertError) throw insertError;
        promptId = data.id;
      }
      const { error: clearToolsError } = await supabase.from('ai_prompt_tools').delete().eq('prompt_id', promptId);
      if (clearToolsError) throw clearToolsError;
      if (draft.tool_keys.length) {
        const { error: toolsError } = await supabase.from('ai_prompt_tools').insert(draft.tool_keys.map((tool_key) => ({ prompt_id: promptId, tool_key })));
        if (toolsError) throw toolsError;
      }
      const { error: clearModelsError } = await supabase.from('ai_prompt_models').delete().eq('prompt_id', promptId);
      if (clearModelsError) throw clearModelsError;
      if (draft.model_keys.length) {
        const { error: modelsError } = await supabase.from('ai_prompt_models').insert(draft.model_keys.map((model_key) => ({ prompt_id: promptId, model_key })));
        if (modelsError) throw modelsError;
      }
    },
    onSuccess: () => {
      setPromptDraft(emptyPrompt);
      setNotice('Prompt enregistré.');
      setError('');
      qc.invalidateQueries({ queryKey: ['admin-prompt-library'] });
    },
    onError: (mutationError) => { setError(mutationError.message); setNotice(''); },
  });

  const categories = query.data?.categories || [];
  const prompts = query.data?.prompts || [];
  const models = query.data?.models || [];
  const roots = categories.filter((category) => !category.parent_id);
  const childrenByParent = useMemo(() => categories.reduce((acc, category) => {
    if (category.parent_id) (acc[category.parent_id] ||= []).push(category);
    return acc;
  }, {}), [categories]);
  const categoryLabel = (id) => {
    const category = categories.find((item) => item.id === id);
    if (!category) return 'Sans catégorie';
    const parent = categories.find((item) => item.id === category.parent_id);
    return parent ? `${parent.name} / ${category.name}` : category.name;
  };
  const visiblePrompts = prompts.filter((prompt) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [prompt.name, prompt.prompt_key, prompt.description, categoryLabel(prompt.category_id)].some((value) => String(value || '').toLowerCase().includes(term));
  });
  const toolItems = ADMIN_TOOL_SURFACES.map((tool) => ({ value: tool.key, label: tool.label, detail: tool.key }));
  const modelItems = models.map((model) => ({
    value: model.model_key,
    label: model.name,
    detail: `${model.kind} · ${model.provider}${model.enabled ? '' : ' · désactivé'}`,
  }));

  if (query.isLoading) return <p className="text-white/70">Chargement de la Prompt Library…</p>;
  if (query.error) return <p className="text-red-300">{query.error.message}</p>;

  return <div className="space-y-6 text-white">
    <div>
      <h2 className="text-2xl font-light">Prompt Library</h2>
      <p className="mt-2 max-w-4xl text-sm text-white/55">Les catégories organisent la banque. Les prompts sont des éléments distincts qui peuvent ensuite être classés dans une catégorie ou sous-catégorie.</p>
    </div>

    <div className="flex gap-2 border-b border-white/10 pb-3">
      <button type="button" onClick={() => setSection('categories')} className={section === 'categories' ? button : secondary}>Catégories & sous-catégories</button>
      <button type="button" onClick={() => setSection('prompts')} className={section === 'prompts' ? button : secondary}>Prompts</button>
    </div>

    {(notice || error) && <p className={`rounded border p-3 text-sm ${error ? 'border-red-400/30 text-red-200' : 'border-green-400/30 text-green-200'}`}>{error || notice}</p>}

    {section === 'categories' && <section className={`${box} space-y-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg">Catégories & sous-catégories</h3>
          <p className="text-xs text-white/45">Ici on organise la banque seulement. Aucun prompt ni modèle n’est créé dans cette section.</p>
        </div>
        <button type="button" className={secondary} onClick={() => setCategoryDraft(emptyCategory)}><FolderPlus size={15} />Nouvelle catégorie</button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="max-h-[420px] overflow-y-auto rounded border border-white/10 bg-black/20 p-2">
          {roots.map((root) => {
            const children = childrenByParent[root.id] || [];
            const expanded = !!expandedRoots[root.id];
            return <div key={root.id} className="border-b border-white/5 last:border-b-0">
              <button
                type="button"
                className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-white/5 ${categoryDraft.id === root.id ? 'bg-white/10' : ''}`}
                onClick={() => {
                  setCategoryDraft(root);
                  if (children.length) setExpandedRoots((current) => ({ ...current, [root.id]: !current[root.id] }));
                }}
              >
                <span className="truncate font-medium">{root.name}</span>
                {children.length > 0 && <span className="flex items-center gap-1 text-xs text-white/35"><span>{children.length}</span><ChevronRight size={14} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} /></span>}
              </button>
              {expanded && children.map((child) => <button
                type="button"
                key={child.id}
                className={`flex w-full items-center gap-2 rounded py-1 pl-5 pr-2 text-left text-xs hover:bg-white/5 ${categoryDraft.id === child.id ? 'bg-white/10 text-white' : 'text-white/60'}`}
                onClick={() => setCategoryDraft(child)}
              ><span className="text-white/20">—</span><span className="truncate">{child.name}</span></button>)}
            </div>;
          })}
          {!roots.length && <p className="py-3 text-sm text-white/40">Aucune catégorie pour l’instant.</p>}
        </div>

        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); saveCategory.mutate(categoryDraft); }}>
          <div>
            <h4 className="text-base font-medium">{categoryDraft.id ? (categoryDraft.parent_id ? 'Modifier la sous-catégorie' : 'Modifier la catégorie') : (categoryDraft.parent_id ? 'Créer une sous-catégorie' : 'Créer une catégorie')}</h4>
            <p className="mt-1 text-xs text-white/40">Pour créer une sous-catégorie, choisis simplement sa catégorie principale dans Parent.</p>
          </div>
          <label className="block text-sm"><span className="mb-1 block text-white/55">Parent</span><select className={field} value={categoryDraft.parent_id || ''} onChange={(event) => setCategoryDraft({ ...categoryDraft, parent_id: event.target.value || null })}><option value="">Aucun — catégorie principale</option>{roots.filter((root) => root.id !== categoryDraft.id).map((root) => <option key={root.id} value={root.id}>{root.name}</option>)}</select></label>
          <label className="block text-sm"><span className="mb-1 block text-white/55">Nom</span><input className={field} value={categoryDraft.name} onChange={(event) => setCategoryDraft({ ...categoryDraft, name: event.target.value, slug: categoryDraft.id ? categoryDraft.slug : slugify(event.target.value) })} /></label>
          <label className="block text-sm"><span className="mb-1 block text-white/55">Clé</span><input className={field} value={categoryDraft.slug} onChange={(event) => setCategoryDraft({ ...categoryDraft, slug: slugify(event.target.value) })} /></label>
          <label className="block text-sm"><span className="mb-1 block text-white/55">Description</span><textarea className={field} rows={3} value={categoryDraft.description || ''} onChange={(event) => setCategoryDraft({ ...categoryDraft, description: event.target.value })} /></label>
          <div className="grid grid-cols-2 gap-3"><label className="block text-sm"><span className="mb-1 block text-white/55">Ordre</span><input className={field} type="number" value={categoryDraft.sort_order ?? 0} onChange={(event) => setCategoryDraft({ ...categoryDraft, sort_order: Number(event.target.value) })} /></label><label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={categoryDraft.is_active !== false} onChange={(event) => setCategoryDraft({ ...categoryDraft, is_active: event.target.checked })} />Active</label></div>
          <button className={button} disabled={saveCategory.isPending || !categoryDraft.name.trim()}><Save size={15} />{categoryDraft.parent_id ? 'Enregistrer la sous-catégorie' : 'Enregistrer la catégorie'}</button>
        </form>
      </div>
    </section>}

    {section === 'prompts' && <div className="space-y-6">
      <section className={`${box} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg">Prompts système</h3><p className="text-xs text-white/45">{prompts.length} prompt(s) · {models.length} modèle(s) disponibles dans le catalogue IA.</p></div><button type="button" className={secondary} onClick={() => setPromptDraft(emptyPrompt)}><Plus size={15} />Nouveau prompt</button></div>
        <div className="relative"><Search size={15} className="absolute left-3 top-3 text-white/35" /><input className={`${field} pl-9`} placeholder="Rechercher un prompt…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {visiblePrompts.map((prompt) => <button type="button" key={prompt.id} onClick={() => setPromptDraft({ ...prompt, category_id: prompt.category_id || '' })} className={`w-full rounded border p-3 text-left ${promptDraft.id === prompt.id ? 'border-white/45 bg-white/10' : 'border-white/10 bg-black/20 hover:bg-white/5'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{prompt.name}</strong><span className={`text-xs ${prompt.is_active ? 'text-green-300' : 'text-white/35'}`}>{prompt.is_active ? 'Actif' : 'Inactif'}</span></div>
            <div className="mt-1 break-all font-mono text-[11px] text-white/40">{prompt.prompt_key}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/50"><span>{categoryLabel(prompt.category_id)}</span><span>·</span><span>{prompt.tool_keys.length} outil(s)</span><span>·</span><span>{prompt.model_keys.length} modèle(s)</span></div>
          </button>)}
          {!visiblePrompts.length && <p className="py-4 text-sm text-white/40">Aucun prompt trouvé.</p>}
        </div>
      </section>

      <form className={`${box} space-y-5`} onSubmit={(event) => { event.preventDefault(); savePrompt.mutate(promptDraft); }}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg">{promptDraft.id ? 'Modifier le prompt' : 'Créer un prompt'}</h3><p className="text-xs text-white/45">Un prompt est un élément distinct. Il peut être classé dans une catégorie ou sous-catégorie existante.</p></div>{promptDraft.id && <span className="inline-flex items-center gap-1 rounded border border-white/15 px-2 py-1 text-xs text-white/50"><Check size={12} />v{promptDraft.version}</span>}</div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm"><span className="mb-1 block text-white/55">Nom du prompt</span><input className={field} value={promptDraft.name} onChange={(event) => setPromptDraft({ ...promptDraft, name: event.target.value })} /></label>
          <label className="block text-sm"><span className="mb-1 block text-white/55">Clé du prompt</span><input className={field} placeholder="video.image_to_video.default" value={promptDraft.prompt_key} onChange={(event) => setPromptDraft({ ...promptDraft, prompt_key: event.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') })} /></label>
          <label className="block text-sm"><span className="mb-1 block text-white/55">Classer dans</span><select className={field} value={promptDraft.category_id || ''} onChange={(event) => setPromptDraft({ ...promptDraft, category_id: event.target.value })}><option value="">Sans catégorie</option>{roots.map((root) => <React.Fragment key={root.id}><option value={root.id}>{root.name}</option>{(childrenByParent[root.id] || []).map((child) => <option key={child.id} value={child.id}>↳ {root.name} / {child.name}</option>)}</React.Fragment>)}</select></label>
          <label className="block text-sm"><span className="mb-1 block text-white/55">Variables</span><input className={field} placeholder="character, scene, camera_motion" value={(promptDraft.variables || []).join(', ')} onChange={(event) => setPromptDraft({ ...promptDraft, variables: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} /></label>
          <label className="block text-sm md:col-span-2"><span className="mb-1 block text-white/55">Description</span><textarea className={field} rows={2} value={promptDraft.description || ''} onChange={(event) => setPromptDraft({ ...promptDraft, description: event.target.value })} /></label>
          <label className="block text-sm md:col-span-2"><span className="mb-1 block text-white/55">Texte du prompt</span><textarea className={`${field} font-mono`} rows={12} value={promptDraft.content || ''} onChange={(event) => setPromptDraft({ ...promptDraft, content: event.target.value })} placeholder="Utilise {{variable}} pour les valeurs dynamiques." /></label>
          <label className="block text-sm"><span className="mb-1 block text-white/55">Priorité</span><input className={field} type="number" value={promptDraft.priority ?? 100} onChange={(event) => setPromptDraft({ ...promptDraft, priority: Number(event.target.value) })} /></label>
          <label className="block text-sm"><span className="mb-1 block text-white/55">Version</span><input className={field} type="number" min="1" value={promptDraft.version ?? 1} onChange={(event) => setPromptDraft({ ...promptDraft, version: Math.max(1, Number(event.target.value)) })} /></label>
          <label className="block text-sm md:col-span-2"><span className="mb-1 block text-white/55">Notes admin</span><textarea className={field} rows={2} value={promptDraft.notes || ''} onChange={(event) => setPromptDraft({ ...promptDraft, notes: event.target.value })} /></label>
        </div>

        <div className="space-y-3"><div><h4 className="text-sm font-medium">Outils associés</h4><p className="text-xs text-white/40">Ces associations appartiennent au prompt, jamais à la catégorie.</p></div><MultiChoice items={toolItems} selected={promptDraft.tool_keys || []} onChange={(tool_keys) => setPromptDraft({ ...promptDraft, tool_keys })} emptyText="Aucun outil disponible." /></div>
        <div className="space-y-3"><div><h4 className="text-sm font-medium">Modèles associés</h4><p className="text-xs text-white/40">Ces associations appartiennent au prompt, jamais à la catégorie.</p></div><MultiChoice items={modelItems} selected={promptDraft.model_keys || []} onChange={(model_keys) => setPromptDraft({ ...promptDraft, model_keys })} emptyText="Aucun modèle dans le catalogue." /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={promptDraft.is_active !== false} onChange={(event) => setPromptDraft({ ...promptDraft, is_active: event.target.checked })} />Prompt actif</label>
        <div className="flex flex-wrap gap-2"><button className={button} disabled={savePrompt.isPending || !promptDraft.name.trim() || !promptDraft.prompt_key.trim()}><Save size={15} />{savePrompt.isPending ? 'Enregistrement…' : 'Enregistrer le prompt'}</button><button type="button" className={secondary} onClick={() => setPromptDraft(emptyPrompt)}>Réinitialiser</button></div>
      </form>
    </div>}
  </div>;
}
