import React, { useRef, useState } from 'react';
import { Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/api/base44Client';

const CHUNK_SIZE = 5 * 1024 * 1024;
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function invokeStream(body) {
  const { data, error } = await supabase.functions.invoke('stream-tus-upload', { body });
  if (error) {
    let message = error.message;
    try { message = (await error.context.json()).error || message; } catch {}
    throw new Error(message || 'Video service unavailable');
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

async function uploadChunk(url, chunk, offset) {
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Tus-Resumable': '1.0.0',
      'Upload-Offset': String(offset),
      'Content-Type': 'application/offset+octet-stream',
    },
    body: chunk,
  });
  if (!response.ok) throw new Error(`Upload interrupted (${response.status})`);
  const nextOffset = Number(response.headers.get('Upload-Offset'));
  return Number.isFinite(nextOffset) ? nextOffset : offset + chunk.size;
}

export default function CloudflareVideoUpload({
  dossierId = null,
  label = 'Upload video',
  name = 'AISTAGE.ONE video',
  maxDurationSeconds = 3600,
  onReady,
  className = '',
}) {
  const inputRef = useRef(null);
  const cancelledRef = useRef(false);
  const [state, setState] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');

  const reset = () => {
    cancelledRef.current = false;
    setState('idle');
    setProgress(0);
    setMessage('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const pollUntilReady = async (assetId) => {
    setState('processing');
    setMessage('Cloudflare is processing the video…');
    for (let i = 0; i < 100 && !cancelledRef.current; i += 1) {
      const result = await invokeStream({ action: 'status', asset_id: assetId });
      if (result?.asset?.status === 'ready') return result.asset;
      if (result?.asset?.status === 'error') throw new Error('Cloudflare could not process this video.');
      await wait(3000);
    }
    throw new Error('The video is still processing. You can return to it shortly.');
  };

  const startUpload = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setState('error');
      setMessage('Choose a video file.');
      return;
    }
    if (file.size > 30 * 1024 * 1024 * 1024) {
      setState('error');
      setMessage('Cloudflare Stream accepts files up to 30 GB.');
      return;
    }

    cancelledRef.current = false;
    setState('preparing');
    setProgress(0);
    setMessage('Preparing secure upload…');

    try {
      const provision = await invokeStream({
        action: 'create',
        file_size: file.size,
        name: file.name || name,
        dossier_id: dossierId,
        max_duration_seconds: maxDurationSeconds,
      });

      if (!provision?.upload_url || !provision?.asset_id) throw new Error('Upload URL unavailable.');

      setState('uploading');
      setMessage('Uploading directly to Cloudflare Stream…');
      let offset = 0;
      while (offset < file.size) {
        if (cancelledRef.current) throw new Error('Upload cancelled.');
        const end = Math.min(offset + CHUNK_SIZE, file.size);
        offset = await uploadChunk(provision.upload_url, file.slice(offset, end), offset);
        setProgress(Math.min(100, Math.round((offset / file.size) * 100)));
      }

      const asset = await pollUntilReady(provision.asset_id);
      setState('ready');
      setProgress(100);
      setMessage('Video ready on Cloudflare Stream.');
      onReady?.(asset);
    } catch (error) {
      if (cancelledRef.current) return reset();
      setState('error');
      setMessage(error instanceof Error ? error.message : 'Video upload failed.');
    }
  };

  const busy = ['preparing', 'uploading', 'processing'].includes(state);

  return (
    <div className={`space-y-2 ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept="video/*,.mp4,.mov,.mkv,.avi,.webm,.mpg,.mpeg,.3gp,.mxf"
        className="hidden"
        onChange={(event) => startUpload(event.target.files?.[0])}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="w-full min-h-11 border border-white/20 bg-neutral-800 px-4 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : state === 'ready' ? <CheckCircle2 size={16} /> : <Upload size={16} />}
        {state === 'uploading' ? `Uploading ${progress}%` : state === 'processing' ? 'Processing video…' : state === 'ready' ? 'Upload another video' : label}
      </button>

      {busy && (
        <div className="h-1.5 w-full bg-white/10 overflow-hidden">
          <div className="h-full bg-white transition-all" style={{ width: `${state === 'processing' ? 100 : progress}%` }} />
        </div>
      )}

      {message && (
        <div className={`flex items-start gap-2 text-xs ${state === 'error' ? 'text-red-300' : state === 'ready' ? 'text-green-300' : 'text-white/55'}`}>
          {state === 'error' && <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />}
          <span>{message}</span>
        </div>
      )}

      {busy && (
        <button type="button" className="text-xs text-white/50 hover:text-white" onClick={() => { cancelledRef.current = true; }}>
          Cancel
        </button>
      )}
    </div>
  );
}
