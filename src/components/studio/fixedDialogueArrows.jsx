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
const bitmapCache = new Map();
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

function editorArrowStyle(preset, position, frameWidth) {
  const scale = Math.max(0.01, Number(frameWidth) || 800) / DIALOGUE_ARROW_CANVAS_BASE;
  const width = preset.width * scale;
  const height = preset.height * scale;
  const anchorX = preset.anchorX * scale;
  const anchorY = preset.anchorY * scale;
  const at = clampPosition(position);
  const common = { position: 'absolute', pointerEvents: 'none', zIndex: 1, width, height, maxWidth: 'none', maxHeight: 'none' };
  if (preset.side === 'top') return { ...common, left: `calc(${at}% - ${anchorX}px)`, bottom: `${anchorY - height}px` };
  if (preset.side === 'left') return { ...common, right: `${anchorX - width}px`, top: `calc(${at}% - ${anchorY}px)` };
  if (preset.side === 'right') return { ...common, left: `${-anchorX}px`, top: `calc(${at}% - ${anchorY}px)` };
  return { ...common, left: `calc(${at}% - ${anchorX}px)`, top: `${-anchorY}px` };
}

export function FixedDialogueArrow({ presetId, position = 50, frameWidth = 800 }) {
  const preset = dialogueArrowPreset(presetId);
  return <img aria-hidden="true" src={preset.src} alt="" draggable={false} style={editorArrowStyle(preset, position, frameWidth)} />;
}

async function arrowBitmap(src) {
  if (!bitmapCache.has(src)) {
    bitmapCache.set(src, fetch(src).then((response) => {
      if (!response.ok) throw new Error(`Unable to load fixed dialogue arrow: ${src}`);
      return response.blob();
    }).then((blob) => createImageBitmap(blob)));
  }
  return bitmapCache.get(src);
}

export async function drawFixedDialogueArrow(ctx, box, x, y, width, height, canvasWidth) {
  const preset = dialogueArrowPreset(box.arrow_preset);
  const bitmap = await arrowBitmap(preset.src);
  const scale = Math.max(0.01, Number(canvasWidth) || DIALOGUE_ARROW_CANVAS_BASE) / DIALOGUE_ARROW_CANVAS_BASE;
  const drawWidth = preset.width * scale;
  const drawHeight = preset.height * scale;
  const anchorX = preset.anchorX * scale;
  const anchorY = preset.anchorY * scale;
  const position = clampPosition(box.arrow_position) / 100;
  let anchorCanvasX;
  let anchorCanvasY;
  if (preset.side === 'top') { anchorCanvasX = x + width * position; anchorCanvasY = y; }
  else if (preset.side === 'left') { anchorCanvasX = x; anchorCanvasY = y + height * position; }
  else if (preset.side === 'right') { anchorCanvasX = x + width; anchorCanvasY = y + height * position; }
  else { anchorCanvasX = x + width * position; anchorCanvasY = y + height; }
  ctx.drawImage(bitmap, anchorCanvasX - anchorX, anchorCanvasY - anchorY, drawWidth, drawHeight);
}
