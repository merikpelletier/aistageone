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

    // Project-level preview/export/publish now live in the page editor itself.
    next = next.replace(
      "import StoryImageFileActions from './StoryImageFileActions';",
      "import StoryImageFileActions from './StoryImageFileActions';\nimport { FotoPlayPreviewModal, FotoPlayExportModal, FotoPlayPublishModal } from './FotoPlayProjectActions';"
    )

    // Persisted per-frame crop zoom is respected by the exported comic page.
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

    // Live page preview uses the same framing values.
    next = next.replace(
      'style={{ objectPosition: `${panel.position_x ?? 50}% ${panel.position_y ?? 50}%` }}',
      'style={{ objectPosition: `${panel.position_x ?? 50}% ${panel.position_y ?? 50}%`, transform: `scale(${Math.max(1, Number(panel.scale) || 1)})`, transformOrigin: `${panel.position_x ?? 50}% ${panel.position_y ?? 50}%` }}'
    )

    // Add image framing controls directly to the selected-frame tool.
    const marker = '<textarea value={selected.prompt || \'\'} onChange={(e) => updatePanel(selectedPanel, { prompt: e.target.value })} rows={8} className={dark} placeholder="Action and composition for this frame" />'
    const controls = `${marker}<div className="space-y-3 border border-white/10 bg-[#181c21] p-3"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase text-[#23c7be]">Image framing</p><button type="button" onClick={() => updatePanel(selectedPanel, { scale: 1, position_x: 50, position_y: 50 })} className="border border-white/10 bg-[#242930] px-2 py-1 text-[10px] font-black text-white">Reset</button></div><label className="block text-[10px] font-black uppercase text-white/55">Zoom · {Math.round((Number(selected.scale) || 1) * 100)}%<input type="range" min="100" max="300" step="5" value={Math.round((Number(selected.scale) || 1) * 100)} onChange={(e) => updatePanel(selectedPanel, { scale: Number(e.target.value) / 100 })} className="mt-2 w-full accent-[#23c7be]" /></label><label className="block text-[10px] font-black uppercase text-white/55">Horizontal position · {Math.round(Number(selected.position_x ?? 50))}%<input type="range" min="0" max="100" step="1" value={Number(selected.position_x ?? 50)} onChange={(e) => updatePanel(selectedPanel, { position_x: Number(e.target.value) })} className="mt-2 w-full accent-[#23c7be]" /></label><label className="block text-[10px] font-black uppercase text-white/55">Vertical position · {Math.round(Number(selected.position_y ?? 50))}%<input type="range" min="0" max="100" step="1" value={Number(selected.position_y ?? 50)} onChange={(e) => updatePanel(selectedPanel, { position_y: Number(e.target.value) })} className="mt-2 w-full accent-[#23c7be]" /></label><p className="text-[10px] leading-4 text-white/40">Crop the image inside this frame without regenerating it. These values are saved with the frame and used in the final page.</p></div>`
    if (next.includes(marker)) next = next.replace(marker, controls)

    // Remove the old desktop "Project" route back to the legacy production form.
    next = next.replace(
      "if (!desktop || classic || !current || current.visual_format !== 'comic') return <div className=\"relative\">{classic && desktop && <button type=\"button\" onClick={() => setClassic(false)} className=\"fixed right-5 top-20 z-[180] border border-[#23c7be] bg-[#23c7be] px-4 py-2 text-xs font-black text-black\">Return to page editor</button>}<LegacyAuthorProductionWorkspace {...props} /></div>;\n  return <ComicPageWorkspace {...props} onClassic={() => setClassic(true)} />;",
      "if (!desktop || !current || current.visual_format !== 'comic') return <LegacyAuthorProductionWorkspace {...props} />;\n  return <ComicPageWorkspace {...props} />;"
    )

    // Add project actions state to the editor.
    next = next.replace(
      "const [showMasterVault, setShowMasterVault] = useState(false); const [showMasterShop, setShowMasterShop] = useState(false); const masterUploadRef = useRef(null);",
      "const [showMasterVault, setShowMasterVault] = useState(false); const [showMasterShop, setShowMasterShop] = useState(false); const masterUploadRef = useRef(null);\n  const [showPreview, setShowPreview] = useState(false); const [showExport, setShowExport] = useState(false); const [showPublish, setShowPublish] = useState(false); const [publishing, setPublishing] = useState(false);"
    )

    // Publication uses the same server function as the previous workspace, but
    // is initiated from the actual editor rather than a redundant screen.
    next = next.replace(
      "const createLook = async (character) => {",
      "const publishProject = async (publication) => {\n    if (!project.id) return toast.error('Save the project before publishing');\n    const readyChapters = project.chapters.filter((chapter) => chapter.segments?.length === 9 && chapter.segments.every((item) => item.status === 'approved' && item.image_url && item.narration_url));\n    if (!readyChapters.length) return toast.error('Complete and approve all 9 segments of at least one chapter first');\n    setPublishing(true);\n    try {\n      const response = await base44.functions.invoke('publishAuthorStory', { project_id: project.id, ...publication });\n      const published = { ...project, status: 'published', published_dossier_id: response.data.dossier_id };\n      setProject(published);\n      setShowPublish(false);\n      await onSave(published, { silent: true });\n      toast.success(response.data.republished ? 'FotoPlay republished' : 'FotoPlay published');\n    } catch (error) { toast.error(error.message || 'Publication failed'); }\n    finally { setPublishing(false); }\n  };\n  const createLook = async (character) => {"
    )

    // Replace the legacy project/setup controls with preview/export/publish in
    // the editor header. There is no route back to the redundant production form.
    next = next.replace(
      '<button onClick={onEditSetup} className="border border-black/15 px-3 py-2 text-xs font-black">Story / cast</button><button onClick={onClassic} title="Project preview, export and publishing" className="flex items-center gap-2 border border-black/15 px-3 py-2 text-xs font-black"><Settings2 size={15} /> Project</button><button onClick={() => onSave(project)} disabled={saving} className="flex items-center gap-2 bg-black px-3 py-2 text-xs font-black text-white">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save</button>',
      '<button onClick={() => setShowPreview(true)} className="border border-black/15 px-3 py-2 text-xs font-black">Preview</button><button onClick={() => setShowExport(true)} className="border border-black/15 px-3 py-2 text-xs font-black">Export</button>{project.published_dossier_id && <a href={`/Magazine?dossier=${encodeURIComponent(project.published_dossier_id)}`} target="_blank" rel="noreferrer" className="border border-emerald-600 bg-emerald-600 px-3 py-2 text-xs font-black text-white">Open published</a>}<button onClick={() => setShowPublish(true)} disabled={publishing} className="bg-[#23c7be] px-3 py-2 text-xs font-black text-black">{publishing ? \'Publishing…\' : project.published_dossier_id ? \'Republish\' : \'Publish\'}</button><button onClick={() => onSave(project)} disabled={saving} className="flex items-center gap-2 bg-black px-3 py-2 text-xs font-black text-white">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save</button>'
    )

    // Project actions render in the same editor surface.
    next = next.replace(
      '{showMasterVault && <VaultPickerModal',
      '{showPreview && <FotoPlayPreviewModal project={project} activeChapterId={activeChapterId} onClose={() => setShowPreview(false)} />}\n    {showExport && <FotoPlayExportModal project={project} activeChapterId={activeChapterId} onClose={() => setShowExport(false)} />}\n    {showPublish && <FotoPlayPublishModal user={user} project={project} publishing={publishing} onClose={() => setShowPublish(false)} onPublish={publishProject} />}\n    {showMasterVault && <VaultPickerModal'
    )

    return next === code ? null : { code: next, map: null }
  },
}

// https://vite.dev/config/
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
