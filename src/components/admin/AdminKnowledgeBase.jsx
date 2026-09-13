import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit2, Trash2, XCircle, BookOpen, Search } from 'lucide-react';

const CATEGORY_COLORS = [
  'bg-blue-900/40 text-blue-300 border-blue-500/30',
  'bg-purple-900/40 text-purple-300 border-purple-500/30',
  'bg-green-900/40 text-green-300 border-green-500/30',
  'bg-orange-900/40 text-orange-300 border-orange-500/30',
  'bg-pink-900/40 text-pink-300 border-pink-500/30',
  'bg-yellow-900/40 text-yellow-300 border-yellow-500/30',
  'bg-cyan-900/40 text-cyan-300 border-cyan-500/30',
  'bg-red-900/40 text-red-300 border-red-500/30',
];

const getCategoryColor = (cat, allCats) => {
  const idx = allCats.indexOf(cat);
  return CATEGORY_COLORS[idx % CATEGORY_COLORS.length] || 'bg-neutral-800 text-white border-white/10';
};

const EMPTY = { category: '', title: '', description: '', tags: '', is_active: true };

export default function AdminKnowledgeBase() {
  const [editing, setEditing] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const queryClient = useQueryClient();

  const { data: entries = [] } = useQuery({
    queryKey: ['knowledgeEntries'],
    queryFn: () => base44.entities.KnowledgeEntry.list('category'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.KnowledgeEntry.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['knowledgeEntries'] }); setEditing(null); }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.KnowledgeEntry.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['knowledgeEntries'] }); setEditing(null); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.KnowledgeEntry.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledgeEntries'] })
  });

  const handleSave = () => {
    const data = {
      ...editing,
      tags: typeof editing.tags === 'string'
        ? editing.tags.split(',').map(t => t.trim()).filter(Boolean)
        : editing.tags || [],
    };
    if (editing.id) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEdit = (entry) => setEditing({
    ...entry,
    tags: Array.isArray(entry.tags) ? entry.tags.join(', ') : (entry.tags || ''),
  });

  // Derive unique categories from actual data
  const allCategories = [...new Set(entries.map(e => e.category).filter(Boolean))].sort();

  const filtered = entries.filter(e => {
    if (filterCategory && e.category !== filterCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return e.title?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q) || (e.tags || []).some(t => t.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white text-lg font-light">Knowledge Library</h2>
          <p className="text-white text-sm mt-1">Tools, techniques, and concepts the agent can look up on demand</p>
        </div>
        <Button onClick={() => setEditing({ ...EMPTY })} className="bg-white text-black hover:bg-white/90">
          <Plus size={16} className="mr-2" /> New Entry
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by title, description or tag…"
          className="w-full bg-neutral-900 border border-white/10 text-white rounded-md pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white"
        />
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap mb-4">
        <button
          onClick={() => setFilterCategory('')}
          className={`text-xs px-3 py-1 rounded-full border transition-all ${!filterCategory ? 'bg-white text-black border-white' : 'border-white/20 text-white hover:border-white/40'}`}
        >
          All ({entries.length}) {filtered.length !== entries.length && `· ${filtered.length} shown`}
        </button>
        {allCategories.map(cat => {
          const count = entries.filter(e => e.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat === filterCategory ? '' : cat)}
              className={`text-xs px-3 py-1 rounded-full border transition-all ${filterCategory === cat ? 'bg-white text-black border-white' : 'border-white/20 text-white hover:border-white/40'}`}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-neutral-950 border border-white/10 rounded-sm">
          <BookOpen size={28} className="text-white/20 mx-auto mb-3" />
          <p className="text-white text-sm">No entries yet</p>
          <p className="text-white text-xs mt-1">Add tools, techniques, and concepts the agent can reference</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(entry => (
            <div key={entry.id} className="bg-neutral-950 border border-white/10 rounded-sm p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${getCategoryColor(entry.category, allCategories)}`}>
                    {entry.category}
                  </span>
                  <h3 className="text-white font-medium text-sm">{entry.title}</h3>
                  {!entry.is_active && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-white border border-white/10">Inactive</span>
                  )}
                </div>
                <p className="text-white text-xs line-clamp-2">{entry.description}</p>
                {entry.tags?.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {entry.tags.map(tag => (
                      <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-neutral-800 text-white">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" onClick={() => openEdit(entry)} className="text-white hover:text-white h-8 w-8">
                  <Edit2 size={14} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(entry)} className="text-white hover:text-red-500 h-8 w-8">
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-white/10 rounded-sm max-w-sm w-full p-6 space-y-4">
            <h3 className="text-white font-medium">Delete this entry?</h3>
            <p className="text-white text-sm">
              <span className="text-white">{confirmDelete.title}</span> will be permanently removed from the knowledge base.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => setConfirmDelete(null)} className="flex-1 bg-neutral-700 border border-white/20 text-white hover:bg-neutral-600">Cancel</Button>
              <Button onClick={() => { deleteMutation.mutate(confirmDelete.id); setConfirmDelete(null); }} className="flex-1 bg-red-600 text-white hover:bg-red-500">Delete</Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-white/10 rounded-sm max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white text-lg font-light">{editing.id ? 'Edit' : 'New'} Knowledge Entry</h3>
                <button onClick={() => setEditing(null)} className="text-white hover:text-white">
                  <XCircle size={20} />
                </button>
              </div>

              {/* Category */}
              <div>
                <label className="text-white text-sm block mb-2">
                  Category <span className="text-red-400">*</span>
                  <span className="text-white text-xs ml-2">Pick existing or type a new one</span>
                </label>
                <input
                  list="category-options"
                  value={editing.category}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  placeholder="e.g. Tool, Technique, MY STUDIO…"
                  className="w-full bg-neutral-900 border border-white/10 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/30"
                />
                <datalist id="category-options">
                  {allCategories.map(cat => <option key={cat} value={cat} />)}
                </datalist>
              </div>

              {/* Title */}
              <div>
                <label className="text-white text-sm block mb-2">Title <span className="text-red-400">*</span></label>
                <Input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="e.g. Lip Sync, Faceswitch, Establishing Shot"
                  className="bg-neutral-900 border-white/10 text-white"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-white text-sm block mb-2">
                  Description <span className="text-red-400">*</span>
                  <span className="text-white text-xs ml-2">What it is, how it works, when and how to use it</span>
                </label>
                <Textarea
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="Explain this tool or technique clearly. The agent will read this verbatim to answer user questions."
                  className="bg-neutral-900 border-white/10 text-white min-h-[160px]"
                  rows={6}
                />
              </div>

              {/* Tags */}
              <div>
                <label className="text-white text-sm block mb-2">
                  Tags
                  <span className="text-white text-xs ml-2">Comma-separated (e.g. musical, video, performance)</span>
                </label>
                <Input
                  value={editing.tags}
                  onChange={(e) => setEditing({ ...editing, tags: e.target.value })}
                  placeholder="musical, video, performance"
                  className="bg-neutral-900 border-white/10 text-white"
                />
              </div>

              {/* Active */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="entry-active"
                  checked={editing.is_active}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                  className="w-4 h-4 accent-white"
                />
                <label htmlFor="entry-active" className="text-white text-sm">Active (visible to agent)</label>
              </div>

              <div className="flex gap-3 pt-2">
                <Button onClick={() => setEditing(null)} className="flex-1 bg-neutral-700 border border-white/20 text-white hover:bg-neutral-600">
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!editing.category || !editing.title || !editing.description}
                  className="flex-1 bg-white text-black hover:bg-white/90 disabled:opacity-40"
                >
                  Save Entry
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}