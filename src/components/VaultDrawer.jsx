import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, X, Trash2, Volume2, Folder, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

const folderAccent = {
  red: 'bg-red-400',
  orange: 'bg-orange-400',
  yellow: 'bg-amber-300',
  green: 'bg-emerald-400',
  blue: 'bg-sky-400',
  purple: 'bg-violet-400',
  pink: 'bg-rose-400',
};

// Can be used as a controlled drawer (pass open + onClose) or standalone (no props).
// When onSelect is provided, the existing Vault folder structure is used to choose an image.
export default function VaultDrawer({ open: controlledOpen, onClose, onSelect }) {
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState({});
  const qc = useQueryClient();

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const handleClose = isControlled ? onClose : () => setInternalOpen(false);

  const { data: assets = [] } = useQuery({
    queryKey: ['vaultAssets', user?.email],
    queryFn: () => base44.entities.VaultAsset.filter({ user_email: user.email }, '-created_date'),
    enabled: !!user?.email && open,
  });

  const { data: folders = [] } = useQuery({
    queryKey: ['vaultFolders', user?.email],
    queryFn: () => base44.entities.VaultFolder.filter({ user_email: user.email }, 'order'),
    enabled: !!user?.email && open && !!onSelect,
  });

  const deleteAsset = async (id) => {
    await base44.entities.VaultAsset.delete(id);
    qc.invalidateQueries({ queryKey: ['vaultAssets', user?.email] });
  };

  const handleImageClick = (asset) => {
    if (onSelect) {
      onSelect(asset.url, asset);
      handleClose?.();
      return;
    }
    setLightboxUrl(asset.url);
  };

  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  if (!user?.email) return null;

  if (onSelect) {
    const imageAssets = assets.filter(asset => asset?.url && asset.media_type !== 'video' && asset.media_type !== 'audio' && asset.media_type !== 'script');
    const unfiledImages = imageAssets.filter(asset => !asset.folder_id);

    const ImageGrid = ({ items }) => (
      <div className="grid grid-cols-2 gap-2 border-t border-white/10 bg-[#17191d] p-3 sm:grid-cols-3">
        {items.length === 0 ? (
          <p className="col-span-full py-5 text-center text-xs text-white/35">No image files in this folder</p>
        ) : items.map(asset => (
          <button
            key={asset.id}
            type="button"
            onClick={() => handleImageClick(asset)}
            className="group min-w-0 overflow-hidden rounded-[4px] border border-white/10 bg-black/30 text-left hover:border-[#23c7be]/50"
            title={asset.name || 'Vault image'}
          >
            <div className="aspect-[4/3] overflow-hidden bg-black/30">
              <img src={asset.url} alt={asset.name || ''} className="h-full w-full object-contain" loading="lazy" />
            </div>
            <div className="truncate px-2 py-2 text-[10px] font-bold text-white/75 group-hover:text-white">{asset.name || 'Untitled'}</div>
          </button>
        ))}
      </div>
    );

    return createPortal(
      <AnimatePresence>
        {open && (
          <motion.aside
            className="fixed right-3 top-3 z-[220] flex h-[calc(100dvh-24px)] max-h-[calc(100dvh-24px)] w-[440px] max-w-[calc(100vw-24px)] flex-col overflow-hidden border border-white/15 bg-[#111317] shadow-2xl"
            initial={{ x: '105%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '105%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="flex flex-shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <Bookmark size={15} className="flex-shrink-0 text-[#23c7be]" fill="currentColor" />
                <p className="truncate text-sm font-bold text-white">Vault</p>
              </div>
              <button type="button" onClick={handleClose} className="p-1.5 text-white/65 hover:text-white" aria-label="Close Vault">
                <X size={18} />
              </button>
            </div>

            <div
              className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3"
              style={{ WebkitOverflowScrolling: 'touch' }}
              onWheel={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
            >
              {unfiledImages.length > 0 && (
                <section className="overflow-hidden rounded-[4px] border border-white/10 bg-[#202328]">
                  <button type="button" className="flex w-full items-center gap-2.5 px-3 py-3 text-left" onClick={() => toggleFolder('__unfiled__')}>
                    <ChevronDown size={15} className={`flex-shrink-0 text-white/45 transition-transform ${!expandedFolders.__unfiled__ ? '-rotate-90' : ''}`} />
                    <span className="h-2.5 w-2.5 flex-shrink-0 bg-[#23c7be]" />
                    <Folder size={17} className="flex-shrink-0 text-white/55" />
                    <span className="min-w-0 flex-1 truncate text-sm font-black text-white">Unfiled</span>
                    <span className="text-xs font-bold text-white/35">{unfiledImages.length}</span>
                  </button>
                  {expandedFolders.__unfiled__ && <ImageGrid items={unfiledImages} />}
                </section>
              )}

              {folders.map(folder => {
                const folderAssets = assets.filter(asset => asset.folder_id === folder.id);
                const folderImages = imageAssets.filter(asset => asset.folder_id === folder.id);
                const isExpanded = !!expandedFolders[folder.id];
                return (
                  <section key={folder.id} className="overflow-hidden rounded-[4px] border border-white/10 bg-[#202328]">
                    <button type="button" className="flex w-full items-center gap-2.5 px-3 py-3 text-left hover:bg-white/[0.025]" onClick={() => toggleFolder(folder.id)}>
                      <ChevronDown size={15} className={`flex-shrink-0 text-white/45 transition-transform ${!isExpanded ? '-rotate-90' : ''}`} />
                      <span className={`h-2.5 w-2.5 flex-shrink-0 ${folderAccent[folder.color] || folderAccent.blue}`} />
                      <Folder size={17} className="flex-shrink-0 text-white/55" />
                      <span className="min-w-0 flex-1 truncate text-sm font-black text-white">{folder.name}</span>
                      <span className="text-xs font-bold text-white/35">{folderAssets.length}</span>
                    </button>
                    {isExpanded && <ImageGrid items={folderImages} />}
                  </section>
                );
              })}

              {folders.length === 0 && unfiledImages.length === 0 && (
                <div className="py-12 text-center">
                  <Bookmark size={28} className="mx-auto mb-3 text-white/20" />
                  <p className="text-sm text-white/60">No image files available in the Vault</p>
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>,
      document.body
    );
  }

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
                                  <img src={asset.url} alt="" className="w-full h-full object-cover cursor-pointer" onClick={() => handleImageClick(asset)} />
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
                                <img src={asset.url} alt="" className="w-full h-full object-cover cursor-pointer" onClick={() => handleImageClick(asset)} />
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