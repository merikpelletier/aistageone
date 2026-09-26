import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mic, Square, Play, Pause, Upload, X, Volume2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import ProductionContextInfo from '@/components/ProductionContextInfo';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function VoiceRecorder({ onRecordingComplete, onClose, productionMethod = null, block = null, character = null, episodePageId, blockId, user, embedded = false }) {
  // Only show production context if coming from a Dossier production
  const showContext = productionMethod && block;
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState(null);
  const [showSaveVault, setShowSaveVault] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioPlayerRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const togglePlayback = () => {
    if (!audioUrl) return;
    
    if (isPlaying) {
      audioPlayerRef.current.pause();
    } else {
      audioPlayerRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleUpload = async () => {
    if (!audioBlob) return;

    setIsUploading(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file: audioBlob });
      const fileUrl = result.file_url;
      setUploadedUrl(fileUrl);
      setIsUploading(false);

      if (!user?.email) { onRecordingComplete(fileUrl); return; }
      setShowSaveVault(true);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload audio');
    } finally {
      setIsUploading(false);
    }
  };

  // After the user picks a folder & the audio is saved to the Vault,
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
            block_overrides: [{ block_id: blockId, user_media_url: uploadedUrl, status: 'uploaded', notes: 'audio' }],
          });
        } else {
          const existingOverrides = timeline.block_overrides || [];
          const otherBlocks = existingOverrides.filter(b => b.block_id !== blockId);
          const updatedOverrides = [...otherBlocks, { block_id: blockId, user_media_url: uploadedUrl, status: 'uploaded', notes: 'audio' }];
          await base44.entities.UserTimeline.update(timeline.id, { block_overrides: updatedOverrides });
        }
        toast.success('Audio saved to your Vault & episode!');
      } catch (err) {
        console.error('Error attaching audio to episode:', err);
        toast.error('Saved to Vault, but failed to attach to episode');
      } finally {
        setIsSaving(false);
      }
    }
    onRecordingComplete(uploadedUrl);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleReset = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsPlaying(false);
  };

  return (
    <div className={`fixed bg-black/80 z-[100] flex items-center justify-center p-4 ${embedded ? 'top-14 right-0 bottom-[64px] left-0 lg:bottom-0 lg:left-[var(--studio-toolbar-width)]' : 'inset-0'}`}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-yellow-400 rounded-3xl p-8 max-w-md w-full"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-black text-xl font-bold">Voice Recorder</h3>
          <button onClick={onClose} className="p-2 hover:bg-black/10 rounded-full transition-colors">
            <X size={20} className="text-black" />
          </button>
        </div>

        {/* Production Context Info - Only show when in Dossier production mode */}
        {showContext && (
          <ProductionContextInfo
            productionMethod={productionMethod}
            block={block}
            character={character}
            referenceMedia={[]}
          />
        )}

        {/* Recording Display */}
        <div className="bg-black rounded-2xl p-8 mb-6 text-center">
          {/* Visualizer */}
          <div className="h-32 flex items-center justify-center gap-1 mb-6">
            {isRecording ? (
              [...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-1 bg-yellow-400 rounded-full"
                  animate={{
                    height: [8, 32 + Math.random() * 40, 8],
                  }}
                  transition={{
                    duration: 0.5,
                    repeat: Infinity,
                    delay: i * 0.05,
                  }}
                />
              ))
            ) : audioUrl ? (
              <audio
                ref={audioPlayerRef}
                src={audioUrl}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />
            ) : (
              <Mic size={64} className="text-white/20" />
            )}
          </div>

          {/* Timer */}
          <p className="text-yellow-400 text-4xl font-bold font-mono">
            {formatTime(recordingTime)}
          </p>

          {/* Status */}
          <p className="text-white text-sm mt-2">
            {isRecording ? 'Recording...' : audioUrl ? 'Ready to upload' : 'Tap mic to start'}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 mb-6">
          {!audioUrl ? (
            <>
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="w-16 h-16 bg-black rounded-full flex items-center justify-center hover:scale-105 transition-transform"
                >
                  <Mic size={24} className="text-yellow-400" />
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center hover:scale-105 transition-transform"
                >
                  <Square size={24} className="text-white" />
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={handleReset}
                className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <X size={20} className="text-black" />
              </button>
              <button
                onClick={togglePlayback}
                className="w-16 h-16 bg-black rounded-full flex items-center justify-center hover:scale-105 transition-transform"
              >
                {isPlaying ? (
                  <Pause size={24} className="text-yellow-400" />
                ) : (
                  <Play size={24} className="text-yellow-400" />
                )}
              </button>
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {isUploading ? (
                  <Loader2 size={20} className="text-white animate-spin" />
                ) : (
                  <Upload size={20} className="text-white" />
                )}
              </button>
            </>
          )}
        </div>

        {/* Upload Button */}
        {audioUrl && (
          <Button
            onClick={handleUpload}
            disabled={isUploading || isSaving}
            className="w-full bg-black hover:bg-black/90 text-yellow-400 font-bold py-4 rounded-2xl"
          >
            {isSaving ? 'Saving to Vault...' : isUploading ? 'Uploading...' : 'Upload Voice'}
          </Button>
        )}

        {/* Save-to-Vault folder picker */}
        {showSaveVault && uploadedUrl && (
          <SaveToVaultModal
            userEmail={user?.email}
            imageUrl={uploadedUrl}
            mediaType="audio"
            onClose={() => setShowSaveVault(false)}
            onSaved={handleVaultSaved}
          />
        )}
      </motion.div>
    </div>
  );
}