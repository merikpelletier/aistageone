import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/lib/AppContext';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Plus, Film, Trash2, Upload, CheckCircle2, Loader2, Mic, Square, X, Camera, Video, Wand2, Users, MapPin, Shirt, Bookmark, ChevronDown, ChevronUp, Pencil, Play, Folder } from 'lucide-react';
import BlockPlayer from '@/components/production/BlockPlayer';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import CharacterRefSheetBuilder from './CharacterRefSheetBuilder';
import TimelineBlock from '@/components/production/TimelineBlock';
import SceneEditorForm from './KitProductionRoom/SceneEditorForm';
import ProductionMethodGuide from './ProductionMethodGuide';
import ProductionMethodSelector from './ProductionMethodSelector';
import EpisodeCreationForm from './KitProductionRoom/EpisodeCreationForm';
import EpisodeMetadataDisplay from './KitProductionRoom/EpisodeMetadataDisplay';
import SceneListView from './KitProductionRoom/SceneListView';
import EpisodesTabBar from './KitProductionRoom/EpisodesTabBar';
import ProductionHeader from './KitProductionRoom/ProductionHeader';
import EpisodePreview from './KitProductionRoom/EpisodePreview';

function uid() { return Math.random().toString(36).slice(2, 10); }
const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// ── Small image picker grid ───────────────────────────────────────────────────
function ImagePicker({ label, icon, items, selectedKey, onSelect, emptyText, allowVault, allowUpload, onVaultOpen, onUpload }) {
  const [lightboxUrl, setLightboxUrl] = useState(null);

  return (
    <div className="space-y-2">
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="" className="max-w-[90vw] max-h-[80vh] rounded-xl object-contain" />
          <button className="absolute top-6 right-5 text-white hover:text-white text-2xl">×</button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {icon}
          <p className="text-white text-sm font-semibold uppercase tracking-wider">{label}</p>
        </div>
        {(allowVault || allowUpload) && items.length > 0 && (
          <div className="flex gap-2">
            {allowUpload && (
              <label className="w-10 h-10 flex items-center justify-center border border-white/60 rounded-xl cursor-pointer hover:bg-white/10 text-white transition-all">
                <Upload size={20} />
                <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && onUpload?.(e.target.files[0])} />
              </label>
            )}
            {allowVault && (
              <button onClick={onVaultOpen} className="w-10 h-10 flex items-center justify-center border border-red-500 bg-red-600/10 rounded-xl hover:bg-red-600/20 text-white transition-all">
                <Bookmark size={20} className="text-red-400" />
              </button>
            )}
          </div>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-white text-sm italic">{emptyText}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map(({ key, imgUrl, name, placeholder }) => {
            const isSelected = selectedKey === key;
            return (
              <div key={key} className="flex flex-col items-center gap-1.5">
                <div className="relative w-full">
                  <button
                    onClick={() => onSelect(isSelected ? null : key)}
                    className={`w-full rounded-2xl border-2 overflow-hidden transition-all ${isSelected ? 'border-red-500 ring-2 ring-red-500/40' : 'border-white/40 hover:border-white'}`}
                  >
                    {imgUrl ? (
                      <img src={imgUrl} alt={name} className="w-full aspect-square object-cover bg-black/30" />
                    ) : (
                      <div className="w-full aspect-square bg-white/10 flex items-center justify-center">{placeholder}</div>
                    )}
                  </button>
                  {imgUrl && (
                    <button
                      onClick={e => { e.stopPropagation(); setLightboxUrl(imgUrl); }}
                      className="absolute bottom-2 right-2 w-10 h-10 bg-black/80 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-lg"
                    >⤢</button>
                  )}
                  {isSelected && (
                    <div className="absolute top-2 left-2 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center">
                      <CheckCircle2 size={16} className="text-white" />
                    </div>
                  )}
                </div>
                <span className="text-white text-sm font-semibold text-center w-full truncate px-1">{name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Compose Scene (the main tool) ─────────────────────────────────────────────
function ComposeScene({ kitPage, onDone, onCancel, recommendedTools = [], referenceMedia = [] }) {
  const [selectedCharacterKey, setSelectedCharacterKey] = useState(null);
  const [selectedSetKey, setSelectedSetKey] = useState(null);
  const [selectedCostumeKey, setSelectedCostumeKey] = useState(null);
  const [scenePrompt, setScenePrompt] = useState('');
  const [actorPhoto, setActorPhoto] = useState(null);
  const [showRefSheetBuilder, setShowRefSheetBuilder] = useState(false);
  const [vaultAssets, setVaultAssets] = useState([]);
  const [characterTypeEntries, setCharacterTypeEntries] = useState([]);
  const [showVaultPicker, setShowVaultPicker] = useState(false);
  const [vaultPickerFor, setVaultPickerFor] = useState(null); // 'character', 'set', or 'costume'
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState(null);

  const characters = kitPage?.kit_characters || [];
  const sets = kitPage?.kit_sets || [];
  const costumes = kitPage?.kit_costumes || [];

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.email) base44.entities.VaultAsset.filter({ user_email: u.email }, '-created_date', 30)
        .then(a => setVaultAssets(a.filter(x => x.media_type === 'image'))).catch(() => {});
    }).catch(() => {});
    // Load character type knowledge entries
    base44.entities.KnowledgeEntry.filter({ category: 'Character Type', is_active: true })
      .then(entries => setCharacterTypeEntries(entries)).catch(() => {});
  }, []);

  // Auto-load reference media as initial selections
  useEffect(() => {
    if (referenceMedia.length > 0) {
      // Try to match reference media to characters/sets/costumes
      referenceMedia.forEach(url => {
        // Check if it matches any character
        const matchingChar = characters.find(c => 
          c.media?.includes(url) || c.photo_url === url
        );
        if (matchingChar) {
          const idx = matchingChar.media?.indexOf(url) || 0;
          setSelectedCharacterKey(`${matchingChar.name}__${idx}`);
        }
      });
    }
  }, [referenceMedia]);

  // Flatten to { key, imgUrl, name, obj }
  const charItems = characters.flatMap(c => {
    const imgs = (c.media?.length > 0) ? c.media : (c.photo_url ? [c.photo_url] : []);
    if (imgs.length === 0) return [{ key: c.name, imgUrl: null, name: c.name, placeholder: <Users size={18} className="text-white" />, obj: c, mediaUrl: null }];
    return imgs.map((url, i) => ({ key: `${c.name}__${i}`, imgUrl: url, name: c.name, obj: c, mediaUrl: url }));
  });
  const [setItems, setSetItems] = useState(sets.flatMap(s =>
    (s.media?.length > 0)
      ? s.media.map((url, i) => ({ key: `${s.name}__${i}`, imgUrl: url, name: s.name, obj: s, mediaUrl: url }))
      : [{ key: s.name, imgUrl: null, name: s.name, placeholder: <MapPin size={18} className="text-white" />, obj: s, mediaUrl: null }]
  ));
  const [costumeItems, setCostumeItems] = useState(costumes.flatMap(c =>
    (c.media?.length > 0)
      ? c.media.map((url, i) => ({ key: `${c.name}__${i}`, imgUrl: url, name: c.name, obj: c, mediaUrl: url }))
      : [{ key: c.name, imgUrl: null, name: c.name, placeholder: <Shirt size={18} className="text-white" />, obj: c, mediaUrl: null }]
  ));

  const selChar = charItems.find(i => i.key === selectedCharacterKey);
  const selSet = setItems.find(i => i.key === selectedSetKey);
  const selCostume = costumeItems.find(i => i.key === selectedCostumeKey);

  const handleCompose = async () => {
    setStatus('generating');
    setErrorMsg('');

    // Enrich character description with character_type field or matching knowledge entry
    let charTypeContext = '';
    if (selChar) {
      const charType = selChar.obj.character_type;
      if (charType) {
        const match = characterTypeEntries.find(e => e.title?.toLowerCase() === charType.toLowerCase());
        charTypeContext = match ? ` (${charType}: ${match.description})` : ` (${charType})`;
      } else {
        const charName = selChar.obj.name?.toLowerCase() || '';
        const charDesc2 = selChar.obj.description?.toLowerCase() || '';
        const match = characterTypeEntries.find(e => {
          const t = e.title?.toLowerCase();
          return charName.includes(t) || charDesc2.includes(t);
        });
        if (match) charTypeContext = ` (${match.title}: ${match.description})`;
      }
    }

    const charDesc = selChar ? `${selChar.obj.name}${selChar.obj.description ? ', ' + selChar.obj.description : ''}${charTypeContext}` : 'a character';
    const setDesc = selSet ? `${selSet.obj.name}${selSet.obj.description ? ', ' + selSet.obj.description : ''}` : 'a cinematic set';
    const costumeDesc = selCostume ? selCostume.obj.name : null;

    const referenceImages = [];
    if (selChar?.mediaUrl) referenceImages.push(selChar.mediaUrl);
    if (selSet?.mediaUrl) referenceImages.push(selSet.mediaUrl);
    if (selCostume?.mediaUrl) referenceImages.push(selCostume.mediaUrl);
    // Add reference media from block
    referenceImages.push(...referenceMedia.slice(0, 2));

    let actorUrl = null;
    if (actorPhoto?.uploadedUrl) { actorUrl = actorPhoto.uploadedUrl; referenceImages.unshift(actorUrl); }
    else if (actorPhoto?.file) {
      const r = await base44.integrations.Core.UploadFile({ file: actorPhoto.file });
      actorUrl = r.file_url; referenceImages.unshift(actorUrl);
    }

    const prompt = `Cinematic production still: ${actorUrl ? 'a person' : charDesc} in the location: ${setDesc}${costumeDesc ? ', wearing ' + costumeDesc : ''}. ${scenePrompt ? scenePrompt + '. ' : ''}Professional film photography, dramatic lighting, high detail.`;
    const res = await base44.functions.invoke('replicateGenerate', { method: 'compose_scene', prompt, reference_image_urls: referenceImages.slice(0, 3), aspect_ratio: '16:9' });

    if (res.data?.file_url) { onDone(res.data.file_url, 'image'); }
    else { setErrorMsg(res.data?.error || 'Generation failed. Try again.'); setStatus('idle'); }
  };

  if (status === 'generating') return (
    <div className="flex flex-col items-center gap-3 py-12">
      <Loader2 size={32} className="text-red-400 animate-spin" />
      <p className="text-white text-sm">Generating scene... (1–3 min)</p>
      <p className="text-white text-xs text-center">AI is composing your scene with the selected references</p>
    </div>
  );

  if (showRefSheetBuilder) return (
    <CharacterRefSheetBuilder
      onDone={(url) => { setActorPhoto({ file: null, previewUrl: url, uploadedUrl: url }); setShowRefSheetBuilder(false); }}
      onCancel={() => setShowRefSheetBuilder(false)}
    />
  );

  return (
    <div className="space-y-4">
      {/* Character */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Users size={12} className="text-white" />
            <p className="text-white text-sm font-semibold uppercase tracking-wider">Character</p>
          </div>
          <div className="flex gap-2">
            <label className="w-10 h-10 flex items-center justify-center border border-white/60 rounded-xl cursor-pointer hover:bg-white/10 text-white transition-all">
              <Upload size={20} />
              <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && setActorPhoto({ file: e.target.files[0], previewUrl: URL.createObjectURL(e.target.files[0]) })} />
            </label>
            {vaultAssets.length > 0 && (
              <button onClick={() => { setShowVaultPicker(true); setVaultPickerFor('character'); }} className="w-10 h-10 flex items-center justify-center border border-red-500 bg-red-600/10 rounded-xl hover:bg-red-600/20 text-white transition-all">
                <Bookmark size={20} className="text-red-400" />
              </button>
            )}
            <button onClick={() => setShowRefSheetBuilder(true)} className="w-10 h-10 flex items-center justify-center border border-white/60 rounded-xl hover:bg-white/10 text-white transition-all">
              <Wand2 size={20} className="text-white" />
            </button>
          </div>
        </div>
        {charItems.length === 0 ? (
          <p className="text-white text-sm italic">No characters in this kit</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {charItems.map(({ key, imgUrl, name, placeholder }) => {
              const isSelected = selectedCharacterKey === key;
              return (
                <div key={key} className="flex flex-col items-center gap-1.5">
                  <div className="relative w-full">
                    <button
                      onClick={() => setSelectedCharacterKey(isSelected ? null : key)}
                      className={`w-full rounded-2xl border-2 overflow-hidden transition-all ${isSelected ? 'border-red-500 ring-2 ring-red-500/40' : 'border-white/40 hover:border-white'}`}
                    >
                      {imgUrl ? (
                        <img src={imgUrl} alt={name} className="w-full aspect-square object-cover bg-black/30" />
                      ) : (
                        <div className="w-full aspect-square bg-white/10 flex items-center justify-center">{placeholder}</div>
                      )}
                    </button>
                    {imgUrl && (
                      <button
                        onClick={e => { e.stopPropagation(); setLightboxUrl(imgUrl); }}
                        className="absolute bottom-2 right-2 w-10 h-10 bg-black/80 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-lg"
                      >⤢</button>
                    )}
                    {isSelected && (
                      <div className="absolute top-2 left-2 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center">
                        <CheckCircle2 size={16} className="text-white" />
                      </div>
                    )}
                  </div>
                  <span className="text-white text-sm font-semibold text-center w-full truncate px-1">{name}</span>
                </div>
              );
            })}
          </div>
        )}
        {/* Character type badge */}
        {selChar && (() => {
          const charType = selChar.obj.character_type;
          const match = charType
            ? characterTypeEntries.find(e => e.title?.toLowerCase() === charType.toLowerCase())
            : characterTypeEntries.find(e => {
                const t = e.title?.toLowerCase();
                return selChar.obj.name?.toLowerCase().includes(t) || selChar.obj.description?.toLowerCase().includes(t);
              });
          const displayType = selChar.obj.character_type || match?.title;
          if (!displayType) return null;
          return (
            <div className="mt-1 px-3 py-2 bg-white/10 border border-white/20 rounded-xl">
              <p className="text-white text-[10px] uppercase tracking-wider mb-0.5">{displayType}</p>
              {match && <p className="text-white text-xs leading-relaxed line-clamp-2">{match.description}</p>}
            </div>
          );
        })()}
      </div>

      {/* Your photo override */}
      <div className="space-y-2">
        {actorPhoto && (
          <div className="flex items-center gap-3 px-4 py-3 bg-white/10 border border-white/20 rounded-2xl">
            <img src={actorPhoto.previewUrl} alt="" className="w-12 h-12 rounded-xl object-cover" />
            <span className="text-white text-base flex-1">Your photo selected</span>
            <button onClick={() => setActorPhoto(null)} className="text-white hover:text-white"><X size={18} /></button>
          </div>
        )}
        {showVaultPicker && vaultPickerFor === 'character' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-white text-sm">Pick from Vault</p>
              <button onClick={() => { setShowVaultPicker(false); setVaultPickerFor(null); }} className="text-white text-sm">Cancel</button>
            </div>
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {vaultAssets.map(a => (
                <button key={a.id} onClick={() => { setActorPhoto({ file: null, previewUrl: a.url, uploadedUrl: a.url }); setShowVaultPicker(false); setVaultPickerFor(null); }}>
                  <img src={a.url} alt="" className="w-full rounded-xl object-cover aspect-square" />
                </button>
              ))}
            </div>
          </div>
        )}
        {vaultPickerFor === 'set' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-white text-sm">Pick from Vault for Set</p>
              <button onClick={() => { setShowVaultPicker(false); setVaultPickerFor(null); }} className="text-white text-sm">Cancel</button>
            </div>
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {vaultAssets.map(a => (
                <button key={a.id} onClick={() => { setSetItems(prev => [...prev, { key: `vault_${a.id}`, imgUrl: a.url, name: 'Vault Set', obj: {}, mediaUrl: a.url }]); setSelectedSetKey(`vault_${a.id}`); setVaultPickerFor(null); }}>
                  <img src={a.url} alt="" className="w-full rounded-xl object-cover aspect-square" />
                </button>
              ))}
            </div>
          </div>
        )}
        {vaultPickerFor === 'costume' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-white text-sm">Pick from Vault for Costume</p>
              <button onClick={() => { setShowVaultPicker(false); setVaultPickerFor(null); }} className="text-white text-sm">Cancel</button>
            </div>
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {vaultAssets.map(a => (
                <button key={a.id} onClick={() => { setCostumeItems(prev => [...prev, { key: `vault_${a.id}`, imgUrl: a.url, name: 'Vault Costume', obj: {}, mediaUrl: a.url }]); setSelectedCostumeKey(`vault_${a.id}`); setVaultPickerFor(null); }}>
                  <img src={a.url} alt="" className="w-full rounded-xl object-cover aspect-square" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Set */}
      <ImagePicker
        label="Set / Location"
        icon={<MapPin size={12} className="text-white" />}
        items={setItems}
        selectedKey={selectedSetKey}
        onSelect={setSelectedSetKey}
        emptyText="No sets in this kit"
        allowVault={true}
        allowUpload={true}
        onVaultOpen={() => setVaultPickerFor('set')}
        onUpload={async (file) => {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          setSetItems(prev => [...prev, { key: `vault_${Date.now()}`, imgUrl: file_url, name: 'Uploaded Set', obj: {}, mediaUrl: file_url }]);
          setSelectedSetKey(`vault_${Date.now()}`);
        }}
      />

      {/* Costume */}
      {costumeItems.length > 0 && (
        <ImagePicker
          label="Costume"
          icon={<Shirt size={12} className="text-white" />}
          items={costumeItems}
          selectedKey={selectedCostumeKey}
          onSelect={setSelectedCostumeKey}
          emptyText="No costumes"
          allowVault={true}
          allowUpload={true}
          onVaultOpen={() => setVaultPickerFor('costume')}
          onUpload={async (file) => {
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            setCostumeItems(prev => [...prev, { key: `vault_${Date.now()}`, imgUrl: file_url, name: 'Uploaded Costume', obj: {}, mediaUrl: file_url }]);
            setSelectedCostumeKey(`vault_${Date.now()}`);
          }}
        />
      )}

      {/* Scene prompt */}
      <textarea
        value={scenePrompt}
        onChange={e => setScenePrompt(e.target.value)}
        placeholder="Describe mood, action, lighting… (optional)"
        rows={2}
        className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/40 resize-none"
      />

      {errorMsg && <p className="text-red-400 text-xs text-center">{errorMsg}</p>}

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="" className="max-w-[90vw] max-h-[80vh] rounded-xl object-contain" />
          <button className="absolute top-6 right-5 text-white hover:text-white text-2xl">×</button>
        </div>
      )}

      <Button
        onClick={handleCompose}
        disabled={!selectedCharacterKey && !actorPhoto && !selectedSetKey}
        className="w-full bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 py-3"
      >
        <Wand2 size={16} className="mr-2" />
        Generate Scene Image →
      </Button>
    </div>
  );
}

// ── Animate / Lip Sync tool ───────────────────────────────────────────────────
function AnimateTool({ mode, kitPage, onDone, recommendedTools = [], referenceMedia = [] }) {
  const [animateImage, setAnimateImage] = useState(null);
  const [animateImageUrl, setAnimateImageUrl] = useState(null);
  const [referenceVideoUrl, setReferenceVideoUrl] = useState(null);
  const [animateAudioUrl, setAnimateAudioUrl] = useState(null);
  const [animatePrompt, setAnimatePrompt] = useState('');
  const [recState, setRecState] = useState('idle');
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const VIDEO_RATIOS = ['16:9', '9:16', '1:1', '4:3'];
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  // Auto-load reference media
  useEffect(() => {
    if (referenceMedia.length > 0) {
      referenceMedia.forEach(url => {
        if (url.match(/\.(mp4|webm|ogg|mov)$/i)) {
          setReferenceVideoUrl(url);
        } else if (!animateImageUrl) {
          setAnimateImageUrl(url);
        }
      });
    }
  }, [referenceMedia]);

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr; chunksRef.current = [];
      mr.ondataavailable = e => chunksRef.current.push(e.data);
      mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); const blob = new Blob(chunksRef.current, { type: 'audio/webm' }); setAudioBlob(blob); setAudioUrl(URL.createObjectURL(blob)); setRecState('preview'); };
      mr.start(); setElapsed(0); setRecState('recording');
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } catch { setErrorMsg('Microphone access denied.'); }
  };
  const stopRec = () => { clearInterval(timerRef.current); mediaRecorderRef.current?.stop(); };
  const submitRec = async () => {
    setRecState('uploading');
    const { file_url } = await base44.integrations.Core.UploadFile({ file: new File([audioBlob], 'rec.webm', { type: 'audio/webm' }) });
    setAnimateAudioUrl(file_url); setRecState('idle'); setAudioBlob(null); setAudioUrl(null);
  };

  const handleRun = async () => {
    setStatus('generating'); setErrorMsg('');
    let photoUrl = animateImageUrl;
    if (!photoUrl && animateImage?.file) { const r = await base44.integrations.Core.UploadFile({ file: animateImage.file }); photoUrl = r.file_url; setAnimateImageUrl(photoUrl); }
    if (!photoUrl && mode !== 'lip_sync') { setErrorMsg('Upload an image first.'); setStatus('idle'); return; }
    const res = await base44.functions.invoke('replicateGenerate', {
      method: mode, 
      photo_url: mode === 'lip_sync' ? referenceVideoUrl : photoUrl,
      reference_video_url: mode === 'animate_with_reference' ? referenceVideoUrl : undefined,
      prompt_override: animatePrompt || undefined, 
      audio_url: animateAudioUrl || undefined,
      aspect_ratio: mode !== 'lip_sync' ? aspectRatio : undefined,
      reference_image_urls: referenceMedia.filter(u => !u.match(/\.(mp4|webm|ogg|mov)$/i)).slice(0, 2),
    });
    if (res.data?.file_url) { onDone(res.data.file_url, 'video'); }
    else { setErrorMsg(res.data?.error || 'Generation failed.'); setStatus('idle'); }
  };

  if (status === 'generating') return (
    <div className="flex flex-col items-center gap-3 py-12">
      <Loader2 size={32} className="text-amber-400 animate-spin" />
      <p className="text-white text-sm">Generating... (1–4 min)</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Image input */}
      {mode !== 'lip_sync' && (
        <div>
          <p className="text-white text-[11px] uppercase tracking-wider mb-1">Image to animate</p>
          {(animateImageUrl || animateImage) ? (
            <div className="relative rounded-xl overflow-hidden">
              <img src={animateImageUrl || animateImage?.previewUrl} alt="" className="w-full max-h-48 object-contain bg-black/30 rounded-xl" />
              <button onClick={() => { setAnimateImage(null); setAnimateImageUrl(null); }} className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center"><X size={10} className="text-white" /></button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-amber-500 rounded-xl cursor-pointer hover:border-amber-400 transition-colors py-8">
              <Upload size={20} className="text-amber-400" />
              <span className="text-white text-xs">Upload image</span>
              <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && setAnimateImage({ file: e.target.files[0], previewUrl: URL.createObjectURL(e.target.files[0]) })} />
            </label>
          )}
        </div>
      )}

      {/* Reference video */}
      {(mode === 'animate_with_reference' || mode === 'lip_sync') && (
        <div>
          <p className="text-white text-[11px] uppercase tracking-wider mb-1">{mode === 'lip_sync' ? 'Video to sync' : 'Reference video (motion)'}</p>
          {referenceVideoUrl ? (
            <div className="relative rounded-xl overflow-hidden">
              <video src={referenceVideoUrl} className="w-full max-h-36 rounded-xl" />
              <button onClick={() => setReferenceVideoUrl(null)} className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center"><X size={10} className="text-white" /></button>
            </div>
          ) : (
            <label className="flex flex-col items-center gap-2 border-2 border-dashed border-white/60 rounded-xl cursor-pointer hover:border-white py-6">
              <Upload size={16} className="text-white" />
              <span className="text-white text-xs">Upload video</span>
              <input type="file" accept="video/*" className="hidden" onChange={async e => { const f = e.target.files[0]; if (!f) return; setStatus('uploading'); const { file_url } = await base44.integrations.Core.UploadFile({ file: f }); setReferenceVideoUrl(file_url); setStatus('idle'); }} />
            </label>
          )}
        </div>
      )}

      {/* Audio */}
      {(mode === 'lip_sync' || mode === 'animate_image') && (
        <div>
          <p className="text-white text-[11px] uppercase tracking-wider mb-1">{mode === 'lip_sync' ? 'Audio for lip sync' : 'Audio track (optional)'}</p>
          {animateAudioUrl ? (
            <div className="flex items-center gap-2"><audio src={animateAudioUrl} controls className="flex-1 h-8" /><button onClick={() => setAnimateAudioUrl(null)} className="text-white hover:text-white"><X size={14} /></button></div>
          ) : recState === 'recording' ? (
            <div className="flex items-center justify-between px-4 py-3 border border-red-600/30 rounded-xl bg-red-600/5">
              <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /><span className="text-red-400 font-mono text-sm">{fmt(elapsed)}</span></div>
              <button onClick={stopRec} className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center"><Square size={16} className="text-white fill-white" /></button>
            </div>
          ) : recState === 'preview' ? (
            <div className="space-y-2">
              <audio src={audioUrl} controls className="w-full" />
              <div className="flex gap-2">
                <button onClick={() => { setAudioBlob(null); setAudioUrl(null); setRecState('idle'); }} className="flex-1 py-2 border border-white/60 rounded-xl text-white text-xs">Re-record</button>
                <button onClick={submitRec} className="flex-1 py-2 bg-red-600 rounded-xl text-white text-xs">Use This →</button>
              </div>
            </div>
          ) : recState === 'uploading' ? (
            <div className="flex items-center gap-2 py-2 text-white text-xs"><Loader2 size={12} className="animate-spin" /> Uploading...</div>
          ) : (
            <div className="flex gap-2">
              <button onClick={startRec} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-red-500 bg-red-600/20 rounded-xl text-white text-xs"><Mic size={13} />Record</button>
              <label className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-white/60 rounded-xl cursor-pointer hover:bg-white/10 text-white text-xs"><Upload size={12} />Upload audio<input type="file" accept="audio/*" className="hidden" onChange={async e => { const f = e.target.files[0]; if (!f) return; setStatus('uploading'); const { file_url } = await base44.integrations.Core.UploadFile({ file: f }); setAnimateAudioUrl(file_url); setStatus('idle'); }} /></label>
            </div>
          )}
        </div>
      )}

      {/* Motion prompt */}
      {mode !== 'lip_sync' && (
        <textarea value={animatePrompt} onChange={e => setAnimatePrompt(e.target.value)} placeholder="Motion prompt (optional)…" rows={2}
          className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50 resize-none" />
      )}

      {/* Aspect Ratio selector — independent per tool */}
      {mode !== 'lip_sync' && (
        <div>
          <p className="text-white text-[11px] uppercase tracking-wider mb-1">Aspect Ratio</p>
          <div className="flex gap-1.5 flex-wrap">
            {VIDEO_RATIOS.map(r => (
              <button key={r} onClick={() => setAspectRatio(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${aspectRatio === r ? 'bg-amber-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {errorMsg && <p className="text-red-400 text-xs text-center">{errorMsg}</p>}

      <Button onClick={handleRun}
        disabled={(!animateImage && !animateImageUrl && mode !== 'lip_sync') || (mode === 'lip_sync' && !referenceVideoUrl) || (mode === 'lip_sync' && !animateAudioUrl)}
        className="w-full bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-40">
        {mode === 'animate_image' ? 'Animate →' : mode === 'animate_with_reference' ? 'Animate with Reference →' : 'Lip Sync →'}
      </Button>
    </div>
  );
}

// ── AI Video tool ─────────────────────────────────────────────────────────────
function AIVideoTool({ onDone, recommendedTools = [], referenceMedia = [] }) {
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [referenceImageUrl, setReferenceImageUrl] = useState(null);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const VIDEO_RATIOS = ['16:9', '9:16', '1:1', '4:3'];

  // Auto-load first image as reference
  useEffect(() => {
    const firstImage = referenceMedia.find(u => !u.match(/\.(mp4|webm|ogg|mov)$/i));
    if (firstImage) setReferenceImageUrl(firstImage);
  }, [referenceMedia]);

  const handleRun = async () => {
    if (!prompt.trim()) return;
    setStatus('generating'); setErrorMsg('');
    const res = await base44.functions.invoke('replicateGenerate', { 
      method: 'text_to_video', 
      prompt,
      aspect_ratio: aspectRatio,
      reference_image_urls: referenceImageUrl ? [referenceImageUrl] : undefined,
    });
    if (res.data?.file_url) { onDone(res.data.file_url, 'video'); }
    else { setErrorMsg(res.data?.error || 'Generation failed.'); setStatus('idle'); }
  };

  if (status === 'generating') return (
    <div className="flex flex-col items-center gap-3 py-12">
      <Loader2 size={32} className="text-amber-400 animate-spin" />
      <p className="text-white text-sm">Generating video... (2–5 min)</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe the video… e.g. 'Cinematic drone shot flying over the Nile at sunset'" rows={4}
        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50 resize-none" />
      <div>
        <p className="text-white text-[11px] uppercase tracking-wider mb-1">Aspect Ratio</p>
        <div className="flex gap-1.5 flex-wrap">
          {VIDEO_RATIOS.map(r => (
            <button key={r} onClick={() => setAspectRatio(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${aspectRatio === r ? 'bg-amber-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>
      {errorMsg && <p className="text-red-400 text-xs">{errorMsg}</p>}
      <Button onClick={handleRun} disabled={!prompt.trim()} className="w-full bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-40">Generate Video →</Button>
    </div>
  );
}

const BLOCK_TYPES = [
  { id: 'character', label: 'Character', color: 'bg-red-500' },
  { id: 'establishing_shot', label: 'Establishing', color: 'bg-blue-500' },
  { id: 'action_element', label: 'Action', color: 'bg-yellow-500' },
  { id: 'transition', label: 'Transition', color: 'bg-purple-500' },
  { id: 'closing_shot', label: 'Closing', color: 'bg-green-500' },
];

// ── Block editor — opens directly on the compose tool ────────────────────────
function BlockEditor({ block, kitPage, onUpdate, onClose, inline = false, recommendedTools = [], referenceMedia = [] }) {
  const [title, setTitle] = useState(block.title || '');
  const [description, setDescription] = useState(block.description || '');
  const [blockType, setBlockType] = useState(block.block_type || null);
  const [dialogue, setDialogue] = useState(block.dialogue || '');
  const [productionInstructions, setProductionInstructions] = useState(block.production_instructions || '');
  const [mediaUrl, setMediaUrl] = useState(block.media_url || null);
  const [mediaType, setMediaType] = useState(block.media_type || null);
  const [vaultAssets, setVaultAssets] = useState([]);
  const [vaultFolders, setVaultFolders] = useState([]);
  const [showVaultPicker, setShowVaultPicker] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.email) {
        Promise.all([
          base44.entities.VaultAsset.filter({ user_email: u.email, media_type: 'video' }, '-created_date', 30),
          base44.entities.VaultFolder.filter({ user_email: u.email }, 'order')
        ]).then(([assets, folders]) => {
          setVaultAssets(assets);
          setVaultFolders(folders);
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const folderColors = {
    red: 'bg-red-500/20 border-red-500/40 text-red-400',
    orange: 'bg-orange-500/20 border-orange-500/40 text-orange-400',
    yellow: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400',
    green: 'bg-green-500/20 border-green-500/40 text-green-400',
    blue: 'bg-blue-500/20 border-blue-500/40 text-blue-400',
    purple: 'bg-purple-500/20 border-purple-500/40 text-purple-400',
    pink: 'bg-pink-500/20 border-pink-500/40 text-pink-400',
  };

  const TOOLS = [
    { id: 'upload', label: 'Upload', icon: <Upload size={13} className="text-white" /> },
  ];

  const blockData = () => ({ ...block, title, description, block_type: blockType, dialogue, production_instructions: productionInstructions, media_url: mediaUrl, media_type: mediaType });

  const handleMediaDone = (url, type) => {
    setMediaUrl(url);
    setMediaType(type);
    const autoTitle = title || (type === 'image' ? 'Scene' : type === 'video' ? 'Video' : 'Audio');
    onUpdate({ ...block, title: autoTitle, description, block_type: blockType, dialogue, production_instructions: productionInstructions, media_url: url, media_type: type });
  };

  const save = () => {
    onUpdate(blockData());
  };

  const BlockTypePicker = () => (
    <div className="space-y-2">
      <p className="text-white text-[10px] uppercase tracking-widest font-semibold">Block Type</p>
      <div className="flex flex-wrap gap-2">
        {BLOCK_TYPES.map(bt => (
          <button
            key={bt.id}
            onClick={() => setBlockType(blockType === bt.id ? null : bt.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              blockType === bt.id
                ? `${bt.color} text-white border-transparent`
                : 'border-white/20 text-white hover:border-white/50 hover:text-white'
            }`}
          >
            {bt.label}
          </button>
        ))}
      </div>
    </div>
  );

  // In inline mode, just render the body content directly (no fixed overlay, no header)
  if (inline) return (
    <div className="space-y-4">
      <BlockTypePicker />
      {mediaUrl && (
        <div className="relative rounded-xl overflow-hidden">
          {mediaType === 'video' || (mediaUrl && mediaUrl.match(/\.(mp4|webm|ogg|mov)$/i)) ? (
            <video src={mediaUrl} controls className="w-full rounded-xl max-h-64" />
          ) : mediaType === 'audio' || (mediaUrl && mediaUrl.match(/\.(mp3|wav|m4a|ogg|aac|webm)$/i)) ? (
            <audio src={mediaUrl} controls className="w-full" />
          ) : (
            <img src={mediaUrl} alt="" className="w-full rounded-xl object-contain max-h-64 bg-black/30" />
          )}
          <button onClick={() => { setMediaUrl(null); setMediaType(null); }}
            className="absolute top-2 right-2 px-2 py-1 bg-black/70 rounded-lg text-white text-xs hover:text-white flex items-center gap-1">
            <Wand2 size={10} />Replace
          </button>
        </div>
      )}
      {!mediaUrl && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white text-[10px] uppercase tracking-widest font-semibold">Upload Video</p>
            <div className="flex gap-2">
              <label className="w-10 h-10 flex items-center justify-center border border-white/60 rounded-xl cursor-pointer hover:bg-white/10 text-white transition-all">
                <Upload size={20} />
                <input type="file" accept="video/*" className="hidden" onChange={async e => {
                  const f = e.target.files[0]; if (!f) return;
                  const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
                  handleMediaDone(file_url, 'video');
                }} />
              </label>
              <button onClick={() => setShowVaultPicker(true)} className="w-10 h-10 flex items-center justify-center border border-red-500 bg-red-600/10 rounded-xl hover:bg-red-600/20 text-white transition-all">
                <Bookmark size={20} className="text-red-400" />
              </button>
            </div>
          </div>
          {showVaultPicker && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-white text-sm">Pick from Vault</p>
                <button onClick={() => setShowVaultPicker(false)} className="text-white text-sm">Cancel</button>
              </div>
              {/* Unfiled Videos */}
              {vaultAssets.filter(a => !a.folder_id).length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-white text-xs uppercase tracking-wider">
                    <Folder size={14} />
                    Unfiled ({vaultAssets.filter(a => !a.folder_id).length})
                  </div>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {vaultAssets.filter(a => !a.folder_id).map(a => (
                      <button key={a.id} onClick={() => { handleMediaDone(a.url, 'video'); setShowVaultPicker(false); }}>
                        <video src={a.url} className="w-full rounded-xl object-cover aspect-video" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Folders */}
              {vaultFolders.map((folder) => {
                const folderVideos = vaultAssets.filter(a => a.folder_id === folder.id);
                const isExpanded = expandedFolders[folder.id] ?? false;
                return (
                  <div key={folder.id} className="space-y-2">
                    <div
                      className={`flex items-center justify-between px-3 py-2 rounded-xl border ${folderColors[folder.color]} cursor-pointer`}
                      onClick={() => toggleFolder(folder.id)}
                    >
                      <div className="flex items-center gap-2">
                        <ChevronDown size={14} className={`text-white transition-transform ${!isExpanded ? '-rotate-90' : ''}`} />
                        <Folder size={14} className="text-white" />
                        <span className="text-white text-sm font-bold">{folder.name}</span>
                        <span className="text-white text-xs font-semibold">({folderVideos.length})</span>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pl-2">
                        {folderVideos.length === 0 ? (
                          <p className="text-white text-xs col-span-2 text-center py-4">Empty folder</p>
                        ) : (
                          folderVideos.map(a => (
                            <button key={a.id} onClick={() => { handleMediaDone(a.url, 'video'); setShowVaultPicker(false); }}>
                              <video src={a.url} className="w-full rounded-xl object-cover aspect-video" />
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {vaultAssets.length === 0 && vaultFolders.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-white text-sm">No videos in vault yet</p>
                  <p className="text-white text-xs mt-1">Upload a video first or generate one in the Studio</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <div className="space-y-3">
        <div>
          <p className="text-white text-[10px] uppercase tracking-widest mb-1">Title</p>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Scene title…" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/50" />
        </div>
        <div>
          <p className="text-white text-[10px] uppercase tracking-widest mb-1">Description</p>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description…" rows={2}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/50 resize-none" />
        </div>
        <div>
          <p className="text-white text-[10px] uppercase tracking-widest mb-1">Dialogue (optional)</p>
          <textarea value={dialogue} onChange={e => setDialogue(e.target.value)} placeholder="Character lines for this scene…" rows={2}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/50 resize-none" />
        </div>
        <div>
          <p className="text-white text-[10px] uppercase tracking-widest mb-1">Production Instructions (optional)</p>
          <textarea value={productionInstructions} onChange={e => setProductionInstructions(e.target.value)} placeholder="Step-by-step instructions…" rows={2}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/50 resize-none" />
        </div>
      </div>
      <button onClick={save} className="w-full py-2.5 bg-white text-black text-sm font-medium rounded-xl">Save Scene</button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black z-[60] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-10 pb-3 border-b border-white/10 flex-shrink-0">
        <button onClick={onClose} className="p-1 text-white hover:text-white"><ChevronLeft size={24} /></button>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs uppercase tracking-wider">Block</p>
          <p className="text-white text-sm font-medium truncate">{title || 'New Scene'}</p>
        </div>
        <button onClick={save} className="px-3 py-1.5 bg-white text-black text-xs rounded-lg font-medium">Save</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{scrollbarColor: 'rgba(255,255,255,0.2) transparent', scrollbarWidth: 'thin'}}>

        <BlockTypePicker />

        {/* Current media preview */}
        {mediaUrl && (
          <div className="relative rounded-xl overflow-hidden">
            {mediaType === 'video' || mediaUrl.match(/\.(mp4|webm|ogg|mov)$/i) ? (
              <video src={mediaUrl} controls className="w-full rounded-xl max-h-64" />
            ) : mediaType === 'audio' || mediaUrl.match(/\.(mp3|wav|m4a|ogg|aac|webm)$/i) ? (
              <audio src={mediaUrl} controls className="w-full" />
            ) : (
              <img src={mediaUrl} alt="" className="w-full rounded-xl object-contain max-h-64 bg-black/30" />
            )}
            <button
              onClick={() => { setMediaUrl(null); setMediaType(null); }}
              className="absolute top-2 right-2 px-2 py-1 bg-black/70 rounded-lg text-white text-xs hover:text-white flex items-center gap-1"
            >
              <Wand2 size={10} />Replace
            </button>
          </div>
        )}

        {!mediaUrl && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-white text-[10px] uppercase tracking-widest font-semibold">Upload Video</p>
              <div className="flex gap-2">
                <label className="w-10 h-10 flex items-center justify-center border border-white/60 rounded-xl cursor-pointer hover:bg-white/10 text-white transition-all">
                  <Upload size={20} />
                  <input type="file" accept="video/*" className="hidden" onChange={async e => {
                    const f = e.target.files[0]; if (!f) return;
                    const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
                    handleMediaDone(file_url, 'video');
                  }} />
                </label>
                {vaultAssets.length > 0 && (
                  <button onClick={() => setShowVaultPicker(true)} className="w-10 h-10 flex items-center justify-center border border-red-500 bg-red-600/10 rounded-xl hover:bg-red-600/20 text-white transition-all">
                    <Bookmark size={20} className="text-red-400" />
                  </button>
                )}
              </div>
            </div>
            {showVaultPicker && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-white text-sm">Pick from Vault</p>
                  <button onClick={() => setShowVaultPicker(false)} className="text-white text-sm">Cancel</button>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {vaultAssets.map(a => (
                    <button key={a.id} onClick={() => { handleMediaDone(a.url, 'video'); setShowVaultPicker(false); }}>
                      <video src={a.url} className="w-full rounded-xl object-cover aspect-video" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <p className="text-white text-[10px] uppercase tracking-widest mb-1">Title</p>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Scene title…" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/50" />
          </div>
          <div>
            <p className="text-white text-[10px] uppercase tracking-widest mb-1">Description</p>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description…" rows={2}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/50 resize-none" />
          </div>
          <div>
            <p className="text-white text-[10px] uppercase tracking-widest mb-1">Dialogue (optional)</p>
            <textarea value={dialogue} onChange={e => setDialogue(e.target.value)} placeholder="Character lines for this scene…" rows={2}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/50 resize-none" />
          </div>
          <div>
            <p className="text-white text-[10px] uppercase tracking-widest mb-1">Production Instructions (optional)</p>
            <textarea value={productionInstructions} onChange={e => setProductionInstructions(e.target.value)} placeholder="Step-by-step instructions…" rows={2}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/50 resize-none" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main KitProductionRoom ────────────────────────────────────────────────────
export default function KitProductionRoom({ kitPage: kitPageProp, dossier, onClose, initialBlockId, initialBlockType, producedMedia, onMediaProduced, referenceMedia = [], productionMethodFromUrl, blockDetailsFromStorage }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { setAppContext } = useAppContext();
  const [user, setUser] = useState(null);
  const [kitPage, setKitPage] = useState(kitPageProp);
  const [episodes, setEpisodes] = useState([]);
  const [activeEpisodeId, setActiveEpisodeId] = useState(null);
  const [production, setProduction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);
  const [productionName, setProductionName] = useState('');
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [episodeDesc, setEpisodeDesc] = useState('');
  const [posterImage, setPosterImage] = useState('');
  const [seriesDesc, setSeriesDesc] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [publicationDate, setPublicationDate] = useState('');
  const [category, setCategory] = useState('');
  const [episodeProduction, setEpisodeProduction] = useState(null);
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' or 'blocks'
  const [masterTimeline, setMasterTimeline] = useState([]);
  const [productionMethod, setProductionMethod] = useState(null);
  const [showMethodGuide, setShowMethodGuide] = useState(false);
  const [blockDetails, setBlockDetails] = useState(null);
  const [pendingBlock, setPendingBlock] = useState(null); // Block waiting for method selection
  const [showMethodSelector, setShowMethodSelector] = useState(false); // Modal for method selection
  const [navigationStatus, setNavigationStatus] = useState('');
  const [hasOpenedEditor, setHasOpenedEditor] = useState(false);
  const [isEpisodeLocked, setIsEpisodeLocked] = useState(false);
  const [savedBlockId, setSavedBlockId] = useState(null);
  const [savingBlockId, setSavingBlockId] = useState(null); // Track which block is being saved
  const [showBlockPlayer, setShowBlockPlayer] = useState(false);
  const [showEpisodePreview, setShowEpisodePreview] = useState(false);
  const [episodePage, setEpisodePage] = useState(null);

  // Broadcast KitProductionRoom context
  useEffect(() => {
    const detail = [
      dossier?.title ? `Project: ${dossier.title}` : null,
      kitPageProp?.title ? `Kit: ${kitPageProp.title}` : null,
      production?.episode_title ? `Episode: ${production.episode_title}` : null,
      editingBlock?.title ? `Editing block: ${editingBlock.title}` : editingBlock ? 'Editing a scene block' : null,
    ].filter(Boolean).join(' | ');
    setAppContext({
      page: 'KitProductionRoom',
      section: 'Episode production timeline',
      detail: detail || null,
    });
  }, [dossier?.title, kitPageProp?.title, production?.episode_title, editingBlock?.title]);

  // Auto-open editor when production is loaded and we have block details from Studio
  useEffect(() => {
    if (production && productionMethodFromUrl && blockDetailsFromStorage?.block && !hasOpenedEditor) {
      setEditingBlock(blockDetailsFromStorage.block);
      setHasOpenedEditor(true);
    }
  }, [production, productionMethodFromUrl, blockDetailsFromStorage]);

  const selectEpisode = (ep) => {
    setProduction(ep);
    setProductionName(ep.production_name || '');
    setEpisodeTitle(ep.episode_title || '');
    setEpisodeDesc(ep.episode_description || '');
    setPosterImage(ep.poster_image || '');
    setSeriesDesc(ep.series_description || '');
    setAuthorName(ep.author_name || '');
    setPublicationDate(ep.publication_date || '');
    setCategory(ep.category || '');
    setEditingBlock(null);
    setActiveEpisodeId(ep.id || null);
  };

  // Load metadata when production is selected
  useEffect(() => {
    if (production) {
      setPosterImage(production.poster_image || '');
      setSeriesDesc(production.series_description || '');
      setAuthorName(production.author_name || '');
      setPublicationDate(production.publication_date || '');
      setCategory(production.category || '');
    }
  }, [production?.id]);

  // Refresh data when returning from Studio with produced media
  useEffect(() => {
    if (producedMedia && activeEpisodeId) {
      // Reload the production to get fresh data
      base44.entities.TimelineStory.get(activeEpisodeId).then(ep => {
        if (ep) {
          selectEpisode(ep);
          // Invalidate cache to ensure fresh data
          qc.invalidateQueries({ queryKey: ['kitUserProduction', activeEpisodeId] });
          // Show success toast
          toast.success('✓ Scène sauvegardée!', {
            description: 'Votre média a été ajouté au timeline',
            duration: 3000,
          });
        }
      }).catch(() => {});
      // Clear the produced media state
      onMediaProduced?.(null);
    }
  }, [producedMedia]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const kitPageId = kitPageProp?.id;
      try { 
        if (kitPageId) {
          const p = await base44.entities.DossierPage.get(kitPageId); 
          if (p) {
            setKitPage(p);
            // Check if episode is locked - batch with previous call
            const allPages = await base44.entities.DossierPage.filter({ dossier_id: dossier?.id, page_type: 'episode' });
            const hasLockedEpisode = allPages.some(ep => ep.is_locked);
            setIsEpisodeLocked(hasLockedEpisode);
          }
        }
      } catch (err) {
        console.error('Error loading kit page:', err);
      }
      const me = await base44.auth.me().catch(() => null);
      setUser(me);
      if (me) {
        try {
          const existing = await base44.entities.TimelineStory.filter({ kit_page_id: kitPageId || 'free_timeline', user_email: me.email });
          setEpisodes(existing);
          if (existing.length > 0) {
            selectEpisode(existing[0]);
          }
        } catch (err) {
          console.error('Error loading productions:', err);
        }
        // Load master timeline from EpisodeProduction
        try {
          const epProd = await base44.entities.EpisodeProduction.filter({ dossier_id: dossier?.id });
          if (epProd.length > 0) {
            setEpisodeProduction(epProd[0]);
            setMasterTimeline(epProd[0].timeline || []);
            // Load the episode DossierPage to get episode_title, episode_description, episode_role
            if (epProd[0].episode_page_id) {
              base44.entities.DossierPage.get(epProd[0].episode_page_id)
                .then(ep => setEpisodePage(ep))
                .catch(() => {});
            }
          }
        } catch (err) {
          console.error('Error loading episode production:', err);
        }
      }
      setLoading(false);
    };
    load();
  }, [kitPageProp?.id, dossier?.id]);

  // Start a fresh, blank episode — never copy the currently-loaded episode's metadata,
  // otherwise "+ Episode" just duplicates the last timeline.
  const createEpisode = async () => {
    const me = user;
    if (!me) return;
    const newEp = {
      kit_page_id: kitPageProp?.id || 'free_timeline',
      dossier_id: dossier?.id || '',
      user_email: me.email,
      episode_title: '',
      episode_description: '',
      poster_image: '',
      series_description: '',
      author_name: me.full_name || '',
      publication_date: '',
      category: '',
      blocks: []
    };
    const saved = await base44.entities.TimelineStory.create(newEp);
    setEpisodes(prev => [...prev, saved]);
    selectEpisode(saved);
  };

  const deleteEpisode = async (epId) => {
    await base44.entities.TimelineStory.delete(epId);
    const remaining = episodes.filter(e => e.id !== epId);
    setEpisodes(remaining);
    if (remaining.length > 0) { selectEpisode(remaining[0]); }
    else { setProduction(null); setActiveEpisodeId(null); setEpisodeTitle(''); setEpisodeDesc(''); }
  };

  const persist = async (blocksArray, blockId = null) => {
    if (!production?.id) {
      toast.error('No episode selected');
      return null;
    }
    
    if (blockId) setSavingBlockId(blockId);
    else setSaving(true);
    
    try {
      const toSave = {
        production_name: productionName || '',
        episode_title: episodeTitle || '',
        episode_description: episodeDesc || '',
        poster_image: posterImage,
        series_description: seriesDesc,
        author_name: authorName,
        publication_date: publicationDate,
        category: category || '',
        blocks: Array.isArray(blocksArray) ? blocksArray : []
      };
      
      const saved = await base44.entities.TimelineStory.update(production.id, toSave);
      // Update local state immediately
      setProduction(prev => ({ ...prev, ...saved }));
      setEpisodes(prev => prev.map(e => e.id === saved.id ? saved : e));
      return saved;
    } catch (err) {
      toast.error('Save failed: ' + err.message);
      throw err;
    } finally {
      if (blockId) setSavingBlockId(null);
      else setSaving(false);
    }
  };

  const addBlock = async () => {
    if (!production) return;
    const nb = { id: uid(), order: (production.blocks || []).length + 1, title: '', description: '', media_url: null, media_type: null };
    const newBlocks = [...(production.blocks || []), nb];
    // Update local state immediately so block appears right away
    setProduction(prev => ({ ...prev, blocks: newBlocks }));
    // Open the editor immediately — don't wait for server
    setEditingBlock(nb);
    // Persist in background
    base44.entities.TimelineStory.update(production.id, {
      production_name: productionName || '',
      episode_title: episodeTitle || '',
      episode_description: episodeDesc || '',
      blocks: newBlocks
    }).then(saved => {
      if (saved) {
        setProduction(saved);
        setEpisodes(prev => prev.map(e => e.id === saved.id ? saved : e));
      }
    }).catch(() => {});
  };

  const updateBlock = async (updatedBlock) => {
    if (!production) return;
    const currentBlocks = production.blocks || [];
    // If block doesn't exist yet, add it; otherwise replace it
    const exists = currentBlocks.some(b => b.id === updatedBlock.id);
    const newBlocks = exists
      ? currentBlocks.map(b => b.id === updatedBlock.id ? updatedBlock : b)
      : [...currentBlocks, updatedBlock];
    // Update local state immediately
    setProduction(prev => ({ ...prev, blocks: newBlocks }));
    const saved = await persist(newBlocks);
    if (saved) setProduction(saved);
    setEditingBlock(null);
  };

  const deleteBlock = async (blockId) => {
    if (!production) return;
    const newBlocks = (production.blocks || []).filter(b => b.id !== blockId).map((b, i) => ({ ...b, order: i + 1 }));
    const saved = await persist(newBlocks);
    if (saved) setProduction(saved);
  };

  const handleProduceInStudio = (block, productionMethod) => {
    console.log('handleProduceInStudio called:', block?.id, productionMethod);
    // If no production method selected, show method selector modal
    if (!productionMethod) {
      console.log('No method, showing selector');
      setPendingBlock(block);
      setShowMethodSelector(true);
      toast.success('Select a production method');
      return;
    }
    
    // First save any pending changes, then redirect
    if (!production) return;
    const updatedBlocks = (production.blocks || []).map(b => b.id === block.id ? b : b);
    persist(updatedBlocks).then((saved) => {
      if (saved) setProduction(saved);
      // Find assigned character for this block
      const assignedChar = block.assigned_character_id 
        ? episodeProduction?.characters?.find(c => c.id === block.assigned_character_id)
        : null;
      
      // Store block details in sessionStorage for the guide
      sessionStorage.setItem('studio_block_details', JSON.stringify({
        block,
        character: assignedChar,
        referenceMedia: block.reference_media || []
      }));
      
      const studioParams = new URLSearchParams({
        mode: 'production',
        dossier_id: dossier?.id || '',
        kit_page_id: kitPageProp.id || '',
        block_id: block.id,
        episode_id: production?.id || '',
        production_method: productionMethod,
      });
      navigate(`/Studio?${studioParams.toString()}`);
    });
  };

  const handleViewBlock = (block) => {
    // Just open the editor for this block without redirecting to Studio
    setEditingBlock(block);
  };

  const handleViewInStudio = (block) => {
    // View existing block in studio for editing
    handleProduceInStudio(block);
  };

  const getUserVersionForBlock = (blockId) => {
    if (!production?.blocks) return null;
    return production.blocks.find(b => b.id === blockId);
  };

  if (loading) return <div className="fixed inset-0 bg-black z-50 flex items-center justify-center"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;



  if (!user) return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center gap-4 px-8">
      <p className="text-white text-sm text-center">Log in to build your production.</p>
      <button onClick={() => base44.auth.redirectToLogin(window.location.href)} className="px-6 py-3 bg-white text-black text-sm rounded-xl">Log in</button>
      <button onClick={onClose} className="text-white text-xs underline">Go back</button>
    </div>
  );

  const handleContinueFromGuide = () => {
    const stored = sessionStorage.getItem('studio_block_details');
    
    if (stored) {
      const parsed = JSON.parse(stored);
      const blockToEdit = parsed.block;
      
      // Keep sessionStorage for Studio page to read
      setShowMethodGuide(false);
      
      const studioParams = new URLSearchParams({
        mode: 'production',
        dossier_id: dossier?.id || '',
        kit_page_id: kitPageProp.id || '',
        block_id: blockToEdit.id,
        episode_id: production?.id || '',
        production_method: productionMethod,
      });
      const url = `/Studio?${studioParams.toString()}`;
      console.log('Navigating to Studio:', url);
      window.location.href = url;
    }
  };

  const handleSelectMethod = (method) => {
    console.log('handleSelectMethod called with:', method);
    
    if (pendingBlock) {
      // Close modal FIRST
      setShowMethodSelector(false);
      setProductionMethod(method);
      
      // Show the ProductionMethodGuide modal
      setShowMethodGuide(true);
      
      // Store block details for the guide
      const assignedChar = pendingBlock.assigned_character_id 
        ? episodeProduction?.characters?.find(c => c.id === pendingBlock.assigned_character_id)
        : null;
      
      sessionStorage.setItem('studio_block_details', JSON.stringify({
        block: pendingBlock,
        character: assignedChar,
        referenceMedia: pendingBlock.reference_media || []
      }));
      
      setPendingBlock(null);
    }
  };

  const sortedBlocks = [...(production?.blocks || [])].sort((a, b) => a.order - b.order);

  return (
    <>
      {/* Episode Preview */}
      {showEpisodePreview && production && (
        <EpisodePreview
          production={production}
          onClose={() => setShowEpisodePreview(false)}
        />
      )}

      {/* Block Player */}
      {showBlockPlayer && masterTimeline.length > 0 && (
        <BlockPlayer
          blocks={masterTimeline}
          characters={episodeProduction?.characters || []}
          userBlocks={production?.blocks || []}
          onClose={() => setShowBlockPlayer(false)}
          onProduce={(block) => {
            setShowBlockPlayer(false);
            handleProduceInStudio(block, productionMethod);
          }}
        />
      )}

      {/* Production Method Guide Modal */}
      {showMethodGuide && productionMethod && (
        <ProductionMethodGuide
          productionMethod={productionMethod}
          block={blockDetails?.block}
          character={blockDetails?.character}
          onClose={() => {
            setShowMethodGuide(false);
            sessionStorage.removeItem('studio_block_details');
          }}
          onContinue={handleContinueFromGuide}
        />
      )}

      {/* Production Method Selector Modal */}
      {showMethodSelector && (
        <ProductionMethodSelector
          onSelect={(method) => {
            handleSelectMethod(method);
          }}
          onCancel={() => {
            setShowMethodSelector(false);
            setPendingBlock(null);
          }}
        />
      )}

      {/* Navigation Status Indicator */}
      {navigationStatus && (
        <div className="fixed top-20 right-4 z-[200] bg-red-600 text-white px-6 py-4 rounded-xl shadow-2xl">
          <p className="text-white text-sm font-mono font-bold">{navigationStatus}</p>
        </div>
      )}

      <div className="fixed inset-0 bg-black z-50 flex flex-col overflow-hidden">
        <ProductionHeader
          productionName={productionName}
          setProductionName={setProductionName}
          kitPage={kitPage}
          saving={saving}
          onClose={onClose}
          onPreview={() => setShowEpisodePreview(true)}
          onPublish={async () => {
            if (!production?.id) { toast.error('No episode selected to publish'); return; }
            if (!production?.blocks?.filter(b => b.media_url).length) { toast.error('Add media to your scenes before publishing'); return; }
            try {
              const res = await base44.functions.invoke('publishEpisode', {
                kit_page_id: kitPageProp?.id || 'free_timeline',
                dossier_id: dossier?.id,
                production_id: production.id
              });
              if (res.data?.success) {
                qc.invalidateQueries({ queryKey: ['dossiers'] });
                qc.invalidateQueries({ queryKey: ['publishedDossiers'] });
                toast.success('Episode published! Redirecting to Magazine…');
                navigate(`/Magazine?dossier=${res.data.dossier_id}`);
              } else {
                toast.error(res.data?.error || 'Publish failed — no success response');
              }
            } catch (err) {
              toast.error(err.response?.data?.error || err.message || 'Publish failed');
            }
          }}
          hasBlocks={production?.blocks?.length > 0}
          dossier={dossier}
        />

        <EpisodesTabBar
          episodes={episodes}
          activeEpisodeId={activeEpisodeId}
          selectEpisode={selectEpisode}
          deleteEpisode={deleteEpisode}
          createEpisode={createEpisode}
          isEpisodeLocked={isEpisodeLocked}
        />

        <div className="flex-1 overflow-y-auto px-6 py-6 pb-24 space-y-4 bg-black" style={{scrollbarColor: 'rgba(255,255,255,0.2) transparent', scrollbarWidth: 'thin'}}>

          {!production && episodes.length === 0 ? (
            <div className="space-y-6">
              {/* Episode Details Banner (no-production view) */}
              {episodePage && (episodePage.episode_title || episodePage.episode_description || episodePage.episode_role) && (
                <div className="relative overflow-hidden rounded-3xl border border-yellow-400/20 bg-gradient-to-br from-yellow-400/10 via-black to-black">
                  <div className="h-1 w-full bg-gradient-to-r from-yellow-400 via-red-500 to-yellow-400" />
                  <div className="p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                      <p className="text-yellow-400 text-[10px] uppercase tracking-[0.25em] font-black">Episode Details</p>
                    </div>
                    {episodePage.episode_title && (
                      <p className="text-white text-2xl font-black leading-tight">{episodePage.episode_title}</p>
                    )}
                    {episodePage.episode_description && (
                      <p className="text-white text-sm leading-relaxed">{episodePage.episode_description}</p>
                    )}
                    {episodePage.episode_role && (
                      <div className="flex items-center gap-2 pt-1">
                        <Users size={12} className="text-yellow-400/70" />
                        <p className="text-yellow-400/80 text-xs font-semibold">{episodePage.episode_role}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Master Timeline View */}
              {masterTimeline.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white text-base font-black uppercase tracking-wider">Production Timeline</p>
                      <p className="text-white text-xs mt-0.5">{masterTimeline.length} blocks to produce</p>
                    </div>
                    <button
                      onClick={() => setShowBlockPlayer(true)}
                      className="flex items-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-500 rounded-2xl text-white font-black transition-colors shadow-lg shadow-red-600/30"
                    >
                      <Play size={16} className="fill-white" />
                      <span className="text-sm">Play</span>
                    </button>
                  </div>
                  <div className="space-y-3">
                    {masterTimeline.map((block, idx) => (
                      <TimelineBlock
                        key={block.id}
                        block={block}
                        character={episodeProduction?.characters?.find(c => c.id === block.assigned_character_id)}
                        kitPage={kitPage}
                        hasUserVersion={false}
                        onProduce={() => createEpisode().then(() => setTimeout(() => handleProduceInStudio(block), 100))}
                        onEdit={() => {}}
                        referenceMedia={block.reference_media || []}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {!masterTimeline.length && (
                <div className="flex flex-col items-center gap-4 py-20">
                  <p className="text-white text-sm">No episode yet</p>
                  <button onClick={createEpisode} className="px-6 py-3 bg-white text-black text-sm font-semibold rounded-full hover:bg-white/90">+ Create First Episode</button>
                </div>
              )}
            </div>
          ) : (
            <>
            {/* Episode info with lock banner */}
            <div className="space-y-3 pb-4 border-b border-white/10">
              {isEpisodeLocked && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-900/20 border border-red-600/30 rounded-xl">
                  <span className="text-xl">🔒</span>
                  <div>
                    <p className="text-red-400 text-sm font-semibold">Episode Locked</p>
                    <p className="text-red-400/60 text-xs">No modifications allowed</p>
                  </div>
                </div>
              )}
              
              {!production ? (
                <EpisodeCreationForm
                  episodeTitle={episodeTitle}
                  setEpisodeTitle={setEpisodeTitle}
                  episodeDesc={episodeDesc}
                  setEpisodeDesc={setEpisodeDesc}
                  seriesDesc={seriesDesc}
                  setSeriesDesc={setSeriesDesc}
                  posterImage={posterImage}
                  setPosterImage={setPosterImage}
                  authorName={authorName}
                  setAuthorName={setAuthorName}
                  publicationDate={publicationDate}
                  setPublicationDate={setPublicationDate}
                  category={category}
                  setCategory={setCategory}
                  onCreate={createEpisode}
                  isLocked={isEpisodeLocked}
                />
              ) : (
                <EpisodeMetadataDisplay
                posterImage={posterImage}
                seriesDesc={seriesDesc}
                authorName={authorName}
                publicationDate={publicationDate}
                episodeTitle={episodeTitle}
                episodeDesc={episodeDesc}
                category={category}
                isLocked={isEpisodeLocked}
                onTitleChange={setEpisodeTitle}
                onDescChange={setEpisodeDesc}
                onSeriesChange={setSeriesDesc}
                onAuthorChange={setAuthorName}
                onPubDateChange={setPublicationDate}
                onCategoryChange={setCategory}
                onPosterChange={setPosterImage}
                onSave={async () => {
                  if (!production) return;
                  const saved = await persist(production.blocks || []);
                  if (saved) {
                    setProduction(saved);
                    setEpisodes(prev => prev.map(e => e.id === saved.id ? saved : e));
                  }
                }}
                saving={saving}
              />
              )}
            </div>

            {/* Add Block Button */}
            {!isEpisodeLocked && production && (
              <button onClick={addBlock}
                className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-red-600/50 hover:border-red-600 rounded-xl text-red-400 hover:text-red-300 transition-colors">
                <Plus size={18} />
                <span className="text-sm font-semibold">+ Add Scene</span>
              </button>
            )}
            
            {/* Show hint if no production exists */}
            {!production && !isEpisodeLocked && (
              <p className="text-white text-xs text-center py-4">Create an episode first to add scenes</p>
            )}

            {/* Episode Details Banner */}
            {episodePage && (episodePage.episode_title || episodePage.episode_description || episodePage.episode_role) && (
              <div className="relative overflow-hidden rounded-3xl border border-yellow-400/20 bg-gradient-to-br from-yellow-400/10 via-black to-black">
                <div className="h-1 w-full bg-gradient-to-r from-yellow-400 via-red-500 to-yellow-400" />
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                    <p className="text-yellow-400 text-[10px] uppercase tracking-[0.25em] font-black">Episode Details</p>
                  </div>
                  {episodePage.episode_title && (
                    <p className="text-white text-2xl font-black leading-tight">{episodePage.episode_title}</p>
                  )}
                  {episodePage.episode_description && (
                    <p className="text-white text-sm leading-relaxed">{episodePage.episode_description}</p>
                  )}
                  {episodePage.episode_role && (
                    <div className="flex items-center gap-2 pt-1">
                      <Users size={12} className="text-yellow-400/70" />
                      <p className="text-yellow-400/80 text-xs font-semibold">{episodePage.episode_role}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Master Timeline View */}
            {masterTimeline.length > 0 && (
              <div className="space-y-3 pb-4 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-base font-black uppercase tracking-wider">Production Timeline</p>
                    <p className="text-white text-xs mt-0.5">{masterTimeline.length} blocks to produce</p>
                  </div>
                  <button
                    onClick={() => setShowBlockPlayer(true)}
                    className="flex items-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-500 rounded-2xl text-white font-black transition-colors shadow-lg shadow-red-600/30"
                  >
                    <Play size={16} className="fill-white" />
                    <span className="text-sm">Play</span>
                  </button>
                </div>
                <div className="space-y-3">
                  {masterTimeline.map((block, idx) => {
                    const userVersion = getUserVersionForBlock(block.id);
                    // Find assigned character from episode production
                    const assignedChar = block.assigned_character_id 
                      ? episodeProduction?.characters?.find(c => c.id === block.assigned_character_id)
                      : null;
                    // Merge reference media from master timeline with user's produced media
                    const userBlock = production?.blocks?.find(b => b.id === block.id);
                    // Collect ALL available reference media from multiple sources
                    const mergedReferenceMedia = [
                      ...(block.reference_media || []),
                      ...(userBlock?.media_url ? [userBlock.media_url] : []),
                      // Fallback: if block has media_url but no reference_media, use it
                      ...(block.media_url && !block.reference_media?.length ? [block.media_url] : []),
                    ].filter((url, i, arr) => arr.indexOf(url) === i); // Remove duplicates
                    console.log('Block', block.id, 'reference_media:', block.reference_media, 'media_url:', block.media_url, 'userBlock:', userBlock);
                    console.log('Merged referenceMedia for block', block.id, ':', mergedReferenceMedia);
                    return (
                      <TimelineBlock
                        key={block.id}
                        block={block}
                        character={assignedChar}
                        kitPage={kitPage}
                        hasUserVersion={!!userVersion}
                        onProduce={async (masterBlock, toolType, mediaUrl, mediaType) => {
                          if (!mediaUrl) return;
                          // Find or create a user block matching this master block
                          const currentBlocks = production?.blocks || [];
                          const existing = currentBlocks.find(b => b.id === masterBlock.id);
                          const updatedBlock = existing
                            ? { ...existing, media_url: mediaUrl, media_type: mediaType, title: existing.title || masterBlock.title }
                            : { id: masterBlock.id, order: masterBlock.order, title: masterBlock.title || '', description: masterBlock.description || '', media_url: mediaUrl, media_type: mediaType };
                          const newBlocks = existing
                            ? currentBlocks.map(b => b.id === masterBlock.id ? updatedBlock : b)
                            : [...currentBlocks, updatedBlock];
                          setProduction(prev => ({ ...prev, blocks: newBlocks }));
                          await persist(newBlocks);
                        }}
                        onEdit={() => handleViewInStudio(block)}
                        referenceMedia={mergedReferenceMedia}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {editingBlock ? (
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <button onClick={() => setEditingBlock(null)} className="text-white hover:text-white">
                    <ChevronLeft size={20} />
                  </button>
                  <p className="text-white text-sm font-semibold flex-1">Edit Scene</p>
                </div>
                <BlockEditor
                  block={editingBlock}
                  kitPage={kitPage}
                  inline={true}
                  onUpdate={updateBlock}
                  onClose={() => setEditingBlock(null)}
                />
              </div>
            ) : (
              <SceneListView
                sortedBlocks={sortedBlocks}
                handleViewBlock={handleViewBlock}
                deleteBlock={deleteBlock}
                savingBlockId={savingBlockId}
                savedBlockId={savedBlockId}
                persist={persist}
                production={production}
                onBlockTitleChange={(blockId, title) => {
                  setProduction(prev => {
                    if (!prev) return prev;
                    const newBlocks = (prev.blocks || []).map(b => b.id === blockId ? { ...b, title } : b);
                    return { ...prev, blocks: newBlocks };
                  });
                }}
              />
            )}
            </>
          )}
        </div>
      </div>


    </>
  );
}