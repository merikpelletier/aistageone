import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Loader2, Plus, Trash2, Upload, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SeriesPageEditor from '@/components/admin/SeriesPageEditor';
import { toast } from 'sonner';

const PAGE_TYPES = [
  ['cover', 'Cover'], ['index', 'Visual Index'], ['contest', 'Contest / Open Call'], ['credits', 'Credits'],
  ['text', 'Text only'], ['image', 'Image only'], ['video', 'Video only'], ['mixed', 'Text + Image/Video'],
  ['join_cast', 'Join the Cast'], ['episode', 'Episode'], ['series', 'Series'], ['member_episodes', 'Member Episodes'], ['block_player', 'Block Player'],
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
      const payload = { ...page, dossier_id: dossier.id, order: Number(page.order) || 1 };
      if (page.id) return base44.entities.DossierPage.update(page.id, payload);
      return base44.entities.DossierPage.create(payload);
    },
    onSuccess: () => { refresh(); setEditingPage(null); toast.success('Page saved.'); },
    onError: (e) => toast.error(e?.message || 'Unable to save page.'),
  });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.DossierPage.delete(id),
    onSuccess: refresh,
    onError: (e) => toast.error(e?.message || 'Unable to delete page.'),
  });

  const upload = async (file, field) => {
    if (!file) return;
    setUploading(field);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setEditingPage(prev => ({ ...prev, [field]: file_url }));
    } catch (e) {
      toast.error(e?.message || 'Upload failed.');
    } finally {
      setUploading('');
    }
  };

  const sorted = [...pages].sort((a, b) => (a.order || 0) - (b.order || 0));
  const newPage = () => setEditingPage({ page_type: 'text', order: sorted.length + 1, title: '', content: '', text_position: 'center', text_color: 'white' });

  return (
    <div className="fixed inset-0 z-[110] bg-black text-white overflow-y-auto">
      <div className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-white/10 bg-black px-5">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Manage dossier</p>
          <h2 className="truncate text-lg font-light">{dossier.title}</h2>
        </div>
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center border border-white/15"><X size={18} /></button>
      </div>

      <div className="mx-auto grid max-w-[1500px] grid-cols-[340px_minmax(0,1fr)] gap-5 p-5">
        <aside className="self-start border border-white/10 bg-neutral-950">
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div><p className="font-semibold">Pages</p><p className="text-xs text-white/40">{sorted.length} page{sorted.length === 1 ? '' : 's'}</p></div>
            <Button onClick={newPage} className="bg-white text-black hover:bg-white/90"><Plus size={14} className="mr-1" /> Add</Button>
          </div>
          <div className="max-h-[calc(100vh-150px)] overflow-y-auto p-2">
            {isLoading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div> : sorted.length === 0 ? <p className="p-4 text-sm text-white/40">No pages yet.</p> : sorted.map(page => (
              <div key={page.id} className="mb-2 flex items-center gap-2 border border-white/10 bg-black p-2">
                <div className="w-7 text-center text-xs text-white/35">{page.order}</div>
                {page.media_url ? <img src={page.media_url} alt="" className="h-12 w-10 object-cover" /> : <div className="h-12 w-10 bg-neutral-900" />}
                <button onClick={() => setEditingPage({ ...page })} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm">{page.title || page.episode_title || page.page_type}</p>
                  <p className="text-[10px] uppercase tracking-wider text-white/35">{page.page_type}</p>
                </button>
                <button onClick={() => { if (confirm('Delete this page?')) deleteMutation.mutate(page.id); }} className="p-2 text-white/45 hover:text-red-400"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </aside>

        <main className="min-w-0">
          {!editingPage ? (
            <div className="flex min-h-[360px] items-center justify-center border border-dashed border-white/10 bg-neutral-950 text-center">
              <div><p className="text-lg font-light">Select a page</p><p className="mt-1 text-sm text-white/40">or add a new one.</p><Button onClick={newPage} className="mt-5 bg-white text-black hover:bg-white/90"><Plus size={14} className="mr-2" />Add page</Button></div>
            </div>
          ) : (
            <div className="border border-white/10 bg-neutral-950">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <h3 className="text-lg font-light">{editingPage.id ? 'Edit page' : 'New page'}</h3>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setEditingPage(null)} className="text-white">Cancel</Button>
                  <Button onClick={() => saveMutation.mutate(editingPage)} disabled={saveMutation.isPending || !!uploading} className="bg-white text-black hover:bg-white/90">{saveMutation.isPending && <Loader2 size={14} className="mr-2 animate-spin" />}Save page</Button>
                </div>
              </div>

              <div className="space-y-5 p-5">
                <div className="grid grid-cols-3 gap-3">
                  <Select value={editingPage.page_type || 'text'} onValueChange={value => setEditingPage(p => ({ ...p, page_type: value }))}>
                    <SelectTrigger className="bg-neutral-900 border-white/10 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>{PAGE_TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input value={editingPage.title || ''} onChange={e => setEditingPage(p => ({ ...p, title: e.target.value }))} placeholder="Page title" className="bg-neutral-900 border-white/10 text-white" />
                  <Input type="number" value={editingPage.order ?? 1} onChange={e => setEditingPage(p => ({ ...p, order: Number(e.target.value) }))} placeholder="Order" className="bg-neutral-900 border-white/10 text-white" />
                </div>

                <div className="flex gap-6 border border-white/10 bg-black/30 p-3 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={!!editingPage.is_hidden_from_public} onChange={e => setEditingPage(p => ({ ...p, is_hidden_from_public: e.target.checked }))} /> Hidden from public</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={!!editingPage.hide_title} onChange={e => setEditingPage(p => ({ ...p, hide_title: e.target.checked }))} /> Hide page title</label>
                  {editingPage.page_type === 'episode' && <label className="flex items-center gap-2"><input type="checkbox" checked={!!editingPage.is_locked} onChange={e => setEditingPage(p => ({ ...p, is_locked: e.target.checked }))} /> Lock episode</label>}
                </div>

                {editingPage.page_type === 'series' && <SeriesPageEditor page={editingPage} onChange={setEditingPage} />}

                {editingPage.page_type === 'episode' && (
                  <div className="grid grid-cols-2 gap-3 border border-white/10 bg-black/30 p-4">
                    <Input value={editingPage.episode_title || ''} onChange={e => setEditingPage(p => ({ ...p, episode_title: e.target.value }))} placeholder="Episode title" className="bg-neutral-900 border-white/10 text-white" />
                    <Input value={editingPage.episode_role || ''} onChange={e => setEditingPage(p => ({ ...p, episode_role: e.target.value }))} placeholder="Role / character available" className="bg-neutral-900 border-white/10 text-white" />
                    <Textarea value={editingPage.episode_description || ''} onChange={e => setEditingPage(p => ({ ...p, episode_description: e.target.value }))} placeholder="Episode description / brief" rows={3} className="col-span-2 bg-neutral-900 border-white/10 text-white" />
                    <Input value={editingPage.episode_tools_hint || ''} onChange={e => setEditingPage(p => ({ ...p, episode_tools_hint: e.target.value }))} placeholder="Suggested AI tools" className="col-span-2 bg-neutral-900 border-white/10 text-white" />
                  </div>
                )}

                {editingPage.page_type === 'contest' && (
                  <div className="grid grid-cols-2 gap-3 border border-white/10 bg-black/30 p-4">
                    <Input value={editingPage.contest_category || ''} onChange={e => setEditingPage(p => ({ ...p, contest_category: e.target.value }))} placeholder="Contest category" className="bg-neutral-900 border-white/10 text-white" />
                    <Input type="datetime-local" value={editingPage.contest_deadline ? String(editingPage.contest_deadline).slice(0,16) : ''} onChange={e => setEditingPage(p => ({ ...p, contest_deadline: e.target.value ? new Date(e.target.value).toISOString() : null }))} className="bg-neutral-900 border-white/10 text-white" />
                    <Textarea value={editingPage.contest_reward || ''} onChange={e => setEditingPage(p => ({ ...p, contest_reward: e.target.value }))} placeholder="Opportunity / prize" rows={2} className="col-span-2 bg-neutral-900 border-white/10 text-white" />
                    <Textarea value={editingPage.contest_rules || ''} onChange={e => setEditingPage(p => ({ ...p, contest_rules: e.target.value }))} placeholder="Rules / eligibility" rows={3} className="col-span-2 bg-neutral-900 border-white/10 text-white" />
                  </div>
                )}

                {editingPage.page_type === 'credits' && (
                  <div className="border border-white/10 bg-black/30 p-4">
                    <p className="mb-3 text-sm text-white/60">Credits page content</p>
                    <Textarea value={editingPage.content || ''} onChange={e => setEditingPage(p => ({ ...p, content: e.target.value }))} placeholder="Credits text or notes" rows={8} className="bg-neutral-900 border-white/10 text-white" />
                  </div>
                )}

                {!['series','episode','credits'].includes(editingPage.page_type) && (
                  <Textarea value={editingPage.content || ''} onChange={e => setEditingPage(p => ({ ...p, content: e.target.value }))} placeholder="Page text content" rows={8} className="bg-neutral-900 border-white/10 text-white" />
                )}

                <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-5">
                  <div className="space-y-2">
                    <p className="text-sm text-white/65">Portrait media</p>
                    {editingPage.media_url && <img src={editingPage.media_url} alt="" className="h-40 w-full object-cover border border-white/10" />}
                    <input id="member-page-portrait" type="file" accept="image/*,video/*" className="hidden" onChange={e => upload(e.target.files?.[0], 'media_url')} />
                    <label htmlFor="member-page-portrait" className="flex cursor-pointer items-center justify-center gap-2 border border-white/20 px-3 py-2 text-sm"><Upload size={14} />{uploading === 'media_url' ? 'Uploading…' : 'Upload portrait'}</label>
                    <Input value={editingPage.media_url || ''} onChange={e => setEditingPage(p => ({ ...p, media_url: e.target.value }))} placeholder="Or paste media URL" className="bg-neutral-900 border-white/10 text-white" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-white/65">Landscape media</p>
                    {editingPage.media_url_landscape && <img src={editingPage.media_url_landscape} alt="" className="h-40 w-full object-cover border border-white/10" />}
                    <input id="member-page-landscape" type="file" accept="image/*,video/*" className="hidden" onChange={e => upload(e.target.files?.[0], 'media_url_landscape')} />
                    <label htmlFor="member-page-landscape" className="flex cursor-pointer items-center justify-center gap-2 border border-white/20 px-3 py-2 text-sm"><Upload size={14} />{uploading === 'media_url_landscape' ? 'Uploading…' : 'Upload landscape'}</label>
                    <Input value={editingPage.media_url_landscape || ''} onChange={e => setEditingPage(p => ({ ...p, media_url_landscape: e.target.value }))} placeholder="Or paste media URL" className="bg-neutral-900 border-white/10 text-white" />
                  </div>
                </div>

                <div className="border-t border-white/10 pt-5">
                  <p className="mb-2 text-sm text-white/65">Audio</p>
                  <div className="flex gap-3">
                    <Input value={editingPage.audio_url || ''} onChange={e => setEditingPage(p => ({ ...p, audio_url: e.target.value }))} placeholder="Audio URL" className="bg-neutral-900 border-white/10 text-white" />
                    <input id="member-page-audio" type="file" accept="audio/*" className="hidden" onChange={e => upload(e.target.files?.[0], 'audio_url')} />
                    <label htmlFor="member-page-audio" className="flex cursor-pointer items-center gap-2 border border-white/20 px-4 py-2 text-sm"><Upload size={14} />Upload audio</label>
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
