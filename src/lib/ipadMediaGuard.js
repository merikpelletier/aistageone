function isIPadDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPad/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function stopAllMedia() {
  document.querySelectorAll('video, audio').forEach((media) => {
    try {
      media.pause();
      media.currentTime = 0;
    } catch (error) {
      console.warn('Unable to stop background media', error);
    }
  });
}

export function installIPadMediaGuard() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !isIPadDevice()) return;

  const handleVisibilityChange = () => {
    if (document.hidden) stopAllMedia();
  };

  const handlePageHide = () => stopAllMedia();

  document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });
  window.addEventListener('pagehide', handlePageHide, { passive: true });
}
