import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import { supabase } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CONTROL_CLASS = 'bg-black/20 border-white/15 text-white placeholder:text-white/25 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[var(--studio-accent)]';
const SELECT_TRIGGER_CLASS = 'bg-black/20 border-white/15 text-white focus:ring-0 focus:ring-offset-0 focus:border-[var(--studio-accent)]';
const PRIMARY_BUTTON_CLASS = 'bg-[var(--studio-accent)] text-[#071211] border border-[var(--studio-accent)] hover:bg-[var(--studio-accent-hover)] hover:border-[var(--studio-accent-hover)]';
const SECONDARY_BUTTON_CLASS = 'bg-white/[0.04] text-white border border-white/15 hover:bg-white/[0.08] hover:border-white/25';
const REMOVE_BUTTON_CLASS = 'h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-md bg-transparent border-0 p-0 cursor-pointer hover:bg-white/[0.06]';

const LOOK_TYPES = [
  ['full_look', 'Full Look'],
  ['dress', 'Dress'],
  ['suit', 'Suit'],
  ['top', 'Top'],
  ['bottom', 'Bottom'],
  ['outerwear', 'Outerwear'],
  ['shoes', 'Shoes'],
  ['accessories', 'Accessories'],
  ['makeup', 'Makeup'],
  ['hair', 'Hair'],
];

const LOOK_TYPE_LABELS = Object.fromEntries(LOOK_TYPES);

const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeEntries = (value, prefix) => {
  if (Array.isArray(value)) return value.map((item, index) => ({ id: item?.id || `${prefix}-${index + 1}`, ...item }));
  const legacy = String(value || '').trim();
  if (!legacy) return [];
  const lines = legacy.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > 1) return lines.map((line, index) => ({ id: `${prefix}-legacy-${index + 1}`, name: line, description: '' }));
  return [{ id: `${prefix}-legacy-1`, name: '', description: legacy }];
};

const lookDetailConfig = {
  dress: {
    label: 'Dress Details',
    placeholder: 'Silhouette, length, sleeves, neckline, closure, construction, embellishments and precise garment details.',
  },
  suit: {
    label: 'Suit Details',
    placeholder: 'Jacket cut, lapels, shoulders, trousers or skirt, fit, construction, buttons and precise tailoring details.',
  },
  top: {
    label: 'Top Details',
    placeholder: 'Garment type, cut, neckline, sleeves, fit, construction and precise details.',
  },
  bottom: {
    label: 'Bottom Details',
    placeholder: 'Garment type, waist, length, cut, fit, construction and precise details.',
  },
  outerwear: {
    label: 'Outerwear Details',
    placeholder: 'Coat or jacket type, silhouette, length, closure, collar, construction and precise details.',
  },
  shoes: {
    label: 'Shoe Details',
    placeholder: 'Shoe type, shape, heel height, toe, sole, fastening and precise construction details.',
  },
  accessories: {
    label: 'Accessory Details',
    placeholder: 'Accessory type, size, shape, placement, construction and precise details.',
  },
  makeup: {
    label: 'Makeup Details',
    placeholder: 'Eyes, brows, lips, complexion, finish, intensity and precise makeup details.',
  },
  hair: {
    label: 'Hair Details',
    placeholder: 'Length, cut, texture, styling, up/down, parting, finish and precise hair details.',
  },
};

export default function AIPilotDirectionEditor({ block, setBlock, readOnly, onSave, saving, mySets = [] }) {
  const [expandedLocationId, setExpandedLocationId] = useState(null);
  const [expandedSetId, setExpandedSetId] = useState(null);
  const [uploadingSetId, setUploadingSetId] = useState(null);
  const [expandedLookId, setExpandedLookId] = useState(null);
  const [uploadingLookId, setUploadingLookId] = useState(null);
  const [expandedMusicId, setExpandedMusicId] = useState(null);

  if (!block) return <div className="h-full min-h-80 flex items-center justify-center text-sm text-white/35">Select a direction block.</div>;

  const content = block.content || {};
  const locations = normalizeEntries(content.locations, 'location');
  const sets = normalizeEntries(content.sets, 'set');
  const looks = Array.isArray(content.looks) ? content.looks.map((item, index) => ({ id: item?.id || `look-${index + 1}`, ...item })) : [];
  const musicPieces = Array.isArray(content.music_pieces) ? content.music_pieces.map((item, index) => ({ id: item?.id || `music-${index + 1}`, ...item })) : [];

  const updateContent = (key, value) => setBlock({ ...block, content: { ...content, [key]: value } });
  const updateLocation = (id, patch) => updateContent('locations', locations.map((item) => item.id === id ? { ...item, ...patch } : item));
  const updateSet = (id, patch) => updateContent('sets', sets.map((item) => item.id === id ? { ...item, ...patch } : item));
  const updateLook = (id, patch) => updateContent('looks', looks.map((item) => item.id === id ? { ...item, ...patch } : item));
  const updateMusicPiece = (id, patch) => updateContent('music_pieces', musicPieces.map((item) => item.id === id ? { ...item, ...patch } : item));

  const addLocation = () => {
    const id = makeId('location');
    updateContent('locations', [...locations, { id, name: '', description: '' }]);
    setExpandedLocationId(id);
  };

  const addLinkedSet = (mySetId) => {
    const project = mySets.find((item) => item.id === mySetId);
    if (!project || sets.some((set) => set.my_set_id === mySetId)) return;
    const id = makeId('set');
    updateContent('sets', [...sets, {
      id, name: project.name || 'Unnamed set', description: project.description || '',
      location_id: '', reference_images: [], my_set_id: project.id,
    }]);
    setExpandedSetId(id);
  };

  const addSet = () => {
    const id = makeId('set');
    updateContent('sets', [...sets, { id, name: '', location_id: '', description: '', reference_images: [] }]);
    setExpandedSetId(id);
  };

  const handleSetReferenceUpload = async (event, setId) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length || readOnly || uploadingSetId || !block?.version_id) return;
    if (files.some((file) => !file.type?.startsWith('image/'))) {
      alert('Reference photos must be image files.');
      return;
    }
    setUploadingSetId(setId);
    try {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!data?.user?.id) throw new Error('You must be signed in to upload set photos.');
      const images = [];
      for (const file of files) {
        const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'jpg';
        const base = file.name.replace(/\\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'set';
        const path = `${data.user.id}/ai-pilots/${block.version_id}/sets/${setId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${base}.${extension}`;
        const { error: uploadError } = await supabase.storage.from('media').upload(path, file, { cacheControl: '3600', upsert: false });
        if (uploadError) throw uploadError;
        const { data: publicData } = supabase.storage.from('media').getPublicUrl(path);
        if (!publicData?.publicUrl) throw new Error('Unable to create reference image URL.');
        images.push({ url: publicData.publicUrl, name: file.name });
      }
      setBlock((current) => ({
        ...current,
        content: {
          ...(current.content || {}),
          sets: (current.content?.sets || []).map((item) => item.id === setId ? {
            ...item,
            reference_images: [...(Array.isArray(item.reference_images) ? item.reference_images : []), ...images],
          } : item),
        },
      }));
    } catch (error) {
      alert(error?.message || 'Unable to upload set photos');
    } finally {
      setUploadingSetId(null);
    }
  };

  const removeSetReference = (setId, index) => {
    updateContent('sets', sets.map((item) => item.id === setId ? {
      ...item,
      reference_images: (Array.isArray(item.reference_images) ? item.reference_images : []).filter((_, i) => i !== index),
    } : item));
  };

  const uploadLookResults = async (event, lookId) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length || readOnly || uploadingLookId || !block?.version_id) return;
    if (files.some((file) => !file.type?.startsWith('image/'))) {
      alert('Look results must be image files.');
      return;
    }
    setUploadingLookId(lookId);
    try {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!data?.user?.id) throw new Error('You must be signed in to upload look results.');
      const images = [];
      for (const file of files) {
        const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'jpg';
        const base = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'look';
        const path = `${data.user.id}/ai-pilots/${block.version_id}/looks/${lookId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${base}.${extension}`;
        const { error: uploadError } = await supabase.storage.from('media').upload(path, file, { cacheControl: '3600', upsert: false });
        if (uploadError) throw uploadError;
        const { data: publicData } = supabase.storage.from('media').getPublicUrl(path);
        if (!publicData?.publicUrl) throw new Error('Unable to create look image URL.');
        images.push({ url: publicData.publicUrl, name: file.name });
      }
      setBlock((current) => ({
        ...current,
        content: {
          ...(current.content || {}),
          looks: (current.content?.looks || []).map((item) => item.id === lookId ? {
            ...item,
            result_images: [...(Array.isArray(item.result_images) ? item.result_images : []), ...images],
          } : item),
        },
      }));
    } catch (error) {
      alert(error?.message || 'Unable to upload look results');
    } finally {
      setUploadingLookId(null);
    }
  };

  const removeLookResult = (lookId, index) => {
    updateContent('looks', looks.map((item) => item.id === lookId ? {
      ...item,
      result_images: (Array.isArray(item.result_images) ? item.result_images : []).filter((_, i) => i !== index),
    } : item));
  };

  const addLook = () => {
    const id = makeId('look');
    updateContent('looks', [...looks, {
      id,
      name: '',
      type: 'full_look',
      description: '',
      colors: '',
      materials_texture: '',
      style_notes: '',
      can_combine: true,
      combination_notes: '',
      result_images: [],
      garment_details: '',
      costume: '',
      shoes: '',
      accessories: '',
      makeup: '',
      hair: '',
    }]);
    setExpandedLookId(id);
  };

  const addMusicPiece = () => {
    const id = makeId('music');
    updateContent('music_pieces', [...musicPieces, {
      id,
      name: '',
      music_style: '',
      mood: '',
      tempo: '',
      instrumentation: '',
      music_role: '',
      references: '',
      vocal_type: '',
      vocal_style: '',
      lyrics: '',
      language: '',
      structure: '',
      music_notes: '',
    }]);
    setExpandedMusicId(id);
  };

  const removeLocation = (id) => {
    const nextLocations = locations.filter((item) => item.id !== id);
    const nextSets = sets.map((item) => item.location_id === id ? { ...item, location_id: '' } : item);
    setBlock({ ...block, content: { ...content, locations: nextLocations, sets: nextSets } });
    if (expandedLocationId === id) setExpandedLocationId(null);
  };

  const removeSet = (id) => {
    updateContent('sets', sets.filter((item) => item.id !== id));
    if (expandedSetId === id) setExpandedSetId(null);
  };

  const removeLook = (id) => {
    updateContent('looks', looks.filter((item) => item.id !== id));
    if (expandedLookId === id) setExpandedLookId(null);
  };

  const removeMusicPiece = (id) => {
    updateContent('music_pieces', musicPieces.filter((item) => item.id !== id));
    if (expandedMusicId === id) setExpandedMusicId(null);
  };

  const textField = (key, label, rows = 4, full = false, placeholder = '') => (
    <label className={`space-y-2 ${full ? 'md:col-span-2' : ''}`}>
      <span className="text-xs text-white/55">{label}</span>
      <Textarea className={CONTROL_CLASS} rows={rows} disabled={readOnly} placeholder={placeholder} value={content[key] || ''} onChange={(event) => updateContent(key, event.target.value)} />
    </label>
  );

  const storyStructureEditor = (
    <div className="space-y-5">
      <div className="border border-white/10 bg-white/[0.02] p-4">
        <div className="text-sm text-white">Series Story Structure</div>
        <div className="text-xs text-white/40 mt-1">Define the recurring narrative framework of the series. Do not describe a specific episode or its story content.</div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {textField('opening_rules', 'Opening / Setup', 4, false, 'How episodes or chapters should usually begin. Define function and rhythm, not episode content.')}
        {textField('inciting_event_rules', 'Inciting Event', 4, false, 'What kind of narrative disruption should normally launch the story movement.')}
        {textField('escalation_rules', 'Escalation', 4, false, 'How conflict, pressure or stakes should build through the story.')}
        {textField('midpoint_rules', 'Midpoint / Major Turn', 4, false, 'Rules for the central shift, reveal, reversal or change of direction.')}
        {textField('crisis_rules', 'Crisis', 4, false, 'How the story should approach its most difficult or unstable point.')}
        {textField('climax_rules', 'Climax', 4, false, 'What the climax should accomplish and how intense or decisive it should be.')}
        {textField('resolution_rules', 'Resolution / Ending', 4, false, 'How much should be resolved and what should remain open.')}
        {textField('hook_rules', 'Hook / Cliffhanger', 4, false, 'Rules for ending hooks, cliffhangers or forward momentum.')}
        {textField('pacing_rules', 'Pacing Rules', 5, true, 'Define pacing, beat density, transitions, quiet moments and acceleration.')}
        {textField('recurring_structure_rules', 'Recurring Structure Rules', 5, true, 'Any structural rules that should remain consistent across user-created episodes.')}
        {textField('structure_avoid', 'What to Avoid', 5, true, 'Narrative structures, pacing habits or storytelling patterns that do not belong in this series.')}
      </div>
    </div>
  );

  const musicEditor = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-white">Music Pieces <span className="text-white/35">({musicPieces.length})</span></div>
          <div className="text-xs text-white/35 mt-1">Define each reusable music piece independently for this AI Pilot.</div>
        </div>
        {!readOnly && <Button size="sm" className={SECONDARY_BUTTON_CLASS} onClick={addMusicPiece}><Plus size={14} /> Add Music</Button>}
      </div>

      {!musicPieces.length && <div className="text-sm text-white/30 py-2">No music pieces yet.</div>}

      <div className="space-y-2">
        {musicPieces.map((piece) => {
          const expanded = expandedMusicId === piece.id;
          return (
            <div key={piece.id} className="border border-white/10 bg-black/20">
              <div className="flex items-center gap-2 min-h-11 px-2">
                <button type="button" className="flex flex-1 min-w-0 items-center gap-2 text-left py-2" onClick={() => setExpandedMusicId(expanded ? null : piece.id)}>
                  {expanded ? <ChevronDown size={16} className="text-white/50 shrink-0" /> : <ChevronRight size={16} className="text-white/50 shrink-0" />}
                  <span className="text-sm text-white truncate">{piece.name || 'Unnamed music piece'}</span>
                  {!expanded && piece.music_role && <span className="hidden md:block text-xs text-white/30 truncate">{piece.music_role}</span>}
                </button>
                {!readOnly && <button type="button" className={REMOVE_BUTTON_CLASS} onClick={() => removeMusicPiece(piece.id)} title="Remove music piece" aria-label="Remove music piece"><Trash2 size={16} strokeWidth={2} color="#ffffff" /></button>}
              </div>

              {expanded && (
                <div className="border-t border-white/10 p-3 space-y-4">
                  <label className="space-y-2 block">
                    <span className="text-xs text-white/55">Title / Name</span>
                    <Input className={CONTROL_CLASS} disabled={readOnly} placeholder="e.g. Main Theme, Romantic Theme, Tension Cue" value={piece.name || ''} onChange={(event) => updateMusicPiece(piece.id, { name: event.target.value })} />
                  </label>

                  <div className="grid md:grid-cols-2 gap-3">
                    <label className="space-y-2">
                      <span className="text-xs text-white/55">Music Style</span>
                      <Textarea className={CONTROL_CLASS} rows={3} disabled={readOnly} placeholder="Genre, period, sonic identity and musical language." value={piece.music_style || ''} onChange={(event) => updateMusicPiece(piece.id, { music_style: event.target.value })} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs text-white/55">Mood</span>
                      <Textarea className={CONTROL_CLASS} rows={3} disabled={readOnly} placeholder="Emotional atmosphere, tension, warmth, darkness or energy." value={piece.mood || ''} onChange={(event) => updateMusicPiece(piece.id, { mood: event.target.value })} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs text-white/55">Tempo</span>
                      <Textarea className={CONTROL_CLASS} rows={3} disabled={readOnly} placeholder="BPM, tempo range, pulse and rhythmic feel." value={piece.tempo || ''} onChange={(event) => updateMusicPiece(piece.id, { tempo: event.target.value })} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs text-white/55">Instrumentation</span>
                      <Textarea className={CONTROL_CLASS} rows={3} disabled={readOnly} placeholder="Core instruments, textures and sonic palette." value={piece.instrumentation || ''} onChange={(event) => updateMusicPiece(piece.id, { instrumentation: event.target.value })} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs text-white/55">Music Role</span>
                      <Textarea className={CONTROL_CLASS} rows={3} disabled={readOnly} placeholder="Where and why this piece is used in the production." value={piece.music_role || ''} onChange={(event) => updateMusicPiece(piece.id, { music_role: event.target.value })} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs text-white/55">References</span>
                      <Textarea className={CONTROL_CLASS} rows={3} disabled={readOnly} placeholder="Musical references, eras, composers, genres or descriptive reference points." value={piece.references || ''} onChange={(event) => updateMusicPiece(piece.id, { references: event.target.value })} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs text-white/55">Vocal Type</span>
                      <Select disabled={readOnly} value={piece.vocal_type || 'female_lead'} onValueChange={(value) => updateMusicPiece(piece.id, { vocal_type: value })}>
                        <SelectTrigger className={SELECT_TRIGGER_CLASS}><SelectValue placeholder="Select vocal type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="female_lead">Female Lead</SelectItem>
                          <SelectItem value="male_lead">Male Lead</SelectItem>
                          <SelectItem value="duet">Duet</SelectItem>
                          <SelectItem value="group_vocals">Group Vocals</SelectItem>
                          <SelectItem value="choir">Choir</SelectItem>
                          <SelectItem value="instrumental">Instrumental</SelectItem>
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs text-white/55">Language</span>
                      <Input className={CONTROL_CLASS} disabled={readOnly} placeholder="e.g. English, French" value={piece.language || ''} onChange={(event) => updateMusicPiece(piece.id, { language: event.target.value })} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs text-white/55">Structure</span>
                      <Input className={CONTROL_CLASS} disabled={readOnly} placeholder="e.g. Intro → Verse → Chorus → Bridge → Outro" value={piece.structure || ''} onChange={(event) => updateMusicPiece(piece.id, { structure: event.target.value })} />
                    </label>
                  </div>

                  <label className="space-y-2 block">
                    <span className="text-xs text-white/55">Vocal Style</span>
                    <Textarea className={CONTROL_CLASS} rows={4} disabled={readOnly || piece.vocal_type === 'instrumental'} placeholder="Voice character and performance: tone, delivery, intensity, range, attitude and chorus treatment." value={piece.vocal_style || ''} onChange={(event) => updateMusicPiece(piece.id, { vocal_style: event.target.value })} />
                  </label>

                  <label className="space-y-2 block">
                    <span className="text-xs text-white/55">Lyrics</span>
                    <Textarea className={CONTROL_CLASS} rows={8} disabled={readOnly || piece.vocal_type === 'instrumental'} placeholder="Production-provided lyrics for this music piece." value={piece.lyrics || ''} onChange={(event) => updateMusicPiece(piece.id, { lyrics: event.target.value })} />
                  </label>

                  <label className="space-y-2 block">
                    <span className="text-xs text-white/55">Music Notes</span>
                    <Textarea className={CONTROL_CLASS} rows={4} disabled={readOnly} placeholder="Additional rules, motifs, restrictions, continuity notes or production guidance for this piece." value={piece.music_notes || ''} onChange={(event) => updateMusicPiece(piece.id, { music_notes: event.target.value })} />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const looksEditor = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-white">Looks <span className="text-white/35">({looks.length})</span></div>
          <div className="text-xs text-white/35 mt-1">Reusable styling elements that can be used alone or combined inside this AI Pilot.</div>
        </div>
        {!readOnly && <Button size="sm" className={SECONDARY_BUTTON_CLASS} onClick={addLook}><Plus size={14} /> Add Look</Button>}
      </div>

      {!looks.length && <div className="text-sm text-white/30 py-2">No looks yet.</div>}

      <div className="space-y-2">
        {looks.map((look) => {
          const expanded = expandedLookId === look.id;
          const type = look.type || 'full_look';
          const typeLabel = LOOK_TYPE_LABELS[type] || 'Full Look';
          const detailConfig = lookDetailConfig[type];
          return (
            <div key={look.id} className="border border-white/10 bg-black/20">
              <div className="flex items-center gap-2 min-h-11 px-2">
                <button type="button" className="flex flex-1 min-w-0 items-center gap-2 text-left py-2" onClick={() => setExpandedLookId(expanded ? null : look.id)}>
                  {expanded ? <ChevronDown size={16} className="text-white/50 shrink-0" /> : <ChevronRight size={16} className="text-white/50 shrink-0" />}
                  <span className="text-sm text-white truncate">{look.name || 'Unnamed look'}</span>
                  <span className="text-xs text-white/35 shrink-0">{typeLabel}</span>
                </button>
                {!readOnly && <button type="button" className={REMOVE_BUTTON_CLASS} onClick={() => removeLook(look.id)} title="Remove look" aria-label="Remove look"><Trash2 size={16} strokeWidth={2} color="#ffffff" /></button>}
              </div>

              {expanded && (
                <div className="border-t border-white/10 p-3 space-y-4">
                  <div className="grid md:grid-cols-2 gap-3">
                    <label className="space-y-2">
                      <span className="text-xs text-white/55">Look Name</span>
                      <Input className={CONTROL_CLASS} disabled={readOnly} placeholder="e.g. Black Crystal Dress, Red Heels, Smoky Eye" value={look.name || ''} onChange={(event) => updateLook(look.id, { name: event.target.value })} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs text-white/55">Type</span>
                      <Select disabled={readOnly} value={type} onValueChange={(value) => updateLook(look.id, { type: value })}>
                        <SelectTrigger className={SELECT_TRIGGER_CLASS}><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>{LOOK_TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                      </Select>
                    </label>
                  </div>

                  <div className="space-y-3 border border-white/10 bg-white/[0.02] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div><p className="text-sm font-semibold text-white">Look result images</p><p className="mt-1 text-xs text-white/40">Upload images generated from this look's prompts. Keep the text details below.</p></div>
                      {!readOnly && <label className={`inline-flex cursor-pointer items-center gap-2 border border-white/20 px-3 py-2 text-xs text-white ${uploadingLookId ? 'pointer-events-none opacity-50' : ''}`}><Upload size={14}/>{uploadingLookId === look.id ? 'Uploading…' : 'Add Images'}<input type="file" multiple accept="image/*" className="hidden" disabled={Boolean(uploadingLookId)} onChange={(event) => uploadLookResults(event, look.id)}/></label>}
                    </div>
                    {Array.isArray(look.result_images) && look.result_images.length > 0 ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{look.result_images.map((image, index) => {
                      const url = typeof image === 'string' ? image : image?.url;
                      return <div key={index} className="relative overflow-hidden border border-white/10 bg-black/40">{url && <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={look.name || 'Look result'} className="aspect-[3/4] w-full object-cover"/></a>}{!readOnly && <button type="button" onClick={() => removeLookResult(look.id, index)} aria-label="Remove result image" className="absolute right-1 top-1 bg-black/80 p-1.5 text-white"><X size={14}/></button>}</div>;
                    })}</div> : <p className="text-xs text-white/35">No look images added yet.</p>}
                  </div>
                  <label className="space-y-2 block">
                    <span className="text-xs text-white/55">Description</span>
                    <Textarea className={CONTROL_CLASS} rows={4} disabled={readOnly} placeholder="Precise description of this styling element." value={look.description || ''} onChange={(event) => updateLook(look.id, { description: event.target.value })} />
                  </label>

                  <div className="grid md:grid-cols-2 gap-3">
                    <label className="space-y-2">
                      <span className="text-xs text-white/55">Colors</span>
                      <Textarea className={CONTROL_CLASS} rows={3} disabled={readOnly} placeholder="Primary and secondary colors, finishes or color placement." value={look.colors || ''} onChange={(event) => updateLook(look.id, { colors: event.target.value })} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs text-white/55">Materials / Texture</span>
                      <Textarea className={CONTROL_CLASS} rows={3} disabled={readOnly} placeholder="Fabric, leather, metal, crystal, finish, texture or surface qualities." value={look.materials_texture || ''} onChange={(event) => updateLook(look.id, { materials_texture: event.target.value })} />
                    </label>
                  </div>

                  {type === 'full_look' ? (
                    <div className="space-y-4">
                      <label className="space-y-2 block">
                        <span className="text-xs text-white/55">Costume</span>
                        <Textarea className={CONTROL_CLASS} rows={4} disabled={readOnly} placeholder="Clothing and garment details for the complete look." value={look.costume || ''} onChange={(event) => updateLook(look.id, { costume: event.target.value })} />
                      </label>
                      <div className="grid md:grid-cols-2 gap-3">
                        <label className="space-y-2">
                          <span className="text-xs text-white/55">Shoes</span>
                          <Textarea className={CONTROL_CLASS} rows={3} disabled={readOnly} placeholder="Shoes included in this full look." value={look.shoes || ''} onChange={(event) => updateLook(look.id, { shoes: event.target.value })} />
                        </label>
                        <label className="space-y-2">
                          <span className="text-xs text-white/55">Accessories</span>
                          <Textarea className={CONTROL_CLASS} rows={3} disabled={readOnly} placeholder="Accessories included in this full look." value={look.accessories || ''} onChange={(event) => updateLook(look.id, { accessories: event.target.value })} />
                        </label>
                        <label className="space-y-2">
                          <span className="text-xs text-white/55">Makeup</span>
                          <Textarea className={CONTROL_CLASS} rows={3} disabled={readOnly} placeholder="Makeup included in this full look." value={look.makeup || ''} onChange={(event) => updateLook(look.id, { makeup: event.target.value })} />
                        </label>
                        <label className="space-y-2">
                          <span className="text-xs text-white/55">Hair</span>
                          <Textarea className={CONTROL_CLASS} rows={3} disabled={readOnly} placeholder="Hair included in this full look." value={look.hair || ''} onChange={(event) => updateLook(look.id, { hair: event.target.value })} />
                        </label>
                      </div>
                    </div>
                  ) : detailConfig ? (
                    <label className="space-y-2 block">
                      <span className="text-xs text-white/55">{detailConfig.label}</span>
                      <Textarea className={CONTROL_CLASS} rows={5} disabled={readOnly} placeholder={detailConfig.placeholder} value={look.garment_details || ''} onChange={(event) => updateLook(look.id, { garment_details: event.target.value })} />
                    </label>
                  ) : null}

                  <label className="space-y-2 block">
                    <span className="text-xs text-white/55">Style Notes</span>
                    <Textarea className={CONTROL_CLASS} rows={3} disabled={readOnly} placeholder="How this element should be styled or interpreted." value={look.style_notes || ''} onChange={(event) => updateLook(look.id, { style_notes: event.target.value })} />
                  </label>

                  <div className="grid md:grid-cols-2 gap-3">
                    <label className="space-y-2">
                      <span className="text-xs text-white/55">Can be combined with other looks</span>
                      <Select disabled={readOnly} value={look.can_combine === false ? 'no' : 'yes'} onValueChange={(value) => updateLook(look.id, { can_combine: value === 'yes' })}>
                        <SelectTrigger className={SELECT_TRIGGER_CLASS}><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent>
                      </Select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs text-white/55">Combination Notes</span>
                      <Textarea className={CONTROL_CLASS} rows={3} disabled={readOnly || look.can_combine === false} placeholder="Optional guidance for combining this with other look elements." value={look.combination_notes || ''} onChange={(event) => updateLook(look.id, { combination_notes: event.target.value })} />
                    </label>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <div className="text-lg text-white">{block.title}</div>
        <div className="text-xs text-white/40 mt-1">Production direction used by the connected creation tools.</div>
      </div>

      {block.block_key === 'series-direction' ? (
        <div className="space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            {textField('tone', 'Tone')}
            {textField('audience', 'Audience')}
            {textField('rules', 'Rules', 5, true)}
          </div>

          <section className="border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-white">Locations <span className="text-white/35">({locations.length})</span></div>
                <div className="text-xs text-white/35 mt-1">Compact list. Open only the location you want to edit.</div>
              </div>
              {!readOnly && <Button size="sm" className={SECONDARY_BUTTON_CLASS} onClick={addLocation}><Plus size={14} /> Add Location</Button>}
            </div>

            {!locations.length && <div className="text-sm text-white/30 py-2">No locations yet.</div>}
            <div className="space-y-1.5">
              {locations.map((location) => {
                const expanded = expandedLocationId === location.id;
                return (
                  <div key={location.id} className="border border-white/10 bg-black/20">
                    <div className="flex items-center gap-2 min-h-11 px-2">
                      <button type="button" className="flex flex-1 min-w-0 items-center gap-2 text-left py-2" onClick={() => setExpandedLocationId(expanded ? null : location.id)}>
                        {expanded ? <ChevronDown size={16} className="text-white/50 shrink-0" /> : <ChevronRight size={16} className="text-white/50 shrink-0" />}
                        <span className="text-sm text-white truncate">{location.name || 'Unnamed location'}</span>
                        {!expanded && location.description && <span className="hidden md:block text-xs text-white/30 truncate">{location.description}</span>}
                      </button>
                      {!readOnly && <button type="button" className={REMOVE_BUTTON_CLASS} onClick={() => removeLocation(location.id)} title="Remove location" aria-label="Remove location"><Trash2 size={16} strokeWidth={2} color="#ffffff" /></button>}
                    </div>
                    {expanded && (
                      <div className="border-t border-white/10 p-3 space-y-3">
                        <Input className={CONTROL_CLASS} disabled={readOnly} placeholder="Location name" value={location.name || ''} onChange={(event) => updateLocation(location.id, { name: event.target.value })} />
                        <Textarea className={CONTROL_CLASS} rows={4} disabled={readOnly} placeholder="Precise description of this location for production and AI generation" value={location.description || ''} onChange={(event) => updateLocation(location.id, { description: event.target.value })} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-white">Sets <span className="text-white/35">({sets.length})</span></div>
                <div className="text-xs text-white/35 mt-1">Compact list. Open only the set you want to edit.</div>
              </div>
              {!readOnly && <div className="flex flex-wrap gap-2 items-center">
                <select aria-label="Add existing set from My Sets" defaultValue="" onChange={(event) => { addLinkedSet(event.target.value); event.target.value = ''; }}
                  className="h-9 min-w-48 max-w-sm border border-white/20 bg-[#151719] px-2 text-xs text-white">
                  <option value="">Add from My Sets…</option>
                  {mySets.filter((item) => !sets.some((set) => set.my_set_id === item.id)).map((item) =>
                    <option key={item.id} value={item.id}>{item.name || 'Unnamed set'}</option>)}
                </select>
                <Button size="sm" className={SECONDARY_BUTTON_CLASS} onClick={addSet}><Plus size={14} /> Add Set</Button>
              </div>}
            </div>

            {!sets.length && <div className="text-sm text-white/30 py-2">No sets yet.</div>}
            <div className="space-y-1.5">
              {sets.map((set) => {
                const expanded = expandedSetId === set.id;
                const location = locations.find((item) => item.id === set.location_id);
                return (
                  <div key={set.id} className="border border-white/10 bg-black/20">
                    <div className="flex items-center gap-2 min-h-11 px-2">
                      <button type="button" className="flex flex-1 min-w-0 items-center gap-2 text-left py-2" onClick={() => setExpandedSetId(expanded ? null : set.id)}>
                        {expanded ? <ChevronDown size={16} className="text-white/50 shrink-0" /> : <ChevronRight size={16} className="text-white/50 shrink-0" />}
                        <span className="text-sm text-white truncate">{set.name || 'Unnamed set'}</span>
                        <span className="text-xs text-white/35 shrink-0">{location?.name || 'No location'}</span>
                        {!expanded && set.description && <span className="hidden md:block text-xs text-white/30 truncate">{set.description}</span>}
                      </button>
                      {!readOnly && <button type="button" className={REMOVE_BUTTON_CLASS} onClick={() => removeSet(set.id)} title="Remove set" aria-label="Remove set"><Trash2 size={16} strokeWidth={2} color="#ffffff" /></button>}
                    </div>
                    {expanded && (
                      <div className="border-t border-white/10 p-3 space-y-3">
                        <div className="grid md:grid-cols-2 gap-2">
                          <Input className={CONTROL_CLASS} disabled={readOnly} placeholder="Set name" value={set.name || ''} onChange={(event) => updateSet(set.id, { name: event.target.value })} />
                          <Select disabled={readOnly || !locations.length} value={set.location_id || 'none'} onValueChange={(value) => updateSet(set.id, { location_id: value === 'none' ? '' : value })}>
                            <SelectTrigger className={SELECT_TRIGGER_CLASS}><SelectValue placeholder="Associated location" /></SelectTrigger>
                            <SelectContent><SelectItem value="none">No location</SelectItem>{locations.map((item) => <SelectItem key={item.id} value={item.id}>{item.name || 'Unnamed location'}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 border border-white/10 bg-white/[0.02] p-3">
                          <label className="block text-xs text-white/60">Linked Studio Set (My Sets)
                            <select value={set.my_set_id || ''} disabled={readOnly} onChange={(event) => {
                              const project = mySets.find((item) => item.id === event.target.value);
                              updateSet(set.id, { my_set_id: project?.id || '' });
                            }} className="mt-2 block h-9 w-full max-w-lg border border-white/20 bg-[#151719] px-2 text-sm text-white">
                              <option value="">Standalone AI Pilot Set (existing images only)</option>
                              {mySets.map((item) => <option key={item.id} value={item.id}>{item.name || 'Unnamed set'}</option>)}
                            </select>
                          </label>
                          {set.my_set_id && (() => {
                            const linked = mySets.find((item) => item.id === set.my_set_id);
                            if (!linked) return <p className="text-xs text-amber-300">Linked Studio Set is unavailable. Existing AI Pilot photos are retained.</p>;
                            const elements = linked.reference_sheet?.extracted_elements || [];
                            return <div className="space-y-2">
                              <p className="text-xs text-white/60">Linked: {linked.name} · {elements.length} reference elements · {(linked.images || []).filter(Boolean).length} set views. No images are copied.</p>
                              {!!(linked.images || []).filter(Boolean).length && <div className="space-y-1">
                                <p className="text-[11px] font-semibold text-white/60">Camera Views</p>
                                <div className="flex flex-wrap gap-2">{linked.images.map((url, index) => url ? <div key={index} className="w-24 space-y-1">
                                  <img src={url} alt={['Hero', 'Wide', 'Reverse', 'Left', 'Right', 'Detail', 'Day', 'Night'][index] || 'Set view'} className="h-16 w-full border border-white/15 bg-black object-contain" />
                                  <p className="text-[10px] text-white/60">{['Hero', 'Wide', 'Reverse', 'Left', 'Right', 'Detail', 'Day', 'Night'][index] || `View ${index + 1}`}</p>
                                </div> : null)}</div>
                              </div>}
                              {!!elements.length && <div className="flex flex-wrap gap-2">{elements.slice(0, 10).map((item, index) =>
                                <div key={item.id || index} className="w-20 space-y-1"><img src={item.image_url} alt={item.name || 'Set object'} className="h-16 w-full border border-white/15 bg-black object-contain" /><div className="truncate text-[10px] text-white/60">{item.name}</div></div>)}</div>}
                            </div>;
                          })()}
                        </div>
                        <Textarea className={CONTROL_CLASS} rows={4} disabled={readOnly} placeholder="Precise description of this set for production and AI generation" value={set.description || ''} onChange={(event) => updateSet(set.id, { description: event.target.value })} />
                        <div className="space-y-3 border-t border-white/10 pt-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="text-xs text-white/60">Reference Photos</span>
                            {!readOnly && (
                              <label className={`inline-flex min-h-9 items-center gap-2 px-3 text-xs cursor-pointer ${SECONDARY_BUTTON_CLASS} ${uploadingSetId ? 'opacity-50 pointer-events-none' : ''}`}>
                                <Upload size={14} /> {uploadingSetId === set.id ? 'Uploading…' : 'Add Photos'}
                                <input type="file" accept="image/*" multiple className="hidden" disabled={Boolean(uploadingSetId)} onChange={(event) => handleSetReferenceUpload(event, set.id)} />
                              </label>
                            )}
                          </div>
                          {Array.isArray(set.reference_images) && set.reference_images.length > 0 ? (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                              {set.reference_images.map((image, index) => (
                                <div key={image.url || index} className="relative border border-white/10 bg-black/30">
                                  <a href={image.url} target="_blank" rel="noreferrer" title="View reference photo">
                                    <img src={image.url} alt={image.name || `Set reference ${index + 1}`} className="aspect-[4/3] w-full object-cover" />
                                  </a>
                                  {!readOnly && <button type="button" onClick={() => removeSetReference(set.id, index)} className="absolute right-1 top-1 rounded bg-black/80 p-1.5 text-white hover:bg-red-700" aria-label="Remove reference photo"><X size={14} /></button>}
                                </div>
                              ))}
                            </div>
                          ) : <div className="text-xs text-white/30">No reference photos yet.</div>}
                          <p className="text-[11px] text-white/35">Save Direction to save changes to the set.</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid md:grid-cols-2 gap-4">
            {textField('what_to_avoid', 'What to Avoid', 5, true)}
          </div>
        </div>
      ) : block.block_key === 'story-structure' ? storyStructureEditor : block.block_key === 'looks' ? looksEditor : block.block_key === 'music-direction' ? musicEditor : (
        <label className="space-y-2 block"><span className="text-xs text-white/55">Direction</span><Textarea className={CONTROL_CLASS} rows={18} disabled={readOnly} value={content.text || ''} onChange={(event) => updateContent('text', event.target.value)} /></label>
      )}

      {!readOnly && <div className="flex justify-end"><Button className={PRIMARY_BUTTON_CLASS} onClick={onSave} disabled={saving || Boolean(uploadingSetId) || Boolean(uploadingLookId)}><Save size={15} className="mr-2" /> {saving ? 'Saving…' : 'Save Direction'}</Button></div>}
    </div>
  );
}