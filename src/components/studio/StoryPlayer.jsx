import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function StoryPlayer({ blocks, hero, theme, onClose }) {
  const allSegments = useMemo(() => {
    const segs = [];
    blocks.forEach((block, blockIdx) => {
      const instructions = block.segment_instructions || [];
      const mediaUrls = block.video_segments || [];
      const narrationUrls = block.narration_audio_urls || [];
      const maxSegs = Math.max(mediaUrls.length, instructions.length);
      for (let segIdx = 0; segIdx < maxSegs; segIdx++) {
        const instruction = instructions[segIdx] || {};
        // Use video_segments URL, fall back to manual_media_url from instructions
        const mediaUrl = mediaUrls[segIdx] || instruction.manual_media_url;
        if (!mediaUrl) continue;
        segs.push({
          url: mediaUrl,
          mediaType: instruction.media_type || 'image',
          narrationUrl: narrationUrls[segIdx] || null,
          blockIdx,
          segIdx,
          blockTitle: block.block_title || `Block ${blockIdx + 1}`,
          narrative: block.narrative_summary || '',
        });
      }
    });
    return segs;
  }, [blocks]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [showEndCard, setShowEndCard] = useState(false);
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const fallbackTimerRef = useRef(null);

  const current = allSegments[currentIdx];
  const isLast = currentIdx >= allSegments.length - 1;

  const clearFallback = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const goToNext = useCallback(() => {
    clearFallback();
    if (currentIdx >= allSegments.length - 1) {
      setShowEndCard(true);
      return;
    }
    setCurrentIdx(currentIdx + 1);
  }, [currentIdx, allSegments.length, clearFallback]);

  const goToPrev = useCallback(() => {
    clearFallback();
    if (currentIdx === 0) return;
    setCurrentIdx(currentIdx - 1);
  }, [currentIdx, clearFallback]);

  // Set fallback timer for segments without narration
  useEffect(() => {
    if (!current) return;

    // No narration URL — use fallback timer to advance (narration autoPlay handles the rest)
    if (!current.narrationUrl) {
      const duration = current.mediaType === 'video' ? 5000 : 8000;
      fallbackTimerRef.current = setTimeout(goToNext, duration);
    }

    return () => clearFallback();
  }, [currentIdx, current, goToNext, clearFallback]);

  // Drive narration playback from a single persistent <audio> element.
  // Setting src + calling play() imperatively is more reliable than key-based
  // remounting, which can leave audioRef.current null when the effect runs.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Clear any stale fallback timer from the previous segment so it can't
    // fire prematurely and skip the new narration before it loads.
    clearFallback();

    if (!current?.narrationUrl) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      return;
    }

    // pause before swapping src so the old source doesn't emit a spurious
    // error event that would trigger a fallback timer.
    audio.pause();
    audio.src = current.narrationUrl;
    audio.load(); // force the browser to process the new source
    audio.play().catch((err) => {
      console.warn('[StoryPlayer] Narration play failed:', err.message);
      fallbackTimerRef.current = setTimeout(goToNext, 8000);
    });
  }, [currentIdx, current?.narrationUrl, goToNext, clearFallback]);

  // Stop all audio on unmount (when player closes)
  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  if (allSegments.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black z-[9999] flex flex-col"
    >
      <style>{`
        @keyframes kenBurns {
          0% { transform: scale(1) translate(0%, 0%); }
          100% { transform: scale(1.15) translate(-2%, -2%); }
        }
      `}</style>

      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
        <button onClick={() => { clearFallback(); onClose(); }} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
          <X size={20} className="text-white" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs uppercase tracking-wider font-bold">{theme?.title || 'Story'}</p>
          <p className="text-white font-bold text-sm truncate">{hero?.name || 'Hero'}'s Story</p>
        </div>
        <div className="bg-white/10 rounded-xl px-3 py-1.5 flex-shrink-0">
          <p className="text-white text-xs font-bold">{currentIdx + 1} / {allSegments.length}</p>
        </div>
      </div>

      {/* Media display */}
      <div className="flex-1 flex items-center justify-center bg-black relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIdx}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            {current?.mediaType === 'video' ? (
              <video
                ref={videoRef}
                src={current.url}
                muted
                loop
                playsInline
                autoPlay
                className="w-full h-full object-contain"
              />
            ) : (
              <img
                src={current.url}
                alt=""
                className="w-full h-full object-cover"
                style={{ animation: 'kenBurns 12s ease-out forwards' }}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Tap zones */}
        <button onClick={goToPrev} className="absolute left-0 top-0 bottom-0 w-1/4 z-20" disabled={currentIdx === 0} />
        <button onClick={goToNext} className="absolute right-0 top-0 bottom-0 w-1/4 z-20" disabled={isLast} />

        {/* Prev/Next buttons */}
        {currentIdx > 0 && (
          <button onClick={goToPrev} className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm active:scale-90 transition-transform z-30">
            <ChevronLeft size={24} className="text-white" />
          </button>
        )}
        {!isLast && (
          <button onClick={goToNext} className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm active:scale-90 transition-transform z-30">
            <ChevronRight size={24} className="text-white" />
          </button>
        )}

        {/* Ended overlay */}
        {showEndCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4 z-40"
          >
            <p className="text-white text-2xl font-bold">End of Story</p>
            <p className="text-white text-sm">{blocks.length} blocks • {allSegments.length} scenes</p>
            <button onClick={onClose} className="mt-4 px-8 py-3 bg-yellow-400 text-black font-bold rounded-2xl active:scale-95 transition-transform">
              Back to Story
            </button>
          </motion.div>
        )}
      </div>

      {/* Persistent narration audio — src is set imperatively in useEffect */}
      <audio
        ref={audioRef}
        preload="auto"
        onEnded={goToNext}
      />

      {/* Bottom info bar */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIdx}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="px-5 py-4 bg-black/80" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          <p className="text-yellow-400 text-xs font-bold uppercase tracking-wider">{current?.blockTitle}</p>
          {current?.narrative && (
            <p className="text-white text-sm mt-1 line-clamp-2">{current.narrative}</p>
          )}
          {/* Progress bar */}
          <div className="mt-3 flex gap-1">
            {allSegments.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${i <= currentIdx ? 'bg-yellow-400' : 'bg-white/20'}`}
              />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
