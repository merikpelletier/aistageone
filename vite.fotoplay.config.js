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

const narratorVoiceInTextTool = {
  name: 'fotoplay-narrator-voice-in-text-tool',
  enforce: 'pre',
  transform(code, id) {
    const normalizedId = id?.replace(/\\/g, '/') || ''
    if (!normalizedId.endsWith('/src/components/studio/AuthorProductionWorkspacePage.jsx')) return null
    let next = code

    if (!next.includes("import { VOICE_NAMES } from '@/lib/voiceCatalog';")) {
      next = next.replace(
        "import FotoPlayAudioPanel from './FotoPlayAudioPanel';",
        "import FotoPlayAudioPanel from './FotoPlayAudioPanel';\nimport { VOICE_NAMES } from '@/lib/voiceCatalog';"
      )
    }

    next = next.replace(
      "const deleteTextBox = (id) => change({ text_boxes: boxes.filter((box) => box.id !== id) });",
      "const deleteTextBox = (id) => change({ text_boxes: boxes.filter((box) => box.id !== id) });\n  const setNarratorVoice = async (voice) => { const nextProject = { ...project, production_settings: { ...(project.production_settings || {}), narrator_voice: voice }, chapters: project.chapters.map((chapter) => chapter.id === activeChapterId ? { ...chapter, segments: chapter.segments.map((item, index) => item.id === segment.id ? normalizeSegment({ ...item, narrator_voice: voice, audio_stale: Boolean(item.narration_url), status: 'draft' }, index) : item) } : chapter) }; setProject(nextProject); try { await onSave(nextProject, { silent: true }); } catch (error) { toast.error(error.message || 'Unable to save narrator voice'); } };"
    )

    next = next.replace(
      "<label className=\"block text-[10px] font-black uppercase text-white/50\">Text size · {box.font_size}<input type=\"range\" min=\"16\" max=\"50\" value={box.font_size} onChange={(e) => updateTextBox(box.id, { font_size: Number(e.target.value) })} className=\"mt-2 w-full accent-[#23c7be]\" /></label>{box.type === 'dialogue'",
      "<label className=\"block text-[10px] font-black uppercase text-white/50\">Text size · {box.font_size}<input type=\"range\" min=\"16\" max=\"50\" value={box.font_size} onChange={(e) => updateTextBox(box.id, { font_size: Number(e.target.value) })} className=\"mt-2 w-full accent-[#23c7be]\" /></label>{box.type === 'narration' && <div className=\"space-y-2 border-t border-white/10 pt-3\"><label className=\"block text-[10px] font-black uppercase text-white/50\">Narrator voice<select value={segment.narrator_voice || project.production_settings?.narrator_voice || ''} onChange={(e) => setNarratorVoice(e.target.value)} className={`${dark} mt-1`}><option value=\"\" className=\"text-black\">Choose narrator voice</option>{VOICE_NAMES.map((voice) => <option key={voice} value={voice} className=\"text-black\">{voice}</option>)}</select></label><div className=\"flex items-center justify-between gap-2\"><p className=\"text-[10px] font-semibold text-[#23c7be]\">Inherited by every narration block</p><button type=\"button\" disabled={!(segment.narrator_voice || project.production_settings?.narrator_voice)} onClick={async () => { try { const voice = segment.narrator_voice || project.production_settings?.narrator_voice; const response = await base44.functions.invoke('generateSpeech', { voice, preview: true }); const url = response?.data?.file_url; if (!url) throw new Error('Voice preview unavailable'); await new Audio(url).play(); } catch (error) { toast.error(error.message || 'Unable to preview voice'); } }} className=\"border border-[#23c7be]/40 bg-[#242930] px-3 py-2 text-[10px] font-black text-[#23c7be] disabled:opacity-35\">Listen</button></div></div>}{box.type === 'dialogue'"
    )

    return next === code ? null : { code: next, map: null }
  },
}

export default defineConfig({
  ...baseConfig,
  plugins: [preserveFotoPlayTextMetadata, ...(baseConfig.plugins || []), narratorVoiceInTextTool],
})
