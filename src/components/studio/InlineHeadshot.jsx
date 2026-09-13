import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';
import { Upload, X, Loader2, Sparkles, Camera, CheckCircle2 } from 'lucide-react';

// Curated headshot style presets. Each builds the prompt sent to Google Nano
// Banana 2 (via the headshot method), which uses the uploaded portrait as its
// identity reference so the actor's face stays recognizable while the
// lighting/background/mood/expression change.
const HEADSHOT_STYLES = [
  { id: 'theatrical', label: 'Theatrical', prompt: 'Dramatic theatrical actor headshot, moody low-key Rembrandt lighting, deep shadows, dark neutral background, intense direct eye contact, shot on 85mm lens, shallow depth of field, professional studio headshot, photorealistic, natural skin texture.' },
  { id: 'commercial', label: 'Commercial', prompt: 'Bright commercial headshot, clean white background, soft even beauty lighting, warm friendly genuine smile, vibrant natural colors, shot on 85mm, sharp focus on eyes, professional talent headshot, photorealistic.' },
  { id: 'corporate', label: 'Corporate', prompt: 'Professional corporate business headshot, neutral grey background, soft directional lighting, confident approachable expression, business attire, shot on 85mm, clean and modern, photorealistic, natural skin texture.' },
  { id: 'editorial', label: 'Editorial', prompt: 'High-end editorial fashion headshot, artistic side lighting, textured background, expressive character, magazine quality, shot on 85mm, shallow depth of field, photorealistic, detailed skin.' },
  { id: 'bw', label: 'Black & White', prompt: 'Classic black and white dramatic headshot, high contrast chiaroscuro lighting, dark background, timeless actor headshot, shot on 85mm, photorealistic, rich grayscale tones, natural skin texture.' },
  { id: 'outdoor', label: 'Outdoor Natural', prompt: 'Natural outdoor headshot, soft window-style daylight, blurred neutral urban background, relaxed genuine expression, shot on 85mm, shallow depth of field, photorealistic, natural skin texture.' },
];

const RATIOS = ['3:4', '4:3', '1:1', '9:16', '16:9'];

const EXPRESSIONS = [
  { id: 'neutral', label: 'Neutral', prompt: 'neutral calm expression, relaxed face, soft direct gaze' },
  { id: 'smiling', label: 'Smiling', prompt: 'warm genuine smiling expression, natural relaxed smile, bright friendly eyes' },
  { id: 'serious', label: 'Serious', prompt: 'serious intense expression, focused determined gaze, no smile' },
  { id: 'sad', label: 'Sad', prompt: 'subtle sad melancholic expression, downcast eyes, pensive emotional mood' },
  { id: 'laughing', label: 'Laughing', prompt: 'natural laughing expression, joyful open smile, eyes crinkled in genuine laughter' },
];

export default function InlineHeadshot({ userEmail, onDone }) {
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [styleId, setStyleId] = useState('theatrical');
  const [expressionId, setExpressionId] = useState('neutral');
  const [addon, setAddon] = useState('');
  const [format, setFormat] = useState('3:4');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [resultUrl, setResultUrl] = useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const onUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotoUrl(file_url);
    } catch {
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!photoUrl) { setError('Upload a portrait first.'); return; }
    const style = HEADSHOT_STYLES.find(s => s.id === styleId) || HEADSHOT_STYLES[0];
    const expression = EXPRESSIONS.find(e => e.id === expressionId) || EXPRESSIONS[0];
    // Nano Banana 2 is conversational/edit-based: pass the portrait as the
    // image_input reference and describe the desired headshot in the prompt.
    // The model preserves the person's identity while restyling the look.
    const fullPrompt = `Edit this exact person's photo into a professional actor headshot. STRICT IDENTITY LOCK: you must NOT change the person's eye color, hair color, skin tone, face shape, or any facial features — they must remain the exact same person with the exact same eyes and hair as the reference photo. Only restyle the lighting, background, wardrobe, mood, and facial expression. ${style.prompt} Facial expression: ${expression.prompt}.${addon.trim() ? ` ${addon.trim()}` : ''} Do NOT alter eye color. Do NOT alter hair color. Head and shoulders composition, centered, photorealistic, natural skin texture.`;
    setStatus('generating'); setError('');
    try {
      const res = await base44.functions.invoke('replicateGenerate', {
        method: 'headshot',
        photo_url: photoUrl,
        prompt: fullPrompt,
        aspect_ratio: format,
      });
      if (res.data?.file_url) {
        setResultUrl(res.data.file_url);
        setShowSaveModal(true);
      } else if (res.data?.error) {
        const m = res.data.error;
        setError(/insufficient|token|balance/i.test(m) ? 'Not enough tokens for this tool.' : m);
      } else {
        setError('Generation failed. Please try again.');
      }
    } catch (e) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || e?.message;
      setError(/insufficient|token|balance/i.test(msg || '') ? 'Not enough tokens for this tool.' : (msg || 'Generation failed.'));
    } finally {
      setStatus('idle');
    }
  };

  if (status === 'generating') return (
    <div className="flex flex-col items-center gap-3 py-10">
      <Loader2 size={28} className="text-rose-400 animate-spin" />
      <p className="text-white text-sm">Generating headshot… (1–3 min)</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Portrait upload */}
      <div>
        <p className="text-white text-xs font-bold uppercase tracking-wider mb-2">Actor Portrait</p>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="w-20 h-24 flex flex-col items-center justify-center gap-1 border-2 border-dashed border-rose-500/40 rounded-xl cursor-pointer hover:border-rose-500/70 transition-colors flex-shrink-0">
            {uploading ? <Loader2 size={18} className="text-rose-400 animate-spin" /> : <Upload size={18} className="text-rose-400" />}
            <span className="text-rose-400 text-[9px] font-bold text-center leading-tight">Upload Portrait</span>
            <input type="file" accept="image/*" className="hidden" onChange={e => onUpload(e.target.files?.[0])} />
          </label>
          {photoUrl && (
            <div className="relative w-20 h-24 rounded-xl overflow-hidden flex-shrink-0">
              <img src={photoUrl} alt="" className="w-full h-full object-cover" />
              <button onClick={() => setPhotoUrl(null)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 flex items-center justify-center text-white">
                <X size={8} />
              </button>
            </div>
          )}
          {!photoUrl && <p className="text-white text-xs">Upload a clear front-facing portrait of the actor.</p>}
        </div>
      </div>

      {/* Headshot style presets */}
      <div>
        <p className="text-white text-xs font-bold uppercase tracking-wider mb-2">Headshot Style</p>
        <div className="grid grid-cols-3 gap-2">
          {HEADSHOT_STYLES.map(s => (
            <button key={s.id} onClick={() => setStyleId(s.id)}
              className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 transition-all ${styleId === s.id ? 'border-rose-500 bg-rose-500/20 text-white' : 'border-white/10 bg-white/5 text-white'}`}>
              <Camera size={16} className={styleId === s.id ? 'text-rose-400' : 'text-white/60'} />
              <span className="text-[10px] font-bold">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Expression */}
      <div>
        <p className="text-white text-xs font-bold uppercase tracking-wider mb-2">Expression</p>
        <div className="grid grid-cols-5 gap-2">
          {EXPRESSIONS.map(e => (
            <button key={e.id} onClick={() => setExpressionId(e.id)}
              className={`py-2 rounded-xl border-2 text-[11px] font-bold transition-all ${expressionId === e.id ? 'border-rose-500 bg-rose-500/20 text-white' : 'border-white/10 bg-white/5 text-white'}`}>
              {e.label}
            </button>
          ))}
        </div>
      </div>

      {/* Optional custom details */}
      <div>
        <p className="text-white text-xs font-bold uppercase tracking-wider mb-2">Extra Details <span className="text-white/30 normal-case font-normal">(optional)</span></p>
        <textarea value={addon} onChange={e => setAddon(e.target.value)} placeholder="e.g. wearing a black turtleneck, soft smile, warm tone…" rows={2}
          className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30 resize-none" />
      </div>

      {/* Format */}
      <div className="flex items-center gap-2">
        <span className="text-white text-xs font-bold uppercase tracking-wider">Format</span>
        <div className="flex gap-1.5 flex-wrap">
          {RATIOS.map(r => (
            <button key={r} onClick={() => setFormat(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${format === r ? 'bg-rose-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button onClick={handleGenerate} disabled={!photoUrl}
        className="w-full py-4 bg-rose-600 text-white font-bold rounded-2xl disabled:opacity-40 transition-opacity flex items-center justify-center gap-2">
        <Sparkles size={18} /> Generate Headshot ({format}) →
      </button>

      {/* Result preview */}
      {resultUrl && !showSaveModal && (
        <div className="space-y-3">
          <p className="text-white text-xs font-bold uppercase tracking-wider">Result</p>
          <div className="rounded-2xl overflow-hidden bg-white/5 relative">
            <img src={resultUrl} alt="Headshot" className="w-full max-h-[50vh] object-contain bg-black" />
            <span className="absolute top-2 left-2 px-2 py-1 bg-black/70 text-yellow-400 text-xs font-bold rounded-full">{format}</span>
          </div>
          <button onClick={() => setShowSaveModal(true)}
            className="w-full py-3 bg-yellow-400 text-black font-bold rounded-2xl">
            Save to Vault →
          </button>
        </div>
      )}

      {showSaveModal && resultUrl && (
        <SaveToVaultModal
          userEmail={userEmail}
          imageUrl={resultUrl}
          mediaType="image"
          onSaved={(saved) => {
            setShowSaveModal(false);
            const url = resultUrl;
            setResultUrl(null);
            onDone(url, 'image', saved.id);
          }}
          onClose={() => setShowSaveModal(false)}
        />
      )}
    </div>
  );
}