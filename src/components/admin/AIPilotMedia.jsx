import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image, Music2, Plus, Save, Trash2, Upload, Video } from 'lucide-react';
import { supabase } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CONTROL_CLASS = 'bg-black/20 border-white/15 text-white placeholder:text-white/25 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[var(--studio-accent)]';
const SELECT_TRIGGER_CLASS = 'bg-black/20 border-white/15 text-white focus:ring-0 focus:ring-offset-0 focus:border-[var(--studio-accent)]';
const PRIMARY_BUTTON_CLASS = 'bg-[var(--studio-accent)] text-[#071211] border border-[var(--studio-accent)] hover:bg-[var(--studio-accent-hover)] hover:border-[var(--studio-accent-hover)]';
const SECONDARY_BUTTON_CLASS = 'bg-white/[0.04] text-white border border-white/15 hover:bg-white/[0.08] hover:border-white/25';

const COMPONENT_TYPES = [
  ['general', 'General AI Pilot'],
  ['character', 'Character'],
  ['location', 'Location'],
  ['set', 'Set'],
  ['look', 'Look'],
  ['visual_direction', 'Visual Direction'],
  ['music_piece', 'Music'],
  ['sound_direction', 'Sound Direction'],
  ['action_prompt', 'Action Prompt'],
  ['blocking_prompt', 'Blocking Prompt'],
];

const slugify = (value = '') => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function mediaTypeFromFile(file) {
  if (file?.type?.startsWith('image/')) return 'image';
  if (file?.type?.startsWith('audio/')) return 'audio';
  if (file?.type?.startsWith('video/')) return 'video';
  return null;
}

function MediaPreview({ item }) {
  if (item.media_type === 'image') return <img src={item.url} alt={item.title || 'AI Pilot media'} className="w-full h-full object-cover" />;
  if (item.media_type === 'audio') return <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-4"><Music2 size={28} className="text-white/45" /><audio src={item.url} controls className="w-full" /></div>;
  if (item.media_type === 'video') return <video src={item.url} controls className="w-full h-full object-contain bg-black" />;
  return null;
}

export default function AIPilotMedia({ pilot, version }) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [uploading, setUploading] = useState(false);

  const queryKey = useMemo(() => ['admin-ai-pilot-media', version?.id], [version?.id]);

  const { data: media = [], isLoading } = useQuery({
    queryKey,
    enabled: Boolean(version?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from('ai_pilot_media').select('*').eq('version_id', version.id).eq('is_active', true).order('sort_order', { ascending: true }).order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const selected = media.find((item) => item.id === editingId) || null;

  React.useEffect(() => {
    if (!selected) {
      setDraft(null);
      return;
    }
    setDraft({ ...selected, component_type: selected.component_type || 'general' });
  }, [selected?.id]);

  const saveItem = useMutation({
    mutationFn: async () => {
      if (!draft?.id) return null;
      const payload = {
        title: draft.title?.trim() || '',
        description: draft.description || '',
        usage_note: draft.usage_note || '',
        component_type: draft.component_type === 'general' ? null : draft.component_type,
        component_key: draft.component_type === 'general' ? null : (draft.component_key?.trim() || null),
        sort_order: Number(draft.sort_order || 0),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from('ai_pilot_media').update(payload).eq('id', draft.id).select('*').single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey });
      if (saved) {
        setEditingId(saved.id);
        setDraft({ ...saved, component_type: saved.component_type || 'general' });
      }
    },
    onError: (error) => alert(error?.message || 'Unable to save AI Pilot media'),
  });

  const deleteItem = useMutation({
    mutationFn: async (item) => {
      if (!item?.id) return;
      const { error } = await supabase.from('ai_pilot_media').delete().eq('id', item.id);
      if (error) throw error;
      if (item.storage_path) {
        const { error: storageError } = await supabase.storage.from('media').remove([item.storage_path]);
        if (storageError) console.warn('AI Pilot media row deleted but storage cleanup failed', storageError);
      }
    },
    onSuccess: async () => {
      setEditingId(null);
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => alert(error?.message || 'Unable to remove AI Pilot media'),
  });

  const handleUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length || !pilot?.id || !version?.id) return;
    setUploading(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const user = userData?.user;
      if (!user?.id) throw new Error('You must be signed in to upload AI Pilot media.');

      const inserted = [];
      for (const file of files) {
        const mediaType = mediaTypeFromFile(file);
        if (!mediaType) throw new Error(`${file.name} is not a supported image, audio, or video file.`);
        const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'bin';
        const basename = file.name.replace(/\.[^.]+$/, '');
        const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${slugify(basename) || 'media'}.${extension}`;
        const path = `${user.id}/ai-pilots/${pilot.id}/media/${safeName}`;
        const { error: uploadError } = await supabase.storage.from('media').upload(path, file, { cacheControl: '3600', upsert: false });
        if (uploadError) throw uploadError;
        const { data: publicData } = supabase.storage.from('media').getPublicUrl(path);
        if (!publicData?.publicUrl) throw new Error(`Unable to create URL for ${file.name}.`);
        inserted.push({
          ai_pilot_id: pilot.id,
          version_id: version.id,
          media_type: mediaType,
          title: basename,
          url: publicData.publicUrl,
          storage_path: path,
          sort_order: media.length + inserted.length,
        });
      }

      const { data, error } = await supabase.from('ai_pilot_media').insert(inserted).select('*');
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey });
      if (data?.[0]?.id) setEditingId(data[0].id);
    } catch (error) {
      alert(error?.message || 'Unable to upload AI Pilot media');
    } finally {
      setUploading(false);
    }
  };

  if (!version) return <div className="text-sm text-white/40">Select an AI Pilot version to manage media.</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="text-sm text-white">AI Pilot Media</div>
          <div className="text-xs text-white/40 mt-1">Official image, audio and video references distributed with this AI Pilot.</div>
        </div>
        <label>
          <input type="file" accept="image/*,audio/*,video/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
          <span className={`h-10 px-4 inline-flex items-center justify-center gap-2 text-sm cursor-pointer ${PRIMARY_BUTTON_CLASS} ${uploading ? 'opacity-50 pointer-events-none' : ''}`}><Upload size={15} /> {uploading ? 'Uploading…' : 'Add media'}</span>
        </label>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_360px] gap-5">
        <div>
          {isLoading ? <div className="text-sm text-white/40">Loading media…</div> : media.length ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {media.map((item) => {
                const Icon = item.media_type === 'video' ? Video : item.media_type === 'audio' ? Music2 : Image;
                return (
                  <button key={item.id} type="button" onClick={() => setEditingId(item.id)} className={`text-left border overflow-hidden ${editingId === item.id ? 'border-[var(--studio-accent)] bg-white/[0.05]' : 'border-white/10 bg-white/[0.02] hover:border-white/25'}`}>
                    <div className="aspect-video bg-black/35 overflow-hidden"><MediaPreview item={item} /></div>
                    <div className="p-3">
                      <div className="flex items-center gap-2"><Icon size={14} className="text-white/45 shrink-0" /><div className="text-sm text-white truncate">{item.title || 'Untitled media'}</div></div>
                      <div className="text-[11px] text-white/35 mt-1 capitalize">{item.media_type}{item.component_type ? ` · ${item.component_type.replaceAll('_', ' ')}` : ' · General'}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="border border-dashed border-white/15 min-h-[260px] flex items-center justify-center text-center px-6">
              <div><Plus size={24} className="mx-auto text-white/25" /><div className="text-sm text-white/55 mt-3">No AI Pilot media yet</div><div className="text-xs text-white/30 mt-1">Add reference images, audio or video for this Pilot.</div></div>
            </div>
          )}
        </div>

        <div className="border border-white/10 bg-white/[0.02] p-4 self-start">
          {draft ? (
            <div className="space-y-4">
              <div className="aspect-video border border-white/10 bg-black/35 overflow-hidden"><MediaPreview item={draft} /></div>
              <label className="space-y-2 block"><span className="text-xs text-white/55">Title</span><Input className={CONTROL_CLASS} value={draft.title || ''} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
              <label className="space-y-2 block"><span className="text-xs text-white/55">Description</span><Textarea className={CONTROL_CLASS} rows={3} value={draft.description || ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
              <label className="space-y-2 block"><span className="text-xs text-white/55">How AI should use this reference</span><Textarea className={CONTROL_CLASS} rows={3} value={draft.usage_note || ''} onChange={(e) => setDraft({ ...draft, usage_note: e.target.value })} /></label>
              <label className="space-y-2 block"><span className="text-xs text-white/55">Associated component</span><Select value={draft.component_type || 'general'} onValueChange={(value) => setDraft({ ...draft, component_type: value, component_key: value === 'general' ? '' : draft.component_key })}><SelectTrigger className={SELECT_TRIGGER_CLASS}><SelectValue /></SelectTrigger><SelectContent>{COMPONENT_TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></label>
              {draft.component_type !== 'general' && <label className="space-y-2 block"><span className="text-xs text-white/55">Component key / name</span><Input className={CONTROL_CLASS} value={draft.component_key || ''} onChange={(e) => setDraft({ ...draft, component_key: e.target.value })} placeholder="Example: Palace Terrace, Amara, Look 01" /></label>}
              <div className="flex items-center justify-between gap-3 pt-2">
                <Button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => deleteItem.mutate(draft)} disabled={deleteItem.isPending}><Trash2 size={15} className="mr-2" /> Remove</Button>
                <Button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => saveItem.mutate()} disabled={saveItem.isPending}><Save size={15} className="mr-2" /> {saveItem.isPending ? 'Saving…' : 'Save media'}</Button>
              </div>
            </div>
          ) : <div className="min-h-[240px] flex items-center justify-center text-sm text-white/35 text-center px-4">Select a media item to edit its production reference information.</div>}
        </div>
      </div>
    </div>
  );
}
