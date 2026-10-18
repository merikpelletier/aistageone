from pathlib import Path

p = Path('src/components/studio/AuthorProductionWorkspacePage.jsx')
s = p.read_text()
start = s.index('function pointerControlPoints(box, points) {')
end = s.index('function comicPageSignature', start)
new = '''function pointerControlPoints(box, points) {
  const clean = normalizePointerPath(points);
  if (box?.pointer_shape === 'triangle' && clean.length >= 3) return [clean[0], clean[1], clean[2]];
  const x = Number(box?.x) || 0; const y = Number(box?.y) || 0;
  const w = Math.max(1, Number(box?.width) || 1); const h = Math.max(1, Number(box?.height) || 1);
  const baseY = Math.max(0, Math.min(100, y + h));
  const centerX = Math.max(0, Math.min(100, x + w * 0.5));
  const halfBase = Math.max(1.8, Math.min(5, w * 0.12));
  const left = { x: Math.max(0, Math.min(100, centerX - halfBase)), y: baseY };
  const right = { x: Math.max(0, Math.min(100, centerX + halfBase)), y: baseY };
  const legacyTip = clean.length ? clean[clean.length - 1] : null;
  const tip = legacyTip || { x: Math.max(0, Math.min(100, centerX + Math.min(10, w * 0.25))), y: Math.max(0, Math.min(100, baseY + 18)) };
  return [left, right, tip];
}

function DialoguePointerPath({ points, box }) {
  const triangle = pointerControlPoints(box, points);
  return <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <polygon points={`${triangle[0].x},${triangle[0].y} ${triangle[1].x},${triangle[1].y} ${triangle[2].x},${triangle[2].y}`} fill="#fff" stroke="#111" strokeWidth="0.45" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
  </svg>;
}

function drawDialoguePointerCanvas(ctx, box, points, canvasWidth, canvasHeight) {
  const triangle = pointerControlPoints(box, points);
  const px = (point) => ({ x: point.x * canvasWidth / 100, y: point.y * canvasHeight / 100 });
  const [a, b, c] = triangle.map(px);
  ctx.save();
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath();
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.strokeStyle = '#111'; ctx.lineWidth = Math.max(2, canvasWidth * 0.0015); ctx.lineJoin = 'round'; ctx.stroke();
  ctx.restore();
}

'''
s = s[:start] + new + s[end:]
s = s.replace("if (box.pointer_path?.length >= 2) drawDialoguePointerCanvas(ctx, box, box.pointer_path, canvas.width, canvas.height);\n      else if (box.arrow_preset) await drawFixedDialogueArrow(ctx, box, x, y, w, h, canvas.width);", "drawDialoguePointerCanvas(ctx, box, box.pointer_path, canvas.width, canvas.height);")
s = s.replace("box.type === 'dialogue' && box.pointer_path?.length >= 2 && box.id !== drawingBoxId ? <DialoguePointerPath", "box.type === 'dialogue' && box.id !== drawingBoxId ? <DialoguePointerPath")
s = s.replace("{ ...box, pointer_path: next, arrow_preset: null, arrow_position: 50 }", "{ ...box, pointer_path: next, pointer_shape: 'triangle', arrow_preset: null, arrow_position: 50 }")
s = s.replace("{ ...item, pointer_path: points, arrow_preset: null, arrow_position: 50 }", "{ ...item, pointer_path: points, pointer_shape: 'triangle', arrow_preset: null, arrow_position: 50 }")
s = s.replace('use EDIT ARROW. Three reference points appear directly on the image so you can shape the arrow toward the speaker.', 'use EDIT TRIANGLE. Three reference points appear directly on the image so you can set the two base corners and point the triangle toward the speaker.')
s = s.replace('EDIT ARROW', 'EDIT TRIANGLE')
p.write_text(s)
