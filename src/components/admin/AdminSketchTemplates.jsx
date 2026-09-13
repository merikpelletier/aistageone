import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Pencil, Trash2, X, Loader2, ImagePlus, Sparkles, Copy } from 'lucide-react';
import { toast } from 'sonner';

const EMPTY = {
  name: '',
  category: 'comedy',
  description: '',
  scenario: '',
  default_duration: 5,
  default_aspect_ratio: '9:16',
  cover_image: '',
  base_scene_image: '',
  base_scene_prompt: '',
  video_prompt: '',
  transformation_prompt: '',
  is_active: true,
  order: 0,
};

function ThemeEditor({ template, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(template || { ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generatingBase, setGeneratingBase] = useState(false);
  const isEdit = !!template?.id;

  const setField = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleCoverUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setField('cover_image', file_url);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleBaseSceneUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setField('base_scene_image', file_url);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateBaseScene = async () => {
    const custom = (form.base_scene_prompt || '').trim();
    if (!custom) return;
    const ratio = form.default_aspect_ratio || '9:16';
    const orientation =
      ratio === '9:16' ? 'vertical portrait 9:16' :
      ratio === '16:9' ? 'horizontal landscape 16:9' :
      'square 1:1';
    const prompt = `${orientation}. ${custom}`;
    setGeneratingBase(true);
    try {
      const res = await base44.integrations.Core.GenerateImage({ prompt });
      const url = res?.url || res?.file_url;
      if (url) {
        setField('base_scene_image', url);
        toast.success('Base scene generated');
      } else {
        toast.error('Image generation returned no URL');
      }
    } catch (err) {
      console.error(err);
      toast.error(err?.message || 'Image generation failed');
    } finally {
      setGeneratingBase(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.scenario.trim()) return;
    setSaving(true);
    try {
      if (isEdit) {
        await base44.entities.SketchTemplate.update(form.id, form);
      } else {
        await base44.entities.SketchTemplate.create(form);
      }
      qc.invalidateQueries({ queryKey: ['sketchTemplates', 'admin'] });
      qc.invalidateQueries({ queryKey: ['sketchTemplates', 'active'] });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-yellow-400 w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 sticky top-0 bg-yellow-400">
          <div>
            <p className="text-black/50 text-[10px] tracking-[0.2em] uppercase font-bold">{isEdit ? 'Edit' : 'New'} theme</p>
            <h3 className="text-black text-xl font-bold">Funny theme</h3>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-black/10 flex items-center justify-center text-black hover:bg-black/20">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Cover */}
          <div>
            <label className="text-black/70 text-xs uppercase tracking-wide font-bold">Cover image</label>
            <div className="mt-1 flex items-center gap-3">
              <label className="relative w-24 h-24 rounded-2xl bg-white/60 border-2 border-dashed border-black/25 flex items-center justify-center cursor-pointer overflow-hidden flex-shrink-0">
                {form.cover_image ? (
                  <img src={form.cover_image} alt="cover" className="w-full h-full object-cover" />
                ) : uploading ? (
                  <Loader2 size={22} className="animate-spin text-black/50" />
                ) : (
                  <ImagePlus size={24} className="text-black/40" />
                )}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleCoverUpload(e.target.files?.[0])} />
              </label>
              <p className="text-black/50 text-xs">Tap to upload a thumbnail for the theme card. Optional.</p>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-black/70 text-xs uppercase tracking-wide font-bold">Name</label>
            <input
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="e.g. Bus Splash"
              className="w-full bg-white border-2 border-black/15 rounded-xl px-4 py-3 mt-1 text-base text-black font-medium focus:border-black outline-none"
              autoFocus
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-black/70 text-xs uppercase tracking-wide font-bold">Category</label>
            <div className="flex gap-2 mt-1">
              {[{ v: 'comedy', l: 'Comedy' }, { v: 'character_intro', l: 'Character Intro' }].map((c) => (
                <button
                  key={c.v}
                  onClick={() => setField('category', c.v)}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${form.category === c.v ? 'bg-black text-yellow-400' : 'bg-white/60 text-black border border-black/15'}`}
                >
                  {c.l}
                </button>
              ))}
            </div>
          </div>

          {/* Base scene image — the anchor for character replacement */}
          <div className="bg-black/5 rounded-2xl p-3 border border-black/10">
            <label className="text-black text-xs uppercase tracking-wide font-bold">Base scene image</label>
            <p className="text-black/50 text-xs mb-2">
              The funny scene photo with a placeholder character. The user's uploaded face is swapped onto this character, then animated. Upload a clear shot framed to match the chosen aspect ratio.
            </p>
            <div className="mb-2">
              <label className="text-black/70 text-xs uppercase tracking-wide font-bold">Image prompt</label>
              <p className="text-black/50 text-xs mb-1">The exact prompt sent to the image AI. Required — the base image won't generate without it.</p>
              <textarea
                value={form.base_scene_prompt}
                onChange={(e) => setField('base_scene_prompt', e.target.value)}
                rows={3}
                placeholder="e.g. A man standing at a bus stop on a rainy city street, full body, front-facing, splashed by muddy water from a passing car, exaggerated shock, cinematic, realistic"
                className="w-full bg-white border-2 border-black/15 rounded-xl px-3 py-2 text-sm text-black focus:border-black outline-none"
              />
            </div>
            <div className="flex items-start gap-3">
              <div className="relative w-24 h-32 rounded-2xl bg-white/60 border-2 border-dashed border-black/25 flex items-center justify-center overflow-hidden flex-shrink-0">
                {form.base_scene_image ? (
                  <img src={form.base_scene_image} alt="base scene" className="w-full h-full object-cover" />
                ) : generatingBase ? (
                  <Loader2 size={22} className="animate-spin text-black/50" />
                ) : (
                  <ImagePlus size={24} className="text-black/40" />
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <p className="text-black/50 text-xs">
                  {form.base_scene_image ? 'Base scene generated. The character in this photo will be replaced by the user.' : 'Generated from the scenario text using AI.'}
                </p>
                <button
                  onClick={handleGenerateBaseScene}
                  disabled={generatingBase || !(form.base_scene_prompt || '').trim()}
                  className="self-start bg-black text-yellow-400 text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                >
                  {generatingBase ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {form.base_scene_image ? 'Regenerate' : 'Generate base scene'}
                </button>
                {form.base_scene_image && (
                  <button onClick={() => setField('base_scene_image', '')} className="text-black/60 text-xs font-bold underline underline-offset-2 self-start">
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Video prompt — the EXACT prompt sent to the video model */}
          <div className="bg-black/5 rounded-2xl p-3 border border-black/10">
            <label className="text-black text-xs uppercase tracking-wide font-bold">Video prompt</label>
            <p className="text-black/50 text-xs mb-1">The exact prompt sent to the video AI (Seedance) when a user generates this sketch. This is your direct control over the generated video. Required to generate.</p>
            <textarea
              value={form.video_prompt}
              onChange={(e) => setField('video_prompt', e.target.value)}
              rows={4}
              placeholder="e.g. Image-to-video animation. The person shown in the reference photo is the main character. Animate them acting out the scene with natural lively motion and comedic timing."
              className="w-full bg-white border-2 border-black/15 rounded-xl px-3 py-2 text-sm text-black focus:border-black outline-none"
            />
          </div>

          {/* Transformation prompt (optional) — enables the drag-morph pipeline */}
          <div className="bg-black/5 rounded-2xl p-3 border border-black/10">
            <label className="text-black text-xs uppercase tracking-wide font-bold">Transformation prompt (optional)</label>
            <p className="text-black/50 text-xs mb-1">
              If set, this theme uses the transformation-morph pipeline: FLUX Kontext restyles the user's photo into the look you describe here (keeping their face), then Kling v2.1 interpolates between the original photo and the restyled image to create an on-screen transformation. Describe the END STATE look only. Leave empty for normal sketches.
            </p>
            <textarea
              value={form.transformation_prompt}
              onChange={(e) => setField('transformation_prompt', e.target.value)}
              rows={4}
              placeholder="e.g. Transform this person into a glamorous drag queen: full dramatic makeup, big blonde bouffant wig, sparkling sequin gown, chandelier earrings, long lashes. Keep the exact same face, pose and background."
              className="w-full bg-white border-2 border-black/15 rounded-xl px-3 py-2 text-sm text-black focus:border-black outline-none"
            />
          </div>

          {/* Scenario */}
          <div>
            <label className="text-black/70 text-xs uppercase tracking-wide font-bold">Scenario</label>
            <p className="text-black/50 text-xs mb-1">The funny situation the user's photo is placed into. Write it as a scene.</p>
            <textarea
              value={form.scenario}
              onChange={(e) => setField('scenario', e.target.value)}
              rows={4}
              placeholder="You're waiting for the bus and a passing car splashes you with muddy water."
              className="w-full bg-white border-2 border-black/15 rounded-xl px-4 py-3 text-sm text-black focus:border-black outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-black/70 text-xs uppercase tracking-wide font-bold">Subtitle (optional)</label>
            <input
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="One line shown under the name"
              className="w-full bg-white border-2 border-black/15 rounded-xl px-4 py-3 mt-1 text-sm text-black focus:border-black outline-none"
            />
          </div>

          {/* Settings */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-black/70 text-xs uppercase tracking-wide font-bold">Duration</label>
              <select value={form.default_duration} onChange={(e) => setField('default_duration', Number(e.target.value))} className="w-full bg-white border border-black/15 rounded-lg px-2 py-2 mt-1 text-sm text-black">
                <option value={5}>5s</option>
                <option value={10}>10s</option>
              </select>
            </div>
            <div>
              <label className="text-black/70 text-xs uppercase tracking-wide font-bold">Aspect</label>
              <select value={form.default_aspect_ratio} onChange={(e) => setField('default_aspect_ratio', e.target.value)} className="w-full bg-white border border-black/15 rounded-lg px-2 py-2 mt-1 text-sm text-black">
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
                <option value="1:1">1:1</option>
              </select>
            </div>
            <div>
              <label className="text-black/70 text-xs uppercase tracking-wide font-bold">Order</label>
              <input type="number" value={form.order} onChange={(e) => setField('order', Number(e.target.value))} className="w-full bg-white border border-black/15 rounded-lg px-2 py-2 mt-1 text-sm text-black" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-black text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setField('is_active', e.target.checked)} />
            Active (visible in Sketch Generator)
          </label>
        </div>

        <div className="px-5 py-4 border-t border-black/15 bg-yellow-400 sticky bottom-0 flex gap-3">
          <button onClick={onClose} className="px-5 py-3 rounded-xl bg-black/10 text-black font-bold">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim() || !form.scenario.trim()}
            className="flex-1 bg-black text-yellow-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : null} {isEdit ? 'Save changes' : 'Create theme'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminSketchTemplates() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null); // null | false(new) | obj
  const [deletingId, setDeletingId] = useState(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['sketchTemplates', 'admin'],
    queryFn: () => base44.entities.SketchTemplate.list('order', 200),
  });

  const handleDelete = async (id) => {
    if (!confirm('Delete this theme?')) return;
    setDeletingId(id);
    try {
      await base44.entities.SketchTemplate.delete(id);
      qc.invalidateQueries({ queryKey: ['sketchTemplates', 'admin'] });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDuplicate = (t) => {
    const { id, created_date, updated_date, created_by_id, ...rest } = t;
    setEditing({ ...rest, name: `${t.name} (copy)` });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white text-lg font-light tracking-wide">Sketch Themes</h2>
        <button onClick={() => setEditing(false)} className="bg-white text-black px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
          <Plus size={16} /> New theme
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-white/50" /></div>
      ) : templates.length === 0 ? (
        <p className="text-white/50 text-sm text-center py-10">No themes yet. Create one to get started.</p>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center gap-3 bg-neutral-900 border border-white/10 rounded-lg p-3">
              {t.cover_image ? (
                <img src={t.cover_image} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-yellow-400/20 flex items-center justify-center flex-shrink-0">
                  <ImagePlus size={18} className="text-yellow-400/60" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{t.name}</p>
                <p className="text-white/40 text-xs truncate">
                  {t.category === 'comedy' ? 'Comedy' : 'Character Intro'} · {t.is_active ? 'Active' : 'Hidden'} · {t.base_scene_image ? 'Has base scene' : 'No base scene'}
                </p>
              </div>
              <button onClick={() => handleDuplicate(t)} className="text-white/60 hover:text-white p-2" title="Duplicate"><Copy size={16} /></button>
              <button onClick={() => setEditing(t)} className="text-white/60 hover:text-white p-2"><Pencil size={16} /></button>
              <button onClick={() => handleDelete(t.id)} disabled={deletingId === t.id} className="text-red-400 hover:text-red-300 p-2">
                {deletingId === t.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              </button>
            </div>
          ))}
        </div>
      )}

      {editing !== null && <ThemeEditor template={editing || null} onClose={() => setEditing(null)} />}
    </div>
  );
}