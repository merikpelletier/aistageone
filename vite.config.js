import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// Page-centric FotoPlay workspace. The importer-scoped redirect keeps the
// existing mobile/non-comic fallback available without creating a module loop.
const fotoPlayPageWorkspace = {
  name: 'fotoplay-page-workspace',
  enforce: 'pre',
  resolveId(source, importer) {
    if (
      source === './AuthorProductionWorkspace' &&
      importer?.replace(/\\/g, '/').endsWith('/src/components/studio/AuthorStoryBlocks.jsx')
    ) {
      return fileURLToPath(new URL('./src/components/studio/AuthorProductionWorkspaceZoom.jsx', import.meta.url))
    }
    return null
  },
  transform(code, id) {
    const normalizedId = id?.replace(/\\/g, '/') || ''

    // Story / cast setup: a character owns a persistent default voice.
    if (normalizedId.endsWith('/src/components/studio/AuthorStoryBlocks.jsx')) {
      let next = code
      next = next.replace(
        "import ProjectCreditsFields from './ProjectCreditsFields';",
        "import ProjectCreditsFields from './ProjectCreditsFields';\nimport { VOICE_NAMES } from '@/lib/voiceCatalog';"
      )
      next = next.replace(
        "useState({ name: '', description: '', image_url: '', image_source: '', image_source_id: null, reference_images: [] })",
        "useState({ name: '', description: '', image_url: '', image_source: '', image_source_id: null, reference_images: [], voice: '' })"
      )
      next = next.replace(
        "const emptyAssetDraft = () => ({ name: '', description: '', image_url: '', image_source: '', image_source_id: null, reference_images: [] });",
        "const emptyAssetDraft = () => ({ name: '', description: '', image_url: '', image_source: '', image_source_id: null, reference_images: [], voice: '' });"
      )
      next = next.replace(
        "const values = { name: draft.name.trim(), description: draft.description.trim(), image_url: draft.image_url, image_source: draft.image_source || null, image_source_id: draft.image_source_id || null, reference_images: Array.isArray(draft.reference_images) ? draft.reference_images : [] };",
        "const values = { name: draft.name.trim(), description: draft.description.trim(), image_url: draft.image_url, image_source: draft.image_source || null, image_source_id: draft.image_source_id || null, reference_images: Array.isArray(draft.reference_images) ? draft.reference_images : [], ...(kind === 'character' ? { voice: draft.voice || '' } : {}) };"
      )
      next = next.replace(
        "const draft = { name: item.name || '', description: item.description || '', image_url: item.image_url || '', image_source: item.image_source || '', image_source_id: item.image_source_id || null, reference_images: Array.isArray(item.reference_images) ? item.reference_images : [] };",
        "const draft = { name: item.name || '', description: item.description || '', image_url: item.image_url || '', image_source: item.image_source || '', image_source_id: item.image_source_id || null, reference_images: Array.isArray(item.reference_images) ? item.reference_images : [], voice: item.voice || item.voice_id || item.tts_voice || '' };"
      )
      next = next.replace(
        '<AssetBuilder title="Characters" icon={UserRound}',
        '<AssetBuilder title="Characters" icon={UserRound} supportsVoice'
      )
      next = next.replace(
        "function AssetBuilder({ title, icon: Icon, items, draft, setDraft, editingId, onAdd, onEdit, onCancelEdit, onRemove, onVault, library, onSelectImage, selected }) {",
        "function AssetBuilder({ title, icon: Icon, items, draft, setDraft, editingId, onAdd, onEdit, onCancelEdit, onRemove, onVault, library, onSelectImage, selected, supportsVoice = false }) {"
      )
      next = next.replace(
        "<p className=\"text-xs font-semibold text-white/50\">{item.source === 'olo_shop' ? 'OLO Shop selection' : item.source === 'story_pack' ? `Story Pack · ${item.source_pack_title || 'Imported'}` : 'Author asset'}</p>",
        "<p className=\"text-xs font-semibold text-white/50\">{item.source === 'olo_shop' ? 'OLO Shop selection' : item.source === 'story_pack' ? `Story Pack · ${item.source_pack_title || 'Imported'}` : 'Author asset'}{supportsVoice && item.voice ? ` · Voice: ${item.voice}` : ''}</p>"
      )
      next = next.replace(
        '<textarea className="w-full rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-black" rows={2} placeholder="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />',
        '<textarea className="w-full rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-black" rows={2} placeholder="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />{supportsVoice && <div className="grid grid-cols-[1fr_auto] gap-2"><select value={draft.voice || \'\'} onChange={(e) => setDraft({ ...draft, voice: e.target.value })} className="w-full rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-black"><option value="">Choose character voice</option>{VOICE_NAMES.map((voice) => <option key={voice} value={voice}>{voice}</option>)}</select><button type="button" disabled={!draft.voice} onClick={async () => { try { const response = await base44.functions.invoke(\'generateSpeech\', { voice: draft.voice, preview: true }); const url = response?.data?.file_url; if (!url) throw new Error(\'Voice preview unavailable\'); await new Audio(url).play(); } catch (error) { toast.error(error.message || \'Unable to preview voice\'); } }} className="rounded-xl border border-yellow-400/40 bg-yellow-400 px-3 py-2.5 text-xs font-black text-black disabled:opacity-35">Listen</button></div>}'
      )
      return next === code ? null : { code: next, map: null }
    }

    if (!normalizedId.endsWith('/src/components/studio/AuthorProductionWorkspacePage.jsx')) return null

    let next = code

    next = next.replace(
      "import StoryImageFileActions from './StoryImageFileActions';",
      "import StoryImageFileActions from './StoryImageFileActions';\nimport { FotoPlayPreviewModal, FotoPlayExportModal, FotoPlayPublishModal } from './FotoPlayProjectActions';\nimport FotoPlayAudioPanel from './FotoPlayAudioPanel';"
    )

    next = next.replace(
      "import { IMAGE_RATIOS, IMAGE_TYPES, TIME_OPTIONS, normalizeSegment, selectedItems } from './authorStoryModel';",
      "import { IMAGE_RATIOS, IMAGE_TYPES, TIME_OPTIONS, normalizeSegment, selectedItems, newChapter } from './authorStoryModel';"
    )

    next = next.replace(
      'async function drawCoverImage(ctx, source, slot, posX = 50, posY = 50) {',
      'async function drawCoverImage(ctx, source, slot, posX = 50, posY = 50, zoom = 1) {'
    )
    next = next.replace(
      'const scale = Math.max(slot.w / bitmap.width, slot.h / bitmap.height);',
      'const scale = Math.max(slot.w / bitmap.width, slot.h / bitmap.height) * Math.max(1, Number(zoom) || 1);'
    )
    next = next.replace(
      'await drawCoverImage(ctx, panel.image_url, slot, panel.position_x ?? 50, panel.position_y ?? 50);',
      'await drawCoverImage(ctx, panel.image_url, slot, panel.position_x ?? 50, panel.position_y ?? 50, panel.scale ?? 1);'
    )

    next = next.replace(
      'style={{ objectPosition: `${panel.position_x ?? 50}% ${panel.position_y ?? 50}%` }}',
      'style={{ objectPosition: `${panel.position_x ?? 50}% ${panel.position_y ?? 50}%`, transform: `scale(${Math.max(1, Number(panel.scale) || 1)})`, transformOrigin: `${panel.position_x ?? 50}% ${panel.position_y ?? 50}%` }}'
    )

    next = next.replace(
      "width: Math.max(18, Math.min(100 - state.box.x, state.box.width + dx)), height: Math.max(8, Math.min(100 - state.box.y, state.box.height + dy))",
      "width: Math.max(2, Math.min(100 - state.box.x, state.box.width + dx)), height: Math.max(2, Math.min(100 - state.box.y, state.box.height + dy))"
    )

    // Playback highlight for the narration/dialogue box currently being spoken.
    next = next.replace(
      "const [selectedBox, setSelectedBox] = useState('');\n  const [width, setWidth] = useState(900);",
      "const [selectedBox, setSelectedBox] = useState('');\n  const [audioActiveBox, setAudioActiveBox] = useState('');\n  const [width, setWidth] = useState(900);\n  useEffect(() => { const handler = (event) => setAudioActiveBox(event.detail?.id || ''); window.addEventListener('fotoplay-audio-active', handler); return () => window.removeEventListener('fotoplay-audio-active', handler); }, []);"
    )
    next = next.replace(
      "className={`absolute z-20 bg-white text-black shadow-lg ${textMode && selectedBox === box.id ? 'ring-3 ring-[#23c7be]' : 'ring-1 ring-black/70'}`}",
      "className={`absolute z-20 bg-white text-black shadow-lg ${audioActiveBox === box.id ? 'ring-4 ring-[#23c7be] shadow-[0_0_28px_rgba(35,199,190,.55)]' : textMode && selectedBox === box.id ? 'ring-3 ring-[#23c7be]' : 'ring-1 ring-black/70'}`}"
    )

    const marker = '<textarea value={selected.prompt || \'\'} onChange={(e) => updatePanel(selectedPanel, { prompt: e.target.value })} rows={8} className={dark} placeholder="Action and composition for this frame" />'
    const controls = `${marker}<div className="space-y-3 border border-white/10 bg-[#181c21] p-3"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase text-[#23c7be]">Image framing</p><button type="button" onClick={() => updatePanel(selectedPanel, { scale: 1, position_x: 50, position_y: 50 })} className="border border-white/10 bg-[#242930] px-2 py-1 text-[10px] font-black text-white">Reset</button></div><label className="block text-[10px] font-black uppercase text-white/55">Zoom · {Math.round((Number(selected.scale) || 1) * 100)}%<input type="range" min="100" max="300" step="5" value={Math.round((Number(selected.scale) || 1) * 100)} onChange={(e) => updatePanel(selectedPanel, { scale: Number(e.target.value) / 100 })} className="mt-2 w-full accent-[#23c7be]" /></label><label className="block text-[10px] font-black uppercase text-white/55">Horizontal position · {Math.round(Number(selected.position_x ?? 50))}%<input type="range" min="0" max="100" step="1" value={Number(selected.position_x ?? 50)} onChange={(e) => updatePanel(selectedPanel, { position_x: Number(e.target.value) })} className="mt-2 w-full accent-[#23c7be]" /></label><label className="block text-[10px] font-black uppercase text-white/55">Vertical position · {Math.round(Number(selected.position_y ?? 50))}%<input type="range" min="0" max="100" step="1" value={Number(selected.position_y ?? 50)} onChange={(e) => updatePanel(selectedPanel, { position_y: Number(e.target.value) })} className="mt-2 w-full accent-[#23c7be]" /></label><p className="text-[10px] leading-4 text-white/40">Crop the image inside this frame without regenerating it. These values are saved with the frame and used in the final page.</p></div>`
    if (next.includes(marker)) next = next.replace(marker, controls)

    next = next.replace(
      "if (!desktop || classic || !current || current.visual_format !== 'comic') return <div className=\"relative\">{classic && desktop && <button type=\"button\" onClick={() => setClassic(false)} className=\"fixed right-5 top-20 z-[180] border border-[#23c7be] bg-[#23c7be] px-4 py-2 text-xs font-black text-black\">Return to page editor</button>}<LegacyAuthorProductionWorkspace {...props} /></div>;\n  return <ComicPageWorkspace {...props} onClassic={() => setClassic(true)} />;",
      "if (!desktop || !current) return <LegacyAuthorProductionWorkspace {...props} />;\n  return <ComicPageWorkspace {...props} />;"
    )

    next = next.replace(
      "const [showMasterVault, setShowMasterVault] = useState(false); const [showMasterShop, setShowMasterShop] = useState(false); const masterUploadRef = useRef(null);",
      "const [showMasterVault, setShowMasterVault] = useState(false); const [showMasterShop, setShowMasterShop] = useState(false); const masterUploadRef = useRef(null);\n  const [showPreview, setShowPreview] = useState(false); const [showExport, setShowExport] = useState(false); const [showPublish, setShowPublish] = useState(false); const [publishing, setPublishing] = useState(false);"
    )

    next = next.replace(
      "const panelCount = Number(segment.comic_panel_count || 3); const panels = Array.from({ length: panelCount }, (_, index) => ({ id: `panel-${index + 1}`, beat: '', shot: IMAGE_TYPES[Math.min(index, IMAGE_TYPES.length - 1)], prompt: '', image_url: '', source_prompt: '', ...(segment.comic_panels?.[index] || {}) }));",
      "const panelCount = segment.visual_format === 'single' ? 1 : Number(segment.comic_panel_count || 3); const legacySingleImage = segment.text_overlay_source_url || segment.image_url || segment.image_versions?.at?.(-1)?.value || ''; const panels = Array.from({ length: panelCount }, (_, index) => ({ id: `panel-${index + 1}`, beat: '', shot: IMAGE_TYPES[Math.min(index, IMAGE_TYPES.length - 1)], prompt: '', image_url: segment.visual_format === 'single' && index === 0 ? legacySingleImage : '', source_prompt: segment.visual_format === 'single' && index === 0 ? (segment.image_source_instruction || segment.image_instruction || '') : '', ...(segment.comic_panels?.[index] || {}) }));"
    )

    next = next.replace(
      "const generateCurrent = async () => { if (!allLeavesReady) { const missing = panels.findIndex((panel) => !flattenLeaves(panel).every((leaf) => leaf?.image_url)); setSelectedPanel(Math.max(0, missing)); setTool('panel'); return toast.error(`Frame ${missing + 1} still needs an image`); } setBusy('sync'); try { await syncPage(); if (!segment.narration_url || segment.audio_stale || segment.audio_source_text !== segment.narration_text || segment.audio_voice !== segment.narrator_voice) await generateAudio(); setNotice('The current page and audio are synchronized.'); } catch (error) { toast.error(error.message || 'Unable to synchronize the page'); } finally { setBusy(''); } };",
      "const generateCurrent = async () => { if (!allLeavesReady) { const missing = panels.findIndex((panel) => !flattenLeaves(panel).every((leaf) => leaf?.image_url)); setSelectedPanel(Math.max(0, missing)); setTool('panel'); return toast.error(`Frame ${missing + 1} still needs an image`); } setBusy('sync'); try { await syncPage(); if (boxes.length) { if (!segment.narration_url || segment.audio_stale) { setTool('voice'); throw new Error('Generate the ordered audio sequence first'); } } else if (!segment.narration_url || segment.audio_stale || segment.audio_source_text !== segment.narration_text || segment.audio_voice !== segment.narrator_voice) await generateAudio(); setNotice('The current page and audio are synchronized.'); } catch (error) { toast.error(error.message || 'Unable to synchronize the page'); } finally { setBusy(''); } };"
    )
    next = next.replace(
      "const approve = async () => { if (!segment.narrator_voice) return toast.error('Choose a voice first'); if (!allLeavesReady) return toast.error('Every frame needs an image'); setBusy('approve'); try { await syncPage(); if (!segment.narration_url || segment.audio_stale || segment.audio_source_text !== segment.narration_text || segment.audio_voice !== segment.narrator_voice) await generateAudio(); const continuity = { ...(active.appearance_continuity || {}) };",
      "const approve = async () => { if (boxes.length ? !segment.narration_url || segment.audio_stale : !segment.narrator_voice) return toast.error(boxes.length ? 'Generate the ordered audio sequence first' : 'Choose a voice first'); if (!allLeavesReady) return toast.error('Every frame needs an image'); setBusy('approve'); try { await syncPage(); if (!boxes.length && (!segment.narration_url || segment.audio_stale || segment.audio_source_text !== segment.narration_text || segment.audio_voice !== segment.narrator_voice)) await generateAudio(); const continuity = { ...(active.appearance_continuity || {}) };"
    )

    // Give sequence-master actions explicit visual feedback and preserve the
    // selected master at chapter level for following segments.
    next = next.replace(
      "const selectMaster = async (url, source, label) => { if (!url) return; await persist({}, { master_reference_url: url, master_reference_source: source, master_reference_label: label }); setShowMasterVault(false); setShowMasterShop(false); };",
      "const selectMaster = async (url, source, label) => { if (!url) return; await persist({}, { master_reference_url: url, master_reference_source: source, master_reference_label: label }); setShowMasterVault(false); setShowMasterShop(false); setNotice(`Sequence master active: ${label}`); toast.success(`Sequence master selected · ${label}`); };"
    )

    next = next.replace(
      "const createLook = async (character) => {",
      "const createChapterFromEditor = async () => {\n    const chapter = newChapter(project.chapters.length, 'manual', null);\n    chapter.image_aspect_ratio = active?.image_aspect_ratio || '16:9';\n    const panelCountForNewChapter = Number(segment?.comic_panel_count || 1);\n    chapter.segments = chapter.segments.map((item, index) => normalizeSegment({ ...item, visual_format: panelCountForNewChapter === 1 ? 'single' : 'comic', comic_panel_count: panelCountForNewChapter }, index));\n    const nextProject = { ...project, chapters: [...project.chapters, chapter] };\n    setProject(nextProject);\n    setActiveChapterId(chapter.id);\n    setSelectedId(chapter.segments[0].id);\n    setSelectedPanel(0);\n    setTool('panel');\n    try {\n      await onSave(nextProject, { silent: true });\n      toast.success(`Chapter ${chapter.number} created`);\n    } catch (error) { toast.error(error.message || 'Unable to create chapter'); }\n  };\n  const publishProject = async (publication) => {\n    if (!project.id) return toast.error('Save the project before publishing');\n    const readyChapters = project.chapters.filter((chapter) => chapter.segments?.length === 9 && chapter.segments.every((item) => item.status === 'approved' && item.image_url && item.narration_url));\n    if (!readyChapters.length) return toast.error('Complete and approve all 9 segments of at least one chapter first');\n    setPublishing(true);\n    try {\n      const response = await base44.functions.invoke('publishAuthorStory', { project_id: project.id, ...publication });\n      const published = { ...project, status: 'published', published_dossier_id: response.data.dossier_id };\n      setProject(published);\n      setShowPublish(false);\n      await onSave(published, { silent: true });\n      toast.success(response.data.republished ? 'FotoPlay republished' : 'FotoPlay published');\n    } catch (error) { toast.error(error.message || 'Publication failed'); }\n    finally { setPublishing(false); }\n  };\n  const createLook = async (character) => {"
    )

    next = next.replace(
      '<button onClick={onEditSetup} className="border border-black/15 px-3 py-2 text-xs font-black">Story / cast</button><button onClick={onClassic} title="Project preview, export and publishing" className="flex items-center gap-2 border border-black/15 px-3 py-2 text-xs font-black"><Settings2 size={15} /> Project</button><button onClick={() => onSave(project)} disabled={saving} className="flex items-center gap-2 bg-black px-3 py-2 text-xs font-black text-white">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save</button>',
      '<button onClick={onEditSetup} className="border border-black/15 px-3 py-2 text-xs font-black">Story / cast</button><button onClick={() => setShowPreview(true)} className="border border-black/15 px-3 py-2 text-xs font-black">Preview</button><button onClick={() => setShowExport(true)} className="border border-black/15 px-3 py-2 text-xs font-black">Export</button>{project.published_dossier_id && <a href={`/Magazine?dossier=${encodeURIComponent(project.published_dossier_id)}`} target="_blank" rel="noreferrer" className="border border-emerald-600 bg-emerald-600 px-3 py-2 text-xs font-black text-white">Open published</a>}<button onClick={() => setShowPublish(true)} disabled={publishing} className="bg-[#23c7be] px-3 py-2 text-xs font-black text-black">{publishing ? \'Publishing…\' : project.published_dossier_id ? \'Republish\' : \'Publish\'}</button><button onClick={() => onSave(project)} disabled={saving} className="flex items-center gap-2 bg-black px-3 py-2 text-xs font-black text-white">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save</button>'
    )

    next = next.replace(
      '<div className="mb-3 flex gap-2 overflow-x-auto bg-black/5 p-2">{project.chapters.map((chapter) => <button key={chapter.id} onClick={() => setActiveChapterId(chapter.id)} className={`shrink-0 border px-3 py-2 text-xs font-black ${chapter.id === activeChapterId ? \'border-black bg-black text-white\' : \'border-black/10 bg-white\'}`}>Chapter {chapter.number}</button>)}</div>',
      '<div className="mb-3 flex gap-2 overflow-x-auto bg-black/5 p-2">{project.chapters.map((chapter) => <button key={chapter.id} onClick={() => setActiveChapterId(chapter.id)} className={`shrink-0 border px-3 py-2 text-xs font-black ${chapter.id === activeChapterId ? \'border-black bg-black text-white\' : \'border-black/10 bg-white\'}`}>Chapter {chapter.number}</button>)}<button type="button" onClick={createChapterFromEditor} className="shrink-0 border border-[#23c7be] bg-[#23c7be] px-3 py-2 text-xs font-black text-black">+ New chapter</button></div>'
    )

    next = next.replace(
      "{[2,3,4].map((count) => <option key={count} className=\"text-black\" value={count}>{count}</option>)}",
      "{[1,2,3,4].map((count) => <option key={count} className=\"text-black\" value={count}>{count}</option>)}"
    )

    next = next.replace(
      "onChange={(event) => change({ comic_panel_count: Number(event.target.value), comic_page_source: '' })}",
      "onChange={(event) => { const count = Number(event.target.value); change({ visual_format: count === 1 ? 'single' : 'comic', comic_panel_count: count, comic_panels: count === 1 && !segment.comic_panels?.length ? [{ id: 'panel-1', beat: '', shot: segment.image_type || 'Wide shot', prompt: segment.image_source_instruction || segment.image_instruction || '', image_url: segment.text_overlay_source_url || segment.image_url || '', source_prompt: segment.image_source_instruction || '' }] : segment.comic_panels, comic_page_source: '' }); }}"
    )

    // Speaker is chosen while editing the text block; Voice & Audio then inherits
    // the permanent voice assigned to that character in Story / cast.
    next = next.replace(
      "{box.type === 'dialogue' && <div className=\"space-y-3 border-t border-white/10 pt-3\"><div><p className=\"mb-2 text-[10px] font-black uppercase text-white/50\">Pointer side</p>",
      "{box.type === 'dialogue' && <div className=\"space-y-3 border-t border-white/10 pt-3\"><label className=\"block text-[10px] font-black uppercase text-white/50\">Character / speaker<select value={box.speaker_id || ''} onChange={(e) => updateTextBox(box.id, { speaker_id: e.target.value, voice: '' })} className={`${dark} mt-1`}><option className=\"text-black\" value=\"\">Choose character</option>{project.characters.map((character) => <option key={character.id} value={character.id} className=\"text-black\">{character.name}{character.voice ? ` · ${character.voice}` : ' · no voice assigned'}</option>)}</select></label>{box.speaker_id && <p className=\"text-[10px] font-semibold text-[#23c7be]\">Voice inherited: {project.characters.find((character) => character.id === box.speaker_id)?.voice || 'No character voice assigned yet'}</p>}<div><p className=\"mb-2 text-[10px] font-black uppercase text-white/50\">Pointer side</p>"
    )

    // Show which sequence master is active directly in the selected-frame tool,
    // including clear/replace controls instead of making the user guess.
    next = next.replace(
      "{tool === 'panel' && selected && <><div className=\"flex items-center justify-between\"><p className=\"font-black text-[#23c7be]\">Frame {selectedPanel + 1}</p>",
      "{tool === 'panel' && selected && <>{active.master_reference_url && <div className=\"flex items-center gap-3 border border-[#23c7be]/50 bg-[#23c7be]/10 p-3\"><img src={active.master_reference_url} alt=\"Sequence master\" className=\"h-14 w-14 shrink-0 object-cover\" /><div className=\"min-w-0 flex-1\"><p className=\"text-[10px] font-black uppercase tracking-[.14em] text-[#23c7be]\">Sequence master active</p><p className=\"truncate text-xs font-bold text-white\">{active.master_reference_label || 'Current chapter master'}</p></div><button type=\"button\" onClick={() => persist({}, { master_reference_url: '', master_reference_source: '', master_reference_label: '' }).then(() => { setNotice('Sequence master cleared.'); toast.success('Sequence master cleared'); })} className=\"border border-white/10 bg-[#242930] px-2 py-1 text-[10px] font-black text-white\">Clear</button></div>}<div className=\"flex items-center justify-between\"><p className=\"font-black text-[#23c7be]\">Frame {selectedPanel + 1}</p>"
    )

    next = next.replace(
      "{selected.image_url && <button onClick={() => selectMaster(selected.image_url, 'panel', `Segment ${segment.number} · frame ${selectedPanel + 1}`)} className={`${action} w-full bg-[#1b1f24]`}>Use selected frame as sequence master</button>}",
      "{selected.image_url && <button onClick={() => selectMaster(selected.image_url, 'panel', `Segment ${segment.number} · frame ${selectedPanel + 1}`)} className={`${action} w-full ${active.master_reference_url === selected.image_url ? 'border-[#23c7be] bg-[#23c7be]/15 text-[#23c7be]' : 'bg-[#1b1f24]'}`}>{active.master_reference_url === selected.image_url ? '✓ Sequence master selected' : active.master_reference_url ? 'Replace sequence master with this frame' : 'Use selected frame as sequence master'}</button>}"
    )

    // New ordered, multi-voice audio panel. Narration/dialogue boxes define the
    // reading order, per-line speaker/voice, pauses and synchronized playback.
    next = next.replace(
      "{tool === 'voice' && <><VoicePicker value={segment.narrator_voice || ''} onChange={(value) => change({ narrator_voice: value, audio_stale: Boolean(segment.narration_url) })} language={segment.narrator_language || project.production_settings?.narrator_language || 'en'} onLanguageChange={(value) => change({ narrator_language: value, audio_stale: Boolean(segment.narration_url) })} disabled={Boolean(busy)} />{segment.narration_url && <audio controls src={segment.narration_url} className=\"w-full\" />}<button onClick={generateAudio} disabled={busy === 'audio'} className={`${action} w-full bg-[#23c7be] text-black`}><Volume2 size={14} /> {segment.narration_url ? 'Regenerate' : 'Generate'} audio · {pricing.tts ?? '—'}</button></>}",
      "{tool === 'voice' && <FotoPlayAudioPanel boxes={boxes} characters={project.characters} segment={segment} project={project} pricing={pricing} busy={busy} setBusy={setBusy} onBoxesChange={(nextBoxes) => change({ text_boxes: nextBoxes, audio_stale: true, status: 'draft' })} onPersist={persist} />}"
    )

    next = next.replace(
      '{showMasterVault && <VaultPickerModal',
      '{showPreview && <FotoPlayPreviewModal project={project} activeChapterId={activeChapterId} onClose={() => setShowPreview(false)} />}\n    {showExport && <FotoPlayExportModal project={project} activeChapterId={activeChapterId} onClose={() => setShowExport(false)} />}\n    {showPublish && <FotoPlayPublishModal user={user} project={project} publishing={publishing} onClose={() => setShowPublish(false)} onPublish={publishProject} />}\n    {showMasterVault && <VaultPickerModal'
    )

    return next === code ? null : { code: next, map: null }
  },
}

export default defineConfig({
  logLevel: 'error',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    fotoPlayPageWorkspace,
    react(),
  ]
});
