import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Save, Trash2 } from 'lucide-react';
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

export default function AIPilotDirectionEditor({ block, setBlock, readOnly, onSave, saving }) {
  const [expandedLocationId, setExpandedLocationId] = useState(null);
  const [expandedSetId, setExpandedSetId] = useState(null);
  const [expandedLookId, setExpandedLookId] = useState(null);

  if (!block) return <div className="h-full min-h-80 flex items-center justify-center text-sm text-white/35">Select a direction block.</div>;

  const content = block.content || {};
  const locations = normalizeEntries(content.locations, 'location');
  const sets = normalizeEntries(content.sets, 'set');
  const looks = Array.isArray(content.looks) ? content.looks.map((item, index) => ({ id: item?.id || `look-${index + 1}`, ...item })) : [];

  const updateContent = (key, value) => setBlock({ ...block, content: { ...content, [key]: value } });
  const updateLocation = (id, patch) => updateContent('locations', locations.map((item) => item.id === id ? { ...item, ...patch } : item));
  const updateSet = (id, patch) => updateContent('sets', sets.map((item) => item.id === id ? { ...item, ...patch } : item));
  const updateLook = (id, patch) => updateContent('looks', looks.map((item) => item.id === id ? { ...item, ...patch } : item));

  const addLocation = () => {
    const id = makeId('location');
    updateContent('locations', [...locations, { id, name: '', description: '' }]);
    setExpandedLocationId(id);
  };

  const addSet = () => {
    const id = makeId('set');
    updateContent('sets', [...sets, { id, name: '', location_id: '', description: '' }]);
    setExpandedSetId(id);
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
      garment_details: '',
      costume: '',
      shoes: '',
      accessories: '',
      makeup: '',
      hair: '',
    }]);
    setExpandedLookId(id);
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
    <div className="space-y-5">
      <div className="grid md:grid-cols-2 gap-4">
        {textField('music_style', 'Music Style', 4, false, 'Genre, period, sonic identity and overall musical language.')}
        {textField('mood', 'Mood', 4, false, 'Emotional atmosphere, tension, warmth, darkness, energy or restraint.')}
        {textField('tempo', 'Tempo', 4, false, 'Tempo range, pulse, rhythmic feel and when tempo should change.')}
        {textField('instrumentation', 'Instrumentation', 4, false, 'Core instruments, textures, electronic or acoustic palette and featured sounds.')}
        {textField('music_role', 'Music Role', 4, false, 'How music should support story, characters, transitions, tension and emotional beats.')}
        {textField('references', 'References', 4, false, 'Musical references, eras, composers, genres or descriptive reference points.')}
        {textField('music_notes', 'Music Notes', 6, true, 'Additional recurring rules, motifs, restrictions, continuity notes or production guidance.')}
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
              {!readOnly && <Button size="sm" className={SECONDARY_BUTTON_CLASS} onClick={addSet}><Plus size={14} /> Add Set</Button>}
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
                        <Textarea className={CONTROL_CLASS} rows={4} disabled={readOnly} placeholder="Precise description of this set for production and AI generation" value={set.description || ''} onChange={(event) => updateSet(set.id, { description: event.target.value })} />
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

      {!readOnly && <div className="flex justify-end"><Button className={PRIMARY_BUTTON_CLASS} onClick={onSave} disabled={saving}><Save size={15} className="mr-2" /> {saving ? 'Saving…' : 'Save Direction'}</Button></div>}
    </div>
  );
}