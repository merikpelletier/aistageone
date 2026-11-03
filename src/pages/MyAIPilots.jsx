import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bot, Check, ChevronDown, ChevronLeft, ChevronUp, Loader2, Plus, Power, PowerOff, Trash2 } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EXTENSION_TYPES = [
  ['character_style', 'Character / Character Style'],
  ['look', 'Look'],
  ['set', 'Set'],
  ['location', 'Location'],
  ['music_piece', 'Music Piece'],
  ['visual_direction', 'Visual Direction'],
];

const humanize = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const isEmpty = (value) => value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0) || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value || {}).length === 0);

function ContentValue({ value }) {
  if (isEmpty(value)) return null;
  if (Array.isArray(value)) {
    return <div className="mt-2 space-y-2">{value.map((item, index) => (
      <div key={item?.id || index} className="rounded-xl border border-white/10 bg-black/40 p-3">
        {typeof item === 'object' && item !== null ? <ContentObject value={item} /> : <p className="text-sm text-white/70">{String(item)}</p>}
      </div>
    ))}</div>;
  }
  if (typeof value === 'object') return <ContentObject value={value} />;
  return <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/70">{String(value)}</p>;
}

function ContentObject({ value }) {
  return <div className="space-y-3">{Object.entries(value || {}).filter(([, entry]) => !isEmpty(entry)).map(([key, entry]) => (
    <div key={key}>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">{humanize(key)}</p>
      <ContentValue value={entry} />
    </div>
  ))}</div>;
}

function PilotDetails({ access, user, onMessage }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState({ extension_type: 'look', name: '', description: '', notes: '' });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!draft.name.trim()) throw new Error('Add a name first.');
      const { error } = await supabase.from('member_ai_pilot_extensions').insert({
        member_ai_pilot_id: access.id,
        user_id: user.id,
        extension_type: draft.extension_type,
        name: draft.name.trim(),
        content: { description: draft.description.trim(), notes: draft.notes.trim() },
        operation: 'add',
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setDraft({ extension_type: 'look', name: '', description: '', notes: '' });
      onMessage('Personal addition saved.');
      await queryClient.invalidateQueries({ queryKey: ['my-ai-pilots', user.id] });
    },
    onError: (error) => onMessage(error?.message || 'Unable to save this addition.'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('member_ai_pilot_extensions').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      onMessage('Personal addition removed.');
      await queryClient.invalidateQueries({ queryKey: ['my-ai-pilots', user.id] });
    },
    onError: (error) => onMessage(error?.message || 'Unable to remove this addition.'),
  });

  return (
    <div className="mt-5 grid gap-5 border-t border-white/10 pt-5 lg:grid-cols-2">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">Published AI Pilot</p><p className="mt-1 text-xs text-white/35">Read only · version {access.version?.version_number || '?'}</p></div>
        </div>
        <div className="space-y-3">
          {(access.blocks || []).length ? (access.blocks || []).map((block) => (
            <details key={block.id} className="rounded-xl border border-white/10 bg-black/35 p-4">
              <summary className="cursor-pointer text-sm font-black text-white">{block.title || humanize(block.block_key)}</summary>
              <div className="mt-4"><ContentObject value={block.content || {}} /></div>
            </details>
          )) : <p className="text-sm text-white/35">No published direction blocks available.</p>}
        </div>
      </div>

      <div>
        <div className="mb-3"><p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">My additions</p><p className="mt-1 text-xs text-white/35">Your additions extend this Pilot without changing the published original.</p></div>
        <div className="space-y-2">
          {(access.extensions || []).map((extension) => (
            <div key={extension.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-300">{humanize(extension.extension_type)}</p><p className="mt-1 font-bold text-white">{extension.name}</p></div>
                <button type="button" onClick={() => deleteMutation.mutate(extension.id)} disabled={deleteMutation.isPending} className="text-red-300 hover:text-red-200" aria-label={`Remove ${extension.name}`}><Trash2 size={15} /></button>
              </div>
              <div className="mt-2"><ContentObject value={extension.content || {}} /></div>
            </div>
          ))}
          {(access.extensions || []).length === 0 && <p className="text-sm text-white/35">No personal additions yet.</p>}
        </div>

        <div className="mt-4 space-y-3 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.05] p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-200">Add to my version</p>
          <select value={draft.extension_type} onChange={(event) => setDraft((current) => ({ ...current, extension_type: event.target.value }))} className="w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-sm text-white">
            {EXTENSION_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Name" className="w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-sm text-white placeholder:text-white/30" />
          <textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} rows={3} placeholder="Description" className="w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-sm text-white placeholder:text-white/30" />
          <textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} rows={3} placeholder="Direction / notes for AI tools" className="w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-sm text-white placeholder:text-white/30" />
          <Button type="button" onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !draft.name.trim()} className="w-full"><Plus size={16} className="mr-2" /> Add to my AI Pilot</Button>
        </div>
      </div>
    </div>
  );
}

export default function MyAIPilots({ embedded = false }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoadingAuth } = useAuth();
  const [selectedProjectByPilot, setSelectedProjectByPilot] = useState({});
  const [expanded, setExpanded] = useState({});
  const [message, setMessage] = useState('');

  const { data: library = [], isLoading: libraryLoading, error: libraryError } = useQuery({
    queryKey: ['my-ai-pilots', user?.id],
    enabled: Boolean(user?.id),
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    queryFn: async () => {
      const { data: accessRows, error: accessError } = await supabase.from('member_ai_pilots').select('*').eq('user_id', user.id).order('granted_at', { ascending: false });
      if (accessError) throw accessError;
      if (!accessRows?.length) return [];

      const pilotIds = [...new Set(accessRows.map((row) => row.ai_pilot_id).filter(Boolean))];
      const memberIds = accessRows.map((row) => row.id);
      const assetIds = [...new Set(accessRows.map((row) => row.source_asset_id).filter(Boolean))];

      const [pilotsResult, versionsResult, extensionsResult, assetsResult] = await Promise.all([
        supabase.from('ai_pilots').select('*').in('id', pilotIds),
        supabase.from('ai_pilot_versions').select('*').in('ai_pilot_id', pilotIds).eq('is_published', true).order('version_number', { ascending: false }),
        supabase.from('member_ai_pilot_extensions').select('*').in('member_ai_pilot_id', memberIds).eq('is_active', true).order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
        assetIds.length ? supabase.from('catalog_asset').select('id,title,description,featured_image,preview_images,creator_name,tags').in('id', assetIds) : Promise.resolve({ data: [], error: null }),
      ]);
      for (const result of [pilotsResult, versionsResult, extensionsResult, assetsResult]) if (result.error) throw result.error;

      const latestPublishedByPilot = new Map();
      (versionsResult.data || []).forEach((version) => {
        if (!latestPublishedByPilot.has(version.ai_pilot_id)) latestPublishedByPilot.set(version.ai_pilot_id, version);
      });
      const versionMap = new Map((versionsResult.data || []).map((version) => [version.id, version]));
      const resolvedVersionIds = [...new Set(accessRows.map((access) => latestPublishedByPilot.get(access.ai_pilot_id)?.id || access.version_id).filter(Boolean))];
      const blocksResult = resolvedVersionIds.length
        ? await supabase.from('ai_pilot_blocks').select('*').in('version_id', resolvedVersionIds).eq('is_active', true).order('sort_order', { ascending: true })
        : { data: [], error: null };
      if (blocksResult.error) throw blocksResult.error;

      const pilotMap = new Map((pilotsResult.data || []).map((pilot) => [pilot.id, pilot]));
      const assetMap = new Map((assetsResult.data || []).map((asset) => [String(asset.id), asset]));
      const blocksByVersion = new Map();
      (blocksResult.data || []).forEach((block) => { if (!blocksByVersion.has(block.version_id)) blocksByVersion.set(block.version_id, []); blocksByVersion.get(block.version_id).push(block); });
      const extensionsByMember = new Map();
      (extensionsResult.data || []).forEach((extension) => { if (!extensionsByMember.has(extension.member_ai_pilot_id)) extensionsByMember.set(extension.member_ai_pilot_id, []); extensionsByMember.get(extension.member_ai_pilot_id).push(extension); });

      return accessRows.map((access) => {
        const resolvedVersion = latestPublishedByPilot.get(access.ai_pilot_id) || versionMap.get(access.version_id) || null;
        const resolvedVersionId = resolvedVersion?.id || access.version_id;
        return {
          ...access,
          version_id: resolvedVersionId,
          pilot: pilotMap.get(access.ai_pilot_id) || null,
          version: resolvedVersion,
          presentation: assetMap.get(String(access.source_asset_id)) || null,
          blocks: blocksByVersion.get(resolvedVersionId) || [],
          extensions: extensionsByMember.get(access.id) || [],
        };
      });
    },
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['my-ai-pilot-projects', user?.email], enabled: Boolean(user?.email), queryFn: async () => {
      const { data, error } = await supabase.from('timeline_story').select('id, production_name, episode_title, updated_date, created_date').eq('user_email', user.email).order('updated_date', { ascending: false, nullsFirst: false });
      if (error) throw error; return data || [];
    },
  });

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['my-ai-pilot-assignments', user?.id], enabled: Boolean(user?.id), queryFn: async () => {
      const { data, error } = await supabase.from('ai_pilot_project_assignments').select('*').eq('user_id', user.id).eq('is_active', true);
      if (error) throw error; return data || [];
    },
  });

  const assignmentsByPilot = useMemo(() => {
    const map = new Map(); assignments.forEach((assignment) => { if (!map.has(assignment.ai_pilot_id)) map.set(assignment.ai_pilot_id, []); map.get(assignment.ai_pilot_id).push(assignment); }); return map;
  }, [assignments]);

  const activateMutation = useMutation({
    mutationFn: async ({ access, projectId }) => {
      if (!user?.id || !projectId) throw new Error('Select a project first.');
      const { error } = await supabase.from('ai_pilot_project_assignments').upsert({ user_id: user.id, project_id: String(projectId), member_ai_pilot_id: access.id, ai_pilot_id: access.ai_pilot_id, version_id: access.version_id, is_active: true, activated_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'user_id,project_id' });
      if (error) throw error;
    },
    onSuccess: () => { setMessage('AI Pilot activated for this project.'); queryClient.invalidateQueries({ queryKey: ['my-ai-pilot-assignments', user?.id] }); },
    onError: (error) => setMessage(error?.message || 'Unable to activate AI Pilot.'),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (assignment) => { const { error } = await supabase.from('ai_pilot_project_assignments').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', assignment.id).eq('user_id', user.id); if (error) throw error; },
    onSuccess: () => { setMessage('AI Pilot removed from the project.'); queryClient.invalidateQueries({ queryKey: ['my-ai-pilot-assignments', user?.id] }); },
    onError: (error) => setMessage(error?.message || 'Unable to remove AI Pilot.'),
  });

  if (isLoadingAuth || libraryLoading) return <div className={`${embedded ? 'min-h-full' : 'min-h-screen'} bg-black flex items-center justify-center`}><Loader2 className="animate-spin text-white" size={34} /></div>;

  return (
    <div className={`${embedded ? 'min-h-full' : 'min-h-screen'} bg-black pb-20 text-white`}>
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-7">
        {!embedded && <button type="button" onClick={() => navigate('/MemberDashboard')} className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-white/60 hover:text-white"><ChevronLeft size={18} /> Account</button>}
        <div className="mb-8 flex flex-col gap-3 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-400">AISTAGE.ONE Direction System</p><h1 className="mt-2 text-4xl font-light tracking-tight">My AI Pilots</h1><p className="mt-2 max-w-2xl text-sm text-white/50">View the published Pilot, add your own production elements, and activate it for your projects.</p></div>
          <Button type="button" variant="outline" onClick={() => navigate('/Catalog')} className="border-white/20 bg-white/[0.03] text-white hover:bg-white/10">Browse Assets Shop</Button>
        </div>
        {(libraryError || message) && <div className={`mb-5 border p-4 text-sm ${libraryError ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100'}`}>{libraryError?.message || message}</div>}
        {library.length === 0 ? <div className="border border-dashed border-white/15 px-6 py-16 text-center"><Bot className="mx-auto text-white/25" size={46} /><h2 className="mt-4 text-xl font-light">No AI Pilot in your library</h2><p className="mt-2 text-sm text-white/40">AI Pilots acquired or granted to your account will appear here.</p><Button type="button" onClick={() => navigate('/Catalog')} className="mt-6">Browse Assets Shop</Button></div> : (
          <div className="space-y-4">{library.map((access) => {
            const activeAssignments = assignmentsByPilot.get(access.ai_pilot_id) || [];
            const selectedProjectId = selectedProjectByPilot[access.id] || '';
            const title = access.presentation?.title || access.pilot?.name || 'AI Pilot';
            const description = access.presentation?.description || access.pilot?.description || '';
            const image = access.presentation?.featured_image || access.pilot?.cover_url || '';
            return <section key={access.id} className="border border-white/10 bg-neutral-950 p-5">
              <div className="grid gap-5 lg:grid-cols-[120px_minmax(0,1fr)_minmax(320px,.8fr)]">
                <div className="aspect-square overflow-hidden bg-neutral-900">{image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Bot size={38} className="text-white/20" /></div>}</div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/35"><span>Version {access.version?.version_number || '?'}</span><span>•</span><span>{access.access_source}</span>{access.presentation?.creator_name ? <><span>•</span><span>{access.presentation.creator_name}</span></> : null}</div>
                  <h2 className="mt-2 text-2xl font-light">{title}</h2>{description && <p className="mt-3 text-sm leading-relaxed text-white/55">{description}</p>}
                  <button type="button" onClick={() => setExpanded((current) => ({ ...current, [access.id]: !current[access.id] }))} className="mt-4 inline-flex items-center gap-2 text-sm font-black text-cyan-300">{expanded[access.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />} {expanded[access.id] ? 'Hide contents' : 'View contents & customize'}</button>
                  {activeAssignments.length > 0 && <div className="mt-4 space-y-2">{activeAssignments.map((assignment) => { const project = projects.find((item) => String(item.id) === String(assignment.project_id)); return <div key={assignment.id} className="flex items-center justify-between gap-3 border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-sm"><span className="min-w-0 truncate text-emerald-200"><Check size={14} className="mr-2 inline" />{project?.production_name || project?.episode_title || `Project ${assignment.project_id}`}</span><button type="button" onClick={() => deactivateMutation.mutate(assignment)} className="flex-none text-white/45 hover:text-white"><PowerOff size={16} /></button></div>; })}</div>}
                </div>
                <div className="border-l-0 border-white/10 lg:border-l lg:pl-5"><p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">Activate for a project</p><div className="mt-3 space-y-3"><Select value={selectedProjectId} onValueChange={(value) => setSelectedProjectByPilot((current) => ({ ...current, [access.id]: value }))} disabled={projectsLoading || assignmentsLoading}><SelectTrigger className="border-white/10 bg-black text-white"><SelectValue placeholder={projectsLoading ? 'Loading projects…' : 'Select project'} /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={String(project.id)}>{project.production_name || project.episode_title || 'Untitled Project'}</SelectItem>)}</SelectContent></Select><Button type="button" className="w-full" disabled={!selectedProjectId || activateMutation.isPending} onClick={() => activateMutation.mutate({ access, projectId: selectedProjectId })}><Power size={16} className="mr-2" /> Activate AI Pilot</Button>{!projectsLoading && projects.length === 0 && <p className="text-xs text-white/35">Create a project first, then return here to assign an AI Pilot.</p>}</div></div>
              </div>
              {expanded[access.id] && <PilotDetails access={access} user={user} onMessage={setMessage} />}
            </section>;
          })}</div>
        )}
      </main>
    </div>
  );
}