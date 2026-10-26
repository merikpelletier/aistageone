from pathlib import Path
p=Path('src/components/studio/VideoTools.jsx')
t=p.read_text()
old="""    const noCharacterRule = characterRefs.length === 0 ? ' NO CHARACTERS ARE PRESENT IN THIS SHOT. Do not invent, add or imply any person, animal, creature or performer.' : '';\n"""
if t.count(old) != 1:
    raise SystemExit(f'expected 1 noCharacterRule, found {t.count(old)}')
t=t.replace(old,'',1)
old_return="""    return `${referenceRules}${noCharacterRule} ${framingRule} ${contentRule}${transitionRule} ${shot.camera ? `CAMERA NOTES: ${shot.camera}.` : ''} ${shot.sound ? `SOUND / AMBIENCE: ${shot.sound}.` : ''} Preserve exact reference identities, exact set continuity, wardrobe, eyelines and screen direction. Duration ${shot.duration} seconds.`;\n"""
new_return="""    return `${referenceRules} ${framingRule} ${contentRule}${transitionRule} ${shot.camera ? `CAMERA NOTES: ${shot.camera}.` : ''} ${shot.sound ? `SOUND / AMBIENCE: ${shot.sound}.` : ''} Preserve exact reference identities, exact set continuity, wardrobe, eyelines and screen direction. Duration ${shot.duration} seconds.`;\n"""
if t.count(old_return) != 1:
    raise SystemExit(f'expected 1 return, found {t.count(old_return)}')
p.write_text(t.replace(old_return,new_return,1))
