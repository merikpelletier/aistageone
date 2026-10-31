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
  sort_order: sortOrder,
  is_active: true,
});

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

  return (
    <div className="border border-white/10 bg-neutral-950">
      <div className="p-4 md:p-5 border-b border-white/10 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--studio-accent)]">Characters / Roles</div>
          <div className="text-sm mt-1 text-white/65">Define the story roles independently from production casting.</div>
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
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <label className="space-y-2">
                  <span className="text-xs text-white/55">Character / Role Name</span>
                  <Input className={CONTROL_CLASS} disabled={readOnly} value={draft.role_name || ''} onChange={(e) => setDraft({ ...draft, role_name: e.target.value })} />
                </label>
                <label className="space-y-2">
                  <span className="text-xs text-white/55">Narrative Function</span>
                  <Input className={CONTROL_CLASS} disabled={readOnly} value={draft.narrative_function || ''} onChange={(e) => setDraft({ ...draft, narrative_function: e.target.value })} placeholder="Lead, antagonist, mentor, critic..." />
                </label>
              </div>

              {[
                ['description', 'Role Description'],
                ['backstory', 'Backstory'],
                ['personality', 'Personality / Traits'],
                ['motivations', 'Motivations'],
                ['goals', 'Goals'],
                ['fears', 'Fears / Vulnerabilities'],
                ['relationships', 'Relationships'],
                ['character_arc', 'Character Arc'],
                ['behavior', 'Behavior / Performance'],
                ['speech_style', 'Speech Style / Dialogue'],
                ['wardrobe_look', 'Wardrobe / Role Look'],
                ['continuity_locks', 'Continuity Locks / Do Not Change'],
              ].map(([field, label]) => (
                <label key={field} className="space-y-2 block">
                  <span className="text-xs text-white/55">{label}</span>
                  <Textarea className={CONTROL_CLASS} rows={field === 'description' ? 3 : 4} disabled={readOnly} value={draft[field] || ''} onChange={(e) => setDraft({ ...draft, [field]: e.target.value })} />
                </label>
              ))}

              <div className="grid sm:grid-cols-2 gap-4">
                <label className="space-y-2">
                  <span className="text-xs text-white/55">Order</span>
                  <Input className={CONTROL_CLASS} type="number" disabled={readOnly} value={draft.sort_order ?? 0} onChange={(e) => setDraft({ ...draft, sort_order: e.target.value })} />
                </label>
                <label className="flex items-end gap-3 pb-2">
                  <Switch disabled={readOnly} checked={draft.is_active !== false} onCheckedChange={(checked) => setDraft({ ...draft, is_active: checked })} />
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
