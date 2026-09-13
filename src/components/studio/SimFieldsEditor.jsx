import React, { useState } from 'react';
import { Plus, X, Target, Zap, Users, Briefcase, Package, BookOpen, Lightbulb, MapPin } from 'lucide-react';

const inputClass = "w-full bg-white rounded-2xl border-2 border-black/10 px-4 py-3 text-black text-sm placeholder-black/40 focus:outline-none focus:border-black/30 font-bold";
const labelClass = "text-black text-xs uppercase tracking-wider font-bold mb-1.5 flex items-center gap-1.5";

function TextListField({ label, icon: Icon, placeholder, items, onChange, hint }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...(items || []), v]);
    setDraft('');
  };
  return (
    <div>
      <label className={labelClass}>{Icon && <Icon size={12} />}{label}</label>
      {hint && <p className="text-black/60 text-xs mb-2">{hint}</p>}
      <div className="space-y-2 mb-2">
        {(items || []).map((item, i) => (
          <div key={i} className="flex items-center gap-2 bg-white rounded-xl border-2 border-black/10 px-3 py-2">
            <span className="flex-1 text-black text-sm font-medium">{item}</span>
            <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="w-6 h-6 bg-black/10 rounded-full flex items-center justify-center active:scale-90">
              <X size={12} className="text-black" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className={inputClass}
        />
        <button onClick={add} className="w-12 bg-black rounded-2xl flex items-center justify-center active:scale-95 flex-shrink-0">
          <Plus size={18} className="text-yellow-400" />
        </button>
      </div>
    </div>
  );
}

function ObjectListField({ label, icon: Icon, items, onChange, fields, addLabel, hint }) {
  const addRow = () => onChange([...(items || []), {}]);
  return (
    <div>
      <label className={labelClass}>{Icon && <Icon size={12} />}{label}</label>
      {hint && <p className="text-black/60 text-xs mb-2">{hint}</p>}
      <div className="space-y-2 mb-2">
        {(items || []).map((item, i) => (
          <div key={i} className="bg-white rounded-xl border-2 border-black/10 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-black/50 text-[10px] font-bold uppercase">#{i + 1}</span>
              <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="w-6 h-6 bg-black/10 rounded-full flex items-center justify-center active:scale-90">
                <X size={12} className="text-black" />
              </button>
            </div>
            {fields.map(f => (
              <div key={f.key}>
                {f.label && <p className="text-black/60 text-[10px] font-bold mb-1 uppercase">{f.label}</p>}
                {f.type === 'select' ? (
                  <select
                    value={item[f.key] || ''}
                    onChange={e => onChange(items.map((it, idx) => idx === i ? { ...it, [f.key]: e.target.value } : it))}
                    className={inputClass}
                  >
                    <option value="">Select…</option>
                    {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : f.type === 'number' ? (
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={item[f.key] ?? ''}
                    onChange={e => onChange(items.map((it, idx) => idx === i ? { ...it, [f.key]: parseFloat(e.target.value) || 0 } : it))}
                    className={inputClass}
                  />
                ) : (
                  <input
                    value={item[f.key] || ''}
                    onChange={e => onChange(items.map((it, idx) => idx === i ? { ...it, [f.key]: e.target.value } : it))}
                    placeholder={f.placeholder}
                    className={inputClass}
                  />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <button onClick={addRow} className="w-full py-2 bg-black/10 text-black rounded-2xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 border-2 border-dashed border-black/20">
        <Plus size={14} /> {addLabel}
      </button>
    </div>
  );
}

export default function SimFieldsEditor({ form, set, characters, sets }) {
  const linkedCharIds = (characters || []).filter(c => c.is_active !== false).map(c => ({ value: c.id, label: c.name }));
  const setOptions = (sets || []).map(s => ({ value: s.id, label: s.name }));

  return (
    <div className="space-y-5">
      {/* Section divider */}
      <div className="flex items-center gap-2 pt-2">
        <div className="h-px bg-black/20 flex-1" />
        <p className="text-black/60 text-[10px] font-bold uppercase tracking-wider">Simulation Init</p>
        <div className="h-px bg-black/20 flex-1" />
      </div>

      {/* Starting set */}
      <div>
        <label className={labelClass}><MapPin size={12} />Starting Set</label>
        <p className="text-black/60 text-xs mb-2">Where this character begins in the simulation world.</p>
        <select
          value={form.sim_starting_story_set_id || ''}
          onChange={e => set('sim_starting_story_set_id', e.target.value || null)}
          className={inputClass}
        >
          <option value="">No starting set</option>
          {setOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <TextListField
        label="Goals"
        icon={Target}
        placeholder="e.g. Recover the stolen ledger"
        items={form.sim_goals}
        onChange={v => set('sim_goals', v)}
        hint="What this character wants to achieve."
      />

      <TextListField
        label="Immediate Needs"
        icon={Zap}
        placeholder="e.g. Pay debt by sundown"
        items={form.sim_immediate_needs}
        onChange={v => set('sim_immediate_needs', v)}
        hint="Pressures pressing right now."
      />

      <TextListField
        label="Responsibilities"
        icon={Briefcase}
        placeholder="e.g. Guard the market gate"
        items={form.sim_responsibilities}
        onChange={v => set('sim_responsibilities', v)}
        hint="Duties / role obligations."
      />

      <TextListField
        label="Starting Knowledge"
        icon={BookOpen}
        placeholder="e.g. Knows the ledger is hidden in the granary"
        items={form.sim_starting_knowledge}
        onChange={v => set('sim_starting_knowledge', v)}
        hint="Private facts this character holds from the start."
      />

      <ObjectListField
        label="Controlled Assets"
        icon={Package}
        items={form.sim_controlled_assets}
        onChange={v => set('sim_controlled_assets', v)}
        addLabel="Add Asset"
        fields={[
          { key: 'name', placeholder: 'Asset name (e.g. Grain Ledger)', label: 'Name' },
          { key: 'description', placeholder: 'What it is', label: 'Description' },
        ]}
      />

      <ObjectListField
        label="Relationships"
        icon={Users}
        items={form.sim_relationships}
        onChange={v => set('sim_relationships', v)}
        addLabel="Add Relationship"
        hint="Links to other characters in the pack."
        fields={[
          { key: 'character_id', type: 'select', label: 'Character', options: linkedCharIds },
          { key: 'relationship_type', placeholder: 'e.g. ally, rival, creditor', label: 'Type' },
          { key: 'description', placeholder: 'Nature of the relationship', label: 'Description' },
        ]}
      />

      <ObjectListField
        label="Starting Beliefs"
        icon={Lightbulb}
        items={form.sim_starting_beliefs}
        onChange={v => set('sim_starting_beliefs', v)}
        addLabel="Add Belief"
        fields={[
          { key: 'text', placeholder: 'What the character believes', label: 'Belief' },
          { key: 'belief_type', type: 'select', label: 'Type', options: [
            { value: 'fact', label: 'Fact' },
            { value: 'hypothesis', label: 'Hypothesis' },
            { value: 'conviction', label: 'Conviction' },
            { value: 'assumption', label: 'Assumption' },
          ] },
          { key: 'confidence', type: 'number', label: 'Confidence (0–1)' },
        ]}
      />
    </div>
  );
}