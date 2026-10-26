from pathlib import Path
p = Path('src/components/studio/VideoTools.jsx')
t = p.read_text()
old = "onTimeUpdate={(event) => { const clipStart = editClipStart(selectedEditClip.id); const local = Math.max(0, Number(event.currentTarget.currentTime || 0) - Number(selectedEditClip.trim_start || 0)); setEditPlayhead(Math.min(editTimelineDuration, clipStart + local)); if (event.currentTarget.currentTime >= Number(selectedEditClip.trim_end || selectedEditClip.source_duration) - 0.02) advanceEditTimeline(selectedEditClip); }}"
new = "onPlay={(event) => { const start = Number(selectedEditClip.trim_start || 0); const end = Number(selectedEditClip.trim_end || selectedEditClip.source_duration); if (event.currentTarget.currentTime < start || event.currentTarget.currentTime >= end - 0.02) event.currentTarget.currentTime = start; }} onTimeUpdate={(event) => { const clipStart = editClipStart(selectedEditClip.id); const local = Math.max(0, Number(event.currentTarget.currentTime || 0) - Number(selectedEditClip.trim_start || 0)); setEditPlayhead(Math.min(editTimelineDuration, clipStart + local)); const trimEnd = Number(selectedEditClip.trim_end || selectedEditClip.source_duration); if (event.currentTarget.currentTime >= trimEnd - 0.02) { event.currentTarget.pause(); event.currentTarget.currentTime = Math.max(Number(selectedEditClip.trim_start || 0), trimEnd - 0.01); advanceEditTimeline(selectedEditClip); } }}"
if t.count(old) != 1:
    raise SystemExit(f'Expected exactly one preview timeupdate handler, found {t.count(old)}')
p.write_text(t.replace(old, new, 1))
