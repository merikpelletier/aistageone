import baseConfig from './vite.config.js'
import { defineConfig } from 'vite'

const preserveFotoPlayTextMetadata = {
  name: 'preserve-fotoplay-text-metadata',
  enforce: 'pre',
  transform(code, id) {
    const normalizedId = id?.replace(/\\/g, '/') || ''
    if (!normalizedId.endsWith('/src/components/studio/AuthorProductionWorkspacePage.jsx')) return null

    const marker = "const normalizedTextBoxes = (boxes) => (Array.isArray(boxes) ? boxes : []).map((box) => ({\n  id:"
    if (!code.includes(marker)) return null

    const next = code.replace(
      marker,
      "const normalizedTextBoxes = (boxes) => (Array.isArray(boxes) ? boxes : []).map((box) => ({\n  ...box,\n  id:"
    )
    return { code: next, map: null }
  },
}

export default defineConfig({
  ...baseConfig,
  plugins: [preserveFotoPlayTextMetadata, ...(baseConfig.plugins || [])],
})
