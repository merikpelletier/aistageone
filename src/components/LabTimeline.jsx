import React, { useState, useEffect } from 'react';
import { Plus, Film, Trash2, Mic } from 'lucide-react';

function uid() { return Math.random().toString(36).slice(2, 10); }

export default function LabTimeline({ onClose }) {
  const [blocks, setBlocks] = useState([]);
  const [editingBlock, setEditingBlock] = useState(null);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('lab_timeline_blocks');
    if (saved) {
      try { setBlocks(JSON.parse(saved)); } catch {}
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('lab_timeline_blocks', JSON.stringify(blocks));
  }, [blocks]);

  const addBlock = () => {
    setBlocks(prev => [...prev, { id: uid(), order: prev.length + 1, title: '', media_url: null, media_type: null }]);
  };

  const deleteBlock = (blockId) => {
    setBlocks(prev => prev.filter(b => b.id !== blockId).map((b, i) => ({ ...b, order: i + 1 })));
  };

  const handleOpenEditor = (block) => {
    setEditingBlock(block);
  };

  const handleSaveBlock = (updated) => {
    setBlocks(prev => prev.map(b => b.id === updated.id ? updated : b));
    setEditingBlock(null);
  };

  const handleProduceInStudio = (block) => {
    sessionStorage.setItem('studio_block_details', JSON.stringify({ block, character: null, referenceMedia: [] }));
    const params = new URLSearchParams({ mode: 'production', block_id: block.id, production_method: 'actor_replacement' });
    window.location.href = `/Studio?${params.toString()}`;
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-10 pb-3 border-b border-white/10">
        {onClose && (
          <button onClick={onClose} className="p-1 text-white hover:text-white"><Film size={24} /></button>
        )}
        <div className="flex-1">
          <p className="text-white text-xs uppercase tracking-wider">Laboratory</p>
          <p className="text-white text-sm font-medium">Create freely • No project needed</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Add Button */}
        <button onClick={addBlock} className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-red-500/70 hover:border-red-400 rounded-xl text-red-400 hover:text-red-300 transition-colors">
          <Plus size={18} />
          <span className="text-sm font-medium">Add Scene</span>
        </button>

        {/* Blocks */}
        {blocks.length > 0 ? (
          <div className="space-y-3">
            {blocks.sort((a, b) => a.order - b.order).map((block, idx) => (
              <div key={block.id}>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-white text-xs font-medium uppercase tracking-wider">Scene {idx + 1}</label>
                  <input
                    value={block.title || ''}
                    onChange={(e) => setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, title: e.target.value } : b))}
                    placeholder="Name this scene..."
                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/40"
                  />
                  <button onClick={() => deleteBlock(block.id)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div onClick={() => handleOpenEditor(block)} className="relative rounded-xl overflow-hidden border border-white/10 bg-white/5 cursor-pointer aspect-[4/3]">
                  {block.media_url ? (
                    block.media_type === 'video' ? <video src={block.media_url} className="w-full h-full object-cover" /> :
                    block.media_type === 'audio' ? <div className="w-full h-full flex items-center justify-center"><Mic size={32} className="text-white" /></div> :
                    <img src={block.media_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center"><Film size={20} className="text-white/20" /></div>
                      <span className="text-white text-xs">Empty - Click to edit</span>
                    </div>
                  )}
                  {block.media_url && (
                    <div className="absolute top-2 right-2 flex gap-2">
                      <button onClick={(e) => { e.stopPropagation(); handleOpenEditor(block); }} className="px-3 py-1.5 bg-white/90 rounded-lg text-black text-xs font-medium">Edit</button>
                      <button onClick={(e) => { e.stopPropagation(); handleProduceInStudio(block); }} className="px-3 py-1.5 bg-red-600 rounded-lg text-white text-xs font-medium">Studio</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <Film size={32} className="text-white/20" />
            </div>
            <p className="text-white text-sm">No scenes yet</p>
            <p className="text-white text-xs mt-1">Tap "Add Scene" to start creating</p>
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {editingBlock && (
        <SceneEditorModal
          block={editingBlock}
          onSave={handleSaveBlock}
          onProduce={handleProduceInStudio}
          onCancel={() => setEditingBlock(null)}
        />
      )}
    </>
  );
}

// Simple editor modal
function SceneEditorModal({ block, onSave, onProduce, onCancel }) {
  const [title, setTitle] = useState(block.title || '');
  const [mediaUrl, setMediaUrl] = useState(block.media_url || null);
  const [mediaType, setMediaType] = useState(block.media_type || null);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const type = file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image';
    // For now just create object URL - in production would upload
    const url = URL.createObjectURL(file);
    setMediaUrl(url);
    setMediaType(type);
    onSave({ ...block, title, media_url: url, media_type: type });
  };

  return (
    <div className="fixed inset-0 bg-black z-[60] flex flex-col">
      <div className="flex items-center gap-3 px-4 pt-10 pb-3 border-b border-white/10">
        <button onClick={onCancel} className="p-1 text-white hover:text-white"><Film size={24} /></button>
        <div className="flex-1">
          <p className="text-white text-xs uppercase">Scene</p>
          <p className="text-white text-sm font-medium">{title || 'New Scene'}</p>
        </div>
        <button onClick={() => onSave({ ...block, title, media_url: mediaUrl, media_type: mediaType })} className="px-3 py-1.5 bg-white text-black text-xs rounded-lg font-medium">Save</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Scene title..." className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none" />
        {!mediaUrl ? (
          <label className="flex flex-col items-center gap-3 py-10 border-2 border-dashed border-white/60 rounded-xl cursor-pointer hover:border-white">
            <Plus size={32} className="text-white" />
            <span className="text-white text-sm">Upload media</span>
            <input type="file" accept="image/*,video/*,audio/*" className="hidden" onChange={handleUpload} />
          </label>
        ) : (
          <div className="relative rounded-xl overflow-hidden">
            {mediaType === 'video' ? <video src={mediaUrl} controls className="w-full" /> :
             mediaType === 'audio' ? <audio src={mediaUrl} controls className="w-full" /> :
             <img src={mediaUrl} alt="" className="w-full" />}
            <button onClick={() => { setMediaUrl(null); setMediaType(null); }} className="absolute top-2 right-2 px-2 py-1 bg-black/70 rounded-lg text-white text-xs">Replace</button>
          </div>
        )}
        {mediaUrl && (
          <button onClick={() => onProduce({ ...block, title, media_url: mediaUrl, media_type: mediaType })} className="w-full py-3 bg-red-600 rounded-xl text-white text-sm font-medium">
            Open in Studio →
          </button>
        )}
      </div>
    </div>
  );
}