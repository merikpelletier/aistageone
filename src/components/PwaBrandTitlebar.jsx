import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

// Edge's Window Controls Overlay exposes the native title-bar area to the PWA.
// Render only when the browser has actually activated it.
export default function PwaBrandTitlebar() {
  const location = useLocation();
  const [visible, setVisible] = useState(
    () => Boolean(navigator.windowControlsOverlay?.visible)
  );
  const [language, setLanguage] = useState(() => {
    const query = new URLSearchParams(window.location.search).get('lang');
    if (query === 'fr' || query === 'en') return query;
    try { return localStorage.getItem('aistage-landing-language') === 'fr' ? 'fr' : 'en'; }
    catch { return 'en'; }
  });

  useEffect(() => {
    const overlay = navigator.windowControlsOverlay;
    if (!overlay) return undefined;
    const sync = () => setVisible(Boolean(overlay.visible));
    sync();
    overlay.addEventListener('geometrychange', sync);
    return () => overlay.removeEventListener('geometrychange', sync);
  }, []);

  useEffect(() => {
    const syncLanguage = () => {
      const query = new URLSearchParams(window.location.search).get('lang');
      if (query === 'fr' || query === 'en') {
        setLanguage(query);
        return;
      }
      try { setLanguage(localStorage.getItem('aistage-landing-language') === 'fr' ? 'fr' : 'en'); }
      catch { setLanguage('en'); }
    };
    syncLanguage();
    window.addEventListener('aistage-language-change', syncLanguage);
    window.addEventListener('storage', syncLanguage);
    return () => {
      window.removeEventListener('aistage-language-change', syncLanguage);
      window.removeEventListener('storage', syncLanguage);
    };
  }, [location.pathname, location.search]);

  if (!visible) return null;

  const french = language === 'fr';
  return (
    <div aria-label={french ? 'LE PLATEAU IA' : 'AISTAGE.ONE'}
      style={{
        position: 'fixed',
        zIndex: 2147483646,
        top: 'env(titlebar-area-y, 0px)',
        left: 'env(titlebar-area-x, 0px)',
        width: 'env(titlebar-area-width, 100%)',
        height: 'env(titlebar-area-height, 32px)',
        background: '#080a0c',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        paddingLeft: 12,
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: 12,
        fontWeight: 750,
        letterSpacing: '0.015em',
        WebkitAppRegion: 'drag',
        appRegion: 'drag',
        userSelect: 'none',
      }}>
      <img src={french ? '/icons/leplateau.svg' : '/icons/icon-192.png?v=5'}
        alt="" aria-hidden="true" width="20" height="20"
        style={{ width: 20, height: 20, objectFit: 'contain', pointerEvents: 'none' }} />
      <span>{french ? 'LE PLATEAU IA' : 'AISTAGE.ONE'}</span>
    </div>
  );
}
