import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Volume2, Loader2, Square } from 'lucide-react';
import { toast } from 'sonner';

export default function VoicePreviewButton({ voiceId, disabled = false }) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);
  const pending = useRef(false);
  const requestId = useRef(0);
  useEffect(() => {
    requestId.current += 1;
    audioRef.current?.pause();
    setPlaying(false);
    return () => { requestId.current += 1; audioRef.current?.pause(); };
  }, [voiceId]);
  const handlePreview = async () => {
    if (disabled || pending.current) return;
    if (playing) { audioRef.current?.pause(); setPlaying(false); return; }
    pending.current = true;
    const id = requestId.current;
    setLoading(true);
    try {
      const { data } = await base44.functions.invoke('generateSpeech', { voice: voiceId, preview: true });
      if (id !== requestId.current) return;
      if (!data?.file_url) throw new Error('No voice preview returned.');
      const audio = new Audio(data.file_url);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.onerror = () => { setPlaying(false); toast.error('Voice preview could not be played.'); };
      await audio.play();
      if (id === requestId.current) setPlaying(true);
      else audio.pause();
    } catch (error) {
      if (id === requestId.current) toast.error(error?.message || 'Voice preview failed');
    } finally { pending.current = false; setLoading(false); }
  };
  return <button type="button" disabled={disabled || loading} onClick={event => { event.stopPropagation(); handlePreview(); }} className="mt-4 flex shrink-0 items-center gap-1 rounded-xl border border-neutral-500 bg-white px-2 py-2 text-xs font-bold text-black disabled:opacity-40" title="Preview voice in English" aria-label={`Preview ${voiceId} in English`}>
    {loading ? <Loader2 size={14} className="animate-spin" /> : playing ? <Square size={14} /> : <Volume2 size={14} />} {playing ? 'Stop' : 'Preview'}
  </button>;
}
