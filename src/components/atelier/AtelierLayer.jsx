import React, { useEffect, useRef } from 'react';
import { Copy, GripHorizontal, RotateCw, Trash2 } from 'lucide-react';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default function AtelierLayer({ layer, selected, canvasWidth, canvasHeight, onSelect, onChange, onDelete, onDuplicate }) {
  const editorRef = useRef(null);

  useEffect(() => { if (selected && layer.type === 'text' && !layer.locked) editorRef.current?.focus(); }, [selected, layer.type, layer.locked]);

  const bindPointerMove = (event, move) => {
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture?.(event.pointerId);
    const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); window.removeEventListener('pointercancel', stop); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop, { once: true }); window.addEventListener('pointercancel', stop, { once: true });
  };

  const startDrag = (event, fromHandle = false) => {
    event.stopPropagation(); onSelect(layer.id); if (layer.locked || (selected && layer.type === 'text' && !fromHandle)) return;
    const startX = event.clientX; const startY = event.clientY; const originX = Number(layer.x) || 0; const originY = Number(layer.y) || 0;
    bindPointerMove(event, (moveEvent) => onChange(layer.id, {
      x: Math.round(clamp(originX + moveEvent.clientX - startX, 0, Math.max(0, canvasWidth - layer.w))),
      y: Math.round(clamp(originY + moveEvent.clientY - startY, 0, Math.max(0, canvasHeight - layer.h))),
    }));
  };

  const startResize = (event) => {
    if (layer.locked) return;
    const startX = event.clientX; const startY = event.clientY; const originWidth = Number(layer.w) || 24; const originHeight = Number(layer.h) || 24;
    bindPointerMove(event, (moveEvent) => onChange(layer.id, {
      w: Math.round(clamp(originWidth + moveEvent.clientX - startX, 24, canvasWidth - layer.x)),
      h: Math.round(clamp(originHeight + moveEvent.clientY - startY, 24, canvasHeight - layer.y)),
    }));
  };

  const startRotate = (event) => {
    if (layer.locked) return;
    const rect = event.currentTarget.parentElement.getBoundingClientRect(); const centerX = rect.left + rect.width / 2; const centerY = rect.top + rect.height / 2;
    bindPointerMove(event, (moveEvent) => onChange(layer.id, { rotation: Math.round(Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) * 180 / Math.PI + 90) }));
  };

  const textStyle = { fontSize: layer.fontSize || 18, color: layer.color || '#ffffff', fontWeight: layer.fontWeight || 700, textAlign: layer.align || 'center', fontFamily: layer.fontFamily || 'Georgia, serif', lineHeight: 1.1, whiteSpace: 'pre-wrap', letterSpacing: layer.letterSpacing ? `${layer.letterSpacing}px` : 'normal', textTransform: layer.uppercase ? 'uppercase' : 'none' };

  return <div onPointerDown={startDrag} className={`absolute select-none ${layer.locked ? 'cursor-default' : 'cursor-move'} ${selected ? 'outline outline-2 outline-yellow-400' : ''}`} style={{ left: layer.x, top: layer.y, width: layer.w, height: layer.h, zIndex: layer.zIndex ?? 1, opacity: layer.opacity ?? 1, transform: `rotate(${layer.rotation || 0}deg)` }}>
    {layer.type === 'image' ? <img src={layer.url} alt="" draggable={false} className="h-full w-full pointer-events-none" style={{ objectFit: layer.objectFit || 'cover', borderRadius: layer.radius || 0 }} /> : selected && !layer.locked ? <textarea ref={editorRef} value={layer.content || ''} onChange={(event) => onChange(layer.id, { content: event.target.value })} onPointerDown={(event) => event.stopPropagation()} className="h-full w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none" style={textStyle} /> : <div className="flex h-full w-full items-center justify-center overflow-hidden pointer-events-none" style={textStyle}>{layer.content || 'Text'}</div>}
    {selected && !layer.locked && <><button type="button" aria-label="Move layer" onPointerDown={(event) => startDrag(event, true)} className="absolute -top-3 left-1/2 flex h-6 -translate-x-1/2 items-center rounded-full bg-yellow-400 px-2 text-black shadow-lg"><GripHorizontal size={13} /></button><button type="button" aria-label="Delete layer" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onDelete(layer.id); }} className="absolute -top-3 -left-3 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 shadow-lg"><Trash2 size={13} className="text-white" /></button><button type="button" aria-label="Duplicate layer" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onDuplicate(layer.id); }} className="absolute -top-3 -right-3 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-lg"><Copy size={12} className="text-black" /></button><div aria-label="Resize layer" onPointerDown={startResize} className="absolute -bottom-2 -right-2 h-6 w-6 cursor-se-resize rounded-sm border-2 border-black bg-yellow-400 shadow-lg" /><div aria-label="Rotate layer" onPointerDown={startRotate} className="absolute -bottom-3 left-1/2 flex h-6 w-6 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border-2 border-black bg-white shadow-lg"><RotateCw size={11} className="text-black" /></div></>}
  </div>;
}
