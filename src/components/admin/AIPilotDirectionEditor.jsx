import React from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CONTROL_CLASS = 'bg-black/20 border-white/15 text-white placeholder:text-white/25 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[var(--studio-accent)]';
const SELECT_TRIGGER_CLASS = 'bg-black/20 border-white/15 text-white focus:ring-0 focus:ring-offset-0 focus:border-[var(--studio-accent)]';
const PRIMARY_BUTTON_CLASS = 'bg-[var(--studio-accent)] text-[#071211] border border-[var(--studio-accent)] hover:bg-[var(--studio-accent-hover)] hover:border-[var(--studio-accent-hover)]';
const SECONDARY_BUTTON_CLASS = 'bg-white/[0.04] text-white border border-white/15 hover:bg-white/[0.08] hover:border-white/25';

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
  if (!block) return <div className="h-full min-h-80 flex items-center justify-center text-sm text-white/35">Select a direction block.</div>;

  const content = block.content || {};
  const locations = normalizeEntries(content.locations, 'location');
  const sets = normalizeEntries(content.sets, 'set');

  const updateContent = (key, value) => setBlock({ ...block, content: { ...content, [key]: value } });
  const updateLocation = (id, patch) => updateContent('locations', locations.map((item) => item.id === id ? { ...item, ...patch } : item));
  const updateSet = (id, patch) => updateContent('sets', sets.map((item) => item.id === id ? { ...item, ...patch } : item));
  const removeLocation = (id) => {
    updateContent('locations', locations.filter((item) => item.id !== id));
    setBlock({ ...block, content: { ...content, locations: locations.filter((item) => item.id !== id), sets: sets.map((item) => item.location_id === id ? { ...item, location_id: '' } : item) } });
  };

  const textField = (key, label, rows = 4, full = false) => (
    <label className={`space-y-2 ${full ? 'md:col-span-2' : ''}`}>
      <span className="text-xs text-white/55">{label}</span>
      <Textarea className={CONTROL_CLASS} rows={rows} disabled={readOnly} value={content[key] || ''} onChange={(event) => updateContent(key, event.target.value)} />
    </label>
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
            <div className="flex items-center justify-between gap-3"><div><div className="text-sm text-white">Locations</div><div className="text-xs text-white/35 mt-1">One precise production location per entry.</div></div>{!readOnly && <Button size="sm" className={SECONDARY_BUTTON_CLASS} onClick={() => updateContent('locations', [...locations, { id: makeId('location'), name: '', description: '' }])}><Plus size={14} /> Add Location</Button>}</div>
            {!locations.length && <div className="text-sm text-white/30 py-2">No locations yet.</div>}
            {locations.map((location) => (
              <div key={location.id} className="border border-white/10 p-3 space-y-3 bg-black/20">
                <div className="flex gap-2"><Input className={CONTROL_CLASS} disabled={readOnly} placeholder="Location name" value={location.name || ''} onChange={(event) => updateLocation(location.id, { name: event.target.value })} />{!readOnly && <Button size="icon" className={SECONDARY_BUTTON_CLASS} onClick={() => removeLocation(location.id)} title="Remove location"><Trash2 size={14} /></Button>}</div>
                <Textarea className={CONTROL_CLASS} rows={5} disabled={readOnly} placeholder="Precise description of this location for production and AI generation" value={location.description || ''} onChange={(event) => updateLocation(location.id, { description: event.target.value })} />
              </div>
            ))}
          </section>

          <section className="border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between gap-3"><div><div className="text-sm text-white">Sets</div><div className="text-xs text-white/35 mt-1">Each set is separate and can be linked to a Location.</div></div>{!readOnly && <Button size="sm" className={SECONDARY_BUTTON_CLASS} onClick={() => updateContent('sets', [...sets, { id: makeId('set'), name: '', location_id: '', description: '' }])}><Plus size={14} /> Add Set</Button>}</div>
            {!sets.length && <div className="text-sm text-white/30 py-2">No sets yet.</div>}
            {sets.map((set) => (
              <div key={set.id} className="border border-white/10 p-3 space-y-3 bg-black/20">
                <div className="grid md:grid-cols-[1fr_1fr_auto] gap-2">
                  <Input className={CONTROL_CLASS} disabled={readOnly} placeholder="Set name" value={set.name || ''} onChange={(event) => updateSet(set.id, { name: event.target.value })} />
                  <Select disabled={readOnly || !locations.length} value={set.location_id || 'none'} onValueChange={(value) => updateSet(set.id, { location_id: value === 'none' ? '' : value })}><SelectTrigger className={SELECT_TRIGGER_CLASS}><SelectValue placeholder="Associated location" /></SelectTrigger><SelectContent><SelectItem value="none">No location</SelectItem>{locations.map((location) => <SelectItem key={location.id} value={location.id}>{location.name || 'Unnamed location'}</SelectItem>)}</SelectContent></Select>
                  {!readOnly && <Button size="icon" className={SECONDARY_BUTTON_CLASS} onClick={() => updateContent('sets', sets.filter((item) => item.id !== set.id))} title="Remove set"><Trash2 size={14} /></Button>}
                </div>
                <Textarea className={CONTROL_CLASS} rows={5} disabled={readOnly} placeholder="Precise description of this set for production and AI generation" value={set.description || ''} onChange={(event) => updateSet(set.id, { description: event.target.value })} />
              </div>
            ))}
          </section>

          <div className="grid md:grid-cols-2 gap-4">
            {textField('what_to_avoid', 'What to Avoid', 5, true)}
            {textField('music', 'Music', 4, true)}
          </div>
        </div>
      ) : (
        <label className="space-y-2 block"><span className="text-xs text-white/55">Direction</span><Textarea className={CONTROL_CLASS} rows={18} disabled={readOnly} value={content.text || ''} onChange={(event) => updateContent('text', event.target.value)} /></label>
      )}

      {!readOnly && <div className="flex justify-end"><Button className={PRIMARY_BUTTON_CLASS} onClick={onSave} disabled={saving}><Save size={15} className="mr-2" /> {saving ? 'Saving…' : 'Save Direction'}</Button></div>}
    </div>
  );
}
