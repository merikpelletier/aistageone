import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Sparkles, Film, Image as ImageIcon, Loader2, ChevronLeft, CheckCircle2, Upload, Download, User, Coins, Camera, X } from 'lucide-react';
import { toast } from 'sonner';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';
import TokenPurchaseModal from '@/components/studio/TokenPurchaseModal';
import { useTokenBalance } from '@/hooks/useTokenBalance';
import { useAiModelOptions } from '@/hooks/useAiModelOptions';
import { useAiPriceQuote } from '@/hooks/useAiPriceQuote';
import { useStudioTranslation } from '@/lib/useStudioTranslation';
import { getPlatformLanguage } from '@/lib/translationDictionary';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'video', label: 'Video' },
  { id: 'image', label: 'Images' },
  { id: 'experience', label: 'Experiences' },
  { id: 'comedy', label: 'Comedy' },
  { id: 'character_intro', label: 'Intros' },
];

const ACTIVE_JOB_STATUSES = new Set(['starting', 'processing', 'finalizing']);

const FRENCH_GENERATION_INSTRUCTION = "Le contenu destiné au public doit être entièrement en français. Tout texte lisible visible dans l’image ou la vidéo (titres, affiches, couvertures, légendes, panneaux et inscriptions) doit être rédigé en français naturel et correctement orthographié. Toute parole, tout dialogue ou toute narration générés doivent être en français. N’affichez aucun texte anglais. Conservez tels quels les noms propres, les marques et les titres explicitement fournis. N’ajoutez pas de texte s’il n’est pas demandé par le concept.";

const applyOutputLanguage = (prompt, language) => {
  const value = String(prompt || '').trim();
  if (!value || language !== 'fr') return value;
  return value.split('||').map(part => part.trim() ? part.trim() + '\\n\\n' + FRENCH_GENERATION_INSTRUCTION : part).join(' || ');
};

export default function SketchStudio({ user }) {
  const tr = useStudioTranslation();
  const generationLanguage = getPlatformLanguage();
  const qc = useQueryClient();
  const restoredPendingRef = useRef(false);
  const [category, setCategory] = useState('all');
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const cameraVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [selectedStyleIndex, setSelectedStyleIndex] = useState(null);
  const [selectedOutput, setSelectedOutput] = useState(null);
  const [duration, setDuration] = useState(5);
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationJob, setGenerationJob] = useState(null);
  const [result, setResult] = useState(null);
  const [showSaveVault, setShowSaveVault] = useState(false);
  const [showBuyTokens, setShowBuyTokens] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const { balance, refresh: refreshBalance } = useTokenBalance(user?.email);

  const configuredOutput = selected?.output_type || 'video';
  const canGenerateImage = configuredOutput === 'image' || configuredOutput === 'both';
  const canGenerateVideo = configuredOutput === 'video' || configuredOutput === 'both';
  const outputType = configuredOutput === 'both' ? selectedOutput : configuredOutput;
  const isImageStage = outputType === 'image';
  const isVideoStage = outputType === 'video';
  const outputChosen = Boolean(outputType);

  const styles = Array.isArray(selected?.styles)
    ? selected.styles.filter((s) => s?.name && (s?.image_prompt || s?.video_prompt || s?.prompt))
    : [];
  const selectedStyle = selectedStyleIndex !== null ? styles[selectedStyleIndex] : null;
  const styleRequired = styles.length > 0;
  const styleChosen = !styleRequired || selectedStyleIndex !== null;

  const activeImagePrompt = applyOutputLanguage(selectedStyle?.image_prompt || selectedStyle?.prompt || selected?.image_prompt || '', generationLanguage);
  const activeVideoPrompt = applyOutputLanguage(selectedStyle?.video_prompt || selected?.video_prompt || '', generationLanguage);
  const activeTransformationPrompt = applyOutputLanguage(selectedStyle?.transformation_prompt || selected?.transformation_prompt || '', generationLanguage);
  const currentEngine = activeTransformationPrompt ? 'kling_morph' : 'kling';

  const pricingInput = isImageStage
    ? { prompt: activeImagePrompt, reference_image_urls: photoUrl ? [photoUrl] : undefined, aspect_ratio: aspectRatio }
    : isVideoStage
      ? { prompt: activeVideoPrompt, image_url: photoUrl || undefined, duration, resolution: '720p', aspect_ratio: aspectRatio, generate_audio: currentEngine === 'kling_morph' }
      : {};

  const service = isImageStage ? 'replicateGenerate:compose_scene' : isVideoStage ? `generateVideo:${currentEngine}` : null;
  const kind = isImageStage ? 'image' : isVideoStage ? 'video' : null;
  const pricingEnabled = Boolean(selected && outputChosen && styleChosen && service && kind);
  const { options: modelOptions, loading: modelsLoading } = useAiModelOptions({ service, kind, input: pricingInput, enabled: pricingEnabled });
  const effectiveModel = selectedModel || modelOptions.find((m) => m.recommended)?.model_key || modelOptions[0]?.model_key || null;
  const { quote: priceQuote, loading: priceLoading } = useAiPriceQuote({ service, kind, input: pricingInput, modelKey: effectiveModel, enabled: pricingEnabled });
  const cost = priceQuote?.credits ?? null;
  const insufficient = balance !== null && cost !== null && balance < cost;

  const { data: themes = [], isLoading } = useQuery({
    queryKey: ['sketchTemplates', 'active'],
    queryFn: () => base44.entities.SketchTemplate.filter({ is_active: true }, 'order', 100),
    staleTime: 60 * 1000,
  });

  const filtered = themes.filter((t) => {
    const type = t.output_type || 'video';
    if (category === 'all') return true;
    if (category === 'image') return type === 'image' || type === 'both';
    if (category === 'video') return type === 'video' || type === 'both';
    return t.category === category;
  });

  const restoreStageFromJob = (job) => {
    if (!job) return;
    const theme = themes.find((item) => String(item.id) === String(job.stage_id));
    if (!theme) return;
    const themeStyles = Array.isArray(theme.styles)
      ? theme.styles.filter((s) => s?.name && (s?.image_prompt || s?.video_prompt || s?.prompt))
      : [];
    const styleIndex = job.style_name
      ? themeStyles.findIndex((style) => style.name === job.style_name)
      : null;
    setSelected({ ...theme, output_type: theme.output_type || 'video' });
    setSelectedOutput('video');
    setSelectedStyleIndex(styleIndex >= 0 ? styleIndex : null);
    setSelectedModel(job.model_key || null);
    setPhotoUrl(job.input?.image_url || photoUrl);
    setPhotoFile(null);
    setDuration(Number(job.input?.duration) || theme.default_duration || 5);
    setAspectRatio(job.input?.aspect_ratio || theme.default_aspect_ratio || '9:16');
  };

  useEffect(() => {
    if (!user?.email || isLoading || themes.length === 0 || restoredPendingRef.current) return;
    restoredPendingRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        const res = await base44.functions.invoke('stageVideoJob', { action: 'list_pending' });
        const job = res?.data?.job || res?.job || null;
        if (cancelled || !job || !ACTIVE_JOB_STATUSES.has(job.status)) return;
        setGenerationJob(job);
        setIsGenerating(true);
        restoreStageFromJob(job);
      } catch (error) {
        console.warn('Unable to restore pending Stage video job', error);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.email, isLoading, themes]);

  useEffect(() => {
    const jobId = generationJob?.id;
    if (!jobId || !ACTIVE_JOB_STATUSES.has(generationJob.status)) return;

    let cancelled = false;
    let timer = null;

    const poll = async () => {
      try {
        const res = await base44.functions.invoke('stageVideoJob', { action: 'status', job_id: jobId });
        const job = res?.data?.job || res?.job || null;
        if (cancelled || !job) return;
        setGenerationJob(job);

        if (job.status === 'succeeded' && job.output_url) {
          setResult(job.output_url);
          setIsGenerating(false);
          restoreStageFromJob(job);
          refreshBalance();
          toast.success(tr('stages.video_ready','Stage video ready'));
          return;
        }

        if (job.status === 'failed' || job.status === 'canceled') {
          setIsGenerating(false);
          refreshBalance();
          toast.error(job.error || tr('stages.error.video_failed','Stage video generation failed'));
          return;
        }

        timer = window.setTimeout(poll, 4000);
      } catch (error) {
        if (cancelled) return;
        console.warn('Stage video status check failed; retrying', error);
        timer = window.setTimeout(poll, 6000);
      }
    };

    timer = window.setTimeout(poll, 1500);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [generationJob?.id, generationJob?.status, themes]);

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
    cameraStreamRef.current = null;
    setShowCamera(false);
  };

  useEffect(() => {
    if (!showCamera || !cameraStreamRef.current || !cameraVideoRef.current) return;
    cameraVideoRef.current.srcObject = cameraStreamRef.current;
    cameraVideoRef.current.play().catch(() => {});
  }, [showCamera]);

  useEffect(() => () => {
    cameraStreamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error(tr('stages.camera_unavailable', 'Camera access is not available in this browser.'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      cameraStreamRef.current = stream;
      setShowCamera(true);
    } catch (error) {
      toast.error(error?.name === 'NotAllowedError'
        ? tr('stages.camera_permission', 'Allow camera access to take a picture.')
        : tr('stages.camera_failed', 'Could not open the camera.'));
    }
  };

  const capturePhoto = () => {
    const video = cameraVideoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) {
      toast.error(tr('stages.camera_not_ready', 'The camera is not ready yet.'));
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!blob) {
        toast.error(tr('stages.camera_capture_failed', 'Could not capture the picture.'));
        return;
      }
      const file = new File([blob], 'stage-photo.jpg', { type: 'image/jpeg' });
      stopCamera();
      handlePhotoUpload(file);
    }, 'image/jpeg', 0.92);
  };

  const handlePhotoUpload = async (file) => {
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotoUrl(file_url);
      setPhotoFile(file);
    } catch {
      toast.error(tr('stages.upload_failed','Photo upload failed'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const openTheme = (theme) => {
    const activeForTheme = generationJob && ACTIVE_JOB_STATUSES.has(generationJob.status)
      && String(generationJob.stage_id) === String(theme.id);
    if (activeForTheme) {
      restoreStageFromJob(generationJob);
      return;
    }
    if (!photoUrl) { toast.error(tr('stages.upload_first','Upload your photo first')); return; }
    const type = theme.output_type || 'video';
    setSelected({ ...theme, output_type: type });
    setSelectedStyleIndex(null);
    setSelectedOutput(type === 'both' ? null : type);
    setSelectedModel(null);
    setResult(null);
    setDuration(theme.default_duration || 5);
    setAspectRatio(theme.default_aspect_ratio || '9:16');
  };

  const chooseStyle = (index) => {
    setSelectedStyleIndex(index);
    setSelectedModel(null);
    setResult(null);
  };

  const chooseOutput = (type) => {
    setSelectedOutput(type);
    setSelectedModel(null);
    setResult(null);
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
      if (imgAspect > targetAspect) { cropH = img.height; cropW = img.height * targetAspect; sx = (img.width - cropW) / 2; sy = 0; }
      else { cropW = img.width; cropH = img.width / targetAspect; sx = 0; sy = (img.height - cropH) / 2; }
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(cropW); canvas.height = Math.round(cropH);
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
    if (!styleChosen) { toast.error(tr('stages.error.choose_style','Choose a style first')); return; }
    if (!outputChosen) { toast.error(tr('stages.error.choose_output','Choose Image or Video first')); return; }

    setIsGenerating(true);
    try {
      if (isImageStage) {
        if (!activeImagePrompt) throw new Error(tr('stages.error.image_prompt','This Stage has no image prompt for this style.'));
        const res = await base44.functions.invoke('replicateGenerate', {
          method: 'compose_scene',
          prompt: activeImagePrompt,
          reference_image_urls: [photoUrl],
          aspect_ratio: aspectRatio,
          model_key: effectiveModel || undefined,
        });
        const url = res?.data?.file_url || res?.file_url;
        if (!url) throw new Error(res?.data?.error || tr('stages.error.image_url','Image generation returned no URL'));
        setResult(url);
        setIsGenerating(false);
        refreshBalance();
        return;
      }

      let morphPrompt = activeTransformationPrompt;
      let prompt = activeVideoPrompt;
      const useMorph = Boolean(morphPrompt);
      if (useMorph) {
        const looks = morphPrompt.split('||').map((s) => s.trim()).filter(Boolean);
        const actions = prompt.split('||').map((s) => s.trim()).filter(Boolean);
        if (looks.length > 1 || actions.length > 1) {
          const i = Math.floor(Math.random() * Math.max(looks.length, actions.length));
          morphPrompt = looks[i] ?? looks[0] ?? '';
          prompt = actions[i] ?? actions[0] ?? '';
        }
      }
      if (!prompt && !useMorph) throw new Error(tr('stages.error.video_prompt','This Stage has no video prompt for this style.'));

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

      const res = await base44.functions.invoke('stageVideoJob', {
        action: 'start',
        stage_id: selected.id,
        style_name: selectedStyle?.name || null,
        prompt,
        image_url: genImage,
        duration,
        aspect_ratio: aspectRatio,
        resolution: '720p',
        engine: useMorph ? 'kling_morph' : 'kling',
        transformation_prompt: useMorph ? morphPrompt : undefined,
        model_key: effectiveModel || undefined,
      });
      const job = res?.data?.job || res?.job || null;
      if (!job?.id) throw new Error(res?.data?.error || tr('stages.error.start_video','Failed to start Stage video generation'));
      setGenerationJob(job);
      setResult(null);
      refreshBalance();
      toast.success(tr('stages.error.video_started','Video generation started'));
    } catch (err) {
      setIsGenerating(false);
      const data = err?.response?.data || {};
      const msg = data.error || data.message || err?.message || tr('stages.error.generation','Generation failed');
      if (data.error === 'Insufficient tokens' || /insufficient (tokens|credits)/i.test(String(msg))) {
        toast.error(tr('stages.error.not_enough','Not enough credits — buy more to generate.'));
        setShowBuyTokens(true);
        refreshBalance();
      } else {
        toast.error(msg);
      }
    }
  };

  const handleDownload = async () => {
    if (!result) return;
    try {
      const response = await fetch(result);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const safeName = String(selected?.name || 'stage-result').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'stage-result';
      let extension = isImageStage ? '.jpg' : '.mp4';
      try {
        const pathname = new URL(result).pathname;
        const match = pathname.match(/(\.[a-z0-9]{2,5})$/i);
        if (match?.[1]) extension = match[1];
      } catch {}
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = safeName.toLowerCase().endsWith(extension.toLowerCase()) ? safeName : `${safeName}${extension}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(result, '_blank', 'noopener,noreferrer');
      toast.error(tr('stages.error.download_blocked','Direct download was blocked. The result was opened in a new tab instead.'));
    }
  };

  const handleSavedToVault = () => {
    setShowSaveVault(false);
    setResult(null);
    setSelected(null);
    setSelectedStyleIndex(null);
    setSelectedOutput(null);
    setGenerationJob(null);
    qc.invalidateQueries({ queryKey: ['vaultAssets', user?.email] });
  };

  if (!selected) {
    return <div className="w-full bg-[#202328] px-4 py-5 pb-28 text-white lg:pb-32">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-end justify-between gap-4 border-b border-white/10 pb-4">
          <p className="text-sm text-white/45">{tr("stages.intro","Upload a photo, then choose a Stage.")}</p>
          {photoUrl && <div className="flex items-center gap-3 rounded-[4px] border border-white/10 bg-[#17191d] px-3 py-2"><img src={photoUrl} alt="you" className="h-10 w-10 rounded-[3px] object-cover"/><div><p className="text-xs font-bold text-white">{tr("stages.photo_ready","Photo ready")}</p><button onClick={() => { setPhotoUrl(null); setPhotoFile(null); }} className="text-[10px] font-bold text-[#8ee9e4]">{tr("stages.change","Change")}</button></div></div>}
        </div>

        {generationJob && ACTIVE_JOB_STATUSES.has(generationJob.status) && <div className="mb-4 flex items-center gap-3 rounded-[4px] border border-[#23c7be]/35 bg-[#23c7be]/10 px-4 py-3"><Loader2 size={18} className="animate-spin text-[#23c7be]"/><div className="min-w-0 flex-1"><p className="text-sm font-black text-white">{tr("stages.job_active","Stage video is still generating")}</p><p className="text-xs text-white/50">{tr("stages.job_help","It will keep running until the AI provider finishes.")}</p></div>{generationJob.stage_id && <button onClick={() => { const theme = themes.find((item) => String(item.id) === String(generationJob.stage_id)); if (theme) openTheme(theme); }} className="studio-button studio-button-secondary">{tr("stages.open","Open")}</button>}</div>}

        <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="space-y-4">
            {!photoUrl && <div className="space-y-3">
              <label className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-[4px] border border-dashed border-white/20 bg-[#17191d] p-6 text-center transition hover:border-[#23c7be]/60 hover:bg-[#1d2126]">{uploadingPhoto ? <><Loader2 size={30} className="animate-spin text-[#23c7be]"/><p className="mt-3 text-sm font-bold">{tr("stages.uploading","Uploading…")}</p></> : <><div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[3px] border border-[#23c7be]/30 bg-[#23c7be]/10"><Upload size={25} className="text-[#23c7be]"/></div><p className="text-base font-black">{tr("stages.upload_photo","Upload a photo")}</p><p className="mt-1 text-xs text-white/40">{tr("stages.photo_hint","Face, full body or selfie")}</p></>}<input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e.target.files?.[0])}/></label>
              <button type="button" onClick={openCamera} disabled={uploadingPhoto} className="flex w-full items-center justify-center gap-2 rounded-[4px] border border-[#23c7be]/35 bg-[#23c7be]/10 px-4 py-3 text-sm font-black text-[#8ee9e4] transition hover:bg-[#23c7be]/15 disabled:opacity-40"><Camera size={18}/>{tr('stages.take_picture', 'Take a picture')}</button>
            </div>}
            <div className="rounded-[4px] border border-white/10 bg-[#17191d] p-3"><p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/45">{tr("stages.filter","Filter")}</p><div className="flex flex-wrap gap-2 lg:flex-col">{CATEGORIES.map((c) => <button key={c.id} onClick={() => setCategory(c.id)} className={`rounded-[3px] border px-3 py-2 text-left text-xs font-black transition ${category === c.id ? 'border-[#23c7be]/40 bg-[#23c7be]/12 text-[#8ee9e4]' : 'border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.07]'}`}>{tr('stages.category.'+c.id,c.label)}</button>)}</div></div>
          </aside>

          <section>
            {isLoading ? <div className="flex min-h-72 items-center justify-center rounded-[4px] border border-white/10 bg-[#17191d]"><Loader2 size={28} className="animate-spin text-[#23c7be]"/></div> : filtered.length === 0 ? <div className="flex min-h-72 flex-col items-center justify-center rounded-[4px] border border-dashed border-white/15 bg-[#17191d] p-10 text-center"><Sparkles size={36} className="text-[#23c7be]"/><p className="mt-4 text-lg font-black">{tr("stages.empty","No Stages here yet")}</p></div> : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((t) => {
              const type = t.output_type || 'video';
              const label = type === 'both' ? tr('stages.output.both','Image + Video') : type === 'image' ? tr('stages.output.image','Image') : tr('stages.output.video','Video');
              return <motion.button key={t.id} whileTap={{ scale: 0.98 }} onClick={() => openTheme(t)} className="overflow-hidden rounded-[4px] border border-white/10 bg-[#17191d] text-left transition hover:border-[#23c7be]/45 hover:shadow-[inset_2px_0_0_#23c7be]"><div className="relative aspect-[16/10] bg-[#1d2126]">{t.cover_image ? <img src={t.cover_image} alt={t.name} className="h-full w-full object-cover"/> : <div className="flex h-full w-full items-center justify-center">{type === 'image' ? <ImageIcon size={32} className="text-[#23c7be]"/> : <Film size={32} className="text-[#23c7be]"/>}</div>}<span className="absolute left-2 top-2 rounded-[3px] border border-white/10 bg-black/70 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-white/80">{label}</span></div><div className="p-3.5"><p className="truncate text-sm font-black text-white">{tr('stages.theme.'+t.name,t.name)}</p>{t.description && <p className="mt-1 line-clamp-2 text-xs text-white/45">{tr('stages.description.'+t.description,t.description)}</p>}</div></motion.button>;
            })}</div>}
          </section>
        </div>
      </div>
      {showCamera && <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label={tr('stages.take_picture', 'Take a picture')}>
        <div className="w-full max-w-2xl overflow-hidden rounded-[4px] border border-white/15 bg-[#17191d]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><h3 className="text-sm font-black text-white">{tr('stages.take_picture', 'Take a picture')}</h3><button type="button" onClick={stopCamera} className="p-2 text-white/70 hover:text-white" aria-label={tr('common.close', 'Close')}><X size={20}/></button></div>
          <video ref={cameraVideoRef} autoPlay playsInline muted className="max-h-[65vh] w-full bg-black object-contain"/>
          <div className="flex justify-end gap-2 p-4"><button type="button" onClick={stopCamera} className="border border-white/15 px-4 py-3 text-sm font-bold text-white">{tr('common.cancel', 'Cancel')}</button><button type="button" onClick={capturePhoto} className="flex items-center gap-2 bg-[#23c7be] px-5 py-3 text-sm font-black text-[#071211]"><Camera size={17}/>{tr('stages.capture', 'Capture photo')}</button></div>
        </div>
      </div>}
    </div>;
  }

  return <div className="w-full bg-[#202328] px-4 py-5 pb-28 text-white lg:pb-32">
    <div className="mx-auto max-w-5xl">
      <button onClick={() => { setSelected(null); setResult(null); setSelectedStyleIndex(null); setSelectedOutput(null); }} className="mb-4 flex items-center gap-2 text-sm font-bold text-white/60 hover:text-white"><ChevronLeft size={20}/> {tr('stages.back','Back to Stages')}</button>
      <div className="rounded-[4px] border border-white/10 bg-[#17191d] p-5 md:p-6">
        <div className="mb-5 flex gap-3 border-b border-white/10 pb-4"><img src={photoUrl} alt="you" className="h-16 w-16 flex-shrink-0 rounded-[3px] object-cover"/><div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-wide text-[#23c7be]"><User size={12} className="mr-1 inline"/>{configuredOutput === 'both' ? tr('stages.kind.both','Image + Video Stage') : configuredOutput === 'image' ? tr('stages.kind.image','Image Stage') : tr('stages.kind.video','Video Stage')}</p><h3 className="mt-1 text-lg font-black text-white">{tr('stages.theme.'+selected.name,selected.name)}</h3>{selected.description && <p className="mt-1 text-sm text-white/45">{tr('stages.description.'+selected.description,selected.description)}</p>}<p className="mt-2 line-clamp-3 text-xs text-white/65">{tr('stages.scenario.'+selected.scenario,selected.scenario)}</p></div></div>

        {styles.length > 0 && <div className="mb-5"><p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/50">1 · {tr("stages.choose_style","Choose a style")}</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{styles.map((style, index) => <button key={`${style.name}-${index}`} onClick={() => chooseStyle(index)} disabled={isGenerating && isVideoStage} className={`overflow-hidden rounded-[3px] border text-left transition disabled:opacity-50 ${selectedStyleIndex === index ? 'border-[#23c7be] bg-[#23c7be]/10 shadow-[inset_2px_0_0_#23c7be]' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}`}>{style.preview_image ? <img src={style.preview_image} alt={style.name} className="aspect-[4/3] w-full object-cover"/> : <div className="flex aspect-[4/3] items-center justify-center bg-[#202328]"><ImageIcon size={24} className="text-[#23c7be]"/></div>}<div className="px-3 py-2 text-xs font-black text-white">{tr('stages.style.'+style.name,style.name)}</div></button>)}</div></div>}

        {configuredOutput === 'both' && styleChosen && <div className="mb-5"><p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/50">{styles.length > 0 ? '2' : '1'} · {tr("stages.choose_output","Choose output")}</p><div className="grid grid-cols-2 gap-2"><button onClick={() => chooseOutput('image')} disabled={isGenerating && isVideoStage} className={`flex items-center justify-center gap-2 rounded-[3px] border py-3 text-sm font-black disabled:opacity-50 ${selectedOutput === 'image' ? 'border-[#23c7be]/45 bg-[#23c7be]/12 text-[#8ee9e4]' : 'border-white/10 bg-white/[0.03] text-white/65'}`}><ImageIcon size={18}/> {tr("stages.output.image","Image")}</button><button onClick={() => chooseOutput('video')} disabled={isGenerating && isVideoStage} className={`flex items-center justify-center gap-2 rounded-[3px] border py-3 text-sm font-black disabled:opacity-50 ${selectedOutput === 'video' ? 'border-[#23c7be]/45 bg-[#23c7be]/12 text-[#8ee9e4]' : 'border-white/10 bg-white/[0.03] text-white/65'}`}><Film size={18}/> {tr("stages.output.video","Video")}</button></div></div>}

        {outputChosen && styleChosen && <>
          <div className="mb-5 space-y-2"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/50">{tr("stages.ai_model","AI Model")}</p><select value={effectiveModel || ''} onChange={(e) => setSelectedModel(e.target.value || null)} disabled={modelsLoading || modelOptions.length === 0 || (isGenerating && isVideoStage)} className="w-full rounded-[3px] border border-white/15 bg-black/25 px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#23c7be] disabled:opacity-50">{modelsLoading && <option value="">{tr("stages.models_loading","Loading models…")}</option>}{!modelsLoading && modelOptions.length === 0 && <option value="">{tr("stages.models_empty","No model available")}</option>}{modelOptions.map((m) => <option key={m.model_key} value={m.model_key}>{m.name || m.model_key}{m.recommended ? ' — ' + tr("stages.recommended","Recommended") : ''}{m.credits ? ` — ${m.credits} ${tr("stages.credits","credits")}` : ''}</option>)}</select></div>

          <div className={`mb-5 grid grid-cols-1 gap-4 ${isVideoStage ? 'md:grid-cols-2' : ''}`}>
            {isVideoStage && <div><p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/50">{tr("stages.duration","Duration")}</p><div className="flex gap-2">{[5, 10].map((d) => <button key={d} onClick={() => setDuration(d)} disabled={isGenerating} className={`flex-1 rounded-[3px] border py-2.5 text-sm font-black disabled:opacity-50 ${duration === d ? 'border-[#23c7be]/40 bg-[#23c7be]/12 text-[#8ee9e4]' : 'border-white/10 bg-white/[0.04] text-white/65'}`}>{d}s</button>)}</div></div>}
            <div><p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/50">{tr("stages.aspect","Aspect")}</p><div className="flex gap-2">{['16:9', '9:16', '1:1'].map((r) => <button key={r} onClick={() => setAspectRatio(r)} disabled={isGenerating && isVideoStage} className={`flex-1 rounded-[3px] border py-2.5 text-xs font-black disabled:opacity-50 ${aspectRatio === r ? 'border-[#23c7be]/40 bg-[#23c7be]/12 text-[#8ee9e4]' : 'border-white/10 bg-white/[0.04] text-white/65'}`}>{r}</button>)}</div></div>
          </div>
        </>}

        <div className="mb-4 flex flex-col gap-1.5 rounded-[3px] border border-white/10 bg-black/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs font-bold text-white/70">{tr("stages.cost","Cost")}: <span className="text-[#8ee9e4]">{!styleChosen ? tr("stages.choose_style_short","Choose style") : !outputChosen ? tr("stages.choose_output_short","Choose output") : priceLoading ? tr("stages.calculating","Calculating…") : cost !== null ? `${cost} ${tr("stages.credits","credits")}` : '…'}</span></p><p className="text-xs font-bold text-white/70">{tr("stages.balance","Balance")}: <span className={insufficient ? 'text-red-400' : 'text-[#8ee9e4]'}>{balance !== null ? `${balance} ${tr("stages.credits","credits")}` : '…'}</span></p></div>
        {insufficient && <button onClick={() => setShowBuyTokens(true)} className="mb-3 flex w-full items-center justify-center gap-2 rounded-[3px] border border-red-400/30 bg-red-400/10 py-3 font-bold text-red-200"><Coins size={18}/> {tr("stages.insufficient","Not enough credits — Buy more")}</button>}

        {generationJob && ACTIVE_JOB_STATUSES.has(generationJob.status) && isVideoStage && <div className="mb-3 flex items-center gap-3 rounded-[3px] border border-[#23c7be]/30 bg-[#23c7be]/10 px-4 py-3"><Loader2 size={18} className="animate-spin text-[#23c7be]"/><div><p className="text-sm font-black text-white">{tr("stages.generating_video","Generating video…")}</p><p className="text-xs text-white/50">{tr("stages.generating_hint","The job stays active until the AI provider finishes. You can leave Stage and come back.")}</p></div></div>}

        {!result ? <button onClick={handleGenerate} disabled={isGenerating || insufficient || !styleChosen || !outputChosen} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-[3px] bg-[#23c7be] py-4 font-black text-[#071211] disabled:bg-white/[0.05] disabled:text-white/30">{isGenerating ? <><Loader2 size={20} className="animate-spin"/> {tr("stages.generating","Generating…")}</> : <><Sparkles size={20}/> {!styleChosen ? tr("stages.choose_a_style","Choose a style") : !outputChosen ? tr("stages.choose_image_or_video","Choose Image or Video") : `${tr("stages.generate","Generate")} ${isImageStage ? tr("stages.output.image","Image") : tr("stages.output.video","Video")}`}</>}</button> : <div className="space-y-4"><div className="flex min-h-[320px] items-center justify-center rounded-[4px] border border-white/10 bg-black p-3">{isImageStage ? <img src={result} alt={selected.name} className="max-h-[700px] max-w-full object-contain"/> : <video src={result} controls className="w-full rounded-[3px]"/>}</div><div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><button onClick={() => { setResult(null); setGenerationJob(null); }} className="rounded-[3px] border border-white/10 bg-white/[0.04] py-3 font-bold text-white">{tr("stages.regenerate","Regenerate")}</button><button onClick={handleDownload} className="flex items-center justify-center gap-2 rounded-[3px] border border-[#23c7be]/35 bg-[#23c7be]/10 py-3 font-black text-[#8ee9e4]"><Download size={19}/> {tr("stages.download","Download")}</button><button onClick={() => setShowSaveVault(true)} className="flex items-center justify-center gap-2 rounded-[3px] bg-[#23c7be] py-3 font-black text-[#071211]"><CheckCircle2 size={20}/> {tr("stages.save_vault","Save to Vault")}</button></div></div>}
      </div>

      {showSaveVault && result && <SaveToVaultModal userEmail={user?.email} imageUrl={result} mediaType={isImageStage ? 'image' : 'video'} onClose={() => setShowSaveVault(false)} onSaved={handleSavedToVault}/>} 
      {showBuyTokens && <TokenPurchaseModal onClose={() => setShowBuyTokens(false)} onPurchased={refreshBalance}/>} 
    </div>
  </div>;
}