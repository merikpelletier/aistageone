import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, Plus, Trash2, ExternalLink, Loader2 } from 'lucide-react';

export default function ProfileLinksSection({ profile, isOwnProfile, userEmail }) {
  const queryClient = useQueryClient();
  const [links, setLinks] = useState(profile?.links || []);
  const [editing, setEditing] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const persist = async (updatedLinks) => {
    setSaving(true);
    try {
      if (profile?.id) {
        await base44.entities.MemberProfile.update(profile.id, { links: updatedLinks });
      } else {
        await base44.entities.MemberProfile.create({ user_email: userEmail, links: updatedLinks });
      }
      queryClient.invalidateQueries({ queryKey: ['memberProfile', userEmail] });
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    if (!newUrl.trim()) return;
    const link = { label: newLabel.trim() || newUrl.trim(), url: newUrl.trim() };
    const updated = [...links, link];
    setLinks(updated);
    setNewLabel('');
    setNewUrl('');
    persist(updated);
  };

  const handleRemove = (idx) => {
    const updated = links.filter((_, i) => i !== idx);
    setLinks(updated);
    persist(updated);
  };

  return (
    <div className="bg-black border border-white/10 rounded-3xl p-6 space-y-4 shadow-2xl lg:rounded-[1vw] lg:p-[2%] lg:space-y-[2%]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 lg:gap-[2%]">
          <div className="w-10 h-10 bg-blue-400/20 rounded-xl flex items-center justify-center lg:w-[8%] lg:aspect-square lg:h-auto lg:rounded-[20%]">
            <Link2 className="text-blue-400 w-1/2 h-1/2" />
          </div>
          <p className="text-white text-xl font-bold uppercase tracking-wider lg:text-[1.15vw]">Links</p>
        </div>
        {isOwnProfile && (
          <button
            onClick={() => setEditing(v => !v)}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wide rounded-xl transition-colors lg:px-[2.5%] lg:py-[1%] lg:text-[0.66vw] lg:rounded-[0.5vw] ${editing ? 'bg-white/10 text-white' : 'bg-white text-black hover:bg-white/90'}`}
          >
            {editing ? 'Done' : 'Manage'}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2.5 lg:gap-[1%]">
        <AnimatePresence>
          {links.map((link, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 border border-white/10 text-white text-sm font-medium rounded-full hover:border-white/40 transition-all lg:gap-[0.5vw] lg:px-[2%] lg:py-[0.8%] lg:text-[0.72vw]"
            >
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 lg:gap-[0.5vw]">
                <span>{link.label || link.url}</span>
                <ExternalLink className="text-white/50 w-[0.75vw] h-[0.75vw]" />
              </a>
              {editing && (
                <button onClick={() => handleRemove(idx)} className="ml-1 text-red-400 hover:text-red-300 transition-colors">
                  <Trash2 className="w-[0.8vw] h-[0.8vw]" />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {editing && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex flex-col gap-2 pt-2 border-t border-white/10 lg:gap-[1%] lg:pt-[1%]">
          <div className="flex gap-2 lg:gap-[1%]">
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Label (e.g. Instagram)" className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/40 lg:rounded-[0.5vw] lg:px-[2%] lg:py-[1%] lg:text-[0.72vw]" />
            <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/40 lg:rounded-[0.5vw] lg:px-[2%] lg:py-[1%] lg:text-[0.72vw]" />
          </div>
          <button onClick={handleAdd} disabled={!newUrl.trim() || saving} className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-xl disabled:opacity-40 transition-colors lg:gap-[1%] lg:py-[1%] lg:text-[0.72vw] lg:rounded-[0.5vw]">
            {saving ? <Loader2 className="animate-spin w-[0.8vw] h-[0.8vw]" /> : <Plus className="w-[0.9vw] h-[0.9vw]" />}
            Add Link
          </button>
        </motion.div>
      )}

      {links.length === 0 && !editing && (
        <p className="text-white/40 text-sm py-2 lg:text-[0.72vw] lg:py-[0.5%]">
          {isOwnProfile ? 'No links yet — click "Manage" to add your links.' : 'No links yet.'}
        </p>
      )}
    </div>
  );
}
