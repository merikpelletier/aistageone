import React, { useState } from 'react';
import { supabase } from '@/api/supabaseClient';
import { CalendarClock, Check, Play } from 'lucide-react';

const DAYS = [
  ['mon', 'M'], ['tue', 'T'], ['wed', 'W'], ['thu', 'T'], ['fri', 'F'], ['sat', 'S'], ['sun', 'S'],
];

const ACTIONS = ['publish', 'comment', 'like', 'follow', 'sponsor', 'sell', 'collaborate'];

const DEFAULT_CONFIG = {
  daily_min: 1,
  daily_max: 3,
  active_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  active_start: '09:00',
  active_end: '21:00',
  use_interests: true,
  activity_mix: {
    publish: true,
    comment: true,
    like: true,
    follow: false,
    sponsor: false,
    sell: false,
    collaborate: false,
  },
};

const FREQUENCY_DEFAULTS = {
  manual: { daily_min: 0, daily_max: 0 },
  low: { daily_min: 1, daily_max: 2 },
  normal: { daily_min: 2, daily_max: 4 },
  high: { daily_min: 4, daily_max: 7 },
};

function configFor(member) {
  return {
    ...DEFAULT_CONFIG,
    ...(member.automation_config || {}),
    active_days: member.automation_config?.active_days || DEFAULT_CONFIG.active_days,
    activity_mix: {
      ...DEFAULT_CONFIG.activity_mix,
      ...(member.automation_config?.activity_mix || {}),
    },
  };
}

export default function AIMemberAutomationPlanner({ members, onUpdate }) {
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [runError, setRunError] = useState('');

  const updateConfig = (member, patch) => {
    const current = configFor(member);
    onUpdate(member.id, {
      automation_config: {
        ...current,
        ...patch,
        activity_mix: patch.activity_mix ? { ...current.activity_mix, ...patch.activity_mix } : current.activity_mix,
      },
    });
  };

  const setFrequency = (member, frequency) => {
    const range = FREQUENCY_DEFAULTS[frequency] || FREQUENCY_DEFAULTS.manual;
    onUpdate(member.id, {
      activity_frequency: frequency,
      automation_config: {
        ...configFor(member),
        ...range,
      },
    });
  };

  const toggleDay = (member, day) => {
    const config = configFor(member);
    const active = config.active_days.includes(day);
    updateConfig(member, {
      active_days: active
        ? config.active_days.filter(item => item !== day)
        : [...config.active_days, day],
    });
  };

  const runNow = async () => {
    setRunning(true);
    setRunError('');
    setRunResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('ai-member-runner', { body: {} });
      if (error) throw error;
      setRunResult(data);
    } catch (error) {
      setRunError(error?.message || 'AI member runner failed.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border border-white/15 bg-neutral-950 p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CalendarClock size={16} />
              <h3 className="text-sm font-medium">Activity Planner</h3>
            </div>
            <p className="text-xs text-white/50 mt-1">
              Define how often each AI member can act, when it can act, and which actions are allowed. Automation still remains individually switchable.
            </p>
          </div>
          <button
            type="button"
            onClick={runNow}
            disabled={running}
            className="h-9 px-4 bg-white text-black text-xs font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Play size={13} />
            {running ? 'Running...' : 'Run now'}
          </button>
        </div>
        {runError && <p className="mt-3 text-xs text-red-300">{runError}</p>}
        {runResult && (
          <div className="mt-3 border-t border-white/10 pt-3 text-xs text-white/60">
            <span>{runResult.published ?? 0} action(s) published</span>
            {runResult.processed !== undefined && <span> · {runResult.processed} member(s) checked</span>}
            {runResult.local_time && <span> · {runResult.local_time}</span>}
          </div>
        )}
      </div>

      {members.map(member => {
        const config = configFor(member);
        const capabilities = member.capabilities || {};

        return (
          <div key={member.id} className="border border-white/10 bg-neutral-950 p-4 space-y-4">
            <div className="flex flex-col xl:flex-row xl:items-center gap-3">
              <div className="min-w-0 xl:w-64">
                <p className="font-medium truncate">{member.display_name}</p>
                <p className="text-xs text-white/45 truncate">@{member.handle} · {member.member_type}</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1">
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Mode</span>
                  <select
                    value={member.activity_frequency || 'manual'}
                    onChange={e => setFrequency(member, e.target.value)}
                    className="input-ai w-full"
                  >
                    <option value="manual">Manual</option>
                    <option value="low">Light</option>
                    <option value="normal">Regular</option>
                    <option value="high">Active</option>
                  </select>
                </label>

                <label className="block">
                  <span className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Daily minimum</span>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={config.daily_min}
                    onChange={e => updateConfig(member, { daily_min: Math.max(0, Number(e.target.value) || 0) })}
                    className="input-ai w-full"
                  />
                </label>

                <label className="block">
                  <span className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Daily maximum</span>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={config.daily_max}
                    onChange={e => updateConfig(member, { daily_max: Math.max(config.daily_min, Number(e.target.value) || 0) })}
                    className="input-ai w-full"
                  />
                </label>

                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdate(member.id, { automation_enabled: !member.automation_enabled })}
                    className={`h-[38px] flex-1 px-3 text-xs border ${member.automation_enabled ? 'bg-teal-400 text-black border-teal-400' : 'border-white/20 text-white'}`}
                  >
                    {member.automation_enabled ? 'Automation ON' : 'Automation OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdate(member.id, { is_active: !member.is_active })}
                    className={`h-[38px] px-3 text-xs border ${member.is_active ? 'border-white/20 text-white' : 'border-red-400/40 text-red-300'}`}
                  >
                    {member.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 border-t border-white/10 pt-4">
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-white/40 mb-2">Allowed automated actions</span>
                <div className="flex flex-wrap gap-2">
                  {ACTIONS.map(action => {
                    const capabilityAllowed = capabilities[action] !== false;
                    const enabled = capabilityAllowed && config.activity_mix[action];
                    return (
                      <button
                        key={action}
                        type="button"
                        disabled={!capabilityAllowed}
                        onClick={() => updateConfig(member, { activity_mix: { [action]: !config.activity_mix[action] } })}
                        className={`px-2.5 py-1.5 text-[10px] uppercase tracking-wide border transition-colors ${enabled ? 'bg-white text-black border-white' : 'border-white/15 text-white/50'} disabled:opacity-25 disabled:cursor-not-allowed`}
                      >
                        {enabled && <Check size={10} className="inline mr-1" />}
                        {action}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs self-end">
                <input
                  type="checkbox"
                  checked={config.use_interests}
                  onChange={e => updateConfig(member, { use_interests: e.target.checked })}
                />
                Match member interests
              </label>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-4 border-t border-white/10 pt-4">
              <div>
                <span className="block text-[10px] uppercase tracking-wider text-white/40 mb-2">Active days</span>
                <div className="flex gap-1.5">
                  {DAYS.map(([value, label], index) => {
                    const active = config.active_days.includes(value);
                    return (
                      <button
                        key={`${value}-${index}`}
                        type="button"
                        onClick={() => toggleDay(member, value)}
                        className={`w-8 h-8 text-xs border ${active ? 'bg-white text-black border-white' : 'border-white/15 text-white/45'}`}
                        title={value}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label>
                <span className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">From</span>
                <input type="time" value={config.active_start} onChange={e => updateConfig(member, { active_start: e.target.value })} className="input-ai" />
              </label>

              <label>
                <span className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">Until</span>
                <input type="time" value={config.active_end} onChange={e => updateConfig(member, { active_end: e.target.value })} className="input-ai" />
              </label>
            </div>

            {config.use_interests && (
              <div className="border-t border-white/10 pt-3">
                <span className="text-[10px] uppercase tracking-wider text-white/40">Interest triggers</span>
                <p className="text-xs text-white/55 mt-1">
                  {(member.interests || []).length ? member.interests.join(' · ') : 'No interests configured for this member yet.'}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
