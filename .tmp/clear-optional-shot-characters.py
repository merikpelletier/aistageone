from pathlib import Path
p=Path('src/components/studio/VideoTools.jsx')
t=p.read_text()
old="""  const setShotMode = (shot, mode) => {
    const patch = { mode };
    if (mode === 'establishing') patch.framing = 'Establishing shot';
    if (mode === 'insert') patch.framing = 'Insert / detail';
    if (mode === 'standard' && !STANDARD_SHOT_TYPES.includes(shot.framing)) patch.framing = 'Medium shot';
    updateShot(shot.id, patch);
  };
"""
new="""  const setShotMode = (shot, mode) => {
    const patch = { mode };
    if (mode === 'establishing') { patch.framing = 'Establishing shot'; patch.character_ids = []; }
    if (mode === 'insert') { patch.framing = 'Insert / detail'; patch.character_ids = []; }
    if (mode === 'standard' && !STANDARD_SHOT_TYPES.includes(shot.framing)) patch.framing = 'Medium shot';
    updateShot(shot.id, patch);
  };
"""
if t.count(old)!=1: raise SystemExit(f'match count {t.count(old)}')
p.write_text(t.replace(old,new,1))
