import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Edit3, Film, Layers, Loader2, Plus, Send } from 'lucide-react';
import { toast } from 'sonner';
import MemberDossierEditor from '@/components/MemberDossierEditor';
import MemberDossierPages from '@/components/MemberDossierPages';

export default function DesktopDossierPublishing({ userEmail, dossiers = [] }) {
  const qc = useQueryClient();
  const [publishingId, setPublishingId] = useState(null);
  const [accessByStory, setAccessByStory] = useState({});
  const [editingDossier, setEditingDossier] = useState(undefined);
  const [managingDossier, setManagingDossier] = useState(null);

  const { data: stories = [], isLoading: storiesLoading } = useQuery({
    queryKey: ['userTimelineStories', userEmail],
    queryFn: () => base44.entities.TimelineStory.filter({ user_email: userEmail }),
    enabled: !!userEmail,
  });

  const { data: directDossiers = [], isLoading: dossiersLoading } = useQuery({
    queryKey: ['desktopMemberDirectDossiers', userEmail],
    queryFn: () => base44.entities.Dossier.filter({ submitted_by_email: userEmail }),
    enabled: !!userEmail,
  });

  const allDossiers = useMemo(() => {
    const map = new Map();
    for (const dossier of [...dossiers, ...directDossiers]) {
      if (dossier?.id) map.set(String(dossier.id), dossier);
    }
    return [...map.values()];
  }, [dossiers, directDossiers]);

  const publishableStories = stories.filter(story => story.blocks?.some(block => block.media_url));

  const dossierByStory = useMemo(() => {
    const map = new Map();
    for (const dossier of allDossiers) {
      if (dossier.production_id) map.set(String(dossier.production_id), dossier);
    }
    for (const story of publishableStories) {
      if (story.dossier_id) {
        const match = allDossiers.find(d => String(d.id) === String(story.dossier_id));
        if (match) map.set(String(story.id), match);
      }
    }
    return map;
  }, [allDossiers, publishableStories]);

  const storyDossierIds = new Set(
    publishableStories.flatMap(story => {
      const linked = dossierByStory.get(String(story.id));
      return linked?.id ? [String(linked.id)] : [];
    })
  );

  const standaloneDossiers = allDossiers.filter(dossier => !storyDossierIds.has(String(dossier.id)));

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
      qc.invalidateQueries({ queryKey: ['desktopMemberDirectDossiers', userEmail] });
      qc.invalidateQueries({ queryKey: ['memberDossiers'] });
    } catch (error) {
      toast.error(error?.message || 'Unable to publish dossier.');
    } finally {
      setPublishingId(null);
    }
  };

  const isLoading = storiesLoading || dossiersLoading;

  return (
    <section className="mt-6 border-t border-white/15 pt-5">
      <div className="mb-4 flex items-end justify-between gap-5">
        <div>
          <h2 className="text-lg font-bold text-white">Dossiers</h2>
          <p className="mt-1 text-sm text-white/45">Create, edit and manage dossier pages.</p>
        </div>
        <button
          type="button"
          onClick={() => setEditingDossier(null)}
          className="flex items-center gap-2 border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white hover:border-white/50"
        >
          <Plus size={13} /> Create new
        </button>
      </div>

      {isLoading ? (
        <div className="flex h-20 items-center justify-center border border-white/10 bg-neutral-950">
          <Loader2 size={20} className="animate-spin text-white/60" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
          {publishableStories.map(story => {
            const isPublished = Boolean(story.is_published);
            const audience = accessByStory[story.id] || 'public';
            const cover = story.poster_image || story.blocks?.find(block => block.media_url)?.media_url;
            const scenes = story.blocks?.filter(block => block.media_url).length || 0;
            const linkedDossier = dossierByStory.get(String(story.id));

            return (
              <div key={`story-${story.id}`} className="grid min-w-0 grid-cols-[110px_minmax(0,1fr)] overflow-hidden border border-white/10 bg-neutral-950">
                <div className="relative min-h-[138px] bg-neutral-900">
                  {cover ? <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Film size={28} className="text-white/25" /></div>}
                  {isPublished && <div className="absolute left-2 top-2 flex items-center gap-1 bg-black/85 px-2 py-1 text-[10px] font-bold uppercase text-white"><CheckCircle2 size={11} /> Published</div>}
                </div>

                <div className="min-w-0 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-white">{story.production_name || story.episode_title || 'Untitled project'}</p>
                      <p className="mt-1 text-xs text-white/45">{scenes} scene{scenes === 1 ? '' : 's'} · Timeline / FotoPlay</p>
                    </div>
                    {linkedDossier ? (
                      <div className="flex shrink-0 gap-2">
                        <button onClick={() => setManagingDossier(linkedDossier)} className="flex items-center gap-1.5 border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:border-white/50"><Layers size={12} /> Pages</button>
                        <button onClick={() => setEditingDossier(linkedDossier)} className="flex items-center gap-1.5 border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:border-white/50"><Edit3 size={12} /> Edit</button>
                      </div>
                    ) : (
                      <Link to={`/MyProjects?project=${story.id}`} className="flex shrink-0 items-center gap-1.5 border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:border-white/50"><Edit3 size={12} /> Edit production</Link>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button onClick={() => setAccessByStory(prev => ({ ...prev, [story.id]: 'public' }))} className={`px-3 py-1.5 text-xs font-semibold border ${audience === 'public' ? 'border-white bg-white text-black' : 'border-white/15 text-white/65'}`}>Public</button>
                    <button onClick={() => setAccessByStory(prev => ({ ...prev, [story.id]: 'subscribers' }))} className={`px-3 py-1.5 text-xs font-semibold border ${audience === 'subscribers' ? 'border-red-600 bg-red-600 text-white' : 'border-white/15 text-white/65'}`}>Subscribers only</button>
                  </div>

                  <button onClick={() => publish(story)} disabled={publishingId === story.id} className="mt-3 flex w-full items-center justify-center gap-2 bg-white px-4 py-2 text-sm font-bold text-black disabled:opacity-50">
                    {publishingId === story.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {isPublished ? 'Republish dossier' : 'Publish dossier'}
                  </button>
                </div>
              </div>
            );
          })}

          {standaloneDossiers.map(dossier => (
            <div key={`dossier-${dossier.id}`} className="grid min-w-0 grid-cols-[110px_minmax(0,1fr)] overflow-hidden border border-white/10 bg-neutral-950">
              <div className="relative min-h-[138px] bg-neutral-900">
                {dossier.cover_image ? <img src={dossier.cover_image} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Film size={28} className="text-white/25" /></div>}
                <div className="absolute left-2 top-2 flex items-center gap-1 bg-black/85 px-2 py-1 text-[10px] font-bold uppercase text-white">{dossier.status === 'published' ? <><CheckCircle2 size={11} /> Published</> : dossier.status || 'Draft'}</div>
              </div>

              <div className="min-w-0 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-white">{dossier.title || 'Untitled dossier'}</p>
                    <p className="mt-1 text-xs text-white/45">Direct dossier{dossier.category ? ` · ${dossier.category}` : ''}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => setManagingDossier(dossier)} className="flex items-center gap-1.5 border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:border-white/50"><Layers size={12} /> Pages</button>
                    <button onClick={() => setEditingDossier(dossier)} className="flex items-center gap-1.5 border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:border-white/50"><Edit3 size={12} /> Edit</button>
                  </div>
                </div>

                <div className="mt-3 flex gap-2 text-xs text-white/55">
                  <span className="border border-white/10 px-2 py-1">{dossier.access_level === 'subscribers' ? 'Subscribers only' : 'Public'}</span>
                  {dossier.content_rating && <span className="border border-white/10 px-2 py-1">{dossier.content_rating === 'all' ? 'ALL' : dossier.content_rating}</span>}
                  {(dossier.default_language || dossier.original_language) && <span className="border border-white/10 px-2 py-1 uppercase">{dossier.default_language || dossier.original_language}</span>}
                </div>
              </div>
            </div>
          ))}

          {publishableStories.length === 0 && standaloneDossiers.length === 0 && (
            <div className="col-span-full flex items-center justify-between border border-white/10 bg-neutral-950 px-4 py-3">
              <p className="text-sm text-white/50">No dossier yet.</p>
              <button onClick={() => setEditingDossier(null)} className="bg-white px-4 py-2 text-sm font-semibold text-black">Create new</button>
            </div>
          )}
        </div>
      )}

      {editingDossier !== undefined && (
        <MemberDossierEditor
          dossier={editingDossier}
          userEmail={userEmail}
          onClose={() => setEditingDossier(undefined)}
          onSaved={(saved) => {
            qc.invalidateQueries({ queryKey: ['desktopMemberDirectDossiers', userEmail] });
            qc.invalidateQueries({ queryKey: ['desktopMemberDossiers', userEmail] });
            qc.invalidateQueries({ queryKey: ['memberDossiers'] });
            if (saved?.id) setManagingDossier(saved);
          }}
        />
      )}

      {managingDossier && <MemberDossierPages dossier={managingDossier} onClose={() => setManagingDossier(null)} />}
    </section>
  );
}
