import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Upload, Loader2, CheckCircle2, Film, Music, FolderOpen } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import VaultPickerModal from '@/components/studio/VaultPickerModal';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';
import { useAiPriceQuote } from '@/hooks/useAiPriceQuote';
import { useAiModelOptions } from '@/hooks/useAiModelOptions';

const DURATIONS = [5, 10];
const RATIOS = ['9:16', '16:9', '1:1', '4:3'];

export default function AnimateImage({ onComplete, onClose, episodePageId, blockId, user, initialPrompt, embedded = false, inline = false }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [imageName, setImageName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [duration, setDuration] = useState(5);
  const [ratio, setRatio] = useState('16:9');
  const [prompt, setPrompt] = useState(initialPrompt || '');
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioName, setAudioName] = useState('');
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showVaultPicker, setShowVaultPicker] = useState(false);
  const [showSaveVault, setShowSaveVault] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const pricingInput = { duration, aspect_ratio: ratio, prompt, audio_url: audioUrl || undefined };
  const { options: modelOptions, loading: modelsLoading } = useAiModelOptions({
    service: 'replicateGenerate:animate_image',
    kind: 'video',
    input: pricingInput,
  });
  const effectiveModel = selectedModel || modelOptions.find(m => m.recommended)?.model_key || modelOptions[0]?.model_key || null;
  const { quote: priceQuote, loading: priceLoading } = useAiPriceQuote({
    service: 'replicateGenerate:animate_image',
    kind: 'video',
    input: pricingInput,
    modelKey: effectiveModel,
  });

  const handleUploadImage = async (file) => {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setImageUrl(file_url);
    setImageName(file.name);
    setUploading(false);
  };

  const handleUploadAudio = async (file) => {
    setUploadingAudio(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setAudioUrl(file_url);
    setAudioName(file.name);
    setUploadingAudio(false);
  };

  const handleGenerate = async () => {
    if (!imageUrl) return;
    setIsGenerating(true);
    try {
      const res = await base44.functions.invoke('replicateGenerate', {
        method: 'animate_image',
        photo_url: imageUrl,
        duration,
        aspect_ratio: ratio,
        prompt: prompt || undefined,
        audio_url: audioUrl || undefined,
        model_key: effectiveModel || undefined,
      });
      if (res.data?.file_url) {
        setResult(res.data.file_url);
      } else {
        toast.error(res.data?.error || 'Animation failed');
      }
    } catch (e) {
      const msg = e.response?.data?.message || e.response?.data?.error;
      toast.error(msg?.includes('Insufficient tokens') ? 'Not enough tokens. Please buy more.' : (msg || 'Animation failed'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseVideo = () => {
    if (!result) return;
    if (!user?.email) { onComplete(result, 'video'); return; }
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
          await base44.entities.UserTimeline.create({
            episode_page_id: episodePageId,
            user_email: user.email,
            block_overrides: [{ block_id: blockId, user_media_url: result, status: 'uploaded' }],
          });
        } else {
          const existingOverrides = timeline.block_overrides || [];
          const otherBlocks = existingOverrides.filter(b => b.block_id !== blockId);
          const updatedOverrides = [...otherBlocks, { block_id: blockId, user_media_url: result, status: 'uploaded' }];
          await base44.entities.UserTimeline.update(timeline.id, { block_overrides: updatedOverrides });
        }
        toast.success('Video saved to your Vault & episode!');
      } catch (err) {
        console.error('Error attaching video to episode:', err);
        toast.error('Saved to Vault, but failed to attach to episode');
      } finally {
        setIsSaving(false);
      }
    }
    onComplete(result, 'video');
  };

  const shellClass = inline
    ? 'relative w-full'
    : `fixed z-[100] ${embedded ? 'top-14 right-0 bottom-[calc(var(--bottom-nav-height)+1rem)] left-0 lg:left-[var(--studio-toolbar-width)] overflow-y-auto bg-[#202328]' : 'inset-0 flex items-center justify-center bg-black/80 p-4'}`;

  const panelClass = inline
    ? 'w-full bg-[#202328] text-white'
    : (embedded
      ? 'min-h-full w-full overflow-y-auto bg-[#202328] p-5 pb-10 text-white md:p-8 md:pb-12'
      : 'max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[4px] border border-white/10 bg-[#202328] p-6 text-white');

  return (
    <div className={shellClass}>
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className={panelClass}>
        <div className="mx-auto w-full max-w-5xl">
          <div className="mb-5 flex items-center justify-between border-b border-white/10 bg-[#17191d] px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[3px] border border-[#23c7be]/30 bg-[#23c7be]/10 text-[#23c7be]"><Film size={19} /></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#23c7be]">Image & Video</p>
                <h3 className="text-xl font-black text-white">Animate Image</h3>
                <p className="text-xs text-white/45">Bring a still image to life with AI motion</p>
              </div>
            </div>
            {!embedded && !inline && <button onClick={onClose} className="rounded-[3px] border border-white/10 bg-white/[0.04] p-2 text-white hover:bg-white/10"><X size={20} /></button>}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
            <div className="space-y-4">
              <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-white/55">Image</p>
                {imageUrl ? (
                  <div>
                    <div className="relative overflow-hidden rounded-[4px] border border-white/10 bg-black">
                      <img src={imageUrl} alt="Preview" className="max-h-[420px] w-full object-contain" />
                      <button onClick={() => { setImageUrl(null); setImageName(''); }} className="absolute right-2 top-2 rounded-[3px] bg-black/75 p-1.5 text-white hover:bg-black"><X size={14} /></button>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-white/55"><CheckCircle2 size={13} className="text-[#23c7be]" />{imageName}</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="flex cursor-pointer flex-col items-center gap-3 rounded-[4px] border border-dashed border-white/20 bg-black/20 py-10 transition hover:border-[#23c7be]/60 hover:bg-black/30">
                      {uploading ? <Loader2 size={28} className="animate-spin text-[#23c7be]" /> : <Upload size={28} className="text-[#23c7be]" />}
                      <span className="text-sm font-bold text-white">{uploading ? 'Uploading…' : 'Upload an image to animate'}</span>
                      <span className="text-xs text-white/35">JPG, PNG or WebP</span>
                      <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={e => e.target.files?.[0] && handleUploadImage(e.target.files[0])} />
                    </label>
                    <button onClick={() => setShowVaultPicker(true)} className="flex w-full items-center justify-center gap-2 rounded-[3px] border border-white/10 bg-white/[0.04] py-2.5 text-sm font-bold text-white hover:bg-white/10"><FolderOpen size={16} /> Pick from Vault</button>
                  </div>
                )}
              </section>

              {result && (
                <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
                  <p className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-white/55">Result</p>
                  <div className="overflow-hidden rounded-[4px] border border-white/10 bg-black"><video src={result} controls className="w-full" /></div>
                </section>
              )}
            </div>

            <div className="space-y-4">
              <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-white/55">AI Model</p>
                <select value={effectiveModel || ''} onChange={e => setSelectedModel(e.target.value || null)} disabled={modelsLoading || modelOptions.length === 0} className="w-full rounded-[3px] border border-white/15 bg-black/25 px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#23c7be] disabled:opacity-50">
                  {modelsLoading && <option value="">Loading models…</option>}
                  {!modelsLoading && modelOptions.length === 0 && <option value="">No model available</option>}
                  {modelOptions.map(m => <option key={m.model_key} value={m.model_key}>{m.name || m.model_key}{m.recommended ? ' — Recommended' : ''}{m.credits ? ` — ${m.credits} credits` : ''}</option>)}
                </select>
              </section>

              <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-white/55">Duration</p>
                    <div className="flex gap-2">{DURATIONS.map(d => <button key={d} onClick={() => setDuration(d)} className={`rounded-[3px] border px-4 py-2 text-sm font-black transition ${duration === d ? 'border-[#23c7be] bg-[#23c7be]/12 text-[#8ee9e4]' : 'border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/10'}`}>{d}s</button>)}</div>
                  </div>
                  <div>
                    <p className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-white/55">Aspect Ratio</p>
                    <div className="flex flex-wrap gap-2">{RATIOS.map(r => <button key={r} onClick={() => setRatio(r)} className={`rounded-[3px] border px-3 py-2 text-xs font-black transition ${ratio === r ? 'border-[#23c7be] bg-[#23c7be]/12 text-[#8ee9e4]' : 'border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/10'}`}>{r}</button>)}</div>
                  </div>
                </div>
              </section>

              <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-white/55">Motion Prompt <span className="normal-case font-normal">(optional)</span></p>
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe the motion… e.g. slow zoom in, hair blowing in the wind, camera pan left" rows={3} className="w-full resize-none rounded-[3px] border border-white/15 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#23c7be]" />
              </section>

              <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-white/55">Audio <span className="normal-case font-normal">(optional)</span></p>
                {audioUrl ? (
                  <div className="flex items-center gap-3 rounded-[3px] border border-white/10 bg-black/20 px-3 py-3"><Music size={16} className="text-[#23c7be]" /><span className="min-w-0 flex-1 truncate text-sm text-white">{audioName}</span><audio src={audioUrl} controls className="h-7 flex-shrink-0" style={{ width: 120 }} /><button onClick={() => { setAudioUrl(null); setAudioName(''); }} className="text-white/55 hover:text-white"><X size={14} /></button></div>
                ) : (
                  <label className="flex cursor-pointer items-center gap-3 rounded-[3px] border border-white/10 bg-black/20 px-4 py-3 hover:bg-black/30">{uploadingAudio ? <Loader2 size={16} className="animate-spin text-[#23c7be]" /> : <Music size={16} className="text-[#23c7be]" />}<span className="text-sm text-white/70">{uploadingAudio ? 'Uploading audio…' : 'Add background audio / music'}</span><input type="file" accept="audio/*" className="hidden" disabled={uploadingAudio} onChange={e => e.target.files?.[0] && handleUploadAudio(e.target.files[0])} /></label>
                )}
              </section>

              {!result ? (
                <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-white/45"><span>AI cost</span><span>{priceLoading ? 'Calculating…' : priceQuote?.credits ? `${priceQuote.credits} credits` : 'Calculated automatically'}</span></div>
                  <button onClick={handleGenerate} disabled={!imageUrl || isGenerating} className="flex w-full items-center justify-center gap-2 rounded-[3px] bg-[#23c7be] py-3.5 text-sm font-black text-[#071211] transition hover:bg-[#35d8cf] disabled:bg-white/[0.05] disabled:text-white/30">
                    {isGenerating ? <><Loader2 size={18} className="animate-spin" /> Animating… (~1–3 min)</> : <><Film size={18} /> Animate Image{priceQuote?.credits ? ` · ${priceQuote.credits} credits` : ''}</>}
                  </button>
                </section>
              ) : (
                <button onClick={handleUseVideo} disabled={isSaving} className="flex w-full items-center justify-center gap-2 rounded-[3px] border border-[#23c7be] bg-[#23c7be] py-3.5 text-sm font-black text-[#071211] hover:bg-[#35d8cf] disabled:opacity-50">
                  {isSaving ? <><Loader2 size={18} className="animate-spin" /> Saving…</> : <><CheckCircle2 size={18} /> Use This Video</>}
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {showVaultPicker && <VaultPickerModal userEmail={user?.email} onClose={() => setShowVaultPicker(false)} onSelect={(url) => { setImageUrl(url); setImageName('Vault image'); setShowVaultPicker(false); }} />}
      {showSaveVault && <SaveToVaultModal userEmail={user?.email} imageUrl={result} mediaType="video" onClose={() => setShowSaveVault(false)} onSaved={handleVaultSaved} />}
    </div>
  );
}
