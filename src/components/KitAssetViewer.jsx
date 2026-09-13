import React, { useState, useEffect } from 'react';
import { ChevronLeft, Users, MapPin, Shirt, Play, X, Film, Bookmark, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
const TABS = [
  { id: 'actors', label: 'Actors', icon: Users },
  { id: 'sets', label: 'Sets', icon: MapPin },
  { id: 'costumes', label: 'Costumes', icon: Shirt },
  { id: 'videos', label: 'Videos', icon: Film },
];

function MediaGrid({ items, emptyText, userEmail, sourceDossierId }) {
  const [lightbox, setLightbox] = useState(null);
  const [saved, setSaved] = useState({});

  const handleSave = async (item, idx) => {
    if (!userEmail || saved[idx]) return;
    try {
      await base44.entities.VaultAsset.create({
        user_email: userEmail,
        url: item.url,
        media_type: item.isVideo ? 'video' : 'image',
        asset_category: item.category || 'reference',
        source_dossier_id: sourceDossierId,
      });
      setSaved(s => ({ ...s, [idx]: true }));
    } catch (e) {
      console.error('Failed to save to vault', e);
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-white text-sm">{emptyText}</p>
      </div>
    );
  }

  return (
    <>
      {lightbox && (
        <div
          className="fixed inset-0 z-[300] bg-black/95 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          {lightbox.isVideo ? (
            <video src={lightbox.url} controls autoPlay className="max-w-[90vw] max-h-[85vh] rounded-xl" onClick={e => e.stopPropagation()} />
          ) : (
            <img src={lightbox.url} alt="" className="max-w-[90vw] max-h-[85vh] rounded-xl object-contain" />
          )}
          <button className="absolute top-6 right-5 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20">
            <X size={18} />
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {items.map((item, idx) => (
          <div key={idx} className="space-y-2">
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-white/5 border border-white/10 group">
              <button
                onClick={() => setLightbox({ url: item.url, isVideo: item.isVideo })}
                className="absolute inset-0 w-full h-full"
              >
                {item.isVideo ? (
                  <>
                    <video src={item.url} className="w-full h-full object-cover" muted playsInline />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center">
                        <Play size={16} className="fill-black text-black ml-0.5" />
                      </div>
                    </div>
                  </>
                ) : (
                  <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                )}
              </button>
              {/* Bookmark button */}
              <button
                onClick={(e) => { e.stopPropagation(); handleSave(item, idx); }}
                className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all z-10 shadow-lg ${
                  saved[idx]
                    ? 'bg-yellow-400 text-black'
                    : 'bg-black/60 text-white/80 hover:bg-yellow-400 hover:text-black'
                }`}
                title={saved[idx] ? 'Saved to Vault' : 'Save to Vault'}
              >
                {saved[idx] ? <Check size={14} /> : <Bookmark size={14} />}
              </button>
            </div>
            {item.name && (
              <p className="text-white text-xs font-semibold text-center truncate px-1">{item.name}</p>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

export default function KitAssetViewer({ kitPage, dossier, onClose }) {
  const [activeTab, setActiveTab] = useState('actors');
  const [userEmail, setUserEmail] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => setUserEmail(u?.email)).catch(() => {});
  }, []);

  const characters = (kitPage?.kit_characters || []).map(c => ({
    name: c.name,
    description: c.description,
    character_type: c.character_type,
    media: (c.media?.length > 0 ? c.media : c.photo_url ? [c.photo_url] : []).map(url => ({
      url,
      name: c.name,
      isVideo: !!url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i),
      category: 'character',
    })),
  })).filter(c => c.media.length > 0);

  const actors = characters.flatMap(c => c.media);

  const sets = (kitPage?.kit_sets || []).flatMap(s =>
    (s.media || []).map(url => ({
      url,
      name: s.name,
      isVideo: !!url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i),
      category: 'set',
    }))
  );

  const costumes = (kitPage?.kit_costumes || []).flatMap(c =>
    (c.media || []).map(url => ({
      url,
      name: c.name,
      isVideo: !!url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i),
      category: 'costume',
    }))
  );

  const videos = [
    ...(kitPage?.kit_reference_media || []),
  ]
    .filter(url => url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i))
    .map(url => ({ url, name: '', isVideo: true, category: 'reference' }));

  const tabCounts = {
    actors: actors.length,
    sets: sets.length,
    costumes: costumes.length,
    videos: videos.length,
  };
  const tabData = { actors, sets, costumes, videos };
  const emptyTexts = {
    actors: 'No actor references in this kit',
    sets: 'No set references in this kit',
    costumes: 'No costume references in this kit',
    videos: 'No videos in this kit',
  };

  const visibleTabs = TABS.filter(t => tabCounts[t.id] > 0 || t.id === 'actors');

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-10 pb-4 border-b border-white/10 flex-shrink-0">
        <button onClick={onClose} className="p-1 text-white hover:text-white">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white text-[10px] uppercase tracking-widest font-semibold">Production Kit</p>
          <p className="text-white text-base font-bold truncate">{dossier?.title || kitPage?.title || 'Kit Assets'}</p>
        </div>
      </div>

      {/* Kit description */}
      {kitPage?.kit_description && (
        <div className="px-5 py-3 border-b border-white/10 flex-shrink-0">
          <p className="text-white text-sm leading-relaxed">{kitPage.kit_description}</p>
        </div>
      )}

      {/* Vault hint */}
      <div className="px-5 py-2 border-b border-white/10 flex-shrink-0 flex items-center gap-2">
        <Bookmark size={12} className="text-yellow-400 flex-shrink-0" />
        <p className="text-white text-xs">Tap <span className="text-yellow-400 font-bold">bookmark</span> on any asset to save it to your Vault</p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10 overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
        {visibleTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              activeTab === id
                ? 'bg-white text-black'
                : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
            }`}
          >
            <Icon size={14} />
            {label}
            {tabCounts[id] > 0 && (
              <span className={`text-xs ${activeTab === id ? 'text-black' : 'text-white'}`}>
                ({tabCounts[id]})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-5 pb-24" style={{ scrollbarColor: 'rgba(255,255,255,0.2) transparent', scrollbarWidth: 'thin' }}>
        {activeTab === 'actors' ? (
          characters.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <p className="text-white text-sm">{emptyTexts.actors}</p>
            </div>
          ) : (
            <div className="space-y-7">
              {characters.map((char, idx) => (
                <div key={idx} className="space-y-3">
                  <div>
                    {char.name && (
                      <p className="text-white text-sm font-bold tracking-wide">{char.name}</p>
                    )}
                    {char.character_type && (
                      <p className="text-yellow-400/80 text-[10px] uppercase tracking-widest font-semibold mt-0.5">
                        {char.character_type}
                      </p>
                    )}
                    {char.description && (
                      <p className="text-white text-xs font-light leading-relaxed mt-1">
                        {char.description}
                      </p>
                    )}
                  </div>
                  <MediaGrid
                    items={char.media}
                    emptyText=""
                    userEmail={userEmail}
                    sourceDossierId={dossier?.id}
                  />
                </div>
              ))}
            </div>
          )
        ) : (
          <MediaGrid
            items={tabData[activeTab] || []}
            emptyText={emptyTexts[activeTab]}
            userEmail={userEmail}
            sourceDossierId={dossier?.id}
          />
        )}
      </div>
    </div>
  );
}