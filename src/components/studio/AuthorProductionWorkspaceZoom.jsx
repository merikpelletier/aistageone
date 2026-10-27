import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minus, Plus, ZoomIn, X } from 'lucide-react';
import AuthorProductionWorkspacePage from './AuthorProductionWorkspacePage';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const TOOL_WIDTH = 430;
const isMobileViewport = () => window.innerWidth < 768;

function findPageCanvas(root) {
  if (!root) return null;
  return [...root.querySelectorAll('div')].find((node) => {
    const ratio = node.style?.aspectRatio;
    if (!ratio) return false;
    return [...node.querySelectorAll('span')].some((span) => span.textContent?.trim() === 'FRAME 1');
  }) || null;
}

function findToolDrawer(root) {
  if (!root) return null;
  return [...root.querySelectorAll('div')].find((node) => {
    const className = typeof node.className === 'string' ? node.className : '';
    return className.includes('absolute') && className.includes('z-40') && className.includes('w-[430px]');
  }) || null;
}

function findRightRail(root) {
  if (!root) return null;
  return [...root.querySelectorAll('aside')].find((node) => {
    const className = typeof node.className === 'string' ? node.className : '';
    return className.includes('border-l');
  }) || null;
}

function drawerSide(drawer) {
  if (!drawer) return '';
  const className = typeof drawer.className === 'string' ? drawer.className : '';
  if (className.includes('left-[62px]')) return 'left';
  if (className.includes('right-[62px]')) return 'right';
  return '';
}

function pageBaseWidth(canvas) {
  const ratio = String(canvas?.style?.aspectRatio || '16 / 9').split('/').map((part) => Number(part.trim()));
  const rw = ratio[0] || 16;
  const rh = ratio[1] || 9;
  if (rw < rh) return 720;
  if (Math.abs(rw - rh) < 0.2) return 900;
  return 1120;
}

function integrateDialogueTails(canvas) {
  if (!canvas) return;
  const svgs = [...canvas.querySelectorAll('svg')].filter((svg) => svg.querySelector('polygon') && svg.querySelector('polyline'));
  svgs.forEach((svg) => {
    svg.style.zIndex = '25';
    svg.style.pointerEvents = 'none';
    if (svg.style.top?.includes('100%')) svg.style.top = 'calc(100% - 2px)';
    if (svg.style.bottom?.includes('100%')) svg.style.bottom = 'calc(100% - 2px)';
    if (svg.style.left?.includes('100%')) svg.style.left = 'calc(100% - 2px)';
    if (svg.style.right?.includes('100%')) svg.style.right = 'calc(100% - 2px)';
    const polygon = svg.querySelector('polygon');
    const edge = svg.querySelector('polyline');
    if (polygon) polygon.setAttribute('fill', '#fff');
    if (edge) {
      edge.setAttribute('stroke', '#111');
      edge.setAttribute('stroke-width', '1');
      edge.setAttribute('stroke-linejoin', 'miter');
      edge.setAttribute('stroke-linecap', 'square');
      edge.setAttribute('vector-effect', 'non-scaling-stroke');
    }
  });
}

const mobileStyles = `
@media (max-width: 767px) {
  [data-fotoplay-workspace="true"] > div > div:first-child {
    padding-left: 6px !important;
    padding-right: 6px !important;
    padding-bottom: 82px !important;
  }

  [data-fotoplay-workspace="true"] header {
    display: grid !important;
    grid-template-columns: 38px minmax(0, 1fr) !important;
    gap: 6px !important;
    padding: 6px !important;
    margin-bottom: 6px !important;
    align-items: center !important;
  }

  [data-fotoplay-workspace="true"] header > button:first-child {
    grid-column: 1 !important;
    grid-row: 1 !important;
    width: 38px !important;
    height: 38px !important;
    min-height: 38px !important;
    padding: 0 !important;
  }

  [data-fotoplay-workspace="true"] header > div:first-of-type {
    grid-column: 2 !important;
    grid-row: 1 !important;
    min-width: 0 !important;
  }

  [data-fotoplay-workspace="true"] header > div:first-of-type p {
    font-size: 7px !important;
    line-height: 1.15 !important;
    letter-spacing: .11em !important;
    margin: 0 !important;
  }

  [data-fotoplay-workspace="true"] header > div:first-of-type h2 {
    font-size: 13px !important;
    line-height: 1.1 !important;
    margin: 1px 0 0 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  [data-fotoplay-workspace="true"] header > button:not(:first-child),
  [data-fotoplay-workspace="true"] header > a {
    min-height: 34px !important;
    padding: 5px 8px !important;
    font-size: 9px !important;
    line-height: 1.05 !important;
    gap: 4px !important;
    white-space: nowrap !important;
  }

  [data-fotoplay-workspace="true"] header > button:not(:first-child) svg,
  [data-fotoplay-workspace="true"] header > a svg {
    width: 13px !important;
    height: 13px !important;
  }

  [data-fotoplay-workspace="true"] header > button:nth-of-type(n+2),
  [data-fotoplay-workspace="true"] header > a {
    grid-column: auto !important;
  }

  [data-fotoplay-workspace="true"] > div > div:nth-child(2) {
    gap: 6px !important;
    padding: 6px !important;
    margin-bottom: 6px !important;
  }

  [data-fotoplay-workspace="true"] > div > div:nth-child(2) > button {
    min-height: 34px !important;
    padding: 5px 9px !important;
    font-size: 9px !important;
    line-height: 1 !important;
  }

  [data-fotoplay-workspace="true"] [class*="grid-cols-9"] {
    display: flex !important;
    gap: 5px !important;
    overflow-x: auto !important;
    padding: 5px !important;
    margin-bottom: 6px !important;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  [data-fotoplay-workspace="true"] [class*="grid-cols-9"]::-webkit-scrollbar {
    display: none;
  }

  [data-fotoplay-workspace="true"] [class*="grid-cols-9"] > button {
    flex: 0 0 34px !important;
    width: 34px !important;
    height: 32px !important;
    font-size: 9px !important;
  }

  [data-fotoplay-workspace="true"] [class*="h-[calc(100vh-230px)]"] {
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
  }

  [data-fotoplay-workspace="true"] [class*="grid-cols-[62px_minmax(0,1fr)_62px]"] {
    display: flex !important;
    flex-direction: column !important;
    height: auto !important;
  }

  [data-fotoplay-workspace="true"] [class*="grid-cols-[62px_minmax(0,1fr)_62px]"] > aside {
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    gap: 4px !important;
    width: 100% !important;
    min-height: 46px !important;
    padding: 4px !important;
    overflow-x: auto !important;
    border-left: 0 !important;
    border-right: 0 !important;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  [data-fotoplay-workspace="true"] [class*="grid-cols-[62px_minmax(0,1fr)_62px]"] > aside::-webkit-scrollbar {
    display: none;
  }

  [data-fotoplay-workspace="true"] [class*="grid-cols-[62px_minmax(0,1fr)_62px]"] > aside:first-child {
    order: 1 !important;
    border-bottom: 1px solid rgba(255,255,255,.1) !important;
  }

  [data-fotoplay-workspace="true"] [class*="grid-cols-[62px_minmax(0,1fr)_62px]"] > main {
    order: 2 !important;
    width: 100% !important;
    min-height: 58dvh !important;
    padding: 6px !important;
    overflow: visible !important;
  }

  [data-fotoplay-workspace="true"] [class*="grid-cols-[62px_minmax(0,1fr)_62px]"] > main > div:first-child p:first-child {
    font-size: 7px !important;
    line-height: 1.1 !important;
  }

  [data-fotoplay-workspace="true"] [class*="grid-cols-[62px_minmax(0,1fr)_62px]"] > main > div:first-child p:last-child {
    font-size: 9px !important;
    line-height: 1.2 !important;
  }

  [data-fotoplay-workspace="true"] [class*="grid-cols-[62px_minmax(0,1fr)_62px]"] > main > div:first-child span {
    font-size: 8px !important;
    padding: 4px 6px !important;
  }

  [data-fotoplay-workspace="true"] [class*="grid-cols-[62px_minmax(0,1fr)_62px]"] > aside:last-child {
    order: 3 !important;
    border-top: 1px solid rgba(255,255,255,.1) !important;
  }

  [data-fotoplay-workspace="true"] [class*="grid-cols-[62px_minmax(0,1fr)_62px]"] > aside button {
    flex: 0 0 auto !important;
    width: 40px !important;
    height: 40px !important;
    min-height: 40px !important;
    padding: 0 !important;
  }

  [data-fotoplay-workspace="true"] [class*="grid-cols-[62px_minmax(0,1fr)_62px]"] > aside button svg {
    width: 16px !important;
    height: 16px !important;
  }

  [data-fotoplay-workspace="true"] [class*="w-[430px]"][class*="absolute"] {
    position: fixed !important;
    inset: 56px 0 64px 0 !important;
    width: 100% !important;
    max-width: none !important;
    height: auto !important;
    z-index: 8000 !important;
    border-left: 0 !important;
    border-right: 0 !important;
  }

  [data-fotoplay-workspace="true"] [class*="w-[430px]"][class*="absolute"] > div:first-child p:first-child {
    font-size: 8px !important;
  }

  [data-fotoplay-workspace="true"] [class*="w-[430px]"][class*="absolute"] > div:first-child p:last-child {
    font-size: 13px !important;
    line-height: 1.1 !important;
  }

  [data-fotoplay-workspace="true"] input,
  [data-fotoplay-workspace="true"] textarea,
  [data-fotoplay-workspace="true"] select {
    font-size: 16px !important;
  }

  [data-fotoplay-page-zoom-tool="true"],
  [data-fotoplay-zoom-panel="true"] {
    display: none !important;
  }
}
`;

export default function AuthorProductionWorkspaceZoom(props) {
  const rootRef = useRef(null);
  const [zoom, setZoom] = useState(80);
  const [fitActive, setFitActive] = useState(false);
  const [toolSide, setToolSide] = useState('');
  const [zoomOpen, setZoomOpen] = useState(false);
  const [rightRail, setRightRail] = useState(null);

  const applyWorkspaceLayout = useCallback(() => {
    const root = rootRef.current;
    const canvas = findPageCanvas(root);
    if (!root || !canvas) return;
    const main = canvas.closest('main');
    if (!main) return;

    const drawer = findToolDrawer(root);
    const side = drawerSide(drawer);
    setToolSide(side);

    main.style.boxSizing = 'border-box';
    if (isMobileViewport()) {
      main.style.paddingLeft = '8px';
      main.style.paddingRight = '8px';
      main.style.transition = 'none';
      if (drawer) {
        drawer.style.boxShadow = 'none';
        drawer.style.borderColor = 'rgba(255,255,255,.1)';
      }
      return;
    }

    main.style.paddingLeft = side === 'left' ? `${TOOL_WIDTH + 24}px` : '16px';
    main.style.paddingRight = side === 'right' ? `${TOOL_WIDTH + 24}px` : '16px';
    main.style.transition = 'padding 160ms ease';

    if (drawer) {
      drawer.style.boxShadow = 'none';
      drawer.style.borderColor = 'rgba(255,255,255,.1)';
    }
  }, []);

  const applyZoom = useCallback((value = zoom) => {
    const root = rootRef.current;
    const canvas = findPageCanvas(root);
    if (!root || !canvas) return;
    const main = canvas.closest('main');

    canvas.dataset.fotoplayPageCanvas = 'true';
    integrateDialogueTails(canvas);

    if (isMobileViewport()) {
      canvas.style.width = '100%';
      canvas.style.maxWidth = '100%';
      canvas.style.maxHeight = 'none';
      canvas.style.flex = '0 0 auto';
      canvas.style.zoom = '1';
      canvas.style.transform = 'none';
      canvas.style.transformOrigin = 'top center';
      applyWorkspaceLayout();
      if (main) {
        main.style.overflow = 'visible';
        main.style.justifyContent = 'flex-start';
        main.style.alignItems = 'stretch';
        main.style.scrollbarGutter = 'auto';
        main.style.paddingTop = '8px';
        main.style.paddingBottom = '18px';
      }
      return;
    }

    const baseWidth = pageBaseWidth(canvas);
    canvas.style.width = `${baseWidth}px`;
    canvas.style.maxWidth = 'none';
    canvas.style.maxHeight = 'none';
    canvas.style.flex = '0 0 auto';
    canvas.style.zoom = String(value / 100);
    canvas.style.transform = 'none';
    canvas.style.transformOrigin = 'top center';
    applyWorkspaceLayout();
    if (main) {
      main.style.overflow = 'auto';
      main.style.justifyContent = 'flex-start';
      main.style.alignItems = 'center';
      main.style.scrollbarGutter = 'stable both-edges';
      main.style.paddingTop = '18px';
      main.style.paddingBottom = '50px';
    }
  }, [applyWorkspaceLayout, zoom]);

  const fitPage = useCallback(() => {
    if (isMobileViewport()) return;
    const root = rootRef.current;
    const canvas = findPageCanvas(root);
    if (!root || !canvas) return;
    const main = canvas.closest('main');
    if (!main) return;

    const drawer = findToolDrawer(root);
    const reserved = drawer ? TOOL_WIDTH + 48 : 32;
    const baseWidth = pageBaseWidth(canvas);
    const ratio = String(canvas.style.aspectRatio || '16 / 9').split('/').map((part) => Number(part.trim()));
    const rw = ratio[0] || 16;
    const rh = ratio[1] || 9;
    const baseHeight = baseWidth * rh / rw;
    const availableWidth = Math.max(240, main.clientWidth - reserved - 48);
    const availableHeight = Math.max(260, main.clientHeight - 95);
    const percent = clamp(Math.floor(Math.min(availableWidth / baseWidth, availableHeight / baseHeight) * 100), 25, 100);
    setFitActive(true);
    setZoom(percent);
    requestAnimationFrame(() => applyZoom(percent));
  }, [applyZoom]);

  const setManualZoom = useCallback((value) => {
    if (isMobileViewport()) return;
    const next = clamp(value, 25, 150);
    setFitActive(false);
    setZoom(next);
    requestAnimationFrame(() => applyZoom(next));
  }, [applyZoom]);

  useEffect(() => {
    applyZoom(zoom);
    const root = rootRef.current;
    if (!root) return undefined;

    const refreshRail = () => {
      const rail = findRightRail(root);
      setRightRail((current) => current === rail ? current : rail);
    };

    const observer = new MutationObserver(() => requestAnimationFrame(() => {
      refreshRail();
      applyWorkspaceLayout();
      applyZoom(zoom);
      if (fitActive && !isMobileViewport()) fitPage();
    }));
    observer.observe(root, { childList: true, subtree: true });

    const onResize = () => {
      refreshRail();
      applyWorkspaceLayout();
      if (fitActive && !isMobileViewport()) fitPage();
      else applyZoom(zoom);
    };
    window.addEventListener('resize', onResize);
    requestAnimationFrame(refreshRail);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [applyWorkspaceLayout, applyZoom, fitActive, fitPage, zoom]);

  const zoomToolButton = rightRail && !isMobileViewport() ? createPortal(
    <button
      type="button"
      onClick={() => setZoomOpen((open) => !open)}
      title="Page zoom"
      aria-label="Page zoom"
      className={`flex h-12 w-12 items-center justify-center border transition ${zoomOpen ? 'border-[#23c7be] bg-[#23c7be] text-black' : 'border-white/10 bg-[#16191d] text-white/70 hover:border-white/30 hover:text-white'}`}
      data-fotoplay-page-zoom-tool="true"
    >
      <ZoomIn size={19} />
    </button>,
    rightRail
  ) : null;

  return <div ref={rootRef} className="relative" data-fotoplay-workspace="true">
    <style>{mobileStyles}</style>
    <AuthorProductionWorkspacePage {...props} />
    {zoomToolButton}
    {zoomOpen && <div className="fixed right-[72px] top-[220px] z-[195] w-[250px] border border-white/15 bg-[#111418] p-4 text-white shadow-2xl" data-fotoplay-zoom-panel="true">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#23c7be]">FotoPlay tool</p><p className="font-black">Page zoom</p></div>
        <button type="button" onClick={() => setZoomOpen(false)} className="p-2 text-white/60 hover:text-white"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-[44px_1fr_44px] gap-2">
        <button type="button" onClick={() => setManualZoom(zoom - 10)} title="Zoom out" className="flex h-10 items-center justify-center border border-white/10 bg-[#1c2025] hover:border-[#23c7be]"><Minus size={16} /></button>
        <button type="button" onClick={() => setManualZoom(100)} title="100%" className="h-10 border border-white/10 bg-[#1c2025] px-2 text-sm font-black hover:border-[#23c7be]">{zoom}%</button>
        <button type="button" onClick={() => setManualZoom(zoom + 10)} title="Zoom in" className="flex h-10 items-center justify-center border border-white/10 bg-[#1c2025] hover:border-[#23c7be]"><Plus size={16} /></button>
      </div>
      <button type="button" onClick={fitPage} className={`mt-2 flex h-10 w-full items-center justify-center gap-2 border px-3 text-xs font-black ${fitActive ? 'border-[#23c7be] bg-[#23c7be] text-black' : 'border-white/10 bg-[#1c2025] text-white hover:border-[#23c7be]'}`}><Maximize2 size={15} /> Fit page</button>
    </div>}
  </div>;
}
