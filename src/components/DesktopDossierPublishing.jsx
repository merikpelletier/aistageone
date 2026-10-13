import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Edit3, Film, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

export default function DesktopDossierPublishing({ userEmail }) {
  const qc = useQueryClient();
  const [publishingId, setPublishingId] = useState(null);
  const [accessByStory, setAccessByStory] = useState({});

  const { data: stories = [], isLoading } = useQuery({
    queryKey: ['userTimelineStories', userEmail],
    queryFn: () => base44.entities.TimelineStory.filter({ user_email: userEmail }),
    enabled: !!userEmail,
  });

  const publishableStories = stories.filter(story => story.blocks?.some(block => block.media_url));

  const publish = async (story) => {
    setPublishingId(story.id);
    try {
      const res = await base44.functions.invoke('publishEpisode', {
        production_id: story.id,
        kit_page_id: story.kit_page_id,
        dossier_id: story.dossier_id,
        access_level: accessByStory[story.id] || 'public',
      });
      if (res.data?.error) {
        toast.error(res.data.error);
        return;
      }
      toast.success(story.is_published ? 'Dossier updated.' : 'Dossier published.');
      qc.invalidateQueries({ queryKey: ['userTimelineStories', userEmail] });
      qc.invalidateQueries({ queryKey: ['desktopMemberDossiers', userEmail] });
      qc.invalidateQueries({ queryKey: ['memberDossiers'] });
    } catch (error) {
      toast.error(error?.message || 'Unable to publish dossier.');
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <section className="mt-6 border-t border-white/15 pt-5">
      <div className="mb-4 flex items-end justify-between gap-5">
        <div>
          <h2 className="text-lg font-bold text-white">Publish a dossier</h2>
          <p className="mt-1 text-sm text-white/45">Publish a finished project, or republish it after editing.</p>
        </div>
        <Link to="/MyProjects" className="border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white hover:border-white/50">
          Manage projects
        </Link>
      </div>

      {isLoading ? (
        <div className="flex h-24 items-center justify-center border border-white/10 bg-neutral-950">
          <Loader2 size={20} className="animate-spin text-white/60" />
        </div>
      ) : publishableStories.length === 0 ? (
        <div className="flex items-center justify-between gap-5 border border-white/10 bg-neutral-950 p-5">
          <div>
            <p className="font-semibold text-white">No project is ready to publish yet.</p>
            <p className="mt-1 text-sm text-white/45">Open My Projects and finish at least one scene before publishing.</p>
          </div>
          <Link to="/MyProjects" className="whitespace-nowrap bg-white px-4 py-2 text-sm font-semibold text-black">Open My Projects</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
          {publishableStories.map(story => {
            const isPublished = Boolean(story.is_published);
            const audience = accessByStory[story.id] || 'public';
            const cover = story.poster_image || story.blocks?.find(block => block.media_url)?.media_url;
            const scenes = story.blocks?.filter(block => block.media_url).length || 0;

            return (
              <div key={story.id} className="grid min-w-0 grid-cols-[120px_minmax(0,1fr)] overflow-hidden border border-white/10 bg-neutral-950">
                <div className="relative min-h-[150px] bg-neutral-900">
                  {cover ? <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Film size={28} className="text-white/25" /></div>}
                  {isPublished && (
                    <div className="absolute left-2 top-2 flex items-center gap-1 bg-black/85 px-2 py-1 text-[10px] font-bold uppercase text-white">
                      <CheckCircle2 size={11} /> Published
                    </div>
                  )}
                </div>

                <div className="min-w-0 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-white">{story.production_name || story.episode_title || 'Untitled project'}</p>
                      <p className="mt-1 text-xs text-white/45">{scenes} scene{scenes === 1 ? '' : 's'}</p>
                    </div>
                    <Link to={`/MyProjects?project=${story.id}`} className="flex shrink-0 items-center gap-1.5 border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:border-white/50">
                      <Edit3 size={12} /> Edit
                    </Link>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <button onClick={() => setAccessByStory(prev => ({ ...prev, [story.id]: 'public' }))} className={`px-3 py-1.5 text-xs font-semibold border ${audience === 'public' ? 'border-white bg-white text-black' : 'border-white/15 text-white/65'}`}>Public</button>
                    <button onClick={() => setAccessByStory(prev => ({ ...prev, [story.id]: 'subscribers' }))} className={`px-3 py-1.5 text-xs font-semibold border ${audience === 'subscribers' ? 'border-red-600 bg-red-600 text-white' : 'border-white/15 text-white/65'}`}>Subscribers only</button>
                  </div>

                  <button onClick={() => publish(story)} disabled={publishingId === story.id} className="mt-4 flex w-full items-center justify-center gap-2 bg-white px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50">
                    {publishingId === story.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {isPublished ? 'Republish dossier' : 'Publish dossier'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
