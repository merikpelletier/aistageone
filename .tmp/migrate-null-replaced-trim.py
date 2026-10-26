from pathlib import Path
p = Path('src/components/studio/VideoTools.jsx')
t = p.read_text()
old = """      return sourceShot?.result_url && sourceShot.result_url !== clip.url
        ? { ...clip, url: sourceShot.result_url, source_duration: null, expand_trim_to_source_on_load: Math.abs(Number(clip.trim_start || 0)) < 0.02 && Math.abs(Number(clip.trim_end || 0) - Number(clip.source_duration || clip.trim_end || 0)) < 0.02 }
        : clip;"""
new = """      return sourceShot?.result_url && sourceShot.result_url !== clip.url
        ? { ...clip, url: sourceShot.result_url, source_duration: null, expand_trim_to_source_on_load: Math.abs(Number(clip.trim_start || 0)) < 0.02 && Math.abs(Number(clip.trim_end || 0) - Number(clip.source_duration || clip.trim_end || 0)) < 0.02 }
        : (clip.source_duration == null ? { ...clip, expand_trim_to_source_on_load: true } : clip);"""
if t.count(old) != 1:
    raise SystemExit(f'Expected one sync block, found {t.count(old)}')
p.write_text(t.replace(old, new, 1))
