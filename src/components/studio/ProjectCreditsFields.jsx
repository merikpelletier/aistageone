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

const FOTO_PLAY_SETUP_THEME = `
body:has(.fotoplay-setup-theme) [class*="bg-yellow-400"] { background-color: #23c7be !important; }
body:has(.fotoplay-setup-theme) [class*="text-yellow-400"] { color: #23c7be !important; }
body:has(.fotoplay-setup-theme) [class*="border-yellow-400"] { border-color: #23c7be !important; }
body:has(.fotoplay-setup-theme) [class*="ring-yellow-400"] { --tw-ring-color: #23c7be !important; }
body:has(.fotoplay-setup-theme) section[class*="bg-black/5"] { background-color: #181c21 !important; border: 1px solid rgba(255,255,255,.08); color: #fff; }
body:has(.fotoplay-setup-theme) section[class*="bg-black"] { background-color: #111418 !important; border: 1px solid rgba(255,255,255,.08); }
body:has(.fotoplay-setup-theme) div[class*="bg-yellow-400"][class*="border-2"] { background-color: #181c21 !important; border-color: #23c7be !important; color: #fff !important; }
body:has(.fotoplay-setup-theme) div[class*="bg-yellow-400"][class*="border-2"] p { color: rgba(255,255,255,.72) !important; }
body:has(.fotoplay-setup-theme) input,
body:has(.fotoplay-setup-theme) textarea,
body:has(.fotoplay-setup-theme) select { background-color: #20242a !important; border-color: rgba(255,255,255,.12) !important; color: #fff !important; box-shadow: none !important; }
body:has(.fotoplay-setup-theme) input::placeholder,
body:has(.fotoplay-setup-theme) textarea::placeholder { color: rgba(255,255,255,.32) !important; }
body:has(.fotoplay-setup-theme) label[class*="text-black"],
body:has(.fotoplay-setup-theme) h2[class*="text-black"],
body:has(.fotoplay-setup-theme) p[class*="text-black"] { color: #fff !important; }
body:has(.fotoplay-setup-theme) [class*="bg-white/10"] { background-color: #20242a !important; }
body:has(.fotoplay-setup-theme) [class*="bg-white/5"] { background-color: #181c21 !important; }
body:has(.fotoplay-setup-theme) button[class*="bg-black"] { background-color: #20242a !important; color: #23c7be !important; border: 1px solid rgba(35,199,190,.35); }
body:has(.fotoplay-setup-theme) button[class*="bg-yellow-400"] { background-color: #23c7be !important; color: #061918 !important; }
body:has(.fotoplay-setup-theme) [class*="rounded-[2rem]"] { border-radius: 14px !important; }
body:has(.fotoplay-setup-theme) [class*="rounded-2xl"] { border-radius: 10px !important; }
body:has(.fotoplay-setup-theme) [class*="rounded-xl"] { border-radius: 8px !important; }
`;

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
    : 'w-full rounded-xl border border-white/10 bg-[#20242a] px-3 py-2.5 text-sm font-semibold text-white placeholder:text-white/30 focus:border-[#23c7be] focus:outline-none';

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
    <div className={`fotoplay-setup-theme ${dark ? 'space-y-4' : 'space-y-4 border border-white/10 bg-[#181c21] p-4'}`}>
      <style>{FOTO_PLAY_SETUP_THEME}</style>
      <div>
        <p className={dark ? 'mb-1 text-white text-[10px] uppercase tracking-widest' : 'mb-1.5 text-xs font-black uppercase tracking-wider text-white'}>
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
            <Users size={15} className="text-[#23c7be]" />
            <p className={dark ? 'text-white text-[10px] uppercase tracking-widest' : 'text-xs font-black uppercase tracking-wider text-white'}>
              Collaborators
            </p>
          </div>
          <button
            type="button"
            onClick={addContributor}
            disabled={disabled}
            className={dark ? 'flex items-center gap-1 border border-white/15 px-2.5 py-1.5 text-xs text-white hover:border-white/35 disabled:opacity-40' : 'flex items-center gap-1 border border-[#23c7be]/40 bg-[#23c7be] px-2.5 py-1.5 text-xs font-black text-black disabled:opacity-40'}
          >
            <Plus size={13} /> Add
          </button>
        </div>

        <div className="space-y-2">
          {contributors.map((contributor, index) => (
            <div key={index} className={dark ? 'grid gap-2 border border-white/10 bg-white/[0.03] p-3 md:grid-cols-[1fr_180px_1fr_auto]' : 'grid gap-2 border border-white/10 bg-[#20242a] p-3 md:grid-cols-[1fr_180px_1fr_auto]'}>
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
                className="flex h-10 w-10 items-center justify-center text-white/45 hover:bg-red-600/20 hover:text-red-400 disabled:opacity-40"
                aria-label="Remove collaborator"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {contributors.length === 0 && (
            <p className={dark ? 'text-xs text-white/35' : 'text-xs font-semibold text-white/45'}>
              No collaborators added yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
