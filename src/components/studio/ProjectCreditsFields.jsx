import React from 'react';
import { Plus, Trash2, Users } from 'lucide-react';

const DEFAULT_ROLES = [
  'Director',
  'Writer',
  'Actor',
  'Character Creator',
  'Set / Location',
  'Costume',
  'Editor',
  'Music',
  'Sound',
  'Producer',
  'Other',
];

export default function ProjectCreditsFields({
  authorName,
  onAuthorChange,
  contributors = [],
  onContributorsChange,
  dark = false,
  disabled = false,
}) {
  const field = dark
    ? 'w-full rounded-xl border border-white/10 bg-[#1a1a1a] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30'
    : 'w-full rounded-xl border-2 border-black/10 bg-white px-3 py-2.5 text-sm font-semibold text-black placeholder:text-black/35 focus:border-black/40 focus:outline-none';

  const updateContributor = (index, patch) => {
    const next = [...contributors];
    next[index] = { ...next[index], ...patch };
    onContributorsChange(next);
  };

  const removeContributor = (index) => {
    onContributorsChange(contributors.filter((_, i) => i !== index));
  };

  const addContributor = () => {
    onContributorsChange([
      ...contributors,
      { name: '', role: '', user_email: '', is_external: false },
    ]);
  };

  return (
    <div className={dark ? 'space-y-4' : 'space-y-4 rounded-2xl border border-black/10 bg-black/[0.03] p-4'}>
      <div>
        <p className={dark ? 'mb-1 text-white text-[10px] uppercase tracking-widest' : 'mb-1.5 text-xs font-black uppercase tracking-wider text-black'}>
          Author *
        </p>
        <input
          value={authorName || ''}
          onChange={(e) => onAuthorChange(e.target.value)}
          placeholder="Author name"
          disabled={disabled}
          className={field}
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users size={15} className={dark ? 'text-white/60' : 'text-black/60'} />
            <p className={dark ? 'text-white text-[10px] uppercase tracking-widest' : 'text-xs font-black uppercase tracking-wider text-black'}>
              Collaborators
            </p>
          </div>
          <button
            type="button"
            onClick={addContributor}
            disabled={disabled}
            className={dark ? 'flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-white hover:border-white/35 disabled:opacity-40' : 'flex items-center gap-1 rounded-lg bg-black px-2.5 py-1.5 text-xs font-black text-yellow-400 disabled:opacity-40'}
          >
            <Plus size={13} /> Add
          </button>
        </div>

        <div className="space-y-2">
          {contributors.map((contributor, index) => (
            <div key={index} className={dark ? 'grid gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 md:grid-cols-[1fr_180px_1fr_auto]' : 'grid gap-2 rounded-xl border border-black/10 bg-white p-3 md:grid-cols-[1fr_180px_1fr_auto]'}>
              <input
                value={contributor.name || ''}
                onChange={(e) => updateContributor(index, { name: e.target.value })}
                placeholder="Name"
                disabled={disabled}
                className={field}
              />
              <select
                value={contributor.role || ''}
                onChange={(e) => updateContributor(index, { role: e.target.value })}
                disabled={disabled}
                className={field}
              >
                <option value="">Role</option>
                {DEFAULT_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
              <input
                value={contributor.user_email || ''}
                onChange={(e) => updateContributor(index, { user_email: e.target.value })}
                placeholder="Member email (optional)"
                disabled={disabled}
                className={field}
              />
              <button
                type="button"
                onClick={() => removeContributor(index)}
                disabled={disabled}
                className={dark ? 'flex h-10 w-10 items-center justify-center rounded-lg text-white/45 hover:bg-red-600/20 hover:text-red-400 disabled:opacity-40' : 'flex h-10 w-10 items-center justify-center rounded-lg text-black/45 hover:bg-red-100 hover:text-red-600 disabled:opacity-40'}
                aria-label="Remove collaborator"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {contributors.length === 0 && (
            <p className={dark ? 'text-xs text-white/35' : 'text-xs font-semibold text-black/45'}>
              No collaborators added yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
