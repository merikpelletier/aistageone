import fotoPlayConfig from './vite.fotoplay.config.js'
import { defineConfig } from 'vite'

const noLegacyFotoPlayFallback = {
  name: 'fotoplay-no-legacy-fallback',
  enforce: 'post',
  transform(code, id) {
    const normalizedId = id?.replace(/\\/g, '/') || ''
    if (!normalizedId.endsWith('/src/components/studio/AuthorProductionWorkspacePage.jsx')) return null

    let next = code

    next = next.replace(
      "if (!desktop || !current) return <LegacyAuthorProductionWorkspace {...props} />;\n  return <ComicPageWorkspace {...props} />;",
      "if (!current) return <div className=\"min-h-[70vh] bg-[#202328] text-white flex items-center justify-center px-6\"><div className=\"text-center\"><p className=\"text-xs font-black uppercase tracking-[.18em] text-[#23c7be]\">FotoPlay</p><p className=\"mt-2 text-sm font-semibold text-white/60\">Select a project to open the modern workspace.</p></div></div>;\n  return <ComicPageWorkspace {...props} />;"
    )

    next = next.replace(
      "if (!desktop || classic || !current || current.visual_format !== 'comic') return <div className=\"relative\">{classic && desktop && <button type=\"button\" onClick={() => setClassic(false)} className=\"fixed right-5 top-20 z-[180] border border-[#23c7be] bg-[#23c7be] px-4 py-2 text-xs font-black text-black\">Return to page editor</button>}<LegacyAuthorProductionWorkspace {...props} /></div>;\n  return <ComicPageWorkspace {...props} onClassic={() => setClassic(true)} />;",
      "if (!current) return <div className=\"min-h-[70vh] bg-[#202328] text-white flex items-center justify-center px-6\"><div className=\"text-center\"><p className=\"text-xs font-black uppercase tracking-[.18em] text-[#23c7be]\">FotoPlay</p><p className=\"mt-2 text-sm font-semibold text-white/60\">Select a project to open the modern workspace.</p></div></div>;\n  return <ComicPageWorkspace {...props} />;"
    )

    next = next.replace(
      "const createChapterFromEditor = async () => {",
      "const deleteChapterFromEditor = async (chapterId) => { if (project.chapters.length <= 1) return toast.error('A project must keep at least one chapter'); const chapter = project.chapters.find((item) => item.id === chapterId); if (!chapter || !window.confirm(`Delete Chapter ${chapter.number}? This cannot be undone.`)) return; const chapters = project.chapters.filter((item) => item.id !== chapterId).map((item, index) => ({ ...item, number: index + 1 })); const nextActiveId = activeChapterId === chapterId ? (chapters[0]?.id || null) : activeChapterId; const nextProject = { ...project, chapters }; setProject(nextProject); setActiveChapterId(nextActiveId); try { await onSave(nextProject, { silent: true }); toast.success('Chapter deleted'); } catch (error) { toast.error(error.message || 'Unable to delete chapter'); } };\n  const createChapterFromEditor = async () => {"
    )

    next = next.replace(
      "{project.chapters.map((chapter) => <button key={chapter.id} onClick={() => setActiveChapterId(chapter.id)} className={`shrink-0 border px-3 py-2 text-xs font-black ${chapter.id === activeChapterId ? 'border-black bg-black text-white' : 'border-black/10 bg-white'}`}>Chapter {chapter.number}</button>)}<button type=\"button\" onClick={createChapterFromEditor} className=\"shrink-0 border border-[#23c7be] bg-[#23c7be] px-3 py-2 text-xs font-black text-black\">+ New chapter</button>",
      "{project.chapters.map((chapter) => <div key={chapter.id} className={`shrink-0 flex items-stretch border ${chapter.id === activeChapterId ? 'border-black bg-black' : 'border-black/15 bg-white'}`}><button type=\"button\" onClick={() => setActiveChapterId(chapter.id)} className={`px-4 py-2 text-xs font-black ${chapter.id === activeChapterId ? 'text-white' : 'text-black'}`}>Chapter {chapter.number}</button>{project.chapters.length > 1 && <button type=\"button\" onClick={() => deleteChapterFromEditor(chapter.id)} aria-label={`Delete Chapter ${chapter.number}`} title={`Delete Chapter ${chapter.number}`} className={`border-l px-2.5 text-sm font-black ${chapter.id === activeChapterId ? 'border-white/20 text-white/70 hover:text-red-300' : 'border-black/15 text-black/55 hover:bg-red-50 hover:text-red-700'}`}>×</button>}</div>)}<button type=\"button\" onClick={createChapterFromEditor} className=\"shrink-0 border border-[#23c7be] bg-[#23c7be] px-4 py-2 text-xs font-black text-black\">+ New chapter</button>"
    )

    if (next.includes('<LegacyAuthorProductionWorkspace')) {
      throw new Error('FotoPlay build blocked: a legacy workspace fallback is still reachable.')
    }

    return next === code ? null : { code: next, map: null }
  },
}

export default defineConfig({
  ...fotoPlayConfig,
  plugins: [...(fotoPlayConfig.plugins || []), noLegacyFotoPlayFallback],
})
