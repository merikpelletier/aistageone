import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Camera, Check, Circle, Loader2, Mic, MicOff, Pause, Play, Save, Square, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';
import { toast } from 'sonner';

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const pickMimeType = () => {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  return candidates.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || '';
};

export default function StudioRecorderLauncher() {
  const location = useLocation();
  const { user } = useAuth();
  const visible = location.pathname.toLowerCase() === '/studio';

  const [open, setOpen] = useState(false);
  const [includeMic, setIncludeMic] = useState(true);
  const [includeSystemAudio, setIncludeSystemAudio] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadedUrl, setUploadedUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showVaultModal, setShowVaultModal] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const displayStreamRef = useRef(null);
  const micStreamRef = useRef(null);
  const mixedStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    [displayStreamRef.current, micStreamRef.current, mixedStreamRef.current].forEach((stream) => {
      stream?.getTracks?.().forEach((track) => track.stop());
    });
    audioContextRef.current?.close?.().catch?.(() => {});
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const resetRecording = () => {
    clearInterval(timerRef.current);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setRecordedBlob(null);
    setUploadedUrl(null);
    setRecordingTime(0);
    setIsPaused(false);
    setIsRecording(false);
  };

  const stopTracks = () => {
    displayStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    micStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    mixedStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    displayStreamRef.current = null;
    micStreamRef.current = null;
    mixedStreamRef.current = null;
    audioContextRef.current?.close?.().catch?.(() => {});
    audioContextRef.current = null;
  };

  const buildRecordingStream = async (displayStream, micStream) => {
    const output = new MediaStream();
    displayStream.getVideoTracks().forEach((track) => output.addTrack(track));

    const audioTracks = [
      ...displayStream.getAudioTracks(),
      ...(micStream?.getAudioTracks?.() || []),
    ];

    if (audioTracks.length === 1) {
      output.addTrack(audioTracks[0]);
      return output;
    }

    if (audioTracks.length > 1) {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (AudioContextCtor) {
        const audioContext = new AudioContextCtor();
        audioContextRef.current = audioContext;
        const destination = audioContext.createMediaStreamDestination();
        audioTracks.forEach((track) => {
          const source = audioContext.createMediaStreamSource(new MediaStream([track]));
          source.connect(destination);
        });
        destination.stream.getAudioTracks().forEach((track) => output.addTrack(track));
      } else {
        output.addTrack(audioTracks[0]);
      }
    }

    return output;
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder) {
      toast.error('Screen recording is not supported by this browser.');
      return;
    }

    try {
      resetRecording();
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 60 } },
        audio: includeSystemAudio,
      });
      displayStreamRef.current = displayStream;

      let micStream = null;
      if (includeMic) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          micStreamRef.current = micStream;
        } catch (error) {
          console.warn('Microphone unavailable, continuing without microphone.', error);
          toast.warning('Microphone unavailable. Recording screen only.');
        }
      }

      const recordingStream = await buildRecordingStream(displayStream, micStream);
      mixedStreamRef.current = recordingStream;
      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(recordingStream, { mimeType, videoBitsPerSecond: 8_000_000 })
        : new MediaRecorder(recordingStream, { videoBitsPerSecond: 8_000_000 });

      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || 'video/webm';
        const blob = new Blob(chunksRef.current, { type });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setPreviewUrl(url);
        setIsRecording(false);
        setIsPaused(false);
        clearInterval(timerRef.current);
        stopTracks();
      };

      displayStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (recorder.state !== 'inactive') recorder.stop();
      }, { once: true });

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((value) => value + 1), 1000);
    } catch (error) {
      stopTracks();
      if (error?.name !== 'NotAllowedError') {
        console.error('Screen recording error:', error);
        toast.error('Could not start screen recording.');
      }
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };

  const togglePause = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recorder.state === 'recording') {
      recorder.pause();
      setIsPaused(true);
      clearInterval(timerRef.current);
    } else if (recorder.state === 'paused') {
      recorder.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => setRecordingTime((value) => value + 1), 1000);
    }
  };

  const uploadRecording = async () => {
    if (!recordedBlob) return;
    setIsUploading(true);
    try {
      const extension = recordedBlob.type.includes('webm') ? 'webm' : 'mp4';
      const file = new File([recordedBlob], `making-of-${Date.now()}.${extension}`, { type: recordedBlob.type || 'video/webm' });
      const result = await base44.integrations.Core.UploadFile({ file });
      if (!result?.file_url) throw new Error('No uploaded file URL returned');
      setUploadedUrl(result.file_url);
      setShowVaultModal(true);
    } catch (error) {
      console.error('Studio Recorder upload failed:', error);
      toast.error('The recording could not be uploaded.');
    } finally {
      setIsUploading(false);
    }
  };

  const closeRecorder = () => {
    if (isRecording) stopRecording();
    stopTracks();
    setOpen(false);
  };

  if (!visible) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed z-[6100] top-2.5 right-3 h-9 px-3 md:px-4 bg-red-600 hover:bg-red-500 text-white flex items-center gap-2 font-bold text-xs tracking-wide shadow-lg"
        title="Record a Making Of"
        aria-label="Open Studio Recorder"
      >
        <Circle size={11} fill="currentColor" />
        <span className="hidden sm:inline">STUDIO RECORDER</span>
        <span className="sm:hidden">REC</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[12000] bg-[#17191d] text-white overflow-y-auto">
          <div className="sticky top-0 z-10 h-14 px-4 md:px-6 flex items-center justify-between bg-[#202328] border-b border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 bg-red-600 flex items-center justify-center flex-shrink-0"><Circle size={12} fill="currentColor" /></div>
              <div className="min-w-0">
                <div className="text-[9px] uppercase tracking-[0.2em] text-white/45">AISTAGE.ONE</div>
                <div className="font-bold text-sm truncate">Studio Recorder · Making Of</div>
              </div>
            </div>
            <button onClick={closeRecorder} className="w-9 h-9 flex items-center justify-center bg-white/10 hover:bg-white/15" aria-label="Close recorder"><X size={18} /></button>
          </div>

          <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
            {!recordedBlob && (
              <div className="grid md:grid-cols-[1.2fr_.8fr] gap-5">
                <section className="bg-black border border-white/10 p-6 md:p-8 min-h-[360px] flex flex-col items-center justify-center text-center">
                  <div className={`w-20 h-20 flex items-center justify-center mb-5 ${isRecording ? 'bg-red-600' : 'bg-white/10'}`}>
                    <Camera size={34} />
                  </div>
                  <h1 className="text-2xl md:text-4xl font-black tracking-tight">Record your process.</h1>
                  <p className="mt-3 text-white/55 max-w-xl">Capture your screen while you create in AI Stage One. Add your microphone for commentary and save the result as a Making Of in your Vault.</p>
                  <div className="mt-8 text-4xl md:text-5xl font-mono font-bold tabular-nums">{formatTime(recordingTime)}</div>
                  <div className="mt-2 text-xs uppercase tracking-[0.2em] text-white/45">{isRecording ? (isPaused ? 'Paused' : 'Recording') : 'Ready'}</div>

                  <div className="mt-8 flex items-center justify-center gap-3">
                    {!isRecording ? (
                      <button onClick={startRecording} className="h-12 px-6 bg-red-600 hover:bg-red-500 font-bold flex items-center gap-2"><Circle size={14} fill="currentColor" /> Start recording</button>
                    ) : (
                      <>
                        <button onClick={togglePause} className="h-12 px-5 bg-white/10 hover:bg-white/15 font-bold flex items-center gap-2">{isPaused ? <Play size={17} /> : <Pause size={17} />}{isPaused ? 'Resume' : 'Pause'}</button>
                        <button onClick={stopRecording} className="h-12 px-5 bg-red-600 hover:bg-red-500 font-bold flex items-center gap-2"><Square size={16} fill="currentColor" /> Stop</button>
                      </>
                    )}
                  </div>
                </section>

                <aside className="bg-[#202328] border border-white/10 p-5 md:p-6 space-y-5">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-white/50 mb-3">Recording options</div>
                    <button disabled={isRecording} onClick={() => setIncludeMic((value) => !value)} className="w-full min-h-[54px] px-4 flex items-center gap-3 bg-white/5 hover:bg-white/10 disabled:opacity-50">
                      {includeMic ? <Mic size={19} /> : <MicOff size={19} />}
                      <div className="text-left flex-1"><div className="font-bold text-sm">Microphone</div><div className="text-xs text-white/45">Narrate your Making Of while you work.</div></div>
                      {includeMic && <Check size={17} />}
                    </button>
                    <button disabled={isRecording} onClick={() => setIncludeSystemAudio((value) => !value)} className="mt-2 w-full min-h-[54px] px-4 flex items-center gap-3 bg-white/5 hover:bg-white/10 disabled:opacity-50">
                      <Camera size={19} />
                      <div className="text-left flex-1"><div className="font-bold text-sm">System / tab audio</div><div className="text-xs text-white/45">Available when the browser and chosen share source support it.</div></div>
                      {includeSystemAudio && <Check size={17} />}
                    </button>
                  </div>
                  <div className="border-t border-white/10 pt-5 text-xs leading-5 text-white/45">
                    Your browser will always ask which screen, window, or tab you want to share. AI Stage One cannot start screen capture without your permission.
                  </div>
                </aside>
              </div>
            )}

            {recordedBlob && previewUrl && (
              <section className="bg-black border border-white/10 p-4 md:p-6">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-5">
                  <div><div className="text-xs uppercase tracking-[0.2em] text-white/45">Making Of</div><h2 className="text-2xl font-black mt-1">Preview your recording</h2></div>
                  <div className="flex gap-2">
                    <button onClick={resetRecording} disabled={isUploading} className="h-10 px-4 bg-white/10 hover:bg-white/15 font-bold text-sm">Record again</button>
                    <button onClick={uploadRecording} disabled={isUploading} className="h-10 px-4 bg-white text-black hover:bg-white/90 font-bold text-sm flex items-center gap-2">{isUploading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{isUploading ? 'Uploading…' : 'Save to Vault'}</button>
                  </div>
                </div>
                <video src={previewUrl} controls playsInline className="w-full max-h-[68vh] bg-black object-contain" />
              </section>
            )}
          </div>
        </div>
      )}

      {showVaultModal && uploadedUrl && (
        <SaveToVaultModal
          userEmail={user?.email}
          imageUrl={uploadedUrl}
          mediaType="video"
          onSaved={() => {
            setShowVaultModal(false);
            toast.success('Making Of saved to your Vault.');
          }}
          onClose={() => setShowVaultModal(false)}
        />
      )}
    </>
  );
}
