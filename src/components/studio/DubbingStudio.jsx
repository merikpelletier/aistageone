import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, Video, Volume2, X, Loader2, Combine, CheckCircle2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import VoiceRecorder from './VoiceRecorder';
import ProductionContextInfo from '@/components/ProductionContextInfo';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';

export default function DubbingStudio({ block, dossier, onClose, onComplete, productionMethod = null, character = null, episodePageId, blockId, user, embedded = false }) {
  const showContext = productionMethod && block;
  const [voiceUrl, setVoiceUrl] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [showRecorder, setShowRecorder] = useState(false);
  const [isMixing, setIsMixing] = useState(false);
  const [mixedResult, setMixedResult] = useState(null);
  const [showSaveVault, setShowSaveVault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleVoiceRecorded = (url) => {
    setVoiceUrl(url);
    setShowRecorder(false);
  };

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
      const response = await base44.functions.invoke('mixAudioVideo', {
        audio_url: voiceUrl,
        video_url: videoUrl,
      });

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
    if (!user?.email) {
      onComplete(mixedResult);
      return;
    }
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
          await base44.entities.UserTimeline.create({
            episode_page_id: episodePageId,
            user_email: user.email,
            block_overrides: [videoOverride],
          });
        } else {
          const otherBlocks = (timeline.block_overrides || []).filter(item => item.block_id !== blockId);
          await base44.entities.UserTimeline.update(timeline.id, { block_overrides: [...otherBlocks, videoOverride] });
        }
        toast.success('Dubbed video saved to your Vault & episode!');
      } catch (error) {
        console.error('Error attaching dubbed video to episode:', error);
        toast.error('Saved to Vault, but failed to attach to episode');
      } finally {
        setIsSaving(false);
      }
    }
    onComplete(mixedResult);
  };

  return (
    <div className={`fixed z-[100] ${embedded ? 'top-14 right-0 bottom-[64px] left-0 lg:bottom-0 lg:left-[var(--studio-toolbar-width)] bg-yellow-400 overflow-y-auto' : 'inset-0 bg-black/80 flex items-center justify-center p-4'}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={embedded ? 'bg-yellow-400 min-h-full w-full p-5 md:p-8 overflow-y-auto' : 'bg-yellow-400 rounded-3xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto'}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-black text-xl font-bold">Dubbing Studio</h3>
            <p className="text-black text-sm">Add your voice to a video</p>
          </div>
          {!embedded && (
            <button onClick={onClose} className="p-2 hover:bg-black/10 rounded-full transition-colors">
              <X size={20} className="text-black" />
            </button>
          )}
        </div>

        {showContext && (
          <ProductionContextInfo
            productionMethod={productionMethod}
            block={block}
            character={character}
            referenceMedia={[]}
          />
        )}

        <div className="mb-6">
          <p className="text-black font-semibold mb-3 flex items-center gap-2">
            <Mic size={16} />
            1. Your Voice
          </p>
          <div className="bg-black rounded-2xl p-4">
            {!voiceUrl ? (
              <div className="text-center">
                <Button
                  onClick={() => setShowRecorder(true)}
                  className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-3 px-6 rounded-xl"
                >
                  <Mic size={18} className="mr-2" />
                  Record Voice
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center">
                  <Volume2 size={18} className="text-black" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium mb-2">Voice recorded</p>
                  <audio src={voiceUrl} controls className="w-full" />
                </div>
                <button onClick={() => setVoiceUrl(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={16} className="text-white" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mb-6">
          <p className="text-black font-semibold mb-3 flex items-center gap-2">
            <Video size={16} />
            2. Video
          </p>
          <div className="bg-black rounded-2xl p-4">
            {!videoUrl ? (
              <div className="text-center">
                <label className="cursor-pointer">
                  <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
                  <div className="bg-white/10 hover:bg-white/20 rounded-xl py-3 px-6 transition-colors">
                    <Upload size={18} className="text-white inline mr-2" />
                    <span className="text-white font-medium">Upload Video</span>
                  </div>
                </label>
              </div>
            ) : (
              <div>
                <video src={videoUrl} controls className="w-full rounded-xl mb-3 max-h-64" />
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center">
                    <Video size={18} className="text-black" />
                  </div>
                  <p className="text-white text-sm font-medium flex-1">Video loaded</p>
                  <button onClick={() => setVideoUrl(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <X size={16} className="text-white" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {voiceUrl && videoUrl && !mixedResult && (
          <Button
            onClick={handleMix}
            disabled={isMixing}
            className="w-full bg-black hover:bg-black/90 text-yellow-400 font-bold py-4 rounded-2xl mb-4"
          >
            {isMixing ? (
              <><Loader2 size={20} className="mr-2 animate-spin" /> Creating dubbed video...</>
            ) : (
              <><Combine size={20} className="mr-2" /> Create Dubbed Video</>
            )}
          </Button>
        )}

        {mixedResult && (
          <div className="bg-black rounded-2xl p-6 mb-4 text-center">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Video size={28} className="text-white" />
            </div>
            <p className="text-white font-semibold mb-2">Dubbing Complete!</p>
            <p className="text-white text-sm mb-4">Your voice has been added to the video</p>
            <video src={mixedResult} controls className="w-full rounded-xl" />
          </div>
        )}

        {mixedResult && (
          <Button
            onClick={handleUseVideo}
            disabled={isSaving}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-2xl disabled:opacity-50"
          >
            {isSaving ? (
              <><Loader2 size={20} className="mr-2 animate-spin" /> Saving...</>
            ) : (
              <><CheckCircle2 size={20} className="mr-2" /> Use Dubbed Video</>
            )}
          </Button>
        )}

        {showSaveVault && (
          <SaveToVaultModal
            userEmail={user?.email}
            imageUrl={mixedResult}
            mediaType="video"
            onClose={() => setShowSaveVault(false)}
            onSaved={handleVaultSaved}
          />
        )}

        {showRecorder && (
          <VoiceRecorder
            onRecordingComplete={handleVoiceRecorded}
            onClose={() => setShowRecorder(false)}
          />
        )}
      </motion.div>
    </div>
  );
}
