import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Copy, Rocket, ChevronRight } from 'lucide-react';
import { supabase } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const BLOCK_TYPES = [
  ['theme_bible', 'Theme Bible'],
  ['look_bible', 'Look Bible'],
  ['production_direction', 'Production Direction'],
  ['performance_direction', 'Performance Direction'],
  ['voice_dialogue_direction', 'Voice / Dialogue Direction'],
  ['music_direction', 'Music Direction'],
  ['sound_direction', 'Sound Direction'],
  ['episode_structure', 'Episode Structure'],
  ['tool_direction', 'Tool Direction'],
  ['continuity_rules', 'Continuity Rules'],
  ['assets', 'Assets'],
  ['prompt_override', 'Prompt Override'],
  ['custom', 'Custom'],
];

const emptyPilot = () => ({
  pilot_key: '',
  name: '',
  description: '',
  category: '',
  tags: [],
  cover_url: '',
  status: 'draft',
  distribution_mode: 'private',
  catalog_asset_id: '',
});

const emptyBlock = (versionId, sortOrder = 0) => ({
  version_id: versionId,
  block_key: '',
  block_type: 'theme_bible',
  title: '',
  content: { text: '' },
  tool_targets: [],
  priority: 100,
  sort_order: sortOrder,
  is_active: true,
});

function slugify(value = '') {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function AdminAIPilots() {
  const queryClient = useQueryClient();
  const [selectedPilotId, setSelectedPilotId] = useState(null);
  const [pilotDraft, setPilotDraft] = useState(null);
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [editingBlock, setEditingBlock] = useState(null);

  const { data: pilots = [], isLoading } = useQuery({
    queryKey: ['admin-ai-pilots'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_pilots')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const selectedPilot = useMemo(
    () => pilots.find((pilot) => pilot.id === selectedPilotId) || null,
    [pilots, selectedPilotId]
  );

  const { data: versions = [] } = useQuery({
    queryKey: ['admin-ai-pilot-versions', selectedPilotId],
    enabled: Boolean(selectedPilotId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_pilot_versions')
        .select('*')
        .eq('ai_pilot_id', selectedPilotId)
        .order('version_number', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const selectedVersion = useMemo(() => {
    if (!versions.length) return null;
    return versions.find((version) => version.id === selectedVersionId) || versions[0];
  }, [versions, selectedVersionId]);

  const { data: blocks = [] } = useQuery({
    queryKey: ['admin-ai-pilot-blocks', selectedVersion?.id],
    enabled: Boolean(selectedVersion?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_pilot_blocks')
        .select('*')
        .eq('version_id', selectedVersion.id)
        .order('sort_order', { ascending: true })
        .order('priority', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  React.useEffect(() => {
    if (selectedPilot) setPilotDraft({ ...selectedPilot });
  }, [selectedPilot]);

  React.useEffect(() => {
    if (versions.length && !versions.some((version) => version.id === selectedVersionId)) {
      setSelectedVersionId(versions[0].id);
    }
  }, [versions, selectedVersionId]);

  const createPilot = useMutation({
    mutationFn: async () => {
      const seed = emptyPilot();
      const { data: pilot, error: pilotError } = await supabase
        .from('ai_pilots')
        .insert({ ...seed, pilot_key: `pilot-${Date.now()}`, name: 'Untitled AI Pilot' })
        .select('*')
        .single();
      if (pilotError) throw pilotError;

      const { data: version, error: versionError } = await supabase
        .from('ai_pilot_versions')
        .insert({ ai_pilot_id: pilot.id, version_number: 1 })
        .select('*')
        .single();
      if (versionError) throw versionError;
      return { pilot, version };
    },
    onSuccess: ({ pilot, version }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-ai-pilots'] });
      setSelectedPilotId(pilot.id);
      setSelectedVersionId(version.id);
    },
    onError: (error) => alert(error?.message || 'Unable to create AI Pilot'),
  });

  const savePilot = useMutation({
    mutationFn: async () => {
      if (!pilotDraft?.id) return null;
      const payload = {
        pilot_key: slugify(pilotDraft.pilot_key || pilotDraft.name),
        name: pilotDraft.name?.trim(),
        description: pilotDraft.description || '',
        category: pilotDraft.category || '',
        tags: Array.isArray(pilotDraft.tags) ? pilotDraft.tags : [],
        cover_url: pilotDraft.cover_url || null,
        distribution_mode: pilotDraft.distribution_mode || 'private',
        catalog_asset_id: pilotDraft.catalog_asset_id || null,
      };
      if (!payload.pilot_key || !payload.name) throw new Error('Name and key are required');
      const { data, error } = await supabase
        .from('ai_pilots')
        .update(payload)
        .eq('id', pilotDraft.id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-ai-pilots'] }),
    onError: (error) => alert(error?.message || 'Unable to save AI Pilot'),
  });

  const createVersion = useMutation({
    mutationFn: async () => {
      if (!selectedPilotId) return null;
      const nextNumber = Math.max(0, ...versions.map((version) => version.version_number || 0)) + 1;
      const { data: nextVersion, error: versionError } = await supabase
        .from('ai_pilot_versions')
        .insert({
          ai_pilot_id: selectedPilotId,
          version_number: nextNumber,
          changelog: '',
        })
        .select('*')
        .single();
      if (versionError) throw versionError;

      if (selectedVersion && blocks.length) {
        const copies = blocks.map((block) => ({
          version_id: nextVersion.id,
          block_key: block.block_key,
          block_type: block.block_type,
          title: block.title,
          content: block.content,
          tool_targets: block.tool_targets || [],
          priority: block.priority,
          sort_order: block.sort_order,
          is_active: block.is_active,
        }));
        const { error: copyError } = await supabase.from('ai_pilot_blocks').insert(copies);
        if (copyError) throw copyError;
      }
      return nextVersion;
    },
    onSuccess: (version) => {
      queryClient.invalidateQueries({ queryKey: ['admin-ai-pilot-versions', selectedPilotId] });
      if (version) setSelectedVersionId(version.id);
    },
    onError: (error) => alert(error?.message || 'Unable to create version'),
  });

  const saveVersionChangelog = async (value) => {
    if (!selectedVersion || selectedVersion.is_published) return;
    const { error } = await supabase
      .from('ai_pilot_versions')
      .update({ changelog: value })
      .eq('id', selectedVersion.id);
    if (error) alert(error.message);
    else queryClient.invalidateQueries({ queryKey: ['admin-ai-pilot-versions', selectedPilotId] });
  };

  const saveBlock = useMutation({
    mutationFn: async () => {
      if (!editingBlock || selectedVersion?.is_published) return null;
      const payload = {
        version_id: selectedVersion.id,
        block_key: slugify(editingBlock.block_key || editingBlock.title),
        block_type: editingBlock.block_type,
        title: editingBlock.title?.trim(),
        content: { text: editingBlock.content?.text || '' },
        tool_targets: editingBlock.tool_targets || [],
        priority: Number(editingBlock.priority || 100),
        sort_order: Number(editingBlock.sort_order || 0),
        is_active: Boolean(editingBlock.is_active),
      };
      if (!payload.block_key || !payload.title) throw new Error('Block title and key are required');

      if (editingBlock.id) {
        const { data, error } = await supabase
          .from('ai_pilot_blocks')
          .update(payload)
          .eq('id', editingBlock.id)
          .select('*')
          .single();
        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        .from('ai_pilot_blocks')
        .insert(payload)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ai-pilot-blocks', selectedVersion?.id] });
      setEditingBlock(null);
    },
    onError: (error) => alert(error?.message || 'Unable to save block'),
  });

  const publishVersion = useMutation({
    mutationFn: async () => {
      if (!selectedVersion?.id) return;
      const { error } = await supabase.rpc('publish_ai_pilot_version', {
        p_version_id: selectedVersion.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ai-pilots'] });
      queryClient.invalidateQueries({ queryKey: ['admin-ai-pilot-versions', selectedPilotId] });
    },
    onError: (error) => alert(error?.message || 'Unable to publish version'),
  });

  const selectPilot = (pilot) => {
    setSelectedPilotId(pilot.id);
    setSelectedVersionId(null);
    setEditingBlock(null);
  };

  if (isLoading) return <div className="text-white/60 text-sm">Loading AI Pilots…</div>;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-5">
      <aside className="border border-white/10 bg-neutral-950 min-h-[70vh]">
        <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">Direction System</div>
            <h2 className="text-lg font-light">AI Pilots</h2>
          </div>
          <Button size="sm" onClick={() => createPilot.mutate()} disabled={createPilot.isPending}>
            <Plus size={15} className="mr-1" /> New
          </Button>
        </div>

        <div className="divide-y divide-white/10">
          {pilots.map((pilot) => (
            <button
              key={pilot.id}
              type="button"
              onClick={() => selectPilot(pilot)}
              className={`w-full text-left p-4 hover:bg-white/[0.04] ${selectedPilotId === pilot.id ? 'bg-white/[0.07]' : ''}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-white text-sm truncate">{pilot.name}</div>
                  <div className="text-white/40 text-xs mt-1 truncate">{pilot.pilot_key}</div>
                </div>
                <ChevronRight size={16} className="text-white/30 flex-shrink-0" />
              </div>
              <div className="flex gap-2 mt-3 text-[10px] uppercase tracking-wider">
                <span className="border border-white/10 px-2 py-1 text-white/55">{pilot.status}</span>
                <span className="border border-white/10 px-2 py-1 text-white/55">{pilot.distribution_mode}</span>
              </div>
            </button>
          ))}
          {!pilots.length && <div className="p-6 text-sm text-white/40">No AI Pilot yet.</div>}
        </div>
      </aside>

      <section className="min-w-0">
        {!pilotDraft ? (
          <div className="border border-white/10 min-h-[70vh] flex items-center justify-center text-white/35 text-sm">
            Select or create an AI Pilot.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="border border-white/10 bg-neutral-950 p-4 md:p-5">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">AI Pilot</div>
                  <h2 className="text-xl font-light mt-1">{pilotDraft.name || 'Untitled'}</h2>
                </div>
                <Button onClick={() => savePilot.mutate()} disabled={savePilot.isPending}>
                  <Save size={15} className="mr-2" /> Save Pilot
                </Button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <label className="space-y-2">
                  <span className="text-xs text-white/55">Name</span>
                  <Input value={pilotDraft.name || ''} onChange={(e) => setPilotDraft({ ...pilotDraft, name: e.target.value })} />
                </label>
                <label className="space-y-2">
                  <span className="text-xs text-white/55">Key</span>
                  <Input value={pilotDraft.pilot_key || ''} onChange={(e) => setPilotDraft({ ...pilotDraft, pilot_key: e.target.value })} />
                </label>
                <label className="space-y-2">
                  <span className="text-xs text-white/55">Category</span>
                  <Input value={pilotDraft.category || ''} onChange={(e) => setPilotDraft({ ...pilotDraft, category: e.target.value })} />
                </label>
                <label className="space-y-2">
                  <span className="text-xs text-white/55">Tags</span>
                  <Input
                    value={(pilotDraft.tags || []).join(', ')}
                    onChange={(e) => setPilotDraft({ ...pilotDraft, tags: e.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })}
                    placeholder="fashion, drama, period"
                  />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-xs text-white/55">Description</span>
                  <Textarea rows={3} value={pilotDraft.description || ''} onChange={(e) => setPilotDraft({ ...pilotDraft, description: e.target.value })} />
                </label>
                <label className="space-y-2">
                  <span className="text-xs text-white/55">Cover URL</span>
                  <Input value={pilotDraft.cover_url || ''} onChange={(e) => setPilotDraft({ ...pilotDraft, cover_url: e.target.value })} />
                </label>
                <label className="space-y-2">
                  <span className="text-xs text-white/55">Distribution</span>
                  <Select value={pilotDraft.distribution_mode || 'private'} onValueChange={(value) => setPilotDraft({ ...pilotDraft, distribution_mode: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">Private</SelectItem>
                      <SelectItem value="assets_shop">Assets Shop</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                {pilotDraft.distribution_mode === 'assets_shop' && (
                  <label className="space-y-2 md:col-span-2">
                    <span className="text-xs text-white/55">Assets Shop Catalog Asset ID</span>
                    <Input value={pilotDraft.catalog_asset_id || ''} onChange={(e) => setPilotDraft({ ...pilotDraft, catalog_asset_id: e.target.value })} />
                  </label>
                )}
              </div>
            </div>

            <div className="border border-white/10 bg-neutral-950">
              <div className="p-4 md:p-5 border-b border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">Versions</div>
                  <div className="text-sm mt-1 text-white/70">Published versions stay fixed. New work continues in a new version.</div>
                </div>
                <Button variant="outline" onClick={() => createVersion.mutate()} disabled={!selectedVersion || createVersion.isPending}>
                  <Copy size={15} className="mr-2" /> New Version
                </Button>
              </div>

              <div className="p-4 md:p-5 space-y-5">
                <div className="flex flex-wrap gap-2">
                  {versions.map((version) => (
                    <button
                      type="button"
                      key={version.id}
                      onClick={() => { setSelectedVersionId(version.id); setEditingBlock(null); }}
                      className={`px-3 py-2 border text-xs ${selectedVersion?.id === version.id ? 'bg-white text-black border-white' : 'border-white/15 text-white/65'}`}
                    >
                      v{version.version_number}{version.is_published ? ' · Published' : ' · Draft'}
                    </button>
                  ))}
                </div>

                {selectedVersion && (
                  <div className="grid md:grid-cols-[1fr_auto] gap-4 items-end">
                    <label className="space-y-2">
                      <span className="text-xs text-white/55">Version notes</span>
                      <Textarea
                        key={selectedVersion.id}
                        rows={2}
                        defaultValue={selectedVersion.changelog || ''}
                        disabled={selectedVersion.is_published}
                        onBlur={(e) => saveVersionChangelog(e.target.value)}
                      />
                    </label>
                    {!selectedVersion.is_published && (
                      <Button onClick={() => publishVersion.mutate()} disabled={publishVersion.isPending || blocks.length === 0}>
                        <Rocket size={15} className="mr-2" /> Publish v{selectedVersion.version_number}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {selectedVersion && (
              <div className="border border-white/10 bg-neutral-950">
                <div className="p-4 md:p-5 border-b border-white/10 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">Direction Blocks</div>
                    <h3 className="text-base font-light mt-1">AI Pilot v{selectedVersion.version_number}</h3>
                  </div>
                  {!selectedVersion.is_published && (
                    <Button size="sm" onClick={() => setEditingBlock(emptyBlock(selectedVersion.id, blocks.length))}>
                      <Plus size={15} className="mr-1" /> Block
                    </Button>
                  )}
                </div>

                <div className="grid lg:grid-cols-[300px_minmax(0,1fr)] min-h-[420px]">
                  <div className="border-b lg:border-b-0 lg:border-r border-white/10">
                    {blocks.map((block) => (
                      <button
                        type="button"
                        key={block.id}
                        onClick={() => setEditingBlock({ ...block, content: block.content || { text: '' } })}
                        className={`w-full text-left p-4 border-b border-white/10 hover:bg-white/[0.04] ${editingBlock?.id === block.id ? 'bg-white/[0.07]' : ''}`}
                      >
                        <div className="text-sm text-white">{block.title}</div>
                        <div className="text-[10px] uppercase tracking-wider text-white/40 mt-1">{block.block_type.replaceAll('_', ' ')}</div>
                        {!!block.tool_targets?.length && <div className="text-xs text-white/45 mt-2">{block.tool_targets.join(' · ')}</div>}
                      </button>
                    ))}
                    {!blocks.length && <div className="p-5 text-sm text-white/35">Add the first direction block.</div>}
                  </div>

                  <div className="p-4 md:p-5">
                    {!editingBlock ? (
                      <div className="h-full min-h-72 flex items-center justify-center text-sm text-white/35">Select a block.</div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          <label className="space-y-2">
                            <span className="text-xs text-white/55">Title</span>
                            <Input disabled={selectedVersion.is_published} value={editingBlock.title || ''} onChange={(e) => setEditingBlock({ ...editingBlock, title: e.target.value })} />
                          </label>
                          <label className="space-y-2">
                            <span className="text-xs text-white/55">Key</span>
                            <Input disabled={selectedVersion.is_published} value={editingBlock.block_key || ''} onChange={(e) => setEditingBlock({ ...editingBlock, block_key: e.target.value })} />
                          </label>
                          <label className="space-y-2">
                            <span className="text-xs text-white/55">Type</span>
                            <Select disabled={selectedVersion.is_published} value={editingBlock.block_type} onValueChange={(value) => setEditingBlock({ ...editingBlock, block_type: value })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {BLOCK_TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </label>
                          <label className="space-y-2">
                            <span className="text-xs text-white/55">Tool targets</span>
                            <Input
                              disabled={selectedVersion.is_published}
                              value={(editingBlock.tool_targets || []).join(', ')}
                              onChange={(e) => setEditingBlock({ ...editingBlock, tool_targets: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })}
                              placeholder="fotoplay, shoot, tts"
                            />
                          </label>
                        </div>

                        <label className="space-y-2 block">
                          <span className="text-xs text-white/55">Direction</span>
                          <Textarea
                            rows={12}
                            disabled={selectedVersion.is_published}
                            value={editingBlock.content?.text || ''}
                            onChange={(e) => setEditingBlock({ ...editingBlock, content: { text: e.target.value } })}
                            placeholder="Write only the direction this block must contribute to the AI context."
                          />
                        </label>

                        <div className="grid sm:grid-cols-3 gap-4">
                          <label className="space-y-2">
                            <span className="text-xs text-white/55">Priority</span>
                            <Input type="number" disabled={selectedVersion.is_published} value={editingBlock.priority ?? 100} onChange={(e) => setEditingBlock({ ...editingBlock, priority: e.target.value })} />
                          </label>
                          <label className="space-y-2">
                            <span className="text-xs text-white/55">Order</span>
                            <Input type="number" disabled={selectedVersion.is_published} value={editingBlock.sort_order ?? 0} onChange={(e) => setEditingBlock({ ...editingBlock, sort_order: e.target.value })} />
                          </label>
                          <label className="flex items-end gap-3 pb-2">
                            <Switch disabled={selectedVersion.is_published} checked={editingBlock.is_active !== false} onCheckedChange={(checked) => setEditingBlock({ ...editingBlock, is_active: checked })} />
                            <span className="text-xs text-white/55">Active</span>
                          </label>
                        </div>

                        {!selectedVersion.is_published && (
                          <div className="flex justify-end">
                            <Button onClick={() => saveBlock.mutate()} disabled={saveBlock.isPending}>
                              <Save size={15} className="mr-2" /> Save Block
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
