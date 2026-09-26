import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Upload, Loader2, CheckCircle2, Film, Music, FolderOpen } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import VaultPickerModal from '@/components/studio/VaultPickerModal';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';

const DURATIONS = ['5s', '10s'];
const RATIOS = ['9:16', '16:9', '1:1', '4:3'];

export default function AnimateImage({ onComplete, onClose, episodePageId, blockId, user, initialPrompt, embedded = false }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [imageName, setImageName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [duration, setDuration] = useState('5s');
  const [ratio, setRatio] = useState('16:9');
  const [prompt, setPrompt] = useState(initialPrompt || '');
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioName, setAudioName] = useState('');
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showVaultPicker, setShowVaultPicker] = useState(false);
  const [showSaveVault, setShowSaveVault] = useState(false);

  const handleUploadImage = async (file) => {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setImageUrl(file_url);
    setImageName(file.name);
    setUploading(false);
  };

  const handleUploadAudio = async (file) => {
    setUploadingAudio(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setAudioUrl(file_url);
    setAudioName(file.name);
    setUploadingAudio(false);
  };

  const handleGenerate = async () => {
    if (!imageUrl) return;
    setIsGenerating(true);
    try {
      const res = await base44.functions.invoke('replicateGenerate', {
        method: 'animate_image',
        photo_url: imageUrl,
        duration,
        aspect_ratio: ratio,
        prompt: prompt || undefined,
        audio_url: audioUrl || undefined,
      });
      if (res.data?.file_url) {
        setResult(res.data.file_url);
      } else {
        toast.error(res.data?.error || 'Animation failed');
      }
    } catch (e) {
      const msg = e.response?.data?.message || e.response?.data?.error;
      toast.error(msg?.includes('Insufficient tokens') ? 'Not enough tokens. Please buy more.' : (msg || 'Animation failed'));
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
    <div className={`fixed bg-black/80 z-[100] flex items-center justify-center p-4 ${embedded ? 'top-14 right-0 bottom-[64px] left-0 lg:bottom-0 lg:left-[var(--studio-toolbar-width)]' : 'inset-0'}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-yellow-400 rounded-3xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-black text-xl font-bold flex items-center gap-2">
              <Film className="w-5 h-5" />
              Animate Image
            </h3>
            <p className="text-black text-sm">Bring a still image to life with AI motion</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-black/10 rounded-full transition-colors">
            <X size={20} className="text-black" />
          </button>
        </div>

        {/* Image Upload */}
        <div className="mb-4">
          <p className="text-black text-xs font-bold uppercase tracking-wider mb-2">Image</p>
          {imageUrl ? (
            <div className="relative">
              <img src={imageUrl} alt="Preview" className="w-full h-48 object-cover rounded-2xl" />
              <button onClick={() => { setImageUrl(null); setImageName(''); }}
                className="absolute top-2 right-2 p-1.5 bg-black/70 rounded-full hover:bg-black transition-colors">
                <X size={14} className="text-white" />
              </button>
              <div className="mt-1.5 flex items-center gap-2 text-black text-xs">
                <CheckCircle2 size={12} className="text-green-600" />
                {imageName}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="flex flex-col items-center gap-3 py-8 border-2 border-dashed border-black/30 rounded-2xl cursor-pointer hover:border-black/60 transition-colors">
                {uploading ? <Loader2 size={28} className="animate-spin text-black" /> : <Upload size={28} className="text-black" />}
                <span className="text-black text-sm font-medium">{uploading ? 'Uploading…' : 'Upload an image to animate'}</span>
                <input type="file" accept="image/*" className="hidden" disabled={uploading}
                  onChange={e => e.target.files?.[0] && handleUploadImage(e.target.files[0])} />
              </label>
              <button onClick={() => setShowVaultPicker(true)}
                className="w-full py-2.5 bg-black/10 hover:bg-black/20 rounded-xl text-black text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                <FolderOpen size={16} /> Pick from Vault
              </button>
            </div>
          )}
        </div>

        {/* Duration & Ratio */}
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-black text-xs font-bold uppercase tracking-wider mb-2">Duration</p>
            <div className="flex gap-2">
              {DURATIONS.map(d => (
                <button key={d} onClick={() => setDuration(d)}
                  className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${duration === d ? 'bg-black text-yellow-400' : 'bg-black/10 text-black'}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-black text-xs font-bold uppercase tracking-wider mb-2">Aspect Ratio</p>
            <div className="flex gap-2 flex-wrap">
              {RATIOS.map(r => (
                <button key={r} onClick={() => setRatio(r)}
                  className={`px-3 py-2 rounded-xl font-bold text-xs transition-all ${ratio === r ? 'bg-black text-yellow-400' : 'bg-black/10 text-black'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Prompt */}
        <div className="mb-4">
          <p className="text-black text-xs font-bold uppercase tracking-wider mb-2">Motion Prompt <span className="font-normal normal-case">(optional)</span></p>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Describe the motion… e.g. 'slow zoom in', 'hair blowing in the wind', 'camera pan left'"
            rows={3}
            className="w-full bg-black/10 border border-black/15 rounded-xl px-4 py-3 text-black text-sm placeholder-black/30 focus:outline-none focus:border-black/40 resize-none"
          />
        </div>

        {/* Audio Upload */}
        <div className="mb-5">
          <p className="text-black text-xs font-bold uppercase tracking-wider mb-2">Audio <span className="font-normal normal-case">(optional)</span></p>
          {audioUrl ? (
            <div className="flex items-center gap-3 px-4 py-3 bg-black/10 rounded-xl">
              <Music size={16} className="text-black flex-shrink-0" />
              <span className="text-black text-sm flex-1 truncate">{audioName}</span>
              <audio src={audioUrl} controls className="h-7 flex-shrink-0" style={{ width: 120 }} />
              <button onClick={() => { setAudioUrl(null); setAudioName(''); }} className="text-black hover:text-black ml-1">
                <X size={14} />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-3 px-4 py-3 bg-black/10 rounded-xl cursor-pointer hover:bg-black/15 transition-colors">
              {uploadingAudio ? <Loader2 size={16} className="animate-spin text-black" /> : <Music size={16} className="text-black" />}
              <span className="text-black text-sm">{uploadingAudio ? 'Uploading audio…' : 'Add background audio / music'}</span>
              <input type="file" accept="audio/*" className="hidden" disabled={uploadingAudio}
                onChange={e => e.target.files?.[0] && handleUploadAudio(e.target.files[0])} />
            </label>
          )}
        </div>

        {/* Generate */}
        {!result && (
          <button onClick={handleGenerate} disabled={!imageUrl || isGenerating}
            className="w-full py-4 bg-black text-yellow-400 font-bold rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2">
            {isGenerating
              ? <><Loader2 size={18} className="animate-spin" /> Animating… (~1–3 min)</>
              : <><Film size={18} /> Animate Image</>}
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
      </motion.div>

      {showVaultPicker && (
        <VaultPickerModal
          userEmail={user?.email}
          onClose={() => setShowVaultPicker(false)}
          onSelect={(url) => {
            setImageUrl(url);
            setImageName('Vault image');
            setShowVaultPicker(false);
          }}
        />
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
      </div>
      );
      }