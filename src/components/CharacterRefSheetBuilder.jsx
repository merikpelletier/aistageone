import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, Loader2, Wand2, X, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const VIEWS = [
  { key: 'front',   label: 'Full Front' },
  { key: 'side',    label: 'Side View' },
  { key: 'back',    label: 'Full Back' },
  { key: 'portrait',label: 'Portrait' },
  { key: 'profile', label: 'Profile' },
];

const FORMATS = [
  { key: '4:3',  label: '4:3 Landscape',  hint: 'Wide turnaround sheet' },
  { key: '3:4',  label: '3:4 Portrait',   hint: 'Tall turnaround sheet' },
  { key: '16:9', label: '16:9 Cinematic', hint: 'Wide banner' },
  { key: '9:16', label: '9:16 Vertical',  hint: 'Phone / reel' },
  { key: '1:1',  label: '1:1 Square',     hint: 'Square sheet' },
];

export default function CharacterRefSheetBuilder({ onDone, onCancel }) {
  const [photos, setPhotos] = useState({}); // { front: { file, previewUrl }, ... }
  const [format, setFormat] = useState('4:3');
  const [status, setStatus] = useState('idle'); // idle | uploading | generating | error
  const [errorMsg, setErrorMsg] = useState('');

  const handleFile = (key, file) => {
    setPhotos(prev => ({ ...prev, [key]: { file, previewUrl: URL.createObjectURL(file) } }));
  };

  const remove = (key) => {
    setPhotos(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const generate = async () => {
    const filled = VIEWS.filter(v => photos[v.key]);
    if (filled.length === 0) {
      setErrorMsg('Upload at least one photo.');
      return;
    }
    setStatus('uploading');
    setErrorMsg('');

    // Upload all provided photos
    const uploadedUrls = [];
    for (const v of filled) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: photos[v.key].file });
      uploadedUrls.push({ label: v.label, url: file_url });
    }

    setStatus('generating');

    const prompt = `Photorealistic character turnaround sheet, ${format}. Show this same person wearing the same clothes as in the reference photos. Clean light grey background, professional studio lighting.`;

    try {
      const res = await base44.functions.invoke('replicateGenerate', {
        method: 'character_sheet',
        photo_urls: uploadedUrls.map(u => u.url),
        aspect_ratio: format,
        prompt_override: prompt,
      });
      if (res.data?.file_url) {
        setStatus('idle');
        onDone(res.data.file_url);
      } else {
        setErrorMsg(res.data?.error || 'Generation failed. Try again.');
        setStatus('error');
      }
    } catch (e) {
      setErrorMsg(e.message || 'Generation failed. Try again.');
      setStatus('error');
    }
  };

  if (status === 'uploading' || status === 'generating') {
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <Loader2 size={28} className="text-red-400 animate-spin" />
        <p className="text-white text-sm">
          {status === 'uploading' ? 'Uploading photos...' : 'Generating reference sheet...'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-white font-semibold text-sm">Create Reference Sheet</p>
        <button onClick={onCancel} className="text-white text-xs hover:text-white flex items-center gap-1">
          <ChevronLeft size={14} /> Back
        </button>
      </div>

      <p className="text-white text-xs leading-relaxed">
        Upload photos of yourself (or your character) from multiple angles. The AI will compose them into a single reference sheet.
      </p>

      <div className="grid grid-cols-3 gap-2">
        {VIEWS.map(v => (
          <div key={v.key} className="space-y-1">
            <p className="text-white text-xs text-center">{v.label}</p>
            {photos[v.key] ? (
              <div className="relative rounded-lg overflow-hidden aspect-[3/4]">
                <img src={photos[v.key].previewUrl} alt={v.label} className="w-full h-full object-cover" />
                <button
                  onClick={() => remove(v.key)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center"
                >
                  <X size={10} className="text-white" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-white/20 rounded-lg cursor-pointer hover:border-white/40 transition-colors aspect-[3/4]">
                <Upload size={16} className="text-white" />
                <span className="text-white text-xs">Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => e.target.files[0] && handleFile(v.key, e.target.files[0])}
                />
              </label>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-white text-xs">Output format</p>
        <div className="grid grid-cols-5 gap-1.5">
          {FORMATS.map(f => (
            <button
              key={f.key}
              onClick={() => setFormat(f.key)}
              className={`px-2 py-1.5 rounded text-xs font-semibold transition-colors ${
                format === f.key
                  ? 'bg-red-600 text-white'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
              title={f.hint}
            >
              {f.key}
            </button>
          ))}
        </div>
        <p className="text-white text-[11px]">{FORMATS.find(f => f.key === format)?.hint}</p>
      </div>

      {errorMsg && <p className="text-red-400 text-xs text-center">{errorMsg}</p>}

      <Button
        onClick={generate}
        disabled={Object.keys(photos).length === 0}
        className="w-full bg-red-600 hover:bg-red-700 text-white disabled:opacity-40"
      >
        <Wand2 size={16} className="mr-2" />
        Generate Reference Sheet →
      </Button>
    </div>
  );
}