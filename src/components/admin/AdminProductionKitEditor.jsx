import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Upload, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useCharacterTypes } from '@/hooks/useCharacterTypes';

function MediaGallery({ items = [], onAdd, onRemove, label, accept = "image/*,video/*", inputId }) {
  const inputRef = React.useRef(null);
  return (
    <div>
      <div className="grid grid-cols-4 gap-1 mb-2">
        {items.map((url, idx) => (
          <div key={idx} className="relative group">
            {url.match(/\.(mp4|webm|ogg)$/i) ? (
              <video src={url} className="w-full h-16 object-cover rounded" />
            ) : (
              <img src={url} alt="" className="w-full h-16 object-cover rounded" />
            )}
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
            >×</button>
          </div>
        ))}
      </div>
      <input ref={inputRef} type="file" accept={accept} multiple onChange={onAdd} className="hidden" />
      <Button type="button" size="sm" onClick={() => inputRef.current?.click()} className="w-full bg-neutral-800 border border-white/20 text-white hover:bg-neutral-700 text-xs">
        <Upload size={12} className="mr-1" />{label} ({items.length})
      </Button>
    </div>
  );
}

function CollapsibleSection({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-white/10 rounded">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-white text-sm hover:text-white transition-colors"
      >
        <span>{title}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && <div className="px-3 pb-3 space-y-3">{children}</div>}
    </div>
  );
}

export default function AdminProductionKitEditor({ page, onChange }) {
  const CHARACTER_TYPES = useCharacterTypes();

  const upload = async (files) => {
    return Promise.all(Array.from(files).map(async (file) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      return file_url;
    }));
  };

  // --- Kit Sets ---
  const sets = page.kit_sets || [];
  const updateSet = (idx, field, value) => {
    const current = page.kit_sets || [];
    const updated = [...current];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange({ ...page, kit_sets: updated });
  };
  const addSetMedia = async (idx, e) => {
    const urls = await upload(e.target.files);
    const current = page.kit_sets || [];
    const updated = [...current];
    updated[idx] = { ...updated[idx], media: [...(updated[idx].media || []), ...urls] };
    onChange({ ...page, kit_sets: updated });
  };
  const removeSetMedia = (sIdx, mIdx) => {
    const current = page.kit_sets || [];
    const updated = [...current];
    updated[sIdx] = { ...updated[sIdx], media: updated[sIdx].media.filter((_, i) => i !== mIdx) };
    onChange({ ...page, kit_sets: updated });
  };

  // --- Kit Characters ---
  const chars = page.kit_characters || [];
  const updateChar = (idx, field, value) => {
    const current = page.kit_characters || [];
    const updated = [...current];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange({ ...page, kit_characters: updated });
  };
  const uploadCharPhoto = async (idx, file) => {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const current = page.kit_characters || [];
    const updated = [...current];
    updated[idx] = { ...updated[idx], photo_url: file_url };
    onChange({ ...page, kit_characters: updated });
  };
  const addCharMedia = async (idx, e) => {
    const urls = await upload(e.target.files);
    const current = page.kit_characters || [];
    const updated = [...current];
    updated[idx] = { ...updated[idx], media: [...(updated[idx].media || []), ...urls] };
    onChange({ ...page, kit_characters: updated });
  };
  const removeCharMedia = (cIdx, mIdx) => {
    const current = page.kit_characters || [];
    const updated = [...current];
    updated[cIdx] = { ...updated[cIdx], media: updated[cIdx].media.filter((_, i) => i !== mIdx) };
    onChange({ ...page, kit_characters: updated });
  };

  // --- Kit Costumes ---
  const costumes = page.kit_costumes || [];
  const updateCostume = (idx, field, value) => {
    const current = page.kit_costumes || [];
    const updated = [...current];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange({ ...page, kit_costumes: updated });
  };
  const addCostumeMedia = async (idx, e) => {
    const urls = await upload(e.target.files);
    const current = page.kit_costumes || [];
    const updated = [...current];
    updated[idx] = { ...updated[idx], media: [...(updated[idx].media || []), ...urls] };
    onChange({ ...page, kit_costumes: updated });
  };
  const removeCostumeMedia = (cIdx, mIdx) => {
    const current = page.kit_costumes || [];
    const updated = [...current];
    updated[cIdx] = { ...updated[cIdx], media: updated[cIdx].media.filter((_, i) => i !== mIdx) };
    onChange({ ...page, kit_costumes: updated });
  };

  // --- Reference Media ---
  const refMedia = page.kit_reference_media || [];
  const addRefMedia = async (e) => {
    const urls = await upload(e.target.files);
    onChange({ ...page, kit_reference_media: [...refMedia, ...urls] });
  };
  const removeRefMedia = (idx) => {
    onChange({ ...page, kit_reference_media: refMedia.filter((_, i) => i !== idx) });
  };

  const uploadCover = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onChange({ ...page, media_url: file_url });
  };

  return (
    <div className="space-y-5">
      {/* Cover media */}
      <div>
        <label className="text-white text-sm block mb-2">🖼️ Cover image / video</label>
        {page.media_url && (
          page.media_url.match(/\.(mp4|webm|ogg)$/i) ? (
            <video src={page.media_url} controls className="w-full rounded mb-2" style={{ maxHeight: '180px' }} />
          ) : (
            <img src={page.media_url} alt="" className="w-full rounded mb-2 object-cover" style={{ maxHeight: '180px' }} />
          )
        )}
        <input type="file" accept="image/*,video/*" onChange={uploadCover} className="hidden" id="kit-cover-upload" />
        <Button type="button" size="sm" onClick={() => document.getElementById('kit-cover-upload').click()} className="w-full bg-neutral-800 border border-white/20 text-white hover:bg-neutral-700 text-xs">
          <Upload size={12} className="mr-1" />{page.media_url ? 'Change cover' : 'Add cover'}
        </Button>
      </div>

      {/* Description */}
      <div>
        <label className="text-white text-sm block mb-2">🎬 Kit description</label>
        <Textarea
          value={page.kit_description || ''}
          onChange={(e) => onChange({ ...page, kit_description: e.target.value })}
          placeholder="Overview of the production — story, universe, tone..."
          className="bg-neutral-900 border-white/10 text-white min-h-[100px]"
          rows={4}
        />
      </div>

      {/* SETS */}
      <div>
        <label className="text-white text-sm block mb-2">🏙️ Sets</label>
        <div className="space-y-3">
          {sets.map((set, idx) => (
            <CollapsibleSection key={idx} title={set.name || `Set ${idx + 1}`} defaultOpen={idx === 0}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-white text-xs">Set {idx + 1}</span>
                <button type="button" onClick={() => onChange({ ...page, kit_sets: sets.filter((_, i) => i !== idx) })} className="text-white hover:text-red-500">
                  <Trash2 size={13} />
                </button>
              </div>
              <Input value={set.name || ''} onChange={(e) => updateSet(idx, 'name', e.target.value)} placeholder="Set name" className="bg-neutral-800 border-white/10 text-white" />
              <Textarea value={set.description || ''} onChange={(e) => updateSet(idx, 'description', e.target.value)} placeholder="Description" className="bg-neutral-800 border-white/10 text-white" rows={2} />
              <MediaGallery
                items={set.media || []}
                onAdd={(e) => addSetMedia(idx, e)}
                onRemove={(mIdx) => removeSetMedia(idx, mIdx)}
                label="Add set media"
                inputId={`kit-set-media-${idx}`}
              />
            </CollapsibleSection>
          ))}
        </div>
        <Button type="button" size="sm" onClick={() => onChange({ ...page, kit_sets: [...sets, { name: '', description: '', media: [] }] })} className="w-full mt-2 bg-neutral-800 border border-white/20 text-white hover:bg-neutral-700">
          <Plus size={13} className="mr-1" /> Add a set
        </Button>
      </div>

      {/* CHARACTERS */}
      <div>
        <label className="text-white text-sm block mb-2">🎭 Characters</label>
        <div className="space-y-3">
          {chars.map((char, idx) => (
            <CollapsibleSection key={idx} title={char.name || `Character ${idx + 1}`} defaultOpen={idx === 0}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-white text-xs">Character {idx + 1}</span>
                <button type="button" onClick={() => onChange({ ...page, kit_characters: chars.filter((_, i) => i !== idx) })} className="text-white hover:text-red-500">
                  <Trash2 size={13} />
                </button>
              </div>
              {/* Main photo */}
              <div className="flex items-center gap-3">
                {char.photo_url ? (
                  <img src={char.photo_url} alt="" className="w-14 h-14 object-cover rounded-full flex-shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-neutral-800 flex items-center justify-center flex-shrink-0 text-white/20 text-xl">?</div>
                )}
                <div className="flex-1">
                  <input type="file" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) uploadCharPhoto(idx, e.target.files[0]); }} className="hidden" id={`kit-char-photo-${idx}`} />
                  <Button type="button" size="sm" onClick={() => document.getElementById(`kit-char-photo-${idx}`).click()} className="bg-neutral-800 border border-white/20 text-white hover:bg-neutral-700 text-xs">
                    <Upload size={12} className="mr-1" />Main photo
                  </Button>
                </div>
              </div>
              <Input value={char.name || ''} onChange={(e) => updateChar(idx, 'name', e.target.value)} placeholder="Character name" className="bg-neutral-800 border-white/10 text-white" />
              <Select value={char.character_type || ''} onValueChange={(value) => updateChar(idx, 'character_type', value)}>
                <SelectTrigger className="bg-neutral-800 border-white/10 text-white">
                  <SelectValue placeholder="Character type..." />
                </SelectTrigger>
                <SelectContent>
                  {CHARACTER_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Textarea value={char.description || ''} onChange={(e) => updateChar(idx, 'description', e.target.value)} placeholder="Character description" className="bg-neutral-800 border-white/10 text-white" rows={2} />
              <div>
                <p className="text-white text-xs mb-1">Reference gallery</p>
                <MediaGallery
                  items={char.media || []}
                  onAdd={(e) => addCharMedia(idx, e)}
                  onRemove={(mIdx) => removeCharMedia(idx, mIdx)}
                  label="Add reference photos/videos"
                  inputId={`kit-char-media-${idx}`}
                />
              </div>
            </CollapsibleSection>
          ))}
        </div>
        <Button type="button" size="sm" onClick={() => onChange({ ...page, kit_characters: [...chars, { name: '', description: '', photo_url: '', media: [] }] })} className="w-full mt-2 bg-neutral-800 border border-white/20 text-white hover:bg-neutral-700">
          <Plus size={13} className="mr-1" /> Add a character
        </Button>
      </div>

      {/* COSTUMES */}
      <div>
        <label className="text-white text-sm block mb-2">👗 Costumes</label>
        <div className="space-y-3">
          {costumes.map((costume, idx) => (
            <CollapsibleSection key={idx} title={costume.name || `Costume ${idx + 1}`} defaultOpen={idx === 0}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-white text-xs">Costume {idx + 1}</span>
                <button type="button" onClick={() => onChange({ ...page, kit_costumes: costumes.filter((_, i) => i !== idx) })} className="text-white hover:text-red-500">
                  <Trash2 size={13} />
                </button>
              </div>
              <Input value={costume.name || ''} onChange={(e) => updateCostume(idx, 'name', e.target.value)} placeholder="Costume name" className="bg-neutral-800 border-white/10 text-white" />
              <Textarea value={costume.description || ''} onChange={(e) => updateCostume(idx, 'description', e.target.value)} placeholder="Description" className="bg-neutral-800 border-white/10 text-white" rows={2} />
              <MediaGallery
                items={costume.media || []}
                onAdd={(e) => addCostumeMedia(idx, e)}
                onRemove={(mIdx) => removeCostumeMedia(idx, mIdx)}
                label="Add costume media"
                inputId={`kit-costume-media-${idx}`}
              />
            </CollapsibleSection>
          ))}
        </div>
        <Button type="button" size="sm" onClick={() => onChange({ ...page, kit_costumes: [...costumes, { name: '', description: '', media: [] }] })} className="w-full mt-2 bg-neutral-800 border border-white/20 text-white hover:bg-neutral-700">
          <Plus size={13} className="mr-1" /> Add a costume
        </Button>
      </div>

      {/* REFERENCE MEDIA */}
      <div>
        <label className="text-white text-sm block mb-2">📎 Reference media</label>
        <MediaGallery
          items={refMedia}
          onAdd={addRefMedia}
          onRemove={removeRefMedia}
          label="Add reference media"
          inputId="kit-ref-media"
        />
      </div>
    </div>
  );
}