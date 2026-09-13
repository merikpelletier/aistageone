import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Upload, Plus, FolderOpen, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCharacterTypes } from '@/hooks/useCharacterTypes';
import { useQuery } from '@tanstack/react-query';

export default function SeriesPageEditor({ page, onChange }) {
  const CHARACTER_TYPES = useCharacterTypes();
  const [showSetPicker, setShowSetPicker] = useState(false);
  const characters = page.series_characters || [];
  const sets = page.series_sets || [];
  const costumes = page.series_costumes || [];

  const { data: userSets = [] } = useQuery({
    queryKey: ['userSets'],
    queryFn: () => base44.entities.SetAsset.list(),
  });

  const updateCharacter = (idx, field, value) => {
    const updated = [...characters];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange({ ...page, series_characters: updated });
  };

  const addCharacter = () => {
    onChange({ ...page, series_characters: [...characters, { name: '', description: '', photo_url: '' }] });
  };

  const removeCharacter = (idx) => {
    onChange({ ...page, series_characters: characters.filter((_, i) => i !== idx) });
  };

  const uploadCharacterPhoto = async (idx, file) => {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    updateCharacter(idx, 'photo_url', file_url);
  };

  const uploadCharacterGallery = async (idx, files) => {
    const urls = await Promise.all(Array.from(files).map(async (file) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      return file_url;
    }));
    const existing = characters[idx].photos || [];
    updateCharacter(idx, 'photos', [...existing, ...urls]);
  };

  const removeCharacterPhoto = (charIdx, photoIdx) => {
    const updated = (characters[charIdx].photos || []).filter((_, i) => i !== photoIdx);
    updateCharacter(charIdx, 'photos', updated);
  };

  const updateCostume = (idx, field, value) => {
    const updated = [...costumes];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange({ ...page, series_costumes: updated });
  };

  const addCostume = () => {
    onChange({ ...page, series_costumes: [...costumes, { name: '', description: '', media: [] }] });
  };

  const removeCostume = (idx) => {
    onChange({ ...page, series_costumes: costumes.filter((_, i) => i !== idx) });
  };

  const uploadCostumeMedia = async (idx, files) => {
    const urls = await Promise.all(Array.from(files).map(async (file) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      return file_url;
    }));
    const existing = costumes[idx].media || [];
    updateCostume(idx, 'media', [...existing, ...urls]);
  };

  const removeCostumeMedia = (costumeIdx, mediaIdx) => {
    const updated = (costumes[costumeIdx].media || []).filter((_, i) => i !== mediaIdx);
    updateCostume(costumeIdx, 'media', updated);
  };

  const updateSet = (idx, field, value) => {
    const updated = [...sets];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange({ ...page, series_sets: updated });
  };

  const addSet = () => {
    onChange({ ...page, series_sets: [...sets, { name: '', description: '', media: [] }] });
  };

  const removeSet = (idx) => {
    onChange({ ...page, series_sets: sets.filter((_, i) => i !== idx) });
  };

  const pickFromLibrary = (setAsset) => {
    const newSet = {
      name: setAsset.name || 'Untitled Set',
      description: setAsset.description || '',
      media: setAsset.images || []
    };
    onChange({ ...page, series_sets: [...sets, newSet] });
    setShowSetPicker(false);
  };

  const uploadSetMedia = async (idx, files) => {
    const urls = await Promise.all(Array.from(files).map(async (file) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      return file_url;
    }));
    const existing = sets[idx].media || [];
    updateSet(idx, 'media', [...existing, ...urls]);
  };

  const removeSetMedia = (setIdx, mediaIdx) => {
    const updated = (sets[setIdx].media || []).filter((_, i) => i !== mediaIdx);
    updateSet(setIdx, 'media', updated);
  };

  return (
    <div className="space-y-6">
      {/* Studio Banner Toggle */}
      <div className="p-3 bg-amber-900/20 border border-amber-600/30 rounded">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="show-studio-banner"
              checked={page.show_studio_banner || false}
              onChange={(e) => onChange({ ...page, show_studio_banner: e.target.checked })}
              className="w-4 h-4 accent-amber-500"
            />
            <label htmlFor="show-studio-banner" className="text-amber-300 text-sm font-medium">
              Show Studio Banner
            </label>
          </div>
          <span className="text-amber-400/60 text-xs">
            {page.show_studio_banner ? 'Banner visible' : 'Banner hidden'}
          </span>
        </div>
        {page.show_studio_banner && (
          <p className="text-amber-200/80 text-xs mt-2 font-semibold tracking-wide">
            AVAILABLE IN THE STUDIO ON THE STAGE SECTION
          </p>
        )}
      </div>

      {/* Series Presentation */}
      <div>
        <label className="text-white text-sm block mb-2">📺 Series presentation</label>
        <Textarea
          value={page.series_presentation || ''}
          onChange={(e) => onChange({ ...page, series_presentation: e.target.value })}
          placeholder="Describe the series — concept, story, universe..."
          className="bg-neutral-900 border-white/10 text-white min-h-[120px]"
          rows={5}
        />
      </div>

      {/* Characters */}
      <div>
        <label className="text-white text-sm block mb-3">🎭 Characters</label>
        <div className="space-y-4">
          {characters.map((char, idx) => (
            <div key={idx} className="p-3 bg-neutral-900 border border-white/10 rounded space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-white text-xs uppercase tracking-wider">Character {idx + 1}</span>
                <button type="button" onClick={() => removeCharacter(idx)} className="text-white hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Photo */}
              <div className="flex items-center gap-3">
                {char.photo_url ? (
                  <img src={char.photo_url} alt="" className="w-16 h-16 object-cover rounded-full flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center flex-shrink-0">
                    <span className="text-white/20 text-xl">?</span>
                  </div>
                )}
                <div className="flex-1 space-y-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => { if (e.target.files?.[0]) uploadCharacterPhoto(idx, e.target.files[0]); }}
                    className="hidden"
                    id={`char-photo-${idx}`}
                  />
                  <label htmlFor={`char-photo-${idx}`}>
                    <Button type="button" size="sm" className="bg-neutral-800 border border-white/20 text-white hover:bg-neutral-700 text-xs" asChild>
                      <span><Upload size={12} className="mr-1" />{char.photo_url ? 'Change photo' : 'Upload photo'}</span>
                    </Button>
                  </label>
                  <Input
                    value={char.photo_url || ''}
                    onChange={(e) => updateCharacter(idx, 'photo_url', e.target.value)}
                    placeholder="Or paste URL"
                    className="bg-neutral-800 border-white/10 text-white text-xs h-7"
                  />
                </div>
              </div>

              <Input
                value={char.name || ''}
                onChange={(e) => updateCharacter(idx, 'name', e.target.value)}
                placeholder="Character name"
                className="bg-neutral-800 border-white/10 text-white"
              />
              <Select value={char.character_type || ''} onValueChange={(value) => updateCharacter(idx, 'character_type', value)}>
                <SelectTrigger className="bg-neutral-800 border-white/10 text-white">
                  <SelectValue placeholder="Character type..." />
                </SelectTrigger>
                <SelectContent>
                  {CHARACTER_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Textarea
                value={char.description || ''}
                onChange={(e) => updateCharacter(idx, 'description', e.target.value)}
                placeholder="Character description"
                className="bg-neutral-800 border-white/10 text-white"
                rows={2}
              />

              {/* Character gallery */}
              <div>
                <p className="text-white text-xs mb-2">Photo gallery</p>
                <div className="grid grid-cols-4 gap-1 mb-2">
                  {(char.photos || []).map((url, pIdx) => (
                    <div key={pIdx} className="relative group">
                      <img src={url} alt="" className="w-full h-16 object-cover rounded" />
                      <button
                        type="button"
                        onClick={() => removeCharacterPhoto(idx, pIdx)}
                        className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                      >×</button>
                    </div>
                  ))}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => { if (e.target.files?.length) uploadCharacterGallery(idx, e.target.files); }}
                  className="hidden"
                  id={`char-gallery-${idx}`}
                />
                <label htmlFor={`char-gallery-${idx}`}>
                  <Button type="button" size="sm" className="w-full bg-neutral-800 border border-white/20 text-white hover:bg-neutral-700 text-xs" asChild>
                    <span><Upload size={12} className="mr-1" />Add photos ({(char.photos || []).length})</span>
                  </Button>
                </label>
              </div>
            </div>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          onClick={addCharacter}
          className="w-full mt-3 bg-neutral-800 border border-white/20 text-white hover:bg-neutral-700"
        >
          <Plus size={14} className="mr-2" />
          Add a character
        </Button>
      </div>

      {/* Costumes */}
      <div>
        <label className="text-white text-sm block mb-3">👗 Costumes</label>
        <div className="space-y-4">
          {costumes.map((costume, idx) => (
            <div key={idx} className="p-3 bg-neutral-900 border border-white/10 rounded space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-white text-xs uppercase tracking-wider">Costume {idx + 1}</span>
                <button type="button" onClick={() => removeCostume(idx)} className="text-white hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
              <Input
                value={costume.name || ''}
                onChange={(e) => updateCostume(idx, 'name', e.target.value)}
                placeholder="Costume name (e.g. Hero Outfit, Evening Gown)"
                className="bg-neutral-800 border-white/10 text-white"
              />
              <Textarea
                value={costume.description || ''}
                onChange={(e) => updateCostume(idx, 'description', e.target.value)}
                placeholder="Costume description"
                className="bg-neutral-800 border-white/10 text-white"
                rows={2}
              />
              <div>
                <p className="text-white text-xs mb-2">Media</p>
                <div className="grid grid-cols-4 gap-1 mb-2">
                  {(costume.media || []).map((url, mIdx) => (
                    <div key={mIdx} className="relative group">
                      {url.match(/\.(mp4|webm|ogg)$/i) ? (
                        <video src={url} className="w-full h-16 object-cover rounded" />
                      ) : (
                        <img src={url} alt="" className="w-full h-16 object-cover rounded" />
                      )}
                      <button
                        type="button"
                        onClick={() => removeCostumeMedia(idx, mIdx)}
                        className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                      >×</button>
                    </div>
                  ))}
                </div>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) => { if (e.target.files?.length) uploadCostumeMedia(idx, e.target.files); }}
                  className="hidden"
                  id={`costume-media-${idx}`}
                />
                <label htmlFor={`costume-media-${idx}`}>
                  <Button type="button" size="sm" className="w-full bg-neutral-800 border border-white/20 text-white hover:bg-neutral-700 text-xs" asChild>
                    <span><Upload size={12} className="mr-1" />Add media ({(costume.media || []).length})</span>
                  </Button>
                </label>
              </div>
            </div>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          onClick={addCostume}
          className="w-full mt-3 bg-neutral-800 border border-white/20 text-white hover:bg-neutral-700"
        >
          <Plus size={14} className="mr-2" />
          Add a costume
        </Button>
      </div>

      {/* Sets */}
      <div>
        <label className="text-white text-sm block mb-3">🎬 Sets</label>
        <div className="space-y-4">
          {sets.map((set, idx) => (
            <div key={idx} className="p-3 bg-neutral-900 border border-white/10 rounded space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-white text-xs uppercase tracking-wider">Set {idx + 1}</span>
                <button type="button" onClick={() => removeSet(idx)} className="text-white hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
              <Input
                value={set.name || ''}
                onChange={(e) => updateSet(idx, 'name', e.target.value)}
                placeholder="Set name (e.g. The Alley, Downtown Rooftop)"
                className="bg-neutral-800 border-white/10 text-white"
              />
              <Textarea
                value={set.description || ''}
                onChange={(e) => updateSet(idx, 'description', e.target.value)}
                placeholder="Set description"
                className="bg-neutral-800 border-white/10 text-white"
                rows={2}
              />
              {/* Media gallery */}
              <div>
                <p className="text-white text-xs mb-2">Media</p>
                <div className="grid grid-cols-4 gap-1 mb-2">
                  {(set.media || []).map((url, mIdx) => (
                    <div key={mIdx} className="relative group">
                      {url.match(/\.(mp4|webm|ogg)$/i) ? (
                        <video src={url} className="w-full h-16 object-cover rounded" />
                      ) : (
                        <img src={url} alt="" className="w-full h-16 object-cover rounded" />
                      )}
                      <button
                        type="button"
                        onClick={() => removeSetMedia(idx, mIdx)}
                        className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                      >×</button>
                    </div>
                  ))}
                </div>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) => { if (e.target.files?.length) uploadSetMedia(idx, e.target.files); }}
                  className="hidden"
                  id={`set-media-${idx}`}
                />
                <label htmlFor={`set-media-${idx}`}>
                  <Button type="button" size="sm" className="w-full bg-neutral-800 border border-white/20 text-white hover:bg-neutral-700 text-xs" asChild>
                    <span><Upload size={12} className="mr-1" />Add media ({(set.media || []).length})</span>
                  </Button>
                </label>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <Button
            type="button"
            size="sm"
            onClick={addSet}
            className="flex-1 bg-neutral-800 border border-white/20 text-white hover:bg-neutral-700"
          >
            <Plus size={14} className="mr-2" />
            Add empty
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setShowSetPicker(true)}
            className="flex-1 bg-yellow-600 border border-yellow-500 text-white hover:bg-yellow-700"
            disabled={userSets.length === 0}
          >
            <FolderOpen size={14} className="mr-2" />
            From Library ({userSets.length})
          </Button>
        </div>

        {/* Set Picker Modal */}
        {showSetPicker && (
          <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-white/10 rounded-xl max-w-md w-full max-h-[70vh] overflow-y-auto">
              <div className="p-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-neutral-900">
                <h3 className="text-white text-sm font-medium">Pick from your sets</h3>
                <button onClick={() => setShowSetPicker(false)} className="text-white hover:text-white">
                  <X size={16} />
                </button>
              </div>
              <div className="p-3 space-y-2">
                {userSets.map(set => (
                  <button
                    key={set.id}
                    onClick={() => pickFromLibrary(set)}
                    className="w-full text-left p-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg flex gap-3"
                  >
                    {set.images?.[0] ? (
                      <img src={set.images[0]} alt="" className="w-16 h-16 object-cover rounded flex-shrink-0" />
                    ) : (
                      <div className="w-16 h-16 bg-neutral-700 rounded flex items-center justify-center flex-shrink-0">
                        <FolderOpen size={20} className="text-white" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{set.name || 'Untitled'}</p>
                      <p className="text-white text-xs truncate">{set.description || 'No description'}</p>
                      <p className="text-white text-xs mt-1">{set.images?.length || 0} images</p>
                    </div>
                  </button>
                ))}
                {userSets.length === 0 && (
                  <p className="text-white text-sm text-center py-8">No sets in your library yet</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}