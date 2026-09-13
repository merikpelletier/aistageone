import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Save, Plus, X, Upload } from 'lucide-react';
import { toast } from 'sonner';
import SimFieldsEditor from './SimFieldsEditor';

export default function UserCharacterEditor({ theme, character, characters, sets, onBack, onSaved }) {
  const isNew = !character;
  const [form, setForm] = useState({
    name: character?.name || '',
    description: character?.description || '',
    backstory: character?.backstory || '',
    character_type: character?.character_type || 'Hero',
    traits: (character?.traits || []).join(', '),
    photos: character?.photos || [],
    reference_sheet: character?.reference_sheet || '',
    is_active: character?.is_active ?? true,
    sim_starting_story_set_id: character?.sim_starting_story_set_id || null,
    sim_goals: character?.sim_goals || [],
    sim_immediate_needs: character?.sim_immediate_needs || [],
    sim_relationships: character?.sim_relationships || [],
    sim_responsibilities: character?.sim_responsibilities || [],
    sim_controlled_assets: character?.sim_controlled_assets || [],
    sim_starting_knowledge: character?.sim_starting_knowledge || [],
    sim_starting_beliefs: character?.sim_starting_beliefs || [],
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingSheet, setUploadingSheet] = useState(false);
  const [characterTypes, setCharacterTypes] = useState([]);

  useEffect(() => {
    base44.entities.CharacterType.list('order', 100)
      .then(setCharacterTypes)
      .catch(() => {});
  }, []);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleUploadPhotos = async (files) => {
    setUploading(true);
    try {
      const urls = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        urls.push(file_url);
      }
      set('photos', [...form.photos, ...urls]);
      toast.success(`${files.length} photo(s) uploaded`);
    } catch {
      toast.error('Upload failed');
    }
    setUploading(false);
  };

  const handleRemovePhoto = (url) => set('photos', form.photos.filter(p => p !== url));

  const handleUploadSheet = async (file) => {
    setUploadingSheet(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set('reference_sheet', file_url);
      toast.success('Reference sheet uploaded');
    } catch {
      toast.error('Upload failed');
    }
    setUploadingSheet(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.description.trim()) { toast.error('Description is required'); return; }
    if (form.photos.length === 0) { toast.error('Add at least one portrait photo'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        backstory: form.backstory.trim() || null,
        character_type: form.character_type,
        traits: form.traits.split(',').map(t => t.trim()).filter(Boolean),
        photos: form.photos,
        reference_sheet: form.reference_sheet || null,
        is_active: form.is_active,
        sim_starting_story_set_id: form.sim_starting_story_set_id || null,
        sim_goals: form.sim_goals || [],
        sim_immediate_needs: form.sim_immediate_needs || [],
        sim_relationships: form.sim_relationships || [],
        sim_responsibilities: form.sim_responsibilities || [],
        sim_controlled_assets: form.sim_controlled_assets || [],
        sim_starting_knowledge: form.sim_starting_knowledge || [],
        sim_starting_beliefs: form.sim_starting_beliefs || [],
      };
      let result;
      if (isNew) {
        result = await base44.entities.StoryCharacter.create(payload);
        toast.success('Character created!');
      } else {
        result = await base44.entities.StoryCharacter.update(character.id, payload);
        toast.success('Character updated!');
      }
      onSaved?.(result);
    } catch {
      toast.error('Failed to save character');
    }
    setSaving(false);
  };

  const inputClass = "w-full bg-white rounded-2xl border-2 border-black/10 px-4 py-3 text-black text-sm placeholder-black/40 focus:outline-none focus:border-black/30 font-bold";
  const labelClass = "text-black text-xs uppercase tracking-wider font-bold mb-1.5 block";

  return (
    <div className="px-5 pb-20 space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={onBack} className="w-10 h-10 bg-black rounded-xl flex items-center justify-center flex-shrink-0">
          <ArrowLeft size={20} className="text-yellow-400" />
        </button>
        <h2 className="text-black text-xl font-bold">Create Your Character</h2>
      </div>

      {theme && (
        <div className="bg-black/5 rounded-2xl px-3 py-2">
          <p className="text-black text-xs font-bold">For pack: {theme.title}</p>
        </div>
      )}

      {/* Portrait photos */}
      <div>
        <label className={labelClass}>Portrait Photo *</label>
        <p className="text-black/60 text-xs mb-2">Shown on the hero card and to the AI. First photo is used as the thumbnail.</p>
        <div className="flex flex-wrap gap-2">
          {form.photos.map((url, i) => (
            <div key={i} className="relative w-24 h-28 bg-black rounded-xl overflow-hidden group">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => handleRemovePhoto(url)}
                className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center hover:bg-red-500/80"
              >
                <X size={12} className="text-white" />
              </button>
              {i === 0 && (
                <div className="absolute bottom-1 left-1 bg-yellow-400 text-black text-[9px] font-bold px-1.5 py-0.5 rounded">Portrait</div>
              )}
            </div>
          ))}
          <label className="w-24 h-28 bg-black rounded-xl border-2 border-dashed border-white/30 flex flex-col items-center justify-center cursor-pointer hover:border-yellow-400">
            {uploading ? (
              <Loader2 size={20} className="animate-spin text-yellow-400" />
            ) : (
              <>
                <Upload size={18} className="text-yellow-400" />
                <span className="text-yellow-400 text-[10px] mt-1 font-bold">Add Photo</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => { const files = Array.from(e.target.files); if (files.length > 0) handleUploadPhotos(files); }}
            />
          </label>
        </div>
      </div>

      {/* Reference sheet */}
      <div>
        <label className={labelClass}>Reference Sheet (Turnaround)</label>
        <p className="text-black/60 text-xs mb-2">Multi-view sheet the video engine uses for identity consistency (not the portrait).</p>
        <div className="flex items-center gap-3">
          {form.reference_sheet ? (
            <div className="relative w-32 h-28 bg-black rounded-xl overflow-hidden">
              <img src={form.reference_sheet} alt="Reference sheet" className="w-full h-full object-contain" />
              <button
                onClick={() => set('reference_sheet', '')}
                className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center hover:bg-red-500/80"
              >
                <X size={12} className="text-white" />
              </button>
            </div>
          ) : (
            <label className="w-32 h-28 bg-black rounded-xl border-2 border-dashed border-white/30 flex flex-col items-center justify-center cursor-pointer hover:border-yellow-400">
              {uploadingSheet ? (
                <Loader2 size={20} className="animate-spin text-yellow-400" />
              ) : (
                <>
                  <Upload size={18} className="text-yellow-400" />
                  <span className="text-yellow-400 text-[10px] mt-1 font-bold">Add Sheet</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const file = e.target.files?.[0]; if (file) handleUploadSheet(file); }}
              />
            </label>
          )}
        </div>
      </div>

      <div>
        <label className={labelClass}>Name *</label>
        <input
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="e.g. Cassia the Senator"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Character Type</label>
        <select
          value={form.character_type}
          onChange={e => set('character_type', e.target.value)}
          className={inputClass}
        >
          {characterTypes.length > 0 ? (
            characterTypes.map(ct => (
              <option key={ct.id} value={ct.name}>{ct.name}</option>
            ))
          ) : (
            ['Hero', 'Anti-Hero', 'Villain', 'Mentor', 'Ally', 'Sidekick', 'NPC'].map(t => (
              <option key={t} value={t}>{t}</option>
            ))
          )}
        </select>
      </div>

      <div>
        <label className={labelClass}>Description *</label>
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Full character bio, personality, and role — used by the AI to portray this character"
          rows={4}
          className={inputClass + ' resize-none'}
        />
      </div>

      <div>
        <label className={labelClass}>Backstory</label>
        <textarea
          value={form.backstory}
          onChange={e => set('backstory', e.target.value)}
          placeholder="History, origin, motivations, and key past events"
          rows={4}
          className={inputClass + ' resize-none'}
        />
      </div>

      <div>
        <label className={labelClass}>Traits (comma-separated)</label>
        <input
          value={form.traits}
          onChange={e => set('traits', e.target.value)}
          placeholder="e.g. cunning, loyal, ambitious"
          className={inputClass}
        />
      </div>

      <SimFieldsEditor form={form} set={set} characters={characters} sets={sets} />

      <div className="flex gap-3 pt-2">
        <Button
          onClick={onBack}
          variant="ghost"
          className="text-black hover:text-black hover:bg-black/10 flex-1"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-black text-yellow-400 hover:bg-black/90 flex-[2]"
        >
          {saving ? <Loader2 size={16} className="animate-spin mr-1" /> : <Save size={16} className="mr-1" />}
          {isNew ? 'Create Character' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}