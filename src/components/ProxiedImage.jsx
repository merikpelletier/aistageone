import { useState, useEffect } from 'react';

export default function ProxiedImage({ src, className, style }) {
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    if (!src) return;
    // Legacy Base44 URLs are intentionally blocked. Active media must be hosted
    // by AISTAGE.ONE/Supabase or another explicitly supported provider.
    if (/\b(?:media\.)?base44\.(?:app|com)\b/i.test(src)) {
      setDataUrl(null);
      return;
    }
    setDataUrl(src);
  }, [src]);

  if (!dataUrl) return <div className={className} style={style} />;

  return (
    <div
      className={className}
      style={{ ...style, backgroundImage: `url("${dataUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    />
  );
}
