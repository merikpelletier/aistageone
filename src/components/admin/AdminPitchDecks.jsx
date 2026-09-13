import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Archive, Eye, Pencil } from 'lucide-react';
import { supabase } from '@/api/base44Client';

export default function AdminPitchDecks() {
  const queryClient = useQueryClient();
  const { data: projects = [], isLoading, error } = useQuery({ queryKey: ['admin-pitch-decks'], queryFn: async () => { const { data, error: queryError } = await supabase.from('pitch_project').select('*').order('updated_at', { ascending: false }).limit(200); if (queryError) throw queryError; return data || []; } });
  const updateProject = async (id, values) => { await supabase.from('pitch_project').update({ ...values, updated_at: new Date().toISOString() }).eq('id', id); queryClient.invalidateQueries({ queryKey: ['admin-pitch-decks'] }); };
  if (isLoading) return <p className="text-white">Loading pitch decks...</p>;
  if (error) return <p className="text-red-400">Pitch Deck controls unavailable.</p>;
  return <div className="space-y-5"><div><h2 className="text-white text-xl font-bold">Pitch Decks</h2><p className="text-white/50 text-sm">{projects.length} private projects</p></div><div className="space-y-3">{projects.map((project) => <article key={project.id} className="bg-neutral-900 border border-white/10 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4"><div className="flex-1"><p className="text-yellow-400 text-[10px] uppercase font-bold">{project.project_type || 'project'} Â· {project.project_status}</p><h3 className="text-white text-lg font-bold">{project.final_title || project.working_title || 'Untitled project'}</h3><p className="text-white/50 text-xs mt-1">{project.creator_name || project.creator_email || 'No creator name'}</p></div><div className="flex gap-2"><Link to={`/PitchDeckDetail?id=${encodeURIComponent(project.id)}`} className="p-3 bg-neutral-700 text-white rounded-xl"><Eye size={16} /></Link><Link to={`/PitchDeckEditor?id=${encodeURIComponent(project.id)}`} className="p-3 bg-yellow-400 text-black rounded-xl"><Pencil size={16} /></Link><button onClick={() => updateProject(project.id, { archived: !project.archived })} className={`p-3 rounded-xl ${project.archived ? 'bg-red-600 text-white' : 'bg-neutral-700 text-white'}`}><Archive size={16} /></button></div></article>)}</div></div>;
}

