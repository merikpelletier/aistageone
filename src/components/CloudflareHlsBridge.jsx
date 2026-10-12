import { useEffect } from 'react';

const HLS_SCRIPT_ID = 'aistage-hls-js';
const HLS_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/hls.js@1.7.3/dist/hls.min.js';

function isStreamHls(url = '') {
  return /\.cloudflarestream\.com\/.*\/manifest\/video\.m3u8(?:\?|$)/i.test(url);
}

function loadHls() {
  if (window.Hls) return Promise.resolve(window.Hls);
  const existing = document.getElementById(HLS_SCRIPT_ID);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(window.Hls), { once: true });
      existing.addEventListener('error', () => reject(new Error('Unable to load HLS player')), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = HLS_SCRIPT_ID;
    script.src = HLS_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(window.Hls);
    script.onerror = () => reject(new Error('Unable to load HLS player'));
    document.head.appendChild(script);
  });
}

export default function CloudflareHlsBridge() {
  useEffect(() => {
    const attached = new Map();

    const detach = (video) => {
      const hls = attached.get(video);
      if (hls) hls.destroy();
      attached.delete(video);
      delete video.dataset.streamHlsSource;
    };

    const attach = async (video) => {
      if (!(video instanceof HTMLVideoElement)) return;
      const source = video.getAttribute('src') || '';
      if (!isStreamHls(source)) {
        if (attached.has(video)) detach(video);
        return;
      }
      if (video.dataset.streamHlsSource === source) return;

      detach(video);

      if (video.canPlayType('application/vnd.apple.mpegurl') && 'ManagedMediaSource' in window) {
        video.dataset.streamHlsSource = source;
        return;
      }

      try {
        const Hls = await loadHls();
        if (!document.contains(video) || !Hls?.isSupported?.()) return;
        video.removeAttribute('src');
        const hls = new Hls();
        attached.set(video, hls);
        video.dataset.streamHlsSource = source;
        hls.loadSource(source);
        hls.attachMedia(video);
      } catch (error) {
        console.error('Cloudflare HLS playback unavailable:', error);
      }
    };

    const scan = (root) => {
      if (root instanceof HTMLVideoElement) attach(root);
      root?.querySelectorAll?.('video[src]')?.forEach(attach);
    };

    scan(document);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.target instanceof HTMLVideoElement) {
          attach(mutation.target);
        }
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) scan(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });

    return () => {
      observer.disconnect();
      attached.forEach((hls) => hls.destroy());
      attached.clear();
    };
  }, []);

  return null;
}
