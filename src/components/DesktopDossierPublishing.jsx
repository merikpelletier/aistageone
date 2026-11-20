import React, { useMemo, useState } from 'react';
import { useStudioTranslation } from '@/lib/useStudioTranslation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44, supabase } from '@/api/base44Client';
import { CheckCircle2, Edit3, Film, Layers, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import MemberDossierEditor from '@/components/MemberDossierEditor';
import MemberDossierPages from '@/components/MemberDossierPages';

export default function DesktopDossierPublishing({ userEmail, dossiers = [] }) {
  const t = useStudioTranslation();
  const qc = useQueryClient();
  const [deletingDossierId, setDeletingDossierId] = useState(null);
  const [editingDossier, setEditingDossier] = useState(undefined);
  const [managingDossier, setManagingDossier] = useState(null);

  // Only genuine dossier records, regardless of status or their source.
  const { data: memberDossiers = [], isLoading } = useQuery({
    queryKey: ['desktopMemberDirectDossiers', userEmail],
    enabled: !!userEmail,
    queryFn: async () => {
      const [submitted, creator, user] = await Promise.all([
        base44.entities.Dossier.filter({ submitted_by_email: userEmail }),
        base44.entities.Dossier.filter({ created_by: userEmail }),
        base44.auth.me(),
      ]);
      const byId = user?.id ? await base44.entities.Dossier.filter({ created_by_id: user.id }) : [];
      return [...submitted, ...creator, ...byId];
    },
  });

  const allDossiers = useMemo(() => {
    const byId = new Map();
    for (const dossier of [...dossiers, ...memberDossiers]) {
      if (dossier?.id) byId.set(String(dossier.id), dossier);
    }
    return [...byId.values()].sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
  }, [dossiers, memberDossiers]);

  const deleteDossier = async (dossier) => {
    const confirmed = window.confirm(`${t('Delete','Delete')} "${dossier.title || t('this dossier','this dossier')}" ${t('and all of its pages? This cannot be undone.','and all of its pages? This cannot be undone.')}`);
    if (!confirmed) return;
    setDeletingDossierId(dossier.id);
    try {
      // Deleting the parent must succeed before deleting its pages.
      // Protected economic records prevent deletion through database constraints.
      const { data: deleted, error } = await supabase.from('dossier').delete().eq('id', dossier.id).select('id');
      if (error) throw error;
      if (!deleted?.some(row => String(row.id) === String(dossier.id))) {
        throw new Error(t('Unable to delete dossier.','Unable to delete dossier.'));
      }

      // Preserve FotoPlay/Timeline source projects: only remove publication links.
      const [stories, projects] = await Promise.all([
        base44.entities.TimelineStory.filter({ dossier_id: dossier.id }),
        base44.entities.AuthorStoryProject.filter({ published_dossier_id: dossier.id }),
      ]);
      await Promise.all([
        ...stories.map(story => base44.entities.TimelineStory.update(story.id, { dossier_id: null, is_published: false })),
        ...projects.map(project => base44.entities.AuthorStoryProject.update(project.id, { published_dossier_id: null })),
      ]);
      const pages = await base44.entities.DossierPage.filter({ dossier_id: dossier.id });
      for (const page of pages) await base44.entities.DossierPage.delete(page.id);

      if (managingDossier?.id === dossier.id) setManagingDossier(null);
      if (editingDossier?.id === dossier.id) setEditingDossier(undefined);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['desktopMemberDirectDossiers', userEmail] }),
        qc.invalidateQueries({ queryKey: ['desktopMemberDossiers', userEmail] }),
        qc.invalidateQueries({ queryKey: ['memberDossiers'] }),
        qc.invalidateQueries({ queryKey: ['userTimelineStories', userEmail] }),
      ]);
      toast.success(t('Dossier deleted.','Dossier deleted.'));
    } catch (error) {
      console.error('Dossier delete failed', error);
      toast.error(error?.message || t('Unable to delete dossier.','Unable to delete dossier.'));
      qc.invalidateQueries({ queryKey: ['desktopMemberDirectDossiers', userEmail] });
    } finally {
      setDeletingDossierId(null);
    }
  };

  return (
    <section className="pt-3">
      {managingDossier ? (
        <MemberDossierPages dossier={managingDossier} userEmail={userEmail} onClose={() => setManagingDossier(null)} />
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
        <div className="flex h-20 items-center justify-center border border-white/10 bg-neutral-950"><Loader2 size={20} className="animate-spin text-white/60" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {allDossiers.map(dossier => (
            <div key={dossier.id} className="flex min-w-0 flex-col border border-white/10 bg-neutral-950">
              <div className="flex min-w-0 gap-3 p-3">
                <div className="relative h-[136px] w-[88px] shrink-0 overflow-hidden bg-neutral-900">
                  {dossier.cover_image ? <img src={dossier.cover_image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Film size={24} className="text-white/25" /></div>}
                  <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-1 bg-black/85 px-1 py-1 text-[9px] font-bold uppercase text-white">
                    {dossier.status === 'published' ? <><CheckCircle2 size={10} />{t('Published','Published')}</> : t(dossier.status || 'Draft', dossier.status || 'Draft')}
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="min-w-0">
                    <p className="line-clamp-2 break-words text-sm font-semibold leading-snug text-white">{dossier.title || t('Untitled dossier','Untitled dossier')}</p>
                    <p className="mt-1 text-[11px] leading-snug text-white/45">{dossier.category ? dossier.category : t('Dossiers','Dossiers')}</p>
                  </div>
                  <div className="mt-auto flex flex-wrap gap-1 text-[10px] text-white/65">
                    <span className="border border-white/10 px-1.5 py-1">{dossier.access_level === 'subscribers' ? t('Subscribers only','Subscribers only') : t('Public','Public')}</span>
                    {dossier.content_rating && <span className="border border-white/10 px-1.5 py-1">{dossier.content_rating === 'all' ? 'ALL' : dossier.content_rating}</span>}
                    {(dossier.default_language || dossier.original_language) && <span className="border border-white/10 px-1.5 py-1 uppercase">{dossier.default_language || dossier.original_language}</span>}
                  </div>
                </div>
              </div>
              <div className="mt-auto flex min-w-0 flex-wrap items-center gap-1.5 border-t border-white/10 px-3 py-2">
                <button onClick={() => setManagingDossier(dossier)} className="inline-flex min-h-8 items-center gap-1 border border-white/20 px-2 py-1 text-[11px] font-semibold text-white hover:border-white/50"><Layers size={12} /> {t('Pages','Pages')}</button>
                <button onClick={() => setEditingDossier(dossier)} className="inline-flex min-h-8 items-center gap-1 border border-white/20 px-2 py-1 text-[11px] font-semibold text-white hover:border-white/50"><Edit3 size={12} /> {t('Edit','Edit')}</button>
                <button onClick={() => deleteDossier(dossier)} disabled={deletingDossierId === dossier.id} className="inline-flex min-h-8 items-center gap-1 border border-red-500/40 px-2 py-1 text-[11px] font-semibold text-red-400 hover:border-red-400 hover:text-red-300 disabled:opacity-50">
                  {deletingDossierId === dossier.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} {t('Delete','Delete')}
                </button>
              </div>
            </div>
          ))}
          {allDossiers.length === 0 && (
            <div className="col-span-full flex items-center justify-between border border-white/10 bg-neutral-950 px-4 py-3">
              <p className="text-sm text-white/50">{t('No dossier yet.','No dossier yet.')}</p>
              <button onClick={() => setEditingDossier(null)} className="bg-white px-4 py-2 text-sm font-semibold text-black">{t('Create new','Create new')}</button>
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
