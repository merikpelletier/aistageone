import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { getPlatformLanguage } from '@/lib/translationDictionary';
import { useStudioTranslation } from '@/lib/useStudioTranslation';
import { Upload, Music, Play, Pause, Download, Save, Trash2, ArrowLeft, ArrowRight, ImagePlus, RefreshCw } from 'lucide-react';

const SLIDE_EN = {
  "Une image ne peut pas être lue.": "An image could not be loaded.",
  "Connexion requise pour enregistrer un projet.": "Sign in to save a project.",
  "Enregistrement des images et du projet…": "Saving images and project…",
  "Fichier manquant : ": "Missing file: ",
  "Nouveau Slide": "New Slide",
  "Projet enregistré dans votre compte AISTAGE.ONE.": "Project saved to your AISTAGE.ONE account.",
  "Enregistrement impossible : ": "Unable to save: ",
  "Ouverture du projet…": "Opening project…",
  "Projet ouvert depuis votre compte.": "Project opened from your account.",
  "Ouverture impossible : ": "Unable to open project: ",
  "Nouveau projet.": "New project.",
  "Aucune ancienne sauvegarde locale trouvée.": "No older local backup found.",
  "Ancienne sauvegarde locale chargée. Cliquez sur Enregistrer pour la conserver dans votre compte.": "Local backup loaded. Click Save to store it in your account.",
  "Ouverture locale impossible : ": "Unable to open local backup: ",
  "Chargez une piste audio valide pour ajuster les durées.": "Load a valid audio track to adjust durations.",
  "Export vidéo non pris en charge par ce navigateur.": "Video export is not supported by this browser.",
  "Aucun format vidéo compatible trouvé.": "No compatible video format found.",
  "Export en cours. Gardez cet onglet actif.": "Exporting. Keep this tab active.",
  "Vidéo exportée en ": "Video exported as ",
  "Export échoué : ": "Export failed: ",
  "Titre du projet": "Project title",
  "Enregistrement…": "Saving…",
  "Enregistrer": "Save",
  "Ouvrir un Slide enregistré": "Open a saved Slide",
  "Projets enregistrés": "Saved projects",
  "Nouveau": "New",
  "Récupérer sauvegarde locale": "Recover local backup",
  "Export…": "Exporting…",
  "Exporter vidéo": "Export video",
  "Pause": "Pause",
  "Lecture": "Play",
  "Ajouter audio (facultatif)": "Add audio (optional)",
  "Retirer": "Remove",
  "Répartir selon la musique": "Fit to audio",
  "Images": "Images",
  "Ajouter des images": "Add images",
  "Ajoutez des illustrations pour commencer.": "Add images to get started.",
  "Réglages des images": "Image settings",
  "Durée (secondes)": "Duration (seconds)",
  "Mouvement": "Motion",
  "Fixe": "Still",
  "Zoom avant": "Zoom in",
  "Zoom arrière": "Zoom out",
  "Panoramique horizontal": "Horizontal pan",
  "Fondu vers la suivante": "Fade to next",
  "Les projets et leurs médias sont sauvegardés dans votre compte. Les originaux ne sont pas modifiés. L’export MP4 dépend du navigateur ; sinon WebM est utilisé.": "Projects and media are saved to your account. Original files are unchanged. MP4 export depends on browser support; otherwise WebM is used."
};
const translateSlide = (fr, lang) => lang === 'fr' ? fr : (SLIDE_EN[fr] || fr);

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
  const [language, setLanguage] = useState(() => getPlatformLanguage());
  useEffect(() => { const sync = () => setLanguage(getPlatformLanguage()); window.addEventListener('aistage-language-change', sync); window.addEventListener('storage', sync); return () => { window.removeEventListener('aistage-language-change', sync); window.removeEventListener('storage', sync); }; }, []);
  const tr = (fr) => translateSlide(fr, language);
  const t = useStudioTranslation();
  const qc = useQueryClient();
  const [dossierOptions, setDossierOptions] = useState(null);
  const [dossierTarget, setDossierTarget] = useState('');
  const [dossierLoading, setDossierLoading] = useState(false);
  const dt = (key, fr, en) => t(key, language === 'fr' ? fr : en);
  const openDossiers = async () => {
    setDossierLoading(true);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user?.email) throw new Error(tr('Connexion requise pour enregistrer un projet.'));
      const list = await base44.entities.Dossier.filter({ submitted_by_email: data.user.email }, 'title');
      setDossierOptions(list || []);
      setDossierTarget('');
    } catch (error) { setStatus(tr('Export échoué : ') + error.message); }
    finally { setDossierLoading(false); }
  };
  const [slides, setSlides] = useState([]);
  const [audio, setAudio] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState('');
  const [title, setTitle] = useState(tr('Nouveau Slide'));
  const [projectId, setProjectId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
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
      } catch { setStatus(tr('Une image ne peut pas être lue.')); }
    }
    setSlides((old) => [...old, ...incoming]);
  };
  const replaceImage = async (id, file) => {
    if (!file || !file.type.startsWith('image/')) return;
    try {
      // Decode before changing anything, so a bad file cannot erase the existing image.
      const { img, url } = await readImage(file);
      if (!slidesRef.current.some((slide) => slide.id === id)) {
        URL.revokeObjectURL(url);
        return;
      }
      const oldUrl = urls.current.get(id);
      images.current.set(id, img);
      urls.current.set(id, url);
      setSlides((items) => items.map((slide) => slide.id === id
        ? { ...slide, file, name: file.name, path: null, mediaVersion: uid() }
        : slide));
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      setStatus(t('slide.image_replaced', 'Image replaced. Save the project to keep the change.'));
    } catch (error) {
      setStatus(t('slide.replace_failed', 'Unable to replace image: ') + (error?.message || ''));
    }
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
  const getUserId = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.id) throw new Error(tr('Connexion requise pour enregistrer un projet.'));
    return data.user.id;
  };
  const refreshProjects = async (ownerId) => {
    const { data, error } = await supabase.from('slide_project').select('id,title,updated_at').eq('owner_id', ownerId).order('updated_at', { ascending: false });
    if (error) throw error;
    setProjects(data || []);
  };
  useEffect(() => {
    getUserId().then(refreshProjects).catch(() => {});
  }, []);
  const save = async () => {
    if (saving) return;
    setSaving(true); setStatus(tr('Enregistrement des images et du projet…'));
    try {
      const ownerId = await getUserId();
      const id = projectId || uid();
      const bucket = supabase.storage.from('slide-project-media');
      const savedSlides = [];
      for (const slide of slides) {
        let path = slide.path;
        if (!path) {
          if (!slide.file) throw new Error(tr('Fichier manquant : ') + slide.name);
          path = ownerId + '/' + id + '/images/' + (slide.mediaVersion || slide.id) + '-' + slide.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const { error } = await bucket.upload(path, slide.file, { upsert: true, contentType: slide.file.type || 'application/octet-stream' });
          if (error) throw error;
        }
        const { file, ...metadata } = slide;
        savedSlides.push({ ...metadata, path });
      }
      let audioPath = audio?.path || null;
      if (audio && !audioPath) {
        audioPath = ownerId + '/' + id + '/audio/' + uid() + '-' + audio.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const { error } = await bucket.upload(audioPath, audio, { upsert: true, contentType: audio.type || 'application/octet-stream' });
        if (error) throw error;
      }
      const payload = { id, owner_id: ownerId, title: title.trim() || tr('Nouveau Slide'), slides: savedSlides, audio: audioPath ? { path: audioPath, name: audio.name } : null, updated_at: new Date().toISOString() };
      const { error } = await supabase.from('slide_project').upsert(payload, { onConflict: 'id' });
      if (error) throw error;
      setProjectId(id);
      setSlides((old) => old.map((slide) => {
        const saved = savedSlides.find((item) => item.id === slide.id);
        return saved ? { ...slide, path: saved.path } : slide;
      }));
      if (audioPath && audio) audio.path = audioPath;
      await refreshProjects(ownerId);
      setStatus(tr('Projet enregistré dans votre compte AISTAGE.ONE.'));
    } catch (e) { setStatus(tr('Enregistrement impossible : ') + e.message); }
    finally { setSaving(false); }
  };
  const openProject = async (id) => {
    if (!id || loading) return;
    setLoading(true); setPlaying(false); setStatus(tr('Ouverture du projet…'));
    try {
      const ownerId = await getUserId();
      const { data, error } = await supabase.from('slide_project').select('*').eq('id', id).eq('owner_id', ownerId).single();
      if (error) throw error;
      const bucket = supabase.storage.from('slide-project-media');
      const restored = [];
      const loadedImages = new Map();
      const loadedUrls = new Map();
      try {
        for (const slide of data.slides || []) {
          const { data: blob, error: fileError } = await bucket.download(slide.path);
          if (fileError) throw fileError;
          const file = new File([blob], slide.name || 'image', { type: blob.type || 'image/png' });
          const { img, url } = await readImage(file);
          loadedImages.set(slide.id, img); loadedUrls.set(slide.id, url);
          restored.push({ ...slide, file });
        }
        let audioFile = null;
        if (data.audio?.path) {
          const { data: blob, error: audioError } = await bucket.download(data.audio.path);
          if (audioError) throw audioError;
          audioFile = new File([blob], data.audio.name || 'audio', { type: blob.type || 'audio/mpeg' });
          audioFile.path = data.audio.path;
        }
        for (const url of urls.current.values()) URL.revokeObjectURL(url);
        images.current = loadedImages; urls.current = loadedUrls;
        setSlides(restored); setTitle(data.title || tr('Nouveau Slide'));
        setMusic(audioFile); setProjectId(id); setPosition(0);
        setStatus(tr('Projet ouvert depuis votre compte.'));
      } catch (e) {
        for (const url of loadedUrls.values()) URL.revokeObjectURL(url);
        throw e;
      }
    } catch (e) { setStatus(tr('Ouverture impossible : ') + e.message); }
    finally { setLoading(false); }
  };
  const newProject = () => {
    setPlaying(false);
    for (const url of urls.current.values()) URL.revokeObjectURL(url);
    images.current.clear(); urls.current.clear();
    setSlides([]); setMusic(null); setTitle(tr('Nouveau Slide')); setProjectId(null); setPosition(0);
    setStatus(tr('Nouveau projet.'));
  };
  const loadLocalBackup = async () => {
    try {
      const data = await restoreProject();
      if (!data) { setStatus(tr('Aucune ancienne sauvegarde locale trouvée.')); return; }
      const restored = []; const loadedImages = new Map(); const loadedUrls = new Map();
      for (const slide of data.slides || []) {
        const { img, url } = await readImage(slide.file);
        loadedImages.set(slide.id, img); loadedUrls.set(slide.id, url);
        restored.push(slide);
      }
      for (const url of urls.current.values()) URL.revokeObjectURL(url);
      images.current = loadedImages; urls.current = loadedUrls;
      setSlides(restored); setTitle(data.title || 'Slide'); setMusic(data.audio || null);
      setProjectId(null); setPosition(0); setPlaying(false);
      setStatus(tr('Ancienne sauvegarde locale chargée. Cliquez sur Enregistrer pour la conserver dans votre compte.'));
    } catch (e) { setStatus(tr('Ouverture locale impossible : ') + e.message); }
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
    if (!n || !Number.isFinite(seconds) || seconds <= 0) { setStatus(tr('Chargez une piste audio valide pour ajuster les durées.')); return; }
    setSlides((old) => old.map((s) => ({ ...s, duration: Math.round((seconds / n) * 10) / 10 })));
  };
  const exportVideo = async (target = null) => {
    if (!slides.length || exporting) return;
    if (!window.MediaRecorder || !canvasRef.current?.captureStream) { setStatus(tr('Export vidéo non pris en charge par ce navigateur.')); return; }
    const mimeType = chooseMime();
    if (!mimeType) { setStatus(tr('Aucun format vidéo compatible trouvé.')); return; }
    setPlaying(false);
    setExporting(true);
    setStatus(tr('Export en cours. Gardez cet onglet actif.'));
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
      if (target) {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user?.email) throw new Error(tr('Connexion requise pour enregistrer un projet.'));
        const owned = await base44.entities.Dossier.filter({ id: target, submitted_by_email: data.user.email });
        if (!owned.length) throw new Error(dt('slide.dossier_unavailable', 'Dossier inaccessible.', 'Dossier unavailable.'));
        const file = new File([blob], (title.trim() || 'slide') + '.' + extension, { type: mimeType });
        const { file_url } = await base44.integrations.Core.UploadFile({ file, dossierId: target });
        if (!file_url) throw new Error(dt('slide.upload_failed', 'Vidéo non enregistrée.', 'Video upload failed.'));
        const pages = await base44.entities.DossierPage.filter({ dossier_id: target });
        const order = Math.max(0, ...pages.map(p => Number(p.order) || 0)) + 1;
        await base44.entities.DossierPage.create({ dossier_id: target, page_type: 'video', title: title.trim() || tr('Nouveau Slide'), order, media_url: file_url, media_url_landscape: file_url, is_hidden_from_public: false, hide_title: false });
        qc.invalidateQueries({ queryKey: ['memberDossierPages', target] });
        setDossierOptions(null);
        setDossierTarget('');
        setStatus(dt('slide.dossier_added', 'Slide ajouté au dossier.', 'Slide added to dossier.'));
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = (title.trim() || 'slide').replace(/[^a-z0-9_-]/gi, '_') + '.' + extension;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
      setStatus(tr('Vidéo exportée en ') + extension.toUpperCase() + '.');
    } catch (e) {
      setStatus(tr('Export échoué : ') + (e.message || String(e)));
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
        <div className="flex gap-2 items-center"><strong className="text-base">Slide</strong><input aria-label={tr('Titre du projet')} className="bg-white/10 border border-white/15 px-2 py-1.5 w-48" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="flex gap-2 flex-wrap">
          <button disabled={saving || loading} onClick={save} className="bg-white/10 disabled:opacity-40 px-3 py-2 flex gap-2 items-center"><Save size={14} /> {saving ? tr('Enregistrement…') : tr('Enregistrer')}</button>
          <select aria-label={tr('Ouvrir un Slide enregistré')} className="bg-[#25282e] px-2 py-2 max-w-52" value={projectId || ''} onChange={(e) => openProject(e.target.value)}><option value="">{tr('Projets enregistrés')}</option>{projects.map((p) => <option value={p.id} key={p.id}>{p.title}</option>)}</select>
          <button onClick={newProject} className="bg-white/10 px-3 py-2">{tr('Nouveau')}</button>
          <button onClick={loadLocalBackup} className="bg-white/10 px-3 py-2">{tr('Récupérer sauvegarde locale')}</button>
          <button disabled={!slides.length || exporting} onClick={() => exportVideo()} className="bg-teal-600 disabled:opacity-40 px-3 py-2 flex gap-2 items-center"><Download size={14} /> {exporting ? tr('Export…') : tr('Exporter vidéo')}</button>
          <button disabled={!slides.length || exporting || dossierLoading} onClick={openDossiers} className="bg-white/10 disabled:opacity-40 px-3 py-2">{dt('slide.add_existing_dossier', 'Ajouter à un dossier existant', 'Add to existing dossier')}</button>
        </div>
      </div>
      {dossierOptions !== null && <div className="flex flex-wrap gap-2 items-center bg-[#16181c] border border-white/10 p-2">
        <select disabled={exporting} aria-label={dt('slide.select_dossier', 'Choisir un dossier', 'Select a dossier')} className="bg-[#25282e] px-2 py-2 max-w-full" value={dossierTarget} onChange={e => setDossierTarget(e.target.value)}><option value="">{dt('slide.select_dossier', 'Choisir un dossier', 'Select a dossier')}</option>{dossierOptions.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}</select>
        <button disabled={!dossierTarget || exporting || !slides.length} onClick={() => exportVideo(dossierTarget)} className="bg-teal-600 disabled:opacity-40 px-3 py-2">{dt('slide.add_to_dossier', 'Ajouter au dossier', 'Add to dossier')}</button>
        <button disabled={exporting} onClick={() => { setDossierOptions(null); setDossierTarget(''); }} className="px-3 py-2">{dt('Cancel', 'Annuler', 'Cancel')}</button>
      </div>}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-3">
        <section className="min-w-0 space-y-3">
          <div className="bg-black border border-white/10 flex justify-center"><canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="w-full max-h-[56vh] object-contain aspect-video" /></div>
          <div className="flex gap-3 items-center bg-[#16181c] p-2 border border-white/10">
            <button disabled={!slides.length} onClick={() => { if (position >= total) setPosition(0); setPlaying((v) => !v); }} aria-label={playing ? tr('Pause') : tr('Lecture')}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
            <input className="flex-1 accent-teal-400" type="range" min="0" max={Math.max(total, 0.01)} step="0.01" value={Math.min(position, total)} onChange={(e) => { setPlaying(false); setPosition(Number(e.target.value)); }} />
            <span className="tabular-nums">{position.toFixed(1)} / {total.toFixed(1)} s</span>
          </div>
          <div className="flex gap-3 items-center flex-wrap bg-[#16181c] border border-white/10 p-2">
            <label className="cursor-pointer bg-white/10 px-3 py-2 flex items-center gap-2"><Music size={14} /> {audio ? audio.name : tr('Ajouter audio (facultatif)')}<input className="hidden" type="file" accept="audio/*" onChange={(e) => setMusic(e.target.files?.[0])} /></label>
            {audio && <><button className="text-red-300" onClick={() => setMusic(null)}>{tr('Retirer')}</button><button className="bg-white/10 px-2 py-2" onClick={fitAudio}>{tr('Répartir selon la musique')}</button></>}
            <audio ref={audioRef} src={audioUrl || undefined} preload="metadata" />
          </div>
          <section className="bg-[#16181c] border border-white/10 p-2">
            <div className="flex items-center justify-between mb-2"><strong>{tr('Images')} ({slides.length})</strong><label className="cursor-pointer bg-white/10 px-3 py-2 flex items-center gap-2"><ImagePlus size={14} /> {tr('Ajouter des images')}<input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addImages(e.target.files); e.target.value = ''; }} /></label></div>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 pb-2 min-h-32">
              {slides.map((s, i) => <div key={s.id} className="min-w-0 border border-white/15 bg-white/5 p-1 space-y-1">
                <button onClick={() => { setPlaying(false); setPosition(duration(slides.slice(0, i))); }} className="w-full"><img src={urls.current.get(s.id)} alt={s.name} className="w-full aspect-video object-cover" /></button>
                <div className="truncate" title={s.name}>{i + 1}. {s.name}</div>
                <div className="flex justify-between items-center"><button disabled={i === 0} onClick={() => move(i, -1)}><ArrowLeft size={14} /></button><span>{s.duration}s</span><button disabled={i === slides.length - 1} onClick={() => move(i, 1)}><ArrowRight size={14} /></button><label className="cursor-pointer inline-flex items-center gap-1 text-[11px] text-white/85 hover:text-white" title={t('slide.replace_image', 'Replace')}><RefreshCw size={13} /><span>{t('slide.replace_image', 'Replace')}</span><input type="file" accept="image/*" className="hidden" aria-label={t('slide.replace_image', 'Replace')} onChange={(e) => { const file = e.target.files?.[0]; if (file) replaceImage(s.id, file); e.target.value = ''; }} /></label><button onClick={() => remove(s.id)} aria-label={tr('Retirer')}><Trash2 size={14} /></button></div>
              </div>)}
              {!slides.length && <div className="p-8 text-white/50">{tr('Ajoutez des illustrations pour commencer.')}</div>}
            </div>
          </section>
        </section>
        <aside className="bg-[#16181c] border border-white/10 p-3 space-y-3 max-h-[75vh] overflow-auto">
          <strong>{tr('Réglages des images')}</strong>
          {slides.map((s, i) => <div key={s.id} className="border-b border-white/10 pb-3 space-y-2">
            <div className="font-semibold truncate">{i + 1}. {s.name}</div>
            <label className="flex items-center justify-between gap-2">{tr('Durée (secondes)')}<input type="number" min="0.5" max="600" step="0.5" className="w-20 bg-white/10 p-1" value={s.duration} onChange={(e) => update(s.id, { duration: Math.max(0.5, Number(e.target.value) || 0.5) })} /></label>
            <label className="block">{tr('Mouvement')}<select className="w-full bg-[#25282e] p-2 mt-1" value={s.effect} onChange={(e) => update(s.id, { effect: e.target.value })}><option value="none">{tr('Fixe')}</option><option value="zoom-in">{tr('Zoom avant')}</option><option value="zoom-out">{tr('Zoom arrière')}</option><option value="pan">{tr('Panoramique horizontal')}</option></select></label>
            <label className="flex items-center justify-between gap-2">{tr('Fondu vers la suivante')}<input type="number" min="0" max="3" step="0.1" className="w-20 bg-white/10 p-1" value={s.transition} onChange={(e) => update(s.id, { transition: Math.max(0, Math.min(3, Number(e.target.value) || 0)) })} /></label>
          </div>)}
          <p className="text-white/45 leading-relaxed">{tr('Les projets et leurs médias sont sauvegardés dans votre compte. Les originaux ne sont pas modifiés. L’export MP4 dépend du navigateur ; sinon WebM est utilisé.')}</p>
        </aside>
      </div>
      {!!status && <div role="status" className="text-teal-300">{status}</div>}
    </div>
  );
}
