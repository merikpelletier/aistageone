import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, X, Trash2, Volume2 } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

// Can be used as a controlled drawer (pass open + onClose) or standalone (no props)
export default function VaultDrawer({ open: controlledOpen, onClose }) {
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const qc = useQueryClient();

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const handleClose = isControlled ? onClose : () => setInternalOpen(false);

  const { data: assets = [] } = useQuery({
    queryKey: ['vaultAssets', user?.email],
    queryFn: () => base44.entities.VaultAsset.filter({ user_email: user.email }, '-created_date'),
    enabled: !!user?.email && open,
  });

  const deleteAsset = async (id) => {
    await base44.entities.VaultAsset.delete(id);
    qc.invalidateQueries({ queryKey: ['vaultAssets', user?.email] });
  };

  if (!user?.email) return null;

  return createPortal(
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 z-[150]"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={handleClose}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-[150] bg-black rounded-t-3xl overflow-hidden flex flex-col"
              style={{ maxHeight: '80vh' }}
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Bookmark size={15} className="text-yellow-400" fill="currentColor" />
                  <p className="text-white text-sm font-medium tracking-widest">Ma Vault</p>
                  {assets.length > 0 && <span className="text-white text-xs">({assets.length})</span>}
                </div>
                <button onClick={handleClose} className="text-white hover:text-white p-1">
                  <X size={18} />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 p-4">
                {assets.length === 0 ? (
                  <div className="py-10 text-center">
                    <Bookmark size={28} className="text-white/20 mx-auto mb-3" />
                    <p className="text-white text-sm">Aucun asset sauvegardé</p>
                    <p className="text-white/25 text-xs mt-1">Naviguez dans les kits de production et bookmarkez des assets</p>
                  </div>
                ) : (
                  <>
                    {['costume', 'character', 'set', 'reference'].map(cat => {
                      const filtered = assets.filter(a => a.asset_category === cat);
                      if (filtered.length === 0) return null;
                      const labels = { costume: 'Costumes', character: 'Personnages', set: 'Décors', reference: 'Références' };
                      return (
                        <div key={cat} className="mb-5">
                          <p className="text-white text-xs uppercase tracking-widest mb-2">{labels[cat]}</p>
                          <div className="grid grid-cols-3 gap-2">
                            {filtered.map(asset => (
                              <div key={asset.id} className="relative rounded-xl overflow-hidden bg-white/5 aspect-square">
                                {asset.media_type === 'video' ? (
                                  <video src={asset.url} className="w-full h-full object-cover" muted playsInline />
                                ) : asset.media_type === 'audio' ? (
                                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-2">
                                    <Volume2 size={24} className="text-yellow-400" />
                                    <audio src={asset.url} controls className="w-full" />
                                  </div>
                                ) : (
                                  <img src={asset.url} alt="" className="w-full h-full object-cover cursor-pointer" onClick={() => setLightboxUrl(asset.url)} />
                                )}
                                <button onClick={() => deleteAsset(asset.id)} className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors">
                                  <Trash2 size={10} className="text-white" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {assets.filter(a => !a.asset_category).length > 0 && (
                      <div>
                        <p className="text-white text-xs uppercase tracking-widest mb-2">Autres</p>
                        <div className="grid grid-cols-3 gap-2">
                          {assets.filter(a => !a.asset_category).map(asset => (
                            <div key={asset.id} className="relative rounded-xl overflow-hidden bg-white/5 aspect-square">
                              {asset.media_type === 'video' ? (
                                <video src={asset.url} className="w-full h-full object-cover" muted playsInline />
                              ) : asset.media_type === 'audio' ? (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-2">
                                  <Volume2 size={24} className="text-yellow-400" />
                                  <audio src={asset.url} controls className="w-full" />
                                </div>
                              ) : (
                                <img src={asset.url} alt="" className="w-full h-full object-cover cursor-pointer" onClick={() => setLightboxUrl(asset.url)} />
                              )}
                              <button onClick={() => deleteAsset(asset.id)} className="absolute top-1 right-1 w-6 h-6 bg-black/60 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors">
                                <Trash2 size={10} className="text-white" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            className="fixed inset-0 bg-black/95 z-[250] flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setLightboxUrl(null)}
          >
            <button className="absolute top-8 right-4 text-white hover:text-white"><X size={24} /></button>
            <img src={lightboxUrl} alt="" className="max-w-full max-h-full rounded-xl object-contain" />
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
}
