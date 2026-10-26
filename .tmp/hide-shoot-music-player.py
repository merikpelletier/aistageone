from pathlib import Path
p=Path('src/components/studio/VideoTools.jsx')
t=p.read_text()
old='<audio ref={editMusicPreviewRef} src={editMusic.url} controls className="mt-3 w-full" onLoadedMetadata={(event) => { const duration = Number(event.currentTarget.duration || 0); event.currentTarget.volume = Math.max(0, Math.min(1, Number(editMusic.volume ?? 0.55))); setEditMusic((value) => ({ ...value, duration, trim_end: value.trim_end > 0 ? Math.min(value.trim_end, duration) : duration })); }} />'
new='<audio ref={editMusicPreviewRef} src={editMusic.url} className="hidden" onLoadedMetadata={(event) => { const duration = Number(event.currentTarget.duration || 0); event.currentTarget.volume = Math.max(0, Math.min(1, Number(editMusic.volume ?? 0.55))); setEditMusic((value) => ({ ...value, duration, trim_end: value.trim_end > 0 ? Math.min(value.trim_end, duration) : duration })); }} />'
if old not in t: raise SystemExit('visible music player not found')
t=t.replace(old,new,1)
p.write_text(t)
