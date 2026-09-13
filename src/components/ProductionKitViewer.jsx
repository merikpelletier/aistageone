import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Film, Users, Shirt, Image, Bookmark } from 'lucide-react';
import { useVault } from '@/hooks/useVault';

function MediaGrid({ items = [], onImageClick, onSaveToVault, savedUrls = new Set(), category }) {
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-3 gap-1.5 mt-2">
    {items.map((url, idx) => {
        const isVideo = url.match(/\.(mp4|webm|ogg)$/i);
        const isSaved = savedUrls.has(url);
        return (
          <div key={idx} className="relative">
            {isVideo ? (
              <video
                src={url}
                playsInline
                controls
                className="w-full rounded-lg object-cover"
                style={{ maxHeight: '33vw' }}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
              />
            ) : (
              <img
                src={url}
                alt=""
                className="w-full rounded-lg object-cover cursor-pointer"
                style={{ height: '33vw', maxHeight: '140px' }}
                onClick={() => onImageClick?.(url)}
              />
            )}
            {onSaveToVault && (
              <button
                onClick={(e) => { e.stopPropagation(); onSaveToVault(url, isVideo ? 'video' : 'image', category); }}
                className={`absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center transition-all ${isSaved ? 'bg-red-600 scale-110' : 'bg-black/60 hover:bg-black/80'}`}
              >
                <Bookmark size={10} className="text-white" fill={isSaved ? 'white' : 'none'} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Section({ icon, title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-white hover:bg-white/5 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-light tracking-wide text-sm">{title}</span>
        </div>
        {open ? <ChevronDown size={16} className="text-white" /> : <ChevronRight size={16} className="text-white" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-4">{children}</div>}
    </div>
  );
}

export default function ProductionKitViewer({ page, onImageClick, onOpenProductionRoom, autoOpen }) {
  const sets = page.kit_sets || [];
  const chars = page.kit_characters || [];
  const costumes = page.kit_costumes || [];
  const refMedia = page.kit_reference_media || [];

  const hasOpened = React.useRef(false);
  React.useEffect(() => {
    if (autoOpen && onOpenProductionRoom && !hasOpened.current) {
      hasOpened.current = true;
      onOpenProductionRoom();
    }
  }, []);

  const { userEmail, savedUrls, saveToVault: saveToVaultBase } = useVault();
  const saveToVault = (url, mediaType, category) => saveToVaultBase(url, mediaType, page.dossier_id || '', category);

  return (
    <div className="absolute inset-0 flex flex-col overflow-y-auto pointer-events-auto bg-black">
      {/* Hero / Cover */}
      {page.media_url && (
        page.media_url.match(/\.(mp4|webm|ogg)$/i) ? (
          <video
            src={page.media_url}
            autoPlay
            loop
            playsInline
            controls
            className="w-full flex-shrink-0"
            style={{ maxHeight: '40vh' }}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          />
        ) : (
          <img src={page.media_url} alt="" className="w-full flex-shrink-0 object-cover" style={{ maxHeight: '40vh' }} onClick={() => onImageClick?.(page.media_url)} />
        )
      )}

      <div className="px-4 pt-5 pb-28 flex flex-col gap-4">
        {/* Title & description */}
        <div>
          <p className="text-white text-xs tracking-widest uppercase mb-1">Production Kit</p>
          <h2 className="text-white text-2xl font-extralight tracking-wider leading-tight mb-3">
            {page.title || 'Production Kit'}
          </h2>
          {page.kit_description && (
            <p className="text-white text-sm font-light leading-relaxed whitespace-pre-wrap">
              {page.kit_description}
            </p>
          )}
          {userEmail && (
            <p className="text-white text-[11px] mt-2 flex items-center gap-1.5">
              <Bookmark size={10} />
              Tap <Bookmark size={10} fill="white" className="text-white" /> on any asset to save it to your vault
            </p>
          )}
        </div>

        {/* SETS */}
        {sets.length > 0 && (
          <Section icon={<Film size={15} className="text-white" />} title="Sets" defaultOpen={true}>
            {sets.map((set, idx) => (
              <div key={idx} className="space-y-1">
                {set.name && <p className="text-white font-medium text-sm">{set.name}</p>}
                {set.description && <p className="text-white text-xs leading-relaxed">{set.description}</p>}
                <MediaGrid items={set.media} onImageClick={onImageClick} onSaveToVault={userEmail ? saveToVault : null} savedUrls={savedUrls} category="set" />
              </div>
            ))}
          </Section>
        )}

        {/* CHARACTERS */}
        {chars.length > 0 && (
          <Section icon={<Users size={15} className="text-white" />} title="Characters" defaultOpen={true}>
            {chars.map((char, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center gap-3">
                  {char.photo_url && (
                    <div className="relative flex-shrink-0">
                      <img src={char.photo_url} alt="" className="w-12 h-12 rounded-full object-cover cursor-pointer" onClick={() => onImageClick?.(char.photo_url)} />
                      {userEmail && (
                        <button
                          onClick={() => saveToVault(char.photo_url, 'image', 'character')}
                          className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center transition-all ${savedUrls.has(char.photo_url) ? 'bg-red-600' : 'bg-black/70'}`}
                        >
                          <Bookmark size={8} className="text-white" fill={savedUrls.has(char.photo_url) ? 'white' : 'none'} />
                        </button>
                      )}
                    </div>
                  )}
                  <div>
                    {char.name && <p className="text-white font-medium text-sm">{char.name}</p>}
                    {char.description && <p className="text-white text-xs leading-relaxed">{char.description}</p>}
                  </div>
                </div>
                <MediaGrid items={char.media} onImageClick={onImageClick} onSaveToVault={userEmail ? saveToVault : null} savedUrls={savedUrls} category="character" />
                {idx < chars.length - 1 && <div className="border-t border-white/5 mt-2" />}
              </div>
            ))}
          </Section>
        )}

        {/* COSTUMES */}
        {costumes.length > 0 && (
          <Section icon={<Shirt size={15} className="text-white" />} title="Costumes">
            {costumes.map((costume, idx) => (
              <div key={idx} className="space-y-1">
                {costume.name && <p className="text-white font-medium text-sm">{costume.name}</p>}
                {costume.description && <p className="text-white text-xs leading-relaxed">{costume.description}</p>}
                <MediaGrid items={costume.media} onImageClick={onImageClick} onSaveToVault={userEmail ? saveToVault : null} savedUrls={savedUrls} category="costume" />
              </div>
            ))}
          </Section>
        )}

        {/* REFERENCE MEDIA */}
        {refMedia.length > 0 && (
          <Section icon={<Image size={15} className="text-white" />} title="Reference media">
            <MediaGrid items={refMedia} onImageClick={onImageClick} onSaveToVault={userEmail ? saveToVault : null} savedUrls={savedUrls} category="reference" />
          </Section>
        )}

        {/* CTA — Production Room */}
        {onOpenProductionRoom && (
          <button
            onClick={onOpenProductionRoom}
            className="w-full py-3 mt-2 bg-red-600 hover:bg-red-700 text-white text-sm font-light tracking-widest rounded-xl transition-colors"
          >
            🎬 BUILD MY PRODUCTION →
          </button>
        )}
      </div>
    </div>
  );
}