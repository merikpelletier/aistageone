import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Sparkles, Film, Loader2, ChevronLeft, CheckCircle2, Upload, User, Coins } from 'lucide-react';
import { toast } from 'sonner';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';
import TokenPurchaseModal from '@/components/studio/TokenPurchaseModal';
import { useTokenBalance } from '@/hooks/useTokenBalance';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'comedy', label: 'Comedy' },
  { id: 'character_intro', label: 'Intros' },
];

export default function SketchStudio({ user }) {
  const qc = useQueryClient();
  const [category, setCategory] = useState('all');
  const [photoUrl, setPhotoUrl] = useState(null);      // uploaded photo file_url (preview)
  const [photoFile, setPhotoFile] = useState(null);    // original File, for cropping at gen time
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [selected, setSelected] = useState(null);      // theme object
  const [duration, setDuration] = useState(5);
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [showSaveVault, setShowSaveVault] = useState(false);
  const [showBuyTokens, setShowBuyTokens] = useState(false);
  const [cost, setCost] = useState(null);
  const { balance, refresh: refreshBalance } = useTokenBalance(user?.email);

  useEffect(() => {
    base44.entities.ToolPricing.filter({ tool_id: 'ai_video', is_active: true })
      .then((r) => setCost(r[0]?.token_cost ?? 0))
      .catch(() => {});
  }, []);

  const insufficient = balance !== null && cost !== null && balance < cost;

  const { data: themes = [], isLoading } = useQuery({
    queryKey: ['sketchTemplates', 'active'],
    queryFn: () => base44.entities.SketchTemplate.filter({ is_active: true }, 'order', 100),
    staleTime: 60 * 1000,
  });

  const filtered = category === 'all' ? themes : themes.filter((t) => t.category === category);

  const handlePhotoUpload = async (file) => {
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotoUrl(file_url);
      setPhotoFile(file);
    } catch (err) {
      toast.error('Photo upload failed');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const openTheme = (theme) => {
    if (!photoUrl) {
      toast.error('Upload your photo first');
      return;
    }
    setSelected(theme);
    setResult(null);
    setDuration(theme.default_duration || 5);
    setAspectRatio(theme.default_aspect_ratio || '9:16');
  };

  // Crop an image File to a target aspect ratio (e.g. "9:16"), centered.
  // Seedance ignores the aspect_ratio param when an image is provided, so we
  // must pre-crop the photo to the chosen ratio for the output video to match.
  const cropToFile = (file, ratio) => new Promise((resolve, reject) => {
    const [w, h] = ratio.split(':').map(Number);
    const targetAspect = w / h;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const imgAspect = img.width / img.height;
      let cropW, cropH, sx, sy;
      if (imgAspect > targetAspect) {
        cropH = img.height;
        cropW = img.height * targetAspect;
        sx = (img.width - cropW) / 2;
        sy = 0;
      } else {
        cropW = img.width;
        cropH = img.width / targetAspect;
        sx = 0;
        sy = (img.height - cropH) / 2;
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(cropW);
      canvas.height = Math.round(cropH);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Crop failed'));
        resolve(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.92);
    };
    img.onerror = reject;
    img.src = url;
  });

  const handleGenerate = async () => {
    if (!selected || !photoUrl) return;
    const useMorph = !!(selected.transformation_prompt || '').trim();
    // Variant support: a theme can list multiple reveals separated by "||" in
    // BOTH the transformation_prompt (the END-STATE look) and the video_prompt
    // (the reveal action + spoken line). We pick ONE matched index so the look
    // always corresponds to its line, and the reveal changes every generation.
    let morphPrompt = (selected.transformation_prompt || '').trim();
    let prompt = (selected.video_prompt || '').trim();
    if (useMorph) {
      const looks = morphPrompt.split('||').map((s) => s.trim()).filter(Boolean);
      const actions = prompt.split('||').map((s) => s.trim()).filter(Boolean);
      if (looks.length > 1 || actions.length > 1) {
        const i = Math.floor(Math.random() * Math.max(looks.length, actions.length));
        morphPrompt = looks[i] ?? looks[0] ?? '';
        prompt = actions[i] ?? actions[0] ?? '';
      }
    }
    if (!useMorph && !prompt) {
      toast.error('This theme has no video prompt set. Ask an admin to add one.');
      return;
    }
    setIsGenerating(true);
    try {
      // Pre-crop the photo to the chosen aspect so the model output matches.
      let genImage = photoUrl;
      if (photoFile) {
        try {
          const cropped = await cropToFile(photoFile, aspectRatio);
          const { file_url } = await base44.integrations.Core.UploadFile({ file: cropped });
          genImage = file_url;
        } catch (e) {
          // If crop fails, fall back to the original photo.
          console.warn('Crop failed, using original photo', e);
        }
      }
      const res = await base44.functions.invoke('generateVideo', {
        prompt,
        image_url: genImage,
        duration,
        aspect_ratio: aspectRatio,
        resolution: '720p',
        use_as_reference: true,
        engine: useMorph ? 'kling_morph' : 'kling',
        transformation_prompt: useMorph ? morphPrompt : undefined,
      });
      if (res.data?.file_url) {
        setResult(res.data.file_url);
        refreshBalance();
      } else if (res.data?.error) {
        throw new Error(res.data.error);
      }
    } catch (err) {
      const data = err?.response?.data || {};
      const msg = data.error || data.message || err?.message || 'Failed to generate sketch';
      if (data.error === 'Insufficient tokens' || /insufficient tokens/i.test(String(msg))) {
        toast.error('Not enough tokens — buy more to generate.');
        setShowBuyTokens(true);
        refreshBalance();
      } else {
        toast.error(msg);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSavedToVault = () => {
    setShowSaveVault(false);
    setResult(null);
    setSelected(null);
    qc.invalidateQueries({ queryKey: ['vaultAssets', user?.email] });
  };

  // ── Theme picker (with upload at top) ──
  if (!selected) {
    return (
      <div className="mt-6">
        <div className="flex flex-col items-center mb-6">
          <p className="text-black text-sm font-black tracking-widest uppercase">Sketch Generator</p>
          <p className="text-black text-xs font-semibold">Pick a funny theme, then upload your photo</p>
        </div>

        {/* Upload your photo — at the top */}
        {photoUrl ? (
          <div className="flex items-center gap-3 mb-4">
            <img src={photoUrl} alt="you" className="w-12 h-12 rounded-xl object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-black text-sm font-bold">Your photo is ready</p>
              <p className="text-black/50 text-xs truncate">Now pick a theme below</p>
            </div>
            <button onClick={() => { setPhotoUrl(null); setPhotoFile(null); }} className="text-black/60 text-xs font-bold underline underline-offset-2">
              Change
            </button>
          </div>
        ) : (
          <label className="block w-full aspect-[3/4] max-w-xs mx-auto bg-black rounded-3xl flex items-center justify-center cursor-pointer relative overflow-hidden mb-4">
            {uploadingPhoto ? (
              <div className="flex flex-col items-center text-yellow-400">
                <Loader2 size={32} className="animate-spin" />
                <p className="text-xs mt-2 font-bold">Uploading…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center text-yellow-400">
                <div className="w-20 h-20 bg-yellow-400/20 rounded-2xl flex items-center justify-center mb-3">
                  <Upload size={32} />
                </div>
                <p className="font-bold text-base">Upload a photo</p>
                <p className="text-yellow-400/70 text-xs mt-1">Your face, full body, or any selfie</p>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handlePhotoUpload(e.target.files?.[0])}
            />
          </label>
        )}

        <div className="flex gap-2 mb-4">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                category === c.id ? 'bg-black text-yellow-400' : 'bg-black/10 text-black hover:bg-black/20'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-black" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-black/10 rounded-3xl p-10 text-center border-2 border-dashed border-black/20">
            <div className="w-20 h-20 bg-black/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Film size={40} className="text-black" />
            </div>
            <p className="text-black text-lg font-bold mb-2">No themes yet</p>
            <p className="text-black text-sm">Ask an admin to add funny themes in the Admin panel</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((t) => (
              <motion.button
                key={t.id}
                whileTap={{ scale: 0.97 }}
                onClick={() => openTheme(t)}
                className="bg-black rounded-3xl overflow-hidden text-left active:opacity-90"
              >
                <div className="aspect-[4/3] bg-yellow-400/20 relative">
                  {t.cover_image ? (
                    <img src={t.cover_image} alt={t.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Sparkles size={32} className="text-yellow-400" />
                    </div>
                  )}
                  {cost !== null && (
                    <span className="absolute top-2 right-2 bg-black/80 text-yellow-400 text-[11px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Coins size={11} /> {cost} Ⓣ
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-white text-sm font-bold truncate">{t.name}</p>
                  {t.description && (
                    <p className="text-yellow-400 text-xs mt-1 line-clamp-2">{t.description}</p>
                  )}
                  <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wide text-yellow-400/70">
                    {t.category === 'comedy' ? 'Comedy' : 'Character Intro'}
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Generate / result ──
  return (
    <div className="mt-6">
      <button
        onClick={() => { setSelected(null); setResult(null); }}
        className="flex items-center gap-2 text-black text-sm font-bold mb-4"
      >
        <ChevronLeft size={20} /> Back to themes
      </button>

      <div className="bg-black rounded-3xl p-6">
        <p className="text-yellow-400 font-black text-lg">{selected.name}</p>
        {selected.description && (
          <p className="text-white/70 text-sm mt-1 mb-4">{selected.description}</p>
        )}

        {/* Photo + scenario preview */}
        <div className="flex gap-3 mb-5">
          <img src={photoUrl} alt="you" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-yellow-400 text-[10px] font-bold uppercase tracking-wide flex items-center gap-1">
              <User size={12} /> Your photo in this scene
            </p>
            <p className="text-white/80 text-xs mt-1 line-clamp-3">{selected.scenario}</p>
          </div>
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <p className="text-yellow-400 text-xs font-bold uppercase tracking-wide mb-1">Duration</p>
            <div className="flex gap-2">
              {[5, 10].map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                    duration === d ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white'
                  }`}
                >
                  {d}s
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-yellow-400 text-xs font-bold uppercase tracking-wide mb-1">Aspect</p>
            <div className="flex gap-2">
              {['16:9', '9:16', '1:1'].map((r) => (
                <button
                  key={r}
                  onClick={() => setAspectRatio(r)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                    aspectRatio === r ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Cost & balance */}
        <div className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2 mb-3">
          <p className="text-white text-xs font-bold">Cost: <span className="text-yellow-400">{cost !== null ? `${cost} Ⓣ` : '…'}</span></p>
          <p className="text-white text-xs font-bold">Balance: <span className={insufficient ? 'text-red-400' : 'text-yellow-400'}>{balance !== null ? `${balance} Ⓣ` : '…'}</span></p>
        </div>
        {insufficient && (
          <button
            onClick={() => setShowBuyTokens(true)}
            className="w-full bg-red-500 text-white font-bold py-3 rounded-2xl mb-3 flex items-center justify-center gap-2"
          >
            <Coins size={18} /> Not enough tokens — Buy more
          </button>
        )}

        {/* Generate */}
        {!result && (
          <button
            onClick={handleGenerate}
            disabled={isGenerating || insufficient}
            className="w-full bg-yellow-400 text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isGenerating ? (
              <><Loader2 size={20} className="animate-spin" /> Generating… (~2-3 min)</>
            ) : (
              <><Sparkles size={20} /> Generate Sketch</>
            )}
          </button>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-2xl p-3">
              <video src={result} controls className="w-full rounded-lg" />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setResult(null); }}
                className="flex-1 bg-white/10 text-white font-bold py-3 rounded-2xl"
              >
                Regenerate
              </button>
              <button
                onClick={() => setShowSaveVault(true)}
                className="flex-1 bg-green-600 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={20} /> Save to Vault
              </button>
            </div>
          </div>
        )}
      </div>

      {showSaveVault && result && (
        <SaveToVaultModal
          userEmail={user?.email}
          imageUrl={result}
          mediaType="video"
          onClose={() => setShowSaveVault(false)}
          onSaved={handleSavedToVault}
        />
      )}

      {showBuyTokens && (
        <TokenPurchaseModal onClose={() => setShowBuyTokens(false)} onPurchased={refreshBalance} />
      )}
    </div>
  );
}