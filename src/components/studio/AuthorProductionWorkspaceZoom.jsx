import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import AuthorProductionWorkspacePage from './AuthorProductionWorkspacePage';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function findPageCanvas(root) {
  if (!root) return null;
  return [...root.querySelectorAll('div')].find((node) => {
    const ratio = node.style?.aspectRatio;
    if (!ratio) return false;
    return [...node.querySelectorAll('span')].some((span) => span.textContent?.trim() === 'FRAME 1');
  }) || null;
}

function pageBaseWidth(canvas) {
  const ratio = String(canvas?.style?.aspectRatio || '16 / 9').split('/').map((part) => Number(part.trim()));
  const rw = ratio[0] || 16;
  const rh = ratio[1] || 9;
  if (rw < rh) return 720;
  if (Math.abs(rw - rh) < 0.2) return 900;
  return 1120;
}

export default function AuthorProductionWorkspaceZoom(props) {
  const rootRef = useRef(null);
  const [zoom, setZoom] = useState(80);
  const [fitActive, setFitActive] = useState(false);

  const applyZoom = useCallback((value = zoom) => {
    const root = rootRef.current;
    const canvas = findPageCanvas(root);
    if (!root || !canvas) return;

    const main = canvas.closest('main');
    const baseWidth = pageBaseWidth(canvas);

    canvas.dataset.fotoplayPageCanvas = 'true';
    canvas.style.width = `${baseWidth}px`;
    canvas.style.maxWidth = 'none';
    canvas.style.maxHeight = 'none';
    canvas.style.flex = '0 0 auto';
    canvas.style.zoom = String(value / 100);
    canvas.style.transform = 'none';
    canvas.style.transformOrigin = 'top center';

    if (main) {
      main.style.overflow = 'auto';
      main.style.justifyContent = 'flex-start';
      main.style.alignItems = 'center';
      main.style.scrollbarGutter = 'stable both-edges';
      main.style.paddingTop = '18px';
      main.style.paddingBottom = '50px';
    }
  }, [zoom]);

  const fitPage = useCallback(() => {
    const root = rootRef.current;
    const canvas = findPageCanvas(root);
    if (!root || !canvas) return;
    const main = canvas.closest('main');
    if (!main) return;

    const baseWidth = pageBaseWidth(canvas);
    const ratio = String(canvas.style.aspectRatio || '16 / 9').split('/').map((part) => Number(part.trim()));
    const rw = ratio[0] || 16;
    const rh = ratio[1] || 9;
    const baseHeight = baseWidth * rh / rw;
    const availableWidth = Math.max(240, main.clientWidth - 80);
    const availableHeight = Math.max(260, main.clientHeight - 95);
    const percent = clamp(Math.floor(Math.min(availableWidth / baseWidth, availableHeight / baseHeight) * 100), 25, 100);
    setFitActive(true);
    setZoom(percent);
    requestAnimationFrame(() => applyZoom(percent));
  }, [applyZoom]);

  const setManualZoom = useCallback((value) => {
    const next = clamp(value, 25, 150);
    setFitActive(false);
    setZoom(next);
    requestAnimationFrame(() => applyZoom(next));
  }, [applyZoom]);

  useEffect(() => {
    applyZoom(zoom);
    const root = rootRef.current;
    if (!root) return undefined;

    const observer = new MutationObserver(() => requestAnimationFrame(() => applyZoom(zoom)));
    observer.observe(root, { childList: true, subtree: true });
    const onResize = () => fitActive ? fitPage() : applyZoom(zoom);
    window.addEventListener('resize', onResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [applyZoom, fitActive, fitPage, zoom]);

  return <div ref={rootRef} className="relative">
    <AuthorProductionWorkspacePage {...props} />
    <div className="pointer-events-auto fixed right-[92px] top-[164px] z-[190] flex items-center gap-1 border border-white/15 bg-[#111418] p-1 text-white shadow-2xl">
      <button type="button" onClick={() => setManualZoom(zoom - 10)} title="Zoom out" className="flex h-9 w-9 items-center justify-center border border-white/10 bg-[#1c2025] hover:border-[#23c7be]"><Minus size={16} /></button>
      <button type="button" onClick={() => setManualZoom(100)} title="100%" className="h-9 min-w-[58px] border border-white/10 bg-[#1c2025] px-2 text-xs font-black hover:border-[#23c7be]">{zoom}%</button>
      <button type="button" onClick={() => setManualZoom(zoom + 10)} title="Zoom in" className="flex h-9 w-9 items-center justify-center border border-white/10 bg-[#1c2025] hover:border-[#23c7be]"><Plus size={16} /></button>
      <button type="button" onClick={fitPage} title="Fit whole page" className={`flex h-9 items-center gap-2 border px-3 text-xs font-black ${fitActive ? 'border-[#23c7be] bg-[#23c7be] text-black' : 'border-white/10 bg-[#1c2025] text-white hover:border-[#23c7be]'}`}><Maximize2 size={15} /> Fit page</button>
    </div>
  </div>;
}
