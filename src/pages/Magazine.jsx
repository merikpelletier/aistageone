import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import DossierViewer from '@/components/DossierViewer';
import DossierCoverActions from '@/components/DossierCoverActions';
import { ChevronDown, ChevronUp, LayoutGrid } from 'lucide-react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAppContext } from '@/lib/AppContext';

export default function Magazine() {
  const { setAppContext } = useAppContext();
  const [searchParams] = useSearchParams();
  const dossierId = searchParams.get('dossier');

  const { data: magazineSettings } = useQuery({
    queryKey: ['admin-surface-runtime', 'page', 'Magazine'],
    queryFn: async () => {
      const { data } = await base44.functions.invoke('admin-pages-tools', { action: 'runtime' });
      return (data?.settings || []).find((item) => item.surface_type === 'page' && item.surface_key === 'Magazine') || null;
    },
    staleTime: 60_000,
  });
  const magazineSectionDefaults = {
    cover_text: { visible: true, order: 0 },
    cover_actions: { visible: true, order: 1 },
    navigation_hints: { visible: true, order: 2 },
    dossier_indicators: { visible: true, order: 3 },
  };
  const magazineSections = (magazineSettings?.configuration?.magazine_sections || []).reduce(
    (map, item) => ({ ...map, [item.key]: { visible: item.visible !== false, order: Number(item.order ?? 0) } }),
    magazineSectionDefaults
  );
  
  const [currentDossierIndex, setCurrentDossierIndex] = useState(0);
  const [viewingDossier, setViewingDossier] = useState(null);
  // True landscape: width significantly larger than height (ratio > 1.2), not just a wide tablet in portrait
  const [isLandscape, setIsLandscape] = useState(window.innerWidth / window.innerHeight > 1.2);
  const containerRef = useRef(null);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);
  const hasInitialized = useRef(false);

  const { data: dossiers = [], isLoading } = useQuery({
    queryKey: ['dossiers', 'published'],
    queryFn: () => base44.entities.Dossier.filter({ status: 'published' }, 'order', 200),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!hasInitialized.current && dossiers.length > 0 && dossierId) {
      const index = dossiers.findIndex(d => d.id === dossierId);
      if (index !== -1) {
        setCurrentDossierIndex(index);
      }
      hasInitialized.current = true;
    }
  }, [dossiers.length]);

  const { data: allPages = [] } = useQuery({
    queryKey: ['dossierPages'],
    queryFn: () => base44.entities.DossierPage.list('order', 500),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e) => {
    touchEndY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    const diff = touchStartY.current - touchEndY.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentDossierIndex < dossiers.length - 1) {
        setCurrentDossierIndex(currentDossierIndex + 1);
      } else if (diff < 0 && currentDossierIndex > 0) {
        setCurrentDossierIndex(currentDossierIndex - 1);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (viewingDossier) return;
    if (e.key === 'ArrowDown' && currentDossierIndex < dossiers.length - 1) {
      setCurrentDossierIndex(currentDossierIndex + 1);
    } else if (e.key === 'ArrowUp' && currentDossierIndex > 0) {
      setCurrentDossierIndex(currentDossierIndex - 1);
    }
  };

  useEffect(() => {
    const handler = (e) => handleKeyDown(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentDossierIndex, viewingDossier, dossiers.length]);

  useEffect(() => {
    const handleResize = () => setIsLandscape(window.innerWidth / window.innerHeight > 1.2);
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Broadcast Magazine context
  useEffect(() => {
    const current = dossiers[currentDossierIndex];
    setAppContext({
      page: 'Magazine',
      section: viewingDossier ? `Reading dossier: ${viewingDossier.title}` : `Browsing covers (${currentDossierIndex + 1}/${dossiers.length})`,
      detail: current && !viewingDossier ? `Current cover: ${current.title}${current.subtitle ? ' — ' + current.subtitle : ''}` : null,
    });
  }, [currentDossierIndex, viewingDossier, dossiers.length]);

  const openDossier = async (dossier) => {
    const freshPages = await base44.entities.DossierPage.filter({ dossier_id: dossier.id }, 'order');
    setViewingDossier({ ...dossier, pages: freshPages });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-yellow-400 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-black/30 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  if (dossiers.length === 0) {
    return (
      <div className="min-h-screen bg-yellow-400 flex flex-col items-center justify-center text-center p-8">
        <h1 className="text-black text-3xl font-extralight tracking-widest mb-4">
          THE WISE PIG
        </h1>
        <p className="text-black text-sm">Coming soon...</p>
      </div>
    );
  }

  const currentDossier = dossiers[currentDossierIndex];

  const activeCoverVideo = isLandscape
    ? (currentDossier?.cover_video_landscape || currentDossier?.cover_video)
    : currentDossier?.cover_video;
  const activeCoverImage = isLandscape
    ? (currentDossier?.cover_image_landscape || currentDossier?.cover_image)
    : currentDossier?.cover_image;

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-yellow-400 pb-16"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Dossier Cover */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentDossier?.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="magazine-cover bg-black"
          style={{}}
          onClick={() => openDossier(currentDossier)}
        >
          {/* Cover Image/Video */}
          {activeCoverVideo ? (
            <video
              src={activeCoverVideo}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : activeCoverImage ? (
            <img
              src={activeCoverImage}
              alt=""
              className="absolute inset-0 w-full h-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 bg-black" />
          )}



          {/* Program toggle — top left */}
          <Link
            to="/Index"
            onClick={(e) => e.stopPropagation()}
            className="absolute top-[60px] left-4 z-20 w-9 h-9 bg-yellow-400 rounded-full flex items-center justify-center hover:bg-yellow-300 transition-colors"
          >
            <LayoutGrid size={16} className="text-black" />
          </Link>

          {/* Content */}
          {magazineSections.cover_text.visible && !currentDossier?.hide_text_on_cover && (
            <div className="absolute top-[108px] left-0 right-0 px-6">
              <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-white text-4xl md:text-6xl font-black tracking-wide mb-3 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
              >
                {currentDossier?.title}
              </motion.h1>
              {currentDossier?.subtitle && (
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-white text-lg font-light"
                >
                  {currentDossier.subtitle}
                </motion.p>
              )}
              {currentDossier?.author_name && (
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-white text-sm mt-4 tracking-wide"
                >
                  By {currentDossier.author_name}
                </motion.p>
              )}
            </div>
          )}

          {/* Tap to read indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              onClick={(e) => { e.stopPropagation(); openDossier(currentDossier); }}
              className="group flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/30 rounded-full px-7 py-3.5 hover:bg-white/20 transition-all"
            >
              <span className="text-white text-sm font-light tracking-[0.2em] uppercase">Explore</span>
              <span className="text-white group-hover:translate-x-1 transition-transform text-base">→</span>
            </motion.button>
          </div>

          {/* Cover Actions */}
          {magazineSections.cover_actions.visible && !activeCoverVideo && (
            <div onClick={(e) => e.stopPropagation()}>
              <DossierCoverActions dossierId={currentDossier?.id} />
            </div>
          )}
          </motion.div>
          </AnimatePresence>

      {/* Navigation hints */}
      {magazineSections.navigation_hints.visible && currentDossierIndex > 0 && (
        <button
          onClick={() => setCurrentDossierIndex(currentDossierIndex - 1)}
          className="fixed left-1/2 -translate-x-1/2 text-white hover:text-white transition-colors z-10 drop-shadow-lg" style={{ top: 'calc(52px + env(safe-area-inset-top) + 16px)' }}
        >
          <ChevronUp size={28} />
        </button>
      )}
      {magazineSections.navigation_hints.visible && currentDossierIndex < dossiers.length - 1 && (
        <button
          onClick={() => setCurrentDossierIndex(currentDossierIndex + 1)}
          className="fixed bottom-20 left-4 text-white hover:text-white transition-colors z-10 drop-shadow-lg"
        >
          <ChevronDown size={28} />
        </button>
      )}

      {/* Dossier indicators */}
      {magazineSections.dossier_indicators.visible && <div className="fixed right-3 flex flex-col gap-1 z-10 overflow-hidden" style={{ top: 'calc(52px + env(safe-area-inset-top) + 100px)', maxHeight: 'calc(100vh - 52px - env(safe-area-inset-top) - 180px)' }}>
        {dossiers.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentDossierIndex(idx)}
            className={`w-1 rounded-full transition-all flex-shrink-0 ${
              idx === currentDossierIndex ? 'bg-red-600 h-4' : 'bg-white/60 h-1.5'
            }`}
          />
        ))}
      </div>}

      {/* Dossier Viewer */}
      {viewingDossier && viewingDossier.pages?.length > 0 && (
        <DossierViewer
          pages={viewingDossier.pages}
          dossier={viewingDossier}
          onClose={() => setViewingDossier(null)}
        />
      )}
    </div>
  );
}