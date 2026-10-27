import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clipDuration = (clip) => Math.max(0.05, Number(clip?.trim_end || 0) - Number(clip?.trim_start || 0));

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
    setElementTime(element, mediaTime);
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

const syncAudio = (audio, music, timelineTime, timelineDuration, shouldPlay) => {
  if (!audio) return;
  if (!music?.url) {
    audio.pause();
    audio.removeAttribute('src');
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
  }

  if (!active) {
    audio.pause();
    return;
  }

  const sourceTime = trimStart + (music.loop ? (local % available) : local);
  setElementTime(audio, Math.min(sourceTime, Math.max(trimStart, trimEnd - 0.01)), 0.08);

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

const ShootTimelineEngine = forwardRef(function ShootTimelineEngine({
  clips,
  music,
  playhead,
  playing,
  onPlayhead,
  onPlayingChange,
  onActiveClip,
  className = '',
  videoStyle = {},
}, ref) {
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
  const durationRef = useRef(0);
  const callbacksRef = useRef({ onPlayhead, onPlayingChange, onActiveClip });
  const [activeDeck, setActiveDeck] = useState('a');

  const timelineDuration = useMemo(() => clips.reduce((sum, clip) => sum + clipDuration(clip), 0), [clips]);
  clipsRef.current = clips;
  musicRef.current = music;
  durationRef.current = timelineDuration;
  callbacksRef.current = { onPlayhead, onPlayingChange, onActiveClip };

  const deck = (name) => (name === 'a' ? deckARef.current : deckBRef.current);
  const otherDeck = (name) => (name === 'a' ? deckBRef.current : deckARef.current);

  const preloadNext = (location, activeName) => {
    const currentClips = clipsRef.current;
    const next = location && currentClips[location.index + 1];
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
    const duration = durationRef.current;
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
      callbacksRef.current.onActiveClip?.(location.clip.id);
    }

    preloadNext(location, activeName);
    syncAudio(audioRef.current, musicRef.current, safe, duration, shouldPlay);
    return true;
  };

  const stopFrame = () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  };

  const runClock = () => {
    const tick = () => {
      const duration = durationRef.current;
      const elapsed = (performance.now() - startedAtRef.current) / 1000;
      const time = startTimelineRef.current + elapsed;

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
        setElementTime(currentActive, location.mediaTime, 0.12);
        currentActive.muted = Boolean(location.clip.muted);
        currentActive.volume = clamp(Number(location.clip.volume ?? 1), 0, 1);
      }

      syncAudio(audioRef.current, musicRef.current, time, duration, true);
      callbacksRef.current.onPlayhead?.(time);
      frameRef.current = requestAnimationFrame(tick);
    };
    stopFrame();
    frameRef.current = requestAnimationFrame(tick);
  };

  const play = async (fromTime = playhead) => {
    const duration = durationRef.current;
    if (!clipsRef.current.length || duration <= 0) return false;
    const start = fromTime >= duration - 0.01 ? 0 : clamp(Number(fromTime || 0), 0, duration);
    startTimelineRef.current = start;
    startedAtRef.current = performance.now();
    syncAudio(audioRef.current, musicRef.current, start, duration, true);
    const ok = await syncToTimeline(start, true);
    if (!ok) return false;
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
    const safe = clamp(Number(time || 0), 0, Math.max(0, durationRef.current));
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

  useImperativeHandle(ref, () => ({ play, pause, seek, duration: () => durationRef.current }), [playhead, playing]);

  useEffect(() => {
    if (!clips.length) return undefined;
    void syncToTimeline(playhead, Boolean(playing));
    if (playing) {
      startTimelineRef.current = playhead;
      startedAtRef.current = performance.now();
      runClock();
    }
    return undefined;
  }, [clips]);

  useEffect(() => {
    if (playing) {
      void seek(playhead, true);
    } else syncAudio(audioRef.current, music, playhead, timelineDuration, false);
  }, [music.url, music.volume, music.start, music.trim_start, music.trim_end, music.duration, music.loop, music.fade_in, music.fade_out]);

  useEffect(() => {
    if (!playing) {
      stopFrame();
      deckARef.current?.pause();
      deckBRef.current?.pause();
      audioRef.current?.pause();
    }
  }, [playing]);

  useEffect(() => () => {
    stopFrame();
    deckARef.current?.pause();
    deckBRef.current?.pause();
    audioRef.current?.pause();
  }, []);

  const sharedProps = {
    controls: false,
    crossOrigin: 'anonymous',
    playsInline: true,
    preload: 'auto',
    style: { width: '100%', height: '100%', objectFit: 'cover', ...videoStyle },
  };

  return (
    <div className={`relative h-full w-full overflow-hidden bg-black ${className}`}>
      <video ref={deckARef} {...sharedProps} className={activeDeck === 'a' ? 'absolute inset-0 h-full w-full' : 'pointer-events-none absolute inset-0 h-full w-full opacity-0'} />
      <video ref={deckBRef} {...sharedProps} className={activeDeck === 'b' ? 'absolute inset-0 h-full w-full' : 'pointer-events-none absolute inset-0 h-full w-full opacity-0'} />
      <audio ref={audioRef} className="hidden" preload="auto" />
    </div>
  );
});

export default ShootTimelineEngine;
