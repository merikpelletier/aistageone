import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, Square, Play, Pause, Upload, X, Loader2, Undo2, Redo2, RotateCcw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import ProductionContextInfo from '@/components/ProductionContextInfo';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';
import { useStudioTranslation } from '@/lib/useStudioTranslation';

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const encodeWav24 = (samples, sampleRate) => {
  const bytesPerSample = 3;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const write = (offset, value) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  write(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 24, true);
  write(36, 'data');
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    const value = Math.round(sample < 0 ? sample * 8388608 : sample * 8388607);
    const offset = 44 + i * 3;
    view.setUint8(offset, value & 255);
    view.setUint8(offset + 1, (value >> 8) & 255);
    view.setUint8(offset + 2, (value >> 16) & 255);
  }
  return new Blob([buffer], { type: 'audio/wav' });
};

const decodeWav = async (blob) => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const context = new AudioContextClass();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    return { samples: decoded.getChannelData(0).slice(), sampleRate: decoded.sampleRate };
  } finally {
    await context.close();
  }
};

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
  const [duration, setDuration] = useState(0);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [samples, setSamples] = useState(null);
  const [takes, setTakes] = useState([]);
  const [history, setHistory] = useState([]);
  const [redoHistory, setRedoHistory] = useState([]);
  const [recordingRange, setRecordingRange] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isExportingMp3, setIsExportingMp3] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState(null);
  const [showSaveVault, setShowSaveVault] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const sampleRateRef = useRef(48000);
  const audioSamplesRef = useRef(null);
  const timerRef = useRef(null);
  const audioPlayerRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: { ideal: 1 }, sampleRate: { ideal: 48000 }, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContextClass({ sampleRate: 48000 });
      await context.resume();
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      recordedChunksRef.current = [];
      sampleRateRef.current = context.sampleRate;
      processor.onaudioprocess = (event) => recordedChunksRef.current.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      source.connect(processor);
      const silentGain = context.createGain();
      silentGain.gain.value = 0;
      processor.connect(silentGain);
      silentGain.connect(context.destination);
      streamRef.current = stream;
      audioContextRef.current = context;
      sourceRef.current = source;
      processorRef.current = processor;
      setRecordingRange(audioBlob ? { start: selectionStart, end: selectionEnd } : null);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(v => v + 1), 1000);
    } catch (error) {
      console.error(error);
      toast.error(t('Could not access microphone. Please check permissions.', 'Could not access microphone. Please check permissions.'));
    }
  };

  const stopRecording = () => {
    if (!isRecording || !audioContextRef.current) return;
    clearInterval(timerRef.current);
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach(track => track.stop());
    const totalLength = recordedChunksRef.current.reduce((sum, chunk) => sum + chunk.length, 0);
    const samples = new Float32Array(totalLength);
    let offset = 0;
    recordedChunksRef.current.forEach(chunk => { samples.set(chunk, offset); offset += chunk.length; });
    const sampleRate = sampleRateRef.current;
    let finalSamples = samples;
    if (recordingRange && audioBlob && samples.length) {
      const start = Math.max(0, Math.floor(recordingRange.start * sampleRate));
      const end = Math.min((audioSamplesRef.current?.length || 0), Math.floor(recordingRange.end * sampleRate));
      const previous = audioSamplesRef.current || new Float32Array();
      setTakes(current => [...current, { id: Date.now(), samples: samples.slice(), duration: samples.length / sampleRate, label: `Take ${current.length + 1}` }]);
      setHistory(current => [...current, previous]);
      setRedoHistory([]);
      finalSamples = new Float32Array(previous.length - (end - start) + samples.length);
      finalSamples.set(previous.subarray(0, start), 0);
      finalSamples.set(samples, start);
      finalSamples.set(previous.subarray(end), start + samples.length);
    } else {
      setHistory([]);
      setRedoHistory([]);
      setTakes([]);
    }
    audioSamplesRef.current = finalSamples;
    setSamples(finalSamples);
    const newBlob = encodeWav24(finalSamples, sampleRate);
    const newUrl = URL.createObjectURL(newBlob);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(newBlob);
    setAudioUrl(newUrl);
    setDuration(finalSamples.length / sampleRate);
    setSelectionStart(0);
    setSelectionEnd(finalSamples.length / sampleRate);
    setRecordingTime(Math.round(finalSamples.length / sampleRate));
    setRecordingRange(null);
    setIsRecording(false);
    audioContextRef.current.close();
    audioContextRef.current = null;
  };

  const togglePlayback = () => {
    if (!audioPlayerRef.current || !audioUrl) return;
    if (isPlaying) audioPlayerRef.current.pause();
    else audioPlayerRef.current.play();
    setIsPlaying(v => !v);
  };

  const handleExportMp3 = async () => {
    if (!audioBlob) return;
    setIsExportingMp3(true);
    try {
      const mp3Blob = await convertToMp3(audioBlob);
      const url = URL.createObjectURL(mp3Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `voice-recording-${Date.now()}.mp3`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('MP3 export failed:', error);
      toast.error(t('Could not export MP3', 'Could not export MP3'));
    } finally {
      setIsExportingMp3(false);
    }
  };

  const handleUpload = async () => {
    if (!audioBlob) return;
    setIsUploading(true);
    try {
      const isMp3 = audioBlob.type === 'audio/mpeg';
      const extension = isMp3 ? 'mp3' : 'wav';
      const mimeType = isMp3 ? 'audio/mpeg' : 'audio/wav';
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
    setSamples(null);
    audioSamplesRef.current = null;
    setTakes([]);
    setHistory([]);
    setRedoHistory([]);
    setRecordingTime(0);
    setIsPlaying(false);
  };

  return (
    <div className={`fixed z-[100] ${embedded ? 'top-14 right-0 bottom-[64px] left-0 lg:bottom-0 lg:left-[var(--studio-toolbar-width)] overflow-y-auto bg-[#202328]' : 'inset-0 flex items-center justify-center bg-black/80 p-4'}`}>
      <motion.div initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .98 }} className={embedded ? 'min-h-full w-full bg-[#202328] p-5 pb-28 text-white md:p-8 lg:pb-32' : 'w-full max-w-3xl rounded-[4px] border border-white/10 bg-[#202328] p-6 text-white'}>
        <div className="mx-auto w-full max-w-4xl">
          <header className="mb-5 flex items-center justify-between border-b border-white/10 bg-[#17191d] px-4 py-4 lg:mb-3 lg:px-3 lg:py-2">
            <div className="flex items-center gap-3 xl:gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-[3px] border border-[#23c7be]/30 bg-[#23c7be]/10 text-[#23c7be] xl:h-8 xl:w-8"><Mic size={19} /></div>
              <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#23c7be]">{t('Sound & Voice', 'Sound & Voice')}</p><h3 className="text-xl font-black">{t('Voice Recorder', 'Voice Recorder')}</h3><p className="text-xs text-white/45">{t('Record dialogue or voice directly in the Studio.', 'Record dialogue or voice directly in the Studio.')}</p></div>
            </div>
            {!embedded && <button onClick={onClose} className="rounded-[3px] border border-white/10 bg-white/[.04] p-2 hover:bg-white/10"><X size={20} /></button>}
          </header>

          {showContext && <ProductionContextInfo productionMethod={productionMethod} block={block} character={character} referenceMedia={[]} />}

          <div className="grid grid-cols-1 gap-3">
            <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-3">
              <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 rounded-[4px] border border-white/10 bg-black/25 p-8 text-center lg:h-[132px] lg:min-h-0 lg:flex-row lg:justify-between lg:gap-5 lg:px-6 lg:py-3">
                <div className="mb-7 flex h-24 items-center justify-center gap-1 lg:mb-0 lg:h-auto lg:w-16">
                  {isRecording ? [...Array(20)].map((_, i) => <motion.div key={i} className="w-1 rounded-[1px] bg-[#23c7be]" animate={{ height: [8, 28 + Math.random() * 44, 8] }} transition={{ duration: .5, repeat: Infinity, delay: i * .04 }} />) : audioUrl ? <audio ref={audioPlayerRef} src={audioUrl} onEnded={() => setIsPlaying(false)} className="hidden" /> : <div className="flex h-20 w-20 items-center justify-center rounded-[3px] border border-[#23c7be]/25 bg-[#23c7be]/10 xl:h-12 xl:w-12"><Mic size={38} className="text-[#23c7be] xl:scale-75" /></div>}
                </div>
                <div className="font-mono text-5xl font-black tracking-tight text-white lg:text-3xl">{fmt(recordingTime)}</div>
                <div className="mt-2 text-sm font-bold text-white/45 lg:mt-0 lg:flex-1 lg:text-left">{isRecording ? t('Recording…', 'Recording…') : isConverting ? t('Preparing audio…', 'Preparing audio…') : audioUrl ? t('WAV recording ready', 'WAV recording ready') : t('Tap the microphone to start', 'Tap the microphone to start')}</div>
                <div className="mt-8 flex items-center gap-3 lg:mt-0 lg:shrink-0">
                  {isRecording ? <button onClick={stopRecording} className="flex h-16 w-16 items-center justify-center rounded-[3px] border border-red-400/40 bg-red-400/10 text-red-200 lg:h-12 lg:w-12"><Square size={24} /></button> : !audioUrl ? <button onClick={startRecording} className="flex h-16 w-16 items-center justify-center rounded-[3px] bg-[#23c7be] text-[#071211] hover:bg-[#35d8cf] lg:h-12 lg:w-12"><Mic size={26} /></button> : <><button onClick={startRecording} title={t('Re-record selected segment', 'Re-record selected segment')} className="flex h-11 w-11 items-center justify-center rounded-[3px] border border-[#23c7be]/40 bg-[#23c7be]/10 text-[#23c7be]"><Mic size={18} /></button><button onClick={reset} className="flex h-11 w-11 items-center justify-center rounded-[3px] border border-white/10 bg-white/[.04] text-white/60 hover:bg-white/10"><X size={18} /></button><button onClick={togglePlayback} className="flex h-16 w-16 items-center justify-center rounded-[3px] border border-[#23c7be]/40 bg-[#23c7be]/10 text-[#23c7be] lg:h-12 lg:w-12">{isPlaying ? <Pause size={24} /> : <Play size={24} />}</button><button onClick={handleUpload} disabled={isUploading} className="flex h-11 w-11 items-center justify-center rounded-[3px] border border-white/10 bg-white/[.04] disabled:opacity-40">{isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}</button></>}
                </div>
              </div>
            </section>

            <aside className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] border border-white/10 bg-[#17191d] px-3 py-2 text-xs">
                <span className={isRecording ? 'text-red-300' : 'text-white/60'}>{isRecording ? t('Recording', 'Recording') : audioUrl ? t('Ready · WAV 48 kHz / 24-bit', 'Ready · WAV 48 kHz / 24-bit') : t('Waiting for recording', 'Waiting for recording')}</span>
                <span className="text-white/40">{t('Destination: Vault', 'Destination: Vault')}</span>
              </div>
              {audioUrl && samples && <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-3">
                <div className="mb-2 flex items-center justify-between text-xs"><strong>{t('Audio track', 'Audio track')}</strong><span className="text-white/45">{fmt(duration)}</span></div>
                <div className="flex h-16 items-center gap-px overflow-hidden rounded bg-black/30 px-1">
                  {Array.from({length: 180}, (_, i) => { const start = Math.floor(i * samples.length / 180); const end = Math.max(start + 1, Math.floor((i + 1) * samples.length / 180)); let peak = 0; for(let j=start;j<Math.min(end,samples.length);j++) peak=Math.max(peak,Math.abs(samples[j])); const time = start / sampleRateRef.current; const selected = time >= selectionStart && time <= selectionEnd; return <div key={i} className={selected ? 'flex-1 rounded-sm bg-[#23c7be]' : 'flex-1 rounded-sm bg-white/25'} style={{height: `${Math.max(3,peak*100)}%`}} />; })}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="text-[11px] text-white/50">{t('Selection start', 'Selection start')} · {selectionStart.toFixed(1)}s<input aria-label="Selection start" type="range" min="0" max={Math.max(.1,duration)} step=".1" value={selectionStart} onChange={e=>setSelectionStart(Math.min(Number(e.target.value),Math.max(0,selectionEnd-.1)))} className="mt-1 w-full accent-[#23c7be]" /></label>
                  <label className="text-[11px] text-white/50">{t('Selection end', 'Selection end')} · {selectionEnd.toFixed(1)}s<input aria-label="Selection end" type="range" min="0" max={Math.max(.1,duration)} step=".1" value={selectionEnd} onChange={e=>setSelectionEnd(Math.max(Number(e.target.value),selectionStart+.1))} className="mt-1 w-full accent-[#23c7be]" /></label>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => { if(!samples || selectionEnd<=selectionStart)return; const a=Math.floor(selectionStart*sampleRateRef.current),b=Math.floor(selectionEnd*sampleRateRef.current); const kept=new Float32Array(samples.length-(b-a)); kept.set(samples.subarray(0,a)); kept.set(samples.subarray(b),a); setHistory(h=>[...h,samples]); setRedoHistory([]); audioSamplesRef.current=kept; setSamples(kept); const blob=encodeWav24(kept,sampleRateRef.current); if(audioUrl)URL.revokeObjectURL(audioUrl); setAudioBlob(blob); setAudioUrl(URL.createObjectURL(blob)); setDuration(kept.length/sampleRateRef.current); setSelectionStart(0); setSelectionEnd(kept.length/sampleRateRef.current); }} className="rounded border border-white/10 px-3 py-2 text-xs">{t('Delete selection', 'Delete selection')}</button>
                  <button onClick={() => {setSelectionStart(0);setSelectionEnd(duration);}} className="rounded border border-white/10 px-3 py-2 text-xs">{t('Select all', 'Select all')}</button>
                  <button disabled={!history.length} onClick={() => {const prev=history[history.length-1];setRedoHistory(h=>[...h,samples]);setHistory(h=>h.slice(0,-1));audioSamplesRef.current=prev;setSamples(prev);const blob=encodeWav24(prev,sampleRateRef.current);if(audioUrl)URL.revokeObjectURL(audioUrl);setAudioBlob(blob);setAudioUrl(URL.createObjectURL(blob));setDuration(prev.length/sampleRateRef.current);setSelectionStart(0);setSelectionEnd(prev.length/sampleRateRef.current);}} className="flex items-center gap-1 rounded border border-white/10 px-3 py-2 text-xs disabled:opacity-30"><Undo2 size={13}/>{t('Undo', 'Undo')}</button>
                  <button disabled={!redoHistory.length} onClick={() => {const next=redoHistory[redoHistory.length-1];setHistory(h=>[...h,samples]);setRedoHistory(h=>h.slice(0,-1));audioSamplesRef.current=next;setSamples(next);const blob=encodeWav24(next,sampleRateRef.current);if(audioUrl)URL.revokeObjectURL(audioUrl);setAudioBlob(blob);setAudioUrl(URL.createObjectURL(blob));setDuration(next.length/sampleRateRef.current);setSelectionStart(0);setSelectionEnd(next.length/sampleRateRef.current);}} className="flex items-center gap-1 rounded border border-white/10 px-3 py-2 text-xs disabled:opacity-30"><Redo2 size={13}/>{t('Redo', 'Redo')}</button>
                  <span className="ml-auto self-center text-[11px] text-white/40">{takes.length} {t('retakes', 'retakes')}</span>
                </div>
              </section>}
              {audioUrl && takes.length > 0 && <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-3"><strong className="text-xs">{t('Retakes', 'Retakes')}</strong>{takes.map((take,index)=><div key={take.id} className="mt-2 flex items-center justify-between text-xs"><span>{take.label} · {fmt(take.duration)}</span><button onClick={()=>{const blob=encodeWav24(take.samples,sampleRateRef.current);const url=URL.createObjectURL(blob);if(audioUrl)URL.revokeObjectURL(audioUrl);setAudioBlob(blob);setAudioUrl(url);audioSamplesRef.current=take.samples;setSamples(take.samples);setDuration(take.duration);setSelectionStart(0);setSelectionEnd(take.duration);}} className="rounded border border-white/10 px-2 py-1">{t('Load take', 'Load take')}</button></div>)}</section>}
              {audioUrl && <div className="space-y-2">
                <button onClick={handleUpload} disabled={isUploading || isSaving || isConverting} className="flex w-full items-center justify-center gap-2 rounded-[3px] bg-[#23c7be] py-3.5 text-sm font-black text-[#071211] hover:bg-[#35d8cf] disabled:bg-white/[.05] disabled:text-white/30">{isSaving ? <><Loader2 size={17} className="animate-spin" /> {t('Saving…', 'Saving…')}</> : isUploading ? <><Loader2 size={17} className="animate-spin" /> {t('Uploading…', 'Uploading…')}</> : <><Upload size={17} /> {t('Save WAV', 'Save WAV')}</>}</button>
                <button onClick={handleExportMp3} disabled={isExportingMp3 || isConverting} className="flex w-full items-center justify-center gap-2 rounded-[3px] border border-white/15 bg-white/[.04] py-2.5 text-xs font-bold text-white hover:bg-white/10 disabled:opacity-40">{isExportingMp3 ? <><Loader2 size={15} className="animate-spin" /> {t('Exporting…', 'Exporting…')}</> : t('Export MP3', 'Export MP3')}</button>
              </div>}
            </aside>
          </div>
        </div>

        {showSaveVault && uploadedUrl && <SaveToVaultModal userEmail={user?.email} imageUrl={uploadedUrl} mediaType="audio" onClose={() => setShowSaveVault(false)} onSaved={handleVaultSaved} />}
      </motion.div>
    </div>
  );
}
