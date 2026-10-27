import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, LockKeyhole, Pencil, Play, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function PitchDecks({ embedded = false, onNew = null, onEdit = null, onView = null }) {
  const { data: projects = [], isLoading, error } = useQuery({ queryKey: ['pitch-projects'], queryFn: () => base44.entities.PitchProject.filter({ archived: false }, '-updated_at', 100) });

  return <div className={`${embedded ? 'h-[calc(100vh-3.5rem)] min-h-0 overflow-y-auto overscroll-contain' : 'min-h-screen'} bg-[#202328] pb-24 text-white`}>
    <header className="border-b border-white/10 bg-[#17191d] px-6 py-8">
      <div className="mx-auto max-w-7xl">
        {!embedded && <Link to="/Studio?tab=tools" className="inline-flex items-center gap-2 text-xs font-bold text-[#23c7be]"><ArrowLeft size={16} /> STUDIO TOOLS</Link>}
        <div className={`${!embedded ? 'mt-8' : ''} flex flex-wrap items-end justify-between gap-5`}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.24em] text-[#23c7be]">AI Production Tool</p>
            <h1 className="mt-1 text-4xl font-bold tracking-tight md:text-5xl">Pitch Decks</h1>
            <p className="mt-3 max-w-2xl text-sm text-white/45">Build cinematic, interactive presentations with images, video and audio.</p>
          </div>
          {embedded
            ? <button type="button" onClick={onNew} className="inline-flex items-center gap-2 rounded-[3px] bg-[#23c7be] px-5 py-3 text-sm font-bold text-[#071211] transition hover:bg-[#35d8cf]"><Plus size={17} /> NEW PITCH DECK</button>
            : <Link to="/PitchDeckEditor" className="inline-flex items-center gap-2 rounded-[3px] bg-[#23c7be] px-5 py-3 text-sm font-bold text-[#071211] transition hover:bg-[#35d8cf]"><Plus size={17} /> NEW PITCH DECK</Link>}
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-7xl px-6 py-8">
      {isLoading ? <div className="py-20 text-center text-sm text-white/35">LOADING...</div>
      : error ? <div className="flex items-center gap-3 border-l-4 border-[#23c7be] bg-[#17191d] p-6"><LockKeyhole size={20} className="text-[#23c7be]" /><p>Sign in to access your private pitch decks.</p></div>
      : projects.length === 0 ? <div className="flex flex-col items-center py-24 text-center text-white/35"><FileText size={44} /><p className="mt-4 font-bold">NO PITCH DECK YET</p></div>
      : <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => <article key={project.id} className="group overflow-hidden rounded-[4px] border border-white/10 bg-[#17191d] transition hover:border-[#23c7be]/60">
            <div className="relative aspect-[16/8] overflow-hidden bg-[#1d2126]">
              {project.source_custom_background_url && <img src={project.source_custom_background_url} alt="" className="h-full w-full object-cover opacity-75 transition duration-500 group-hover:scale-105" />}
              <div className="absolute inset-0 bg-gradient-to-t from-[#17191d] to-transparent" />
              <div className="absolute bottom-4 left-4 right-4"><span className="rounded-[2px] border border-[#23c7be]/30 bg-[#23c7be]/15 px-2 py-1 text-[9px] font-bold uppercase text-[#8ee9e4]">{project.project_status || 'draft'}</span><h2 className="mt-2 text-xl font-bold">{project.final_title || project.working_title || 'Untitled project'}</h2></div>
            </div>
            <div className="p-4">
              {project.hook_headline && <p className="line-clamp-2 text-sm text-white/45">{project.hook_headline}</p>}
              <div className="mt-4 flex gap-2 border-t border-white/10 pt-4">
                {embedded ? <button type="button" onClick={() => onView?.(project.id)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[3px] bg-white/[0.06] p-2 text-xs font-bold hover:bg-white/[0.1]"><Play size={13} /> VIEW</button> : <Link to={`/PitchDeckDetail?id=${encodeURIComponent(project.id)}`} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[3px] bg-white/[0.06] p-2 text-xs font-bold hover:bg-white/[0.1]"><Play size={13} /> VIEW</Link>}
                {embedded ? <button type="button" onClick={() => onEdit?.(project.id)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[3px] bg-[#23c7be] p-2 text-xs font-bold text-[#071211] hover:bg-[#35d8cf]"><Pencil size={13} /> EDIT</button> : <Link to={`/PitchDeckEditor?id=${encodeURIComponent(project.id)}`} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[3px] bg-[#23c7be] p-2 text-xs font-bold text-[#071211] hover:bg-[#35d8cf]"><Pencil size={13} /> EDIT</Link>}
              </div>
            </div>
          </article>)}
        </div>}
    </main>
  </div>;
}
