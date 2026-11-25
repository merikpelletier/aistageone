import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AtelierAssetPicker from '@/components/atelier/AtelierAssetPicker';
import { toast } from 'sonner';
import { useStudioTranslation } from '@/lib/useStudioTranslation';

export default function MemberDossierEditor({ dossier = null, userEmail, onClose, onSaved, embedded = false }) {
  const qc = useQueryClient();
  const t = useStudioTranslation();
  const [uploading, setUploading] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [ratingReasonsInput, setRatingReasonsInput] = useState((dossier?.rating_reasons || []).join(', '));
  const [audioLanguagesInput, setAudioLanguagesInput] = useState((dossier?.audio_languages || []).join(', '));
  const [subtitleLanguagesInput, setSubtitleLanguagesInput] = useState((dossier?.subtitle_languages || []).join(', '));
  const [form, setForm] = useState(() => ({
    title: dossier?.title || '',
    subtitle: dossier?.subtitle || '',
    description: dossier?.description || '',
    author_name: dossier?.author_name || '',
    category: dossier?.category || '',
    class: dossier?.class || 'Videos',
    access_level: dossier?.access_level || 'public',
    status: dossier?.status || 'draft',
    cover_image: dossier?.cover_image || '',
    cover_image_landscape: dossier?.cover_image_landscape || '',
    cover_video: dossier?.cover_video || '',
    cover_video_landscape: dossier?.cover_video_landscape || '',
    audio_languages: dossier?.audio_languages || [],
    subtitle_languages: dossier?.subtitle_languages || [],
    first_publication_date: dossier?.first_publication_date || '',
    official_registration_reference: dossier?.official_registration_reference || '',
    rating_reasons: dossier?.rating_reasons || [],
    content_rating: dossier?.content_rating || null,
    access_model: dossier?.access_model || 'free',
    original_language: dossier?.original_language || '',
    default_language: dossier?.default_language || '',
    public_promo_confirmed: Boolean(dossier?.public_promo_confirmed),
    hide_text_on_cover: Boolean(dossier?.hide_text_on_cover),
    mobile_enabled: Boolean(dossier?.mobile_enabled),
    mobile_public_id: dossier?.mobile_public_id || '',
  }));

  const { data: categories = [] } = useQuery({
    queryKey: ['dossierCategories'],
    queryFn: () => base44.entities.DossierCategory.list('name'),
  });

  const { data: dossierClasses = [] } = useQuery({
    queryKey: ['dossierClasses'],
    queryFn: () => base44.entities.DossierClass.list('order'),
  });

  const classOptions = dossierClasses.length ? dossierClasses.map(item => item.name) : ['Videos', 'Story', 'Assets', 'Kits', 'Merchandise'];

  const saveMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const data = {
        ...form,
        rating_reasons: languageList(ratingReasonsInput),
        audio_languages: languageList(audioLanguagesInput),
        subtitle_languages: languageList(subtitleLanguagesInput),
        first_publication_date: form.first_publication_date || null,
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        description: form.description.trim(),
        author_name: form.author_name.trim(),
        submitted_by_email: dossier?.submitted_by_email || userEmail,
        submitted_at: dossier?.submitted_at || now.toISOString(),
        order: dossier?.order ?? 999,
      };

      if (!data.title) throw new Error(t('Enter a title.','Enter a title.'));
      if (!data.cover_image) throw new Error(t('Choose a cover image.','Choose a cover image.'));

      if (data.status === 'published' && data.mobile_enabled && !data.mobile_public_id) {
        data.mobile_public_id = `MOB-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
      }

      if (data.status === 'published') {
        if (!data.content_rating) throw new Error(t('Choose a content rating before publishing.','Choose a content rating before publishing.'));
        if (!data.original_language?.trim()) throw new Error(t('Choose an original language before publishing.','Choose an original language before publishing.'));
        data.original_language = data.original_language.trim();
        data.default_language = data.default_language?.trim() || data.original_language;
        data.public_promo_confirmed = true;
        if (data.content_rating === '18+') {
          data.adult_age_gate_required = true;
          data.adult_warning_page_required = true;
        }
        if (data.access_model === 'paid') data.commercial_access_required = true;
      }

      if (dossier?.id) return base44.entities.Dossier.update(dossier.id, data);
      return base44.entities.Dossier.create(data);
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['desktopMemberDirectDossiers', userEmail] });
      qc.invalidateQueries({ queryKey: ['desktopMemberDossiers', userEmail] });
      qc.invalidateQueries({ queryKey: ['memberDossiers'] });
      toast.success(dossier?.id ? t('Dossier updated.','Dossier updated.') : t('Dossier created.','Dossier created.'));
      onSaved?.(saved);
      onClose?.();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || error?.response?.data?.error || error?.message || t('Unable to save dossier.','Unable to save dossier.'));
    },
  });

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleCoverUpload = async (e, field = 'cover_image') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set(field, file_url);
    } catch (error) {
      toast.error(error?.message || t('Unable to upload cover.','Unable to upload cover.'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const isPublishing = form.status === 'published';

  const fieldStyle = "h-10 border-white/15 bg-[#181a1e] text-white placeholder:text-white/35 focus-visible:ring-1 focus-visible:ring-teal-400";
  const selectStyle = "h-10 border-white/15 bg-[#181a1e] text-white";
  const sectionTitle = "mb-3 text-[11px] font-bold uppercase tracking-[0.13em] text-teal-300";
  const fieldLabel = "mb-1.5 block text-[11px] font-semibold text-white/65";
  const languageList = (text) => text.split(',').map(value => value.trim()).filter(Boolean);

  return (
    <>
      {embedded ? (
        <div className="w-full min-w-0 border border-white/10 bg-[#101214] text-white">

          <DialogHeader className="shrink-0 border-b border-white/10 px-5 py-4 pr-12 md:px-7">
            {embedded ? (
              <h2 className="text-lg font-semibold tracking-normal">{dossier?.id ? t('Edit dossier','Edit dossier') : t('Create new dossier','Create new dossier')}</h2>
            ) : (
              <DialogTitle className="text-lg font-semibold tracking-normal">{dossier?.id ? t('Edit dossier','Edit dossier') : t('Create new dossier','Create new dossier')}</DialogTitle>
            )}
            <p className="mt-1 text-xs text-white/50">{t('Dossier form introduction','Complete your dossier information before publishing.')}</p>
          </DialogHeader>

          <div className={embedded ? "px-5 py-5 md:px-7" : "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 md:px-7"}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
              <section className="min-w-0 space-y-3">
                <h3 className={sectionTitle}>{t('Dossier identity','Identity and description')}</h3>
                <div>
                  <label className={fieldLabel} htmlFor="dossier-title">{t('Title *','Title *')}</label>
                  <Input id="dossier-title" value={form.title} onChange={e => set('title', e.target.value)} className={fieldStyle} />
                </div>
                <div>
                  <label className={fieldLabel} htmlFor="dossier-subtitle">{t('Subtitle','Subtitle')}</label>
                  <Input id="dossier-subtitle" value={form.subtitle} onChange={e => set('subtitle', e.target.value)} className={fieldStyle} />
                </div>
                <div>
                  <label className={fieldLabel} htmlFor="dossier-author">{t('Author','Author')}</label>
                  <Input id="dossier-author" value={form.author_name} onChange={e => set('author_name', e.target.value)} className={fieldStyle} />
                </div>
                <div>
                  <label className={fieldLabel} htmlFor="dossier-description">{t('Description / pitch','Description / pitch')}</label>
                  <Textarea id="dossier-description" value={form.description} onChange={e => set('description', e.target.value)} rows={4} className="min-h-[112px] resize-y border-white/15 bg-[#181a1e] text-white" />
                </div>
              </section>

              <section className="min-w-0 space-y-3">
                <h3 className={sectionTitle}>{t('Dossier cover media','Cover and presentation')}</h3>
                <div className="flex items-start gap-4">
                  <div className="flex h-44 w-30 shrink-0 items-center justify-center overflow-hidden border border-white/15 bg-[#181a1e] text-xs text-white/35" style={{ width: 118 }}>
                    {form.cover_image ? <img src={form.cover_image} alt="" className="h-full w-full object-cover" /> : t('COVER','COVER')}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className={fieldLabel}>{t('Portrait cover','Portrait cover')} *</p>
                    <input id="member-dossier-cover" type="file" accept="image/*" onChange={e => handleCoverUpload(e)} className="hidden" />
                    <label htmlFor="member-dossier-cover" className="inline-flex min-h-9 cursor-pointer items-center gap-2 border border-white/25 px-3 text-xs font-semibold hover:bg-white/10">
                      {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      {form.cover_image ? t('Replace cover','Replace cover') : t('Upload cover','Upload cover')}
                    </label>
                    <button type="button" onClick={() => setVaultOpen(true)} className="block min-h-9 border border-white/25 px-3 text-xs font-semibold hover:bg-white/10">
                      {t('Choose from Vault','Choose from Vault')}
                    </button>
                    <label className="flex items-center gap-2 text-xs text-white/65">
                      <input type="checkbox" checked={form.hide_text_on_cover} onChange={e => set('hide_text_on_cover', e.target.checked)} className="h-4 w-4 accent-teal-400" />
                      {t('Hide title','Hide title')}
                    </label>
                  </div>
                </div>
                <div>
                  <label className={fieldLabel} htmlFor="dossier-landscape-cover">{t('Landscape cover','Landscape cover')}</label>
                  <div className="flex gap-2">
                    <Input id="dossier-landscape-cover" value={form.cover_image_landscape} onChange={e => set('cover_image_landscape', e.target.value)} placeholder={t('Media URL','Media URL')} className={fieldStyle} />
                    <input id="member-dossier-landscape" type="file" accept="image/*" onChange={e => handleCoverUpload(e, 'cover_image_landscape')} className="hidden" />
                    <label htmlFor="member-dossier-landscape" className="flex shrink-0 cursor-pointer items-center justify-center gap-1 border border-white/25 px-3 text-xs hover:bg-white/10"><Upload size={13} />{t('Upload','Upload')}</label>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div><label className={fieldLabel} htmlFor="dossier-video-cover">{t('Portrait cover video','Portrait cover video')}</label><Input id="dossier-video-cover" value={form.cover_video} onChange={e => set('cover_video', e.target.value)} placeholder="URL" className={fieldStyle} /></div>
                  <div><label className={fieldLabel} htmlFor="dossier-video-landscape">{t('Landscape cover video','Landscape cover video')}</label><Input id="dossier-video-landscape" value={form.cover_video_landscape} onChange={e => set('cover_video_landscape', e.target.value)} placeholder="URL" className={fieldStyle} /></div>
                </div>
              </section>
            </div>

            <section className="mt-6 border-t border-white/10 pt-5">
              <h3 className={sectionTitle}>{t('Dossier classification','Classification and languages')}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className={fieldLabel}>{t('Category','Category')}</label>
                  <Select value={form.category || '__none__'} onValueChange={value => set('category', value === '__none__' ? '' : value)}>
                    <SelectTrigger className={selectStyle}><SelectValue placeholder={t('Category','Category')} /></SelectTrigger>
                    <SelectContent><SelectItem value="__none__">{t('— No category —','— No category —')}</SelectItem>{categories.map(cat => <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={fieldLabel}>{t('Content type','Content type')}</label>
                  <Select value={form.class || 'Videos'} onValueChange={value => set('class', value)}>
                    <SelectTrigger className={selectStyle}><SelectValue /></SelectTrigger>
                    <SelectContent>{classOptions.map(name => <SelectItem key={name} value={name}>{t(name,name)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={fieldLabel}>{t('Rating','Rating')}</label>
                  <Select value={form.content_rating || '__none__'} onValueChange={value => set('content_rating', value === '__none__' ? null : value)}>
                    <SelectTrigger className={selectStyle}><SelectValue placeholder={t('Rating','Rating')} /></SelectTrigger>
                    <SelectContent><SelectItem value="__none__">{t('— Rating —','— Rating —')}</SelectItem><SelectItem value="all">{t('All audiences','All audiences')}</SelectItem><SelectItem value="13+">13+</SelectItem><SelectItem value="18+">18+</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={fieldLabel} htmlFor="dossier-reasons">{t('Rating reasons','Rating reasons')}</label>
                  <Input id="dossier-reasons" value={ratingReasonsInput} onChange={e => setRatingReasonsInput(e.target.value)} placeholder={t('Comma-separated values','Comma-separated values')} className={fieldStyle} />
                </div>
                <div><label className={fieldLabel} htmlFor="dossier-original-language">{t('Original language *','Original language *')}</label><Input id="dossier-original-language" value={form.original_language} onChange={e => set('original_language', e.target.value)} placeholder="fr" className={fieldStyle} /></div>
                <div><label className={fieldLabel} htmlFor="dossier-default-language">{t('Default language','Default language')}</label><Input id="dossier-default-language" value={form.default_language} onChange={e => set('default_language', e.target.value)} placeholder="fr" className={fieldStyle} /></div>
                <div><label className={fieldLabel} htmlFor="dossier-audio-languages">{t('Audio languages','Audio languages')}</label><Input id="dossier-audio-languages" value={audioLanguagesInput} onChange={e => setAudioLanguagesInput(e.target.value)} placeholder="fr, en" className={fieldStyle} /></div>
                <div><label className={fieldLabel} htmlFor="dossier-subtitle-languages">{t('Subtitle languages','Subtitle languages')}</label><Input id="dossier-subtitle-languages" value={subtitleLanguagesInput} onChange={e => setSubtitleLanguagesInput(e.target.value)} placeholder="fr, en" className={fieldStyle} /></div>
              </div>
            </section>

            <section className="mt-6 border-t border-white/10 pt-5">
              <h3 className={sectionTitle}>{t('Dossier publication','Access and publication')}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className={fieldLabel}>{t('Visibility','Visibility')}</label>
                  <Select value={form.access_level} onValueChange={value => set('access_level', value)}>
                    <SelectTrigger className={selectStyle}><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="public">{t('Public','Public')}</SelectItem><SelectItem value="subscribers">{t('Subscribers only','Subscribers only')}</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={fieldLabel}>{t('Access model','Access model')}</label>
                  <Select value={form.access_model || 'free'} onValueChange={value => set('access_model', value)}>
                    <SelectTrigger className={selectStyle}><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="free">{t('Free','Free')}</SelectItem><SelectItem value="paid">{t('Paid','Paid')}</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={fieldLabel}>{t('Publication status','Publication status')}</label>
                  <Select value={form.status} onValueChange={value => set('status', value)}>
                    <SelectTrigger className={selectStyle}><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="draft">{t('Draft','Draft')}</SelectItem><SelectItem value="published">{t('Published','Published')}</SelectItem><SelectItem value="unpublished">{t('Unpublished','Unpublished')}</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4 border-t border-white/10 pt-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={Boolean(form.mobile_enabled)}
                    onChange={event => set('mobile_enabled', event.target.checked)}
                    className="mt-1 h-4 w-4 accent-teal-400"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white">{t('Créer une version mobile','Create a mobile version')}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-white/50">{t('Préparer ce dossier pour le player mobile externe AISTAGE.ONE. La version mobile reste liée à ce dossier et réutilise son contenu existant.','Prepare this dossier for the external AISTAGE.ONE mobile player. The mobile version remains linked to this dossier and reuses its existing content.')}</span>
                    {form.mobile_public_id && (
                      <span className="mt-2 block text-[11px] text-teal-300">{t('Identifiant de publication mobile','Mobile publication ID')}: {form.mobile_public_id}{dossier?.mobile_enabled && dossier?.status === 'published' && form.mobile_enabled && form.status === 'published' && <a href={`/mobile/${encodeURIComponent(form.mobile_public_id)}`} target="_blank" rel="noopener noreferrer" className="ml-3 underline text-white">{t('Ouvrir le player mobile','Open mobile player')}</a>}</span>
                    )}
                  </span>
                </label>
              </div>
              <button type="button" onClick={() => setShowAdvanced(value => !value)} className="mt-4 text-xs font-semibold text-teal-300 hover:text-teal-200" aria-expanded={showAdvanced}>
                {showAdvanced ? '−' : '+'} {t('Publication details','Additional publication details')}
              </button>
              {showAdvanced && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><label className={fieldLabel} htmlFor="dossier-first-publication">{t('First publication date','First publication date')}</label><Input id="dossier-first-publication" type="date" value={form.first_publication_date ? String(form.first_publication_date).slice(0,10) : ''} onChange={e => set('first_publication_date', e.target.value || null)} className={fieldStyle} /></div>
                  <div><label className={fieldLabel} htmlFor="dossier-registration">{t('Official registration reference','Official registration reference')}</label><Input id="dossier-registration" value={form.official_registration_reference} onChange={e => set('official_registration_reference', e.target.value)} className={fieldStyle} /></div>
                </div>
              )}
            </section>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/15 bg-[#101214] px-5 py-3 md:px-7">
            <Button type="button" variant="ghost" onClick={onClose} className="text-white hover:bg-white/10">{t('Cancel','Cancel')}</Button>
            <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || uploading} className="bg-white px-5 text-black hover:bg-white/90">
              {saveMutation.isPending && <Loader2 size={14} className="mr-2 animate-spin" />}
              {isPublishing ? t('Save & publish','Save & publish') : t('Save','Save')}
            </Button>
          </div>

        </div>
      ) : (
        <Dialog open onOpenChange={(open) => { if (!open && !vaultOpen) onClose?.(); }} modal={!vaultOpen}>
          <DialogContent overlayClassName="z-[7999]" className="z-[8000] flex h-[min(90dvh,860px)] w-[min(96vw,1080px)] max-w-none flex-col gap-0 overflow-hidden border-white/15 bg-[#101214] p-0 text-white sm:max-w-none">

          <DialogHeader className="shrink-0 border-b border-white/10 px-5 py-4 pr-12 md:px-7">
            {embedded ? (
              <h2 className="text-lg font-semibold tracking-normal">{dossier?.id ? t('Edit dossier','Edit dossier') : t('Create new dossier','Create new dossier')}</h2>
            ) : (
              <DialogTitle className="text-lg font-semibold tracking-normal">{dossier?.id ? t('Edit dossier','Edit dossier') : t('Create new dossier','Create new dossier')}</DialogTitle>
            )}
            <p className="mt-1 text-xs text-white/50">{t('Dossier form introduction','Complete your dossier information before publishing.')}</p>
          </DialogHeader>

          <div className={embedded ? "px-5 py-5 md:px-7" : "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 md:px-7"}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
              <section className="min-w-0 space-y-3">
                <h3 className={sectionTitle}>{t('Dossier identity','Identity and description')}</h3>
                <div>
                  <label className={fieldLabel} htmlFor="dossier-title">{t('Title *','Title *')}</label>
                  <Input id="dossier-title" value={form.title} onChange={e => set('title', e.target.value)} className={fieldStyle} />
                </div>
                <div>
                  <label className={fieldLabel} htmlFor="dossier-subtitle">{t('Subtitle','Subtitle')}</label>
                  <Input id="dossier-subtitle" value={form.subtitle} onChange={e => set('subtitle', e.target.value)} className={fieldStyle} />
                </div>
                <div>
                  <label className={fieldLabel} htmlFor="dossier-author">{t('Author','Author')}</label>
                  <Input id="dossier-author" value={form.author_name} onChange={e => set('author_name', e.target.value)} className={fieldStyle} />
                </div>
                <div>
                  <label className={fieldLabel} htmlFor="dossier-description">{t('Description / pitch','Description / pitch')}</label>
                  <Textarea id="dossier-description" value={form.description} onChange={e => set('description', e.target.value)} rows={4} className="min-h-[112px] resize-y border-white/15 bg-[#181a1e] text-white" />
                </div>
              </section>

              <section className="min-w-0 space-y-3">
                <h3 className={sectionTitle}>{t('Dossier cover media','Cover and presentation')}</h3>
                <div className="flex items-start gap-4">
                  <div className="flex h-44 w-30 shrink-0 items-center justify-center overflow-hidden border border-white/15 bg-[#181a1e] text-xs text-white/35" style={{ width: 118 }}>
                    {form.cover_image ? <img src={form.cover_image} alt="" className="h-full w-full object-cover" /> : t('COVER','COVER')}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className={fieldLabel}>{t('Portrait cover','Portrait cover')} *</p>
                    <input id="member-dossier-cover" type="file" accept="image/*" onChange={e => handleCoverUpload(e)} className="hidden" />
                    <label htmlFor="member-dossier-cover" className="inline-flex min-h-9 cursor-pointer items-center gap-2 border border-white/25 px-3 text-xs font-semibold hover:bg-white/10">
                      {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      {form.cover_image ? t('Replace cover','Replace cover') : t('Upload cover','Upload cover')}
                    </label>
                    <button type="button" onClick={() => setVaultOpen(true)} className="block min-h-9 border border-white/25 px-3 text-xs font-semibold hover:bg-white/10">
                      {t('Choose from Vault','Choose from Vault')}
                    </button>
                    <label className="flex items-center gap-2 text-xs text-white/65">
                      <input type="checkbox" checked={form.hide_text_on_cover} onChange={e => set('hide_text_on_cover', e.target.checked)} className="h-4 w-4 accent-teal-400" />
                      {t('Hide title','Hide title')}
                    </label>
                  </div>
                </div>
                <div>
                  <label className={fieldLabel} htmlFor="dossier-landscape-cover">{t('Landscape cover','Landscape cover')}</label>
                  <div className="flex gap-2">
                    <Input id="dossier-landscape-cover" value={form.cover_image_landscape} onChange={e => set('cover_image_landscape', e.target.value)} placeholder={t('Media URL','Media URL')} className={fieldStyle} />
                    <input id="member-dossier-landscape" type="file" accept="image/*" onChange={e => handleCoverUpload(e, 'cover_image_landscape')} className="hidden" />
                    <label htmlFor="member-dossier-landscape" className="flex shrink-0 cursor-pointer items-center justify-center gap-1 border border-white/25 px-3 text-xs hover:bg-white/10"><Upload size={13} />{t('Upload','Upload')}</label>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div><label className={fieldLabel} htmlFor="dossier-video-cover">{t('Portrait cover video','Portrait cover video')}</label><Input id="dossier-video-cover" value={form.cover_video} onChange={e => set('cover_video', e.target.value)} placeholder="URL" className={fieldStyle} /></div>
                  <div><label className={fieldLabel} htmlFor="dossier-video-landscape">{t('Landscape cover video','Landscape cover video')}</label><Input id="dossier-video-landscape" value={form.cover_video_landscape} onChange={e => set('cover_video_landscape', e.target.value)} placeholder="URL" className={fieldStyle} /></div>
                </div>
              </section>
            </div>

            <section className="mt-6 border-t border-white/10 pt-5">
              <h3 className={sectionTitle}>{t('Dossier classification','Classification and languages')}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className={fieldLabel}>{t('Category','Category')}</label>
                  <Select value={form.category || '__none__'} onValueChange={value => set('category', value === '__none__' ? '' : value)}>
                    <SelectTrigger className={selectStyle}><SelectValue placeholder={t('Category','Category')} /></SelectTrigger>
                    <SelectContent><SelectItem value="__none__">{t('— No category —','— No category —')}</SelectItem>{categories.map(cat => <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={fieldLabel}>{t('Content type','Content type')}</label>
                  <Select value={form.class || 'Videos'} onValueChange={value => set('class', value)}>
                    <SelectTrigger className={selectStyle}><SelectValue /></SelectTrigger>
                    <SelectContent>{classOptions.map(name => <SelectItem key={name} value={name}>{t(name,name)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={fieldLabel}>{t('Rating','Rating')}</label>
                  <Select value={form.content_rating || '__none__'} onValueChange={value => set('content_rating', value === '__none__' ? null : value)}>
                    <SelectTrigger className={selectStyle}><SelectValue placeholder={t('Rating','Rating')} /></SelectTrigger>
                    <SelectContent><SelectItem value="__none__">{t('— Rating —','— Rating —')}</SelectItem><SelectItem value="all">{t('All audiences','All audiences')}</SelectItem><SelectItem value="13+">13+</SelectItem><SelectItem value="18+">18+</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={fieldLabel} htmlFor="dossier-reasons">{t('Rating reasons','Rating reasons')}</label>
                  <Input id="dossier-reasons" value={ratingReasonsInput} onChange={e => setRatingReasonsInput(e.target.value)} placeholder={t('Comma-separated values','Comma-separated values')} className={fieldStyle} />
                </div>
                <div><label className={fieldLabel} htmlFor="dossier-original-language">{t('Original language *','Original language *')}</label><Input id="dossier-original-language" value={form.original_language} onChange={e => set('original_language', e.target.value)} placeholder="fr" className={fieldStyle} /></div>
                <div><label className={fieldLabel} htmlFor="dossier-default-language">{t('Default language','Default language')}</label><Input id="dossier-default-language" value={form.default_language} onChange={e => set('default_language', e.target.value)} placeholder="fr" className={fieldStyle} /></div>
                <div><label className={fieldLabel} htmlFor="dossier-audio-languages">{t('Audio languages','Audio languages')}</label><Input id="dossier-audio-languages" value={audioLanguagesInput} onChange={e => setAudioLanguagesInput(e.target.value)} placeholder="fr, en" className={fieldStyle} /></div>
                <div><label className={fieldLabel} htmlFor="dossier-subtitle-languages">{t('Subtitle languages','Subtitle languages')}</label><Input id="dossier-subtitle-languages" value={subtitleLanguagesInput} onChange={e => setSubtitleLanguagesInput(e.target.value)} placeholder="fr, en" className={fieldStyle} /></div>
              </div>
            </section>

            <section className="mt-6 border-t border-white/10 pt-5">
              <h3 className={sectionTitle}>{t('Dossier publication','Access and publication')}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className={fieldLabel}>{t('Visibility','Visibility')}</label>
                  <Select value={form.access_level} onValueChange={value => set('access_level', value)}>
                    <SelectTrigger className={selectStyle}><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="public">{t('Public','Public')}</SelectItem><SelectItem value="subscribers">{t('Subscribers only','Subscribers only')}</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={fieldLabel}>{t('Access model','Access model')}</label>
                  <Select value={form.access_model || 'free'} onValueChange={value => set('access_model', value)}>
                    <SelectTrigger className={selectStyle}><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="free">{t('Free','Free')}</SelectItem><SelectItem value="paid">{t('Paid','Paid')}</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={fieldLabel}>{t('Publication status','Publication status')}</label>
                  <Select value={form.status} onValueChange={value => set('status', value)}>
                    <SelectTrigger className={selectStyle}><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="draft">{t('Draft','Draft')}</SelectItem><SelectItem value="published">{t('Published','Published')}</SelectItem><SelectItem value="unpublished">{t('Unpublished','Unpublished')}</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4 border-t border-white/10 pt-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={Boolean(form.mobile_enabled)}
                    onChange={event => set('mobile_enabled', event.target.checked)}
                    className="mt-1 h-4 w-4 accent-teal-400"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white">{t('Créer une version mobile','Create a mobile version')}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-white/50">{t('Préparer ce dossier pour le player mobile externe AISTAGE.ONE. La version mobile reste liée à ce dossier et réutilise son contenu existant.','Prepare this dossier for the external AISTAGE.ONE mobile player. The mobile version remains linked to this dossier and reuses its existing content.')}</span>
                    {form.mobile_public_id && (
                      <span className="mt-2 block text-[11px] text-teal-300">{t('Identifiant de publication mobile','Mobile publication ID')}: {form.mobile_public_id}{dossier?.mobile_enabled && dossier?.status === 'published' && form.mobile_enabled && form.status === 'published' && <a href={`/mobile/${encodeURIComponent(form.mobile_public_id)}`} target="_blank" rel="noopener noreferrer" className="ml-3 underline text-white">{t('Ouvrir le player mobile','Open mobile player')}</a>}</span>
                    )}
                  </span>
                </label>
              </div>
              <button type="button" onClick={() => setShowAdvanced(value => !value)} className="mt-4 text-xs font-semibold text-teal-300 hover:text-teal-200" aria-expanded={showAdvanced}>
                {showAdvanced ? '−' : '+'} {t('Publication details','Additional publication details')}
              </button>
              {showAdvanced && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><label className={fieldLabel} htmlFor="dossier-first-publication">{t('First publication date','First publication date')}</label><Input id="dossier-first-publication" type="date" value={form.first_publication_date ? String(form.first_publication_date).slice(0,10) : ''} onChange={e => set('first_publication_date', e.target.value || null)} className={fieldStyle} /></div>
                  <div><label className={fieldLabel} htmlFor="dossier-registration">{t('Official registration reference','Official registration reference')}</label><Input id="dossier-registration" value={form.official_registration_reference} onChange={e => set('official_registration_reference', e.target.value)} className={fieldStyle} /></div>
                </div>
              )}
            </section>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/15 bg-[#101214] px-5 py-3 md:px-7">
            <Button type="button" variant="ghost" onClick={onClose} className="text-white hover:bg-white/10">{t('Cancel','Cancel')}</Button>
            <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || uploading} className="bg-white px-5 text-black hover:bg-white/90">
              {saveMutation.isPending && <Loader2 size={14} className="mr-2 animate-spin" />}
              {isPublishing ? t('Save & publish','Save & publish') : t('Save','Save')}
            </Button>
          </div>

          </DialogContent>
        </Dialog>
      )}

      {vaultOpen && (
        <AtelierAssetPicker
          userEmail={userEmail}
          onClose={() => setVaultOpen(false)}
          onSelect={(url) => {
            set('cover_image', url);
            setVaultOpen(false);
          }}
        />
      )}
    </>
  );
}
