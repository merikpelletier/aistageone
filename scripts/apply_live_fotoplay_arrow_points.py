from pathlib import Path

p = Path('src/components/studio/AuthorProductionWorkspace.jsx')
s = p.read_text()

old = """    arrow_preset: DIALOGUE_ARROW_PRESET_IDS.has(box.arrow_preset) ? box.arrow_preset : defaultDialogueArrowForLegacySide(box.tail_side),
    arrow_position: Math.max(10, Math.min(90, arrowPosition)),
  };
"""
new = """    arrow_preset: DIALOGUE_ARROW_PRESET_IDS.has(box.arrow_preset) ? box.arrow_preset : defaultDialogueArrowForLegacySide(box.tail_side),
    arrow_position: Math.max(10, Math.min(90, arrowPosition)),
    arrow_points: Array.isArray(box.arrow_points) && box.arrow_points.length === 3 ? box.arrow_points.map((point) => ({ x: Math.max(0, Math.min(100, Number(point?.x) || 0)), y: Math.max(0, Math.min(100, Number(point?.y) || 0)) })) : null,
  };
"""
assert old in s, 'normalize target missing'
s = s.replace(old, new, 1)

marker = "function roundedRect(ctx, x, y, width, height, radius) {"
helpers = r'''function dialogueArrowPoints(box) {
  if (Array.isArray(box?.arrow_points) && box.arrow_points.length === 3) return box.arrow_points;
  const x = Number(box?.x) || 0, y = Number(box?.y) || 0, w = Math.max(1, Number(box?.width) || 1), h = Math.max(1, Number(box?.height) || 1);
  const a = { x: Math.max(0, Math.min(100, x + w * 0.5)), y: Math.max(0, Math.min(100, y + h)) };
  const z = { x: Math.max(0, Math.min(100, a.x + 10)), y: Math.max(0, Math.min(100, a.y + 16)) };
  return [a, { x: (a.x + z.x) / 2, y: (a.y + z.y) / 2 }, z];
}
function dialogueArrowPath(points) { const [a,c,z] = points; return `M ${a.x} ${a.y} Q ${c.x} ${c.y} ${z.x} ${z.y}`; }
function dialogueArrowHead(points) { const [,c,z] = points; const dx = z.x-c.x, dy = z.y-c.y, len = Math.hypot(dx,dy) || 1, ux = dx/len, uy = dy/len, size = 2.1, half = 0.9, bx = z.x-ux*size, by = z.y-uy*size; return { tip:z, left:{x:bx-uy*half,y:by+ux*half}, right:{x:bx+uy*half,y:by-ux*half} }; }
function EditableDialogueArrow({ points, frameWidth }) {
  const h = dialogueArrowHead(points), outer = Math.max(4, frameWidth*0.0042), inner = Math.max(2, frameWidth*0.0018);
  return <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d={dialogueArrowPath(points)} fill="none" stroke="#fff" strokeWidth={outer} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/><path d={dialogueArrowPath(points)} fill="none" stroke="#111" strokeWidth={inner} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/><polygon points={`${h.tip.x},${h.tip.y} ${h.left.x},${h.left.y} ${h.right.x},${h.right.y}`} fill="#111" stroke="#fff" strokeWidth="0.8" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/></svg>;
}
function drawEditableDialogueArrow(ctx, points, canvasWidth, canvasHeight) {
  const [a,c,z] = points, sx = canvasWidth/100, sy = canvasHeight/100;
  const px = (q) => ({x:q.x*sx,y:q.y*sy}), pa=px(a), pc=px(c), pz=px(z), h=dialogueArrowHead(points), ht=px(h.tip), hl=px(h.left), hr=px(h.right);
  ctx.save(); ctx.beginPath(); ctx.moveTo(pa.x,pa.y); ctx.quadraticCurveTo(pc.x,pc.y,pz.x,pz.y); ctx.lineCap='round'; ctx.lineJoin='round'; ctx.strokeStyle='#fff'; ctx.lineWidth=Math.max(4,canvasWidth*.0042); ctx.stroke(); ctx.strokeStyle='#111'; ctx.lineWidth=Math.max(2,canvasWidth*.0018); ctx.stroke(); ctx.beginPath(); ctx.moveTo(ht.x,ht.y); ctx.lineTo(hl.x,hl.y); ctx.lineTo(hr.x,hr.y); ctx.closePath(); ctx.fillStyle='#111'; ctx.fill(); ctx.strokeStyle='#fff'; ctx.lineWidth=Math.max(1.5,canvasWidth*.0008); ctx.stroke(); ctx.restore();
}

'''
assert marker in s, 'helper insertion marker missing'
s = s.replace(marker, helpers + marker, 1)

old = "if (box.type === 'dialogue') await drawFixedDialogueArrow(ctx, box, x, y, width, height, canvas.width);"
new = "if (box.type === 'dialogue') { if (box.arrow_points?.length === 3) drawEditableDialogueArrow(ctx, box.arrow_points, canvas.width, canvas.height); else await drawFixedDialogueArrow(ctx, box, x, y, width, height, canvas.width); }"
assert old in s, 'export target missing'
s = s.replace(old, new, 1)

old = "const frameRef = useRef(null); const changeRef = useRef(onChange); const dragRef = useRef(null);"
new = "const frameRef = useRef(null); const changeRef = useRef(onChange); const dragRef = useRef(null); const arrowDragRef = useRef(null);"
assert old in s, 'editor refs target missing'
s = s.replace(old, new, 1)

old = """  const replace = (id, values) => changeRef.current(items.map((box) => box.id === id ? { ...box, ...values } : box));
  const add = (type) => { const index = items.length; const next = { id: crypto.randomUUID(), type, text: type === 'narration' ? (defaultNarration || '') : '', x: 6 + index * 3 % 28, y: 6 + index * 4 % 45, width: 42, height: 20, font_size: 26, arrow_preset: DEFAULT_DIALOGUE_ARROW_PRESET, arrow_position: 50 }; changeRef.current([...items, next]); setSelectedId(next.id); };
"""
new = """  const replace = (id, values) => changeRef.current(items.map((box) => box.id === id ? { ...box, ...values } : box));
  const beginArrowPoint = (event, box, pointIndex) => { if (disabled) return; event.preventDefault(); event.stopPropagation(); setSelectedId(box.id); const initial = dialogueArrowPoints(box); arrowDragRef.current = { id: box.id, pointIndex }; const move = (moveEvent) => { if (!arrowDragRef.current || !frameRef.current) return; const rect = frameRef.current.getBoundingClientRect(); const point = { x: Math.max(0, Math.min(100, ((moveEvent.clientX - rect.left) / rect.width) * 100)), y: Math.max(0, Math.min(100, ((moveEvent.clientY - rect.top) / rect.height) * 100)) }; const nextPoints = initial.map((item, index) => index === pointIndex ? point : item); changeRef.current(items.map((item) => item.id === box.id ? { ...item, arrow_points: nextPoints } : item)); }; const stop = () => { arrowDragRef.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop); window.addEventListener('pointercancel', stop); };
  const selectBox = (event, box) => { event.stopPropagation(); setSelectedId(box.id); if (box.type === 'dialogue' && !box.arrow_points) replace(box.id, { arrow_points: dialogueArrowPoints(box) }); };
  const add = (type) => { const index = items.length; const next = { id: crypto.randomUUID(), type, text: type === 'narration' ? (defaultNarration || '') : '', x: 6 + index * 3 % 28, y: 6 + index * 4 % 45, width: 42, height: 20, font_size: 26, arrow_preset: DEFAULT_DIALOGUE_ARROW_PRESET, arrow_position: 50 }; if (type === 'dialogue') next.arrow_points = dialogueArrowPoints(next); changeRef.current([...items, next]); setSelectedId(next.id); };
"""
assert old in s, 'editor methods target missing'
s = s.replace(old, new, 1)

old = """      {imageUrl ? <img src={imageUrl} alt=\"Text layout preview\" className=\"absolute inset-0 h-full w-full object-contain\" draggable={false} /> : <div className=\"absolute inset-0 flex items-center justify-center px-6 text-center text-xs font-bold text-white/35\">Prepare narration and dialogue boxes now. The generated image will appear behind them.</div>}
      {items.map((box) => <div key={box.id} onPointerDown={(event) => { event.stopPropagation(); setSelectedId(box.id); }} className={`absolute select-none bg-white text-black shadow-lg ${selectedId === box.id ? 'ring-4 ring-yellow-400' : 'ring-1 ring-black/70'}`} style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.width}%`, height: `${box.height}%`, fontSize: `${Math.max(9, frameWidth * box.font_size / 1300)}px` }}>
        {box.type === 'dialogue' && <FixedDialogueArrow presetId={box.arrow_preset} position={box.arrow_position} frameWidth={frameWidth} />}
"""
new = """      {imageUrl ? <img src={imageUrl} alt=\"Text layout preview\" className=\"absolute inset-0 h-full w-full object-contain\" draggable={false} /> : <div className=\"absolute inset-0 flex items-center justify-center px-6 text-center text-xs font-bold text-white/35\">Prepare narration and dialogue boxes now. The generated image will appear behind them.</div>}
      {items.map((box) => box.type === 'dialogue' && box.arrow_points?.length === 3 ? <EditableDialogueArrow key={`editable-arrow-${box.id}`} points={box.arrow_points} frameWidth={frameWidth} /> : null)}
      {selected?.type === 'dialogue' && selected.arrow_points?.length === 3 && selected.arrow_points.map((point, pointIndex) => <button type=\"button\" key={`arrow-point-${pointIndex}`} aria-label={pointIndex === 0 ? 'Arrow anchor point' : pointIndex === 1 ? 'Arrow curve point' : 'Arrow tip point'} onPointerDown={(event) => beginArrowPoint(event, selected, pointIndex)} className={`absolute z-30 h-5 w-5 -translate-x-1/2 -translate-y-1/2 border-2 shadow-lg ${pointIndex === 0 ? 'border-white bg-black' : pointIndex === 1 ? 'border-black bg-[#23c7be]' : 'border-white bg-red-500'}`} style={{ left: `${point.x}%`, top: `${point.y}%` }} />)}
      {items.map((box) => <div key={box.id} onPointerDown={(event) => selectBox(event, box)} className={`absolute select-none bg-white text-black shadow-lg ${selectedId === box.id ? 'ring-4 ring-yellow-400' : 'ring-1 ring-black/70'}`} style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.width}%`, height: `${box.height}%`, fontSize: `${Math.max(9, frameWidth * box.font_size / 1300)}px` }}>
        {box.type === 'dialogue' && !box.arrow_points && <FixedDialogueArrow presetId={box.arrow_preset} position={box.arrow_position} frameWidth={frameWidth} />}
"""
assert old in s, 'render target missing'
s = s.replace(old, new, 1)

p.write_text(s)
print('patched active FotoPlay')
