from pathlib import Path
p=Path('src/components/studio/VideoTools.jsx')
t=p.read_text()
old="""    const syncedTimeline = savedTimeline.map((clip) => {\n      const sourceShot = shotPlan.find((shot) => shot.id === clip.shot_id);\n      return sourceShot?.result_url && sourceShot.result_url !== clip.url ? { ...clip, url: sourceShot.result_url } : clip;\n    });\n    const next = syncedTimeline.length ? syncedTimeline : buildDefaultEditorClips();\n"""
new="""    const syncedTimeline = savedTimeline.map((clip) => {\n      const sourceShot = shotPlan.find((shot) => shot.id === clip.shot_id);\n      return sourceShot?.result_url && sourceShot.result_url !== clip.url ? { ...clip, url: sourceShot.result_url } : clip;\n    });\n    const existingShotIds = new Set(syncedTimeline.map((clip) => clip.shot_id).filter(Boolean));\n    const missingGeneratedClips = buildDefaultEditorClips().filter((clip) => !existingShotIds.has(clip.shot_id));\n    const next = syncedTimeline.length ? [...syncedTimeline, ...missingGeneratedClips] : missingGeneratedClips;\n"""
if t.count(old)!=1:
    raise SystemExit(f'expected exact block once, found {t.count(old)}')
p.write_text(t.replace(old,new,1))
