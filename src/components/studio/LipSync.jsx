import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Upload, Loader2, CheckCircle2, Mic, Video } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';
import { useAiPriceQuote } from '@/hooks/useAiPriceQuote';
import { useAiModelOptions } from '@/hooks/useAiModelOptions';

export default function LipSync({ onComplete, onClose, episodePageId, blockId, user, embedded = false, inline = false }) {
  const [videoUrl, setVideoUrl] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [videoName, setVideoName] = useState('');
  const [audioName, setAudioName] = useState('');
  const [uploading, setUploading] = useState({ video: false, audio: false });
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveVault, setShowSaveVault] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);

  const pricingInput = { photo_url: videoUrl || undefined, audio_url: audioUrl || undefined };
  const { options: modelOptions, loading: modelsLoading } = useAiModelOptions({ service: 'replicateGenerate:lip_sync', kind: 'video', input: pricingInput });
  const effectiveModel = selectedModel || modelOptions.find(m => m.recommended)?.model_key || modelOptions[0]?.model_key || null;
  const { quote: priceQuote, loading: priceLoading } = useAiPriceQuote({ service: 'replicateGenerate:lip_sync', kind: 'video', input: pricingInput, modelKey: effectiveModel });

  const handleVideoUpload = async (file) => {
    setUploading(u => ({ ...u, video: true }));
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setVideoUrl(file_url);
      setVideoName(file.name);
    } finally {
      setUploading(u => ({ ...u, video: false }));
    }
  };

  const handleAudioUpload = async (file) => {
    setUploading(u => ({ ...u, audio: true }));
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setAudioUrl(file_url);
      setAudioName(file.name);
    } finally {
      setUploading(u => ({ ...u, audio: false }));
    }
  };

  const handleGenerate = async () => {
    if (!videoUrl || !audioUrl) return;
    setIsGenerating(true);
    try {
      const res = await base44.functions.invoke('replicateGenerate', {
        method: 'lip_sync',
        photo_url: videoUrl,
        audio_url: audioUrl,
        model_key: effectiveModel || undefined,
      });
      if (res.data?.file_url) setResult(res.data.file_url);
      else toast.error(res.data?.error || 'Lip sync failed');
    } catch (e) {
      const msg = e.response?.data?.message || e.response?.data?.error;
      toast.error(msg?.includes('Insufficient tokens') ? 'Not enough tokens. Please buy more.' : (msg || 'Lip sync failed'));
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
        const timeline = timelines[0];
        if (!timeline) {
          await base44.entities.UserTimeline.create({
            episode_page_id: episodePageId,
            user_email: user.email,
            block_overrides: [{ block_id: blockId, user_media_url: result, status: 'uploaded' }],
          });
        } else {
          const otherBlocks = (timeline.block_overrides || []).filter(b => b.block_id !== blockId);
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
    onComplete(result, 'video');
  };

  const shellClass = inline
    ? 'relative w-full'
    : `fixed z-[100] ${embedded ? 'top-14 right-0 bottom-[64px] left-0 lg:bottom-0 lg:left-[var(--studio-toolbar-width)] overflow-y-auto bg-[#202328]' : 'inset-0 flex items-center justify-center bg-black/80 p-4'}`;

  const panelClass = inline
    ? 'w-full bg-[#202328] text-white'
    : embedded
      ? 'min-h-full w-full overflow-y-auto bg-[#202328] p-5 pb-28 text-white md:p-8 md:pb-28 lg:pb-32'
      : 'max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[4px] border border-white/10 bg-[#202328] p-6 text-white';

  return (
    <div className={shellClass}>
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className={panelClass}>
        <div className="mx-auto w-full max-w-5xl">
          <div className="mb-5 flex items-center justify-between border-b border-white/10 bg-[#17191d] px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[3px] border border-[#23c7be]/30 bg-[#23c7be]/10 text-[#23c7be]"><Mic size={19} /></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#23c7be]">Image & Video</p>
                <h3 className="text-xl font-black text-white">Lip Sync</h3>
                <p className="text-xs text-white/45">Sync audio to a video automatically</p>
              </div>
            </div>
            {!embedded && !inline && <button onClick={onClose} className="rounded-[3px] border border-white/10 bg-white/[0.04] p-2 text-white hover:bg-white/10"><X size={20} /></button>}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
                <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/50"><Video size={14} className="text-[#23c7be]" /> Video</div>
                {videoUrl ? (
                  <div className="overflow-hidden rounded-[4px] border border-white/10 bg-black">
                    <video src={videoUrl} controls className="max-h-[420px] w-full object-contain" />
                    <div className="flex items-center gap-3 border-t border-white/10 bg-[#17191d] px-3 py-2"><CheckCircle2 size={16} className="flex-shrink-0 text-[#23c7be]" /><span className="min-w-0 flex-1 truncate text-xs text-white/65">{videoName}</span><button onClick={() => { setVideoUrl(null); setVideoName(''); }} className="text-white/45 hover:text-white"><X size={14} /></button></div>
                  </div>
                ) : (
                  <label className="flex min-h-[190px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[4px] border border-dashed border-white/20 bg-black/20 p-6 text-center transition hover:border-[#23c7be]/60 hover:bg-black/30">
                    {uploading.video ? <Loader2 size={28} className="animate-spin text-[#23c7be]" /> : <Upload size={28} className="text-[#23c7be]" />}
                    <div><p className="text-sm font-bold text-white">{uploading.video ? 'Uploading…' : 'Upload video'}</p><p className="mt-1 text-xs text-white/35">MP4, WebM, MOV</p></div>
                    <input type="file" accept="video/*" className="hidden" disabled={uploading.video} onChange={e => e.target.files?.[0] && handleVideoUpload(e.target.files[0])} />
                  </label>
                )}
              </section>

              <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
                <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/50"><Mic size={14} className="text-[#23c7be]" /> Audio</div>
                {audioUrl ? (
                  <div className="flex items-center gap-3 rounded-[4px] border border-white/10 bg-black/20 px-3 py-3"><CheckCircle2 size={16} className="flex-shrink-0 text-[#23c7be]" /><span className="min-w-0 flex-1 truncate text-xs text-white/65">{audioName}</span><audio src={audioUrl} controls className="h-8 min-w-0 flex-1" /><button onClick={() => { setAudioUrl(null); setAudioName(''); }} className="flex-shrink-0 text-white/45 hover:text-white"><X size={14} /></button></div>
                ) : (
                  <label className="flex min-h-[150px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[4px] border border-dashed border-white/20 bg-black/20 p-6 text-center transition hover:border-[#23c7be]/60 hover:bg-black/30">
                    {uploading.audio ? <Loader2 size={28} className="animate-spin text-[#23c7be]" /> : <Upload size={28} className="text-[#23c7be]" />}
                    <div><p className="text-sm font-bold text-white">{uploading.audio ? 'Uploading…' : 'Upload audio'}</p><p className="mt-1 text-xs text-white/35">MP3, WAV, WebM</p></div>
                    <input type="file" accept="audio/*" className="hidden" disabled={uploading.audio} onChange={e => e.target.files?.[0] && handleAudioUpload(e.target.files[0])} />
                  </label>
                )}
              </section>

              {result && (
                <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
                  <div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-black text-white">Lip Sync Result</p><p className="text-xs text-white/40">Ready to save or use in your production.</p></div><CheckCircle2 size={20} className="text-[#23c7be]" /></div>
                  <div className="overflow-hidden rounded-[4px] border border-white/10 bg-black"><video src={result} controls className="w-full" /></div>
                </section>
              )}
            </div>

            <aside className="space-y-4">
              <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/50">AI Model</p>
                <select value={effectiveModel || ''} onChange={e => setSelectedModel(e.target.value || null)} disabled={modelsLoading || modelOptions.length === 0} className="w-full rounded-[3px] border border-white/15 bg-black/25 px-3 py-3 text-sm font-bold text-white outline-none focus:border-[#23c7be] disabled:opacity-50">
                  {modelsLoading && <option value="">Loading models…</option>}
                  {!modelsLoading && modelOptions.length === 0 && <option value="">No model available</option>}
                  {modelOptions.map(m => <option key={m.model_key} value={m.model_key}>{m.name || m.model_key}{m.recommended ? ' — Recommended' : ''}{m.credits ? ` — ${m.credits} credits` : ''}</option>)}
                </select>
              </section>

              {!result ? (
                <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
                  <div className="mb-3 flex items-center justify-between text-xs text-white/45"><span>AI cost</span><span>{priceLoading ? 'Calculating…' : priceQuote?.credits ? `${priceQuote.credits} credits` : 'Calculated automatically'}</span></div>
                  <button onClick={handleGenerate} disabled={!videoUrl || !audioUrl || isGenerating} className="flex w-full items-center justify-center gap-2 rounded-[3px] bg-[#23c7be] py-3.5 text-sm font-black text-[#071211] transition hover:bg-[#35d8cf] disabled:bg-white/[0.05] disabled:text-white/30">
                    {isGenerating ? <><Loader2 size={18} className="animate-spin" /> Syncing… (~1–3 min)</> : <><Mic size={18} /> Generate Lip Sync{priceQuote?.credits ? ` · ${priceQuote.credits} credits` : ''}</>}
                  </button>
                </section>
              ) : (
                <button onClick={handleUseVideo} disabled={isSaving} className="flex w-full items-center justify-center gap-2 rounded-[3px] bg-[#23c7be] py-3.5 text-sm font-black text-[#071211] hover:bg-[#35d8cf] disabled:opacity-50">
                  {isSaving ? <><Loader2 size={18} className="animate-spin" /> Saving…</> : <><CheckCircle2 size={18} /> Use This Video</>}
                </button>
              )}
            </aside>
          </div>
        </div>

        {showSaveVault && <SaveToVaultModal userEmail={user?.email} imageUrl={result} mediaType="video" onClose={() => setShowSaveVault(false)} onSaved={handleVaultSaved} />}
      </motion.div>
    </div>
  );
}
