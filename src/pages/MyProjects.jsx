import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Film, Trash2, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import KitProductionRoom from '@/components/KitProductionRoom';

export default function MyProjects() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [deletingId, setDeletingId] = useState(null);
  const [openProject, setOpenProject] = useState(null); // { project, kitPage, dossier }
  const [loadingProjectId, setLoadingProjectId] = useState(null);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['myProjects'],
    queryFn: async () => {
      const user = await base44.auth.me();
      if (!user) return [];
      const all = await base44.entities.TimelineStory.filter({ user_email: user.email });
      const enriched = await Promise.all(all.map(async (p) => {
        try {
          const dossier = p.dossier_id ? await base44.entities.Dossier.get(p.dossier_id) : null;
          return { ...p, dossier };
        } catch {
          return { ...p, dossier: null };
        }
      }));
      return enriched.sort((a, b) => new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date));
    },
  });

  const handleDelete = async (projectId, e) => {
    e.stopPropagation();
    if (!confirm('Delete this project?')) return;
    setDeletingId(projectId);
    try {
      await base44.entities.TimelineStory.delete(projectId);
      qc.invalidateQueries({ queryKey: ['myProjects'] });
    } catch {
      alert('Failed to delete project');
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenProject = async (project) => {
    setLoadingProjectId(project.id);
    try {
      let kitPage = null;
      if (project.kit_page_id && project.kit_page_id !== 'free_timeline') {
        kitPage = await base44.entities.DossierPage.get(project.kit_page_id);
      }
      const dossier = project.dossier || (project.dossier_id ? await base44.entities.Dossier.get(project.dossier_id).catch(() => null) : null);
      setOpenProject({ project, kitPage, dossier });
    } catch {
      alert('Could not load project. Try again.');
    } finally {
      setLoadingProjectId(null);
    }
  };

  // If a project is open, render KitProductionRoom as full overlay
  if (openProject) {
    return (
      <KitProductionRoom
        kitPage={openProject.kitPage}
        dossier={openProject.dossier}
        onClose={() => {
          setOpenProject(null);
          qc.invalidateQueries({ queryKey: ['myProjects'] });
        }}
        referenceMedia={[
          ...(openProject.kitPage?.kit_characters?.flatMap(c => c.media || []) || []),
          ...(openProject.kitPage?.kit_sets?.flatMap(s => s.media || []) || []),
        ].slice(0, 6)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-yellow-400 flex items-center justify-center">
        <Loader2 size={40} className="text-black animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-yellow-400 pb-20">
      {/* Header */}
      <div className="px-5 pt-12 pb-6">
        <button onClick={() => navigate('/Studio')} className="flex items-center gap-2 text-black hover:text-black mb-6">
          <ChevronLeft size={20} />
          <span className="text-sm font-bold">Back to Studio</span>
        </button>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center">
            <Film size={24} className="text-yellow-400" />
          </div>
          <div>
            <h1 className="text-black text-4xl font-bold">My Projects</h1>
            <p className="text-black text-sm mt-1">{projects.length} {projects.length === 1 ? 'project' : 'projects'}</p>
          </div>
        </div>
      </div>

      {/* Projects List */}
      <div className="px-5 space-y-3">
        {projects.length === 0 ? (
          <div className="bg-yellow-300/40 rounded-3xl p-10 text-center border-2 border-black/10 shadow-lg">
            <div className="w-20 h-20 bg-black/5 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Film size={40} className="text-black" />
            </div>
            <p className="text-black text-lg font-bold mb-2">No projects yet</p>
            <p className="text-black text-sm mb-6">Start creating from a production kit</p>
            <Button onClick={() => navigate('/Magazine')} className="bg-black text-yellow-400 hover:bg-black/90">
              <Plus size={16} className="mr-2" />
              Browse Kits
            </Button>
          </div>
        ) : (
          projects.map((project) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleOpenProject(project)}
              className="bg-black rounded-3xl p-5 cursor-pointer hover:bg-black/90 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-yellow-400/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                  {loadingProjectId === project.id ? (
                    <Loader2 size={28} className="text-yellow-400 animate-spin" />
                  ) : (
                    <Film size={28} className="text-yellow-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-base truncate">
                    {project.production_name || project.episode_title || 'Untitled Project'}
                  </p>
                  {project.episode_title && project.production_name && (
                    <p className="text-white text-sm mt-1 truncate">{project.episode_title}</p>
                  )}
                  {project.dossier && (
                    <p className="text-white text-xs mt-2 truncate">
                      From: {project.dossier.title}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-white text-xs">
                      {project.blocks?.filter(b => b.media_url).length || 0} scenes
                    </span>
                    {project.updated_date && (
                      <span className="text-white text-xs">
                        · Updated {new Date(project.updated_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(project.id, e)}
                  disabled={deletingId === project.id}
                  className="w-9 h-9 bg-red-600/20 rounded-full flex items-center justify-center hover:bg-red-600/30 transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  {deletingId === project.id ? (
                    <Loader2 size={16} className="text-red-400 animate-spin" />
                  ) : (
                    <Trash2 size={16} className="text-red-400" />
                  )}
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}