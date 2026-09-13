import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, Check, ChevronRight, Clock3, Film, Image as ImageIcon, Library, Loader2, MapPin, Pencil, Plus, Save, Sparkles, Trash2, UserRound, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import VaultPickerModal from './VaultPickerModal';
import AuthorProductionWorkspace from './AuthorProductionWorkspace';
import { normalizeAuthorProject } from './authorStoryModel';

const IMAGE_TYPES = ['Wide shot', 'Full shot', 'Medium shot', 'Close-up', 'Detail shot', 'Aerial view', 'Other'];
const TIME_OPTIONS = ['Dawn', 'Morning', 'Afternoon', 'Evening', 'Night', 'Late night'];
const fieldClass = 'w-full rounded-2xl border-2 border-black/10 bg-white px-4 py-3 text-sm font-semibold text-black placeholder-black/35 focus:border-black/40 focus:outline-none';
const labelClass = 'mb-1.5 block text-xs font-black uppercase tracking-wider text-black';

const emptyProject = () => normalizeAuthorProject();
const newSegment = (number) => ({ id: crypto.randomUUID(), number, narration_text: '', image_type: 'Wide shot', image_instruction: '', character_ids: [], location_ids: [], time_periods: [], transition_notes: '', image_url: '', narration_url: '', status: 'draft' });
const newChapter = (count, mode, topicId) => ({ id: crypto.randomUUID(), number: count + 1, title: `Chapter ${count + 1}`, creation_mode: mode, topic_id: topicId || null, segments: Array.from({ length: 9 }, (_, index) => newSegment(index + 1)) });

export default function AuthorStoryBlocks({ user, onBack, storyPacks = [], packCharacters = [], packSets = [], packTopics = [], packsLoading = false }) {
  const [view, setView] = useState('dashboard');
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeChapterId, setActiveChapterId] = useState(null);
  const [shopCharacters, setShopCharacters] = useState([]);
  const [shopSets, setShopSets] = useState([]);

  const loadProjects = async () => {
    setLoading(true);
    try { setProjects(await base44.entities.AuthorStoryProject.list('-updated_date', 100)); }
    catch (error) { toast.error(error.message || 'Unable to load your author projects'); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadProjects(); }, []);

  useEffect(() => {
    const loadShopSelections = async () => {
      const { data: categories, error: categoryError } = await supabase
        .from('asset_category')
        .select('id,key,label_en,label_fr')
        .eq('is_active', true);
      if (categoryError) throw categoryError;

      const categoryText = (category) => `${category.key || ''} ${category.label_en || ''} ${category.label_fr || ''}`.toLowerCase();
      const categoryById = new Map((categories || []).map((category) => [category.id, category]));
      const characterCategoryIds = (categories || []).filter((category) => /\b(actor|character|acteur|personnage)s?\b/.test(categoryText(category))).map((category) => category.id);
      const setCategoryIds = (categories || []).filter((category) => /\b(set|sets|décor|decor|lieu|location)s?\b/.test(categoryText(category))).map((category) => category.id);
      const selectAssets = async (categoryIds) => {
        if (!categoryIds.length) return [];
        const { data, error } = await supabase
          .from('catalog_asset')
          .select('id,title,description,featured_image,preview_images,category_id,creator_name')
          .eq('status', 'published')
          .in('category_id', categoryIds)
          .order('title', { ascending: true })
          .limit(300);
        if (error) throw error;
        return (data || []).map((asset) => {
          const category = categoryById.get(asset.category_id);
          return {
            ...asset,
            category_key: category?.key || '',
            category_label: category?.label_en || category?.label_fr || category?.key || '',
          };
        });
      };
      const [characters, sets] = await Promise.all([selectAssets(characterCategoryIds), selectAssets(setCategoryIds)]);
      setShopCharacters(characters);
      setShopSets(sets);
    };

    loadShopSelections().catch((error) => toast.error(error.message || 'Unable to load OLO Shop selections'));
  }, []);

  const openProject = (row) => {
    const complete = row.story_description && row.characters?.length && row.locations?.length;
    setProject(normalizeAuthorProject(row));
    setActiveChapterId(row.chapters?.[0]?.id || null);
    setView(complete ? 'workspace' : 'setup');
  };

  const saveProject = async (nextView = view, sourceProject = project, options = {}) => {
    if (!sourceProject?.title?.trim()) { toast.error('Add a story title'); return null; }
    setSaving(true);
    try {
      const payload = { title: sourceProject.title.trim(), genre: sourceProject.genre?.trim() || null, story_description: sourceProject.story_description.trim(), tone_rules: sourceProject.tone_rules?.trim() || null, story_rules: sourceProject.story_rules?.trim() || null, cover_image: sourceProject.cover_image || null, characters: sourceProject.characters || [], locations: sourceProject.locations || [], topics: sourceProject.topics || [], chapters: sourceProject.chapters || [], production_settings: sourceProject.production_settings || {}, status: sourceProject.status || 'draft' };
      const saved = sourceProject.id ? await base44.entities.AuthorStoryProject.update(sourceProject.id, payload) : await base44.entities.AuthorStoryProject.create(payload);
      setProject(saved);
      setProjects((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setView(nextView);
      if (!options.silent) toast.success('Private project saved');
      return saved;
    } catch (error) { toast.error(error.message || 'Unable to save the project'); return null; }
    finally { setSaving(false); }
  };

  if (view === 'dashboard') return <AuthorDashboard
    projects={projects} loading={loading} onBack={onBack}
    onNew={() => setView('start')} onOpen={openProject}
    onDelete={async (id) => { if (!window.confirm('Delete this private author project?')) return; try { await base44.entities.AuthorStoryProject.delete(id); setProjects((rows) => rows.filter((row) => row.id !== id)); } catch (error) { toast.error(error.message); } }}
  />;

  if (view === 'start') return <AuthorStart
    storyPacks={storyPacks} packCharacters={packCharacters} packSets={packSets} packTopics={packTopics} loading={packsLoading}
    onBack={() => setView('dashboard')}
    onBlank={() => { setProject(emptyProject()); setView('setup'); }}
    onImport={(nextProject) => { setProject(nextProject); setView('setup'); }}
  />;

  if (view === 'setup' && project) return <ProjectSetup
    user={user} project={project} setProject={setProject} shopCharacters={shopCharacters} shopSets={shopSets}
    saving={saving} onBack={() => setView(project.id ? 'workspace' : 'dashboard')} onSave={(foundationComplete) => saveProject(foundationComplete ? 'workspace' : 'setup')}
  />;

  if (view === 'workspace' && project) return <AuthorProductionWorkspace
    user={user} project={project} setProject={setProject} activeChapterId={activeChapterId} setActiveChapterId={setActiveChapterId}
    saving={saving} onBack={() => { setView('dashboard'); loadProjects(); }} onEditSetup={() => setView('setup')} onSave={(sourceProject, options) => saveProject('workspace', sourceProject || project, options)}
  />;
  return null;
}

function AuthorDashboard({ projects, loading, onBack, onNew, onOpen, onDelete }) {
  return <div className="mx-auto w-full max-w-[1500px] px-5 pb-24 lg:px-10">
    <div className="mb-8 flex items-center gap-3"><button onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black text-yellow-400"><ArrowLeft size={20} /></button><div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-[0.2em] text-black/60">Private author workspace</p><h2 className="truncate text-2xl font-black text-black lg:text-4xl">My FotoPlay</h2></div><button onClick={onNew} className="flex items-center gap-2 rounded-2xl bg-black px-4 py-3 text-sm font-black text-yellow-400 lg:px-6"><Plus size={18} /><span className="hidden sm:inline">New FotoPlay</span><span className="sm:hidden">New</span></button></div>
    <div className="mb-8 rounded-3xl bg-black p-6 text-white lg:flex lg:items-center lg:justify-between lg:p-8"><div><div className="mb-2 flex items-center gap-2 text-yellow-400"><Sparkles size={18} /><span className="text-xs font-black uppercase tracking-widest">Your stories, your production</span></div><p className="max-w-3xl text-sm font-semibold leading-relaxed text-white/80 lg:text-base">Create privately, direct nine narrative segments per chapter, and publish only when your production is ready.</p></div><div className="mt-5 rounded-2xl bg-yellow-400 px-4 py-3 text-xs font-black uppercase tracking-wider text-black lg:mt-0">Private until published</div></div>
    {loading ? <div className="flex justify-center py-24"><Loader2 className="animate-spin text-black" size={30} /></div> : projects.length === 0 ? <button onClick={onNew} className="flex w-full flex-col items-center rounded-[2rem] border-2 border-dashed border-black/25 bg-black/5 px-6 py-20 text-center"><BookOpen size={42} className="mb-4" /><p className="text-xl font-black">Create your first FotoPlay</p><p className="mt-2 text-sm font-semibold text-black/60">Define the story, cast and locations before building its chapters.</p></button> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{projects.map((item) => <motion.article key={item.id} whileHover={{ y: -3 }} className="overflow-hidden rounded-[2rem] bg-black shadow-xl"><button onClick={() => onOpen(item)} className="block w-full text-left"><div className="aspect-video bg-yellow-400">{item.cover_image ? <img src={item.cover_image} alt="" className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center"><BookOpen size={42} /></div>}</div><div className="p-5"><p className="truncate text-lg font-black text-yellow-400">{item.title}</p><p className="mt-1 line-clamp-2 text-sm font-semibold text-white/70">{item.story_description}</p><div className="mt-4 flex gap-4 text-xs font-bold text-white/55"><span>{item.characters?.length || 0} characters</span><span>{item.locations?.length || 0} locations</span><span>{item.chapters?.length || 0} chapters</span></div></div></button><div className="flex items-center justify-between border-t border-white/10 px-5 py-3"><span className="text-xs font-black uppercase tracking-wider text-yellow-400">Private draft</span><button onClick={() => onDelete(item.id)} className="rounded-xl bg-red-500/15 p-2 text-red-400"><Trash2 size={15} /></button></div></motion.article>)}</div>}
  </div>;
}

function AuthorStart({ storyPacks, packCharacters, packSets, packTopics, loading, onBack, onBlank, onImport }) {
  const [selectedPack, setSelectedPack] = useState(null);
  const [selection, setSelection] = useState({ foundation: true, cover: true, characterIds: [], locationIds: [], topicIds: [] });
  const packItems = useMemo(() => {
    if (!selectedPack) return { characters: [], locations: [], topics: [] };
    const characterIds = new Set(selectedPack.story_character_ids || []);
    const locationIds = new Set(selectedPack.story_set_ids || []);
    const topicIds = new Set(selectedPack.starting_topic_ids || []);
    return {
      characters: packCharacters.filter((item) => characterIds.has(item.id)),
      locations: packSets.filter((item) => locationIds.has(item.id)),
      topics: packTopics.filter((item) => topicIds.has(item.id) || item.theme_id === selectedPack.id),
    };
  }, [selectedPack, packCharacters, packSets, packTopics]);
  const choosePack = (pack) => {
    const characterIds = new Set(pack.story_character_ids || []);
    const locationIds = new Set(pack.story_set_ids || []);
    const topicIds = new Set(pack.starting_topic_ids || []);
    setSelectedPack(pack);
    setSelection({
      foundation: true,
      cover: true,
      characterIds: packCharacters.filter((item) => characterIds.has(item.id)).map((item) => item.id),
      locationIds: packSets.filter((item) => locationIds.has(item.id)).map((item) => item.id),
      topicIds: packTopics.filter((item) => topicIds.has(item.id) || item.theme_id === pack.id).map((item) => item.id),
    });
  };
  const toggle = (field, id) => setSelection((current) => ({ ...current, [field]: current[field].includes(id) ? current[field].filter((value) => value !== id) : [...current[field], id] }));
  const importPack = () => {
    if (!selectedPack) return;
    const source = { id: selectedPack.id, title: selectedPack.title, imported_at: new Date().toISOString() };
    const project = normalizeAuthorProject({
      genre: selection.foundation ? selectedPack.type || '' : '',
      story_description: selection.foundation ? selectedPack.description || '' : '',
      tone_rules: selection.foundation ? selectedPack.tone_rules || '' : '',
      story_rules: selection.foundation ? selectedPack.story_rules || '' : '',
      cover_image: selection.cover ? selectedPack.cover_image || selectedPack.cover_template_image || '' : '',
      characters: packItems.characters.filter((item) => selection.characterIds.includes(item.id)).map((item) => ({ id: crypto.randomUUID(), name: item.name, description: item.description || '', image_url: item.photos?.[0] || item.reference_sheet || '', reference_images: [...new Set([...(item.photos || []), item.reference_sheet].filter(Boolean))], source: 'story_pack', source_id: item.id, source_pack_id: selectedPack.id, source_pack_title: selectedPack.title })),
      locations: packItems.locations.filter((item) => selection.locationIds.includes(item.id)).map((item) => ({ id: crypto.randomUUID(), name: item.name, description: item.description || '', image_url: item.images?.[0] || '', reference_images: item.images || [], source: 'story_pack', source_id: item.id, source_pack_id: selectedPack.id, source_pack_title: selectedPack.title })),
      topics: packItems.topics.filter((item) => selection.topicIds.includes(item.id)).map((item) => ({ id: crypto.randomUUID(), title: item.title, description: item.description || '', source: 'story_pack', source_id: item.id, source_pack_id: selectedPack.id, source_pack_title: selectedPack.title })),
      production_settings: { story_pack_source: source },
    });
    onImport(project);
  };
  if (selectedPack) return <div className="mx-auto w-full max-w-[1500px] px-5 pb-24 lg:px-10">
    <div className="mb-8 flex items-center gap-3"><button onClick={() => setSelectedPack(null)} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black text-yellow-400"><ArrowLeft size={20} /></button><div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-widest text-black/55">Start from a Story Pack</p><h2 className="truncate text-2xl font-black lg:text-4xl">Choose what to bring into your story</h2></div><button onClick={importPack} className="rounded-2xl bg-black px-5 py-3 text-sm font-black text-yellow-400">Use selected components</button></div>
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]"><aside className="overflow-hidden rounded-[2rem] bg-black text-white">{(selectedPack.cover_image || selectedPack.cover_template_image) && <img src={selectedPack.cover_image || selectedPack.cover_template_image} alt="" className="aspect-video w-full object-cover" />}<div className="p-6"><p className="text-xs font-black uppercase tracking-widest text-yellow-400">Story Pack</p><h3 className="mt-2 text-2xl font-black">{selectedPack.title}</h3><p className="mt-3 text-sm font-semibold leading-relaxed text-white/65">{selectedPack.description}</p><p className="mt-5 text-xs font-bold text-white/45">The pack remains unchanged. Your selections are copied into a private project and can be edited or removed at any time.</p></div></aside>
      <main className="space-y-5"><PackSection title="Story foundation" description="World, genre, tone and story rules" checked={selection.foundation} onToggle={() => setSelection((current) => ({ ...current, foundation: !current.foundation }))} /><PackSection title="Pack cover" description="Use the pack image as a starting cover" checked={selection.cover} onToggle={() => setSelection((current) => ({ ...current, cover: !current.cover }))} image={selectedPack.cover_image || selectedPack.cover_template_image} />
        <PackItemGroup title="Characters" items={packItems.characters} selected={selection.characterIds} onToggle={(id) => toggle('characterIds', id)} imageFor={(item) => item.photos?.[0] || item.reference_sheet} />
        <PackItemGroup title="Locations" items={packItems.locations} selected={selection.locationIds} onToggle={(id) => toggle('locationIds', id)} imageFor={(item) => item.images?.[0]} />
        <PackItemGroup title="Inspiration topics" items={packItems.topics} selected={selection.topicIds} onToggle={(id) => toggle('topicIds', id)} />
      </main></div>
  </div>;
  return <div className="mx-auto w-full max-w-[1500px] px-5 pb-24 lg:px-10"><div className="mb-8 flex items-center gap-3"><button onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black text-yellow-400"><ArrowLeft size={20} /></button><div><p className="text-xs font-black uppercase tracking-widest text-black/55">FotoPlay Author</p><h2 className="text-2xl font-black lg:text-4xl">How do you want to begin?</h2></div></div>
    <div className="grid gap-5 lg:grid-cols-2"><button onClick={onBlank} className="min-h-64 rounded-[2rem] bg-black p-7 text-left text-white"><Pencil className="text-yellow-400" size={34} /><h3 className="mt-12 text-3xl font-black">Create from scratch</h3><p className="mt-3 text-sm font-semibold text-white/60">Build your own story, cast, locations and topics with every existing Author tool.</p></button><section className="rounded-[2rem] bg-yellow-400 p-7"><Library size={34} /><h3 className="mt-8 text-3xl font-black">Start from a Story Pack</h3><p className="mt-3 text-sm font-semibold text-black/60">Choose only the components you want, then adapt them freely in your private project.</p></section></div>
    <div className="mt-6"><h3 className="mb-4 text-sm font-black uppercase tracking-widest">Available Story Packs</h3>{loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin" /></div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{storyPacks.filter((pack) => pack.is_active !== false).map((pack) => <button key={pack.id} onClick={() => choosePack(pack)} className="overflow-hidden rounded-3xl bg-black text-left text-white"><div className="aspect-video bg-black/10">{(pack.cover_image || pack.cover_template_image) ? <img src={pack.cover_image || pack.cover_template_image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-yellow-400"><BookOpen size={34} /></div>}</div><div className="p-5"><p className="text-xs font-black uppercase tracking-widest text-yellow-400">{pack.type || 'Story Pack'}</p><h4 className="mt-1 text-lg font-black">{pack.title}</h4><p className="mt-2 line-clamp-2 text-xs font-semibold text-white/55">{pack.description}</p></div></button>)}</div>}</div>
  </div>;
}

function PackSection({ title, description, checked, onToggle, image }) {
  return <button onClick={onToggle} className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left ${checked ? 'border-black bg-yellow-400' : 'border-black/10 bg-white'}`}>{image && <img src={image} alt="" className="h-14 w-20 rounded-xl object-cover" />}<div className="flex-1"><p className="font-black">{title}</p><p className="text-xs font-semibold text-black/55">{description}</p></div><span className={`flex h-7 w-7 items-center justify-center rounded-full ${checked ? 'bg-black text-yellow-400' : 'bg-black/10'}`}>{checked && <Check size={16} />}</span></button>;
}

function PackItemGroup({ title, items, selected, onToggle, imageFor }) {
  if (!items.length) return null;
  return <section className="rounded-3xl bg-black p-5 text-white"><div className="mb-4 flex items-center justify-between"><h3 className="font-black text-yellow-400">{title}</h3><span className="text-xs font-bold text-white/50">{selected.length}/{items.length} selected</span></div><div className="grid gap-2 sm:grid-cols-2">{items.map((item) => { const checked = selected.includes(item.id); const image = imageFor?.(item); return <button key={item.id} onClick={() => onToggle(item.id)} className={`flex items-center gap-3 rounded-2xl border p-3 text-left ${checked ? 'border-yellow-400 bg-yellow-400/10' : 'border-white/10 bg-white/5'}`}>{image && <img src={image} alt="" className="h-12 w-12 rounded-xl object-cover" />}<div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{item.name || item.title}</p><p className="line-clamp-1 text-xs text-white/45">{item.description}</p></div><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${checked ? 'bg-yellow-400 text-black' : 'bg-white/10'}`}>{checked && <Check size={14} />}</span></button>; })}</div></section>;
}

function ProjectSetup({ user, project, setProject, shopCharacters, shopSets, saving, onBack, onSave }) {
  const [characterDraft, setCharacterDraft] = useState({ name: '', description: '', image_url: '', image_source: '', image_source_id: null, reference_images: [] });
  const [locationDraft, setLocationDraft] = useState({ name: '', description: '', image_url: '', image_source: '', image_source_id: null, reference_images: [] });
  const [editingCharacterId, setEditingCharacterId] = useState(null);
  const [editingLocationId, setEditingLocationId] = useState(null);
  const [vaultTarget, setVaultTarget] = useState(null);
  const emptyAssetDraft = () => ({ name: '', description: '', image_url: '', image_source: '', image_source_id: null, reference_images: [] });
  const addCustom = (kind) => {
    const draft = kind === 'character' ? characterDraft : locationDraft;
    if (!draft.name.trim()) { toast.error(`Add a ${kind} name`); return; }
    const field = kind === 'character' ? 'characters' : 'locations';
    const editingId = kind === 'character' ? editingCharacterId : editingLocationId;
    setProject((current) => {
      const values = { name: draft.name.trim(), description: draft.description.trim(), image_url: draft.image_url, image_source: draft.image_source || null, image_source_id: draft.image_source_id || null, reference_images: Array.isArray(draft.reference_images) ? draft.reference_images : [] };
      if (editingId) return { ...current, [field]: current[field].map((item) => item.id === editingId ? { ...item, ...values } : item) };
      return { ...current, [field]: [...current[field], { id: crypto.randomUUID(), source: 'author', source_id: null, ...values }] };
    });
    if (kind === 'character') { setCharacterDraft(emptyAssetDraft()); setEditingCharacterId(null); }
    else { setLocationDraft(emptyAssetDraft()); setEditingLocationId(null); }
  };
  const editAsset = (kind, item) => {
    const draft = { name: item.name || '', description: item.description || '', image_url: item.image_url || '', image_source: item.image_source || '', image_source_id: item.image_source_id || null, reference_images: Array.isArray(item.reference_images) ? item.reference_images : [] };
    if (kind === 'character') { setCharacterDraft(draft); setEditingCharacterId(item.id); }
    else { setLocationDraft(draft); setEditingLocationId(item.id); }
  };
  const cancelEdit = (kind) => {
    if (kind === 'character') { setCharacterDraft(emptyAssetDraft()); setEditingCharacterId(null); }
    else { setLocationDraft(emptyAssetDraft()); setEditingLocationId(null); }
  };
  const removeAsset = (kind, id) => {
    const field = kind === 'character' ? 'characters' : 'locations';
    setProject((current) => ({ ...current, [field]: current[field].filter((item) => item.id !== id) }));
    if ((kind === 'character' ? editingCharacterId : editingLocationId) === id) cancelEdit(kind);
  };
  const selectLibraryImage = (kind, source, selectedImage) => {
    const image = selectedImage || source.featured_image || source.preview_images?.[0] || '';
    if (!image) { toast.error('This OLO Shop selection has no image'); return; }
    const setDraft = kind === 'character' ? setCharacterDraft : setLocationDraft;
    const referenceImages = [...new Set([source.featured_image, ...(Array.isArray(source.preview_images) ? source.preview_images : [])].filter(Boolean))];
    setDraft((current) => ({ ...current, image_url: image, image_source: 'olo_shop', image_source_id: source.id, reference_images: referenceImages }));
  };
  const complete = project.title.trim() && project.story_description.trim() && project.characters.length && project.locations.length;
  return <div className="mx-auto w-full max-w-[1500px] px-5 pb-28 lg:px-10">
    <div className="mb-8 flex items-center gap-3"><button onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black text-yellow-400"><ArrowLeft size={20} /></button><div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-widest text-black/55">FotoPlay Author</p><h2 className="truncate text-2xl font-black text-black lg:text-4xl">Define your story</h2></div><button onClick={() => onSave(complete)} disabled={saving || !project.title.trim()} className="flex items-center gap-2 rounded-2xl bg-black px-5 py-3 text-sm font-black text-yellow-400 disabled:opacity-35">{saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />} {complete ? 'Save & continue' : 'Save draft'}</button></div>
    {project.production_settings?.story_pack_source && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-black bg-yellow-400 px-5 py-4"><div><p className="text-xs font-black uppercase tracking-widest">Started from Story Pack</p><p className="font-black">{project.production_settings.story_pack_source.title}</p></div><p className="max-w-xl text-xs font-semibold text-black/60">This is your private editable copy. You can change or remove every imported component without changing the original pack.</p></div>}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,.9fr)]">
      <section className="space-y-5 rounded-[2rem] bg-black/5 p-5 lg:p-7">
        <div><label className={labelClass}>Story title *</label><input className={fieldClass} value={project.title} onChange={(e) => setProject({ ...project, title: e.target.value })} placeholder="Title of your story" /></div>
        <div><label className={labelClass}>Genre</label><input className={fieldClass} value={project.genre || ''} onChange={(e) => setProject({ ...project, genre: e.target.value })} placeholder="Drama, comedy, thriller, science fiction..." /></div>
        <div><label className={labelClass}>Story definition *</label><textarea className={`${fieldClass} min-h-36 resize-y`} value={project.story_description} onChange={(e) => setProject({ ...project, story_description: e.target.value })} placeholder="Define the story, its world, central conflict and direction." /></div>
        <div className="grid gap-4 md:grid-cols-2"><div><label className={labelClass}>Tone and atmosphere</label><textarea className={`${fieldClass} min-h-28`} value={project.tone_rules || ''} onChange={(e) => setProject({ ...project, tone_rules: e.target.value })} /></div><div><label className={labelClass}>Story rules</label><textarea className={`${fieldClass} min-h-28`} value={project.story_rules || ''} onChange={(e) => setProject({ ...project, story_rules: e.target.value })} /></div></div>
        <div><label className={labelClass}>Cover image</label><button onClick={() => setVaultTarget('cover')} className="flex aspect-video w-full max-w-sm items-center justify-center overflow-hidden rounded-2xl bg-black text-yellow-400">{project.cover_image ? <img src={project.cover_image} alt="" className="h-full w-full object-contain" /> : <><ImageIcon size={20} /><span className="ml-2 text-xs font-black">Choose from Vault</span></>}</button></div>
      </section>
      <section className="rounded-[2rem] bg-black p-5 text-white lg:p-7"><div className="mb-5 flex items-center gap-3"><Users className="text-yellow-400" /><div><h3 className="font-black">Project foundation</h3><p className="text-xs font-semibold text-white/55">Required before the first chapter</p></div></div>
        <AssetBuilder title="Characters" icon={UserRound} items={project.characters} draft={characterDraft} setDraft={setCharacterDraft} editingId={editingCharacterId} onAdd={() => addCustom('character')} onEdit={(item) => editAsset('character', item)} onCancelEdit={() => cancelEdit('character')} onRemove={(id) => removeAsset('character', id)} onVault={() => setVaultTarget('character')} library={shopCharacters} onSelectImage={(item, imageUrl) => selectLibraryImage('character', item, imageUrl)} selected={(item, imageUrl) => characterDraft.image_source === 'olo_shop' && characterDraft.image_source_id === item.id && characterDraft.image_url === imageUrl} />
        <div className="my-7 h-px bg-white/10" />
        <AssetBuilder title="Locations" icon={MapPin} items={project.locations} draft={locationDraft} setDraft={setLocationDraft} editingId={editingLocationId} onAdd={() => addCustom('location')} onEdit={(item) => editAsset('location', item)} onCancelEdit={() => cancelEdit('location')} onRemove={(id) => removeAsset('location', id)} onVault={() => setVaultTarget('location')} library={shopSets} onSelectImage={(item, imageUrl) => selectLibraryImage('location', item, imageUrl)} selected={(item, imageUrl) => locationDraft.image_source === 'olo_shop' && locationDraft.image_source_id === item.id && locationDraft.image_url === imageUrl} />
      </section>
    </div>
    {vaultTarget && <VaultPickerModal allowUpload userEmail={user?.email} onClose={() => setVaultTarget(null)} onSelect={(url) => { if (vaultTarget === 'cover') setProject((p) => ({ ...p, cover_image: url })); if (vaultTarget === 'character') setCharacterDraft((p) => ({ ...p, image_url: url, image_source: 'vault', image_source_id: null })); if (vaultTarget === 'location') setLocationDraft((p) => ({ ...p, image_url: url, image_source: 'vault', image_source_id: null })); setVaultTarget(null); }} />}
  </div>;
}

function AssetBuilder({ title, icon: Icon, items, draft, setDraft, editingId, onAdd, onEdit, onCancelEdit, onRemove, onVault, library, onSelectImage, selected }) {
  const [showLibrary, setShowLibrary] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryCreator, setLibraryCreator] = useState('all');
  const [libraryCategory, setLibraryCategory] = useState('all');
  const libraryCreators = useMemo(() => [...new Set(library.map((item) => item.creator_name).filter(Boolean))].sort(), [library]);
  const libraryCategories = useMemo(() => [...new Set(library.map((item) => item.category_label).filter(Boolean))].sort(), [library]);
  const filteredLibrary = useMemo(() => {
    const term = librarySearch.trim().toLowerCase();
    return library.filter((item) => {
      if (libraryCreator !== 'all' && item.creator_name !== libraryCreator) return false;
      if (libraryCategory !== 'all' && item.category_label !== libraryCategory) return false;
      if (!term) return true;
      return [item.title, item.description, item.creator_name, item.category_label]
        .some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [library, librarySearch, libraryCreator, libraryCategory]);
  const filteredLibraryImages = useMemo(() => filteredLibrary.flatMap((item) => {
    const images = [...new Set([item.featured_image, ...(Array.isArray(item.preview_images) ? item.preview_images : [])].filter(Boolean))];
    return images.map((imageUrl, imageIndex) => ({ item, imageUrl, imageIndex }));
  }), [filteredLibrary]);
  const clearLibraryFilters = () => { setLibrarySearch(''); setLibraryCreator('all'); setLibraryCategory('all'); };
  return <div><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><Icon size={17} className="text-yellow-400" /><h4 className="text-sm font-black">{title} *</h4></div><span className="rounded-full bg-yellow-400 px-2.5 py-1 text-xs font-black text-black">{items.length}</span></div>
    <div className="space-y-2">{items.map((item) => <div key={item.id} className={`flex items-center gap-3 rounded-2xl p-2.5 ${editingId === item.id ? 'bg-yellow-400/20 ring-1 ring-yellow-400' : 'bg-white/10'}`}><div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-yellow-400 text-black">{item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-cover" /> : <Icon size={18} />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{item.name}</p><p className="text-xs font-semibold text-white/50">{item.source === 'olo_shop' ? 'OLO Shop selection' : item.source === 'story_pack' ? `Story Pack · ${item.source_pack_title || 'Imported'}` : 'Author asset'}</p></div><button onClick={() => onEdit(item)} className="p-2 text-yellow-400" aria-label={`Edit ${item.name}`} title="Edit"><Pencil size={15} /></button><button onClick={() => onRemove(item.id)} className="p-2 text-red-400" aria-label={`Remove ${item.name}`} title="Remove"><X size={15} /></button></div>)}</div>
    <div className="mt-3 space-y-2 rounded-2xl bg-white/5 p-3">{editingId && <div className="flex items-center justify-between rounded-xl bg-yellow-400/15 px-3 py-2"><span className="text-xs font-black uppercase tracking-wider text-yellow-400">Editing {title.slice(0, -1).toLowerCase()}</span><button onClick={onCancelEdit} className="text-xs font-black text-white/70">Cancel</button></div>}<input className="w-full rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-black" placeholder={`${editingId ? 'Edit' : 'New'} ${title.slice(0, -1).toLowerCase()} name`} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /><textarea className="w-full rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-black" rows={2} placeholder="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />{draft.image_url && <div className="flex items-center gap-3 rounded-xl border border-yellow-400/30 bg-black/30 p-2"><img src={draft.image_url} alt="Selected reference" className="h-14 w-14 rounded-lg object-cover" /><div className="min-w-0 flex-1"><p className="text-xs font-black text-yellow-400">Selected image</p><p className="truncate text-[11px] font-semibold text-white/50">{draft.image_source === 'olo_shop' ? 'OLO Shop' : 'Vault'}</p></div><button onClick={() => setDraft({ ...draft, image_url: '', image_source: '', image_source_id: null })} className="p-2 text-red-400" aria-label="Remove selected image"><X size={15} /></button></div>}<div className="flex gap-2"><button onClick={onVault} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 py-2.5 text-xs font-black text-yellow-400"><Library size={14} /> Select image from Vault</button><button onClick={onAdd} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-yellow-400 py-2.5 text-xs font-black text-black">{editingId ? <Save size={14} /> : <Plus size={14} />} {editingId ? 'Save changes' : 'Add'}</button></div></div>
    <button onClick={() => setShowLibrary(!showLibrary)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-yellow-400/40 py-2.5 text-xs font-black text-yellow-400"><Library size={14} /> {showLibrary ? 'Hide OLO Shop images' : 'Select image from OLO Shop'}</button>
    {showLibrary && <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <input value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="Search OLO Shop" className="rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-black placeholder:text-black/40" />
        <select value={libraryCategory} onChange={(event) => setLibraryCategory(event.target.value)} className="rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-black"><option value="all">All categories</option>{libraryCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select>
        <select value={libraryCreator} onChange={(event) => setLibraryCreator(event.target.value)} className="rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-black"><option value="all">All creators</option>{libraryCreators.map((creator) => <option key={creator} value={creator}>{creator}</option>)}</select>
      </div>
      <div className="my-3 flex items-center justify-between text-xs font-bold text-white/55"><span>{filteredLibraryImages.length} images from {filteredLibrary.length} assets</span>{(librarySearch || libraryCategory !== 'all' || libraryCreator !== 'all') && <button onClick={clearLibraryFilters} className="text-yellow-400">Clear filters</button>}</div>
      <div className="grid grid-cols-2 gap-2">{filteredLibraryImages.map(({ item, imageUrl, imageIndex }) => <button key={`${item.id}-${imageIndex}`} onClick={() => onSelectImage(item, imageUrl)} className={`rounded-xl border p-2 text-left ${selected(item, imageUrl) ? 'border-yellow-400 bg-yellow-400/15' : 'border-white/10 bg-white/5'}`}><div className="mb-2 aspect-video overflow-hidden rounded-lg bg-white/5"><img src={imageUrl} alt={`${item.title} reference ${imageIndex + 1}`} className="h-full w-full object-contain" /></div><div className="flex items-center justify-between gap-2"><div className="min-w-0"><span className="block truncate text-xs font-black">{item.title}</span><span className="block truncate text-[10px] text-white/45">Image {imageIndex + 1} · {item.category_label}{item.creator_name ? ` · ${item.creator_name}` : ''}</span></div>{selected(item, imageUrl) && <Check size={14} className="shrink-0 text-yellow-400" />}</div></button>)}</div>
    </div>}
  </div>;
}

function ProjectWorkspace({ project, setProject, activeChapterId, setActiveChapterId, saving, onBack, onEditSetup, onSave }) {
  const [topic, setTopic] = useState({ title: '', description: '' });
  const [mode, setMode] = useState('manual');
  const [topicId, setTopicId] = useState('');
  const active = useMemo(() => project.chapters.find((c) => c.id === activeChapterId), [project.chapters, activeChapterId]);
  const updateChapter = (updater) => setProject((p) => ({ ...p, chapters: p.chapters.map((c) => c.id === activeChapterId ? updater(c) : c) }));
  const updateSegment = (id, values) => updateChapter((c) => ({ ...c, segments: c.segments.map((s) => s.id === id ? { ...s, ...values } : s) }));
  const addChapter = () => { if (mode === 'topic' && !topicId) return toast.error('Select a topic'); const chapter = newChapter(project.chapters.length, mode, topicId); setProject((p) => ({ ...p, chapters: [...p.chapters, chapter] })); setActiveChapterId(chapter.id); };
  return <div className="mx-auto w-full max-w-[1700px] px-5 pb-28 lg:px-10"><div className="mb-6 flex items-center gap-3"><button onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black text-yellow-400"><ArrowLeft size={20} /></button><div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-widest text-black/55">Private author project</p><h2 className="truncate text-2xl font-black lg:text-4xl">{project.title}</h2></div><button onClick={onEditSetup} className="hidden rounded-2xl bg-black/10 px-4 py-3 text-sm font-black md:block">Story, cast & locations</button><button onClick={onSave} disabled={saving} className="flex items-center gap-2 rounded-2xl bg-black px-4 py-3 text-sm font-black text-yellow-400">{saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />} Save</button></div>
    <div className="grid gap-5 lg:grid-cols-[330px_minmax(0,1fr)]"><aside className="space-y-5"><section className="rounded-3xl bg-black p-5 text-white"><div className="mb-3 flex items-center gap-2 text-yellow-400"><Sparkles size={17} /><h3 className="text-sm font-black uppercase tracking-wider">Inspiration topics</h3></div><p className="mb-4 text-xs font-semibold text-white/55">Optional ideas for an automated chapter draft.</p><div className="space-y-2">{project.topics.map((t) => <div key={t.id} className="rounded-xl bg-white/10 p-3"><div className="flex gap-2"><div className="flex-1"><p className="text-sm font-black">{t.title}</p><p className="text-xs text-white/55">{t.description}</p></div><button onClick={() => setProject((p) => ({ ...p, topics: p.topics.filter((x) => x.id !== t.id) }))}><X size={14} className="text-red-400" /></button></div></div>)}</div><div className="mt-3 space-y-2"><input className="w-full rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-black" placeholder="Topic title" value={topic.title} onChange={(e) => setTopic({ ...topic, title: e.target.value })} /><textarea className="w-full rounded-xl bg-white px-3 py-2.5 text-sm text-black" rows={2} placeholder="Starting idea" value={topic.description} onChange={(e) => setTopic({ ...topic, description: e.target.value })} /><button onClick={() => { if (!topic.title.trim()) return; setProject((p) => ({ ...p, topics: [...p.topics, { id: crypto.randomUUID(), title: topic.title.trim(), description: topic.description.trim() }] })); setTopic({ title: '', description: '' }); }} className="w-full rounded-xl bg-yellow-400 py-2.5 text-xs font-black text-black">Add topic</button></div></section>
      <section className="rounded-3xl bg-black/5 p-4"><h3 className="mb-3 text-sm font-black uppercase tracking-wider">Chapters</h3><div className="space-y-2">{project.chapters.map((c) => <button key={c.id} onClick={() => setActiveChapterId(c.id)} className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ${c.id === activeChapterId ? 'bg-black text-yellow-400' : 'bg-white text-black'}`}><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400 text-xs font-black text-black">{c.number}</span><span className="flex-1 truncate text-sm font-black">{c.title}</span><ChevronRight size={15} /></button>)}</div><div className="mt-4 space-y-2"><div className="grid grid-cols-2 gap-2"><button onClick={() => setMode('manual')} className={`rounded-xl py-2.5 text-xs font-black ${mode === 'manual' ? 'bg-black text-yellow-400' : 'bg-white'}`}>Write directly</button><button onClick={() => setMode('topic')} className={`rounded-xl py-2.5 text-xs font-black ${mode === 'topic' ? 'bg-black text-yellow-400' : 'bg-white'}`}>Use a topic</button></div>{mode === 'topic' && <select value={topicId} onChange={(e) => setTopicId(e.target.value)} className={fieldClass}><option value="">Select a topic</option>{project.topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select>}<button onClick={addChapter} className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-xs font-black"><Plus size={15} /> New chapter</button></div></section></aside>
      <main>{!active ? <div className="flex min-h-[520px] flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-black/20 bg-black/5 p-10 text-center"><Film size={44} className="mb-4" /><h3 className="text-xl font-black">Create the first chapter</h3><p className="mt-2 text-sm font-semibold text-black/55">Every chapter starts with nine editable narrative segments.</p></div> : <section className="overflow-hidden rounded-[2rem] bg-black text-white"><div className="flex flex-col gap-3 border-b border-white/10 p-5 md:flex-row md:items-center"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400 font-black text-black">{active.number}</div><input value={active.title} onChange={(e) => updateChapter((c) => ({ ...c, title: e.target.value }))} className="min-w-0 flex-1 rounded-xl bg-white/10 px-3 py-2 text-lg font-black text-white" /><span className="rounded-xl bg-yellow-400/15 px-3 py-2 text-xs font-black uppercase text-yellow-400">9 segments · {active.creation_mode === 'topic' ? 'Topic assisted' : 'Author directed'}</span></div><div className="space-y-4 p-4 lg:p-6">{active.segments.map((s) => <SegmentEditor key={s.id} segment={s} characters={project.characters} locations={project.locations} onChange={(values) => updateSegment(s.id, values)} />)}</div></section>}</main></div>
  </div>;
}

function SegmentEditor({ segment, characters, locations, onChange }) {
  const [open, setOpen] = useState(segment.number === 1);
  const toggle = (field, value) => onChange({ [field]: segment[field].includes(value) ? segment[field].filter((x) => x !== value) : [...segment[field], value] });
  return <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/5"><button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 p-4 text-left"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400 text-xs font-black text-black">{segment.number}</span><div className="min-w-0 flex-1"><p className="text-sm font-black">Segment {segment.number}</p><p className="truncate text-xs text-white/45">{segment.narration_text || 'Narration and production instructions'}</p></div><ChevronRight size={17} className={`text-yellow-400 ${open ? 'rotate-90' : ''}`} /></button>{open && <div className="grid gap-4 border-t border-white/10 p-4 xl:grid-cols-2"><div className="space-y-4"><div><label className="mb-1 block text-xs font-black uppercase text-yellow-400">Narration text</label><textarea value={segment.narration_text} onChange={(e) => onChange({ narration_text: e.target.value })} rows={5} className="w-full rounded-xl bg-white p-3 text-sm font-semibold text-black" /></div><div className="grid gap-3 sm:grid-cols-[180px_1fr]"><select value={segment.image_type} onChange={(e) => onChange({ image_type: e.target.value })} className="rounded-xl bg-white p-3 text-sm font-bold text-black">{IMAGE_TYPES.map((type) => <option key={type}>{type}</option>)}</select><input value={segment.image_instruction} onChange={(e) => onChange({ image_instruction: e.target.value })} className="rounded-xl bg-white p-3 text-sm text-black" placeholder="Image instruction for the AI" /></div><textarea value={segment.transition_notes} onChange={(e) => onChange({ transition_notes: e.target.value })} rows={3} className="w-full rounded-xl bg-white p-3 text-sm text-black" placeholder="Changes of location or time inside this segment" /></div><div className="space-y-5"><ChoiceGrid title="Characters present" icon={Users} items={characters} selected={segment.character_ids} onToggle={(id) => toggle('character_ids', id)} /><ChoiceGrid title="Locations concerned" icon={MapPin} items={locations} selected={segment.location_ids} onToggle={(id) => toggle('location_ids', id)} /><div><div className="mb-2 flex items-center gap-2 text-yellow-400"><Clock3 size={15} /><p className="text-xs font-black uppercase">Time periods</p></div><div className="flex flex-wrap gap-2">{TIME_OPTIONS.map((time) => <button key={time} onClick={() => toggle('time_periods', time)} className={`rounded-xl px-3 py-2 text-xs font-black ${segment.time_periods.includes(time) ? 'bg-yellow-400 text-black' : 'bg-white/10'}`}>{time}</button>)}</div></div></div></div>}</article>;
}

function ChoiceGrid({ title, icon: Icon, items, selected, onToggle }) {
  return <div><div className="mb-2 flex items-center gap-2 text-yellow-400"><Icon size={15} /><p className="text-xs font-black uppercase">{title}</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{items.map((item) => <button key={item.id} onClick={() => onToggle(item.id)} className={`flex items-center gap-2 rounded-xl border p-2 text-left ${selected.includes(item.id) ? 'border-yellow-400 bg-yellow-400/15' : 'border-white/10 bg-white/5'}`}><div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-yellow-400 text-black">{item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-cover" /> : <Icon size={15} />}</div><span className="flex-1 truncate text-xs font-black">{item.name}</span>{selected.includes(item.id) && <Check size={13} className="text-yellow-400" />}</button>)}</div></div>;
}
