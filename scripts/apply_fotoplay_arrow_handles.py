from pathlib import Path
import re

path = Path('src/components/studio/AuthorProductionWorkspacePage.jsx')
text = path.read_text()

helper_pattern = re.compile(r"function dialogueTailGeometry\(box, points\) \{.*?\n\}\n\nfunction comicPageSignature", re.S)
helper_replacement = r'''function pointerControlPoints(box, points) {
  const clean = normalizePointerPath(points);
  if (clean.length >= 3) return [clean[0], clean[Math.floor((clean.length - 1) / 2)], clean[clean.length - 1]];
  if (clean.length === 2) return [clean[0], { x: (clean[0].x + clean[1].x) / 2, y: (clean[0].y + clean[1].y) / 2 }, clean[1]];
  const x = Number(box?.x) || 0; const y = Number(box?.y) || 0;
  const w = Math.max(1, Number(box?.width) || 1); const h = Math.max(1, Number(box?.height) || 1);
  const start = { x: Math.max(0, Math.min(100, x + w * 0.5)), y: Math.max(0, Math.min(100, y + h)) };
  const tip = { x: Math.max(0, Math.min(100, start.x + 10)), y: Math.max(0, Math.min(100, start.y + 18)) };
  const control = { x: Math.max(0, Math.min(100, start.x + 4)), y: Math.max(0, Math.min(100, (start.y + tip.y) / 2)) };
  return [start, control, tip];
}

function pointerCurvePath(box, points) {
  const [start, control, tip] = pointerControlPoints(box, points);
  return `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${tip.x} ${tip.y}`;
}

function pointerArrowHead(box, points) {
  const [, control, tip] = pointerControlPoints(box, points);
  const dx = tip.x - control.x; const dy = tip.y - control.y;
  const length = Math.hypot(dx, dy) || 1; const ux = dx / length; const uy = dy / length;
  const size = 2.2; const half = 0.95;
  const baseX = tip.x - ux * size; const baseY = tip.y - uy * size;
  return { tip, left: { x: baseX - uy * half, y: baseY + ux * half }, right: { x: baseX + uy * half, y: baseY - ux * half } };
}

function DialoguePointerPath({ points, box, frameWidth = 900 }) {
  const path = pointerCurvePath(box, points);
  const head = pointerArrowHead(box, points);
  const outer = Math.max(4, frameWidth * 0.0042); const inner = Math.max(2, frameWidth * 0.0018);
  return <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <path d={path} fill="none" stroke="#fff" strokeWidth={outer} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    <path d={path} fill="none" stroke="#111" strokeWidth={inner} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    <polygon points={`${head.tip.x},${head.tip.y} ${head.left.x},${head.left.y} ${head.right.x},${head.right.y}`} fill="#111" stroke="#fff" strokeWidth="0.8" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
  </svg>;
}

function drawDialoguePointerCanvas(ctx, box, points, canvasWidth, canvasHeight) {
  const [start, control, tip] = pointerControlPoints(box, points);
  const sx = canvasWidth / 100; const sy = canvasHeight / 100;
  const p = (point) => ({ x: point.x * sx, y: point.y * sy });
  const a = p(start); const c = p(control); const z = p(tip);
  const head = pointerArrowHead(box, points); const ht = p(head.tip); const hl = p(head.left); const hr = p(head.right);
  ctx.save();
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(c.x, c.y, z.x, z.y);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(4, canvasWidth * 0.0042); ctx.stroke();
  ctx.strokeStyle = '#111'; ctx.lineWidth = Math.max(2, canvasWidth * 0.0018); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ht.x, ht.y); ctx.lineTo(hl.x, hl.y); ctx.lineTo(hr.x, hr.y); ctx.closePath(); ctx.fillStyle = '#111'; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, canvasWidth * 0.0008); ctx.stroke(); ctx.restore();
}

function comicPageSignature'''
text, count = helper_pattern.subn(helper_replacement, text, count=1)
assert count == 1, f'helper block matches: {count}'

old_state = "  const pointerDraftRef = useRef([]); const [drawingBoxId, setDrawingBoxId] = useState(''); const [pointerDraft, setPointerDraft] = useState([]);"
new_state = "  const pointerPointsRef = useRef([]); const pointerDragRef = useRef(null); const [drawingBoxId, setDrawingBoxId] = useState(''); const [pointerDraft, setPointerDraft] = useState([]);"
assert old_state in text
text = text.replace(old_state, new_state, 1)

old_items = "  const items = normalizedTextBoxes(boxes);"
new_items = "  const items = normalizedTextBoxes(boxes);\n  const editingBox = items.find((box) => box.id === drawingBoxId);"
assert old_items in text
text = text.replace(old_items, new_items, 1)

methods_pattern = re.compile(r"  const pointFromEvent = .*?\n  const pageWidth =", re.S)
methods_replacement = r'''  const pointFromEvent = (event) => { const rect = ref.current?.getBoundingClientRect(); if (!rect) return null; return { x: Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)), y: Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100)) }; };
  const startPointerHandle = (event, index) => { if (!drawingBoxId) return; event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture?.(event.pointerId); pointerDragRef.current = { index, pointerId: event.pointerId }; };
  const movePointerHandle = (event) => { const dragState = pointerDragRef.current; if (!drawingBoxId || !dragState) return; event.preventDefault(); const point = pointFromEvent(event); if (!point) return; const next = [...pointerPointsRef.current]; next[dragState.index] = point; pointerPointsRef.current = next; setPointerDraft(next); onBoxesChange(items.map((box) => box.id === drawingBoxId ? { ...box, pointer_path: next, arrow_preset: null, arrow_position: 50 } : box)); };
  const finishPointerHandle = (event) => { if (!pointerDragRef.current) return; movePointerHandle(event); pointerDragRef.current = null; };
  const pageWidth ='''
text, count = methods_pattern.subn(methods_replacement, text, count=1)
assert count == 1, f'method block matches: {count}'

pointer_layer_pattern = re.compile(r'    <div className="pointer-events-none absolute inset-0 z-10">.*?</div>\n', re.S)
pointer_layer_replacement = '''    <div className="pointer-events-none absolute inset-0 z-10">{items.map((box) => box.type === 'dialogue' && box.pointer_path?.length >= 2 && box.id !== drawingBoxId ? <DialoguePointerPath key={`pointer-${box.id}`} points={box.pointer_path} box={box} frameWidth={width} /> : null)}</div>\n'''
text, count = pointer_layer_pattern.subn(pointer_layer_replacement, text, count=1)
assert count == 1, f'pointer layer matches: {count}'

old_draw = "onClick={(event) => { event.stopPropagation(); pointerDraftRef.current = []; setPointerDraft([]); setDrawingBoxId(box.id); }}"
new_draw = "onClick={(event) => { event.stopPropagation(); const points = pointerControlPoints(box, box.pointer_path); pointerPointsRef.current = points; setPointerDraft(points); setDrawingBoxId(box.id); onBoxesChange(items.map((item) => item.id === box.id ? { ...item, pointer_path: points, arrow_preset: null, arrow_position: 50 } : item)); }}"
assert old_draw in text
text = text.replace(old_draw, new_draw, 1)
text = text.replace("{box.pointer_path?.length >= 2 ? 'REDRAW' : 'DRAW'}", "EDIT ARROW", 1)

old_overlay = "    {drawingBoxId && <div className=\"absolute inset-0 z-40 cursor-crosshair touch-none\" onPointerDown={startPointer} onPointerMove={movePointer} onPointerUp={finishPointer} onPointerCancel={finishPointer}><div className=\"pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 bg-[#23c7be] px-3 py-1.5 text-[10px] font-black uppercase text-black shadow-lg\">Draw from the dialogue box toward the speaker</div></div>}"
new_overlay = """    {drawingBoxId && editingBox && <div className=\"absolute inset-0 z-40 touch-none\" onPointerDown={(event) => { if (event.target === event.currentTarget) { pointerDragRef.current = null; pointerPointsRef.current = []; setPointerDraft([]); setDrawingBoxId(''); } }} onPointerMove={movePointerHandle} onPointerUp={finishPointerHandle} onPointerCancel={finishPointerHandle}>\n      <DialoguePointerPath points={pointerDraft} box={editingBox} frameWidth={width} />\n      {pointerDraft.map((point, index) => <button type=\"button\" key={`pointer-handle-${index}`} aria-label={index === 0 ? 'Arrow anchor' : index === 1 ? 'Arrow curve' : 'Arrow tip'} onPointerDown={(event) => startPointerHandle(event, index)} className={`absolute z-50 h-5 w-5 -translate-x-1/2 -translate-y-1/2 border-2 shadow-lg ${index === 0 ? 'border-white bg-black' : index === 1 ? 'border-black bg-[#23c7be]' : 'border-white bg-red-500'}`} style={{ left: `${point.x}%`, top: `${point.y}%` }} />)}\n      <div className=\"pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 bg-[#23c7be] px-3 py-1.5 text-[10px] font-black uppercase text-black shadow-lg\">Drag the 3 reference points · click outside to finish</div>\n    </div>}"""
assert old_overlay in text
text = text.replace(old_overlay, new_overlay, 1)

text = text.replace('For dialogue, select the block on the page and use DRAW to trace the pointer directly toward the speaker.', 'For dialogue, select the block on the page and use EDIT ARROW. Three reference points appear directly on the image so you can shape the arrow toward the speaker.', 1)
text = text.replace('Select this dialogue on the page. DRAW traces a new pointer directly on the segment; REDRAW replaces it; CLEAR removes it.', 'Select this dialogue on the page. EDIT ARROW shows three reference points directly on the image: anchor, curve and tip. Drag them to shape the arrow; CLEAR removes it.', 1)

path.write_text(text)
print('patched', path)
