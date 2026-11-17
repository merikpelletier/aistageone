import React, { useMemo, useState } from 'react';
import { useStudioTranslation } from '@/lib/useStudioTranslation';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Edit3, Film, Layers, Loader2, Plus, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import MemberDossierEditor from '@/components/MemberDossierEditor';
import MemberDossierPages from '@/components/MemberDossierPages';

export default function DesktopDossierPublishing({ userEmail, dossiers = [] }) {
  const t = useStudioTranslation();
  const qc = useQueryClient();
  const [publishingId, setPublishingId] = useState(null);
  const [deletingDossierId, setDeletingDossierId] = useState(null);
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
      toast.success(story.is_published ? t('Dossier updated.','Dossier updated.') : t('Dossier published.','Dossier published.'));
      qc.invalidateQueries({ queryKey: ['userTimelineStories', userEmail] });
      qc.invalidateQueries({ queryKey: ['desktopMemberDossiers', userEmail] });
      qc.invalidateQueries({ queryKey: ['desktopMemberDirectDossiers', userEmail] });
      qc.invalidateQueries({ queryKey: ['memberDossiers'] });
    } catch (error) {
      toast.error(error?.message || t('Unable to publish dossier.','Unable to publish dossier.'));
    } finally {
      setPublishingId(null);
    }
  };

  const deleteDirectDossier = async (dossier) => {
    const confirmed = window.confirm(`${t("Delete","Delete")} "${dossier.title || t("this dossier","this dossier")}" ${t("and all of its pages? This cannot be undone.","and all of its pages? This cannot be undone.")}`);
    if (!confirmed) return;

    setDeletingDossierId(dossier.id);
    try {
      const pages = await base44.entities.DossierPage.filter({ dossier_id: dossier.id });
      for (const page of pages || []) {
        await base44.entities.DossierPage.delete(page.id);
      }
      await base44.entities.Dossier.delete(dossier.id);

      if (managingDossier?.id === dossier.id) setManagingDossier(null);
      if (editingDossier?.id === dossier.id) setEditingDossier(undefined);

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['desktopMemberDirectDossiers', userEmail] }),
        qc.invalidateQueries({ queryKey: ['desktopMemberDossiers', userEmail] }),
        qc.invalidateQueries({ queryKey: ['memberDossiers'] }),
      ]);
      toast.success(t('Dossier deleted.','Dossier deleted.'));
    } catch (error) {
      console.error('Dossier delete failed', error);
      toast.error(error?.response?.data?.message || error?.response?.data?.error || error?.message || t('Unable to delete dossier.','Unable to delete dossier.'));
    } finally {
      setDeletingDossierId(null);
    }
  };

  const isLoading = storiesLoading || dossiersLoading;

  return (
    <section className="pt-3">
      {managingDossier ? (
        <MemberDossierPages dossier={managingDossier} onClose={() => setManagingDossier(null)} />
      ) : editingDossier === undefined ? (
        <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">{t("Dossiers", "Dossiers")}</h2>
          <p className="mt-0.5 text-xs text-white/45">{t("Create, edit and manage dossier pages.", "Create, edit and manage dossier pages.")}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditingDossier(null)}
          className="flex h-9 items-center gap-2 border border-white/20 px-3 text-xs font-bold uppercase tracking-wide text-white hover:border-white/50"
        >
          <Plus size={13} /> {t("Create new", "Create new")}
        </button>
      </div>

      {isLoading ? (
        <div className="flex h-20 items-center justify-center border border-white/10 bg-neutral-950">
          <Loader2 size={20} className="animate-spin text-white/60" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {publishableStories.map(story => {
            const isPublished = Boolean(story.is_published);
            const audience = accessByStory[story.id] || 'public';
            const cover = story.poster_image || story.blocks?.find(block => block.media_url)?.media_url;
            const scenes = story.blocks?.filter(block => block.media_url).length || 0;
            const linkedDossier = dossierByStory.get(String(story.id));

            return (
              <div key={`story-${story.id}`} className="flex min-w-0 flex-col border border-white/10 bg-neutral-950">
                <div className="flex min-w-0 gap-3 p-3">
                  <div className="relative h-[136px] w-[88px] shrink-0 overflow-hidden bg-neutral-900">
                    {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Film size={24} className="text-white/25" /></div>}
                    {isPublished && <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-1 bg-black/85 px-1 py-1 text-[9px] font-bold uppercase text-white"><CheckCircle2 size={10} /> {t("Published","Published")}</div>}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="min-w-0">
                      <p className="line-clamp-2 break-words text-sm font-semibold leading-snug text-white">{story.production_name || story.episode_title || t('Untitled project','Untitled project')}</p>
                      <p className="mt-1 text-[11px] leading-snug text-white/45">{scenes} {scenes === 1 ? t('scene','scene') : t('scenes','scenes')} · Timeline / FotoPlay</p>
                    </div>
                    <div className="mt-auto flex flex-wrap gap-1">
                      <button onClick={() => setAccessByStory(prev => ({ ...prev, [story.id]: 'public' }))} className={`border px-2 py-1 text-[11px] font-semibold ${audience === 'public' ? 'border-white bg-white text-black' : 'border-white/15 text-white/65'}`}>{t("Public", "Public")}</button>
                      <button onClick={() => setAccessByStory(prev => ({ ...prev, [story.id]: 'subscribers' }))} className={`border px-2 py-1 text-[11px] font-semibold ${audience === 'subscribers' ? 'border-red-600 bg-red-600 text-white' : 'border-white/15 text-white/65'}`}>{t("Subscribers only", "Subscribers only")}</button>
                    </div>
                  </div>
                </div>
                <div className="mt-auto flex min-w-0 flex-wrap items-center gap-1.5 border-t border-white/10 px-3 py-2">
                  <button onClick={() => publish(story)} disabled={publishingId === story.id} className="inline-flex min-h-8 min-w-0 items-center justify-center gap-1.5 bg-white px-2 py-1 text-[11px] font-bold text-black disabled:opacity-50">
                    {publishingId === story.id ? <Loader2 size={12} className="shrink-0 animate-spin" /> : <Send size={12} className="shrink-0" />}
                    <span>{isPublished ? t('Republish dossier','Republish dossier') : t('Publish dossier','Publish dossier')}</span>
                  </button>
                  {linkedDossier ? (
                    <>
                      <button onClick={() => setManagingDossier(linkedDossier)} className="inline-flex min-h-8 items-center gap-1 border border-white/20 px-2 py-1 text-[11px] font-semibold text-white hover:border-white/50"><Layers size={12} /> {t("Pages","Pages")}</button>
                      <button onClick={() => setEditingDossier(linkedDossier)} className="inline-flex min-h-8 items-center gap-1 border border-white/20 px-2 py-1 text-[11px] font-semibold text-white hover:border-white/50"><Edit3 size={12} /> {t("Edit","Edit")}</button>
                    </>
                  ) : (
                    <Link to={`/MyProjects?project=${story.id}`} className="inline-flex min-h-8 items-center gap-1 border border-white/20 px-2 py-1 text-[11px] font-semibold text-white hover:border-white/50"><Edit3 size={12} /> {t("Edit production","Edit production")}</Link>
                  )}
                </div>
              </div>
            );
          })}

          {standaloneDossiers.map(dossier => (
            <div key={`dossier-${dossier.id}`} className="flex min-w-0 flex-col border border-white/10 bg-neutral-950">
              <div className="flex min-w-0 gap-3 p-3">
                <div className="relative h-[136px] w-[88px] shrink-0 overflow-hidden bg-neutral-900">
                  {dossier.cover_image ? <img src={dossier.cover_image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Film size={24} className="text-white/25" /></div>}
                  <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-1 bg-black/85 px-1 py-1 text-[9px] font-bold uppercase text-white">{dossier.status === 'published' ? <><CheckCircle2 size={10} /> {t('Published','Published')}</> : t(dossier.status || 'Draft',dossier.status || 'Draft')}</div>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="min-w-0">
                    <p className="line-clamp-2 break-words text-sm font-semibold leading-snug text-white">{dossier.title || t('Untitled dossier','Untitled dossier')}</p>
                    <p className="mt-1 text-[11px] leading-snug text-white/45">{t('Direct dossier','Direct dossier')}{dossier.category ? ` · ${dossier.category}` : ''}</p>
                  </div>
                  <div className="mt-auto flex flex-wrap gap-1 text-[10px] text-white/65">
                    <span className="border border-white/10 px-1.5 py-1">{dossier.access_level === 'subscribers' ? t('Subscribers only','Subscribers only') : t('Public','Public')}</span>
                    {dossier.content_rating && <span className="border border-white/10 px-1.5 py-1">{dossier.content_rating === 'all' ? 'ALL' : dossier.content_rating}</span>}
                    {(dossier.default_language || dossier.original_language) && <span className="border border-white/10 px-1.5 py-1 uppercase">{dossier.default_language || dossier.original_language}</span>}
                  </div>
                </div>
              </div>
              <div className="mt-auto flex min-w-0 flex-wrap items-center gap-1.5 border-t border-white/10 px-3 py-2">
                <button onClick={() => setManagingDossier(dossier)} className="inline-flex min-h-8 items-center gap-1 border border-white/20 px-2 py-1 text-[11px] font-semibold text-white hover:border-white/50"><Layers size={12} /> {t("Pages","Pages")}</button>
                <button onClick={() => setEditingDossier(dossier)} className="inline-flex min-h-8 items-center gap-1 border border-white/20 px-2 py-1 text-[11px] font-semibold text-white hover:border-white/50"><Edit3 size={12} /> {t("Edit","Edit")}</button>
                <button onClick={() => deleteDirectDossier(dossier)} disabled={deletingDossierId === dossier.id} className="inline-flex min-h-8 items-center gap-1 border border-red-500/40 px-2 py-1 text-[11px] font-semibold text-red-400 hover:border-red-400 hover:text-red-300 disabled:opacity-50">
                  {deletingDossierId === dossier.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} {t("Delete","Delete")}
                </button>
              </div>
            </div>
          ))}

          {publishableStories.length === 0 && standaloneDossiers.length === 0 && (
            <div className="col-span-full flex items-center justify-between border border-white/10 bg-neutral-950 px-4 py-3">
              <p className="text-sm text-white/50">{t("No dossier yet.", "No dossier yet.")}</p>
              <button onClick={() => setEditingDossier(null)} className="bg-white px-4 py-2 text-sm font-semibold text-black">{t("Create new", "Create new")}</button>
            </div>
          )}
        </div>
      )}

        </>
      ) : (
        <MemberDossierEditor
          embedded
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

    </section>
  );
}
