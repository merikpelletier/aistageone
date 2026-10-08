import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

  const folderButtonClass = (selected) => (
    `w-full min-h-[42px] flex items-center gap-3 px-3 py-2 border text-left transition-colors ${
      selected
        ? 'bg-[rgba(35,199,190,.08)] border-[var(--studio-accent)]'
        : 'bg-[rgba(255,255,255,.03)] border-[var(--studio-border)] hover:bg-[rgba(255,255,255,.06)] hover:border-[var(--studio-border-strong)]'
    }`
  );

  const modal = (
    <div className="fixed inset-0 z-[99999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 text-[var(--studio-text)]">
      <div className="studio-panel w-full max-w-4xl max-h-[calc(100dvh-24px)] sm:max-h-[calc(100dvh-48px)] overflow-hidden flex flex-col shadow-[0_24px_80px_rgba(0,0,0,.55)]">
        {/* Header */}
        <div className="studio-tool-header flex-shrink-0">
          <div className="min-w-0">
            <div className="studio-tool-eyebrow mb-1">Vault</div>
            <h3 className="studio-tool-title uppercase tracking-[0.08em]">Save to Vault</h3>
          </div>
          <button onClick={onClose} className="studio-icon-button flex-shrink-0" aria-label="Close Save to Vault">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_320px] md:items-start">
            {/* Preview */}
            <section className="min-w-0 space-y-2">
              <p className="studio-tool-eyebrow">Preview</p>
              <div className="studio-panel-secondary relative overflow-hidden min-h-[220px] flex items-center justify-center bg-black/25">
                {mediaType === 'video' ? (
                  <video src={imageUrl} controls className="w-full max-h-[58vh] object-contain bg-black" />
                ) : mediaType === 'audio' ? (
                  <div className="w-full min-h-[260px] flex flex-col items-center justify-center gap-4 p-6 bg-black/20">
                    <div className="w-14 h-14 border border-[var(--studio-border-strong)] bg-[var(--studio-surface-3)] flex items-center justify-center">
                      <Volume2 size={26} className="text-[var(--studio-accent)]" />
                    </div>
                    <audio src={imageUrl} controls className="w-full max-w-sm" />
                  </div>
                ) : (
                  <img src={imageUrl} alt="Generated result" className="w-full max-h-[58vh] object-contain bg-black" />
                )}
                <a
                  href={imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute top-3 right-3 studio-button studio-button-secondary !min-h-0 h-8 !px-3 text-[11px]"
                >
                  <ExternalLink size={13} /> Open full
                </a>
              </div>
            </section>

            {/* Details */}
            <section className="min-w-0 space-y-5">
              <div className="space-y-2">
                <label htmlFor="vault-asset-name" className="studio-tool-eyebrow block">Name</label>
                <input
                  id="vault-asset-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name this file…"
                  className="studio-input w-full h-[var(--studio-control-height)] px-3 text-sm font-semibold placeholder:text-[var(--studio-text-faint)]"
                />
              </div>

              {/* Folder picker */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="studio-tool-eyebrow">Save to folder</p>
                  {!loading && (
                    <button
                      onClick={() => setShowCreate(s => !s)}
                      className="text-[11px] font-bold text-[var(--studio-accent)] hover:text-[var(--studio-accent-hover)] transition-colors"
                    >
                      {showCreate ? 'Cancel' : '+ New folder'}
                    </button>
                  )}
                </div>

                {loading ? (
                  <div className="studio-panel-secondary h-[84px] flex items-center justify-center">
                    <Loader2 size={18} className="animate-spin text-[var(--studio-accent)]" />
                  </div>
                ) : (
                  <div className="studio-panel-secondary overflow-hidden">
                    <div className="max-h-[220px] overflow-y-auto p-2 space-y-1.5">
                      <button
                        onClick={() => setSelectedFolderId(null)}
                        className={folderButtonClass(selectedFolderId === null)}
                      >
                        <Folder size={16} className={selectedFolderId === null ? 'text-[var(--studio-accent)]' : 'text-[var(--studio-text-muted)]'} />
                        <span className="text-sm font-semibold flex-1 truncate">Unfiled</span>
                        {selectedFolderId === null && <Check size={16} className="text-[var(--studio-accent)]" />}
                      </button>

                      {folders.map(f => {
                        const color = FOLDER_COLORS.find(c => c.key === f.color) || FOLDER_COLORS[0];
                        const selected = selectedFolderId === f.id;
                        return (
                          <button
                            key={f.id}
                            onClick={() => setSelectedFolderId(f.id)}
                            className={folderButtonClass(selected)}
                          >
                            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color.dot}`} />
                            <span className="text-sm font-semibold flex-1 truncate">{f.name}</span>
                            {selected && <Check size={16} className="text-[var(--studio-accent)]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {showCreate && (
                  <div className="studio-panel-secondary p-3 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-[var(--studio-text-muted)]">
                      <FolderPlus size={15} className="text-[var(--studio-accent)]" />
                      Create new folder
                    </div>
                    <input
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      placeholder="Folder name…"
                      className="studio-input w-full h-[var(--studio-control-height)] px-3 text-sm placeholder:text-[var(--studio-text-faint)]"
                    />
                    <div className="flex flex-wrap gap-2" aria-label="Folder color">
                      {FOLDER_COLORS.map(c => (
                        <button
                          key={c.key}
                          onClick={() => setNewColor(c.key)}
                          className={`w-7 h-7 rounded-full ${c.dot} ${newColor === c.key ? `ring-2 ring-offset-2 ring-offset-[var(--studio-surface-2)] ${c.ring}` : 'opacity-70 hover:opacity-100'}`}
                          aria-label={`${c.key} folder color`}
                        />
                      ))}
                    </div>
                    <button
                      onClick={handleCreateFolder}
                      disabled={!newName.trim() || creating}
                      className="studio-button studio-button-secondary w-full"
                    >
                      {creating ? <Loader2 size={14} className="animate-spin" /> : <FolderPlus size={14} />}
                      {creating ? 'Creating…' : 'Create folder'}
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-[var(--studio-border)] bg-[var(--studio-surface)] px-4 sm:px-5 py-3 flex items-center justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="studio-button studio-button-primary w-full sm:w-auto sm:min-w-[180px]"
          >
            {saving ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}
            {saving ? 'Saving…' : 'Save to Vault'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
