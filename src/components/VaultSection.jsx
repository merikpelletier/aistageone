import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark, Trash2, X, Folder, Plus, ChevronDown, Pencil, FileText, Volume2, Upload, Download, Loader2, Info, Star } from 'lucide-react';
import ScriptEditor from '@/components/studio/ScriptEditor';
import AssetInspector from '@/components/studio/AssetInspector';
import { toast } from 'sonner';

function VisibleTags({ tags = [] }) {
  if (!Array.isArray(tags) || tags.length === 0) return null;
  return (
    <div className="absolute left-2 top-2 z-[2] flex max-w-[75%] flex-wrap gap-1 pointer-events-none">
      {tags.slice(0, 3).map((tag) => (
        <span key={tag} className="rounded-[2px] border border-white/10 bg-black/75 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-white/75">
          {tag}
        </span>
      ))}
    </div>
  );
}

const folderAccent = {
  red: 'bg-red-400',
  orange: 'bg-orange-400',
  yellow: 'bg-amber-300',
  green: 'bg-emerald-400',
  blue: 'bg-sky-400',
  purple: 'bg-violet-400',
  pink: 'bg-rose-400',
};

export default function VaultSection({ userEmail, onUsePrompt }) {
  const queryClient = useQueryClient();
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('blue');
  const [expandedFolders, setExpandedFolders] = useState({});
  const [allCollapsed] = useState(true);
  const [editingName, setEditingName] = useState(null);
  const [nameDraft, setNameDraft] = useState('');
  const [scriptAsset, setScriptAsset] = useState(null);
  const [inspectorAsset, setInspectorAsset] = useState(null);
  const [uploading, setUploading] = useState(false);

  const uploadMedia = async (event) => {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);
    if (!files.length || uploading) return;
    if (!userEmail) { toast.error('Sign in to upload media'); input.value = ''; return; }
    setUploading(true);
    try {
      let uploaded = 0;
      for (const file of files) {
        const mediaType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : null;
        if (!mediaType) continue;
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        await base44.entities.VaultAsset.create({
          user_email: userEmail,
          author_name: userEmail,
          url: file_url,
          name: file.name.replace(/\.[^.]+$/, ''),
          media_type: mediaType,
          asset_category: 'upload',
          source_dossier_id: '',
        });
        uploaded += 1;
      }
      await queryClient.invalidateQueries({ queryKey: ['vaultAssets', userEmail] });
      if (uploaded) toast.success(`${uploaded} media file${uploaded === 1 ? '' : 's'} uploaded to Vault`);
      else toast.error('Select image, video, or audio files');
    } catch (error) {
      toast.error(error.message || 'Unable to upload media');
    } finally {
      setUploading(false);
      input.value = '';
    }
  };

  const saveName = async (asset) => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== asset.name) {
      await base44.entities.VaultAsset.update(asset.id, { name: trimmed });
      queryClient.invalidateQueries({ queryKey: ['vaultAssets', userEmail] });
    }
    setEditingName(null);
  };

  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['vaultFolders', userEmail],
    queryFn: () => base44.entities.VaultFolder.filter({ user_email: userEmail }, 'order'),
    enabled: !!userEmail,
  });

  const { data: assets = [], isLoading: assetsLoading } = useQuery({
    queryKey: ['vaultAssets', userEmail],
    queryFn: () => base44.entities.VaultAsset.filter({ user_email: userEmail }, '-created_date'),
    enabled: !!userEmail,
  });

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    await base44.entities.VaultFolder.create({
      user_email: userEmail,
      name: newFolderName.trim(),
      color: newFolderColor,
      order: folders.length,
    });
    setNewFolderName('');
    setNewFolderColor('blue');
    setShowNewFolder(false);
    queryClient.invalidateQueries({ queryKey: ['vaultFolders', userEmail] });
  };

  const deleteFolder = async (folderId) => {
    const folderAssets = assets.filter(a => a.folder_id === folderId);
    try {
      for (const asset of folderAssets) await base44.entities.VaultAsset.update(asset.id, { folder_id: null });
      await base44.entities.VaultFolder.delete(folderId);
    } catch (error) {
      toast.error(error.message || 'Unable to delete folder');
      return;
    } finally {
      queryClient.invalidateQueries({ queryKey: ['vaultFolders', userEmail] });
      queryClient.invalidateQueries({ queryKey: ['vaultAssets', userEmail] });
      queryClient.invalidateQueries({ queryKey: ['vaultFoldersForPicker', userEmail] });
      queryClient.invalidateQueries({ queryKey: ['vaultAssetsForPicker', userEmail] });
    }
  };

  const deleteAsset = async (id) => {
    await base44.entities.VaultAsset.delete(id);
    queryClient.invalidateQueries({ queryKey: ['vaultAssets', userEmail] });
  };

  const downloadAsset = async (asset) => {
    try {
      const response = await fetch(asset.url);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const urlExtension = (() => {
        try {
          const pathname = new URL(asset.url).pathname;
          const match = pathname.match(/(\.[a-z0-9]{2,5})$/i);
          return match?.[1] || '';
        } catch {
          return '';
        }
      })();
      const typeExtension = asset.media_type === 'video' ? '.mp4' : asset.media_type === 'audio' ? '.mp3' : asset.media_type === 'image' ? '.jpg' : '';
      const safeName = String(asset.name || 'asset').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'asset';
      const extension = urlExtension || typeExtension;
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = safeName.toLowerCase().endsWith(extension.toLowerCase()) ? safeName : `${safeName}${extension}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      window.open(asset.url, '_blank', 'noopener,noreferrer');
      toast.error('Direct download was blocked. The file was opened in a new tab instead.');
    }
  };

  const moveAssetToFolder = async (assetId, folderId) => {
    await base44.entities.VaultAsset.update(assetId, { folder_id: folderId === 'unfiled' ? null : folderId });
    queryClient.invalidateQueries({ queryKey: ['vaultAssets', userEmail] });
  };

  const toggleFolder = (folderId) => setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));

  if (foldersLoading || assetsLoading) {
    return <div className="flex min-h-[280px] items-center justify-center rounded-[4px] border border-white/10 bg-[#17191d]"><Loader2 className="animate-spin text-[#23c7be]" size={24} /></div>;
  }

  const unfiledAssets = assets.filter(a => !a.folder_id);

  const AssetCard = ({ asset, currentFolderId = null }) => {
    const moveOptions = currentFolderId
      ? [{ id: 'unfiled', name: 'Unfiled' }, ...folders.filter(f => f.id !== currentFolderId)]
      : folders;

    return (
      <article className="min-w-0 overflow-hidden rounded-[4px] border border-white/10 bg-[#17191d] transition hover:border-[#23c7be]/35">
        <div className="relative aspect-[4/3] overflow-hidden bg-black/35">
          <VisibleTags tags={asset.tags} />

          {asset.media_type === 'script' ? (
            <button onClick={() => setScriptAsset(asset)} className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#111317] p-4 text-center">
              <FileText size={34} className="text-[#23c7be]" />
              <span className="line-clamp-2 text-[10px] font-black uppercase tracking-wider text-[#8ee9e4]">{asset.name || 'Script'}</span>
            </button>
          ) : asset.media_type === 'video' ? (
            <button onClick={() => setLightboxUrl(asset.url)} className="relative h-full w-full bg-black">
              <video src={asset.url} className="h-full w-full object-contain" muted preload="metadata" />
              <span className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[3px] border border-white/15 bg-black/70">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
              </span>
            </button>
          ) : asset.media_type === 'audio' ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[#111317] p-4">
              <Volume2 size={34} className="text-[#23c7be]" />
              <audio src={asset.url} controls className="w-full max-w-[230px]" />
            </div>
          ) : (
            <button onClick={() => setLightboxUrl(asset.url)} className="h-full w-full bg-black/20">
              <img src={asset.url} alt={asset.name || ''} className="h-full w-full object-contain" />
            </button>
          )}

          <div className="absolute right-2 top-2 flex gap-1.5">
            <button onClick={() => setInspectorAsset(asset)} className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-white/10 bg-black/75 text-white/75 hover:border-[#23c7be]/40 hover:text-[#8ee9e4]" title="Asset details"><Info size={14} /></button>
            <button onClick={() => downloadAsset(asset)} className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-white/10 bg-black/75 text-white/75 hover:border-[#23c7be]/40 hover:text-[#8ee9e4]" title="Download"><Download size={14} /></button>
            <button onClick={() => { setEditingName(asset.id); setNameDraft(asset.name || ''); }} className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-white/10 bg-black/75 text-white/75 hover:text-white" title="Rename"><Pencil size={14} /></button>
            <button onClick={() => deleteAsset(asset.id)} className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-red-400/25 bg-black/75 text-red-300 hover:bg-red-400/10" title="Delete"><Trash2 size={14} /></button>
          </div>

          {asset.is_magazine_ready && <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-[3px] border border-[#23c7be]/35 bg-[#17191d]/90 text-[#23c7be]" title="Magazine ready"><Star size={13} fill="currentColor" /></span>}

          {editingName === asset.id && (
            <div className="absolute inset-0 z-10 flex flex-col justify-center gap-3 bg-black/90 p-4" onClick={(e) => e.stopPropagation()}>
              <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveName(asset); if (e.key === 'Escape') setEditingName(null); }} placeholder="Name this file…" className="w-full rounded-[3px] border border-[#23c7be]/50 bg-[#17191d] px-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-[#23c7be]" autoFocus />
              <div className="flex justify-end gap-2"><button onClick={() => setEditingName(null)} className="rounded-[3px] border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-white">Cancel</button><button onClick={() => saveName(asset)} className="rounded-[3px] bg-[#23c7be] px-3 py-2 text-xs font-black text-[#071211]">Save</button></div>
            </div>
          )}
        </div>

        <div className="space-y-3 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-white" title={asset.name || 'Untitled'}>{asset.name || 'Untitled'}</p>
            <div className="mt-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-white/35">
              <span>{asset.media_type || 'asset'}</span>
              {asset.asset_category && <><span>·</span><span className="text-[#8ee9e4]/75">{asset.asset_category}</span></>}
            </div>
          </div>
          {moveOptions.length > 0 && (
            <select
              value=""
              onChange={(e) => { if (e.target.value) moveAssetToFolder(asset.id, e.target.value); }}
              className="h-10 w-full rounded-[3px] border border-white/15 bg-[#111317] px-3 text-xs font-bold text-white outline-none focus:border-[#23c7be]"
              style={{ colorScheme: 'dark' }}
              aria-label={`Move ${asset.name || 'asset'} to folder`}
            >
              <option value="" className="bg-[#111317] text-white">Move to…</option>
              {moveOptions.map(f => <option key={f.id} value={f.id} className="bg-[#111317] text-white">{f.name}</option>)}
            </select>
          )}
        </div>
      </article>
    );
  };

  const AssetGrid = ({ items, currentFolderId = null }) => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {items.map(asset => <AssetCard key={asset.id} asset={asset} currentFolderId={currentFolderId} />)}
    </div>
  );

  return (
    <div className="space-y-5 rounded-[4px] border border-white/10 bg-[#17191d] p-4 shadow-none md:p-5">
      <header className="flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[3px] border border-[#23c7be]/30 bg-[#23c7be]/10 text-[#23c7be]"><Bookmark size={19} fill="currentColor" /></div>
          <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#23c7be]">Library & Assets</p><div className="flex items-baseline gap-2"><h2 className="text-xl font-black text-white">My Vault</h2><span className="text-xs font-bold text-white/35">{assets.length} assets</span></div></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className={`flex cursor-pointer items-center gap-2 rounded-[3px] border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black text-white transition hover:bg-white/[0.08] ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
            {uploading ? <Loader2 size={15} className="animate-spin text-[#23c7be]" /> : <Upload size={15} className="text-[#23c7be]" />}
            {uploading ? 'Uploading…' : 'Upload media'}
            <input type="file" accept="image/*,video/*,audio/*" multiple className="hidden" onChange={uploadMedia} disabled={uploading} />
          </label>
          <button onClick={() => setShowNewFolder(true)} className="flex items-center gap-2 rounded-[3px] bg-[#23c7be] px-4 py-2.5 text-xs font-black text-[#071211] transition hover:bg-[#35d8cf]"><Plus size={15} /> New Folder</button>
        </div>
      </header>

      {showNewFolder && (
        <div className="grid gap-2 rounded-[4px] border border-white/10 bg-[#202328] p-3 sm:grid-cols-[minmax(0,1fr)_150px_auto_auto]">
          <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Folder name…" className="h-10 rounded-[3px] border border-white/10 bg-black/25 px-3 text-sm font-semibold text-white outline-none placeholder:text-white/25 focus:border-[#23c7be]" autoFocus />
          <select value={newFolderColor} onChange={(e) => setNewFolderColor(e.target.value)} className="h-10 rounded-[3px] border border-white/10 bg-black/25 px-3 text-xs font-bold text-white outline-none focus:border-[#23c7be]"><option value="red">Red</option><option value="orange">Orange</option><option value="yellow">Yellow</option><option value="green">Green</option><option value="blue">Blue</option><option value="purple">Purple</option><option value="pink">Pink</option></select>
          <button onClick={createFolder} className="h-10 rounded-[3px] bg-[#23c7be] px-4 text-xs font-black text-[#071211]">Create</button>
          <button onClick={() => setShowNewFolder(false)} className="flex h-10 w-10 items-center justify-center rounded-[3px] border border-white/10 bg-white/[0.04] text-white/60"><X size={16} /></button>
        </div>
      )}

      {unfiledAssets.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 border-b border-white/10 pb-2.5">
            <Folder size={16} className="text-[#23c7be]" />
            <h3 className="text-xs font-black uppercase tracking-[0.14em] text-white">Unfiled</h3>
            <span className="text-xs font-bold text-white/35">{unfiledAssets.length}</span>
          </div>
          <AssetGrid items={unfiledAssets} />
        </section>
      )}

      {folders.map((folder) => {
        const folderAssets = assets.filter(a => a.folder_id === folder.id);
        const isExpanded = expandedFolders[folder.id] ?? !allCollapsed;
        return (
          <section key={folder.id} className="overflow-hidden rounded-[4px] border border-white/10 bg-[#202328]">
            <div className="flex cursor-pointer items-center justify-between px-3 py-3 hover:bg-white/[0.025]" onClick={() => toggleFolder(folder.id)}>
              <div className="flex min-w-0 items-center gap-2.5">
                <ChevronDown size={15} className={`flex-shrink-0 text-white/45 transition-transform ${!isExpanded ? '-rotate-90' : ''}`} />
                <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-[1px] ${folderAccent[folder.color] || 'bg-[#23c7be]'}`} />
                <Folder size={16} className="flex-shrink-0 text-white/55" />
                <span className="truncate text-sm font-black text-white">{folder.name}</span>
                <span className="text-xs font-bold text-white/30">{folderAssets.length}</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id); }} className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-transparent text-white/35 transition hover:border-red-400/20 hover:bg-red-400/10 hover:text-red-300" title="Delete folder"><Trash2 size={14} /></button>
            </div>
            {isExpanded && <div className="border-t border-white/10 p-3">{folderAssets.length ? <AssetGrid items={folderAssets} currentFolderId={folder.id} /> : <div className="py-8 text-center text-xs font-semibold text-white/30">This folder is empty.</div>}</div>}
          </section>
        );
      })}

      {assets.length === 0 && folders.length === 0 && (
        <div className="rounded-[4px] border border-dashed border-white/15 bg-[#202328] py-14 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[3px] border border-[#23c7be]/25 bg-[#23c7be]/10"><Bookmark size={22} className="text-[#23c7be]" /></div>
          <p className="text-sm font-black text-white">No saved assets yet</p>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-white/35">Upload media or save production assets to organize them here.</p>
        </div>
      )}

      {lightboxUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4" onClick={() => setLightboxUrl(null)}>
          <button className="absolute right-4 top-8 z-10 flex h-9 w-9 items-center justify-center rounded-[3px] border border-white/10 bg-white/[0.05] text-white"><X size={20} /></button>
          {lightboxUrl.match(/\.(mp4|webm|mov|m4v)(\?|$)/i) ? <video src={lightboxUrl} controls autoPlay className="max-h-full max-w-full rounded-[4px]" onClick={(e) => e.stopPropagation()} /> : <img src={lightboxUrl} alt="" className="max-h-full max-w-full rounded-[4px] object-contain" onClick={(e) => e.stopPropagation()} />}
        </div>
      )}

      {scriptAsset && <ScriptEditor asset={scriptAsset} userEmail={userEmail} onClose={() => setScriptAsset(null)} onUsePrompt={onUsePrompt} />}
      {inspectorAsset && <AssetInspector asset={inspectorAsset} userEmail={userEmail} folders={folders} onClose={() => setInspectorAsset(null)} />}
    </div>
  );
}