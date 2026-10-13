import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, Upload, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const PAGE_TYPES = [
  ['cover', 'Cover'], ['index', 'Visual Index'], ['contest', 'Contest / Open Call'], ['credits', 'Credits'],
  ['text', 'Text only'], ['image', 'Image only'], ['video', 'Video only'], ['mixed', 'Text + Image/Video'],
  ['block_player', 'Block Player'],
];

export default function MemberDossierPages({ dossier, onClose }) {
  const qc = useQueryClient();
  const [editingPage, setEditingPage] = useState(null);
  const [uploading, setUploading] = useState('');

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ['memberDossierPages', dossier.id],
    queryFn: () => base44.entities.DossierPage.filter({ dossier_id: dossier.id }),
    enabled: !!dossier?.id,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['memberDossierPages', dossier.id] });

  const saveMutation = useMutation({
    mutationFn: async (page) => {
      const { id, created_date, updated_date, created_by, ...rest } = page;
      const payload = { ...rest, dossier_id: dossier.id, order: Number(rest.order) || 1 };
      if (id) return base44.entities.DossierPage.update(id, payload);
      return base44.entities.DossierPage.create(payload);
    },
    onSuccess: () => {
      refresh();
      setEditingPage(null);
      toast.success('Page saved.');
    },
    onError: (e) => {
      console.error('DossierPage save failed', e);
      toast.error(e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Unable to save page.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.DossierPage.delete(id),
    onSuccess: refresh,
    onError: (e) => toast.error(e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Unable to delete page.'),
  });

  const upload = async (file, field) => {
    if (!file) return;
    setUploading(field);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setEditingPage(prev => ({ ...prev, [field]: file_url }));
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Upload failed.');
    } finally {
      setUploading('');
    }
  };

  const sorted = [...pages].sort((a, b) => (a.order || 0) - (b.order || 0));
  const newPage = () => setEditingPage({
    page_type: 'text',
    order: sorted.length + 1,
    title: '',
    content: '',
    text_position: 'center',
    text_color: 'white',
    is_hidden_from_public: false,
    hide_title: false,
  });

  const update = (key, value) => setEditingPage(prev => ({ ...prev, [key]: value }));

  return (
    <div className="fixed inset-0 z-40 flex h-[100dvh] flex-col overflow-hidden bg-black text-white">
      <div className="z-30 flex h-14 flex-none items-center justify-between border-b border-white/10 bg-black px-4 lg:px-5">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Manage dossier</p>
          <h2 className="truncate text-base font-light lg:text-lg">{dossier.title}</h2>
        </div>
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center border border-white/15" aria-label="Close dossier manager"><X size={18} /></button>
      </div>

      <div className="mx-auto grid min-h-0 w-full max-w-[1500px] flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden p-3 lg:grid-cols-[340px_minmax(0,1fr)] lg:grid-rows-1 lg:gap-5 lg:p-5">
        <aside className="flex max-h-[28vh] min-h-0 flex-col overflow-hidden border border-white/10 bg-neutral-950 lg:max-h-none">
          <div className="flex flex-none items-center justify-between border-b border-white/10 p-3 lg:p-4">
            <div><p className="font-semibold">Pages</p><p className="text-xs text-white/40">{sorted.length} page{sorted.length === 1 ? '' : 's'}</p></div>
            <Button onClick={newPage} className="h-9 bg-white px-3 text-black hover:bg-white/90"><Plus size={14} className="mr-1" /> Add</Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
            ) : sorted.length === 0 ? (
              <p className="p-3 text-sm text-white/40">No pages yet.</p>
            ) : sorted.map(page => (
              <div key={page.id} className="mb-2 flex items-center gap-2 border border-white/10 bg-black p-2">
                <div className="w-6 text-center text-xs text-white/35">{page.order}</div>
                {page.media_url ? <img src={page.media_url} alt="" className="h-11 w-9 object-cover" /> : <div className="h-11 w-9 bg-neutral-900" />}
                <button onClick={() => setEditingPage({ ...page })} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm">{page.title || page.page_type}</p>
                  <p className="text-[10px] uppercase tracking-wider text-white/35">{page.page_type}</p>
                </button>
                <button onClick={() => { if (window.confirm('Delete this page?')) deleteMutation.mutate(page.id); }} className="p-2 text-white/45 hover:text-red-400" aria-label="Delete page"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </aside>

        <main className="min-h-0 min-w-0 overflow-y-auto overscroll-contain">
          {!editingPage ? (
            <div className="flex min-h-[260px] items-center justify-center border border-dashed border-white/10 bg-neutral-950 text-center lg:min-h-[360px]">
              <div><p className="text-base font-light lg:text-lg">Select a page</p><p className="mt-1 text-sm text-white/40">or add a new one.</p><Button onClick={newPage} className="mt-4 bg-white text-black hover:bg-white/90"><Plus size={14} className="mr-2" />Add page</Button></div>
            </div>
          ) : (
            <div className="border border-white/10 bg-neutral-950">
              <div className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-white/10 bg-neutral-950 px-3 py-3 lg:px-5 lg:py-4">
                <h3 className="truncate text-base font-light lg:text-lg">{editingPage.id ? 'Edit page' : 'New page'}</h3>
                <div className="flex flex-none gap-2">
                  <Button variant="ghost" onClick={() => setEditingPage(null)} className="h-9 px-3 text-white">Cancel</Button>
                  <Button type="button" onClick={() => saveMutation.mutate(editingPage)} disabled={saveMutation.isPending || !!uploading} className="h-9 bg-white px-3 text-black hover:bg-white/90">
                    {saveMutation.isPending && <Loader2 size={14} className="mr-2 animate-spin" />}Save
                  </Button>
                </div>
              </div>

              <div className="space-y-4 p-3 pb-8 lg:space-y-5 lg:p-5 lg:pb-10">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <select value={editingPage.page_type || 'text'} onChange={e => update('page_type', e.target.value)} className="h-10 w-full border border-white/10 bg-neutral-900 px-3 text-sm text-white outline-none">
                    {PAGE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <Input value={editingPage.title || ''} onChange={e => update('title', e.target.value)} placeholder="Page title" className="bg-neutral-900 border-white/10 text-white" />
                  <Input type="number" value={editingPage.order ?? 1} onChange={e => update('order', Number(e.target.value))} placeholder="Order" className="bg-neutral-900 border-white/10 text-white" />
                </div>

                <div className="flex flex-col gap-3 border border-white/10 bg-black/30 p-3 text-sm sm:flex-row sm:gap-6">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={!!editingPage.is_hidden_from_public} onChange={e => update('is_hidden_from_public', e.target.checked)} /> Hidden from public</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={!!editingPage.hide_title} onChange={e => update('hide_title', e.target.checked)} /> Hide page title</label>
                </div>

                {editingPage.page_type === 'contest' && (
                  <div className="grid grid-cols-1 gap-3 border border-white/10 bg-black/30 p-3 sm:grid-cols-2 lg:p-4">
                    <Input value={editingPage.contest_category || ''} onChange={e => update('contest_category', e.target.value)} placeholder="Contest category" className="bg-neutral-900 border-white/10 text-white" />
                    <Input type="datetime-local" value={editingPage.contest_deadline ? String(editingPage.contest_deadline).slice(0,16) : ''} onChange={e => update('contest_deadline', e.target.value ? new Date(e.target.value).toISOString() : null)} className="bg-neutral-900 border-white/10 text-white" />
                    <Textarea value={editingPage.contest_reward || ''} onChange={e => update('contest_reward', e.target.value)} placeholder="Opportunity / prize" rows={2} className="bg-neutral-900 border-white/10 text-white sm:col-span-2" />
                    <Textarea value={editingPage.contest_rules || ''} onChange={e => update('contest_rules', e.target.value)} placeholder="Rules / eligibility" rows={3} className="bg-neutral-900 border-white/10 text-white sm:col-span-2" />
                  </div>
                )}

                {editingPage.page_type === 'credits' ? (
                  <div className="border border-white/10 bg-black/30 p-3 lg:p-4">
                    <p className="mb-3 text-sm text-white/60">Credits page content</p>
                    <Textarea value={editingPage.content || ''} onChange={e => update('content', e.target.value)} placeholder="Credits text or notes" rows={7} className="bg-neutral-900 border-white/10 text-white" />
                  </div>
                ) : (
                  <Textarea value={editingPage.content || ''} onChange={e => update('content', e.target.value)} placeholder="Page text content" rows={6} className="bg-neutral-900 border-white/10 text-white" />
                )}

                <div className="grid grid-cols-1 gap-4 border-t border-white/10 pt-4 sm:grid-cols-2 lg:pt-5">
                  <div className="space-y-2">
                    <p className="text-sm text-white/65">Portrait media</p>
                    {editingPage.media_url && <img src={editingPage.media_url} alt="" className="h-40 w-full border border-white/10 object-cover" />}
                    <input id="member-page-portrait" type="file" accept="image/*,video/*" className="hidden" onChange={e => upload(e.target.files?.[0], 'media_url')} />
                    <label htmlFor="member-page-portrait" className="flex cursor-pointer items-center justify-center gap-2 border border-white/20 px-3 py-2 text-sm"><Upload size={14} />{uploading === 'media_url' ? 'Uploading…' : 'Upload portrait'}</label>
                    <Input value={editingPage.media_url || ''} onChange={e => update('media_url', e.target.value)} placeholder="Or paste media URL" className="bg-neutral-900 border-white/10 text-white" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-white/65">Landscape media</p>
                    {editingPage.media_url_landscape && <img src={editingPage.media_url_landscape} alt="" className="h-40 w-full border border-white/10 object-cover" />}
                    <input id="member-page-landscape" type="file" accept="image/*,video/*" className="hidden" onChange={e => upload(e.target.files?.[0], 'media_url_landscape')} />
                    <label htmlFor="member-page-landscape" className="flex cursor-pointer items-center justify-center gap-2 border border-white/20 px-3 py-2 text-sm"><Upload size={14} />{uploading === 'media_url_landscape' ? 'Uploading…' : 'Upload landscape'}</label>
                    <Input value={editingPage.media_url_landscape || ''} onChange={e => update('media_url_landscape', e.target.value)} placeholder="Or paste media URL" className="bg-neutral-900 border-white/10 text-white" />
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4 lg:pt-5">
                  <p className="mb-2 text-sm text-white/65">Audio</p>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input value={editingPage.audio_url || ''} onChange={e => update('audio_url', e.target.value)} placeholder="Audio URL" className="bg-neutral-900 border-white/10 text-white" />
                    <input id="member-page-audio" type="file" accept="audio/*" className="hidden" onChange={e => upload(e.target.files?.[0], 'audio_url')} />
                    <label htmlFor="member-page-audio" className="flex cursor-pointer items-center justify-center gap-2 border border-white/20 px-4 py-2 text-sm"><Upload size={14} />{uploading === 'audio_url' ? 'Uploading…' : 'Upload audio'}</label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
