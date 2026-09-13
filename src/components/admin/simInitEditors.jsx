import React from 'react';
import { Plus, X } from 'lucide-react';

// Shared, reusable editors for simulation-initialization arrays on the existing
// admin forms. Match the admin design: neutral-800 inputs, white/10 borders,
// white text, xs uppercase labels. These only edit values the admin enters —
// they never derive or invent content.

const inputClass = "w-full bg-neutral-800 border border-white/10 rounded-sm px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30";

// Edits an array of strings (goals, needs, world conditions, public facts…)
export function TextListEditor({ label, items, onChange, placeholder, addLabel = 'Add' }) {
  const list = Array.isArray(items) ? items : [];
  const update = (i, v) => onChange(list.map((x, idx) => (idx === i ? v : x)));
  const add = () => onChange([...list, '']);
  const remove = (i) => onChange(list.filter((_, idx) => idx !== i));
  return (
    <div>
      {label && <label className="text-white text-xs uppercase tracking-wider font-medium mb-1.5 block">{label}</label>}
      <div className="space-y-2">
        {list.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <input value={item} onChange={e => update(i, e.target.value)} placeholder={placeholder} className={inputClass} />
            <button type="button" onClick={() => remove(i)} className="w-8 h-8 flex-shrink-0 bg-neutral-800 border border-white/10 rounded-sm flex items-center justify-center hover:bg-red-500/20">
              <X size={14} className="text-white" />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={add} className="mt-2 inline-flex items-center gap-1.5 text-white/70 hover:text-white text-xs">
        <Plus size={14} /> {addLabel}
      </button>
    </div>
  );
}

// A comma-separated tags input that lets the user type freely (including
// commas) while the parent array stays clean. Uses a local draft string so
// typing a comma doesn't get stripped/rejoined mid-keystroke.
function TagsInput({ value, onChange, placeholder }) {
  const arr = Array.isArray(value) ? value : [];
  const [draft, setDraft] = React.useState(arr.join(', '));
  const [focused, setFocused] = React.useState(false);
  React.useEffect(() => {
    if (!focused) setDraft(arr.join(', '));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused]);
  return (
    <input
      value={draft}
      placeholder={placeholder || 'comma-separated'}
      onFocus={() => setFocused(true)}
      onChange={e => { setDraft(e.target.value); onChange(e.target.value.split(',').map(s => s.trim()).filter(Boolean)); }}
      onBlur={() => { setFocused(false); setDraft(arr.join(', ')); }}
      className={inputClass}
    />
  );
}

// Edits an array of objects. `fields` describes each property:
//   { key, label, type: 'text'|'textarea'|'select'|'number'|'checkbox'|'tags', options?, placeholder?, full? }
// 'select' options: array of strings OR array of { value, label }.
// 'tags' edits an array-of-strings property as a comma-separated input.
// 'full' makes the field span both columns.
export function ObjectListEditor({ label, items, onChange, fields, addLabel = 'Add', blank = {} }) {
  const list = Array.isArray(items) ? items : [];
  const updateField = (i, key, val) => onChange(list.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)));
  const add = () => onChange([...list, { ...blank }]);
  const remove = (i) => onChange(list.filter((_, idx) => idx !== i));
  return (
    <div>
      {label && <label className="text-white text-xs uppercase tracking-wider font-medium mb-1.5 block">{label}</label>}
      <div className="space-y-3">
        {list.map((item, i) => (
          <div key={i} className="bg-neutral-900 border border-white/10 rounded-sm p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-white/40 text-[10px] uppercase tracking-wider">#{i + 1}</span>
              <button type="button" onClick={() => remove(i)} className="w-7 h-7 bg-neutral-800 border border-white/10 rounded-sm flex items-center justify-center hover:bg-red-500/20">
                <X size={12} className="text-white" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {fields.map(f => {
                const val = item[f.key];
                const wrap = (children, spanFull) => (
                  <div key={f.key} className={spanFull || f.full ? 'col-span-2' : ''}>
                    {f.label && f.type !== 'checkbox' && <span className="text-white/40 text-[10px] uppercase tracking-wider block mb-1">{f.label}</span>}
                    {children}
                  </div>
                );
                if (f.type === 'select') {
                  return wrap(
                    <select value={val || ''} onChange={e => updateField(i, f.key, e.target.value)} className={inputClass}>
                      <option value="">{f.placeholder || '— select —'}</option>
                      {(f.options || []).map(o => {
                        const v = typeof o === 'string' ? o : o.value;
                        const l = typeof o === 'string' ? o : o.label;
                        return <option key={v} value={v}>{l}</option>;
                      })}
                    </select>
                  );
                }
                if (f.type === 'checkbox') {
                  return (
                    <div key={f.key} className="flex items-center gap-2 col-span-2">
                      <input type="checkbox" checked={!!val} onChange={e => updateField(i, f.key, e.target.checked)} className="w-4 h-4" />
                      <span className="text-white text-xs">{f.label}</span>
                    </div>
                  );
                }
                if (f.type === 'tags') {
                  return wrap(
                    <TagsInput
                      value={val}
                      placeholder={f.placeholder || 'comma-separated'}
                      onChange={v => updateField(i, f.key, v)}
                    />,
                    true
                  );
                }
                if (f.type === 'textarea') {
                  return wrap(
                    <textarea value={val || ''} onChange={e => updateField(i, f.key, e.target.value)} placeholder={f.placeholder} rows={2} className={inputClass + ' resize-none'} />,
                    true
                  );
                }
                if (f.type === 'number') {
                  return wrap(
                    <input type="number" step="0.01" min="0" max="1" value={val ?? ''} onChange={e => updateField(i, f.key, e.target.value === '' ? '' : Number(e.target.value))} placeholder={f.placeholder} className={inputClass} />
                  );
                }
                return wrap(
                  <input value={val || ''} onChange={e => updateField(i, f.key, e.target.value)} placeholder={f.placeholder} className={inputClass} />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={add} className="mt-2 inline-flex items-center gap-1.5 text-white/70 hover:text-white text-xs">
        <Plus size={14} /> {addLabel}
      </button>
    </div>
  );
}