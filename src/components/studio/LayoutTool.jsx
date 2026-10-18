import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Download,
  Image as ImageIcon,
  LayoutTemplate,
  Loader2,
  Save,
  Sparkles,
  Store,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import AtelierAssetPicker from '@/components/atelier/AtelierAssetPicker';
import Catalog from '@/pages/Catalog';
import { useAiPriceQuote } from '@/hooks/useAiPriceQuote';
import { useAiModelOptions } from '@/hooks/useAiModelOptions';

const CREATION_MODES = [
  { id: 'ai', label: 'AI' },
  { id: 'compose', label: 'Compose exact' },
];

const PURPOSES = [
  { id: 'cover', label: 'Cover' },
  { id: 'page', label: 'Page' },
  { id: 'spread', label: 'Double page' },
  { id: 'image', label: 'Image' },
];

const IMAGE_MODES = [
  { id: 'prompt', label: 'Prompt only' },
  { id: 'combine', label: 'Combine images' },
];

const FORMATS = [
  { id: '2:3', label: '2:3' },
  { id: '3:4', label: '3:4' },
  { id: '9:16', label: '9:16' },
  { id: '16:9', label: '16:9' },
  { id: '1:1', label: '1:1' },
];

const COVER_POSITIONS = [
  { id: 'top', label: 'Top' },
  { id: 'middle', label: 'Middle' },
  { id: 'bottom', label: 'Bottom' },
];

const COVER_STYLES = [
  { id: 'classic', label: 'Classic' },
  { id: 'romantic', label: 'Romantic' },
  { id: 'drama', label: 'Drama' },
  { id: 'sci-fi', label: 'Sci-Fi' },
  { id: 'fashion', label: 'Fashion' },
  { id: 'horror', label: 'Horror' },
  { id: 'comedy', label: 'Comedy' },
  { id: 'action', label: 'Action' },
  { id: 'documentary', label: 'Documentary' },
];

const COVER_TREATMENTS = [
  { id: 'minimal', label: 'Minimal' },
  { id: 'bold', label: 'Bold' },
  { id: 'elegant', label: 'Elegant' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'cinematic', label: 'Cinematic' },
];

const COVER_ALIGNMENTS = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Center' },
  { id: 'right', label: 'Right' },
];

const COVER_EMPHASIS = [
  { id: 'portrait', label: 'Portrait' },
  { id: 'full-image', label: 'Full image' },
  { id: 'typography', label: 'Typography' },
  { id: 'balanced', label: 'Balanced' },
];

const ALLOWED_UPLOAD_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const FORMAT_DIMENSIONS = {
  '2:3': [1200, 1800],
  '3:4': [1200, 1600],
  '9:16': [1080, 1920],
  '16:9': [1920, 1080],
  '1:1': [1400, 1400],
};

function buildPrompt({
  purpose,
  format,
  exactText,
  direction,
  hasSource,
  imageMode,
  imageCount,
  revision,
  coverTitle,
  coverSubtitle,
  titlePosition,
  subtitlePosition,
  coverStyle,
  coverTreatment,
  coverAlignment,
  coverEmphasis,
}) {
  if (purpose === 'image') {
    return [
      imageMode === 'combine'
        ? `Create one coherent standalone image in ${format} format by combining the ${imageCount} supplied reference images.`
        : `Create one finished standalone image in ${format} format entirely from the image prompt.`,
      imageMode === 'combine'
        ? 'Use the important subjects and visual elements from every supplied reference. Blend them into one natural, unified composition; do not make a collage, contact sheet, split screen or grid unless the image prompt explicitly requests it.'
        : 'Do not rely on a source image. Create the complete visual from the image prompt.',
      direction.trim() ? `Image prompt: ${direction.trim()}` : '',
      revision.trim() ? `Revision requested from the previous version: ${revision.trim()}` : '',
      'Do not add any words, letters, numbers, captions, speech bubbles, signs, logos, watermarks or typographic marks anywhere in the image.',
      'Deliver one complete publication-ready image without mockup borders, editor controls, guides or margins.',
    ].filter(Boolean).join('\n');
  }

  if (purpose === 'cover') {
    return [
      `Create a finished cover layout in ${format} format.`,
      hasSource
        ? 'Use the supplied source image as the primary visual. Preserve its essential subject and identity while recomposing it professionally.'
        : 'Create the complete primary visual from the cover direction and selected style.',
      coverTitle.trim()
        ? `Use this exact cover title with identical spelling: ${coverTitle.trim()}. Place the title in the ${titlePosition} area of the cover.`
        : 'Do not invent a title.',
      coverSubtitle.trim()
        ? `Use this exact subtitle with identical spelling: ${coverSubtitle.trim()}. Place the subtitle in the ${subtitlePosition} area of the cover.`
        : 'Do not invent a subtitle.',
      `Cover style: ${coverStyle}.`,
      `Title treatment: ${coverTreatment}.`,
      `Text alignment: ${coverAlignment}.`,
      `Visual emphasis: ${coverEmphasis}.`,
      coverTitle.trim() || coverSubtitle.trim()
        ? 'Integrate the title and subtitle into the visual composition as designed typography, matching the mood, lighting, depth, scale and style of the cover. Avoid generic default-font overlays or plain text boxes. Keep every supplied word readable and correctly spelled. Do not add any other words, captions, logos or typographic marks.'
        : 'Do not add any words, letters, logos or typographic marks.',
      direction.trim() ? `Art direction: ${direction.trim()}` : '',
      revision.trim() ? `Revision requested from the previous version: ${revision.trim()}` : '',
      'Deliver one complete publication-ready flattened cover without mockup borders, editor controls, guides or margins.',
    ].filter(Boolean).join('\n');
  }

  const purposeLabel = PURPOSES.find((item) => item.id === purpose)?.label || 'editorial';
  return [
    `Create a finished ${purposeLabel} layout in ${format} format.`,
    hasSource
      ? 'Use the supplied source image as the primary visual. Preserve its essential subject and identity while recomposing it professionally.'
      : 'Create the complete primary visual from the art direction.',
    exactText.trim()
      ? `Integrate this exact text with identical spelling and line breaks: ${exactText.trim()}.`
      : 'Do not add any words, letters, logos or typographic marks.',
    exactText.trim()
      ? 'Design the lettering as an original graphic element inside the artwork, integrated with its lighting, depth, material and composition. Do not use a conventional font overlay, generic caption, plain white text, interface typography or a text box. Keep every character readable and correctly spelled.'
      : '',
    direction.trim() ? `Art direction: ${direction.trim()}` : '',
    revision.trim() ? `Revision requested from the previous version: ${revision.trim()}` : '',
    'Deliver one complete publication-ready flattened image without mockup borders, editor controls, guides or margins.',
  ].filter(Boolean).join('\n');
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to load one of the composition images'));
    image.src = url;
  });
}

function fitContain(imageWidth, imageHeight, canvasWidth, canvasHeight) {
  const scale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    x: (canvasWidth - width) / 2,
    y: (canvasHeight - height) / 2,
    width,
    height,
  };
}

function overlayAnchor({ position, alignment, margin }, canvasWidth, canvasHeight, width, height) {
  const marginX = canvasWidth * (margin / 100);
  const marginY = canvasHeight * (margin / 100);

  let x = marginX;
  if (alignment === 'center') x = (canvasWidth - width) / 2;
  if (alignment === 'right') x = canvasWidth - width - marginX;

  let y = marginY;
  if (position === 'middle') y = (canvasHeight - height) / 2;
  if (position === 'bottom') y = canvasHeight - height - marginY;

  return { x, y };
}

function createOverlay(url) {
  return {
    id: crypto.randomUUID(),
    url,
    position: 'top',
    alignment: 'center',
    scale: 40,
    margin: 4,
    rotation: 0,
    opacity: 100,
  };
}

export default function LayoutTool({ user, onClose }) {
  const [creationMode, setCreationMode] = useState('ai');
  const [purpose, setPurpose] = useState('cover');
  const [imageMode, setImageMode] = useState('prompt');
  const [format, setFormat] = useState('2:3');
  const [sourceUrls, setSourceUrls] = useState([]);
  const [imageSources, setImageSources] = useState([]);
  const [exactText, setExactText] = useState('');
  const [direction, setDirection] = useState('');
  const [revision, setRevision] = useState('');
  const [versions, setVersions] = useState([]);
  const [selectedUrl, setSelectedUrl] = useState('');
  const [vaultTarget, setVaultTarget] = useState(null);
  const [assetShopTarget, setAssetShopTarget] = useState(null);
  const [assetSelecting, setAssetSelecting] = useState(false);
  const [uploadTarget, setUploadTarget] = useState('source');
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const [coverTitle, setCoverTitle] = useState('');
  const [coverSubtitle, setCoverSubtitle] = useState('');
  const [titlePosition, setTitlePosition] = useState('top');
  const [subtitlePosition, setSubtitlePosition] = useState('bottom');
  const [coverStyle, setCoverStyle] = useState('classic');
  const [coverTreatment, setCoverTreatment] = useState('editorial');
  const [coverAlignment, setCoverAlignment] = useState('center');
  const [coverEmphasis, setCoverEmphasis] = useState('balanced');

  const [composeBaseUrl, setComposeBaseUrl] = useState('');
  const [composeOverlays, setComposeOverlays] = useState([]);
  const [composeResultUrl, setComposeResultUrl] = useState('');
  const [composing, setComposing] = useState(false);

  const fileInputRef = useRef(null);

  const prompt = useMemo(() => buildPrompt({
    purpose,
    format,
    exactText,
    direction,
    hasSource: sourceUrls.length > 0,
    imageMode,
    imageCount: imageSources.length,
    revision,
    coverTitle,
    coverSubtitle,
    titlePosition,
    subtitlePosition,
    coverStyle,
    coverTreatment,
    coverAlignment,
    coverEmphasis,
  }), [
    purpose,
    format,
    exactText,
    direction,
    sourceUrls.length,
    imageMode,
    imageSources.length,
    revision,
    coverTitle,
    coverSubtitle,
    titlePosition,
    subtitlePosition,
    coverStyle,
    coverTreatment,
    coverAlignment,
    coverEmphasis,
  ]);

  const pricingInput = { aspect_ratio: format, prompt };
  const { options: modelOptions, loading: modelsLoading } = useAiModelOptions({
    service: 'replicateGenerate:compose_scene',
    kind: 'image',
    input: pricingInput,
  });
  const effectiveModel = selectedModel || modelOptions.find((model) => model.recommended)?.model_key || modelOptions[0]?.model_key || null;
  const { quote: priceQuote, loading: priceLoading } = useAiPriceQuote({
    service: 'replicateGenerate:compose_scene',
    kind: 'image',
    input: pricingInput,
    modelKey: effectiveModel,
  });

  const addSourceUrl = (url, target = 'source') => {
    if (!url) return;
    if (target === 'compose-base') {
      setComposeBaseUrl(url);
      setComposeResultUrl('');
      return;
    }
    if (target === 'compose-overlay') {
      setComposeOverlays((current) => [...current, createOverlay(url)].slice(0, 6));
      setComposeResultUrl('');
      return;
    }
    if (target === 'combine') {
      setImageSources((current) => [...new Set([...current, url])].slice(0, 3));
      return;
    }
    setSourceUrls((current) => [...new Set([...current, url])].slice(0, 4));
  };

  const startUpload = (target) => {
    setUploadTarget(target);
    fileInputRef.current?.click();
  };

  const handleUploadFiles = async (event) => {
    const picked = Array.from(event.target.files || []);
    event.target.value = '';
    if (!picked.length) return;

    const invalid = picked.find((file) => !ALLOWED_UPLOAD_TYPES.includes(file.type));
    if (invalid) {
      toast.error('Choose JPG, PNG or WEBP images');
      return;
    }

    let available = picked.length;
    if (uploadTarget === 'combine') available = Math.max(0, 3 - imageSources.length);
    if (uploadTarget === 'source') available = Math.max(0, 4 - sourceUrls.length);
    if (uploadTarget === 'compose-base') available = 1;
    if (uploadTarget === 'compose-overlay') available = Math.max(0, 6 - composeOverlays.length);

    if (!available) {
      toast.error('Maximum number of images reached');
      return;
    }

    setUploading(true);
    try {
      const selected = picked.slice(0, available);
      const uploaded = [];
      for (const file of selected) {
        const result = await base44.integrations.Core.UploadFile({ file, saveToVault: false });
        if (result?.file_url) uploaded.push(result.file_url);
      }
      if (!uploaded.length) throw new Error('Upload did not return an image URL');

      uploaded.forEach((url) => addSourceUrl(url, uploadTarget));
      toast.success(uploaded.length === 1 ? 'Image uploaded' : `${uploaded.length} images uploaded`);
    } catch (error) {
      toast.error(error?.message || 'Unable to upload image');
    } finally {
      setUploading(false);
    }
  };

  const openAssetsShop = (target) => {
    setAssetShopTarget(target);
  };

  const handleAssetShopSelect = async (assetId) => {
    if (!assetId || !assetShopTarget || assetSelecting) return;
    setAssetSelecting(true);
    try {
      const { data: asset, error } = await supabase
        .from('catalog_asset')
        .select('featured_image')
        .eq('id', assetId)
        .single();
      if (error) throw error;
      if (!asset?.featured_image) throw new Error('This asset has no image available for Layout');
      addSourceUrl(asset.featured_image, assetShopTarget);
      setAssetShopTarget(null);
      toast.success('Asset added to Layout');
    } catch (error) {
      toast.error(error?.message || 'Unable to add this asset to Layout');
    } finally {
      setAssetSelecting(false);
    }
  };

  const updateOverlay = (id, patch) => {
    setComposeOverlays((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
    setComposeResultUrl('');
  };

  const moveOverlay = (id, directionValue) => {
    setComposeOverlays((current) => {
      const index = current.findIndex((item) => item.id === id);
      if (index < 0) return current;
      const nextIndex = index + directionValue;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
    setComposeResultUrl('');
  };

  const generate = async () => {
    if (purpose === 'image' && imageMode === 'prompt' && !direction.trim()) {
      toast.error('Describe the image to create');
      return;
    }
    if (purpose === 'image' && imageMode === 'combine' && imageSources.length < 2) {
      toast.error('Choose at least 2 images to combine');
      return;
    }
    if (purpose !== 'image' && sourceUrls.length === 0 && !direction.trim()) {
      toast.error('Choose an image or describe the art direction');
      return;
    }

    setGenerating(true);
    try {
      const references = purpose === 'image'
        ? imageMode === 'combine'
          ? [...new Set([...(revision.trim() ? [selectedUrl] : []), ...imageSources].filter(Boolean))].slice(0, 3)
          : [...new Set(revision.trim() ? [selectedUrl].filter(Boolean) : [])]
        : [...new Set([selectedUrl, ...sourceUrls].filter(Boolean))].slice(0, 4);

      const response = await base44.functions.invoke('replicateGenerate', {
        method: 'compose_scene',
        prompt,
        reference_image_urls: references.length ? references : undefined,
        aspect_ratio: format,
        model_key: effectiveModel || undefined,
      });
      const url = response?.data?.file_url;
      if (!url) throw new Error(response?.data?.error || response?.data?.message || 'Generation failed');

      const version = { id: crypto.randomUUID(), url, prompt };
      setVersions((current) => [version, ...current]);
      setSelectedUrl(url);
      setRevision('');
      toast.success(purpose === 'image' ? 'Image generated' : 'Layout generated');
    } catch (error) {
      toast.error(error?.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const renderExactComposition = async () => {
    if (!composeBaseUrl) {
      toast.error('Choose a base image');
      return;
    }

    setComposing(true);
    try {
      const [canvasWidth, canvasHeight] = FORMAT_DIMENSIONS[format] || FORMAT_DIMENSIONS['2:3'];
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, canvasWidth, canvasHeight);

      const baseImage = await loadImage(composeBaseUrl);
      const baseFit = fitContain(baseImage.naturalWidth, baseImage.naturalHeight, canvasWidth, canvasHeight);
      context.drawImage(baseImage, baseFit.x, baseFit.y, baseFit.width, baseFit.height);

      for (const overlay of composeOverlays) {
        const overlayImage = await loadImage(overlay.url);
        const maxWidth = canvasWidth * (overlay.scale / 100);
        const naturalScale = maxWidth / overlayImage.naturalWidth;
        const width = overlayImage.naturalWidth * naturalScale;
        const height = overlayImage.naturalHeight * naturalScale;
        const anchor = overlayAnchor(overlay, canvasWidth, canvasHeight, width, height);

        context.save();
        context.globalAlpha = overlay.opacity / 100;
        context.translate(anchor.x + width / 2, anchor.y + height / 2);
        context.rotate((overlay.rotation * Math.PI) / 180);
        context.drawImage(overlayImage, -width / 2, -height / 2, width, height);
        context.restore();
      }

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Unable to render composition')), 'image/png', 1);
      });
      const file = new File([blob], `layout-compose-${Date.now()}.png`, { type: 'image/png' });
      const upload = await base44.integrations.Core.UploadFile({ file, saveToVault: false });
      if (!upload?.file_url) throw new Error('Unable to upload rendered composition');
      setComposeResultUrl(upload.file_url);
      toast.success('Exact composition rendered');
    } catch (error) {
      toast.error(error?.message || 'Unable to render composition');
    } finally {
      setComposing(false);
    }
  };

  const saveToVault = async (url = selectedUrl, nameOverride = '') => {
    if (!url) return;
    setSaving(true);
    try {
      await base44.entities.VaultAsset.create({
        user_email: user?.email || '',
        url,
        media_type: 'image',
        name: nameOverride || (purpose === 'image'
          ? (direction.trim().slice(0, 60) || 'Generated image')
          : purpose === 'cover'
            ? (coverTitle.trim().slice(0, 60) || 'Generated cover')
            : (exactText.trim().split('\n')[0]?.slice(0, 60) || `Layout ${purpose}`)),
        tags: creationMode === 'compose' ? ['layout', 'exact-compose'] : ['ai-generated', purpose === 'image' ? 'image' : 'layout', purpose],
        asset_category: 'reference',
        aspect_ratio: format.replace(':', ''),
      });
      toast.success('Layout saved to your Vault');
    } catch (error) {
      toast.error(error?.message || 'Unable to save to Vault');
    } finally {
      setSaving(false);
    }
  };

  const downloadUrl = async (url, fileName = 'layout') => {
    if (!url) return;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error();
      const href = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = href;
      link.download = `${fileName}.png`;
      link.click();
      URL.revokeObjectURL(href);
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
      toast.info('Open the image to save it');
    }
  };

  const download = async () => {
    const fileName = purpose === 'image'
      ? 'image'
      : purpose === 'cover'
        ? (coverTitle.trim().replace(/[^a-z0-9]+/gi, '_') || 'cover')
        : (exactText.trim().split('\n')[0]?.replace(/[^a-z0-9]+/gi, '_') || 'layout');
    await downloadUrl(selectedUrl, fileName);
  };

  const sourceTarget = purpose === 'image' && imageMode === 'combine' ? 'combine' : 'source';
  const sourceList = sourceTarget === 'combine' ? imageSources : sourceUrls;
  const maxSources = sourceTarget === 'combine' ? 3 : 4;
  const previewAspect = format.replace(':', ' / ');

  return (
    <div className="min-h-screen bg-[#202328] px-5 pb-24 pt-6 text-white lg:h-[calc(100vh-3.5rem)] lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:px-8">
      <header className="mx-auto mb-5 flex max-w-[1500px] items-center gap-3 border-b border-white/10 pb-5">
        <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-[3px] border border-white/10 bg-white/[0.04] text-white/65 transition hover:bg-white/10 hover:text-white">
          <ArrowLeft size={19} />
        </button>
        <div>
          <p className="text-[9px] font-black uppercase tracking-[.24em] text-[#23c7be]">AI Production Tool</p>
          <h1 className="text-3xl font-black tracking-tight lg:text-4xl">Layout</h1>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-5 xl:grid-cols-[430px_minmax(0,1fr)]">
        <section className="space-y-5 rounded-[4px] border border-white/10 bg-[#16181b] p-5 lg:p-6">
          <Picker title="Mode" items={CREATION_MODES} value={creationMode} onChange={setCreationMode} columns="grid-cols-2" />

          {creationMode === 'ai' ? (
            <>
              <div>
                <Label>AI Model</Label>
                <select
                  value={effectiveModel || ''}
                  onChange={(event) => setSelectedModel(event.target.value || null)}
                  disabled={modelsLoading || modelOptions.length === 0}
                  className="w-full rounded-[3px] border border-white/10 bg-[#26292d] px-3 py-3 text-sm font-bold text-white outline-none transition focus:border-[#23c7be]/60 disabled:opacity-50"
                >
                  {modelsLoading && <option value="">Loading models…</option>}
                  {!modelsLoading && modelOptions.length === 0 && <option value="">No model available</option>}
                  {modelOptions.map((model) => (
                    <option key={model.model_key} value={model.model_key}>
                      {model.name || model.model_key}{model.recommended ? ' — Recommended' : ''}{model.credits ? ` — ${model.credits} credits` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <Picker title="Usage" items={PURPOSES} value={purpose} onChange={setPurpose} columns="grid-cols-2 sm:grid-cols-4" />
              <Picker title="Format" items={FORMATS} value={format} onChange={setFormat} columns="grid-cols-5" />

              {purpose === 'image' && (
                <Picker title="Image creation" items={IMAGE_MODES} value={imageMode} onChange={setImageMode} columns="grid-cols-2" />
              )}

              {(purpose !== 'image' || imageMode === 'combine') && (
                <div>
                  <Label>{sourceTarget === 'combine' ? 'Images to combine · 2 to 3' : 'Source images'}</Label>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" multiple className="hidden" onChange={handleUploadFiles} />
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => startUpload(sourceTarget)} disabled={uploading || sourceList.length >= maxSources} className="flex min-h-14 items-center justify-center gap-2 rounded-[3px] border border-[#23c7be]/45 bg-[#23c7be]/10 px-3 py-3 text-sm font-black text-[#23c7be] transition hover:bg-[#23c7be]/15 disabled:cursor-not-allowed disabled:opacity-40">
                      {uploading ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
                      {uploading ? 'Uploading…' : 'Upload'}
                    </button>
                    <button type="button" onClick={() => openAssetsShop(sourceTarget)} disabled={sourceList.length >= maxSources} className="flex min-h-14 items-center justify-center gap-2 rounded-[3px] border border-white/15 bg-white/[0.04] px-3 py-3 text-sm font-black text-white transition hover:border-[#23c7be]/50 hover:text-[#23c7be] disabled:cursor-not-allowed disabled:opacity-40">
                      <Store size={17} /> Assets Shop
                    </button>
                  </div>
                  <button type="button" onClick={() => setVaultTarget(sourceTarget)} disabled={sourceList.length >= maxSources} className="mt-2 flex w-full items-center justify-center gap-2 rounded-[3px] border border-white/10 bg-white/[0.025] px-3 py-2.5 text-xs font-black text-white/65 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40">
                    <ImageIcon size={15} /> Pick from Vault
                  </button>
                  {sourceList.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {sourceList.map((url, index) => (
                        <div key={`${url}-${index}`} className="relative aspect-square overflow-hidden rounded-[3px] border border-white/15 bg-white/5">
                          <img src={url} alt={`Source ${index + 1}`} className="h-full w-full object-cover" />
                          <button type="button" onClick={() => {
                            if (sourceTarget === 'combine') setImageSources((current) => current.filter((item) => item !== url));
                            else setSourceUrls((current) => current.filter((item) => item !== url));
                          }} className="absolute right-1 top-1 rounded-[3px] bg-black/80 px-2 py-1 text-[10px] font-black text-red-300">Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {purpose === 'cover' && (
                <div className="space-y-4 border-t border-white/10 pt-5">
                  <div>
                    <Label>Cover title</Label>
                    <input type="text" value={coverTitle} onChange={(event) => setCoverTitle(event.target.value)} placeholder="Write the exact title" className="w-full rounded-[3px] border border-white/10 bg-[#26292d] px-3 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/25 focus:border-[#23c7be]/60" />
                  </div>
                  <Picker title="Title position" items={COVER_POSITIONS} value={titlePosition} onChange={setTitlePosition} columns="grid-cols-3" />
                  <div>
                    <Label>Subtitle</Label>
                    <input type="text" value={coverSubtitle} onChange={(event) => setCoverSubtitle(event.target.value)} placeholder="Write the exact subtitle" className="w-full rounded-[3px] border border-white/10 bg-[#26292d] px-3 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/25 focus:border-[#23c7be]/60" />
                  </div>
                  <Picker title="Subtitle position" items={COVER_POSITIONS} value={subtitlePosition} onChange={setSubtitlePosition} columns="grid-cols-3" />
                  <Picker title="Style" items={COVER_STYLES} value={coverStyle} onChange={setCoverStyle} columns="grid-cols-3" />
                  <Picker title="Title treatment" items={COVER_TREATMENTS} value={coverTreatment} onChange={setCoverTreatment} columns="grid-cols-3" />
                  <Picker title="Text alignment" items={COVER_ALIGNMENTS} value={coverAlignment} onChange={setCoverAlignment} columns="grid-cols-3" />
                  <Picker title="Visual emphasis" items={COVER_EMPHASIS} value={coverEmphasis} onChange={setCoverEmphasis} columns="grid-cols-2" />
                </div>
              )}

              {purpose !== 'image' && purpose !== 'cover' && (
                <div>
                  <Label>Exact text</Label>
                  <textarea value={exactText} onChange={(event) => setExactText(event.target.value)} rows={3} placeholder="Write the exact words and line breaks" className="w-full resize-none rounded-[3px] border border-white/10 bg-[#26292d] p-3 text-sm font-semibold text-white outline-none placeholder:text-white/25 focus:border-[#23c7be]/60" />
                </div>
              )}

              <div>
                <Label>{purpose === 'image' ? 'Image prompt' : purpose === 'cover' ? 'Art direction · optional' : 'Art direction'}</Label>
                <textarea value={direction} onChange={(event) => setDirection(event.target.value)} rows={5} placeholder={purpose === 'image' ? 'Describe the image to create, its subjects, setting, style, light and composition' : purpose === 'cover' ? 'Optional: add specific visual direction, setting, subject, lighting or composition' : 'Describe the visual world, materials, lettering character, light and composition'} className="w-full resize-none rounded-[3px] border border-white/10 bg-[#26292d] p-3 text-sm font-semibold text-white outline-none placeholder:text-white/25 focus:border-[#23c7be]/60" />
              </div>

              {selectedUrl && (
                <div>
                  <Label>Change this version</Label>
                  <textarea value={revision} onChange={(event) => setRevision(event.target.value)} rows={2} placeholder="Describe only what must change" className="w-full resize-none rounded-[3px] border border-white/10 bg-[#26292d] p-3 text-sm font-semibold text-white outline-none placeholder:text-white/25 focus:border-[#23c7be]/60" />
                </div>
              )}

              <button onClick={generate} disabled={generating} className="flex w-full items-center justify-center gap-2 rounded-[3px] bg-[#23c7be] py-3.5 font-black text-[#071211] transition hover:bg-[#35d8cf] disabled:opacity-50">
                {generating ? <><Loader2 className="animate-spin" size={18} /> Generating…</> : <><Sparkles size={18} /> {selectedUrl ? 'Generate a new version' : purpose === 'image' ? 'Generate image' : 'Generate layout'}{priceLoading ? ' · calculating…' : priceQuote?.credits ? ` · ${priceQuote.credits} credits` : ''}</>}
              </button>
            </>
          ) : (
            <>
              <Picker title="Format" items={FORMATS} value={format} onChange={(value) => { setFormat(value); setComposeResultUrl(''); }} columns="grid-cols-5" />
              <div className="rounded-[3px] border border-[#23c7be]/25 bg-[#23c7be]/[0.06] p-3 text-xs font-semibold leading-relaxed text-white/70">
                Compose exact does not send your images to the AI model. The base image and overlays are rendered as supplied; only position, scale, rotation, opacity and layer order are applied.
              </div>

              <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" multiple className="hidden" onChange={handleUploadFiles} />

              <div>
                <Label>Base image · locked as-is</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => startUpload('compose-base')} disabled={uploading} className="flex min-h-14 items-center justify-center gap-2 rounded-[3px] border border-[#23c7be]/45 bg-[#23c7be]/10 px-3 py-3 text-sm font-black text-[#23c7be] transition hover:bg-[#23c7be]/15 disabled:opacity-40">
                    {uploading ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />} Upload
                  </button>
                  <button type="button" onClick={() => openAssetsShop('compose-base')} className="flex min-h-14 items-center justify-center gap-2 rounded-[3px] border border-white/15 bg-white/[0.04] px-3 py-3 text-sm font-black text-white transition hover:border-[#23c7be]/50 hover:text-[#23c7be]">
                    <Store size={17} /> Assets Shop
                  </button>
                </div>
                <button type="button" onClick={() => setVaultTarget('compose-base')} className="mt-2 flex w-full items-center justify-center gap-2 rounded-[3px] border border-white/10 bg-white/[0.025] px-3 py-2.5 text-xs font-black text-white/65 transition hover:bg-white/[0.06] hover:text-white">
                  <ImageIcon size={15} /> Pick from Vault
                </button>
                {composeBaseUrl && (
                  <div className="relative mt-3 overflow-hidden rounded-[3px] border border-white/15 bg-white/5 p-2">
                    <img src={composeBaseUrl} alt="Base" className="max-h-48 w-full object-contain" />
                    <button type="button" onClick={() => { setComposeBaseUrl(''); setComposeResultUrl(''); }} className="absolute right-2 top-2 rounded-[3px] bg-black/80 px-2 py-1 text-[10px] font-black text-red-300">Remove</button>
                  </div>
                )}
              </div>

              <div>
                <Label>Overlay assets · exact images</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => startUpload('compose-overlay')} disabled={uploading || composeOverlays.length >= 6} className="flex min-h-14 items-center justify-center gap-2 rounded-[3px] border border-[#23c7be]/45 bg-[#23c7be]/10 px-3 py-3 text-sm font-black text-[#23c7be] transition hover:bg-[#23c7be]/15 disabled:opacity-40">
                    {uploading ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />} Upload overlay
                  </button>
                  <button type="button" onClick={() => openAssetsShop('compose-overlay')} disabled={composeOverlays.length >= 6} className="flex min-h-14 items-center justify-center gap-2 rounded-[3px] border border-white/15 bg-white/[0.04] px-3 py-3 text-sm font-black text-white transition hover:border-[#23c7be]/50 hover:text-[#23c7be] disabled:opacity-40">
                    <Store size={17} /> Assets Shop
                  </button>
                </div>
                <button type="button" onClick={() => setVaultTarget('compose-overlay')} disabled={composeOverlays.length >= 6} className="mt-2 flex w-full items-center justify-center gap-2 rounded-[3px] border border-white/10 bg-white/[0.025] px-3 py-2.5 text-xs font-black text-white/65 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40">
                  <ImageIcon size={15} /> Pick from Vault
                </button>

                <div className="mt-3 space-y-3">
                  {composeOverlays.map((overlay, index) => (
                    <div key={overlay.id} className="rounded-[3px] border border-white/10 bg-[#202328] p-3">
                      <div className="mb-3 flex items-center gap-3">
                        <img src={overlay.url} alt={`Overlay ${index + 1}`} className="h-16 w-16 rounded-[3px] border border-white/10 object-contain" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-black uppercase tracking-[.12em] text-white/70">Overlay {index + 1}</div>
                          <div className="mt-2 flex gap-2">
                            <button type="button" onClick={() => moveOverlay(overlay.id, -1)} disabled={index === 0} className="rounded-[3px] border border-white/10 px-2 py-1 text-[10px] font-black disabled:opacity-25">Back</button>
                            <button type="button" onClick={() => moveOverlay(overlay.id, 1)} disabled={index === composeOverlays.length - 1} className="rounded-[3px] border border-white/10 px-2 py-1 text-[10px] font-black disabled:opacity-25">Front</button>
                            <button type="button" onClick={() => { setComposeOverlays((current) => current.filter((item) => item.id !== overlay.id)); setComposeResultUrl(''); }} className="rounded-[3px] border border-red-400/20 px-2 py-1 text-[10px] font-black text-red-300">Remove</button>
                          </div>
                        </div>
                      </div>

                      <Picker title="Vertical position" items={COVER_POSITIONS} value={overlay.position} onChange={(value) => updateOverlay(overlay.id, { position: value })} columns="grid-cols-3" />
                      <div className="mt-3"><Picker title="Alignment" items={COVER_ALIGNMENTS} value={overlay.alignment} onChange={(value) => updateOverlay(overlay.id, { alignment: value })} columns="grid-cols-3" /></div>
                      <RangeControl label="Scale" value={overlay.scale} min={5} max={100} suffix="%" onChange={(value) => updateOverlay(overlay.id, { scale: value })} />
                      <RangeControl label="Margin" value={overlay.margin} min={0} max={20} suffix="%" onChange={(value) => updateOverlay(overlay.id, { margin: value })} />
                      <RangeControl label="Rotation" value={overlay.rotation} min={-180} max={180} suffix="°" onChange={(value) => updateOverlay(overlay.id, { rotation: value })} />
                      <RangeControl label="Opacity" value={overlay.opacity} min={10} max={100} suffix="%" onChange={(value) => updateOverlay(overlay.id, { opacity: value })} />
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={renderExactComposition} disabled={composing || !composeBaseUrl} className="flex w-full items-center justify-center gap-2 rounded-[3px] bg-[#23c7be] py-3.5 font-black text-[#071211] transition hover:bg-[#35d8cf] disabled:opacity-50">
                {composing ? <><Loader2 className="animate-spin" size={18} /> Rendering…</> : <><LayoutTemplate size={18} /> Render exact composition</>}
              </button>
            </>
          )}
        </section>

        <section className="min-h-[600px] rounded-[4px] border border-white/10 bg-[#16181b] p-5 lg:p-6">
          {creationMode === 'compose' ? (
            <>
              <div className="flex min-h-[480px] items-center justify-center rounded-[3px] border border-white/[0.06] bg-[#101214] p-4">
                {composeResultUrl ? (
                  <img src={composeResultUrl} alt="Exact composition" className="max-h-[760px] max-w-full object-contain shadow-2xl" />
                ) : composeBaseUrl ? (
                  <div className="relative max-h-[760px] w-full max-w-[720px] overflow-hidden bg-transparent shadow-2xl" style={{ aspectRatio: previewAspect }}>
                    <img src={composeBaseUrl} alt="Base preview" className="absolute inset-0 h-full w-full object-contain" />
                    {composeOverlays.map((overlay) => {
                      const horizontal = overlay.alignment === 'left' ? `${overlay.margin}%` : overlay.alignment === 'right' ? 'auto' : '50%';
                      const right = overlay.alignment === 'right' ? `${overlay.margin}%` : 'auto';
                      const vertical = overlay.position === 'top' ? `${overlay.margin}%` : overlay.position === 'bottom' ? 'auto' : '50%';
                      const bottom = overlay.position === 'bottom' ? `${overlay.margin}%` : 'auto';
                      const translateX = overlay.alignment === 'center' ? '-50%' : '0';
                      const translateY = overlay.position === 'middle' ? '-50%' : '0';
                      return (
                        <img
                          key={overlay.id}
                          src={overlay.url}
                          alt="Overlay preview"
                          className="absolute max-h-full object-contain"
                          style={{
                            width: `${overlay.scale}%`,
                            left: horizontal,
                            right,
                            top: vertical,
                            bottom,
                            opacity: overlay.opacity / 100,
                            transform: `translate(${translateX}, ${translateY}) rotate(${overlay.rotation}deg)`,
                            transformOrigin: 'center',
                          }}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center text-white/35">
                    <LayoutTemplate size={28} className="mx-auto mb-4" />
                    <p className="font-black text-white/70">Choose a base image</p>
                    <p className="mt-2 text-sm">It will remain unchanged. Overlays are placed on top without AI interpretation.</p>
                  </div>
                )}
              </div>

              {composeResultUrl && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button onClick={() => saveToVault(composeResultUrl, 'Exact composition')} disabled={saving} className="flex items-center justify-center gap-2 rounded-[3px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black transition hover:bg-white/[0.08] disabled:opacity-50">
                    {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />} Save to Vault
                  </button>
                  <button onClick={() => downloadUrl(composeResultUrl, 'exact_composition')} className="flex items-center justify-center gap-2 rounded-[3px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black transition hover:bg-white/[0.08]">
                    <Download size={17} /> Download
                  </button>
                </div>
              )}
            </>
          ) : selectedUrl ? (
            <>
              <div className="flex min-h-[480px] items-center justify-center rounded-[3px] border border-white/[0.06] bg-[#101214] p-4">
                <img src={selectedUrl} alt={purpose === 'image' ? 'Selected image' : 'Selected layout'} className="max-h-[760px] max-w-full object-contain shadow-2xl" />
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button onClick={() => saveToVault()} disabled={saving} className="flex items-center justify-center gap-2 rounded-[3px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black transition hover:bg-white/[0.08] disabled:opacity-50">
                  {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />} Save to Vault
                </button>
                <button onClick={download} className="flex items-center justify-center gap-2 rounded-[3px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black transition hover:bg-white/[0.08]">
                  <Download size={17} /> Download
                </button>
              </div>

              {versions.length > 1 && (
                <div className="mt-5">
                  <Label>Versions</Label>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                    {versions.map((version) => (
                      <button key={version.id} type="button" onClick={() => setSelectedUrl(version.url)} className={`relative aspect-square overflow-hidden rounded-[3px] border-2 bg-black ${selectedUrl === version.url ? 'border-[#23c7be]' : 'border-white/10 hover:border-white/30'}`}>
                        <img src={version.url} alt="" className="h-full w-full object-cover" />
                        {selectedUrl === version.url && <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#23c7be] text-black"><Check size={13} /></span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex min-h-[560px] flex-col items-center justify-center text-center text-white/35">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[4px] border border-white/10 bg-white/[0.03]"><LayoutTemplate size={28} /></div>
              <h2 className="text-xl font-black text-white/75">Your finished layout will appear here</h2>
              <p className="mt-3 max-w-md text-sm font-semibold leading-relaxed">The result is a flattened AI composition, not a conventional text layer.</p>
            </div>
          )}
        </section>
      </div>

      {vaultTarget && (
        <AtelierAssetPicker userEmail={user?.email || ''} onSelect={(url) => addSourceUrl(url, vaultTarget)} onClose={() => setVaultTarget(null)} />
      )}

      {assetShopTarget && (
        <div className="fixed inset-0 z-[130] flex flex-col bg-[#202328] text-white">
          <div className="flex min-h-14 items-center gap-3 border-b border-white/10 bg-[#16181b] px-4 sm:px-6">
            <button type="button" onClick={() => setAssetShopTarget(null)} disabled={assetSelecting} className="flex items-center gap-2 rounded-[3px] border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-black text-white transition hover:bg-white/10 disabled:opacity-40">
              <ArrowLeft size={17} /> Back to Layout
            </button>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#23c7be]">Assets Shop</p>
              <p className="truncate text-xs font-semibold text-white/55">Select an asset to add it to this composition</p>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden"><Catalog embedded onOpenAsset={handleAssetShopSelect} /></div>
          {assetSelecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55">
              <div className="flex items-center gap-3 rounded-[3px] border border-white/10 bg-[#16181b] px-5 py-4 font-black"><Loader2 size={18} className="animate-spin text-[#23c7be]" /> Adding asset to Layout…</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Label({ children }) {
  return <div className="mb-2 text-[11px] font-black uppercase tracking-[.15em] text-white/55">{children}</div>;
}

function Picker({ title, items, value, onChange, columns }) {
  return (
    <div>
      <Label>{title}</Label>
      <div className={`grid ${columns} gap-2`}>
        {items.map((item) => (
          <button key={item.id} type="button" onClick={() => onChange(item.id)} className={`min-h-12 rounded-[3px] border px-2 py-2.5 text-xs font-black transition ${value === item.id ? 'border-[#23c7be] bg-[#23c7be] text-[#071211]' : 'border-white/10 bg-[#24272b] text-white hover:border-white/25'}`}>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RangeControl({ label, value, min, max, suffix, onChange }) {
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-[.12em] text-white/50">
        <span>{label}</span><span>{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-[#23c7be]" />
    </div>
  );
}
