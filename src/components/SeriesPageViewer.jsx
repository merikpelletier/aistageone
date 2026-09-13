import React, { useState } from 'react';
import { Bookmark } from 'lucide-react';
import { useVault } from '@/hooks/useVault';

export default function SeriesPageViewer({ page, onImageClick, dossierId = '', allPages = [], onNavigateToPage }) {
  const { userEmail, savedUrls, saveToVault } = useVault();
  const characters = page.series_characters || [];
  const sets = page.series_sets || [];
  const costumes = page.series_costumes || [];

  return (
    <div className="absolute inset-0 flex flex-col overflow-y-auto pointer-events-auto bg-black pb-24" style={{ paddingTop: 'calc(52px + env(safe-area-inset-top))' }}>
      {/* Hero media */}
      {(page.media_url || page.media_url_landscape) && (() => {
        const url = page.media_url || page.media_url_landscape;
        return url.match(/\.(mp4|webm|ogg)$/i) ? (
          <video
            src={url}
            autoPlay
            loop
            playsInline
            controls
            className="w-full flex-shrink-0 object-cover"
            style={{ aspectRatio: '9/16', maxHeight: '70vh' }}
          />
        ) : (
          <div className="relative flex-shrink-0">
            <img
              src={url}
              alt=""
              className="w-full object-cover cursor-pointer"
              style={{ aspectRatio: '9/16', maxHeight: '70vh' }}
              onClick={() => onImageClick?.(url)}
            />
            <button
              onClick={() => saveToVault(url, 'image', dossierId, 'reference')}
              className={`absolute bottom-3 right-3 w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all ${savedUrls.has(url) ? 'bg-red-600' : 'bg-black/60'}`}
            >
              <Bookmark size={16} className="text-white" fill={savedUrls.has(url) ? 'white' : 'none'} />
            </button>
          </div>
        );
      })()}

      {/* Series title */}
      {page.title && (
        <div className="px-6 pt-10 pb-4 flex-shrink-0">
          <h2 className="text-white text-3xl font-extralight tracking-widest">{page.title}</h2>
        </div>
      )}

      {/* Studio Banner */}
      {page.show_studio_banner && (
        <div className="px-6 pb-4 flex-shrink-0">
          <div className="bg-amber-600/20 border border-amber-500/30 rounded-lg px-4 py-3">
            <p className="text-amber-400 text-xs font-bold uppercase tracking-widest text-center">
              AVAILABLE IN THE STUDIO ON THE STAGE SECTION
            </p>
          </div>
        </div>
      )}

      {/* Presentation */}
      {page.series_presentation && (
        <div className="px-6 pb-6 flex-shrink-0">
          <p className="text-white text-xs uppercase tracking-widest mb-3">About the series</p>
          <p className="text-white/80 text-sm font-light leading-relaxed whitespace-pre-wrap">
            {page.series_presentation}
          </p>
        </div>
      )}

      {/* Characters */}
      {characters.length > 0 && (
        <div className="px-6 pb-6 flex-shrink-0">
          <p className="text-white text-xs uppercase tracking-widest mb-4">Characters</p>
          <div className="space-y-4">
            {characters.map((char, idx) => (
              <div key={idx} className="flex items-start gap-4">
                {char.photo_url ? (
                  <div className="relative flex-shrink-0 w-16 h-16">
                    <img
                      src={char.photo_url}
                      alt={char.name}
                      className="w-16 h-16 rounded-full object-cover cursor-pointer"
                      onClick={() => onImageClick?.(char.photo_url)}
                    />
                    <button
                      onClick={() => saveToVault(char.photo_url, 'image', dossierId, 'character')}
                      className={`absolute bottom-0 right-0 w-5 h-5 rounded-full flex items-center justify-center transition-all ${savedUrls.has(char.photo_url) ? 'bg-red-600' : 'bg-black/70'}`}
                    >
                      <Bookmark size={8} className="text-white" fill={savedUrls.has(char.photo_url) ? 'white' : 'none'} />
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-full bg-neutral-800 flex-shrink-0 flex items-center justify-center">
                    <span className="text-white/20 text-2xl">?</span>
                  </div>
                )}
                <div className="flex-1 pt-1">
                  {char.name && <p className="text-white font-medium tracking-wide mb-1">{char.name}</p>}
                  {char.description && <p className="text-white text-sm font-light leading-relaxed">{char.description}</p>}
                  {char.photos?.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {char.photos.map((url, pIdx) => (
                        <div key={pIdx} className="relative">
                          <img
                            src={url}
                            alt=""
                            className="w-12 h-12 object-cover rounded cursor-pointer"
                            onClick={() => onImageClick?.(url)}
                          />
                          <button
                            onClick={() => saveToVault(url, 'image', dossierId, 'character')}
                            className={`absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center transition-all ${savedUrls.has(url) ? 'bg-red-600' : 'bg-black/60'}`}
                          >
                            <Bookmark size={7} className="text-white" fill={savedUrls.has(url) ? 'white' : 'none'} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Costumes */}
      {costumes.length > 0 && (
        <div className="px-4 pb-6 flex-shrink-0">
          <p className="text-white text-xs uppercase tracking-widest mb-4 px-2">Costumes</p>
          <div className="space-y-6">
            {costumes.map((costume, idx) => (
              <div key={idx}>
                {costume.name && (
                  <p className="text-white text-sm font-medium tracking-wide px-2 mb-2">{costume.name}</p>
                )}
                {costume.description && (
                  <p className="text-white text-xs font-light leading-relaxed px-2 mb-3">{costume.description}</p>
                )}
                {costume.media?.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {costume.media.map((url, mIdx) => (
                      <div key={mIdx} className="relative">
                        {url.match(/\.(mp4|webm|ogg)$/i) ? (
                          <video
                            src={url}
                            playsInline
                            className="w-full rounded-lg object-cover cursor-pointer"
                            style={{ maxHeight: '45vw' }}
                            onClick={(e) => { e.currentTarget.pause(); onImageClick?.(url); }}
                          />
                        ) : (
                          <img
                            src={url}
                            alt=""
                            className="w-full rounded-lg object-cover cursor-pointer"
                            style={{ maxHeight: '45vw' }}
                            onClick={() => onImageClick?.(url)}
                          />
                        )}
                        {!url.match(/\.(mp4|webm|ogg)$/i) && (
                          <button
                            onClick={() => saveToVault(url, 'image', dossierId, 'costume')}
                            className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center transition-all ${savedUrls.has(url) ? 'bg-red-600' : 'bg-black/60'}`}
                          >
                            <Bookmark size={10} className="text-white" fill={savedUrls.has(url) ? 'white' : 'none'} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sets */}
      {sets.length > 0 && (
        <div className="px-4 pb-6 flex-shrink-0">
          <p className="text-white text-xs uppercase tracking-widest mb-4 px-2">Sets</p>
          <div className="space-y-6">
            {sets.map((set, idx) => (
              <div key={idx}>
                {set.name && (
                  <p className="text-white text-sm font-medium tracking-wide px-2 mb-2">{set.name}</p>
                )}
                {set.description && (
                  <p className="text-white text-xs font-light leading-relaxed px-2 mb-3">{set.description}</p>
                )}
                {set.media?.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {set.media.map((url, mIdx) => (
                      <div key={mIdx} className="relative">
                        {url.match(/\.(mp4|webm|ogg)$/i) ? (
                          <video
                            src={url}
                            playsInline
                            className="w-full rounded-lg object-cover cursor-pointer"
                            style={{ maxHeight: '45vw' }}
                            onClick={(e) => { e.currentTarget.pause(); onImageClick?.(url); }}
                          />
                        ) : (
                          <img
                            src={url}
                            alt=""
                            className="w-full rounded-lg object-cover cursor-pointer"
                            style={{ maxHeight: '45vw' }}
                            onClick={() => onImageClick?.(url)}
                          />
                        )}
                        {!url.match(/\.(mp4|webm|ogg)$/i) && (
                          <button
                            onClick={() => saveToVault(url, 'image', dossierId, 'set')}
                            className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center transition-all ${savedUrls.has(url) ? 'bg-red-600' : 'bg-black/60'}`}
                          >
                            <Bookmark size={10} className="text-white" fill={savedUrls.has(url) ? 'white' : 'none'} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}