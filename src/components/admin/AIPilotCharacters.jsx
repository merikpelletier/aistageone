import React, { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save } from 'lucide-react';
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
              <Section eyebrow="Identity" title="Character Core" description="Only stable information that helps the AI understand and preserve this character.">
                <label className="space-y-2 block">
                  <span className="text-xs text-white/60">Character Name</span>
                  <Input className={CONTROL_CLASS} disabled={readOnly} value={draft.role_name || ''} onChange={(e) => setField('role_name', e.target.value)} />
                </label>
                <Field label="Character Description" helper="A short description of who the character is. Do not repeat personality, history or appearance." value={draft.description} onChange={(value) => setField('description', value)} readOnly={readOnly} rows={3} />
                <Field label="Personality & Behavior" helper="Core traits and reactions the AI should consistently preserve." value={draft.personality} onChange={(value) => setField('personality', value)} readOnly={readOnly} rows={3} />
                <Field label="Relevant Backstory" helper="Optional. Include only past facts that still affect the character's present behavior or decisions." value={draft.backstory} onChange={(value) => setField('backstory', value)} readOnly={readOnly} rows={3} />
              </Section>

              <Section eyebrow="Performance" title="Performance Direction" description="Use only recurring performance information that should remain consistent across generated scenes.">
                <Field label="Physical Performance" helper="Posture, movement, gestures, eye behavior or mannerisms that define the character on screen." value={draft.physical_performance} onChange={(value) => setField('physical_performance', value)} readOnly={readOnly} rows={3} placeholder="Example: controlled posture, economical gestures, steady eye contact..." />
              </Section>

              <Section eyebrow="Voice" title="Voice & Dialogue" description="The minimum vocal direction needed to keep speaking and dialogue consistent.">
                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Voice Identity" helper="Only stable vocal qualities: register, texture, accent or defining vocal presence." value={draft.voice_identity} onChange={(value) => setField('voice_identity', value)} readOnly={readOnly} rows={3} placeholder="Example: warm low register, precise London inflection..." />
                  <Field label="Dialogue Style" helper="How the character speaks: vocabulary, rhythm, formality, directness or recurring verbal habits." value={draft.dialogue_style} onChange={(value) => setField('dialogue_style', value)} readOnly={readOnly} rows={3} />
                </div>
              </Section>

              <Section eyebrow="Visual" title="Visual Direction" description="Stable visual information that image and video tools need to preserve the character.">
                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Visual Identity" helper="Defining visual qualities that should remain recognizable across generated images and video." value={draft.visual_identity} onChange={(value) => setField('visual_identity', value)} readOnly={readOnly} rows={3} />
                  <Field label="Wardrobe / Styling Direction" helper="Recurring styling logic only. Scene-specific outfits belong with the scene or look." value={draft.wardrobe_look} onChange={(value) => setField('wardrobe_look', value)} readOnly={readOnly} rows={3} />
                </div>
              </Section>

              <Section eyebrow="Continuity" title="Character Locks" description="Use only for details that the AI must never change.">
                <Field label="Do Not Change" helper="Hard character continuity rules. Leave blank when there is no true lock." value={draft.continuity_locks} onChange={(value) => setField('continuity_locks', value)} readOnly={readOnly} rows={3} />
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
                <div className="flex justify-end">
                  <Button className={PRIMARY_BUTTON_CLASS} onClick={() => saveCharacter.mutate()} disabled={saveCharacter.isPending}>
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
