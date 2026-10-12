import { useEffect } from 'react';

const HLS_SCRIPT_ID = 'aistage-hls-js';
const HLS_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/hls.js@1.7.3/dist/hls.min.js';

function isStreamHls(url = '') {
  return /\.cloudflarestream\.com\/.*\/manifest\/video\.m3u8(?:\?|$)/i.test(url);
}

function streamThumbnailUrl(url = '') {
  if (!isStreamHls(url)) return null;
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const videoId = parts[0];
    if (!videoId) return null;
    return `${parsed.origin}/${videoId}/thumbnails/thumbnail.jpg?time=1s&height=480`;
  } catch {
    return null;
  }
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

    const fixStreamImagePreview = (image) => {
      if (!(image instanceof HTMLImageElement)) return;
      const source = image.getAttribute('src') || '';
      if (!isStreamHls(source)) return;
      const thumbnail = streamThumbnailUrl(source);
      if (!thumbnail) return;
      image.dataset.streamHlsSource = source;
      image.src = thumbnail;
      image.alt = image.alt || 'Cloudflare Stream video preview';
    };

    const scan = (root) => {
      if (root instanceof HTMLVideoElement) attach(root);
      if (root instanceof HTMLImageElement) fixStreamImagePreview(root);
      root?.querySelectorAll?.('video[src]')?.forEach(attach);
      root?.querySelectorAll?.('img[src]')?.forEach(fixStreamImagePreview);
    };

    scan(document);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes') {
          if (mutation.target instanceof HTMLVideoElement) attach(mutation.target);
          if (mutation.target instanceof HTMLImageElement) fixStreamImagePreview(mutation.target);
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
