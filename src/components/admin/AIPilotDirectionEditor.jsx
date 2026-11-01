import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plus, Save, Trash2 } from 'lucide-react';
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

const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeEntries = (value, prefix) => {
  if (Array.isArray(value)) return value.map((item, index) => ({ id: item?.id || `${prefix}-${index + 1}`, ...item }));
  const legacy = String(value || '').trim();
  if (!legacy) return [];
  const lines = legacy.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > 1) return lines.map((line, index) => ({ id: `${prefix}-legacy-${index + 1}`, name: line, description: '' }));
  return [{ id: `${prefix}-legacy-1`, name: '', description: legacy }];
};

export default function AIPilotDirectionEditor({ block, setBlock, readOnly, onSave, saving }) {
  const [expandedLocationId, setExpandedLocationId] = useState(null);
  const [expandedSetId, setExpandedSetId] = useState(null);
  const [expandedLookId, setExpandedLookId] = useState(null);

  const { data: characters = [] } = useQuery({
    queryKey: ['admin-ai-pilot-look-characters', block?.version_id],
    enabled: Boolean(block?.version_id && block?.block_key === 'looks'),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_pilot_characters')
        .select('id, role_name, sort_order, is_active')
        .eq('version_id', block.version_id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('role_name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

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
    if (!characters.length) return;
    const id = makeId('look');
    updateContent('looks', [...looks, { id, character_id: characters[0].id, name: '', costume: '', makeup: '', hair: '' }]);
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

  const looksEditor = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-white">Character Looks <span className="text-white/35">({looks.length})</span></div>
          <div className="text-xs text-white/35 mt-1">Create specific looks for individual characters.</div>
        </div>
        {!readOnly && <Button size="sm" className={SECONDARY_BUTTON_CLASS} onClick={addLook} disabled={!characters.length}><Plus size={14} /> Add Look</Button>}
      </div>

      {!characters.length && <div className="border border-white/10 bg-white/[0.02] p-4 text-sm text-white/40">Create the characters first, then assign looks to them here.</div>}
      {characters.length > 0 && !looks.length && <div className="text-sm text-white/30 py-2">No looks yet.</div>}

      <div className="space-y-2">
        {looks.map((look) => {
          const expanded = expandedLookId === look.id;
          const character = characters.find((item) => item.id === look.character_id);
          return (
            <div key={look.id} className="border border-white/10 bg-black/20">
              <div className="flex items-center gap-2 min-h-11 px-2">
                <button type="button" className="flex flex-1 min-w-0 items-center gap-2 text-left py-2" onClick={() => setExpandedLookId(expanded ? null : look.id)}>
                  {expanded ? <ChevronDown size={16} className="text-white/50 shrink-0" /> : <ChevronRight size={16} className="text-white/50 shrink-0" />}
                  <span className="text-sm text-white truncate">{character?.role_name || 'Select character'}</span>
                  <span className="text-xs text-white/35 truncate">{look.name || 'Unnamed look'}</span>
                </button>
                {!readOnly && <button type="button" className={REMOVE_BUTTON_CLASS} onClick={() => removeLook(look.id)} title="Remove look" aria-label="Remove look"><Trash2 size={16} strokeWidth={2} color="#ffffff" /></button>}
              </div>

              {expanded && (
                <div className="border-t border-white/10 p-3 space-y-4">
                  <div className="grid md:grid-cols-2 gap-3">
                    <label className="space-y-2">
                      <span className="text-xs text-white/55">Character</span>
                      <Select disabled={readOnly} value={look.character_id || ''} onValueChange={(value) => updateLook(look.id, { character_id: value })}>
                        <SelectTrigger className={SELECT_TRIGGER_CLASS}><SelectValue placeholder="Select character" /></SelectTrigger>
                        <SelectContent>{characters.map((item) => <SelectItem key={item.id} value={item.id}>{item.role_name || 'Unnamed character'}</SelectItem>)}</SelectContent>
                      </Select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs text-white/55">Look Name</span>
                      <Input className={CONTROL_CLASS} disabled={readOnly} placeholder="e.g. Arrival, Gala, Runway, Casual" value={look.name || ''} onChange={(event) => updateLook(look.id, { name: event.target.value })} />
                    </label>
                  </div>

                  <label className="space-y-2 block">
                    <span className="text-xs text-white/55">Costume</span>
                    <Textarea className={CONTROL_CLASS} rows={5} disabled={readOnly} placeholder="Exact clothing, colors, materials, accessories and styling for this look." value={look.costume || ''} onChange={(event) => updateLook(look.id, { costume: event.target.value })} />
                  </label>

                  <div className="grid md:grid-cols-2 gap-3">
                    <label className="space-y-2">
                      <span className="text-xs text-white/55">Makeup</span>
                      <Textarea className={CONTROL_CLASS} rows={4} disabled={readOnly} placeholder="Makeup for this specific look." value={look.makeup || ''} onChange={(event) => updateLook(look.id, { makeup: event.target.value })} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs text-white/55">Hair</span>
                      <Textarea className={CONTROL_CLASS} rows={4} disabled={readOnly} placeholder="Hair for this specific look." value={look.hair || ''} onChange={(event) => updateLook(look.id, { hair: event.target.value })} />
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
      ) : block.block_key === 'story-structure' ? storyStructureEditor : block.block_key === 'looks' ? looksEditor : (
        <label className="space-y-2 block"><span className="text-xs text-white/55">Direction</span><Textarea className={CONTROL_CLASS} rows={18} disabled={readOnly} value={content.text || ''} onChange={(event) => updateContent('text', event.target.value)} /></label>
      )}

      {!readOnly && <div className="flex justify-end"><Button className={PRIMARY_BUTTON_CLASS} onClick={onSave} disabled={saving}><Save size={15} className="mr-2" /> {saving ? 'Saving…' : 'Save Direction'}</Button></div>}
    </div>
  );
}
