const UPDATE_INTERVAL_MS = 30 * 60 * 1000;

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      });

      const checkForUpdate = () => registration.update().catch(() => {});
      window.setInterval(checkForUpdate, UPDATE_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate();
      });
    } catch (error) {
      console.error('Service worker registration failed:', error);
    }
  });
}
