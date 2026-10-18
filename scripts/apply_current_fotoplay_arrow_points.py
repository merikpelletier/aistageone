from pathlib import Path
import re

path = Path('src/components/studio/AuthorProductionWorkspace.jsx')
text = path.read_text()

# 1) Preserve custom arrow control points in normalized dialogue boxes.
old = """    font_size: Number.isFinite(Number(box.font_size)) ? Number(box.font_size) : 26,
    arrow_preset: DIALOGUE_ARROW_PRESET_IDS.has(box.arrow_preset) ? box.arrow_preset : defaultDialogueArrowForLegacySide(box.tail_side),
    arrow_position: Math.max(10, Math.min(90, arrowPosition)),
"""
new = """    font_size: Number.isFinite(Number(box.font_size)) ? Number(box.font_size) : 26,
    arrow_preset: DIALOGUE_ARROW_PRESET_IDS.has(box.arrow_preset) ? box.arrow_preset : defaultDialogueArrowForLegacySide(box.tail_side),
    arrow_position: Math.max(10, Math.min(90, arrowPosition)),
    arrow_points: Array.isArray(box.arrow_points) && box.arrow_points.length === 3
      ? box.arrow_points.map((point) => ({ x: Math.max(0, Math.min(100, Number(point?.x) || 0)), y: Math.max(0, Math.min(100, Number(point?.y) || 0)) }))
      : null,
"""
assert old in text, 'normalize block not found'
text = text.replace(old, new, 1)

# 2) Helpers for default 3-point geometry, SVG display, and export rendering.
marker = "function roundedRect(ctx, x, y, width, height, radius) {"
helpers = r'''function dialogueArrowPoints(box) {
  if (Array.isArray(box?.arrow_points) && box.arrow_points.length === 3) return box.arrow_points;
  const x = Number(box?.x) || 0; const y = Number(box?.y) || 0;
  const width = Math.max(1, Number(box?.width) || 1); const height = Math.max(1, Number(box?.height) || 1);
  const anchorX = Math.max(0, Math.min(100, x + width * ((Number(box?.arrow_position) || 50) / 100)));
  const anchorY = Math.max(0, Math.min(100, y + height));
  const tipX = Math.max(0, Math.min(100, anchorX + 10));
  const tipY = Math.max(0, Math.min(100, anchorY + 16));
  return [
    { x: anchorX, y: anchorY },
    { x: Math.max(0, Math.min(100, anchorX + 4)), y: Math.max(0, Math.min(100, anchorY + 8)) },
    { x: tipX, y: tipY },
  ];
}
function dialogueArrowPath(points) {
  const [a, c, z] = points;
  return `M ${a.x} ${a.y} Q ${c.x} ${c.y} ${z.x} ${z.y}`;
}
function dialogueArrowHead(points) {
  const [, c, z] = points; const dx = z.x - c.x; const dy = z.y - c.y; const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len; const uy = dy / len; const size = 2.1; const half = 0.9;
  const bx = z.x - ux * size; const by = z.y - uy * size;
  return { tip: z, left: { x: bx - uy * half, y: by + ux * half }, right: { x: bx + uy * half, y: by - ux * half } };
}
function EditableDialogueArrow({ points, frameWidth }) {
  const head = dialogueArrowHead(points); const outer = Math.max(4, frameWidth * 0.0042); const inner = Math.max(2, frameWidth * 0.0018);
  return <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <path d={dialogueArrowPath(points)} fill="none" stroke="#fff" strokeWidth={outer} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    <path d={dialogueArrowPath(points)} fill="none" stroke="#111" strokeWidth={inner} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    <polygon points={`${head.tip.x},${head.tip.y} ${head.left.x},${head.left.y} ${head.right.x},${head.right.y}`} fill="#111" stroke="#fff" strokeWidth="0.8" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
  </svg>;
}
function drawEditableDialogueArrow(ctx, points, canvasWidth, canvasHeight) {
  const [a, c, z] = points; const sx = canvasWidth / 100; const sy = canvasHeight / 100;
  const p = (point) => ({ x: point.x * sx, y: point.y * sy }); const pa = p(a); const pc = p(c); const pz = p(z);
  const head = dialogueArrowHead(points); const ht = p(head.tip); const hl = p(head.left); const hr = p(head.right);
  ctx.save(); ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.quadraticCurveTo(pc.x, pc.y, pz.x, pz.y);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(4, canvasWidth * 0.0042); ctx.stroke();
  ctx.strokeStyle = '#111'; ctx.lineWidth = Math.max(2, canvasWidth * 0.0018); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ht.x, ht.y); ctx.lineTo(hl.x, hl.y); ctx.lineTo(hr.x, hr.y); ctx.closePath(); ctx.fillStyle = '#111'; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, canvasWidth * 0.0008); ctx.stroke(); ctx.restore();
}

'''
assert marker in text, 'roundedRect marker not found'
text = text.replace(marker, helpers + marker, 1)

# 3) Use the exact same custom geometry in final image export.
old = "if (box.type === 'dialogue') await drawFixedDialogueArrow(ctx, box, x, y, width, height, canvas.width);"
new = "if (box.type === 'dialogue') { if (box.arrow_points?.length === 3) drawEditableDialogueArrow(ctx, box.arrow_points, canvas.width, canvas.height); else await drawFixedDialogueArrow(ctx, box, x, y, width, height, canvas.width); }"
assert old in text, 'export arrow line not found'
text = text.replace(old, new, 1)

# 4) Add direct point dragging in the CURRENT FotoPlay editor.
old = "const frameRef = useRef(null); const changeRef = useRef(onChange); const dragRef = useRef(null);"
new = "const frameRef = useRef(null); const changeRef = useRef(onChange); const dragRef = useRef(null); const arrowDragRef = useRef(null);"
assert old in text, 'editor refs line not found'
text = text.replace(old, new, 1)

old = """  const replace = (id, values) => changeRef.current(items.map((box) => box.id === id ? { ...box, ...values } : box));
  const add = (type) => { const index = items.length; const next = { id: crypto.randomUUID(), type, text: type === 'narration' ? (defaultNarration || '') : '', x: 6 + index * 3 % 28, y: 6 + index * 4 % 45, width: 42, height: 20, font_size: 26, arrow_preset: DEFAULT_DIALOGUE_ARROW_PRESET, arrow_position: 50 }; changeRef.current([...items, next]); setSelectedId(next.id); };
"""
new = """  const replace = (id, values) => changeRef.current(items.map((box) => box.id === id ? { ...box, ...values } : box));
  const beginArrowPoint = (event, box, pointIndex) => {
    if (disabled) return; event.preventDefault(); event.stopPropagation(); setSelectedId(box.id);
    const initial = dialogueArrowPoints(box); arrowDragRef.current = { id: box.id, pointIndex };
    const move = (moveEvent) => {
      if (!arrowDragRef.current || !frameRef.current) return;
      const rect = frameRef.current.getBoundingClientRect();
      const point = { x: Math.max(0, Math.min(100, ((moveEvent.clientX - rect.left) / rect.width) * 100)), y: Math.max(0, Math.min(100, ((moveEvent.clientY - rect.top) / rect.height) * 100)) };
      const nextPoints = initial.map((item, index) => index === pointIndex ? point : item);
      changeRef.current(items.map((item) => item.id === box.id ? { ...item, arrow_points: nextPoints } : item));
    };
    const stop = () => { arrowDragRef.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop); window.addEventListener('pointercancel', stop);
  };
  const selectBox = (event, box) => {
    event.stopPropagation(); setSelectedId(box.id);
    if (box.type === 'dialogue' && !box.arrow_points) replace(box.id, { arrow_points: dialogueArrowPoints(box) });
  };
  const add = (type) => { const index = items.length; const next = { id: crypto.randomUUID(), type, text: type === 'narration' ? (defaultNarration || '') : '', x: 6 + index * 3 % 28, y: 6 + index * 4 % 45, width: 42, height: 20, font_size: 26, arrow_preset: DEFAULT_DIALOGUE_ARROW_PRESET, arrow_position: 50 }; if (type === 'dialogue') next.arrow_points = dialogueArrowPoints(next); changeRef.current([...items, next]); setSelectedId(next.id); };
"""
assert old in text, 'replace/add block not found'
text = text.replace(old, new, 1)

# 5) Render curves across the image and 3 draggable point handles for the selected dialogue.
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
assert old in text, 'frame render block not found'
text = text.replace(old, new, 1)

# 6) Make the direct-on-image interaction explicit, without removing existing controls.
old = '<span className="text-[11px] text-white/45">Drag the yellow handle to move · drag the corner to resize</span>'
new = '<span className="text-[11px] text-white/45">Drag the yellow handle to move · drag the corner to resize · select a Dialogue and drag its 3 arrow points directly on the image</span>'
assert old in text, 'helper text not found'
text = text.replace(old, new, 1)

path.write_text(text)
print('patched', path)
