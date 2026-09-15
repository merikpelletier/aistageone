import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, Copy, ExternalLink, Eye, EyeOff, Film, Image as ImageIcon, LayoutTemplate, Loader2, MonitorPlay, Music, Plus, Rocket, Save, Settings2, Share2, Trash2, Volume2 } from 'lucide-react';
import { supabase } from '@/api/base44Client';
import PitchDeckPreview, { mediaThumbnail, mediaUrl } from '@/components/pitch/PitchDeckPreview';
import PitchVoiceSelector from '@/components/pitch/PitchVoiceSelector';
import { LAYOUT_OPTIONS, PITCH_TEMPLATES, TRANSITIONS } from '@/components/pitch/pitchDeckTemplates';

const emptyProject = { working_title: '', final_title: '', tagline: '', project_type: 'film', genre: '', subgenre: '', hook_headline: '', logline_short: '', logline_full: '', original_language: 'en', project_status: 'draft', selected_template_id: 'science_fiction' };

async function loadEditor(id) {
  const results = await Promise.all([
    supabase.from('pitch_project').select('*').eq('id', id).single(),
    supabase.from('pitch_section').select('*').eq('pitch_project_id', id).order('order_index'),
    supabase.from('pitch_media').select('*').eq('pitch_project_id', id).order('display_order'),
    supabase.from('pitch_character').select('*').eq('pitch_project_id', id).order('display_order'),
    supabase.from('pitch_source_document').select('*').eq('pitch_project_id', id).order('created_at'),
    supabase.from('pitch_title_option').select('*').eq('pitch_project_id', id).order('score', { ascending: false }),
  ]);
  const error = results.map((result) => result.error).find(Boolean);
  if (error) throw error;
  return { project: results[0].data, sections: results[1].data || [], media: results[2].data || [], characters: results[3].data || [], documents: results[4].data || [], titles: results[5].data || [] };
}

const mediaIcon = (type) => type === 'video' ? Film : type === 'audio' ? Music : ImageIcon;
const slugify = (value) => String(value || 'pitch').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'pitch';

export default function PitchDeckEditor() {
  const [params] = useSearchParams();
  const projectId = params.get('id');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [project, setProject] = useState(emptyProject);
  const [selectedId, setSelectedId] = useState(null);
  const [panel, setPanel] = useState('sections');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [mediaDraft, setMediaDraft] = useState({ title: '', source_media_url: '', media_type: 'image' });
  const [narrationVoice, setNarrationVoice] = useState('Rachel');
  const [narrationLanguage, setNarrationLanguage] = useState('en');
  const [generatingNarration, setGeneratingNarration] = useState(false);
  const [narrationPlaying, setNarrationPlaying] = useState(false);
  const [narrationMuted, setNarrationMuted] = useState(false);
  const narrationAudioRef = useRef(null);
  const timers = useRef({});
  const { data, isLoading, error } = useQuery({ queryKey: ['pitch-editor', projectId], queryFn: () => loadEditor(projectId), enabled: Boolean(projectId) });

  useEffect(() => { if (data?.project) setProject(data.project); }, [data?.project]);
  useEffect(() => { if (!selectedId && data?.sections?.length) setSelectedId(data.sections[0].id); }, [data?.sections, selectedId]);

  const selected = data?.sections?.find((section) => section.id === selectedId) || null;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['pitch-editor', projectId] });
  const setLocalSection = (id, patch) => queryClient.setQueryData(['pitch-editor', projectId], (current) => current ? ({ ...current, sections: current.sections.map((section) => section.id === id ? { ...section, ...patch } : section) }) : current);

  const updateSection = (id, patch) => {
    setLocalSection(id, patch);
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(async () => {
      const { error: updateError } = await supabase.from('pitch_section').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
      if (updateError) setNotice(updateError.message);
    }, 450);
  };

  const saveProject = async () => {
    setSaving(true); setNotice('');
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setNotice('Sign in is required.'); setSaving(false); return; }
    const allowed = ['working_title','final_title','tagline','project_type','genre','subgenre','format','original_language','creator_name','creator_email','creator_phone','company_name','project_status','intended_recipient','pitch_goal','selected_template_id','hook_headline','logline_short','logline_full'];
    const payload = Object.fromEntries(allowed.map((field) => [field, project[field] ?? null]));
    payload.owner_id = auth.user.id; payload.updated_at = new Date().toISOString();
    const result = projectId ? await supabase.from('pitch_project').update(payload).eq('id', projectId).select('*').single() : await supabase.from('pitch_project').insert(payload).select('*').single();
    if (result.error) setNotice(result.error.message);
    else { setProject(result.data); setNotice('Pitch deck saved.'); if (!projectId) navigate(`/PitchDeckEditor?id=${encodeURIComponent(result.data.id)}`, { replace: true }); }
    setSaving(false);
  };

  const addSection = async () => {
    if (!projectId) { setNotice('Save the project before adding sections.'); setPanel('project'); return; }
    const isFirst = !data.sections.length;
    const { data: created, error: createError } = await supabase.from('pitch_section').insert({ pitch_project_id: projectId, section_type: isFirst ? 'cover' : 'custom', title: isFirst ? 'Cover' : 'New section', original_language: project.original_language || 'en', order_index: data.sections.length, layout_type: isFirst ? 'hero' : 'text', transition_type: 'fade', is_visible: true, show_text: true }).select('*').single();
    if (createError) setNotice(createError.message); else { await refresh(); setSelectedId(created.id); }
  };

  const moveSection = async (index, direction) => {
    const reordered = [...data.sections];
    const next = index + direction;
    if (next < 0 || next >= reordered.length) return;
    const [moved] = reordered.splice(index, 1); reordered.splice(next, 0, moved);
    queryClient.setQueryData(['pitch-editor', projectId], { ...data, sections: reordered.map((section, order_index) => ({ ...section, order_index })) });
    await Promise.all(reordered.map((section, order_index) => supabase.from('pitch_section').update({ order_index }).eq('id', section.id)));
  };

  const duplicateSection = async (section) => {
    const payload = { pitch_project_id: projectId, section_type: section.section_type, title: `${section.title || 'Section'} copy`, subtitle: section.subtitle, body: section.body, original_language: section.original_language, source_media_url: section.source_media_url, source_media_cover_url: section.source_media_cover_url, gallery_media: section.gallery_media || [], show_text: section.show_text, order_index: data.sections.length, layout_type: section.layout_type, transition_type: section.transition_type, is_visible: section.is_visible, is_custom: true };
    await supabase.from('pitch_section').insert(payload); refresh();
  };

  const deleteSection = async (id) => { await supabase.from('pitch_section').delete().eq('id', id); if (selectedId === id) setSelectedId(null); refresh(); };

  const generateNarration = async () => {
    if (!selected || !projectId) return;
    setGeneratingNarration(true); setNotice('');
    narrationAudioRef.current?.pause();
    setNarrationPlaying(false);
    const { data: result, error: genError } = await supabase.functions.invoke('generatePitchSpeech', { body: { project_id: projectId, section_id: selected.id, voice: narrationVoice, language_code: narrationLanguage || 'en' } });
    if (genError || !result?.url) {
      let detail = result?.error || genError?.message || 'Narration generation failed.';
      const context = genError?.context;
      if (context) {
        const status = context.status ? `HTTP ${context.status}` : '';
        let bodyText = '';
        try {
          const raw = typeof context.json === 'function' ? await context.json() : (typeof context.text === 'function' ? await context.text() : null);
          bodyText = raw && typeof raw === 'object' ? (raw.error || JSON.stringify(raw)) : (raw || '');
        } catch { /* ignore body parse failure */ }
        detail = [status, bodyText || detail].filter(Boolean).join(' - ');
      }
      setNotice(detail);
    }
    else {
      setNotice('Narration saved for this section.');
      const resolvedVoice = result.voice || narrationVoice;
      const resolvedLanguage = result.language_code || narrationLanguage;
      setLocalSection(selected.id, { narration_audio_url: result.url, narration_voice: resolvedVoice, narration_language: resolvedLanguage });
      const audio = narrationAudioRef.current;
      if (audio) {
        audio.muted = narrationMuted;
        audio.src = result.url;
        audio.load();
        audio.play().catch(() => setNarrationPlaying(false));
      }
      refresh();
    }
    setGeneratingNarration(false);
  };

  // Reuses the same native <audio> playback pattern as StoryBlock's narration_audio_urls:
  // one stored URL per unit (section here, segment there), loaded directly into a visible
  // native audio element and controlled via its own play/pause/ended events.
  const toggleNarrationPlayback = () => {
    const audio = narrationAudioRef.current;
    if (!audio || !selected?.narration_audio_url) return;
    if (audio.paused) { audio.play().catch(() => { setNarrationPlaying(false); }); }
    else { audio.pause(); }
  };

  const toggleNarrationMute = () => {
    const audio = narrationAudioRef.current;
    const next = !narrationMuted;
    setNarrationMuted(next);
    if (audio) audio.muted = next;
  };

  useEffect(() => {
    narrationAudioRef.current?.pause();
    setNarrationPlaying(false);
  }, [selectedId]);

  const attachMedia = async (item) => {
    if (!selected) { setNotice('Select a section first.'); return; }
    const url = mediaUrl(item);
    if (!url) return;
    if (selected.layout_type === 'gallery') {
      const gallery = Array.isArray(selected.gallery_media) ? selected.gallery_media : [];
      updateSection(selected.id, { gallery_media: gallery.includes(url) ? gallery.filter((entry) => entry !== url) : [...gallery, url] });
    } else updateSection(selected.id, { source_media_url: selected.source_media_url === url ? null : url });
  };

  const addMediaLink = async () => {
    if (!projectId || !mediaDraft.source_media_url.trim()) return;
    const payload = { pitch_project_id: projectId, title: mediaDraft.title || mediaDraft.source_media_url.split('/').pop(), media_type: mediaDraft.media_type, source_media_url: mediaDraft.source_media_url.trim(), source_thumbnail_url: mediaDraft.media_type === 'image' ? mediaDraft.source_media_url.trim() : null, display_order: data.media.length };
    const { error: mediaError } = await supabase.from('pitch_media').insert(payload);
    if (mediaError) setNotice(mediaError.message); else { setMediaDraft({ title: '', source_media_url: '', media_type: 'image' }); refresh(); }
  };

  const selectTemplate = async (templateId) => {
    setProject((current) => ({ ...current, selected_template_id: templateId }));
    if (projectId) { await supabase.from('pitch_project').update({ selected_template_id: templateId, updated_at: new Date().toISOString() }).eq('id', projectId); refresh(); }
  };

  const publicUrl = project.share_slug ? `${window.location.origin}/PitchDeckShare?slug=${encodeURIComponent(project.share_slug)}` : '';

  const publishProject = async () => {
    if (!projectId) { setNotice('Save the project before publishing it.'); return; }
    if (!(data?.sections || []).some((section) => section.is_visible !== false)) { setNotice('Add at least one visible section before publishing.'); return; }
    setPublishing(true); setNotice('');
    const shareSlug = project.share_slug || `${slugify(project.final_title || project.working_title)}-${projectId.replace(/-/g, '').slice(0, 8)}`;
    const allowed = ['working_title','final_title','tagline','project_type','genre','subgenre','format','original_language','creator_name','creator_email','creator_phone','company_name','intended_recipient','pitch_goal','selected_template_id','hook_headline','logline_short','logline_full'];
    const payload = Object.fromEntries(allowed.map((field) => [field, project[field] ?? null]));
    Object.assign(payload, { share_slug: shareSlug, share_access_type: 'link', allow_sharing: true, is_published: true, project_status: 'published', updated_at: new Date().toISOString() });
    const { data: published, error: publishError } = await supabase.from('pitch_project').update(payload).eq('id', projectId).select('*').single();
    if (publishError) setNotice(publishError.message);
    else { setProject(published); setNotice('Published. Anyone with the link can view this pitch deck.'); await refresh(); }
    setPublishing(false);
  };

  const copyPublicLink = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setNotice('Share link copied.');
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-zinc-950"><Loader2 className="h-8 w-8 animate-spin text-cyan-400" /></div>;
  if (error) return <div className="min-h-screen bg-zinc-950 p-8 text-white"><Link to="/Studio?tab=tools" className="inline-flex items-center gap-2 text-cyan-400"><ArrowLeft size={18} /> STUDIO TOOLS</Link><p className="mt-10">This pitch deck cannot be edited.</p></div>;

  const panelTabs = [{ id: 'sections', label: 'Sections', icon: LayoutTemplate }, { id: 'media', label: 'Media', icon: Film }, { id: 'project', label: 'Project', icon: Settings2 }];

  return <div className="min-h-screen bg-zinc-950 pb-24 text-white">
    <header className="agent-safe-lg-sticky border-b border-zinc-800 bg-zinc-950/95 px-4 py-4 backdrop-blur lg:sticky lg:top-0 lg:z-40">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Link to="/PitchDecks" className="text-zinc-400 hover:text-white"><ArrowLeft size={19} /></Link><div><p className="text-[10px] font-bold tracking-[.25em] text-cyan-400">OLO PITCH BUILDER</p><h1 className="text-lg font-bold">{project.final_title || project.working_title || 'New pitch deck'}</h1></div></div><div className="flex items-center gap-2"><Link to="/Studio?tab=tools" className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300">STUDIO TOOLS</Link>{projectId && <Link to={`/PitchDeckDetail?id=${encodeURIComponent(projectId)}`} className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/50 px-3 py-2 text-xs text-cyan-300"><MonitorPlay size={15} /> FULL PREVIEW</Link>}<button onClick={publishProject} disabled={publishing || !projectId} className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/50 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-300 disabled:opacity-40">{publishing ? <Loader2 size={15} className="animate-spin" /> : <Rocket size={15} />} {project.is_published ? 'REPUBLISH' : 'PUBLISH'}</button><button onClick={saveProject} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-xs font-bold disabled:opacity-50">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} SAVE</button></div></div>
    </header>
    <main className="mx-auto max-w-[1500px] p-4">
      {notice && <div className="mb-4 border-l-4 border-cyan-400 bg-zinc-900 p-3 text-sm text-zinc-200">{notice}</div>}
      {project.is_published && publicUrl && <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3"><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Published Â· public link</p><p className="truncate text-xs text-zinc-300">{publicUrl}</p></div><button onClick={copyPublicLink} className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-bold text-cyan-300"><Share2 size={14} /> COPY LINK</button><a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-zinc-950"><ExternalLink size={14} /> OPEN STANDALONE</a></div>}
      <div className="grid grid-cols-12 gap-4">
        <section className="col-span-12 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 lg:col-span-9"><p className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-500">Interactive preview</p><PitchDeckPreview project={project} sections={data?.sections || []} media={data?.media || []} characters={data?.characters || []} selectedId={selectedId} onSelectSection={setSelectedId} /></section>
        <aside className="col-span-12 lg:col-span-3"><div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 lg:sticky lg:top-24"><div className="grid grid-cols-3 border-b border-zinc-800">{panelTabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setPanel(id)} className={`flex items-center justify-center gap-1.5 px-2 py-3 text-xs ${panel === id ? 'bg-cyan-500/15 text-cyan-300' : 'text-zinc-500 hover:text-white'}`}><Icon size={14} /> {label}</button>)}</div>
          <div className="max-h-[calc(100vh-10rem)] overflow-y-auto p-3">
            {panel === 'sections' && <div className="space-y-3"><button onClick={addSection} className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 py-2 text-xs font-bold text-cyan-300"><Plus size={15} /> ADD SECTION</button><div className="space-y-1.5">{(data?.sections || []).map((section, index) => <div key={section.id} onClick={() => setSelectedId(section.id)} className={`cursor-pointer rounded-lg border p-2 ${selectedId === section.id ? 'border-cyan-500 bg-cyan-500/10' : 'border-zinc-800 bg-zinc-950/50'}`}><div className="flex items-center gap-1"><span className="w-5 text-[10px] text-zinc-600">{index + 1}</span><p className="min-w-0 flex-1 truncate text-xs">{section.title || section.section_type}</p><button onClick={(event) => { event.stopPropagation(); moveSection(index, -1); }} className="p-1 text-zinc-500"><ChevronUp size={13} /></button><button onClick={(event) => { event.stopPropagation(); moveSection(index, 1); }} className="p-1 text-zinc-500"><ChevronDown size={13} /></button><button onClick={(event) => { event.stopPropagation(); updateSection(section.id, { is_visible: !section.is_visible }); }} className="p-1 text-zinc-500">{section.is_visible === false ? <EyeOff size={13} /> : <Eye size={13} />}</button><button onClick={(event) => { event.stopPropagation(); duplicateSection(section); }} className="p-1 text-zinc-500"><Copy size={13} /></button><button onClick={(event) => { event.stopPropagation(); deleteSection(section.id); }} className="p-1 text-red-400"><Trash2 size={13} /></button></div></div>)}</div>
              {selected && <div className="space-y-3 border-t border-zinc-800 pt-3"><label className="block text-[10px] uppercase text-zinc-500">Title<input value={selected.title || ''} onChange={(event) => updateSection(selected.id, { title: event.target.value })} className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs text-white" /></label><label className="block text-[10px] uppercase text-zinc-500">Subtitle<input value={selected.subtitle || ''} onChange={(event) => updateSection(selected.id, { subtitle: event.target.value })} className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs text-white" /></label><label className="block text-[10px] uppercase text-zinc-500">Body<textarea value={selected.body || ''} onChange={(event) => updateSection(selected.id, { body: event.target.value })} rows={6} className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs text-white" /></label><label className="block text-[10px] uppercase text-zinc-500">Layout<select value={selected.layout_type || 'text'} onChange={(event) => updateSection(selected.id, { layout_type: event.target.value })} className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs text-white">{LAYOUT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block text-[10px] uppercase text-zinc-500">Transition<select value={selected.transition_type || 'fade'} onChange={(event) => updateSection(selected.id, { transition_type: event.target.value })} className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs text-white">{TRANSITIONS.map((transition) => <option key={transition}>{transition}</option>)}</select></label><div className="space-y-2 border-t border-zinc-800 pt-3"><p className="text-[10px] uppercase text-zinc-500">Narration</p><PitchVoiceSelector value={narrationVoice} onChange={setNarrationVoice} language={narrationLanguage} onLanguageChange={setNarrationLanguage} /><button onClick={generateNarration} disabled={generatingNarration} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-cyan-600 py-2 text-xs font-bold disabled:opacity-50">{generatingNarration ? <Loader2 size={13} className="animate-spin" /> : <Volume2 size={13} />} {generatingNarration ? 'GENERATING NARRATION...' : 'GENERATE NARRATION'}</button>{selected.narration_audio_url && <div className="flex items-center gap-2"><button onClick={toggleNarrationPlayback} className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-bold text-cyan-300">{narrationPlaying ? 'PAUSE' : 'PLAY'}</button><button onClick={toggleNarrationMute} className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-bold text-cyan-300">{narrationMuted ? 'UNMUTE' : 'MUTE'}</button><p className="truncate text-[10px] text-emerald-400">Saved: {selected.narration_voice} Â· {selected.narration_language}</p><audio ref={narrationAudioRef} src={selected.narration_audio_url} controls onEnded={() => setNarrationPlaying(false)} onPause={() => setNarrationPlaying(false)} onPlay={() => setNarrationPlaying(true)} className="mt-2 w-full" /></div>}</div></div>}
            </div>}
            {panel === 'media' && <div className="space-y-3"><p className="text-xs text-zinc-400">Select a slide, then attach an image, video or audio file from the library.</p><div className="space-y-2">{(data?.media || []).map((item) => { const Icon = mediaIcon(item.media_type); const attached = selected && (selected.source_media_url === mediaUrl(item) || (Array.isArray(selected.gallery_media) && selected.gallery_media.includes(mediaUrl(item)))); return <div key={item.id} className={`rounded-lg border p-2 ${attached ? 'border-cyan-500 bg-cyan-500/10' : 'border-zinc-800 bg-zinc-950/50'}`}><div className="flex items-center gap-2"><div className="flex h-14 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-black">{item.media_type === 'image' && mediaThumbnail(item) ? <img src={mediaThumbnail(item)} alt="" className="h-full w-full object-cover" /> : item.media_type === 'video' && mediaUrl(item) ? <video src={mediaUrl(item)} muted preload="metadata" className="h-full w-full object-cover" /> : <Icon size={20} className="text-cyan-400" />}</div><div className="min-w-0 flex-1"><p className="truncate text-xs text-white">{item.title || 'Untitled media'}</p><p className="text-[10px] uppercase text-zinc-600">{item.media_type}</p></div><button onClick={() => attachMedia(item)} className={`rounded-md px-2 py-1 text-xs ${attached ? 'bg-cyan-500 text-white' : 'bg-zinc-800 text-cyan-300'}`}>{attached ? 'âœ“' : '+'}</button><button onClick={async () => { await supabase.from('pitch_media').delete().eq('id', item.id); refresh(); }} className="p-1 text-red-400"><Trash2 size={13} /></button></div></div>; })}</div><div className="space-y-2 border-t border-zinc-800 pt-3"><p className="text-xs font-bold text-white">Add existing media URL</p><input value={mediaDraft.title} onChange={(event) => setMediaDraft({ ...mediaDraft, title: event.target.value })} placeholder="Media title" className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs" /><input value={mediaDraft.source_media_url} onChange={(event) => setMediaDraft({ ...mediaDraft, source_media_url: event.target.value })} placeholder="https://..." className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs" /><select value={mediaDraft.media_type} onChange={(event) => setMediaDraft({ ...mediaDraft, media_type: event.target.value })} className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs"><option value="image">Image</option><option value="video">Video</option><option value="audio">Audio</option></select><button onClick={addMediaLink} className="w-full rounded-md bg-cyan-600 py-2 text-xs font-bold">ADD TO LIBRARY</button></div></div>}
            {panel === 'project' && <div className="space-y-3"><p className="text-xs font-bold text-white">Project details</p>{[['working_title','Working title'],['final_title','Final title'],['tagline','Tagline'],['genre','Genre'],['subgenre','Subgenre'],['project_type','Project type'],['hook_headline','Hook headline']].map(([field,label]) => <label key={field} className="block text-[10px] uppercase text-zinc-500">{label}<input value={project[field] || ''} onChange={(event) => setProject({ ...project, [field]: event.target.value })} className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs text-white" /></label>)}<label className="block text-[10px] uppercase text-zinc-500">Logline<textarea value={project.logline_short || ''} onChange={(event) => setProject({ ...project, logline_short: event.target.value })} rows={4} className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs text-white" /></label><button onClick={saveProject} className="w-full rounded-md bg-gradient-to-r from-cyan-500 to-blue-600 py-2 text-xs font-bold">SAVE PROJECT</button><div className="border-t border-zinc-800 pt-3"><p className="mb-2 text-xs font-bold text-white">Visual template</p><div className="grid grid-cols-2 gap-2">{PITCH_TEMPLATES.map((template) => <button key={template.id} onClick={() => selectTemplate(template.id)} className={`overflow-hidden rounded-lg border text-left ${project.selected_template_id === template.id ? 'border-cyan-400' : 'border-zinc-700'}`}><div className={`h-12 bg-gradient-to-br ${template.gradient}`} /><p className="truncate px-2 py-1.5 text-[10px]">{template.name}</p></button>)}</div></div><div className="grid grid-cols-2 gap-2 text-center"><div className="rounded-lg bg-zinc-950 p-3"><p className="text-xl font-bold text-cyan-400">{data?.documents.length || 0}</p><p className="text-[9px] uppercase text-zinc-600">Documents</p></div><div className="rounded-lg bg-zinc-950 p-3"><p className="text-xl font-bold text-cyan-400">{data?.titles.length || 0}</p><p className="text-[9px] uppercase text-zinc-600">Title ideas</p></div></div></div>}
          </div>
        </div></aside>
      </div>
    </main>
  </div>;
}

