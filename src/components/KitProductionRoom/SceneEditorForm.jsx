import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, X, Upload, Users, Film, Mic, MapPin, Zap, Clapperboard, Video, CheckCircle2, Loader2 } from 'lucide-react';

const blockTypeConfig = {
  character: { icon: Users, color: 'bg-red-500', label: 'Character' },
  establishing_shot: { icon: MapPin, color: 'bg-blue-500', label: 'Establishing Shot' },
  action_element: { icon: Zap, color: 'bg-yellow-500', label: 'Action' },
  transition: { icon: Clapperboard, color: 'bg-purple-500', label: 'Transition' },
  closing_shot: { icon: Film, color: 'bg-green-500', label: 'Closing Shot' },
};

// ── Video Upload Panel ───────────────────────────────────────────────────
function VideoUploadPanel({ block, kitPage, onPublish, onClose, character }) {
  const [uploadingFile, setUploadingFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(block.media_url || null);
  const [errorMsg, setErrorMsg] = useState('');

  const currentActor = character || (block.assigned_character_id
    ? kitPage?.kit_characters?.find(c => c.id === block.assigned_character_id)
    : null);

  const handleUpload = async (file) => {
    if (!file.type.startsWith('video/')) {
      setErrorMsg('Please upload a video file');
      return;
    }
    setUploadingFile(file);
    setErrorMsg('');
    
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPreviewUrl(file_url);
    } catch (err) {
      setErrorMsg('Upload failed. Try again.');
    } finally {
      setUploadingFile(null);
    }
  };

  if (previewUrl) {
    return (
      <div className="space-y-3">
        <div className="relative rounded-xl overflow-hidden border border-white/20">
          <video src={previewUrl} controls className="w-full aspect-video object-cover" />
          <button onClick={() => setPreviewUrl(null)} className="absolute top-2 right-2 w-7 h-7 bg-black/80 rounded-full flex items-center justify-center">
            <X size={14} className="text-white" />
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-white/20 rounded-xl text-white text-xs hover:bg-white/5">Discard</button>
          <button 
            onClick={() => onPublish(previewUrl, 'video')}
            className="flex-1 py-2 bg-green-600 hover:bg-green-500 rounded-xl text-white text-xs font-medium flex items-center justify-center gap-1"
          >
            <CheckCircle2 size={12} />
            Use This Video
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {currentActor && (
        <div className="px-3 py-2 bg-white/5 rounded-xl">
          <div className="flex items-center gap-2">
            <Users size={12} className="text-white" />
            <span className="text-white text-xs">Assigned: <span className="text-white font-semibold">{currentActor.name}</span></span>
          </div>
        </div>
      )}

      {block.dialogue && (
        <div className="px-3 py-2 bg-black/30 rounded-xl border-l-2 border-red-500/50">
          <div className="flex items-center gap-1.5 mb-1">
            <Mic size={10} className="text-red-400" />
            <span className="text-red-400 text-[10px] font-bold uppercase">Dialogue</span>
          </div>
          <p className="text-white/80 text-xs italic">"{block.dialogue}"</p>
        </div>
      )}

      <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-white/40 rounded-xl cursor-pointer hover:border-white/60 transition-colors py-12">
        {uploadingFile ? (
          <>
            <Loader2 size={32} className="text-white animate-spin" />
            <span className="text-white text-sm">Uploading...</span>
          </>
        ) : (
          <>
            <Video size={32} className="text-white" />
            <div className="text-center">
              <p className="text-white font-semibold text-sm">Upload Video</p>
              <p className="text-white text-xs mt-1">MP4, MOV, WebM</p>
            </div>
          </>
        )}
        <input
          type="file"
          accept="video/*"
          className="hidden"
          onChange={e => e.target.files[0] && handleUpload(e.target.files[0])}
          disabled={!!uploadingFile}
        />
      </label>

      {errorMsg && <p className="text-red-400 text-xs text-center">{errorMsg}</p>}

      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-2 border border-white/20 rounded-xl text-white text-xs hover:bg-white/5">Cancel</button>
      </div>
    </div>
  );
}

export default function SceneEditorForm({ block, onSave, onProduce, onCancel, kitPage, dossier }) {
  const [editingBlock, setEditingBlock] = useState(block);
  const [saving, setSaving] = useState(false);
  const [showUploadPanel, setShowUploadPanel] = useState(false);

  const config = blockTypeConfig[editingBlock.block_type] || blockTypeConfig.character;
  const Icon = config.icon;

  const handlePublish = (mediaUrl, mediaType) => {
    setEditingBlock({ ...editingBlock, media_url: mediaUrl, media_type: mediaType });
    setShowUploadPanel(false);
  };

  const characterForBlock = block.assigned_character_id 
    ? kitPage?.kit_characters?.find(c => c.id === block.assigned_character_id)
    : null;

  const handleSave = async () => {
    setSaving(true);
    await onSave(editingBlock);
    setSaving(false);
  };

  const handleSaveAndProduce = async () => {
    setSaving(true);
    await onSave(editingBlock);
    setSaving(false);
    onProduce(editingBlock);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onCancel} className="text-white hover:text-white flex items-center gap-1 text-xs">
          <ChevronLeft size={15} />Back
        </button>
        <div className={`w-8 h-8 ${config.color} rounded-lg flex items-center justify-center`}>
          <Icon size={14} className="text-black" />
        </div>
        <p className="text-white text-sm font-bold">{config.label} Scene</p>
      </div>

      {/* Block Type */}
      <div>
        <label className="text-white text-[10px] uppercase tracking-widest mb-2 block">BLOCK TYPE</label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(blockTypeConfig).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setEditingBlock({...editingBlock, block_type: key})}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                editingBlock.block_type === key
                  ? `${cfg.color} text-white border-transparent`
                  : 'border-white/20 text-white hover:border-white/50 hover:text-white'
              }`}
            >
              {cfg.label}
            </button>
          ))}
        </div>
      </div>

      {/* Section Tool */}
      <div className="pt-4 border-t border-white/10">
        <label className="text-white text-[10px] uppercase tracking-widest mb-2 block">SECTION TOOL</label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowUploadPanel(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-white/60 rounded-xl text-white text-xs font-medium hover:bg-white/10 transition-colors"
          >
            <Upload size={13} />
            Upload
          </button>
        </div>
      </div>

      {/* Upload Panel */}
      {showUploadPanel && (
        <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
          <VideoUploadPanel 
            block={block}
            kitPage={kitPage}
            onPublish={handlePublish}
            onClose={() => setShowUploadPanel(false)}
            character={characterForBlock}
          />
        </div>
      )}

      {/* Title */}
      <div>
        <label className="text-white text-[10px] uppercase tracking-widest mb-1 block">TITLE</label>
        <input
          value={editingBlock.title || ''}
          onChange={(e) => setEditingBlock({...editingBlock, title: e.target.value})}
          placeholder="Scene title..."
          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/50"
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-white text-[10px] uppercase tracking-widest mb-1 block">DESCRIPTION</label>
        <textarea
          value={editingBlock.description || ''}
          onChange={(e) => setEditingBlock({...editingBlock, description: e.target.value})}
          placeholder="Short description..."
          rows={2}
          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/50 resize-none"
        />
      </div>

      {/* Dialogue */}
      <div>
        <label className="text-white text-[10px] uppercase tracking-widest mb-1 block flex items-center gap-1">
          <Mic size={10} className="text-red-400" />
          DIALOGUE (OPTIONAL)
        </label>
        <textarea
          value={editingBlock.dialogue || ''}
          onChange={(e) => setEditingBlock({...editingBlock, dialogue: e.target.value})}
          placeholder="Character lines for this scene..."
          rows={2}
          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/50 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-4">
        <button
          onClick={handleSaveAndProduce}
          disabled={saving}
          className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2"
        >
          <Film size={14} />
          {saving ? 'Saving...' : 'Save & Continue'}
        </button>
        <button
          onClick={async () => {
            await handleSave();
            onCancel();
          }}
          disabled={saving}
          className="w-full py-3 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white text-sm font-medium rounded-xl"
        >
          Save for Later
        </button>
      </div>
    </div>
  );
}