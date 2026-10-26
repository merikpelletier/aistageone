from pathlib import Path
p=Path('src/components/studio/VideoTools.jsx')
t=p.read_text()
old="  const editPreviewRef = useRef(null);\n  const editTimelineViewportRef = useRef(null);"
new="  const editPreviewRef = useRef(null);\n  const editMusicPreviewRef = useRef(null);\n  const editTimelineViewportRef = useRef(null);"
if old not in t: raise SystemExit('preview ref block not found')
t=t.replace(old,new,1)
old="  const persistEditorTimeline = async (clips) => {\n    if (!shotPlan.length) return;\n    const nextShots = shotPlan.map((shot, index) => index === 0 ? { ...shot, editor_timeline: clips, editor_music: editMusic, editor_ratio: editRatio } : shot);"
new="  const persistEditorTimeline = async (clips, music = editMusic, ratio = editRatio) => {\n    if (!shotPlan.length) return;\n    const nextShots = shotPlan.map((shot, index) => index === 0 ? { ...shot, editor_timeline: clips, editor_music: music, editor_ratio: ratio } : shot);"
if old not in t: raise SystemExit('persist block not found')
t=t.replace(old,new,1)
marker="  const persistEditorTimeline = async (clips, music = editMusic, ratio = editRatio) => {"
insert="""  useEffect(() => {
    const audio = editMusicPreviewRef.current;
    if (!audio || !editMusic.url) return;
    const start = Math.max(0, Number(editMusic.start || 0));
    const trimStart = Math.max(0, Number(editMusic.trim_start || 0));
    const trimEnd = Math.max(trimStart, Number(editMusic.trim_end || editMusic.duration || 0));
    const available = Math.max(0, trimEnd - trimStart);
    const localTimeline = editPlayhead - start;
    const active = available > 0 && localTimeline >= 0 && (Boolean(editMusic.loop) || localTimeline < available);
    let sourceTime = trimStart;
    if (active) sourceTime = trimStart + (editMusic.loop ? (localTimeline % available) : localTimeline);
    if (Number.isFinite(sourceTime) && Math.abs(Number(audio.currentTime || 0) - sourceTime) > 0.35) {
      try { audio.currentTime = Math.min(sourceTime, Math.max(trimStart, trimEnd - 0.01)); } catch {}
    }
    let gain = Math.max(0, Math.min(1, Number(editMusic.volume ?? 0.55)));
    const fadeIn = Math.max(0, Number(editMusic.fade_in || 0));
    const fadeOut = Math.max(0, Number(editMusic.fade_out || 0));
    if (fadeIn > 0 && localTimeline >= 0 && localTimeline < fadeIn) gain *= localTimeline / fadeIn;
    const effectiveLength = editMusic.loop ? Math.max(0, editTimelineDuration - start) : available;
    if (fadeOut > 0 && active && effectiveLength > 0 && localTimeline > effectiveLength - fadeOut) gain *= Math.max(0, (effectiveLength - localTimeline) / fadeOut);
    audio.volume = Math.max(0, Math.min(1, gain));
    audio.loop = false;
    if (editPlaying && active) audio.play().catch(() => {});
    else audio.pause();
  }, [editPlaying, editPlayhead, editMusic.url, editMusic.volume, editMusic.start, editMusic.trim_start, editMusic.trim_end, editMusic.duration, editMusic.loop, editMusic.fade_in, editMusic.fade_out, editTimelineDuration]);

  useEffect(() => {
    if (step !== 'edit' || !shotPlan.length) return undefined;
    const timer = window.setTimeout(() => { void persistEditorTimeline(editClips, editMusic, editRatio); }, 300);
    return () => window.clearTimeout(timer);
  }, [editMusic, editRatio]);

"""
if marker not in t: raise SystemExit('persist marker not found')
t=t.replace(marker,insert+marker,1)
old="  const pauseEditTimeline = () => {\n    editPreviewRef.current?.pause();\n    setEditPlaying(false);\n  };"
new="  const pauseEditTimeline = () => {\n    editPreviewRef.current?.pause();\n    editMusicPreviewRef.current?.pause();\n    setEditPlaying(false);\n  };"
if old not in t: raise SystemExit('pause block not found')
t=t.replace(old,new,1)
old='<audio src={editMusic.url} controls className="mt-3 w-full" onLoadedMetadata={(event) => { const duration = Number(event.currentTarget.duration || 0); setEditMusic((value) => ({ ...value, duration, trim_end: value.trim_end > 0 ? Math.min(value.trim_end, duration) : duration })); }} />'
new='<audio ref={editMusicPreviewRef} src={editMusic.url} controls className="mt-3 w-full" onLoadedMetadata={(event) => { const duration = Number(event.currentTarget.duration || 0); event.currentTarget.volume = Math.max(0, Math.min(1, Number(editMusic.volume ?? 0.55))); setEditMusic((value) => ({ ...value, duration, trim_end: value.trim_end > 0 ? Math.min(value.trim_end, duration) : duration })); }} />'
if old not in t: raise SystemExit('audio player not found')
t=t.replace(old,new,1)
p.write_text(t)
