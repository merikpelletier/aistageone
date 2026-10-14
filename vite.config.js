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
