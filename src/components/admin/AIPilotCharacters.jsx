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
    if (!draft.role_name?.trim()) throw new Error('Character / role name is required.');

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
          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--studio-accent)]">Characters / Roles</div>
          <div className="text-sm mt-1 text-white/65">Production directions for how AI tools must write, portray, animate and voice each role.</div>
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
              <div className="text-xs text-white/40 mt-1">{character.narrative_function || 'Role'}</div>
            </button>
          ))}
          {!characters.length && <div className="p-5 text-sm text-white/35">No characters yet.</div>}
        </div>

        <div className="p-4 md:p-5">
          {!draft ? (
            <div className="min-h-80 flex items-center justify-center text-sm text-white/35">Select or add a character.</div>
          ) : (
            <div className="space-y-5 max-w-5xl">
              <Section eyebrow="Identity" title="Narrative Core" description="The story information used by writing and direction tools to understand who this person is.">
                <div className="grid md:grid-cols-2 gap-4">
                  <label className="space-y-2">
                    <span className="text-xs text-white/60">Character / Role Name</span>
                    <Input className={CONTROL_CLASS} disabled={readOnly} value={draft.role_name || ''} onChange={(e) => setField('role_name', e.target.value)} />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs text-white/60">Narrative Function</span>
                    <Input className={CONTROL_CLASS} disabled={readOnly} value={draft.narrative_function || ''} onChange={(e) => setField('narrative_function', e.target.value)} placeholder="Lead, antagonist, ally, critic..." />
                  </label>
                </div>
                <Field label="Role Description" helper="Feeds FotoPlay, scene writing and production context." value={draft.description} onChange={(value) => setField('description', value)} readOnly={readOnly} rows={3} />
                <Field label="Backstory" helper="Only information that should influence behavior, dialogue or story decisions." value={draft.backstory} onChange={(value) => setField('backstory', value)} readOnly={readOnly} />
                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Personality / Behavioral Traits" helper="Core behavior the AI must preserve." value={draft.personality} onChange={(value) => setField('personality', value)} readOnly={readOnly} />
                  <Field label="Motivation / Goals / Pressure" helper="What drives choices in generated scenes." value={[draft.motivations, draft.goals, draft.fears].filter(Boolean).join('\n\n')} onChange={(value) => setDraft((current) => ({ ...current, motivations: value, goals: '', fears: '' }))} readOnly={readOnly} />
                </div>
                <Field label="Relationships" helper="How behavior changes around specific people." value={draft.relationships} onChange={(value) => setField('relationships', value)} readOnly={readOnly} />
                <Field label="Character Arc" helper="Long-term evolution; prevents generated scenes from ignoring where the role is in the story." value={draft.character_arc} onChange={(value) => setField('character_arc', value)} readOnly={readOnly} />
              </Section>

              <Section eyebrow="Performance" title="Physical Performance Direction" description="Feeds AI Video, Compose and any model generating acting, movement or body language.">
                <Field label="Physical Performance" helper="Posture, movement, gestures, eye behavior, energy, stillness, physical confidence and recurring mannerisms." value={draft.physical_performance} onChange={(value) => setField('physical_performance', value)} readOnly={readOnly} placeholder="Example: controlled posture, economical gestures, holds eye contact under pressure..." />
                <Field label="Behavior Under Pressure" helper="How the performance changes in conflict, intimacy, fear, anger, seduction, authority or vulnerability." value={draft.behavior} onChange={(value) => setField('behavior', value)} readOnly={readOnly} />
              </Section>

              <Section eyebrow="Voice" title="Voice & Speech Direction" description="Shared vocal direction for AI Video, Dubbing, TTS, Lip Sync and dialogue generation.">
                <Field label="Voice Identity" helper="Timbre, perceived age, register, texture, accent, resonance and vocal presence. This defines what the voice should sound like." value={draft.voice_identity} onChange={(value) => setField('voice_identity', value)} readOnly={readOnly} placeholder="Example: warm low register, precise London inflection, controlled resonance..." />
                <Field label="Delivery & Rhythm" helper="Pace, pauses, breath, articulation, emphasis, volume and conversational rhythm." value={draft.voice_delivery} onChange={(value) => setField('voice_delivery', value)} readOnly={readOnly} />
                <Field label="Emotional Vocal Range" helper="How the voice changes across emotions while remaining recognizably the same character." value={draft.voice_emotional_range} onChange={(value) => setField('voice_emotional_range', value)} readOnly={readOnly} />
                <Field label="Dialogue Style" helper="Vocabulary, sentence length, formality, humor, directness, hesitation and verbal strategy. Feeds dialogue writing as well as spoken performance." value={draft.dialogue_style} onChange={(value) => setField('dialogue_style', value)} readOnly={readOnly} />
                <Field label="Signature Speech Traits" helper="Recurring phrases, verbal habits, interruptions, fillers, clipped endings or patterns that may be used without becoming caricature." value={draft.signature_speech_traits} onChange={(value) => setField('signature_speech_traits', value)} readOnly={readOnly} />
                <Field label="Voice Continuity / Never Change" helper="Hard vocal locks that every voice-producing model must preserve across scenes and tools." value={draft.voice_continuity} onChange={(value) => setField('voice_continuity', value)} readOnly={readOnly} />
              </Section>

              <Section eyebrow="Visual" title="Visual Production Direction" description="Feeds Actor, Compose, AI Video and image-generation tools without tying the role to a specific performer.">
                <Field label="Visual Identity" helper="Stable visual qualities of the role: silhouette, grooming, presence, styling logic and defining visual cues." value={draft.visual_identity} onChange={(value) => setField('visual_identity', value)} readOnly={readOnly} />
                <Field label="Wardrobe / Styling Direction" helper="How the role should be dressed and styled; use story-state variations when needed." value={draft.wardrobe_look} onChange={(value) => setField('wardrobe_look', value)} readOnly={readOnly} />
                <Field label="Visual Continuity / Never Change" helper="Locks for generated images and video: details that cannot drift between shots, scenes or tools." value={draft.visual_continuity} onChange={(value) => setField('visual_continuity', value)} readOnly={readOnly} />
              </Section>

              <Section eyebrow="Control" title="Production Locks & Tool Notes" description="Final constraints used to prevent AI drift across the production pipeline.">
                <Field label="Global Continuity Locks / Do Not Change" helper="Cross-tool rules that override creative variation for this role." value={draft.continuity_locks} onChange={(value) => setField('continuity_locks', value)} readOnly={readOnly} />
                <Field label="Production Notes" helper="Role-specific instructions that do not fit another field but must reach the production resolver." value={draft.production_notes} onChange={(value) => setField('production_notes', value)} readOnly={readOnly} />
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
