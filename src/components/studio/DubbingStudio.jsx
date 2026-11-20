import React, { useEffect, useRef, useState } from 'react';
import { Upload, Video, Volume2, Loader2, CheckCircle2, X, Download, Languages } from 'lucide-react';
import { motion } from 'framer-motion';
import { base44, supabase } from '@/api/base44Client';
import { toast } from 'sonner';
import ProductionContextInfo from '@/components/ProductionContextInfo';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';
import { useStudioTranslation } from '@/lib/useStudioTranslation';
import { useAiModelOptions } from '@/hooks/useAiModelOptions';

const languages = [
  ['auto', 'Auto detect'], ['en', 'English'], ['fr', 'French'], ['fr-CA', 'Canadian French'],
  ['es', 'Spanish'], ['es-MX', 'Mexican Spanish'], ['de', 'German'], ['it', 'Italian'],
  ['pt', 'Portuguese'], ['pt-BR', 'Brazilian Portuguese'], ['ja', 'Japanese'],
  ['ko', 'Korean'], ['zh', 'Chinese'], ['ar', 'Arabic'], ['hi', 'Hindi'],
  ['nl', 'Dutch'], ['pl', 'Polish'], ['tr', 'Turkish'], ['ru', 'Russian'],
];

export default function DubbingStudio({ block, dossier, onClose, onComplete, productionMethod = null, character = null, episodePageId, blockId, user, embedded = false, inline = false }) {
  const t = useStudioTranslation();
  const [videoUrl, setVideoUrl] = useState('');
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('fr');
  const [modelKey, setModelKey] = useState('');
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [jobId, setJobId] = useState('');
  const [step, setStep] = useState('idle');
  const [finalUrl, setFinalUrl] = useState('');
  const [showSaveVault, setShowSaveVault] = useState(false);
  const [saving, setSaving] = useState(false);
  const working = useRef(false);
  const [assemblyError, setAssemblyError] = useState('');
  const { options: models, loading: loadingModels } = useAiModelOptions({
    service: 'generateDubbing', kind: 'speech',
    input: { duration_seconds: durationSeconds, target_language: targetLanguage },
    enabled: true,
  });

  useEffect(() => {
    if (!models.length) { setModelKey(''); return; }
    if (!models.some(m => m.model_key === modelKey)) {
      setModelKey((models.find(m => m.recommended) || models[0]).model_key);
    }
  }, [models, modelKey]);

  useEffect(() => {
    if (!modelKey || !videoUrl || !durationSeconds) {
      setQuote(null);
      setQuoteError('');
      return;
    }
    let cancelled = false;
    supabase.functions.invoke('ai-price-quote', {
      body: {
        service: 'generateDubbing', kind: 'speech', model_key: modelKey,
        input: { duration_seconds: durationSeconds, source_url: videoUrl, target_language: targetLanguage },
      },
    }).then(({ data, error }) => {
      if (cancelled) return;
      if (error || data?.error) throw Error(data?.error || error?.message || 'Quote unavailable');
      setQuote(data);
      setQuoteError('');
    }).catch(error => {
      if (!cancelled) { setQuote(null); setQuoteError(error.message); }
    });
    return () => { cancelled = true; };
  }, [modelKey, videoUrl, durationSeconds, targetLanguage]);

  const reset = () => { setStep('idle'); setFinalUrl(''); setJobId(''); setAssemblyError(''); working.current = false; };
  const cloudflareMedia = async (action, payload = {}) => {
    const { data, error } = await supabase.functions.invoke('dubbing-cloudflare-media', {
      body: { action, ...payload },
    });
    if (error || data?.error) throw Error(data?.error || error?.message || 'Cloudflare video unavailable');
    return data;
  };

  const waitForCloudflareMedia = async (action, payload) => {
    // Cloudflare generates downloadable MP4s asynchronously, without re-uploading.
    for (let attempt = 0; attempt < 150; attempt++) {
      const result = await cloudflareMedia(action, payload);
      if (result.status === 'ready') return result;
      if (result.status !== 'processing') throw Error(result.error || 'Cloudflare video processing failed');
      await new Promise(resolve => setTimeout(resolve, 4000));
    }
    throw Error(t('Video is still processing. Retry assembly shortly.', 'La vidéo est toujours en préparation. Réessayez l’assemblage dans quelques instants.'));
  };

  const handleUpload = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    reset();
    setVideoUrl('');
    setDurationSeconds(0);
    setUploading(true);
    try {
      const metadata = await new Promise((resolve, reject) => {
        const node = document.createElement('video');
        const objectUrl = URL.createObjectURL(file);
        node.preload = 'metadata';
        node.onloadedmetadata = () => { const duration = node.duration; URL.revokeObjectURL(objectUrl); resolve(duration); };
        node.onerror = () => { URL.revokeObjectURL(objectUrl); reject(Error('Invalid video')); };
        node.src = objectUrl;
      });
      if (!Number.isFinite(metadata) || metadata <= 0 || metadata > 14400) {
        throw Error(t('Video must be shorter than four hours', 'La vidéo doit durer moins de quatre heures'));
      }
      const result = await base44.integrations.Core.UploadFile({ file });
      if (!result.file_url) throw Error('Upload failed');
      setVideoUrl(result.file_url);
      setDurationSeconds(metadata);
    } catch (error) {
      toast.error(error.message || t('Video upload failed', 'Échec du téléversement'));
    } finally { setUploading(false); event.target.value = ''; }
  };

  const invoke = async (action, payload = {}) => {
    const { data, error } = await supabase.functions.invoke('generateDubbing', {
      body: { action, ...payload },
    });
    if (error || data?.error && data?.status !== 'failed') throw Error(data?.error || error?.message || 'Dubbing failed');
    return data;
  };

  const finishVideo = async (audioUrl, id) => {
    if (working.current) return;
    working.current = true;
    setAssemblyError('');
    setStep('mixing');
    try {
      const prepared = await waitForCloudflareMedia('prepare', { video_url: videoUrl });
      const { data, error } = await supabase.functions.invoke('mixAudioVideo', {
        body: { audio_url: audioUrl, video_url: prepared.mp4_url },
      });
      if (error || data?.error) throw Error(data?.error || error?.message || t('Video assembly failed', 'Échec de l’assemblage vidéo'));
      const output = data?.output_asset_id
        ? (await waitForCloudflareMedia('output_status', { asset_id: data.output_asset_id })).file_url
        : data?.file_url;
      if (!output) throw Error(t('The mixer returned no video', 'Le mixage n’a produit aucune vidéo'));
      await invoke('finish', { job_id: id, final_video_url: output });
      setFinalUrl(output);
      setStep('completed');
    } catch (error) {
      setAssemblyError(error.message || t('Video reconstruction failed', 'La reconstruction de la vidéo a échoué'));
      setStep('mix_failed');
      toast.error(error.message || t('Video reconstruction failed', 'La reconstruction de la vidéo a échoué'));
    } finally { working.current = false; }
  };

  useEffect(() => {
    if (!jobId || step !== 'dubbing') return;
    let cancelled = false;
    let timeoutId;
    const poll = async () => {
      try {
        const data = await invoke('status', { job_id: jobId });
        if (cancelled) return;
        if (data.status === 'audio_ready' && data.audio_url) {
          setStep('mixing');
          await finishVideo(data.audio_url, jobId);
          return;
        }
        if (data.status === 'failed') {
          setStep('failed');
          toast.error(data.error || t('Dubbing failed', 'Échec du doublage'));
          return;
        }
        if (data.status === 'completed' && data.file_url) {
          setFinalUrl(data.file_url);
          setStep('completed');
          return;
        }
      } catch (error) { if (!cancelled) toast.error(error.message); }
      if (!cancelled) timeoutId = setTimeout(poll, 5000);
    };
    poll();
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [jobId, step]);

  const start = async () => {
    if (!videoUrl || !modelKey || !quote?.credits || working.current) return;
    working.current = true;
    setStep('starting');
    try {
      const data = await invoke('start', {
        video_url: videoUrl, duration_seconds: durationSeconds,
        source_language: sourceLanguage, target_language: targetLanguage,
        model_key: modelKey,
      });
      if (!data.job_id) throw Error('No dubbing job was created');
      setJobId(data.job_id);
      setStep('dubbing');
    } catch (error) {
      setStep('idle');
      toast.error(error.message);
    } finally { working.current = false; }
  };

  const retryAssembly = async () => {
    if (!jobId || working.current) return;
    try {
      const data = await invoke('status', { job_id: jobId });
      if (data.status !== 'audio_ready' || !data.audio_url) {
        throw Error(t('The dubbed audio is unavailable for this job.', 'L’audio doublé n’est plus disponible pour ce traitement.'));
      }
      await finishVideo(data.audio_url, jobId);
    } catch (error) { setAssemblyError(error.message); toast.error(error.message); }
  };

  const useVideo = () => {
    if (!finalUrl) return;
    if (!user?.email) { onComplete?.(finalUrl); return; }
    setShowSaveVault(true);
  };
  const savedToVault = async () => {
    setShowSaveVault(false);
    if (episodePageId && blockId && user?.email) {
      setSaving(true);
      try {
        const timelines = await base44.entities.UserTimeline.filter({ episode_page_id: episodePageId, user_email: user.email });
        const timeline = timelines[0];
        const override = { block_id: blockId, user_media_url: finalUrl, status: 'uploaded' };
        if (!timeline) {
          await base44.entities.UserTimeline.create({ episode_page_id: episodePageId, user_email: user.email, block_overrides: [override] });
        } else {
          await base44.entities.UserTimeline.update(timeline.id, {
            block_overrides: [...(timeline.block_overrides || []).filter(item => item.block_id !== blockId), override],
          });
        }
      } catch (error) { toast.error(error.message || t('Failed to attach video to episode', 'Impossible de joindre la vidéo à l’épisode')); }
      finally { setSaving(false); }
    }
    onComplete?.(finalUrl);
  };

  const shell = inline ? 'relative w-full' : `fixed z-[100] ${embedded ? 'top-14 right-0 bottom-[64px] left-0 lg:bottom-0 lg:left-[var(--studio-toolbar-width)] overflow-y-auto bg-[#202328]' : 'inset-0 flex items-center justify-center bg-black/80 p-4'}`;
  const panel = inline ? 'w-full bg-[#202328] p-4 text-white md:p-5' : embedded
    ? 'min-h-full w-full overflow-y-auto bg-[#202328] p-5 pb-28 text-white md:p-8 lg:pb-32'
    : 'max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded border border-white/10 bg-[#202328] p-6 text-white';

  return (
    <div className={shell}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={panel}>
        <div className="mx-auto max-w-5xl">
          <header className="mb-5 flex items-center justify-between border-b border-white/10 bg-[#17191d] px-4 py-3">
            <div className="flex items-center gap-3">
              <Languages size={22} className="text-[#23c7be]" />
              <div><h3 className="text-lg font-bold">{t('Dubbing Studio', 'Studio de doublage')}</h3><p className="text-xs text-white/50">{t('Translate and replace the full soundtrack of a video.', 'Traduisez et remplacez entièrement la bande sonore d’une vidéo.')}</p></div>
            </div>
            {!embedded && !inline && <button onClick={onClose} aria-label="Close"><X size={20} /></button>}
          </header>
          {productionMethod && block && <ProductionContextInfo productionMethod={productionMethod} block={block} character={character} referenceMedia={[]} />}

          <section className="rounded border border-white/10 bg-[#17191d] p-4">
            <div className="mb-3 flex items-center gap-2"><Video size={17} className="text-[#23c7be]" /><span className="text-sm font-bold">{t('Original video', 'Vidéo originale')}</span></div>
            {videoUrl ? (
              <div className="space-y-2">
                <video src={videoUrl} controls className="max-h-[320px] w-full rounded bg-black" />
                <div className="flex items-center justify-between gap-3 text-xs text-white/60">
                  <span>{Math.round(durationSeconds)} s</span>
                  <button className="rounded border border-white/20 px-3 py-1.5" disabled={step !== 'idle'} onClick={() => { reset(); setVideoUrl(''); setDurationSeconds(0); }}>{t('Replace video', 'Changer de vidéo')}</button>
                </div>
              </div>
            ) : (
              <label className="flex min-h-[130px] cursor-pointer flex-col items-center justify-center gap-2 rounded border border-dashed border-white/20 bg-black/20">
                {uploading ? <Loader2 size={25} className="animate-spin text-[#23c7be]" /> : <Upload size={25} className="text-[#23c7be]" />}
                <span className="text-sm">{uploading ? t('Uploading video…', 'Téléversement…') : t('Upload video', 'Importer une vidéo')}</span>
                <input type="file" accept="video/*" className="hidden" disabled={uploading} onChange={handleUpload} />
              </label>
            )}
          </section>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-xs text-white/65">{t('Source language', 'Langue originale')}
              <select className="w-full rounded border border-white/20 bg-[#17191d] p-2 text-sm text-white" value={sourceLanguage} disabled={step !== 'idle'} onChange={event => setSourceLanguage(event.target.value)}>
                {languages.map(([code, label]) => <option key={code} value={code}>{t(label, label)}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs text-white/65">{t('Target language', 'Langue de doublage')}
              <select className="w-full rounded border border-white/20 bg-[#17191d] p-2 text-sm text-white" value={targetLanguage} disabled={step !== 'idle'} onChange={event => setTargetLanguage(event.target.value)}>
                {languages.filter(([code]) => code !== 'auto').map(([code, label]) => <option key={code} value={code}>{t(label, label)}</option>)}
              </select>
            </label>
          </div>

          <section className="mt-3 rounded border border-white/10 bg-[#17191d] p-4">
            <label className="block space-y-2 text-xs text-white/65">
              {t('Dubbing model', 'Modèle de doublage')}
              <select className="w-full rounded border border-white/20 bg-black/30 p-2 text-sm text-white" value={modelKey} disabled={step !== 'idle' || loadingModels} onChange={event => setModelKey(event.target.value)}>
                {!models.length && <option value="">{loadingModels ? t('Loading models…', 'Chargement des modèles…') : t('No dubbing model configured in Admin', 'Aucun modèle de doublage configuré dans Admin')}</option>}
                {models.map(model => <option key={model.model_key} value={model.model_key}>{model.name}{model.credits != null ? ` · ${model.credits} ${t('credits', 'crédits')}` : ''}</option>)}
              </select>
            </label>
            {videoUrl && <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
              <div><p className="text-xs text-white/50">{t('Dubbing estimate', 'Estimation du doublage')}</p>
                <p className="text-lg font-bold">{quote?.credits == null ? '—' : `${quote.credits} ${t('credits', 'crédits')}`}</p>
                <p className="text-xs text-white/40">{t('Video assembly is billed separately.', 'L’assemblage vidéo est facturé séparément.')}</p>
              </div>
              {quote?.estimated && <span className="text-xs text-white/45">{t('Estimated', 'Estimé')}</span>}
            </div>}
            {quoteError && <p className="mt-2 text-xs text-red-300">{quoteError}</p>}
            {step === 'idle' && <button onClick={start} disabled={!videoUrl || !quote?.credits || !modelKey || uploading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded bg-[#23c7be] px-3 py-3 text-sm font-bold text-[#071211] disabled:opacity-30"><Volume2 size={17} />{t('Generate dubbed video', 'Générer la vidéo doublée')}</button>}
            {['starting', 'dubbing', 'mixing'].includes(step) && <div className="mt-4 flex items-center gap-2 text-sm text-[#23c7be]">
              <Loader2 className="animate-spin" size={18} />
              {step === 'mixing' ? t('Replacing soundtrack and creating video…', 'Remplacement de la bande sonore et création de la vidéo…')
                : step === 'dubbing' ? t('Generating translated audio…', 'Génération de l’audio traduit…')
                  : t('Starting dubbing…', 'Démarrage du doublage…')}
            </div>}
            {step === 'failed' && <p className="mt-3 text-sm text-red-300">{t('The dubbing could not be completed.', 'Le doublage n’a pas pu être terminé.')}</p>}
            {step === 'mix_failed' && <div className="mt-3 space-y-3">
              <p className="text-sm text-red-300">{assemblyError || t('The assembly failed; your translated audio is preserved.', 'L’assemblage a échoué ; votre audio traduit est conservé.')}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={retryAssembly} disabled={working.current} className="rounded bg-[#23c7be] px-4 py-2 text-sm font-bold text-black">{t('Retry video assembly', 'Reprendre l’assemblage vidéo')}</button>

              </div>
            </div>}
          </section>

          {finalUrl && <section className="mt-3 rounded border border-white/10 bg-[#17191d] p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-bold"><CheckCircle2 size={18} className="text-[#23c7be]" />{t('Dubbed video ready', 'Vidéo doublée prête')}</div>
            <video src={finalUrl} controls className="w-full rounded bg-black" />
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={finalUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded border border-white/20 px-3 py-2 text-sm"><Download size={16} />{t('Open MP4', 'Ouvrir le MP4')}</a>
              <button onClick={useVideo} disabled={saving} className="rounded bg-[#23c7be] px-4 py-2 text-sm font-bold text-black">{t('Use dubbed video', 'Utiliser la vidéo doublée')}</button>
            </div>
          </section>}
        </div>
        {showSaveVault && <SaveToVaultModal userEmail={user?.email} imageUrl={finalUrl} mediaType="video" onClose={() => setShowSaveVault(false)} onSaved={savedToVault} />}
      </motion.div>
    </div>
  );
}
