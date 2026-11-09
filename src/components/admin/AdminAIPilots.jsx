import React, { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Copy, Rocket, ChevronRight, Upload, X, FileText, Users, SlidersHorizontal, History, Images } from 'lucide-react';
import { supabase } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AIPilotCharacters from './AIPilotCharacters';
import AIPilotDirectionEditor from './AIPilotDirectionEditor';
import AIPilotMedia from './AIPilotMedia';
import AIPilotPreviewGallery from './AIPilotPreviewGallery';

const CONTROL_CLASS = 'bg-black/20 border-white/15 text-white placeholder:text-white/25 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-[var(--studio-accent)]';
const SELECT_TRIGGER_CLASS = 'bg-black/20 border-white/15 text-white focus:ring-0 focus:ring-offset-0 focus:border-[var(--studio-accent)]';
const PRIMARY_BUTTON_CLASS = 'bg-[var(--studio-accent)] text-[#071211] border border-[var(--studio-accent)] hover:bg-[var(--studio-accent-hover)] hover:border-[var(--studio-accent-hover)]';
const SECONDARY_BUTTON_CLASS = 'bg-white/[0.04] text-white border border-white/15 hover:bg-white/[0.08] hover:border-white/25';

const emptyPilot = () => ({ pilot_key: '', name: '', description: '', category: '', tags: [], cover_url: '', status: 'draft', distribution_mode: 'private', asset_subcategory_id: '' });
const slugify = (value = '') => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const TABS = [['overview', 'Overview', FileText], ['characters', 'Characters', Users], ['direction', 'Direction', SlidersHorizontal], ['media', 'Media', Images], ['versions', 'Versions', History]];

export default function AdminAIPilots() {
  const queryClient = useQueryClient();
  const charactersRef = useRef(null);
  const [selectedPilotId, setSelectedPilotId] = useState(null);
  const [pilotDraft, setPilotDraft] = useState(null);
  const [selectedVersionId, setSelectedVersionId] = useState(null);
  const [editingBlock, setEditingBlock] = useState(null);
  const [versionNotesDraft, setVersionNotesDraft] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [coverUploading, setCoverUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [saveState, setSaveState] = useState('idle');

  const { data: pilots = [], isLoading } = useQuery({
    queryKey: ['admin-ai-pilots'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ai_pilots').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: aiPilotCatalog = { category: null, subcategories: [] } } = useQuery({
    queryKey: ['ai-pilot-assets-shop-taxonomy'],
    queryFn: async () => {
      const { data: category, error: categoryError } = await supabase.from('asset_category').select('id, key, label_en, label_fr').eq('key', 'ai-pilot').eq('is_active', true).single();
      if (categoryError) throw categoryError;
      const { data: subcategories, error: subcategoryError } = await supabase.from('asset_subcategory').select('id, key, label_en, label_fr, display_order').eq('category_id', category.id).eq('is_active', true).order('display_order', { ascending: true });
      if (subcategoryError) throw subcategoryError;
      return { category, subcategories: subcategories || [] };
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

  const selectedVersion = useMemo(() => versions.find((version) => version.id === selectedVersionId) || versions[0] || null, [versions, selectedVersionId]);

  const { data: blocks = [] } = useQuery({
    queryKey: ['admin-ai-pilot-blocks', selectedVersion?.id],
    enabled: Boolean(selectedVersion?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from('ai_pilot_blocks').select('*').eq('version_id', selectedVersion.id).eq('is_active', true).order('sort_order', { ascending: true }).order('priority', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: scenarioCharacters = [] } = useQuery({
    queryKey: ['admin-ai-pilot-scenario-characters', selectedVersion?.id],
    enabled: Boolean(selectedVersion?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from('ai_pilot_characters')
        .select('id, role_name, is_active, reference_images')
        .eq('version_id', selectedVersion.id)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: mySets = [] } = useQuery({
    queryKey: ['admin-ai-pilot-my-sets', selectedVersion?.id],
    enabled: Boolean(selectedVersion?.id),
    queryFn: async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth?.user?.id) return [];
      const { data, error } = await supabase.from('set_designer_project')
        .select('id,name,description,images,reference_sheet,updated_date')
        .eq('created_by_id', auth.user.id)
        .order('updated_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const scenarioSets = useMemo(() => {
    const direction = blocks.find((item) => item.block_key === 'series-direction');
    const sets = direction?.content?.sets;
    return Array.isArray(sets) ? sets.filter((set) => set?.id && set?.name).map((set) => {
      const linked = mySets.find((project) => project.id === set.my_set_id);
      return {
        id: set.id, name: set.name, description: set.description || '',
        reference_images: set.reference_images || [], my_set_id: set.my_set_id || '',
        linked_set: linked ? {
          id: linked.id, name: linked.name, description: linked.description || '',
          images: Array.isArray(linked.images) ? linked.images : [],
          reference_sheet: linked.reference_sheet || null,
        } : null,
      };
    }) : [];
  }, [blocks, mySets]);

  const scenarioLooks = useMemo(() => {
    const looksBlock = blocks.find((item) => item.block_key === 'looks');
    return Array.isArray(looksBlock?.content?.looks)
      ? looksBlock.content.looks.filter((look) => look?.id && look?.name).map((look) => ({
        id: look.id,
        name: look.name,
        type: look.type || '',
        description: look.description || '',
        costume: look.costume || '',
        garment_details: look.garment_details || '',
        shoes: look.shoes || '',
        accessories: look.accessories || '',
        makeup: look.makeup || '',
        hair: look.hair || '',
        colors: look.colors || '',
        result_images: look.result_images || [],
      }))
      : [];
  }, [blocks]);

  const directionBlocks = useMemo(() => {
    if (!selectedVersion?.id) return blocks;
    if (blocks.some((item) => item.block_key === 'scenario')) return blocks;
    const scenario = {
      version_id: selectedVersion.id,
      block_key: 'scenario',
      block_type: 'custom',
      title: 'Scenario',
      content: { creative_brief: '', scenarios: [], creative_freedom: '' },
      tool_targets: ['fotoplay', 'shoot', 'compose', 'timeline'],
      priority: 100,
      sort_order: Math.floor(Number(blocks.find((item) => item.block_key === 'story-structure')?.sort_order ?? 3)) + 1,
      is_active: true,
    };
    return [...blocks, scenario].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  }, [blocks, selectedVersion?.id]);

  React.useEffect(() => { if (selectedPilot) setPilotDraft({ ...selectedPilot }); }, [selectedPilot]);
  React.useEffect(() => { if (versions.length && !versions.some((version) => version.id === selectedVersionId)) setSelectedVersionId(versions[0].id); }, [versions, selectedVersionId]);
  React.useEffect(() => { setVersionNotesDraft(selectedVersion?.changelog || ''); }, [selectedVersion?.id, selectedVersion?.changelog]);

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
      setEditingBlock(null);
      setActiveTab('overview');
    },
    onError: (error) => alert(error?.message || 'Unable to create AI Pilot'),
  });

  const buildPilotPayload = () => ({
    pilot_key: slugify(pilotDraft?.pilot_key || pilotDraft?.name),
    name: pilotDraft?.name?.trim(),
    description: pilotDraft?.description || '',
    category: pilotDraft?.category || '',
    tags: Array.isArray(pilotDraft?.tags) ? pilotDraft.tags : [],
    cover_url: pilotDraft?.cover_url || null,
    distribution_mode: pilotDraft?.distribution_mode || 'private',
    asset_subcategory_id: pilotDraft?.distribution_mode === 'assets_shop' ? (pilotDraft?.asset_subcategory_id || null) : null,
  });

  const persistOverview = async () => {
    if (!pilotDraft?.id) return null;
    const payload = buildPilotPayload();
    if (!payload.pilot_key || !payload.name) throw new Error('Name and key are required');
    const { data, error } = await supabase.from('ai_pilots').update(payload).eq('id', pilotDraft.id).select('*').single();
    if (error) throw error;
    return data;
  };

  const persistBlock = async (block = editingBlock) => {
    if (!block) return null;
    const payload = {
      version_id: selectedVersion.id,
      block_key: slugify(block.block_key || block.title),
      block_type: block.block_type,
      title: block.title?.trim(),
      content: block.content || {},
      tool_targets: block.tool_targets || [],
      priority: Number(block.priority || 100),
      sort_order: Number(block.sort_order || 0),
      is_active: block.is_active !== false,
    };
    if (!payload.block_key || !payload.title) throw new Error('Block title and key are required');
    if (block.id) {
      const { data, error } = await supabase.from('ai_pilot_blocks').update(payload).eq('id', block.id).select('*').single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await supabase.from('ai_pilot_blocks').upsert(payload, { onConflict: 'version_id,block_key' }).select('*').single();
    if (error) throw error;
    setEditingBlock((current) => current?.block_key === data.block_key && !current.id && current.version_id === data.version_id
      ? { ...current, id: data.id }
      : current);
    return data;
  };

  const persistVersionNotes = async () => {
    if (!selectedVersion?.id || selectedVersion.is_published) return null;
    const { data, error } = await supabase.from('ai_pilot_versions').update({ changelog: versionNotesDraft }).eq('id', selectedVersion.id).select('*').single();
    if (error) throw error;
    return data;
  };

  const persistEverything = async () => {
    const overview = await persistOverview();
    await charactersRef.current?.saveCurrent?.();
    if (editingBlock) await persistBlock(editingBlock);
    await persistVersionNotes();
    return overview;
  };

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-ai-pilots'] }),
      selectedVersion?.id ? queryClient.invalidateQueries({ queryKey: ['admin-ai-pilot-blocks', selectedVersion.id] }) : Promise.resolve(),
      selectedVersion?.id ? queryClient.invalidateQueries({ queryKey: ['admin-ai-pilot-characters', selectedVersion.id] }) : Promise.resolve(),
      selectedVersion?.id ? queryClient.invalidateQueries({ queryKey: ['admin-ai-pilot-scenario-characters', selectedVersion.id] }) : Promise.resolve(),
      selectedVersion?.id ? queryClient.invalidateQueries({ queryKey: ['admin-ai-pilot-media', selectedVersion.id] }) : Promise.resolve(),
      selectedPilotId ? queryClient.invalidateQueries({ queryKey: ['admin-ai-pilot-versions', selectedPilotId] }) : Promise.resolve(),
    ]);
  };

  const savePilot = useMutation({
    mutationFn: async () => {
      setSaveState('saving');
      return persistEverything();
    },
    onSuccess: async () => {
      await refreshAll();
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 1600);
    },
    onError: (error) => {
      setSaveState('error');
      alert(error?.message || 'Unable to save AI Pilot');
    },
  });

  const addTag = (rawValue = tagInput) => {
    const nextTags = rawValue.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean);
    if (!nextTags.length) return;
    setPilotDraft((current) => ({ ...current, tags: Array.from(new Set([...(current?.tags || []), ...nextTags])) }));
    setTagInput('');
  };
  const removeTag = (tagToRemove) => setPilotDraft((current) => ({ ...current, tags: (current?.tags || []).filter((tag) => tag !== tagToRemove) }));
  const handleTagKeyDown = (event) => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addTag(); } };

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

  const saveBlock = useMutation({
    mutationFn: () => persistBlock(editingBlock),
    onSuccess: async (saved) => {
      if (saved) setEditingBlock(saved);
      if (selectedVersion?.id) await queryClient.invalidateQueries({ queryKey: ['admin-ai-pilot-blocks', selectedVersion.id] });
    },
    onError: (error) => alert(error?.message || 'Unable to save direction'),
  });

  const selectBlock = async (block) => {
    try {
      if (editingBlock && editingBlock.id !== block.id) await persistBlock(editingBlock);
      setEditingBlock({ ...block, content: block.content || {} });
      if (selectedVersion?.id) await queryClient.invalidateQueries({ queryKey: ['admin-ai-pilot-blocks', selectedVersion.id] });
    } catch (error) {
      alert(error?.message || 'Unable to save current direction');
    }
  };

  const createVersion = useMutation({
    mutationFn: async () => {
      if (!selectedPilotId) return null;
      await persistEverything();
      const nextNumber = Math.max(0, ...versions.map((version) => version.version_number || 0)) + 1;
      const { data: nextVersion, error: versionError } = await supabase.from('ai_pilot_versions').insert({ ai_pilot_id: selectedPilotId, version_number: nextNumber }).select('*').single();
      if (versionError) throw versionError;

      const { data: currentBlocks, error: blocksError } = await supabase.from('ai_pilot_blocks').select('*').eq('version_id', selectedVersion.id).eq('is_active', true).order('sort_order');
      if (blocksError) throw blocksError;
      if (currentBlocks?.length) {
        const copies = currentBlocks.map(({ id, created_at, updated_at, ...block }) => ({ ...block, version_id: nextVersion.id }));
        const { error: copyError } = await supabase.from('ai_pilot_blocks').insert(copies);
        if (copyError) throw copyError;
      }

      const { data: characters, error: characterReadError } = await supabase.from('ai_pilot_characters').select('*').eq('version_id', selectedVersion.id);
      if (characterReadError) throw characterReadError;
      if (characters?.length) {
        const characterCopies = characters.map(({ id, created_at, updated_at, ...character }) => ({ ...character, version_id: nextVersion.id }));
        const { error: characterCopyError } = await supabase.from('ai_pilot_characters').insert(characterCopies);
        if (characterCopyError) throw characterCopyError;
      }

      const { data: media, error: mediaReadError } = await supabase.from('ai_pilot_media').select('*').eq('version_id', selectedVersion.id).eq('is_active', true).order('sort_order');
      if (mediaReadError) throw mediaReadError;
      if (media?.length) {
        const mediaCopies = media.map(({ id, created_at, updated_at, ...item }) => ({ ...item, version_id: nextVersion.id }));
        const { error: mediaCopyError } = await supabase.from('ai_pilot_media').insert(mediaCopies);
        if (mediaCopyError) throw mediaCopyError;
      }
      return nextVersion;
    },
    onSuccess: async (version) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-ai-pilot-versions', selectedPilotId] });
      if (version) {
        setSelectedVersionId(version.id);
        setEditingBlock(null);
      }
    },
    onError: (error) => alert(error?.message || 'Unable to create version'),
  });

  const publishVersion = useMutation({
    mutationFn: async () => {
      if (!selectedVersion?.id || !pilotDraft?.id) return;
      const payload = buildPilotPayload();
      if (payload.distribution_mode === 'assets_shop' && !payload.asset_subcategory_id) throw new Error('Select an AI Pilot Assets Shop subcategory before publishing');
      await persistEverything();
      const { error } = await supabase.rpc('publish_ai_pilot_version', { p_version_id: selectedVersion.id });
      if (error) throw error;
    },
    onSuccess: refreshAll,
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
          <div><div className="text-[10px] uppercase tracking-[0.2em] text-[var(--studio-accent)]">Direction System</div><div className="text-lg font-light mt-1">AI Pilots</div></div>
          <Button size="icon" className={PRIMARY_BUTTON_CLASS} onClick={() => createPilot.mutate()} disabled={createPilot.isPending} title="New AI Pilot"><Plus size={17} /></Button>
        </div>
        <div className="max-h-[68vh] overflow-y-auto">
          {pilots.map((pilot) => <button key={pilot.id} type="button" onClick={() => selectPilot(pilot)} className={`w-full text-left px-4 py-3 border-b border-white/8 hover:bg-white/[0.04] ${selectedPilotId === pilot.id ? 'bg-white/[0.06] shadow-[inset_2px_0_0_var(--studio-accent)]' : ''}`}><div className="flex items-center justify-between gap-2"><div className="min-w-0"><div className="text-sm text-white truncate">{pilot.name}</div><div className="text-[11px] text-white/35 truncate mt-0.5">{pilot.category || 'Uncategorized'}</div></div><ChevronRight size={14} className="text-white/25" /></div></button>)}
          {!pilots.length && <div className="p-4 text-sm text-white/35">No AI Pilot yet.</div>}
        </div>
      </aside>

      <main className="min-w-0">
        {!pilotDraft ? (
          <div className="min-h-[76vh] flex items-center justify-center"><div className="text-center max-w-sm px-6"><div className="text-white text-lg">Create or select an AI Pilot</div><div className="text-white/45 text-sm mt-2">Build the production direction package used across AISTAGE.ONE tools.</div><Button className={`mt-5 ${PRIMARY_BUTTON_CLASS}`} onClick={() => createPilot.mutate()}><Plus size={16} className="mr-2" /> New AI Pilot</Button></div></div>
        ) : (
          <div className="min-h-[76vh] flex flex-col">
            <div className="sticky top-0 z-20 bg-[#090b0d]/95 backdrop-blur border-b border-white/10">
              <div className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0"><div className="flex items-center gap-3 min-w-0"><h2 className="text-lg md:text-xl font-light truncate">{pilotDraft.name || 'Untitled AI Pilot'}</h2>{selectedVersion && <span className="text-[10px] uppercase tracking-wider border border-white/10 px-2 py-1 text-white/45">v{selectedVersion.version_number}{selectedVersion.is_published ? ' · Published' : ' · Draft'}</span>}</div><div className="text-xs text-white/35 mt-1 truncate">{pilotDraft.pilot_key}</div></div>
                <div className="flex items-center gap-3">{saveState === 'saved' && <span className="text-xs text-[var(--studio-accent)]">All saved</span>}{saveState === 'error' && <span className="text-xs text-red-400">Save failed</span>}<Button className={PRIMARY_BUTTON_CLASS} onClick={() => savePilot.mutate()} disabled={savePilot.isPending || saveBlock.isPending}><Save size={15} className="mr-2" /> {savePilot.isPending ? 'Saving all…' : 'Save All'}</Button></div>
              </div>
              <div className="px-5 flex gap-1 overflow-x-auto">{TABS.map(([value, label, Icon]) => <button key={value} type="button" onClick={() => setActiveTab(value)} className={`inline-flex items-center gap-2 px-3 py-3 text-sm border-b-2 whitespace-nowrap transition-colors ${activeTab === value ? 'border-[var(--studio-accent)] text-white' : 'border-transparent text-white/45 hover:text-white/75'}`}><Icon size={15} /> {label}</button>)}</div>
            </div>

            <div className="flex-1 p-4 md:p-5">
              <div className={activeTab === 'overview' ? '' : 'hidden'}>
                <div className="grid lg:grid-cols-[220px_minmax(0,1fr)] gap-5 max-w-5xl">
                  <div>
                    <div className="text-xs text-white/50 mb-2">Cover</div>
                    <div className="aspect-[2/3] border border-white/10 bg-[#0d0f12] flex items-center justify-center overflow-hidden">{pilotDraft.cover_url ? <img src={pilotDraft.cover_url} alt="AI Pilot cover" className="w-full h-full object-contain" /> : <div className="text-xs text-white/25">No cover</div>}</div>
                    <label className="mt-3 block"><input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={coverUploading} /><span className="h-10 w-full inline-flex items-center justify-center gap-2 border border-white/15 text-sm text-white/75 cursor-pointer hover:border-[var(--studio-accent)] hover:bg-white/[0.04]"><Upload size={15} /> {coverUploading ? 'Uploading…' : 'Upload cover'}</span></label>
                    {pilotDraft.cover_url && <button type="button" onClick={() => setPilotDraft({ ...pilotDraft, cover_url: '' })} className="w-full text-xs text-white/35 hover:text-white mt-2">Remove cover</button>}
                    <AIPilotPreviewGallery pilot={pilotDraft} />
                  </div>
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4"><label className="space-y-2"><span className="text-xs text-white/55">Name</span><Input className={CONTROL_CLASS} value={pilotDraft.name || ''} onChange={(e) => setPilotDraft({ ...pilotDraft, name: e.target.value })} /></label><label className="space-y-2"><span className="text-xs text-white/55">Key</span><Input className={CONTROL_CLASS} value={pilotDraft.pilot_key || ''} onChange={(e) => setPilotDraft({ ...pilotDraft, pilot_key: e.target.value })} /></label><label className="space-y-2"><span className="text-xs text-white/55">Category</span><Input className={CONTROL_CLASS} value={pilotDraft.category || ''} onChange={(e) => setPilotDraft({ ...pilotDraft, category: e.target.value })} /></label><label className="space-y-2"><span className="text-xs text-white/55">Distribution</span><Select value={pilotDraft.distribution_mode || 'private'} onValueChange={(value) => setPilotDraft({ ...pilotDraft, distribution_mode: value, asset_subcategory_id: value === 'assets_shop' ? pilotDraft.asset_subcategory_id : '' })}><SelectTrigger className={SELECT_TRIGGER_CLASS}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="private">Private</SelectItem><SelectItem value="assets_shop">Assets Shop</SelectItem></SelectContent></Select></label></div>
                    {pilotDraft.distribution_mode === 'assets_shop' && <div className="grid md:grid-cols-2 gap-4 border border-white/10 bg-white/[0.02] p-4"><div className="space-y-2"><span className="text-xs text-white/55">Assets Shop Category</span><div className="h-10 px-3 flex items-center border border-white/10 bg-black/20 text-sm text-white/70">{aiPilotCatalog.category?.label_en || 'AI Pilot'}</div></div><label className="space-y-2"><span className="text-xs text-white/55">Subcategory</span><Select value={pilotDraft.asset_subcategory_id || ''} onValueChange={(value) => setPilotDraft({ ...pilotDraft, asset_subcategory_id: value })}><SelectTrigger className={SELECT_TRIGGER_CLASS}><SelectValue placeholder="Select subcategory" /></SelectTrigger><SelectContent>{aiPilotCatalog.subcategories.map((subcategory) => <SelectItem key={subcategory.id} value={subcategory.id}>{subcategory.label_en || subcategory.label_fr || subcategory.key}</SelectItem>)}</SelectContent></Select></label></div>}
                    <label className="space-y-2 block"><span className="text-xs text-white/55">Description</span><Textarea className={CONTROL_CLASS} rows={5} value={pilotDraft.description || ''} onChange={(e) => setPilotDraft({ ...pilotDraft, description: e.target.value })} /></label>
                    <div className="space-y-2"><span className="text-xs text-white/55">Tags</span><div className="flex gap-2"><Input className={CONTROL_CLASS} value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={handleTagKeyDown} placeholder="Add tag" /><Button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => addTag()} disabled={!tagInput.trim()}>Add</Button></div>{!!pilotDraft.tags?.length && <div className="flex flex-wrap gap-2">{pilotDraft.tags.map((tag) => <span key={tag} className="inline-flex items-center gap-1.5 border border-white/15 px-2.5 py-1 text-xs text-white/75 bg-white/[0.03]">{tag}<button type="button" onClick={() => removeTag(tag)} className="text-white/35 hover:text-white"><X size={12} /></button></span>)}</div>}</div>
                  </div>
                </div>
              </div>

              {selectedVersion && <div className={activeTab === 'characters' ? '' : 'hidden'}><AIPilotCharacters ref={charactersRef} version={selectedVersion} readOnly={false} /></div>}

              {selectedVersion && <div className={activeTab === 'direction' ? '' : 'hidden'}>
                <div className="min-h-[58vh] border border-white/10">
                  <div className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-[#0b0d0f] px-4 py-3">
                    <label htmlFor="ai-pilot-direction-select" className="shrink-0 text-xs font-semibold text-white/60">Direction Section</label>
                    <select
                      id="ai-pilot-direction-select"
                      aria-label="Select direction section"
                      value={editingBlock?.block_key || ''}
                      onChange={(event) => {
                        const block = directionBlocks.find((item) => item.block_key === event.target.value);
                        if (block) selectBlock(block);
                      }}
                      className="min-w-0 w-full max-w-md flex-1 rounded border border-white/20 bg-[#151719] px-3 py-2 text-sm text-white focus:border-[var(--studio-accent)] focus:outline-none"
                    >
                      <option value="">Select a section</option>
                      {directionBlocks.map((block) => <option key={block.id || block.block_key} value={block.block_key}>{block.title}</option>)}
                    </select>
                  </div>
                  <div className="p-4 md:p-5">
                    <AIPilotDirectionEditor block={editingBlock} setBlock={setEditingBlock} readOnly={false} onSave={() => saveBlock.mutate()} saving={saveBlock.isPending} availableCharacters={scenarioCharacters.filter((character) => character.is_active !== false).map((character) => ({ id: character.id, name: character.role_name, reference_images: character.reference_images || [] }))} availableSets={scenarioSets} availableLooks={scenarioLooks} mySets={mySets} />
                  </div>
                </div>
              </div>}

              {selectedVersion && <div className={activeTab === 'media' ? '' : 'hidden'}><AIPilotMedia pilot={pilotDraft} version={selectedVersion} /></div>}

              <div className={activeTab === 'versions' ? '' : 'hidden'}>
                <div className="max-w-4xl space-y-4"><div className="flex items-center justify-between gap-4"><div><div className="text-sm text-white">Versions</div><div className="text-xs text-white/40 mt-1">Save updates the selected version. Publish remains a separate action.</div></div><Button className={SECONDARY_BUTTON_CLASS} onClick={() => createVersion.mutate()} disabled={!selectedVersion || createVersion.isPending}><Copy size={15} className="mr-2" /> New Version</Button></div><div className="border border-white/10 divide-y divide-white/10">{versions.map((version) => <button key={version.id} type="button" onClick={() => { setSelectedVersionId(version.id); setEditingBlock(null); }} className={`w-full text-left p-4 flex items-center justify-between gap-4 ${selectedVersion?.id === version.id ? 'bg-white/[0.05] shadow-[inset_2px_0_0_var(--studio-accent)]' : 'hover:bg-white/[0.03]'}`}><div><div className="text-sm text-white">Version {version.version_number}</div><div className="text-xs text-white/35 mt-1">{version.changelog || 'No version notes'}</div></div><span className="text-[10px] uppercase tracking-wider text-white/45">{version.is_published ? 'Published' : 'Draft'}</span></button>)}</div>{selectedVersion && <div className="border border-white/10 p-4 space-y-4"><label className="space-y-2 block"><span className="text-xs text-white/55">Version notes</span><Textarea className={CONTROL_CLASS} rows={4} value={versionNotesDraft} disabled={selectedVersion.is_published} onChange={(e) => setVersionNotesDraft(e.target.value)} /></label>{!selectedVersion.is_published && <div className="flex justify-end"><Button className={PRIMARY_BUTTON_CLASS} onClick={() => publishVersion.mutate()} disabled={publishVersion.isPending || blocks.length === 0}><Rocket size={15} className="mr-2" /> Publish v{selectedVersion.version_number}</Button></div>}</div>}</div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
