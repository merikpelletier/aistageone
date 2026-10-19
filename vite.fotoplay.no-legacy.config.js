import fotoPlayConfig from './vite.fotoplay.config.js'
import { defineConfig } from 'vite'

const noLegacyFotoPlayFallback = {
  name: 'fotoplay-no-legacy-fallback',
  enforce: 'pre',
  transform(code, id) {
    const normalizedId = id?.replace(/\\/g, '/') || ''

    if (normalizedId.endsWith('/src/pages/Studio.jsx')) {
      const next = code.replace(
        "const closeAllStudioTools = () => {\n    setActiveToolPanel(null);",
        "const closeAllStudioTools = () => {\n    setActiveTab(null);\n    setActiveToolPanel(null);"
      )
      if (next === code) throw new Error('Studio exclusivity guard was not applied.')
      return { code: next, map: null }
    }

    if (normalizedId.endsWith('/src/components/studio/AuthorStoryBlocks.jsx')) {
      const next = code.replace(
        "saving={saving} onBack={() => setView(project.id ? 'workspace' : 'dashboard')} onSave={(foundationComplete) => saveProject(foundationComplete ? 'workspace' : 'setup')}",
        "saving={saving} onBack={() => setView(project.id ? 'workspace' : 'dashboard')} onSave={() => saveProject('workspace')}"
      )
      if (next === code) throw new Error('FotoPlay setup-to-editor handoff was not applied.')
      return { code: next, map: null }
    }

    if (!normalizedId.endsWith('/src/components/studio/AuthorProductionWorkspacePage.jsx')) return null

    let next = code

    next = next.replace(
      "if (!desktop || !current) return <LegacyAuthorProductionWorkspace {...props} />;\n  return <ComicPageWorkspace {...props} />;",
      "if (!current) return <LegacyAuthorProductionWorkspace {...props} />;\n  return <ComicPageWorkspace {...props} />;"
    )

    next = next.replace(
      "if (!desktop || classic || !current || current.visual_format !== 'comic') return <div className=\"relative\">{classic && desktop && <button type=\"button\" onClick={() => setClassic(false)} className=\"fixed right-5 top-20 z-[180] border border-[#23c7be] bg-[#23c7be] px-4 py-2 text-xs font-black text-black\">Return to page editor</button>}<LegacyAuthorProductionWorkspace {...props} /></div>;\n  return <ComicPageWorkspace {...props} onClassic={() => setClassic(true)} />;",
      "if (!current) return <LegacyAuthorProductionWorkspace {...props} />;\n  return <ComicPageWorkspace {...props} />;"
    )

    next = next.replace(
      "  if (!current) return <div className=\"min-h-[70vh] bg-[#202328] text-white flex items-center justify-center px-6\"><div className=\"text-center\"><p className=\"text-xs font-black uppercase tracking-[.18em] text-[#23c7be]\">FotoPlay</p><p className=\"mt-2 text-sm font-semibold text-white/60\">Select a project to open the current workspace.</p></div></div>;\n  return <ComicPageWorkspace {...props} onClassic={() => {}} />;",
      "  const createFirstChapter = async () => { const chapter = newChapter(0, 'manual', null); const nextProject = { ...project, chapters: [chapter] }; props.setProject(nextProject); props.setActiveChapterId(chapter.id); await props.onSave(nextProject, { silent: true }); };\n  if (!current) return <div className=\"mx-auto w-full max-w-[1900px] px-3 pb-6 lg:px-4\"><header className=\"mb-3 flex items-center gap-3 border-b border-black/10 bg-white px-2 py-2 text-black\"><button onClick={props.onBack} className=\"flex h-10 w-10 items-center justify-center bg-black text-white\"><ArrowLeft size={18} /></button><div className=\"min-w-0 flex-1\"><p className=\"text-[10px] font-black uppercase tracking-[.16em] text-black/45\">FotoPlay page editor</p><h2 className=\"truncate text-lg font-black\">{project.title || 'New FotoPlay'}</h2></div><button onClick={props.onEditSetup} className=\"border border-black/15 px-3 py-2 text-xs font-black\">Story / cast</button></header><div className=\"flex min-h-[70vh] items-center justify-center border border-white/10 bg-[#0d1013] px-6 text-white\"><div className=\"max-w-lg text-center\"><p className=\"text-xs font-black uppercase tracking-[.18em] text-[#23c7be]\">New FotoPlay</p><h3 className=\"mt-2 text-2xl font-black\">Start the first chapter</h3><p className=\"mt-3 text-sm font-semibold text-white/55\">Your project is saved and connected to the page editor.</p><button type=\"button\" onClick={createFirstChapter} className=\"mt-6 bg-[#23c7be] px-5 py-3 text-sm font-black text-black\">Create first chapter</button></div></div></div>;\n  return <ComicPageWorkspace {...props} onClassic={() => {}} />;"
    )

    next = next.replace(
      "const createChapterFromEditor = async () => {",
      "const deleteChapterFromEditor = async (chapterId) => { if (project.chapters.length <= 1) return toast.error('A project must keep at least one chapter'); const chapter = project.chapters.find((item) => item.id === chapterId); if (!chapter || !window.confirm(`Delete Chapter ${chapter.number}? This cannot be undone.`)) return; const chapters = project.chapters.filter((item) => item.id !== chapterId).map((item, index) => ({ ...item, number: index + 1 })); const nextActiveId = activeChapterId === chapterId ? (chapters[0]?.id || null) : activeChapterId; const nextProject = { ...project, chapters }; setProject(nextProject); setActiveChapterId(nextActiveId); try { await onSave(nextProject, { silent: true }); toast.success('Chapter deleted'); } catch (error) { toast.error(error.message || 'Unable to delete chapter'); } };\n  const createChapterFromEditor = async () => {"
    )

    next = next.replace(
      "{project.chapters.map((chapter) => <button key={chapter.id} onClick={() => setActiveChapterId(chapter.id)} className={`shrink-0 border px-3 py-2 text-xs font-black ${chapter.id === activeChapterId ? 'border-black bg-black text-white' : 'border-black/10 bg-white'}`}>Chapter {chapter.number}</button>)}<button type=\"button\" onClick={createChapterFromEditor} className=\"shrink-0 border border-[#23c7be] bg-[#23c7be] px-3 py-2 text-xs font-black text-black\">+ New chapter</button>",
      "{project.chapters.map((chapter) => <div key={chapter.id} className={`shrink-0 flex items-stretch border ${chapter.id === activeChapterId ? 'border-black bg-black' : 'border-black/15 bg-white'}`}><button type=\"button\" onClick={() => setActiveChapterId(chapter.id)} className={`px-4 py-2 text-xs font-black ${chapter.id === activeChapterId ? 'text-white' : 'text-black'}`}>Chapter {chapter.number}</button>{project.chapters.length > 1 && <button type=\"button\" onClick={() => deleteChapterFromEditor(chapter.id)} aria-label={`Delete Chapter ${chapter.number}`} title={`Delete Chapter ${chapter.number}`} className={`border-l px-2.5 text-sm font-black ${chapter.id === activeChapterId ? 'border-white/20 text-white/70 hover:text-red-300' : 'border-black/15 text-black/55 hover:bg-red-50 hover:text-red-700'}`}>×</button>}</div>)}<button type=\"button\" onClick={createChapterFromEditor} className=\"shrink-0 border border-[#23c7be] bg-[#23c7be] px-4 py-2 text-xs font-black text-black\">+ New chapter</button>"
    )

    return next === code ? null : { code: next, map: null }
  },
}

export default defineConfig({
  ...fotoPlayConfig,
  plugins: [...(fotoPlayConfig.plugins || []), noLegacyFotoPlayFallback],
})
