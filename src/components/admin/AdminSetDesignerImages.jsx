import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/api/supabaseClient';

const GROUP_LABELS = {
  direction: 'Direction',
  era: 'Era',
  lighting: 'Lighting',
  time_of_day: 'Time of day',
  weather_atmosphere: 'Weather / Atmosphere',
  image_treatment: 'Image treatment',
};

const GROUP_ORDER = ['direction', 'era', 'lighting', 'time_of_day', 'weather_atmosphere', 'image_treatment'];

export default function AdminSetDesignerImages() {
  const qc = useQueryClient();
  const [uploadingId, setUploadingId] = useState(null);

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['admin-set-designer-option-images'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('set_designer_option_images')
        .select('id,group_key,option_key,label,image_url,storage_path,active,updated_at')
        .order('group_key')
        .order('label');
      if (error) throw error;
      return data || [];
    },
  });

  const uploadImage = async (row, file) => {
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      toast.error('Choose an image file.');
      return;
    }

    setUploadingId(row.id);
    try {
      const path = `${row.group_key}/${row.option_key}`;
      const { error: uploadError } = await supabase.storage
        .from('set-designer-options')
        .upload(path, file, {
          upsert: true,
          contentType: file.type,
          cacheControl: '0',
        });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from('set-designer-options').getPublicUrl(path);
      const imageUrl = `${publicData.publicUrl}?v=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('set_designer_option_images')
        .update({
          image_url: imageUrl,
          storage_path: path,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      if (updateError) throw updateError;

      await qc.invalidateQueries({ queryKey: ['admin-set-designer-option-images'] });
      toast.success(`${row.label} image updated`);
    } catch (uploadError) {
      console.error('Set Designer image upload failed', uploadError);
      toast.error(uploadError.message || 'Image upload failed');
    } finally {
      setUploadingId(null);
    }
  };

  if (isLoading) {
    return <div className="flex min-h-64 items-center justify-center"><Loader2 className="animate-spin text-[#23c7be]" /></div>;
  }

  if (error) {
    return <div className="border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-100">Set Designer images could not load: {error.message}</div>;
  }

  return (
    <div className="space-y-6 text-white">
      <div className="border border-white/10 bg-[#111417] p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center border border-[#23c7be]/35 bg-[#23c7be]/10 text-[#23c7be]"><ImagePlus size={19} /></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#23c7be]">Set Designer</p>
            <h2 className="text-xl font-black">Button images</h2>
          </div>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">Upload or replace the image used inside each Set Designer option button. Changes use the fixed image slot for that option; no code change or redeployment is required after an image replacement.</p>
      </div>

      {GROUP_ORDER.map(groupKey => {
        const items = rows.filter(row => row.group_key === groupKey);
        if (!items.length) return null;
        return (
          <section key={groupKey} className="border border-white/10 bg-[#17191d]">
            <div className="border-b border-white/10 px-5 py-4">
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-white/85">{GROUP_LABELS[groupKey]}</h3>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map(row => {
                const busy = uploadingId === row.id;
                return (
                  <article key={row.id} className="overflow-hidden border border-white/10 bg-black">
                    <div className="relative aspect-[16/9] bg-[#0d0f12]">
                      {row.image_url ? (
                        <img src={row.image_url} alt={row.label} className="absolute inset-0 h-full w-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-xs text-white/30">No image</div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-black text-white">{row.label}</p>
                      <label className={`mt-3 flex cursor-pointer items-center justify-center gap-2 border border-[#23c7be]/35 px-3 py-2.5 text-xs font-black text-[#8ee9e4] hover:bg-[#23c7be]/10 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                        {row.image_url ? 'Replace image' : 'Upload image'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={event => {
                            const file = event.target.files?.[0];
                            event.target.value = '';
                            uploadImage(row, file);
                          }}
                        />
                      </label>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
