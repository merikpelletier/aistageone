import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ShoppingCart, Bookmark, List, X, LayoutGrid } from 'lucide-react';
import { useVault } from '@/hooks/useVault';
import { base44 } from '@/api/base44Client';
import { useAppContext } from '@/lib/AppContext';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import ProductOptionsModal from '@/components/ProductOptionsModal';
import DossierCoverActions from '@/components/DossierCoverActions';
import ProductionRoom from '@/components/ProductionRoom';
import KitProductionRoom from '@/components/KitProductionRoom';
import SeriesPageViewer from '@/components/SeriesPageViewer';
import ProductionKitViewer from '@/components/ProductionKitViewer';
import MemberEpisodesPage from '@/components/MemberEpisodesPage';
import BlockPlayer from '@/components/production/BlockPlayer';
// Small helper: loads EpisodeProduction and shows a "Watch Blocks" button
function EpisodeBlocksButton({ episodePageId, dossierId, onPlay }) {
  const [epProd, setEpProd] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  const load = async () => {
    if (loaded) { if (epProd) onPlay({ blocks: epProd.timeline || [], characters: epProd.characters || [] }); return; }
    setLoading(true);
    const { base44 } = await import('@/api/base44Client');
    const results = await base44.entities.EpisodeProduction.filter({ episode_page_id: episodePageId }).catch(() => []);
    const prod = results[0] || null;
    setEpProd(prod);
    setLoaded(true);
    setLoading(false);
    if (prod?.timeline?.length > 0) onPlay({ blocks: prod.timeline, characters: prod.characters || [] });
  };

  if (loaded && (!epProd || !epProd.timeline?.length)) return null;

  return (
    <button
      onClick={load}
      disabled={loading}
      className="mt-2 w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-2xl text-white text-sm font-bold tracking-wide flex items-center justify-center gap-2 transition-colors pointer-events-auto"
    >
      {loading ? '⏳ Loading...' : '▶ Watch Episode Blocks'}
    </button>
  );
}

// Helper: loads EpisodeProduction (or TimelineStory) for block_player page type and auto-plays
function BlockPlayerLoader({ episodePageId, dossierId, onPlay, blockIds }) {
  const [loading, setLoading] = React.useState(true);
  const onPlayRef = React.useRef(onPlay);
  onPlayRef.current = onPlay;

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { base44 } = await import('@/api/base44Client');
      // Try EpisodeProduction first (legacy episode pages)
      const results = await base44.entities.EpisodeProduction.filter({ episode_page_id: episodePageId }).catch(() => []);
      const prod = results[0] || null;
      if (cancelled) return;
      if (prod?.timeline?.length > 0) {
        setLoading(false);
        onPlayRef.current({ blocks: prod.timeline, characters: prod.characters || [] });
        return;
      }
      // Fallback 1: episodePageId is a TimelineStory production_id
      try {
        const story = await base44.entities.TimelineStory.get(episodePageId);
        if (cancelled) return;
        const rawBlocks = (story?.blocks || []).filter(b => b.media_url).sort((a, b) => (a.order || 0) - (b.order || 0));
        // Map TimelineStory blocks to the format BlockPlayer expects (reference_media array)
        const blocks = rawBlocks.map(b => ({
          ...b,
          reference_media: b.media_url ? [b.media_url] : [],
          block_type: b.media_type === 'video' ? 'closing_shot' : 'establishing_shot',
        }));
        if (blocks.length > 0) {
          onPlayRef.current({ blocks, characters: [] });
          return;
        }
      } catch {}

      // Fallback 2: episodePageId is a StorySession ID — load StoryBlocks and flatten segments
      try {
        let storyBlocks = await base44.entities.StoryBlock.filter({ session_id: episodePageId }, 'order', 200);
        if (cancelled) return;
        // Restrict to specific chapters if the published page only includes a subset
        if (blockIds && blockIds.length > 0) {
          const idSet = new Set(blockIds);
          storyBlocks = storyBlocks.filter(b => idSet.has(b.id));
        }
        const blocks = [];
        for (const sb of storyBlocks) {
          const segs = sb.video_segments || [];
          const instructions = sb.segment_instructions || [];
          for (let i = 0; i < segs.length; i++) {
            if (segs[i]) {
              blocks.push({
                id: `${sb.id}-${i}`,
                order: blocks.length,
                title: instructions[i]?.story_action || sb.block_title || `Scene ${blocks.length + 1}`,
                description: instructions[i]?.narration_text || sb.narrative_summary || '',
                reference_media: [segs[i]],
                narration_audio: (sb.narration_audio_urls || [])[i] || '',
                block_type: instructions[i]?.media_type === 'video' ? 'closing_shot' : 'establishing_shot',
              });
            }
          }
        }
        if (blocks.length > 0) {
          onPlayRef.current({ blocks, characters: [] });
        }
      } catch {}
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [episodePageId, blockIds]);

  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return null;
}

export default function DossierViewer({ pages, onClose, dossier }) {
  const { userEmail, savedUrls, saveToVault } = useVault();
  const { setAppContext } = useAppContext();
  const [productionEpisode, setProductionEpisode] = useState(null);
  const [kitProductionPage, setKitProductionPage] = useState(null);
  const [blockPlayerData, setBlockPlayerData] = useState(null); // { blocks, characters }
  const kitProductionDismissed = React.useRef(false);
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);

  useEffect(() => {
    const handleResize = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
      setCurrentPage(0);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);
  const activeFormat = isLandscape ? 'landscape' : 'portrait';
  const filteredPages = (pages || []).filter(p => !p.is_hidden_from_public);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [added, setAdded] = useState(false);
  const [currentProductImage, setCurrentProductImage] = useState(0);

  useEffect(() => {
    setCurrentProductImage(0);
    kitProductionDismissed.current = false;
    setKitProductionPage(null);
  }, [currentPage]);

  // Broadcast DossierViewer context
  useEffect(() => {
    const page = filteredPages[currentPage];
    setAppContext({
      page: 'Magazine',
      section: `Reading dossier: ${dossier?.title || 'unknown'}`,
      detail: page ? `Page ${currentPage + 1}/${filteredPages.length} — type: ${page.page_type}${page.title ? ', title: ' + page.title : ''}${page.episode_title ? ', episode: ' + page.episode_title : ''}` : null,
    });
  }, [currentPage, dossier?.title, filteredPages.length]);
  const [showIndex, setShowIndex] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const containerRef = useRef(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);
  const isTouchingVideo = useRef(false);

  const handleTouchStart = (e) => {
    // Skip if touch started on interactive elements
    if (e.target.closest('video, button, input, [role="button"]')) return;
    
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e) => {
    // Skip if no touch start recorded
    if (touchStartX.current === 0) return;
    
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    const diffX = touchStartX.current - touchEndX.current;
    const diffY = touchStartY.current - touchEndY.current;
    
    // Only navigate on significant horizontal swipe
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
      if (diffX > 0 && currentPage < filteredPages.length - 1) {
        setCurrentPage(currentPage + 1);
      } else if (diffX < 0 && currentPage > 0) {
        setCurrentPage(currentPage - 1);
      }
    }
    
    // Reset
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowRight' && currentPage < filteredPages.length - 1) {
      setCurrentPage(currentPage + 1);
    } else if (e.key === 'ArrowLeft' && currentPage > 0) {
      setCurrentPage(currentPage - 1);
    } else if (e.key === 'Escape') {
      onClose?.();
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage]);

  const page = filteredPages[currentPage] || filteredPages[0];
  // Use landscape-specific media if available, otherwise fall back to portrait media
  const activeMediaUrl = (isLandscape && page?.media_url_landscape)
    ? page.media_url_landscape
    : (page?.media_url || page?.media_url_landscape);

  const textPositionClass = {
    top: 'items-start pt-20',
    center: 'items-center',
    bottom: 'items-end pb-24'
  }[page?.text_position || 'center'];

  const addToCart = () => {
    const cart = JSON.parse(sessionStorage.getItem('cochon_cart') || '[]');
    
    const optionsKey = JSON.stringify(selectedOptions);
    const existing = cart.find(item => 
      item.id === page.id && JSON.stringify(item.options || {}) === optionsKey
    );
    
    let newCart;
    if (existing) {
      newCart = cart.map(item => 
        item.id === page.id && JSON.stringify(item.options || {}) === optionsKey
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    } else {
      newCart = [...cart, { 
        id: page.id, 
        name: page.title || dossier.title,
        price: page.price,
        image_url: activeMediaUrl || dossier.cover_image,
        options: selectedOptions,
        quantity: 1 
      }];
    }
    
    sessionStorage.setItem('cochon_cart', JSON.stringify(newCart));
    setSelectedOptions({});
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <>
    <div
      ref={containerRef}
      className={`fixed bg-black z-30 ${isLandscape ? 'inset-0 flex items-center justify-center' : 'inset-x-0 top-0'}`}
      style={isLandscape ? {} : { bottom: 'calc(56px + env(safe-area-inset-bottom))' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <AnimatePresence mode="wait">
         <motion.div
           key={currentPage}
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           transition={{ duration: 0.3 }}
           className={isLandscape
             ? "relative w-full max-w-5xl mx-auto flex h-screen pointer-events-auto"
             : "absolute inset-0 pointer-events-auto"
           }
         >
          {/* Background Media — only when NOT stacked layout and NOT a product */}
          {!isLandscape && !page?.is_product && page?.page_type !== 'series' && activeMediaUrl && !(page?.page_type === 'mixed' && page?.image_layout !== 'background') && (
            page?.page_type === 'video' ? (
              <div className="absolute inset-0 pointer-events-auto">
                <video
                  key={currentPage}
                  src={activeMediaUrl}
                  autoPlay
                  loop
                  playsInline
                  controls
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={(e) => { e.stopPropagation(); setFullscreenImage(activeMediaUrl); }}
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                  className="absolute top-4 right-4 z-20 bg-black/60 text-white rounded-full w-12 h-12 flex items-center justify-center text-2xl"
                >⛶</button>
                <button
                  onClick={(e) => { e.stopPropagation(); setFullscreenImage(activeMediaUrl); }}
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => { e.stopPropagation(); }}
                  className="absolute top-4 right-4 z-20 bg-black/60 text-white rounded-full w-12 h-12 flex items-center justify-center text-2xl"
                >⛶</button>
              </div>
            ) : (
              <img
                src={activeMediaUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-contain"
              />
            )
          )}

          {/* Stacked layout: image above or below text */}
          {!isLandscape && page?.page_type === 'mixed' && page?.image_layout !== 'background' && (
            <div className="absolute inset-0 flex flex-col overflow-y-auto pointer-events-auto pb-20 pt-4">
              {(page?.image_layout === 'above' || (!page?.image_layout && activeMediaUrl)) && (
                <img src={activeMediaUrl} alt="" className="w-full object-contain flex-shrink-0 cursor-pointer" style={{ maxHeight: '50vh' }} onClick={() => setFullscreenImage(activeMediaUrl)} />
              )}
              <div className={`flex flex-col px-6 py-4 flex-1 ${page?.text_color === 'black' ? 'text-black' : 'text-white'}`}>
                {page?.title && (
                  <h2 className="text-3xl font-extralight tracking-widest mb-4 flex-shrink-0">{page.title}</h2>
                )}
                {page?.content && (
                  <div
                    className="text-base font-light leading-relaxed whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: page.content }}
                  />
                )}
              </div>
              {page?.image_layout === 'below' && (
                <img src={activeMediaUrl} alt="" className="w-full object-contain flex-shrink-0 cursor-pointer" style={{ maxHeight: '50vh' }} onClick={() => setFullscreenImage(activeMediaUrl)} />
              )}
              {/* Media gallery */}
              {(page?.images || []).length > 0 && (
                <div className="px-4 pb-6 grid grid-cols-2 gap-2">
                  {page.images.map((img, idx) => (
                    img.match(/\.(mp4|webm|ogg)$/i) ? (
                      <video key={idx} src={img} playsInline className="w-full rounded-lg object-cover cursor-pointer" style={{ maxHeight: '45vw' }} onClick={(e) => { e.currentTarget.pause(); setFullscreenImage(img); }} />
                    ) : (
                      <div key={idx} className="relative rounded-lg" style={{ height: '45vw' }}>
                        <img src={img} alt="" className="w-full h-full object-cover cursor-pointer rounded-lg" onClick={() => setFullscreenImage(img)} />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            saveToVault(img, 'image', dossier?.id || '', 'reference');
                          }}
                          className={`absolute bottom-2 right-2 z-10 w-9 h-9 flex items-center justify-center rounded-full shadow-lg ${savedUrls.has(img) ? 'bg-red-600 text-white' : 'bg-black/60 text-white'}`}
                        >
                          <Bookmark size={16} fill={savedUrls.has(img) ? 'white' : 'none'} />
                        </button>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          )}



          {/* Landscape layout: image left, text right */}
          {isLandscape && (
            <div className="flex w-full h-full">
              {activeMediaUrl && (
                <div className="w-1/2 h-full flex-shrink-0 overflow-hidden pointer-events-auto">
                  {page?.page_type === 'video' ? (
                    <video
                      key={currentPage}
                      src={activeMediaUrl}
                      autoPlay
                      loop
                      playsInline
                      controls
                      className="w-full h-full object-cover pointer-events-auto"
                    />
                  ) : (
                    <img
                      src={activeMediaUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              )}
              <div className={`flex flex-col justify-center px-10 py-12 overflow-y-auto ${page?.media_url ? 'w-1/2' : 'w-full'}`}>
                {page?.title && (
                  <h2 className="text-3xl md:text-4xl font-extralight tracking-widest mb-6 text-white">
                    {page.title}
                  </h2>
                )}
                {page?.content && (
                  <div
                    className="text-base md:text-lg font-light leading-relaxed text-white/90"
                    dangerouslySetInnerHTML={{ __html: page.content }}
                  />
                )}
              </div>
            </div>
          )}

          {/* Series page */}
          {page?.page_type === 'series' && (
            <SeriesPageViewer
              page={page}
              onImageClick={setFullscreenImage}
              dossierId={dossier?.id || ''}
              allPages={pages}
              onNavigateToPage={(p) => {
                const idx = pages.findIndex(pg => pg.id === p.id);
                if (idx !== -1) setCurrentPage(idx);
              }}
            />
          )}

          {/* Production Kit page — show spinner, production room opens via overlay */}
          {page?.page_type === 'production_kit' && !kitProductionPage && (() => {
            if (!kitProductionDismissed.current) {
              kitProductionDismissed.current = true;
              setTimeout(() => setKitProductionPage(page), 0);
            }
            return (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            );
          })()}

          {/* Join the Cast page */}
          {page?.page_type === 'join_cast' && (() => {
            const episodePages = pages.filter(p => p.page_type === 'episode');
            return (
              <div className="absolute inset-0 flex flex-col px-6 pt-16 pb-20 overflow-y-auto pointer-events-auto bg-black">
                <h2 className="text-white text-3xl font-extralight tracking-widest mb-2">{page.title || 'Join the Cast'}</h2>
                {page.content && <p className="text-white text-sm mb-6 font-light">{page.content}</p>}
                <div className="space-y-4">
                  {episodePages.map((ep, idx) => {
                    const epMedia = ep.media_url;
                    const isVideo = epMedia && epMedia.match(/\.(mp4|webm|ogg)$/i);
                    return (
                      <div key={ep.id || idx} className="border border-white/10 rounded-lg overflow-hidden bg-white/5">
                        {/* Episode video/image preview */}
                        {epMedia && (
                          isVideo ? (
                            <video
                              src={epMedia}
                              playsInline
                              controls
                              className="w-full object-cover pointer-events-auto"
                              style={{ aspectRatio: '9/16', maxHeight: '70vh' }}
                              onTouchStart={(e) => e.stopPropagation()}
                              onTouchMove={(e) => e.stopPropagation()}
                              onTouchEnd={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <img
                              src={epMedia}
                              alt=""
                              className="w-full object-cover cursor-pointer"
                              style={{ maxHeight: '40vw' }}
                              onClick={() => setFullscreenImage(epMedia)}
                            />
                          )
                        )}
                        <div className="p-4">
                          <p className="text-white font-medium tracking-wide mb-1">{ep.episode_title || `Episode ${idx + 1}`}</p>
                          {ep.episode_role && <p className="text-red-400 text-sm mb-1">Role: {ep.episode_role}</p>}
                          {ep.episode_description && <p className="text-white text-xs leading-relaxed mb-2 line-clamp-3">{ep.episode_description}</p>}
                          {ep.episode_tools_hint && <p className="text-white text-xs mb-3">🛠 {ep.episode_tools_hint}</p>}
                          <button
                            onClick={() => setProductionEpisode(ep)}
                            className="w-full py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-light tracking-widest rounded-lg transition-colors"
                          >
                            JOIN →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {episodePages.length === 0 && (
                    <p className="text-white text-sm">No episodes available yet.</p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Member Episodes page */}
          {page?.page_type === 'member_episodes' && (
            <MemberEpisodesPage page={page} dossier={dossier} pages={pages} />
          )}

          {/* Block Player page */}
          {page?.page_type === 'block_player' && page?.block_player_episode_page_id && (
            <BlockPlayerLoader
              episodePageId={page.block_player_episode_page_id}
              dossierId={dossier?.id}
              blockIds={page.block_player_block_ids}
              onPlay={(data) => setBlockPlayerData(data)}
            />
          )}

          {/* Block Player page */}
          {page?.page_type === 'block_player' && page?.block_player_episode_page_id && (
            <BlockPlayerLoader
              episodePageId={page.block_player_episode_page_id}
              dossierId={dossier?.id}
              blockIds={page.block_player_block_ids}
              onPlay={(data) => setBlockPlayerData(data)}
            />
          )}

          {/* Episode page */}
          {page?.page_type === 'episode' && (
            <div className="absolute inset-0 flex flex-col overflow-y-auto pointer-events-auto bg-black">
              {/* Episode video/image header */}
              {activeMediaUrl && (
                activeMediaUrl.match(/\.(mp4|webm|ogg)$/i) ? (
                  <video
                    key={currentPage}
                    src={activeMediaUrl}
                    autoPlay
                    loop
                    playsInline
                    controls
                    className="w-full flex-shrink-0 pointer-events-auto"
                    style={{ maxHeight: '45vh' }}
                  />
                ) : (
                  <img src={activeMediaUrl} alt="" className="w-full flex-shrink-0 object-cover" style={{ maxHeight: '45vh' }} />
                )
              )}
              <div className="px-6 pt-5 pb-24 flex flex-col gap-3">
                <p className="text-white text-xs tracking-widest uppercase">Episode</p>
                <h2 className="text-white text-2xl font-extralight tracking-wider leading-tight">{page.episode_title || page.title || 'Episode'}</h2>
                {page.episode_role && (
                  <p className="text-red-400 text-sm tracking-wide">Role: {page.episode_role}</p>
                )}
                {page.episode_description && (
                  <p className="text-white text-sm font-light leading-relaxed whitespace-pre-wrap">{page.episode_description}</p>
                )}
                {page.episode_tools_hint && (
                  <p className="text-white text-xs">🛠 Suggested tools: {page.episode_tools_hint}</p>
                )}
                {/* Watch Blocks button — loads EpisodeProduction for this episode page */}
                <EpisodeBlocksButton episodePageId={page.id} dossierId={dossier?.id} onPlay={(data) => setBlockPlayerData(data)} />
              </div>
            </div>
          )}

          {/* Portrait Content */}
          {!page?.is_product && page?.page_type !== 'join_cast' && page?.page_type !== 'episode' && page?.page_type !== 'series' && page?.page_type !== 'member_episodes' && page?.page_type !== 'block_player' && !(page?.page_type === 'mixed' && page?.image_layout !== 'background') && (
            <div className={`${isLandscape ? 'hidden' : ''} absolute inset-0 flex flex-col px-6 pt-16 pb-20 pointer-events-none`}>
              {page?.title && (
                <h2 className={`text-3xl md:text-5xl font-extralight tracking-widest mb-6 flex-shrink-0 ${
                  page?.text_color === 'black' ? 'text-black' : 'text-white'
                }`}>
                  {page.title}
                </h2>
              )}
              {page?.content && (
                <div
                  className={`w-full text-base md:text-lg font-light leading-relaxed overflow-y-auto pointer-events-auto flex-1 whitespace-pre-wrap ${
                    page?.text_color === 'black' ? 'text-black/90' : 'text-white/90'
                  }`}
                  dangerouslySetInnerHTML={{ __html: page.content }}
                />
              )}
            </div>
          )}

        </motion.div>
      </AnimatePresence>


      {/* Left nav: go back a page, or close if on first page */}
      <button
        onClick={() => currentPage > 0 ? setCurrentPage(currentPage - 1) : onClose?.()}
        className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors z-40 pointer-events-auto"
      >
        <ChevronLeft size={32} />
      </button>

      {/* Right nav: go forward a page */}
      {currentPage < pages.length - 1 && (
        <button
          onClick={() => setCurrentPage(currentPage + 1)}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors z-40 pointer-events-auto"
        >
          <ChevronRight size={32} />
        </button>
      )}

      {/* Save to Vault button */}
      {activeMediaUrl && !page?.is_product && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!userEmail) { base44.auth.redirectToLogin(window.location.href); return; }
            saveToVault(activeMediaUrl, activeMediaUrl.match(/\.(mp4|webm|ogg)$/i) ? 'video' : 'image', dossier?.id || '', 'reference');
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          className={`absolute z-40 rounded-full w-12 h-12 flex items-center justify-center transition-colors pointer-events-auto shadow-lg ${
            savedUrls.has(activeMediaUrl) ? 'bg-red-600 text-white' : 'bg-black/60 text-white hover:bg-black/80'
          }`}
          style={{ top: 'calc(52px + env(safe-area-inset-top) + 8px)', right: '68px' }}
        >
          <Bookmark size={20} fill={savedUrls.has(activeMediaUrl) ? 'white' : 'none'} />
        </button>
      )}

      {/* Index toggle button (menu) */}
      <button
        onClick={() => setShowIndex(v => !v)}
        className="absolute right-4 z-40 bg-white text-black rounded-full w-12 h-12 flex items-center justify-center transition-colors pointer-events-auto shadow-lg" style={{ top: 'calc(52px + env(safe-area-inset-top) + 8px)' }}
      >
        {showIndex ? <X size={20} /> : <List size={20} />}
      </button>

      {/* Persistent program grid button — on all dossier pages */}
      <Link
        to="/Index"
        onClick={(e) => e.stopPropagation()}
        className="absolute left-4 z-40 w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center hover:bg-yellow-300 transition-colors pointer-events-auto shadow-lg"
        style={{ top: 'calc(52px + env(safe-area-inset-top) + 8px)' }}
      >
        <LayoutGrid size={20} className="text-black" />
      </Link>



      {/* Table of Contents panel */}
      <AnimatePresence>
        {showIndex && (
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 60 }}
            transition={{ duration: 0.2 }}
            className="absolute top-0 right-0 bottom-0 z-30 w-72 max-w-[85vw] bg-black/90 backdrop-blur-sm flex flex-col pointer-events-auto overflow-y-auto"
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/10 flex-shrink-0">
              <h3 className="text-white font-light tracking-widest text-sm uppercase">Contents</h3>
              <button onClick={() => setShowIndex(false)} className="text-white hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {filteredPages.map((p, idx) => {
                const pageTypeIcon = {
                  cover: '🖼️', text: '📝', image: '🖼️', video: '🎬', mixed: '📰',
                  join_cast: '🎭', episode: '🎬', series: '📺', production_kit: '🎬', member_episodes: '🌟'
                }[p.page_type] || '📄';
                const label = p.episode_title || p.title || p.page_type;
                const isActive = idx === currentPage;
                return (
                  <button
                    key={p.id || idx}
                    onClick={() => { setCurrentPage(idx); setShowIndex(false); }}
                    className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${
                      isActive ? 'bg-white/10 text-white' : 'text-white hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="text-base flex-shrink-0">{pageTypeIcon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-light truncate">{label}</p>
                      {p.episode_description && (
                        <p className="text-xs text-white truncate mt-0.5">{p.episode_description}</p>
                      )}
                    </div>
                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

       {/* Page Indicators */}
       <div className="fixed bottom-20 left-1/2 -translate-x-1/2 flex gap-2 z-40 pointer-events-auto">
        {filteredPages.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentPage(idx)}
            className={`w-2 h-2 rounded-full transition-colors ${
              idx === currentPage ? 'bg-white' : 'bg-white/30'
            }`}
          />
        ))}
      </div>

      {/* Product Info (for products) */}
      {page?.is_product && (
        <div className="absolute top-0 left-0 right-0 bottom-0 z-20 bg-black pointer-events-auto">
          <div className="h-full overflow-y-auto px-4 py-4 pb-24" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="bg-neutral-950 rounded-lg p-4 mb-3 border border-white/20">
            


            {/* Feature banner image (media_url) */}
            {activeMediaUrl && (
              <div className="mb-4 w-full rounded-lg overflow-hidden">
                <img src={activeMediaUrl} alt={page.title} className="w-full object-contain rounded-lg" />
              </div>
            )}

            {/* Product Images Gallery — all images[], completely separate from feature media above */}
            {(page.images || []).length > 0 && (() => {
              const galleryImages = page.images;
              const safeIdx = Math.min(currentProductImage, galleryImages.length - 1);
              return (
                <div
                  className="mb-4"
                  onTouchStart={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  onTouchEnd={(e) => e.stopPropagation()}
                >
                  <div className="w-full bg-neutral-900 rounded-lg overflow-hidden flex items-center justify-center" style={{ height: '60vw', maxHeight: '420px' }}>
                    <img src={galleryImages[safeIdx]} alt={page.title} className="w-full h-full object-contain" />
                  </div>
                  {galleryImages.length > 1 && (
                    <div className="flex gap-2 mt-3 overflow-x-auto">
                      {galleryImages.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => { e.stopPropagation(); setCurrentProductImage(idx); }}
                          className={`w-16 h-16 rounded overflow-hidden flex-shrink-0 flex items-center justify-center bg-neutral-900 ${safeIdx === idx ? 'ring-2 ring-white' : 'ring-1 ring-white/20'}`}
                        >
                          <img src={img} alt="" className="w-full h-full object-contain" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {page.price && (
              <div className="text-white text-2xl font-light mb-3">{page.price}</div>
            )}

            {/* Description */}
            {page.content && (
              <div 
                className="text-white text-sm leading-relaxed mb-4 max-h-24 overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: page.content }}
              />
            )}

            {/* Options Selection */}
            {page.product_options && page.product_options.length > 0 && (
              <div 
                className="space-y-3 mb-4"
                onTouchStart={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
              >
                {page.product_options.map((option, idx) => (
                  <div key={idx}>
                    <div className="text-white text-xs font-medium mb-2 uppercase tracking-wider">
                      {option.name}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {option.values.map((val) => {
                        const isSelected = selectedOptions[option.name] === val;
                        return (
                          <button
                            key={val}
                            onClick={() => setSelectedOptions({...selectedOptions, [option.name]: val})}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                              isSelected 
                                ? 'bg-white text-black' 
                                : 'bg-neutral-900 text-white border border-white/20'
                            }`}
                          >
                            {val}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

            {/* Add to Cart Button */}
            <Button
              onClick={addToCart}
              className="w-full bg-white text-black hover:bg-white/90 font-light tracking-wide shadow-2xl py-6 text-base"
              disabled={added}
            >
              {added ? '✓ Added to cart' : (
                <>
                  <ShoppingCart size={18} className="mr-2" />
                  Add to cart
                </>
              )}
            </Button>
          </div>
        </div>
      )}

    </div>

    {/* Fullscreen image overlay */}
    {fullscreenImage && (
      <div
        className="fixed inset-0 z-50 bg-black flex flex-col"
        style={{ paddingTop: 'calc(52px + env(safe-area-inset-top))' }}
        onClick={() => setFullscreenImage(null)}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
          {!fullscreenImage.match(/\.(mp4|webm|ogg)$/i) ? (
            <button
              onClick={() => {
                if (!userEmail) { base44.auth.redirectToLogin(window.location.href); return; }
                saveToVault(fullscreenImage, 'image', dossier?.id || '', 'reference');
              }}
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${savedUrls.has(fullscreenImage) ? 'bg-red-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              <Bookmark size={18} fill={savedUrls.has(fullscreenImage) ? 'white' : 'none'} />
            </button>
          ) : <div />}
          <button
            className="text-white bg-white/10 rounded-full w-10 h-10 flex items-center justify-center text-xl"
            onClick={() => setFullscreenImage(null)}
          >✕</button>
        </div>

        {/* Image */}
        <div className="flex-1 flex items-center justify-center overflow-hidden" onClick={() => setFullscreenImage(null)}>
          {fullscreenImage.match(/\.(mp4|webm|ogg)$/i) ? (
            <video src={fullscreenImage} controls autoPlay playsInline className="w-full h-full object-contain" onClick={(e) => e.stopPropagation()} />
          ) : (
            <img src={fullscreenImage} alt="" className="w-full h-full object-contain" />
          )}
        </div>


      </div>
    )}

    {/* Production Room (episode-based) */}
    {productionEpisode && (
      <ProductionRoom
        episodePage={productionEpisode}
        dossier={dossier}
        onClose={() => setProductionEpisode(null)}
      />
    )}

    {/* Kit Production Room (free-form) */}
    {kitProductionPage && (
      <KitProductionRoom
        kitPage={kitProductionPage}
        dossier={dossier}
        onClose={() => { setKitProductionPage(null); onClose?.(); }}
      />
    )}

    {/* Block Player */}
    {blockPlayerData && (
      <BlockPlayer
        blocks={blockPlayerData.blocks}
        characters={blockPlayerData.characters}
        onClose={() => setBlockPlayerData(null)}
      />
    )}
    </>
  );
}