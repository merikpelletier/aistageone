import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Sparkles, Film, Loader2, ChevronLeft, CheckCircle2, Upload, User, Coins } from 'lucide-react';
import { toast } from 'sonner';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';
import TokenPurchaseModal from '@/components/studio/TokenPurchaseModal';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { useAiModelOptions } from '@/hooks/useAiModelOptions';
import { useAiPriceQuote } from '@/hooks/useAiPriceQuote';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'comedy', label: 'Comedy' },
  { id: 'character_intro', label: 'Intros' },
];

export default function SketchStudio({ user }) {
  const qc = useQueryClient();
  const [category, setCategory] = useState('all');
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [selected, setSelected] = useState(null);
  const [duration, setDuration] = useState(5);
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [showSaveVault, setShowSaveVault] = useState(false);
  const [showBuyTokens, setShowBuyTokens] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const { balance, refresh: refreshBalance } = useTokenBalance(user?.email);

  const currentEngine = (selected?.transformation_prompt || '').trim() ? 'kling_morph' : 'kling';
  const pricingInput = {
    prompt: (selected?.video_prompt || '').trim(),
    image_url: photoUrl || undefined,
    duration,
    resolution: '720p',
    aspect_ratio: aspectRatio,
    generate_audio: currentEngine === 'kling_morph',
  };
  const { options: modelOptions, loading: modelsLoading } = useAiModelOptions({
    service: `generateVideo:${currentEngine}`,
    kind: 'video',
    input: pricingInput,
    enabled: Boolean(selected),
  });
  const effectiveModel = selectedModel || modelOptions.find(m => m.recommended)?.model_key || modelOptions[0]?.model_key || null;
  const { quote: priceQuote, loading: priceLoading } = useAiPriceQuote({
    service: `generateVideo:${currentEngine}`,
    kind: 'video',
    input: pricingInput,
    modelKey: effectiveModel,
    enabled: Boolean(selected),
  });
  const cost = priceQuote?.credits ?? null;
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
    } catch {
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
      canvas.getContext('2d').drawImage(img, sx, sy, cropW, cropH, 0, 0, canvas.width, canvas.height);
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
      let genImage = photoUrl;
      if (photoFile) {
        try {
          const cropped = await cropToFile(photoFile, aspectRatio);
          const { file_url } = await base44.integrations.Core.UploadFile({ file: cropped });
          genImage = file_url;
        } catch (e) {
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
        model_key: effectiveModel || undefined,
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
        toast.error('Not enough credits — buy more to generate.');
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

  if (!selected) {
    return (
      <div className="w-full bg-[#202328] px-4 py-5 pb-28 text-white lg:pb-32">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex items-end justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#23c7be]">Stages</p>
              <h2 className="text-2xl font-black text-white">Sketch Generator</h2>
              <p className="mt-1 text-sm text-white/45">Upload a photo, then choose a theme.</p>
            </div>
            {photoUrl && (
              <div className="flex items-center gap-3 rounded-[4px] border border-white/10 bg-[#17191d] px-3 py-2">
                <img src={photoUrl} alt="you" className="h-10 w-10 rounded-[3px] object-cover" />
                <div><p className="text-xs font-bold text-white">Photo ready</p><button onClick={() => { setPhotoUrl(null); setPhotoFile(null); }} className="text-[10px] font-bold text-[#8ee9e4]">Change</button></div>
              </div>
            )}
          </div>

          <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="space-y-4">
              {!photoUrl && (
                <label className="flex min-h-[330px] cursor-pointer flex-col items-center justify-center rounded-[4px] border border-dashed border-white/20 bg-[#17191d] p-6 text-center transition hover:border-[#23c7be]/60 hover:bg-[#1d2126]">
                  {uploadingPhoto ? (
                    <><Loader2 size={30} className="animate-spin text-[#23c7be]" /><p className="mt-3 text-sm font-bold">Uploading…</p></>
                  ) : (
                    <><div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[3px] border border-[#23c7be]/30 bg-[#23c7be]/10"><Upload size={28} className="text-[#23c7be]" /></div><p className="text-base font-black">Upload a photo</p><p className="mt-1 text-xs text-white/40">Face, full body or selfie</p></>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e.target.files?.[0])} />
                </label>
              )}

              <div className="rounded-[4px] border border-white/10 bg-[#17191d] p-3">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/45">Categories</p>
                <div className="flex flex-wrap gap-2 lg:flex-col">
                  {CATEGORIES.map((c) => (
                    <button key={c.id} onClick={() => setCategory(c.id)} className={`rounded-[3px] border px-3 py-2 text-left text-xs font-black transition ${category === c.id ? 'border-[#23c7be]/40 bg-[#23c7be]/12 text-[#8ee9e4]' : 'border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.07]'}`}>{c.label}</button>
                  ))}
                </div>
              </div>
            </aside>

            <section>
              {isLoading ? (
                <div className="flex min-h-72 items-center justify-center rounded-[4px] border border-white/10 bg-[#17191d]"><Loader2 size={28} className="animate-spin text-[#23c7be]" /></div>
              ) : filtered.length === 0 ? (
                <div className="flex min-h-72 flex-col items-center justify-center rounded-[4px] border border-dashed border-white/15 bg-[#17191d] p-10 text-center"><Film size={36} className="text-[#23c7be]" /><p className="mt-4 text-lg font-black">No themes yet</p><p className="mt-1 text-sm text-white/40">Ask an admin to add themes in the Admin panel.</p></div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((t) => (
                    <motion.button key={t.id} whileTap={{ scale: 0.98 }} onClick={() => openTheme(t)} className="overflow-hidden rounded-[4px] border border-white/10 bg-[#17191d] text-left transition hover:border-[#23c7be]/45 hover:shadow-[inset_2px_0_0_#23c7be]">
                      <div className="relative aspect-[16/10] bg-[#1d2126]">{t.cover_image ? <img src={t.cover_image} alt={t.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Sparkles size={32} className="text-[#23c7be]" /></div>}</div>
                      <div className="p-3.5"><p className="truncate text-sm font-black text-white">{t.name}</p>{t.description && <p className="mt-1 line-clamp-2 text-xs text-white/45">{t.description}</p>}<span className="mt-2 inline-block text-[10px] font-black uppercase tracking-wide text-[#8ee9e4]">{t.category === 'comedy' ? 'Comedy' : 'Character Intro'}</span></div>
                    </motion.button>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#202328] px-4 py-5 pb-28 text-white lg:pb-32">
      <div className="mx-auto max-w-5xl">
        <button onClick={() => { setSelected(null); setResult(null); }} className="mb-4 flex items-center gap-2 text-sm font-bold text-white/60 hover:text-white"><ChevronLeft size={20} /> Back to themes</button>

        <div className="rounded-[4px] border border-white/10 bg-[#17191d] p-5 md:p-6">
          <div className="mb-5 flex gap-3 border-b border-white/10 pb-4">
            <img src={photoUrl} alt="you" className="h-16 w-16 flex-shrink-0 rounded-[3px] object-cover" />
            <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-wide text-[#23c7be]"><User size={12} className="mr-1 inline" />Your photo in this scene</p><h3 className="mt-1 text-lg font-black text-white">{selected.name}</h3>{selected.description && <p className="mt-1 text-sm text-white/45">{selected.description}</p>}<p className="mt-2 line-clamp-3 text-xs text-white/65">{selected.scenario}</p></div>
          </div>

          <div className="mb-5 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/50">AI Model</p>
            <select value={effectiveModel || ''} onChange={e => setSelectedModel(e.target.value || null)} disabled={modelsLoading || modelOptions.length === 0} className="w-full rounded-[3px] border border-white/15 bg-black/25 px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#23c7be] disabled:opacity-50">
              {modelsLoading && <option value="">Loading models…</option>}
              {!modelsLoading && modelOptions.length === 0 && <option value="">No model available</option>}
              {modelOptions.map(m => <option key={m.model_key} value={m.model_key}>{m.name || m.model_key}{m.recommended ? ' — Recommended' : ''}{m.credits ? ` — ${m.credits} credits` : ''}</option>)}
            </select>
          </div>

          <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div><p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/50">Duration</p><div className="flex gap-2">{[5,10].map(d => <button key={d} onClick={() => setDuration(d)} className={`flex-1 rounded-[3px] border py-2.5 text-sm font-black ${duration === d ? 'border-[#23c7be]/40 bg-[#23c7be]/12 text-[#8ee9e4]' : 'border-white/10 bg-white/[0.04] text-white/65'}`}>{d}s</button>)}</div></div>
            <div><p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/50">Aspect</p><div className="flex gap-2">{['16:9','9:16','1:1'].map(r => <button key={r} onClick={() => setAspectRatio(r)} className={`flex-1 rounded-[3px] border py-2.5 text-xs font-black ${aspectRatio === r ? 'border-[#23c7be]/40 bg-[#23c7be]/12 text-[#8ee9e4]' : 'border-white/10 bg-white/[0.04] text-white/65'}`}>{r}</button>)}</div></div>
          </div>

          <div className="mb-4 flex flex-col gap-1.5 rounded-[3px] border border-white/10 bg-black/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs font-bold text-white/70">Cost: <span className="text-[#8ee9e4]">{priceLoading ? 'Calculating…' : cost !== null ? `${cost} credits` : '…'}</span></p><p className="text-xs font-bold text-white/70">Balance: <span className={insufficient ? 'text-red-400' : 'text-[#8ee9e4]'}>{balance !== null ? `${balance} credits` : '…'}</span></p></div>

          {insufficient && <button onClick={() => setShowBuyTokens(true)} className="mb-3 flex w-full items-center justify-center gap-2 rounded-[3px] border border-red-400/30 bg-red-400/10 py-3 font-bold text-red-200"><Coins size={18} /> Not enough credits — Buy more</button>}

          {!result ? (
            <button onClick={handleGenerate} disabled={isGenerating || insufficient} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-[3px] bg-[#23c7be] py-4 font-black text-[#071211] disabled:bg-white/[0.05] disabled:text-white/30">{isGenerating ? <><Loader2 size={20} className="animate-spin" /> Generating… (~2-3 min)</> : <><Sparkles size={20} /> Generate Sketch</>}</button>
          ) : (
            <div className="space-y-4"><div className="rounded-[4px] border border-white/10 bg-black p-3"><video src={result} controls className="w-full rounded-[3px]" /></div><div className="flex gap-3"><button onClick={() => setResult(null)} className="flex-1 rounded-[3px] border border-white/10 bg-white/[0.04] py-3 font-bold text-white">Regenerate</button><button onClick={() => setShowSaveVault(true)} className="flex flex-1 items-center justify-center gap-2 rounded-[3px] bg-[#23c7be] py-3 font-black text-[#071211]"><CheckCircle2 size={20} /> Save to Vault</button></div></div>
          )}
        </div>

        {showSaveVault && result && <SaveToVaultModal userEmail={user?.email} imageUrl={result} mediaType="video" onClose={() => setShowSaveVault(false)} onSaved={handleSavedToVault} />}
        {showBuyTokens && <TokenPurchaseModal onClose={() => setShowBuyTokens(false)} onPurchased={refreshBalance} />}
      </div>
    </div>
  );
}
