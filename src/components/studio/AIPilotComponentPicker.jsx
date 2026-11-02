import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Sparkles, X } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { getAIPilotComponentLibrary } from '@/lib/aiPilotComponents';

const TYPE_LABELS = {
  action_prompt: 'Action Prompts',
  blocking_prompt: 'Blocking Prompts',
};

const ALLOWED_TYPES = new Set(['action_prompt', 'blocking_prompt']);

export default function AIPilotComponentPicker({ toolKey = 'compose_scene', value = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [library, setLibrary] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
          if (!cancelled) setLibrary([]);
          return;
        }
        const items = await getAIPilotComponentLibrary({ userId: user.id, toolKey });
        if (!cancelled) setLibrary((items || []).filter((item) => ALLOWED_TYPES.has(item.component_type)));
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Unable to load AI Pilot prompts.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [toolKey]);

  const selectedKeys = useMemo(() => new Set((value || []).map((item) => item.key)), [value]);
  const grouped = useMemo(() => {
    const groups = new Map();
    library.forEach((item) => {
      const key = item.component_type;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    return [...groups.entries()];
  }, [library]);

  const toggle = (component) => {
    const current = value || [];
    if (selectedKeys.has(component.key)) onChange?.(current.filter((item) => item.key !== component.key));
    else onChange?.([...current, component]);
  };

  return (
    <section className="border border-cyan-300/30 bg-cyan-300/[0.04]">
      <button type="button" onClick={() => setOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 p-3 text-left">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles size={15} className="shrink-0 text-cyan-300" />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-cyan-200">AI Pilot Direction</p>
            <p className="mt-0.5 text-[11px] text-white/50">Choose Action or Blocking prompts from any AI Pilot in your library.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/55">
          {value?.length ? <span>{value.length} selected</span> : null}
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>

      {value?.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-white/10 px-3 py-2">
          {value.map((component) => (
            <button key={component.key} type="button" onClick={() => toggle(component)} className="inline-flex items-center gap-1.5 border border-cyan-300/25 bg-black/40 px-2 py-1 text-[10px] text-cyan-100">
              <span>{component.label}</span>
              <span className="text-white/35">· {component.pilot?.name}</span>
              <X size={11} />
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="space-y-4 border-t border-white/10 p-3">
          {loading && <div className="flex items-center gap-2 text-xs text-white/55"><Loader2 size={14} className="animate-spin" /> Loading AI Pilot prompts…</div>}
          {error && <p className="text-xs text-red-300">{error}</p>}
          {!loading && !error && grouped.length === 0 && <p className="text-xs text-white/45">No Action or Blocking prompts found in your AI Pilots.</p>}
          {grouped.map(([type, items]) => (
            <div key={type} className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">{TYPE_LABELS[type] || type.replace(/_/g, ' ')}</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((component) => {
                  const selected = selectedKeys.has(component.key);
                  return (
                    <button key={component.key} type="button" onClick={() => toggle(component)} className={`border p-2.5 text-left ${selected ? 'border-cyan-300 bg-cyan-300/10' : 'border-white/10 bg-black/35 hover:border-white/25'}`}>
                      <p className="text-xs font-bold text-white">{component.label}</p>
                      <p className="mt-1 truncate text-[10px] text-cyan-200/70">{component.pilot?.name || 'AI Pilot'}{component.personal ? ' · My addition' : ''}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
