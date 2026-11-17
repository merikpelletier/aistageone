import React, { useEffect, useState } from 'react';

// Leave the Edge window-controls overlay unbranded while preserving
// the native minimize, maximize and close controls.
export default function PwaBrandTitlebar() {
  const [visible, setVisible] = useState(
    () => Boolean(navigator.windowControlsOverlay?.visible)
  );

  useEffect(() => {
    const overlay = navigator.windowControlsOverlay;
    if (!overlay) return undefined;
    const sync = () => setVisible(Boolean(overlay.visible));
    sync();
    overlay.addEventListener('geometrychange', sync);
    return () => overlay.removeEventListener('geometrychange', sync);
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        zIndex: 2147483646,
        top: 'env(titlebar-area-y, 0px)',
        left: 'env(titlebar-area-x, 0px)',
        width: 'env(titlebar-area-width, 100%)',
        height: 'env(titlebar-area-height, 32px)',
        background: '#080a0c',
        WebkitAppRegion: 'drag',
        appRegion: 'drag',
        userSelect: 'none',
      }}
    />
  );
}
