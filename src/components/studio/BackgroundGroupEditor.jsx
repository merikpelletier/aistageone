import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Upload, WandSparkles, RotateCcw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAiModelOptions } from '@/hooks/useAiModelOptions';
import { useAiPriceQuote } from '@/hooks/useAiPriceQuote';
import { toast } from 'sonner';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';

const IDS = ['BG-01', 'BG-02', 'BG-03', 'BG-04', 'BG-05', 'BG-06'];
const GROUP_META_TAG = 'background-group-data:';
const decodeGroup = asset => {
  try {
    const entry = Array.isArray(asset?.style_tags) && asset.style_tags.find(tag => typeof tag === 'string' && tag.startsWith(GROUP_META_TAG));
    return entry ? JSON.parse(decodeURIComponent(entry.slice(GROUP_META_TAG.length))) : {};
  } catch { return {}; }
};
const THEMES = [
  ['hotel', 'Luxury hotel guests', 'Elegant hotel guests, varied adult ages and appearances, polished upscale wardrobes; understated, believable extras.'],
  ['press', 'Press and media', 'Professional journalists, photographers and editors; smart practical clothing with discreet media accessories.'],
  ['fashion', 'Fashion event audience', 'Stylish fashion-industry guests with distinct, sophisticated looks and tasteful variety.'],
  ['restaurant', 'Restaurant patrons', 'Restaurant guests in refined day and evening outfits, natural age and style variation.'],
  ['staff', 'Hotel and event staff', 'Uniformed hospitality workers, believable coordinated workwear with distinct identities.'],
  ['custom', 'Custom theme', ''],
];

// Approved six-figure sheet: fixed front-facing poses, BG-01 through BG-06.
const TEMPLATE_PREVIEW = '/actor-guides/background-six-template.webp';
const toTemplateFile = async () => {
  const response = await fetch(TEMPLATE_PREVIEW);
  if (!response.ok) throw new Error('Approved background template could not be loaded.');
  const blob = await response.blob();
  return new File([blob], 'background-six-template.webp', { type: 'image/webp' });
};

export default function BackgroundGroupEditor({ userEmail, onClose }) {
  const queryClient = useQueryClient();
  const [loadedAsset, setLoadedAsset] = useState(null);
  const saved = decodeGroup(loadedAsset);
  const { data: savedGroups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['actor-background-groups', userEmail],
    enabled: Boolean(userEmail),
    queryFn: async () => {
      const assets = await base44.entities.VaultAsset.filter({ user_email: userEmail }, '-created_date', null);
      return (assets || []).filter(asset => asset.asset_category === 'background_group');
    },
  });
  const [name, setName] = useState('');
  const [theme, setTheme] = useState('hotel');
  const [themePrompt, setThemePrompt] = useState(THEMES[0][2]);
  const [directions, setDirections] = useState(Object.fromEntries(IDS.map(id => [id, ''])));
  const [selected, setSelected] = useState(IDS);
  const [sourceMode, setSourceMode] = useState('current');
  const [templateUrl, setTemplateUrl] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showVaultSave, setShowVaultSave] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const activeUrl = sourceMode === 'original' ? (originalUrl || templateUrl) : (currentUrl || originalUrl || templateUrl);
  const preview = activeUrl || TEMPLATE_PREVIEW;
  const prompt = useMemo(() => {
    const targets = selected.filter(id => IDS.includes(id));
    const lines = IDS.map(id => `${id}: ${targets.includes(id) ? (directions[id]?.trim() || 'Follow the overall theme; make this person visually distinct from the others.') : 'DO NOT CHANGE this character. Preserve appearance, wardrobe, age and color exactly as shown.'}`);
    return `BACKGROUND GROUP SHEET TRANSFORMATION — STRICT GRID CONTROL.
INPUT: ONE reference sheet with six numbered figures, arranged in 2 rows x 3 columns.
Output ONE 4:3 image with the EXACT same panel geometry, same dividing lines and labels: BG-01, BG-02, BG-03 on the top row; BG-04, BG-05, BG-06 below.
One complete standing person per panel, viewed strictly from the front, with relaxed arms at the sides and feet slightly apart. Keep every head, hand and foot fully visible. Fixed framing and scale, neutral white studio backgrounds. NO interaction or overlapping between panels; no scene, no extra people, no text beyond the six correct IDs.
OVERALL THEME: ${themePrompt.trim() || 'Varied believable background actors'}.
MODE: ${targets.length === 6 ? 'Transform all six figures.' : `Change ONLY ${targets.join(', ')}. All other numbered panels MUST stay visually unchanged.`}
CHARACTER-BY-CHARACTER DIRECTIONS:
${lines.join('\n')}
A panel number is a positional reference, not a name to display on clothing. No changes to panel positions or layout. Keep all unchanged cells visually identical. Do not turn this into a collage or a group portrait.`;
  }, [selected, directions, themePrompt]);
  const { options: models = [], loading: modelsLoading } = useAiModelOptions({
    service: 'generateCharacterSheet', kind: 'image', input: { aspect_ratio: '4:3', prompt },
  });
  const modelKey = selectedModel || models.find(model => model.recommended)?.model_key || models[0]?.model_key || null;
  const { quote, loading: quoteLoading } = useAiPriceQuote({
    service: 'generateCharacterSheet', kind: 'image', input: { aspect_ratio: '4:3', prompt }, modelKey,
  });
  const upload = async file => {
    const response = await base44.integrations.Core.UploadFile({ file });
    if (!response?.file_url) throw new Error('Image upload failed');
    return response.file_url;
  };
  const ensureTemplate = async () => {
    if (templateUrl) return templateUrl;
    const url = await upload(await toTemplateFile());
    setTemplateUrl(url);
    setOriginalUrl(url);
    return url;
  };
  const generate = async () => {
    if (!selected.length) return toast.error('Select at least one BG number.');
    if (!modelKey) return toast.error('Select an image model first.');
    setGenerating(true);
    try {
      const baseUrl = sourceMode === 'original' ? (originalUrl || await ensureTemplate()) : (currentUrl || originalUrl || await ensureTemplate());
      const result = await base44.functions.invoke('generateCharacterSheet', {
        source_mode: 'sheet', reference_sheet_url: baseUrl,
        image_urls: [baseUrl], angle_urls: [], look_reference_urls: [],
        aspect_ratio: '4:3', prompt_override: prompt, replace_preset: true,
        model_key: modelKey,
      });
      if (!result?.data?.file_url) throw new Error(result?.data?.error || 'Generation returned no image');
      setCurrentUrl(result.data.file_url);
      setSourceMode('current');
      toast.success('Background sheet generated. The result is now the active source.');
    } catch (error) {
      console.error('Background group generation failed', error);
      toast.error(error.message || 'Could not generate the group');
    } finally { setGenerating(false); }
  };
  const backgroundMetadata = () => ({
    version: 1, theme, theme_prompt: themePrompt, directions, selected,
    template_url: templateUrl, original_url: originalUrl || templateUrl,
    current_url: currentUrl, ids: IDS, layout: '2x3',
  });
  const save = () => {
    if (!name.trim()) return toast.error('Name this background group.');
    if (!currentUrl) return toast.error('Generate the background group first.');
    setShowVaultSave(true);
  };
  const handleVaultSaved = async asset => {
    setSaving(true);
    try {
      await base44.entities.VaultAsset.update(asset.id, {
        asset_category: 'background_group',
        actor_name: name.trim(),
        tags: ['Background Group', THEMES.find(t => t[0] === theme)?.[1] || 'Custom', ...IDS],
        style_tags: [GROUP_META_TAG + encodeURIComponent(JSON.stringify(backgroundMetadata()))],
        aspect_ratio: '4:3',
      });
      setLoadedAsset({ ...asset, asset_category: 'background_group' });
      await queryClient.invalidateQueries({ queryKey: ['actor-background-groups', userEmail] });
      await queryClient.invalidateQueries({ queryKey: ['vaultAssets', userEmail] });
      await queryClient.invalidateQueries({ queryKey: ['vaultAssetsForCharacterDesigner', userEmail] });
      setShowVaultSave(false);
      toast.success('Background Group saved in your Vault folder.');
    } catch (error) {
      console.error('Background group Vault metadata save failed', error);
      toast.error('Image saved, but group details could not be finalized. Please check My Vault.');
    } finally { setSaving(false); }
  };
  const loadGroup = asset => {
    const record = decodeGroup(asset);
    setLoadedAsset(asset);
    setName(asset.name || '');
    setTheme(record.theme || 'custom');
    setThemePrompt(record.theme_prompt || '');
    setDirections(record.directions || Object.fromEntries(IDS.map(id => [id, ''])));
    setSelected(record.selected || IDS);
    setTemplateUrl(record.template_url || '');
    setOriginalUrl(record.original_url || record.template_url || '');
    setCurrentUrl(record.current_url || asset.url || '');
    setSourceMode('current');
    toast.success('Background Group loaded from My Vault.');
  };
  const fieldClass = 'w-full border border-white/15 bg-black/30 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300';
  return <div className="min-h-screen bg-[#202328] px-4 py-5 pb-24 text-white sm:px-7">
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs font-black uppercase tracking-widest text-cyan-300">Actor · Background Group</p>
          <h2 className="mt-1 text-2xl font-black">Six-actor reference sheet</h2>
          <p className="mt-1 text-sm text-white/55">One fixed 2×3 grid. Generate groups by theme, then refine individual numbered figures.</p></div>
        <button type="button" onClick={onClose} className="flex items-center gap-2 border border-white/20 px-3 py-2 text-xs font-bold"><ArrowLeft size={15}/>BACK TO ACTOR</button>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <div className="space-y-3">
          <div className="border border-white/15 bg-[#141619] p-3">
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-cyan-200">My Vault · Background Groups</p>
            {groupsLoading ? <p className="text-xs text-white/50">Loading your groups...</p> : savedGroups.length ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {savedGroups.map(asset => <button key={asset.id} type="button" onClick={() => loadGroup(asset)}
                  className="border border-white/15 bg-black/25 p-2 text-left hover:border-cyan-300/50">
                  <img src={asset.url} alt="" className="aspect-[4/3] w-full bg-white object-contain" />
                  <p className="mt-1 truncate text-xs font-bold text-white">{asset.name}</p>
                </button>)}
              </div>
            ) : <p className="text-xs text-white/50">No saved groups yet. Generate one and save it in a Vault folder.</p>}
          </div>
          <img src={preview} alt="Six numbered background actor template or generated sheet" className="w-full border border-white/15 bg-white object-contain" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setSourceMode('original')} className={`border px-3 py-2 text-xs font-bold ${sourceMode === 'original' ? 'border-cyan-300 text-cyan-300' : 'border-white/20'}`}>USE ORIGINAL TEMPLATE</button>
            <button type="button" onClick={() => setSourceMode('current')} className={`border px-3 py-2 text-xs font-bold ${sourceMode === 'current' ? 'border-cyan-300 text-cyan-300' : 'border-white/20'}`}>USE CURRENT SHEET</button>
            <label className="flex cursor-pointer items-center gap-2 border border-white/20 px-3 py-2 text-xs font-bold"><Upload size={14}/>UPLOAD TEMPLATE
              <input type="file" accept="image/*" className="hidden" disabled={uploading || generating} onChange={async e => {
                const file = e.target.files?.[0]; if (!file) return;
                setUploading(true);
                try { const url = await upload(file); setTemplateUrl(url); setOriginalUrl(url); setCurrentUrl(''); setSourceMode('original'); }
                catch (error) { toast.error(error.message || 'Upload failed'); }
                finally { setUploading(false); e.target.value = ''; }
              }}/></label>
          </div>
          <p className="text-xs text-white/50">{sourceMode === 'original' ? 'The original neutral template will be used for the next generation.' : 'The latest generated sheet automatically becomes the source of the next generation.'}</p>
        </div>
        <div className="space-y-4">
          <label className="block text-xs font-black uppercase tracking-wide text-white/60">Group name
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Hotel Lobby — Guests A" className={`mt-2 ${fieldClass}`}/></label>
          <label className="block text-xs font-black uppercase tracking-wide text-white/60">Theme
            <select value={theme} onChange={e => { const v = THEMES.find(t => t[0] === e.target.value); setTheme(v[0]); setThemePrompt(v[2]); }} className={`mt-2 ${fieldClass}`}>
              {THEMES.map(t => <option key={t[0]} value={t[0]}>{t[1]}</option>)}
            </select></label>
          <label className="block text-xs font-black uppercase tracking-wide text-white/60">Overall theme prompt
            <textarea rows={3} value={themePrompt} onChange={e => setThemePrompt(e.target.value)} className={`mt-2 ${fieldClass}`}/></label>
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-white/60">Figures to transform</p>
            <div className="grid grid-cols-3 gap-2">
              {IDS.map(id => <label key={id} className={`cursor-pointer border px-3 py-2 text-center text-xs font-black ${selected.includes(id) ? 'border-cyan-300 bg-cyan-300/10 text-cyan-200' : 'border-white/15 text-white/40'}`}>
                <input type="checkbox" className="mr-1" checked={selected.includes(id)} onChange={e => setSelected(current => e.target.checked ? [...current, id] : current.filter(v => v !== id))}/>{id}
              </label>)}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {IDS.map(id => <label key={id} className="block text-xs font-black text-cyan-300">{id} · specific direction
              <textarea rows={2} value={directions[id] || ''} disabled={!selected.includes(id)} onChange={e => setDirections(current => ({ ...current, [id]: e.target.value }))}
                placeholder="Appearance, age, wardrobe, details..." className={`mt-1 ${fieldClass} disabled:opacity-30`}/></label>)}
          </div>
          <p className="text-xs text-white/50">Unselected figures are instructed to remain unchanged. AI consistency is best-effort, especially when editing an entire sheet.</p>
          <label className="block text-xs font-bold">AI model
            <select value={modelKey || ''} onChange={e => setSelectedModel(e.target.value || null)} disabled={modelsLoading} className={`mt-1 ${fieldClass}`}>
              {modelsLoading && <option value="">Loading models...</option>}
              {!modelsLoading && !models.length && <option value="">No image model enabled</option>}
              {models.map(m => <option key={m.model_key} value={m.model_key}>{m.name || m.model_key}</option>)}
            </select></label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={generate} disabled={generating || !modelKey || uploading} className="flex items-center gap-2 bg-cyan-300 px-4 py-3 text-xs font-black text-black disabled:opacity-40">
              {generating ? <Loader2 className="animate-spin" size={16}/> : <WandSparkles size={16}/>}GENERATE GROUP {quoteLoading ? '' : quote?.credits ? `· ${quote.credits} credits` : ''}</button>
            <button type="button" onClick={save} disabled={saving || !currentUrl} className="border border-cyan-300 px-4 py-3 text-xs font-black text-cyan-200 disabled:opacity-35">
              {saving ? 'SAVING...' : 'SAVE TO MY VAULT'}</button>
            <button type="button" onClick={() => setSourceMode('original')} className="flex items-center gap-1 border border-white/20 px-3 py-3 text-xs font-bold"><RotateCcw size={14}/>RESET SOURCE</button>
          </div>
        </div>
      </div>
    </div>
    {showVaultSave && currentUrl && <SaveToVaultModal userEmail={userEmail} imageUrl={currentUrl} mediaType="image"
      suggestedName={name.trim()} onSaved={handleVaultSaved} onClose={() => setShowVaultSave(false)} />}
  </div>;
}
