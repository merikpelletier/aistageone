import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Users, Layers, Search, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import StoryCharacterEditor from '@/components/admin/StoryCharacterEditor';
import StorySetEditor from '@/components/admin/StorySetEditor';

export default function CastSetsManager({ theme, onBack }) {
  const [tab, setTab] = useState('characters');
  const [allCharacters, setAllCharacters] = useState([]);
  const [allSets, setAllSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [attachedCharIds, setAttachedCharIds] = useState(theme.story_character_ids || []);
  const [attachedSetIds, setAttachedSetIds] = useState(theme.story_set_ids || []);
  const [editingChar, setEditingChar] = useState(null);
  const [editingSet, setEditingSet] = useState(null);

  // Each theme has its own cast & sets — only load the items linked to THIS theme.
  const loadAll = () => {
    setLoading(true);
    const charIds = theme.story_character_ids || [];
    const setIds = theme.story_set_ids || [];
    Promise.all([
      Promise.all(charIds.map(id => base44.entities.StoryCharacter.get(id).catch(() => null))),
      Promise.all(setIds.map(id => base44.entities.StorySet.get(id).catch(() => null))),
    ])
      .then(([chars, sets]) => {
        setAllCharacters(chars.filter(Boolean));
        setAllSets(sets.filter(Boolean));
      })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  // A newly-created character is linked to this theme immediately.
  const attachChar = async (char) => {
    if (!char?.id || attachedCharIds.includes(char.id)) { loadAll(); return; }
    const newIds = [...attachedCharIds, char.id];
    setAttachedCharIds(newIds);
    setAllCharacters(prev => [...prev, char]);
    try {
      await base44.admin.setStoryThemeCharacters(theme.id, newIds);
      toast.success('Added to this theme');
    } catch {
      toast.error('Failed to link to theme');
    }
  };

  const attachSet = async (setAsset) => {
    if (!setAsset?.id || attachedSetIds.includes(setAsset.id)) { loadAll(); return; }
    const newIds = [...attachedSetIds, setAsset.id];
    setAttachedSetIds(newIds);
    setAllSets(prev => [...prev, setAsset]);
    try {
      await base44.admin.setStoryThemeSets(theme.id, newIds);
      toast.success('Added to this theme');
    } catch {
      toast.error('Failed to link to theme');
    }
  };

  const handleDeleteChar = async (char) => {
    if (!confirm(`Delete "${char.name}"?`)) return;
    try {
      await base44.admin.deleteStoryCharacter(char.id);
      const newIds = attachedCharIds.filter(id => id !== char.id);
      setAttachedCharIds(newIds);
      setAllCharacters(prev => prev.filter(c => c.id !== char.id));
      toast.success('Character deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleDeleteSet = async (setAsset) => {
    if (!confirm(`Delete "${setAsset.name}"?`)) return;
    try {
      await base44.admin.deleteStorySet(setAsset.id);
      const newIds = attachedSetIds.filter(id => id !== setAsset.id);
      setAttachedSetIds(newIds);
      setAllSets(prev => prev.filter(s => s.id !== setAsset.id));
      toast.success('Set deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const filteredChars = allCharacters.filter(c => (c.name || '').toLowerCase().includes(search.toLowerCase()));
  const filteredSets = allSets.filter(s => (s.name || '').toLowerCase().includes(search.toLowerCase()));

  if (editingChar !== null) {
    const wasNew = editingChar === 'new';
    return (
      <StoryCharacterEditor
        character={wasNew ? null : editingChar}
        packCharacters={allCharacters}
        packSets={allSets}
        onBack={(created) => {
          setEditingChar(null);
          if (wasNew && created?.id) attachChar(created);
          else loadAll();
        }}
      />
    );
  }

  if (editingSet !== null) {
    const wasNew = editingSet === 'new';
    return (
      <StorySetEditor
        set={wasNew ? null : editingSet}
        onBack={(created) => {
          setEditingSet(null);
          if (wasNew && created?.id) attachSet(created);
          else loadAll();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-white hover:text-white text-sm">
        <ArrowLeft size={16} /> Back to themes
      </button>

      <div>
        <h2 className="text-white text-lg font-light tracking-wider">CAST &amp; SETS</h2>
        <p className="text-white text-xs">For: {theme.title}</p>
      </div>

      <div className="flex gap-1 bg-neutral-900 border border-white/10 rounded-sm p-1">
        <button
          onClick={() => setTab('characters')}
          className={`flex-1 py-2 text-xs font-medium tracking-wide rounded-sm transition-colors flex items-center justify-center gap-1.5 ${tab === 'characters' ? 'bg-white text-black' : 'text-white hover:text-white'}`}
        >
          <Users size={14} /> Characters ({allCharacters.length})
        </button>
        <button
          onClick={() => setTab('sets')}
          className={`flex-1 py-2 text-xs font-medium tracking-wide rounded-sm transition-colors flex items-center justify-center gap-1.5 ${tab === 'sets' ? 'bg-white text-black' : 'text-white hover:text-white'}`}
        >
          <Layers size={14} /> Sets ({allSets.length})
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${tab}...`}
            className="w-full bg-neutral-800 border border-white/10 rounded-sm pl-9 pr-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30"
          />
        </div>
        <Button onClick={() => tab === 'characters' ? setEditingChar('new') : setEditingSet('new')} className="bg-white text-black hover:bg-white/90" size="sm">
          <Plus size={16} className="mr-1" /> New
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-white" /></div>
      ) : tab === 'characters' ? (
        <CharacterGrid characters={filteredChars} onEdit={setEditingChar} onDelete={handleDeleteChar} />
      ) : (
        <SetGrid sets={filteredSets} onEdit={setEditingSet} onDelete={handleDeleteSet} />
      )}
    </div>
  );
}

function CharacterGrid({ characters, onEdit, onDelete }) {
  if (characters.length === 0) {
    return (
      <div className="bg-neutral-900 border border-white/10 rounded-sm p-10 text-center">
        <Users size={28} className="text-white/20 mx-auto mb-2" />
        <p className="text-white text-sm">No characters in this theme yet</p>
        <p className="text-white text-xs mt-1">Click "New" to create one</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {characters.map(c => {
        const photo = c.photos?.[0];
        return (
          <div key={c.id} className="relative bg-neutral-900 border border-white/10 rounded-sm overflow-hidden transition-all">
            <button onClick={() => onEdit(c)} className="w-full text-left">
              <div className="aspect-[3/4] bg-neutral-800">
                {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : <Users size={24} className="text-white/20 m-auto mt-10" />}
              </div>
              <div className="p-2">
                <p className="text-white text-xs font-medium truncate">{c.name || 'Unnamed'}</p>
                <p className="text-white text-[10px] truncate">{c.character_type || ''}</p>
              </div>
            </button>
            <div className="absolute top-1.5 right-1.5 flex gap-1">
              <button onClick={() => onEdit(c)} className="w-6 h-6 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80">
                <Pencil size={10} className="text-white" />
              </button>
              <button onClick={() => onDelete(c)} className="w-6 h-6 bg-black/60 rounded-full flex items-center justify-center hover:bg-red-500/80">
                <Trash2 size={10} className="text-white" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SetGrid({ sets, onEdit, onDelete }) {
  if (sets.length === 0) {
    return (
      <div className="bg-neutral-900 border border-white/10 rounded-sm p-10 text-center">
        <Layers size={28} className="text-white/20 mx-auto mb-2" />
        <p className="text-white text-sm">No sets in this theme yet</p>
        <p className="text-white text-xs mt-1">Click "New" to create one</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {sets.map(s => {
        const img = s.images?.[0];
        return (
          <div key={s.id} className="relative bg-neutral-900 border border-white/10 rounded-sm overflow-hidden transition-all">
            <button onClick={() => onEdit(s)} className="w-full text-left">
              <div className="aspect-video bg-neutral-800">
                {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <Layers size={24} className="text-white/20 m-auto mt-6" />}
              </div>
              <div className="p-2">
                <p className="text-white text-xs font-medium truncate">{s.name || 'Unnamed'}</p>
                <p className="text-white text-[10px] truncate">{s.tags?.slice(0, 2).join(', ') || ''}</p>
              </div>
            </button>
            <div className="absolute top-1.5 right-1.5 flex gap-1">
              <button onClick={() => onEdit(s)} className="w-6 h-6 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80">
                <Pencil size={10} className="text-white" />
              </button>
              <button onClick={() => onDelete(s)} className="w-6 h-6 bg-black/60 rounded-full flex items-center justify-center hover:bg-red-500/80">
                <Trash2 size={10} className="text-white" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
