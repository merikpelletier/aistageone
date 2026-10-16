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

const textReadingOrderControls = {
  name: 'fotoplay-text-reading-order-controls',
  enforce: 'pre',
  transform(code, id) {
    const normalizedId = id?.replace(/\\/g, '/') || ''
    if (!normalizedId.endsWith('/src/components/studio/AuthorProductionWorkspacePage.jsx')) return null
    let next = code

    next = next.replace(
      "const deleteTextBox = (id) => change({ text_boxes: boxes.filter((box) => box.id !== id) });",
      "const deleteTextBox = (id) => change({ text_boxes: boxes.filter((box) => box.id !== id).map((item, index) => ({ ...item, order: index + 1 })) });\n  const moveTextBoxOrder = (id, delta) => { const ordered = [...boxes].sort((a, b) => (Number(a.order) || boxes.indexOf(a) + 1) - (Number(b.order) || boxes.indexOf(b) + 1)); const index = ordered.findIndex((item) => item.id === id); const target = index + delta; if (index < 0 || target < 0 || target >= ordered.length) return; [ordered[index], ordered[target]] = [ordered[target], ordered[index]]; change({ text_boxes: ordered.map((item, orderIndex) => ({ ...item, order: orderIndex + 1 })), audio_stale: true, status: 'draft' }); };"
    )

    next = next.replace(
      "<div className=\"flex items-center justify-between gap-2\"><p className=\"text-xs font-black uppercase text-[#23c7be]\">{box.type === 'dialogue' ? 'Dialogue' : 'Narration'} {index + 1}</p><button onClick={() => deleteTextBox(box.id)} className=\"flex items-center gap-1 bg-red-500/20 px-2 py-1 text-[10px] font-black text-red-200\"><Trash2 size={12} /> Delete block</button></div>",
      "<div className=\"flex items-center justify-between gap-2\"><div className=\"flex items-center gap-2\"><span className=\"flex h-7 w-7 items-center justify-center bg-[#23c7be] text-[11px] font-black text-black\">{Number(box.order) || index + 1}</span><p className=\"text-xs font-black uppercase text-[#23c7be]\">{box.type === 'dialogue' ? 'Dialogue' : 'Narration'} {index + 1}</p></div><div className=\"flex items-center gap-1\"><button type=\"button\" title=\"Move earlier in reading order\" disabled={index === 0} onClick={() => moveTextBoxOrder(box.id, -1)} className=\"flex h-7 w-7 items-center justify-center border border-white/10 bg-[#242930] text-sm font-black text-white disabled:opacity-25\">↑</button><button type=\"button\" title=\"Move later in reading order\" disabled={index === boxes.length - 1} onClick={() => moveTextBoxOrder(box.id, 1)} className=\"flex h-7 w-7 items-center justify-center border border-white/10 bg-[#242930] text-sm font-black text-white disabled:opacity-25\">↓</button><button onClick={() => deleteTextBox(box.id)} className=\"ml-1 flex items-center gap-1 bg-red-500/20 px-2 py-1 text-[10px] font-black text-red-200\"><Trash2 size={12} /> Delete block</button></div></div>"
    )

    return next === code ? null : { code: next, map: null }
  },
}

const restorePublishVault = {
  name: 'restore-fotoplay-publish-vault',
  enforce: 'pre',
  transform(code, id) {
    const normalizedId = id?.replace(/\\/g, '/') || ''
    if (!normalizedId.endsWith('/src/components/studio/FotoPlayProjectActions.jsx')) return null
    let next = code
    if (!next.includes("import VaultPickerModal from './VaultPickerModal';")) next = next.replace("import { completedExportChapters, exportAnimatedVideo, exportSlideshowZip, supportedMp4Type } from './storyExport';", "import VaultPickerModal from './VaultPickerModal';\nimport { completedExportChapters, exportAnimatedVideo, exportSlideshowZip, supportedMp4Type } from './storyExport';")
    next = next.replace("const [confirmed, setConfirmed] = useState(false); const [uploading, setUploading] = useState(false);", "const [confirmed, setConfirmed] = useState(false); const [uploading, setUploading] = useState(false); const [showVault, setShowVault] = useState(false);")
    next = next.replace('<div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-black uppercase text-white/55">Cover</p><label', '<div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-black uppercase text-white/55">Cover</p><div className="flex gap-2"><button type="button" onClick={() => setShowVault(true)} className={`${action} bg-[#23c7be] text-black`}><ImageIcon size={14} /> Vault</button><label')
    next = next.replace('<input type="file" accept="image/*" onChange={uploadCover} className="sr-only" /></label></div><div className="grid grid-cols-4 gap-2 md:grid-cols-6">', '<input type="file" accept="image/*" onChange={uploadCover} className="sr-only" /></label></div></div><div className="grid grid-cols-4 gap-2 md:grid-cols-6">')
    next = next.replace('return <div className="fixed inset-0 z-[220] flex items-start justify-center overflow-y-auto bg-black/90 p-4 py-6 text-white">', 'return <><div className="fixed inset-0 z-[220] flex items-start justify-center overflow-y-auto bg-black/90 p-4 py-6 text-white">')
    next = next.replace('</div></div></div></div>;\n}', '</div></div></div></div>{showVault && <VaultPickerModal userEmail={user?.email || project.created_by || \'\'} onSelect={(url) => { setCoverImage(url); setShowVault(false); }} onClose={() => setShowVault(false)} />}</>;\n}')
    return next === code ? null : { code: next, map: null }
  },
}

const approvalAndPublishIntegrity = {
  name: 'fotoplay-approval-and-publish-integrity',
  enforce: 'post',
  transform(code, id) {
    const normalizedId = id?.replace(/\\/g, '/') || ''
    let next = code

    if (normalizedId.endsWith('/src/components/studio/AuthorProductionWorkspacePage.jsx')) {
      const currentApprove = "const approve = async () => { if (boxes.length ? !segment.narration_url || segment.audio_stale : !segment.narrator_voice) return toast.error(boxes.length ? 'Generate the ordered audio sequence first' : 'Choose a voice first'); if (!allLeavesReady) return toast.error('Every frame needs an image'); setBusy('approve'); try { await syncPage(); if (!boxes.length && (!segment.narration_url || segment.audio_stale || segment.audio_source_text !== segment.narration_text || segment.audio_voice !== segment.narrator_voice)) await generateAudio(); const continuity = { ...(active.appearance_continuity || {}) }; for (const id of segment.character_ids) { const value = segment.character_directions?.[id] || {}; if (value.continuity_scope === 'carry') continuity[id] = value; } await persist({ status: 'approved' }, { appearance_continuity: continuity }); if (segment.number < 9) setSelectedId(active.segments[segment.number].id); setNotice(`Segment ${segment.number} approved.`); } catch (error) { toast.error(error.message || 'Approval failed'); } finally { setBusy(''); } };"
      const fixedApprove = "const approve = async () => { if (boxes.length ? !segment.narration_url || segment.audio_stale : !segment.narrator_voice) return toast.error(boxes.length ? 'Build final audio first' : 'Choose a voice first'); if (!allLeavesReady) return toast.error('Every frame needs an image'); setBusy('approve'); try { let file = await assembleComicPage(panels, active.image_aspect_ratio || '16:9'); file = await addTextBoxesToFile(file, boxes); const uploaded = await base44.integrations.Core.UploadFile({ file }); if (!uploaded?.file_url) throw new Error('Unable to save the synchronized page'); const audioValues = {}; if (!boxes.length && (!segment.narration_url || segment.audio_stale || segment.audio_source_text !== segment.narration_text || segment.audio_voice !== segment.narrator_voice)) { const response = await base44.functions.invoke('generateSpeech', { text: segment.narration_text, voice: segment.narrator_voice, language_code: segment.narrator_language || project.production_settings?.narrator_language || 'en' }); if (!response?.data?.file_url) throw new Error('No audio returned'); audioValues.narration_url = response.data.file_url; audioValues.audio_source_text = segment.narration_text; audioValues.audio_voice = segment.narrator_voice; audioValues.audio_language = segment.narrator_language || project.production_settings?.narrator_language || 'en'; audioValues.audio_stale = false; } const continuity = { ...(active.appearance_continuity || {}) }; for (const id of segment.character_ids) { const value = segment.character_directions?.[id] || {}; if (value.continuity_scope === 'carry') continuity[id] = value; } await persist({ image_url: uploaded.file_url, comic_page_source: comicPageSignature(active, panels), image_source_aspect_ratio: active.image_aspect_ratio || '16:9', text_overlay_source_url: '', text_overlay_applied_signature: JSON.stringify(boxes), ...audioValues, status: 'approved' }, { appearance_continuity: continuity }); if (segment.number < 9) setSelectedId(active.segments[segment.number].id); setNotice(`Segment ${segment.number} approved.`); } catch (error) { toast.error(error.message || 'Approval failed'); } finally { setBusy(''); } };"
      next = next.replace(currentApprove, fixedApprove)
    }

    if (normalizedId.endsWith('/src/components/studio/AuthorProductionWorkspace.jsx')) {
      next = next.replace(
        "const response = await base44.functions.invoke('publishAuthorStory', { project_id: project.id, ...publication });",
        "const savedBeforePublish = await onSave(project, { silent: true }); if (!savedBeforePublish) throw new Error('Unable to synchronize the project before publishing'); const response = await base44.functions.invoke('publishAuthorStory', { project_id: project.id, ...publication });"
      )
      next = next.replace(
        "      window.open(`/Magazine?dossier=${encodeURIComponent(response.data.dossier_id)}`, '_blank', 'noopener,noreferrer');\n",
        ''
      )
    }

    return next === code ? null : { code: next, map: null }
  },
}

const finalAudioTerminology = {
  name: 'fotoplay-final-audio-terminology',
  enforce: 'post',
  transform(code, id) {
    const normalizedId = id?.replace(/\\/g, '/') || ''
    if (!normalizedId.endsWith('/src/components/studio/AuthorProductionWorkspacePage.jsx')) return null
    const next = code
      .replaceAll('Generate the ordered audio sequence first', 'Build final audio first')
      .replaceAll('Generate the ordered audio sequence', 'Build final audio')
    return next === code ? null : { code: next, map: null }
  },
}

export default defineConfig({
  ...baseConfig,
  plugins: [preserveFotoPlayTextMetadata, ...(baseConfig.plugins || []), narratorVoiceInTextTool, textReadingOrderControls, restorePublishVault, approvalAndPublishIntegrity, finalAudioTerminology],
})