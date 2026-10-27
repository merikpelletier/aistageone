import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Folder, Music2, Pause, Play, Scissors, Undo2, Upload, Volume2, VolumeX, ZoomIn, ZoomOut } from 'lucide-react';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clipDuration = (clip) => Math.max(0.05, Number(clip?.trim_end || 0) - Number(clip?.trim_start || 0));
const timelineDurationOf = (clips) => clips.reduce((sum, clip) => sum + clipDuration(clip), 0);

const locateClip = (clips, timelineTime) => {
  const safeTime = Math.max(0, Number(timelineTime || 0));
  let cursor = 0;
  for (let index = 0; index < clips.length; index += 1) {
    const clip = clips[index];
    const duration = clipDuration(clip);
    const end = cursor + duration;
    if (safeTime < end || index === clips.length - 1) {
      const local = clamp(safeTime - cursor, 0, duration);
      return { clip, index, start: cursor, end, local, mediaTime: Number(clip.trim_start || 0) + local };
    }
    cursor = end;
  }
  return null;
};

const clipStart = (clips, id) => {
  let cursor = 0;
  for (const clip of clips) {
    if (clip.id === id) return cursor;
    cursor += clipDuration(clip);
  }
  return 0;
};

const formatTime = (seconds) => {
  const safe = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const frames = Math.floor((safe - Math.floor(safe)) * 30);
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
};

const setElementTime = (element, time, tolerance = 0.04) => {
  if (!element || !Number.isFinite(time)) return;
  try {
    if (Math.abs(Number(element.currentTime || 0) - time) > tolerance) element.currentTime = time;
  } catch {}
};

const prepareVideo = (element, clip, mediaTime, shouldPlay = false) => {
  if (!element || !clip?.url) return Promise.resolve(false);
  const clipId = String(clip.id);
  const apply = () => {
    element.muted = Boolean(clip.muted);
    element.volume = clamp(Number(clip.volume ?? 1), 0, 1);
    setElementTime(element, mediaTime, 0.02);
    if (!shouldPlay) return Promise.resolve(true);
    const playback = element.play();
    return playback && typeof playback.then === 'function' ? playback.then(() => true).catch(() => false) : Promise.resolve(true);
  };
  if (element.dataset.clipId === clipId && element.src === clip.url) return apply();
  element.dataset.clipId = clipId;
  element.src = clip.url;
  element.preload = 'auto';
  element.playsInline = true;
  element.load();
  if (element.readyState >= 1) return apply();
  return new Promise((resolve) => {
    const ready = () => {
      element.removeEventListener('loadedmetadata', ready);
      apply().then(resolve);
    };
    element.addEventListener('loadedmetadata', ready, { once: true });
  });
};

const syncAudio = (audio, music, timelineTime, timelineDuration, shouldPlay, forceSeek = false) => {
  if (!audio) return;
  if (!music?.url) {
    audio.pause();
    audio.removeAttribute('src');
    audio.dataset.musicUrl = '';
    return;
  }
  const start = Math.max(0, Number(music.start || 0));
  const trimStart = Math.max(0, Number(music.trim_start || 0));
  const trimEnd = Math.max(trimStart, Number(music.trim_end || music.duration || 0));
  const available = Math.max(0, trimEnd - trimStart);
  const local = timelineTime - start;
  const active = available > 0 && local >= 0 && (Boolean(music.loop) || local < available);
  if (audio.dataset.musicUrl !== music.url) {
    audio.dataset.musicUrl = music.url;
    audio.src = music.url;
    audio.preload = 'auto';
    audio.load();
    forceSeek = true;
  }
  if (!active) {
    audio.pause();
    return;
  }
  const sourceTime = trimStart + (music.loop ? (local % available) : local);
  const safeSourceTime = Math.min(sourceTime, Math.max(trimStart, trimEnd - 0.01));
  const loopWrapped = Boolean(music.loop) && Number(audio.currentTime || 0) > safeSourceTime + 0.35;
  if (forceSeek || !shouldPlay || audio.paused || loopWrapped) setElementTime(audio, safeSourceTime, 0.03);
  let gain = clamp(Number(music.volume ?? 0.55), 0, 1);
  const fadeIn = Math.max(0, Number(music.fade_in || 0));
  const fadeOut = Math.max(0, Number(music.fade_out || 0));
  if (fadeIn > 0 && local < fadeIn) gain *= clamp(local / fadeIn, 0, 1);
  const effectiveLength = music.loop ? Math.max(0, timelineDuration - start) : available;
  if (fadeOut > 0 && local > effectiveLength - fadeOut) gain *= clamp((effectiveLength - local) / fadeOut, 0, 1);
  audio.volume = clamp(gain, 0, 1);
  audio.loop = false;
  if (shouldPlay) {
    if (audio.paused) audio.play().catch(() => {});
  } else audio.pause();
};

const ShootTimelineEngine = forwardRef(function ShootTimelineEngine({ clips, music, playhead, playing, onPlayhead, onPlayingChange, onActiveClip, className = '', videoStyle = {} }, ref) {
  const rootRef = useRef(null);
  const deckARef = useRef(null);
  const deckBRef = useRef(null);
  const audioRef = useRef(null);
  const frameRef = useRef(null);
  const startedAtRef = useRef(0);
  const startTimelineRef = useRef(0);
  const activeDeckRef = useRef('a');
  const activeClipIdRef = useRef(null);
  const clipsRef = useRef(clips);
  const musicRef = useRef(music);
  const callbacksRef = useRef({ onPlayhead, onPlayingChange, onActiveClip });
  const [activeDeck, setActiveDeck] = useState('a');
  const [revision, setRevision] = useState(0);
  const [portalHost, setPortalHost] = useState(null);
  const [previewRatio, setPreviewRatio] = useState('16:9');
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState(clips[0]?.id || null);
  const [undoStack, setUndoStack] = useState([]);

  clipsRef.current = clips;
  musicRef.current = music;
  callbacksRef.current = { onPlayhead, onPlayingChange, onActiveClip };
  const timelineDuration = useMemo(() => timelineDurationOf(clips), [clips, revision]);
  const selectedClip = clips.find((clip) => clip.id === selectedId) || clips.find((clip) => clip.id === activeClipIdRef.current) || clips[0] || null;
  const selectedClipIndex = selectedClip ? clips.findIndex((clip) => clip.id === selectedClip.id) : -1;
  const pxPerSecond = 72 * zoom;
  const timelineWidth = Math.max(640, timelineDuration * pxPerSecond);

  useEffect(() => {
    const root = rootRef.current;
    const editContainer = root?.closest('.space-y-4');
    if (!editContainer || editContainer.dataset.realShootEditor === '1') return undefined;
    const ratioNode = [...editContainer.querySelectorAll('div')].find((node) => {
      const classes = typeof node.className === 'string' ? node.className : '';
      return classes.includes('aspect-[9/16]') || classes.includes('aspect-square') || classes.includes('aspect-video');
    });
    const ratioClasses = typeof ratioNode?.className === 'string' ? ratioNode.className : '';
    if (ratioClasses.includes('aspect-[9/16]')) setPreviewRatio('9:16');
    else if (ratioClasses.includes('aspect-square')) setPreviewRatio('1:1');
    else setPreviewRatio('16:9');

    const host = document.createElement('div');
    host.dataset.realShootEditorHost = '1';
    host.className = 'w-full';
    const previous = [...editContainer.children].map((node) => [node, node.style.display]);
    previous.forEach(([node]) => { node.style.display = 'none'; });
    editContainer.dataset.realShootEditor = '1';
    editContainer.appendChild(host);
    setPortalHost(host);
    return () => {
      setPortalHost(null);
      previous.forEach(([node, display]) => { node.style.display = display; });
      delete editContainer.dataset.realShootEditor;
      host.remove();
    };
  }, []);

  const remember = () => setUndoStack((stack) => [...stack.slice(-29), { clips: clipsRef.current.map((clip) => ({ ...clip })), music: { ...musicRef.current }, selectedId }]);
  const force = () => setRevision((value) => value + 1);
  const deck = (name) => (name === 'a' ? deckARef.current : deckBRef.current);
  const otherDeck = (name) => (name === 'a' ? deckBRef.current : deckARef.current);

  const preloadNext = (location, activeName) => {
    const next = location && clipsRef.current[location.index + 1];
    const target = otherDeck(activeName);
    if (!target) return;
    if (!next) {
      target.pause();
      target.removeAttribute('src');
      target.dataset.clipId = '';
      return;
    }
    void prepareVideo(target, next, Number(next.trim_start || 0), false);
  };

  const syncToTimeline = async (timelineTime, shouldPlay, forceDeck = null) => {
    const currentClips = clipsRef.current;
    const duration = timelineDurationOf(currentClips);
    const safe = clamp(Number(timelineTime || 0), 0, Math.max(0, duration));
    const location = locateClip(currentClips, safe);
    if (!location) return false;
    let activeName = forceDeck || activeDeckRef.current;
    let active = deck(activeName);
    const inactiveName = activeName === 'a' ? 'b' : 'a';
    const inactive = deck(inactiveName);
    if (active?.dataset.clipId !== String(location.clip.id) && inactive?.dataset.clipId === String(location.clip.id)) {
      active?.pause();
      activeName = inactiveName;
      activeDeckRef.current = activeName;
      setActiveDeck(activeName);
      active = deck(activeName);
    }
    const ok = await prepareVideo(active, location.clip, location.mediaTime, shouldPlay);
    if (!ok && shouldPlay) {
      callbacksRef.current.onPlayingChange?.(false);
      return false;
    }
    if (activeClipIdRef.current !== location.clip.id) {
      activeClipIdRef.current = location.clip.id;
      setSelectedId(location.clip.id);
      callbacksRef.current.onActiveClip?.(location.clip.id);
    }
    preloadNext(location, activeName);
    syncAudio(audioRef.current, musicRef.current, safe, duration, shouldPlay, true);
    return true;
  };

  const stopFrame = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  };

  const runClock = () => {
    const tick = () => {
      const duration = timelineDurationOf(clipsRef.current);
      const time = startTimelineRef.current + (performance.now() - startedAtRef.current) / 1000;
      if (time >= duration - 0.005) {
        stopFrame();
        deckARef.current?.pause();
        deckBRef.current?.pause();
        audioRef.current?.pause();
        callbacksRef.current.onPlayhead?.(duration);
        callbacksRef.current.onPlayingChange?.(false);
        return;
      }
      const location = locateClip(clipsRef.current, time);
      const currentActive = deck(activeDeckRef.current);
      if (location && currentActive?.dataset.clipId !== String(location.clip.id)) {
        void syncToTimeline(time, true);
      } else if (location && currentActive) {
        currentActive.muted = Boolean(location.clip.muted);
        currentActive.volume = clamp(Number(location.clip.volume ?? 1), 0, 1);
      }
      syncAudio(audioRef.current, musicRef.current, time, duration, true, false);
      callbacksRef.current.onPlayhead?.(time);
      frameRef.current = requestAnimationFrame(tick);
    };
    stopFrame();
    frameRef.current = requestAnimationFrame(tick);
  };

  const play = async (fromTime = playhead) => {
    const duration = timelineDurationOf(clipsRef.current);
    if (!clipsRef.current.length || duration <= 0) return false;
    const start = fromTime >= duration - 0.01 ? 0 : clamp(Number(fromTime || 0), 0, duration);
    startTimelineRef.current = start;
    startedAtRef.current = performance.now();
    const location = locateClip(clipsRef.current, start);
    const active = deck(activeDeckRef.current);
    if (location && active?.dataset.clipId === String(location.clip.id)) {
      active.muted = Boolean(location.clip.muted);
      active.volume = clamp(Number(location.clip.volume ?? 1), 0, 1);
      setElementTime(active, location.mediaTime, 0.02);
      const playback = active.play();
      if (playback && typeof playback.catch === 'function') playback.catch(() => callbacksRef.current.onPlayingChange?.(false));
      preloadNext(location, activeDeckRef.current);
      syncAudio(audioRef.current, musicRef.current, start, duration, true, true);
    } else {
      const ok = await syncToTimeline(start, true);
      if (!ok) return false;
    }
    callbacksRef.current.onPlayhead?.(start);
    callbacksRef.current.onPlayingChange?.(true);
    runClock();
    return true;
  };

  const pause = () => {
    stopFrame();
    deckARef.current?.pause();
    deckBRef.current?.pause();
    audioRef.current?.pause();
    callbacksRef.current.onPlayingChange?.(false);
  };

  const seek = async (time, resume = playing) => {
    const safe = clamp(Number(time || 0), 0, Math.max(0, timelineDurationOf(clipsRef.current)));
    stopFrame();
    deckARef.current?.pause();
    deckBRef.current?.pause();
    audioRef.current?.pause();
    callbacksRef.current.onPlayhead?.(safe);
    await syncToTimeline(safe, resume);
    if (resume) {
      startTimelineRef.current = safe;
      startedAtRef.current = performance.now();
      runClock();
    }
  };

  useImperativeHandle(ref, () => ({ play, pause, seek, duration: () => timelineDurationOf(clipsRef.current) }), [playhead, playing]);
  useEffect(() => { if (!clips.length) return undefined; void syncToTimeline(playhead, false); return undefined; }, [clips]);
  useEffect(() => { if (!playing) { stopFrame(); deckARef.current?.pause(); deckBRef.current?.pause(); audioRef.current?.pause(); } }, [playing]);
  useEffect(() => () => { stopFrame(); deckARef.current?.pause(); deckBRef.current?.pause(); audioRef.current?.pause(); }, []);

  const restoreUndo = () => setUndoStack((stack) => {
    if (!stack.length) return stack;
    const previous = stack[stack.length - 1];
    clipsRef.current.splice(0, clipsRef.current.length, ...previous.clips.map((clip) => ({ ...clip })));
    Object.keys(musicRef.current).forEach((key) => delete musicRef.current[key]);
    Object.assign(musicRef.current, previous.music);
    setSelectedId(previous.selectedId || clipsRef.current[0]?.id || null);
    force();
    void syncToTimeline(Math.min(playhead, timelineDurationOf(clipsRef.current)), false);
    return stack.slice(0, -1);
  });

  const mutateClip = (id, patch) => {
    remember();
    const clip = clipsRef.current.find((item) => item.id === id);
    if (!clip) return;
    Object.assign(clip, patch);
    force();
    void syncToTimeline(playhead, false);
  };

  const updateTrimStart = (clip, rawValue) => {
    const next = Math.max(0, Math.min(Number(rawValue) || 0, Number(clip.trim_end) - 0.05));
    mutateClip(clip.id, { trim_start: next });
    void seek(clipStart(clipsRef.current, clip.id), false);
  };

  const updateTrimEnd = (clip, rawValue) => {
    const sourceDuration = Number(clip.source_duration || clip.trim_end || 999);
    const next = Math.max(Number(clip.trim_start) + 0.05, Math.min(Number(rawValue) || 0.05, sourceDuration));
    mutateClip(clip.id, { trim_end: next });
    void seek(Math.min(playhead, timelineDurationOf(clipsRef.current)), false);
  };

  const splitAtPlayhead = () => {
    const location = locateClip(clipsRef.current, playhead);
    if (!location?.clip) return;
    const mediaTime = Number(location.clip.trim_start || 0) + location.local;
    if (mediaTime <= Number(location.clip.trim_start || 0) + 0.05 || mediaTime >= Number(location.clip.trim_end || 0) - 0.05) return;
    remember();
    const left = { ...location.clip, id: crypto.randomUUID(), trim_end: mediaTime, label: `${location.clip.label} A` };
    const right = { ...location.clip, id: crypto.randomUUID(), trim_start: mediaTime, label: `${location.clip.label} B` };
    clipsRef.current.splice(location.index, 1, left, right);
    setSelectedId(right.id);
    callbacksRef.current.onActiveClip?.(right.id);
    force();
  };

  const deleteSelected = () => {
    const index = clipsRef.current.findIndex((clip) => clip.id === selectedClip?.id);
    if (index < 0) return;
    remember();
    clipsRef.current.splice(index, 1);
    const nextId = clipsRef.current[Math.min(index, Math.max(0, clipsRef.current.length - 1))]?.id || null;
    setSelectedId(nextId);
    callbacksRef.current.onActiveClip?.(nextId);
    callbacksRef.current.onPlayhead?.(Math.min(playhead, timelineDurationOf(clipsRef.current)));
    force();
  };

  const moveSelected = (direction) => {
    const index = clipsRef.current.findIndex((clip) => clip.id === selectedClip?.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= clipsRef.current.length) return;
    remember();
    [clipsRef.current[index], clipsRef.current[target]] = [clipsRef.current[target], clipsRef.current[index]];
    force();
    void seek(clipStart(clipsRef.current, selectedClip.id), false);
  };

  const beginMusicMove = (event) => {
    if (!musicRef.current.url) return;
    event.stopPropagation();
    event.preventDefault();
    remember();
    const startX = event.clientX;
    const original = Number(musicRef.current.start || 0);
    const move = (moveEvent) => { musicRef.current.start = clamp(original + (moveEvent.clientX - startX) / pxPerSecond, 0, Math.max(0, timelineDurationOf(clipsRef.current))); force(); };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); syncAudio(audioRef.current, musicRef.current, playhead, timelineDurationOf(clipsRef.current), false, true); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  };

  const beginMusicTrim = (event, side) => {
    if (!musicRef.current.url) return;
    event.stopPropagation();
    event.preventDefault();
    remember();
    const startX = event.clientX;
    const originalStart = Number(musicRef.current.trim_start || 0);
    const originalEnd = Number(musicRef.current.trim_end || musicRef.current.duration || 0);
    const originalTimeline = Number(musicRef.current.start || 0);
    const move = (moveEvent) => {
      const delta = (moveEvent.clientX - startX) / pxPerSecond;
      if (side === 'left') {
        const next = clamp(originalStart + delta, 0, originalEnd - 0.05);
        musicRef.current.trim_start = next;
        musicRef.current.start = clamp(originalTimeline + (next - originalStart), 0, timelineDurationOf(clipsRef.current));
      } else musicRef.current.trim_end = clamp(originalEnd + delta, originalStart + 0.05, Number(musicRef.current.duration || originalEnd));
      force();
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); syncAudio(audioRef.current, musicRef.current, playhead, timelineDurationOf(clipsRef.current), false, true); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  };

  const triggerLegacy = (matcher) => {
    const host = portalHost?.parentElement;
    const buttons = [...(host?.querySelectorAll('button, label') || [])].filter((node) => node !== portalHost && matcher(node.textContent || ''));
    buttons[0]?.click();
  };

  const sharedProps = { controls: false, crossOrigin: 'anonymous', playsInline: true, preload: 'auto' };
  const preview = (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <video ref={deckARef} {...sharedProps} style={{ width: '100%', height: '100%', objectFit: 'cover', ...videoStyle }} className={activeDeck === 'a' ? 'absolute inset-0 h-full w-full' : 'pointer-events-none absolute inset-0 h-full w-full opacity-0'} />
      <video ref={deckBRef} {...sharedProps} style={{ width: '100%', height: '100%', objectFit: 'cover', ...videoStyle }} className={activeDeck === 'b' ? 'absolute inset-0 h-full w-full' : 'pointer-events-none absolute inset-0 h-full w-full opacity-0'} />
      <audio ref={audioRef} className="hidden" preload="auto" />
    </div>
  );

  const musicLength = Math.max(0, Number(music.trim_end || music.duration || 0) - Number(music.trim_start || 0));
  const musicVisible = music.loop ? Math.max(0, timelineDuration - Number(music.start || 0)) : Math.min(musicLength, Math.max(0, timelineDuration - Number(music.start || 0)));
  const rulerStep = zoom >= 2 ? 0.5 : zoom <= 0.75 ? 2 : 1;
  const rulerMarks = Math.floor(timelineDuration / rulerStep) + 1;
  const previewClass = previewRatio === '9:16' ? 'aspect-[9/16] max-h-[72vh] max-w-full' : previewRatio === '1:1' ? 'aspect-square max-h-[560px]' : 'aspect-video max-h-[560px]';

  const editor = (
    <div className="space-y-3">
      <section className="flex flex-wrap items-center justify-between gap-2 border border-white/10 bg-[#17191d] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => playing ? pause() : void play(playhead)} className="flex h-9 items-center gap-2 border border-white/10 bg-white/[0.06] px-3 text-xs font-black">{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? 'Pause' : 'Play'}</button>
          <button type="button" onClick={splitAtPlayhead} className="flex h-9 items-center gap-2 border border-white/10 bg-white/[0.06] px-3 text-xs font-bold"><Scissors size={14} /> Split</button>
          <button type="button" onClick={restoreUndo} disabled={!undoStack.length} className="flex h-9 items-center gap-2 border border-white/10 bg-white/[0.06] px-3 text-xs font-bold disabled:opacity-30"><Undo2 size={14} /> Undo</button>
          <span className="font-mono text-xs font-black text-[#8ee9e4]">{formatTime(playhead)}</span>
        </div>
        <div className="flex items-center gap-2"><button type="button" onClick={() => triggerLegacy((text) => text.includes('Export Scene'))} className="bg-[#23c7be] px-4 py-2 text-xs font-black text-black">Export Scene</button></div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[1fr_340px]">
        <section className="border border-white/10 bg-black p-2"><div className={`mx-auto overflow-hidden bg-black ${previewClass}`}>{preview}</div></section>
        <aside className="space-y-3 border border-white/10 bg-[#17191d] p-3">
          {selectedClip ? <>
            <div className="border-b border-white/10 pb-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div><p className="text-xs font-black">{selectedClip.label}</p><p className="text-[9px] text-white/35">VIDEO CLIP</p></div>
                <button type="button" onClick={splitAtPlayhead} className="bg-white/10 px-2 py-1 text-[10px] font-bold">Split at playhead</button>
              </div>
              <div className="mb-3 grid grid-cols-3 gap-1">
                <button type="button" disabled={selectedClipIndex <= 0} onClick={() => moveSelected(-1)} className="border border-white/10 bg-white/5 px-2 py-2 text-[10px] font-bold disabled:opacity-25">← Move left</button>
                <button type="button" onClick={deleteSelected} className="border border-red-400/25 bg-red-400/10 px-2 py-2 text-[10px] font-bold text-red-200">Delete</button>
                <button type="button" disabled={selectedClipIndex < 0 || selectedClipIndex >= clips.length - 1} onClick={() => moveSelected(1)} className="border border-white/10 bg-white/5 px-2 py-2 text-[10px] font-bold disabled:opacity-25">Move right →</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] text-white/45">Trim start<input type="number" min="0" step="0.05" value={Number(selectedClip.trim_start || 0)} onChange={(event) => updateTrimStart(selectedClip, event.target.value)} className="mt-1 w-full bg-black/30 p-2 text-xs text-white" /></label>
                <label className="text-[10px] text-white/45">Trim end<input type="number" min="0.05" step="0.05" value={Number(selectedClip.trim_end || selectedClip.source_duration || 0)} onChange={(event) => updateTrimEnd(selectedClip, event.target.value)} className="mt-1 w-full bg-black/30 p-2 text-xs text-white" /></label>
              </div>
            </div>
            <label className="block text-[10px] text-white/45">Scale · {Number(selectedClip.scale || 1).toFixed(2)}×<input type="range" min="1" max="2.5" step="0.05" value={selectedClip.scale || 1} onChange={(event) => mutateClip(selectedClip.id, { scale: Number(event.target.value) })} className="mt-1 w-full" /></label>
            <label className="block text-[10px] text-white/45">Position X · {Number(selectedClip.x || 0)}%<input type="range" min="-100" max="100" step="1" value={selectedClip.x || 0} onChange={(event) => mutateClip(selectedClip.id, { x: Number(event.target.value) })} className="mt-1 w-full" /></label>
            <label className="block text-[10px] text-white/45">Position Y · {Number(selectedClip.y || 0)}%<input type="range" min="-100" max="100" step="1" value={selectedClip.y || 0} onChange={(event) => mutateClip(selectedClip.id, { y: Number(event.target.value) })} className="mt-1 w-full" /></label>
            <label className="block text-[10px] text-white/45">Clip volume · {Math.round(Number(selectedClip.volume ?? 1) * 100)}%<input type="range" min="0" max="1" step="0.05" value={selectedClip.volume ?? 1} onChange={(event) => mutateClip(selectedClip.id, { volume: Number(event.target.value) })} className="mt-1 w-full" /></label>
            <button type="button" onClick={() => mutateClip(selectedClip.id, { muted: !selectedClip.muted })} className="flex w-full items-center justify-center gap-2 border border-white/10 p-2 text-xs font-bold">{selectedClip.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}{selectedClip.muted ? 'Muted' : 'Clip audio on'}</button>
          </> : null}
          {music.url && <div className="space-y-2 border-t border-white/10 pt-3"><div className="flex items-center gap-2"><Music2 size={14} className="text-[#8ee9e4]" /><div><p className="text-xs font-black">{music.name || 'Music'}</p><p className="text-[9px] text-white/35">AUDIO TRACK</p></div></div><label className="block text-[10px] text-white/45">Music volume · {Math.round(Number(music.volume ?? 0.55) * 100)}%<input type="range" min="0" max="1" step="0.05" value={music.volume ?? 0.55} onChange={(event) => { remember(); musicRef.current.volume = Number(event.target.value); force(); }} className="mt-1 w-full" /></label><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => { remember(); musicRef.current.loop = !musicRef.current.loop; force(); }} className={`border p-2 text-[10px] font-bold ${music.loop ? 'border-[#23c7be] text-[#8ee9e4]' : 'border-white/10'}`}>{music.loop ? 'Loop on' : 'Loop off'}</button><button type="button" onClick={() => { remember(); Object.assign(musicRef.current, { url: '', name: '', start: 0, trim_start: 0, trim_end: 0, duration: 0 }); force(); }} className="border border-red-400/25 p-2 text-[10px] font-bold text-red-200">Remove</button></div></div>}
        </aside>
      </div>

      <section className="border border-white/10 bg-[#111317]">
        <div className="flex items-center justify-between border-b border-white/10 p-2"><div><span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#23c7be]">Timeline</span><span className="ml-2 text-[9px] text-white/35">Video + music · same playhead</span></div><div className="flex items-center gap-1"><button type="button" onClick={() => setZoom((value) => clamp(value - 0.25, 0.5, 3))} className="border border-white/10 p-1.5"><ZoomOut size={12} /></button><span className="w-10 text-center text-[9px]">{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom((value) => clamp(value + 0.25, 0.5, 3))} className="border border-white/10 p-1.5"><ZoomIn size={12} /></button></div></div>
        <div className="grid grid-cols-[68px_1fr] md:grid-cols-[88px_1fr]">
          <div className="border-r border-white/10 bg-[#17191d]"><div className="h-7 border-b border-white/10" /><div className="flex h-24 items-center px-2 text-[9px] font-black text-white/55">V1 · VIDEO</div><div className="flex h-16 items-center px-2 text-[9px] font-black text-white/55">A1 · MUSIC</div></div>
          <div className="overflow-x-auto"><div className="relative" style={{ width: `${timelineWidth}px`, minWidth: '100%' }}>
            <div className="relative h-7 border-b border-white/10" onPointerDown={(event) => { const rect = event.currentTarget.getBoundingClientRect(); void seek((event.clientX - rect.left) / pxPerSecond, playing); }}>{Array.from({ length: rulerMarks }, (_, index) => { const second = index * rulerStep; return <div key={second} className="absolute inset-y-0 border-l border-white/15" style={{ left: `${second * pxPerSecond}px` }}><span className="absolute left-1 top-1 text-[8px] text-white/35">{second.toFixed(rulerStep < 1 ? 1 : 0)}s</span></div>; })}</div>
            <div className="relative h-24 border-b border-white/10 bg-black/30" onPointerDown={(event) => { const rect = event.currentTarget.getBoundingClientRect(); void seek((event.clientX - rect.left) / pxPerSecond, playing); }}>{clips.map((clip, index) => { const start = clipStart(clips, clip.id); const width = clipDuration(clip) * pxPerSecond; const selected = selectedClip?.id === clip.id; return <div key={clip.id} onPointerDown={(event) => { event.stopPropagation(); setSelectedId(clip.id); callbacksRef.current.onActiveClip?.(clip.id); void seek(start, false); }} className={`absolute inset-y-1 overflow-hidden border bg-[#20252c] ${selected ? 'z-20 border-[#23c7be] ring-1 ring-[#23c7be]' : 'z-10 border-white/15'}`} style={{ left: `${start * pxPerSecond}px`, width: `${Math.max(18, width)}px` }}><video src={clip.url} muted preload="metadata" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40" /><div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" /><div className="pointer-events-none absolute bottom-2 left-3 right-3"><p className="truncate text-[10px] font-black">{index + 1}. {clip.label}</p><p className="text-[8px] text-white/55">{clipDuration(clip).toFixed(2)}s</p></div></div>; })}</div>
            <div className="relative h-16 bg-black/30" onPointerDown={(event) => { const rect = event.currentTarget.getBoundingClientRect(); void seek((event.clientX - rect.left) / pxPerSecond, playing); }}>{!music.url ? <div className="absolute inset-2 flex items-center gap-2"><button type="button" onClick={(event) => { event.stopPropagation(); triggerLegacy((text) => text.includes('Add Music')); }} className="flex items-center gap-2 border border-dashed border-white/20 px-3 py-2 text-[10px] font-bold text-white/55"><Upload size={12} /> Add music</button><button type="button" onClick={(event) => { event.stopPropagation(); triggerLegacy((text) => text.trim() === 'Vault'); }} className="flex items-center gap-2 border border-white/10 px-3 py-2 text-[10px] font-bold text-white/55"><Folder size={12} /> Vault</button></div> : <div onPointerDown={beginMusicMove} className="absolute inset-y-2 cursor-grab overflow-hidden border border-[#23c7be]/60 bg-[#23c7be]/15" style={{ left: `${Number(music.start || 0) * pxPerSecond}px`, width: `${Math.max(24, musicVisible * pxPerSecond)}px` }}><div className="pointer-events-none absolute inset-0 flex items-center px-5"><div><p className="truncate text-[10px] font-black text-[#bff7f3]">♫ {music.name || 'Music'}</p><p className="text-[8px] text-white/55">{music.loop ? 'Loop' : `${musicLength.toFixed(2)}s`}</p></div></div><button type="button" onPointerDown={(event) => beginMusicTrim(event, 'left')} className="absolute inset-y-0 left-0 z-30 w-3 cursor-ew-resize bg-[#23c7be]/35" /><button type="button" onPointerDown={(event) => beginMusicTrim(event, 'right')} className="absolute inset-y-0 right-0 z-30 w-3 cursor-ew-resize bg-[#23c7be]/35" /></div>}</div>
            <div className="pointer-events-none absolute bottom-0 top-0 z-50 w-[2px] bg-[#23c7be]" style={{ left: `${playhead * pxPerSecond}px` }} />
          </div></div>
        </div>
      </section>
    </div>
  );

  return <div ref={rootRef} className={`relative h-full w-full overflow-hidden bg-black ${className}`}>{portalHost ? createPortal(editor, portalHost) : preview}</div>;
});

export default ShootTimelineEngine;
