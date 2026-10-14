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
    if (!normalizedId.endsWith('/src/components/studio/AuthorProductionWorkspacePage.jsx')) return null

    let next = code

    next = next.replace(
      "import StoryImageFileActions from './StoryImageFileActions';",
      "import StoryImageFileActions from './StoryImageFileActions';\nimport { FotoPlayPreviewModal, FotoPlayExportModal, FotoPlayPublishModal } from './FotoPlayProjectActions';"
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

    // Text/dialogue box resizing: the former 18% x 8% minimum made the resize
    // handle appear to freeze. Keep the same page bounds, but allow much finer
    // resizing so the handle follows the pointer instead of hitting a large clamp.
    next = next.replace(
      "width: Math.max(18, Math.min(100 - state.box.x, state.box.width + dx)), height: Math.max(8, Math.min(100 - state.box.y, state.box.height + dy))",
      "width: Math.max(6, Math.min(100 - state.box.x, state.box.width + dx)), height: Math.max(4, Math.min(100 - state.box.y, state.box.height + dy))"
    )

    const marker = '<textarea value={selected.prompt || \'\'} onChange={(e) => updatePanel(selectedPanel, { prompt: e.target.value })} rows={8} className={dark} placeholder="Action and composition for this frame" />'
    const controls = `${marker}<div className="space-y-3 border border-white/10 bg-[#181c21] p-3"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase text-[#23c7be]">Image framing</p><button type="button" onClick={() => updatePanel(selectedPanel, { scale: 1, position_x: 50, position_y: 50 })} className="border border-white/10 bg-[#242930] px-2 py-1 text-[10px] font-black text-white">Reset</button></div><label className="block text-[10px] font-black uppercase text-white/55">Zoom · {Math.round((Number(selected.scale) || 1) * 100)}%<input type="range" min="100" max="300" step="5" value={Math.round((Number(selected.scale) || 1) * 100)} onChange={(e) => updatePanel(selectedPanel, { scale: Number(e.target.value) / 100 })} className="mt-2 w-full accent-[#23c7be]" /></label><label className="block text-[10px] font-black uppercase text-white/55">Horizontal position · {Math.round(Number(selected.position_x ?? 50))}%<input type="range" min="0" max="100" step="1" value={Number(selected.position_x ?? 50)} onChange={(e) => updatePanel(selectedPanel, { position_x: Number(e.target.value) })} className="mt-2 w-full accent-[#23c7be]" /></label><label className="block text-[10px] font-black uppercase text-white/55">Vertical position · {Math.round(Number(selected.position_y ?? 50))}%<input type="range" min="0" max="100" step="1" value={Number(selected.position_y ?? 50)} onChange={(e) => updatePanel(selectedPanel, { position_y: Number(e.target.value) })} className="mt-2 w-full accent-[#23c7be]" /></label><p className="text-[10px] leading-4 text-white/40">Crop the image inside this frame without regenerating it. These values are saved with the frame and used in the final page.</p></div>`
    if (next.includes(marker)) next = next.replace(marker, controls)

    next = next.replace(
      "if (!desktop || classic || !current || current.visual_format !== 'comic') return <div className=\"relative\">{classic && desktop && <button type=\"button\" onClick={() => setClassic(false)} className=\"fixed right-5 top-20 z-[180] border border-[#23c7be] bg-[#23c7be] px-4 py-2 text-xs font-black text-black\">Return to page editor</button>}<LegacyAuthorProductionWorkspace {...props} /></div>;\n  return <ComicPageWorkspace {...props} onClassic={() => setClassic(true)} />;",
      "if (!desktop || !current || current.visual_format !== 'comic') return <LegacyAuthorProductionWorkspace {...props} />;\n  return <ComicPageWorkspace {...props} />;"
    )

    next = next.replace(
      "const [showMasterVault, setShowMasterVault] = useState(false); const [showMasterShop, setShowMasterShop] = useState(false); const masterUploadRef = useRef(null);",
      "const [showMasterVault, setShowMasterVault] = useState(false); const [showMasterShop, setShowMasterShop] = useState(false); const masterUploadRef = useRef(null);\n  const [showPreview, setShowPreview] = useState(false); const [showExport, setShowExport] = useState(false); const [showPublish, setShowPublish] = useState(false); const [publishing, setPublishing] = useState(false);"
    )

    next = next.replace(
      "const createLook = async (character) => {",
      "const createChapterFromEditor = async () => {\n    const chapter = newChapter(project.chapters.length, 'manual', null);\n    chapter.image_aspect_ratio = active?.image_aspect_ratio || '16:9';\n    const panelCountForNewChapter = Number(segment?.comic_panel_count || 3);\n    chapter.segments = chapter.segments.map((item, index) => normalizeSegment({ ...item, visual_format: 'comic', comic_panel_count: panelCountForNewChapter }, index));\n    const nextProject = { ...project, chapters: [...project.chapters, chapter] };\n    setProject(nextProject);\n    setActiveChapterId(chapter.id);\n    setSelectedId(chapter.segments[0].id);\n    setSelectedPanel(0);\n    setTool('panel');\n    try {\n      await onSave(nextProject, { silent: true });\n      toast.success(`Chapter ${chapter.number} created`);\n    } catch (error) { toast.error(error.message || 'Unable to create chapter'); }\n  };\n  const publishProject = async (publication) => {\n    if (!project.id) return toast.error('Save the project before publishing');\n    const readyChapters = project.chapters.filter((chapter) => chapter.segments?.length === 9 && chapter.segments.every((item) => item.status === 'approved' && item.image_url && item.narration_url));\n    if (!readyChapters.length) return toast.error('Complete and approve all 9 segments of at least one chapter first');\n    setPublishing(true);\n    try {\n      const response = await base44.functions.invoke('publishAuthorStory', { project_id: project.id, ...publication });\n      const published = { ...project, status: 'published', published_dossier_id: response.data.dossier_id };\n      setProject(published);\n      setShowPublish(false);\n      await onSave(published, { silent: true });\n      toast.success(response.data.republished ? 'FotoPlay republished' : 'FotoPlay published');\n    } catch (error) { toast.error(error.message || 'Publication failed'); }\n    finally { setPublishing(false); }\n  };\n  const createLook = async (character) => {"
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
