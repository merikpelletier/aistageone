import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, Download, Image as ImageIcon, LayoutTemplate, Loader2, Save, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import AtelierAssetPicker from '@/components/atelier/AtelierAssetPicker';

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

function buildPrompt({ purpose, format, exactText, direction, hasSource, imageMode, imageCount, revision }) {
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
  const [sourceUrl, setSourceUrl] = useState('');
  const [imageSources, setImageSources] = useState([]);
  const [exactText, setExactText] = useState('');
  const [direction, setDirection] = useState('');
  const [revision, setRevision] = useState('');
  const [versions, setVersions] = useState([]);
  const [selectedUrl, setSelectedUrl] = useState('');
  const [showVault, setShowVault] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const prompt = useMemo(() => buildPrompt({
    purpose, format, exactText, direction, hasSource: !!sourceUrl,
    imageMode, imageCount: imageSources.length, revision,
  }), [purpose, format, exactText, direction, sourceUrl, imageMode, imageSources.length, revision]);

  const generate = async () => {
    if (purpose === 'image' && imageMode === 'prompt' && !direction.trim()) { toast.error('Describe the image to create'); return; }
    if (purpose === 'image' && imageMode === 'combine' && imageSources.length < 2) { toast.error('Choose at least 2 images to combine'); return; }
    if (purpose !== 'image' && !sourceUrl && !direction.trim()) { toast.error('Choose an image or describe the art direction'); return; }
    setGenerating(true);
    try {
      const references = purpose === 'image'
        ? imageMode === 'combine'
          ? [...new Set([...(revision.trim() ? [selectedUrl] : []), ...imageSources].filter(Boolean))].slice(0, 3)
          : [...new Set(revision.trim() ? [selectedUrl].filter(Boolean) : [])]
        : [...new Set([selectedUrl, sourceUrl].filter(Boolean))].slice(0, 2);
      const response = await base44.functions.invoke('replicateGenerate', {
        method: 'compose_scene', prompt,
        reference_image_urls: references.length ? references : undefined,
        aspect_ratio: format,
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
        name: purpose === 'image' ? (direction.trim().slice(0, 60) || 'Generated image') : (exactText.trim().split('\n')[0]?.slice(0, 60) || `Layout ${purpose}`),
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
      const fileName = purpose === 'image' ? 'image' : (exactText.trim().split('\n')[0]?.replace(/[^a-z0-9]+/gi, '_') || 'layout');
      link.href = href; link.download = `${fileName}.png`; link.click(); URL.revokeObjectURL(href);
    } catch { window.open(selectedUrl, '_blank', 'noopener,noreferrer'); toast.info('Open the image to save it'); }
  };

  return <div className="min-h-screen bg-zinc-900 px-5 pb-24 pt-10 text-white lg:px-10">
    <header className="mx-auto mb-8 flex max-w-[1500px] items-center gap-3">
      <button onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black text-yellow-400"><ArrowLeft size={20} /></button>
      <div><p className="text-xs font-black uppercase tracking-[.22em] text-yellow-400">AI production tool</p><h1 className="text-3xl font-black lg:text-5xl">Layout</h1></div>
    </header>
    <div className="mx-auto grid max-w-[1500px] gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
      <section className="space-y-5 rounded-[2rem] bg-black p-5 lg:p-7">
        <Picker title="Usage" items={PURPOSES} value={purpose} onChange={setPurpose} columns="grid-cols-2 sm:grid-cols-4" />
        <Picker title="Format" items={FORMATS} value={format} onChange={setFormat} columns="grid-cols-5" />
        {purpose === 'image' ? <>
          <Picker title="Image creation" items={IMAGE_MODES} value={imageMode} onChange={setImageMode} columns="grid-cols-2" />
          {imageMode === 'combine' && <div><Label>Images to combine · 2 to 3</Label><div className="grid grid-cols-3 gap-2">{imageSources.map((url, index) => <div key={url} className="relative aspect-square overflow-hidden rounded-xl border border-white/15 bg-white/5"><img src={url} alt={`Source ${index + 1}`} className="h-full w-full object-cover" /><button onClick={() => setImageSources((current) => current.filter((item) => item !== url))} className="absolute right-1 top-1 rounded-full bg-black/80 px-2 py-1 text-[10px] font-black text-red-400">Remove</button></div>)}{imageSources.length < 3 && <button onClick={() => setShowVault(true)} className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-yellow-400/60 bg-white/5 p-2 text-center text-xs font-black text-yellow-400"><span><ImageIcon size={20} className="mx-auto mb-2" />Add image</span></button>}</div></div>}
        </> : <div><Label>Source image</Label><button onClick={() => setShowVault(true)} className="flex min-h-36 w-full items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/5">{sourceUrl ? <img src={sourceUrl} alt="Source" className="max-h-64 w-full object-contain" /> : <span className="flex items-center gap-2 text-sm font-black text-yellow-400"><ImageIcon size={18} /> Choose from Vault</span>}</button>{sourceUrl && <button onClick={() => setSourceUrl('')} className="mt-2 text-xs font-bold text-red-400">Remove source image</button>}</div>}
        {purpose !== 'image' && <div><Label>Exact text</Label><textarea value={exactText} onChange={(event) => setExactText(event.target.value)} rows={3} placeholder="Write the exact words and line breaks" className="w-full rounded-2xl bg-white p-3 text-sm font-bold text-black" /></div>}
        <div><Label>{purpose === 'image' ? 'Image prompt' : 'Art direction'}</Label><textarea value={direction} onChange={(event) => setDirection(event.target.value)} rows={5} placeholder={purpose === 'image' ? 'Describe the image to create, its subjects, setting, style, light and composition' : 'Describe the visual world, materials, lettering character, light and composition'} className="w-full rounded-2xl bg-white p-3 text-sm font-semibold text-black" /></div>
        {selectedUrl && <div><Label>Change this version</Label><textarea value={revision} onChange={(event) => setRevision(event.target.value)} rows={2} placeholder="Describe only what must change" className="w-full rounded-2xl bg-white p-3 text-sm font-semibold text-black" /></div>}
        <button onClick={generate} disabled={generating} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-yellow-400 py-4 font-black text-black disabled:opacity-50">{generating ? <><Loader2 className="animate-spin" size={18} /> Generating…</> : <><Sparkles size={18} /> {selectedUrl ? 'Generate a new version' : purpose === 'image' ? 'Generate image' : 'Generate layout'}</>}</button>
      </section>
      <section className="min-h-[600px] rounded-[2rem] bg-black/50 p-5 lg:p-7">
        {selectedUrl ? <><div className="flex min-h-[480px] items-center justify-center"><img src={selectedUrl} alt={purpose === 'image' ? 'Selected image' : 'Selected layout'} className="max-h-[760px] max-w-full rounded-2xl object-contain shadow-2xl" /></div><div className="mt-5 grid gap-2 sm:grid-cols-2"><button onClick={saveToVault} disabled={saving} className="flex items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-sm font-black text-black">{saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save to Vault</button><button onClick={download} className="flex items-center justify-center gap-2 rounded-xl bg-white/10 py-3 text-sm font-black"><Download size={16} /> Download PNG</button></div></> : <div className="flex min-h-[560px] flex-col items-center justify-center text-center text-white/35"><LayoutTemplate size={48} /><p className="mt-4 text-lg font-black text-white/60">Your finished {purpose === 'image' ? 'image' : 'layout'} will appear here</p>{purpose !== 'image' && <p className="mt-2 max-w-sm text-sm font-semibold">The result is a flattened AI composition, not a conventional text layer.</p>}</div>}
        {versions.length > 1 && <div className="mt-6"><Label>Versions</Label><div className="grid grid-cols-4 gap-2 sm:grid-cols-6">{versions.map((version) => <button key={version.id} onClick={() => setSelectedUrl(version.url)} className={`relative aspect-square overflow-hidden rounded-xl border-2 ${selectedUrl === version.url ? 'border-yellow-400' : 'border-transparent'}`}><img src={version.url} alt="" className="h-full w-full object-cover" />{selectedUrl === version.url && <span className="absolute right-1 top-1 rounded-full bg-yellow-400 p-1 text-black"><Check size={10} /></span>}</button>)}</div></div>}
      </section>
    </div>
    {showVault && <AtelierAssetPicker userEmail={user?.email} onSelect={(url) => { if (purpose === 'image' && imageMode === 'combine') setImageSources((current) => [...new Set([...current, url])].slice(0, 3)); else setSourceUrl(url); setShowVault(false); }} onClose={() => setShowVault(false)} />}
  </div>;
}

function Label({ children }) { return <p className="mb-2 text-xs font-black uppercase tracking-widest text-white/45">{children}</p>; }
function Picker({ title, items, value, onChange, columns }) {
  return <div><Label>{title}</Label><div className={`grid gap-2 ${columns}`}>{items.map((item) => <button key={item.id} onClick={() => onChange(item.id)} className={`rounded-xl px-2 py-3 text-xs font-black ${value === item.id ? 'bg-yellow-400 text-black' : 'bg-white/10'}`}>{item.label}</button>)}</div></div>;
}
