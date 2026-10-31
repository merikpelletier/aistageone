import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Copy, Rocket, ChevronRight, Upload, X, FileText, Users, SlidersHorizontal, History } from 'lucide-react';
import { supabase } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import AIPilotCharacters from './AIPilotCharacters';

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

const CONTROL_CLASS = 'bg-black/20 border-white/15 text-white placeholder:text-white/25 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[var(--studio-accent)]';
const SELECT_TRIGGER_CLASS = 'bg-black/20 border-white/15 text-white focus:ring-0 focus:ring-offset-0 focus:border-[var(--studio-accent)]';
const PRIMARY_BUTTON_CLASS = 'bg-[var(--studio-accent)] text-[#071211] border border-[var(--studio-accent)] hover:bg-[var(--studio-accent-hover)] hover:border-[var(--studio-accent-hover)]';
const SECONDARY_BUTTON_CLASS = 'bg-white/[0.04] text-white border border-white/15 hover:bg-white/[0.08] hover:border-white/25';

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
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const TABS = [
  ['overview', 'Overview', FileText],
  ['characters', 'Characters', Users],
  ['direction', 'Direction', SlidersHorizontal],
  ['versions', 'Versions', History],
];

export default function AdminAIPilots() {
  const queryClient = useQueryClient();
  const [selectedPilotId, setSelectedPilotId] = useState(null);
  const [pilotDraft, setPilotDraft] = useState(null);
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [editingBlock, setEditingBlock] = useState(null);
  const [tagInput, setTagInput] = useState('');
  const [coverUploading, setCoverUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const { data: pilots = [], isLoading } = useQuery({
    queryKey: ['admin-ai-pilots'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ai_pilots').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const selectedPilot = useMemo(() => pilots.find((pilot) => pilot.id === selectedPilotId) || null, [pilots, selectedPilotId]);

  const { data: versions = [] } = useQuery({
    queryKey: ['admin-ai-pilot-versions', selectedPilotId],
    enabled: Boolean(selectedPilotId),
    queryFn: async () => {
      const { data, error } = await supabase.from('ai_pilot_versions').select('*').eq('ai_pilot_id', selectedPilotId).order('version_number', { ascending: false });
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
      const { data, error } = await supabase.from('ai_pilot_blocks').select('*').eq('version_id', selectedVersion.id).order('sort_order', { ascending: true }).order('priority', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  React.useEffect(() => {
    if (selectedPilot) setPilotDraft({ ...selectedPilot });
  }, [selectedPilot]);

  React.useEffect(() => {
    if (versions.length && !versions.some((version) => version.id === selectedVersionId)) setSelectedVersionId(versions[0].id);
  }, [versions, selectedVersionId]);

  const createPilot = useMutation({
    mutationFn: async () => {
      const seed = emptyPilot();
      const { data: pilot, error: pilotError } = await supabase.from('ai_pilots').insert({ ...seed, pilot_key: `pilot-${Date.now()}`, name: 'Untitled AI Pilot' }).select('*').single();
      if (pilotError) throw pilotError;
      const { data: version, error: versionError } = await supabase.from('ai_pilot_versions').insert({ ai_pilot_id: pilot.id, version_number: 1 }).select('*').single();
      if (versionError) throw versionError;
      return { pilot, version };
    },
    onSuccess: ({ pilot, version }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-ai-pilots'] });
      setSelectedPilotId(pilot.id);
      setSelectedVersionId(version.id);
      setActiveTab('overview');
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
      const { data, error } = await supabase.from('ai_pilots').update(payload).eq('id', pilotDraft.id).select('*').single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-ai-pilots'] }),
    onError: (error) => alert(error?.message || 'Unable to save AI Pilot'),
  });

  const addTag = (rawValue = tagInput) => {
    const nextTags = rawValue.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean);
    if (!nextTags.length) return;
    setPilotDraft((current) => ({ ...current, tags: Array.from(new Set([...(current?.tags || []), ...nextTags])) }));
    setTagInput('');
  };

  const removeTag = (tagToRemove) => setPilotDraft((current) => ({ ...current, tags: (current?.tags || []).filter((tag) => tag !== tagToRemove) }));

  const handleTagKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag();
    }
  };

  const handleCoverUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !pilotDraft?.id) return;
    if (!file.type?.startsWith('image/')) return alert('Please choose an image file.');
    setCoverUploading(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const user = userData?.user;
      if (!user?.id) throw new Error('You must be signed in to upload a cover.');
      const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'jpg';
      const safeName = `${Date.now()}-${slugify(file.name.replace(/\.[^.]+$/, '')) || 'cover'}.${extension}`;
      const path = `${user.id}/ai-pilots/${pilotDraft.id}/${safeName}`;
      const { error: uploadError } = await supabase.storage.from('media').upload(path, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from('media').getPublicUrl(path);
      if (!publicData?.publicUrl) throw new Error('Unable to create the cover URL.');
      setPilotDraft((current) => ({ ...current, cover_url: publicData.publicUrl }));
    } catch (error) {
      alert(error?.message || 'Unable to upload cover image');
    } finally {
      setCoverUploading(false);
    }
  };

  const createVersion = useMutation({
    mutationFn: async () => {
      if (!selectedPilotId) return null;
      const nextNumber = Math.max(0, ...versions.map((version) => version.version_number || 0)) + 1;
      const { data: nextVersion, error: versionError } = await supabase.from('ai_pilot_versions').insert({ ai_pilot_id: selectedPilotId, version_number: nextNumber, changelog: '' }).select('*').single();
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

      if (selectedVersion?.id) {
        const { data: characters, error: characterReadError } = await supabase.from('ai_pilot_characters').select('*').eq('version_id', selectedVersion.id);
        if (characterReadError) throw characterReadError;
        if (characters?.length) {
          const characterCopies = characters.map(({ id, created_at, updated_at, ...character }) => ({ ...character, version_id: nextVersion.id }));
          const { error: characterCopyError } = await supabase.from('ai_pilot_characters').insert(characterCopies);
          if (characterCopyError) throw characterCopyError;
        }
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
    const { error } = await supabase.from('ai_pilot_versions').update({ changelog: value }).eq('id', selectedVersion.id);
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
        const { data, error } = await supabase.from('ai_pilot_blocks').update(payload).eq('id', editingBlock.id).select('*').single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from('ai_pilot_blocks').insert(payload).select('*').single();
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
      const { error } = await supabase.rpc('publish_ai_pilot_version', { p_version_id: selectedVersion.id });
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
    setTagInput('');
    setActiveTab('overview');
  };

  if (isLoading) return <div className="text-white/60 text-sm">Loading AI Pilots…</div>;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)] gap-0 border border-white/10 bg-[#090b0d] min-h-[76vh]">
      <aside className="border-b xl:border-b-0 xl:border-r border-white/10 bg-[#0b0d0f]">
        <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--studio-accent)]">Direction System</div>
            <div className="text-lg font-light mt-1">AI Pilots</div>
          </div>
          <Button size="icon" className={PRIMARY_BUTTON_CLASS} onClick={() => createPilot.mutate()} disabled={createPilot.isPending} title="New AI Pilot">
            <Plus size={17} />
          </Button>
        </div>
        <div className="max-h-[68vh] overflow-y-auto">
          {pilots.map((pilot) => (
            <button
              key={pilot.id}
              type="button"
              onClick={() => selectPilot(pilot)}
              className={`w-full text-left px-4 py-3 border-b border-white/8 hover:bg-white/[0.04] ${selectedPilotId === pilot.id ? 'bg-white/[0.06] shadow-[inset_2px_0_0_var(--studio-accent)]' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm text-white truncate">{pilot.name}</div>
                  <div className="text-[11px] text-white/35 truncate mt-0.5">{pilot.category || 'Uncategorized'}</div>
                </div>
                <ChevronRight size={14} className="text-white/25" />
              </div>
            </button>
          ))}
          {!pilots.length && <div className="p-4 text-sm text-white/35">No AI Pilot yet.</div>}
        </div>
      </aside>

      <main className="min-w-0">
        {!pilotDraft ? (
          <div className="min-h-[76vh] flex items-center justify-center">
            <div className="text-center max-w-sm px-6">
              <div className="text-white text-lg">Create or select an AI Pilot</div>
              <div className="text-white/45 text-sm mt-2">Build the production direction package used across AISTAGE.ONE tools.</div>
              <Button className={`mt-5 ${PRIMARY_BUTTON_CLASS}`} onClick={() => createPilot.mutate()}><Plus size={16} className="mr-2" /> New AI Pilot</Button>
            </div>
          </div>
        ) : (
          <div className="min-h-[76vh] flex flex-col">
            <div className="sticky top-0 z-20 bg-[#090b0d]/95 backdrop-blur border-b border-white/10">
              <div className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <h2 className="text-lg md:text-xl font-light truncate">{pilotDraft.name || 'Untitled AI Pilot'}</h2>
                    {selectedVersion && <span className="text-[10px] uppercase tracking-wider border border-white/10 px-2 py-1 text-white/45">v{selectedVersion.version_number}{selectedVersion.is_published ? ' · Published' : ' · Draft'}</span>}
                  </div>
                  <div className="text-xs text-white/35 mt-1 truncate">{pilotDraft.pilot_key}</div>
                </div>
                <Button className={PRIMARY_BUTTON_CLASS} onClick={() => savePilot.mutate()} disabled={savePilot.isPending}><Save size={15} className="mr-2" /> Save</Button>
              </div>

              <div className="px-5 flex gap-1 overflow-x-auto">
                {TABS.map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setActiveTab(value)}
                    className={`inline-flex items-center gap-2 px-3 py-3 text-sm border-b-2 whitespace-nowrap transition-colors ${activeTab === value ? 'border-[var(--studio-accent)] text-white' : 'border-transparent text-white/45 hover:text-white/75'}`}
                  >
                    <Icon size={15} /> {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 p-4 md:p-5">
              {activeTab === 'overview' && (
                <div className="grid lg:grid-cols-[220px_minmax(0,1fr)] gap-5 max-w-5xl">
                  <div>
                    <div className="text-xs text-white/50 mb-2">Cover</div>
                    <div className="aspect-[2/3] border border-white/10 bg-[#0d0f12] flex items-center justify-center overflow-hidden">
                      {pilotDraft.cover_url ? <img src={pilotDraft.cover_url} alt="AI Pilot cover" className="w-full h-full object-contain" /> : <div className="text-xs text-white/25">No cover</div>}
                    </div>
                    <label className="mt-3 block">
                      <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={coverUploading} />
                      <span className="h-10 w-full inline-flex items-center justify-center gap-2 border border-white/15 text-sm text-white/75 cursor-pointer hover:border-[var(--studio-accent)] hover:bg-white/[0.04]">
                        <Upload size={15} /> {coverUploading ? 'Uploading…' : 'Upload cover'}
                      </span>
                    </label>
                    {pilotDraft.cover_url && <button type="button" onClick={() => setPilotDraft({ ...pilotDraft, cover_url: '' })} className="w-full text-xs text-white/35 hover:text-white mt-2">Remove cover</button>}
                  </div>

                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <label className="space-y-2"><span className="text-xs text-white/55">Name</span><Input className={CONTROL_CLASS} value={pilotDraft.name || ''} onChange={(e) => setPilotDraft({ ...pilotDraft, name: e.target.value })} /></label>
                      <label className="space-y-2"><span className="text-xs text-white/55">Key</span><Input className={CONTROL_CLASS} value={pilotDraft.pilot_key || ''} onChange={(e) => setPilotDraft({ ...pilotDraft, pilot_key: e.target.value })} /></label>
                      <label className="space-y-2"><span className="text-xs text-white/55">Category</span><Input className={CONTROL_CLASS} value={pilotDraft.category || ''} onChange={(e) => setPilotDraft({ ...pilotDraft, category: e.target.value })} /></label>
                      <label className="space-y-2"><span className="text-xs text-white/55">Distribution</span><Select value={pilotDraft.distribution_mode || 'private'} onValueChange={(value) => setPilotDraft({ ...pilotDraft, distribution_mode: value })}><SelectTrigger className={SELECT_TRIGGER_CLASS}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="private">Private</SelectItem><SelectItem value="assets_shop">Assets Shop</SelectItem></SelectContent></Select></label>
                    </div>

                    <label className="space-y-2 block"><span className="text-xs text-white/55">Description</span><Textarea className={CONTROL_CLASS} rows={5} value={pilotDraft.description || ''} onChange={(e) => setPilotDraft({ ...pilotDraft, description: e.target.value })} /></label>

                    <div className="space-y-2">
                      <span className="text-xs text-white/55">Tags</span>
                      <div className="flex gap-2"><Input className={CONTROL_CLASS} value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={handleTagKeyDown} placeholder="Add tag" /><Button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => addTag()} disabled={!tagInput.trim()}>Add</Button></div>
                      {!!pilotDraft.tags?.length && <div className="flex flex-wrap gap-2">{pilotDraft.tags.map((tag) => <span key={tag} className="inline-flex items-center gap-1.5 border border-white/15 px-2.5 py-1 text-xs text-white/75 bg-white/[0.03]">{tag}<button type="button" onClick={() => removeTag(tag)} className="text-white/35 hover:text-white"><X size={12} /></button></span>)}</div>}
                    </div>

                    {pilotDraft.distribution_mode === 'assets_shop' && <label className="space-y-2 block"><span className="text-xs text-white/55">Assets Shop Catalog Asset ID</span><Input className={CONTROL_CLASS} value={pilotDraft.catalog_asset_id || ''} onChange={(e) => setPilotDraft({ ...pilotDraft, catalog_asset_id: e.target.value })} /></label>}
                  </div>
                </div>
              )}

              {activeTab === 'characters' && selectedVersion && <AIPilotCharacters version={selectedVersion} readOnly={selectedVersion.is_published} />}

              {activeTab === 'direction' && selectedVersion && (
                <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] border border-white/10 min-h-[58vh]">
                  <div className="border-b lg:border-b-0 lg:border-r border-white/10 bg-[#0b0d0f]">
                    <div className="p-3 border-b border-white/10 flex items-center justify-between gap-2">
                      <div className="text-xs uppercase tracking-[0.18em] text-white/45">Direction blocks</div>
                      {!selectedVersion.is_published && <Button size="icon" className={SECONDARY_BUTTON_CLASS} onClick={() => setEditingBlock(emptyBlock(selectedVersion.id, blocks.length))}><Plus size={15} /></Button>}
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto">
                      {blocks.map((block) => (
                        <button key={block.id} type="button" onClick={() => setEditingBlock({ ...block, content: block.content || { text: '' } })} className={`w-full text-left px-3 py-3 border-b border-white/8 hover:bg-white/[0.04] ${editingBlock?.id === block.id ? 'bg-white/[0.06] shadow-[inset_2px_0_0_var(--studio-accent)]' : ''}`}>
                          <div className="text-sm text-white">{block.title}</div>
                          <div className="text-[10px] uppercase tracking-wider text-white/35 mt-1">{block.block_type.replaceAll('_', ' ')}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 md:p-5">
                    {!editingBlock ? (
                      <div className="h-full min-h-80 flex items-center justify-center text-sm text-white/35">Select a direction block.</div>
                    ) : (
                      <div className="space-y-4 max-w-4xl">
                        <div className="grid md:grid-cols-2 gap-4">
                          <label className="space-y-2"><span className="text-xs text-white/55">Title</span><Input className={CONTROL_CLASS} disabled={selectedVersion.is_published} value={editingBlock.title || ''} onChange={(e) => setEditingBlock({ ...editingBlock, title: e.target.value })} /></label>
                          <label className="space-y-2"><span className="text-xs text-white/55">Type</span><Select disabled={selectedVersion.is_published} value={editingBlock.block_type} onValueChange={(value) => setEditingBlock({ ...editingBlock, block_type: value })}><SelectTrigger className={SELECT_TRIGGER_CLASS}><SelectValue /></SelectTrigger><SelectContent>{BLOCK_TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></label>
                        </div>
                        <label className="space-y-2 block"><span className="text-xs text-white/55">Direction</span><Textarea className={CONTROL_CLASS} rows={15} disabled={selectedVersion.is_published} value={editingBlock.content?.text || ''} onChange={(e) => setEditingBlock({ ...editingBlock, content: { text: e.target.value } })} placeholder="Write the production direction this block contributes to AI context." /></label>
                        <div className="grid md:grid-cols-[1fr_120px_120px_auto] gap-4 items-end">
                          <label className="space-y-2"><span className="text-xs text-white/55">Tool targets</span><Input className={CONTROL_CLASS} disabled={selectedVersion.is_published} value={(editingBlock.tool_targets || []).join(', ')} onChange={(e) => setEditingBlock({ ...editingBlock, tool_targets: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} placeholder="fotoplay, actor, tts..." /></label>
                          <label className="space-y-2"><span className="text-xs text-white/55">Priority</span><Input className={CONTROL_CLASS} type="number" disabled={selectedVersion.is_published} value={editingBlock.priority ?? 100} onChange={(e) => setEditingBlock({ ...editingBlock, priority: e.target.value })} /></label>
                          <label className="space-y-2"><span className="text-xs text-white/55">Order</span><Input className={CONTROL_CLASS} type="number" disabled={selectedVersion.is_published} value={editingBlock.sort_order ?? 0} onChange={(e) => setEditingBlock({ ...editingBlock, sort_order: e.target.value })} /></label>
                          <label className="flex items-center gap-2 h-10"><Switch disabled={selectedVersion.is_published} checked={editingBlock.is_active !== false} onCheckedChange={(checked) => setEditingBlock({ ...editingBlock, is_active: checked })} /><span className="text-xs text-white/55">Active</span></label>
                        </div>
                        {!selectedVersion.is_published && <div className="flex justify-end"><Button className={PRIMARY_BUTTON_CLASS} onClick={() => saveBlock.mutate()} disabled={saveBlock.isPending}><Save size={15} className="mr-2" /> Save Block</Button></div>}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'versions' && (
                <div className="max-w-4xl space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div><div className="text-sm text-white">Versions</div><div className="text-xs text-white/40 mt-1">Published versions stay fixed. New work continues in a new version.</div></div>
                    <Button className={SECONDARY_BUTTON_CLASS} onClick={() => createVersion.mutate()} disabled={!selectedVersion || createVersion.isPending}><Copy size={15} className="mr-2" /> New Version</Button>
                  </div>

                  <div className="border border-white/10 divide-y divide-white/10">
                    {versions.map((version) => (
                      <button key={version.id} type="button" onClick={() => { setSelectedVersionId(version.id); setEditingBlock(null); }} className={`w-full text-left p-4 flex items-center justify-between gap-4 ${selectedVersion?.id === version.id ? 'bg-white/[0.05] shadow-[inset_2px_0_0_var(--studio-accent)]' : 'hover:bg-white/[0.03]'}`}>
                        <div><div className="text-sm text-white">Version {version.version_number}</div><div className="text-xs text-white/35 mt-1">{version.changelog || 'No version notes'}</div></div>
                        <span className="text-[10px] uppercase tracking-wider text-white/45">{version.is_published ? 'Published' : 'Draft'}</span>
                      </button>
                    ))}
                  </div>

                  {selectedVersion && (
                    <div className="border border-white/10 p-4 space-y-4">
                      <label className="space-y-2 block"><span className="text-xs text-white/55">Version notes</span><Textarea className={CONTROL_CLASS} key={selectedVersion.id} rows={4} defaultValue={selectedVersion.changelog || ''} disabled={selectedVersion.is_published} onBlur={(e) => saveVersionChangelog(e.target.value)} /></label>
                      {!selectedVersion.is_published && <div className="flex justify-end"><Button className={PRIMARY_BUTTON_CLASS} onClick={() => publishVersion.mutate()} disabled={publishVersion.isPending || blocks.length === 0}><Rocket size={15} className="mr-2" /> Publish v{selectedVersion.version_number}</Button></div>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
