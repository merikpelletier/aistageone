import React, { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Trash2, Upload, X, Sparkles, Loader2, Volume2, Check } from 'lucide-react';
import { supabase } from '@/api/base44Client';
import { useStudioTranslation } from '@/lib/useStudioTranslation';
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
  voice_apparent_age: '',
  voice_gender: '',
  voice_accent: '',
  voice_timbre_texture: '',
  voice_pitch: '',
  voice_personality_expressiveness: '',
  voice_mode: 'voice_design',
  voice_speaker: 'Serena',
  voice_reference_text: '',
  voice_reference_audio: '',
  voice_delivery: '',
  voice_emotional_range: '',
  dialogue_style: '',
  signature_speech_traits: '',
  voice_continuity: '',
  visual_identity: '',
  visual_continuity: '',
  production_notes: '',
  reference_images: [],
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
  const t = useStudioTranslation();
  const [voiceLanguage, setVoiceLanguage] = useState('en');
  const french = voiceLanguage === 'fr';
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [referenceUploading, setReferenceUploading] = useState(false);
  const [voiceDesigning, setVoiceDesigning] = useState(false);
  const [voicePreviews, setVoicePreviews] = useState([]);
  const [voiceSaving, setVoiceSaving] = useState(false);

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
    if (selected) setDraft((current) => current?.id === selected.id
      ? current
      : { ...selected, reference_images: Array.isArray(selected.reference_images) ? selected.reference_images : [] });
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
      voice_apparent_age: draft.voice_apparent_age || '',
      voice_gender: draft.voice_gender || '',
      voice_accent: draft.voice_accent || '',
      voice_timbre_texture: draft.voice_timbre_texture || '',
      voice_pitch: draft.voice_pitch || '',
      voice_personality_expressiveness: draft.voice_personality_expressiveness || '',
      voice_mode: draft.voice_mode || 'voice_design',
      voice_speaker: draft.voice_speaker || 'Serena',
      voice_reference_text: draft.voice_reference_text || '',
      voice_reference_audio: draft.voice_reference_audio || '',
      voice_language: draft.voice_language || 'auto',
      voice_style_instruction: draft.voice_style_instruction || '',
      voice_preview_text: draft.voice_preview_text || '',
      voice_sample_url: draft.voice_sample_url || null,
      voice_sample_text: draft.voice_sample_text || null,
      voice_sample_url_fr: draft.voice_sample_url_fr || null,
      voice_sample_text_fr: draft.voice_sample_text_fr || null,
      voice_preview_text_fr: draft.voice_preview_text_fr || '',
      voice_accent_fr: draft.voice_accent_fr || '',
      voice_id: draft.voice_id || null,
      voice_delivery: draft.voice_delivery || '',
      voice_emotional_range: draft.voice_emotional_range || '',
      dialogue_style: draft.dialogue_style || '',
      signature_speech_traits: draft.signature_speech_traits || '',
      voice_continuity: draft.voice_continuity || '',
      visual_identity: draft.visual_identity || '',
      visual_continuity: draft.visual_continuity || '',
      production_notes: draft.production_notes || '',
      reference_images: Array.isArray(draft.reference_images) ? draft.reference_images : [],
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
    mutationFn: async (characterId) => {
      if (!characterId || readOnly) return;
      const { error } = await supabase
        .from('ai_pilot_characters')
        .delete()
        .eq('id', characterId)
        .eq('version_id', version.id);
      if (error) throw error;
    },
    onSuccess: async (_, characterId) => {
      if (editingId === characterId) {
        setEditingId(null);
        setDraft(null);
      }
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

  const handleReferenceUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length || readOnly || !version?.id) return;
    const invalid = files.find((file) => !file.type?.startsWith('image/'));
    if (invalid) return alert('Reference images must be image files.');

    setReferenceUploading(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = userData?.user?.id;
      if (!userId) throw new Error('You must be signed in to upload reference images.');

      const uploaded = [];
      for (const file of files) {
        const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'jpg';
        const base = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'reference';
        const path = `${userId}/ai-pilots/${version.id}/characters/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${base}.${extension}`;
        const { error: uploadError } = await supabase.storage.from('media').upload(path, file, { cacheControl: '3600', upsert: false });
        if (uploadError) throw uploadError;
        const { data: publicData } = supabase.storage.from('media').getPublicUrl(path);
        if (!publicData?.publicUrl) throw new Error('Unable to create reference image URL.');
        uploaded.push({ url: publicData.publicUrl, name: file.name });
      }

      setDraft((current) => ({
        ...current,
        reference_images: [...(Array.isArray(current?.reference_images) ? current.reference_images : []), ...uploaded],
      }));
    } catch (error) {
      alert(error?.message || 'Unable to upload reference images');
    } finally {
      setReferenceUploading(false);
    }
  };

  const frenchReferenceText = draft?.voice_preview_text_fr || t('aipilots.voice.default_french_reference', 'Je suis {name}. Voici ma voix. Chaque mot exprime ma personnalité, mon histoire et mes intentions. Écoutez attentivement le son, le rythme et le caractère de ma voix.').replace('{name}', draft?.role_name || '');
  const designCharacterVoice = async () => {
    if (!draft || readOnly || voiceDesigning) return;
    setVoiceDesigning(true);
    setVoicePreviews([]);
    try {
      let character = draft;
      if (!character.id) {
        character = await persistCharacter();
        if (!character?.id) throw new Error('Save the character before designing its voice.');
        setEditingId(character.id);
        setDraft({ ...character, reference_images: Array.isArray(character.reference_images) ? character.reference_images : [] });
        await queryClient.invalidateQueries({ queryKey: ['admin-ai-pilot-characters', version?.id] });
      } else {
        character = await persistCharacter();
      }
      const { data, error } = await supabase.functions.invoke('designCharacterVoice', {
        body: { action: 'design', character_id: character.id, mode: 'voice_design', language: french ? 'fr' : 'en', preview_text: french ? frenchReferenceText : character.voice_preview_text || '' },
      });
      if (error) throw error;
      if (!data?.preview?.audio_url) throw new Error(data?.error || 'Replicate did not return a voice sample.');
      setVoicePreviews([{ ...data.preview, language: voiceLanguage, characterId: character.id }]);
    } catch (error) {
      let message = error?.message || 'Unable to design character voice.';
      const response = error?.context;
      if (response && typeof response.clone === 'function') {
        try {
          const details = await response.clone().json();
          if (details?.error) message = details.error;
        } catch {
          // Keep the original Supabase error when no JSON details are available.
        }
      }
      alert(message);
    } finally {
      setVoiceDesigning(false);
    }
  };

  const saveDesignedVoice = async () => {
    const preview = voicePreviews[0];
    if (!draft?.id || !preview?.audio_url || preview.characterId !== draft.id || voiceSaving) return;
    setVoiceSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('designCharacterVoice', {
        body: { action: 'save', character_id: draft.id, audio_url: preview.audio_url, preview_text: preview.preview_text, language: preview.language },
      });
      if (error) throw error;
      if (!data?.voice_sample_url) throw new Error(data?.error || 'Replicate voice sample was not saved.');
      setDraft((current) => current?.id !== preview.characterId ? current : ({ ...current, ...(preview.language === 'fr' ? { voice_sample_url_fr: data.voice_sample_url, voice_sample_text_fr: preview.preview_text } : { voice_sample_url: data.voice_sample_url, voice_sample_text: preview.preview_text, voice_id: null }) }));
      setVoicePreviews([]);
      await queryClient.invalidateQueries({ queryKey: ['admin-ai-pilot-characters', version?.id] });
      alert('Character voice saved. It will be reused automatically in FotoPlay and compatible Shoot speech generation.');
    } catch (error) {
      alert(error?.message || 'Unable to save character voice.');
    } finally {
      setVoiceSaving(false);
    }
  };

  const removeReferenceImage = (index) => {
    setDraft((current) => ({
      ...current,
      reference_images: (Array.isArray(current?.reference_images) ? current.reference_images : []).filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const confirmDelete = (character) => {
    if (!character?.id || deleteCharacter.isPending) return;
    const name = character.role_name?.trim() || 'this character';
    if (window.confirm(`Delete ${name}? This cannot be undone.`)) {
      deleteCharacter.mutate(character.id);
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
            <Plus size={17} className="mr-1 shrink-0" strokeWidth={2.5} style={{ color: '#ffffff', stroke: '#ffffff' }} /> Add Character
          </Button>
        )}
      </div>

      <div className="min-h-[520px]">
        <div className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-[#0b0d0f] px-4 py-3">
          <label htmlFor="ai-pilot-character-select" className="shrink-0 text-xs font-semibold text-white/60">Select Character</label>
          <select
            id="ai-pilot-character-select"
            aria-label="Select character to edit"
            value={editingId || ''}
            onChange={(event) => setEditingId(event.target.value || null)}
            className="min-w-0 w-full max-w-md flex-1 rounded border border-white/20 bg-[#151719] px-3 py-2 text-sm text-white focus:border-[var(--studio-accent)] focus:outline-none"
          >
            <option value="">Select a character</option>
            {characters.map((character) => (
              <option key={character.id} value={character.id}>{character.role_name}</option>
            ))}
          </select>
          {!readOnly && selected && (
            <button type="button" onClick={() => confirmDelete(selected)}
              aria-label={`Delete ${selected.role_name || 'character'}`}
              title={`Delete ${selected.role_name || 'character'}`}
              disabled={deleteCharacter.isPending}
              className="inline-flex shrink-0 items-center gap-2 rounded border border-red-400/20 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-40">
              <Trash2 size={15} /> Delete {selected.role_name}
            </button>
          )}
        </div>

        <div className="p-4 md:p-5">
          {!draft ? (
            <div className="min-h-80 flex items-center justify-center text-sm text-white/35">Select or add a character.</div>
          ) : (
            <div className="space-y-5 w-full">
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

                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-white/60">Reference Images</div>
                    <div className="text-[11px] text-white/30 mt-1">Images used by compatible AI image and video tools to preserve the character's visual identity.</div>
                  </div>
                  {!!draft.reference_images?.length && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {draft.reference_images.map((image, index) => (
                        <div key={`${image?.url || image}-${index}`} className="relative aspect-[3/4] overflow-hidden border border-white/10 bg-black">
                          <img src={image?.url || image} alt={`${draft.role_name || 'Character'} reference ${index + 1}`} className="h-full w-full object-cover" />
                          {!readOnly && (
                            <button type="button" onClick={() => removeReferenceImage(index)} className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-white hover:bg-black" aria-label={`Remove reference image ${index + 1}`}>
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {!readOnly && (
                    <label className="inline-flex cursor-pointer items-center gap-2 border border-white/15 bg-white/[0.04] px-3 py-2 text-xs text-white/75 hover:bg-white/[0.08] hover:border-white/25">
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleReferenceUpload} disabled={referenceUploading} />
                      <Upload size={14} /> {referenceUploading ? 'Uploading…' : 'Add reference images'}
                    </label>
                  )}
                </div>

                

                <Section eyebrow="VOICE STUDIO" title="Character Voice" description="Define the character's permanent vocal identity. Emotional direction belongs to individual dialogue in FotoPlay and Shoot.">
                  <div className="flex gap-2">
                    {['en', 'fr'].map(lang => <button key={lang} type="button" disabled={voiceDesigning || voiceSaving} onClick={() => { setVoiceLanguage(lang); setVoicePreviews([]); }} className={`px-3 py-2 text-xs border ${voiceLanguage === lang ? 'border-[#23c7be] text-[#23c7be]' : 'border-white/15 text-white/60'}`}>{lang === 'en' ? t('aipilots.voice.english', 'English') : t('aipilots.voice.french', 'French')}</button>)}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Apparent age" helper="How old the voice should sound." value={draft.voice_apparent_age} onChange={(value) => setField('voice_apparent_age', value)} readOnly={readOnly} rows={2} placeholder="Mature adult…" />
                    <Field label="Vocal gender" helper="Vocal presentation." value={draft.voice_gender} onChange={(value) => setField('voice_gender', value)} readOnly={readOnly} rows={2} placeholder="Feminine, masculine, androgynous…" />
                    <Field label={t('aipilots.voice.accent', 'Accent')} helper="Accent and pronunciation, not spoken language." value={draft.voice_accent} onChange={(value) => setField('voice_accent', value)} readOnly={readOnly} rows={2} placeholder="Native Italian accent when speaking English…" />
                    <Field label="Timbre & texture" helper="The sound and texture of the voice." value={draft.voice_timbre_texture} onChange={(value) => setField('voice_timbre_texture', value)} readOnly={readOnly} rows={2} placeholder="Warm, rich, slightly husky…" />
                    <Field label="Pitch / register" helper="Natural vocal range." value={draft.voice_pitch} onChange={(value) => setField('voice_pitch', value)} readOnly={readOnly} rows={2} placeholder="Low, mid-low, high…" />
                    <Field label="Personality & expressiveness" helper="Stable vocal character, not scene emotion." value={draft.voice_personality_expressiveness} onChange={(value) => setField('voice_personality_expressiveness', value)} readOnly={readOnly} rows={2} placeholder="Confident, elegant, measured…" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label={t('aipilots.voice.reference_text', 'Voice reference dialogue')} value={french ? frenchReferenceText : draft.voice_preview_text} onChange={(value) => setField(french ? 'voice_preview_text_fr' : 'voice_preview_text', value)} readOnly={readOnly} rows={3} placeholder={french ? t('aipilots.voice.french_text', 'Write the exact French dialogue to read.') : t('aipilots.voice.english_text', 'Write the exact English dialogue to read.')} />
                  </div>
                  <div className="border border-white/10 bg-white/[0.025] p-3 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-white/75">Voice preview</div>
                        <div className="mt-1 text-[11px] text-white/40">{(french ? draft.voice_sample_url_fr : draft.voice_sample_url) ? 'A voice sample is saved for this character.' : 'Generate a preview, listen, refine the description, then approve it.'}</div>
                      </div>
                      <span className="text-[10px] font-bold text-[#23c7be]">{(french ? draft.voice_sample_url_fr : draft.voice_sample_url) ? 'SAMPLE SAVED' : 'AWAITING APPROVAL'}</span>
                    </div>
                    {(french ? draft.voice_sample_url_fr : draft.voice_sample_url) && <audio controls preload="none" className="h-8 max-w-full" src={french ? draft.voice_sample_url_fr : draft.voice_sample_url} />}
                    {!readOnly && <button type="button" onClick={designCharacterVoice} disabled={voiceDesigning || voiceSaving || ![draft.voice_apparent_age, draft.voice_gender, draft.voice_accent, draft.voice_timbre_texture, draft.voice_pitch, draft.voice_personality_expressiveness].some((value) => value?.trim())} className="inline-flex items-center gap-2 border border-[#23c7be]/40 bg-[#23c7be]/10 px-3 py-2 text-xs font-bold text-[#8ee9e4] disabled:opacity-40">
                      {voiceDesigning ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      {voiceDesigning ? 'Generating preview…' : 'Generate voice preview'}
                    </button>}
                    {!!voicePreviews.length && voicePreviews[0].characterId === draft.id && voicePreviews[0].language === voiceLanguage && <div className="space-y-2">
                      <div className="text-[11px] font-bold text-white/65">Listen to the proposed voice</div>
                      {voicePreviews.map((preview) => <div key={preview.audio_url} className="flex items-center gap-3 border border-[#23c7be] bg-[#23c7be]/10 p-2">
                        <span className="flex-1 text-xs text-white/75">Voice preview</span>
                        <audio controls preload="none" className="h-8 max-w-[220px]" src={preview.audio_url} />
                      </div>)}
                      <button type="button" onClick={saveDesignedVoice} disabled={voiceSaving} className="inline-flex items-center gap-2 bg-[#23c7be] px-3 py-2 text-xs font-black text-black disabled:opacity-40">
                        {voiceSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve & save voice
                      </button>
                    </div>}
                  </div>
                </Section>

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

            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default AIPilotCharacters;
