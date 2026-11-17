import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, Upload, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useStudioTranslation } from '@/lib/useStudioTranslation';

const PAGE_TYPES = [
  ['cover', 'Cover'], ['index', 'Visual Index'], ['contest', 'Contest / Open Call'], ['credits', 'Credits'],
  ['text', 'Text only'], ['image', 'Image only'], ['video', 'Video only'], ['mixed', 'Text + Image/Video'],
  ['block_player', 'Block Player'],
];

export default function MemberDossierPages({ dossier, onClose }) {
  const qc = useQueryClient();
  const t = useStudioTranslation();
  const [editingPage, setEditingPage] = useState(null);
  const [uploading, setUploading] = useState('');
  const [detailsTab, setDetailsTab] = useState('media');

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
      toast.success(t('Page saved.','Page saved.'));
    },
    onError: (e) => {
      console.error('DossierPage save failed', e);
      toast.error(e?.response?.data?.message || e?.response?.data?.error || e?.message || t('Unable to save page.','Unable to save page.'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: id => base44.entities.DossierPage.delete(id),
    onSuccess: refresh,
    onError: (e) => toast.error(e?.response?.data?.message || e?.response?.data?.error || e?.message || t('Unable to delete page.','Unable to delete page.')),
  });

  const upload = async (file, field) => {
    if (!file) return;
    setUploading(field);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setEditingPage(prev => ({ ...prev, [field]: file_url }));
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.response?.data?.error || e?.message || t('Upload failed.','Upload failed.'));
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
    <div className="flex w-full min-w-0 flex-col bg-black text-white">
      <div className="flex min-h-12 flex-none items-center justify-between border-b border-white/10 bg-black px-3 py-1.5">
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-[0.12em] text-white/40">{t('Manage dossier','Manage dossier')}</p>
          <h2 className="truncate text-sm font-medium">{dossier.title}</h2>
        </div>
        <button onClick={onClose} className="flex h-7 w-7 items-center justify-center border border-white/15" aria-label={t("Close dossier manager","Close dossier manager")}><X size={18} /></button>
      </div>

      <div className="grid w-full min-w-0 flex-1 grid-cols-1 gap-2 p-2 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-3">
        <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden border border-white/10 bg-neutral-950 lg:sticky lg:top-2 lg:max-h-[calc(100dvh-9rem)]">
          <div className="flex flex-none flex-wrap items-center justify-between gap-1 border-b border-white/10 p-2">
            <div><p className="text-xs font-semibold">{t('Pages','Pages')}</p><p className="text-[10px] text-white/40">{sorted.length} {sorted.length === 1 ? t('page','page') : t('pages','pages')}</p></div>
            <Button onClick={newPage} className="h-7 bg-white px-2 text-[11px] text-black hover:bg-white/90"><Plus size={14} className="mr-1" /> {t('Add','Add')}</Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
            ) : sorted.length === 0 ? (
              <p className="p-3 text-sm text-white/40">{t('No pages yet.','No pages yet.')}</p>
            ) : sorted.map(page => (
              <div key={page.id} className="mb-1 flex items-center gap-1.5 border border-white/10 bg-black p-1.5">
                <div className="w-6 text-center text-xs text-white/35">{page.order}</div>
                {page.media_url ? <img src={page.media_url} alt="" className="h-9 w-7 object-cover" /> : <div className="h-9 w-7 bg-neutral-900" />}
                <button onClick={() => setEditingPage({ ...page })} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-xs">{page.title || page.page_type}</p>
                  <p className="text-[10px] uppercase tracking-wider text-white/35">{page.page_type}</p>
                </button>
                <button onClick={() => { if (window.confirm(t('Delete this page?','Delete this page?'))) deleteMutation.mutate(page.id); }} className="p-2 text-white/45 hover:text-red-400" aria-label={t("Delete page","Delete page")}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </aside>

        <main className="min-h-0 min-w-0 bg-neutral-950/30">
          {!editingPage ? (
            <div className="flex min-h-[260px] items-center justify-center border border-dashed border-white/10 bg-neutral-950 text-center lg:min-h-[360px]">
              <div><p className="text-base font-light lg:text-lg">{t('Select a page','Select a page')}</p><p className="mt-1 text-sm text-white/40">{t('or add a new one.','or add a new one.')}</p><Button onClick={newPage} className="mt-4 bg-white text-black hover:bg-white/90"><Plus size={14} className="mr-2" />{t('Add page','Add page')}</Button></div>
            </div>
          ) : (
            <div className="border border-white/10 bg-neutral-950">
              <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-1.5 border-b border-white/10 bg-neutral-950 px-3 py-2">
                <h3 className="truncate text-sm font-medium">{editingPage.id ? t('Edit page','Edit page') : t('New page','New page')}</h3>
                <div className="flex flex-none gap-2">
                  <Button variant="ghost" onClick={() => setEditingPage(null)} className="h-7 px-2 text-xs text-white">{t('Cancel','Cancel')}</Button>
                  <Button type="button" onClick={() => saveMutation.mutate(editingPage)} disabled={saveMutation.isPending || !!uploading} className="h-7 bg-white px-2 text-[11px] text-black hover:bg-white/90">
                    {saveMutation.isPending && <Loader2 size={14} className="mr-2 animate-spin" />}{t('Save','Save')}
                  </Button>
                </div>
              </div>

              <div className="space-y-3 p-3 pb-5">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(125px,1fr)_minmax(180px,2fr)_72px]">
                  <select value={editingPage.page_type || 'text'} onChange={e => update('page_type', e.target.value)} className="h-8 w-full border border-white/10 bg-neutral-900 px-2 text-xs text-white outline-none">
                    {PAGE_TYPES.map(([value, label]) => <option key={value} value={value}>{t(label,label)}</option>)}
                  </select>
                  <Input value={editingPage.title || ''} onChange={e => update('title', e.target.value)} placeholder={t("Page title","Page title")} className="h-8 bg-neutral-900 border-white/10 text-white text-xs" />
                  <Input type="number" value={editingPage.order ?? 1} onChange={e => update('order', Number(e.target.value))} placeholder={t("Order","Order")} className="h-8 bg-neutral-900 border-white/10 text-white text-xs" />
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border border-white/10 bg-black/30 px-2 py-1.5 text-xs">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={!!editingPage.is_hidden_from_public} onChange={e => update('is_hidden_from_public', e.target.checked)} /> {t('Hidden from public','Hidden from public')}</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={!!editingPage.hide_title} onChange={e => update('hide_title', e.target.checked)} /> {t('Hide page title','Hide page title')}</label>
                </div>

 
                <div className="flex flex-wrap gap-1 border-b border-white/10 pb-2">
                  {[
                    ['media', 'Media and text'],
                    ['display', 'Page display'],
                    ['episode', 'Episode details'],
                    ['series', 'Series details'],
                    ['kit', 'Production kit'],
                    ...(editingPage?.page_type === 'contest' ? [['contest', 'Contest details']] : []),
                  ].map(([value, label]) => <button key={value} type="button" onClick={() => setDetailsTab(value)} className={`border px-2 py-1 text-[11px] ${detailsTab === value ? 'border-teal-400 text-teal-300' : 'border-white/10 text-white/60 hover:text-white'}`}>{t(label,label)}</button>)}
                </div>
                {detailsTab === 'display' && (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <label className="text-xs text-white/70">{t('Image layout','Image layout')}<Input value={editingPage.image_layout || ''} onChange={e => update('image_layout',e.target.value)} className="mt-1 h-8 bg-neutral-900 border-white/10" /></label>
                    <label className="text-xs text-white/70">{t('Text position','Text position')}<select value={editingPage.text_position || 'center'} onChange={e => update('text_position',e.target.value)} className="mt-1 h-8 w-full bg-neutral-900 border border-white/10 px-2"><option value="left">{t('Left','Left')}</option><option value="center">{t('Center','Center')}</option><option value="right">{t('Right','Right')}</option></select></label>
                    <label className="text-xs text-white/70">{t('Text color','Text color')}<Input value={editingPage.text_color || 'white'} onChange={e => update('text_color',e.target.value)} className="mt-1 h-8 bg-neutral-900 border-white/10" /></label>
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!editingPage.is_locked} onChange={e=>update('is_locked',e.target.checked)}/>{t('Locked page','Locked page')}</label>
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!editingPage.show_studio_banner} onChange={e=>update('show_studio_banner',e.target.checked)}/>{t('Show Studio banner','Show Studio banner')}</label>
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!editingPage.is_product} onChange={e=>update('is_product',e.target.checked)}/>{t('Product page','Product page')}</label>
                    {editingPage.is_product && <label className="text-xs text-white/70">{t('Price','Price')}<Input value={editingPage.price || ''} onChange={e=>update('price',e.target.value)} className="mt-1 h-8 bg-neutral-900 border-white/10" /></label>}
                  </div>
                )}
                {detailsTab === 'episode' && (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {['episode_title','episode_role','episode_tools_hint','block_player_episode_page_id'].map(key=> <label key={key} className="text-xs text-white/70">{t(key.replaceAll('_',' '),key.replaceAll('_',' '))}<Input value={editingPage[key] || ''} onChange={e=>update(key,e.target.value)} className="mt-1 h-8 bg-neutral-900 border-white/10" /></label>)}
                    <label className="md:col-span-2 text-xs text-white/70">{t('Episode description','Episode description')}<Textarea rows={3} value={editingPage.episode_description || ''} onChange={e=>update('episode_description',e.target.value)} className="mt-1 bg-neutral-900 border-white/10"/></label>
                    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!editingPage.cast_members_only} onChange={e=>update('cast_members_only',e.target.checked)}/>{t('Cast for members only','Cast for members only')}</label>
                  </div>
                )}
                {detailsTab === 'series' && (
                  <div className="space-y-2">
                    <label className="block text-xs text-white/70">{t('Series presentation','Series presentation')}<Textarea rows={3} value={editingPage.series_presentation || ''} onChange={e=>update('series_presentation',e.target.value)} className="mt-1 bg-neutral-900 border-white/10"/></label>
                    <p className="text-[11px] text-white/50">{t('Structured series data','Structured series data is preserved when you save this page.')}</p>
                  </div>
                )}
                {detailsTab === 'kit' && (
                  <div className="space-y-2">
                    <label className="block text-xs text-white/70">{t('Kit description','Kit description')}<Textarea rows={3} value={editingPage.kit_description || ''} onChange={e=>update('kit_description',e.target.value)} className="mt-1 bg-neutral-900 border-white/10"/></label>
                    <p className="text-[11px] text-white/50">{t('Structured kit data','Structured production-kit data is preserved when you save this page.')}</p>
                  </div>
                )}

                {detailsTab === 'contest' && editingPage.page_type === 'contest' && (
                  <div className="grid grid-cols-1 gap-3 border border-white/10 bg-black/30 p-3 sm:grid-cols-2 lg:p-4">
                    <Input value={editingPage.contest_category || ''} onChange={e => update('contest_category', e.target.value)} placeholder={t("Contest category","Contest category")} className="h-8 bg-neutral-900 border-white/10 text-white text-xs" />
                    <Input type="datetime-local" value={editingPage.contest_deadline ? String(editingPage.contest_deadline).slice(0,16) : ''} onChange={e => update('contest_deadline', e.target.value ? new Date(e.target.value).toISOString() : null)} className="h-8 bg-neutral-900 border-white/10 text-white text-xs" />
                    <Textarea value={editingPage.contest_reward || ''} onChange={e => update('contest_reward', e.target.value)} placeholder={t("Opportunity / prize","Opportunity / prize")} rows={2} className="bg-neutral-900 border-white/10 text-white sm:col-span-2" />
                    <Textarea value={editingPage.contest_rules || ''} onChange={e => update('contest_rules', e.target.value)} placeholder={t("Rules / eligibility","Rules / eligibility")} rows={3} className="bg-neutral-900 border-white/10 text-white sm:col-span-2" />
                  </div>
                )}

                {detailsTab === 'media' && (editingPage.page_type === 'credits' ? (
                  <div className="border border-white/10 bg-black/30 p-3 lg:p-4">
                    <p className="mb-3 text-sm text-white/60">{t('Credits page content','Credits page content')}</p>
                    <Textarea value={editingPage.content || ''} onChange={e => update('content', e.target.value)} placeholder={t("Credits text or notes","Credits text or notes")} rows={4} className="h-8 bg-neutral-900 border-white/10 text-white text-xs" />
                  </div>
                ) : (
                  <Textarea value={editingPage.content || ''} onChange={e => update('content', e.target.value)} placeholder={t("Page text content","Page text content")} rows={3} className="h-8 bg-neutral-900 border-white/10 text-white text-xs" />
                ))}

                {detailsTab === 'media' && <>
                <div className="grid grid-cols-1 gap-3 border-t border-white/10 pt-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm text-white/65">{t('Portrait media','Portrait media')}</p>
                    {editingPage.media_url && <img src={editingPage.media_url} alt="" className="h-24 w-full border border-white/10 object-contain" />}
                    <input id="member-page-portrait" type="file" accept="image/*,video/*" className="hidden" onChange={e => upload(e.target.files?.[0], 'media_url')} />
                    <label htmlFor="member-page-portrait" className="flex cursor-pointer items-center justify-center gap-1.5 border border-white/20 px-2 py-1.5 text-xs"><Upload size={14} />{uploading === 'media_url' ? t('Uploading…','Uploading…') : t('Upload portrait','Upload portrait')}</label>
                    <Input value={editingPage.media_url || ''} onChange={e => update('media_url', e.target.value)} placeholder={t("Or paste media URL","Or paste media URL")} className="h-8 bg-neutral-900 border-white/10 text-white text-xs" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-white/65">{t('Landscape media','Landscape media')}</p>
                    {editingPage.media_url_landscape && <img src={editingPage.media_url_landscape} alt="" className="h-24 w-full border border-white/10 object-contain" />}
                    <input id="member-page-landscape" type="file" accept="image/*,video/*" className="hidden" onChange={e => upload(e.target.files?.[0], 'media_url_landscape')} />
                    <label htmlFor="member-page-landscape" className="flex cursor-pointer items-center justify-center gap-2 border border-white/20 px-3 py-2 text-sm"><Upload size={14} />{uploading === 'media_url_landscape' ? t('Uploading…','Uploading…') : t('Upload landscape','Upload landscape')}</label>
                    <Input value={editingPage.media_url_landscape || ''} onChange={e => update('media_url_landscape', e.target.value)} placeholder={t("Or paste media URL","Or paste media URL")} className="h-8 bg-neutral-900 border-white/10 text-white text-xs" />
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4 lg:pt-5">
                  <p className="mb-2 text-sm text-white/65">{t('Audio','Audio')}</p>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input value={editingPage.audio_url || ''} onChange={e => update('audio_url', e.target.value)} placeholder={t("Audio URL","Audio URL")} className="h-8 bg-neutral-900 border-white/10 text-white text-xs" />
                    <input id="member-page-audio" type="file" accept="audio/*" className="hidden" onChange={e => upload(e.target.files?.[0], 'audio_url')} />
                    <label htmlFor="member-page-audio" className="flex cursor-pointer items-center justify-center gap-2 border border-white/20 px-4 py-2 text-sm"><Upload size={14} />{uploading === 'audio_url' ? t('Uploading…','Uploading…') : t('Upload audio','Upload audio')}</label>
                  </div>
                </div>
                </>}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
