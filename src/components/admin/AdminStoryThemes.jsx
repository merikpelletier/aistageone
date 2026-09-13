import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { BookOpen, Plus, X, ChevronRight, ChevronLeft, Loader2, Trash2, Pencil, Sparkles, Save, ArrowLeft, Users, Layers, Check, Film } from 'lucide-react';
import { toast } from 'sonner';
import CastSetsManager from '@/components/admin/CastSetsManager';
import ThemeMediaManager from '@/components/admin/ThemeMediaManager';
import { TextListEditor, ObjectListEditor } from '@/components/admin/simInitEditors';

export default function AdminStoryThemes() {
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTheme, setEditingTheme] = useState(null); // null | 'new' | theme object
  const [managingTopicsFor, setManagingTopicsFor] = useState(null); // theme object or null
  const [managingAssetsFor, setManagingAssetsFor] = useState(null); // theme object or null
  const [managingMediaFor, setManagingMediaFor] = useState(null); // theme object or null

  const loadThemes = () => {
    setLoading(true);
    base44.entities.StoryTheme.filter({}, 'order', 50)
      .then(setThemes)
      .catch(() => toast.error('Failed to load themes'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadThemes(); }, []);

  const handleDeleteTheme = async (theme) => {
    if (!confirm(`Delete "${theme.title}"? This will also delete its starting topics.`)) return;
    try {
      await base44.admin.deleteStoryTheme(theme.id);
      toast.success('Theme deleted');
      loadThemes();
    } catch (e) {
      toast.error('Failed to delete theme');
    }
  };

  // ── TOPICS MANAGEMENT VIEW ──
  if (managingTopicsFor) {
    return (
      <TopicsManager
        theme={managingTopicsFor}
        onBack={() => { setManagingTopicsFor(null); loadThemes(); }}
      />
    );
  }

  // ── CAST & SETS MANAGEMENT VIEW ──
  if (managingAssetsFor) {
    return (
      <CastSetsManager
        theme={managingAssetsFor}
        onBack={() => { setManagingAssetsFor(null); loadThemes(); }}
      />
    );
  }

  // ── MEDIA MANAGEMENT VIEW ──
  if (managingMediaFor) {
    return (
      <ThemeMediaManager
        theme={managingMediaFor}
        onBack={() => { setManagingMediaFor(null); loadThemes(); }}
      />
    );
  }

  // ── THEME EDITOR VIEW ──
  if (editingTheme) {
    return (
      <ThemeEditor
        theme={editingTheme === 'new' ? null : editingTheme}
        onBack={() => { setEditingTheme(null); loadThemes(); }}
      />
    );
  }

  // ── THEMES LIST VIEW ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white text-lg font-light tracking-wider">FOTOPLAY</h2>
          <p className="text-white text-xs">Create themes for the FotoPlay engine</p>
        </div>
        <Button
          onClick={() => setEditingTheme('new')}
          className="bg-white text-black hover:bg-white/90"
        >
          <Plus size={16} className="mr-1" /> New Theme
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={24} className="animate-spin text-white" />
        </div>
      ) : themes.length === 0 ? (
        <div className="bg-neutral-900 border border-white/10 rounded-sm p-12 text-center">
          <BookOpen size={32} className="text-white/20 mx-auto mb-3" />
          <p className="text-white text-sm">No themes yet. Create your first one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {themes.map(theme => (
            <motion.div
              key={theme.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-neutral-900 border border-white/10 rounded-sm p-4 flex items-center gap-4"
            >
              <div className="w-12 h-12 bg-yellow-400 rounded-sm flex items-center justify-center flex-shrink-0 overflow-hidden">
                {theme.cover_image ? (
                  <img src={theme.cover_image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <BookOpen size={20} className="text-black" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm">{theme.title}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  {theme.type && <span className="text-white text-xs uppercase tracking-wide">{theme.type}</span>}
                  <span className="text-yellow-400 text-xs">{theme.credit_cost_per_block || 10} Ⓣ/block</span>
                  <span className="text-white text-xs">{theme.is_active ? 'Active' : 'Inactive'}</span>
                </div>
                <p className="text-white text-xs mt-1 line-clamp-1">{theme.description}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  onClick={() => setManagingTopicsFor(theme)}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:text-white hover:bg-white/10 h-8 px-2"
                >
                  <Sparkles size={14} className="mr-1" /> Topics
                </Button>
                <Button
                  onClick={() => setManagingAssetsFor(theme)}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:text-white hover:bg-white/10 h-8 px-2"
                >
                  <Users size={14} className="mr-1" /> Cast & Sets
                </Button>
                <Button
                  onClick={() => setManagingMediaFor(theme)}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:text-white hover:bg-white/10 h-8 px-2"
                >
                  <Film size={14} className="mr-1" /> Media
                </Button>
                <Button
                  onClick={() => setEditingTheme(theme)}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:text-white hover:bg-white/10 h-8 w-8 p-0"
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  onClick={() => handleDeleteTheme(theme)}
                  variant="ghost"
                  size="sm"
                  className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10 h-8 w-8 p-0"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── THEME EDITOR ──
function ThemeEditor({ theme, onBack }) {
  const isNew = !theme;
  const [form, setForm] = useState({
    title: theme?.title || '',
    type: theme?.type || '',
    description: theme?.description || '',
    tone_rules: theme?.tone_rules || '',
    story_rules: theme?.story_rules || '',
    credit_cost_per_block: theme?.credit_cost_per_block || 10,
    cover_image: theme?.cover_image || '',
    cover_template_image: theme?.cover_template_image || '',
    is_active: theme?.is_active ?? true,
    order: theme?.order || 0,
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleUploadImage = async (file) => {
    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set('cover_image', file_url);
      toast.success('Cover image uploaded');
    } catch {
      toast.error('Image upload failed');
    }
    setUploadingImage(false);
  };

  const handleUploadTemplate = async (file) => {
    setUploadingTemplate(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set('cover_template_image', file_url);
      toast.success('Cover template uploaded');
    } catch {
      toast.error('Template upload failed');
    }
    setUploadingTemplate(false);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.description.trim()) { toast.error('Description is required'); return; }
    if (!form.type.trim()) { toast.error('Genre / type is required'); return; }
    setSaving(true);
    try {
      if (isNew) {
        await base44.admin.saveStoryTheme(null, form);
        toast.success('Theme created!');
      } else {
        await base44.admin.saveStoryTheme(theme.id, form);
        toast.success('Theme updated!');
      }
      onBack();
    } catch (e) {
      toast.error('Failed to save theme');
    }
    setSaving(false);
  };

  const inputClass = "w-full bg-neutral-800 border border-white/10 rounded-sm px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30";
  const labelClass = "text-white text-xs uppercase tracking-wider font-medium mb-1.5 block";

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-2 text-white hover:text-white text-sm">
        <ArrowLeft size={16} /> Back to themes
      </button>

      <h2 className="text-white text-lg font-light tracking-wider">
        {isNew ? 'NEW THEME' : 'EDIT THEME'}
      </h2>

      {/* Cover image */}
      <div>
        <label className={labelClass}>Cover Image</label>
        <div className="flex items-center gap-3">
          <div className="w-24 h-16 bg-neutral-800 border border-white/10 rounded-sm overflow-hidden flex-shrink-0">
            {form.cover_image ? (
              <img src={form.cover_image} alt="" className="w-full h-full object-cover" />
            ) : (
              <BookOpen size={20} className="text-white/20 m-auto mt-4" />
            )}
          </div>
          <label className="cursor-pointer">
            <span className="inline-flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs rounded-sm transition-colors">
              {uploadingImage ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {uploadingImage ? 'Uploading…' : 'Upload Image'}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files[0]; if (f) handleUploadImage(f); }}
            />
          </label>
          {form.cover_image && (
            <button onClick={() => set('cover_image', '')} className="text-red-400/60 hover:text-red-400 text-xs">
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Cover template image — designed background with series title baked in */}
      <div>
        <label className={labelClass}>Cover Template (Series Poster Background)</label>
        <p className="text-white/40 text-xs mb-2">Portrait image with the series title baked into the artwork. Published Story cards use this as the background, overlay the story title at the top, and center the chosen scene image.</p>
        <div className="flex items-center gap-3">
          <div className="w-16 h-24 bg-neutral-800 border border-white/10 rounded-sm overflow-hidden flex-shrink-0">
            {form.cover_template_image ? (
              <img src={form.cover_template_image} alt="" className="w-full h-full object-cover" />
            ) : (
              <BookOpen size={20} className="text-white/20 m-auto mt-8" />
            )}
          </div>
          <label className="cursor-pointer">
            <span className="inline-flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-xs rounded-sm transition-colors">
              {uploadingTemplate ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {uploadingTemplate ? 'Uploading…' : 'Upload Template'}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files[0]; if (f) handleUploadTemplate(f); }}
            />
          </label>
          {form.cover_template_image && (
            <button onClick={() => set('cover_template_image', '')} className="text-red-400/60 hover:text-red-400 text-xs">
              Remove
            </button>
          )}
        </div>
      </div>

      <div>
        <label className={labelClass}>Title *</label>
        <input
          value={form.title}
          onChange={e => set('title', e.target.value)}
          placeholder="e.g. Neon Noir"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Genre / Type *</label>
        <input
          value={form.type}
          onChange={e => set('type', e.target.value)}
          placeholder="e.g. drama, comedy, thriller, sci-fi"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Description *</label>
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Full description of the theme's world, mood, and setting"
          rows={3}
          className={inputClass + ' resize-none'}
        />
      </div>

      <div>
        <label className={labelClass}>Tone Rules</label>
        <textarea
          value={form.tone_rules}
          onChange={e => set('tone_rules', e.target.value)}
          placeholder="Rules governing the tone and atmosphere (e.g. 'Dark and moody, no graphic violence, tension through dialogue')"
          rows={2}
          className={inputClass + ' resize-none'}
        />
      </div>

      <div>
        <label className={labelClass}>Story Rules</label>
        <textarea
          value={form.story_rules}
          onChange={e => set('story_rules', e.target.value)}
          placeholder="Rules for story structure, pacing, and content boundaries (e.g. 'Each block 15-30 seconds, always end with a dilemma, max 3 choices')"
          rows={2}
          className={inputClass + ' resize-none'}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Credit Cost / Block</label>
          <input
            type="number"
            value={form.credit_cost_per_block}
            onChange={e => set('credit_cost_per_block', Number(e.target.value))}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Display Order</label>
          <input
            type="number"
            value={form.order}
            onChange={e => set('order', Number(e.target.value))}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={e => set('is_active', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-white text-sm">Active (visible to users)</span>
        </label>
      </div>

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
          {isNew ? 'Create Theme' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}

// ── TOPICS MANAGER ──
function TopicsManager({ theme, onBack }) {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTopic, setEditingTopic] = useState(null); // null | 'new' | topic object

  const loadTopics = () => {
    setLoading(true);
    base44.entities.StartingTopic.filter({ theme_id: theme.id }, 'order', 50)
      .then(setTopics)
      .catch(() => toast.error('Failed to load topics'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTopics(); }, [theme.id]);

  const handleDeleteTopic = async (topic) => {
    if (!confirm(`Delete "${topic.title}"?`)) return;
    try {
      await base44.admin.deleteStartingTopic(topic.id);
      toast.success('Topic deleted');
      loadTopics();
    } catch {
      toast.error('Failed to delete topic');
    }
  };

  if (editingTopic) {
    return (
      <TopicEditor
        theme={theme}
        topic={editingTopic === 'new' ? null : editingTopic}
        onBack={() => { setEditingTopic(null); loadTopics(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-white hover:text-white text-sm">
        <ArrowLeft size={16} /> Back to themes
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white text-lg font-light tracking-wider">STARTING TOPICS</h2>
          <p className="text-white text-xs">For: {theme.title}</p>
        </div>
        <Button
          onClick={() => setEditingTopic('new')}
          className="bg-white text-black hover:bg-white/90"
        >
          <Plus size={16} className="mr-1" /> New Topic
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={24} className="animate-spin text-white" />
        </div>
      ) : topics.length === 0 ? (
        <div className="bg-neutral-900 border border-white/10 rounded-sm p-12 text-center">
          <Sparkles size={32} className="text-white/20 mx-auto mb-3" />
          <p className="text-white text-sm">No topics yet. Create the first one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {topics.map(topic => (
            <motion.div
              key={topic.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-neutral-900 border border-white/10 rounded-sm p-4 flex items-center gap-4"
            >
              <div className="w-10 h-10 bg-yellow-400/20 rounded-sm flex items-center justify-center flex-shrink-0">
                <Sparkles size={16} className="text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm">{topic.title}</p>
                <p className="text-white text-xs mt-1 line-clamp-2">{topic.description}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  onClick={() => setEditingTopic(topic)}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:text-white hover:bg-white/10 h-8 w-8 p-0"
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  onClick={() => handleDeleteTopic(topic)}
                  variant="ghost"
                  size="sm"
                  className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10 h-8 w-8 p-0"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── TOPIC EDITOR ──
function TopicEditor({ theme, topic, onBack }) {
  const isNew = !topic;
  const [form, setForm] = useState({
    title: topic?.title || '',
    description: topic?.description || '',
    theme_id: theme.id,
    order: topic?.order || 0,
    character_ids: topic?.character_ids || [],
    // ── Simulation initialization (admin-authored only) ──
    sim_opening_situation: topic?.sim_opening_situation || '',
    sim_world_conditions: topic?.sim_world_conditions || [],
    sim_public_facts: topic?.sim_public_facts || [],
    sim_private_facts_by_character: topic?.sim_private_facts_by_character || [],
    sim_hero_initial_goals: topic?.sim_hero_initial_goals || [],
    sim_initial_active_situations: topic?.sim_initial_active_situations || [],
  });
  const [saving, setSaving] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [availableChars, setAvailableChars] = useState([]);
  const [loadingChars, setLoadingChars] = useState(true);

  useEffect(() => {
    const ids = theme.story_character_ids || [];
    if (ids.length === 0) { setAvailableChars([]); setLoadingChars(false); return; }
    Promise.all(ids.map(id => base44.entities.StoryCharacter.get(id).catch(() => null)))
      .then(chars => { setAvailableChars(chars.filter(Boolean)); setLoadingChars(false); })
      .catch(() => setLoadingChars(false));
  }, [theme.id]);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const toggleChar = (id) => setForm(prev => ({
    ...prev,
    character_ids: prev.character_ids.includes(id)
      ? prev.character_ids.filter(c => c !== id)
      : [...prev.character_ids, id],
  }));

  // ── AI auto-fill: draft the whole form from the description + theme cast ──
  const handleAutoFill = async () => {
    if (!form.description.trim()) { toast.error('Write a description first'); return; }
    if (availableChars.length === 0) { toast.error('No characters linked to this theme yet'); return; }
    setAutofilling(true);
    try {
      const cast = availableChars.map(c => ({ id: c.id, name: c.name, character_type: c.character_type || '', description: c.description || '' }));
      const prompt = `You help an admin author a "Starting Topic" for an AI story-simulation engine.

THEME: ${theme.title}
THEME DESCRIPTION: ${theme.description || ''}

TOPIC DESCRIPTION (the admin's input — everything you generate must be consistent with it):
${form.description}

AVAILABLE CHARACTERS (ONLY use these ids for character_ids, private facts, and hero goals):
${JSON.stringify(cast, null, 2)}

Generate the rest of the topic form from the description:
- title: a short evocative title
- character_ids: ids of characters who should feature in this opening
- sim_opening_situation: the opening objective event or pressure (one sentence)
- sim_world_conditions: starting world conditions (short strings)
- sim_public_facts: facts everyone in the pack knows (short strings)
- sim_private_facts_by_character: privately-held starting facts per character (use only ids above)
- sim_hero_initial_goals: an initial goal for each selectable hero (use only ids above)
- sim_initial_active_situations: initial active situations with a type and status

Return only the JSON object.`;
      const data = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            character_ids: { type: 'array', items: { type: 'string' } },
            sim_opening_situation: { type: 'string' },
            sim_world_conditions: { type: 'array', items: { type: 'string' } },
            sim_public_facts: { type: 'array', items: { type: 'string' } },
            sim_private_facts_by_character: { type: 'array', items: { type: 'object', properties: { character_id: { type: 'string' }, facts: { type: 'array', items: { type: 'string' } } }, required: ['character_id', 'facts'] } },
            sim_hero_initial_goals: { type: 'array', items: { type: 'object', properties: { character_id: { type: 'string' }, goal: { type: 'string' } }, required: ['character_id', 'goal'] } },
            sim_initial_active_situations: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, situation_type: { type: 'string', enum: ['debt', 'investigation', 'threat', 'deadline', 'other'] }, status: { type: 'string', enum: ['pending', 'active', 'escalating', 'resolved', 'abandoned'] } }, required: ['name', 'situation_type', 'status'] } },
          },
        },
      });
      const validIds = new Set(availableChars.map(c => c.id));
      setForm(prev => ({
        ...prev,
        title: prev.title.trim() ? prev.title : (data.title || '').trim(),
        character_ids: Array.from(new Set([...prev.character_ids, ...(data.character_ids || []).filter(id => validIds.has(id))])),
        sim_opening_situation: data.sim_opening_situation || prev.sim_opening_situation,
        sim_world_conditions: (data.sim_world_conditions?.length ? data.sim_world_conditions : prev.sim_world_conditions),
        sim_public_facts: (data.sim_public_facts?.length ? data.sim_public_facts : prev.sim_public_facts),
        sim_private_facts_by_character: (data.sim_private_facts_by_character || []).filter(p => p.character_id && validIds.has(p.character_id)),
        sim_hero_initial_goals: (data.sim_hero_initial_goals || []).filter(g => g.character_id && validIds.has(g.character_id) && g.goal),
        sim_initial_active_situations: (data.sim_initial_active_situations || []).filter(s => s.name),
      }));
      toast.success('Form auto-filled — review before saving');
    } catch {
      toast.error('Auto-fill failed');
    } finally {
      setAutofilling(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.description.trim()) { toast.error('Description is required'); return; }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      theme_id: form.theme_id,
      order: form.order,
      character_ids: form.character_ids,
      // ── Simulation initialization: saved verbatim, never derived ──
      sim_opening_situation: (form.sim_opening_situation || '').trim() || null,
      sim_world_conditions: (form.sim_world_conditions || []).map(s => s.trim()).filter(Boolean),
      sim_public_facts: (form.sim_public_facts || []).map(s => s.trim()).filter(Boolean),
      sim_private_facts_by_character: (form.sim_private_facts_by_character || [])
        .map(p => ({ character_id: p.character_id || '', facts: (p.facts || []).map(f => f.trim()).filter(Boolean) }))
        .filter(p => p.character_id && p.facts.length > 0),
      sim_hero_initial_goals: (form.sim_hero_initial_goals || [])
        .map(g => ({ character_id: g.character_id || '', goal: (g.goal || '').trim() }))
        .filter(g => g.character_id && g.goal),
      sim_initial_active_situations: (form.sim_initial_active_situations || [])
        .map(s => ({
          name: (s.name || '').trim(),
          description: (s.description || '').trim(),
          situation_type: s.situation_type || 'other',
          status: s.status || 'active',
        }))
        .filter(s => s.name),
    };
    try {
      await base44.admin.saveStartingTopic(isNew ? null : topic.id, payload);
      toast.success(isNew ? 'Topic created!' : 'Topic updated!');
      onBack();
    } catch (error) {
      console.error('Failed to save starting topic', error);
      toast.error('Failed to save topic');
    }
    setSaving(false);
  };

  const inputClass = "w-full bg-neutral-800 border border-white/10 rounded-sm px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30";
  const labelClass = "text-white text-xs uppercase tracking-wider font-medium mb-1.5 block";

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-2 text-white hover:text-white text-sm">
        <ArrowLeft size={16} /> Back to topics
      </button>

      <h2 className="text-white text-lg font-light tracking-wider">
        {isNew ? 'NEW TOPIC' : 'EDIT TOPIC'}
      </h2>

      <p className="text-white text-xs bg-neutral-900 border border-white/10 rounded-sm px-3 py-2">
        Theme: {theme.title}
      </p>

      <div>
        <label className={labelClass}>Title *</label>
        <input
          value={form.title}
          onChange={e => set('title', e.target.value)}
          placeholder="e.g. The Mysterious Call"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Description *</label>
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Full description used by the AI agent as inspiration to start the story. Be detailed — this sets the opening scene, situation, and mood."
          rows={5}
          className={inputClass + ' resize-none'}
        />
      </div>

      <div>
        <Button
          type="button"
          onClick={handleAutoFill}
          disabled={autofilling || !form.description.trim() || availableChars.length === 0}
          variant="outline"
          className="bg-neutral-800 border-white/20 text-white hover:bg-neutral-700 hover:text-white"
        >
          {autofilling ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Sparkles size={14} className="mr-1.5" />}
          {autofilling ? 'Filling…' : 'Auto-fill from Description'}
        </Button>
        <p className="text-white/40 text-xs mt-1.5">AI drafts the title, character tags, and all simulation fields from your description. Review before saving.</p>
      </div>

      <div>
        <label className={labelClass}>Display Order</label>
        <input
          type="number"
          value={form.order}
          onChange={e => set('order', Number(e.target.value))}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Character Tags (guides the AI)</label>
        <p className="text-white/40 text-xs mb-2">Select which characters could be involved when the story starts from this topic. The AI will be told to feature them.</p>
        {loadingChars ? (
          <div className="flex items-center gap-2 text-white/40 text-xs"><Loader2 size={14} className="animate-spin" /> Loading cast…</div>
        ) : availableChars.length === 0 ? (
          <p className="text-white/30 text-xs italic">No characters linked to this theme yet. Add them via “Cast &amp; Sets”.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableChars.map(c => {
              const active = form.character_ids.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleChar(c.id)}
                  className={
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-sm border text-xs transition-colors " +
                    (active
                      ? "bg-yellow-400 border-yellow-400 text-black"
                      : "bg-neutral-800 border-white/10 text-white hover:border-white/30")
                  }
                >
                  {active ? <Check size={12} /> : null}
                  {c.name || 'Unnamed'}
                  {c.character_type ? <span className={active ? "opacity-60" : "text-white/40"}>· {c.character_type}</span> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ─────────────────── Simulation Initialization ─────────────────── */}
      <div className="border-t border-white/10 pt-5 space-y-4">
        <div>
          <p className="text-white text-sm font-medium uppercase tracking-wider">Simulation Initialization</p>
          <p className="text-white/40 text-xs mt-0.5">Authoritative data the simulation reads at Begin Story. Admin-authored only — not derived from the topic description or character backstories.</p>
        </div>

        <div>
          <label className={labelClass}>Opening Situation</label>
          <textarea
            value={form.sim_opening_situation}
            onChange={e => set('sim_opening_situation', e.target.value)}
            placeholder="The opening objective event or pressure"
            rows={2}
            className={inputClass + ' resize-none'}
          />
        </div>

        <TextListEditor label="World Conditions" items={form.sim_world_conditions} onChange={v => set('sim_world_conditions', v)} placeholder="e.g. Severe heat" addLabel="Add condition" />

        <TextListEditor label="Public Facts" items={form.sim_public_facts} onChange={v => set('sim_public_facts', v)} placeholder="Facts everyone in the pack knows" addLabel="Add public fact" />

        <ObjectListEditor
          label="Private Facts by Character"
          items={form.sim_private_facts_by_character}
          onChange={v => set('sim_private_facts_by_character', v)}
          addLabel="Add private facts"
          blank={{ character_id: '', facts: [] }}
          fields={[
            { key: 'character_id', label: 'Character', type: 'select', options: availableChars.map(c => ({ value: c.id, label: c.name || 'Unnamed' })) },
            { key: 'facts', label: 'Facts', type: 'tags', placeholder: 'comma-separated facts' },
          ]}
        />

        <ObjectListEditor
          label="Hero Initial Goals (per selectable Hero)"
          items={form.sim_hero_initial_goals}
          onChange={v => set('sim_hero_initial_goals', v)}
          addLabel="Add hero goal"
          blank={{ character_id: '', goal: '' }}
          fields={[
            { key: 'character_id', label: 'Hero', type: 'select', options: availableChars.map(c => ({ value: c.id, label: c.name || 'Unnamed' })) },
            { key: 'goal', label: 'Goal', full: true },
          ]}
        />

        <ObjectListEditor
          label="Initial Active Situations"
          items={form.sim_initial_active_situations}
          onChange={v => set('sim_initial_active_situations', v)}
          addLabel="Add situation"
          blank={{ name: '', description: '', situation_type: 'other', status: 'active' }}
          fields={[
            { key: 'name', label: 'Name' },
            { key: 'description', label: 'Description', full: true },
            { key: 'situation_type', label: 'Type', type: 'select', options: ['debt', 'investigation', 'threat', 'deadline', 'other'] },
            { key: 'status', label: 'Status', type: 'select', options: ['pending', 'active', 'escalating', 'resolved', 'abandoned'] },
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
          {isNew ? 'Create Topic' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
