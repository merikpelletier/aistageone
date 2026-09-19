import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Folder, ChevronDown, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const folderColors = {
  red: 'bg-red-500/20 border-red-500/40 text-red-400',
  orange: 'bg-orange-500/20 border-orange-500/40 text-orange-400',
  yellow: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400',
  green: 'bg-green-500/20 border-green-500/40 text-green-400',
  blue: 'bg-blue-500/20 border-blue-500/40 text-blue-400',
  purple: 'bg-purple-500/20 border-purple-500/40 text-purple-400',
  pink: 'bg-pink-500/20 border-pink-500/40 text-pink-400',
};

export default function VaultPickerModal({ userEmail, onSelect, onClose, allowUpload = false }) {
  const queryClient = useQueryClient();
  const [expandedFolders, setExpandedFolders] = useState({});
  const [uploading, setUploading] = useState(false);

  const uploadImages = async (event) => {
    const input = event.currentTarget;
    const files = Array.from(input.files || []).filter((file) => file.type.startsWith('image/'));
    if (!files.length || uploading) return;
    if (!userEmail) { toast.error('Sign in to upload images'); input.value = ''; return; }
    setUploading(true);
    try {
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        await base44.entities.VaultAsset.create({
          user_email: userEmail,
          url: file_url,
          name: file.name.replace(/\.[^.]+$/, ''),
          media_type: 'image',
          asset_category: 'reference',
          source_dossier_id: '',
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['vaultAssetsForPicker', userEmail] });
      toast.success(`${files.length} image${files.length === 1 ? '' : 's'} uploaded to Vault`);
    } catch (error) {
      toast.error(error.message || 'Unable to upload images');
    } finally {
      setUploading(false);
      input.value = '';
    }
  };

  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['vaultFoldersForPicker', userEmail],
    queryFn: () => base44.entities.VaultFolder.filter({ user_email: userEmail }, 'order', null),
    enabled: !!userEmail,
  });

  const { data: vaultAssets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ['vaultAssetsForPicker', userEmail],
    queryFn: () => base44.entities.VaultAsset.filter({ user_email: userEmail }, '-created_date', null),
    enabled: !!userEmail,
  });

  const images = vaultAssets.filter(a => a.media_type === 'image');
  const unfiledImages = images.filter(a => !a.folder_id);

  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  if (foldersLoading || assetsLoading) {
    return (
      <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 pt-10 pb-4 border-b border-white/10 flex-shrink-0">
        <h3 className="text-white text-sm font-medium tracking-widest uppercase">Pick from Vault</h3>
        <div className="flex items-center gap-2">
          {allowUpload && <label className={`flex items-center gap-2 rounded-xl bg-yellow-400 px-4 py-2.5 text-xs font-black text-black ${uploading ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}>{uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}{uploading ? 'Uploading...' : 'Upload images'}<input type="file" accept="image/*" multiple className="hidden" onChange={uploadImages} disabled={uploading} /></label>}
          <button onClick={onClose} className="p-2 text-white hover:text-white"><X size={20} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Unfiled Images */}
        {unfiledImages.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white text-xs uppercase tracking-wider">
              <Folder size={14} />
              Unfiled ({unfiledImages.length})
            </div>
            <div className="grid grid-cols-3 gap-2">
              {unfiledImages.map(asset => (
                <button
                  key={asset.id}
                  onClick={() => onSelect(asset.url)}
                  className="aspect-square rounded-xl overflow-hidden bg-white/5 hover:ring-2 hover:ring-yellow-400 transition-all"
                >
                  <img src={asset.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Folders */}
        {folders.map((folder) => {
          const folderImages = images.filter(a => a.folder_id === folder.id);
          const isExpanded = expandedFolders[folder.id] ?? false;

          return (
            <div key={folder.id} className="space-y-2">
              <div
                className={`flex items-center justify-between px-3 py-2 rounded-xl border ${folderColors[folder.color]} cursor-pointer`}
                onClick={() => toggleFolder(folder.id)}
              >
                <div className="flex items-center gap-2">
                  <ChevronDown size={14} className={`text-white transition-transform ${!isExpanded ? '-rotate-90' : ''}`} />
                  <Folder size={14} className="text-white" />
                  <span className="text-white text-sm font-bold">{folder.name}</span>
                  <span className="text-white text-xs font-semibold">({folderImages.length})</span>
                </div>
              </div>

              {isExpanded && folderImages.length > 0 && (
                <div className="grid grid-cols-3 gap-2 pl-2">
                  {folderImages.map(asset => (
                    <button
                      key={asset.id}
                      onClick={() => onSelect(asset.url)}
                      className="aspect-square rounded-xl overflow-hidden bg-white/5 hover:ring-2 hover:ring-yellow-400 transition-all"
                    >
                      <img src={asset.url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {images.length === 0 && (
          <div className="text-center py-16">
            <p className="text-white text-sm">No images in your Vault yet.</p>
            <p className="text-white/20 text-xs mt-1">Save images from dossiers first.</p>
          </div>
        )}
      </div>
    </div>
  );
}
