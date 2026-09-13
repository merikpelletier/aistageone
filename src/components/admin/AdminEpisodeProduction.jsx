import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import ProxiedImage from '@/components/ProxiedImage';
import AdminEpisodeParticipants from './AdminEpisodeParticipants';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ChevronDown, ChevronUp, Upload, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCharacterTypes } from '@/hooks/useCharacterTypes';

const ALL_PARTICIPATION_OPTIONS = [
  { value: 'likeness_reference', label: 'Likeness (Reference)' },
  { value: 'likeness_performance', label: 'Likeness (Performance)' },
  { value: 'reference_performance', label: 'Reference Performance' },
  { value: 'body_and_voice', label: 'Body & Voice' },
  { value: 'faceswitch', label: 'FaceSwitch' },
  { value: 'voice_only', label: 'Voice Only 🎵' },
];

// voice_only is only available for Musical dossiers
const getParticipationOptions = (isMusical) =>
  isMusical ? ALL_PARTICIPATION_OPTIONS : ALL_PARTICIPATION_OPTIONS.filter(o => o.value !== 'voice_only');

const BLOCK_TYPES = [
  { value: 'character', label: 'Character' },
  { value: 'establishing_shot', label: 'Establishing Shot' },
  { value: 'action_element', label: 'Action / Element' },
  { value: 'transition', label: 'Transition' },
  { value: 'closing_shot', label: 'Closing Shot' },
];

const BLOCK_TYPE_COLORS = {
  character: 'bg-red-600/20 text-red-300 border-red-600/30',
  establishing_shot: 'bg-blue-600/20 text-blue-300 border-blue-600/30',
  action_element: 'bg-orange-600/20 text-orange-300 border-orange-600/30',
  transition: 'bg-purple-600/20 text-purple-300 border-purple-600/30',
  closing_shot: 'bg-green-600/20 text-green-300 border-green-600/30',
};

function newCharacter() {
  return {
    id: `char_${Date.now()}`,
    name: '',
    description: '',
    photo_url: '',
    character_type: '',
    participation_methods: [],
    reference_images: [],
  };
}

function newBlock(order) {
  return {
    id: `block_${Date.now()}`,
    order,
    title: '',
    block_type: 'character',
    description: '',
    assigned_character_id: '',
    dialogue: '',
    reference_media: [],
    production_instructions: '',
    allowed_methods: [],
  };
}

export default function AdminEpisodeProduction({ episodePage, dossier }) {
  const CHARACTER_TYPES = useCharacterTypes();
  const isMusical = dossier?.category === 'Musical';
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline' | 'characters' | 'participants'
  const [expandedBlock, setExpandedBlock] = useState(null);
  const [expandedChar, setExpandedChar] = useState(null);
  const [uploading, setUploading] = useState(false);

  const { data: production, isLoading } = useQuery({
    queryKey: ['episodeProduction', episodePage.id],
    queryFn: async () => {
      const res = await base44.entities.EpisodeProduction.filter({ episode_page_id: episodePage.id });
      return res[0] || null;
    },
  });

  const [form, setForm] = useState(null);

  // Reset form when switching to a different episode
  useEffect(() => {
    setForm(null);
  }, [episodePage.id]);

  useEffect(() => {
    // Initialize form on first load or when episode page changes
    if (production !== undefined && form === null) {
      const normalizeRefImages = (imgs) =>
        (imgs || []).map(r => typeof r === 'string' ? { url: r, block_id: '' } : r);

      setForm(production
        ? {
            ...production,
            characters: (production.characters || []).map(c => ({
              ...c,
              reference_images: normalizeRefImages(c.reference_images),
            })),
            timeline: production.timeline || [],
            dossier_id: production.dossier_id || episodePage.dossier_id,
          }
        : {
            episode_page_id: episodePage.id,
            dossier_id: episodePage.dossier_id,
            characters: [],
            timeline: [],
          });
    }
  }, [production, episodePage.id, episodePage.dossier_id]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (data.id) return base44.entities.EpisodeProduction.update(data.id, data);
      return base44.entities.EpisodeProduction.create(data);
    },
    onSuccess: (saved) => {
      // Sync form with saved record (ensures id is set after create)
      if (saved?.id) {
        setForm(saved);
        qc.setQueryData(['episodeProduction', episodePage.id], saved);
      }
    },
  });

  if (isLoading || !form) return <div className="py-4 text-white text-sm">Loading...</div>;

  // ── Timeline helpers ──────────────────────────────────────────────
  const updateBlock = (blockId, updates) =>
    setForm(f => ({ ...f, timeline: f.timeline.map(b => b.id === blockId ? { ...b, ...updates } : b) }));

  const addBlock = () => {
    const block = newBlock(form.timeline.length + 1);
    setForm(f => ({ ...f, timeline: [...f.timeline, block] }));
    setExpandedBlock(block.id);
  };

  const removeBlock = (blockId) =>
    setForm(f => {
      const filtered = f.timeline.filter(b => b.id !== blockId);
      return { ...f, timeline: filtered.map((b, i) => ({ ...b, order: i + 1 })) };
    });

  const uploadBlockMedia = async (blockId, file) => {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const block = form.timeline.find(b => b.id === blockId);
    updateBlock(blockId, { reference_media: [...(block.reference_media || []), file_url] });
    setUploading(false);
  };

  const removeBlockMedia = (blockId, idx) => {
    const block = form.timeline.find(b => b.id === blockId);
    updateBlock(blockId, { reference_media: block.reference_media.filter((_, i) => i !== idx) });
  };

  const uploadInstrumentalTrack = async (blockId, file) => {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    updateBlock(blockId, { instrumental_track_url: file_url });
    setUploading(false);
  };

  // ── Character helpers ─────────────────────────────────────────────
  const updateChar = (charId, updates) =>
    setForm(f => ({ ...f, characters: f.characters.map(c => c.id === charId ? { ...c, ...updates } : c) }));

  const addChar = () => {
    const char = newCharacter();
    setForm(f => ({ ...f, characters: [...f.characters, char] }));
    setExpandedChar(char.id);
  };

  const removeChar = (charId) =>
    setForm(f => ({ ...f, characters: f.characters.filter(c => c.id !== charId) }));

  const uploadCharPhoto = async (charId, file) => {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    updateChar(charId, { photo_url: file_url });
    setUploading(false);
  };

  const uploadCharRefImage = async (charId, file) => {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const char = form.characters.find(c => c.id === charId);
    // Store as object { url, block_id } instead of plain string
    const existing = (char.reference_images || []).map(r => typeof r === 'string' ? { url: r, block_id: '' } : r);
    updateChar(charId, { reference_images: [...existing, { url: file_url, block_id: '' }] });
    setUploading(false);
  };

  const sortedTimeline = [...form.timeline].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      {isMusical && (
        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-400/10 border border-yellow-400/30 rounded-lg">
          <span className="text-yellow-400 text-sm">🎵</span>
          <span className="text-yellow-400/80 text-xs">Musical episode — instrumental track upload and Voice Only method are enabled per block.</span>
        </div>
      )}
      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('timeline')}
          className={`px-3 py-1.5 text-xs rounded transition-colors ${activeTab === 'timeline' ? 'bg-white text-black font-medium' : 'text-white hover:text-white'}`}
        >
          🎬 Master Timeline ({form.timeline.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('characters')}
          className={`px-3 py-1.5 text-xs rounded transition-colors ${activeTab === 'characters' ? 'bg-white text-black font-medium' : 'text-white hover:text-white'}`}
        >
          👤 Characters ({form.characters.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('participants')}
          className={`px-3 py-1.5 text-xs rounded transition-colors ${activeTab === 'participants' ? 'bg-white text-black font-medium' : 'text-white hover:text-white'}`}
        >
          🎬 Participants
        </button>
      </div>

      {/* ── TIMELINE TAB ─────────────────────────────────────────────── */}
      {activeTab === 'timeline' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-white text-xs tracking-widest uppercase">Timeline Blocks</p>
            <Button type="button" size="sm" onClick={addBlock} className="gap-1 bg-red-600 hover:bg-red-700 text-white text-xs">
              <Plus size={14} /> Add Block
            </Button>
          </div>

          {sortedTimeline.map((block) => {
            const assignedCharIds = block.assigned_character_ids || (block.assigned_character_id ? [block.assigned_character_id] : []);
            const assignedChars = assignedCharIds.map(id => form.characters.find(c => c.id === id)).filter(Boolean);
            const isOpen = expandedBlock === block.id;
            return (
              <div key={block.id} className="border border-white/10 rounded-xl overflow-hidden">
                {/* Block header */}
                <button
                  type="button"
                  onClick={() => setExpandedBlock(isOpen ? null : block.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/8 transition-colors text-left"
                >
                  <span className="text-white text-xs font-mono w-6 flex-shrink-0">
                    {String(block.order).padStart(2, '0')}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded border flex-shrink-0 ${BLOCK_TYPE_COLORS[block.block_type] || 'bg-white/10 text-white border-white/10'}`}>
                    {BLOCK_TYPES.find(t => t.value === block.block_type)?.label || block.block_type}
                  </span>
                  <span className="text-white text-sm flex-1 truncate">{block.title || 'Untitled block'}</span>
                  {assignedChars.length > 0 && (
                    <span className="text-white text-xs truncate max-w-[100px] flex-shrink-0">{assignedChars.map(c => c.name).join(', ')}</span>
                  )}
                  {isOpen ? <ChevronUp size={16} className="text-white flex-shrink-0" /> : <ChevronDown size={16} className="text-white flex-shrink-0" />}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-3 space-y-3 bg-black/30">
                    {/* Order + Title row */}
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-white text-xs mb-1 block">#</label>
                        <Input
                          type="number"
                          value={block.order}
                          onChange={e => updateBlock(block.id, { order: parseInt(e.target.value) || 1 })}
                          className="bg-white/5 border-white/10 text-white text-sm"
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="text-white text-xs mb-1 block">Title</label>
                        <Input
                          value={block.title}
                          onChange={e => updateBlock(block.id, { title: e.target.value })}
                          placeholder="e.g. Laura discovers the door"
                          className="bg-white/5 border-white/10 text-white text-sm"
                        />
                      </div>
                    </div>

                    {/* Block type */}
                    <div>
                      <label className="text-white text-xs mb-1 block">Block Type</label>
                      <Select value={block.block_type} onValueChange={v => updateBlock(block.id, { block_type: v })}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BLOCK_TYPES.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="text-white text-xs mb-1 block">Short Description</label>
                      <Input
                        value={block.description}
                        onChange={e => updateBlock(block.id, { description: e.target.value })}
                        placeholder="e.g. Moon crater / secret door"
                        className="bg-white/5 border-white/10 text-white text-sm"
                      />
                    </div>

                    {/* Assigned characters (multi-select) */}
                    <div>
                      <label className="text-white text-xs mb-1 block">Assigned Characters (optional)</label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {(block.assigned_character_ids || (block.assigned_character_id ? [block.assigned_character_id] : [])).map(cid => {
                          const c = form.characters.find(ch => ch.id === cid);
                          if (!c) return null;
                          return (
                            <span key={cid} className="flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-full pl-1.5 pr-2 py-0.5">
                              {c.photo_url && <img src={c.photo_url} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />}
                              <span className="text-white text-xs">{c.name || 'Unnamed'}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const current = block.assigned_character_ids || (block.assigned_character_id ? [block.assigned_character_id] : []);
                                  updateBlock(block.id, { assigned_character_ids: current.filter(id => id !== cid), assigned_character_id: '' });
                                }}
                                className="text-white hover:text-red-400 ml-0.5 leading-none"
                              >×</button>
                            </span>
                          );
                        })}
                      </div>
                      <Select
                        value="__add__"
                        onValueChange={v => {
                          if (v === '__add__') return;
                          const current = block.assigned_character_ids || (block.assigned_character_id ? [block.assigned_character_id] : []);
                          if (!current.includes(v)) {
                            updateBlock(block.id, { assigned_character_ids: [...current, v], assigned_character_id: v });
                          }
                        }}
                      >
                        <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm">
                          <SelectValue placeholder="+ Add character…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__add__">+ Add character…</SelectItem>
                          {form.characters.filter(c => {
                            const current = block.assigned_character_ids || (block.assigned_character_id ? [block.assigned_character_id] : []);
                            return !current.includes(c.id);
                          }).map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name || 'Unnamed character'}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Dialogue */}
                    <div>
                      <label className="text-white text-xs mb-1 block">Dialogue (optional)</label>
                      <Textarea
                        value={block.dialogue}
                        onChange={e => updateBlock(block.id, { dialogue: e.target.value })}
                        className="bg-white/5 border-white/10 text-white text-sm min-h-16"
                        placeholder="Character line(s) for this block"
                      />
                    </div>

                    {/* Production instructions */}
                    <div>
                      <label className="text-white text-xs mb-1 block">Production Instructions</label>
                      <Textarea
                        value={block.production_instructions}
                        onChange={e => updateBlock(block.id, { production_instructions: e.target.value })}
                        className="bg-white/5 border-white/10 text-white text-sm min-h-20"
                        placeholder="Step-by-step instructions for this block"
                      />
                    </div>

                    {/* Reference media */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-white text-xs">Reference Media <span className="text-yellow-400/70">(visible in Studio)</span></label>
                        <label className="cursor-pointer text-white hover:text-white text-xs flex items-center gap-1">
                          <input type="file" accept="image/*,video/*" className="hidden" onChange={e => e.target.files[0] && uploadBlockMedia(block.id, e.target.files[0])} />
                          <Upload size={12} /> Upload
                        </label>
                      </div>
                      {(block.reference_media || []).length === 0 && (
                        <p className="text-white/20 text-xs mb-2">No reference media uploaded yet</p>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        {(block.reference_media || []).map((url, i) => (
                          <div key={i} className="relative w-16 h-16 rounded overflow-hidden bg-white/10 flex-shrink-0 border border-white/20">
                            {url.includes('video') || url.includes('mp4') || url.includes('webm') ? (
                              <video src={url} className="w-full h-full object-cover" />
                            ) : (
                              <ProxiedImage src={url} className="w-full h-full" />
                            )}
                            <button
                              type="button"
                              onClick={() => removeBlockMedia(block.id, i)}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full flex items-center justify-center text-white z-10"
                            >
                              <Trash2 size={8} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Karaoke guide video — Musical episodes only */}
                    {isMusical && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-white text-xs">🎤 Karaoke Guide Video <span className="text-yellow-400/70">(lyrics + music, for dubbing)</span></label>
                          <label className="cursor-pointer text-white hover:text-white text-xs flex items-center gap-1">
                            <input type="file" accept="video/*" className="hidden" onChange={async e => {
                              if (!e.target.files[0]) return;
                              setUploading(true);
                              const { file_url } = await base44.integrations.Core.UploadFile({ file: e.target.files[0] });
                              updateBlock(block.id, { karaoke_guide_url: file_url });
                              setUploading(false);
                            }} />
                            <Upload size={12} /> Upload
                          </label>
                        </div>
                        {block.karaoke_guide_url ? (
                          <div className="flex items-center gap-2 p-2 bg-white/5 border border-white/10 rounded">
                            <span className="text-yellow-400 text-xs">🎤</span>
                            <span className="text-white text-xs flex-1 truncate">{block.karaoke_guide_url.split('/').pop()}</span>
                            <button type="button" onClick={() => updateBlock(block.id, { karaoke_guide_url: '' })} className="text-white hover:text-red-400">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ) : (
                          <p className="text-white/20 text-xs">No karaoke guide yet</p>
                        )}
                      </div>
                    )}

                    {/* Instrumental track — Musical episodes only */}
                    {isMusical && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-white text-xs">🎵 Instrumental Track <span className="text-yellow-400/70">(Musical)</span></label>
                          <label className="cursor-pointer text-white hover:text-white text-xs flex items-center gap-1">
                            <input type="file" accept="audio/*" className="hidden" onChange={e => e.target.files[0] && uploadInstrumentalTrack(block.id, e.target.files[0])} />
                            <Upload size={12} /> Upload
                          </label>
                        </div>
                        {block.instrumental_track_url ? (
                          <div className="flex items-center gap-2 p-2 bg-white/5 border border-white/10 rounded">
                            <span className="text-yellow-400 text-xs">🎵</span>
                            <span className="text-white text-xs flex-1 truncate">{block.instrumental_track_url.split('/').pop()}</span>
                            <button type="button" onClick={() => updateBlock(block.id, { instrumental_track_url: '' })} className="text-white hover:text-red-400">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ) : (
                          <p className="text-white/20 text-xs">No instrumental track yet</p>
                        )}
                      </div>
                    )}

                    <div className="flex justify-end pt-1">
                      <button type="button" onClick={() => removeBlock(block.id)} className="text-red-400/60 hover:text-red-400 text-xs flex items-center gap-1">
                        <Trash2 size={12} /> Remove block
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {form.timeline.length === 0 && (
            <p className="text-white/20 text-sm text-center py-6">No timeline blocks yet. Add the first block above.</p>
          )}
        </div>
      )}

      {/* ── CHARACTERS TAB ───────────────────────────────────────────── */}
      {activeTab === 'characters' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-white text-xs tracking-widest uppercase">Characters</p>
            <Button type="button" size="sm" onClick={addChar} className="gap-1 bg-red-600 hover:bg-red-700 text-white text-xs">
              <Plus size={14} /> Add
            </Button>
          </div>

          {form.characters.map((char) => {
            const isOpen = expandedChar === char.id;
            return (
              <div key={char.id} className="border border-white/10 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedChar(isOpen ? null : char.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/8 transition-colors"
                >
                  {char.photo_url
                    ? <ProxiedImage src={char.photo_url} className="w-8 h-8 flex-shrink-0" style={{ borderRadius: '9999px' }} />
                    : <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0" />
                  }
                  <span className="text-white text-sm flex-1 text-left">{char.name || 'New character'}</span>
                  {isOpen ? <ChevronUp size={16} className="text-white" /> : <ChevronDown size={16} className="text-white" />}
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-3 space-y-4 bg-black/30">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-white text-xs mb-1 block">Name</label>
                        <Input value={char.name} onChange={e => updateChar(char.id, { name: e.target.value })}
                          className="bg-white/5 border-white/10 text-white text-sm" />
                      </div>
                      <div>
                        <label className="text-white text-xs mb-1 block">Photo</label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && uploadCharPhoto(char.id, e.target.files[0])} />
                          <span className="flex items-center gap-1 px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-xs hover:bg-white/10">
                            <Upload size={12} /> Upload
                          </span>
                          {char.photo_url && <ProxiedImage src={char.photo_url} className="w-8 h-8" style={{ borderRadius: '9999px' }} />}
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="text-white text-xs mb-1 block">Character Type</label>
                      <Select value={char.character_type || ''} onValueChange={v => updateChar(char.id, { character_type: v })}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm">
                          <SelectValue placeholder="Type..." />
                        </SelectTrigger>
                        <SelectContent>
                          {CHARACTER_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-white text-xs mb-1 block">Short Description</label>
                      <Input value={char.description} onChange={e => updateChar(char.id, { description: e.target.value })}
                        className="bg-white/5 border-white/10 text-white text-sm" />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-white text-xs">Reference Images</label>
                        <label className="cursor-pointer text-white hover:text-white text-xs flex items-center gap-1">
                          <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && uploadCharRefImage(char.id, e.target.files[0])} />
                          <Upload size={12} /> Upload
                        </label>
                      </div>
                      <div className="flex gap-3 flex-wrap">
                       {(char.reference_images || []).map((ref, i) => {
                         const refObj = typeof ref === 'string' ? { url: ref, block_id: '' } : ref;
                         return (
                           <div key={i} className="relative rounded overflow-hidden bg-white/10 flex-shrink-0" style={{ width: '80px', height: '142px' }}>
                             <ProxiedImage src={refObj.url} className="w-full h-full" style={{ objectFit: 'cover' }} />
                             <button
                               type="button"
                               onClick={() => updateChar(char.id, { reference_images: char.reference_images.filter((_, j) => j !== i) })}
                               className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full flex items-center justify-center text-white z-10"
                             >
                               <Trash2 size={8} />
                             </button>
                           </div>
                         );
                       })}
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button type="button" onClick={() => removeChar(char.id)} className="text-red-400/60 hover:text-red-400 text-xs flex items-center gap-1">
                        <Trash2 size={12} /> Remove character
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {form.characters.length === 0 && (
            <p className="text-white/20 text-sm text-center py-6">No characters yet.</p>
          )}
        </div>
      )}

      {/* ── PARTICIPANTS TAB ─────────────────────────────────────────── */}
      {activeTab === 'participants' && (
        <AdminEpisodeParticipants episodePage={episodePage} production={form} />
      )}

      {/* Save — hide on participants tab */}
      <Button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); saveMutation.mutate(form); }}
        disabled={saveMutation.isPending || uploading}
        style={{ display: activeTab === 'participants' ? 'none' : undefined }}
        className="w-full bg-white text-black hover:bg-white/90 font-light tracking-wide"
      >
        {saveMutation.isPending ? 'Saving...' : 'Save Production'}
      </Button>
      {saveMutation.isSuccess && <p className="text-green-400 text-xs text-center">✓ Saved</p>}
      {saveMutation.isError && <p className="text-red-400 text-xs text-center">Error: {saveMutation.error?.message}</p>}
    </div>
  );
}