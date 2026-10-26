from pathlib import Path
p=Path('src/components/studio/VideoTools.jsx')
t=p.read_text()

old="""      return sourceShot?.result_url && sourceShot.result_url !== clip.url ? { ...clip, url: sourceShot.result_url } : clip;"""
new="""      return sourceShot?.result_url && sourceShot.result_url !== clip.url
        ? { ...clip, url: sourceShot.result_url, trim_start: 0, trim_end: Math.max(0.1, Number(sourceShot.duration || 5)), source_duration: Math.max(0.1, Number(sourceShot.duration || 5)), reset_trim_on_load: true }
        : clip;"""
if old not in t: raise SystemExit('regenerated shot sync block not found')
t=t.replace(old,new,1)

old2="""updateEditClip(selectedEditClip.id, { source_duration: duration, trim_end: Math.min(Number(selectedEditClip.trim_end || duration), duration) }, false);"""
new2="""updateEditClip(selectedEditClip.id, selectedEditClip.reset_trim_on_load ? { source_duration: duration, trim_start: 0, trim_end: duration, reset_trim_on_load: false } : { source_duration: duration, trim_end: Math.min(Number(selectedEditClip.trim_end || duration), duration) }, false);"""
if old2 not in t: raise SystemExit('editor metadata trim block not found')
t=t.replace(old2,new2,1)

p.write_text(t)
