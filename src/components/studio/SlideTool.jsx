import React, { useEffect, useRef, useState } from 'react';
import { Upload, Music, Play, Pause, Download, Save, Trash2, ArrowLeft, ArrowRight, ImagePlus } from 'lucide-react';

const FPS = 30;
const WIDTH = 1280;
const HEIGHT = 720;
const duration = (slides) => slides.reduce((sum, slide) => sum + Number(slide.duration || 0), 0);
const uid = () => crypto.randomUUID();
const mediaTypes = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
const chooseMime = () => mediaTypes.find((type) => MediaRecorder.isTypeSupported(type)) || '';
const readImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => resolve({ img, url });
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image invalide')); };
  img.src = url;
});
const openDb = () => new Promise((resolve, reject) => {
  const request = indexedDB.open('aistage-slide', 1);
  request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('projects')) request.result.createObjectStore('projects'); };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
const storeProject = async (data) => {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('projects', 'readwrite');
    tx.objectStore('projects').put(data, 'current');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
};
const restoreProject = async () => {
  const db = await openDb();
  const data = await new Promise((resolve, reject) => {
    const tx = db.transaction('projects', 'readonly');
    const request = tx.objectStore('projects').get('current');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return data;
};
function renderFrame(ctx, slides, images, t, width, height) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  let elapsed = 0;
  let index = 0;
  for (; index < slides.length - 1; index++) {
    if (t < elapsed + slides[index].duration) break;
    elapsed += slides[index].duration;
  }
  const slide = slides[index];
  if (!slide) return;
  const localTime = Math.max(0, t - elapsed);
  const draw = (s, progress, alpha) => {
    const img = images.current.get(s.id);
    if (!img) return;
    const fill = Math.max(width / img.width, height / img.height);
    const zoom = s.effect === 'zoom-in' ? 1 + 0.15 * progress : s.effect === 'zoom-out' ? 1.15 - 0.15 * progress : s.effect === 'pan' ? 1.12 : 1;
    const iw = img.width * fill * zoom;
    const ih = img.height * fill * zoom;
    const drift = s.effect === 'pan' ? (progress - 0.5) * Math.min(width * 0.12, iw - width) : 0;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, (width - iw) / 2 - drift, (height - ih) / 2, iw, ih);
    ctx.globalAlpha = 1;
  };
  const progress = Math.min(1, localTime / Math.max(0.1, slide.duration));
  draw(slide, progress, 1);
  const transition = Math.min(slide.transition || 0, slide.duration / 2, slides[index + 1]?.duration / 2 || 0);
  if (transition > 0 && localTime > slide.duration - transition) {
    const next = slides[index + 1];
    draw(next, 0, (localTime - (slide.duration - transition)) / transition);
  }
}
export default function SlideTool() {
  const [slides, setSlides] = useState([]);
  const [audio, setAudio] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState('');
  const [title, setTitle] = useState('Nouveau Slide');
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const images = useRef(new Map());
  const urls = useRef(new Map());
  const clock = useRef(0);
  const playingRef = useRef(false);
  const slidesRef = useRef(slides);
  slidesRef.current = slides;
  const total = duration(slides);
  const update = (id, patch) => setSlides((items) => items.map((s) => s.id === id ? { ...s, ...patch } : s));
  const addImages = async (files) => {
    const incoming = [];
    for (const file of Array.from(files || []).filter((f) => f.type.startsWith('image/'))) {
      try {
        const id = uid();
        const { img, url } = await readImage(file);
        images.current.set(id, img);
        urls.current.set(id, url);
        incoming.push({ id, file, duration: 4, effect: 'none', transition: 0.6, name: file.name });
      } catch { setStatus('Une image ne peut pas être lue.'); }
    }
    setSlides((old) => [...old, ...incoming]);
  };
  const setMusic = (file) => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    if (!file) { setAudio(null); setAudioUrl(''); return; }
    setAudio(file);
    setAudioUrl(URL.createObjectURL(file));
  };
  const move = (i, step) => setSlides((old) => {
    const copy = [...old]; const j = i + step;
    if (j < 0 || j >= copy.length) return old;
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  });
  const remove = (id) => {
    const url = urls.current.get(id);
    if (url) URL.revokeObjectURL(url);
    urls.current.delete(id);
    images.current.delete(id);
    setSlides((old) => old.filter((s) => s.id !== id));
  };
  const save = async () => {
    try {
      await storeProject({ title, slides: slides.map(({ file, ...s }) => ({ ...s, file })), audio });
      setStatus('Projet enregistré dans ce navigateur.');
    } catch (e) { setStatus('Enregistrement impossible : ' + e.message); }
  };
  const load = async () => {
    try {
      const data = await restoreProject();
      if (!data) { setStatus('Aucun projet local enregistré.'); return; }
      playingRef.current = false; setPlaying(false);
      for (const url of urls.current.values()) URL.revokeObjectURL(url);
      images.current.clear(); urls.current.clear();
      const restored = [];
      for (const slide of data.slides || []) {
        try {
          const { img, url } = await readImage(slide.file);
          images.current.set(slide.id, img); urls.current.set(slide.id, url);
          restored.push(slide);
        } catch { /* ignore corrupted image */ }
      }
      setSlides(restored); setTitle(data.title || 'Slide'); setMusic(data.audio || null);
      setPosition(0); setStatus('Projet rouvert.');
    } catch (e) { setStatus('Ouverture impossible : ' + e.message); }
  };
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) renderFrame(canvas.getContext('2d'), slides, images, position, canvas.width, canvas.height);
  }, [slides, position]);
  useEffect(() => {
    playingRef.current = playing;
    if (!playing) { audioRef.current?.pause(); return; }
    clock.current = performance.now() - position * 1000;
    if (audioRef.current && audioUrl) {
      audioRef.current.currentTime = Math.min(position, audioRef.current.duration || position);
      audioRef.current.play().catch(() => {});
    }
    let raf;
    const tick = () => {
      if (!playingRef.current) return;
      const elapsed = (performance.now() - clock.current) / 1000;
      if (elapsed >= duration(slidesRef.current)) { setPosition(duration(slidesRef.current)); setPlaying(false); return; }
      setPosition(elapsed);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, audioUrl]);
  const fitAudio = () => {
    const n = slides.length;
    const seconds = audioRef.current?.duration;
    if (!n || !Number.isFinite(seconds) || seconds <= 0) { setStatus('Chargez une piste audio valide pour ajuster les durées.'); return; }
    setSlides((old) => old.map((s) => ({ ...s, duration: Math.round((seconds / n) * 10) / 10 })));
  };
  const exportVideo = async () => {
    if (!slides.length || exporting) return;
    if (!window.MediaRecorder || !canvasRef.current?.captureStream) { setStatus('Export vidéo non pris en charge par ce navigateur.'); return; }
    const mimeType = chooseMime();
    if (!mimeType) { setStatus('Aucun format vidéo compatible trouvé.'); return; }
    setPlaying(false);
    setExporting(true);
    setStatus('Export en cours. Gardez cet onglet actif.');
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH; canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    let stream, recorder, audioElement, audioContext, audioSource;
    try {
      stream = canvas.captureStream(FPS);
      if (audio && audioUrl) {
        audioElement = new Audio(audioUrl);
        audioElement.preload = 'auto';
        await new Promise((resolve, reject) => { audioElement.oncanplay = resolve; audioElement.onerror = reject; audioElement.load(); });
        audioContext = new AudioContext();
        audioSource = audioContext.createMediaElementSource(audioElement);
        const dest = audioContext.createMediaStreamDestination();
        audioSource.connect(dest);
        for (const track of dest.stream.getAudioTracks()) stream.addTrack(track);
      }
      const chunks = [];
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6000000 });
      const completion = new Promise((resolve, reject) => {
        recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        recorder.onerror = (e) => reject(e.error || new Error('Erreur enregistrement'));
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });
      renderFrame(ctx, slides, images, 0, WIDTH, HEIGHT);
      recorder.start(1000);
      const start = performance.now();
      audioElement?.play().catch(() => {});
      await new Promise((resolve) => {
        const tick = () => {
          const t = Math.min(total, (performance.now() - start) / 1000);
          renderFrame(ctx, slides, images, t, WIDTH, HEIGHT);
          if (t >= total) resolve(); else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      recorder.stop();
      const blob = await completion;
      const extension = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = (title.trim() || 'slide').replace(/[^a-z0-9_-]/gi, '_') + '.' + extension;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
      setStatus('Vidéo exportée en ' + extension.toUpperCase() + '.');
    } catch (e) {
      setStatus('Export échoué : ' + (e.message || String(e)));
      if (recorder?.state === 'recording') recorder.stop();
    } finally {
      audioElement?.pause();
      stream?.getTracks().forEach((track) => track.stop());
      await audioContext?.close().catch(() => {});
      setExporting(false);
    }
  };
  return (
    <div className="p-3 md:p-4 text-white text-xs space-y-3 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 items-center"><strong className="text-base">Slide</strong><input aria-label="Titre du projet" className="bg-white/10 border border-white/15 px-2 py-1.5 w-48" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={save} className="bg-white/10 px-3 py-2 flex gap-2 items-center"><Save size={14} /> Enregistrer</button>
          <button onClick={load} className="bg-white/10 px-3 py-2">Ouvrir le projet local</button>
          <button disabled={!slides.length || exporting} onClick={exportVideo} className="bg-teal-600 disabled:opacity-40 px-3 py-2 flex gap-2 items-center"><Download size={14} /> {exporting ? 'Export…' : 'Exporter vidéo'}</button>
        </div>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-3">
        <section className="min-w-0 space-y-3">
          <div className="bg-black border border-white/10 flex justify-center"><canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="w-full max-h-[56vh] object-contain aspect-video" /></div>
          <div className="flex gap-3 items-center bg-[#16181c] p-2 border border-white/10">
            <button disabled={!slides.length} onClick={() => { if (position >= total) setPosition(0); setPlaying((v) => !v); }} aria-label={playing ? 'Pause' : 'Lecture'}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
            <input className="flex-1 accent-teal-400" type="range" min="0" max={Math.max(total, 0.01)} step="0.01" value={Math.min(position, total)} onChange={(e) => { setPlaying(false); setPosition(Number(e.target.value)); }} />
            <span className="tabular-nums">{position.toFixed(1)} / {total.toFixed(1)} s</span>
          </div>
          <div className="flex gap-3 items-center flex-wrap bg-[#16181c] border border-white/10 p-2">
            <label className="cursor-pointer bg-white/10 px-3 py-2 flex items-center gap-2"><Music size={14} /> {audio ? audio.name : 'Ajouter audio (facultatif)'}<input className="hidden" type="file" accept="audio/*" onChange={(e) => setMusic(e.target.files?.[0])} /></label>
            {audio && <><button className="text-red-300" onClick={() => setMusic(null)}>Retirer</button><button className="bg-white/10 px-2 py-2" onClick={fitAudio}>Répartir selon la musique</button></>}
            <audio ref={audioRef} src={audioUrl || undefined} preload="metadata" />
          </div>
          <section className="bg-[#16181c] border border-white/10 p-2">
            <div className="flex items-center justify-between mb-2"><strong>Images ({slides.length})</strong><label className="cursor-pointer bg-white/10 px-3 py-2 flex items-center gap-2"><ImagePlus size={14} /> Ajouter des images<input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addImages(e.target.files); e.target.value = ''; }} /></label></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 pb-2 min-h-32">
              {slides.map((s, i) => <div key={s.id} className="min-w-0 border border-white/15 bg-white/5 p-1 space-y-1">
                <button onClick={() => { setPlaying(false); setPosition(duration(slides.slice(0, i))); }} className="w-full"><img src={urls.current.get(s.id)} alt={s.name} className="w-full aspect-video object-cover" /></button>
                <div className="truncate" title={s.name}>{i + 1}. {s.name}</div>
                <div className="flex justify-between items-center"><button disabled={i === 0} onClick={() => move(i, -1)}><ArrowLeft size={14} /></button><span>{s.duration}s</span><button disabled={i === slides.length - 1} onClick={() => move(i, 1)}><ArrowRight size={14} /></button><button onClick={() => remove(s.id)} aria-label="Retirer"><Trash2 size={14} /></button></div>
              </div>)}
              {!slides.length && <div className="p-8 text-white/50">Ajoutez des illustrations pour commencer.</div>}
            </div>
          </section>
        </section>
        <aside className="bg-[#16181c] border border-white/10 p-3 space-y-3 max-h-[75vh] overflow-auto">
          <strong>Réglages des images</strong>
          {slides.map((s, i) => <div key={s.id} className="border-b border-white/10 pb-3 space-y-2">
            <div className="font-semibold truncate">{i + 1}. {s.name}</div>
            <label className="flex items-center justify-between gap-2">Durée (secondes)<input type="number" min="0.5" max="600" step="0.5" className="w-20 bg-white/10 p-1" value={s.duration} onChange={(e) => update(s.id, { duration: Math.max(0.5, Number(e.target.value) || 0.5) })} /></label>
            <label className="block">Mouvement<select className="w-full bg-[#25282e] p-2 mt-1" value={s.effect} onChange={(e) => update(s.id, { effect: e.target.value })}><option value="none">Fixe</option><option value="zoom-in">Zoom avant</option><option value="zoom-out">Zoom arrière</option><option value="pan">Panoramique horizontal</option></select></label>
            <label className="flex items-center justify-between gap-2">Fondu vers la suivante<input type="number" min="0" max="3" step="0.1" className="w-20 bg-white/10 p-1" value={s.transition} onChange={(e) => update(s.id, { transition: Math.max(0, Math.min(3, Number(e.target.value) || 0)) })} /></label>
          </div>)}
          <p className="text-white/45 leading-relaxed">Projets enregistrés localement dans ce navigateur. Les fichiers originaux ne sont pas modifiés. L’export MP4 dépend du navigateur ; sinon WebM est utilisé.</p>
        </aside>
      </div>
      {!!status && <div role="status" className="text-teal-300">{status}</div>}
    </div>
  );
}
