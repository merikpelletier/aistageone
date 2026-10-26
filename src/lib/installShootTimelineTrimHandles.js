const HANDLE_ATTR = 'data-shoot-trim-handle';
const MIN_DURATION = 0.05;

const setReactInputValue = (input, value) => {
  if (!input) return;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setter) return;
  setter.call(input, String(value));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
};

const findClipTrimInputs = () => {
  const labels = [...document.querySelectorAll('aside label')];
  const startLabel = labels.find((label) => label.textContent?.trim().startsWith('Trim start'));
  const endLabel = labels.find((label) => label.textContent?.trim().startsWith('Trim end'));
  return {
    startInput: startLabel?.querySelector('input[type="number"]') || null,
    endInput: endLabel?.querySelector('input[type="number"]') || null,
  };
};

const styleHandle = (handle, edge) => {
  Object.assign(handle.style, {
    position: 'absolute',
    top: '0',
    bottom: '0',
    [edge]: '0',
    width: '10px',
    zIndex: '35',
    cursor: 'ew-resize',
    border: '0',
    padding: '0',
    margin: '0',
    background: 'rgba(35, 199, 190, 0.12)',
    opacity: '0.72',
    touchAction: 'none',
  });
  handle.style[edge === 'left' ? 'borderLeft' : 'borderRight'] = '2px solid #23c7be';
  handle.addEventListener('mouseenter', () => {
    handle.style.opacity = '1';
    handle.style.background = 'rgba(35, 199, 190, 0.28)';
  });
  handle.addEventListener('mouseleave', () => {
    handle.style.opacity = '0.72';
    handle.style.background = 'rgba(35, 199, 190, 0.12)';
  });
};

const startTrimDrag = (event, clipElement, edge) => {
  event.preventDefault();
  event.stopPropagation();
  const handle = event.currentTarget;
  handle.setPointerCapture?.(event.pointerId);
  clipElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  requestAnimationFrame(() => {
    const { startInput, endInput } = findClipTrimInputs();
    if (!startInput || !endInput) return;

    const initialStart = Number(startInput.value || 0);
    const initialEnd = Number(endInput.value || 0);
    const duration = Math.max(MIN_DURATION, initialEnd - initialStart);
    const width = Math.max(1, clipElement.getBoundingClientRect().width);
    const pixelsPerSecond = width / duration;
    const startX = event.clientX;

    const onMove = (moveEvent) => {
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
      const deltaSeconds = (moveEvent.clientX - startX) / Math.max(0.01, pixelsPerSecond);
      if (edge === 'left') {
        const nextStart = Math.max(0, Math.min(initialEnd - MIN_DURATION, initialStart + deltaSeconds));
        setReactInputValue(startInput, Number(nextStart.toFixed(3)));
      } else {
        const nextEnd = Math.max(initialStart + MIN_DURATION, initialEnd + deltaSeconds);
        setReactInputValue(endInput, Number(nextEnd.toFixed(3)));
      }
    };

    const finish = (finishEvent) => {
      finishEvent?.preventDefault?.();
      finishEvent?.stopPropagation?.();
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', finish);
      handle.removeEventListener('pointercancel', finish);
      try { handle.releasePointerCapture?.(event.pointerId); } catch {}
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', finish, { once: true });
    handle.addEventListener('pointercancel', finish, { once: true });
  });
};

const addHandle = (clipElement, edge) => {
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.setAttribute(HANDLE_ATTR, edge);
  handle.setAttribute('aria-label', edge === 'left' ? 'Trim clip start' : 'Trim clip end');
  styleHandle(handle, edge);
  handle.addEventListener('pointerdown', (event) => startTrimDrag(event, clipElement, edge));
  handle.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  clipElement.appendChild(handle);
};

const enhanceTimeline = () => {
  const timelineHeading = [...document.querySelectorAll('p')].find((node) => node.textContent?.trim() === 'Timeline');
  const timelineSection = timelineHeading?.closest('section');
  if (!timelineSection) return;

  const track = [...timelineSection.querySelectorAll('div')].find((node) =>
    node.classList.contains('cursor-ew-resize') && node.querySelector(':scope > div video')
  );
  if (!track) return;

  [...track.children].forEach((clipElement) => {
    if (!(clipElement instanceof HTMLElement) || !clipElement.querySelector('video')) return;
    if (clipElement.querySelector(`[${HANDLE_ATTR}]`)) return;
    if (getComputedStyle(clipElement).position === 'static') clipElement.style.position = 'relative';
    addHandle(clipElement, 'left');
    addHandle(clipElement, 'right');
  });
};

export const installShootTimelineTrimHandles = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  let frame = null;
  const schedule = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(enhanceTimeline);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('resize', schedule);
  schedule();
};
