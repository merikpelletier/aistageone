import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Folder, FolderPlus, Check, ExternalLink, Loader2, Volume2 } from 'lucide-react';

const FOLDER_COLORS = [
  { key: 'blue', dot: 'bg-blue-500', ring: 'ring-blue-500' },
  { key: 'red', dot: 'bg-red-500', ring: 'ring-red-500' },
  { key: 'orange', dot: 'bg-orange-500', ring: 'ring-orange-500' },
  { key: 'yellow', dot: 'bg-yellow-400', ring: 'ring-yellow-400' },
  { key: 'green', dot: 'bg-green-500', ring: 'ring-green-500' },
  { key: 'purple', dot: 'bg-purple-500', ring: 'ring-purple-500' },
  { key: 'pink', dot: 'bg-pink-500', ring: 'ring-pink-500' },
];

export default function SaveToVaultModal({ userEmail, imageUrl, mediaType = 'image', onSaved, onClose }) {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolderId, setSelectedFolderId] = useState(null); // null = Unfiled
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('blue');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const defaultName = mediaType === 'video' ? 'My video' : mediaType === 'audio' ? 'My audio' : 'My image';
  const [name, setName] = useState(defaultName);

  const loadFolders = async () => {
    const f = await base44.entities.VaultFolder.filter({ user_email: userEmail }, 'order', null).catch(() => []);
    setFolders(f);
    setLoading(false);
  };

  useEffect(() => { if (userEmail) loadFolders(); else setLoading(false); }, [userEmail]);

  const handleCreateFolder = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const created = await base44.entities.VaultFolder.create({
      user_email: userEmail,
      name: newName.trim(),
      color: newColor,
      order: folders.length,
    }).catch(() => null);
    setCreating(false);
    if (created) {
      setFolders(prev => [...prev, created]);
      setSelectedFolderId(created.id);
      setNewName('');
      setShowCreate(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const saved = await base44.entities.VaultAsset.create({
      user_email: userEmail,
      name: name.trim() || defaultName,
      url: imageUrl,
      media_type: mediaType,
      asset_category: 'reference',
      folder_id: selectedFolderId || null,
    }).catch(() => null);
    setSaving(false);
    if (saved) {
      onSaved(saved);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-10 pb-4 border-b border-white/10 flex-shrink-0">
        <h3 className="text-white text-sm font-bold tracking-widest uppercase">Save to Vault</h3>
        <button onClick={onClose} className="p-2 text-white hover:text-white">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Name */}
        <div>
          <p className="text-white text-xs font-bold uppercase tracking-wider mb-2">Name</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this file…"
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm font-semibold placeholder-white/30 focus:outline-none focus:border-yellow-400"
          />
        </div>

        {/* Preview */}
        <div className="rounded-2xl overflow-hidden bg-white/5 relative">
          {mediaType === 'video' ? (
            <video src={imageUrl} controls className="w-full max-h-[40vh] object-contain bg-black" />
          ) : mediaType === 'audio' ? (
            <div className="w-full max-h-[40vh] bg-black flex flex-col items-center justify-center gap-3 py-10">
              <Volume2 size={40} className="text-yellow-400" />
              <audio src={imageUrl} controls className="w-full max-w-sm" />
            </div>
          ) : (
            <img src={imageUrl} alt="Generated result" className="w-full max-h-[40vh] object-contain bg-black" />
          )}
          <a href={imageUrl} target="_blank" rel="noopener noreferrer"
            className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 text-white text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-black/90">
            <ExternalLink size={12} /> Open full
          </a>
        </div>

        {/* Folder picker */}
        <div className="space-y-2">
          <p className="text-white text-xs font-bold uppercase tracking-wider">Save to folder</p>

          {loading ? (
            <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-white" /></div>
          ) : (
            <>
              {/* Unfiled */}
              <button
                onClick={() => setSelectedFolderId(null)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${selectedFolderId === null ? 'border-yellow-400 bg-yellow-400/10' : 'border-white/10 bg-white/5'}`}
              >
                <Folder size={16} className="text-white" />
                <span className="text-white text-sm font-semibold flex-1 text-left">Unfiled</span>
                {selectedFolderId === null && <Check size={16} className="text-yellow-400" />}
              </button>

              {/* Existing folders */}
              {folders.map(f => {
                const color = FOLDER_COLORS.find(c => c.key === f.color) || FOLDER_COLORS[0];
                const sel = selectedFolderId === f.id;
                return (
                  <button key={f.id}
                    onClick={() => setSelectedFolderId(f.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${sel ? 'border-yellow-400 bg-yellow-400/10' : 'border-white/10 bg-white/5'}`}
                  >
                    <span className={`w-3 h-3 rounded-full ${color.dot}`} />
                    <span className="text-white text-sm font-semibold flex-1 text-left truncate">{f.name}</span>
                    {sel && <Check size={16} className="text-yellow-400" />}
                  </button>
                );
              })}

              {/* Create new folder toggle */}
              <button
                onClick={() => setShowCreate(s => !s)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-white/20 bg-transparent hover:border-white/40 transition-all"
              >
                <FolderPlus size={16} className="text-white" />
                <span className="text-white text-sm font-semibold flex-1 text-left">Create new folder</span>
              </button>

              {showCreate && (
                <div className="space-y-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                  <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Folder name…"
                    className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-yellow-400"
                  />
                  <div className="flex flex-wrap gap-2">
                    {FOLDER_COLORS.map(c => (
                      <button key={c.key}
                        onClick={() => setNewColor(c.key)}
                        className={`w-7 h-7 rounded-full ${c.dot} ${newColor === c.key ? `ring-2 ring-offset-2 ring-offset-black ${c.ring}` : ''}`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={handleCreateFolder}
                    disabled={!newName.trim() || creating}
                    className="w-full py-2 bg-yellow-400 text-black font-bold rounded-lg disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {creating ? <Loader2 size={14} className="animate-spin" /> : <FolderPlus size={14} />}
                    Create folder
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer save button */}
      <div className="px-4 pb-8 pt-3 border-t border-white/10 flex-shrink-0">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-4 bg-yellow-400 text-black font-bold rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          {saving ? 'Saving…' : 'Save to Vault'}
        </button>
      </div>
    </div>
  );
}
