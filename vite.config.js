import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// Temporary branch wiring for the page-centric FotoPlay workspace. The redirect
// is deliberately importer-scoped so the new workspace can still call the
// existing editor as its mobile/classic fallback without creating a module loop.
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

    return next === code ? null : { code: next, map: null }
  },
}

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
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
