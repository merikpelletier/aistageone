import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image as ImageIcon, Film, Plus, Check, Users, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ManualSegmentModal({ open, onClose, theme, characters, sets, onCreated, insertPosition, segmentNumber }) {
  const [selectedMedia, setSelectedMedia] = useState(null); // {url, media_type, source_label}
  const [narration, setNarration] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('media');

  useEffect(() => {
    if (open) {
      setSelectedMedia(null);
      setNarration('');
      setActiveTab('media');
    }
  }, [open]);

  const themeMedia = theme?.media_urls || [];
  const linkedChars = characters?.filter(c => (theme?.story_character_ids || []).includes(c.id)) || [];
  const linkedSets = sets?.filter(s => (theme?.story_set_ids || []).includes(s.id)) || [];

  const isVideo = (url) => /\.(mp4|webm|mov|avi)(\?|$)/i.test(url);

  const pickMedia = (url, mediaType, label) => {
    setSelectedMedia({ url, media_type: mediaType, source_label: label });
  };

  const handleCreate = async () => {
    if (!selectedMedia) {
      toast.error('Pick a media item');
      return;
    }
    setSaving(true);
    try {
      await onCreated({
        media_url: selectedMedia.url,
        media_type: selectedMedia.media_type,
        narration_text: narration || '',
        source_label: selectedMedia.source_label,
      });
      onClose();
    } catch (e) {
      toast.error('Failed to add segment: ' + (e.response?.data?.error || e.message || 'Unknown error'));
    }
    setSaving(false);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 z-[100] flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="bg-black w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[85vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/10 flex-shrink-0">
            <div>
              <p className="text-yellow-400 font-bold text-lg">
                Add Segment {insertPosition === 'before' ? 'Before' : 'After'} #{segmentNumber}
              </p>
              <p className="text-white text-xs">Pick media from your theme assets</p>
            </div>
            <button onClick={onClose} className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center">
              <X size={18} className="text-white" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {/* Tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab('media')}
                className={`px-4 py-2 rounded-lg text-xs font-bold ${activeTab === 'media' ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white'}`}
              >
                <ImageIcon size={12} className="inline mr-1" /> Media ({themeMedia.length})
              </button>
              <button
                onClick={() => setActiveTab('characters')}
                className={`px-4 py-2 rounded-lg text-xs font-bold ${activeTab === 'characters' ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white'}`}
              >
                <Users size={12} className="inline mr-1" /> Characters ({linkedChars.length})
              </button>
              <button
                onClick={() => setActiveTab('sets')}
                className={`px-4 py-2 rounded-lg text-xs font-bold ${activeTab === 'sets' ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white'}`}
              >
                <MapPin size={12} className="inline mr-1" /> Sets ({linkedSets.length})
              </button>
            </div>

            {/* Media grid */}
            {activeTab === 'media' && (
              <div className="grid grid-cols-3 gap-2">
                {themeMedia.length === 0 ? (
                  <p className="text-white text-sm col-span-3 text-center py-8">No theme media available</p>
                ) : themeMedia.map((url, i) => {
                  const selected = selectedMedia?.url === url;
                  const video = isVideo(url);
                  return (
                    <button
                      key={i}
                      onClick={() => pickMedia(url, video ? 'video' : 'image', 'Theme Media')}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 ${selected ? 'border-yellow-400' : 'border-transparent'}`}
                    >
                      {video ? (
                        <video src={url} className="w-full h-full object-cover" muted />
                      ) : (
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      )}
                      {selected && (
                        <div className="absolute inset-0 bg-yellow-400/30 flex items-center justify-center">
                          <Check size={20} className="text-yellow-400" />
                        </div>
                      )}
                      <div className="absolute bottom-1 right-1 bg-black/60 rounded p-0.5">
                        {video ? <Film size={10} className="text-white" /> : <ImageIcon size={10} className="text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {activeTab === 'characters' && (
              <div className="grid grid-cols-2 gap-2">
                {linkedChars.length === 0 ? (
                  <p className="text-white text-sm col-span-2 text-center py-8">No characters linked</p>
                ) : linkedChars.map(char => {
                  const photo = char.photos?.[0];
                  if (!photo) return null;
                  const selected = selectedMedia?.url === photo;
                  return (
                    <button
                      key={char.id}
                      onClick={() => pickMedia(photo, 'image', char.name)}
                      className={`relative aspect-[3/4] rounded-lg overflow-hidden border-2 ${selected ? 'border-yellow-400' : 'border-transparent'}`}
                    >
                      <img src={photo} alt="" className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1.5">
                        <p className="text-white text-xs font-bold truncate">{char.name}</p>
                      </div>
                      {selected && (
                        <div className="absolute inset-0 bg-yellow-400/30 flex items-center justify-center">
                          <Check size={20} className="text-yellow-400" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {activeTab === 'sets' && (
              <div className="grid grid-cols-2 gap-2">
                {linkedSets.length === 0 ? (
                  <p className="text-white text-sm col-span-2 text-center py-8">No sets linked</p>
                ) : linkedSets.map(set => {
                  const img = set.images?.[0];
                  if (!img) return null;
                  const selected = selectedMedia?.url === img;
                  return (
                    <button
                      key={set.id}
                      onClick={() => pickMedia(img, 'image', set.name)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 ${selected ? 'border-yellow-400' : 'border-transparent'}`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1.5">
                        <p className="text-white text-xs font-bold truncate">{set.name}</p>
                      </div>
                      {selected && (
                        <div className="absolute inset-0 bg-yellow-400/30 flex items-center justify-center">
                          <Check size={20} className="text-yellow-400" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Narration input */}
            {selectedMedia && (
              <div className="mt-4 bg-white/5 rounded-xl p-3">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                    {isVideo(selectedMedia.url) ? (
                      <video src={selectedMedia.url} className="w-full h-full object-cover" muted />
                    ) : (
                      <img src={selectedMedia.url} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <p className="text-white text-xs">{selectedMedia.source_label}</p>
                </div>
                <textarea
                  value={narration}
                  onChange={e => setNarration(e.target.value)}
                  placeholder="Narration text for this scene (optional)…"
                  className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-yellow-400 resize-none"
                  rows={2}
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-white/10 flex-shrink-0">
            <button
              onClick={handleCreate}
              disabled={!selectedMedia || saving}
              className="w-full py-3 bg-yellow-400 text-black font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
              Add Segment
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}