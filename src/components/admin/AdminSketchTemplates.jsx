import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Pencil, Trash2, X, Loader2, ImagePlus, Sparkles, Copy, Film, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAiModelOptions } from '@/hooks/useAiModelOptions';
import { useAiPriceQuote } from '@/hooks/useAiPriceQuote';

const EMPTY = {
  name: '', output_type: 'video', category: 'comedy', description: '', scenario: '',
  default_duration: 5, default_aspect_ratio: '9:16', cover_image: '', base_scene_image: '',
  base_scene_prompt: '', image_prompt: '', video_prompt: '', transformation_prompt: '',
  styles: [], is_active: true, order: 0,
};

function ThemeEditor({ template, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY, ...(template || {}), output_type: template?.output_type || 'video', styles: Array.isArray(template?.styles) ? template.styles : [] });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [styleUploading, setStyleUploading] = useState(null);
  const [generatingBase, setGeneratingBase] = useState(false);
  const [selectedBaseModel, setSelectedBaseModel] = useState(null);
  const isEdit = !!template?.id;
  const isImage = form.output_type === 'image';

  const baseRatio = form.default_aspect_ratio || '9:16';
  const basePromptText = (form.base_scene_prompt || '').trim();
  const basePricingInput = { prompt: basePromptText, aspect_ratio: baseRatio };
  const { options: baseModelOptions, loading: baseModelsLoading } = useAiModelOptions({ service: 'replicateGenerate:compose_scene', kind: 'image', input: basePricingInput, enabled: !isImage });
  const effectiveBaseModel = selectedBaseModel || baseModelOptions.find(m => m.recommended)?.model_key || baseModelOptions[0]?.model_key || null;
  const { quote: basePriceQuote, loading: basePriceLoading } = useAiPriceQuote({ service: 'replicateGenerate:compose_scene', kind: 'image', input: basePricingInput, modelKey: effectiveBaseModel, enabled: !isImage });

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setStyle = (index, key, value) => setForm((f) => ({ ...f, styles: f.styles.map((s, i) => i === index ? { ...s, [key]: value } : s) }));
  const addStyle = () => setForm((f) => ({ ...f, styles: [...f.styles, { name: '', preview_image: '', prompt: '' }] }));
  const removeStyle = (index) => setForm((f) => ({ ...f, styles: f.styles.filter((_, i) => i !== index) }));

  const uploadFile = async (file) => {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    return file_url;
  };

  const handleCoverUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try { setField('cover_image', await uploadFile(file)); }
    catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const handleStylePreviewUpload = async (index, file) => {
    if (!file) return;
    setStyleUploading(index);
    try { setStyle(index, 'preview_image', await uploadFile(file)); }
    catch { toast.error('Preview upload failed'); }
    finally { setStyleUploading(null); }
  };

  const handleGenerateBaseScene = async () => {
    const custom = (form.base_scene_prompt || '').trim();
    if (!custom) return;
    const ratio = form.default_aspect_ratio || '9:16';
    const orientation = ratio === '9:16' ? 'vertical portrait 9:16' : ratio === '16:9' ? 'horizontal landscape 16:9' : 'square 1:1';
    setGeneratingBase(true);
    try {
      const res = await base44.functions.invoke('replicateGenerate', { method: 'compose_scene', prompt: `${orientation}. ${custom}`, aspect_ratio: ratio, model_key: effectiveBaseModel || undefined });
      const url = res?.data?.file_url || res?.file_url;
      if (!url) throw new Error('Image generation returned no URL');
      setField('base_scene_image', url);
      toast.success('Base scene generated');
    } catch (err) { toast.error(err?.message || 'Image generation failed'); }
    finally { setGeneratingBase(false); }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.scenario.trim()) return;
    if (isImage && !(form.image_prompt || '').trim() && !form.styles.some(s => (s.prompt || '').trim())) { toast.error('Add a default image prompt or at least one style prompt'); return; }
    if (!isImage && !(form.video_prompt || '').trim()) { toast.error('Add a video prompt'); return; }
    const cleanStyles = form.styles
      .map(s => ({ name: (s.name || '').trim(), preview_image: s.preview_image || '', prompt: (s.prompt || '').trim() }))
      .filter(s => s.name && s.prompt);
    setSaving(true);
    try {
      const payload = { ...form, styles: cleanStyles, output_type: isImage ? 'image' : 'video' };
      if (isEdit) await base44.entities.SketchTemplate.update(form.id, payload);
      else await base44.entities.SketchTemplate.create(payload);
      qc.invalidateQueries({ queryKey: ['sketchTemplates', 'admin'] });
      qc.invalidateQueries({ queryKey: ['sketchTemplates', 'active'] });
      onClose();
    } catch (err) { console.error(err); toast.error('Unable to save Stage'); }
    finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4">
    <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-[4px] bg-[#202328] text-white sm:max-w-3xl sm:rounded-[4px]">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#202328] px-5 py-4">
        <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#23c7be]">{isEdit ? 'Edit' : 'New'} Stage</p><h3 className="text-xl font-black">{form.name || 'Stage template'}</h3></div>
        <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-[3px] border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10"><X size={18}/></button>
      </div>

      <div className="space-y-4 p-5">
        <div><label className="text-[10px] font-black uppercase tracking-wide text-white/50">Output</label><div className="mt-2 grid grid-cols-2 gap-2">
          <button onClick={() => setField('output_type', 'video')} className={`flex items-center justify-center gap-2 rounded-[3px] border py-3 text-sm font-black ${!isImage ? 'border-[#23c7be]/40 bg-[#23c7be]/10 text-[#8ee9e4]' : 'border-white/10 bg-white/[0.03] text-white/60'}`}><Film size={16}/> Video</button>
          <button onClick={() => setField('output_type', 'image')} className={`flex items-center justify-center gap-2 rounded-[3px] border py-3 text-sm font-black ${isImage ? 'border-[#23c7be]/40 bg-[#23c7be]/10 text-[#8ee9e4]' : 'border-white/10 bg-white/[0.03] text-white/60'}`}><ImageIcon size={16}/> Image</button>
        </div></div>

        <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
          <div><label className="text-[10px] font-black uppercase tracking-wide text-white/50">Cover</label><label className="mt-2 flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-[3px] border border-dashed border-white/20 bg-[#17191d]">{form.cover_image ? <img src={form.cover_image} alt="cover" className="h-full w-full object-cover"/> : uploading ? <Loader2 size={22} className="animate-spin text-[#23c7be]"/> : <ImagePlus size={24} className="text-white/35"/>}<input type="file" accept="image/*" className="hidden" onChange={(e) => handleCoverUpload(e.target.files?.[0])}/></label></div>
          <div className="space-y-4">
            <div><label className="text-[10px] font-black uppercase tracking-wide text-white/50">Name</label><input value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder={isImage ? 'e.g. Portrait' : 'e.g. Bus Splash'} className="mt-1 w-full rounded-[3px] border border-white/10 bg-[#17191d] px-3 py-2.5 text-sm text-white outline-none focus:border-[#23c7be]/60"/></div>
            <div><label className="text-[10px] font-black uppercase tracking-wide text-white/50">Category</label><div className="mt-1 grid grid-cols-2 gap-2">{[{v:'comedy',l:'Comedy'},{v:'character_intro',l:'Character Intro'}].map(c => <button key={c.v} onClick={() => setField('category', c.v)} className={`rounded-[3px] border py-2 text-xs font-black ${form.category === c.v ? 'border-[#23c7be]/40 bg-[#23c7be]/10 text-[#8ee9e4]' : 'border-white/10 bg-white/[0.03] text-white/60'}`}>{c.l}</button>)}</div></div>
          </div>
        </div>

        {isImage ? <>
          <div className="rounded-[4px] border border-[#23c7be]/25 bg-[#17191d] p-4"><label className="text-[10px] font-black uppercase tracking-wide text-[#8ee9e4]">Default image prompt</label><p className="mt-1 text-xs text-white/40">Used when this Stage has no style selected.</p><textarea value={form.image_prompt || ''} onChange={(e) => setField('image_prompt', e.target.value)} rows={3} placeholder="Base prompt for this image Stage..." className="mt-2 w-full resize-none rounded-[3px] border border-white/10 bg-[#26292d] p-3 text-sm text-white outline-none focus:border-[#23c7be]/60"/></div>

          <div className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
            <div className="mb-3 flex items-center justify-between gap-3"><div><label className="text-[10px] font-black uppercase tracking-wide text-[#8ee9e4]">Styles</label><p className="mt-1 text-xs text-white/40">Add as many selectable looks as you want. Each one has its own prompt.</p></div><button onClick={addStyle} className="flex items-center gap-2 rounded-[3px] bg-[#23c7be] px-3 py-2 text-xs font-black text-[#071211]"><Plus size={14}/> Add style</button></div>
            {form.styles.length === 0 ? <div className="rounded-[3px] border border-dashed border-white/15 p-5 text-center text-xs text-white/35">No styles yet.</div> : <div className="space-y-3">{form.styles.map((style, index) => <div key={index} className="grid gap-3 rounded-[3px] border border-white/10 bg-[#202328] p-3 md:grid-cols-[92px_minmax(0,1fr)_36px]">
              <label className="flex h-[92px] cursor-pointer items-center justify-center overflow-hidden rounded-[3px] border border-dashed border-white/15 bg-[#17191d]">{style.preview_image ? <img src={style.preview_image} alt="" className="h-full w-full object-cover"/> : styleUploading === index ? <Loader2 size={18} className="animate-spin text-[#23c7be]"/> : <ImagePlus size={20} className="text-white/25"/>}<input type="file" accept="image/*" className="hidden" onChange={(e) => handleStylePreviewUpload(index, e.target.files?.[0])}/></label>
              <div className="space-y-2"><input value={style.name || ''} onChange={(e) => setStyle(index, 'name', e.target.value)} placeholder="Style name — e.g. Editorial" className="w-full rounded-[3px] border border-white/10 bg-[#17191d] px-3 py-2 text-sm text-white outline-none focus:border-[#23c7be]/60"/><textarea value={style.prompt || ''} onChange={(e) => setStyle(index, 'prompt', e.target.value)} rows={3} placeholder="Prompt for this style..." className="w-full resize-none rounded-[3px] border border-white/10 bg-[#17191d] p-3 text-sm text-white outline-none focus:border-[#23c7be]/60"/></div>
              <button onClick={() => removeStyle(index)} className="flex h-9 w-9 items-center justify-center rounded-[3px] border border-red-400/20 bg-red-400/5 text-red-300"><Trash2 size={15}/></button>
            </div>)}</div>}
          </div>
        </> : <>
          <div className="rounded-[4px] border border-white/10 bg-[#17191d] p-4"><label className="text-[10px] font-black uppercase tracking-wide text-white/55">Base scene</label><select value={effectiveBaseModel || ''} onChange={e => setSelectedBaseModel(e.target.value || null)} disabled={baseModelsLoading || baseModelOptions.length === 0} className="mt-3 w-full rounded-[3px] border border-white/10 bg-[#26292d] px-3 py-2 text-sm text-white disabled:opacity-50">{baseModelsLoading && <option value="">Loading models…</option>}{!baseModelsLoading && baseModelOptions.length === 0 && <option value="">No model available</option>}{baseModelOptions.map(m => <option key={m.model_key} value={m.model_key}>{m.name || m.model_key}{m.recommended ? ' — Recommended' : ''}{m.credits ? ` — ${m.credits} credits` : ''}</option>)}</select><div className="mt-1 flex justify-between text-[11px] text-white/35"><span>AI cost</span><span>{basePriceLoading ? 'Calculating…' : basePriceQuote?.credits ? `${basePriceQuote.credits} credits` : 'Calculated automatically'}</span></div><textarea value={form.base_scene_prompt || ''} onChange={(e) => setField('base_scene_prompt', e.target.value)} rows={3} placeholder="Describe the base scene..." className="mt-3 w-full resize-none rounded-[3px] border border-white/10 bg-[#26292d] p-3 text-sm text-white outline-none focus:border-[#23c7be]/60"/><div className="mt-3 flex items-start gap-3"><div className="flex h-28 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-[3px] border border-dashed border-white/15 bg-black/20">{form.base_scene_image ? <img src={form.base_scene_image} alt="base scene" className="h-full w-full object-cover"/> : <ImagePlus size={22} className="text-white/25"/>}</div><button onClick={handleGenerateBaseScene} disabled={generatingBase || !(form.base_scene_prompt || '').trim()} className="flex items-center gap-2 rounded-[3px] bg-[#23c7be] px-3 py-2 text-xs font-black text-[#071211] disabled:opacity-40">{generatingBase ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>} {form.base_scene_image ? 'Regenerate base scene' : 'Generate base scene'}</button></div></div>
          <div className="rounded-[4px] border border-white/10 bg-[#17191d] p-4"><label className="text-[10px] font-black uppercase tracking-wide text-white/55">Video prompt</label><textarea value={form.video_prompt || ''} onChange={(e) => setField('video_prompt', e.target.value)} rows={4} placeholder="Exact prompt sent to the video model..." className="mt-2 w-full resize-none rounded-[3px] border border-white/10 bg-[#26292d] p-3 text-sm text-white outline-none focus:border-[#23c7be]/60"/></div>
          <div className="rounded-[4px] border border-white/10 bg-[#17191d] p-4"><label className="text-[10px] font-black uppercase tracking-wide text-white/55">Transformation prompt (optional)</label><textarea value={form.transformation_prompt || ''} onChange={(e) => setField('transformation_prompt', e.target.value)} rows={4} placeholder="Describe the end-state transformation..." className="mt-2 w-full resize-none rounded-[3px] border border-white/10 bg-[#26292d] p-3 text-sm text-white outline-none focus:border-[#23c7be]/60"/></div>
        </>}

        <div><label className="text-[10px] font-black uppercase tracking-wide text-white/50">Scenario / instructions</label><textarea value={form.scenario} onChange={(e) => setField('scenario', e.target.value)} rows={3} placeholder={isImage ? 'Describe what this Stage creates for the user.' : 'Describe the scene.'} className="mt-1 w-full resize-none rounded-[3px] border border-white/10 bg-[#17191d] p-3 text-sm text-white outline-none focus:border-[#23c7be]/60"/></div>
        <div><label className="text-[10px] font-black uppercase tracking-wide text-white/50">Subtitle</label><input value={form.description || ''} onChange={(e) => setField('description', e.target.value)} className="mt-1 w-full rounded-[3px] border border-white/10 bg-[#17191d] px-3 py-2.5 text-sm text-white outline-none focus:border-[#23c7be]/60"/></div>
        <div className={`grid gap-3 ${isImage ? 'grid-cols-2' : 'grid-cols-3'}`}>{!isImage && <div><label className="text-[10px] font-black uppercase text-white/45">Duration</label><select value={form.default_duration} onChange={(e) => setField('default_duration', Number(e.target.value))} className="mt-1 w-full rounded-[3px] border border-white/10 bg-[#17191d] px-2 py-2 text-sm text-white"><option value={5}>5s</option><option value={10}>10s</option></select></div>}<div><label className="text-[10px] font-black uppercase text-white/45">Aspect</label><select value={form.default_aspect_ratio} onChange={(e) => setField('default_aspect_ratio', e.target.value)} className="mt-1 w-full rounded-[3px] border border-white/10 bg-[#17191d] px-2 py-2 text-sm text-white"><option value="16:9">16:9</option><option value="9:16">9:16</option><option value="1:1">1:1</option></select></div><div><label className="text-[10px] font-black uppercase text-white/45">Order</label><input type="number" value={form.order} onChange={(e) => setField('order', Number(e.target.value))} className="mt-1 w-full rounded-[3px] border border-white/10 bg-[#17191d] px-2 py-2 text-sm text-white"/></div></div>
        <label className="flex items-center gap-2 text-sm text-white/70"><input type="checkbox" checked={form.is_active} onChange={(e) => setField('is_active', e.target.checked)}/> Active in Stages</label>
      </div>

      <div className="sticky bottom-0 flex gap-3 border-t border-white/10 bg-[#202328] px-5 py-4"><button onClick={onClose} className="rounded-[3px] border border-white/10 bg-white/[0.04] px-5 py-2.5 font-bold text-white/70">Cancel</button><button onClick={handleSave} disabled={saving || !form.name.trim() || !form.scenario.trim()} className="flex flex-1 items-center justify-center gap-2 rounded-[3px] bg-[#23c7be] py-2.5 font-black text-[#071211] disabled:opacity-40">{saving && <Loader2 size={16} className="animate-spin"/>} {isEdit ? 'Save changes' : `Create ${isImage ? 'Image' : 'Video'} Stage`}</button></div>
    </div>
  </div>;
}

export default function AdminSketchTemplates() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const { data: templates = [], isLoading } = useQuery({ queryKey: ['sketchTemplates', 'admin'], queryFn: () => base44.entities.SketchTemplate.list('order', 200) });

  const handleDelete = async (id) => { if (!confirm('Delete this Stage?')) return; setDeletingId(id); try { await base44.entities.SketchTemplate.delete(id); qc.invalidateQueries({ queryKey: ['sketchTemplates', 'admin'] }); } finally { setDeletingId(null); } };
  const handleDuplicate = (t) => { const { id, created_date, updated_date, created_by_id, ...rest } = t; setEditing({ ...rest, output_type: t.output_type || 'video', styles: Array.isArray(t.styles) ? t.styles : [], name: `${t.name} (copy)` }); };

  return <div>
    <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-light tracking-wide text-white">Stages</h2><p className="text-xs text-white/40">Create video or image experiences for the Studio.</p></div><button onClick={() => setEditing(false)} className="flex items-center gap-2 rounded-[3px] bg-[#23c7be] px-4 py-2 text-sm font-black text-[#071211]"><Plus size={16}/> New Stage</button></div>
    {isLoading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-white/50"/></div> : templates.length === 0 ? <p className="py-10 text-center text-sm text-white/50">No Stages yet.</p> : <div className="space-y-2">{templates.map(t => { const image = t.output_type === 'image'; return <div key={t.id} className="flex items-center gap-3 rounded-[4px] border border-white/10 bg-neutral-900 p-3">{t.cover_image ? <img src={t.cover_image} alt="" className="h-12 w-12 flex-shrink-0 rounded-[3px] object-cover"/> : <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[3px] bg-white/[0.04]">{image ? <ImageIcon size={18} className="text-[#23c7be]"/> : <Film size={18} className="text-[#23c7be]"/>}</div>}<div className="min-w-0 flex-1"><p className="truncate font-medium text-white">{t.name}</p><p className="truncate text-xs text-white/40">{image ? 'Image' : 'Video'} · {Array.isArray(t.styles) && t.styles.length ? `${t.styles.length} styles · ` : ''}{t.is_active ? 'Active' : 'Hidden'}</p></div><button onClick={() => handleDuplicate(t)} className="p-2 text-white/60 hover:text-white"><Copy size={16}/></button><button onClick={() => setEditing(t)} className="p-2 text-white/60 hover:text-white"><Pencil size={16}/></button><button onClick={() => handleDelete(t.id)} disabled={deletingId === t.id} className="p-2 text-red-400 hover:text-red-300">{deletingId === t.id ? <Loader2 size={16} className="animate-spin"/> : <Trash2 size={16}/>}</button></div>})}</div>}
    {editing !== null && <ThemeEditor template={editing || null} onClose={() => setEditing(null)}/>} 
  </div>;
}
