import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Save, Plus, X, Upload, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { TextListEditor, ObjectListEditor } from '@/components/admin/simInitEditors';

export default function StoryCharacterEditor({ character, onBack, packCharacters = [], packSets = [] }) {
  const isNew = !character;
  const [form, setForm] = useState({
    name: character?.name || '',
    description: character?.description || '',
    backstory: character?.backstory || '',
    character_type: character?.character_type || 'NPC',
    traits: (character?.traits || []).join(', '),
    photos: character?.photos || [],
    reference_sheet: character?.reference_sheet || '',
    reference_sheet_notes: character?.reference_sheet_notes || '',
    reference_sheet_color_palette: character?.reference_sheet_color_palette || [],
    reference_sheet_wardrobe_anchors: character?.reference_sheet_wardrobe_anchors || [],
    reference_sheet_do_not_change: character?.reference_sheet_do_not_change || [],
    reference_sheet_style_constraints: character?.reference_sheet_style_constraints || '',
    is_active: character?.is_active ?? true,
    // ── Simulation initialization (admin-authored only) ──
    sim_starting_story_set_id: character?.sim_starting_story_set_id || '',
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
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoFillingSim, setAutoFillingSim] = useState(false);
  const [characterTypes, setCharacterTypes] = useState([]);

  useEffect(() => {
    base44.entities.CharacterType.list('order', 100)
      .then(setCharacterTypes)
      .catch(() => toast.error('Failed to load character types'));
  }, []);

  // Relationships + starting set are scoped to THIS theme's pack only —
  // passed in from CastSetsManager so we never mix characters/sets across themes.
  const packMateOptions = packCharacters
    .filter(c => c.id !== character?.id)
    .map(c => ({ value: c.id, label: c.name || 'Unnamed' }));

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

  const handleRemovePhoto = (url) => {
    set('photos', form.photos.filter(p => p !== url));
  };

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

  const handleAutoFillMetadata = async () => {
    if (!form.reference_sheet) { toast.error('Upload a reference sheet first'); return; }
    setAutoFilling(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a character design supervisor. Analyze this character reference sheet (turnaround / multi-view) and extract structured visual-integrity metadata that a video engine will use to keep this character visually consistent across generations.

Return JSON with these fields:
- reference_sheet_notes: a concise visual description covering build/physique, skin tone, eye color, hair style and color, and any distinguishing features.
- reference_sheet_color_palette: array of dominant color labels (skin, hair, wardrobe, accents), e.g. ["deep blue skin", "silver-white hair", "violet eyes"].
- reference_sheet_wardrobe_anchors: array of canonical outfit/costume elements visible on the sheet that should stay locked across generations, e.g. ["geometric bio-suit", "silver circuitry seams"].
- reference_sheet_do_not_change: array of features that must NEVER be altered by the video engine (scars, markings, prosthetics, specific facial features), e.g. ["three cheekbone markings", "prosthetic left hand"]. Empty array if none.
- reference_sheet_style_constraints: short notes on lighting, lens/look, aspect ratio the sheet was shot in, and texture/material notes (fabric types, skin texture, makeup state).

Only state what you can actually see. Be precise and specific. Use empty arrays for list fields with nothing visible.`,
        file_urls: [form.reference_sheet],
        response_json_schema: {
          type: "object",
          properties: {
            reference_sheet_notes: { type: "string" },
            reference_sheet_color_palette: { type: "array", items: { type: "string" } },
            reference_sheet_wardrobe_anchors: { type: "array", items: { type: "string" } },
            reference_sheet_do_not_change: { type: "array", items: { type: "string" } },
            reference_sheet_style_constraints: { type: "string" },
          },
          required: ["reference_sheet_notes", "reference_sheet_color_palette", "reference_sheet_wardrobe_anchors", "reference_sheet_do_not_change", "reference_sheet_style_constraints"],
        },
      });

      // Fill blanks only — preserve anything the admin has already authored.
      setForm(prev => ({
        ...prev,
        reference_sheet_notes: prev.reference_sheet_notes?.trim() ? prev.reference_sheet_notes : (res.reference_sheet_notes || ''),
        reference_sheet_color_palette: (prev.reference_sheet_color_palette?.length ? prev.reference_sheet_color_palette : (res.reference_sheet_color_palette || [])),
        reference_sheet_wardrobe_anchors: (prev.reference_sheet_wardrobe_anchors?.length ? prev.reference_sheet_wardrobe_anchors : (res.reference_sheet_wardrobe_anchors || [])),
        reference_sheet_do_not_change: (prev.reference_sheet_do_not_change?.length ? prev.reference_sheet_do_not_change : (res.reference_sheet_do_not_change || [])),
        reference_sheet_style_constraints: prev.reference_sheet_style_constraints?.trim() ? prev.reference_sheet_style_constraints : (res.reference_sheet_style_constraints || ''),
      }));
      toast.success('Metadata drafted from reference sheet');
    } catch {
      toast.error('Failed to read reference sheet');
    }
    setAutoFilling(false);
  };

  // Drafts the Simulation Initialization fields from the character's description
  // + backstory. Fills blanks only — anything the admin has already authored is
  // preserved. Relationships are matched to pack mates by name.
  const handleAutoFillSimInit = async () => {
    if (!form.description.trim() && !form.backstory.trim()) {
      toast.error('Add a description or backstory first');
      return;
    }
    setAutoFillingSim(true);
    try {
      const packMateNames = packCharacters
        .filter(c => c.id !== character?.id)
        .map(c => c.name)
        .filter(Boolean);
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a simulation designer. Read this character's profile and draft the simulation-initialization fields a story simulation will read at "Begin Story". Infer reasonable goals, immediate needs, relationships, responsibilities, controlled assets, starting knowledge, and starting beliefs from the character's description and backstory — only infer what is supported by the text.

CHARACTER NAME: ${form.name || '(unnamed)'}
CHARACTER TYPE: ${form.character_type || 'NPC'}
TRAITS: ${form.traits || '(none)'}
DESCRIPTION: ${form.description || '(none)'}
BACKSTORY: ${form.backstory || '(none)'}

PACK MATES (other characters in the same theme — relationships may only target these by name): ${packMateNames.join(', ') || '(none yet)'}

Return JSON with these fields:
- sim_goals: array of short strings — this character's objectives.
- sim_immediate_needs: array of short strings — pressures pressing right now.
- sim_relationships: array of { target_name, relationship_type, description } — target_name MUST be one of the pack mates listed above (empty array if no pack mates exist). relationship_type is a short label (ally, rival, employer, kin, creditor, etc.).
- sim_responsibilities: array of short strings — duties / role obligations.
- sim_controlled_assets: array of { name, description } — possessions this character holds.
- sim_starting_knowledge: array of strings — privately-held starting facts only this character knows.
- sim_starting_beliefs: array of { text, belief_type, confidence } — belief_type is one of "fact","hypothesis","conviction","assumption"; confidence is a number 0–1 (optional, omit if unsure).

Be concise and specific. Use empty arrays where nothing is supported by the text.`,
        response_json_schema: {
          type: "object",
          properties: {
            sim_goals: { type: "array", items: { type: "string" } },
            sim_immediate_needs: { type: "array", items: { type: "string" } },
            sim_relationships: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  target_name: { type: "string" },
                  relationship_type: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
            sim_responsibilities: { type: "array", items: { type: "string" } },
            sim_controlled_assets: {
              type: "array",
              items: {
                type: "object",
                properties: { name: { type: "string" }, description: { type: "string" } },
              },
            },
            sim_starting_knowledge: { type: "array", items: { type: "string" } },
            sim_starting_beliefs: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  belief_type: { type: "string" },
                  confidence: { type: "number" },
                },
              },
            },
          },
          required: ["sim_goals", "sim_immediate_needs", "sim_relationships", "sim_responsibilities", "sim_controlled_assets", "sim_starting_knowledge", "sim_starting_beliefs"],
        },
      });

      // Map proposed relationships to pack-mate IDs by name.
      const nameToId = Object.fromEntries(packCharacters.map(c => [c.name, c.id]));
      const mappedRelationships = (res.sim_relationships || [])
        .filter(r => r.target_name && nameToId[r.target_name])
        .map(r => ({
          character_id: nameToId[r.target_name],
          relationship_type: (r.relationship_type || '').trim(),
          description: (r.description || '').trim(),
        }))
        .filter(r => r.character_id && r.relationship_type);

      const mappedBeliefs = (res.sim_starting_beliefs || []).map(b => ({
        text: (b.text || '').trim(),
        belief_type: b.belief_type || 'hypothesis',
        ...(b.confidence !== undefined && b.confidence !== null && !isNaN(Number(b.confidence)) ? { confidence: Number(b.confidence) } : {}),
      })).filter(b => b.text);

      // Match the StoryTheme auto-fill pattern: the AI draft wins when it
      // produces content; existing values are kept only when the draft is empty.
      setForm(prev => ({
        ...prev,
        sim_goals: (res.sim_goals?.length ? res.sim_goals : prev.sim_goals),
        sim_immediate_needs: (res.sim_immediate_needs?.length ? res.sim_immediate_needs : prev.sim_immediate_needs),
        sim_relationships: (mappedRelationships.length ? mappedRelationships : prev.sim_relationships),
        sim_responsibilities: (res.sim_responsibilities?.length ? res.sim_responsibilities : prev.sim_responsibilities),
        sim_controlled_assets: (res.sim_controlled_assets?.length ? res.sim_controlled_assets : prev.sim_controlled_assets),
        sim_starting_knowledge: (res.sim_starting_knowledge?.length ? res.sim_starting_knowledge : prev.sim_starting_knowledge),
        sim_starting_beliefs: (mappedBeliefs.length ? mappedBeliefs : prev.sim_starting_beliefs),
      }));
      toast.success('Simulation init drafted from backstory');
    } catch {
      toast.error('Failed to draft simulation init');
    }
    setAutoFillingSim(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.description.trim()) { toast.error('Description is required'); return; }
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
        reference_sheet_notes: form.reference_sheet_notes.trim() || null,
        reference_sheet_color_palette: (form.reference_sheet_color_palette || []).map(s => s.trim()).filter(Boolean),
        reference_sheet_wardrobe_anchors: (form.reference_sheet_wardrobe_anchors || []).map(s => s.trim()).filter(Boolean),
        reference_sheet_do_not_change: (form.reference_sheet_do_not_change || []).map(s => s.trim()).filter(Boolean),
        reference_sheet_style_constraints: form.reference_sheet_style_constraints.trim() || null,
        is_active: form.is_active,
        // ── Simulation initialization: saved verbatim, never derived ──
        sim_starting_story_set_id: form.sim_starting_story_set_id || null,
        sim_goals: (form.sim_goals || []).map(s => s.trim()).filter(Boolean),
        sim_immediate_needs: (form.sim_immediate_needs || []).map(s => s.trim()).filter(Boolean),
        sim_relationships: (form.sim_relationships || [])
          .map(r => ({
            character_id: r.character_id || '',
            relationship_type: (r.relationship_type || '').trim(),
            description: (r.description || '').trim(),
          }))
          .filter(r => r.character_id && r.relationship_type),
        sim_responsibilities: (form.sim_responsibilities || []).map(s => s.trim()).filter(Boolean),
        sim_controlled_assets: (form.sim_controlled_assets || [])
          .map(a => ({ name: (a.name || '').trim(), description: (a.description || '').trim() }))
          .filter(a => a.name),
        sim_starting_knowledge: (form.sim_starting_knowledge || [])
          .map(k => (typeof k === 'string' ? k : (k?.text || '')).trim())
          .filter(Boolean),
        sim_starting_beliefs: (form.sim_starting_beliefs || [])
          .map(b => {
            const out = { text: (b.text || '').trim(), belief_type: b.belief_type || 'hypothesis' };
            const c = b.confidence;
            if (c !== '' && c != null && !isNaN(Number(c))) out.confidence = Number(c);
            return out;
          })
          .filter(b => b.text),
      };
      if (isNew) {
        const created = await base44.admin.saveStoryCharacter(null, payload);
        toast.success('Character created!');
        onBack(created);
      } else {
        const updated = await base44.admin.saveStoryCharacter(character.id, payload);
        toast.success('Character updated!');
        onBack(updated);
      }
    } catch (error) {
      console.error('Failed to save character', error);
      toast.error(error?.message || 'Failed to save character');
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
        {isNew ? 'NEW CHARACTER' : 'EDIT CHARACTER'}
      </h2>

      {/* Photos */}
      <div>
        <label className={labelClass}>Reference Photos</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {form.photos.map((url, i) => (
            <div key={i} className="relative w-20 h-24 bg-neutral-800 border border-white/10 rounded-sm overflow-hidden group">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => handleRemovePhoto(url)}
                className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center hover:bg-red-500/80"
              >
                <X size={10} className="text-white" />
              </button>
            </div>
          ))}
          <label className="w-20 h-24 bg-neutral-800 border-2 border-dashed border-white/20 rounded-sm flex flex-col items-center justify-center cursor-pointer hover:border-white/40">
            {uploading ? (
              <Loader2 size={18} className="animate-spin text-white" />
            ) : (
              <>
                <Upload size={16} className="text-white" />
                <span className="text-white text-[10px] mt-1">Add</span>
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
        <p className="text-white text-xs">Portrait / identification photos (shown in the UI and to the agent)</p>
      </div>

      {/* Reference Sheet */}
      <div>
        <label className={labelClass}>Character Reference Sheet (Turnaround)</label>
        <div className="flex items-center gap-3 mb-2">
          {form.reference_sheet ? (
            <div className="relative w-28 h-24 bg-neutral-800 border border-white/10 rounded-sm overflow-hidden group">
              <img src={form.reference_sheet} alt="Reference sheet" className="w-full h-full object-contain" />
              <button
                onClick={() => set('reference_sheet', '')}
                className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center hover:bg-red-500/80"
              >
                <X size={10} className="text-white" />
              </button>
            </div>
          ) : (
            <label className="w-28 h-24 bg-neutral-800 border-2 border-dashed border-white/20 rounded-sm flex flex-col items-center justify-center cursor-pointer hover:border-white/40">
              {uploadingSheet ? (
                <Loader2 size={18} className="animate-spin text-white" />
              ) : (
                <>
                  <Upload size={16} className="text-white" />
                  <span className="text-white text-[10px] mt-1">Add</span>
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
        <p className="text-white text-xs">Full turnaround / multi-view sheet — this is the anchor image the video engine uses for identity consistency (NOT the portrait)</p>
      </div>

      {/* Reference Sheet Metadata */}
      <div className="border border-white/10 rounded-sm p-4 space-y-4 bg-neutral-900/50">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-white text-sm font-medium uppercase tracking-wider">Reference Sheet Metadata</p>
            <p className="text-white/40 text-xs mt-0.5">Visual integrity data associated with the reference sheet. Travels with the character and is read by the video engine to keep identity consistent across generations.</p>
          </div>
          <button
            type="button"
            onClick={handleAutoFillMetadata}
            disabled={!form.reference_sheet || autoFilling}
            className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed rounded-sm text-white text-xs font-medium uppercase tracking-wider whitespace-nowrap transition-colors"
          >
            {autoFilling ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {autoFilling ? 'Reading…' : 'Auto-fill from Sheet'}
          </button>
        </div>

        <div>
          <label className={labelClass}>Visual Description</label>
          <textarea
            value={form.reference_sheet_notes}
            onChange={e => set('reference_sheet_notes', e.target.value)}
            placeholder="e.g. Slim athletic build, deep blue skin, pale silver-white hair in a high bob, luminescent violet eyes, angular jaw, three small geometric markings along the left cheekbone"
            rows={3}
            className={inputClass + ' resize-none'}
          />
          <p className="text-white/40 text-xs mt-1">Build, skin tone, eye color, hair style/color, and distinguishing features.</p>
        </div>

        <TextListEditor label="Color Palette" items={form.reference_sheet_color_palette} onChange={v => set('reference_sheet_color_palette', v)} placeholder="e.g. deep blue skin, silver-white hair, violet eyes" addLabel="Add color" />

        <TextListEditor label="Wardrobe Anchors" items={form.reference_sheet_wardrobe_anchors} onChange={v => set('reference_sheet_wardrobe_anchors', v)} placeholder="e.g. geometric bio-suit, silver circuitry seams" addLabel="Add anchor" />

        <TextListEditor label="Do Not Change" items={form.reference_sheet_do_not_change} onChange={v => set('reference_sheet_do_not_change', v)} placeholder="e.g. left-cheekbone markings, prosthetic left hand" addLabel="Add lock" />

        <div>
          <label className={labelClass}>Style / Format Constraints</label>
          <textarea
            value={form.reference_sheet_style_constraints}
            onChange={e => set('reference_sheet_style_constraints', e.target.value)}
            placeholder="e.g. Soft even studio lighting, 50mm lens look, shot in 3:4 portrait, matte skin texture, subtle sub-surface scattering on blue skin"
            rows={2}
            className={inputClass + ' resize-none'}
          />
          <p className="text-white/40 text-xs mt-1">Lighting, lens/look, aspect ratio, and texture/material notes.</p>
        </div>
      </div>

      <div>
        <label className={labelClass}>Name *</label>
        <input
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="e.g. Senator Cassius"
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
          {characterTypes.map(ct => (
            <option key={ct.id} value={ct.name}>{ct.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Description *</label>
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Full character bio, personality, backstory — used by the AI agent to portray this character"
          rows={4}
          className={inputClass + ' resize-none'}
        />
      </div>

      <div>
        <label className={labelClass}>Backstory</label>
        <textarea
          value={form.backstory}
          onChange={e => set('backstory', e.target.value)}
          placeholder="Detailed history, origin, motivations, and key past events — guides how the AI agent portrays this character across the story"
          rows={5}
          className={inputClass + ' resize-none'}
        />
      </div>

      <div>
        <label className={labelClass}>Traits (comma-separated)</label>
        <input
          value={form.traits}
          onChange={e => set('traits', e.target.value)}
          placeholder="e.g. cunning, ambitious, ruthless, charismatic"
          className={inputClass}
        />
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={e => set('is_active', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-white text-sm">Active (available for themes)</span>
        </label>
      </div>

      {/* ─────────────────── Simulation Initialization ─────────────────── */}
      <div className="border-t border-white/10 pt-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-white text-sm font-medium uppercase tracking-wider">Simulation Initialization</p>
            <p className="text-white/40 text-xs mt-0.5">Authoritative data the simulation reads at Begin Story. Auto-fill drafts from the description & backstory — review and edit before saving.</p>
          </div>
          <button
            type="button"
            onClick={handleAutoFillSimInit}
            disabled={autoFillingSim || (!form.description.trim() && !form.backstory.trim())}
            className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed rounded-sm text-white text-xs font-medium uppercase tracking-wider whitespace-nowrap transition-colors"
          >
            {autoFillingSim ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {autoFillingSim ? 'Drafting…' : 'Auto-fill from Backstory'}
          </button>
        </div>

        <div>
          <label className={labelClass}>Starting StorySet</label>
          <select
            value={form.sim_starting_story_set_id}
            onChange={e => set('sim_starting_story_set_id', e.target.value)}
            className={inputClass}
          >
            <option value="">— none —</option>
            {packSets.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <p className="text-white/40 text-xs mt-1">The StorySet this character starts in (from this theme's sets). Resolved to a SimLocation at init.</p>
        </div>

        <TextListEditor label="Goals" items={form.sim_goals} onChange={v => set('sim_goals', v)} placeholder="e.g. Secure independence" addLabel="Add goal" />

        <TextListEditor label="Immediate Needs" items={form.sim_immediate_needs} onChange={v => set('sim_immediate_needs', v)} placeholder="Pressures pressing right now" addLabel="Add need" />

        <ObjectListEditor
          label="Relationships"
          items={form.sim_relationships}
          onChange={v => set('sim_relationships', v)}
          addLabel="Add relationship"
          blank={{ character_id: '', relationship_type: '', description: '' }}
          fields={[
            { key: 'character_id', label: 'Character', type: 'select', options: packMateOptions },
            { key: 'relationship_type', label: 'Type', placeholder: 'e.g. ally, employer, creditor' },
            { key: 'description', label: 'Description', full: true },
          ]}
        />

        <TextListEditor label="Responsibilities" items={form.sim_responsibilities} onChange={v => set('sim_responsibilities', v)} placeholder="Duties / role obligations" addLabel="Add responsibility" />

        <ObjectListEditor
          label="Controlled Assets"
          items={form.sim_controlled_assets}
          onChange={v => set('sim_controlled_assets', v)}
          addLabel="Add asset"
          blank={{ name: '', description: '' }}
          fields={[
            { key: 'name', label: 'Name' },
            { key: 'description', label: 'Description', full: true },
          ]}
        />

        <TextListEditor label="Starting Knowledge" items={form.sim_starting_knowledge} onChange={v => set('sim_starting_knowledge', v)} placeholder="Privately-held starting fact" addLabel="Add fact" />

        <ObjectListEditor
          label="Starting Beliefs / Assumptions"
          items={form.sim_starting_beliefs}
          onChange={v => set('sim_starting_beliefs', v)}
          addLabel="Add belief"
          blank={{ text: '', belief_type: 'hypothesis', confidence: '' }}
          fields={[
            { key: 'text', label: 'Belief', full: true },
            { key: 'belief_type', label: 'Type', type: 'select', options: ['fact', 'hypothesis', 'conviction', 'assumption'] },
            { key: 'confidence', label: 'Confidence (0–1, optional)', type: 'number' },
          ]}
        />
      </div>
      {/* ──────────────────────────────────────────────────────────────── */}

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
          {isNew ? 'Create Character' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
