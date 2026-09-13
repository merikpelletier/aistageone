import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Loader2, Folder, ChevronLeft, ImageOff } from 'lucide-react';

const folderColors = {
  red: 'bg-red-500/20 border-red-500/40 text-red-400',
  orange: 'bg-orange-500/20 border-orange-500/40 text-orange-400',
  yellow: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400',
  green: 'bg-green-500/20 border-green-500/40 text-green-400',
  blue: 'bg-blue-500/20 border-blue-500/40 text-blue-400',
  purple: 'bg-purple-500/20 border-purple-500/40 text-purple-400',
  pink: 'bg-pink-500/20 border-pink-500/40 text-pink-400',
};

// Pick an image from the user's vault — always starts at folder selection.
export default function AtelierAssetPicker({ userEmail, onSelect, onClose }) {
  const [openFolderId, setOpenFolderId] = useState(null); // null = folder list, 'unfiled' = unfiled, id = folder

  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['vaultFolders', userEmail],
    queryFn: () => base44.entities.VaultFolder.filter({ user_email: userEmail }, 'order'),
    enabled: !!userEmail,
  });

  const { data: assets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ['vaultAssets', userEmail],
    queryFn: () => base44.entities.VaultAsset.filter({ user_email: userEmail, media_type: 'image' }, '-created_date'),
    enabled: !!userEmail,
  });

  const loading = foldersLoading || assetsLoading;

  const imageAssetsFor = (folderId) => {
    if (folderId === 'unfiled') return assets.filter(a => !a.folder_id);
    return assets.filter(a => a.folder_id === folderId);
  };

  const countFor = (folderId) => imageAssetsFor(folderId).length;

  const title = openFolderId === null
    ? 'Pick from your vault'
    : openFolderId === 'unfiled'
      ? 'Unfiled'
      : (folders.find(f => f.id === openFolderId)?.name || 'Folder');

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-neutral-950 border border-white/10 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/10 gap-3">
          {openFolderId !== null ? (
            <button onClick={() => setOpenFolderId(null)} className="flex items-center gap-1.5 text-white text-sm font-bold hover:opacity-80">
              <ChevronLeft size={18} />
              Folders
            </button>
          ) : (
            <p className="text-white font-bold tracking-wide">Pick from your vault</p>
          )}
          {openFolderId !== null && <p className="text-white font-bold tracking-wide truncate flex-1 text-center">{title}</p>}
          <button onClick={onClose} className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0"><X size={16} className="text-white" /></button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-yellow-400" /></div>
          ) : openFolderId === null ? (
            <FolderList folders={folders} unfiledCount={countFor('unfiled')} countFor={countFor} onOpen={setOpenFolderId} />
          ) : (
            <ImageGrid
              assets={imageAssetsFor(openFolderId)}
              onSelect={(url) => { onSelect(url); onClose(); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function FolderList({ folders, unfiledCount, countFor, onOpen }) {
  const total = folders.reduce((s, f) => s + countFor(f.id), 0) + unfiledCount;
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ImageOff size={32} className="text-white/30 mb-3" />
        <p className="text-white/50 text-sm">No image assets in your vault yet.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {folders.map(f => {
        const color = folderColors[f.color] || folderColors.blue;
        const count = countFor(f.id);
        return (
          <button
            key={f.id}
            onClick={() => onOpen(f.id)}
            className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${color}`}>
              <Folder size={20} />
            </div>
            <span className="flex-1 text-left text-white font-semibold text-sm truncate">{f.name}</span>
            <span className="text-white/40 text-xs font-bold">{count}</span>
          </button>
        );
      })}
      {unfiledCount > 0 && (
        <button
          onClick={() => onOpen('unfiled')}
          className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center border bg-white/10 border-white/20 text-white/60">
            <Folder size={20} />
          </div>
          <span className="flex-1 text-left text-white font-semibold text-sm truncate">Unfiled</span>
          <span className="text-white/40 text-xs font-bold">{unfiledCount}</span>
        </button>
      )}
    </div>
  );
}

function ImageGrid({ assets, onSelect }) {
  if (assets.length === 0) {
    return <p className="text-white/50 text-sm text-center py-12">No images in this folder.</p>;
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {assets.map(a => (
        <button
          key={a.id}
          onClick={() => onSelect(a.url)}
          className="relative rounded-lg overflow-hidden bg-white/5 border border-white/10 hover:border-yellow-400 transition-colors"
          style={{ aspectRatio: '3/4' }}
        >
          <img src={a.url} alt="" className="w-full h-full object-cover" />
          {a.name && <span className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[10px] px-1 py-0.5 truncate">{a.name}</span>}
        </button>
      ))}
    </div>
  );
}