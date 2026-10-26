from pathlib import Path
p = Path('src/components/studio/VideoTools.jsx')
t = p.read_text()
old = "? { ...clip, url: sourceShot.result_url, source_duration: Math.max(0.1, Number(sourceShot.duration || 5)) }"
new = "? { ...clip, url: sourceShot.result_url, source_duration: null }"
if t.count(old) != 1:
    raise SystemExit(f'Expected exactly one replaced source-duration assignment, found {t.count(old)}')
p.write_text(t.replace(old, new, 1))
# trigger workflow
