import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import VaultDrawer from '@/components/VaultDrawer';
import { toast } from 'sonner';

export default function MemberDossierEditor({ dossier = null, userEmail, onClose, onSaved }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
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
    content_rating: dossier?.content_rating || null,
    access_model: dossier?.access_model || 'free',
    original_language: dossier?.original_language || '',
    default_language: dossier?.default_language || '',
    public_promo_confirmed: Boolean(dossier?.public_promo_confirmed),
    hide_text_on_cover: Boolean(dossier?.hide_text_on_cover),
  }));

  const { data: categories = [] } = useQuery({
    queryKey: ['dossierCategories'],
    queryFn: () => base44.entities.DossierCategory.list('name'),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const data = {
        ...form,
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        description: form.description.trim(),
        author_name: form.author_name.trim(),
        submitted_by_email: dossier?.submitted_by_email || userEmail,
        submitted_at: dossier?.submitted_at || now.toISOString(),
        order: dossier?.order ?? 999,
      };

      if (!data.title) throw new Error('Enter a title.');
      if (!data.cover_image) throw new Error('Choose a cover image.');

      if (data.status === 'published') {
        if (!data.content_rating) throw new Error('Choose a content rating before publishing.');
        if (!data.original_language?.trim()) throw new Error('Choose an original language before publishing.');
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
      e.target.value = '';
    }
  };

  const isPublishing = form.status === 'published';

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) onClose?.(); }}>
        <DialogContent className="bg-neutral-950 border-white/10 text-white max-w-xl max-h-[86vh] overflow-y-auto p-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-white/10">
            <DialogTitle className="font-light tracking-wide">{dossier?.id ? 'Edit dossier' : 'Create new dossier'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 px-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Title *" className="bg-neutral-900 border-white/10 text-white" />
              <Input value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} placeholder="Subtitle" className="bg-neutral-900 border-white/10 text-white" />
              <Input value={form.author_name} onChange={(e) => set('author_name', e.target.value)} placeholder="Author" className="bg-neutral-900 border-white/10 text-white" />
              <Select value={form.category || '__none__'} onValueChange={(value) => set('category', value === '__none__' ? '' : value)}>
                <SelectTrigger className="bg-neutral-900 border-white/10 text-white"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent><SelectItem value="__none__">— No category —</SelectItem>{categories.map(cat => <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={form.class || 'Videos'} onValueChange={(value) => set('class', value)}>
                <SelectTrigger className="bg-neutral-900 border-white/10 text-white"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Videos">Videos</SelectItem><SelectItem value="Story">Story</SelectItem><SelectItem value="Assets">Assets</SelectItem><SelectItem value="Kits">Kits</SelectItem><SelectItem value="Merchandise">Merchandise</SelectItem></SelectContent>
              </Select>
              <Select value={form.access_level} onValueChange={(value) => set('access_level', value)}>
                <SelectTrigger className="bg-neutral-900 border-white/10 text-white"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="public">Public</SelectItem><SelectItem value="subscribers">Subscribers only</SelectItem></SelectContent>
              </Select>
            </div>

            <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Description / pitch" rows={3} className="bg-neutral-900 border-white/10 text-white resize-none" />

            <div className="flex items-center gap-3 border-t border-white/10 pt-3">
              {form.cover_image ? <img src={form.cover_image} alt="" className="h-20 w-14 object-cover border border-white/10" /> : <div className="flex h-20 w-14 items-center justify-center border border-dashed border-white/15 text-[9px] text-white/30">COVER</div>}
              <input id="member-dossier-cover" type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
              <label htmlFor="member-dossier-cover" className="inline-flex cursor-pointer items-center gap-2 border border-white/20 px-3 py-2 text-sm text-white hover:border-white/50">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {form.cover_image ? 'Replace cover' : 'Upload cover'}
              </label>
              <button type="button" onClick={() => setVaultOpen(true)} className="inline-flex items-center gap-2 border border-white/20 px-3 py-2 text-sm text-white hover:border-white/50">
                Vault
              </button>
              <label className="ml-auto flex items-center gap-2 text-sm text-white/70">
                <input type="checkbox" checked={form.hide_text_on_cover} onChange={(e) => set('hide_text_on_cover', e.target.checked)} className="h-4 w-4 accent-white" />
                Hide title
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
              <Select value={form.status} onValueChange={(value) => set('status', value)}>
                <SelectTrigger className="bg-neutral-900 border-white/10 text-white"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="unpublished">Unpublished</SelectItem></SelectContent>
              </Select>
              {isPublishing && (
                <Select value={form.content_rating || '__none__'} onValueChange={(value) => set('content_rating', value === '__none__' ? null : value)}>
                  <SelectTrigger className="bg-neutral-900 border-white/10 text-white"><SelectValue placeholder="Rating" /></SelectTrigger>
                  <SelectContent><SelectItem value="__none__">— Rating —</SelectItem><SelectItem value="all">All audiences</SelectItem><SelectItem value="13+">13+</SelectItem><SelectItem value="18+">18+</SelectItem></SelectContent>
                </Select>
              )}
              {isPublishing && <Input value={form.original_language} onChange={(e) => set('original_language', e.target.value)} placeholder="Original language *" className="bg-neutral-900 border-white/10 text-white" />}
              {isPublishing && <Input value={form.default_language} onChange={(e) => set('default_language', e.target.value)} placeholder="Default language" className="bg-neutral-900 border-white/10 text-white" />}
              {isPublishing && (
                <Select value={form.access_model || 'free'} onValueChange={(value) => set('access_model', value)}>
                  <SelectTrigger className="bg-neutral-900 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="free">Free</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-3">
            <Button type="button" variant="ghost" onClick={onClose} className="text-white hover:bg-white/10">Cancel</Button>
            <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || uploading} className="bg-white text-black hover:bg-white/90">
              {saveMutation.isPending && <Loader2 size={14} className="mr-2 animate-spin" />}
              {isPublishing ? 'Save & publish' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <VaultDrawer
        open={vaultOpen}
        onClose={() => setVaultOpen(false)}
        onSelect={(url) => set('cover_image', url)}
      />
    </>
  );
}
