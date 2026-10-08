import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, Video, Volume2, X, Loader2, Combine, CheckCircle2, Upload } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import VoiceRecorder from './VoiceRecorder';
import ProductionContextInfo from '@/components/ProductionContextInfo';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';

export default function DubbingStudio({ block, dossier, onClose, onComplete, productionMethod = null, character = null, episodePageId, blockId, user, embedded = false, inline = false }) {
  const showContext = productionMethod && block;
  const [voiceUrl, setVoiceUrl] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [showRecorder, setShowRecorder] = useState(false);
  const [isMixing, setIsMixing] = useState(false);
  const [mixedResult, setMixedResult] = useState(null);
  const [showSaveVault, setShowSaveVault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleVoiceRecorded = (url) => { setVoiceUrl(url); setShowRecorder(false); };

  const handleVideoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      setVideoUrl(result.file_url);
    } catch (error) {
      toast.error(error?.message || 'Failed to upload video');
    }
  };

  const handleMix = async () => {
    if (!voiceUrl || !videoUrl) return;
    setIsMixing(true);
    try {
      const response = await base44.functions.invoke('mixAudioVideo', { audio_url: voiceUrl, video_url: videoUrl });
      if (!response.data?.file_url) throw new Error('The dubbing service returned no video');
      setMixedResult(response.data.file_url);
    } catch (error) {
      const msg = error.response?.data?.message || error.response?.data?.error || error.message;
      toast.error(msg?.includes('Insufficient tokens') ? 'Not enough tokens. Please buy more.' : (msg || 'Failed to create dubbed video'));
    } finally {
      setIsMixing(false);
    }
  };

  const handleUseVideo = () => {
    if (!mixedResult) return;
    if (!user?.email) return onComplete(mixedResult);
    setShowSaveVault(true);
  };

  const handleVaultSaved = async () => {
    setShowSaveVault(false);
    if (episodePageId && blockId && user?.email) {
      setIsSaving(true);
      try {
        const timelines = await base44.entities.UserTimeline.filter({ episode_page_id: episodePageId, user_email: user.email });
        const timeline = timelines[0];
        const videoOverride = { block_id: blockId, user_media_url: mixedResult, status: 'uploaded' };
        if (!timeline) {
          await base44.entities.UserTimeline.create({ episode_page_id: episodePageId, user_email: user.email, block_overrides: [videoOverride] });
        } else {
          const otherBlocks = (timeline.block_overrides || []).filter(item => item.block_id !== blockId);
          await base44.entities.UserTimeline.update(timeline.id, { block_overrides: [...otherBlocks, videoOverride] });
        }
        toast.success('Dubbed video saved to your Vault & episode!');
      } catch (error) {
        console.error(error);
        toast.error('Saved to Vault, but failed to attach to episode');
      } finally {
        setIsSaving(false);
      }
    }
    onComplete(mixedResult);
  };

  const shell = inline
    ? 'relative w-full'
    : `fixed z-[100] ${embedded ? 'top-14 right-0 bottom-[64px] left-0 lg:bottom-0 lg:left-[var(--studio-toolbar-width)] overflow-y-auto bg-[#202328]' : 'inset-0 flex items-center justify-center bg-black/80 p-4'}`;

  const panel = inline
    ? 'w-full bg-[#202328] p-4 text-white md:p-5'
    : embedded
      ? 'min-h-full w-full overflow-y-auto bg-[#202328] p-5 pb-28 text-white md:p-8 lg:pb-32'
      : 'max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[4px] border border-white/10 bg-[#202328] p-6 text-white';

  return (
    <div className={shell}>
      <motion.div initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .98 }} className={panel}>
        <div className="mx-auto max-w-5xl">
          <header className="mb-5 flex items-center justify-between border-b border-white/10 bg-[#17191d] px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[3px] border border-[#23c7be]/30 bg-[#23c7be]/10 text-[#23c7be]"><Volume2 size={19} /></div>
              <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#23c7be]">Sound & Voice</p><h3 className="text-xl font-black">Dubbing Studio</h3><p className="text-xs text-white/45">Add your voice to a video.</p></div>
            </div>
            {!embedded && !inline && <button onClick={onClose} className="rounded-[3px] border border-white/10 bg-white/[.04] p-2 hover:bg-white/10"><X size={20} /></button>}
          </header>

          {showContext && <ProductionContextInfo productionMethod={productionMethod} block={block} character={character} referenceMedia={[]} />}

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
              <div className="mb-3 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-[3px] border border-[#23c7be]/30 bg-[#23c7be]/10 text-xs font-black text-[#8ee9e4]">1</span><div><p className="text-sm font-black">Your Voice</p><p className="text-xs text-white/40">Record the dialogue you want to add.</p></div></div>
              {!voiceUrl ? (
                <button onClick={() => setShowRecorder(true)} className="flex min-h-[160px] w-full flex-col items-center justify-center gap-3 rounded-[4px] border border-dashed border-white/15 bg-black/20 text-white transition hover:border-[#23c7be]/50 hover:bg-black/30">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[3px] border border-[#23c7be]/30 bg-[#23c7be]/10 text-[#23c7be]"><Mic size={24} /></div>
                  <span className="text-sm font-black">Record Voice</span>
                </button>
              ) : (
                <div className="rounded-[4px] border border-white/10 bg-black/20 p-3"><div className="mb-3 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-[3px] border border-[#23c7be]/30 bg-[#23c7be]/10 text-[#23c7be]"><Volume2 size={18} /></div><div className="min-w-0 flex-1"><p className="text-sm font-black">Voice recorded</p><p className="text-xs text-white/40">Ready for dubbing</p></div><button onClick={() => setVoiceUrl(null)} className="rounded-[3px] border border-white/10 bg-white/[.04] p-2 text-white/60 hover:bg-white/10"><X size={15} /></button></div><audio src={voiceUrl} controls className="w-full" /></div>
              )}
            </section>

            <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
              <div className="mb-3 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-[3px] border border-[#23c7be]/30 bg-[#23c7be]/10 text-xs font-black text-[#8ee9e4]">2</span><div><p className="text-sm font-black">Video</p><p className="text-xs text-white/40">Choose the video that receives the voice.</p></div></div>
              {!videoUrl ? (
                <label className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[4px] border border-dashed border-white/15 bg-black/20 text-white transition hover:border-[#23c7be]/50 hover:bg-black/30">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[3px] border border-[#23c7be]/30 bg-[#23c7be]/10 text-[#23c7be]"><Upload size={24} /></div>
                  <span className="text-sm font-black">Upload Video</span><span className="text-xs text-white/35">MP4, WebM, MOV</span>
                  <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
                </label>
              ) : (
                <div className="rounded-[4px] border border-white/10 bg-black/20 p-3"><video src={videoUrl} controls className="mb-3 max-h-[300px] w-full rounded-[3px] bg-black" /><div className="flex items-center gap-3"><Video size={18} className="text-[#23c7be]" /><span className="flex-1 text-sm font-black">Video loaded</span><button onClick={() => setVideoUrl(null)} className="rounded-[3px] border border-white/10 bg-white/[.04] p-2 text-white/60 hover:bg-white/10"><X size={15} /></button></div></div>
              )}
            </section>
          </div>

          {voiceUrl && videoUrl && !mixedResult && (
            <section className="mt-4 rounded-[4px] border border-white/10 bg-[#17191d] p-4">
              <div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-black">Ready to combine</p><p className="text-xs text-white/40">The recorded voice will be mixed with the selected video.</p></div><Combine size={18} className="text-[#23c7be]" /></div>
              <button onClick={handleMix} disabled={isMixing} className="flex w-full items-center justify-center gap-2 rounded-[3px] bg-[#23c7be] py-3.5 text-sm font-black text-[#071211] hover:bg-[#35d8cf] disabled:bg-white/[.05] disabled:text-white/30">{isMixing ? <><Loader2 size={18} className="animate-spin" /> Creating dubbed video…</> : <><Combine size={18} /> Create Dubbed Video</>}</button>
            </section>
          )}

          {mixedResult && (
            <section className="mt-4 rounded-[4px] border border-white/10 bg-[#17191d] p-4">
              <div className="mb-3 flex items-center gap-2"><CheckCircle2 size={18} className="text-[#23c7be]" /><div><p className="text-sm font-black">Dubbing complete</p><p className="text-xs text-white/40">Your voice has been added to the video.</p></div></div>
              <video src={mixedResult} controls className="w-full rounded-[3px] border border-white/10 bg-black" />
              <button onClick={handleUseVideo} disabled={isSaving} className="mt-4 flex w-full items-center justify-center gap-2 rounded-[3px] bg-[#23c7be] py-3.5 text-sm font-black text-[#071211] hover:bg-[#35d8cf] disabled:opacity-50">{isSaving ? <><Loader2 size={18} className="animate-spin" /> Saving…</> : <><CheckCircle2 size={18} /> Use Dubbed Video</>}</button>
            </section>
          )}
        </div>

        {showSaveVault && <SaveToVaultModal userEmail={user?.email} imageUrl={mixedResult} mediaType="video" onClose={() => setShowSaveVault(false)} onSaved={handleVaultSaved} />}
        {showRecorder && <VoiceRecorder onRecordingComplete={handleVoiceRecorded} onClose={() => setShowRecorder(false)} />}
      </motion.div>
    </div>
  );
}
