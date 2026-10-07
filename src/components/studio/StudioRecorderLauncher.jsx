import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return candidates.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || '';
};

export default function StudioRecorderLauncher() {
  const location = useLocation();
  const { user } = useAuth();
  const visible = location.pathname.toLowerCase() === '/studio';

  const [open, setOpen] = useState(false);
  const [toolbarHost, setToolbarHost] = useState(null);
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

  useEffect(() => {
    if (!visible) return;
    const locateToolbar = () => {
      const candidates = Array.from(document.querySelectorAll('aside'));
      const studioAside = candidates.find((node) => node.className?.toString?.().includes('border-r')) || null;
      setToolbarHost(studioAside);
    };
    locateToolbar();
    const id = window.setInterval(locateToolbar, 1000);
    return () => window.clearInterval(id);
  }, [visible]);

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
    const audioTracks = [...displayStream.getAudioTracks(), ...(micStream?.getAudioTracks?.() || [])];

    if (audioTracks.length === 1) {
      output.addTrack(audioTracks[0]);
    } else if (audioTracks.length > 1) {
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
        setRecordedBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        setIsRecording(false);
        setIsPaused(false);
        setOpen(true);
        clearInterval(timerRef.current);
        stopTracks();
      };

      displayStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (recorder.state !== 'inactive') recorder.stop();
      }, { once: true });

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setIsRecording(true);
      setOpen(false);
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

  if (!visible) return null;

  const toolbarButton = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      title="Studio Recorder · Making Of"
      aria-label="Open Studio Recorder"
      className="w-full min-h-[46px] px-3 flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white border-t border-white/10 font-bold text-[11px]"
    >
      <Circle size={13} fill="currentColor" className="flex-shrink-0" />
      <span className="truncate">Studio Recorder</span>
    </button>
  );

  return (
    <>
      {toolbarHost ? createPortal(toolbarButton, toolbarHost) : null}

      {!toolbarHost && !isRecording && (
        <button onClick={() => setOpen(true)} className="lg:hidden fixed z-[6100] right-3 bottom-[74px] h-11 px-3 bg-red-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg">
          <Circle size={11} fill="currentColor" /> RECORDER
        </button>
      )}

      {open && !isRecording && (
        <aside className="fixed z-[9000] top-14 right-0 bottom-0 w-full sm:w-[380px] bg-[#17191d] text-white border-l border-white/10 shadow-2xl overflow-y-auto">
          <div className="sticky top-0 z-10 h-14 px-4 flex items-center justify-between bg-[#202328] border-b border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 bg-red-600 flex items-center justify-center"><Circle size={12} fill="currentColor" /></div>
              <div><div className="text-[9px] uppercase tracking-[0.2em] text-white/45">AISTAGE.ONE</div><div className="font-bold text-sm">Studio Recorder</div></div>
            </div>
            <button onClick={() => setOpen(false)} className="w-9 h-9 flex items-center justify-center bg-white/10"><X size={18} /></button>
          </div>

          <div className="p-4 space-y-4">
            {!recordedBlob ? (
              <>
                <div className="bg-black border border-white/10 p-5 text-center">
                  <Camera size={34} className="mx-auto mb-3 text-white/70" />
                  <h2 className="text-xl font-black">Record your process</h2>
                  <p className="mt-2 text-xs leading-5 text-white/50">The panel closes automatically when recording starts so the Studio remains fully visible.</p>
                </div>

                <button onClick={() => setIncludeMic((value) => !value)} className="w-full min-h-[54px] px-4 flex items-center gap-3 bg-white/5 hover:bg-white/10">
                  {includeMic ? <Mic size={19} /> : <MicOff size={19} />}
                  <div className="text-left flex-1"><div className="font-bold text-sm">Microphone</div><div className="text-xs text-white/45">Narrate while you work.</div></div>
                  {includeMic && <Check size={17} />}
                </button>

                <button onClick={() => setIncludeSystemAudio((value) => !value)} className="w-full min-h-[54px] px-4 flex items-center gap-3 bg-white/5 hover:bg-white/10">
                  <Camera size={19} />
                  <div className="text-left flex-1"><div className="font-bold text-sm">System / tab audio</div><div className="text-xs text-white/45">When supported by the browser.</div></div>
                  {includeSystemAudio && <Check size={17} />}
                </button>

                <button onClick={startRecording} className="w-full h-12 bg-red-600 hover:bg-red-500 font-bold flex items-center justify-center gap-2">
                  <Circle size={14} fill="currentColor" /> Start recording
                </button>
              </>
            ) : (
              <>
                <div className="text-xs uppercase tracking-[0.2em] text-white/45">Making Of preview</div>
                <video src={previewUrl} controls playsInline className="w-full bg-black max-h-[52vh] object-contain" />
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={resetRecording} disabled={isUploading} className="h-11 bg-white/10 font-bold text-sm">Record again</button>
                  <button onClick={uploadRecording} disabled={isUploading} className="h-11 bg-white text-black font-bold text-sm flex items-center justify-center gap-2">
                    {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {isUploading ? 'Uploading…' : 'Save to Vault'}
                  </button>
                </div>
              </>
            )}
          </div>
        </aside>
      )}

      {isRecording && (
        <div className="fixed z-[9500] right-4 bottom-4 bg-[#17191d] text-white border border-white/15 shadow-2xl px-3 py-2 flex items-center gap-3">
          <Circle size={11} fill="currentColor" className="text-red-500" />
          <span className="font-mono font-bold text-sm tabular-nums">{formatTime(recordingTime)}</span>
          <button onClick={togglePause} className="w-8 h-8 bg-white/10 flex items-center justify-center" title={isPaused ? 'Resume' : 'Pause'}>{isPaused ? <Play size={15} /> : <Pause size={15} />}</button>
          <button onClick={stopRecording} className="w-8 h-8 bg-red-600 flex items-center justify-center" title="Stop"><Square size={14} fill="currentColor" /></button>
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
