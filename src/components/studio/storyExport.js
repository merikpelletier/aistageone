const MP4_TYPES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4',
];

const encoder = new TextEncoder();
const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

const slug = (value) => String(value || 'story-block').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'story-block';
const write16 = (view, offset, value) => view.setUint16(offset, value, true);
const write32 = (view, offset, value) => view.setUint32(offset, value >>> 0, true);
const crc32 = (bytes) => { let crc = 0xffffffff; for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; };
const dosStamp = (date = new Date()) => ({ time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2), date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate() });

function zipStore(entries) {
  const chunks = []; const central = []; let offset = 0; const stamp = dosStamp();
  for (const entry of entries) {
    const name = encoder.encode(entry.name); const data = entry.data instanceof Uint8Array ? entry.data : new Uint8Array(entry.data); const crc = crc32(data);
    const local = new Uint8Array(30); const localView = new DataView(local.buffer);
    write32(localView, 0, 0x04034b50); write16(localView, 4, 20); write16(localView, 6, 0x0800); write16(localView, 8, 0); write16(localView, 10, stamp.time); write16(localView, 12, stamp.date); write32(localView, 14, crc); write32(localView, 18, data.length); write32(localView, 22, data.length); write16(localView, 26, name.length);
    const header = new Uint8Array(46); const view = new DataView(header.buffer);
    write32(view, 0, 0x02014b50); write16(view, 4, 20); write16(view, 6, 20); write16(view, 8, 0x0800); write16(view, 10, 0); write16(view, 12, stamp.time); write16(view, 14, stamp.date); write32(view, 16, crc); write32(view, 20, data.length); write32(view, 24, data.length); write16(view, 28, name.length); write32(view, 42, offset);
    chunks.push(local, name, data); central.push(header, name); offset += local.length + name.length + data.length;
  }
  const centralSize = central.reduce((total, value) => total + value.length, 0); const end = new Uint8Array(22); const view = new DataView(end.buffer);
  write32(view, 0, 0x06054b50); write16(view, 8, entries.length); write16(view, 10, entries.length); write32(view, 12, centralSize); write32(view, 16, offset);
  return new Blob([...chunks, ...central, end], { type: 'application/zip' });
}

async function fetchBytes(url, label) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to download ${label} (${response.status})`);
  return { bytes: new Uint8Array(await response.arrayBuffer()), type: response.headers.get('content-type') || '' };
}

function extension(type, url, fallback) {
  if (type.includes('png')) return 'png'; if (type.includes('webp')) return 'webp'; if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
  if (type.includes('mpeg')) return 'mp3'; if (type.includes('wav')) return 'wav'; if (type.includes('ogg')) return 'ogg'; if (type.includes('mp4')) return 'm4a';
  const match = String(url).match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i); return match?.[1]?.toLowerCase() || fallback;
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export const completedExportChapters = (project) => project.chapters.filter((chapter) => chapter.segments.length === 9 && chapter.segments.every((segment) => segment.status === 'approved' && segment.image_url && segment.narration_url));
export const supportedMp4Type = () => typeof MediaRecorder !== 'undefined' && MP4_TYPES.find((type) => MediaRecorder.isTypeSupported(type));

export async function exportSlideshowZip(project, chapters, onProgress = () => {}) {
  const slides = chapters.flatMap((chapter) => chapter.segments.map((segment) => ({ chapter, segment })));
  const entries = []; const manifest = { title: project.title, exported_at: new Date().toISOString(), chapters: [] };
  for (let index = 0; index < slides.length; index += 1) {
    const { chapter, segment } = slides[index]; const number = String(index + 1).padStart(3, '0'); onProgress(`Preparing slide ${index + 1} of ${slides.length}`, index / slides.length);
    const [image, audio] = await Promise.all([fetchBytes(segment.image_url, `slide ${index + 1}`), fetchBytes(segment.narration_url, `audio ${index + 1}`)]);
    const imageName = `slides/${number}-chapter-${chapter.number}-segment-${segment.number}.${extension(image.type, segment.image_url, 'png')}`;
    const audioName = `audio/${number}-chapter-${chapter.number}-segment-${segment.number}.${extension(audio.type, segment.narration_url, 'mp3')}`;
    entries.push({ name: imageName, data: image.bytes }, { name: audioName, data: audio.bytes });
    manifest.chapters.push({ chapter_number: chapter.number, chapter_title: chapter.title, segment_number: segment.number, image: imageName, audio: audioName, narration: segment.narration_text || '', transition: segment.transition_notes || '' });
  }
  entries.push({ name: 'story-block.json', data: encoder.encode(JSON.stringify(manifest, null, 2)) });
  entries.push({ name: 'README.txt', data: encoder.encode('AISTAGE.ONE Story Block export\n\nThe numbered images are ready for a carousel, slideshow or printing. Matching narration files use the same number. The original project and source media were not modified.') });
  onProgress('Creating ZIP file', 0.98); download(zipStore(entries), `${slug(project.title)}-slideshow.zip`); onProgress('Slideshow downloaded', 1);
}

async function decodeAudio(context, url, index) {
  const response = await fetch(url); if (!response.ok) throw new Error(`Unable to download narration ${index + 1} (${response.status})`);
  return context.decodeAudioData(await response.arrayBuffer());
}

async function loadBitmap(url, index) {
  const response = await fetch(url); if (!response.ok) throw new Error(`Unable to download image ${index + 1} (${response.status})`);
  return createImageBitmap(await response.blob());
}

function canvasSize(ratio) {
  const [rw, rh] = String(ratio || '16:9').split(':').map(Number); const width = rw || 16; const height = rh || 9;
  if (width === height) return { width: 1080, height: 1080 };
  return width > height ? { width: 1920, height: Math.round(1920 * height / width) } : { width: Math.round(1920 * width / height), height: 1920 };
}

function drawAnimatedImage(ctx, bitmap, width, height, progress, direction, alpha = 1) {
  const base = Math.min(width / bitmap.width, height / bitmap.height); const zoom = 1 + 0.035 * progress; const drawWidth = bitmap.width * base * zoom; const drawHeight = bitmap.height * base * zoom;
  const travelX = Math.max(0, drawWidth - width) / 2; const travelY = Math.max(0, drawHeight - height) / 2; const reverse = direction % 2 === 1;
  const x = (width - drawWidth) / 2 + (reverse ? travelX * (1 - progress) : -travelX * (1 - progress));
  const y = (height - drawHeight) / 2 + (direction % 3 === 0 ? -travelY * progress : travelY * progress);
  ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(bitmap, x, y, drawWidth, drawHeight); ctx.restore();
}

export async function exportAnimatedVideo(project, chapters, onProgress = () => {}) {
  const mimeType = supportedMp4Type();
  if (!mimeType) throw new Error('This browser cannot create a social-ready MP4 locally. Use the current version of Edge, Chrome or Safari on a computer.');
  if (!HTMLCanvasElement.prototype.captureStream) throw new Error('This browser cannot record the animated canvas.');
  const scenes = chapters.flatMap((chapter) => chapter.segments.map((segment) => ({ chapter, segment })));
  const AudioContextClass = window.AudioContext || window.webkitAudioContext; if (!AudioContextClass) throw new Error('Web Audio is unavailable in this browser.');
  const audioContext = new AudioContextClass(); await audioContext.resume(); onProgress('Loading images and narrations', 0.02);
  const [bitmaps, audioBuffers] = await Promise.all([Promise.all(scenes.map(({ segment }, index) => loadBitmap(segment.image_url, index))), Promise.all(scenes.map(({ segment }, index) => decodeAudio(audioContext, segment.narration_url, index)))]);
  const durations = audioBuffers.map((buffer) => Math.max(2, buffer.duration)); const starts = []; let totalDuration = 0; durations.forEach((duration) => { starts.push(totalDuration); totalDuration += duration; });
  const { width, height } = canvasSize(chapters[0]?.image_aspect_ratio || '16:9'); const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d', { alpha: false });
  const destination = audioContext.createMediaStreamDestination(); const stream = canvas.captureStream(30); destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000, audioBitsPerSecond: 192000 }); const chunks = [];
  const stopped = new Promise((resolve, reject) => { recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); }; recorder.onerror = () => reject(recorder.error || new Error('Video recording failed')); recorder.onstop = resolve; });
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height); drawAnimatedImage(ctx, bitmaps[0], width, height, 0, 0); recorder.start(1000);
  const lead = 0.15; const audioStart = audioContext.currentTime + lead; const sources = audioBuffers.map((buffer, index) => { const source = audioContext.createBufferSource(); source.buffer = buffer; source.connect(destination); source.start(audioStart + starts[index]); return source; });
  const wallStart = performance.now() + lead * 1000; const transition = 0.65;
  let lastReportedPercent = -1;
  await new Promise((resolve) => {
    const frame = (now) => {
      const elapsed = Math.max(0, (now - wallStart) / 1000); let sceneIndex = starts.findLastIndex((start) => start <= elapsed); if (sceneIndex < 0) sceneIndex = 0; sceneIndex = Math.min(sceneIndex, scenes.length - 1);
      const local = Math.max(0, elapsed - starts[sceneIndex]); const progress = Math.min(1, local / durations[sceneIndex]); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
      if (sceneIndex > 0 && local < transition) { const fade = local / transition; drawAnimatedImage(ctx, bitmaps[sceneIndex - 1], width, height, 1, sceneIndex - 1, 1 - fade); drawAnimatedImage(ctx, bitmaps[sceneIndex], width, height, progress, sceneIndex, fade); }
      else drawAnimatedImage(ctx, bitmaps[sceneIndex], width, height, progress, sceneIndex);
      const percent = Math.min(100, Math.round(elapsed / totalDuration * 100)); if (percent !== lastReportedPercent) { lastReportedPercent = percent; onProgress(`Rendering video · ${percent}%`, Math.min(0.99, elapsed / totalDuration)); }
      if (elapsed >= totalDuration) resolve(); else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  recorder.stop(); await stopped; sources.forEach((source) => { try { source.stop(); } catch { /* already ended */ } }); stream.getTracks().forEach((track) => track.stop()); bitmaps.forEach((bitmap) => bitmap.close()); await audioContext.close();
  download(new Blob(chunks, { type: mimeType }), `${slug(project.title)}-animated.mp4`); onProgress('Animated MP4 downloaded', 1);
}
