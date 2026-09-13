import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { X, Image as ImageIcon, Film, Plus, Check, Users, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ManualBlockModal({ open, onClose, theme, characters, sets, onCreated, insertPosition, existingCount }) {
  const [step, setStep] = useState('pick'); // pick → narrate → confirm
  const [selectedMedia, setSelectedMedia] = useState([]); // {url, media_type, source_label}
  const [narrations, setNarrations] = useState([]); // text per segment
  const [blockTitle, setBlockTitle] = useState('');
  const [narrativeSummary, setNarrativeSummary] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('media'); // media | characters | sets

  // Reset when opened
  useEffect(() => {
    if (open) {
      setStep('pick');
      setSelectedMedia([]);
      setNarrations([]);
      setBlockTitle('');
      setNarrativeSummary('');
    }
  }, [open]);

  const themeMedia = theme?.media_urls || [];
  const linkedChars = characters?.filter(c => (theme?.story_character_ids || []).includes(c.id)) || [];
  const linkedSets = sets?.filter(s => (theme?.story_set_ids || []).includes(s.id)) || [];

  const toggleMedia = (url, mediaType, label) => {
    const exists = selectedMedia.find(m => m.url === url);
    if (exists) {
      setSelectedMedia(prev => prev.filter(m => m.url !== url));
      setNarrations(prev => prev.filter((_, i) => selectedMedia[i].url !== url));
    } else {
      setSelectedMedia(prev => [...prev, { url, media_type: mediaType, source_label: label }]);
      setNarrations(prev => [...prev, '']);
    }
  };

  const updateNarration = (idx, text) => {
    setNarrations(prev => prev.map((n, i) => i === idx ? text : n));
  };

  const removeSelected = (idx) => {
    setSelectedMedia(prev => prev.filter((_, i) => i !== idx));
    setNarrations(prev => prev.filter((_, i) => i !== idx));
  };

  const isVideo = (url) => /\.(mp4|webm|mov|avi)(\?|$)/i.test(url);

  const handleCreate = async () => {
    if (selectedMedia.length === 0) {
      toast.error('Pick at least one media item');
      return;
    }
    setSaving(true);
    try {
      const segments = selectedMedia.map((m, i) => ({
        segment_number: i + 1,
        segment_purpose: 'context',
        media_type: m.media_type,
        estimated_duration: '10-15 seconds',
        shot_framing: 'medium shot',
        selected_set: '',
        characters_present: [],
        story_action: 'Manual scene',
        prompt: m.url,
        narration_text: narrations[i] || '',
        sound_effect: '',
        dialogue: '',
        emotional_tone: '',
        continuity_notes: 'Manual block',
        manual_media_url: m.url,
      }));

      const title = blockTitle || `Manual Block`;
      const summary = narrativeSummary || selectedMedia.map((m, i) => narrations[i]).filter(Boolean).join(' ') || 'Manual scene';

      await onCreated({
        block_title: title,
        narrative_summary: summary,
        segment_instructions: segments,
        selected_characters: [],
        selected_sets: [],
        choice_options: [],
      });

      onClose();
    } catch (e) {
      toast.error('Failed to create block');
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
                {insertPosition === 'before' ? 'Add Block Before' : insertPosition === 'after' ? 'Add Block After' : 'Add Manual Block'}
              </p>
              <p className="text-white text-xs">Pick media from your theme assets</p>
            </div>
            <button onClick={onClose} className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center">
              <X size={18} className="text-white" />
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex gap-2 px-5 py-3 flex-shrink-0">
            {['pick', 'narrate', 'confirm'].map((s, i) => (
              <div key={s} className={`flex-1 h-1 rounded-full ${step === s || (step === 'pick' && i === 0) || (step === 'narrate' && i <= 1) || (step === 'confirm' && i <= 2) ? 'bg-yellow-400' : 'bg-white/10'}`} />
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {step === 'pick' && (
              <div>
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
                      const selected = selectedMedia.find(m => m.url === url);
                      const video = isVideo(url);
                      return (
                        <button
                          key={i}
                          onClick={() => toggleMedia(url, video ? 'video' : 'image', 'Theme Media')}
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
                      const selected = selectedMedia.find(m => m.url === photo);
                      return (
                        <button
                          key={char.id}
                          onClick={() => toggleMedia(photo, 'image', char.name)}
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
                      const selected = selectedMedia.find(m => m.url === img);
                      return (
                        <button
                          key={set.id}
                          onClick={() => toggleMedia(img, 'image', set.name)}
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

                {/* Selected count */}
                {selectedMedia.length > 0 && (
                  <div className="mt-4 bg-yellow-400/10 rounded-xl p-3">
                    <p className="text-yellow-400 text-xs font-bold">{selectedMedia.length} item(s) selected</p>
                  </div>
                )}
              </div>
            )}

            {step === 'narrate' && (
              <div>
                <p className="text-white text-sm mb-4">Write narration text for each segment (optional but recommended):</p>
                <div className="space-y-4">
                  {selectedMedia.map((m, i) => (
                    <div key={i} className="bg-white/5 rounded-xl p-3">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                          {isVideo(m.url) ? (
                            <video src={m.url} className="w-full h-full object-cover" muted />
                          ) : (
                            <img src={m.url} alt="" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs">Segment {i + 1} — {m.source_label}</p>
                          <button
                            onClick={() => removeSelected(i)}
                            className="text-red-400 text-xs font-bold mt-0.5"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <textarea
                        value={narrations[i] || ''}
                        onChange={e => updateNarration(i, e.target.value)}
                        placeholder="Narration text for this scene…"
                        className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-yellow-400 resize-none"
                        rows={2}
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-3">
                  <input
                    value={blockTitle}
                    onChange={e => setBlockTitle(e.target.value)}
                    placeholder="Block title (optional)"
                    className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-yellow-400"
                  />
                  <textarea
                    value={narrativeSummary}
                    onChange={e => setNarrativeSummary(e.target.value)}
                    placeholder="Block narrative summary (optional)"
                    className="w-full bg-black border border-white/10 rounded-lg p-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-yellow-400 resize-none"
                    rows={2}
                  />
                </div>
              </div>
            )}

            {step === 'confirm' && (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check size={32} className="text-black" />
                </div>
                <p className="text-white font-bold text-lg">Ready to create?</p>
                <p className="text-white text-sm mt-1">
                  {selectedMedia.length} segment(s) will be added {insertPosition === 'before' ? 'before' : 'after'} the selected block.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-white/10 flex-shrink-0">
            {step === 'pick' && (
              <button
                onClick={() => selectedMedia.length > 0 ? setStep('narrate') : toast.error('Pick at least one media item')}
                disabled={selectedMedia.length === 0}
                className="w-full py-3 bg-yellow-400 text-black font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
              >
                Next ({selectedMedia.length} selected)
              </button>
            )}
            {step === 'narrate' && (
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('pick')}
                  className="px-5 py-3 bg-white/10 text-white font-bold rounded-xl"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  className="flex-1 py-3 bg-yellow-400 text-black font-bold rounded-xl"
                >
                  Review
                </button>
              </div>
            )}
            {step === 'confirm' && (
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('narrate')}
                  className="px-5 py-3 bg-white/10 text-white font-bold rounded-xl"
                >
                  Back
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className="flex-1 py-3 bg-yellow-400 text-black font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                  Create Block
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}