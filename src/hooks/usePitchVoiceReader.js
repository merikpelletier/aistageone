import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/api/base44Client';

export function usePitchVoiceReader({ visibleSections, project, voice, language, currentIndex, onSectionChange, publicMode = false }) {
  const [isReading, setIsReading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [playingIndex, setPlayingIndex] = useState(-1);
  const [error, setError] = useState('');
  const audioRef = useRef(null);
  const cacheRef = useRef({});
  const indexRef = useRef(-1);
  const stoppedRef = useRef(true);
  const playbackRunRef = useRef(0);
  const sectionsRef = useRef(visibleSections);
  const onSectionChangeRef = useRef(onSectionChange);

  sectionsRef.current = visibleSections;
  onSectionChangeRef.current = onSectionChange;

  const stop = useCallback(() => {
    playbackRunRef.current += 1;
    stoppedRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
    setIsReading(false);
    setIsPaused(false);
    setIsGenerating(false);
    setPlayingIndex(-1);
    indexRef.current = -1;
  }, []);

  const playFrom = useCallback(async (startIndex) => {
    const run = ++playbackRunRef.current;
    stoppedRef.current = false;
    const sections = sectionsRef.current;
    let index = startIndex;

    const playNext = async () => {
      if (stoppedRef.current || run !== playbackRunRef.current) return;
      if (index >= sections.length) { stop(); return; }

      const section = sections[index];
      setPlayingIndex(index);
      indexRef.current = index;
      onSectionChangeRef.current?.(index);

      const cacheKey = `${section.id}|${voice}|${language}`;
      let url = cacheRef.current[cacheKey];
      if (!url) {
        setIsGenerating(true);
        const { data, error: requestError } = await supabase.functions.invoke('generatePitchSpeech', {
          body: {
            project_id: project?.id,
            share_slug: publicMode ? project?.share_slug || null : null,
            section_id: section.id,
            voice,
            language_code: language,
          },
        });
        if (stoppedRef.current || run !== playbackRunRef.current) return;
        setIsGenerating(false);
        if (requestError || !data?.url) {
          setError(data?.error || requestError?.message || 'Voice reader unavailable.');
          stop();
          return;
        }
        url = data.url;
        cacheRef.current[cacheKey] = url;
      }

      let audio = audioRef.current;
      if (!audio) {
        audio = new Audio();
        audioRef.current = audio;
      }
      audio.src = url;
      audio.onended = () => { index += 1; playNext(); };
      audio.onerror = () => {
        setError('Voice audio could not be played.');
        stop();
      };
      try {
        await audio.play();
      } catch {
        setError('Voice playback was blocked.');
        stop();
      }
    };

    await playNext();
  }, [project?.id, project?.share_slug, publicMode, stop, voice, language]);

  const play = useCallback(() => {
    if (!visibleSections.length) return;
    setError('');
    setIsReading(true);
    setIsPaused(false);
    playFrom(indexRef.current >= 0 ? indexRef.current : Math.max(0, currentIndex || 0));
  }, [currentIndex, playFrom, visibleSections.length]);

  const pause = useCallback(() => {
    if (!audioRef.current || audioRef.current.paused) return;
    audioRef.current.pause();
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    if (!audioRef.current?.src || !audioRef.current.paused) return;
    audioRef.current.play().then(() => setIsPaused(false)).catch(() => {
      setError('Voice playback was blocked.');
      stop();
    });
  }, [stop]);

  const toggle = useCallback(() => {
    if (!isReading) play();
    else if (isPaused) resume();
    else pause();
  }, [isPaused, isReading, pause, play, resume]);

  const previousVoiceRef = useRef(`${voice}|${language}`);
  useEffect(() => {
    if (previousVoiceRef.current === `${voice}|${language}`) return;
    previousVoiceRef.current = `${voice}|${language}`;
    cacheRef.current = {};
    if (isReading) {
      const restartAt = indexRef.current >= 0 ? indexRef.current : currentIndex;
      stop();
      setIsReading(true);
      playFrom(restartAt);
    }
  }, [currentIndex, isReading, playFrom, stop, voice, language]);

  useEffect(() => () => {
    playbackRunRef.current += 1;
    stoppedRef.current = true;
    audioRef.current?.pause();
  }, []);

  return { isReading, isPaused, isGenerating, playingIndex, error, toggle, stop };
}
