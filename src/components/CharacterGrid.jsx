import React, { useState } from 'react';
import { Bookmark, Check, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function CharacterGrid({ characters = [], emptyText, userEmail, sourceDossierId }) {
  const [lightbox, setLightbox] = useState(null);
  const [saved, setSaved] = useState({});

  const handleSave = async (url, key) => {
    if (!userEmail || saved[key]) return;
    try {
      await base44.entities.VaultAsset.create({
        user_email: userEmail,
        url,
        media_type: 'image',
        asset_category: 'character',
        source_dossier_id: sourceDossierId,
      });
      setSaved(s => ({ ...s, [key]: true }));
    } catch (e) {
      console.error('Failed to save to vault', e);
    }
  };

  if (characters.length === 0 || characters.every(c => (c.media?.length || 0) === 0)) {
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
          <img src={lightbox} alt="" className="max-w-[90vw] max-h-[85vh] rounded-xl object-contain" />
          <button className="absolute top-6 right-5 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20">
            <X size={18} />
          </button>
        </div>
      )}
      <div className="space-y-6">
        {characters.map((char, cIdx) => {
          const media = char.media || [];
          if (media.length === 0) return null;
          return (
            <div key={cIdx} className="space-y-2">
              {/* Character info header */}
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
              {/* Character media grid */}
              <div className={`grid gap-3 ${media.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {media.map((url, mIdx) => {
                  const key = `${cIdx}-${mIdx}`;
                  const isSaved = saved[key];
                  return (
                    <div key={mIdx} className="space-y-1">
                      <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-white/5 border border-white/10 group">
                        <button
                          onClick={() => setLightbox(url)}
                          className="absolute inset-0 w-full h-full"
                        >
                          <img src={url} alt={char.name || ''} className="w-full h-full object-cover" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSave(url, key); }}
                          className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all z-10 shadow-lg ${
                            isSaved
                              ? 'bg-yellow-400 text-black'
                              : 'bg-black/60 text-white/80 hover:bg-yellow-400 hover:text-black'
                          }`}
                          title={isSaved ? 'Saved to Vault' : 'Save to Vault'}
                        >
                          {isSaved ? <Check size={14} /> : <Bookmark size={14} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}