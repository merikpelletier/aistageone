from pathlib import Path
p=Path('src/components/studio/VideoTools.jsx')
s=p.read_text()
def r(a,b):
    global s
    if s.count(a)!=1: raise SystemExit(f'match count {s.count(a)} for {a[:80]}')
    s=s.replace(a,b,1)
r("  const [editTimelineZoom, setEditTimelineZoom] = useState(1);\n  const [editPlaying, setEditPlaying] = useState(false);","  const [editTimelineZoom, setEditTimelineZoom] = useState(1);\n  const [editTimelineViewportWidth, setEditTimelineViewportWidth] = useState(0);\n  const [editPlaying, setEditPlaying] = useState(false);")
r("  const editPreviewRef = useRef(null);","  const editPreviewRef = useRef(null);\n  const editTimelineViewportRef = useRef(null);")
r("  const editTimelineTick = editTimelineZoom >= 3 ? 0.25 : editTimelineZoom >= 2 ? 0.5 : 1;\n  const editTimelinePixelsPerSecond = 44 * editTimelineZoom;\n  const editTimelineWidth = Math.max(720, editTimelineDuration * editTimelinePixelsPerSecond);","  const editTimelineTick = editTimelineZoom >= 2 ? 0.5 : 1;\n  const editTimelineWidth = Math.max(1, editTimelineViewportWidth || 1) * editTimelineZoom;\n  const editTimelinePixelsPerSecond = editTimelineDuration > 0 ? editTimelineWidth / editTimelineDuration : 0;")
marker="  const openEditor = () => {"
effect="""  useEffect(() => {\n    if (step !== 'edit') return undefined;\n    const node = editTimelineViewportRef.current;\n    if (!node) return undefined;\n    const updateWidth = () => setEditTimelineViewportWidth(node.clientWidth || 0);\n    updateWidth();\n    const observer = new ResizeObserver(updateWidth);\n    observer.observe(node);\n    return () => observer.disconnect();\n  }, [step]);\n\n"""
if s.count(marker)!=1: raise SystemExit('openEditor marker mismatch')
s=s.replace(marker,effect+marker,1)
r("<div className=\"overflow-x-auto border border-white/10 bg-black/30\"><div className=\"relative\" style={{ width: `${editTimelineWidth}px` }}>","<div ref={editTimelineViewportRef} className=\"overflow-x-auto border border-white/10 bg-black/30\"><div className=\"relative\" style={{ width: `${editTimelineWidth}px`, minWidth: '100%' }}>")
p.write_text(s)
