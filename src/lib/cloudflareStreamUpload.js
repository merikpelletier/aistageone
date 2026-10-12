import { supabase } from '@/api/supabaseClient';

const CHUNK_SIZE = 5 * 1024 * 1024;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isVideoFile(file) {
  if (!file) return false;
  if (file.type) return file.type.startsWith('video/');
  return /\.(mp4|mov|mkv|avi|webm|mpg|mpeg|3gp|mxf|m4v)$/i.test(file.name || '');
}

async function invokeStream(body) {
  const { data, error } = await supabase.functions.invoke('stream-upload', { body });
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

export async function uploadVideoToCloudflareStream(file, {
  dossierId = null,
  maxDurationSeconds = 3600,
  onProgress,
  isCancelled = () => false,
} = {}) {
  if (!isVideoFile(file)) throw new Error('Choose a video file.');
  if (file.size > 30 * 1024 * 1024 * 1024) throw new Error('Cloudflare Stream accepts files up to 30 GB.');

  const provision = await invokeStream({
    action: 'create_tus_upload',
    file_size: file.size,
    name: file.name || 'AISTAGE.ONE video',
    dossier_id: dossierId,
    max_duration_seconds: maxDurationSeconds,
  });

  if (!provision?.upload_url || !provision?.asset_id) throw new Error('Upload URL unavailable.');

  let offset = 0;
  while (offset < file.size) {
    if (isCancelled()) throw new Error('Upload cancelled.');
    const end = Math.min(offset + CHUNK_SIZE, file.size);
    offset = await uploadChunk(provision.upload_url, file.slice(offset, end), offset);
    onProgress?.(Math.min(100, Math.round((offset / file.size) * 100)), 'uploading');
  }

  onProgress?.(100, 'processing');
  for (let i = 0; i < 100; i += 1) {
    if (isCancelled()) throw new Error('Upload cancelled.');
    const result = await invokeStream({ action: 'status', asset_id: provision.asset_id });
    if (result?.asset?.status === 'ready') {
      return { ...result.asset, original_name: file.name || 'AISTAGE.ONE video' };
    }
    if (result?.asset?.status === 'error') throw new Error('Cloudflare could not process this video.');
    await wait(3000);
  }

  throw new Error('The video is still processing. You can return to it shortly.');
}

export { isVideoFile };
