import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import ShootTimelineEngine from '@/components/studio/ShootTimelineEngine';
import { buildModelToolInput, getMappedModelField } from '@/components/studio/DynamicAiModelControls';

const RATIOS = [
  { id: '16:9', label: 'Landscape' },
  { id: '9:16', label: 'Portrait' },
  { id: '1:1', label: 'Square' },
];

const STANDARD_SHOT_TYPES = [
  'Wide shot',
  'Medium shot',
  'Medium close-up',
  'Close-up',
  'Two-shot',
  'Over-the-shoulder',
  'Reverse angle',
];

const SHOT_MODES = [
  { id: 'standard', label: 'Standard' },
  { id: 'establishing', label: 'Establishing' },
  { id: 'insert', label: 'Insert / detail' },
];

const ACTION_PRESETS = [
  { label: 'Already seated in armchair', value: 'Character is already seated naturally in an armchair that is present in the set. Their weight is supported by the seat and backrest, feet placed naturally on the floor, hands relaxed, body posture anatomically correct. Preserve the exact chair, set layout, wardrobe and body proportions.' },
  { label: 'Already seated on sofa', value: 'Character is already seated naturally on a sofa that is present in the set. Their hips and back are supported by the cushions, feet placed naturally, hands relaxed, body posture anatomically correct. Preserve the exact sofa, set layout, wardrobe and body proportions.' },
  { label: 'Sit down in armchair', value: 'Character turns toward the armchair already present in the set, aligns their body with the seat, bends naturally at the hips and knees, lowers themselves onto the seat, then settles with their back supported and feet naturally placed on the floor. Do not move or redesign the chair.' },
  { label: 'Sit down on sofa', value: 'Character approaches the sofa already present in the set, turns naturally, bends at the hips and knees, lowers themselves onto the cushion, then settles into a stable seated posture. Do not move, resize or redesign the sofa.' },
  { label: 'Stand up', value: 'Character rises naturally from the seat by leaning slightly forward, placing weight through the feet, extending the knees and hips, and reaching a stable standing posture. Preserve the furniture position and avoid unnatural body deformation.' },
  { label: 'Lean forward while seated', value: 'While remaining seated, character leans their upper body forward naturally from the hips, keeping balance through the feet and seat, with realistic posture and weight distribution.' },
  { label: 'Lean back while seated', value: 'While remaining seated, character gently leans back into the chair or sofa backrest, keeping realistic body contact, posture and weight distribution.' },
  { label: 'Cross legs while seated', value: 'While seated, character naturally lifts one leg and crosses it over the other, keeping the pelvis stable, feet and knees anatomically correct, and maintaining natural contact with the seat.' },
  { label: 'Walk across room', value: 'Character walks naturally across the existing room with realistic alternating steps, balanced weight transfer and subtle arm movement, avoiding furniture and preserving the exact set layout.' },
  { label: 'Walk toward camera', value: 'Character walks naturally toward the camera with realistic steps, balanced body movement and stable identity, remaining correctly grounded in the set.' },
  { label: 'Walk away from camera', value: 'Character turns and walks naturally away from the camera with realistic steps, balanced movement and stable identity, remaining correctly grounded in the set.' },
  { label: 'Enter room', value: 'Character enters the visible room naturally from the available entrance, crosses the threshold with realistic body movement, then continues into the set without changing the architecture or door position.' },
  { label: 'Exit room', value: 'Character moves naturally toward the existing exit, crosses the threshold and leaves the visible space. Preserve the architecture, door and set layout exactly.' },
  { label: 'Turn toward character', value: 'Character naturally turns their head first, then shoulders and torso as needed, directing their attention toward the other selected character while keeping realistic posture and eyeline.' },
  { label: 'Turn away', value: 'Character naturally turns their head and body away from the current subject or direction, with realistic weight shift and continuous body motion.' },
  { label: 'Look at character', value: 'Character directs their eyes and head toward the other selected character, maintaining a natural eyeline and subtle facial reaction without unnecessary body movement.' },
  { label: 'Look toward object', value: 'Character naturally shifts their gaze and head toward the specified object, establishing a clear eyeline while keeping the rest of the body stable unless movement is required.' },
  { label: 'Pick up object', value: 'Character reaches toward the existing object, makes clear hand contact, closes the fingers naturally around it, lifts it with realistic weight and keeps the object stable and unchanged.' },
  { label: 'Put down object', value: 'Character lowers the held object onto the specified existing surface, keeps clear hand contact until the object is supported, then releases it naturally. Preserve the object appearance and surface position.' },
  { label: 'Reach for object', value: 'Character extends the appropriate arm and hand toward the specified existing object with natural shoulder, elbow and wrist movement, maintaining a clear physical relationship to the object.' },
  { label: 'Open door', value: 'Character approaches the existing door, reaches for the handle, makes clear hand contact, operates the handle and opens the door naturally on its existing hinges. Do not redesign, relocate or replace the door.' },
  { label: 'Close door', value: 'Character makes contact with the existing door and closes it naturally along its existing hinge path until it reaches the frame. Do not redesign, relocate or replace the door.' },
  { label: 'Stop and react', value: 'Character stops their current movement, settles their weight naturally, then gives a clear but controlled reaction through eyes, face and posture without exaggerated or unrelated movement.' },
  { label: 'Nod', value: 'Character gives a natural controlled nod using a small downward and upward head movement while maintaining stable posture and eyeline.' },
  { label: 'Shake head', value: 'Character gives a natural controlled side-to-side head movement indicating disagreement or disbelief while maintaining stable posture.' },
  { label: 'Gesture while speaking', value: 'Character uses restrained natural hand and forearm gestures synchronized with the spoken line, keeping the gestures secondary to the dialogue and avoiding exaggerated movement.' },
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

const newBeat = (characterId = '') => ({
  id: crypto.randomUUID(),
  character_id: characterId,
  dialogue: '',
  emotion: '',
  action: '',
});

const newShot = (index = 0) => ({
  id: crypto.randomUUID(),
  order: index + 1,
  label: `Shot ${index + 1}`,
  mode: 'standard',
  duration: 5,
  framing: 'Medium shot',
  character_ids: [],
  lines: [],
  shot_references: [],
  shot_video_references: [],
  transition_reference_id: '',
  transition_instruction: '',
  description: '',
  camera: '',
  sound: '',
  result_url: '',
});

const spokenWordCount = (dialogue = '') => String(dialogue)
  .trim()
  .split(/\s+/)
  .filter(Boolean).length;

const estimatedSpeechSeconds = (dialogue = '') => spokenWordCount(dialogue) / 2.2;
const fittedDuration = (dialogue = '') => Math.max(3, Math.min(15, Math.ceil(estimatedSpeechSeconds(dialogue) + 1)));
const cleanScenePassage = (value = '') => String(value).replace(/\*\*/g, '').trim();
const shotDialogueText = (shot) => (Array.isArray(shot?.lines) ? shot.lines : []).map((line) => line.dialogue || '').filter(Boolean).join(' ');

const ratioSize = (ratio) => {
  if (ratio === '9:16') return { width: 720, height: 1280 };
  if (ratio === '1:1') return { width: 1080, height: 1080 };
  return { width: 1280, height: 720 };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function AssetsShopPicker({ onSelect, onClose, embedded = false }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [subcategory, setSubcategory] = useState('all');
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from('catalog_asset').select('id,title,description,featured_image,preview_images,creator_name,tags,category_id,subcategory_id').eq('status', 'published').order('title', { ascending: true }).limit(500),
      supabase.from('asset_category').select('id,key,label_en,label_fr').eq('is_active', true).order('display_order', { ascending: true }),
      supabase.from('asset_subcategory').select('id,category_id,key,label_en,label_fr').eq('is_active', true).order('display_order', { ascending: true }),
    ])
      .then(([assetResult, categoryResult, subcategoryResult]) => {
        if (!active) return;
        if (assetResult.error) throw assetResult.error;
        if (categoryResult.error) throw categoryResult.error;
        if (subcategoryResult.error) throw subcategoryResult.error;
        setAssets((assetResult.data || []).filter((asset) => catalogImages(asset).length));
        setCategories(categoryResult.data || []);
        setSubcategories(subcategoryResult.data || []);
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError?.message || 'Assets Shop could not load.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => { setSubcategory('all'); }, [category]);

  const availableSubcategories = category === 'all' ? subcategories : subcategories.filter((item) => item.category_id === category);
  const term = search.trim().toLowerCase();
  const filtered = assets.filter((asset) => {
    if (category !== 'all' && asset.category_id !== category) return false;
    if (subcategory !== 'all' && asset.subcategory_id !== subcategory) return false;
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
        <div className="grid gap-2 border-b border-white/10 p-4 md:grid-cols-[minmax(0,1fr)_220px_220px]">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Assets Shop" className="w-full border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" />
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full border border-white/10 bg-black/30 px-3 py-3 text-sm text-white">
            <option value="all">All categories</option>
            {categories.map((item) => <option key={item.id} value={item.id}>{item.label_en || item.label_fr || item.key}</option>)}
          </select>
          <select value={subcategory} onChange={(event) => setSubcategory(event.target.value)} className="w-full border border-white/10 bg-black/30 px-3 py-3 text-sm text-white">
            <option value="all">All subcategories</option>
            {availableSubcategories.map((item) => <option key={item.id} value={item.id}>{item.label_en || item.label_fr || item.key}</option>)}
          </select>
        </div>
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
  const [modelParamsByKey, setModelParamsByKey] = useState({});
  const [busy, setBusy] = useState(false);
  const [regeneratingShotId, setRegeneratingShotId] = useState(null);
  const [activeShotId, setActiveShotId] = useState(null);
  const [modifyVideoPrompt, setModifyVideoPrompt] = useState('');
  const [showVaultPicker, setShowVaultPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null);
  const [showAssetsShop, setShowAssetsShop] = useState(false);
  const [showSaveVault, setShowSaveVault] = useState(false);
  const [vaultVideoUrl, setVaultVideoUrl] = useState(null);
  const [vaultSaveSource, setVaultSaveSource] = useState('shot');
  const [savingEditToVault, setSavingEditToVault] = useState(false);
  const [userEmail, setUserEmail] = useState(user?.email || null);
  const [showMyScenes, setShowMyScenes] = useState(false);
  const [savedScenes, setSavedScenes] = useState([]);
  const [loadingScenes, setLoadingScenes] = useState(false);
  const [promptEdits, setPromptEdits] = useState({});
  const [selectedScenePassage, setSelectedScenePassage] = useState(null);
  const [quickAddCharacterId, setQuickAddCharacterId] = useState('');
  const [quickAddText, setQuickAddText] = useState('');
  const [editClips, setEditClips] = useState([]);
  const [selectedEditClipId, setSelectedEditClipId] = useState(null);
  const [editRatio, setEditRatio] = useState('16:9');
  const [editMusic, setEditMusic] = useState({ url: '', name: '', volume: 0.55, start: 0, trim_start: 0, trim_end: 0, duration: 0, loop: false, fade_in: 0, fade_out: 0 });
  const [editPlayhead, setEditPlayhead] = useState(0);
  const [editTimelineZoom, setEditTimelineZoom] = useState(1);
  const [editTimelineViewportWidth, setEditTimelineViewportWidth] = useState(0);
  const [editPlaying, setEditPlaying] = useState(false);
  const [editUndoStack, setEditUndoStack] = useState([]);
  const [exportingEdit, setExportingEdit] = useState(false);
  const editTimelineEngineRef = useRef(null);
  const editTimelineViewportRef = useRef(null);

  useEffect(() => {
    if (user?.email) {
      setUserEmail(user.email);
      return;
    }
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email || null)).catch(() => {});
  }, [user?.email]);

  const scenePassages = useMemo(() => String(sceneText || '')
    .split(/\n\s*\n/)
    .map((value) => value.trim())
    .filter(Boolean), [sceneText]);

  const normalizeShotCastIds = (shot, castData = cast) => {
    const ids = new Set(Array.isArray(shot?.character_ids) ? shot.character_ids : []);
    const mode = shot?.mode || (shot?.framing === 'Establishing shot' ? 'establishing' : shot?.framing === 'Insert / detail' ? 'insert' : 'standard');
    if (mode === 'standard') {
      (Array.isArray(shot?.lines) ? shot.lines : []).forEach((line) => { if (line.character_id) ids.add(line.character_id); });
      if (!ids.size && Array.isArray(shot?.characters)) {
        const legacyNames = new Set(shot.characters.map((value) => String(value).trim().toLowerCase()));
        castData.filter((member) => legacyNames.has(String(member.name || '').trim().toLowerCase())).forEach((member) => ids.add(member.id));
      }
    }
    return [...ids].filter((id) => castData.some((member) => member.id === id));
  };

  const findCharacterIdBySpeaker = (speaker, castData = cast) => {
    const key = String(speaker || '').trim().toLowerCase();
    const found = castData.find((member, index) => [member.name, `Character ${index + 1}`].filter(Boolean).some((label) => String(label).trim().toLowerCase() === key));
    return found?.id || '';
  };

  const migrateShotPlan = (shots, castData) => (Array.isArray(shots) ? shots : []).map((shot) => {
    if (Array.isArray(shot.lines)) {
      return {
        ...shot,
        mode: shot.mode || (shot.framing === 'Establishing shot' ? 'establishing' : shot.framing === 'Insert / detail' ? 'insert' : 'standard'),
        character_ids: normalizeShotCastIds(shot, castData),
        shot_references: Array.isArray(shot.shot_references) ? shot.shot_references : [],
        shot_video_references: Array.isArray(shot.shot_video_references) ? shot.shot_video_references : [],
        transition_reference_id: shot.transition_reference_id || '',
        transition_instruction: shot.transition_instruction || '',
      };
    }
    const legacyDialogue = String(shot.dialogue || '').trim();
    const legacyAction = String(shot.action || '').trim();
    const match = legacyDialogue.match(/^([^:\n]{1,80}):\s*(.+)$/s);
    const characterId = match ? findCharacterIdBySpeaker(match[1], castData) : normalizeShotCastIds(shot, castData)[0] || '';
    const legacyMode = shot.framing === 'Establishing shot' ? 'establishing' : shot.framing === 'Insert / detail' ? 'insert' : 'standard';
    return {
      ...shot,
      mode: legacyMode,
      character_ids: normalizeShotCastIds(shot, castData),
      lines: legacyMode === 'standard' && (legacyDialogue || legacyAction) ? [{
        id: crypto.randomUUID(),
        character_id: characterId,
        dialogue: match ? match[2].trim() : legacyDialogue,
        emotion: '',
        action: legacyAction,
      }] : [],
      shot_references: [],
      shot_video_references: [],
      transition_reference_id: '',
      transition_instruction: '',
      description: legacyMode !== 'standard' ? (legacyAction || legacyDialogue) : '',
    };
  });

  const loadMyScenes = async () => {
    setLoadingScenes(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const ownerId = authData.user?.id;
      if (!ownerId) throw new Error('You must be signed in to open My Scenes.');
      const { data, error } = await supabase.from('shoot_scene').select('*').eq('user_id', ownerId).order('updated_at', { ascending: false });
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
    const restoredCast = Array.isArray(scene.cast_data) ? scene.cast_data : [];
    const restoredShots = migrateShotPlan(scene?.shot_plan, restoredCast);
    const restoredStatus = scene?.status || 'setup';
    const canShoot = ['approved', 'shooting', 'completed'].includes(restoredStatus);
    setSceneId(scene.id);
    setTitle(scene.title || 'Untitled scene');
    setAspectRatio(scene.aspect_ratio || '16:9');
    setCast(restoredCast);
    setSetReference(scene.set_reference || { name: '', url: '', description: '' });
    setSceneText(scene.scene_text || '');
    setShotPlan(restoredShots);
    setApproved(canShoot);
    setActiveShotId(restoredShots[0]?.id || null);
    setPromptEdits({});
    setSelectedScenePassage(null);
    setEditClips([]);
    setSelectedEditClipId(null);
    setEditPlayhead(0);
    setStep(restoredStatus === 'planned' ? 'plan' : (canShoot ? 'shoot' : 'setup'));
    setShowMyScenes(false);
    toast.success('Scene restored');
  };

  const activeShot = shotPlan.find((shot) => shot.id === activeShotId) || shotPlan[0] || null;
  const shotCast = (shot) => normalizeShotCastIds(shot).map((id) => cast.find((member) => member.id === id)).filter(Boolean);
  const shotMode = (shot) => shot?.mode || 'standard';
  const quoteService = 'generateVideo:video';
  const modelDiscoveryInput = useMemo(() => ({
    duration: Number(activeShot?.duration || 5),
    aspect_ratio: aspectRatio,
    prompt: activeShot ? `${activeShot.framing || 'Medium shot'}. ${activeShot.description || ''} ${shotDialogueText(activeShot)}`.trim() : '',
    reference_images: activeShot ? [setReference.url, ...shotCast(activeShot).map((member) => member.reference_url), ...(activeShot.shot_references || []).map((ref) => ref.url)].filter(Boolean) : [setReference.url].filter(Boolean),
  }), [activeShot, aspectRatio, cast, setReference.url]);
  const { options: modelOptions, loading: modelsLoading } = useAiModelOptions({ service: quoteService, kind: 'video', input: modelDiscoveryInput });
  const effectiveModel = selectedModel || modelOptions.find((item) => item.recommended)?.model_key || modelOptions[0]?.model_key || null;
  const effectiveModelOption = modelOptions.find((item) => item.model_key === effectiveModel) || null;
  const modelParams = effectiveModel ? (modelParamsByKey[effectiveModel] || {}) : {};
  const durationBinding = getMappedModelField(effectiveModelOption, 'duration');
  const durationField = durationBinding?.schema || {};
  const modelDurationMin = Number.isFinite(Number(durationField.minimum)) ? Number(durationField.minimum) : 3;
  const modelDurationMax = Number.isFinite(Number(durationField.maximum)) ? Number(durationField.maximum) : 15;
  const normalizeVideoDuration = (value) => Math.max(modelDurationMin, Math.min(modelDurationMax, Number(value) || modelDurationMin));
  const aspectBinding = getMappedModelField(effectiveModelOption, 'aspect_ratio');
  const modelAspectRatios = Array.isArray(aspectBinding?.schema?.enum) && aspectBinding.schema.enum.length ? aspectBinding.schema.enum.map(String) : RATIOS.map((ratio) => ratio.id);
  const referenceBinding = getMappedModelField(effectiveModelOption, 'reference_images');
  const modelReferenceMax = Number.isFinite(Number(referenceBinding?.schema?.maxItems)) ? Number(referenceBinding.schema.maxItems) : 7;
  const resolutionBinding = getMappedModelField(effectiveModelOption, 'resolution');
  const resolutionOptions = Array.isArray(resolutionBinding?.schema?.enum) ? resolutionBinding.schema.enum.map(String) : [];
  const resolutionValue = resolutionBinding ? (modelParams[resolutionBinding.name] ?? resolutionBinding.schema?.default ?? resolutionOptions[0] ?? '') : '';
  const audioBinding = getMappedModelField(effectiveModelOption, 'generate_audio');
  const audioValue = audioBinding ? Boolean(modelParams[audioBinding.name] ?? audioBinding.schema?.default ?? false) : false;
  const referenceVideoBinding = getMappedModelField(effectiveModelOption, 'reference_videos');
  const referenceVideoMax = Number.isFinite(Number(referenceVideoBinding?.schema?.maxItems)) ? Number(referenceVideoBinding.schema.maxItems) : 5;
  const activeVideoReferenceUrls = (Array.isArray(activeShot?.shot_video_references) ? activeShot.shot_video_references : []).map((ref) => ref?.url).filter(Boolean).slice(0, referenceVideoMax);
  const systemModelInput = useMemo(() => ({
    duration: normalizeVideoDuration(activeShot?.duration || 5),
    aspect_ratio: aspectRatio,
    prompt: modelDiscoveryInput.prompt,
    reference_images: modelDiscoveryInput.reference_images.slice(0, modelReferenceMax),
  }), [activeShot?.duration, aspectRatio, modelDiscoveryInput.prompt, modelDiscoveryInput.reference_images, modelDurationMin, modelDurationMax, modelReferenceMax]);
  const pricingModelParams = useMemo(() => {
    const next = { ...modelParams };
    if (resolutionBinding && resolutionValue) next[resolutionBinding.name] = resolutionValue;
    if (audioBinding) next[audioBinding.name] = audioValue;
    if (referenceVideoBinding) next[referenceVideoBinding.name] = activeVideoReferenceUrls;
    return next;
  }, [modelParams, resolutionBinding?.name, resolutionValue, audioBinding?.name, audioValue, referenceVideoBinding?.name, activeVideoReferenceUrls.join('|')]);
  const pricingInput = useMemo(() => buildModelToolInput(effectiveModelOption, pricingModelParams, systemModelInput), [effectiveModelOption, pricingModelParams, systemModelInput]);
  const { quote: priceQuote } = useAiPriceQuote({ service: quoteService, kind: 'video', input: pricingInput, modelKey: effectiveModel });

  const updateCast = (id, patch) => setCast((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const updateShot = (id, patch) => setShotPlan((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  const updateBeat = (shotId, beatId, patch) => setShotPlan((items) => items.map((shot) => shot.id === shotId ? { ...shot, lines: (shot.lines || []).map((line) => line.id === beatId ? { ...line, ...patch } : line) } : shot));
  const updateModelParam = (name, value) => { if (!effectiveModel) return; setModelParamsByKey((current) => { const next = { ...(current[effectiveModel] || {}) }; if (value === undefined || value === null || value === '') delete next[name]; else next[name] = value; return { ...current, [effectiveModel]: next }; }); };

  const setShotMode = (shot, mode) => {
    const patch = { mode };
    if (mode === 'establishing') { patch.framing = 'Establishing shot'; patch.character_ids = []; }
    if (mode === 'insert') { patch.framing = 'Insert / detail'; patch.character_ids = []; }
    if (mode === 'standard' && !STANDARD_SHOT_TYPES.includes(shot.framing)) patch.framing = 'Medium shot';
    updateShot(shot.id, patch);
  };

  const characterIdsForPassage = (passage) => {
    const clean = cleanScenePassage(passage).toLowerCase();
    return cast.filter((member, index) => [member.name, `Character ${index + 1}`].filter(Boolean).some((label) => clean.includes(String(label).toLowerCase()))).map((member) => member.id);
  };

  const addShot = async () => {
    if (selectedScenePassage === null || !scenePassages[selectedScenePassage]) {
      toast.error('Select a Scene passage first.');
      return;
    }
    const source = cleanScenePassage(scenePassages[selectedScenePassage]);
    const match = source.match(/^([^:\n]{1,80}):\s*(.+)$/s);
    const detectedIds = characterIdsForPassage(source);
    const speakerId = match ? findCharacterIdBySpeaker(match[1]) : detectedIds[0] || '';
    const shot = {
      ...newShot(shotPlan.length),
      character_ids: detectedIds,
      lines: [{ ...newBeat(speakerId), dialogue: match ? match[2].trim() : '', action: match ? '' : source }],
      duration: match ? fittedDuration(match[2]) : 5,
    };
    const nextShots = [...shotPlan, shot];
    setShotPlan(nextShots);
    setActiveShotId(shot.id);
    setApproved(false);
    setStep('plan');
    try {
      await saveScene({ shot_plan: nextShots, status: 'planned' });
      toast.success(`${shot.label} added`);
    } catch (error) {
      toast.error(error.message || 'Shot could not be saved.');
    }
  };

  const startManualCuts = async () => {
    setShotPlan([]);
    setActiveShotId(null);
    setApproved(false);
    setPromptEdits({});
    setSelectedScenePassage(null);
    setEditClips([]);
    setSelectedEditClipId(null);
    setEditPlayhead(0);
    setStep('plan');
    try {
      await saveScene({ shot_plan: [], status: 'planned' });
      toast.success('Old shot plan removed. Select a Scene passage to create your first shot.');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const toggleShotCharacter = async (shot, memberId) => {
    const current = normalizeShotCastIds(shot);
    const exists = current.includes(memberId);
    const nextCharacterIds = exists ? current.filter((id) => id !== memberId) : [...current, memberId];
    const previousShots = shotPlan;
    const nextShots = shotPlan.map((item) => item.id === shot.id ? { ...item, character_ids: nextCharacterIds } : item);
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

  const uploadVideoReference = async (file, target) => {
    if (!file) return;
    const { data: authData } = await supabase.auth.getUser();
    const owner = authData.user?.id || 'public';
    const extension = file.name?.split('.').pop() || 'mp4';
    const folder = target?.type === 'shot-video-replacement' ? 'replacements' : 'video-references';
    const path = `${owner}/shoot/${folder}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from('media').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined });
    if (error) throw error;
    const { data } = supabase.storage.from('media').getPublicUrl(path);
    await applyPickedVideoReference(data.publicUrl, file.name, target);
  };

  const applyPickedImage = (url, name, target = pickerTarget) => {
    if (!url || !target) return;
    if (target.type === 'cast') updateCast(target.id, { reference_url: url });
    if (target.type === 'set') setSetReference((value) => ({ ...value, url, name: value.name || name || 'Set' }));
    if (target.type === 'shot-reference') {
      setShotPlan((items) => items.map((shot) => {
        if (shot.id !== target.shotId) return shot;
        const currentRefs = Array.isArray(shot.shot_references) ? shot.shot_references : [];
        const baseReferenceCount = (setReference.url ? 1 : 0) + shotCast(shot).filter((member) => member.reference_url).length;
        if (baseReferenceCount + currentRefs.length >= modelReferenceMax) return shot;
        return { ...shot, shot_references: [...currentRefs, { id: crypto.randomUUID(), name: name || `Shot reference ${currentRefs.length + 1}`, url }] };
      }));
    }
    if (target.type === 'music') setEditMusic((value) => ({ ...value, url, name: name || 'Vault music', start: 0, trim_start: 0, trim_end: 0, duration: 0, loop: false, fade_in: 0, fade_out: 0 }));
    setShowVaultPicker(false);
    setShowAssetsShop(false);
    setPickerTarget(null);
  };

  const replaceShotResult = async (shotId, url) => {
    if (!shotId || !url) return;
    const nextShots = shotPlan.map((shot) => shot.id === shotId ? { ...shot, result_url: url } : shot);
    setShotPlan(nextShots);
    setEditClips([]);
    setSelectedEditClipId(null);
    setEditPlayhead(0);
    const currentScene = sceneId || (await saveScene({ shot_plan: nextShots, status: 'shooting' })).id;
    const { error } = await supabase.from('shoot_scene').update({ shot_plan: nextShots, status: 'shooting', updated_at: new Date().toISOString() }).eq('id', currentScene);
    if (error) throw error;
    toast.success('Shot video replaced');
  };

  const applyPickedVideoReference = async (url, name, target = pickerTarget) => {
    if (!url || !target) return;
    if (target.type === 'shot-video-replacement') {
      try {
        await replaceShotResult(target.shotId, url);
        setShowVaultPicker(false);
        setPickerTarget(null);
      } catch (error) {
        toast.error(error?.message || 'Shot video could not be replaced.');
      }
      return;
    }
    if (target.type !== 'shot-video-reference') return;
    setShotPlan((items) => items.map((shot) => {
      if (shot.id !== target.shotId) return shot;
      const currentRefs = Array.isArray(shot.shot_video_references) ? shot.shot_video_references : [];
      if (!referenceVideoBinding || currentRefs.length >= referenceVideoMax) return shot;
      return { ...shot, shot_video_references: [...currentRefs, { id: crypto.randomUUID(), name: name || `Video reference ${currentRefs.length + 1}`, url }] };
    }));
    setShowVaultPicker(false);
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
    const query = sceneId ? supabase.from('shoot_scene').update(payload).eq('id', sceneId).select('*').single() : supabase.from('shoot_scene').insert(payload).select('*').single();
    const { data, error } = await query;
    if (error) throw error;
    setSceneId(data.id);
    return data;
  };

  const startNewScene = async () => {
    const hasCurrentScene = Boolean(sceneId || title.trim() !== 'Untitled scene' || sceneText.trim() || shotPlan.length || setReference.url || cast.some((member) => member.reference_url || member.voice_or_sound || member.manner || member.description));
    if (hasCurrentScene) {
      const completed = shotPlan.length > 0 && shotPlan.every((shot) => shot.result_url);
      try {
        await saveScene({ status: completed ? 'completed' : (approved ? 'approved' : (shotPlan.length ? 'planned' : 'setup')) });
      } catch (error) {
        toast.error(error.message || 'Current scene could not be saved.');
        return;
      }
    }
    setSceneId(null);
    setTitle('Untitled scene');
    setCast([newCastMember(0), newCastMember(1)]);
    setSetReference({ name: '', url: '', description: '' });
    setSceneText('');
    setAspectRatio('16:9');
    setShotPlan([]);
    setApproved(false);
    setActiveShotId(null);
    setPromptEdits({});
    setSelectedScenePassage(null);
    setEditClips([]);
    setSelectedEditClipId(null);
    setEditMusic({ url: '', name: '', volume: 0.55, start: 0, trim_start: 0, trim_end: 0, duration: 0, loop: false, fade_in: 0, fade_out: 0 });
    setEditPlayhead(0);
    setEditTimelineZoom(1);
    setEditPlaying(false);
    setEditUndoStack([]);
    setEditRatio('16:9');
    setShowMyScenes(false);
    setStep('setup');
    toast.success(hasCurrentScene ? 'Scene saved. New scene ready.' : 'New scene ready.');
  };

  const shotReferences = (shot) => {
    const refs = [];
    if (setReference.url) refs.push({ role: 'SET REFERENCE', url: setReference.url, member: null, shotReference: null });
    shotCast(shot).filter((member) => member.reference_url).forEach((member, index) => refs.push({ role: `CHARACTER ${index + 1} REFERENCE`, url: member.reference_url, member, shotReference: null }));
    (Array.isArray(shot.shot_references) ? shot.shot_references : []).filter((ref) => ref.url).forEach((shotReference) => refs.push({ role: 'SHOT VISUAL REFERENCE', url: shotReference.url, member: null, shotReference }));
    return refs.slice(0, modelReferenceMax);
  };

  const shotReferenceUrls = (shot) => shotReferences(shot).map((ref) => ref.url);

  const buildShotPrompt = (shot) => {
    const refs = shotReferences(shot);
    const characterRefs = refs.filter((ref) => ref.member);
    const roleById = new Map(characterRefs.map((ref) => [ref.member.id, ref.role.replace(' REFERENCE', '')]));
    const imageNumberByShotReferenceId = new Map(refs.map((ref, index) => [ref.shotReference?.id, index + 1]).filter(([id]) => id));
    const referenceRules = refs.map((ref, index) => {
      if (ref.shotReference) return `SHOT VISUAL REFERENCE = Image ${index + 1}. Use Image ${index + 1} exactly as supplied when the shot instructions call for it. Do not redesign, reinterpret or replace its visible content.`;
      if (!ref.member) return `${ref.role} = Image ${index + 1}. Use this exact set as the physical location master. Do not redesign, reinterpret, move, remove, resize, recolor or substitute architecture, furniture, props, materials or lighting fixtures.`;
      const member = ref.member;
      const voice = member.voice_or_sound ? ` BASE VOICE / SOUND: ${member.voice_or_sound}.` : '';
      const manner = member.manner ? ` BASE PERFORMANCE: ${member.manner}.` : '';
      const notes = member.description ? ` CHARACTER NOTES: ${member.description}.` : '';
      return `${ref.role} = Image ${index + 1}. Use this exact character reference. Do not invent or redescribe appearance, face, hair, body, wardrobe or accessories. The image is authoritative.${voice}${manner}${notes}`;
    }).join(' ');
    const framingRule = `FRAMING LOCK: ${shot.framing} is mandatory. Do not substitute a different shot size, angle or composition.`;
    let contentRule = '';
    if (shotMode(shot) === 'standard') {
      const beats = (shot.lines || []).map((line, index) => {
        const role = roleById.get(line.character_id) || 'UNASSIGNED CHARACTER';
        const dialogue = line.dialogue ? ` DIALOGUE: ${line.dialogue}.` : '';
        const emotion = line.emotion ? ` DELIVERY / EMOTION: ${line.emotion}. Apply this only to this beat while preserving the base voice identity.` : '';
        const action = line.action ? ` ACTION: ${line.action}.` : '';
        return `BEAT ${index + 1}: ${role}.${dialogue}${emotion}${action}`;
      }).join(' ');
      contentRule = `${beats} Execute beats in listed order. Only a character assigned dialogue moves their mouth during that beat; other visible characters remain silent and may react.`;
    } else {
      const label = shotMode(shot) === 'establishing' ? 'ESTABLISHING DESCRIPTION' : 'INSERT DESCRIPTION';
      contentRule = `${label}: ${shot.description || 'No description specified.'}`;
    }
    const transitionImageNumber = imageNumberByShotReferenceId.get(shot.transition_reference_id);
    const transitionRule = transitionImageNumber && String(shot.transition_instruction || '').trim() ? ` TRANSITION: After the listed shot action/beats, ${String(shot.transition_instruction).trim()} to Image ${transitionImageNumber}. Image ${transitionImageNumber} becomes the specified visual target; do not substitute another image.` : '';
    return `${referenceRules} ${framingRule} ${contentRule}${transitionRule} ${shot.camera ? `CAMERA NOTES: ${shot.camera}.` : ''} ${shot.sound ? `SOUND / AMBIENCE: ${shot.sound}.` : ''} Preserve exact reference identities, exact set continuity, wardrobe, eyelines and screen direction. Duration ${shot.duration} seconds.`;
  };

  const finalPromptForShot = (shot) => promptEdits[shot.id] ?? buildShotPrompt(shot);

  const invokeGenerateVideo = async (body, headers = undefined) => {
    const { data, error } = await supabase.functions.invoke('generateVideo', { body, ...(headers ? { headers } : {}) });
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
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const generateShot = async (shot) => {
    if (!sceneId) {
      try { await saveScene({ status: 'approved' }); } catch (error) { return toast.error(error.message); }
    }
    const selectedCast = shotCast(shot);
    if (shot.framing === 'Over-the-shoulder' && selectedCast.length < 2) return toast.error('Over-the-shoulder requires two selected characters.');
    if (selectedCast.some((member) => !member.reference_url)) return toast.error('Every selected character needs a reference image.');
    if (!setReference.url) return toast.error('Add a set reference before generating this shot.');
    if (shotMode(shot) === 'standard') {
      const incompleteBeat = (shot.lines || []).find((line) => (line.dialogue || line.action) && !line.character_id);
      if (incompleteBeat) return toast.error('Every active dialogue/action line must be assigned to a character.');
    }
    if (shot.transition_reference_id && !shotReferences(shot).some((ref) => ref.shotReference?.id === shot.transition_reference_id)) return toast.error('The selected transition reference is no longer available.');
    const finalPrompt = finalPromptForShot(shot).trim();
    if (!finalPrompt) return toast.error('Final prompt cannot be empty.');
    const speechSeconds = estimatedSpeechSeconds(shotDialogueText(shot));
    if (speechSeconds > Number(shot.duration || 0)) return toast.error(`Dialogue needs about ${Math.ceil(speechSeconds)}s but this shot is ${shot.duration}s. Increase duration or shorten the dialogue.`);
    setBusy(true);
    setRegeneratingShotId(shot.result_url ? shot.id : null);
    setActiveShotId(shot.id);
    try {
      const refs = shotReferenceUrls(shot);
      const shotVideoUrls = (Array.isArray(shot.shot_video_references) ? shot.shot_video_references : []).map((ref) => ref?.url).filter(Boolean).slice(0, referenceVideoMax);
      const generationModelParams = { ...modelParams };
      if (resolutionBinding && resolutionValue) generationModelParams[resolutionBinding.name] = resolutionValue;
      if (audioBinding) generationModelParams[audioBinding.name] = audioValue;
      if (referenceVideoBinding) generationModelParams[referenceVideoBinding.name] = shotVideoUrls;
      const effectiveInput = buildModelToolInput(effectiveModelOption, generationModelParams, {
        duration: normalizeVideoDuration(shot.duration),
        aspect_ratio: aspectRatio,
        prompt: finalPrompt,
        reference_images: refs.slice(0, modelReferenceMax),
      });
      const startData = await invokeGenerateVideo({
        async_mode: true,
        prompt: finalPrompt,
        reference_image_urls: refs.slice(0, modelReferenceMax),
        duration: normalizeVideoDuration(shot.duration),
        aspect_ratio: aspectRatio,
        engine: 'video',
        model_key: effectiveModel || undefined,
        model_input: effectiveInput,
      }, { 'x-idempotency-key': crypto.randomUUID() });

      if (!startData?.prediction_id) throw new Error('Video job did not start.');

      let statusData = startData;
      while (statusData?.status !== 'succeeded') {
        await sleep(5000);
        statusData = await invokeGenerateVideo({
          action: 'status',
          prediction_id: startData.prediction_id,
          credit_charge: startData.credit_charge,
          lineage_inputs: startData.lineage_inputs,
        });
        if (['failed', 'canceled', 'aborted'].includes(statusData?.status)) {
          throw new Error(statusData?.error || `Video generation ${statusData.status}`);
        }
      }

      const url = statusData?.file_url;
      if (!url) throw new Error('No video returned.');
      const nextShots = shotPlan.map((item) => item.id === shot.id ? { ...item, result_url: url } : item);
      setShotPlan(nextShots);
      setEditClips([]);
      setSelectedEditClipId(null);
      setEditPlayhead(0);
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

  const modifyActiveShotVideo = async (shot) => {
    if (!shot?.result_url) return toast.error('Generate this shot before modifying it.');
    if (!modifyVideoPrompt.trim()) return toast.error('Describe what to change.');
    setBusy(true);
    try {
      const startData = await invokeGenerateVideo({
        async_mode: true,
        engine: 'kling_video_edit',
        video_url: shot.result_url,
        prompt: modifyVideoPrompt.trim(),
      }, { 'x-idempotency-key': crypto.randomUUID() });
      if (!startData?.prediction_id) throw new Error('Video job did not start.');
      let statusData = startData;
      while (statusData?.status !== 'succeeded') {
        await sleep(5000);
        statusData = await invokeGenerateVideo({
          action: 'status',
          prediction_id: startData.prediction_id,
          credit_charge: startData.credit_charge,
          lineage_inputs: startData.lineage_inputs,
        });
        if (['failed', 'canceled', 'aborted'].includes(statusData?.status)) {
          throw new Error(statusData?.error || `Video generation ${statusData.status}`);
        }
      }
      const url = statusData?.file_url;
      if (!url) throw new Error('No video returned.');
      const nextShots = shotPlan.map((item) => item.id === shot.id ? { ...item, result_url: url } : item);
      setShotPlan(nextShots);
      const currentScene = sceneId || (await saveScene({ shot_plan: nextShots, status: 'shooting' })).id;
      const { error: updateError } = await supabase.from('shoot_scene').update({ shot_plan: nextShots, status: 'shooting', updated_at: new Date().toISOString() }).eq('id', currentScene);
      if (updateError) throw updateError;
      setModifyVideoPrompt('');
      toast.success('Video modified');
    } catch (error) {
      toast.error(error?.message || 'Video modification failed');
    } finally {
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

  const buildDefaultEditorClips = () => shotPlan.filter((shot) => shot.result_url).map((shot) => ({ id: crypto.randomUUID(), shot_id: shot.id, label: shot.label, url: shot.result_url, source_duration: null, trim_start: 0, trim_end: 0, expand_trim_to_source_on_load: true, scale: 1, x: 0, y: 0, volume: 1, muted: false }));
  const editClipDuration = (clip) => Math.max(0.05, Number(clip?.trim_end || 0) - Number(clip?.trim_start || 0));
  const editTimelineDuration = editClips.reduce((sum, clip) => sum + editClipDuration(clip), 0);
  const editTimelineTick = editTimelineZoom >= 2 ? 0.5 : 1;
  const editTimelineWidth = Math.max(1, editTimelineViewportWidth || 1) * editTimelineZoom;
  const editTimelinePixelsPerSecond = editTimelineDuration > 0 ? editTimelineWidth / editTimelineDuration : 0;
  const editClipStart = (id) => {
    let total = 0;
    for (const clip of editClips) {
      if (clip.id === id) return total;
      total += editClipDuration(clip);
    }
    return 0;
  };
  const editLocationAt = (time) => {
    const safe = Math.max(0, Math.min(Number(time || 0), Math.max(0, editTimelineDuration)));
    let cursor = 0;
    for (let index = 0; index < editClips.length; index += 1) {
      const clip = editClips[index];
      const duration = editClipDuration(clip);
      const end = cursor + duration;
      if (safe < end || index === editClips.length - 1) return { clip, index, start: cursor, end, local: Math.max(0, Math.min(duration, safe - cursor)) };
      cursor = end;
    }
    return null;
  };

  useEffect(() => {
    if (step !== 'edit') return undefined;
    const node = editTimelineViewportRef.current;
    if (!node) return undefined;
    const updateWidth = () => setEditTimelineViewportWidth(node.clientWidth || 0);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, [step]);

  const openEditor = () => {
    if (!shotPlan.some((shot) => shot.result_url)) return toast.error('Generate at least one shot before editing.');
    const savedTimeline = Array.isArray(shotPlan[0]?.editor_timeline) ? shotPlan[0].editor_timeline.filter((clip) => clip?.url) : [];
    const syncedTimeline = savedTimeline.map((clip) => {
      const sourceShot = shotPlan.find((shot) => shot.id === clip.shot_id);
      return sourceShot?.result_url && sourceShot.result_url !== clip.url
        ? { ...clip, url: sourceShot.result_url, source_duration: null, expand_trim_to_source_on_load: Math.abs(Number(clip.trim_start || 0)) < 0.02 && Math.abs(Number(clip.trim_end || 0) - Number(clip.source_duration || clip.trim_end || 0)) < 0.02 }
        : (clip.source_duration == null ? { ...clip, expand_trim_to_source_on_load: true } : clip);
    });
    const existingShotIds = new Set(syncedTimeline.map((clip) => clip.shot_id).filter(Boolean));
    const missingGeneratedClips = buildDefaultEditorClips().filter((clip) => !existingShotIds.has(clip.shot_id));
    const next = syncedTimeline.length ? [...syncedTimeline, ...missingGeneratedClips] : missingGeneratedClips;
    setEditClips(next);
    setSelectedEditClipId(next[0]?.id || null);
    setEditPlayhead(0);
    setEditTimelineZoom(1);
    setEditPlaying(false);
    setEditUndoStack([]);
    setEditRatio(shotPlan[0]?.editor_ratio || aspectRatio || '16:9');
    setEditMusic({ url: '', name: '', volume: 0.55, start: 0, trim_start: 0, trim_end: 0, duration: 0, loop: false, fade_in: 0, fade_out: 0, ...(shotPlan[0]?.editor_music || {}) });
    setStep('edit');
  };

  const selectedEditClip = editClips.find((clip) => clip.id === selectedEditClipId) || editClips[0] || null;
  const selectedEditClipIndex = selectedEditClip ? editClips.findIndex((clip) => clip.id === selectedEditClip.id) : -1;
  const rememberEdit = () => setEditUndoStack((stack) => [...stack.slice(-49), { clips: editClips.map((clip) => ({ ...clip })), selectedId: selectedEditClipId }]);
  const updateEditClip = (id, patch, remember = true) => { if (remember) rememberEdit(); setEditClips((items) => items.map((clip) => clip.id === id ? { ...clip, ...patch } : clip)); };
  const syncEditClipMediaDuration = (clip, rawDuration) => { const duration = Number(rawDuration); if (!Number.isFinite(duration) || duration <= 0) return; const oldSourceDuration = Number(clip.source_duration || 0); const wasFullLength = Math.abs(Number(clip.trim_start || 0)) < 0.02 && oldSourceDuration > 0 && Math.abs(Number(clip.trim_end || 0) - oldSourceDuration) < 0.02; updateEditClip(clip.id, (clip.expand_trim_to_source_on_load || clip.source_duration == null || wasFullLength) ? { source_duration: duration, trim_end: duration, expand_trim_to_source_on_load: false } : { source_duration: duration, trim_end: Math.min(Number(clip.trim_end || duration), duration) }, false); };
  const undoEdit = () => setEditUndoStack((stack) => {
    if (!stack.length) return stack;
    const previous = stack[stack.length - 1];
    setEditClips(previous.clips);
    setSelectedEditClipId(previous.selectedId || previous.clips[0]?.id || null);
    setEditPlayhead((value) => Math.min(value, previous.clips.reduce((sum, clip) => sum + editClipDuration(clip), 0)));
    return stack.slice(0, -1);
  });

  useEffect(() => {
    if (step !== 'edit') return undefined;
    const handleUndoKey = (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== 'z') return;
      const target = event.target;
      if (target?.matches?.('input, textarea, select') || target?.isContentEditable) return;
      event.preventDefault();
      undoEdit();
    };
    window.addEventListener('keydown', handleUndoKey);
    return () => window.removeEventListener('keydown', handleUndoKey);
  }, [step, editUndoStack, editClips, selectedEditClipId]);

  const persistEditorTimeline = async (clips, music = editMusic, ratio = editRatio) => {
    if (!shotPlan.length) return;
    const nextShots = shotPlan.map((shot, index) => index === 0 ? { ...shot, editor_timeline: clips, editor_music: music, editor_ratio: ratio } : shot);
    setShotPlan(nextShots);
    try {
      if (sceneId) {
        const { error } = await supabase.from('shoot_scene').update({ shot_plan: nextShots, updated_at: new Date().toISOString() }).eq('id', sceneId);
        if (error) throw error;
      } else await saveScene({ shot_plan: nextShots });
    } catch (error) {
      toast.error(error.message || 'Timeline could not be saved.');
    }
  };

  const deleteEditClip = (id) => {
    const index = editClips.findIndex((clip) => clip.id === id);
    if (index < 0) return;
    rememberEdit();
    const nextSelectedId = editClips[index + 1]?.id || editClips[index - 1]?.id || null;
    const next = editClips.filter((item) => item.id !== id);
    setEditClips(next);
    void persistEditorTimeline(next);
    if (selectedEditClipId === id) setSelectedEditClipId(nextSelectedId);
  };

  const moveEditClip = (id, direction) => {
    const index = editClips.findIndex((clip) => clip.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= editClips.length) return;
    rememberEdit();
    const next = [...editClips];
    [next[index], next[target]] = [next[target], next[index]];
    setEditClips(next);
    void persistEditorTimeline(next);
  };

  const seekEditorPlayhead = (time) => {
    if (!editClips.length) return;
    const safe = Math.max(0, Math.min(Number(time || 0), Math.max(0, editTimelineDuration)));
    const location = editLocationAt(safe);
    setEditPlayhead(safe);
    if (location?.clip?.id) setSelectedEditClipId(location.clip.id);
    void editTimelineEngineRef.current?.seek(safe, editPlaying);
  };

  const playEditTimeline = () => {
    if (!editClips.length) return;
    void editTimelineEngineRef.current?.play(editPlayhead);
  };

  const pauseEditTimeline = () => {
    editTimelineEngineRef.current?.pause();
  };

  const splitEditClip = () => {
    const location = editLocationAt(editPlayhead);
    const clip = location?.clip;
    if (!clip) return;
    const at = Number(clip.trim_start || 0) + Number(location.local || 0);
    if (at <= Number(clip.trim_start) + 0.05 || at >= Number(clip.trim_end) - 0.05) return toast.error('Move the playhead inside the trimmed clip before splitting.');
    const left = { ...clip, id: crypto.randomUUID(), trim_end: at, label: `${clip.label} A` };
    const right = { ...clip, id: crypto.randomUUID(), trim_start: at, label: `${clip.label} B` };
    rememberEdit();
    const index = editClips.findIndex((item) => item.id === clip.id);
    const next = [...editClips.slice(0, index), left, right, ...editClips.slice(index + 1)];
    setEditClips(next);
    void persistEditorTimeline(next);
    setSelectedEditClipId(right.id);
  };

  const uploadEditorMusic = async (file) => {
    if (!file) return;
    try {
      const { data: authData } = await supabase.auth.getUser();
      const owner = authData.user?.id || 'public';
      const extension = file.name?.split('.').pop() || 'mp3';
      const path = `${owner}/shoot/music/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from('media').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined });
      if (error) throw error;
      const { data } = supabase.storage.from('media').getPublicUrl(path);
      setEditMusic((value) => ({ ...value, url: data.publicUrl, name: file.name, start: 0, trim_start: 0, trim_end: 0, duration: 0, loop: false, fade_in: 0, fade_out: 0 }));
      toast.success('Music added');
    } catch (error) {
      toast.error(error.message || 'Music upload failed.');
    }
  };

  const saveEditor = async () => {
    if (!shotPlan.length) return;
    const nextShots = shotPlan.map((shot, index) => index === 0 ? { ...shot, editor_timeline: editClips, editor_music: editMusic, editor_ratio: editRatio } : shot);
    setShotPlan(nextShots);
    try {
      if (sceneId) {
        const { error } = await supabase.from('shoot_scene').update({ shot_plan: nextShots, updated_at: new Date().toISOString() }).eq('id', sceneId);
        if (error) throw error;
      } else await saveScene({ shot_plan: nextShots });
      toast.success('Edit saved');
    } catch (error) {
      toast.error(error.message || 'Edit could not be saved.');
    }
  };

  const drawVideoFrame = (ctx, canvas, video, clip) => {
    const vw = Number(video.videoWidth || canvas.width);
    const vh = Number(video.videoHeight || canvas.height);
    const base = Math.max(canvas.width / vw, canvas.height / vh);
    const scale = base * Math.max(0.25, Number(clip.scale || 1));
    const width = vw * scale;
    const height = vh * scale;
    const x = (canvas.width - width) / 2 + (Number(clip.x || 0) / 100) * (canvas.width / 2);
    const y = (canvas.height - height) / 2 + (Number(clip.y || 0) / 100) * (canvas.height / 2);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, x, y, width, height);
  };

  const renderEditTimeline = async () => {
    if (!editClips.length) throw new Error('There are no clips to export.');
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) throw new Error('This browser cannot render the edit locally.');
    let canvasStream;
    let audioContext;
    let musicElement;
    let exportVideo;
    try {
      const { width, height } = ratioSize(editRatio);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      canvasStream = canvas.captureStream(30);
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      await audioContext.resume();
      const audioDestination = audioContext.createMediaStreamDestination();
      exportVideo = document.createElement('video');
      exportVideo.crossOrigin = 'anonymous';
      exportVideo.playsInline = true;
      exportVideo.preload = 'auto';
      const videoSource = audioContext.createMediaElementSource(exportVideo);
      const videoGain = audioContext.createGain();
      videoSource.connect(videoGain).connect(audioDestination);
      let musicGain = null;
      let musicStartTimer = null;
      if (editMusic.url) {
        musicElement = document.createElement('audio');
        musicElement.crossOrigin = 'anonymous';
        musicElement.src = editMusic.url;
        musicElement.loop = Boolean(editMusic.loop);
        musicElement.preload = 'auto';
        await new Promise((resolve, reject) => {
          const ready = () => { cleanup(); resolve(); };
          const failed = () => { cleanup(); reject(new Error('Music track could not be loaded for export.')); };
          const cleanup = () => { musicElement.removeEventListener('loadedmetadata', ready); musicElement.removeEventListener('error', failed); };
          musicElement.addEventListener('loadedmetadata', ready);
          musicElement.addEventListener('error', failed);
          musicElement.load();
        });
        const musicSource = audioContext.createMediaElementSource(musicElement);
        musicGain = audioContext.createGain();
        musicGain.gain.value = 0;
        musicSource.connect(musicGain).connect(audioDestination);
        const trimStart = Math.max(0, Number(editMusic.trim_start || 0));
        const trimEnd = Math.max(trimStart, Math.min(Number(editMusic.trim_end || musicElement.duration || 0), Number(musicElement.duration || 0)));
        musicElement.currentTime = trimStart;
        const trackStart = Math.max(0, Number(editMusic.start || 0));
        const trackLength = Math.max(0, Math.min(editTimelineDuration - trackStart, editMusic.loop ? editTimelineDuration - trackStart : trimEnd - trimStart));
        const baseVolume = Math.max(0, Math.min(1, Number(editMusic.volume || 0)));
        const fadeIn = Math.max(0, Math.min(Number(editMusic.fade_in || 0), trackLength));
        const fadeOut = Math.max(0, Math.min(Number(editMusic.fade_out || 0), trackLength));
        const startMusic = async () => {
          const now = audioContext.currentTime;
          musicGain.gain.cancelScheduledValues(now);
          musicGain.gain.setValueAtTime(fadeIn > 0 ? 0 : baseVolume, now);
          if (fadeIn > 0) musicGain.gain.linearRampToValueAtTime(baseVolume, now + fadeIn);
          if (fadeOut > 0) {
            const fadeOutAt = Math.max(now, now + trackLength - fadeOut);
            musicGain.gain.setValueAtTime(baseVolume, fadeOutAt);
            musicGain.gain.linearRampToValueAtTime(0, now + trackLength);
          }
          await musicElement.play();
          if (!editMusic.loop && trackLength > 0) setTimeout(() => musicElement.pause(), trackLength * 1000);
        };
        if (trackLength > 0) {
          if (trackStart > 0) musicStartTimer = setTimeout(() => { void startMusic(); }, trackStart * 1000);
          else await startMusic();
        }
      }
      const combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioDestination.stream.getAudioTracks()]);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm';
      const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 8000000 });
      const chunks = [];
      recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
      const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
      recorder.start(500);
      const loadVideo = (url) => new Promise((resolve, reject) => {
        const onReady = () => { cleanup(); resolve(); };
        const onError = () => { cleanup(); reject(new Error('A clip could not be loaded for export.')); };
        const cleanup = () => { exportVideo.removeEventListener('loadedmetadata', onReady); exportVideo.removeEventListener('error', onError); };
        exportVideo.addEventListener('loadedmetadata', onReady);
        exportVideo.addEventListener('error', onError);
        exportVideo.src = url;
        exportVideo.load();
      });
      for (const clip of editClips) {
        await loadVideo(clip.url);
        const trimStart = Math.max(0, Number(clip.trim_start || 0));
        const mediaDuration = Number.isFinite(exportVideo.duration) ? exportVideo.duration : Number(clip.source_duration || 5);
        const trimEnd = Math.max(trimStart + 0.05, Math.min(Number(clip.trim_end || mediaDuration), mediaDuration));
        exportVideo.currentTime = Math.min(trimStart, Math.max(0, mediaDuration - 0.05));
        await new Promise((resolve) => exportVideo.addEventListener('seeked', resolve, { once: true }));
        videoGain.gain.value = clip.muted ? 0 : Math.max(0, Math.min(1, Number(clip.volume ?? 1)));
        await exportVideo.play();
        await new Promise((resolve) => {
          const render = () => {
            drawVideoFrame(ctx, canvas, exportVideo, clip);
            if (exportVideo.currentTime >= trimEnd || exportVideo.ended) { exportVideo.pause(); resolve(); return; }
            requestAnimationFrame(render);
          };
          render();
        });
      }
      recorder.stop();
      await stopped;
      if (musicElement) musicElement.pause();
      if (musicStartTimer) clearTimeout(musicStartTimer);
      const blob = new Blob(chunks, { type: mimeType });
      return { blob, mimeType };
    } finally {
      try { exportVideo?.pause(); } catch {}
      try { musicElement?.pause(); } catch {}
      try { canvasStream?.getTracks().forEach((track) => track.stop()); } catch {}
      try { await audioContext?.close(); } catch {}
    }
  };

  const exportEditor = async () => {
    setExportingEdit(true);
    try {
      const { blob } = await renderEditTimeline();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(title || 'scene').replace(/[^a-z0-9_-]+/gi, '_')}_edit.webm`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast.success('Scene exported');
    } catch (error) {
      toast.error(error.message || 'Export failed. Some video hosts may block browser-side rendering.');
    } finally {
      setExportingEdit(false);
    }
  };

  const saveEditToVault = async () => {
    setSavingEditToVault(true);
    try {
      const { blob } = await renderEditTimeline();
      const { data: authData } = await supabase.auth.getUser();
      const owner = authData.user?.id || 'public';
      const path = `${owner}/shoot/exports/${crypto.randomUUID()}.webm`;
      const { error } = await supabase.storage.from('media').upload(path, blob, { cacheControl: '3600', upsert: false, contentType: 'video/webm' });
      if (error) throw error;
      const { data } = supabase.storage.from('media').getPublicUrl(path);
      setVaultVideoUrl(data.publicUrl);
      setVaultSaveSource('scene');
      setShowSaveVault(true);
    } catch (error) {
      toast.error(error.message || 'Could not save the edit to Vault.');
    } finally {
      setSavingEditToVault(false);
    }
  };

  const renderCharacterData = (shot) => {
    const members = shotCast(shot);
    if (!members.length) return <p className="mt-2 text-[10px] text-white/35">No character references linked to this shot.</p>;
    return <div className="mt-2 grid gap-2 md:grid-cols-2">{members.map((member, index) => <div key={member.id} className="border border-white/10 bg-black/20 p-2"><div className="flex items-center justify-between"><span className="text-xs font-bold text-white">{member.name}</span><span className="text-[9px] font-black text-[#8ee9e4]">CHARACTER {index + 1}</span></div><p className="mt-1 text-[9px] uppercase text-white/35">Base voice / sound</p><p className="text-[11px] text-white/75">{member.voice_or_sound || 'Not defined'}</p><p className="mt-1 text-[9px] uppercase text-white/35">Base performance</p><p className="text-[11px] text-white/75">{member.manner || 'Not defined'}</p></div>)}</div>;
  };

  const renderShotReferences = (shot) => {
    const refs = Array.isArray(shot.shot_references) ? shot.shot_references : [];
    const videoRefs = Array.isArray(shot.shot_video_references) ? shot.shot_video_references : [];
    const allRefs = shotReferences(shot);
    const imageNumberFor = (id) => {
      const index = allRefs.findIndex((ref) => ref.shotReference?.id === id);
      return index >= 0 ? index + 1 : null;
    };
    return <div className="mt-4 border-t border-white/10 pt-3"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#23c7be]">Shot visual references</p><p className="text-[10px] text-white/35">Optional images used only by this shot. Their Image number is the real order sent to the model.</p></div><div className="flex gap-1"><label className="cursor-pointer bg-white/10 px-3 py-2 text-[10px] font-bold"><Upload size={11} className="mr-1 inline" /> Upload<input type="file" accept="image/*" className="hidden" onChange={(event) => uploadImage(event.target.files?.[0], { type: 'shot-reference', shotId: shot.id }).catch((error) => toast.error(error.message))} /></label><button type="button" onClick={() => { setPickerTarget({ type: 'shot-reference', shotId: shot.id }); setShowVaultPicker(true); }} className="bg-white/10 px-3 py-2 text-[10px] font-bold"><Folder size={11} className="mr-1 inline" /> Vault</button><button type="button" onClick={() => { setPickerTarget({ type: 'shot-reference', shotId: shot.id }); setShowAssetsShop(true); }} className="bg-white/10 px-3 py-2 text-[10px] font-bold"><ShoppingBag size={11} className="mr-1 inline" /> Assets</button></div></div>{refs.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{refs.map((ref) => <div key={ref.id} className="border border-white/10 bg-black/20 p-2"><div className="aspect-video overflow-hidden bg-black"><img src={ref.url} alt="" className="h-full w-full object-contain" /></div><div className="mt-2 flex items-center justify-between gap-2"><div className="min-w-0"><p className="truncate text-[10px] font-bold text-white">{ref.name || 'Shot reference'}</p><p className="text-[9px] font-black text-[#8ee9e4]">IMAGE {imageNumberFor(ref.id) || '—'}</p></div><button type="button" onClick={() => updateShot(shot.id, { shot_references: refs.filter((item) => item.id !== ref.id), transition_reference_id: shot.transition_reference_id === ref.id ? '' : shot.transition_reference_id })} className="text-white/35"><Trash2 size={12} /></button></div></div>)}</div> : <p className="text-[10px] text-white/35">No additional visual reference.</p>}{refs.length > 0 && <div className="mt-3 grid gap-2 md:grid-cols-[220px_1fr]"><label className="text-[10px] font-black uppercase text-white/40">Transition target<select value={shot.transition_reference_id || ''} onChange={(event) => updateShot(shot.id, { transition_reference_id: event.target.value })} className="mt-1 w-full bg-black/30 p-2 text-xs text-white"><option value="">No transition</option>{refs.map((ref) => <option key={ref.id} value={ref.id}>Image {imageNumberFor(ref.id)} — {ref.name || 'Shot reference'}</option>)}</select></label><label className="text-[10px] font-black uppercase text-white/40">Transition instruction<input value={shot.transition_instruction || ''} onChange={(event) => updateShot(shot.id, { transition_instruction: event.target.value })} className="mt-1 w-full bg-black/30 p-2 text-xs text-white" placeholder="Example: dissolve smoothly / fade slowly / cut sharply" /></label></div>}<div className="mt-4 border-t border-white/10 pt-3"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#23c7be]">Video references</p><p className="text-[10px] text-white/35">Optional motion, camera or style references for models that support reference video input.</p></div>{referenceVideoBinding && <div className="flex gap-1"><label className="cursor-pointer bg-white/10 px-3 py-2 text-[10px] font-bold"><Upload size={11} className="mr-1 inline" /> Upload<input type="file" accept="video/mp4,video/quicktime,video/*" className="hidden" onChange={(event) => uploadVideoReference(event.target.files?.[0], { type: 'shot-video-reference', shotId: shot.id }).catch((error) => toast.error(error.message))} /></label><button type="button" onClick={() => { setPickerTarget({ type: 'shot-video-reference', shotId: shot.id }); setShowVaultPicker(true); }} className="bg-white/10 px-3 py-2 text-[10px] font-bold"><Folder size={11} className="mr-1 inline" /> Vault</button></div>}</div>{!referenceVideoBinding ? <p className="text-[10px] text-white/35">The selected model does not support reference videos.</p> : videoRefs.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{videoRefs.map((ref, index) => <div key={ref.id} className="border border-white/10 bg-black/20 p-2"><div className="aspect-video overflow-hidden bg-black"><video src={ref.url} muted preload="metadata" className="h-full w-full object-contain" /></div><div className="mt-2 flex items-center justify-between gap-2"><div className="min-w-0"><p className="truncate text-[10px] font-bold text-white">{ref.name || `Video reference ${index + 1}`}</p><p className="text-[9px] font-black text-[#8ee9e4]">VIDEO {index + 1}</p></div><button type="button" onClick={() => updateShot(shot.id, { shot_video_references: videoRefs.filter((item) => item.id !== ref.id) })} className="text-white/35"><Trash2 size={12} /></button></div></div>)}</div> : <p className="text-[10px] text-white/35">No video reference.</p>}</div></div>;
  };

  return (
    <div className={`fixed z-[100] ${embedded ? 'top-14 right-0 bottom-[64px] left-0 lg:bottom-0 lg:left-[var(--studio-toolbar-width)] overflow-y-auto bg-[#202328]' : 'inset-0 flex items-center justify-center bg-black/80 p-4'}`}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={embedded ? 'min-h-full w-full bg-[#202328] p-5 pb-28 text-white md:p-8' : 'max-h-[92vh] w-full max-w-6xl overflow-y-auto border border-white/10 bg-[#202328] p-6 text-white'}>
        <div className="mx-auto max-w-7xl">
          <header className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-[#17191d] px-4 py-4">
            <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#23c7be]/30 bg-[#23c7be]/10 text-[#23c7be]"><Camera size={20} /></div><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#23c7be]">Scene Production</p><div className="flex flex-wrap items-center gap-3"><h3 className="text-xl font-black">Shoot</h3><input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Scene name" className="min-w-[220px] max-w-[420px] flex-1 border border-white/10 bg-black/25 px-3 py-1.5 text-sm font-black text-white outline-none focus:border-[#23c7be]" placeholder="Scene name" /></div><p className="mt-1 text-xs text-white/45">Build technical shots, generate them, then finish the scene in Edit.</p></div></div>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={startNewScene} disabled={busy || exportingEdit} className="flex items-center gap-2 border border-[#23c7be]/30 bg-[#23c7be]/10 px-3 py-2 text-xs font-bold text-[#8ee9e4] hover:bg-[#23c7be]/20 disabled:opacity-50"><Plus size={14} /> New Scene</button><button type="button" onClick={openMyScenes} className={`flex items-center gap-2 border px-3 py-2 text-xs font-bold ${showMyScenes ? 'border-[#23c7be] bg-[#23c7be]/10 text-[#8ee9e4]' : 'border-white/10 bg-white/[0.05]'}`}><Folder size={14} /> My Scenes</button><button type="button" onClick={() => (step === 'edit' ? saveEditor() : saveScene().then(() => toast.success('Shoot scene saved')).catch((error) => toast.error(error.message)))} className="flex items-center gap-2 border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-bold"><Save size={14} /> Save</button>{!embedded && <button type="button" onClick={onClose} className="p-2"><X size={19} /></button>}</div>
          </header>

          {showMyScenes && <section className="mb-5 border border-white/10 bg-[#17191d] p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.15em] text-[#23c7be]">My Scenes</p><p className="text-xs text-white/45">Open one of your saved Shoot scenes.</p></div><button type="button" onClick={loadMyScenes} disabled={loadingScenes} className="bg-white/10 px-3 py-2 text-xs font-bold disabled:opacity-50">Refresh</button></div>{loadingScenes ? <div className="flex min-h-24 items-center justify-center"><Loader2 className="animate-spin text-[#23c7be]" /></div> : savedScenes.length ? <div className="grid gap-2 md:grid-cols-2">{savedScenes.map((scene) => <button key={scene.id} type="button" onClick={() => restoreScene(scene)} className="border border-white/10 bg-black/20 p-3 text-left hover:border-[#23c7be]"><div className="flex items-center justify-between gap-3"><span className="truncate text-sm font-black">{scene.title || 'Untitled scene'}</span><span className="text-[10px] font-bold uppercase text-[#8ee9e4]">{scene.status || 'setup'}</span></div><p className="mt-1 text-[10px] text-white/40">{scene.aspect_ratio || '16:9'} · {Array.isArray(scene.shot_plan) ? scene.shot_plan.length : 0} shots</p></button>)}</div> : <div className="border border-white/10 bg-black/20 p-4 text-sm text-white/45">No saved scenes yet.</div>}</section>}

          {showContext && <ProductionContextInfo productionMethod={productionMethod} block={block} character={character} referenceMedia={referenceMedia} />}

          <div className="mb-5 grid grid-cols-4 border border-white/10 bg-[#17191d] text-center text-xs font-black"><button type="button" onClick={() => setStep('setup')} className={`p-3 ${step === 'setup' ? 'bg-[#23c7be] text-black' : 'text-white/60'}`}>1 · Setup</button><button type="button" onClick={() => sceneText.trim() && setStep('plan')} className={`p-3 ${step === 'plan' ? 'bg-[#23c7be] text-black' : 'text-white/60'}`}>2 · Cuts</button><button type="button" onClick={() => approved && setStep('shoot')} className={`p-3 ${step === 'shoot' ? 'bg-[#23c7be] text-black' : 'text-white/60'}`}>3 · Shoot</button><button type="button" onClick={openEditor} className={`p-3 ${step === 'edit' ? 'bg-[#23c7be] text-black' : 'text-white/60'}`}>4 · Edit</button></div>

          {step === 'setup' && <div className="space-y-5">...</div>}

          {step === 'plan' && <div className="space-y-4">...</div>}

          {step === 'shoot' && <div className="grid gap-4 lg:grid-cols-[330px_1fr]">
            <aside className="space-y-2 border border-white/10 bg-[#17191d] p-3"><div className="mb-3"><p className="text-xs font-black uppercase tracking-[0.15em] text-[#23c7be]">Shot list</p><p className="text-[10px] text-white/45">{completedCount}/{shotPlan.length} generated</p></div>{shotPlan.map((shot, index) => <button key={shot.id} type="button" onClick={() => setActiveShotId(shot.id)} className={`w-full border p-3 text-left ${activeShot?.id === shot.id ? 'border-[#23c7be] bg-[#23c7be]/10' : 'border-white/10 bg-black/20'}`}><div className="flex items-center justify-between"><span className="text-xs font-black">{index + 1}. {shot.label}</span>{shot.result_url && <CheckCircle2 size={14} className="text-[#23c7be]" />}</div><p className="mt-1 text-[10px] text-white/45">{shot.duration}s · {shot.framing}</p></button>)}</aside>
            <main className="space-y-4">{activeShot && <>
              <section className="border border-white/10 bg-[#17191d] p-4">...</section>
              <section className="border border-white/10 bg-[#17191d] p-4">...</section>
              <section className="border border-[#23c7be]/30 bg-[#17191d] p-4">...</section>
              {activeShot.result_url ? <section className="border border-white/10 bg-black p-3"><video src={activeShot.result_url} controls className="max-h-[60vh] w-full" /><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => generateShot(activeShot)} disabled={busy} className="flex items-center justify-center bg-white/10 py-3 text-xs font-bold disabled:opacity-60">{regeneratingShotId === activeShot.id ? <><Loader2 size={14} className="mr-2 animate-spin" /> Regenerating…</> : 'Regenerate With This Prompt'}</button><button type="button" onClick={() => { setVaultVideoUrl(activeShot.result_url); setVaultSaveSource('shot'); setShowSaveVault(true); }} disabled={regeneratingShotId === activeShot.id} className="bg-[#23c7be] py-3 text-xs font-black text-black hover:bg-[#8ee9e4] disabled:opacity-50">Save Shot to Vault</button></div><div className="mt-2 grid grid-cols-2 gap-2"><label className="flex cursor-pointer items-center justify-center bg-white/10 py-3 text-xs font-bold hover:bg-white/15"><Upload size={14} className="mr-2" /> Upload Video<input type="file" accept="video/mp4,video/quicktime,video/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) uploadVideoReference(file, { type: 'shot-video-replacement', shotId: activeShot.id }).catch((error) => toast.error(error.message || 'Video upload failed.')); }} /></label><button type="button" onClick={() => { setPickerTarget({ type: 'shot-video-replacement', shotId: activeShot.id }); setShowVaultPicker(true); }} className="flex items-center justify-center bg-white/10 py-3 text-xs font-bold hover:bg-white/15"><Folder size={14} className="mr-2" /> Replace from Vault</button></div><div className="mt-2 border-t border-white/10 pt-2"><textarea value={modifyVideoPrompt} onChange={(event) => setModifyVideoPrompt(event.target.value)} className="min-h-16 w-full bg-black/30 p-2 text-xs text-white" placeholder="Describe what to change in this video…" /><button type="button" onClick={() => modifyActiveShotVideo(activeShot)} disabled={busy || !modifyVideoPrompt.trim()} className="mt-2 w-full bg-white/10 py-3 text-xs font-bold disabled:opacity-50">{busy ? <Loader2 size={14} className="mr-2 inline animate-spin" /> : null}Modify Video</button></div></section> : <Button onClick={() => generateShot(activeShot)} disabled={busy || modelsLoading} className="w-full bg-[#23c7be] py-5 font-black text-black hover:bg-[#8ee9e4] hover:text-black">{busy ? <Loader2 className="mr-2 animate-spin" /> : <Video className="mr-2" />} Generate With This Prompt</Button>}
              {completedCount > 0 && <button type="button" onClick={openEditor} className="w-full border border-[#23c7be]/30 bg-[#23c7be]/10 py-4 text-sm font-black text-[#8ee9e4] hover:bg-[#23c7be]/20">Open Scene Editor</button>}
            </>}</main>
          </div>}

          {step === 'edit' && <div className="space-y-4">...</div>}
        </div>

        {showVaultPicker && userEmail && <VaultPickerModal userEmail={userEmail} mediaType={pickerTarget?.type === 'music' ? 'audio' : (pickerTarget?.type === 'shot-video-reference' || pickerTarget?.type === 'shot-video-replacement') ? 'video' : 'image'} onSelect={(url, name) => (pickerTarget?.type === 'shot-video-reference' || pickerTarget?.type === 'shot-video-replacement') ? applyPickedVideoReference(url, name || (pickerTarget?.type === 'shot-video-replacement' ? 'Vault replacement video' : 'Vault video reference')) : applyPickedImage(url, name || (pickerTarget?.type === 'music' ? 'Vault music' : 'Vault reference'))} onClose={() => { setShowVaultPicker(false); setPickerTarget(null); }} embedded={embedded} />}
        {showAssetsShop && <AssetsShopPicker embedded={embedded} onSelect={(url, name) => applyPickedImage(url, name)} onClose={() => { setShowAssetsShop(false); setPickerTarget(null); }} />}
        {showSaveVault && vaultVideoUrl && userEmail && <SaveToVaultModal userEmail={userEmail} imageUrl={vaultVideoUrl} mediaType="video" onClose={() => setShowSaveVault(false)} onSaved={() => { setShowSaveVault(false); toast.success(vaultSaveSource === 'scene' ? 'Scene saved to Vault' : 'Shot saved to Vault'); }} />}
      </motion.div>
    </div>
  );
}
