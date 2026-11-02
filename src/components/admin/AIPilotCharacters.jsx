import React, { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Trash2 } from 'lucide-react';
import { supabase } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

const CONTROL_CLASS = 'bg-black/20 border-white/15 text-white placeholder:text-white/25 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[var(--studio-accent)]';
const PRIMARY_BUTTON_CLASS = 'bg-[var(--studio-accent)] text-[#071211] border border-[var(--studio-accent)] hover:bg-[var(--studio-accent-hover)] hover:border-[var(--studio-accent-hover)]';
const SECONDARY_BUTTON_CLASS = 'bg-white/[0.04] text-white border border-white/15 hover:bg-white/[0.08] hover:border-white/25';

const emptyCharacter = (versionId, sortOrder = 0) => ({
  version_id: versionId,
  role_name: '',
  narrative_function: '',
  description: '',
  backstory: '',
  personality: '',
  motivations: '',
  goals: '',
  fears: '',
  relationships: '',
  character_arc: '',
  behavior: '',
  speech_style: '',
  wardrobe_look: '',
  continuity_locks: '',
  physical_performance: '',
  voice_identity: '',
  voice_delivery: '',
  voice_emotional_range: '',
  dialogue_style: '',
  signature_speech_traits: '',
  voice_continuity: '',
  visual_identity: '',
  visual_continuity: '',
  production_notes: '',
  sort_order: sortOrder,
  is_active: true,
});

const Section = ({ eyebrow, title, description, children }) => (
  <section className="border border-white/10 bg-white/[0.015]">
    <div className="px-4 py-3 border-b border-white/10">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--studio-accent)]">{eyebrow}</div>
      <div className="text-sm text-white mt-1">{title}</div>
      {description && <div className="text-xs text-white/40 mt-1">{description}</div>}
    </div>
    <div className="p-4 space-y-4">{children}</div>
  </section>
);

const Field = ({ label, helper, value, onChange, readOnly, rows = 4, placeholder = '' }) => (
  <label className="space-y-2 block">
    <div>
      <span className="text-xs text-white/60">{label}</span>
      {helper && <div className="text-[11px] text-white/30 mt-1">{helper}</div>}
    </div>
    <Textarea className={CONTROL_CLASS} rows={rows} disabled={readOnly} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
  </label>
);

const AIPilotCharacters = forwardRef(function AIPilotCharacters({ version, readOnly = false }, ref) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);

  const { data: characters = [] } = useQuery({
    queryKey: ['admin-ai-pilot-characters', version?.id],
    enabled: Boolean(version?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_pilot_characters')
        .select('*')
        .eq('version_id', version.id)
        .order('sort_order', { ascending: true })
        .order('role_name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const selected = useMemo(
    () => characters.find((character) => character.id === editingId) || null,
    [characters, editingId]
  );

  React.useEffect(() => {
    if (selected) setDraft({ ...selected });
  }, [selected]);

  React.useEffect(() => {
    if (!version?.id) {
      setEditingId(null);
      setDraft(null);
    }
  }, [version?.id]);

  const persistCharacter = async () => {
    if (!draft || readOnly) return null;
    if (!draft.role_name?.trim()) throw new Error('Character name is required.');

    const payload = {
      version_id: version.id,
      role_name: draft.role_name.trim(),
      narrative_function: draft.narrative_function || '',
      description: draft.description || '',
      backstory: draft.backstory || '',
      personality: draft.personality || '',
      motivations: draft.motivations || '',
      goals: draft.goals || '',
      fears: draft.fears || '',
      relationships: draft.relationships || '',
      character_arc: draft.character_arc || '',
      behavior: draft.behavior || '',
      speech_style: draft.speech_style || '',
      wardrobe_look: draft.wardrobe_look || '',
      continuity_locks: draft.continuity_locks || '',
      physical_performance: draft.physical_performance || '',
      voice_identity: draft.voice_identity || '',
      voice_delivery: draft.voice_delivery || '',
      voice_emotional_range: draft.voice_emotional_range || '',
      dialogue_style: draft.dialogue_style || '',
      signature_speech_traits: draft.signature_speech_traits || '',
      voice_continuity: draft.voice_continuity || '',
      visual_identity: draft.visual_identity || '',
      visual_continuity: draft.visual_continuity || '',
      production_notes: draft.production_notes || '',
      sort_order: Number(draft.sort_order || 0),
      is_active: draft.is_active !== false,
    };

    if (draft.id) {
      const { data, error } = await supabase
        .from('ai_pilot_characters')
        .update(payload)
        .eq('id', draft.id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase
      .from('ai_pilot_characters')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  };

  const saveCharacter = useMutation({
    mutationFn: persistCharacter,
    onSuccess: (character) => {
      queryClient.invalidateQueries({ queryKey: ['admin-ai-pilot-characters', version?.id] });
      if (character?.id) setEditingId(character.id);
    },
    onError: (error) => alert(error?.message || 'Unable to save character'),
  });

  const deleteCharacter = useMutation({
    mutationFn: async () => {
      if (!draft?.id || readOnly) return;
      const { error } = await supabase
        .from('ai_pilot_characters')
        .delete()
        .eq('id', draft.id)
        .eq('version_id', version.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      setEditingId(null);
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: ['admin-ai-pilot-characters', version?.id] });
    },
    onError: (error) => alert(error?.message || 'Unable to delete character'),
  });

  useImperativeHandle(ref, () => ({
    saveCurrent: async () => {
      if (!draft || readOnly) return null;
      const character = await persistCharacter();
      await queryClient.invalidateQueries({ queryKey: ['admin-ai-pilot-characters', version?.id] });
      if (character?.id) setEditingId(character.id);
      return character;
    },
  }), [draft, readOnly, version?.id]);

  const startNew = () => {
    setEditingId(null);
    setDraft(emptyCharacter(version.id, characters.length));
  };

  const setField = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  const confirmDelete = () => {
    if (!draft?.id || deleteCharacter.isPending) return;
    const name = draft.role_name?.trim() || 'this character';
    if (window.confirm(`Delete ${name}? This cannot be undone.`)) {
      deleteCharacter.mutate();
    }
  };

  return (
    <div className="border border-white/10 bg-neutral-950">
      <div className="p-4 md:p-5 border-b border-white/10 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--studio-accent)]">Characters</div>
          <div className="text-sm mt-1 text-white/65">Stable character information shared with AI writing and production tools.</div>
        </div>
        {!readOnly && (
          <Button size="sm" className={SECONDARY_BUTTON_CLASS} onClick={startNew}>
            <Plus size={15} className="mr-1" /> Character
          </Button>
        )}
      </div>

      <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] min-h-[520px]">
        <div className="border-b lg:border-b-0 lg:border-r border-white/10">
          {characters.map((character) => (
            <button
              key={character.id}
              type="button"
              onClick={() => setEditingId(character.id)}
              className={`w-full text-left p-4 border-b border-white/10 hover:bg-white/[0.04] ${editingId === character.id ? 'bg-white/[0.07] shadow-[inset_2px_0_0_var(--studio-accent)]' : ''}`}
            >
              <div className="text-sm text-white">{character.role_name}</div>
              <div className="text-xs text-white/40 mt-1">Character</div>
            </button>
          ))}
          {!characters.length && <div className="p-5 text-sm text-white/35">No characters yet.</div>}
        </div>

        <div className="p-4 md:p-5">
          {!draft ? (
            <div className="min-h-80 flex items-center justify-center text-sm text-white/35">Select or add a character.</div>
          ) : (
            <div className="space-y-5 max-w-5xl">
              <Section eyebrow="Character" title="Character Direction" description="Only stable information that is useful to AI production tools.">
                <label className="space-y-2 block">
                  <span className="text-xs text-white/60">Character Name</span>
                  <Input className={CONTROL_CLASS} disabled={readOnly} value={draft.role_name || ''} onChange={(e) => setField('role_name', e.target.value)} />
                </label>

                <Field
                  label="Role / Function"
                  helper="The character's function in the production or story. Keep it short."
                  value={draft.narrative_function}
                  onChange={(value) => setField('narrative_function', value)}
                  readOnly={readOnly}
                  rows={2}
                  placeholder="Example: lead model, antagonist, mentor, investigator..."
                />

                <Field
                  label="Core Identity"
                  helper="A concise description of who the character is. Keep only stable facts the AI needs to understand the character."
                  value={draft.description}
                  onChange={(value) => setField('description', value)}
                  readOnly={readOnly}
                  rows={3}
                />

                <Field
                  label="Background"
                  helper="Relevant past information that still affects how the character is written, directed or interpreted."
                  value={draft.backstory}
                  onChange={(value) => setField('backstory', value)}
                  readOnly={readOnly}
                  rows={3}
                />

                <Field
                  label="Personality"
                  helper="Core personality traits the AI should consistently preserve."
                  value={draft.personality}
                  onChange={(value) => setField('personality', value)}
                  readOnly={readOnly}
                  rows={3}
                  placeholder="Example: confident, observant, disciplined, direct..."
                />

                <Field
                  label="Visual Identity"
                  helper="Stable visual characteristics needed to keep the character recognizable across image and video tools."
                  value={draft.visual_identity}
                  onChange={(value) => setField('visual_identity', value)}
                  readOnly={readOnly}
                  rows={3}
                />

                <Field
                  label="Voice Prompt"
                  helper="Prompt sent to the voice model / TTS to guide the generated voice: apparent age, accent, tone, pitch, texture, rhythm, energy and other useful vocal qualities."
                  value={draft.voice_identity}
                  onChange={(value) => setField('voice_identity', value)}
                  readOnly={readOnly}
                  rows={3}
                  placeholder="Example: young British female voice, subtle London accent, warm but controlled, medium-low pitch, clear articulation, natural rhythm..."
                />

                <Field
                  label="Key Relationships"
                  helper="Only relationships that materially affect how the character is written or directed."
                  value={draft.relationships}
                  onChange={(value) => setField('relationships', value)}
                  readOnly={readOnly}
                  rows={3}
                />

                <Field
                  label="AI Instructions"
                  helper="Essential rules the AI must respect when using this character. Do not add scene-specific direction here."
                  value={draft.continuity_locks}
                  onChange={(value) => setField('continuity_locks', value)}
                  readOnly={readOnly}
                  rows={3}
                  placeholder="Example: Never portray the character as submissive or impressed simply by wealth or status."
                />
              </Section>

              <div className="grid sm:grid-cols-2 gap-4">
                <label className="space-y-2">
                  <span className="text-xs text-white/55">Order</span>
                  <Input className={CONTROL_CLASS} type="number" disabled={readOnly} value={draft.sort_order ?? 0} onChange={(e) => setField('sort_order', e.target.value)} />
                </label>
                <label className="flex items-end gap-3 pb-2">
                  <Switch disabled={readOnly} checked={draft.is_active !== false} onCheckedChange={(checked) => setField('is_active', checked)} />
                  <span className="text-xs text-white/55">Active</span>
                </label>
              </div>

              {!readOnly && (
                <div className="flex items-center justify-between gap-3">
                  {draft.id ? (
                    <Button variant="destructive" onClick={confirmDelete} disabled={deleteCharacter.isPending || saveCharacter.isPending}>
                      <Trash2 size={15} className="mr-2" /> Delete Character
                    </Button>
                  ) : <div />}
                  <Button className={PRIMARY_BUTTON_CLASS} onClick={() => saveCharacter.mutate()} disabled={saveCharacter.isPending || deleteCharacter.isPending}>
                    <Save size={15} className="mr-2" /> Save Character
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default AIPilotCharacters;
