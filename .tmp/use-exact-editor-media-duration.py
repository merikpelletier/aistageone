from pathlib import Path
p = Path('src/components/studio/VideoTools.jsx')
t = p.read_text()
old1 = "const buildDefaultEditorClips = () => shotPlan.filter((shot) => shot.result_url).map((shot) => ({ id: crypto.randomUUID(), shot_id: shot.id, label: shot.label, url: shot.result_url, source_duration: Math.max(0.1, Number(shot.duration || 5)), trim_start: 0, trim_end: Math.max(0.1, Number(shot.duration || 5)), scale: 1, x: 0, y: 0, volume: 1, muted: false }));"
new1 = "const buildDefaultEditorClips = () => shotPlan.filter((shot) => shot.result_url).map((shot) => ({ id: crypto.randomUUID(), shot_id: shot.id, label: shot.label, url: shot.result_url, source_duration: null, trim_start: 0, trim_end: 0, expand_trim_to_source_on_load: true, scale: 1, x: 0, y: 0, volume: 1, muted: false }));"
old2 = "const updateEditClip = (id, patch, remember = true) => { if (remember) rememberEdit(); setEditClips((items) => items.map((clip) => clip.id === id ? { ...clip, ...patch } : clip)); };"
new2 = "const updateEditClip = (id, patch, remember = true) => { if (remember) rememberEdit(); setEditClips((items) => items.map((clip) => clip.id === id ? { ...clip, ...patch } : clip)); };\n  const syncEditClipMediaDuration = (clip, rawDuration) => { const duration = Number(rawDuration); if (!Number.isFinite(duration) || duration <= 0) return; const oldSourceDuration = Number(clip.source_duration || 0); const wasFullLength = Math.abs(Number(clip.trim_start || 0)) < 0.02 && oldSourceDuration > 0 && Math.abs(Number(clip.trim_end || 0) - oldSourceDuration) < 0.02; updateEditClip(clip.id, (clip.expand_trim_to_source_on_load || clip.source_duration == null || wasFullLength) ? { source_duration: duration, trim_end: duration, expand_trim_to_source_on_load: false } : { source_duration: duration, trim_end: Math.min(Number(clip.trim_end || duration), duration) }, false); };"
old3 = "const duration = Number(event.currentTarget.duration || selectedEditClip.source_duration || 5); updateEditClip(selectedEditClip.id, selectedEditClip.expand_trim_to_source_on_load ? { source_duration: duration, trim_end: duration, expand_trim_to_source_on_load: false } : { source_duration: duration, trim_end: Math.min(Number(selectedEditClip.trim_end || duration), duration) }, false);"
new3 = "const duration = Number(event.currentTarget.duration); syncEditClipMediaDuration(selectedEditClip, duration);"
old4 = '<video src={clip.url} muted preload="metadata" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-65" />'
new4 = '<video src={clip.url} muted preload="metadata" onLoadedMetadata={(event) => syncEditClipMediaDuration(clip, event.currentTarget.duration)} className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-65" />'
for i, (old, new) in enumerate([(old1,new1),(old2,new2),(old3,new3),(old4,new4)], 1):
    if t.count(old) != 1:
        raise SystemExit(f'Target {i}: expected exactly one match, found {t.count(old)}')
    t = t.replace(old, new, 1)
p.write_text(t)
