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
    <div className="bg-black border border-white/10 rounded-3xl p-6 space-y-4 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-400/20 rounded-xl flex items-center justify-center">
            <Link2 size={20} className="text-blue-400" />
          </div>
          <p className="text-white text-xl font-bold uppercase tracking-wider">Links</p>
        </div>
        {isOwnProfile && (
          <button
            onClick={() => setEditing(v => !v)}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wide rounded-xl transition-colors ${editing ? 'bg-white/10 text-white' : 'bg-white text-black hover:bg-white/90'}`}
          >
            {editing ? 'Done' : 'Manage'}
          </button>
        )}
      </div>

      {/* Links list */}
      <div className="flex flex-wrap gap-2.5">
        <AnimatePresence>
          {links.map((link, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 border border-white/10 text-white text-sm font-medium rounded-full hover:border-white/40 transition-all"
            >
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                <span>{link.label || link.url}</span>
                <ExternalLink size={13} className="text-white/50" />
              </a>
              {editing && (
                <button
                  onClick={() => handleRemove(idx)}
                  className="ml-1 text-red-400 hover:text-red-300 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add new link form */}
      {editing && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="flex flex-col gap-2 pt-2 border-t border-white/10"
        >
          <div className="flex gap-2">
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="Label (e.g. Instagram)"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/40"
            />
            <input
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              placeholder="https://..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/40"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={!newUrl.trim() || saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-xl disabled:opacity-40 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={16} />}
            Add Link
          </button>
        </motion.div>
      )}

      {/* Empty state */}
      {links.length === 0 && !editing && (
        <p className="text-white/40 text-sm py-2">
          {isOwnProfile ? 'No links yet — click "Manage" to add your links.' : 'No links yet.'}
        </p>
      )}
    </div>
  );
}