import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Download, Image as ImageIcon, LayoutTemplate, Loader2, Save, Sparkles, Store, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import AtelierAssetPicker from '@/components/atelier/AtelierAssetPicker';
import Catalog from '@/pages/Catalog';
import AssetDetail from '@/pages/AssetDetail';
import { useAiPriceQuote } from '@/hooks/useAiPriceQuote';
import { useAiModelOptions } from '@/hooks/useAiModelOptions';

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
  { id: '2:3', label: '2:3' }, { id: '3:4', label: '3:4' },
  { id: '9:16', label: '9:16' }, { id: '16:9', label: '16:9' },
  { id: '1:1', label: '1:1' },
];

function buildPrompt({ purpose, format, exactText, direction, hasSource, imageMode, imageCount, revision, coverTitle, coverSubtitle, coverAuthor, logoCount, sourceCount }) {
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
    const textInstructions = [
      coverTitle.trim() ? `Main title, exact spelling: <<<${coverTitle.trim()}>>>.` : '',
      coverSubtitle.trim() ? `Subtitle, exact spelling: <<<${coverSubtitle.trim()}>>>.` : '',
      coverAuthor.trim() ? `Author credit, exact spelling: <<<${coverAuthor.trim()}>>>.` : '',
    ].filter(Boolean);

    return [
      `Create a finished publication-ready cover in ${format} format.`,
      sourceCount > 0
        ? `Use the first ${sourceCount} supplied reference image${sourceCount > 1 ? 's' : ''} as visual material for the final composition. Preserve the essential subjects and identity while recomposing them professionally into one coherent cover.`
        : 'Create the complete primary visual from the art direction.',
      logoCount > 0
        ? `The last ${logoCount} supplied reference image${logoCount > 1 ? 's are' : ' is'} logo artwork. Integrate ${logoCount > 1 ? 'these logos' : 'this logo'} cleanly into the cover, preserving the supplied design, proportions and identity. Do not redesign, reinterpret or replace ${logoCount > 1 ? 'them' : 'it'}.`
        : '',
      ...textInstructions,
      textInstructions.length
        ? 'Build a strong editorial hierarchy: the main title must be dominant, the subtitle secondary, and the author credit clearly readable but less prominent. Keep all supplied wording exactly spelled and readable.'
        : 'Do not invent titles, subtitles, author names or other editorial text.',
      'Treat typography and logos as intentional parts of the cover composition, balanced with the imagery and safe from the edges. The result must read immediately as a designed cover, not as a poster mockup or plain text over an image.',
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
      ? `Integrate this exact text with identical spelling and line breaks: <<<${exactText.trim()}>>>.`
      : 'Do not add any words, letters, logos or typographic marks.',
    exactText.trim()
      ? 'Design the lettering as an original graphic element inside the artwork, integrated with its lighting, depth, material and composition. Do not use a conventional font overlay, generic caption, plain white text, interface typography or a text box. Keep every character readable and correctly spelled.'
      : '',
    direction.trim() ? `Art direction: ${direction.trim()}` : '',
    revision.trim() ? `Revision requested from the previous version: ${revision.trim()}` : '',
    'Deliver one complete publication-ready flattened image without mockup borders, editor controls, guides or margins.',
  ].filter(Boolean).join('\n');
}

export default function LayoutTool({ user, onClose }) {
  const [purpose, setPurpose] = useState('cover');
  const [imageMode, setImageMode] = useState('prompt');
  const [format, setFormat] = useState('2:3');
  const [sourceUrls, setSourceUrls] = useState([]);
  const [imageSources, setImageSources] = useState([]);
  const [logoUrls, setLogoUrls] = useState([]);
  const [coverTitle, setCoverTitle] = useState('');
  const [coverSubtitle, setCoverSubtitle] = useState('');
  const [coverAuthor, setCoverAuthor] = useState('');
  const [exactText, setExactText] = useState('');
  const [direction, setDirection] = useState('');
  const [revision, setRevision] = useState('');
  const [versions, setVersions] = useState([]);
  const [selectedUrl, setSelectedUrl] = useState('');
  const [showVault, setShowVault] = useState(false);
  const [pickerTarget, setPickerTarget] = useState('source');
  const [showAssetsShop, setShowAssetsShop] = useState(false);
  const [shopAssetId, setShopAssetId] = useState(null);
  const [uploadTarget, setUploadTarget] = useState('source');
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const fileInputRef = useRef(null);
  const prompt = useMemo(() => buildPrompt({
    purpose, format, exactText, direction, hasSource: sourceUrls.length > 0,
    imageMode, imageCount: imageSources.length, revision,
    coverTitle, coverSubtitle, coverAuthor, logoCount: logoUrls.length, sourceCount: sourceUrls.length,
  }), [purpose, format, exactText, direction, sourceUrls.length, imageMode, imageSources.length, revision, coverTitle, coverSubtitle, coverAuthor, logoUrls.length]);
  const pricingInput = { aspect_ratio: format, prompt };
  const { options: modelOptions, loading: modelsLoading } = useAiModelOptions({
    service: 'replicateGenerate:compose_scene',
    kind: 'image',
    input: pricingInput,
  });
  const effectiveModel = selectedModel || modelOptions.find(m => m.recommended)?.model_key || modelOptions[0]?.model_key || null;
  const { quote: priceQuote, loading: priceLoading } = useAiPriceQuote({
    service: 'replicateGenerate:compose_scene',
    kind: 'image',
    input: pricingInput,
    modelKey: effectiveModel,
  });

  const openVault = (target) => {
    setPickerTarget(target);
    setShowVault(true);
  };

  const startUpload = (target) => {
    setUploadTarget(target);
    fileInputRef.current?.click();
  };

  const handleUploadFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    const maxCount = uploadTarget === 'combine' ? 3 : uploadTarget === 'logo' ? 2 : 4;
    const currentCount = uploadTarget === 'combine' ? imageSources.length : uploadTarget === 'logo' ? logoUrls.length : sourceUrls.length;
    const available = Math.max(0, maxCount - currentCount);
    if (!available) {
      toast.error(`Maximum ${maxCount} ${uploadTarget === 'logo' ? 'logos' : 'source images'}`);
      return;
    }

    setUploading(true);
    try {
      const uploadedUrls = [];
      for (const file of files.slice(0, available)) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          throw new Error('Choose JPG, PNG or WEBP images');
        }
        const result = await base44.integrations.Core.UploadFile({ file, saveToVault: false });
        if (result?.file_url) uploadedUrls.push(result.file_url);
      }
      if (!uploadedUrls.length) throw new Error('Upload did not return an image URL');
      if (uploadTarget === 'combine') {
        setImageSources((current) => [...new Set([...current, ...uploadedUrls])].slice(0, 3));
      } else if (uploadTarget === 'logo') {
        setLogoUrls((current) => [...new Set([...current, ...uploadedUrls])].slice(0, 2));
      } else {
        setSourceUrls((current) => [...new Set([...current, ...uploadedUrls])].slice(0, 4));
      }
      toast.success(uploadedUrls.length === 1 ? 'Image uploaded' : `${uploadedUrls.length} images uploaded`);
    } catch (error) {
      toast.error(error?.message || 'Unable to upload image');
    } finally {
      setUploading(false);
    }
  };

  const openAssetsShop = () => {
    setShopAssetId(null);
    setShowAssetsShop(true);
  };

  const generate = async () => {
    if (purpose === 'image' && imageMode === 'prompt' && !direction.trim()) { toast.error('Describe the image to create'); return; }
    if (purpose === 'image' && imageMode === 'combine' && imageSources.length < 2) { toast.error('Choose at least 2 images to combine'); return; }
    if (purpose !== 'image' && sourceUrls.length === 0 && !direction.trim()) { toast.error('Choose an image or describe the art direction'); return; }
    if (purpose === 'cover' && !coverTitle.trim() && !coverSubtitle.trim() && !coverAuthor.trim() && logoUrls.length === 0 && !direction.trim()) { toast.error('Add cover details or describe the art direction'); return; }
    setGenerating(true);
    try {
      const references = purpose === 'image'
        ? imageMode === 'combine'
          ? [...new Set([...(revision.trim() ? [selectedUrl] : []), ...imageSources].filter(Boolean))].slice(0, 3)
          : [...new Set(revision.trim() ? [selectedUrl].filter(Boolean) : [])]
        : purpose === 'cover'
          ? [...new Set([selectedUrl, ...sourceUrls, ...logoUrls].filter(Boolean))].slice(0, 6)
          : [...new Set([selectedUrl, ...sourceUrls].filter(Boolean))].slice(0, 4);
      const response = await base44.functions.invoke('replicateGenerate', {
        method: 'compose_scene', prompt,
        reference_image_urls: references.length ? references : undefined,
        aspect_ratio: format,
        model_key: effectiveModel || undefined,
      });
      const url = response?.data?.file_url;
      if (!url) throw new Error(response?.data?.error || response?.data?.message || 'Generation failed');
      const version = { id: crypto.randomUUID(), url, prompt };
      setVersions((current) => [version, ...current]);
      setSelectedUrl(url); setRevision(''); toast.success(purpose === 'image' ? 'Image generated' : 'Layout generated');
    } catch (error) { toast.error(error?.message || 'Generation failed'); }
    finally { setGenerating(false); }
  };

  const saveToVault = async () => {
    if (!selectedUrl) return; setSaving(true);
    try {
      await base44.entities.VaultAsset.create({
        user_email: user?.email || '', url: selectedUrl, media_type: 'image',
        name: purpose === 'image' ? (direction.trim().slice(0, 60) || 'Generated image') : purpose === 'cover' ? (coverTitle.trim().slice(0, 60) || 'Generated cover') : (exactText.trim().split('\n')[0]?.slice(0, 60) || `Layout ${purpose}`),
        tags: ['ai-generated', purpose === 'image' ? 'image' : 'layout', purpose], asset_category: 'reference',
        aspect_ratio: format.replace(':', ''),
      });
      toast.success('Layout saved to your Vault');
    } catch (error) { toast.error(error?.message || 'Unable to save to Vault'); }
    finally { setSaving(false); }
  };

  const download = async () => {
    if (!selectedUrl) return;
    try {
      const response = await fetch(selectedUrl); if (!response.ok) throw new Error();
      const href = URL.createObjectURL(await response.blob()); const link = document.createElement('a');
      const fileName = purpose === 'image' ? 'image' : purpose === 'cover' ? (coverTitle.trim().replace(/[^a-z0-9]+/gi, '_') || 'cover') : (exactText.trim().split('\n')[0]?.replace(/[^a-z0-9]+/gi, '_') || 'layout');
      link.href = href; link.download = `${fileName}.png`; link.click(); URL.revokeObjectURL(href);
    } catch { window.open(selectedUrl, '_blank', 'noopener,noreferrer'); toast.info('Open the image to save it'); }
  };

  if (showAssetsShop) {
    return <div className="min-h-screen bg-[#202328] text-white lg:h-[calc(100vh-3.5rem)] lg:min-h-0 lg:overflow-hidden">
      <header className="flex items-center gap-3 border-b border-white/10 bg-[#16181b] px-5 py-4 lg:px-8">
        <button type="button" onClick={() => { setShopAssetId(null); setShowAssetsShop(false); }} className="flex h-10 w-10 items-center justify-center rounded-[3px] border border-white/10 bg-white/[0.04] text-white/65 transition hover:bg-white/10 hover:text-white"><ArrowLeft size={19} /></button>
        <div>
          <p className="text-[9px] font-black uppercase tracking-[.24em] text-[#23c7be]">Layout</p>
          <h1 className="text-2xl font-black tracking-tight">Assets Shop</h1>
        </div>
      </header>
      {shopAssetId
        ? <AssetDetail assetId={shopAssetId} embedded onBack={() => setShopAssetId(null)} />
        : <Catalog embedded onOpenAsset={setShopAssetId} />}
    </div>;
  }

  return <div className="min-h-screen bg-[#202328] px-5 pb-24 pt-6 text-white lg:h-[calc(100vh-3.5rem)] lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:px-8">
    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleUploadFiles} />
    <header className="mx-auto mb-5 flex max-w-[1500px] items-center gap-3 border-b border-white/10 pb-5">
      <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-[3px] border border-white/10 bg-white/[0.04] text-white/65 transition hover:bg-white/10 hover:text-white"><ArrowLeft size={19} /></button>
      <div>
        <p className="text-[9px] font-black uppercase tracking-[.24em] text-[#23c7be]">AI Production Tool</p>
        <h1 className="text-3xl font-black tracking-tight lg:text-4xl">Layout</h1>
      </div>
    </header>

    <div className="mx-auto grid max-w-[1500px] gap-5 xl:grid-cols-[430px_minmax(0,1fr)]">
      <section className="space-y-5 rounded-[4px] border border-white/10 bg-[#16181b] p-5 lg:p-6">
        <div>
          <Label>AI Model</Label>
          <select value={effectiveModel || ''} onChange={(e) => setSelectedModel(e.target.value || null)} disabled={modelsLoading || modelOptions.length === 0} className="w-full rounded-[3px] border border-white/10 bg-[#26292d] px-3 py-3 text-sm font-bold text-white outline-none transition focus:border-[#23c7be]/60 disabled:opacity-50">
            {modelsLoading && <option value="">Loading models…</option>}
            {!modelsLoading && modelOptions.length === 0 && <option value="">No model available</option>}
            {modelOptions.map((m) => <option key={m.model_key} value={m.model_key}>{m.name || m.model_key}{m.recommended ? ' — Recommended' : ''}{m.credits ? ` — ${m.credits} credits` : ''}</option>)}
          </select>
        </div>

        <Picker title="Usage" items={PURPOSES} value={purpose} onChange={setPurpose} columns="grid-cols-2 sm:grid-cols-4" />
        <Picker title="Format" items={FORMATS} value={format} onChange={setFormat} columns="grid-cols-5" />

        {purpose === 'image' ? <>
          <Picker title="Image creation" items={IMAGE_MODES} value={imageMode} onChange={setImageMode} columns="grid-cols-2" />
          {imageMode === 'combine' && <div><Label>Images to combine · 2 to 3</Label><div className="grid grid-cols-3 gap-2">{imageSources.map((url, index) => <div key={url} className="relative aspect-square overflow-hidden rounded-[3px] border border-white/15 bg-white/5"><img src={url} alt={`Source ${index + 1}`} className="h-full w-full object-cover" /><button onClick={() => setImageSources((current) => current.filter((item) => item !== url))} className="absolute right-1 top-1 rounded-[3px] bg-black/80 px-2 py-1 text-[10px] font-black text-red-300">Remove</button></div>)}{imageSources.length < 3 && <button onClick={() => openVault('combine')} className="flex aspect-square items-center justify-center rounded-[3px] border border-dashed border-[#23c7be]/55 bg-[#23c7be]/[0.04] p-2 text-center text-xs font-black text-[#23c7be]"><span><ImageIcon size={20} className="mx-auto mb-2" />Add image</span></button>}</div><div className="mt-2 grid grid-cols-2 gap-2"><button onClick={() => startUpload('combine')} disabled={uploading} className="flex items-center justify-center gap-2 rounded-[3px] border border-white/10 bg-white/[0.04] py-2.5 text-xs font-black text-white hover:bg-white/10 disabled:opacity-50"><Upload size={15} />{uploading && uploadTarget === 'combine' ? 'Uploading…' : 'Upload'}</button><button onClick={openAssetsShop} className="flex items-center justify-center gap-2 rounded-[3px] border border-white/10 bg-white/[0.04] py-2.5 text-xs font-black text-white hover:bg-white/10"><Store size={15} />Assets Shop</button></div></div>}
        </> : <div><Label>Source images</Label><div className="grid grid-cols-3 gap-2">{sourceUrls.map((url, index) => <div key={url} className="relative aspect-square overflow-hidden rounded-[3px] border border-white/15 bg-white/5"><img src={url} alt={`Source ${index + 1}`} className="h-full w-full object-cover" /><button onClick={() => setSourceUrls((current) => current.filter((item) => item !== url))} className="absolute right-1 top-1 rounded-[3px] bg-black/80 px-2 py-1 text-[10px] font-black text-red-300">Remove</button></div>)}{sourceUrls.length < 4 && <button onClick={() => openVault('source')} className="flex aspect-square items-center justify-center rounded-[3px] border border-dashed border-[#23c7be]/55 bg-[#23c7be]/[0.04] p-2 text-center text-xs font-black text-[#23c7be]"><span><ImageIcon size={20} className="mx-auto mb-2" />Add image</span></button>}</div><div className="mt-2 grid grid-cols-2 gap-2"><button onClick={() => startUpload('source')} disabled={uploading} className="flex items-center justify-center gap-2 rounded-[3px] border border-white/10 bg-white/[0.04] py-2.5 text-xs font-black text-white hover:bg-white/10 disabled:opacity-50"><Upload size={15} />{uploading && uploadTarget === 'source' ? 'Uploading…' : 'Upload'}</button><button onClick={openAssetsShop} className="flex items-center justify-center gap-2 rounded-[3px] border border-white/10 bg-white/[0.04] py-2.5 text-xs font-black text-white hover:bg-white/10"><Store size={15} />Assets Shop</button></div></div>}

        {purpose === 'cover' && <div className="space-y-4 rounded-[3px] border border-[#23c7be]/25 bg-[#23c7be]/[0.035] p-4">
          <div><Label>Cover title</Label><input value={coverTitle} onChange={(event) => setCoverTitle(event.target.value)} placeholder="Main title" className="w-full rounded-[3px] border border-white/10 bg-[#26292d] px-3 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/25 focus:border-[#23c7be]/60" /></div>
          <div><Label>Subtitle</Label><input value={coverSubtitle} onChange={(event) => setCoverSubtitle(event.target.value)} placeholder="Optional subtitle" className="w-full rounded-[3px] border border-white/10 bg-[#26292d] px-3 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/25 focus:border-[#23c7be]/60" /></div>
          <div><Label>Author</Label><input value={coverAuthor} onChange={(event) => setCoverAuthor(event.target.value)} placeholder="Author or creator" className="w-full rounded-[3px] border border-white/10 bg-[#26292d] px-3 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/25 focus:border-[#23c7be]/60" /></div>
          <div><Label>Logos · up to 2</Label><div className="grid grid-cols-3 gap-2">{logoUrls.map((url, index) => <div key={url} className="relative aspect-square overflow-hidden rounded-[3px] border border-white/15 bg-white/5 p-2"><img src={url} alt={`Logo ${index + 1}`} className="h-full w-full object-contain" /><button onClick={() => setLogoUrls((current) => current.filter((item) => item !== url))} className="absolute right-1 top-1 rounded-[3px] bg-black/80 px-2 py-1 text-[10px] font-black text-red-300">Remove</button></div>)}{logoUrls.length < 2 && <button onClick={() => openVault('logo')} className="flex aspect-square items-center justify-center rounded-[3px] border border-dashed border-[#23c7be]/55 bg-[#23c7be]/[0.04] p-2 text-center text-xs font-black text-[#23c7be]"><span><ImageIcon size={20} className="mx-auto mb-2" />Add logo</span></button>}</div><button onClick={() => startUpload('logo')} disabled={uploading || logoUrls.length >= 2} className="mt-2 flex w-full items-center justify-center gap-2 rounded-[3px] border border-white/10 bg-white/[0.04] py-2.5 text-xs font-black text-white hover:bg-white/10 disabled:opacity-50"><Upload size={15} />{uploading && uploadTarget === 'logo' ? 'Uploading…' : 'Upload logo'}</button></div>
        </div>}

        {purpose !== 'image' && purpose !== 'cover' && <div><Label>Exact text</Label><textarea value={exactText} onChange={(event) => setExactText(event.target.value)} rows={3} placeholder="Write the exact words and line breaks" className="w-full resize-none rounded-[3px] border border-white/10 bg-[#26292d] p-3 text-sm font-semibold text-white outline-none placeholder:text-white/25 focus:border-[#23c7be]/60" /></div>}
        <div><Label>{purpose === 'image' ? 'Image prompt' : 'Art direction'}</Label><textarea value={direction} onChange={(event) => setDirection(event.target.value)} rows={5} placeholder={purpose === 'image' ? 'Describe the image to create, its subjects, setting, style, light and composition' : purpose === 'cover' ? 'Describe the cover style, visual hierarchy, mood, typography character, light and composition' : 'Describe the visual world, materials, lettering character, light and composition'} className="w-full resize-none rounded-[3px] border border-white/10 bg-[#26292d] p-3 text-sm font-semibold text-white outline-none placeholder:text-white/25 focus:border-[#23c7be]/60" /></div>
        {selectedUrl && <div><Label>Change this version</Label><textarea value={revision} onChange={(event) => setRevision(event.target.value)} rows={2} placeholder="Describe only what must change" className="w-full resize-none rounded-[3px] border border-white/10 bg-[#26292d] p-3 text-sm font-semibold text-white outline-none placeholder:text-white/25 focus:border-[#23c7be]/60" /></div>}

        <button onClick={generate} disabled={generating} className="flex w-full items-center justify-center gap-2 rounded-[3px] bg-[#23c7be] py-3.5 font-black text-[#071211] transition hover:bg-[#35d8cf] disabled:opacity-50">{generating ? <><Loader2 className="animate-spin" size={18} /> Generating…</> : <><Sparkles size={18} /> {selectedUrl ? 'Generate a new version' : purpose === 'image' ? 'Generate image' : 'Generate layout'}{priceLoading ? ' · calculating…' : priceQuote?.credits ? ` · ${priceQuote.credits} credits` : ''}</>}</button>
      </section>

      <section className="min-h-[600px] rounded-[4px] border border-white/10 bg-[#16181b] p-5 lg:p-6">
        {selectedUrl ? <>
          <div className="flex min-h-[480px] items-center justify-center rounded-[3px] border border-white/[0.06] bg-[#101214] p-4"><img src={selectedUrl} alt={purpose === 'image' ? 'Selected image' : 'Selected layout'} className="max-h-[760px] max-w-full object-contain shadow-2xl" /></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2"><button onClick={saveToVault} disabled={saving} className="flex items-center justify-center gap-2 rounded-[3px] bg-[#23c7be] py-3 text-sm font-black text-[#071211]">{saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save to Vault</button><button onClick={download} className="flex items-center justify-center gap-2 rounded-[3px] border border-white/10 bg-white/[0.04] py-3 text-sm font-black text-white hover:bg-white/10"><Download size={16} /> Download PNG</button></div>
        </> : <div className="flex min-h-[560px] flex-col items-center justify-center text-center text-white/30"><div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[3px] border border-white/10 bg-white/[0.03]"><LayoutTemplate size={27} /></div><p className="text-lg font-black text-white/65">Your finished {purpose === 'image' ? 'image' : 'layout'} will appear here</p>{purpose !== 'image' && <p className="mt-2 max-w-sm text-sm font-medium text-white/35">The result is a flattened AI composition, not a conventional text layer.</p>}</div>}

        {versions.length > 1 && <div className="mt-6"><Label>Versions</Label><div className="grid grid-cols-4 gap-2 sm:grid-cols-6">{versions.map((version) => <button key={version.id} onClick={() => setSelectedUrl(version.url)} className={`relative aspect-square overflow-hidden rounded-[3px] border ${selectedUrl === version.url ? 'border-[#23c7be]' : 'border-white/10'}`}><img src={version.url} alt="" className="h-full w-full object-cover" />{selectedUrl === version.url && <span className="absolute right-1 top-1 rounded-[3px] bg-[#23c7be] p-1 text-[#071211]"><Check size={10} /></span>}</button>)}</div></div>}
      </section>
    </div>

    {showVault && <AtelierAssetPicker userEmail={user?.email} onSelect={(url) => {
      if (pickerTarget === 'combine') setImageSources((current) => [...new Set([...current, url])].slice(0, 3));
      else if (pickerTarget === 'logo') setLogoUrls((current) => [...new Set([...current, url])].slice(0, 2));
      else setSourceUrls((current) => [...new Set([...current, url])].slice(0, 4));
      setShowVault(false);
    }} onClose={() => setShowVault(false)} />}
  </div>;
}

function Label({ children }) { return <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/45">{children}</p>; }
function Picker({ title, items, value, onChange, columns }) {
  return <div><Label>{title}</Label><div className={`grid gap-2 ${columns}`}>{items.map((item) => <button key={item.id} onClick={() => onChange(item.id)} className={`rounded-[3px] border px-2 py-3 text-xs font-black transition ${value === item.id ? 'border-[#23c7be] bg-[#23c7be] text-[#071211]' : 'border-white/10 bg-white/[0.04] text-white hover:bg-white/10'}`}>{item.label}</button>)}</div></div>;
}
