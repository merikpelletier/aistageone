import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit3, Film, Layers, Loader2, Plus, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import MemberDossierEditor from '@/components/MemberDossierEditor';
import MemberDossierPages from '@/components/MemberDossierPages';

export default function MobileDossierPublishing({ userEmail }) {
  const qc = useQueryClient();
  const [editingDossier, setEditingDossier] = useState(undefined);
  const [managingDossier, setManagingDossier] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const { data: dossiers = [], isLoading } = useQuery({
    queryKey: ['mobileMemberDirectDossiers', userEmail],
    queryFn: () => base44.entities.Dossier.filter({ submitted_by_email: userEmail }),
    enabled: !!userEmail,
  });

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['mobileMemberDirectDossiers', userEmail] }),
      qc.invalidateQueries({ queryKey: ['desktopMemberDirectDossiers', userEmail] }),
      qc.invalidateQueries({ queryKey: ['memberDossiers', userEmail] }),
    ]);
  };

  const deleteDossier = async (dossier) => {
    if (!window.confirm(`Delete "${dossier.title || 'this dossier'}" and all of its pages? This cannot be undone.`)) return;
    setDeletingId(dossier.id);
    try {
      const pages = await base44.entities.DossierPage.filter({ dossier_id: dossier.id });
      for (const page of pages || []) await base44.entities.DossierPage.delete(page.id);
      await base44.entities.Dossier.delete(dossier.id);
      await refresh();
      toast.success('Dossier deleted.');
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Unable to delete dossier.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="w-full bg-black px-4 pb-6 pt-3 text-white lg:hidden">
      <div className="mb-3 flex items-center justify-between border-t border-white/15 pt-4">
        <div>
          <h2 className="text-base font-bold">Dossiers</h2>
          <p className="mt-0.5 text-xs text-white/45">Create and manage your published content.</p>
        </div>
        <button
          type="button"
          onClick={() => setEditingDossier(null)}
          className="flex items-center gap-1.5 border border-white/25 px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-white"
        >
          <Plus size={13} /> Create new
        </button>
      </div>

      {isLoading ? (
        <div className="flex h-20 items-center justify-center border border-white/10 bg-neutral-950">
          <Loader2 size={18} className="animate-spin text-white/60" />
        </div>
      ) : dossiers.length === 0 ? (
        <div className="border border-white/10 bg-neutral-950 p-4 text-sm text-white/50">No dossier yet.</div>
      ) : (
        <div className="space-y-3">
          {dossiers.map(dossier => (
            <article key={dossier.id} className="overflow-hidden border border-white/10 bg-neutral-950">
              <div className="flex gap-3 p-3">
                <div className="relative h-24 w-16 flex-none overflow-hidden bg-neutral-900">
                  {dossier.cover_image ? (
                    <img src={dossier.cover_image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center"><Film size={22} className="text-white/25" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{dossier.title || 'Untitled dossier'}</p>
                      <p className="mt-1 text-[11px] uppercase tracking-wider text-white/35">{dossier.status || 'draft'}</p>
                    </div>
                    <span className="border border-white/10 px-2 py-1 text-[10px] text-white/50">{dossier.access_level === 'subscribers' ? 'Subscribers' : 'Public'}</span>
                  </div>
                  {dossier.subtitle && <p className="mt-2 line-clamp-2 text-xs text-white/55">{dossier.subtitle}</p>}
                </div>
              </div>

              <div className="grid grid-cols-3 border-t border-white/10">
                <button onClick={() => setManagingDossier(dossier)} className="flex items-center justify-center gap-1.5 border-r border-white/10 py-3 text-xs font-semibold text-white"><Layers size={13} /> Pages</button>
                <button onClick={() => setEditingDossier(dossier)} className="flex items-center justify-center gap-1.5 border-r border-white/10 py-3 text-xs font-semibold text-white"><Edit3 size={13} /> Edit</button>
                <button onClick={() => deleteDossier(dossier)} disabled={deletingId === dossier.id} className="flex items-center justify-center gap-1.5 py-3 text-xs font-semibold text-red-400 disabled:opacity-50">
                  {deletingId === dossier.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {editingDossier !== undefined && (
        <MemberDossierEditor
          dossier={editingDossier}
          userEmail={userEmail}
          onClose={() => setEditingDossier(undefined)}
          onSaved={async (saved) => {
            await refresh();
            if (saved?.id) setManagingDossier(saved);
          }}
        />
      )}

      {managingDossier && <MemberDossierPages dossier={managingDossier} onClose={() => setManagingDossier(null)} />}
    </section>
  );
}
