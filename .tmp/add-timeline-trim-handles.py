from pathlib import Path
p=Path('src/components/studio/VideoTools.jsx')
t=p.read_text()

old="""  const updateEditClip = (id, patch, remember = true) => { if (remember) rememberEdit(); setEditClips((items) => items.map((clip) => clip.id === id ? { ...clip, ...patch } : clip)); };
  const undoEdit = () => setEditUndoStack((stack) => {"""
new="""  const updateEditClip = (id, patch, remember = true) => { if (remember) rememberEdit(); setEditClips((items) => items.map((clip) => clip.id === id ? { ...clip, ...patch } : clip)); };
  const startEditTrimDrag = (event, clip, edge) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedEditClipId(clip.id);
    rememberEdit();
    const startX = event.clientX;
    const pixelsPerSecond = Math.max(0.01, Number(editTimelinePixelsPerSecond || 0));
    const initialStart = Number(clip.trim_start || 0);
    const initialEnd = Number(clip.trim_end || clip.source_duration || 0.05);
    const sourceDuration = Math.max(initialEnd, Number(clip.source_duration || initialEnd));
    const handleMove = (moveEvent) => {
      const deltaSeconds = (moveEvent.clientX - startX) / pixelsPerSecond;
      setEditClips((items) => items.map((item) => {
        if (item.id !== clip.id) return item;
        if (edge === 'start') return { ...item, trim_start: Math.max(0, Math.min(initialStart + deltaSeconds, initialEnd - 0.05)) };
        return { ...item, trim_end: Math.max(initialStart + 0.05, Math.min(initialEnd + deltaSeconds, sourceDuration)) };
      }));
    };
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      setEditClips((items) => { void persistEditorTimeline(items); return items; });
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp, { once: true });
  };
  const undoEdit = () => setEditUndoStack((stack) => {"""
if old not in t: raise SystemExit('updateEditClip anchor not found')
t=t.replace(old,new,1)

old2="""style={{ flex: `0 0 ${duration * editTimelinePixelsPerSecond}px` }}><video src={clip.url} muted preload=\"metadata\" className=\"pointer-events-none absolute inset-0 h-full w-full object-cover opacity-65\" />"""
new2="""style={{ flex: `0 0 ${duration * editTimelinePixelsPerSecond}px` }}><button type=\"button\" aria-label={`Trim start of ${clip.label}`} onPointerDown={(event) => startEditTrimDrag(event, clip, 'start')} onClick={(event) => event.stopPropagation()} className=\"absolute inset-y-0 left-0 z-30 w-3 cursor-ew-resize border-l-2 border-[#23c7be] bg-[#23c7be]/10 opacity-70 hover:bg-[#23c7be]/30 hover:opacity-100\" /><button type=\"button\" aria-label={`Trim end of ${clip.label}`} onPointerDown={(event) => startEditTrimDrag(event, clip, 'end')} onClick={(event) => event.stopPropagation()} className=\"absolute inset-y-0 right-0 z-30 w-3 cursor-ew-resize border-r-2 border-[#23c7be] bg-[#23c7be]/10 opacity-70 hover:bg-[#23c7be]/30 hover:opacity-100\" /><video src={clip.url} muted preload=\"metadata\" className=\"pointer-events-none absolute inset-0 h-full w-full object-cover opacity-65\" />"""
if old2 not in t: raise SystemExit('timeline clip video anchor not found')
t=t.replace(old2,new2,1)

p.write_text(t)
