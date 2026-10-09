import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Layers, Loader2, Plus } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import SetAssetEditor from '@/components/studio/SetAssetEditor';

export default function SetDesignerWorkspace({ userEmail }) {
  const qc = useQueryClient();
  const [selectedProject, setSelectedProject] = useState(null);
  const [creating, setCreating] = useState(false);

  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: ['setDesignerProjects'],
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from('set_designer_project')
        .select('*')
        .order('updated_date', { ascending: false });
      if (queryError) throw queryError;
      return data || [];
    },
  });

  const openNew = () => {
    setSelectedProject(null);
    setCreating(true);
  };

  const openProject = (project) => {
    setCreating(false);
    setSelectedProject(project);
  };

  const returnToProjects = () => {
    setCreating(false);
    setSelectedProject(null);
    qc.invalidateQueries({ queryKey: ['setDesignerProjects'] });
  };

  const handleSaved = (saved) => {
    setCreating(false);
    setSelectedProject(saved);
    qc.invalidateQueries({ queryKey: ['setDesignerProjects'] });
  };

  if (creating || selectedProject) {
    return (
      <SetAssetEditor
        embedded
        key={selectedProject?.id || 'new-set-project'}
        asset={selectedProject || null}
        userEmail={userEmail}
        onSaved={handleSaved}
        onClose={returnToProjects}
      />
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#202328] px-4 py-6 text-white md:px-7">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#23c7be]">Set Designer</p>
            <h2 className="mt-1 text-3xl font-black">My Sets</h2>
            <p className="mt-2 max-w-2xl text-sm text-white/45">Open a saved set to change its creative direction, replace references, or generate another production angle.</p>
          </div>
          <button type="button" onClick={openNew} className="flex items-center justify-center gap-2 bg-[#23c7be] px-5 py-3 text-sm font-black text-[#071211] hover:bg-[#35d8cf]">
            <Plus size={17} /> NEW SET
          </button>
        </div>

        {isLoading ? (
          <div className="flex min-h-72 items-center justify-center"><Loader2 className="animate-spin text-[#23c7be]" /></div>
        ) : error ? (
          <div className="border border-red-400/20 bg-red-400/10 p-6 text-sm text-red-100">Your saved sets could not be loaded.</div>
        ) : projects.length === 0 ? (
          <button type="button" onClick={openNew} className="flex min-h-72 w-full flex-col items-center justify-center border border-dashed border-white/15 bg-[#17191d] px-6 text-center hover:border-[#23c7be]/50">
            <Layers size={36} className="text-[#23c7be]" />
            <span className="mt-4 text-lg font-black">Create your first set</span>
            <span className="mt-2 text-sm text-white/40">The complete Set Designer project will stay available here for later changes and additional views.</span>
          </button>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((project) => {
              const images = Array.isArray(project.images) ? project.images : [];
              const hero = images[0];
              const viewCount = images.filter(Boolean).length;
              return (
                <button key={project.id} type="button" onClick={() => openProject(project)} className="overflow-hidden border border-white/10 bg-[#17191d] text-left transition hover:border-[#23c7be]/55">
                  <div className="aspect-[16/10] bg-black">
                    {hero ? <img src={hero} alt={project.name || 'Saved set'} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-white/20"><Layers size={34} /></div>}
                  </div>
                  <div className="p-4">
                    <p className="truncate text-sm font-black text-white">{project.name || 'Untitled set'}</p>
                    <p className="mt-1 text-[11px] font-bold text-white/40">{viewCount}/8 production views</p>
                    <p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#8ee9e4]">Open Set Designer</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
