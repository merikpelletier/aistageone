import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Play, Pause, Mic, Users, Film, MapPin, Zap, Clapperboard, CheckCircle2, SkipForward } from 'lucide-react';

const blockTypeConfig = {
  character: { icon: Users, color: 'bg-red-500', label: 'Character' },
  establishing_shot: { icon: MapPin, color: 'bg-blue-500', label: 'Establishing Shot' },
  action_element: { icon: Zap, color: 'bg-yellow-500', label: 'Action' },
  transition: { icon: Clapperboard, color: 'bg-purple-500', label: 'Transition' },
  closing_shot: { icon: Film, color: 'bg-green-500', label: 'Closing Shot' },
};

const IMAGE_DISPLAY_DURATION = 5000;

export default function BlockPlayer({ blocks = [], characters = [], userBlocks = [], onClose, onProduce }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const videoRef = useRef(null);
  const narrationRef = useRef(null);
  const progressInterval = useRef(null);

  const sortedBlocks = [...blocks].sort((a, b) => (a.order || 0) - (b.order || 0));

  // Derive block-level values before any hooks that depend on them
  const block = sortedBlocks[currentIndex] || null;
  const config = block ? (blockTypeConfig[block.block_type] || { icon: Film, color: 'bg-gray-500', label: block.block_type || 'Block' }) : { icon: Film, color: 'bg-gray-500', label: 'Block' };
  const Icon = config.icon;
  const media = block?.reference_media?.[0] || null;
  const narrationAudio = block?.narration_audio || null;
  const isVideo = !!(media && media.match(/\.(mp4|webm|ogg|mov)$/i));
  const isAudio = !!(media && media.match(/\.(mp3|wav|m4a|ogg|aac|webm)$/i) && !isVideo);
  const isImage = !!(media && !isVideo && !isAudio);
  const character = block ? characters.find(c => c.id === block.assigned_character_id) : null;
  const userBlock = block ? userBlocks.find(b => b.id === block.id) : null;
  const hasUserVersion = !!userBlock?.media_url;

  const clearImageProgress = () => {
    clearInterval(progressInterval.current);
    progressInterval.current = null;
  };

  const goTo = (idx) => {
    clearImageProgress();
    setCurrentIndex(Math.max(0, Math.min(idx, sortedBlocks.length - 1)));
    setImageProgress(0);
  };

  const goNext = () => {
    if (currentIndex < sortedBlocks.length - 1) goTo(currentIndex + 1);
  };

  const goPrev = () => {
    if (currentIndex > 0) goTo(currentIndex - 1);
  };

  // Auto-advance image blocks (only when no narration — narration drives advance if present)
  useEffect(() => {
    clearImageProgress();
    setImageProgress(0);

    if (isPlaying && isImage && !narrationAudio) {
      const start = Date.now();
      progressInterval.current = setInterval(() => {
        const elapsed = Date.now() - start;
        const pct = Math.min((elapsed / IMAGE_DISPLAY_DURATION) * 100, 100);
        setImageProgress(pct);
        if (elapsed >= IMAGE_DISPLAY_DURATION) {
          clearImageProgress();
          goNext();
        }
      }, 50);
    }

    return clearImageProgress;
  }, [currentIndex, isPlaying, isImage, narrationAudio]);

  // Handle play/pause for video + narration
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
    if (narrationRef.current) {
      if (isPlaying) {
        narrationRef.current.play().catch(() => {});
      } else {
        narrationRef.current.pause();
      }
    }
  }, [isPlaying, currentIndex, narrationAudio]);

  // Preload next video for smoother transitions
  useEffect(() => {
    const nextBlock = sortedBlocks[currentIndex + 1];
    if (nextBlock) {
      const nextMedia = nextBlock.reference_media?.[0];
      if (nextMedia && nextMedia.match(/\.(mp4|webm|ogg|mov)$/i)) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'video';
        link.href = nextMedia;
        document.head.appendChild(link);
        return () => document.head.removeChild(link);
      }
    }
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') onClose?.();
      else if (e.key === ' ') { e.preventDefault(); setIsPlaying(p => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentIndex]);

  if (!block) return null;

  const handleVideoEnded = () => {
    if (isPlaying) goNext();
  };

  // When narration ends, advance (covers image blocks with narration)
  const handleNarrationEnded = () => {
    if (isPlaying) goNext();
  };

  return (
    <div className="fixed inset-0 bg-black z-[320] flex flex-col">
      {/* Progress bar (image auto-advance) */}
      {isImage && isPlaying && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/20 z-30">
          <div className="h-full bg-white transition-none" style={{ width: `${imageProgress}%` }} />
        </div>
      )}

      {/* Block index dots */}
      <div className="absolute top-4 left-0 right-0 flex justify-center gap-1.5 z-30 px-16">
        {sortedBlocks.map((_, i) => {
          const isUserDone = !!userBlocks.find(b => b.id === sortedBlocks[i].id)?.media_url;
          return (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`h-1 rounded-full transition-all ${
                i === currentIndex ? 'bg-white w-6' : isUserDone ? 'bg-green-400 w-2' : 'bg-white/30 w-2'
              }`}
            />
          );
        })}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute z-[310] w-11 h-11 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"
        style={{ top: 'calc(52px + env(safe-area-inset-top) + 8px)', right: '8px' }}
      >
        <X size={22} />
      </button>

      {/* Media area */}
      <div className="flex-1 relative overflow-hidden" onClick={() => setShowInfo(v => !v)}>
        {isVideo ? (
          <>
            {isBuffering && (
              <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
                <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            )}
            <video
              key={`video-${block.id}`}
              ref={videoRef}
              src={media}
              autoPlay={isPlaying}
              playsInline
              loop={false}
              preload="auto"
              onEnded={handleVideoEnded}
              onWaiting={() => setIsBuffering(true)}
              onCanPlay={() => setIsBuffering(false)}
              onPlaying={() => setIsBuffering(false)}
              className="w-full h-full object-contain bg-black"
              onClick={e => { e.stopPropagation(); setIsPlaying(p => !p); }}
            />
          </>
        ) : isImage ? (
          <img key={`img-${block.id}`} src={media} alt="" className="w-full h-full object-contain" />
        ) : (
          <div key={`fallback-${block.id}`} className="w-full h-full flex flex-col items-center justify-center gap-4 bg-black">
            <div className={`w-24 h-24 ${config.color} rounded-3xl flex items-center justify-center`}>
              <Icon size={44} className="text-black" />
            </div>
            <p className="text-white text-sm font-light">No reference media</p>
          </div>
        )}

        {isAudio && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center">
              <Mic size={48} className="text-white" />
            </div>
            <audio ref={videoRef} src={media} autoPlay={isPlaying} onEnded={handleVideoEnded} />
          </div>
        )}

        {/* Narration audio — plays alongside video/image */}
        {narrationAudio && (
          <audio
            ref={narrationRef}
            src={narrationAudio}
            autoPlay={isPlaying}
            onEnded={handleNarrationEnded}
          />
        )}

        {showInfo && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />
        )}
      </div>

      {/* Bottom info overlay */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-6 pointer-events-none"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-10 h-10 ${config.color} rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <Icon size={18} className="text-black" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-white text-xs font-bold uppercase tracking-widest">{config.label}</span>
                  <span className="text-white text-xs">{currentIndex + 1} / {sortedBlocks.length}</span>
                  {hasUserVersion && (
                    <span className="flex items-center gap-1 text-green-400 text-xs font-semibold">
                      <CheckCircle2 size={10} />Done
                    </span>
                  )}
                </div>
                <p className="text-white text-lg font-semibold leading-tight">{block.title || 'Untitled Block'}</p>
                {block.description && (
                  <p className="text-white text-sm font-light mt-1 line-clamp-2">{block.description}</p>
                )}
              </div>
            </div>

            {character && (
              <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-white/10 rounded-xl backdrop-blur-sm">
                {character.media?.[0] || character.photo_url ? (
                  <img src={character.media?.[0] || character.photo_url} alt={character.name} className="w-7 h-7 rounded-lg object-cover" />
                ) : (
                  <div className="w-7 h-7 bg-red-500 rounded-lg flex items-center justify-center">
                    <Users size={14} className="text-black" />
                  </div>
                )}
                <span className="text-white text-xs">Character: <span className="text-white font-semibold">{character.name}</span></span>
              </div>
            )}

            {block.dialogue && (
              <div className="mb-3 px-3 py-2 bg-black/50 rounded-xl border-l-2 border-red-500/70 backdrop-blur-sm">
                <div className="flex items-center gap-1.5 mb-1">
                  <Mic size={10} className="text-red-400" />
                  <span className="text-red-400 text-[10px] font-bold uppercase tracking-wider">Dialogue</span>
                </div>
                <p className="text-white/90 text-sm italic">"{block.dialogue}"</p>
              </div>
            )}

            {onProduce && (
              <button
                onClick={(e) => { e.stopPropagation(); onProduce(block); }}
                className={`pointer-events-auto w-full py-3 rounded-2xl text-sm font-bold tracking-wide transition-all ${
                  hasUserVersion ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'
                }`}
              >
                {hasUserVersion ? '✓ View / Replace Your Version' : '🎬 Produce This Block'}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prev / Next nav */}
      {currentIndex > 0 && (
        <button onClick={goPrev} className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-12 h-12 bg-black/50 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors">
          <ChevronLeft size={28} />
        </button>
      )}
      {currentIndex < sortedBlocks.length - 1 && (
        <button onClick={goNext} className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-12 h-12 bg-black/50 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors">
          <ChevronRight size={28} />
        </button>
      )}

      {/* Play / Pause + Skip */}
      <div className="absolute bottom-4 right-5 z-40 flex items-center gap-2">
        <button onClick={() => setIsPlaying(p => !p)} className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors backdrop-blur-sm">
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        {currentIndex < sortedBlocks.length - 1 && (
          <button onClick={goNext} className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors backdrop-blur-sm">
            <SkipForward size={16} />
          </button>
        )}
      </div>
    </div>
  );
}