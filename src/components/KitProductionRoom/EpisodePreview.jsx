import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Play, Pause, Film, RotateCcw } from 'lucide-react';

const IMAGE_DURATION = 5000;

export default function EpisodePreview({ production, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [visibleLayer, setVisibleLayer] = useState(0);
  const [layers, setLayers] = useState([0, -1]);
  const [imageProgress, setImageProgress] = useState(0);

  const videoRefs = [useRef(null), useRef(null)];
  const progressTimer = useRef(null);

  const blocks = [...(production?.blocks || [])]
    .filter(b => b.media_url)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const block = blocks[currentIndex];
  const isVideo = (url) => !!(url && url.match(/\.(mp4|webm|ogg|mov)$/i));
  const isAudio = (url) => !!(url && url.match(/\.(mp3|wav|m4a|ogg|aac)$/i));
  const isImage = (url) => !!(url && !isVideo(url) && !isAudio(url));

  // Ref mirror — event handlers read from here to avoid stale closures
  const ref = useRef({});
  ref.current.currentIndex = currentIndex;
  ref.current.visibleLayer = visibleLayer;
  ref.current.layers = layers;
  ref.current.blocksLen = blocks.length;

  // Commit the switch: flip visible layer, update index
  const doSwitch = (targetIdx) => {
    if (ref.current.pendingTarget !== targetIdx) return;
    ref.current.pendingTarget = null;
    const hiddenLayer = 1 - ref.current.visibleLayer;
    setVisibleLayer(hiddenLayer);
    setCurrentIndex(targetIdx);
  };

  // Switch to a specific block index
  const switchTo = (targetIdx) => {
    if (targetIdx < 0 || targetIdx >= ref.current.blocksLen) return;
    if (targetIdx === ref.current.currentIndex) return;
    if (ref.current.pendingTarget === targetIdx) return;

    const hiddenLayer = 1 - ref.current.visibleLayer;
    const alreadyLoaded = ref.current.layers[hiddenLayer] === targetIdx;

    // Update hidden layer to target block
    const newLayers = [...ref.current.layers];
    newLayers[hiddenLayer] = targetIdx;
    ref.current.layers = newLayers;
    setLayers(newLayers);
    ref.current.pendingTarget = targetIdx;

    // If hidden layer already had this block preloaded, switch now
    if (alreadyLoaded) {
      const v = videoRefs[hiddenLayer].current;
      if (v && v.readyState >= 3) {
        doSwitch(targetIdx);
        return;
      }
    }
    // Otherwise, onCanPlay / onLoad will fire and call doSwitch
  };

  const handleCanPlay = (layerIdx) => {
    const target = ref.current.pendingTarget;
    if (target === null || target === undefined) return;
    if (layerIdx === 1 - ref.current.visibleLayer) {
      doSwitch(target);
    }
  };

  const handleEnded = () => { if (isPlaying) switchTo(ref.current.currentIndex + 1); };

  // Preload next block into hidden layer (no switch — just buffer)
  useEffect(() => {
    if (ref.current.pendingTarget !== null && ref.current.pendingTarget !== undefined) return;
    const hiddenLayer = 1 - visibleLayer;
    const next = currentIndex + 1;
    if (next < blocks.length && layers[hiddenLayer] !== next) {
      const newLayers = [...layers];
      newLayers[hiddenLayer] = next;
      setLayers(newLayers);
    }
  }, [currentIndex, visibleLayer, blocks.length]);

  // Play/pause the visible video, pause the hidden one
  useEffect(() => {
    [0, 1].forEach(i => {
      const v = videoRefs[i].current;
      if (!v) return;
      if (i === visibleLayer && isPlaying) v.play().catch(() => {});
      else v.pause();
    });
  }, [isPlaying, visibleLayer, currentIndex]);

  // Image auto-advance with progress bar
  useEffect(() => {
    if (progressTimer.current) { clearInterval(progressTimer.current); progressTimer.current = null; }
    setImageProgress(0);
    if (!block || !isPlaying) return;
    if (isImage(block.media_url)) {
      const start = Date.now();
      progressTimer.current = setInterval(() => {
        const elapsed = Date.now() - start;
        setImageProgress(Math.min((elapsed / IMAGE_DURATION) * 100, 100));
        if (elapsed >= IMAGE_DURATION) {
          clearInterval(progressTimer.current);
          progressTimer.current = null;
          switchTo(currentIndex + 1);
        }
      }, 50);
    }
    return () => { if (progressTimer.current) { clearInterval(progressTimer.current); progressTimer.current = null; } };
  }, [currentIndex, isPlaying]);

  // Init
  useEffect(() => {
    setCurrentIndex(0); setIsPlaying(true); setLayers([0, -1]); setVisibleLayer(0);
    ref.current.pendingTarget = null;
  }, []);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') switchTo(ref.current.currentIndex + 1);
      else if (e.key === 'ArrowLeft') switchTo(ref.current.currentIndex - 1);
      else if (e.key === 'Escape') onClose?.();
      else if (e.key === ' ') { e.preventDefault(); setIsPlaying(p => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (blocks.length === 0) {
    return (
      <div className="fixed inset-0 bg-black z-[80] flex flex-col items-center justify-center gap-4">
        <p className="text-white text-sm">No scenes with media to preview yet.</p>
        <button onClick={onClose} className="px-6 py-2.5 bg-white text-black text-sm rounded-xl font-semibold">Close</button>
      </div>
    );
  }

  const renderLayerMedia = (layerIdx, blockIdx) => {
    if (blockIdx < 0 || blockIdx >= blocks.length) return null;
    const b = blocks[blockIdx];
    const isVisible = layerIdx === visibleLayer;

    if (isVideo(b.media_url)) {
      return (
        <video
          ref={videoRefs[layerIdx]}
          src={b.media_url}
          playsInline
          controls={false}
          preload="auto"
          muted={!isVisible}
          onEnded={isVisible ? handleEnded : undefined}
          onCanPlay={() => handleCanPlay(layerIdx)}
          className="max-w-full max-h-full object-contain"
        />
      );
    }
    if (isAudio(b.media_url)) {
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="w-32 h-32 rounded-full bg-white/10 flex items-center justify-center">
            <Film size={48} className="text-white/60" />
          </div>
          <audio src={b.media_url} autoPlay={isVisible && isPlaying} controls onEnded={isVisible ? handleEnded : undefined} className="w-full max-w-sm" />
        </div>
      );
    }
    return <img src={b.media_url} alt="" className="max-w-full max-h-full object-contain" onLoad={() => handleCanPlay(layerIdx)} />;
  };

  return (
    <div className="fixed inset-0 bg-black z-[80] flex flex-col">
      {block && isImage(block.media_url) && isPlaying && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/20 z-30">
          <div className="h-full bg-white transition-none" style={{ width: `${imageProgress}%` }} />
        </div>
      )}

      <div className="flex items-center justify-between px-4 pt-10 pb-3 flex-shrink-0 z-30">
        <div className="min-w-0">
          <p className="text-white/40 text-[10px] uppercase tracking-widest">Preview</p>
          <p className="text-white text-sm font-bold truncate">{production?.episode_title || production?.production_name || 'Untitled'}</p>
        </div>
        <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-white">
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {[0, 1].map(layerIdx => (
          <div
            key={layerIdx}
            className="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
            style={{ opacity: layerIdx === visibleLayer ? 1 : 0 }}
          >
            {renderLayerMedia(layerIdx, layers[layerIdx])}
          </div>
        ))}
      </div>

      {block && (block.title || block.description) && (
        <div className="absolute bottom-24 left-0 right-0 px-6 py-3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-20">
          {block.title && <p className="text-white text-base font-bold">{block.title}</p>}
          {block.description && <p className="text-white/70 text-sm mt-0.5 line-clamp-2">{block.description}</p>}
        </div>
      )}

      <div className="flex-shrink-0 px-6 pb-8 pt-4 flex items-center justify-between gap-4 z-30">
        <button onClick={() => switchTo(currentIndex - 1)} disabled={currentIndex === 0}
          className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white disabled:opacity-30">
          <ChevronLeft size={22} />
        </button>

        <div className="flex-1 flex items-center gap-1.5">
          {blocks.map((b, i) => (
            <button key={b.id || i} onClick={() => switchTo(i)}
              className={`h-1.5 rounded-full transition-all flex-1 ${i === currentIndex ? 'bg-red-500' : 'bg-white/20 hover:bg-white/40'}`}
            />
          ))}
        </div>

        <button onClick={() => setIsPlaying(p => !p)}
          className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white">
          {isPlaying ? <Pause size={20} /> : <Play size={20} className="fill-white" />}
        </button>

        <button onClick={() => switchTo(0)} disabled={currentIndex === 0}
          className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white disabled:opacity-30">
          <RotateCcw size={20} />
        </button>

        <button onClick={() => switchTo(currentIndex + 1)} disabled={currentIndex >= blocks.length - 1}
          className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white disabled:opacity-30">
          <ChevronRight size={22} />
        </button>
      </div>
    </div>
  );
}