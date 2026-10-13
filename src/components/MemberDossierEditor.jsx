import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Upload, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function MemberDossierEditor({ dossier = null, userEmail, onClose, onSaved }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState(() => ({
    title: dossier?.title || '',
    subtitle: dossier?.subtitle || '',
    author_name: dossier?.author_name || '',
    category: dossier?.category || '',
    class: dossier?.class || '',
    access_level: dossier?.access_level || 'public',
    status: dossier?.status || 'draft',
    cover_image: dossier?.cover_image || '',
    content_rating: dossier?.content_rating || null,
    access_model: dossier?.access_model || 'free',
    original_language: dossier?.original_language || '',
    default_language: dossier?.default_language || '',
    audio_languages: Array.isArray(dossier?.audio_languages) ? dossier.audio_languages : [],
    subtitle_languages: Array.isArray(dossier?.subtitle_languages) ? dossier.subtitle_languages : [],
    public_promo_confirmed: Boolean(dossier?.public_promo_confirmed),
    hide_text_on_cover: Boolean(dossier?.hide_text_on_cover),
  }));

  const { data: categories = [] } = useQuery({
    queryKey: ['dossierCategories'],
    queryFn: () => base44.entities.DossierCategory.list('name'),
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (dossier?.id) return base44.entities.Dossier.update(dossier.id, data);
      return base44.entities.Dossier.create(data);
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['desktopMemberDossiers', userEmail] });
      qc.invalidateQueries({ queryKey: ['memberDossiers'] });
      toast.success(dossier?.id ? 'Dossier updated.' : 'Dossier created.');
      onSaved?.(saved);
      onClose?.();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Unable to save dossier.');
    },
  });

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set('cover_image', file_url);
    } catch (error) {
      toast.error(error?.message || 'Unable to upload cover.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    const data = {
      ...form,
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      author_name: form.author_name.trim(),
      category: form.category || '',
      class: form.class || '',
      original_language: form.original_language.trim() || null,
      default_language: form.default_language.trim() || null,
      audio_languages: form.audio_languages.filter(Boolean),
      subtitle_languages: form.subtitle_languages.filter(Boolean),
      submitted_by_email: userEmail,
    };

    if (!data.title) {
      toast.error('Enter a title.');
      return;
    }

    if (data.status === 'published') {
      if (!data.content_rating) {
        toast.error('Choose a content rating before publishing.');
        return;
      }
      if (!data.access_model) {
        toast.error('Choose an access model before publishing.');
        return;
      }
      if (!data.original_language) {
        toast.error('Choose an original language before publishing.');
        return;
      }
      if (!data.default_language) data.default_language = data.original_language;
      if (data.default_language !== data.original_language && !data.audio_languages.includes(data.default_language)) {
        toast.error('Default language must be the original language or one of the audio languages.');
        return;
      }
      if (!data.public_promo_confirmed) {
        toast.error('Confirm public publication before publishing.');
        return;
      }
      if (data.content_rating === '18+') {
        data.adult_age_gate_required = true;
        data.adult_warning_page_required = true;
      }
      if (data.access_model === 'paid') data.commercial_access_required = true;
    }

    saveMutation.mutate(data);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/85 p-6 backdrop-blur-sm">
      <div className="my-8 w-full max-w-3xl border border-white/15 bg-neutral-950 text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">Dossier</p>
            <h2 className="text-xl font-light">{dossier?.id ? 'Edit dossier' : 'Create new dossier'}</h2>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center border border-white/15 text-white/70 hover:text-white" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Title" className="bg-neutral-900 border-white/10 text-white" />
            <Input value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} placeholder="Subtitle" className="bg-neutral-900 border-white/10 text-white" />
            <Input value={form.author_name} onChange={(e) => set('author_name', e.target.value)} placeholder="Author" className="bg-neutral-900 border-white/10 text-white" />

            <Select value={form.category || '__none__'} onValueChange={(value) => set('category', value === '__none__' ? '' : value)}>
              <SelectTrigger className="bg-neutral-900 border-white/10 text-white"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent><SelectItem value="__none__">— No category —</SelectItem>{categories.map(cat => <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>)}</SelectContent>
            </Select>

            <Select value={form.class || '__none__'} onValueChange={(value) => set('class', value === '__none__' ? '' : value)}>
              <SelectTrigger className="bg-neutral-900 border-white/10 text-white"><SelectValue placeholder="Class" /></SelectTrigger>
              <SelectContent><SelectItem value="__none__">— No class —</SelectItem><SelectItem value="Videos">Videos</SelectItem><SelectItem value="Story">Story</SelectItem><SelectItem value="Assets">Assets</SelectItem><SelectItem value="Kits">Kits</SelectItem><SelectItem value="Merchandise">Merchandise</SelectItem></SelectContent>
            </Select>

            <Select value={form.access_level} onValueChange={(value) => set('access_level', value)}>
              <SelectTrigger className="bg-neutral-900 border-white/10 text-white"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="public">Public</SelectItem><SelectItem value="subscribers">Subscribers only</SelectItem></SelectContent>
            </Select>

            <Select value={form.status} onValueChange={(value) => set('status', value)}>
              <SelectTrigger className="bg-neutral-900 border-white/10 text-white"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="unpublished">Unpublished</SelectItem></SelectContent>
            </Select>
          </div>

          <div className="border-t border-white/10 pt-5">
            <label className="mb-2 block text-sm text-white/70">Cover image</label>
            <div className="flex items-center gap-4">
              {form.cover_image ? <img src={form.cover_image} alt="" className="h-32 w-24 object-cover border border-white/10" /> : <div className="flex h-32 w-24 items-center justify-center border border-dashed border-white/15 text-[10px] uppercase tracking-wider text-white/25">No cover</div>}
              <div>
                <input id="member-dossier-cover" type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
                <label htmlFor="member-dossier-cover" className="inline-flex cursor-pointer items-center gap-2 border border-white/20 px-4 py-2 text-sm text-white hover:border-white/50">
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload cover
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t border-white/10 pt-5">
            <div>
              <p className="text-sm font-medium text-white">Classification & Languages</p>
              <p className="mt-1 text-xs text-white/45">Required when the dossier is published.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select value={form.content_rating || '__none__'} onValueChange={(value) => set('content_rating', value === '__none__' ? null : value)}>
                <SelectTrigger className="bg-neutral-900 border-white/10 text-white"><SelectValue placeholder="Content rating" /></SelectTrigger>
                <SelectContent><SelectItem value="__none__">— Not classified —</SelectItem><SelectItem value="all">All audiences</SelectItem><SelectItem value="13+">13+</SelectItem><SelectItem value="18+">18+</SelectItem></SelectContent>
              </Select>
              <Select value={form.access_model || '__none__'} onValueChange={(value) => set('access_model', value === '__none__' ? null : value)}>
                <SelectTrigger className="bg-neutral-900 border-white/10 text-white"><SelectValue placeholder="Access model" /></SelectTrigger>
                <SelectContent><SelectItem value="__none__">— Not set —</SelectItem><SelectItem value="free">Free</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent>
              </Select>
              <Input value={form.original_language} onChange={(e) => set('original_language', e.target.value)} placeholder="Original language — en, fr..." className="bg-neutral-900 border-white/10 text-white" />
              <Input value={form.default_language} onChange={(e) => set('default_language', e.target.value)} placeholder="Default language" className="bg-neutral-900 border-white/10 text-white" />
              <Input value={form.audio_languages.join(', ')} onChange={(e) => set('audio_languages', e.target.value.split(',').map(v => v.trim()).filter(Boolean))} placeholder="Audio languages — en, fr" className="bg-neutral-900 border-white/10 text-white" />
              <Input value={form.subtitle_languages.join(', ')} onChange={(e) => set('subtitle_languages', e.target.value.split(',').map(v => v.trim()).filter(Boolean))} placeholder="Subtitle languages — en, fr" className="bg-neutral-900 border-white/10 text-white" />
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 border border-white/10 bg-neutral-900/60 p-4">
            <input type="checkbox" checked={form.public_promo_confirmed} onChange={(e) => set('public_promo_confirmed', e.target.checked)} className="mt-0.5 h-5 w-5 accent-white" />
            <span><span className="block text-sm text-white">Public publication confirmed</span><span className="mt-1 block text-xs text-white/45">Required for published dossiers.</span></span>
          </label>

          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" checked={form.hide_text_on_cover} onChange={(e) => set('hide_text_on_cover', e.target.checked)} className="h-5 w-5 accent-white" />
            <span className="text-sm text-white">Hide title on cover</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-white/10 px-6 py-4">
          <Button type="button" onClick={onClose} className="bg-neutral-800 text-white hover:bg-neutral-700">Cancel</Button>
          <Button type="button" onClick={handleSave} disabled={saveMutation.isPending || uploading} className="bg-white text-black hover:bg-white/90">
            {saveMutation.isPending && <Loader2 size={14} className="mr-2 animate-spin" />}
            {form.status === 'published' ? 'Save & publish' : 'Save dossier'}
          </Button>
        </div>
      </div>
    </div>
  );
}
