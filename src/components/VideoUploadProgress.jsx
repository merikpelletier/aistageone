import React, { useEffect, useState } from 'react';
import { VIDEO_UPLOAD_PROGRESS_EVENT } from '@/lib/cloudflareStreamUpload';

export default function VideoUploadProgress() {
  const [upload, setUpload] = useState(null);

  useEffect(() => {
    let clearTimer;
    const handleProgress = (event) => {
      const detail = event.detail || {};
      setUpload(detail);
      window.clearTimeout(clearTimer);
      if (detail.stage === 'ready') {
        clearTimer = window.setTimeout(() => setUpload(null), 1200);
      }
      if (detail.stage === 'error') {
        clearTimer = window.setTimeout(() => setUpload(null), 4500);
      }
    };

    window.addEventListener(VIDEO_UPLOAD_PROGRESS_EVENT, handleProgress);
    return () => {
      window.removeEventListener(VIDEO_UPLOAD_PROGRESS_EVENT, handleProgress);
      window.clearTimeout(clearTimer);
    };
  }, []);

  if (!upload) return null;

  const stage = upload.stage;
  const percent = Math.max(0, Math.min(100, Number(upload.percent) || 0));
  const label = stage === 'processing'
    ? 'Processing video…'
    : stage === 'ready'
      ? 'Video ready'
      : stage === 'error'
        ? (upload.message || 'Video upload failed')
        : `Uploading video… ${percent}%`;

  return (
    <div className="fixed bottom-5 left-1/2 z-[10000] w-[min(92vw,430px)] -translate-x-1/2 border border-white/15 bg-black/95 px-4 py-3 shadow-2xl">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-white">{upload.fileName || 'Video'}</p>
          <p className={`mt-1 text-[11px] ${stage === 'error' ? 'text-red-300' : 'text-white/70'}`}>{label}</p>
        </div>
        {stage !== 'processing' && stage !== 'error' && <span className="text-xs font-bold text-white">{percent}%</span>}
      </div>
      {stage !== 'error' && (
        <div className="mt-3 h-1.5 overflow-hidden bg-white/10">
          <div
            className={`h-full bg-white transition-[width] duration-200 ${stage === 'processing' ? 'animate-pulse' : ''}`}
            style={{ width: `${stage === 'processing' ? 100 : percent}%` }}
          />
        </div>
      )}
    </div>
  );
}
