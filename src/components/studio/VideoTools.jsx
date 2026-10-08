import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Film, X, Loader2, Type, CheckCircle2, Image as ImageIcon, Sparkles, Upload, Video, Play, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import ProductionContextInfo from '@/components/ProductionContextInfo';
import VaultPickerModal from '@/components/studio/VaultPickerModal';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';
import { useAiPriceQuote } from '@/hooks/useAiPriceQuote';
import { useAiModelOptions } from '@/hooks/useAiModelOptions';

const RATIOS = [
  { id: '16:9', label: 'Landscape', icon: '🎬' },
  { id: '9:16', label: 'Portrait', icon: '📱' },
  { id: '1:1', label: 'Square', icon: '🖼️' },
];

const DURATIONS = [
  { id: 5, label: '5s' },
  { id: 10, label: '10s' },
];

const RESOLUTIONS = [
  { id: '480p', label: '480p', quality: 'Fast' },
  { id: '720p', label: '720p', quality: 'HD' },
];

export default function VideoTools({ onComplete, onClose, recommendedTools = [], referenceMedia = [], productionMethod = null, block = null, character = null, initialMode = null, episodePageId, blockId, user, embedded = false }) {
  const showContext = productionMethod && block;
  const [mode, setMode] = useState(initialMode || 'text');
  const [prompt, setPrompt] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [duration, setDuration] = useState(5);
  const [resolution, setResolution] = useState('480p');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [showVaultPicker, setShowVaultPicker] = useState(false);
  const [vaultPickerTarget, setVaultPickerTarget] = useState(null);
  const [showSaveVault, setShowSaveVault] = useState(false);
  const [userEmail, setUserEmail] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);

  const quoteService = 'generateVideo:seedance';
  const pricingInput = { duration, resolution, aspect_ratio: aspectRatio, prompt, image_url: imagePreview || undefined, video_url: videoPreview || undefined };
  const { options: modelOptions, loading: modelsLoading } = useAiModelOptions({ service: quoteService, kind: 'video', input: pricingInput });
  const effectiveModel = selectedModel || modelOptions.find(m => m.recommended)?.model_key || modelOptions[0]?.model_key || null;
  const { quote: priceQuote, loading: priceLoading } = useAiPriceQuote({ service: quoteService, kind: 'video', input: pricingInput, modelKey: effectiveModel });

  useEffect(() => {
    base44.auth.me().then(u => setUserEmail(u?.email)).catch(() => {});
  }, []);

  useEffect(() => {
    if (recommendedTools.length > 0) {
      if (recommendedTools.includes('text_to_video')) setMode('text');
      else if (recommendedTools.includes('image_to_video')) setMode('image');
      else if (recommendedTools.includes('video_reference')) setMode('video');
    }
  }, [recommendedTools]);

  const handleImageUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleVideoUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => setVideoPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (mode === 'text' && !prompt.trim()) return;
    if (mode === 'image' && !imagePreview) return;
    if (mode === 'video' && !videoPreview) return;

    setIsGenerating(true);
    try {
      const response = await base44.functions.invoke('generateVideo', {
        prompt: prompt || (mode === 'image' ? 'Animate this image' : 'Use as reference'),
        image_url: (mode === 'image' || mode === 'video') ? imagePreview : null,
        video_url: mode === 'video' ? videoPreview : null,
        duration,
        aspect_ratio: aspectRatio,
        resolution,
        model_key: effectiveModel || undefined,
      });
      if (response.data?.file_url) setResult(response.data.file_url);
    } catch (error) {
      const msg = error.response?.data?.message || error.response?.data?.error;
      toast.error(msg?.includes('Insufficient tokens') ? 'Not enough tokens. Please buy more.' : (msg || 'Failed to generate video'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleComplete = () => result && onComplete(result);
  const handleUseVideo = () => {
    if (!result) return;
    if (!user?.email) { handleComplete(); return; }
    setShowSaveVault(true);
  };

  const handleVaultSaved = async () => {
    setShowSaveVault(false);
    if (episodePageId && blockId && user?.email) {
      setIsSaving(true);
      try {
        const timelines = await base44.entities.UserTimeline.filter({ episode_page_id: episodePageId, user_email: user.email });
        let timeline = timelines[0];
        if (!timeline) {
          await base44.entities.UserTimeline.create({ episode_page_id: episodePageId, user_email: user.email, block_overrides: [{ block_id: blockId, user_media_url: result, status: 'uploaded' }] });
        } else {
          const existingOverrides = timeline.block_overrides || [];
          const otherBlocks = existingOverrides.filter(b => b.block_id !== blockId);
          await base44.entities.UserTimeline.update(timeline.id, { block_overrides: [...otherBlocks, { block_id: blockId, user_media_url: result, status: 'uploaded' }] });
        }
        toast.success('Video saved to your Vault & episode!');
      } catch (err) {
        console.error('Error attaching video to episode:', err);
        toast.error('Saved to Vault, but failed to attach to episode');
      } finally {
        setIsSaving(false);
      }
    }
    handleComplete();
  };

  const activeButton = 'border-[#23c7be]/40 bg-[#23c7be]/12 text-[#8ee9e4]';
  const idleButton = 'border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08]';

  return (
    <div className={`fixed z-[100] ${embedded ? 'top-14 right-0 bottom-[64px] left-0 lg:bottom-0 lg:left-[var(--studio-toolbar-width)] overflow-y-auto bg-[#202328]' : 'inset-0 flex items-center justify-center bg-black/80 p-4'}`}>
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className={embedded ? 'min-h-full w-full overflow-y-auto bg-[#202328] p-5 pb-28 text-white md:p-8 md:pb-28 lg:pb-32' : 'max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[4px] border border-white/10 bg-[#202328] p-6 text-white'}>
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex items-center justify-between border-b border-white/10 bg-[#17191d] px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[3px] border border-[#23c7be]/30 bg-[#23c7be]/10 text-[#23c7be]"><Sparkles size={19} /></div>
              <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#23c7be]">Image & Video</p><h3 className="text-xl font-black text-white">{mode === 'video' ? 'Video Reference' : 'AI Video Generation'}</h3><p className="text-xs text-white/45">Kling / Seedance models</p></div>
            </div>
            {!embedded && <button onClick={onClose} className="rounded-[3px] border border-white/10 bg-white/[0.04] p-2 text-white hover:bg-white/10"><X size={20} /></button>}
          </div>

          {showContext && <ProductionContextInfo productionMethod={productionMethod} block={block} character={character} referenceMedia={referenceMedia} />}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              {!initialMode && recommendedTools.length === 0 && (
                <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/50">Generation Mode</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[['text','Text to Video',Type],['image','Image to Video',ImageIcon],['video','Video Reference',Video]].map(([id,label,Icon]) => <button key={id} onClick={() => setMode(id)} className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-[3px] border p-3 text-xs font-black transition ${mode === id ? activeButton : idleButton}`}><Icon size={20} />{label}</button>)}
                  </div>
                </section>
              )}

              {recommendedTools.length > 0 && (
                <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/50">Recommended Tools for This Block</p>
                  <div className="grid gap-2 sm:grid-cols-3">{recommendedTools.map(tool => {
                    const active = (tool === 'text_to_video' && mode === 'text') || (tool === 'image_to_video' && mode === 'image') || (tool === 'video_reference' && mode === 'video');
                    const Icon = tool === 'text_to_video' ? Type : tool === 'image_to_video' ? ImageIcon : Video;
                    const label = tool === 'text_to_video' ? 'Text to Video' : tool === 'image_to_video' ? 'Image to Video' : 'Video Reference';
                    return <button key={tool} onClick={() => setMode(tool === 'text_to_video' ? 'text' : tool === 'image_to_video' ? 'image' : 'video')} className={`flex items-center gap-2 rounded-[3px] border px-3 py-2.5 text-xs font-black ${active ? activeButton : idleButton}`}><Icon size={16} />{label}</button>;
                  })}</div>
                </section>
              )}

              {mode === 'text' && (
                <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
                  <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/50"><Type size={14} className="text-[#23c7be]" /> Video Prompt</p>
                  <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe your video scene in detail..." className="min-h-[130px] w-full resize-none rounded-[3px] border border-white/15 bg-black/25 p-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#23c7be]" maxLength={1000} />
                  <p className="mt-2 text-right text-[10px] text-white/35">{prompt.length}/1000 characters</p>
                </section>
              )}

              {mode === 'image' && (
                <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
                  <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/50"><ImageIcon size={14} className="text-[#23c7be]" /> Reference Image</p>
                  {imagePreview ? <div className="relative overflow-hidden rounded-[4px] border border-white/10 bg-black"><img src={imagePreview} alt="Preview" className="max-h-[430px] w-full object-contain" /><button onClick={() => setImagePreview(null)} className="absolute right-2 top-2 rounded-[3px] bg-black/75 p-2"><X size={15} /></button></div> : <div className="rounded-[4px] border border-dashed border-white/20 bg-black/20 p-8 text-center"><Upload size={30} className="mx-auto mb-3 text-[#23c7be]" /><p className="mb-3 text-sm text-white/70">Upload an image</p><input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} className="hidden" id="image-upload" /><label htmlFor="image-upload" className="inline-block cursor-pointer rounded-[3px] bg-[#23c7be] px-4 py-2 text-sm font-black text-black">Choose File</label></div>}
                </section>
              )}

              {mode === 'video' && (
                <div className="space-y-4">
                  <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
                    <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/50"><ImageIcon size={14} className="text-[#23c7be]" /> Subject Image <span className="normal-case font-normal">(character / scene)</span></p>
                    {imagePreview ? <div className="relative overflow-hidden rounded-[4px] border border-white/10 bg-black"><img src={imagePreview} alt="Preview" className="max-h-[330px] w-full object-contain" /><button onClick={() => setImagePreview(null)} className="absolute right-2 top-2 rounded-[3px] bg-black/75 p-2"><X size={15} /></button></div> : <div className="rounded-[4px] border border-dashed border-white/20 bg-black/20 p-6 text-center"><ImageIcon size={28} className="mx-auto mb-3 text-[#23c7be]" /><p className="mb-3 text-sm text-white/55">Upload your image or pick from Vault</p><div className="flex justify-center gap-2"><input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} className="hidden" id="image-upload-vref" /><label htmlFor="image-upload-vref" className="inline-flex cursor-pointer items-center gap-2 rounded-[3px] bg-[#23c7be] px-4 py-2 text-sm font-black text-black"><Upload size={14} /> Upload</label><button onClick={() => { setVaultPickerTarget('image'); setShowVaultPicker(true); }} className="inline-flex items-center gap-2 rounded-[3px] border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-white"><Folder size={14} /> Vault</button></div></div>}
                  </section>

                  <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
                    <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/50"><Video size={14} className="text-[#23c7be]" /> Motion Reference Video <span className="normal-case font-normal">(movement)</span></p>
                    {videoPreview ? <div className="relative overflow-hidden rounded-[4px] border border-white/10 bg-black"><video src={videoPreview} controls className="max-h-[330px] w-full object-contain" /><button onClick={() => setVideoPreview(null)} className="absolute right-2 top-2 rounded-[3px] bg-black/75 p-2"><X size={15} /></button></div> : <div className="space-y-3">
                      {referenceMedia.filter(url => url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i)).length > 0 && <div><p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/40">From Series</p><div className="grid grid-cols-3 gap-2">{referenceMedia.filter(url => url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i)).map((url,i) => <button key={i} onClick={() => setVideoPreview(url)} className="relative aspect-square overflow-hidden rounded-[3px] border border-white/10"><video src={url} className="h-full w-full object-cover" muted /><div className="absolute inset-0 flex items-center justify-center bg-black/20"><Play size={16} className="fill-white text-white" /></div></button>)}</div></div>}
                      <div className="rounded-[4px] border border-dashed border-white/20 bg-black/20 p-6 text-center"><Video size={28} className="mx-auto mb-3 text-[#23c7be]" /><p className="mb-3 text-sm text-white/55">Upload or pick from Vault</p><div className="flex justify-center gap-2"><input type="file" accept="video/*" onChange={(e) => e.target.files?.[0] && handleVideoUpload(e.target.files[0])} className="hidden" id="video-upload" /><label htmlFor="video-upload" className="inline-flex cursor-pointer items-center gap-2 rounded-[3px] bg-[#23c7be] px-4 py-2 text-sm font-black text-black"><Upload size={14} /> Upload</label><button onClick={() => { setVaultPickerTarget('video'); setShowVaultPicker(true); }} className="inline-flex items-center gap-2 rounded-[3px] border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-white"><Folder size={14} /> Vault</button></div></div>
                    </div>}
                  </section>
                </div>
              )}

              {referenceMedia.length > 0 && mode !== 'video' && (
                <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4"><p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/50">Block Reference Media</p><div className="grid grid-cols-3 gap-2">{referenceMedia.map((url,i) => <button key={i} onClick={() => { if (url.match(/\.(mp4|webm|ogg|mov)$/i)) { setVideoPreview(url); setImagePreview(null); setMode('video'); } else { setImagePreview(url); setVideoPreview(null); setMode('image'); } }} className="relative aspect-square overflow-hidden rounded-[3px] border border-white/10 hover:border-[#23c7be]/50">{url.match(/\.(mp4|webm|ogg|mov)$/i) ? <video src={url} className="h-full w-full object-cover" /> : <img src={url} alt="" className="h-full w-full object-cover" />}</button>)}</div></section>
              )}
            </div>

            <aside className="space-y-4">
              <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/50">AI Model</p>
                <select value={effectiveModel || ''} onChange={e => setSelectedModel(e.target.value || null)} disabled={modelsLoading || modelOptions.length === 0} className="w-full rounded-[3px] border border-white/15 bg-black/25 px-3 py-3 text-sm font-bold text-white outline-none focus:border-[#23c7be] disabled:opacity-50">{modelsLoading && <option value="">Loading models…</option>}{!modelsLoading && modelOptions.length === 0 && <option value="">No model available</option>}{modelOptions.map(m => <option key={m.model_key} value={m.model_key}>{m.name || m.model_key}{m.recommended ? ' — Recommended' : ''}{m.credits ? ` — ${m.credits} credits` : ''}</option>)}</select>
              </section>

              <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4"><p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/50">Aspect Ratio</p><div className="grid grid-cols-3 gap-2">{RATIOS.map(ratio => <button key={ratio.id} onClick={() => setAspectRatio(ratio.id)} className={`rounded-[3px] border p-2 text-center ${aspectRatio === ratio.id ? activeButton : idleButton}`}><p className="text-lg">{ratio.icon}</p><p className="text-[10px] font-bold">{ratio.label}</p></button>)}</div></section>

              <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4"><p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/50">Duration</p><div className="grid grid-cols-2 gap-2">{DURATIONS.map(d => <button key={d.id} onClick={() => setDuration(d.id)} className={`rounded-[3px] border p-2.5 text-center ${duration === d.id ? activeButton : idleButton}`}><p className="font-black">{d.label}</p><p className="text-[9px] opacity-60">{duration === d.id ? (priceLoading ? 'Calculating…' : priceQuote?.credits ? `${priceQuote.credits} credits` : 'Automatic price') : 'Auto price'}</p></button>)}</div></section>

              <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4"><p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/50">Resolution</p><div className="grid grid-cols-2 gap-2">{RESOLUTIONS.map(r => <button key={r.id} onClick={() => setResolution(r.id)} className={`rounded-[3px] border p-2.5 text-center ${resolution === r.id ? activeButton : idleButton}`}><p className="font-black">{r.label}</p><p className="text-[9px] opacity-60">{r.quality}</p></button>)}</div></section>

              {!result ? <Button onClick={handleGenerate} disabled={isGenerating || (mode === 'text' && !prompt.trim()) || (mode === 'image' && !imagePreview) || (mode === 'video' && (!imagePreview || !videoPreview))} className="w-full rounded-[3px] bg-[#23c7be] py-4 font-black text-[#071211] hover:bg-[#35d8cf] disabled:bg-white/[0.05] disabled:text-white/30 disabled:opacity-100">{isGenerating ? <><Loader2 size={20} className="mr-2 animate-spin" /> Generating…</> : <><Film size={20} className="mr-2" /> Generate Video{priceQuote?.credits ? ` · ${priceQuote.credits} credits` : ''}</>}</Button> : <Button onClick={handleUseVideo} disabled={isSaving} className="w-full rounded-[3px] bg-[#23c7be] py-4 font-black text-[#071211] hover:bg-[#35d8cf] disabled:opacity-50">{isSaving ? <><Loader2 size={20} className="mr-2 animate-spin" /> Saving…</> : <><CheckCircle2 size={20} className="mr-2" /> Use This Video</>}</Button>}
            </aside>
          </div>

          {result && <section className="mt-4 rounded-[4px] border border-white/10 bg-[#17191d] p-4"><div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-black text-white">Video Generated</p><p className="text-xs text-white/40">{duration}s · {resolution} · {aspectRatio}</p></div><CheckCircle2 className="text-[#23c7be]" size={20} /></div><video src={result} controls className="w-full rounded-[3px] bg-black" /></section>}
        </div>

        {showSaveVault && <SaveToVaultModal userEmail={user?.email} imageUrl={result} mediaType="video" onClose={() => setShowSaveVault(false)} onSaved={handleVaultSaved} />}
        {showVaultPicker && userEmail && <VaultPickerModal userEmail={userEmail} onSelect={(url) => { if (vaultPickerTarget === 'video') setVideoPreview(url); else setImagePreview(url); setShowVaultPicker(false); setVaultPickerTarget(null); }} onClose={() => { setShowVaultPicker(false); setVaultPickerTarget(null); }} />}
      </motion.div>
    </div>
  );
}
