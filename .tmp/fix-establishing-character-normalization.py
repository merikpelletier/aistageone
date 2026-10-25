from pathlib import Path
p=Path('src/components/studio/VideoTools.jsx')
t=p.read_text()
old="""  const normalizeShotCastIds = (shot, castData = cast) => {
    const ids = new Set(Array.isArray(shot?.character_ids) ? shot.character_ids : []);
    (Array.isArray(shot?.lines) ? shot.lines : []).forEach((line) => { if (line.character_id) ids.add(line.character_id); });
    if (!ids.size && Array.isArray(shot?.characters)) {
      const legacyNames = new Set(shot.characters.map((value) => String(value).trim().toLowerCase()));
      castData.filter((member) => legacyNames.has(String(member.name || '').trim().toLowerCase())).forEach((member) => ids.add(member.id));
    }
    return [...ids].filter((id) => castData.some((member) => member.id === id));
  };
"""
new="""  const normalizeShotCastIds = (shot, castData = cast) => {
    const ids = new Set(Array.isArray(shot?.character_ids) ? shot.character_ids : []);
    const mode = shot?.mode || (shot?.framing === 'Establishing shot' ? 'establishing' : shot?.framing === 'Insert / detail' ? 'insert' : 'standard');
    if (mode === 'standard') {
      (Array.isArray(shot?.lines) ? shot.lines : []).forEach((line) => { if (line.character_id) ids.add(line.character_id); });
      if (!ids.size && Array.isArray(shot?.characters)) {
        const legacyNames = new Set(shot.characters.map((value) => String(value).trim().toLowerCase()));
        castData.filter((member) => legacyNames.has(String(member.name || '').trim().toLowerCase())).forEach((member) => ids.add(member.id));
      }
    }
    return [...ids].filter((id) => castData.some((member) => member.id === id));
  };
"""
if t.count(old)!=1: raise SystemExit(f'match count {t.count(old)}')
p.write_text(t.replace(old,new,1))
