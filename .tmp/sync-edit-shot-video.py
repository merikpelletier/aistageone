from pathlib import Path
p=Path('src/components/studio/VideoTools.jsx')
t=p.read_text()
old="""    const savedTimeline = Array.isArray(shotPlan[0]?.editor_timeline) ? shotPlan[0].editor_timeline.filter((clip) => clip?.url) : [];
    const next = savedTimeline.length ? savedTimeline : buildDefaultEditorClips();
"""
new="""    const savedTimeline = Array.isArray(shotPlan[0]?.editor_timeline) ? shotPlan[0].editor_timeline.filter((clip) => clip?.url) : [];
    const syncedTimeline = savedTimeline.map((clip) => {
      const sourceShot = shotPlan.find((shot) => shot.id === clip.shot_id);
      return sourceShot?.result_url && sourceShot.result_url !== clip.url ? { ...clip, url: sourceShot.result_url } : clip;
    });
    const next = syncedTimeline.length ? syncedTimeline : buildDefaultEditorClips();
"""
if t.count(old) != 1: raise SystemExit(f'match count {t.count(old)}')
p.write_text(t.replace(old,new,1))
