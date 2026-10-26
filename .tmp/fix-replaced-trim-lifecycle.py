from pathlib import Path
p = Path('src/components/studio/VideoTools.jsx')
t = p.read_text()
old1 = "? { ...clip, url: sourceShot.result_url, source_duration: null }"
new1 = "? { ...clip, url: sourceShot.result_url, source_duration: null, expand_trim_to_source_on_load: Math.abs(Number(clip.trim_start || 0)) < 0.02 && Math.abs(Number(clip.trim_end || 0) - Number(clip.source_duration || clip.trim_end || 0)) < 0.02 }"
old2 = "updateEditClip(selectedEditClip.id, { source_duration: duration, trim_end: Math.min(Number(selectedEditClip.trim_end || duration), duration) }, false);"
new2 = "updateEditClip(selectedEditClip.id, selectedEditClip.expand_trim_to_source_on_load ? { source_duration: duration, trim_end: duration, expand_trim_to_source_on_load: false } : { source_duration: duration, trim_end: Math.min(Number(selectedEditClip.trim_end || duration), duration) }, false);"
if t.count(old1) != 1:
    raise SystemExit(f'Expected one replacement sync line, found {t.count(old1)}')
if t.count(old2) != 1:
    raise SystemExit(f'Expected one metadata duration line, found {t.count(old2)}')
t = t.replace(old1, new1, 1).replace(old2, new2, 1)
p.write_text(t)
