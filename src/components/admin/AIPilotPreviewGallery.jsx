import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Images, Upload, X } from 'lucide-react';
import { supabase } from '@/api/base44Client';

const slugify = (value = '') => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export default function AIPilotPreviewGallery({ pilot }) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const queryKey = ['ai-pilot-preview-gallery', pilot?.catalog_asset_id];
  const { data: previewImages = [], isLoading } = useQuery({
    queryKey,
    enabled: Boolean(pilot?.catalog_asset_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('catalog_asset')
        .select('preview_images')
        .eq('id', pilot.catalog_asset_id)
        .single();
      if (error) throw error;
      return Array.isArray(data?.preview_images) ? data.preview_images.filter(Boolean) : [];
    },
  });

  const updateGallery = async (nextImages) => {
    if (!pilot?.catalog_asset_id) throw new Error('This AI Pilot does not have an Assets Shop listing yet.');
    const { error } = await supabase
      .from('catalog_asset')
      .update({ preview_images: nextImages, updated_at: new Date().toISOString() })
      .eq('id', pilot.catalog_asset_id);
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey });
  };

  const handleUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length || !pilot?.id || !pilot?.catalog_asset_id) return;
    setUploading(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const user = userData?.user;
      if (!user?.id) throw new Error('You must be signed in to upload preview images.');

      const uploadedUrls = [];
      for (const file of files) {
        if (!file.type?.startsWith('image/')) throw new Error(`${file.name} is not an image file.`);
        const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'jpg';
        const basename = file.name.replace(/\.[^.]+$/, '');
        const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${slugify(basename) || 'preview'}.${extension}`;
        const path = `${user.id}/ai-pilots/${pilot.id}/preview/${safeName}`;
        const { error: uploadError } = await supabase.storage.from('media').upload(path, file, { cacheControl: '3600', upsert: false });
        if (uploadError) throw uploadError;
        const { data: publicData } = supabase.storage.from('media').getPublicUrl(path);
        if (!publicData?.publicUrl) throw new Error(`Unable to create URL for ${file.name}.`);
        uploadedUrls.push(publicData.publicUrl);
      }

      await updateGallery([...previewImages, ...uploadedUrls]);
    } catch (error) {
      alert(error?.message || 'Unable to upload preview images');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (url) => {
    try {
      await updateGallery(previewImages.filter((item) => item !== url));
    } catch (error) {
      alert(error?.message || 'Unable to remove preview image');
    }
  };

  if (!pilot?.catalog_asset_id) {
    return (
      <div className="mt-5 border border-white/10 bg-white/[0.02] p-3">
        <div className="flex items-center gap-2 text-xs text-white/55"><Images size={14} /> Preview Gallery</div>
        <div className="mt-2 text-xs text-white/30">Publish this AI Pilot to Assets Shop once before adding preview images.</div>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-white/55"><Images size={14} /> Preview Gallery</div>
        <label className={`inline-flex h-8 items-center gap-2 border border-white/15 px-3 text-xs text-white/70 cursor-pointer hover:border-[var(--studio-accent)] hover:bg-white/[0.04] ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
          <Upload size={13} /> {uploading ? 'Uploading…' : 'Add images'}
        </label>
      </div>

      {isLoading ? (
        <div className="text-xs text-white/30">Loading preview gallery…</div>
      ) : previewImages.length ? (
        <div className="grid grid-cols-2 gap-2">
          {previewImages.map((url) => (
            <div key={url} className="group relative aspect-square overflow-hidden border border-white/10 bg-black/30">
              <img src={url} alt="AI Pilot preview" className="h-full w-full object-cover" />
              <button type="button" onClick={() => removeImage(url)} className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center bg-black/80 text-white/75 opacity-0 transition group-hover:opacity-100" aria-label="Remove preview image"><X size={14} /></button>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-white/15 p-4 text-center text-xs text-white/30">No preview images yet.</div>
      )}
    </div>
  );
}
