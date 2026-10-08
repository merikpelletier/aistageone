import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, Square, Play, Pause, Upload, X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import ProductionContextInfo from '@/components/ProductionContextInfo';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function VoiceRecorder({ onRecordingComplete, onClose, productionMethod = null, block = null, character = null, episodePageId, blockId, user, embedded = false }) {
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
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(v => v + 1), 1000);
    } catch (error) {
      console.error(error);
      toast.error('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || !isRecording) return;
    recorder.stop();
    recorder.stream.getTracks().forEach(track => track.stop());
    clearInterval(timerRef.current);
    setIsRecording(false);
  };

  const togglePlayback = () => {
    if (!audioPlayerRef.current || !audioUrl) return;
    if (isPlaying) audioPlayerRef.current.pause();
    else audioPlayerRef.current.play();
    setIsPlaying(v => !v);
  };

  const handleUpload = async () => {
    if (!audioBlob) return;
    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: audioBlob });
      setUploadedUrl(file_url);
      if (!user?.email) return onRecordingComplete(file_url);
      setShowSaveVault(true);
    } catch (error) {
      console.error(error);
      toast.error('Failed to upload audio');
    } finally {
      setIsUploading(false);
    }
  };

  const handleVaultSaved = async () => {
    setShowSaveVault(false);
    if (episodePageId && blockId && user?.email) {
      setIsSaving(true);
      try {
        const timelines = await base44.entities.UserTimeline.filter({ episode_page_id: episodePageId, user_email: user.email });
        const timeline = timelines[0];
        const override = { block_id: blockId, user_media_url: uploadedUrl, status: 'uploaded', notes: 'audio' };
        if (!timeline) {
          await base44.entities.UserTimeline.create({ episode_page_id: episodePageId, user_email: user.email, block_overrides: [override] });
        } else {
          const others = (timeline.block_overrides || []).filter(b => b.block_id !== blockId);
          await base44.entities.UserTimeline.update(timeline.id, { block_overrides: [...others, override] });
        }
        toast.success('Audio saved to your Vault & episode!');
      } catch (error) {
        console.error(error);
        toast.error('Saved to Vault, but failed to attach to episode');
      } finally {
        setIsSaving(false);
      }
    }
    onRecordingComplete(uploadedUrl);
  };

  const reset = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsPlaying(false);
  };

  return (
    <div className={`fixed z-[100] ${embedded ? 'top-14 right-0 bottom-[64px] left-0 lg:bottom-0 lg:left-[var(--studio-toolbar-width)] overflow-y-auto bg-[#202328]' : 'inset-0 flex items-center justify-center bg-black/80 p-4'}`}>
      <motion.div initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .98 }} className={embedded ? 'min-h-full w-full bg-[#202328] p-5 pb-28 text-white md:p-8 lg:pb-32' : 'w-full max-w-3xl rounded-[4px] border border-white/10 bg-[#202328] p-6 text-white'}>
        <div className="mx-auto max-w-5xl">
          <header className="mb-5 flex items-center justify-between border-b border-white/10 bg-[#17191d] px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[3px] border border-[#23c7be]/30 bg-[#23c7be]/10 text-[#23c7be]"><Mic size={19} /></div>
              <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#23c7be]">Sound & Voice</p><h3 className="text-xl font-black">Voice Recorder</h3><p className="text-xs text-white/45">Record dialogue or voice directly in the Studio.</p></div>
            </div>
            {!embedded && <button onClick={onClose} className="rounded-[3px] border border-white/10 bg-white/[.04] p-2 hover:bg-white/10"><X size={20} /></button>}
          </header>

          {showContext && <ProductionContextInfo productionMethod={productionMethod} block={block} character={character} referenceMedia={[]} />}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
            <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-[4px] border border-white/10 bg-black/25 p-8 text-center">
                <div className="mb-7 flex h-24 items-center justify-center gap-1">
                  {isRecording ? [...Array(20)].map((_, i) => <motion.div key={i} className="w-1 rounded-[1px] bg-[#23c7be]" animate={{ height: [8, 28 + Math.random() * 44, 8] }} transition={{ duration: .5, repeat: Infinity, delay: i * .04 }} />) : audioUrl ? <audio ref={audioPlayerRef} src={audioUrl} onEnded={() => setIsPlaying(false)} className="hidden" /> : <div className="flex h-20 w-20 items-center justify-center rounded-[3px] border border-[#23c7be]/25 bg-[#23c7be]/10"><Mic size={38} className="text-[#23c7be]" /></div>}
                </div>
                <div className="font-mono text-5xl font-black tracking-tight text-white">{fmt(recordingTime)}</div>
                <div className="mt-2 text-sm font-bold text-white/45">{isRecording ? 'Recording…' : audioUrl ? 'Recording ready' : 'Tap the microphone to start'}</div>
                <div className="mt-8 flex items-center gap-3">
                  {!audioUrl ? (!isRecording ? <button onClick={startRecording} className="flex h-16 w-16 items-center justify-center rounded-[3px] bg-[#23c7be] text-[#071211] hover:bg-[#35d8cf]"><Mic size={26} /></button> : <button onClick={stopRecording} className="flex h-16 w-16 items-center justify-center rounded-[3px] border border-red-400/40 bg-red-400/10 text-red-200"><Square size={24} /></button>) : <><button onClick={reset} className="flex h-11 w-11 items-center justify-center rounded-[3px] border border-white/10 bg-white/[.04] text-white/60 hover:bg-white/10"><X size={18} /></button><button onClick={togglePlayback} className="flex h-16 w-16 items-center justify-center rounded-[3px] border border-[#23c7be]/40 bg-[#23c7be]/10 text-[#23c7be]">{isPlaying ? <Pause size={24} /> : <Play size={24} />}</button><button onClick={handleUpload} disabled={isUploading} className="flex h-11 w-11 items-center justify-center rounded-[3px] border border-white/10 bg-white/[.04] disabled:opacity-40">{isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}</button></>}
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
                <p className="text-[10px] font-black uppercase tracking-[.12em] text-white/40">Recording status</p>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between rounded-[3px] border border-white/10 bg-black/20 px-3 py-3"><span className="text-white/40">State</span><strong className={isRecording ? 'text-red-300' : audioUrl ? 'text-[#8ee9e4]' : 'text-white'}>{isRecording ? 'Recording' : audioUrl ? 'Ready' : 'Waiting'}</strong></div>
                  <div className="flex justify-between rounded-[3px] border border-white/10 bg-black/20 px-3 py-3"><span className="text-white/40">Format</span><strong>WebM audio</strong></div>
                  <div className="flex justify-between rounded-[3px] border border-white/10 bg-black/20 px-3 py-3"><span className="text-white/40">Destination</span><strong>Vault</strong></div>
                </div>
              </section>
              {audioUrl && <button onClick={handleUpload} disabled={isUploading || isSaving} className="flex w-full items-center justify-center gap-2 rounded-[3px] bg-[#23c7be] py-3.5 text-sm font-black text-[#071211] hover:bg-[#35d8cf] disabled:bg-white/[.05] disabled:text-white/30">{isSaving ? <><Loader2 size={17} className="animate-spin" /> Saving…</> : isUploading ? <><Loader2 size={17} className="animate-spin" /> Uploading…</> : <><Upload size={17} /> Save Recording</>}</button>}
            </aside>
          </div>
        </div>

        {showSaveVault && uploadedUrl && <SaveToVaultModal userEmail={user?.email} imageUrl={uploadedUrl} mediaType="audio" onClose={() => setShowSaveVault(false)} onSaved={handleVaultSaved} />}
      </motion.div>
    </div>
  );
}
