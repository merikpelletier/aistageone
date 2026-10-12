import React from 'react';

export function isCloudflareStreamUrl(url = '') {
  return typeof url === 'string' && /\.cloudflarestream\.com\//i.test(url);
}

export function cloudflarePlayerUrl(url = '') {
  if (!isCloudflareStreamUrl(url)) return null;
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (!parts.length) return null;
    const videoId = parts[0];
    return `${parsed.origin}/${videoId}/iframe`;
  } catch {
    return null;
  }
}

export default function CloudflareStreamVideo({
  src,
  title = 'AISTAGE.ONE video',
  className = '',
  controls = true,
  autoPlay = false,
  muted = false,
  previewOnly = false,
}) {
  const playerUrl = cloudflarePlayerUrl(src);

  if (playerUrl) {
    return (
      <iframe
        src={playerUrl}
        title={title}
        className={className}
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen={!previewOnly}
        loading="lazy"
        style={previewOnly ? { pointerEvents: 'none' } : undefined}
      />
    );
  }

  return (
    <video
      src={src}
      className={className}
      controls={controls}
      autoPlay={autoPlay}
      muted={muted}
      preload="metadata"
    />
  );
}
