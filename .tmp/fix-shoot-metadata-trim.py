from pathlib import Path
p = Path('src/components/studio/VideoTools.jsx')
t = p.read_text()
old = "updateEditClip(selectedEditClip.id, selectedEditClip.reset_trim_on_load ? { source_duration: duration, trim_start: 0, trim_end: duration, reset_trim_on_load: false } : { source_duration: duration, trim_end: Math.min(Number(selectedEditClip.trim_end || duration), duration) }, false);"
new = "updateEditClip(selectedEditClip.id, { source_duration: duration, trim_end: Math.min(Number(selectedEditClip.trim_end || duration), duration) }, false);"
if t.count(old) != 1:
    raise SystemExit(f'Expected exactly one metadata trim reset, found {t.count(old)}')
p.write_text(t.replace(old, new, 1))
