import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Code2, Eye, FileCode2, Loader2, MonitorCog, Palette, Save, Search, Settings2, Sparkles, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { ADMIN_SURFACES, CODER_MODELS, defaultSurfaceSettings } from '@/config/adminSurfaces';

const field = 'w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-yellow-400/70';
const label = 'mb-1.5 block text-[11px] font-black uppercase tracking-wider text-white/55';

function Toggle({ checked, onChange, title, description }) {
  return <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
    <span><span className="block text-sm font-bold text-white">{title}</span>{description && <span className="mt-1 block text-xs text-white/45">{description}</span>}</span>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-yellow-400" />
  </label>;
}

function SectionTabs({ active, onChange }) {
  return <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/5 p-1.5">
    {[[Code2, 'code', 'Code'], [Palette, 'look', 'Look'], [Settings2, 'configuration', 'Configuration']].map(([Icon, key, text]) =>
      <button key={key} onClick={() => onChange(key)} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black uppercase tracking-wider ${active === key ? 'bg-yellow-400 text-black' : 'text-white/60 hover:bg-white/5'}`}><Icon size={14} />{text}</button>)}
  </div>;
}

function CodeSection({ surface, setting, proposals, onRefresh }) {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(CODER_MODELS[0].value);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const analyze = useMutation({
    mutationFn: async () => (await base44.functions.invoke('admin-pages-tools', { action: 'analyze', surface, setting, prompt, model })).data,
    onSuccess: (proposal) => { setSelectedProposal(proposal); setPrompt(''); onRefresh(); toast.success('Targeted change prepared for review'); },
    onError: (error) => toast.error(error.message || 'Analysis failed'),
  });
  const apply = useMutation({
    mutationFn: async (id) => (await base44.functions.invoke('admin-pages-tools', { action: 'apply', change_id: id })).data,
    onSuccess: (result) => { setSelectedProposal(result.change); onRefresh(); toast.success(result.github ? 'Code committed to GitHub — Vercel deployment started' : 'Settings applied'); },
    onError: (error) => toast.error(error.message || 'Apply failed'),
  });
  const current = selectedProposal || proposals?.[0];
  const hasRuntimePatch = current?.has_runtime_patch ?? Boolean(Object.keys(current?.proposed_changes?.look_patch || {}).length || Object.keys(current?.proposed_changes?.configuration_patch || {}).length);
  const hasCodePatch = current?.has_code_patch ?? Boolean(current?.proposed_changes?.file_changes?.length);
  const commitUrl = current?.proposed_changes?.result?.commit_url;
  return <div className="space-y-5">
    <div className="rounded-2xl border border-yellow-400/25 bg-yellow-400/[0.06] p-4 text-sm text-white/70">
      The coder receives the selected item, its current settings and its known source files. It prepares one targeted change. No autonomous agent or automatic paid retry is used.
    </div>
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
      <div><span className={label}>Requested change</span><textarea className={field} rows={7} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={`Describe the precise change for ${surface.label}...`} /></div>
      <div className="space-y-4"><div><span className={label}>Replicate model</span><select className={field} value={model} onChange={(event) => setModel(event.target.value)}>{CODER_MODELS.map((item) => <option key={item.value} value={item.value} className="bg-black">{item.label}</option>)}</select></div>
        <button disabled={!prompt.trim() || analyze.isPending} onClick={() => analyze.mutate()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 py-3 text-sm font-black text-black disabled:opacity-40">{analyze.isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}Analyze & prepare</button>
        <p className="text-xs leading-relaxed text-white/40">An analysis calls Replicate and may incur the provider cost associated with the selected model.</p>
      </div>
    </div>
    {current && <div className="rounded-2xl border border-white/15 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-yellow-400">Review</p><h4 className="mt-1 text-lg font-black text-white">{current.title || 'Targeted change'}</h4></div><span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase text-white/60">{current.status}</span></div>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-white/70">{current.summary}</p>
      {current.files?.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{current.files.map((file) => <span key={file} className="rounded-lg bg-black px-2.5 py-1.5 font-mono text-[11px] text-white/60">{file}</span>)}</div>}
      {current.patch && <pre className="mt-4 max-h-80 overflow-auto rounded-xl bg-black p-4 text-xs leading-relaxed text-emerald-300">{current.patch}</pre>}
      {current.status === 'review' && <button onClick={() => apply.mutate(current.id)} disabled={apply.isPending} className="mt-4 flex items-center gap-2 rounded-xl border border-yellow-400/50 px-4 py-2.5 text-sm font-black text-yellow-400 disabled:opacity-40"><Eye size={15} />{apply.isPending ? 'Applying…' : hasCodePatch ? 'Apply code to GitHub' : 'Apply approved settings'}</button>}
      {commitUrl && <a className="mt-4 block text-xs font-bold text-emerald-300 underline" href={commitUrl} target="_blank" rel="noreferrer">Open the applied GitHub commit</a>}
      {hasCodePatch && current.status === 'review' && <p className="mt-3 text-xs text-white/35">Applying creates one reviewed commit on GitHub main. The connected Vercel project then deploys it automatically.</p>}
    </div>}
  </div>;
}

function LookSection({ surface, draft, setDraft }) {
  const update = (key, value) => setDraft((current) => ({ ...current, look: { ...current.look, [key]: value } }));
  return <div className="grid gap-4 md:grid-cols-2">
    <div><span className={label}>Background color</span><div className="flex gap-2"><input type="color" value={draft.look.background_color || '#facc15'} onChange={(event) => update('background_color', event.target.value)} className="h-11 w-14 rounded-lg bg-transparent" /><input className={field} value={draft.look.background_color || ''} onChange={(event) => update('background_color', event.target.value)} placeholder="Keep current" /></div></div>
    {surface.key === 'bottom_navigation' ? <>
      <div><span className={label}>Text color</span><div className="flex gap-2"><input type="color" value={draft.look.text_color || draft.look.foreground_color || '#000000'} onChange={(event) => update('text_color', event.target.value)} className="h-11 w-14 rounded-lg bg-transparent" /><input className={field} value={draft.look.text_color || ''} onChange={(event) => update('text_color', event.target.value)} placeholder="Keep current black" /></div></div>
      <div><span className={label}>Icon color</span><div className="flex gap-2"><input type="color" value={draft.look.icon_color || draft.look.foreground_color || '#000000'} onChange={(event) => update('icon_color', event.target.value)} className="h-11 w-14 rounded-lg bg-transparent" /><input className={field} value={draft.look.icon_color || ''} onChange={(event) => update('icon_color', event.target.value)} placeholder="Keep current black" /></div></div>
      <div><span className={label}>Active indicator</span><div className="flex gap-2"><input type="color" value={draft.look.active_color || '#dc2626'} onChange={(event) => update('active_color', event.target.value)} className="h-11 w-14 rounded-lg bg-transparent" /><input className={field} value={draft.look.active_color || ''} onChange={(event) => update('active_color', event.target.value)} placeholder="Keep current red" /></div></div>
      <div><span className={label}>Border color</span><div className="flex gap-2"><input type="color" value={draft.look.border_color || '#000000'} onChange={(event) => update('border_color', event.target.value)} className="h-11 w-14 rounded-lg bg-transparent" /><input className={field} value={draft.look.border_color || ''} onChange={(event) => update('border_color', event.target.value)} placeholder="Keep current" /></div></div>
    </> : <>
      <div><span className={label}>Accent color</span><div className="flex gap-2"><input type="color" value={draft.look.accent_color || '#facc15'} onChange={(event) => update('accent_color', event.target.value)} className="h-11 w-14 rounded-lg bg-transparent" /><input className={field} value={draft.look.accent_color || ''} onChange={(event) => update('accent_color', event.target.value)} /></div></div>
      <div><span className={label}>Text color</span><div className="flex gap-2"><input type="color" value={draft.look.text_color || '#000000'} onChange={(event) => update('text_color', event.target.value)} className="h-11 w-14 rounded-lg bg-transparent" /><input className={field} value={draft.look.text_color || ''} onChange={(event) => update('text_color', event.target.value)} placeholder="Keep existing colors" /></div></div>
      <div><span className={label}>Icon color</span><div className="flex gap-2"><input type="color" value={draft.look.icon_color || '#000000'} onChange={(event) => update('icon_color', event.target.value)} className="h-11 w-14 rounded-lg bg-transparent" /><input className={field} value={draft.look.icon_color || ''} onChange={(event) => update('icon_color', event.target.value)} placeholder="Keep existing colors" /></div></div>
    </>}
    <div><span className={label}>Content width</span><select className={field} value={draft.look.content_width || 'full'} onChange={(event) => update('content_width', event.target.value)}><option className="bg-black" value="full">Existing full width</option><option className="bg-black" value="wide">Wide · 1440px</option><option className="bg-black" value="contained">Contained · 1200px</option></select></div>
    <div><span className={label}>Spacing</span><select className={field} value={draft.look.spacing || 'default'} onChange={(event) => update('spacing', event.target.value)}><option className="bg-black" value="compact">Compact</option><option className="bg-black" value="default">Existing spacing</option><option className="bg-black" value="relaxed">Relaxed</option></select></div>
  </div>;
}

function ConfigurationSection({ surface, draft, setDraft }) {
  const config = draft.configuration || {};
  const update = (key, value) => setDraft((current) => ({ ...current, configuration: { ...current.configuration, [key]: value } }));
  const pageKeys = ADMIN_SURFACES.filter((item) => item.type === 'page' && item.key !== 'Admin');
  const studioGroups = ['Actor & Character', 'Sound & Voice', 'Video', 'Timeline & Scene', 'Image & Layout', 'Project Presentation', 'Marketplace'];
  return <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-2">
      <div><span className={label}>Displayed name</span><input className={field} value={draft.label || ''} onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))} /></div>
      <div><span className={label}>Position / order</span><input className={field} type="number" min="0" value={config.order ?? 0} onChange={(event) => update('order', Number(event.target.value))} /><p className="mt-1 text-xs text-white/35">Lower numbers appear first.</p></div>
    </div>
    <Toggle checked={draft.visible} onChange={(visible) => setDraft((current) => ({ ...current, visible }))} title="Visible" description={surface.type === 'page' ? 'Controls whether this page appears in the existing navigation.' : 'Controls whether this tool is shown in its existing surface.'} />
    <Toggle checked={draft.active} onChange={(active) => setDraft((current) => ({ ...current, active }))} title="Active" description="Keeps the item configured while allowing it to be disabled." />
    {surface.type === 'page' && <Toggle checked={config.show_navigation !== false} onChange={(value) => update('show_navigation', value)} title="Show existing navigation" />}
    {surface.type === 'page' && surface.key === 'Studio' && <>
      <StudioViewsEditor views={config.studio_views || []} onChange={(views) => update('studio_views', views)} />
      <StudioHomeItemsEditor items={config.home_items || []} onChange={(items) => update('home_items', items)} />
      <FotoplayViewsEditor views={config.fotoplay_views || []} onChange={(views) => update('fotoplay_views', views)} />
    </>}
    {surface.type === 'tool' && surface.scope === 'studio' && <div className="grid gap-4 md:grid-cols-2"><div><span className={label}>Studio section</span><select className={field} value={config.group || ''} onChange={(event) => update('group', event.target.value)}><option className="bg-black" value="">Keep current section</option>{studioGroups.map((group) => <option key={group} className="bg-black" value={group}>{group}</option>)}</select></div><div><span className={label}>Description</span><input className={field} value={config.description || ''} onChange={(event) => update('description', event.target.value)} placeholder="Keep current description" /></div></div>}
    {surface.key === 'agent_bar' && <>
      <div className="grid gap-4 md:grid-cols-2"><div><span className={label}>Position</span><select className={field} value={config.position || 'top'} onChange={(event) => update('position', event.target.value)}><option className="bg-black" value="top">Top</option><option className="bg-black" value="bottom">Bottom</option></select></div><div><span className={label}>Label</span><input className={field} value={config.label || ''} onChange={(event) => update('label', event.target.value)} /></div><div><span className={label}>Input text</span><input className={field} value={config.placeholder || ''} onChange={(event) => update('placeholder', event.target.value)} /></div><div><span className={label}>Model</span><input className={field} value={config.model || ''} onChange={(event) => update('model', event.target.value)} placeholder="Configured Replicate model" /></div></div>
      <div><span className={label}>Pages where it appears</span><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{pageKeys.map((page) => <label key={page.key} className="flex items-center gap-2 rounded-xl bg-white/5 p-3 text-xs text-white/70"><input type="checkbox" className="accent-yellow-400" checked={(config.pages || []).includes(page.key)} onChange={(event) => update('pages', event.target.checked ? [...new Set([...(config.pages || []), page.key])] : (config.pages || []).filter((key) => key !== page.key))} />{page.label}</label>)}</div></div>
      <div><span className={label}>Prompt / behavior</span><textarea className={field} rows={5} value={config.prompt || ''} onChange={(event) => update('prompt', event.target.value)} /></div>
      <div className="grid gap-4 md:grid-cols-2"><div><span className={label}>Permissions</span><textarea className={field} rows={4} value={(config.permissions || []).join('\n')} onChange={(event) => update('permissions', event.target.value.split('\n').map((value) => value.trim()).filter(Boolean))} placeholder="One permission per line" /></div><div><span className={label}>Allowed actions</span><textarea className={field} rows={4} value={(config.actions || []).join('\n')} onChange={(event) => update('actions', event.target.value.split('\n').map((value) => value.trim()).filter(Boolean))} placeholder="One action per line" /></div></div>
    </>}
  </div>;
}

const STUDIO_HOME_ICONS = ['Home', 'Clapperboard', 'Theater', 'Wrench', 'Bookmark', 'BookOpen'];

function StudioImageUploadField({ label: fieldLabel, value, onChange, uploading, setUploading }) {
  const inputId = `studio-upload-${fieldLabel}-${Math.random().toString(36).slice(2)}`;
  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onChange(file_url);
    } catch (error) {
      toast.error(error.message || 'Upload failed');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };
  return <div>
    <span className={label}>{fieldLabel}</span>
    {value ? <div className="space-y-2">
      <div className="h-24 w-full overflow-hidden rounded-xl border border-white/10 bg-black/40"><img src={value} alt={fieldLabel} className="h-full w-full object-cover" /></div>
      <div className="flex gap-2">
        <label htmlFor={inputId} className="cursor-pointer rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white hover:bg-white/15">{uploading ? 'Uploading…' : 'Replace'}</label>
        <button type="button" onClick={() => onChange('')} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-red-300 hover:bg-white/15">Remove</button>
      </div>
    </div> : <label htmlFor={inputId} className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/5 px-3 py-6 text-xs font-black text-white/60 hover:bg-white/10">{uploading ? 'Uploading…' : `Upload ${fieldLabel}`}</label>}
    <input id={inputId} type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
  </div>;
}

const STUDIO_VIEW_ICONS = ['Home', 'Clapperboard', 'Theater', 'Wrench', 'BookOpen'];
const DEFAULT_STUDIO_VIEWS = [
  { key: 'home', label: 'Home', icon: 'Home', background_image: '', visible: true, order: 0 },
  { key: 'library', label: 'Production Kits', icon: 'Clapperboard', background_image: '', visible: true, order: 1 },
  { key: 'lab', label: 'Fun / Stages', icon: 'Theater', background_image: '', visible: true, order: 2 },
  { key: 'tools', label: 'Tools', icon: 'Wrench', background_image: '', visible: true, order: 3 },
  { key: 'stories', label: 'FotoPlay', icon: 'BookOpen', background_image: '', visible: true, order: 4 },
];
const FOTOPLAY_NAVIGABLE_VIEWS = ['gateway', 'author', 'browse'];
const DEFAULT_FOTOPLAY_VIEWS = [
  { key: 'gateway', label: 'Gateway', description: 'Choose your experience entry screen', background_image: '', visible: true, order: 0 },
  { key: 'author', label: 'Author', description: 'Private author workspace', background_image: '', visible: true, order: 1 },
  { key: 'browse', label: 'Browse', description: 'Browse available Story Packs', background_image: '', visible: true, order: 2 },
  { key: 'packDetails', label: 'Pack Details', description: 'Story Pack characters & existing sessions' },
  { key: 'topicSelection', label: 'Topic Selection', description: 'Choose the starting point for a hero' },
  { key: 'arcDefinition', label: 'Arc Definition', description: 'Design the AI-proposed story arc' },
  { key: 'characterEditor', label: 'Character Editor', description: 'Create your own hero character' },
  { key: 'session', label: 'Session', description: 'Story player and chapter production' },
];

function StudioViewsEditor({ views, onChange }) {
  const merged = DEFAULT_STUDIO_VIEWS.map((def) => ({ ...def, ...(views.find((item) => item.key === def.key) || {}) }));
  const sorted = [...merged].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const updateItem = (key, patch) => onChange(merged.map((item) => item.key === key ? { ...item, ...patch } : item));
  const [uploadingKey, setUploadingKey] = useState(null);
  return <div className="space-y-3">
    {sorted.map((item) => {
      const iconSource = item.icon_image ? 'custom' : 'builtin';
      return <div key={item.key} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
      <div className="flex items-center justify-between gap-3"><span className="text-sm font-black text-white">{item.key}</span><label className="flex items-center gap-2 text-xs text-white/60"><input type="checkbox" className="accent-yellow-400" checked={item.visible !== false} onChange={(event) => updateItem(item.key, { visible: event.target.checked })} />Visible</label></div>
      <div className="grid gap-3 md:grid-cols-2">
        <div><span className={label}>Displayed name</span><input className={field} value={item.label || ''} onChange={(event) => updateItem(item.key, { label: event.target.value })} /></div>
        <div><span className={label}>Order</span><input type="number" className={field} value={item.order ?? 0} onChange={(event) => updateItem(item.key, { order: Number(event.target.value) })} /></div>
      </div>
      <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <span className={label}>Icon source</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => updateItem(item.key, { icon_image: '' })} className={`rounded-lg px-3 py-1.5 text-xs font-black ${iconSource === 'builtin' ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/60'}`}>Built-in icon</button>
            <button type="button" onClick={() => updateItem(item.key, { icon_image: item.icon_image || ' ' })} className={`rounded-lg px-3 py-1.5 text-xs font-black ${iconSource === 'custom' ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/60'}`}>Custom image</button>
          </div>
        </div>
        {iconSource === 'builtin' ? <div><span className={label}>Icon</span><select className={field} value={item.icon || 'Home'} onChange={(event) => updateItem(item.key, { icon: event.target.value })}>{STUDIO_VIEW_ICONS.map((icon) => <option key={icon} className="bg-black" value={icon}>{icon}</option>)}</select></div> : <StudioImageUploadField label="Icon image" value={item.icon_image?.trim() ? item.icon_image : ''} onChange={(url) => updateItem(item.key, { icon_image: url || ' ' })} uploading={uploadingKey === `${item.key}-icon`} setUploading={(value) => setUploadingKey(value ? `${item.key}-icon` : null)} />}
      </div>
      <StudioImageUploadField label="Background image" value={item.background_image || ''} onChange={(url) => updateItem(item.key, { background_image: url })} uploading={uploadingKey === `${item.key}-bg`} setUploading={(value) => setUploadingKey(value ? `${item.key}-bg` : null)} />
    </div>;
    })}
  </div>;
}

function FotoplayViewsEditor({ views, onChange }) {
  const merged = DEFAULT_FOTOPLAY_VIEWS.map((def) => ({ ...def, ...(views.find((item) => item.key === def.key) || {}) }));
  const navigable = merged.filter((item) => FOTOPLAY_NAVIGABLE_VIEWS.includes(item.key)).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const workflowOnly = merged.filter((item) => !FOTOPLAY_NAVIGABLE_VIEWS.includes(item.key));
  const updateItem = (key, patch) => onChange(merged.map((item) => item.key === key ? { ...item, ...patch } : item));
  const [uploadingKey, setUploadingKey] = useState(null);
  return <div className="space-y-3">
    <p className={label}>Navigable entry views</p>
    {navigable.map((item) => <div key={item.key} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
      <div className="flex items-center justify-between gap-3"><span className="text-sm font-black text-white">{item.key}</span><label className="flex items-center gap-2 text-xs text-white/60"><input type="checkbox" className="accent-yellow-400" checked={item.visible !== false} onChange={(event) => updateItem(item.key, { visible: event.target.checked })} />Visible</label></div>
      <div className="grid gap-3 md:grid-cols-2">
        <div><span className={label}>Displayed name</span><input className={field} value={item.label || ''} onChange={(event) => updateItem(item.key, { label: event.target.value })} /></div>
        <div><span className={label}>Order</span><input type="number" className={field} value={item.order ?? 0} onChange={(event) => updateItem(item.key, { order: Number(event.target.value) })} /></div>
      </div>
      <div><span className={label}>Description</span><input className={field} value={item.description || ''} onChange={(event) => updateItem(item.key, { description: event.target.value })} /></div>
      <StudioImageUploadField label="Background image" value={item.background_image || ''} onChange={(url) => updateItem(item.key, { background_image: url })} uploading={uploadingKey === `${item.key}-bg`} setUploading={(value) => setUploadingKey(value ? `${item.key}-bg` : null)} />
    </div>)}
    <p className={`${label} mt-5`}>Workflow steps (not directly navigable)</p>
    {workflowOnly.map((item) => <div key={item.key} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
      <span className="text-sm font-black text-white">{item.key}</span>
      <div><span className={label}>Displayed name</span><input className={field} value={item.label || ''} onChange={(event) => updateItem(item.key, { label: event.target.value })} /></div>
      <div><span className={label}>Description</span><input className={field} value={item.description || ''} onChange={(event) => updateItem(item.key, { description: event.target.value })} /></div>
    </div>)}
  </div>;
}

function StudioHomeItemsEditor({ items, onChange }) {
  const sorted = [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const updateItem = (key, patch) => onChange(items.map((item) => item.key === key ? { ...item, ...patch } : item));
  const [uploadingKey, setUploadingKey] = useState(null);
  return <div className="space-y-3">
    <p className={label}>Studio home items</p>
    {sorted.map((item) => {
      const iconSource = item.icon_image ? 'custom' : 'builtin';
      return <div key={item.key} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
      <div className="flex items-center justify-between gap-3"><span className="text-sm font-black text-white">{item.key}</span><label className="flex items-center gap-2 text-xs text-white/60"><input type="checkbox" className="accent-yellow-400" checked={item.visible !== false} onChange={(event) => updateItem(item.key, { visible: event.target.checked })} />Visible</label></div>
      <div className="grid gap-3 md:grid-cols-2">
        <div><span className={label}>Display name</span><input className={field} value={item.label || ''} onChange={(event) => updateItem(item.key, { label: event.target.value })} /></div>
        <div><span className={label}>Order</span><input type="number" className={field} value={item.order ?? 0} onChange={(event) => updateItem(item.key, { order: Number(event.target.value) })} /></div>
      </div>
      <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <span className={label}>Icon source</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => updateItem(item.key, { icon_image: '' })} className={`rounded-lg px-3 py-1.5 text-xs font-black ${iconSource === 'builtin' ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/60'}`}>Built-in icon</button>
            <button type="button" onClick={() => updateItem(item.key, { icon_image: item.icon_image || ' ' })} className={`rounded-lg px-3 py-1.5 text-xs font-black ${iconSource === 'custom' ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white/60'}`}>Custom image</button>
          </div>
        </div>
        {iconSource === 'builtin' ? <div><span className={label}>Icon</span><select className={field} value={item.icon || 'Home'} onChange={(event) => updateItem(item.key, { icon: event.target.value })}>{STUDIO_HOME_ICONS.map((icon) => <option key={icon} className="bg-black" value={icon}>{icon}</option>)}</select></div> : <StudioImageUploadField label="Icon image" value={item.icon_image?.trim() ? item.icon_image : ''} onChange={(url) => updateItem(item.key, { icon_image: url || ' ' })} uploading={uploadingKey === `${item.key}-icon`} setUploading={(value) => setUploadingKey(value ? `${item.key}-icon` : null)} />}
      </div>
      <StudioImageUploadField label="Background image" value={item.background_image || ''} onChange={(url) => updateItem(item.key, { background_image: url })} uploading={uploadingKey === `${item.key}-bg`} setUploading={(value) => setUploadingKey(value ? `${item.key}-bg` : null)} />
      <div><span className={label}>Description</span><input className={field} value={item.description || ''} onChange={(event) => updateItem(item.key, { description: event.target.value })} /></div>
    </div>;
    })}
  </div>;
}

export default function AdminPagesTools() {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState('page');
  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState('Index');
  const [section, setSection] = useState('configuration');
  const { data, isLoading, refetch } = useQuery({ queryKey: ['admin-pages-tools'], queryFn: async () => (await base44.functions.invoke('admin-pages-tools', { action: 'overview' })).data });
  const surfaces = useMemo(() => ADMIN_SURFACES.filter((item) => item.type === kind).map((item) => {
    const saved = data?.settings?.find((setting) => setting.surface_type === item.type && setting.surface_key === item.key);
    return { ...item, displayLabel: saved?.label || item.label, order: Number(saved?.configuration?.order ?? ADMIN_SURFACES.indexOf(item)) };
  }).filter((item) => item.displayLabel.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.order - b.order || a.displayLabel.localeCompare(b.displayLabel)), [data?.settings, kind, search]);
  const surface = ADMIN_SURFACES.find((item) => item.type === kind && item.key === selectedKey) || surfaces[0] || ADMIN_SURFACES[0];
  const stored = data?.settings?.find((item) => item.surface_type === surface.type && item.surface_key === surface.key);
  const [draft, setDraft] = useState(() => defaultSurfaceSettings(surface));
  useEffect(() => setDraft({ ...defaultSurfaceSettings(surface), ...(stored || {}), look: { ...defaultSurfaceSettings(surface).look, ...(stored?.look || {}) }, configuration: { ...defaultSurfaceSettings(surface).configuration, ...(stored?.configuration || {}) } }), [surface.key, surface.type, stored]);
  useEffect(() => { if (surfaces.length && !surfaces.some((item) => item.key === selectedKey)) setSelectedKey(surfaces[0].key); }, [kind, surfaces, selectedKey]);
  const save = useMutation({ mutationFn: async () => (await base44.functions.invoke('admin-pages-tools', { action: 'save', setting: draft })).data, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-pages-tools'] }); queryClient.invalidateQueries({ queryKey: ['admin-surface-runtime'] }); toast.success('Settings saved'); }, onError: (error) => toast.error(error.message || 'Save failed') });
  const proposals = (data?.changes || []).filter((item) => item.surface_type === surface.type && item.surface_key === surface.key);
  if (isLoading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="animate-spin text-yellow-400" /></div>;
  return <div className="overflow-hidden rounded-3xl border border-white/10 bg-neutral-950 text-white">
    <div className="border-b border-white/10 p-5"><div className="flex items-center gap-3"><MonitorCog className="text-yellow-400" /><div><h2 className="text-xl font-black">Pages & Tools</h2><p className="text-sm text-white/45">Code, look and configuration for each existing surface.</p></div></div></div>
    <div className="grid min-h-[680px] lg:grid-cols-[280px_minmax(0,1fr)]"><aside className="border-b border-white/10 bg-black/40 p-4 lg:border-b-0 lg:border-r"><div className="grid grid-cols-2 gap-2"><button onClick={() => { setKind('page'); setSelectedKey('Index'); }} className={`rounded-xl px-3 py-2 text-xs font-black ${kind === 'page' ? 'bg-yellow-400 text-black' : 'bg-white/5'}`}><FileCode2 size={14} className="mr-2 inline" />Pages</button><button onClick={() => { setKind('tool'); setSelectedKey('agent_bar'); }} className={`rounded-xl px-3 py-2 text-xs font-black ${kind === 'tool' ? 'bg-yellow-400 text-black' : 'bg-white/5'}`}><Wrench size={14} className="mr-2 inline" />Tools</button></div><div className="relative mt-3"><Search size={14} className="absolute left-3 top-3 text-white/35" /><input value={search} onChange={(event) => setSearch(event.target.value)} className={`${field} pl-9`} placeholder="Search" /></div><div className="mt-3 max-h-[570px] space-y-1 overflow-y-auto">{surfaces.map((item) => <button key={item.key} onClick={() => setSelectedKey(item.key)} className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold ${surface.key === item.key ? 'bg-white text-black' : 'text-white/60 hover:bg-white/5'}`}>{item.displayLabel}</button>)}</div></aside>
      <main className="min-w-0 p-5 lg:p-7"><div className="mb-5 flex flex-wrap items-start justify-between gap-4"><div><p className="text-[11px] font-black uppercase tracking-[0.2em] text-yellow-400">{surface.type}{surface.scope ? ` · ${surface.scope}` : ''}</p><h3 className="mt-1 text-2xl font-black">{draft.label || surface.label}</h3>{surface.route && <p className="mt-1 font-mono text-xs text-white/35">{surface.route}</p>}</div>{section !== 'code' && <button onClick={() => save.mutate()} disabled={save.isPending} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-black disabled:opacity-40"><Save size={15} />Save</button>}</div><SectionTabs active={section} onChange={setSection} /><div className="mt-6">{section === 'code' && <CodeSection surface={surface} setting={draft} proposals={proposals} onRefresh={refetch} />}{section === 'look' && <LookSection surface={surface} draft={draft} setDraft={setDraft} />}{section === 'configuration' && <ConfigurationSection surface={surface} draft={draft} setDraft={setDraft} />}</div></main></div>
  </div>;
}
