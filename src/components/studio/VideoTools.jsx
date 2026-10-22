import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, CheckCircle2, Folder, Image as ImageIcon, Loader2, Plus, Save, ShoppingBag, Trash2, Upload, Users, Video, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/api/supabaseClient';
import { toast } from 'sonner';
import ProductionContextInfo from '@/components/ProductionContextInfo';
import VaultPickerModal from '@/components/studio/VaultPickerModal';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';
import { useAiPriceQuote } from '@/hooks/useAiPriceQuote';
import { useAiModelOptions } from '@/hooks/useAiModelOptions';

const RATIOS = [
  { id: '16:9', label: 'Landscape' },
  { id: '9:16', label: 'Portrait' },
  { id: '1:1', label: 'Square' },
];

const SHOT_TYPES = [
  'Wide shot',
  'Medium shot',
  'Medium close-up',
  'Close-up',
  'Two-shot',
  'Over-the-shoulder',
  'Insert / detail',
  'Reverse angle',
];

const catalogImages = (asset) => [...new Set([
  asset?.featured_image,
  ...(Array.isArray(asset?.preview_images) ? asset.preview_images : []),
].filter(Boolean))];

const newCastMember = (index = 0) => ({
  id: crypto.randomUUID(),
  name: `Character ${index + 1}`,
  type: 'human',
  reference_url: '',
  voice_or_sound: '',
  manner: '',
  description: '',
});

const newShot = (index = 0) => ({
  id: crypto.randomUUID(),
  order: index + 1,
  label: `Shot ${index + 1}`,
  duration: 5,
  framing: 'Medium shot',
  characters: [],
  dialogue: '',
  action: '',
  camera: '',
  sound: '',
  result_url: '',
});

const spokenWordCount = (dialogue = '') => String(dialogue)
  .replace(/(^|\s)[A-Za-zÀ-ÿ0-9 _'-]+:\s*/g, ' ')
  .trim()
  .split(/\s+/)
  .filter(Boolean).length;

const estimatedSpeechSeconds = (dialogue = '') => spokenWordCount(dialogue) / 2.2;
const fittedDuration = (dialogue = '') => Math.max(3, Math.min(15, Math.ceil(estimatedSpeechSeconds(dialogue) + 1)));

function AssetsShopPicker({ onSelect, onClose, embedded = false }) {
  const [search, setSearch] = useState('');
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    supabase
      .from('catalog_asset')
      .select('id,title,description,featured_image,preview_images,creator_name,tags')
      .eq('status', 'published')
      .order('title', { ascending: true })
      .limit(500)
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) throw loadError;
        setAssets((data || []).filter((asset) => catalogImages(asset).length));
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError?.message || 'Assets Shop could not load.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const term = search.trim().toLowerCase();
  const filtered = assets.filter((asset) => {
    if (!term) return true;
    const tags = Array.isArray(asset.tags) ? asset.tags.join(' ') : String(asset.tags || '');
    return `${asset.title || ''} ${asset.description || ''} ${asset.creator_name || ''} ${tags}`.toLowerCase().includes(term);
  });

  const frameClass = embedded
    ? 'fixed top-14 right-0 bottom-[64px] left-0 lg:bottom-0 lg:left-[var(--studio-toolbar-width)]'
    : 'fixed inset-0';

  return (
    <motion.div className={`${frameClass} z-[99999] flex items-center justify-center bg-black/90 p-3`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden border border-white/10 bg-[#17191d]" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-white/10 p-5">
          <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#23c7be]">Assets Shop</p><h3 className="text-xl font-black text-white">Choose a reference image</h3></div>
          <button type="button" onClick={onClose} className="p-2 text-white"><X size={18} /></button>
        </header>
        <div className="border-b border-white/10 p-4"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Assets Shop" className="w-full border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" /></div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? <div className="flex min-h-56 items-center justify-center"><Loader2 className="animate-spin text-[#23c7be]" /></div>
            : error ? <div className="border border-red-400/25 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>
              : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{filtered.flatMap((asset) => catalogImages(asset).map((url, index) => (
                <button key={`${asset.id}-${index}`} type="button" onClick={() => onSelect(url, asset.title)} className="overflow-hidden border border-white/10 bg-black text-left hover:border-[#23c7be]">
                  <div className="aspect-[4/3]"><img src={url} alt="" className="h-full w-full object-contain" /></div>
                  <div className="p-2"><p className="truncate text-xs font-bold text-white">{asset.title}</p><p className="text-[9px] text-white/35">Image {index + 1} of {catalogImages(asset).length}</p></div>
                </button>
              )))}</div>}
        </div>
      </div>
    </motion.div>
  );
}

export default function VideoTools({ onClose, referenceMedia = [], productionMethod = null, block = null, character = null, user, embedded = false }) {
  const showContext = productionMethod && block;
  const [step, setStep] = useState('setup');
  const [sceneId, setSceneId] = useState(null);
  const [title, setTitle] = useState('Untitled scene');
  const [cast, setCast] = useState([newCastMember(0), newCastMember(1)]);
  const [setReference, setSetReference] = useState({ name: '', url: '', description: '' });
  const [sceneText, setSceneText] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [shotPlan, setShotPlan] = useState([]);
  const [approved, setApproved] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [regeneratingShotId, setRegeneratingShotId] = useState(null);
  const [activeShotId, setActiveShotId] = useState(null);
  const [showVaultPicker, setShowVaultPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null);
  const [showAssetsShop, setShowAssetsShop] = useState(false);
  const [showSaveVault, setShowSaveVault] = useState(false);
  const [vaultVideoUrl, setVaultVideoUrl] = useState(null);
  const [userEmail, setUserEmail] = useState(user?.email || null);
  const [showMyScenes, setShowMyScenes] = useState(false);
  const [savedScenes, setSavedScenes] = useState([]);
  const [loadingScenes, setLoadingScenes] = useState(false);
  const [promptEdits, setPromptEdits] = useState({});

  useEffect(() => {
    if (user?.email) {
      setUserEmail(user.email);
      return;
    }
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email || null)).catch(() => {});
  }, [user?.email]);

  const loadMyScenes = async () => {
    setLoadingScenes(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const ownerId = authData.user?.id;
      if (!ownerId) throw new Error('You must be signed in to open My Scenes.');
      const { data, error } = await supabase
        .from('shoot_scene')
        .select('*')
        .eq('user_id', ownerId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setSavedScenes(data || []);
    } catch (error) {
      toast.error(error?.message || 'My Scenes could not load.');
    } finally {
      setLoadingScenes(false);
    }
  };

  const openMyScenes = async () => {
    const nextOpen = !showMyScenes;
    setShowMyScenes(nextOpen);
    if (nextOpen) await loadMyScenes();
  };

  const restoreScene = (scene) => {
    const restoredShots = Array.isArray(scene?.shot_plan) ? scene.shot_plan : [];
    const restoredStatus = scene?.status || 'setup';
    const canShoot = ['approved', 'shooting', 'completed'].includes(restoredStatus);
    setSceneId(scene.id);
    setTitle(scene.title || 'Untitled scene');
    setAspectRatio(scene.aspect_ratio || '16:9');
    setCast(Array.isArray(scene.cast_data) ? scene.cast_data : []);
    setSetReference(scene.set_reference || { name: '', url: '', description: '' });
    setSceneText(scene.scene_text || '');
    setShotPlan(restoredShots);
    setApproved(canShoot);
    setActiveShotId(restoredShots[0]?.id || null);
    setPromptEdits({});
    setStep(restoredStatus === 'planned' ? 'plan' : (canShoot ? 'shoot' : 'setup'));
    setShowMyScenes(false);
    toast.success('Scene restored');
  };

  const activeShot = shotPlan.find((shot) => shot.id === activeShotId) || shotPlan[0] || null;
  const quoteService = 'generateVideo:video';
  const pricingInput = useMemo(() => ({
    duration: Math.max(3, Math.min(15, Number(activeShot?.duration || 5))),
    mode: 'pro',
    aspect_ratio: aspectRatio,
    prompt: `${activeShot?.framing || 'Medium shot'}. ${activeShot?.action || ''} ${activeShot?.dialogue || ''}`.trim(),
    reference_images: [setReference.url, ...cast.map((member) => member.reference_url)].filter(Boolean).slice(0, 7),
    generate_audio: true,
  }), [activeShot, aspectRatio, cast, setReference.url]);

  const { options: modelOptions, loading: modelsLoading } = useAiModelOptions({ service: quoteService, kind: 'video', input: pricingInput });
  const effectiveModel = selectedModel || modelOptions.find((item) => item.recommended)?.model_key || modelOptions[0]?.model_key || null;
  const { quote: priceQuote } = useAiPriceQuote({ service: quoteService, kind: 'video', input: pricingInput, modelKey: effectiveModel });

  const updateCast = (id, patch) => setCast((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const updateShot = (id, patch) => setShotPlan((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));

  const addShot = () => {
    const shot = newShot(shotPlan.length);
    const nextShots = [...shotPlan, shot];
    setShotPlan(nextShots);
    setActiveShotId(shot.id);
    setApproved(false);
    setStep('plan');
    return nextShots;
  };

  const startManualCuts = async () => {
    const firstShot = newShot(0);
    const nextShots = [firstShot];
    setShotPlan(nextShots);
    setActiveShotId(firstShot.id);
    setApproved(false);
    setPromptEdits({});
    setStep('plan');
    try {
      await saveScene({ shot_plan: nextShots, status: 'planned' });
      toast.success('Old shots removed. Start with your Shot 1.');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const toggleShotCharacter = async (shot, memberName) => {
    const current = Array.isArray(shot.characters) ? shot.characters : [];
    const exists = current.some((name) => name.trim().toLowerCase() === memberName.trim().toLowerCase());
    const nextCharacters = exists
      ? current.filter((name) => name.trim().toLowerCase() !== memberName.trim().toLowerCase())
      : [...current, memberName];
    const previousShots = shotPlan;
    const nextShots = shotPlan.map((item) => item.id === shot.id ? { ...item, characters: nextCharacters } : item);
    setShotPlan(nextShots);
    if (!sceneId) return;
    const { error } = await supabase.from('shoot_scene').update({ shot_plan: nextShots, updated_at: new Date().toISOString() }).eq('id', sceneId);
    if (error) {
      setShotPlan(previousShots);
      toast.error(error.message || 'Could not update shot cast.');
    }
  };

  const uploadImage = async (file, target) => {
    if (!file) return;
    const { data: authData } = await supabase.auth.getUser();
    const owner = authData.user?.id || 'public';
    const extension = file.name?.split('.').pop() || 'jpg';
    const path = `${owner}/shoot/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from('media').upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from('media').getPublicUrl(path);
    applyPickedImage(data.publicUrl, file.name, target);
  };

  const applyPickedImage = (url, name, target = pickerTarget) => {
    if (!url || !target) return;
    if (target.type === 'cast') updateCast(target.id, { reference_url: url });
    if (target.type === 'set') setSetReference((value) => ({ ...value, url, name: value.name || name || 'Set' }));
    setShowVaultPicker(false);
    setShowAssetsShop(false);
    setPickerTarget(null);
  };

  const buildScenePayload = (overrides = {}) => ({
    title: title.trim() || 'Untitled scene',
    aspect_ratio: aspectRatio,
    cast_data: cast,
    set_reference: setReference.url ? setReference : null,
    scene_text: sceneText,
    shot_plan: shotPlan,
    status: approved ? 'approved' : (shotPlan.length ? 'planned' : 'setup'),
    updated_at: new Date().toISOString(),
    ...overrides,
  });

  const saveScene = async (overrides = {}) => {
    const payload = buildScenePayload(overrides);
    const query = sceneId
      ? supabase.from('shoot_scene').update(payload).eq('id', sceneId).select('*').single()
      : supabase.from('shoot_scene').insert(payload).select('*').single();
    const { data, error } = await query;
    if (error) throw error;
    setSceneId(data.id);
    return data;
  };

  const shotCast = (shot) => {
    const requested = new Set((shot.characters || []).map((name) => String(name).trim().toLowerCase()));
    return requested.size
      ? cast.filter((member) => requested.has(member.name.trim().toLowerCase()))
      : [];
  };

  const shotReferences = (shot) => {
    const refs = [];
    if (setReference.url) refs.push({ role: 'SET REFERENCE', name: setReference.name || 'Set', url: setReference.url });
    shotCast(shot).filter((member) => member.reference_url).forEach((member) => {
      const castIndex = cast.findIndex((item) => item.id === member.id);
      refs.push({ role: `CHARACTER ${castIndex + 1} REFERENCE`, name: member.name, url: member.reference_url });
    });
    return refs.slice(0, 7);
  };

  const shotReferenceUrls = (shot) => shotReferences(shot).map((ref) => ref.url);

  const buildShotPrompt = (shot) => {
    const refs = shotReferences(shot);
    const referenceRules = refs.map((ref, index) => {
      if (ref.role === 'SET REFERENCE') {
        return `${ref.role} = Image ${index + 1}. Use this exact set as the physical location master. Do not redesign, reinterpret, move, remove, resize, recolor or substitute architecture, furniture, props, materials or lighting fixtures.`;
      }
      return `${ref.role} = Image ${index + 1} (${ref.name}). Use this exact person/character reference. Do not invent or redescribe appearance, face, hair, body, wardrobe or accessories. The image is authoritative.`;
    }).join(' ');
    const framingRule = `FRAMING LOCK: ${shot.framing} is mandatory. Execute this exact selected shot type. Do not substitute a different shot size, angle or composition. Camera notes may refine movement or placement but may not override the selected framing.`;
    return `${referenceRules} ${framingRule} ACTION: ${shot.action || 'No additional action specified.'} ${shot.dialogue ? `DIALOGUE: ${shot.dialogue}. Preserve exact speaker attribution. Only the speaking character moves their mouth; other visible characters react silently.` : ''} ${shot.camera ? `CAMERA NOTES: ${shot.camera}.` : ''} ${shot.sound ? `SOUND: ${shot.sound}.` : ''} Preserve exact reference identities, exact set continuity, wardrobe, eyelines and screen direction. Duration ${shot.duration} seconds.`;
  };

  const finalPromptForShot = (shot) => promptEdits[shot.id] ?? buildShotPrompt(shot);

  const generateShot = async (shot) => {
    if (!sceneId) {
      try { await saveScene({ status: 'approved' }); } catch (error) { return toast.error(error.message); }
    }
    const selectedCast = shotCast(shot);
    if (shot.framing === 'Over-the-shoulder' && selectedCast.length < 2) {
      return toast.error('Over-the-shoulder requires two selected characters.');
    }
    if (selectedCast.some((member) => !member.reference_url)) {
      return toast.error('Every selected character needs a reference image.');
    }
    if (!setReference.url) {
      return toast.error('Add a set reference before generating this shot.');
    }
    const finalPrompt = finalPromptForShot(shot).trim();
    if (!finalPrompt) return toast.error('Final prompt cannot be empty.');
    const speechSeconds = estimatedSpeechSeconds(shot.dialogue);
    if (speechSeconds > Number(shot.duration || 0)) {
      return toast.error(`Dialogue needs about ${Math.ceil(speechSeconds)}s but this shot is ${shot.duration}s. Increase duration or shorten the line.`);
    }
    setBusy(true);
    setRegeneratingShotId(shot.result_url ? shot.id : null);
    setActiveShotId(shot.id);
    try {
      const refs = shotReferenceUrls(shot);
      const { data, error } = await supabase.functions.invoke('generateVideo', {
        body: {
          prompt: finalPrompt,
          reference_image_urls: refs,
          duration: Math.max(3, Math.min(15, Number(shot.duration) || 5)),
          aspect_ratio: aspectRatio,
          resolution: '720p',
          generate_audio: true,
          engine: 'video',
          model_key: effectiveModel || undefined,
        },
        headers: { 'x-idempotency-key': crypto.randomUUID() },
      });
      if (error) {
        let message = error.message || 'Shot generation failed';
        try {
          if (error.context && typeof error.context.json === 'function' && !error.context.bodyUsed) {
            const details = await error.context.json();
            message = details?.error || details?.message || message;
          }
        } catch {}
        throw new Error(message);
      }
      const url = data?.file_url;
      if (!url) throw new Error('No video returned.');
      const nextShots = shotPlan.map((item) => item.id === shot.id ? { ...item, result_url: url } : item);
      setShotPlan(nextShots);
      const currentScene = sceneId || (await saveScene({ shot_plan: nextShots, status: 'shooting' })).id;
      const { error: updateError } = await supabase.from('shoot_scene').update({ shot_plan: nextShots, status: 'shooting', updated_at: new Date().toISOString() }).eq('id', currentScene);
      if (updateError) throw updateError;
      toast.success(`${shot.label} generated`);
    } catch (error) {
      toast.error(error?.message || 'Shot generation failed');
    } finally {
      setRegeneratingShotId(null);
      setBusy(false);
    }
  };

  const approvePlan = async () => {
    if (!shotPlan.length) return toast.error('Add at least one shot.');
    setApproved(true);
    setStep('shoot');
    try {
      await saveScene({ shot_plan: shotPlan, status: 'approved' });
      toast.success('Shot plan approved');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const allShotDuration = shotPlan.reduce((sum, shot) => sum + Number(shot.duration || 0), 0);
  const completedCount = shotPlan.filter((shot) => shot.result_url).length;

  return (
    <div className={`fixed z-[100] ${embedded ? 'top-14 right-0 bottom-[64px] left-0 lg:bottom-0 lg:left-[var(--studio-toolbar-width)] overflow-y-auto bg-[#202328]' : 'inset-0 flex items-center justify-center bg-black/80 p-4'}`}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={embedded ? 'min-h-full w-full bg-[#202328] p-5 pb-28 text-white md:p-8' : 'max-h-[92vh] w-full max-w-6xl overflow-y-auto border border-white/10 bg-[#202328] p-6 text-white'}>
        <div className="mx-auto max-w-7xl">
          <header className="mb-5 flex items-center justify-between border-b border-white/10 bg-[#17191d] px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center border border-[#23c7be]/30 bg-[#23c7be]/10 text-[#23c7be]"><Camera size={20} /></div>
              <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#23c7be]">Scene Production</p><h3 className="text-xl font-black">Shoot</h3><p className="text-xs text-white/45">You define every shot. Review the exact final prompt before generation.</p></div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={openMyScenes} className={`flex items-center gap-2 border px-3 py-2 text-xs font-bold ${showMyScenes ? 'border-[#23c7be] bg-[#23c7be]/10 text-[#8ee9e4]' : 'border-white/10 bg-white/[0.05]'}`}><Folder size={14} /> My Scenes</button>
              <button type="button" onClick={() => saveScene().then(() => toast.success('Shoot scene saved')).catch((error) => toast.error(error.message))} className="flex items-center gap-2 border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-bold"><Save size={14} /> Save</button>
              {!embedded && <button type="button" onClick={onClose} className="p-2"><X size={19} /></button>}
            </div>
          </header>

          {showMyScenes && <section className="mb-5 border border-white/10 bg-[#17191d] p-4">
            <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.15em] text-[#23c7be]">My Scenes</p><p className="text-xs text-white/45">Open one of your saved Shoot scenes.</p></div><button type="button" onClick={loadMyScenes} disabled={loadingScenes} className="bg-white/10 px-3 py-2 text-xs font-bold disabled:opacity-50">Refresh</button></div>
            {loadingScenes ? <div className="flex min-h-24 items-center justify-center"><Loader2 className="animate-spin text-[#23c7be]" /></div>
              : savedScenes.length ? <div className="grid gap-2 md:grid-cols-2">{savedScenes.map((scene) => <button key={scene.id} type="button" onClick={() => restoreScene(scene)} className="border border-white/10 bg-black/20 p-3 text-left hover:border-[#23c7be]"><div className="flex items-center justify-between gap-3"><span className="truncate text-sm font-black">{scene.title || 'Untitled scene'}</span><span className="text-[10px] font-bold uppercase text-[#8ee9e4]">{scene.status || 'setup'}</span></div><p className="mt-1 text-[10px] text-white/40">{scene.aspect_ratio || '16:9'} · {Array.isArray(scene.shot_plan) ? scene.shot_plan.length : 0} shots</p></button>)}</div>
                : <div className="border border-white/10 bg-black/20 p-4 text-sm text-white/45">No saved scenes yet.</div>}
          </section>}

          {showContext && <ProductionContextInfo productionMethod={productionMethod} block={block} character={character} referenceMedia={referenceMedia} />}

          <div className="mb-5 grid grid-cols-3 border border-white/10 bg-[#17191d] text-center text-xs font-black">
            <button type="button" onClick={() => setStep('setup')} className={`p-3 ${step === 'setup' ? 'bg-[#23c7be] text-black' : 'text-white/60'}`}>1 · Setup</button>
            <button type="button" onClick={() => shotPlan.length && setStep('plan')} className={`p-3 ${step === 'plan' ? 'bg-[#23c7be] text-black' : 'text-white/60'}`}>2 · Cuts</button>
            <button type="button" onClick={() => approved && setStep('shoot')} className={`p-3 ${step === 'shoot' ? 'bg-[#23c7be] text-black' : 'text-white/60'}`}>3 · Shoot</button>
          </div>

          {step === 'setup' && <div className="space-y-5">
            <section className="grid gap-3 md:grid-cols-[1fr_300px]">
              <input value={title} onChange={(event) => setTitle(event.target.value)} className="border border-white/10 bg-[#17191d] px-4 py-3 text-sm font-bold" placeholder="Scene title" />
              <div className="grid grid-cols-3 gap-2">{RATIOS.map((ratio) => <button key={ratio.id} type="button" onClick={() => setAspectRatio(ratio.id)} className={`border p-2 text-xs font-bold ${aspectRatio === ratio.id ? 'border-[#23c7be] bg-[#23c7be]/10 text-[#8ee9e4]' : 'border-white/10 text-white/55'}`}>{ratio.label}<br /><span className="font-black">{ratio.id}</span></button>)}</div>
            </section>

            <section className="border border-white/10 bg-[#17191d] p-4">
              <div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.15em] text-[#23c7be]">Cast</p><p className="text-xs text-white/45">One exact reference per performer.</p></div><button type="button" onClick={() => setCast((items) => [...items, newCastMember(items.length)])} className="flex items-center gap-1 bg-white/10 px-3 py-2 text-xs font-bold"><Plus size={13} /> Cast</button></div>
              <div className="space-y-3">{cast.map((member) => <div key={member.id} className="grid gap-3 border border-white/10 p-3 lg:grid-cols-[120px_1fr_1fr_1fr_40px]">
                <div className="space-y-2"><div className="aspect-square overflow-hidden border border-white/10 bg-black">{member.reference_url ? <img src={member.reference_url} alt="" className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-white/25"><Users /></div>}</div><div className="grid grid-cols-3 gap-1"><label className="cursor-pointer bg-white/10 p-1 text-center"><Upload size={11} className="mx-auto" /><input type="file" accept="image/*" className="hidden" onChange={(event) => uploadImage(event.target.files?.[0], { type: 'cast', id: member.id }).catch((error) => toast.error(error.message))} /></label><button type="button" onClick={() => { setPickerTarget({ type: 'cast', id: member.id }); setShowVaultPicker(true); }} className="bg-white/10 p-1"><Folder size={11} className="mx-auto" /></button><button type="button" onClick={() => { setPickerTarget({ type: 'cast', id: member.id }); setShowAssetsShop(true); }} className="bg-white/10 p-1"><ShoppingBag size={11} className="mx-auto" /></button></div></div>
                <div className="space-y-2"><input value={member.name} onChange={(event) => updateCast(member.id, { name: event.target.value })} className="w-full bg-black/30 p-2 text-sm font-bold" placeholder="Name" /><select value={member.type} onChange={(event) => updateCast(member.id, { type: event.target.value })} className="w-full bg-black/30 p-2 text-xs"><option value="human">Human</option><option value="animal">Animal</option><option value="creature">Creature / being</option><option value="robot">Robot / synthetic</option></select></div>
                <textarea value={member.voice_or_sound} onChange={(event) => updateCast(member.id, { voice_or_sound: event.target.value })} className="min-h-24 bg-black/30 p-2 text-xs" placeholder={member.type === 'human' ? 'Voice: age, tone, accent, texture…' : 'Sound / vocalization…'} />
                <div className="space-y-2"><textarea value={member.manner} onChange={(event) => updateCast(member.id, { manner: event.target.value })} className="min-h-11 w-full bg-black/30 p-2 text-xs" placeholder="Manner / performance" /><textarea value={member.description} onChange={(event) => updateCast(member.id, { description: event.target.value })} className="min-h-11 w-full bg-black/30 p-2 text-xs" placeholder="Character notes" /></div>
                <button type="button" onClick={() => setCast((items) => items.filter((item) => item.id !== member.id))} className="text-white/45"><Trash2 size={15} /></button>
              </div>)}</div>
            </section>

            <section className="border border-white/10 bg-[#17191d] p-4">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.15em] text-[#23c7be]">Set</p>
              <div className="grid gap-3 md:grid-cols-[180px_1fr]"><div><div className="aspect-video overflow-hidden border border-white/10 bg-black">{setReference.url ? <img src={setReference.url} alt="" className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-white/25"><ImageIcon /></div>}</div><div className="mt-2 grid grid-cols-3 gap-1"><label className="cursor-pointer bg-white/10 p-2 text-center"><Upload size={13} className="mx-auto" /><input type="file" accept="image/*" className="hidden" onChange={(event) => uploadImage(event.target.files?.[0], { type: 'set' }).catch((error) => toast.error(error.message))} /></label><button type="button" onClick={() => { setPickerTarget({ type: 'set' }); setShowVaultPicker(true); }} className="bg-white/10"><Folder size={13} className="mx-auto" /></button><button type="button" onClick={() => { setPickerTarget({ type: 'set' }); setShowAssetsShop(true); }} className="bg-white/10"><ShoppingBag size={13} className="mx-auto" /></button></div></div><div className="space-y-2"><input value={setReference.name} onChange={(event) => setSetReference((value) => ({ ...value, name: event.target.value }))} className="w-full bg-black/30 p-3 text-sm font-bold" placeholder="Set name" /><textarea value={setReference.description} onChange={(event) => setSetReference((value) => ({ ...value, description: event.target.value }))} className="min-h-28 w-full bg-black/30 p-3 text-xs" placeholder="Continuity notes only — the image remains authoritative." /></div></div>
            </section>

            <section className="border border-white/10 bg-[#17191d] p-4"><p className="mb-2 text-xs font-black uppercase tracking-[0.15em] text-[#23c7be]">Scene</p><textarea value={sceneText} onChange={(event) => setSceneText(event.target.value)} className="min-h-[260px] w-full bg-black/30 p-4 text-sm leading-6" placeholder="Keep the complete scene here as your script reference. You will create the shots yourself in Cuts." /></section>

            <section className="border border-white/10 bg-[#17191d] p-4"><p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/50">Video model</p><select value={effectiveModel || ''} onChange={(event) => setSelectedModel(event.target.value || null)} disabled={modelsLoading || !modelOptions.length} className="w-full border border-white/10 bg-black/30 p-3 text-sm text-white">{modelsLoading && <option>Loading models…</option>}{modelOptions.map((item) => <option key={item.model_key} value={item.model_key}>{item.name || item.model_key}{item.recommended ? ' — Recommended' : ''}</option>)}</select></section>

            <div className="grid gap-2 md:grid-cols-2"><Button onClick={() => saveScene().then(() => toast.success('Scene setup saved')).catch((error) => toast.error(error.message))} className="bg-white/10 text-white"><Save size={16} className="mr-2" /> Save Scene Setup</Button><Button onClick={startManualCuts} className="bg-[#23c7be] font-black text-black"><Plus className="mr-2" /> Create Shots</Button></div>
          </div>}

          {step === 'plan' && <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-[#17191d] p-4"><div><p className="text-sm font-black">Your shot plan</p><p className="text-xs text-white/45">{shotPlan.length} shots · approximately {allShotDuration}s total. You control every cut.</p></div><div className="flex gap-2"><button type="button" onClick={addShot} className="flex items-center gap-1 bg-white/10 px-3 py-2 text-xs font-bold"><Plus size={13} /> Add Shot</button><button type="button" onClick={approvePlan} className="bg-[#23c7be] px-4 py-2 text-xs font-black text-black">Approve & Shoot</button></div></div>
            <div className="space-y-3">{shotPlan.map((shot, index) => {
              const speechSeconds = estimatedSpeechSeconds(shot.dialogue);
              const timingProblem = speechSeconds > Number(shot.duration || 0);
              return <div key={shot.id} className={`border bg-[#17191d] p-4 ${timingProblem ? 'border-red-400/60' : 'border-white/10'}`}>
                <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center bg-[#23c7be]/10 text-xs font-black text-[#8ee9e4]">{index + 1}</span><input value={shot.label} onChange={(event) => updateShot(shot.id, { label: event.target.value })} className="bg-transparent text-sm font-black" /></div><button type="button" onClick={() => setShotPlan((items) => items.filter((item) => item.id !== shot.id))} className="text-white/40"><Trash2 size={14} /></button></div>
                <div className="grid gap-2 md:grid-cols-4"><label className="text-[10px] text-white/45">Duration<div className="mt-1 flex gap-1"><input type="number" min="3" max="15" value={shot.duration} onChange={(event) => updateShot(shot.id, { duration: Math.max(3, Math.min(15, Number(event.target.value) || 3)) })} className="min-w-0 flex-1 bg-black/30 p-2 text-xs text-white" /><button type="button" onClick={() => updateShot(shot.id, { duration: fittedDuration(shot.dialogue) })} className="bg-white/10 px-2 text-[9px] font-bold">Fit</button></div></label><label className="text-[10px] text-white/45">Framing<select value={shot.framing} onChange={(event) => updateShot(shot.id, { framing: event.target.value })} className="mt-1 w-full bg-black/30 p-2 text-xs text-white">{SHOT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label><label className="text-[10px] text-white/45 md:col-span-2">Characters<input value={(shot.characters || []).join(', ')} onChange={(event) => updateShot(shot.id, { characters: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} className="mt-1 w-full bg-black/30 p-2 text-xs text-white" /></label></div>
                <div className="mt-2 grid gap-2 md:grid-cols-2"><textarea value={shot.dialogue} onChange={(event) => updateShot(shot.id, { dialogue: event.target.value })} className="min-h-20 bg-black/30 p-2 text-xs" placeholder="Dialogue with speaker names" /><textarea value={shot.action} onChange={(event) => updateShot(shot.id, { action: event.target.value })} className="min-h-20 bg-black/30 p-2 text-xs" placeholder="Action — describe only what happens, not appearance" /><textarea value={shot.camera} onChange={(event) => updateShot(shot.id, { camera: event.target.value })} className="min-h-16 bg-black/30 p-2 text-xs" placeholder="Camera movement / placement — framing above remains authoritative" /><textarea value={shot.sound} onChange={(event) => updateShot(shot.id, { sound: event.target.value })} className="min-h-16 bg-black/30 p-2 text-xs" placeholder="Sound / ambience" /></div>
                {timingProblem && <p className="mt-2 text-xs font-bold text-red-300">Timing conflict: dialogue needs about {Math.ceil(speechSeconds)}s, but the shot is {shot.duration}s.</p>}
              </div>;
            })}</div>
          </div>}

          {step === 'shoot' && <div className="grid gap-4 lg:grid-cols-[330px_1fr]">
            <aside className="space-y-2 border border-white/10 bg-[#17191d] p-3"><div className="mb-3"><p className="text-xs font-black uppercase tracking-[0.15em] text-[#23c7be]">Shot list</p><p className="text-[10px] text-white/45">{completedCount}/{shotPlan.length} generated</p></div>{shotPlan.map((shot, index) => <button key={shot.id} type="button" onClick={() => setActiveShotId(shot.id)} className={`w-full border p-3 text-left ${activeShot?.id === shot.id ? 'border-[#23c7be] bg-[#23c7be]/10' : 'border-white/10 bg-black/20'}`}><div className="flex items-center justify-between"><span className="text-xs font-black">{index + 1}. {shot.label}</span>{shot.result_url && <CheckCircle2 size={14} className="text-[#23c7be]" />}</div><p className="mt-1 text-[10px] text-white/45">{shot.duration}s · {shot.framing}</p></button>)}</aside>
            <main className="space-y-4">{activeShot && <>
              <section className="border border-white/10 bg-[#17191d] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-lg font-black">{activeShot.label}</p><p className="text-xs text-white/45">{activeShot.duration}s · {activeShot.framing} · {(activeShot.characters || []).join(', ') || 'No cast specified'}</p></div><span className="text-xs font-bold text-[#8ee9e4]">{priceQuote?.credits ? `${priceQuote.credits} credits` : ''}</span></div><div className="mt-4 grid gap-3 md:grid-cols-2"><div><p className="mb-1 text-[10px] font-black uppercase text-white/40">Dialogue</p><p className="text-sm">{activeShot.dialogue || '—'}</p></div><div><p className="mb-1 text-[10px] font-black uppercase text-white/40">Action / Camera</p><p className="text-sm">{activeShot.action} {activeShot.camera}</p></div></div><div className="mt-4 border-t border-white/10 pt-3"><p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/40">Characters in this shot</p><div className="flex flex-wrap gap-2">{cast.map((member) => { const selected = (activeShot.characters || []).some((name) => name.trim().toLowerCase() === member.name.trim().toLowerCase()); return <button key={member.id} type="button" onClick={() => toggleShotCharacter(activeShot, member.name)} className={`border px-3 py-2 text-xs font-bold ${selected ? 'border-[#23c7be] bg-[#23c7be]/10 text-[#8ee9e4]' : 'border-white/10 bg-white/[0.04] text-white/55'}`}>{selected ? '✓ ' : '+ '}{member.name}</button>; })}</div>{activeShot.result_url && <p className="mt-2 text-[10px] text-white/35">Character changes apply when this shot is regenerated.</p>}</div></section>
              <section className="border border-white/10 bg-[#17191d] p-4"><p className="mb-2 text-[10px] font-black uppercase text-white/40">Exact references sent for this shot</p><div className="flex flex-wrap gap-2">{shotReferences(activeShot).map((ref, index) => <div key={`${ref.url}-${index}`} className="w-28"><div className="aspect-square overflow-hidden bg-black"><img src={ref.url} alt="" className="h-full w-full object-contain" /></div><p className="mt-1 text-[9px] font-bold text-[#8ee9e4]">{ref.role}</p><p className="truncate text-[9px] text-white/40">Image {index + 1} · {ref.name}</p></div>)}</div></section>
              <section className="border border-[#23c7be]/30 bg-[#17191d] p-4"><div className="mb-2 flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#23c7be]">Final prompt sent to video model</p><p className="text-[10px] text-white/40">Review and correct anything before generating.</p></div>{promptEdits[activeShot.id] !== undefined && <button type="button" onClick={() => setPromptEdits((current) => { const next = { ...current }; delete next[activeShot.id]; return next; })} className="bg-white/10 px-3 py-2 text-[10px] font-bold">Reset</button>}</div><textarea value={finalPromptForShot(activeShot)} onChange={(event) => setPromptEdits((current) => ({ ...current, [activeShot.id]: event.target.value }))} className="min-h-52 w-full border border-white/10 bg-black/30 p-3 text-xs leading-5 text-white" /></section>
              {activeShot.result_url ? <section className="border border-white/10 bg-black p-3"><video src={activeShot.result_url} controls className="max-h-[60vh] w-full" /><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => generateShot(activeShot)} disabled={busy} className="flex items-center justify-center bg-white/10 py-3 text-xs font-bold disabled:opacity-60">{regeneratingShotId === activeShot.id ? <><Loader2 size={14} className="mr-2 animate-spin" /> Regenerating…</> : 'Regenerate With This Prompt'}</button><button type="button" onClick={() => { setVaultVideoUrl(activeShot.result_url); setShowSaveVault(true); }} disabled={regeneratingShotId === activeShot.id} className="bg-[#23c7be] py-3 text-xs font-black text-black disabled:opacity-50">Save Shot to Vault</button></div></section>
                : <Button onClick={() => generateShot(activeShot)} disabled={busy || modelsLoading} className="w-full bg-[#23c7be] py-5 font-black text-black">{busy ? <Loader2 className="mr-2 animate-spin" /> : <Video className="mr-2" />} Generate With This Prompt</Button>}
            </>}</main>
          </div>}
        </div>

        {showVaultPicker && userEmail && <VaultPickerModal userEmail={userEmail} onSelect={(url) => applyPickedImage(url, 'Vault reference')} onClose={() => { setShowVaultPicker(false); setPickerTarget(null); }} embedded={embedded} />}
        {showAssetsShop && <AssetsShopPicker embedded={embedded} onSelect={(url, name) => applyPickedImage(url, name)} onClose={() => { setShowAssetsShop(false); setPickerTarget(null); }} />}
        {showSaveVault && vaultVideoUrl && userEmail && <SaveToVaultModal userEmail={userEmail} imageUrl={vaultVideoUrl} mediaType="video" onClose={() => setShowSaveVault(false)} onSaved={() => { setShowSaveVault(false); toast.success('Shot saved to Vault'); }} />}
      </motion.div>
    </div>
  );
}