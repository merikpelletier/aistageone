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
