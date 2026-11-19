import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, Square, Play, Pause, Upload, X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import ProductionContextInfo from '@/components/ProductionContextInfo';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';
import { useStudioTranslation } from '@/lib/useStudioTranslation';

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const loadMp3Encoder = () => new Promise((resolve, reject) => {
  if (window.lamejs?.Mp3Encoder) return resolve(window.lamejs);
  const existing = document.querySelector('script[data-lamejs]');
  if (existing) {
    existing.addEventListener('load', () => resolve(window.lamejs), { once: true });
    existing.addEventListener('error', reject, { once: true });
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js';
  script.async = true;
  script.dataset.lamejs = 'true';
  script.onload = () => window.lamejs?.Mp3Encoder ? resolve(window.lamejs) : reject(new Error('MP3 encoder did not load'));
  script.onerror = () => reject(new Error('Could not load MP3 encoder'));
  document.head.appendChild(script);
});

const convertToMp3 = async (sourceBlob) => {
  const lamejs = await loadMp3Encoder();
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioContextClass();
  try {
    const decoded = await audioContext.decodeAudioData(await sourceBlob.arrayBuffer());
    const channels = Math.min(decoded.numberOfChannels, 2);
    const sampleRate = decoded.sampleRate;
    const encoder = new lamejs.Mp3Encoder(channels, sampleRate, 192);
    const left = decoded.getChannelData(0);
    const right = channels === 2 ? decoded.getChannelData(1) : null;
    const mp3Chunks = [];
    const samplesPerFrame = 1152;
    const toInt16 = (data, start, end) => {
      const output = new Int16Array(end - start);
      for (let i = start; i < end; i++) {
        const sample = Math.max(-1, Math.min(1, data[i]));
        output[i - start] = sample < 0 ? sample * 32768 : sample * 32767;
      }
      return output;
    };
    for (let offset = 0; offset < left.length; offset += samplesPerFrame) {
      const end = Math.min(offset + samplesPerFrame, left.length);
      const leftChunk = toInt16(left, offset, end);
      const encoded = channels === 2
        ? encoder.encodeBuffer(leftChunk, toInt16(right, offset, end))
        : encoder.encodeBuffer(leftChunk);
      if (encoded.length) mp3Chunks.push(new Uint8Array(encoded));
    }
    const finalChunk = encoder.flush();
    if (finalChunk.length) mp3Chunks.push(new Uint8Array(finalChunk));
    return new Blob(mp3Chunks, { type: 'audio/mpeg' });
  } finally {
    await audioContext.close();
  }
};

export default function VoiceRecorder({ onRecordingComplete, onClose, productionMethod = null, block = null, character = null, episodePageId, blockId, user, embedded = false }) {
  const t = useStudioTranslation();
  const showContext = productionMethod && block;
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState(null);
  const [showSaveVault, setShowSaveVault] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioPlayerRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 48000 },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      const preferredMimeType = 'audio/webm;codecs=opus';
      const recorderOptions = { audioBitsPerSecond: 192000 };
      if (MediaRecorder.isTypeSupported(preferredMimeType)) {
        recorderOptions.mimeType = preferredMimeType;
      }
      const recorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const sourceBlob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setIsConverting(true);
        try {
          const mp3Blob = await convertToMp3(sourceBlob);
          setAudioBlob(mp3Blob);
          setAudioUrl(URL.createObjectURL(mp3Blob));
        } catch (error) {
          console.error('MP3 conversion failed:', error);
          setAudioBlob(sourceBlob);
          setAudioUrl(URL.createObjectURL(sourceBlob));
          toast.error(t('MP3 conversion failed. Original recording is available.', 'MP3 conversion failed. Original recording is available.'));
        } finally {
          setIsConverting(false);
        }
      };
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(v => v + 1), 1000);
    } catch (error) {
      console.error(error);
      toast.error(t('Could not access microphone. Please check permissions.', 'Could not access microphone. Please check permissions.'));
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
      const isMp3 = audioBlob.type === 'audio/mpeg';
      const extension = isMp3 ? 'mp3' : 'webm';
      const mimeType = isMp3 ? 'audio/mpeg' : (audioBlob.type || 'audio/webm');
      const recordingFile = new File([audioBlob], `voice-recording-${Date.now()}.${extension}`, { type: mimeType });
      const { file_url } = await base44.integrations.Core.UploadFile({ file: recordingFile });
      setUploadedUrl(file_url);
      if (!user?.email) return onRecordingComplete(file_url);
      setShowSaveVault(true);
    } catch (error) {
      console.error(error);
      toast.error(t('Failed to upload audio', 'Failed to upload audio'));
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
        toast.success(t('Audio saved to your Vault & episode!', 'Audio saved to your Vault & episode!'));
      } catch (error) {
        console.error(error);
        toast.error(t('Saved to Vault, but failed to attach to episode', 'Saved to Vault, but failed to attach to episode'));
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
              <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#23c7be]">{t('Sound & Voice', 'Sound & Voice')}</p><h3 className="text-xl font-black">{t('Voice Recorder', 'Voice Recorder')}</h3><p className="text-xs text-white/45">{t('Record dialogue or voice directly in the Studio.', 'Record dialogue or voice directly in the Studio.')}</p></div>
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
                <div className="mt-2 text-sm font-bold text-white/45">{isRecording ? t('Recording…', 'Recording…') : isConverting ? t('Converting to MP3…', 'Converting to MP3…') : audioUrl ? t('MP3 recording ready', 'MP3 recording ready') : t('Tap the microphone to start', 'Tap the microphone to start')}</div>
                <div className="mt-8 flex items-center gap-3">
                  {!audioUrl ? (!isRecording ? <button onClick={startRecording} className="flex h-16 w-16 items-center justify-center rounded-[3px] bg-[#23c7be] text-[#071211] hover:bg-[#35d8cf]"><Mic size={26} /></button> : <button onClick={stopRecording} className="flex h-16 w-16 items-center justify-center rounded-[3px] border border-red-400/40 bg-red-400/10 text-red-200"><Square size={24} /></button>) : <><button onClick={reset} className="flex h-11 w-11 items-center justify-center rounded-[3px] border border-white/10 bg-white/[.04] text-white/60 hover:bg-white/10"><X size={18} /></button><button onClick={togglePlayback} className="flex h-16 w-16 items-center justify-center rounded-[3px] border border-[#23c7be]/40 bg-[#23c7be]/10 text-[#23c7be]">{isPlaying ? <Pause size={24} /> : <Play size={24} />}</button><button onClick={handleUpload} disabled={isUploading} className="flex h-11 w-11 items-center justify-center rounded-[3px] border border-white/10 bg-white/[.04] disabled:opacity-40">{isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}</button></>}
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
                <p className="text-[10px] font-black uppercase tracking-[.12em] text-white/40">{t('Recording status', 'Recording status')}</p>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between rounded-[3px] border border-white/10 bg-black/20 px-3 py-3"><span className="text-white/40">{t('State', 'State')}</span><strong className={isRecording ? 'text-red-300' : audioUrl ? 'text-[#8ee9e4]' : 'text-white'}>{isRecording ? t('Recording', 'Recording') : audioUrl ? t('Ready', 'Ready') : t('Waiting', 'Waiting')}</strong></div>
                  <div className="flex justify-between rounded-[3px] border border-white/10 bg-black/20 px-3 py-3"><span className="text-white/40">{t('Format', 'Format')}</span><strong>{audioBlob?.type === 'audio/mpeg' ? 'MP3 audio' : 'WebM (original)'}</strong></div>
                  <div className="flex justify-between rounded-[3px] border border-white/10 bg-black/20 px-3 py-3"><span className="text-white/40">{t('Destination', 'Destination')}</span><strong>{t('Vault', 'Vault')}</strong></div>
                </div>
              </section>
              {audioUrl && <button onClick={handleUpload} disabled={isUploading || isSaving || isConverting} className="flex w-full items-center justify-center gap-2 rounded-[3px] bg-[#23c7be] py-3.5 text-sm font-black text-[#071211] hover:bg-[#35d8cf] disabled:bg-white/[.05] disabled:text-white/30">{isSaving ? <><Loader2 size={17} className="animate-spin" /> {t('Saving…', 'Saving…')}</> : isUploading ? <><Loader2 size={17} className="animate-spin" /> {t('Uploading…', 'Uploading…')}</> : <><Upload size={17} /> {t('Save Recording', 'Save Recording')}</>}</button>}
            </aside>
          </div>
        </div>

        {showSaveVault && uploadedUrl && <SaveToVaultModal userEmail={user?.email} imageUrl={uploadedUrl} mediaType="audio" onClose={() => setShowSaveVault(false)} onSaved={handleVaultSaved} />}
      </motion.div>
    </div>
  );
}
