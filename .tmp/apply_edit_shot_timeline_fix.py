from pathlib import Path

path = Path('src/components/studio/VideoTools.jsx')
text = path.read_text(encoding='utf-8')

def replace_once(old, new):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'Expected one match, found {count}: {old[:120]!r}')
    text = text.replace(old, new, 1)

replace_once(
    "  const [editTimelineZoom, setEditTimelineZoom] = useState(1);\n  const [editUndoStack, setEditUndoStack] = useState([]);",
    "  const [editTimelineZoom, setEditTimelineZoom] = useState(1);\n  const [editPlaying, setEditPlaying] = useState(false);\n  const [editUndoStack, setEditUndoStack] = useState([]);"
)
replace_once(
    "    setEditPlayhead(0);\n    setEditTimelineZoom(1);\n    setEditUndoStack([]);\n    setEditRatio('16:9');",
    "    setEditPlayhead(0);\n    setEditTimelineZoom(1);\n    setEditPlaying(false);\n    setEditUndoStack([]);\n    setEditRatio('16:9');"
)
replace_once(
    "    setEditPlayhead(0);\n    setEditTimelineZoom(1);\n    setEditUndoStack([]);\n    setEditRatio(shotPlan[0]?.editor_ratio || aspectRatio || '16:9');",
    "    setEditPlayhead(0);\n    setEditTimelineZoom(1);\n    setEditPlaying(false);\n    setEditUndoStack([]);\n    setEditRatio(shotPlan[0]?.editor_ratio || aspectRatio || '16:9');"
)
replace_once(
    "  }, [step, editUndoStack, editClips, selectedEditClipId]);\n\n  const moveEditClip",
    "  }, [step, editUndoStack, editClips, selectedEditClipId]);\n\n  useEffect(() => {\n    const video = editPreviewRef.current;\n    if (!video || !selectedEditClip) return undefined;\n    video.muted = Boolean(selectedEditClip.muted);\n    video.volume = Math.max(0, Math.min(1, Number(selectedEditClip.volume ?? 1)));\n    if (!editPlaying) return undefined;\n    const play = () => video.play().catch(() => setEditPlaying(false));\n    if (video.readyState >= 2) play();\n    else video.addEventListener('canplay', play, { once: true });\n    return () => video.removeEventListener('canplay', play);\n  }, [editPlaying, selectedEditClipId, selectedEditClip?.muted, selectedEditClip?.volume]);\n\n  const moveEditClip"
)
replace_once(
    "  const splitEditClip = () => {",
    "  const playEditTimeline = () => {\n    if (!editClips.length) return;\n    if (editPlayhead >= editTimelineDuration - 0.02) seekEditorPlayhead(0);\n    setEditPlaying(true);\n  };\n\n  const pauseEditTimeline = () => {\n    editPreviewRef.current?.pause();\n    setEditPlaying(false);\n  };\n\n  const advanceEditTimeline = (clip) => {\n    const index = editClips.findIndex((item) => item.id === clip.id);\n    const next = editClips[index + 1];\n    if (!editPlaying || !next) {\n      setEditPlaying(false);\n      if (!next) setEditPlayhead(editTimelineDuration);\n      return;\n    }\n    setEditPlayhead(editClipStart(next.id));\n    setSelectedEditClipId(next.id);\n  };\n\n  const splitEditClip = () => {"
)
replace_once(
    "controls crossOrigin=\"anonymous\" onLoadedMetadata={(event) => { const duration = Number(event.currentTarget.duration || selectedEditClip.source_duration || 5); updateEditClip(selectedEditClip.id, { source_duration: duration, trim_end: Math.min(Number(selectedEditClip.trim_end || duration), duration) }, false); const localTime = Math.max(0, editPlayhead - editClipStart(selectedEditClip.id)); event.currentTarget.currentTime = Math.min(Number(selectedEditClip.trim_start || 0) + localTime, Math.max(0, duration - 0.05)); }} onTimeUpdate={(event) => { const clipStart = editClipStart(selectedEditClip.id); const local = Math.max(0, Number(event.currentTarget.currentTime || 0) - Number(selectedEditClip.trim_start || 0)); setEditPlayhead(Math.min(editTimelineDuration, clipStart + local)); if (event.currentTarget.currentTime >= Number(selectedEditClip.trim_end || selectedEditClip.source_duration)) event.currentTarget.pause(); }}",
    "controls crossOrigin=\"anonymous\" muted={Boolean(selectedEditClip.muted)} onLoadedMetadata={(event) => { const duration = Number(event.currentTarget.duration || selectedEditClip.source_duration || 5); updateEditClip(selectedEditClip.id, { source_duration: duration, trim_end: Math.min(Number(selectedEditClip.trim_end || duration), duration) }, false); const localTime = Math.max(0, editPlayhead - editClipStart(selectedEditClip.id)); event.currentTarget.currentTime = Math.min(Number(selectedEditClip.trim_start || 0) + localTime, Math.max(0, duration - 0.05)); event.currentTarget.volume = Math.max(0, Math.min(1, Number(selectedEditClip.volume ?? 1))); }} onTimeUpdate={(event) => { const clipStart = editClipStart(selectedEditClip.id); const local = Math.max(0, Number(event.currentTarget.currentTime || 0) - Number(selectedEditClip.trim_start || 0)); setEditPlayhead(Math.min(editTimelineDuration, clipStart + local)); if (event.currentTarget.currentTime >= Number(selectedEditClip.trim_end || selectedEditClip.source_duration) - 0.02) advanceEditTimeline(selectedEditClip); }}"
)
replace_once(
    "<div className=\"flex items-center gap-2\"><div className=\"flex items-center border border-white/10\"><button type=\"button\" onClick={() => setEditTimelineZoom((value) => Math.max(1, Number((value - 0.5).toFixed(1))))}",
    "<div className=\"flex items-center gap-2\"><button type=\"button\" onClick={editPlaying ? pauseEditTimeline : playEditTimeline} disabled={!editClips.length} className=\"border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black disabled:opacity-30\">{editPlaying ? '❚❚ Pause' : '▶ Play Timeline'}</button><div className=\"flex items-center border border-white/10\"><button type=\"button\" onClick={() => setEditTimelineZoom((value) => Math.max(1, Number((value - 0.5).toFixed(1))))}"
)
replace_once("Math.min(4, Number((value + 0.5).toFixed(1)))", "Math.min(8, Number((value + 0.5).toFixed(1)))")
replace_once("disabled={editTimelineZoom >= 4}", "disabled={editTimelineZoom >= 8}")
replace_once(
    "style={{ width: `${Math.max(720, editTimelineDuration * 90 * editTimelineZoom)}px` }}",
    "style={{ width: `${editTimelineZoom * 100}%`, minWidth: '720px' }}"
)

path.write_text(text, encoding='utf-8')
