from pathlib import Path
p = Path('src/components/studio/VideoTools.jsx')
t = p.read_text()
old = """      return sourceShot?.result_url && sourceShot.result_url !== clip.url
        ? { ...clip, url: sourceShot.result_url, trim_start: 0, trim_end: Math.max(0.1, Number(sourceShot.duration || 5)), source_duration: Math.max(0.1, Number(sourceShot.duration || 5)), reset_trim_on_load: true }
        : clip;"""
new = """      return sourceShot?.result_url && sourceShot.result_url !== clip.url
        ? { ...clip, url: sourceShot.result_url, source_duration: Math.max(0.1, Number(sourceShot.duration || 5)) }
        : clip;"""
if t.count(old) != 1:
    raise SystemExit(f'Expected exactly one replaced-clip block, found {t.count(old)}')
p.write_text(t.replace(old, new, 1))
