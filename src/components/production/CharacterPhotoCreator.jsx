import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, Loader2, X, Camera, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DEFAULT_PROMPT = `Image A is the facial identity reference. Image B is the target image. Replace the face in Image B with the face from Image A while keeping Image B's pose, camera angle, framing, glasses, hairstyle, clothing, lighting, background, and photorealistic style. The final result must look like the person from Image A was photographed naturally in the same position and setting as Image B. Preserve realistic skin texture, beard details, facial proportions, shadows, and lens reflections. Do not change the background, outfit, glasses, crop, or overall composition.`;

const PHOTO_SLOTS = [
  { key: 'front', label: 'Front Body', hint: 'Full body, facing forward', placeholder: '/placeholders/silhouette-full.svg' },
  { key: 'portrait', label: 'Portrait', hint: 'Close-up face, front-facing', placeholder: '/placeholders/silhouette-portrait.svg' },
  { key: 'profile', label: 'Profile', hint: 'Side view of face/body', placeholder: '/placeholders/silhouette-profile.svg' },
];

function PhotoSlot({ label, hint, placeholder, photo, onSelect, onClear }) {
  return (
    <div className="flex flex-col gap-1.5 items-center" style={{ width: '90px' }}>
      <p className="text-white text-[10px] tracking-wide text-center">{label}</p>
      {photo ? (
        <div className="relative rounded-lg overflow-hidden bg-white/10" style={{ width: '90px', height: '120px' }}>
          <img src={photo.previewUrl} alt={label} className="w-full h-full object-cover" />
          <button
            onClick={onClear}
            className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center"
          >
            <X size={10} className="text-white" />
          </button>
        </div>
      ) : (
        <label className="relative rounded-lg overflow-hidden cursor-pointer group" style={{ width: '90px', height: '120px' }}>
          {/* Placeholder image */}
          <img src={placeholder} alt={hint} className="w-full h-full object-cover opacity-30 group-hover:opacity-40 transition-opacity" />
          {/* Dashed border overlay */}
          <div className="absolute inset-0 border-2 border-dashed border-white/20 rounded-lg group-hover:border-yellow-600/50 transition-colors" />
          {/* Upload icon overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <Upload size={16} className="text-white" />
            <span className="text-white text-[9px] text-center px-1 leading-tight">{hint}</span>
          </div>
          <input type="file" accept="image/jpeg,image/jpg,image/png" className="hidden"
            onChange={e => e.target.files[0] && onSelect(e.target.files[0])} />
        </label>
      )}
    </div>
  );
}

export default function CharacterPhotoCreator({ character, onDone }) {
  const [photos, setPhotos] = useState({ front: null, portrait: null, profile: null });
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [resultUrl, setResultUrl] = useState(null);
  const [customPrompt, setCustomPrompt] = useState(DEFAULT_PROMPT);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('4:3');
  const RATIOS = ['4:3', '3:4', '16:9', '9:16', '1:1'];

  const setPhoto = (key, file) => {
    setPhotos(p => ({ ...p, [key]: { file, previewUrl: URL.createObjectURL(file) } }));
    setStatus('idle');
    setErrorMsg('');
    setResultUrl(null);
  };

  const clearPhoto = (key) => {
    setPhotos(p => ({ ...p, [key]: null }));
  };

  // At least portrait is required; front body is the primary reference for generation
  const canGenerate = photos.portrait !== null;

  const handleGenerate = async () => {
    if (!canGenerate) return;

    const isAuth = await base44.auth.isAuthenticated();
    if (!isAuth) {
      base44.auth.redirectToLogin(window.location.href);
      return;
    }

    setStatus('uploading');
    setErrorMsg('');

    try {
      // Upload all provided photos
      const uploads = await Promise.all(
        PHOTO_SLOTS
          .filter(s => photos[s.key])
          .map(s => base44.integrations.Core.UploadFile({ file: photos[s.key].file }))
      );
      const urls = uploads.map(u => u.file_url);

      // Primary reference = portrait, secondary = front body (if provided)
      const portraitIdx = PHOTO_SLOTS.filter(s => photos[s.key]).findIndex(s => s.key === 'portrait');
      const primaryUrl = urls[portraitIdx];
      // Use front body as the "target" reference if available, otherwise portrait
      const frontIdx = PHOTO_SLOTS.filter(s => photos[s.key]).findIndex(s => s.key === 'front');
      const referenceUrl = frontIdx >= 0 ? urls[frontIdx] : primaryUrl;

      setStatus('generating');
      const res = await base44.functions.invoke('replicateGenerate', {
        method: 'character_photo',
        photo_url: primaryUrl,
        reference_image_url: referenceUrl,
        extra_reference_urls: urls.filter((_, i) => i !== portraitIdx && i !== frontIdx),
        prompt_override: customPrompt !== DEFAULT_PROMPT ? customPrompt : undefined,
        aspect_ratio: aspectRatio,
      });

      if (res.data?.file_url) {
        setResultUrl(res.data.file_url);
        setStatus('done');
      } else {
        setErrorMsg(res.data?.error || 'Generation failed');
        setStatus('error');
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Generation failed';
      setErrorMsg(msg);
      setStatus('error');
    }
  };

  const isLoading = status === 'uploading' || status === 'generating';

  return (
    <div className="space-y-5">
      {/* Info */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-1">
        <div className="flex items-center gap-2">
          <Camera size={16} className="text-yellow-400" />
          <p className="text-white text-xs font-medium tracking-wide">CREATE YOUR CHARACTER PHOTO</p>
        </div>
        <p className="text-white text-xs leading-relaxed">
          Upload your photos below and the AI will generate you as{' '}
          <span className="text-white">{character.name}</span>.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 border border-white/10 rounded-xl">
          <Loader2 size={28} className="text-yellow-400 animate-spin" />
          <span className="text-white text-sm">
            {status === 'uploading' ? 'Uploading your photos...' : 'AI is generating your character look...'}
          </span>
          {status === 'generating' && <span className="text-white/20 text-xs">This can take 20–40 seconds</span>}
        </div>
      ) : status === 'done' && resultUrl ? (
        <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden">
            <img src={resultUrl} alt="Your character photo" className="w-full object-cover rounded-xl" />
            <span className="absolute top-2 right-2 px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">
              ✓ Generated
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 border-white/20 text-white hover:bg-white/10"
              onClick={() => { setStatus('idle'); setResultUrl(null); }}
            >
              Redo
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              onClick={() => onDone(resultUrl)}
            >
              Use This Photo →
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Tip */}
          <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-xl px-4 py-3">
            <p className="text-yellow-300/80 text-xs leading-relaxed">
              📸 <span className="font-semibold">Tip:</span> Match the angle and framing of each shot as closely as possible for best results.
            </p>
          </div>

          {/* Photo upload slots */}
          <div>
            <p className="text-white text-xs tracking-widest uppercase mb-3">Your Reference Photos</p>
            <div className="flex gap-3 justify-start">
              {PHOTO_SLOTS.map(slot => (
                <PhotoSlot
                  key={slot.key}
                  label={slot.label}
                  hint={slot.hint}
                  placeholder={slot.placeholder}
                  photo={photos[slot.key]}
                  onSelect={file => setPhoto(slot.key, file)}
                  onClear={() => clearPhoto(slot.key)}
                />
              ))}
            </div>
            <p className="text-white/20 text-xs mt-2">Portrait is required. Front body and profile improve results.</p>
          </div>

          {/* Aspect ratio selector */}
          <div>
            <p className="text-white text-xs tracking-widest uppercase mb-2">Output Format</p>
            <div className="flex gap-2 flex-wrap">
              {RATIOS.map(r => (
                <button key={r} onClick={() => setAspectRatio(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${aspectRatio === r ? 'bg-yellow-500 text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          {canGenerate && (
            <Button
              onClick={handleGenerate}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-medium"
            >
              Generate My Character Photo ({aspectRatio})
            </Button>
          )}

          {status === 'error' && <p className="text-red-400 text-xs text-center">{errorMsg}</p>}

          {/* Advanced: custom prompt */}
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowAdvanced(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-white text-xs hover:text-white transition-colors"
            >
              <span className="tracking-widest uppercase">Advanced — Edit Prompt</span>
              {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showAdvanced && (
              <div className="px-4 pb-4 space-y-2">
                <textarea
                  value={customPrompt}
                  onChange={e => setCustomPrompt(e.target.value)}
                  rows={6}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white text-xs resize-none focus:outline-none focus:border-yellow-400/40"
                />
                <button
                  onClick={() => setCustomPrompt(DEFAULT_PROMPT)}
                  className="text-yellow-400/60 text-xs hover:text-yellow-400 transition-colors"
                >
                  Reset to default
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
