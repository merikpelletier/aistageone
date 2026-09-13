import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check } from 'lucide-react';

const ASPECT_RATIOS = [
  { label: '16:9', value: 16 / 9 },
  { label: '4:3',  value: 4 / 3 },
  { label: '9:16', value: 9 / 16 },
];

async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');

  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y,
    pixelCrop.width, pixelCrop.height,
    0, 0,
    pixelCrop.width, pixelCrop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.92);
  });
}

export default function ImageCropModal({ imageUrl, onConfirm, onClose }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspectIdx, setAspectIdx] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_, pixels) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    const blob = await getCroppedImg(imageUrl, croppedAreaPixels);
    const file = new File([blob], 'cropped.jpg', { type: 'image/jpeg' });
    onConfirm(file);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col h-[100dvh]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-10 pb-4 border-b border-white/10 flex-shrink-0">
        <div>
          <h3 className="text-white text-sm font-medium tracking-widest uppercase">Frame your image</h3>
          <p className="text-white text-xs mt-0.5">Choose a ratio, then drag & pinch to frame</p>
        </div>
        <button onClick={onClose} className="p-2 text-white hover:text-white">
          <X size={20} />
        </button>
      </div>

      {/* Aspect ratio selector */}
      <div className="px-5 pt-3 pb-1 flex-shrink-0">
        <p className="text-white text-xs mb-2 uppercase tracking-widest">Ratio</p>
        <div className="flex gap-2">
          {ASPECT_RATIOS.map((ar, idx) => (
            <button
              key={ar.label}
              onClick={() => setAspectIdx(idx)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                aspectIdx === idx ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white'
              }`}
            >
              {ar.label}
            </button>
          ))}
        </div>
      </div>

      {/* Confirm (above image) */}
      <div className="px-5 pb-3 flex-shrink-0">
        <button
          onClick={handleConfirm}
          disabled={processing}
          className="w-full py-3.5 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-black text-sm font-bold tracking-widest rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {processing
            ? <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            : <><Check size={16} /> Use this crop</>
          }
        </button>
      </div>

      {/* Cropper */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          aspect={ASPECT_RATIOS[aspectIdx].value}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>

      {/* Zoom slider */}
      <div className="px-5 py-3 flex-shrink-0">
        <input
          type="range"
          min={1} max={3} step={0.01}
          value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
          className="w-full accent-yellow-400"
        />
      </div>

    </div>
  );
}