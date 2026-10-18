from pathlib import Path

path = Path('src/components/studio/AuthorProductionWorkspacePage.jsx')
text = path.read_text()
old = "{items.map((box) => <div key={box.id} onPointerDown={(event) => { event.stopPropagation(); textMode && !drawingBoxId && setSelectedBox(box.id); }} className={`absolute z-20 bg-white text-black shadow-lg ${textMode && selectedBox === box.id ? 'ring-3 ring-[#23c7be]' : 'ring-1 ring-black/70'}`}"
new = "{items.map((box) => <div key={box.id} onPointerDown={(event) => { event.stopPropagation(); if (!textMode || drawingBoxId) return; setSelectedBox(box.id); if (box.type === 'dialogue') { const points = pointerControlPoints(box, box.pointer_path); pointerPointsRef.current = points; setPointerDraft(points); setDrawingBoxId(box.id); onBoxesChange(items.map((item) => item.id === box.id ? { ...item, pointer_path: points, arrow_preset: null, arrow_position: 50 } : item)); } }} className={`absolute z-20 bg-white text-black shadow-lg ${textMode && selectedBox === box.id ? 'ring-3 ring-[#23c7be]' : 'ring-1 ring-black/70'}`}"
assert old in text, 'target not found'
path.write_text(text.replace(old, new, 1))
print('patched', path)
