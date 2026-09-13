import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Save, X, Upload, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { TextListEditor, ObjectListEditor } from '@/components/admin/simInitEditors';

const ENV_OPTIONS = {
  location_type: ['street', 'market', 'alley', 'tavern', 'villa', 'bedroom', 'courtyard', 'bathhouse', 'government building', 'arena', 'wilderness', 'other'],
  public_access: ['open', 'controlled', 'restricted', 'private'],
  crowd_level: ['empty', 'low', 'moderate', 'high', 'packed'],
  visibility: ['very_low', 'low', 'moderate', 'high', 'very_high'],
  privacy: ['none', 'low', 'moderate', 'high', 'complete'],
  guard_presence: ['none', 'low', 'moderate', 'high'],
  general_danger: ['very_low', 'low', 'moderate', 'high', 'extreme'],
  ambush_risk: ['very_low', 'low', 'moderate', 'high', 'extreme'],
  surveillance_risk: ['very_low', 'low', 'moderate', 'high', 'extreme'],
  escape_difficulty: ['very_easy', 'easy', 'moderate', 'difficult', 'very_difficult'],
};
const TIME_PERIODS = ['dawn', 'morning', 'afternoon', 'evening', 'night', 'late_night'];

const simInputClass = "w-full bg-neutral-800 border border-white/10 rounded-sm px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30";
const simLabelClass = "text-white text-xs uppercase tracking-wider font-medium mb-1.5 block";

function SimSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className={simLabelClass}>{label}</label>
      <select value={value || ''} onChange={e => onChange(e.target.value)} className={simInputClass}>
        <option value="">— none —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

export default function StorySetEditor({ set: setAsset, onBack }) {
  const isNew = !setAsset;
  const [form, setForm] = useState({
    name: setAsset?.name || '',
    description: setAsset?.description || '',
    tags: (setAsset?.tags || []).join(', '),
    images: setAsset?.images || [],
    // ── Simulation environment (admin-authored only) ──
    sim_location_type: setAsset?.sim_location_type || '',
    sim_public_access: setAsset?.sim_public_access || '',
    sim_crowd_level: setAsset?.sim_crowd_level || '',
    sim_visibility: setAsset?.sim_visibility || '',
    sim_privacy: setAsset?.sim_privacy || '',
    sim_guard_presence: setAsset?.sim_guard_presence || '',
    sim_general_danger: setAsset?.sim_general_danger || '',
    sim_ambush_risk: setAsset?.sim_ambush_risk || '',
    sim_surveillance_risk: setAsset?.sim_surveillance_risk || '',
    sim_escape_difficulty: setAsset?.sim_escape_difficulty || '',
    sim_entry_points: setAsset?.sim_entry_points || [],
    sim_exit_routes: setAsset?.sim_exit_routes || [],
    sim_hiding_places: setAsset?.sim_hiding_places || [],
    sim_environmental_hazards: setAsset?.sim_environmental_hazards || [],
    sim_suitable_actions: setAsset?.sim_suitable_actions || [],
    sim_unsuitable_actions: setAsset?.sim_unsuitable_actions || [],
    sim_special_rules: setAsset?.sim_special_rules || [],
    sim_time_profiles: setAsset?.sim_time_profiles || [],
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [autoFillingSim, setAutoFillingSim] = useState(false);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleUploadImages = async (files) => {
    setUploading(true);
    try {
      const urls = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        urls.push(file_url);
      }
      set('images', [...form.images, ...urls]);
      toast.success(`${files.length} image(s) uploaded`);
    } catch {
      toast.error('Upload failed');
    }
    setUploading(false);
  };

  const handleRemoveImage = (url) => {
    set('images', form.images.filter(p => p !== url));
  };

  const handleAutoFillSimEnvironment = async () => {
    if (!form.name.trim() && !form.description.trim() && form.images.length === 0) {
      toast.error('Add a name, description, or reference image first');
      return;
    }
    setAutoFillingSim(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a simulation environment designer. Draft the structured environment fields for this set from its name, description, tags, and reference images. Only infer details supported by the supplied material. Return concise operational data for a story simulation.

SET NAME: ${form.name || '(unnamed)'}
DESCRIPTION: ${form.description || '(none)'}
TAGS: ${form.tags || '(none)'}

Allowed enum values:
- sim_public_access: open, controlled, restricted, private
- sim_crowd_level: empty, low, moderate, high, packed
- sim_visibility: very_low, low, moderate, high, very_high
- sim_privacy: none, low, moderate, high, complete
- sim_guard_presence: none, low, moderate, high
- sim_general_danger, sim_ambush_risk, sim_surveillance_risk: very_low, low, moderate, high, extreme
- sim_escape_difficulty: very_easy, easy, moderate, difficult, very_difficult

Use empty arrays where the source does not support a list. Time profiles are optional and must use dawn, morning, afternoon, evening, night, or late_night.`,
        file_urls: form.images,
        response_json_schema: {
          type: 'object',
          properties: {
            sim_location_type: { type: 'string' },
            sim_public_access: { type: 'string' },
            sim_crowd_level: { type: 'string' },
            sim_visibility: { type: 'string' },
            sim_privacy: { type: 'string' },
            sim_guard_presence: { type: 'string' },
            sim_general_danger: { type: 'string' },
            sim_ambush_risk: { type: 'string' },
            sim_surveillance_risk: { type: 'string' },
            sim_escape_difficulty: { type: 'string' },
            sim_entry_points: { type: 'array', items: { type: 'string' } },
            sim_exit_routes: { type: 'array', items: { type: 'string' } },
            sim_hiding_places: { type: 'array', items: { type: 'string' } },
            sim_environmental_hazards: { type: 'array', items: { type: 'string' } },
            sim_suitable_actions: { type: 'array', items: { type: 'string' } },
            sim_unsuitable_actions: { type: 'array', items: { type: 'string' } },
            sim_special_rules: { type: 'array', items: { type: 'string' } },
            sim_time_profiles: { type: 'array', items: { type: 'object' } },
          },
          required: [
            'sim_location_type', 'sim_public_access', 'sim_crowd_level',
            'sim_visibility', 'sim_privacy', 'sim_guard_presence',
            'sim_general_danger', 'sim_ambush_risk', 'sim_surveillance_risk',
            'sim_escape_difficulty', 'sim_entry_points', 'sim_exit_routes',
            'sim_hiding_places', 'sim_environmental_hazards',
            'sim_suitable_actions', 'sim_unsuitable_actions',
            'sim_special_rules', 'sim_time_profiles',
          ],
        },
      });
      setForm(prev => ({
        ...prev,
        sim_location_type: res.sim_location_type || prev.sim_location_type,
        sim_public_access: res.sim_public_access || prev.sim_public_access,
        sim_crowd_level: res.sim_crowd_level || prev.sim_crowd_level,
        sim_visibility: res.sim_visibility || prev.sim_visibility,
        sim_privacy: res.sim_privacy || prev.sim_privacy,
        sim_guard_presence: res.sim_guard_presence || prev.sim_guard_presence,
        sim_general_danger: res.sim_general_danger || prev.sim_general_danger,
        sim_ambush_risk: res.sim_ambush_risk || prev.sim_ambush_risk,
        sim_surveillance_risk: res.sim_surveillance_risk || prev.sim_surveillance_risk,
        sim_escape_difficulty: res.sim_escape_difficulty || prev.sim_escape_difficulty,
        sim_entry_points: res.sim_entry_points?.length ? res.sim_entry_points : prev.sim_entry_points,
        sim_exit_routes: res.sim_exit_routes?.length ? res.sim_exit_routes : prev.sim_exit_routes,
        sim_hiding_places: res.sim_hiding_places?.length ? res.sim_hiding_places : prev.sim_hiding_places,
        sim_environmental_hazards: res.sim_environmental_hazards?.length ? res.sim_environmental_hazards : prev.sim_environmental_hazards,
        sim_suitable_actions: res.sim_suitable_actions?.length ? res.sim_suitable_actions : prev.sim_suitable_actions,
        sim_unsuitable_actions: res.sim_unsuitable_actions?.length ? res.sim_unsuitable_actions : prev.sim_unsuitable_actions,
        sim_special_rules: res.sim_special_rules?.length ? res.sim_special_rules : prev.sim_special_rules,
        sim_time_profiles: res.sim_time_profiles?.length ? res.sim_time_profiles : prev.sim_time_profiles,
      }));
      toast.success('Simulation environment auto-filled');
    } catch (error) {
      console.error('Failed to auto-fill set environment', error);
      toast.error(error?.message || 'Failed to auto-fill simulation environment');
    }
    setAutoFillingSim(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.description.trim()) { toast.error('Description is required'); return; }
    setSaving(true);
    const cleanArr = (a) => (a || []).map(s => (typeof s === 'string' ? s.trim() : s)).filter(Boolean);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        images: form.images,
        // ── Simulation environment: saved verbatim, never derived ──
        sim_location_type: form.sim_location_type || null,
        sim_public_access: form.sim_public_access || null,
        sim_crowd_level: form.sim_crowd_level || null,
        sim_visibility: form.sim_visibility || null,
        sim_privacy: form.sim_privacy || null,
        sim_guard_presence: form.sim_guard_presence || null,
        sim_general_danger: form.sim_general_danger || null,
        sim_ambush_risk: form.sim_ambush_risk || null,
        sim_surveillance_risk: form.sim_surveillance_risk || null,
        sim_escape_difficulty: form.sim_escape_difficulty || null,
        sim_entry_points: cleanArr(form.sim_entry_points),
        sim_exit_routes: cleanArr(form.sim_exit_routes),
        sim_hiding_places: cleanArr(form.sim_hiding_places),
        sim_environmental_hazards: cleanArr(form.sim_environmental_hazards),
        sim_suitable_actions: cleanArr(form.sim_suitable_actions),
        sim_unsuitable_actions: cleanArr(form.sim_unsuitable_actions),
        sim_special_rules: cleanArr(form.sim_special_rules),
        sim_time_profiles: (form.sim_time_profiles || [])
          .map(p => ({
            time_period: p.time_period || '',
            crowd_level: p.crowd_level || null,
            visibility: p.visibility || null,
            privacy: p.privacy || null,
            guard_presence: p.guard_presence || null,
            general_danger: p.general_danger || null,
            ambush_risk: p.ambush_risk || null,
            surveillance_risk: p.surveillance_risk || null,
            special_rules: cleanArr(p.special_rules),
          }))
          .filter(p => p.time_period),
      };
      if (isNew) {
        const created = await base44.admin.saveStorySet(null, payload);
        toast.success('Set created!');
        onBack(created);
      } else {
        const updated = await base44.admin.saveStorySet(setAsset.id, payload);
        toast.success('Set updated!');
        onBack(updated);
      }
    } catch (error) {
      console.error('Failed to save set', error);
      toast.error(error?.message || 'Failed to save set');
    }
    setSaving(false);
  };

  const inputClass = "w-full bg-neutral-800 border border-white/10 rounded-sm px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30";
  const labelClass = "text-white text-xs uppercase tracking-wider font-medium mb-1.5 block";

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-2 text-white hover:text-white text-sm">
        <ArrowLeft size={16} /> Back to cast & sets
      </button>

      <h2 className="text-white text-lg font-light tracking-wider">
        {isNew ? 'NEW SET' : 'EDIT SET'}
      </h2>

      {/* Images */}
      <div>
        <label className={labelClass}>Reference Images</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {form.images.map((url, i) => (
            <div key={i} className="relative w-24 h-16 bg-neutral-800 border border-white/10 rounded-sm overflow-hidden">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => handleRemoveImage(url)}
                className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center hover:bg-red-500/80"
              >
                <X size={10} className="text-white" />
              </button>
            </div>
          ))}
          <label className="w-24 h-16 bg-neutral-800 border-2 border-dashed border-white/20 rounded-sm flex flex-col items-center justify-center cursor-pointer hover:border-white/40">
            {uploading ? (
              <Loader2 size={18} className="animate-spin text-white" />
            ) : (
              <>
                <Upload size={16} className="text-white" />
                <span className="text-white text-[10px] mt-0.5">Add</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => { const files = Array.from(e.target.files); if (files.length > 0) handleUploadImages(files); }}
            />
          </label>
        </div>
        <p className="text-white text-xs">Upload up to 8 reference images</p>
      </div>

      <div>
        <label className={labelClass}>Name *</label>
        <input
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="e.g. Roman Forum"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Description *</label>
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Full description of the set's atmosphere, style, lighting, etc."
          rows={3}
          className={inputClass + ' resize-none'}
        />
      </div>

      <div>
        <label className={labelClass}>Tags (comma-separated)</label>
        <input
          value={form.tags}
          onChange={e => set('tags', e.target.value)}
          placeholder="e.g. Ancient, Outdoor, Grand, Political"
          className={inputClass}
        />
      </div>

      {/* ─────────────────── Simulation Environment ─────────────────── */}
      <div className="border-t border-white/10 pt-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
          <p className="text-white text-sm font-medium uppercase tracking-wider">Simulation Environment</p>
          <p className="text-white/40 text-xs mt-0.5">Structured environmental data reviewed by the admin and read at simulation initialization.</p>
          </div>
          <Button
            type="button"
            onClick={handleAutoFillSimEnvironment}
            disabled={autoFillingSim}
            className="bg-white text-black hover:bg-white/90 shrink-0"
          >
            {autoFillingSim ? <Loader2 size={15} className="animate-spin mr-1" /> : <Sparkles size={15} className="mr-1" />}
            Auto-fill
          </Button>
        </div>

        <div>
          <label className={labelClass}>Location Type</label>
          <input
            value={form.sim_location_type || ''}
            onChange={e => set('sim_location_type', e.target.value)}
            placeholder="e.g. space_station, tavern, market"
            className={inputClass}
          />
          <p className="text-white/40 text-xs mt-1">Free text — type whatever fits this set.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SimSelect label="Public Access" value={form.sim_public_access} onChange={v => set('sim_public_access', v)} options={ENV_OPTIONS.public_access} />
          <SimSelect label="Crowd Level (base)" value={form.sim_crowd_level} onChange={v => set('sim_crowd_level', v)} options={ENV_OPTIONS.crowd_level} />
          <SimSelect label="Visibility (base)" value={form.sim_visibility} onChange={v => set('sim_visibility', v)} options={ENV_OPTIONS.visibility} />
          <SimSelect label="Privacy (base)" value={form.sim_privacy} onChange={v => set('sim_privacy', v)} options={ENV_OPTIONS.privacy} />
          <SimSelect label="Guard Presence (base)" value={form.sim_guard_presence} onChange={v => set('sim_guard_presence', v)} options={ENV_OPTIONS.guard_presence} />
          <SimSelect label="Escape Difficulty" value={form.sim_escape_difficulty} onChange={v => set('sim_escape_difficulty', v)} options={ENV_OPTIONS.escape_difficulty} />
          <SimSelect label="General Danger (base)" value={form.sim_general_danger} onChange={v => set('sim_general_danger', v)} options={ENV_OPTIONS.general_danger} />
          <SimSelect label="Ambush Risk (base)" value={form.sim_ambush_risk} onChange={v => set('sim_ambush_risk', v)} options={ENV_OPTIONS.ambush_risk} />
          <SimSelect label="Surveillance Risk (base)" value={form.sim_surveillance_risk} onChange={v => set('sim_surveillance_risk', v)} options={ENV_OPTIONS.surveillance_risk} />
        </div>

        <TextListEditor label="Entry Points" items={form.sim_entry_points} onChange={v => set('sim_entry_points', v)} placeholder="e.g. main gate" addLabel="Add entry point" />
        <TextListEditor label="Exit Routes" items={form.sim_exit_routes} onChange={v => set('sim_exit_routes', v)} placeholder="e.g. side alley" addLabel="Add exit route" />
        <TextListEditor label="Hiding Places" items={form.sim_hiding_places} onChange={v => set('sim_hiding_places', v)} placeholder="e.g. behind the counter" addLabel="Add hiding place" />
        <TextListEditor label="Environmental Hazards" items={form.sim_environmental_hazards} onChange={v => set('sim_environmental_hazards', v)} placeholder="e.g. open well" addLabel="Add hazard" />
        <TextListEditor label="Suitable Actions" items={form.sim_suitable_actions} onChange={v => set('sim_suitable_actions', v)} placeholder="e.g. secret_meeting, surveillance" addLabel="Add suitable action" />
        <TextListEditor label="Unsuitable Actions" items={form.sim_unsuitable_actions} onChange={v => set('sim_unsuitable_actions', v)} placeholder="e.g. ambush" addLabel="Add unsuitable action" />
        <TextListEditor label="Special Rules (base)" items={form.sim_special_rules} onChange={v => set('sim_special_rules', v)} placeholder="location-specific constraint or advantage" addLabel="Add special rule" />

        <ObjectListEditor
          label="Time Profiles"
          items={form.sim_time_profiles}
          onChange={v => set('sim_time_profiles', v)}
          addLabel="Add time profile"
          blank={{ time_period: '', crowd_level: '', visibility: '', privacy: '', guard_presence: '', general_danger: '', ambush_risk: '', surveillance_risk: '', special_rules: [] }}
          fields={[
            { key: 'time_period', label: 'Time Period', type: 'select', options: TIME_PERIODS },
            { key: 'crowd_level', label: 'Crowd', type: 'select', options: ENV_OPTIONS.crowd_level },
            { key: 'visibility', label: 'Visibility', type: 'select', options: ENV_OPTIONS.visibility },
            { key: 'privacy', label: 'Privacy', type: 'select', options: ENV_OPTIONS.privacy },
            { key: 'guard_presence', label: 'Guards', type: 'select', options: ENV_OPTIONS.guard_presence },
            { key: 'general_danger', label: 'Danger', type: 'select', options: ENV_OPTIONS.general_danger },
            { key: 'ambush_risk', label: 'Ambush Risk', type: 'select', options: ENV_OPTIONS.ambush_risk },
            { key: 'surveillance_risk', label: 'Surveillance', type: 'select', options: ENV_OPTIONS.surveillance_risk },
            { key: 'special_rules', label: 'Special Rules', type: 'tags', placeholder: 'comma-separated' },
          ]}
        />
      </div>
      {/* ────────────────────────────────────────────────────────────── */}

      <div className="flex gap-3 pt-2">
        <Button
          onClick={onBack}
          variant="ghost"
          className="text-white hover:text-white hover:bg-white/10"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-white text-black hover:bg-white/90"
        >
          {saving ? <Loader2 size={16} className="animate-spin mr-1" /> : <Save size={16} className="mr-1" />}
          {isNew ? 'Create Set' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
