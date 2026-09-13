import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, X, Loader2, Trash2, Film, Music, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

function getMediaType(url) {
  if (!url) return 'image';
  if (/\.(mp4|webm|mov|avi)(\?|$)/i.test(url)) return 'video';
  if (/\.(mp3|wav|ogg|m4a|aac|flac)(\?|$)/i.test(url)) return 'audio';
  return 'image';
}

function MediaThumbnail({ url, onRemove }) {
  const type = getMediaType(url);
  const Icon = type === 'video' ? Film : type === 'audio' ? Music : ImageIcon;

  return (
    <div className="relative group bg-neutral-800 border border-white/10 rounded-sm overflow-hidden aspect-square">
      {type === 'image' && (
        <img src={url} alt="" className="w-full h-full object-cover" />
      )}
      {type === 'video' && (
        <video src={url} className="w-full h-full object-cover" muted />
      )}
      {type === 'audio' && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
          <Icon size={28} className="text-yellow-400" />
          <audio src={url} controls className="w-[90%] h-8" />
        </div>
      )}
      {type !== 'audio' && (
        <div className="absolute top-1 left-1 bg-black/70 rounded-sm px-1.5 py-0.5">
          <Icon size={12} className="text-white" />
        </div>
      )}
      <button
        onClick={onRemove}
        className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-500 rounded-sm p-1 transition-colors"
      >
        <Trash2 size={12} className="text-white" />
      </button>
    </div>
  );
}

export default function ThemeMediaManager({ theme, onBack }) {
  const [media, setMedia] = useState(theme.media_urls || []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploadedUrls = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        uploadedUrls.push(file_url);
      }
      const updated = [...media, ...uploadedUrls];
      setMedia(updated);
      await base44.admin.setStoryThemeMedia(theme.id, updated);
      toast.success(`${uploadedUrls.length} file(s) uploaded`);
    } catch (e) {
      toast.error('Upload failed');
    }
    setUploading(false);
  };

  const handleRemove = async (index) => {
    const updated = media.filter((_, i) => i !== index);
    setMedia(updated);
    setSaving(true);
    try {
      await base44.admin.setStoryThemeMedia(theme.id, updated);
      toast.success('Media removed');
    } catch {
      toast.error('Failed to remove media');
      setMedia(media);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-white hover:text-white text-sm">
        <ArrowLeft size={16} /> Back to themes
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white text-lg font-light tracking-wider">THEME MEDIA</h2>
          <p className="text-white text-xs">For: {theme.title}</p>
        </div>
        <label className="cursor-pointer">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black text-sm rounded-sm hover:bg-white/90 transition-colors">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {uploading ? 'Uploading…' : 'Upload Media'}
          </span>
          <input
            type="file"
            accept="image/*,video/*,audio/*"
            multiple
            className="hidden"
            onChange={e => { const fs = Array.from(e.target.files); if (fs.length) handleUpload(fs); e.target.value = ''; }}
          />
        </label>
      </div>

      <p className="text-white text-xs">
        Upload videos, audio files, or images related to this theme. These assets can be used as reference material for story generation.
      </p>

      {media.length === 0 ? (
        <div className="bg-neutral-900 border border-white/10 rounded-sm p-12 text-center">
          <Film size={32} className="text-white/20 mx-auto mb-3" />
          <p className="text-white text-sm">No media yet. Upload videos, audios, or images.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {media.map((url, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <MediaThumbnail url={url} onRemove={() => handleRemove(i)} />
            </motion.div>
          ))}
        </div>
      )}

      {saving && (
        <p className="text-white text-xs flex items-center gap-2">
          <Loader2 size={12} className="animate-spin" /> Saving…
        </p>
      )}
    </div>
  );
}
