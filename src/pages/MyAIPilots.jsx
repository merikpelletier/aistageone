import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bot, Check, ChevronLeft, Loader2, Power, PowerOff } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function MyAIPilots() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoadingAuth } = useAuth();
  const [selectedProjectByPilot, setSelectedProjectByPilot] = useState({});
  const [message, setMessage] = useState('');

  const { data: library = [], isLoading: libraryLoading, error: libraryError } = useQuery({
    queryKey: ['my-ai-pilots', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data: accessRows, error: accessError } = await supabase
        .from('member_ai_pilots')
        .select('*')
        .eq('user_id', user.id)
        .order('granted_at', { ascending: false });
      if (accessError) throw accessError;
      if (!accessRows?.length) return [];

      const pilotIds = [...new Set(accessRows.map((row) => row.ai_pilot_id))];
      const versionIds = [...new Set(accessRows.map((row) => row.version_id))];

      const [{ data: pilots, error: pilotsError }, { data: versions, error: versionsError }] = await Promise.all([
        supabase.from('ai_pilots').select('*').in('id', pilotIds),
        supabase.from('ai_pilot_versions').select('*').in('id', versionIds),
      ]);
      if (pilotsError) throw pilotsError;
      if (versionsError) throw versionsError;

      const pilotMap = new Map((pilots || []).map((pilot) => [pilot.id, pilot]));
      const versionMap = new Map((versions || []).map((version) => [version.id, version]));
      return accessRows.map((access) => ({
        ...access,
        pilot: pilotMap.get(access.ai_pilot_id) || null,
        version: versionMap.get(access.version_id) || null,
      }));
    },
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['my-ai-pilot-projects', user?.email],
    enabled: Boolean(user?.email),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timeline_story')
        .select('id, production_name, episode_title, updated_date, created_date')
        .eq('user_email', user.email)
        .order('updated_date', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['my-ai-pilot-assignments', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_pilot_project_assignments')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
  });

  const assignmentsByPilot = useMemo(() => {
    const map = new Map();
    assignments.forEach((assignment) => {
      if (!map.has(assignment.ai_pilot_id)) map.set(assignment.ai_pilot_id, []);
      map.get(assignment.ai_pilot_id).push(assignment);
    });
    return map;
  }, [assignments]);

  const activateMutation = useMutation({
    mutationFn: async ({ access, projectId }) => {
      if (!user?.id || !projectId) throw new Error('Select a project first.');
      const { error } = await supabase
        .from('ai_pilot_project_assignments')
        .upsert({
          user_id: user.id,
          project_id: String(projectId),
          member_ai_pilot_id: access.id,
          ai_pilot_id: access.ai_pilot_id,
          version_id: access.version_id,
          is_active: true,
          activated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,project_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage('AI Pilot activated for this project.');
      queryClient.invalidateQueries({ queryKey: ['my-ai-pilot-assignments', user?.id] });
    },
    onError: (error) => setMessage(error?.message || 'Unable to activate AI Pilot.'),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (assignment) => {
      const { error } = await supabase
        .from('ai_pilot_project_assignments')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', assignment.id)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage('AI Pilot removed from the project.');
      queryClient.invalidateQueries({ queryKey: ['my-ai-pilot-assignments', user?.id] });
    },
    onError: (error) => setMessage(error?.message || 'Unable to remove AI Pilot.'),
  });

  if (isLoadingAuth || libraryLoading) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-white" size={34} /></div>;
  }

  return (
    <div className="min-h-screen bg-black pb-20 text-white">
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-7">
        <button type="button" onClick={() => navigate('/MemberDashboard')} className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-white/60 hover:text-white">
          <ChevronLeft size={18} /> Account
        </button>

        <div className="mb-8 flex flex-col gap-3 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-400">AISTAGE.ONE Direction System</p>
            <h1 className="mt-2 text-4xl font-light tracking-tight">My AI Pilots</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/50">Choose the AI direction package that should guide a production. Activating a Pilot does not change the Pilot itself.</p>
          </div>
          <Button type="button" variant="outline" onClick={() => navigate('/Catalog')} className="border-white/20 bg-white/[0.03] text-white hover:bg-white/10">Browse Assets Shop</Button>
        </div>

        {(libraryError || message) && (
          <div className={`mb-5 border p-4 text-sm ${libraryError ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100'}`}>
            {libraryError?.message || message}
          </div>
        )}

        {library.length === 0 ? (
          <div className="border border-dashed border-white/15 px-6 py-16 text-center">
            <Bot className="mx-auto text-white/25" size={46} />
            <h2 className="mt-4 text-xl font-light">No AI Pilot in your library</h2>
            <p className="mt-2 text-sm text-white/40">AI Pilots acquired or granted to your account will appear here.</p>
            <Button type="button" onClick={() => navigate('/Catalog')} className="mt-6">Browse Assets Shop</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {library.map((access) => {
              const activeAssignments = assignmentsByPilot.get(access.ai_pilot_id) || [];
              const selectedProjectId = selectedProjectByPilot[access.id] || '';
              return (
                <section key={access.id} className="border border-white/10 bg-neutral-950 p-5">
                  <div className="grid gap-5 lg:grid-cols-[120px_minmax(0,1fr)_minmax(320px,.8fr)]">
                    <div className="aspect-square overflow-hidden bg-neutral-900">
                      {access.pilot?.cover_url ? <img src={access.pilot.cover_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Bot size={38} className="text-white/20" /></div>}
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/35">
                        <span>Version {access.version?.version_number || '?'}</span>
                        <span>•</span>
                        <span>{access.access_source}</span>
                      </div>
                      <h2 className="mt-2 text-2xl font-light">{access.pilot?.name || 'AI Pilot'}</h2>
                      {access.pilot?.description && <p className="mt-3 text-sm leading-relaxed text-white/55">{access.pilot.description}</p>}
                      {activeAssignments.length > 0 && (
                        <div className="mt-4 space-y-2">
                          {activeAssignments.map((assignment) => {
                            const project = projects.find((item) => String(item.id) === String(assignment.project_id));
                            return (
                              <div key={assignment.id} className="flex items-center justify-between gap-3 border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-sm">
                                <span className="min-w-0 truncate text-emerald-200"><Check size={14} className="mr-2 inline" />{project?.production_name || project?.episode_title || `Project ${assignment.project_id}`}</span>
                                <button type="button" onClick={() => deactivateMutation.mutate(assignment)} className="flex-none text-white/45 hover:text-white" aria-label="Deactivate AI Pilot"><PowerOff size={16} /></button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="border-l-0 border-white/10 lg:border-l lg:pl-5">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-white/45">Activate for a project</p>
                      <div className="mt-3 space-y-3">
                        <Select value={selectedProjectId} onValueChange={(value) => setSelectedProjectByPilot((current) => ({ ...current, [access.id]: value }))} disabled={projectsLoading || assignmentsLoading}>
                          <SelectTrigger className="border-white/10 bg-black text-white"><SelectValue placeholder={projectsLoading ? 'Loading projects…' : 'Select project'} /></SelectTrigger>
                          <SelectContent>
                            {projects.map((project) => (
                              <SelectItem key={project.id} value={String(project.id)}>{project.production_name || project.episode_title || 'Untitled Project'}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" className="w-full" disabled={!selectedProjectId || activateMutation.isPending} onClick={() => activateMutation.mutate({ access, projectId: selectedProjectId })}>
                          <Power size={16} className="mr-2" /> Activate AI Pilot
                        </Button>
                        {!projectsLoading && projects.length === 0 && <p className="text-xs text-white/35">Create a project first, then return here to assign an AI Pilot.</p>}
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
