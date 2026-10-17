import React from 'react';

export const DIALOGUE_ARROW_CANVAS_BASE = 1600;
export const DEFAULT_DIALOGUE_ARROW_PRESET = 'curve-bottom-right-short';

export const DIALOGUE_ARROW_PRESETS = [
  { id: 'curve-bottom-left-short', label: 'Curve short ↙', family: 'curve', length: 'short', side: 'bottom', src: '/fotoplay/dialogue-arrows/curve-bottom-left-short.svg', width: 100, height: 80, anchorX: 76, anchorY: 0 },
  { id: 'curve-bottom-right-short', label: 'Curve short ↘', family: 'curve', length: 'short', side: 'bottom', src: '/fotoplay/dialogue-arrows/curve-bottom-right-short.svg', width: 100, height: 80, anchorX: 24, anchorY: 0 },
  { id: 'curve-bottom-left-long', label: 'Curve long ↙', family: 'curve', length: 'long', side: 'bottom', src: '/fotoplay/dialogue-arrows/curve-bottom-left-long.svg', width: 150, height: 110, anchorX: 116, anchorY: 0 },
  { id: 'curve-bottom-right-long', label: 'Curve long ↘', family: 'curve', length: 'long', side: 'bottom', src: '/fotoplay/dialogue-arrows/curve-bottom-right-long.svg', width: 150, height: 110, anchorX: 34, anchorY: 0 },
  { id: 'curve-top-left-long', label: 'Curve top ↖', family: 'curve', length: 'long', side: 'top', src: '/fotoplay/dialogue-arrows/curve-top-left-long.svg', width: 150, height: 110, anchorX: 116, anchorY: 110 },
  { id: 'curve-top-right-long', label: 'Curve top ↗', family: 'curve', length: 'long', side: 'top', src: '/fotoplay/dialogue-arrows/curve-top-right-long.svg', width: 150, height: 110, anchorX: 34, anchorY: 110 },
  { id: 'curve-left-up-short', label: 'Curve left ↖', family: 'curve', length: 'short', side: 'left', src: '/fotoplay/dialogue-arrows/curve-left-up-short.svg', width: 90, height: 100, anchorX: 90, anchorY: 72 },
  { id: 'curve-left-down-short', label: 'Curve left ↙', family: 'curve', length: 'short', side: 'left', src: '/fotoplay/dialogue-arrows/curve-left-down-short.svg', width: 90, height: 100, anchorX: 90, anchorY: 28 },
  { id: 'curve-right-up-short', label: 'Curve right ↗', family: 'curve', length: 'short', side: 'right', src: '/fotoplay/dialogue-arrows/curve-right-up-short.svg', width: 90, height: 100, anchorX: 0, anchorY: 72 },
  { id: 'curve-right-down-short', label: 'Curve right ↘', family: 'curve', length: 'short', side: 'right', src: '/fotoplay/dialogue-arrows/curve-right-down-short.svg', width: 90, height: 100, anchorX: 0, anchorY: 28 },
  { id: 'angle-bottom-left', label: 'Angle ↙', family: 'angle', length: 'medium', side: 'bottom', src: '/fotoplay/dialogue-arrows/angle-bottom-left.svg', width: 120, height: 90, anchorX: 90, anchorY: 0 },
  { id: 'angle-bottom-right', label: 'Angle ↘', family: 'angle', length: 'medium', side: 'bottom', src: '/fotoplay/dialogue-arrows/angle-bottom-right.svg', width: 120, height: 90, anchorX: 30, anchorY: 0 },
  { id: 'angle-left-long', label: 'Angle left', family: 'angle', length: 'long', side: 'left', src: '/fotoplay/dialogue-arrows/angle-left-long.svg', width: 150, height: 100, anchorX: 150, anchorY: 50 },
  { id: 'angle-right-long', label: 'Angle right', family: 'angle', length: 'long', side: 'right', src: '/fotoplay/dialogue-arrows/angle-right-long.svg', width: 150, height: 100, anchorX: 0, anchorY: 50 },
];

const PRESETS = new Map(DIALOGUE_ARROW_PRESETS.map((preset) => [preset.id, preset]));
const clampPosition = (value) => Math.max(10, Math.min(90, Number(value) || 50));

export function defaultDialogueArrowForLegacySide(side) {
  if (side === 'top') return 'curve-top-right-long';
  if (side === 'left') return 'curve-left-down-short';
  if (side === 'right') return 'curve-right-down-short';
  return DEFAULT_DIALOGUE_ARROW_PRESET;
}

export function dialogueArrowPreset(id) {
  return PRESETS.get(id) || PRESETS.get(DEFAULT_DIALOGUE_ARROW_PRESET);
}

function tailGeometry(preset) {
  const w = preset.width;
  const h = preset.height;
  const id = preset.id;
  const baseHalf = Math.max(5, Math.min(11, Math.min(w, h) * 0.1));
  let a;
  let b;
  let tip;

  if (preset.side === 'top' || preset.side === 'bottom') {
    const edgeY = preset.side === 'top' ? h : 0;
    const tipY = preset.side === 'top' ? h * 0.08 : h * 0.92;
    const tipX = id.includes('left') ? w * 0.12 : w * 0.88;
    a = { x: preset.anchorX - baseHalf, y: edgeY };
    b = { x: preset.anchorX + baseHalf, y: edgeY };
    tip = { x: tipX, y: tipY };
  } else {
    const edgeX = preset.side === 'left' ? w : 0;
    const tipX = preset.side === 'left' ? w * 0.08 : w * 0.92;
    const tipY = id.includes('up') ? h * 0.12 : id.includes('down') ? h * 0.88 : h * 0.5;
    a = { x: edgeX, y: preset.anchorY - baseHalf };
    b = { x: edgeX, y: preset.anchorY + baseHalf };
    tip = { x: tipX, y: tipY };
  }

  const controlA = { x: a.x * 0.46 + tip.x * 0.54, y: a.y * 0.46 + tip.y * 0.54 };
  const controlB = { x: b.x * 0.46 + tip.x * 0.54, y: b.y * 0.46 + tip.y * 0.54 };
  return { a, b, tip, controlA, controlB };
}

function tailPath(preset) {
  const tail = tailGeometry(preset);
  return `M ${tail.a.x} ${tail.a.y} Q ${tail.controlA.x} ${tail.controlA.y} ${tail.tip.x} ${tail.tip.y} Q ${tail.controlB.x} ${tail.controlB.y} ${tail.b.x} ${tail.b.y} Z`;
}

function editorArrowStyle(preset, position, frameWidth) {
  const scale = Math.max(0.01, Number(frameWidth) || 800) / DIALOGUE_ARROW_CANVAS_BASE;
  const width = preset.width * scale;
  const height = preset.height * scale;
  const anchorX = preset.anchorX * scale;
  const anchorY = preset.anchorY * scale;
  const at = clampPosition(position);
  const common = { position: 'absolute', pointerEvents: 'none', zIndex: 1, width, height, maxWidth: 'none', maxHeight: 'none', overflow: 'visible' };
  if (preset.side === 'top') return { ...common, left: `calc(${at}% - ${anchorX}px)`, top: `${-anchorY}px` };
  if (preset.side === 'left') return { ...common, left: `${-anchorX}px`, top: `calc(${at}% - ${anchorY}px)` };
  if (preset.side === 'right') return { ...common, left: `calc(100% - ${anchorX}px)`, top: `calc(${at}% - ${anchorY}px)` };
  return { ...common, left: `calc(${at}% - ${anchorX}px)`, top: `calc(100% - ${anchorY}px)` };
}

export function FixedDialogueArrow({ presetId, position = 50, frameWidth = 800 }) {
  const preset = dialogueArrowPreset(presetId);
  return <svg aria-hidden="true" viewBox={`0 0 ${preset.width} ${preset.height}`} preserveAspectRatio="none" style={editorArrowStyle(preset, position, frameWidth)}>
    <path d={tailPath(preset)} fill="#fff" stroke="#111" strokeWidth="2.2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
  </svg>;
}

export async function drawFixedDialogueArrow(ctx, box, x, y, width, height, canvasWidth) {
  const preset = dialogueArrowPreset(box.arrow_preset);
  const scale = Math.max(0.01, Number(canvasWidth) || DIALOGUE_ARROW_CANVAS_BASE) / DIALOGUE_ARROW_CANVAS_BASE;
  const drawWidth = preset.width * scale;
  const drawHeight = preset.height * scale;
  const anchorX = preset.anchorX * scale;
  const anchorY = preset.anchorY * scale;
  const position = clampPosition(box.arrow_position) / 100;
  let originX;
  let originY;

  if (preset.side === 'top') {
    originX = x + width * position - anchorX;
    originY = y - anchorY;
  } else if (preset.side === 'left') {
    originX = x - anchorX;
    originY = y + height * position - anchorY;
  } else if (preset.side === 'right') {
    originX = x + width - anchorX;
    originY = y + height * position - anchorY;
  } else {
    originX = x + width * position - anchorX;
    originY = y + height - anchorY;
  }

  const tail = tailGeometry(preset);
  const map = (point) => ({ x: originX + point.x * scale, y: originY + point.y * scale });
  const a = map(tail.a);
  const b = map(tail.b);
  const tip = map(tail.tip);
  const controlA = map(tail.controlA);
  const controlB = map(tail.controlB);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(controlA.x, controlA.y, tip.x, tip.y);
  ctx.quadraticCurveTo(controlB.x, controlB.y, b.x, b.y);
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = Math.max(2, canvasWidth * 0.0018);
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}
