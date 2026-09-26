import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Upload, Loader2, CheckCircle2, Mic, Video } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';

export default function LipSync({ onComplete, onClose, episodePageId, blockId, user, embedded = false }) {
  const [videoUrl, setVideoUrl] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [videoName, setVideoName] = useState('');
  const [audioName, setAudioName] = useState('');
  const [uploading, setUploading] = useState({ video: false, audio: false });
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveVault, setShowSaveVault] = useState(false);

  const handleVideoUpload = async (file) => {
    setUploading(u => ({ ...u, video: true }));
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setVideoUrl(file_url);
    setVideoName(file.name);
    setUploading(u => ({ ...u, video: false }));
  };

  const handleAudioUpload = async (file) => {
    setUploading(u => ({ ...u, audio: true }));
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setAudioUrl(file_url);
    setAudioName(file.name);
    setUploading(u => ({ ...u, audio: false }));
  };

  const handleGenerate = async () => {
    if (!videoUrl || !audioUrl) return;
    setIsGenerating(true);
    try {
      const res = await base44.functions.invoke('replicateGenerate', {
        method: 'lip_sync',
        photo_url: videoUrl,
        audio_url: audioUrl,
      });
      if (res.data?.file_url) {
        setResult(res.data.file_url);
      } else {
        toast.error(res.data?.error || 'Lip sync failed');
      }
    } catch (e) {
      const msg = e.response?.data?.message || e.response?.data?.error;
      toast.error(msg?.includes('Insufficient tokens') ? 'Not enough tokens. Please buy more.' : (msg || 'Lip sync failed'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseVideo = () => {
    if (!result) return;
    if (!user?.email) { onComplete(result, 'video'); return; }
    setShowSaveVault(true);
  };

  // After the user picks a folder & the video is saved to the Vault,
  // also attach it to the scene's episode block (if launched from one).
  const handleVaultSaved = async () => {
    setShowSaveVault(false);
    if (episodePageId && blockId && user?.email) {
      setIsSaving(true);
      try {
        const timelines = await base44.entities.UserTimeline.filter({ episode_page_id: episodePageId, user_email: user.email });
        let timeline = timelines[0];
        if (!timeline) {
          await base44.entities.UserTimeline.create({
            episode_page_id: episodePageId,
            user_email: user.email,
            block_overrides: [{ block_id: blockId, user_media_url: result, status: 'uploaded' }],
          });
        } else {
          const existingOverrides = timeline.block_overrides || [];
          const otherBlocks = existingOverrides.filter(b => b.block_id !== blockId);
          const updatedOverrides = [...otherBlocks, { block_id: blockId, user_media_url: result, status: 'uploaded' }];
          await base44.entities.UserTimeline.update(timeline.id, { block_overrides: updatedOverrides });
        }
        toast.success('Video saved to your Vault & episode!');
      } catch (err) {
        console.error('Error attaching video to episode:', err);
        toast.error('Saved to Vault, but failed to attach to episode');
      } finally {
        setIsSaving(false);
      }
    }
    onComplete(result, 'video');
  };

  return (
    <div className={`fixed z-[100] ${embedded ? 'top-14 right-0 bottom-[64px] left-0 lg:bottom-0 lg:left-[var(--studio-toolbar-width)] bg-yellow-400 overflow-y-auto' : 'inset-0 bg-black/80 flex items-center justify-center p-4'}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={embedded ? 'bg-yellow-400 min-h-full w-full p-5 md:p-8 overflow-y-auto' : 'bg-yellow-400 rounded-3xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto'}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-black text-xl font-bold flex items-center gap-2">
              <Mic className="w-5 h-5" />
              Lip Sync
            </h3>
            <p className="text-black text-sm">Sync audio to a video automatically</p>
          </div>
          {!embedded && (
            <button onClick={onClose} className="p-2 hover:bg-black/10 rounded-full transition-colors">
              <X size={20} className="text-black" />
            </button>
          )}
        </div>

        {/* Video Upload */}
        <div className="mb-5">
          <p className="text-black font-semibold mb-2 flex items-center gap-2"><Video size={16} /> Video</p>
          {videoUrl ? (
            <div className="flex items-center gap-3 p-3 bg-black/10 rounded-xl">
              <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
              <span className="text-black text-sm truncate flex-1">{videoName}</span>
              <button onClick={() => { setVideoUrl(null); setVideoName(''); }} className="text-black hover:text-black"><X size={14} /></button>
            </div>
          ) : (
            <label className="flex flex-col items-center gap-2 py-6 border-2 border-dashed border-black/30 rounded-xl cursor-pointer hover:border-black/60 transition-colors">
              {uploading.video ? <Loader2 size={24} className="animate-spin text-black" /> : <Upload size={24} className="text-black" />}
              <span className="text-black text-sm">{uploading.video ? 'Uploading…' : 'Upload video'}</span>
              <input type="file" accept="video/*" className="hidden" disabled={uploading.video} onChange={e => e.target.files?.[0] && handleVideoUpload(e.target.files[0])} />
            </label>
          )}
        </div>

        {/* Audio Upload */}
        <div className="mb-6">
          <p className="text-black font-semibold mb-2 flex items-center gap-2"><Mic size={16} /> Audio</p>
          {audioUrl ? (
            <div className="flex items-center gap-3 p-3 bg-black/10 rounded-xl">
              <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
              <span className="text-black text-sm truncate flex-1">{audioName}</span>
              <audio src={audioUrl} controls className="h-8 flex-1 min-w-0" />
              <button onClick={() => { setAudioUrl(null); setAudioName(''); }} className="text-black hover:text-black flex-shrink-0"><X size={14} /></button>
            </div>
          ) : (
            <label className="flex flex-col items-center gap-2 py-6 border-2 border-dashed border-black/30 rounded-xl cursor-pointer hover:border-black/60 transition-colors">
              {uploading.audio ? <Loader2 size={24} className="animate-spin text-black" /> : <Upload size={24} className="text-black" />}
              <span className="text-black text-sm">{uploading.audio ? 'Uploading…' : 'Upload audio (mp3, wav, webm…)'}</span>
              <input type="file" accept="audio/*" className="hidden" disabled={uploading.audio} onChange={e => e.target.files?.[0] && handleAudioUpload(e.target.files[0])} />
            </label>
          )}
        </div>

        {/* Generate */}
        {!result && (
          <button onClick={handleGenerate} disabled={!videoUrl || !audioUrl || isGenerating}
            className="w-full py-4 bg-black text-yellow-400 font-bold rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2">
            {isGenerating ? <><Loader2 size={18} className="animate-spin" /> Syncing… (~1–3 min)</> : <><Mic size={18} /> Generate Lip Sync</>}
          </button>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-4">
            <div className="bg-black rounded-2xl overflow-hidden">
              <video src={result} controls className="w-full" />
            </div>
            <button onClick={handleUseVideo} disabled={isSaving}
              className="w-full py-4 bg-green-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50">
              {isSaving ? <><Loader2 size={18} className="animate-spin" /> Saving…</> : <><CheckCircle2 size={18} /> Use This Video</>}
            </button>
          </div>
        )}

        {showSaveVault && (
          <SaveToVaultModal
            userEmail={user?.email}
            imageUrl={result}
            mediaType="video"
            onClose={() => setShowSaveVault(false)}
            onSaved={handleVaultSaved}
          />
        )}
      </motion.div>
    </div>
  );
}