import VoicePicker from '@/components/studio/VoicePicker.jsx';
import React, { useState, useEffect, useRef } from 'react';
import { Film, Users, MapPin, Zap, Clapperboard, Mic, Play, CheckCircle2, Wand2, X, Loader2, Sparkles, Camera, Video, Palette, Upload, Music, Type, ListVideo, Layers, Folder, Check, Coins, Bookmark, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import VaultPickerModal from '@/components/studio/VaultPickerModal';
import ImageCropModal from '@/components/studio/ImageCropModal';
import VideoTools from '@/components/studio/VideoTools';
import AnimateImage from '@/components/studio/AnimateImage';

const PHOTO_SLOTS = [
  { key: 'front',    label: 'Full Front',  placeholder: '/placeholders/silhouette-full.svg' },
  { key: 'back',     label: 'Full Back',   placeholder: '/placeholders/silhouette-full.svg' },
  { key: 'side',     label: 'Full Side',   placeholder: '/placeholders/silhouette-side.svg' },
  { key: 'portrait', label: 'Portrait',    placeholder: '/placeholders/silhouette-portrait.svg' },
  { key: 'profile',  label: 'Profile',     placeholder: '/placeholders/silhouette-profile.svg' },
];

const blockTypeConfig = {
  character: { icon: Users, color: 'bg-red-500', label: 'Character' },
  establishing_shot: { icon: MapPin, color: 'bg-blue-500', label: 'Establishing Shot' },
  action_element: { icon: Zap, color: 'bg-yellow-500', label: 'Action' },
  transition: { icon: Clapperboard, color: 'bg-purple-500', label: 'Transition' },
  closing_shot: { icon: Film, color: 'bg-green-500', label: 'Closing Shot' },
};

// All scenes have access to all production techniques
const ALL_TOOLS = ['compose_scene', 'animate_image', 'animate_with_reference', 'lip_sync', 'text_to_video'];

// ── Voice Panel (matches VoiceRecorder component exactly) ────────────────────
function VoicePanel({ onPublish, onClose }) {
  const [recState, setRecState] = useState('idle'); // idle | recording | preview | uploading
  const [elapsed, setElapsed] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioPlayerRef = useRef(null);

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    mediaRecorderRef.current = mr; chunksRef.current = [];
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      mr.stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      setAudioBlob(blob); setAudioUrl(URL.createObjectURL(blob)); setRecState('preview');
    };
    mr.start(); setElapsed(0); setRecState('recording');
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  };

  const handleUpload = async () => {
    setRecState('uploading');
    const { file_url } = await base44.integrations.Core.UploadFile({ file: new File([audioBlob], 'rec.webm', { type: 'audio/webm' }) });
    onPublish(file_url, 'audio', 'voice', false);
  };

  const handleReset = () => { setAudioBlob(null); setAudioUrl(null); setElapsed(0); setIsPlaying(false); setRecState('idle'); };

  return (
    <div className="space-y-4 bg-yellow-400 rounded-3xl p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-black text-lg font-bold">Voice Recorder</h3>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20"><X size={16} className="text-black" /></button>
      </div>
      <div className="bg-black rounded-2xl p-6 text-center">
        <div className="h-20 flex items-center justify-center mb-4">
          {recState === 'recording' ? (
            <div className="flex gap-1 items-center">
              {[...Array(12)].map((_, i) => <div key={i} className="w-1 bg-yellow-400 rounded-full animate-pulse" style={{ height: `${8 + Math.random() * 24}px`, animationDelay: `${i * 0.08}s` }} />)}
            </div>
          ) : <Mic size={48} className="text-white/20" />}
        </div>
        <p className="text-yellow-400 text-4xl font-bold font-mono">{fmt(elapsed)}</p>
        <p className="text-white text-sm mt-1">
          {recState === 'recording' ? 'Recording…' : recState === 'preview' ? 'Ready to upload' : 'Tap mic to start'}
        </p>
      </div>
      {recState === 'preview' && audioUrl && (
        <audio ref={audioPlayerRef} src={audioUrl} controls className="w-full rounded-xl" onEnded={() => setIsPlaying(false)} />
      )}
      <div className="flex items-center justify-center gap-4">
        {recState === 'idle' && (
          <button onClick={startRecording} className="w-16 h-16 bg-black rounded-full flex items-center justify-center hover:scale-105 transition-transform">
            <Mic size={24} className="text-yellow-400" />
          </button>
        )}
        {recState === 'recording' && (
          <button onClick={stopRecording} className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center hover:scale-105 transition-transform">
            <div className="w-5 h-5 bg-white rounded-sm" />
          </button>
        )}
        {recState === 'preview' && (
          <>
            <button onClick={handleReset} className="w-12 h-12 bg-black/20 rounded-full flex items-center justify-center hover:bg-black/30 transition-colors">
              <X size={18} className="text-black" />
            </button>
            <button onClick={handleUpload} className="w-full py-4 bg-black text-yellow-400 font-bold rounded-2xl flex items-center justify-center gap-2">
              <Upload size={18} /> Upload Voice
            </button>
          </>
        )}
        {recState === 'uploading' && (
          <div className="flex items-center gap-3 py-4 justify-center">
            <Loader2 size={20} className="animate-spin text-black" />
            <span className="text-black">Uploading…</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Lip Sync Panel (matches LipSync component exactly) ───────────────────────
function LipSyncPanel({ onPublish, onClose, referenceMedia, userEmail }) {
  const firstRefVideo = referenceMedia?.find(url => url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i)) || null;
  const firstRefImage = !firstRefVideo ? (referenceMedia?.find(url => !url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i)) || null) : null;
  const preloadedVideo = firstRefVideo || firstRefImage;
  const [videoUrl, setVideoUrl] = useState(preloadedVideo);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioName, setAudioName] = useState('');
  const [videoName, setVideoName] = useState(preloadedVideo ? 'Series reference' : '');
  const [uploading, setUploading] = useState({ video: false, audio: false });
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  // Audio mode: 'pick' | 'record'
  const [audioMode, setAudioMode] = useState(null);
  // Recording state
  const [recState, setRecState] = useState('idle');
  const [recElapsed, setRecElapsed] = useState(0);
  const [recBlob, setRecBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  // Vault picker for audio
  const [showVaultAudio, setShowVaultAudio] = useState(false);
  const [vaultFolders, setVaultFolders] = useState([]);
  const [vaultAssets, setVaultAssets] = useState([]);
  const [selectedVaultFolder, setSelectedVaultFolder] = useState(null);
  const [loadingVault, setLoadingVault] = useState(false);

  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const handleVideoUpload = async (file) => {
    setUploading(u => ({ ...u, video: true }));
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setVideoUrl(file_url); setVideoName(file.name);
    setUploading(u => ({ ...u, video: false }));
  };

  const handleAudioUpload = async (file) => {
    setUploading(u => ({ ...u, audio: true }));
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setAudioUrl(file_url); setAudioName(file.name);
    setUploading(u => ({ ...u, audio: false }));
    setAudioMode(null);
  };

  // Recording
  const startRec = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    mediaRecorderRef.current = mr; chunksRef.current = [];
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => { mr.stream.getTracks().forEach(t => t.stop()); setRecBlob(new Blob(chunksRef.current, { type: 'audio/webm' })); setRecState('preview'); };
    mr.start(); setRecElapsed(0); setRecState('recording');
    timerRef.current = setInterval(() => setRecElapsed(s => s + 1), 1000);
  };
  const stopRec = () => { clearInterval(timerRef.current); mediaRecorderRef.current?.stop(); };
  const uploadRec = async () => {
    setRecState('uploading');
    const { file_url } = await base44.integrations.Core.UploadFile({ file: new File([recBlob], 'recording.webm', { type: 'audio/webm' }) });
    setAudioUrl(file_url); setAudioName('Recording'); setAudioMode(null); setRecState('idle'); setRecBlob(null);
  };

  // Vault audio
  const openVault = async () => {
    setShowVaultAudio(true);
    if (!userEmail) return;
    setLoadingVault(true);
    const folders = await base44.entities.VaultFolder.filter({ user_email: userEmail }, 'order', 50).catch(() => []);
    setVaultFolders(folders);
    setLoadingVault(false);
  };
  const loadVaultFolder = async (folder) => {
    if (selectedVaultFolder?.id === folder.id) { setSelectedVaultFolder(null); setVaultAssets([]); return; }
    setSelectedVaultFolder(folder); setLoadingVault(true);
    const assets = await base44.entities.VaultAsset.filter({ user_email: userEmail, folder_id: folder.id, media_type: 'image' }, '-created_date', 50).catch(() => []);
    // Note: VaultAsset only stores images; for audio we rely on upload/record
    setVaultAssets(assets); setLoadingVault(false);
  };

  const handleGenerate = async () => {
    if (!videoUrl || !audioUrl) return;
    setIsGenerating(true); setError('');
    const res = await base44.functions.invoke('replicateGenerate', { method: 'lip_sync', photo_url: videoUrl, audio_url: audioUrl });
    setIsGenerating(false);
    if (res.data?.file_url) setResult(res.data.file_url);
    else setError(res.data?.error || 'Lip sync failed');
  };

  const folderColors = { red:'bg-red-500', orange:'bg-orange-500', yellow:'bg-yellow-400', green:'bg-green-500', blue:'bg-blue-500', purple:'bg-purple-500', pink:'bg-pink-500' };

  return (
    <div className="space-y-5 bg-yellow-400 rounded-3xl p-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-black text-lg font-bold flex items-center gap-2"><Mic size={18} /> Lip Sync</h3>
          <p className="text-black text-xs">Sync audio to a video automatically</p>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20"><X size={16} className="text-black" /></button>
      </div>

      {/* Video */}
      <div>
        <p className="text-black font-semibold mb-2 flex items-center gap-2"><Video size={16} /> Video</p>
        {videoUrl ? (
          <div className="space-y-2">
            {videoUrl.match(/\.(mp4|webm|ogg|mov)(\?|$)/i)
              ? <video src={videoUrl} className="w-full rounded-xl" controls />
              : <img src={videoUrl} alt="" className="w-full rounded-xl" />}
            <div className="flex items-center gap-3 p-3 bg-black/10 rounded-xl">
              <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
              <span className="text-black text-sm truncate flex-1">{videoName}</span>
              <button onClick={() => { setVideoUrl(null); setVideoName(''); }} className="text-black hover:text-black"><X size={14} /></button>
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center gap-2 py-6 border-2 border-dashed border-black/30 rounded-xl cursor-pointer hover:border-black/60 transition-colors">
            {uploading.video ? <Loader2 size={24} className="animate-spin text-black" /> : <Upload size={24} className="text-black" />}
            <span className="text-black text-sm">{uploading.video ? 'Uploading…' : 'Upload video'}</span>
            <input type="file" accept="video/*" className="hidden" disabled={uploading.video} onChange={e => e.target.files?.[0] && handleVideoUpload(e.target.files[0])} />
          </label>
        )}
      </div>

      {/* Audio */}
      <div>
        <p className="text-black font-semibold mb-2 flex items-center gap-2"><Mic size={16} /> Audio</p>
        {audioUrl ? (
          <div className="space-y-2">
            <audio src={audioUrl} controls className="w-full rounded-xl" />
            <div className="flex items-center gap-3 p-3 bg-black/10 rounded-xl">
              <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
              <span className="text-black text-sm truncate flex-1">{audioName}</span>
              <button onClick={() => { setAudioUrl(null); setAudioName(''); }} className="text-black hover:text-black"><X size={14} /></button>
            </div>
          </div>
        ) : audioMode === 'record' ? (
          <div className="bg-black rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-white text-sm font-bold">Record Audio</span>
              <button onClick={() => { setAudioMode(null); setRecState('idle'); setRecBlob(null); clearInterval(timerRef.current); }} className="text-white hover:text-white"><X size={14} /></button>
            </div>
            <div className="text-center">
              <p className="text-yellow-400 text-3xl font-mono font-bold">{fmt(recElapsed)}</p>
              <p className="text-white text-xs mt-1">{recState === 'recording' ? 'Recording…' : recState === 'preview' ? 'Ready to use' : 'Tap to start'}</p>
            </div>
            {recState === 'preview' && recBlob && (
              <audio src={URL.createObjectURL(recBlob)} controls className="w-full" />
            )}
            <div className="flex items-center justify-center gap-3">
              {recState === 'idle' && (
                <button onClick={startRec} className="w-14 h-14 bg-yellow-400 rounded-full flex items-center justify-center hover:scale-105 transition-transform">
                  <Mic size={22} className="text-black" />
                </button>
              )}
              {recState === 'recording' && (
                <button onClick={stopRec} className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center hover:scale-105 transition-transform">
                  <div className="w-5 h-5 bg-white rounded-sm" />
                </button>
              )}
              {recState === 'preview' && (
                <>
                  <button onClick={() => { setRecState('idle'); setRecBlob(null); setRecElapsed(0); }} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20"><X size={16} className="text-white" /></button>
                  <button onClick={uploadRec} className="flex-1 py-3 bg-yellow-400 text-black font-bold rounded-xl flex items-center justify-center gap-2 text-sm">
                    <Upload size={16} /> Use Recording
                  </button>
                </>
              )}
              {recState === 'uploading' && <Loader2 size={20} className="animate-spin text-yellow-400" />}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {/* 3 options: Upload, Record, Vault */}
            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col items-center gap-2 py-4 bg-black/10 border-2 border-dashed border-black/30 rounded-xl cursor-pointer hover:border-black/60 transition-colors">
                {uploading.audio ? <Loader2 size={20} className="animate-spin text-black" /> : <Upload size={20} className="text-black" />}
                <span className="text-black text-xs font-semibold">{uploading.audio ? 'Uploading…' : 'Upload'}</span>
                <input type="file" accept="audio/*" className="hidden" disabled={uploading.audio} onChange={e => e.target.files?.[0] && handleAudioUpload(e.target.files[0])} />
              </label>
              <button onClick={() => setAudioMode('record')} className="flex flex-col items-center gap-2 py-4 bg-black/10 border-2 border-dashed border-black/30 rounded-xl hover:border-black/60 transition-colors">
                <Mic size={20} className="text-black" />
                <span className="text-black text-xs font-semibold">Record</span>
              </button>
              <button onClick={openVault} className="flex flex-col items-center gap-2 py-4 bg-black/10 border-2 border-dashed border-black/30 rounded-xl hover:border-black/60 transition-colors">
                <Folder size={20} className="text-black" />
                <span className="text-black text-xs font-semibold">Vault</span>
              </button>
            </div>
          </div>
        )}

        {/* Vault audio picker */}
        {showVaultAudio && !audioUrl && (
          <div className="mt-3 bg-black rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white text-sm font-bold">Vault (audio files)</span>
              <button onClick={() => setShowVaultAudio(false)} className="text-white hover:text-white"><X size={14} /></button>
            </div>
            <p className="text-white text-xs">Note: Vault stores images. Upload or record audio directly.</p>
            {loadingVault ? <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-white" /></div> : (
              vaultFolders.length === 0
                ? <p className="text-white text-xs italic text-center py-2">No vault folders</p>
                : <div className="flex gap-2 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
                    {vaultFolders.map(f => (
                      <button key={f.id} onClick={() => loadVaultFolder(f)}
                        className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all ${selectedVaultFolder?.id === f.id ? 'border-yellow-400 text-white bg-yellow-400/20' : 'border-white/10 text-white bg-white/5'}`}>
                        <span className={`w-2 h-2 rounded-full ${folderColors[f.color] || 'bg-blue-500'}`} />{f.name}
                      </button>
                    ))}
                  </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-red-600 text-xs font-semibold">{error}</p>}

      {!result && (
        <button onClick={handleGenerate} disabled={!videoUrl || !audioUrl || isGenerating}
          className="w-full py-4 bg-black text-yellow-400 font-bold rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2">
          {isGenerating ? <><Loader2 size={18} className="animate-spin" /> Syncing… (~1–3 min)</> : <><Mic size={18} /> Generate Lip Sync</>}
        </button>
      )}
      {result && (
        <div className="space-y-4">
          <div className="bg-black rounded-2xl overflow-hidden"><video src={result} controls className="w-full" /></div>
          <button onClick={() => onPublish(result, 'video', 'lip_sync', false)}
            className="w-full py-4 bg-green-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> Publish to Timeline
          </button>
        </div>
      )}
    </div>
  );
}

// ── Dress Actor Panel (matches LabWorkspace InlineDressActor exactly) ─────────
function DressActorPanel({ userEmail, onPublish, onClose }) {
  const [characters, setCharacters] = useState([]);
  const [vaultFolders, setVaultFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [folderAssets, setFolderAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [selectedChar, setSelectedChar] = useState(null);
  const [costumeUrls, setCostumeUrls] = useState([]);
  const [costumeFolder, setCostumeFolder] = useState(null);
  const [costumeFolderAssets, setCostumeFolderAssets] = useState([]);
  const [loadingCostumeAssets, setLoadingCostumeAssets] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const folderColors = { red:'bg-red-500', orange:'bg-orange-500', yellow:'bg-yellow-400', green:'bg-green-500', blue:'bg-blue-500', purple:'bg-purple-500', pink:'bg-pink-500' };

  useEffect(() => {
    if (!userEmail) return;
    base44.entities.CharacterSheet.filter({ user_email: userEmail }).then(setCharacters).catch(() => {});
    base44.entities.VaultFolder.filter({ user_email: userEmail }, 'order', 50).then(setVaultFolders).catch(() => {});
  }, [userEmail]);

  const handleSelectFolder = async (folder) => {
    if (selectedFolder?.id === folder.id) { setSelectedFolder(null); setFolderAssets([]); return; }
    setSelectedFolder(folder); setLoadingAssets(true);
    const assets = await base44.entities.VaultAsset.filter({ user_email: userEmail, folder_id: folder.id, media_type: 'image' }, '-created_date', 50).catch(() => []);
    setFolderAssets(assets); setLoadingAssets(false);
  };

  const handleSelectCostumeFolder = async (folder) => {
    if (costumeFolder?.id === folder.id) { setCostumeFolder(null); setCostumeFolderAssets([]); return; }
    setCostumeFolder(folder); setLoadingCostumeAssets(true);
    const assets = await base44.entities.VaultAsset.filter({ user_email: userEmail, folder_id: folder.id, media_type: 'image' }, '-created_date', 50).catch(() => []);
    setCostumeFolderAssets(assets); setLoadingCostumeAssets(false);
  };

  const toggleCostume = (url) => setCostumeUrls(prev => prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]);

  const [savedToVault, setSavedToVault] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState(null);

  const handleGenerate = async () => {
    setStatus('generating'); setError('');
    const charName = selectedChar?.character_name || selectedChar?.label || 'a character';
    const refImages = [];
    if (selectedChar?.character_photos?.[0]) {
      const raw = selectedChar.character_photos[0];
      try { const parsed = JSON.parse(raw); refImages.push(parsed.portrait || parsed.front || Object.values(parsed)[0]); }
      catch { refImages.push(raw); }
    } else if (selectedChar?.url) refImages.push(selectedChar.url);
    costumeUrls.forEach(u => refImages.push(u));
    const genPrompt = `Full body portrait of ${charName} wearing the exact costume shown in the reference image. ${prompt} High quality fashion photography, neutral background, full outfit visible.`;
    const res = await base44.functions.invoke('replicateGenerate', { method: 'compose_scene', prompt: genPrompt, reference_image_urls: refImages.slice(0, 3), aspect_ratio: '4:3' });
    if (res.data?.file_url) {
      // Save to Vault automatically
      if (userEmail) {
        await base44.entities.VaultAsset.create({ user_email: userEmail, url: res.data.file_url, media_type: 'image', asset_category: 'character' }).catch(() => {});
        setSavedToVault(true);
      }
      setGeneratedImageUrl(res.data.file_url);
      setStatus('result');
    } else {
      setError(res.data?.error || 'Generation failed.');
      setStatus('idle');
    }
  };

  if (status === 'generating') return (
    <div className="flex flex-col items-center gap-3 py-10">
      <Loader2 size={28} className="text-rose-400 animate-spin" />
      <p className="text-white text-sm">Dressing actor… (1–3 min)</p>
    </div>
  );

  if (status === 'result' && generatedImageUrl) return (
    <div className="space-y-4">
      <img src={generatedImageUrl} alt="Dressed actor" className="w-full rounded-2xl" />
      <div className="flex items-center gap-2 px-3 py-2 bg-green-500/20 border border-green-500/40 rounded-xl">
        <CheckCircle2 size={14} className="text-green-400 flex-shrink-0" />
        <p className="text-green-400 text-xs font-semibold">Saved to your Vault (character)</p>
      </div>
      <div className="px-3 py-3 bg-violet-500/20 border border-violet-500/40 rounded-xl">
        <p className="text-violet-300 text-xs font-bold mb-1">Next step</p>
        <p className="text-white text-xs">Go to <span className="font-bold text-violet-300">Video → Animate Image</span> and pick this image from your Vault to create a video for the timeline.</p>
      </div>
      <button onClick={() => { setStatus('idle'); setGeneratedImageUrl(null); setSavedToVault(false); }}
        className="w-full py-3 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-2xl transition-colors">
        Dress Another Actor
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Actor Reference */}
      <div>
        <p className="text-white text-xs font-bold uppercase tracking-wider mb-2">Actor Reference</p>
        {characters.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2" style={{scrollbarWidth:'none'}}>
            {characters.map(c => {
              const photo = c.character_photos?.[0];
              const sel = selectedChar?.id === c.id && !selectedChar?.url;
              return (
                <button key={`cs-${c.id}`} onClick={() => setSelectedChar(sel ? null : c)}
                  className={`flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-2xl border-2 transition-all ${sel ? 'border-rose-500 bg-rose-500/20' : 'border-white/10 bg-white/5'}`}>
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/10">
                    {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : <Users size={20} className="m-auto mt-3 text-white" />}
                  </div>
                  <span className="text-white text-[10px] font-semibold w-16 text-center truncate">{c.character_name || 'Actor'}</span>
                </button>
              );
            })}
          </div>
        )}
        {vaultFolders.length > 0 && (
          <div className="mt-2 space-y-2">
            <p className="text-white text-[10px] uppercase tracking-widest font-semibold">Vault Folders</p>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
              {vaultFolders.map(f => (
                <button key={f.id} onClick={() => handleSelectFolder(f)}
                  className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all text-xs font-semibold ${selectedFolder?.id === f.id ? 'border-rose-500 bg-rose-500/20 text-white' : 'border-white/10 bg-white/5 text-white'}`}>
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${folderColors[f.color] || 'bg-blue-500'}`} />{f.name}
                </button>
              ))}
            </div>
            {selectedFolder && (
              <div className="mt-2">
                {loadingAssets ? <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-white" /></div>
                : folderAssets.length === 0 ? <p className="text-white text-xs italic">No images in this folder</p>
                : (
                  <div className="flex gap-2 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
                    {folderAssets.map(v => {
                      const sel = selectedChar?.id === v.id;
                      return (
                        <button key={v.id} onClick={() => setSelectedChar(sel ? null : { ...v, label: 'Actor', character_photos: [v.url] })}
                          className={`flex-shrink-0 p-1.5 rounded-xl border-2 transition-all ${sel ? 'border-rose-500 bg-rose-500/20' : 'border-white/10 bg-white/5'}`}>
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/10">
                            <img src={v.url} alt="" className="w-full h-full object-cover" />
                          </div>
                          {sel && <CheckCircle2 size={12} className="text-rose-400 mx-auto mt-1" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Costume Reference */}
      <div>
        <p className="text-white text-xs font-bold uppercase tracking-wider mb-2">Costume Reference</p>
        {vaultFolders.length > 0 && (
          <div className="space-y-2 mb-3">
            <div className="flex gap-2 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
              {vaultFolders.map(f => (
                <button key={f.id} onClick={() => handleSelectCostumeFolder(f)}
                  className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all text-xs font-semibold ${costumeFolder?.id === f.id ? 'border-rose-500 bg-rose-500/20 text-white' : 'border-white/10 bg-white/5 text-white'}`}>
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${folderColors[f.color] || 'bg-blue-500'}`} />{f.name}
                </button>
              ))}
            </div>
            {costumeFolder && (
              <div className="mt-1">
                {loadingCostumeAssets ? <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-white" /></div>
                : costumeFolderAssets.length === 0 ? <p className="text-white text-xs italic">No images in this folder</p>
                : (
                  <div className="flex gap-2 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
                    {costumeFolderAssets.map(v => {
                      const sel = costumeUrls.includes(v.url);
                      return (
                        <button key={v.id} onClick={() => toggleCostume(v.url)}
                          className={`flex-shrink-0 relative p-1 rounded-xl border-2 transition-all ${sel ? 'border-rose-500 bg-rose-500/20' : 'border-white/10 bg-white/5'}`}>
                          <div className="w-12 h-12 rounded-lg overflow-hidden"><img src={v.url} alt="" className="w-full h-full object-cover" /></div>
                          {sel && <div className="absolute top-1 right-1 w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center"><CheckCircle2 size={8} className="text-white" /></div>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="w-16 h-16 flex flex-col items-center justify-center gap-1 border-2 border-dashed border-rose-500/40 rounded-xl cursor-pointer hover:border-rose-500/70 transition-colors flex-shrink-0">
            <Upload size={16} className="text-rose-400" />
            <span className="text-rose-400 text-[9px] font-bold">Upload</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={async e => {
              const files = Array.from(e.target.files); if (!files.length) return;
              const urls = await Promise.all(files.map(f => base44.integrations.Core.UploadFile({ file: f }).then(r => r.file_url)));
              setCostumeUrls(prev => [...prev, ...urls]);
            }} />
          </label>
          {costumeUrls.map((url, i) => (
            <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button onClick={() => setCostumeUrls(prev => prev.filter(u => u !== url))}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 flex items-center justify-center text-white">
                <X size={8} />
              </button>
            </div>
          ))}
          {costumeUrls.length === 0 && <p className="text-white text-xs">No costume selected yet</p>}
        </div>
      </div>

      <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Add styling details… (optional)" rows={2}
        className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30 resize-none" />

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button onClick={handleGenerate} disabled={!selectedChar && costumeUrls.length === 0}
        className="w-full py-4 bg-rose-600 text-white font-bold rounded-2xl disabled:opacity-40 transition-opacity flex items-center justify-center gap-2">
        <Sparkles size={18} /> Dress Actor →
      </button>
    </div>
  );
}

// ── Compose Scene (matches LabWorkspace InlineCompose exactly) ────────────────
function ComposeScene({ userEmail, onClose }) {
  const [characters, setCharacters] = useState([]);
  const [sets, setSets] = useState([]);
  const [vaultFolders, setVaultFolders] = useState([]);
  const [selectedCharFolder, setSelectedCharFolder] = useState(null);
  const [selectedSetFolder, setSelectedSetFolder] = useState(null);
  const [charFolderAssets, setCharFolderAssets] = useState([]);
  const [setFolderAssets, setSetFolderAssets] = useState([]);
  const [loadingCharAssets, setLoadingCharAssets] = useState(false);
  const [loadingSetAssets, setLoadingSetAssets] = useState(false);
  const [selectedChar, setSelectedChar] = useState(null);
  const [selectedSet, setSelectedSet] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [uploadedPhoto, setUploadedPhoto] = useState(null);
  const [tokenCost, setTokenCost] = useState(10);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [generatedImageUrl, setGeneratedImageUrl] = useState(null);

  const folderColors = { red:'bg-red-500', orange:'bg-orange-500', yellow:'bg-yellow-400', green:'bg-green-500', blue:'bg-blue-500', purple:'bg-purple-500', pink:'bg-pink-500' };

  useEffect(() => {
    base44.entities.ToolPricing.filter({ tool_id: 'compose_scene', is_active: true })
      .then(r => { if (r[0]) setTokenCost(r[0].token_cost); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!userEmail) return;
    base44.entities.CharacterSheet.filter({ user_email: userEmail }).then(setCharacters).catch(() => {});
    base44.entities.SetAsset.filter({ user_email: userEmail }).then(setSets).catch(() => {});
    base44.entities.VaultFolder.filter({ user_email: userEmail }, 'order', 50).then(setVaultFolders).catch(() => {});
  }, [userEmail]);

  const handleSelectCharFolder = async (folder) => {
    if (selectedCharFolder?.id === folder.id) { setSelectedCharFolder(null); setCharFolderAssets([]); return; }
    setSelectedCharFolder(folder);
    setLoadingCharAssets(true);
    const assets = await base44.entities.VaultAsset.filter({ user_email: userEmail, folder_id: folder.id, media_type: 'image' }, '-created_date', 50).catch(() => []);
    setCharFolderAssets(assets);
    setLoadingCharAssets(false);
  };

  const handleSelectSetFolder = async (folder) => {
    if (selectedSetFolder?.id === folder.id) { setSelectedSetFolder(null); setSetFolderAssets([]); return; }
    setSelectedSetFolder(folder);
    setLoadingSetAssets(true);
    const assets = await base44.entities.VaultAsset.filter({ user_email: userEmail, folder_id: folder.id, media_type: 'image' }, '-created_date', 50).catch(() => []);
    setSetFolderAssets(assets);
    setLoadingSetAssets(false);
  };

  const handleGenerate = async () => {
    if (!selectedSet && !uploadedPhoto) { setError('Please select a set or upload a photo first.'); return; }
    if (!prompt.trim()) { setError('Please enter a prompt.'); return; }
    setStatus('generating'); setError('');
    const charName = selectedChar?.character_name || 'a person';
    const setName = selectedSet?.name || 'a cinematic set';
    const refImages = [];
    if (selectedChar?.character_photos?.[0]) refImages.push(selectedChar.character_photos[0]);
    if (selectedSet?.images?.[0]) refImages.push(selectedSet.images[0]);
    if (uploadedPhoto) refImages.unshift(uploadedPhoto);
    const genPrompt = selectedChar
      ? `Cinematic production still: ${charName} in ${setName}. ${prompt} Professional film photography, dramatic lighting.`
      : `Cinematic production still: ${setName}. ${prompt} Professional film photography, dramatic lighting, atmospheric.`;
    try {
      const res = await base44.functions.invoke('replicateGenerate', { method: 'compose_scene', prompt: genPrompt, reference_image_urls: refImages.slice(0, 3), aspect_ratio: aspectRatio });
      if (res.data?.file_url) {
        // Save to Vault automatically
        if (userEmail) {
          await base44.entities.VaultAsset.create({ user_email: userEmail, url: res.data.file_url, media_type: 'image', asset_category: 'set' }).catch(() => {});
        }
        setGeneratedImageUrl(res.data.file_url);
        setStatus('result');
      } else { setError(res.data?.error || 'Generation failed.'); setStatus('idle'); }
    } catch { setError('An error occurred. Please try again.'); setStatus('idle'); }
  };

  if (status === 'generating') return (
    <div className="flex flex-col items-center gap-3 py-10">
      <Loader2 size={28} className="text-red-400 animate-spin" />
      <p className="text-white text-sm">Generating scene… (1–3 min)</p>
    </div>
  );

  if (status === 'result' && generatedImageUrl) return (
    <div className="space-y-4">
      <img src={generatedImageUrl} alt="Composed scene" className="w-full rounded-2xl" />
      <div className="flex items-center gap-2 px-3 py-2 bg-green-500/20 border border-green-500/40 rounded-xl">
        <CheckCircle2 size={14} className="text-green-400 flex-shrink-0" />
        <p className="text-green-400 text-xs font-semibold">Saved to your Vault (set)</p>
      </div>
      <div className="px-3 py-3 bg-violet-500/20 border border-violet-500/40 rounded-xl">
        <p className="text-violet-300 text-xs font-bold mb-1">Next step</p>
        <p className="text-white text-xs">Go to <span className="font-bold text-violet-300">Video → Animate Image</span> and pick this image from your Vault to create a video for the timeline.</p>
      </div>
      <button onClick={() => { setStatus('idle'); setGeneratedImageUrl(null); }}
        className="w-full py-3 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-2xl transition-colors">
        Compose Another Scene
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Debug info */}
      <div className="bg-white/5 rounded-lg p-3 text-xs text-white">
        <p>User: {userEmail || 'none'}</p>
        <p>Characters: {characters.length} | Sets: {sets.length} | Vault Folders: {vaultFolders.length}</p>
        <p>Selected: {selectedChar?.character_name || 'none'} | {selectedSet?.name || 'none'}</p>
      </div>

      {/* Pick Character from Vault */}
      <div className="space-y-2">
        <p className="text-white text-xs font-bold uppercase tracking-wider">Pick Character from Vault</p>
        {vaultFolders.length === 0 ? (
          <p className="text-white text-xs italic">No vault folders yet</p>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
              {vaultFolders.map(f => {
                const isOpen = selectedCharFolder?.id === f.id;
                return (
                  <button key={f.id} onClick={() => handleSelectCharFolder(f)}
                    className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all text-xs font-semibold ${isOpen ? 'border-yellow-400 bg-yellow-400/20 text-white' : 'border-white/20 bg-white/10 text-white'}`}>
                    <span className={`w-2 h-2 rounded-full ${folderColors[f.color] || 'bg-blue-500'}`} />{f.name}
                  </button>
                );
              })}
            </div>
            {selectedCharFolder && (
              <div className="mt-2">
                {loadingCharAssets ? <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-white" /></div>
                : charFolderAssets.length === 0 ? <p className="text-white text-xs italic">No images in this folder</p>
                : (
                  <div className="flex gap-2 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
                    {charFolderAssets.map(v => {
                      const sel = selectedChar?.id === v.id;
                      return (
                        <button key={v.id} onClick={() => setSelectedChar(sel ? null : { ...v, character_name: 'Actor', character_photos: [v.url] })}
                          className={`flex-shrink-0 flex flex-col items-center gap-1 p-1.5 rounded-xl border-2 transition-all ${sel ? 'border-yellow-400 bg-yellow-400/20' : 'border-white/20 bg-white/10'}`}>
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/10">
                            <img src={v.url} alt="" className="w-full h-full object-cover" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Character Library */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-white/80 text-xs font-bold uppercase tracking-wider">Character (Library)</p>
          <button onClick={() => base44.entities.CharacterSheet.filter({ user_email: userEmail }).then(setCharacters).catch(() => {})} className="text-white hover:text-white text-xs">↻ Refresh</button>
        </div>
        {characters.length === 0 ? (
          <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-xl p-4 text-center">
            <p className="text-yellow-400 text-sm font-bold">⚠ No actors in your library</p>
            <p className="text-white text-xs mt-1">Go to Library tab → New Actor to create one</p>
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-2" style={{scrollbarWidth:'none'}}>
            {characters.map(c => {
              const photo = c.character_photos?.[0];
              const sel = selectedChar?.id === c.id;
              return (
                <button key={c.id} onClick={() => setSelectedChar(sel ? null : c)}
                  className={`flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-2xl border-2 transition-all ${sel ? 'border-yellow-400 bg-yellow-400/20' : 'border-white/20 bg-white/10 hover:border-white/40'}`}>
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/10">
                    {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : <Users size={20} className="m-auto mt-3 text-white" />}
                  </div>
                  <span className="text-white text-[10px] font-semibold w-16 text-center truncate">{c.character_name || 'Actor'}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Pick Set from Vault */}
      {vaultFolders.length > 0 && (
        <div className="space-y-2">
          <p className="text-white text-xs font-bold uppercase tracking-wider">Pick Set from Vault Folders</p>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
            {vaultFolders.map(f => {
              const isOpen = selectedSetFolder?.id === f.id;
              return (
                <button key={f.id} onClick={() => handleSelectSetFolder(f)}
                  className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all text-xs font-semibold ${isOpen ? 'border-yellow-400 bg-yellow-400/20 text-white' : 'border-white/20 bg-white/10 text-white'}`}>
                  <span className={`w-2 h-2 rounded-full ${folderColors[f.color] || 'bg-blue-500'}`} />{f.name}
                </button>
              );
            })}
          </div>
          {selectedSetFolder && (
            <div className="mt-2">
              {loadingSetAssets ? <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-white" /></div>
              : setFolderAssets.length === 0 ? <p className="text-white text-xs italic">No images in this folder</p>
              : (
                <div className="flex gap-2 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
                  {setFolderAssets.map(v => {
                    const sel = selectedSet?.id === v.id;
                    return (
                      <button key={v.id} onClick={() => setSelectedSet(sel ? null : { ...v, name: 'Set', images: [v.url] })}
                        className={`flex-shrink-0 flex flex-col items-center gap-1 p-1.5 rounded-xl border-2 transition-all ${sel ? 'border-yellow-400 bg-yellow-400/20' : 'border-white/20 bg-white/10'}`}>
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/10">
                          <img src={v.url} alt="" className="w-full h-full object-cover" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sets Library */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-white/80 text-xs font-bold uppercase tracking-wider">Your Sets (Library)</p>
          <button onClick={() => base44.entities.SetAsset.filter({ user_email: userEmail }).then(setSets).catch(() => {})} className="text-white hover:text-white text-xs">↻ Refresh</button>
        </div>
        {sets.length === 0 ? (
          <div className="bg-white/5 rounded-xl p-4 text-center">
            <p className="text-white text-sm">No sets in your library yet</p>
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-2" style={{scrollbarWidth:'none'}}>
            {sets.map(s => {
              const img = s.images?.[0];
              const sel = selectedSet?.id === s.id;
              return (
                <button key={s.id} onClick={() => setSelectedSet(sel ? null : s)}
                  className={`flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-2xl border-2 transition-all ${sel ? 'border-yellow-400 bg-yellow-400/20' : 'border-white/20 bg-white/10 hover:border-white/40'}`}>
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/10">
                    {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : <MapPin size={20} className="m-auto mt-3 text-white" />}
                  </div>
                  <span className="text-white text-[10px] font-semibold w-16 text-center truncate">{s.name || 'Set'}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Aspect Ratio */}
      <div className="space-y-2">
        <p className="text-white/80 text-xs font-bold uppercase tracking-wider">Aspect Ratio</p>
        <div className="flex gap-2">
          {['16:9', '4:3', '9:16'].map(r => (
            <button key={r} onClick={() => setAspectRatio(r)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${aspectRatio === r ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white hover:bg-white/20'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Upload Photo */}
      <div className="bg-white/5 rounded-xl p-4">
        <p className="text-white/80 text-xs font-bold uppercase tracking-wider mb-3">Or Upload Photo</p>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 px-4 py-3 bg-yellow-400 text-black rounded-xl cursor-pointer hover:bg-yellow-300 transition-colors font-semibold text-sm">
            <Upload size={16} />
            <span>Upload Photo</span>
            <input type="file" accept="image/*" className="hidden" onChange={async e => {
              const f = e.target.files[0]; if (!f) return;
              const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
              setUploadedPhoto(file_url);
            }} />
          </label>
          {uploadedPhoto && (
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
              <div className="w-8 h-8 rounded-lg overflow-hidden"><img src={uploadedPhoto} alt="" className="w-full h-full object-cover" /></div>
              <span className="text-green-400 text-xs font-semibold">✓ Ready</span>
              <button onClick={() => setUploadedPhoto(null)} className="text-white hover:text-white"><X size={14} /></button>
            </div>
          )}
        </div>
      </div>

      {/* Prompt */}
      <div>
        <p className="text-white/80 text-xs font-bold uppercase tracking-wider mb-2">Prompt <span className="text-red-400">*</span></p>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Required: Describe mood, action, lighting…" rows={2}
          className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-yellow-400 resize-none" />
      </div>

      {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}

      <button onClick={handleGenerate} disabled={(!selectedSet && !uploadedPhoto) || !prompt.trim()}
        className="w-full py-4 bg-yellow-400 text-black font-bold rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-yellow-300 transition-colors flex items-center justify-center gap-2 text-base">
        <Wand2 size={18} /> Generate Scene → ({tokenCost} Ⓣ)
      </button>
    </div>
  );
}

// ── New Actor Panel (full Character Sheet form) ──────────────────────────
function NewActorPanel({ userEmail, onClose, onPublish }) {
  const [name, setName] = useState('');
  const [photos, setPhotos] = useState({});
  const [uploading, setUploading] = useState(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedSheet, setGeneratedSheet] = useState(null);
  const [tokenCost, setTokenCost] = useState(10);

  useEffect(() => {
    base44.entities.ToolPricing.filter({ tool_id: 'character_sheet', is_active: true })
      .then(r => { if (r[0]) setTokenCost(r[0].token_cost); }).catch(() => {});
  }, []);

  const photoCount = Object.keys(photos).length;

  const handleUpload = async (e, slotKey) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(slotKey);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setPhotos(p => ({ ...p, [slotKey]: file_url }));
    setUploading(null);
  };

  const removePhoto = (slotKey) => setPhotos(p => { const n = { ...p }; delete n[slotKey]; return n; });

  const handleGenerate = async () => {
    if (photoCount === 0) return;
    setGenerating(true);
    const imageUrls = PHOTO_SLOTS.map(s => photos[s.key]).filter(Boolean);
    const res = await base44.functions.invoke('generateCharacterSheet', { image_urls: imageUrls });
    if (res.data?.file_url) setGeneratedSheet(res.data.file_url);
    setGenerating(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const photoUrls = PHOTO_SLOTS.map(s => photos[s.key]).filter(Boolean);
    const data = { user_email: userEmail, character_name: name, character_photos: photoUrls, voice_sample_url: generatedSheet || '' };
    await base44.entities.CharacterSheet.create(data);
    // Save all photos + generated sheet to the Vault
    const vaultUrls = [...photoUrls, ...(generatedSheet ? [generatedSheet] : [])];
    await Promise.all(vaultUrls.map(url =>
      base44.entities.VaultAsset.create({ user_email: userEmail, url, media_type: 'image', asset_category: 'character' }).catch(() => {})
    ));
    setSaving(false);
    if (generatedSheet) onPublish(generatedSheet, 'image', 'new_actor', false);
    else onClose();
  };

  return (
    <div className="space-y-6">
      {/* Character Name */}
      <div>
        <label className="block text-white text-sm font-medium mb-2">Character Name</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Noir, Vesper, The Oracle..."
          className="w-full bg-white/8 border border-white/15 rounded-2xl px-4 py-4 text-white text-base placeholder-white/25 focus:outline-none focus:border-white/40" />
      </div>

      {/* Reference Photos */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${photoCount > 0 ? 'bg-green-500' : 'bg-red-600'} text-white`}>
            {photoCount > 0 ? <Check size={16} /> : '1'}
          </div>
          <div>
            <p className="text-white font-semibold text-base">Your Reference Photos</p>
            <p className="text-white text-sm">{photoCount > 0 ? `${photoCount} photo(s) added` : 'Minimum 1 photo — full body, neutral background'}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {PHOTO_SLOTS.map(({ key, label, placeholder }) => (
            <div key={key}>
              <p className="text-white/80 text-sm font-medium mb-2">{label}</p>
              {photos[key] ? (
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden">
                  <img src={photos[key]} alt={label} className="w-full h-full object-cover" />
                  <button onClick={() => removePhoto(key)} className="absolute top-2 right-2 w-7 h-7 bg-black/70 rounded-full flex items-center justify-center hover:bg-black/90 transition-colors">
                    <X size={14} className="text-white" />
                  </button>
                </div>
              ) : (
                <div className="aspect-[3/4] rounded-2xl border-2 border-dashed border-white/30 overflow-hidden flex flex-col bg-white/5">
                  <div className="flex-1 relative flex items-center justify-center">
                    <img src={placeholder} alt={label} className="absolute inset-0 w-full h-full object-cover opacity-30" />
                  </div>
                  <div className="flex border-t border-white/20 flex-shrink-0">
                    <label className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 cursor-pointer hover:bg-white/10 transition-colors">
                      {uploading === key ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Upload size={18} className="text-white/80" />}
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e, key)} />
                    </label>
                    <div className="w-px bg-white/20" />
                    <label className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 cursor-pointer hover:bg-white/10 transition-colors">
                      <Camera size={18} className="text-yellow-400" />
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleUpload(e, key)} />
                    </label>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Generate */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${generatedSheet ? 'bg-green-500' : 'bg-red-600'} text-white`}>
            {generatedSheet ? <Check size={16} /> : '2'}
          </div>
          <div>
            <p className="text-white font-semibold text-base">Generate Character Sheet</p>
            <p className="text-white text-sm">{photoCount > 0 ? `${photoCount} photo(s) ready` : 'Add at least one photo first'}</p>
          </div>
        </div>
        {generatedSheet && (
          <div className="mb-4 rounded-2xl overflow-hidden">
            <img src={generatedSheet} alt="Generated" className="w-full object-contain" />
          </div>
        )}
        <button onClick={handleGenerate} disabled={photoCount === 0 || generating}
          className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed text-black text-base font-bold rounded-2xl transition-colors flex items-center justify-center gap-3">
          {generating ? <><div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />Generating...</> : <><Sparkles size={18} />{generatedSheet ? 'Regenerate' : 'Generate my Character Sheet'}<span className="ml-2 px-3 py-1 bg-black/20 rounded-full text-xs font-black flex items-center gap-1"><Coins size={10} /> {tokenCost} Ⓣ</span></>}
        </button>
      </div>

      {/* Save */}
      <button onClick={handleSave} disabled={saving || photoCount === 0}
        className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-base font-semibold rounded-2xl transition-colors">
        {saving ? 'Saving...' : 'Save Character Sheet'}
      </button>
    </div>
  );
}

// ── New Set Panel (mirrors SetAssetEditor, inline) ───────────────────────────
function NewSetPanel({ userEmail, onClose }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vaultPickerOpen, setVaultPickerOpen] = useState(false);
  const [cropSource, setCropSource] = useState(null);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || images.length >= 8) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setImages(prev => [...prev, file_url]);
    setUploading(false);
  };

  const handleVaultSelect = (url) => { setVaultPickerOpen(false); setCropSource(url); };

  const handleCropConfirm = async (blob) => {
    setUploading(true); setCropSource(null);
    const { file_url } = await base44.integrations.Core.UploadFile({ file: blob });
    setImages(prev => [...prev, file_url]);
    setUploading(false);
  };

  const removeImage = (idx) => setImages(prev => prev.filter((_, i) => i !== idx));

  const addTag = (e) => {
    e.preventDefault();
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  };

  const handleSave = async () => {
    if (!name) return;
    setSaving(true);
    await base44.entities.SetAsset.create({ user_email: userEmail, name, description, tags, images });
    // Also save each image to the Vault
    if (userEmail && images.length > 0) {
      await Promise.all(images.map(url =>
        base44.entities.VaultAsset.create({ user_email: userEmail, url, media_type: 'image', asset_category: 'set' }).catch(() => {})
      ));
    }
    setSaving(false);
    onClose();
  };

  return (
    <div className="space-y-5">
      {/* Name */}
      <div>
        <label className="text-white text-xs uppercase tracking-widest mb-2 block">Set Name</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Gothic Manor, Tropical Beach..."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/30" />
      </div>

      {/* Description */}
      <div>
        <label className="text-white text-xs uppercase tracking-widest mb-2 block">Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Atmosphere, style, lighting, era..." rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/30 resize-none" />
      </div>

      {/* Tags */}
      <div>
        <label className="text-white text-xs uppercase tracking-widest mb-2 block">Tags</label>
        <form onSubmit={addTag} className="flex gap-2 mb-2">
          <input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Add a tag..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/30" />
          <button type="submit" disabled={!tagInput.trim()} className="px-4 py-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white text-sm rounded-xl transition-colors">Add</button>
        </form>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <span key={tag} className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400/15 text-yellow-400 rounded-full text-xs font-medium">
                {tag}
                <button onClick={() => setTags(p => p.filter(t => t !== tag))}><X size={11} /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Images */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-white text-xs uppercase tracking-widest">Sets ({images.length}/8)</label>
          {images.length < 8 && (
            <button onClick={() => setVaultPickerOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-300 rounded-xl text-xs text-black font-semibold transition-colors">
              <Bookmark size={14} /> From Vault
            </button>
          )}
        </div>
        <p className="text-white text-xs mb-3">Add up to 8 set/location images. Upload directly or pick from your Vault.</p>
        <div className="grid grid-cols-3 gap-2">
          {images.map((url, idx) => (
            <div key={idx} className="relative rounded-xl overflow-hidden bg-white/5">
              <img src={url} alt="" className="w-full h-auto object-cover" />
              <button onClick={() => removeImage(idx)} className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center">
                <X size={10} className="text-white" />
              </button>
            </div>
          ))}
          {images.length < 8 && (
            <label className="aspect-square rounded-xl border border-dashed border-white/20 hover:border-white/40 flex items-center justify-center cursor-pointer transition-colors">
              {uploading ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Plus size={20} className="text-white" />}
              <input type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} />
            </label>
          )}
        </div>
      </div>

      <button onClick={handleSave} disabled={saving || !name}
        className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold tracking-widest rounded-xl transition-colors">
        {saving ? 'Saving...' : 'Save Set'}
      </button>

      {vaultPickerOpen && (
        <VaultPickerModal userEmail={userEmail} onSelect={handleVaultSelect} onClose={() => setVaultPickerOpen(false)} />
      )}
      {cropSource && (
        <ImageCropModal imageUrl={cropSource} onConfirm={handleCropConfirm} onClose={() => setCropSource(null)} />
      )}
    </div>
  );
}

// ── Inline Tool Panel ───────────────────────────────────────────────────
function InlineToolPanel({ block, kitPage, referenceMedia, onPublish, onClose, onSwitchTool, toolType, character, userEmail, animateWithRefImageUrl, setAnimateWithRefImageUrl, episodePageId, user }) {
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [generatedMedia, setGeneratedMedia] = useState(null); // { url, type }
  const [selectedCharacters, setSelectedCharacters] = useState([]);
  const [selectedSet, setSelectedSet] = useState(null);
  const [scenePrompt, setScenePrompt] = useState('');
  const [animateImage, setAnimateImage] = useState(null);
  const firstRefImage = referenceMedia?.find(url => !url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i)) || null;
  const [animateImageUrl, setAnimateImageUrl] = useState(firstRefImage);
  const [animateWithRefImage, setAnimateWithRefImage] = useState(null);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  const [showSetPicker, setShowSetPicker] = useState(false);
  const [showVaultPicker, setShowVaultPicker] = useState(false);
  const [vaultPickerFor, setVaultPickerFor] = useState(null); // 'animate', 'animate_with_ref', or 'set'
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [duration, setDuration] = useState(5); // 5 or 10 seconds
  const [audioFile, setAudioFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [uploadedPhoto, setUploadedPhoto] = useState(null);
  const [uploading, setUploading] = useState(null);
  const [selectedActorFolder, setSelectedActorFolder] = useState(null);
  const [selectedCostumeFolder, setSelectedCostumeFolder] = useState(null);
  const [dressActorPrompt, setDressActorPrompt] = useState('');
  const [actorImageUrl, setActorImageUrl] = useState(null);
  const [costumeImageUrl, setCostumeImageUrl] = useState(null);
  const [ttsResultUrl, setTtsResultUrl] = useState(null);
  const [voiceFile, setVoiceFile] = useState(null);
  const [voiceUrl, setVoiceUrl] = useState(null);
  const [instrumentalFile, setInstrumentalFile] = useState(null);
  const [instrumentalUrl, setInstrumentalUrl] = useState(null);
  const [selectedVoice, setSelectedVoice] = useState('Rachel');
  const [speechLanguage, setSpeechLanguage] = useState('en');
  const [selectedEmotion, setSelectedEmotion] = useState('None');
  const [ttsText, setTtsText] = useState('');

  const characters = kitPage?.kit_characters || [];
  const sets = kitPage?.kit_sets || [];
  const costumes = kitPage?.kit_costumes || [];
  
  // Use character prop (from parent) OR find from block assignment
  const currentActor = character || (block.assigned_character_id
    ? characters.find(c => c.id === block.assigned_character_id)
    : null);

  const handleCompose = async () => {
    if (!selectedSet && !uploadedPhoto) {
      setErrorMsg('Please select a set or upload a photo first.');
      return;
    }
    if (!scenePrompt.trim()) {
      setErrorMsg('Please enter a prompt.');
      return;
    }
    setStatus('generating');
    setErrorMsg('');

    const charName = selectedCharacters[0]?.name || 'a person';
    const setName = selectedSet?.name || 'a cinematic set';
    const refImages = [];
    if (selectedCharacters[0]?.media?.[0]) refImages.push(selectedCharacters[0].media[0]);
    if (selectedSet?.media?.[0]) refImages.push(selectedSet.media[0]);
    if (uploadedPhoto) refImages.unshift(uploadedPhoto);
    
    const prompt = selectedCharacters.length > 0
      ? `Cinematic production still: ${charName} in ${setName}. ${scenePrompt} Professional film photography, dramatic lighting.`
      : `Cinematic production still: ${setName}. ${scenePrompt} Professional film photography, dramatic lighting, atmospheric.`;
    
    try {
      const res = await base44.functions.invoke('replicateGenerate', { 
        method: 'compose_scene', 
        prompt, 
        reference_image_urls: refImages.slice(0, 3),
        aspect_ratio: aspectRatio
      });

      if (res.data?.file_url) { 
        setGeneratedMedia({ url: res.data.file_url, type: 'image' });
        setStatus('preview'); 
      } else { 
        setErrorMsg(res.data?.error || 'Generation failed.'); 
        setStatus('idle'); 
      }
    } catch (err) {
      setErrorMsg('Generation failed. Try again.');
      setStatus('idle');
    }
  };

  const handleAnimate = async () => {
    setStatus('generating');
    setErrorMsg('');
    
    let photoUrl = null;
    
    // For animate_with_reference mode
    if (toolType === 'animate_with_reference') {
      photoUrl = animateWithRefImageUrl;
      if (!photoUrl && animateWithRefImage?.file) {
        const r = await base44.integrations.Core.UploadFile({ file: animateWithRefImage.file });
        photoUrl = r.file_url;
      }
    } 
    // For animate_image and lip_sync modes
    else {
      photoUrl = animateImageUrl;
      if (!photoUrl && animateImage?.file) {
        const r = await base44.integrations.Core.UploadFile({ file: animateImage.file });
        photoUrl = r.file_url;
      }
    }
    
    if (!photoUrl) {
      setErrorMsg('Upload an image first.');
      setStatus('idle');
      return;
    }

    try {
      const res = await base44.functions.invoke('replicateGenerate', {
        method: toolType === 'animate_with_reference' ? 'animate_with_reference' : (toolType === 'lip_sync' ? 'lip_sync' : 'animate_image'),
        photo_url: photoUrl,
        prompt_override: scenePrompt || undefined,
        aspect_ratio: aspectRatio
      });

      if (res.data?.file_url) {
        setGeneratedMedia({ url: res.data.file_url, type: 'video' });
        setStatus('preview');
      } else {
        setErrorMsg(res.data?.error || 'Generation failed.');
        setStatus('idle');
      }
    } catch (err) {
      setErrorMsg('Generation failed. Try again.');
      setStatus('idle');
    }
  };

  if (status === 'generating') {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <Loader2 size={24} className="text-amber-400 animate-spin" />
        <p className="text-white text-xs">Generating... (1–4 min)</p>
      </div>
    );
  }

  // Preview mode - show generated media with publish button
  if (status === 'preview' && generatedMedia) {
    return (
      <div className="space-y-3">
        <div className="relative rounded-xl overflow-hidden border border-white/20">
          {generatedMedia.type === 'video' ? (
            <video src={generatedMedia.url} controls className="w-full aspect-video object-cover" />
          ) : (
            <img src={generatedMedia.url} alt="" className="w-full aspect-video object-cover" />
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-white/20 rounded-xl text-white text-xs hover:bg-white/5">Discard</button>
          <button 
            onClick={() => onPublish(generatedMedia.url, generatedMedia.type, toolType, toolType === 'compose_scene')}
            className="flex-1 py-2 bg-green-600 hover:bg-green-500 rounded-xl text-white text-xs font-medium flex items-center justify-center gap-1"
          >
            <CheckCircle2 size={12} />
            Publish to Timeline
          </button>
        </div>
      </div>
    );
  }

  const isAnimateMode = toolType === 'animate_image' || toolType === 'lip_sync';
  const isLipSyncMode = toolType === 'lip_sync';
  const isComposeMode = toolType === 'compose_scene' || toolType === 'compose';
  const isTextToVideo = toolType === 'text_to_video';
  const isDressActorMode = toolType === 'dress_actor';
  const isDubbingMode = toolType === 'dubbing';
  const isTTSMmode = toolType === 'tts';
  const isNewActorMode = toolType === 'new_actor';
  const isVoiceMode = toolType === 'voice';
  const isNewSetMode = toolType === 'new_set';
  const isFreeTimelineMode = toolType === 'my_own_video';
  // Tools that have their own complete UI — don't show fallthrough generic button
  const hasOwnPanel = isTTSMmode || isDubbingMode || isDressActorMode || isComposeMode || isLipSyncMode || toolType === 'animate_image' || isTextToVideo || toolType === 'animate_with_reference' || isNewActorMode || isVoiceMode || isFreeTimelineMode || isNewSetMode;

  return (
    <div className="space-y-6">
      {/* Text to Speech - Yellow modal design */}
      {isTTSMmode && (
        <div className="space-y-5 bg-yellow-400 rounded-3xl p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                  <Sparkles size={16} className="text-yellow-400" />
                </div>
                <p className="text-black text-lg font-bold">Text to Speech</p>
              </div>
              <p className="text-black text-xs mt-1">ElevenLabs v3 with emotions</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 transition-colors">
              <X size={18} className="text-black" />
            </button>
          </div>

          {/* Select Voice */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-black rounded-full flex items-center justify-center">
                <Users size={14} className="text-yellow-400" />
              </div>
              <p className="text-black text-sm font-bold">Select Voice</p>
            </div>
            <VoicePicker value={selectedVoice} onChange={setSelectedVoice} language={speechLanguage} onLanguageChange={setSpeechLanguage} />
          </div>

          {/* Emotion */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-black rounded-full flex items-center justify-center">
                <Sparkles size={14} className="text-yellow-400" />
              </div>
              <p className="text-black text-sm font-bold">Emotion</p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { emoji: '😐', label: 'None' },
                { emoji: '🤩', label: 'Excited' },
                { emoji: '🤫', label: 'Whispers' },
                { emoji: '😮‍💨', label: 'Sighs' },
                { emoji: '😂', label: 'Laughs' },
                { emoji: '🙄', label: 'Sarcastic' },
                { emoji: '😠', label: 'Angry' },
                { emoji: '😢', label: 'Sad' },
              ].map(emotion => (
                <button
                  key={emotion.label}
                  onClick={() => setSelectedEmotion(emotion.label)}
                  className={`p-3 rounded-xl flex flex-col items-center gap-1 transition-all ${
                    selectedEmotion === emotion.label
                      ? 'bg-black text-white'
                      : 'bg-yellow-500 text-black hover:bg-yellow-400'
                  }`}
                >
                  <span className="text-xl">{emotion.emoji}</span>
                  <span className={`text-[10px] font-medium ${selectedEmotion === emotion.label ? 'text-white' : 'text-black'}`}>{emotion.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Enter Text */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-black rounded-full flex items-center justify-center">
                <Type size={14} className="text-yellow-400" />
              </div>
              <p className="text-black text-sm font-bold">Enter Text</p>
            </div>
            <div className="bg-black rounded-2xl p-4">
              <textarea
                value={ttsText}
                onChange={e => setTtsText(e.target.value)}
                placeholder="Type or paste your text here..."
                rows={4}
                className="w-full bg-transparent text-white text-sm placeholder-white/30 focus:outline-none resize-none"
              />
            </div>
            <p className="text-black text-xs text-right mt-1">{ttsText.length}/5000 characters</p>
          </div>

          {errorMsg && <p className="text-red-400 text-xs text-center">{errorMsg}</p>}

          {ttsResultUrl && (
            <div className="space-y-3">
              <audio src={ttsResultUrl} controls className="w-full rounded-xl" />
              <button
                onClick={() => onPublish(ttsResultUrl, 'audio', 'tts', false)}
                className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-2xl text-white text-sm font-bold flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={16} />
                Publish to Timeline
              </button>
            </div>
          )}

          {/* Action Button */}
          <button
            disabled={!ttsText.trim()}
            onClick={async () => {
              setStatus('generating'); setErrorMsg(''); setTtsResultUrl(null);
              try {
                const voice = selectedVoice || 'Rachel';
                const emotionPrefix = selectedEmotion !== 'None' ? `[${selectedEmotion}] ` : '';
                const res = await base44.integrations.Core.GenerateSpeech({ text: emotionPrefix + ttsText, voice, language_code: speechLanguage });
                if (res?.url) { setTtsResultUrl(res.url); setStatus('idle'); }
                else { setErrorMsg('Generation failed.'); setStatus('idle'); }
              } catch (e) { setErrorMsg(e.message || 'Generation failed.'); setStatus('idle'); }
            }}
            className="w-full py-4 bg-black hover:bg-black/80 disabled:opacity-40 disabled:cursor-not-allowed text-yellow-400 text-base font-bold rounded-2xl transition-colors flex items-center justify-center gap-2"
          >
            <Sparkles size={18} />
            Generate Speech
            <Play size={18} className="fill-yellow-400" />
          </button>
        </div>
      )}

      {/* Dubbing Studio - Yellow modal design */}
      {isDubbingMode && (
        <div className="space-y-5">
          {/* Section 1: Your Voice */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                <Mic size={16} className="text-yellow-400" />
              </div>
              <p className="text-black text-sm font-bold">1. Your Voice</p>
            </div>
            <div className="bg-black rounded-2xl p-4">
              {voiceUrl ? (
                <div className="flex items-center gap-3">
                  <audio src={voiceUrl} controls className="flex-1" />
                  <button
                    onClick={() => { setVoiceFile(null); setVoiceUrl(null); }}
                    className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                  >
                    <X size={14} className="text-white" />
                  </button>
                </div>
              ) : (
                <button className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                  <Mic size={16} />
                  Record Voice
                </button>
              )}
            </div>
          </div>

          {/* Section 2: Instrumental Track */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                <Music size={16} className="text-yellow-400" />
              </div>
              <p className="text-black text-sm font-bold">2. Instrumental Track</p>
            </div>
            <div className="bg-black rounded-2xl border-2 border-dashed border-white/20 p-8">
              {instrumentalUrl ? (
                <div className="flex items-center gap-3">
                  <audio src={instrumentalUrl} controls className="flex-1" />
                  <button
                    onClick={() => { setInstrumentalFile(null); setInstrumentalUrl(null); }}
                    className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                  >
                    <X size={14} className="text-white" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 cursor-pointer">
                  <input type="file" accept="audio/*" className="hidden" onChange={e => {
                    const file = e.target.files[0];
                    if (file) {
                      setInstrumentalFile(file);
                      setInstrumentalUrl(URL.createObjectURL(file));
                    }
                  }} />
                  <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center">
                    <Upload size={20} className="text-white" />
                  </div>
                  <p className="text-white text-sm font-medium">Upload Instrumental</p>
                </label>
              )}
            </div>
          </div>

          {/* Action Button */}
          <button className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 text-black text-base font-bold rounded-2xl transition-colors flex items-center justify-center gap-2">
            <Sparkles size={18} />
            Mix & Generate
            <Play size={18} className="fill-black" />
          </button>
        </div>
      )}

      {/* Dress Actor - matches LabWorkspace InlineDressActor exactly */}
      {isDressActorMode && (
        <DressActorPanel userEmail={userEmail} onPublish={onPublish} onClose={onClose} />
      )}

      {/* Compose Scene - matches LabWorkspace InlineCompose exactly */}
      {isComposeMode && (
        <ComposeScene userEmail={userEmail} onClose={onClose} />
      )}

      {/* Lip Sync - matches LipSync component exactly */}
      {isLipSyncMode && (
        <LipSyncPanel onPublish={onPublish} onClose={onClose} referenceMedia={referenceMedia} userEmail={userEmail} />
      )}

      {/* Animate - Full featured with Duration, Aspect Ratio, Audio */}
      {toolType === 'animate_image' && (
        <div className="space-y-5 bg-yellow-400 rounded-3xl p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                  <Film size={16} className="text-yellow-400" />
                </div>
                <p className="text-black text-lg font-bold">Animate Image</p>
              </div>
              <p className="text-black text-xs mt-1">Bring a still image to life with AI motion</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 transition-colors">
              <X size={18} className="text-black" />
            </button>
          </div>

          {/* Reference Media Gallery */}
          <div>
            <p className="text-black text-xs font-bold uppercase tracking-wider mb-3">
              Reference Images ({referenceMedia?.length || 0})
            </p>
            {referenceMedia && referenceMedia.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {referenceMedia.map((url, idx) => {
                  const isVideo = url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i);
                  if (isVideo) return null;
                  return (
                    <button
                      key={idx}
                      onClick={() => setAnimateImageUrl(url)}
                      className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                        animateImageUrl === url ? 'border-black ring-2 ring-black/20' : 'border-black/20 hover:border-black/40'
                      }`}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      {animateImageUrl === url && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                            <Film size={16} className="text-yellow-400" />
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="bg-yellow-500/30 border-2 border-dashed border-black/30 rounded-2xl p-6 text-center">
                <p className="text-black text-sm mb-2">No reference images</p>
                <p className="text-black text-xs">Upload in Admin → Episode Production → Block → Reference Media</p>
              </div>
            )}
          </div>

          {/* Image Upload */}
          <div>
            <p className="text-black text-xs font-bold uppercase tracking-wider mb-3">{referenceMedia?.length > 0 ? 'Or Upload New Image' : 'Upload Image'}</p>
            {(() => {
              const displayImageUrl = animateImageUrl || animateImage?.previewUrl;
              if (displayImageUrl) {
                return (
                  <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-black/10">
                    <img src={displayImageUrl} alt="" className="w-full h-full object-cover" onError={(e) => { console.error('Image load failed:', e.target.src, 'from referenceMedia:', referenceMedia); }} />
                    <button onClick={() => { setAnimateImage(null); setAnimateImageUrl(null); }} className="absolute top-2 right-2 w-7 h-7 bg-black rounded-full flex items-center justify-center hover:bg-black/80 transition-colors">
                      <X size={14} className="text-white" />
                    </button>
                  </div>
                );
              }
              return (
                <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-black/30 rounded-2xl cursor-pointer hover:border-black/50 transition-colors py-10 bg-yellow-500/30">
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    const file = e.target.files[0];
                    if (file) {
                      setAnimateImage({ file, previewUrl: URL.createObjectURL(file) });
                    }
                  }} />
                  <div className="w-14 h-14 bg-black/10 rounded-full flex items-center justify-center">
                    <Upload size={28} className="text-black" />
                  </div>
                  <p className="text-black text-sm font-medium">Upload an image to animate</p>
                </label>
              );
            })()}
          </div>

          {/* Duration */}
          <div>
            <p className="text-black text-xs font-bold uppercase tracking-wider mb-3">Duration</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDuration(5)}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors ${
                  duration === 5 ? 'bg-black text-yellow-400' : 'bg-yellow-500 text-black hover:bg-yellow-400'
                }`}
              >
                5s
              </button>
              <button
                onClick={() => setDuration(10)}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors ${
                  duration === 10 ? 'bg-black text-yellow-400' : 'bg-yellow-500 text-black hover:bg-yellow-400'
                }`}
              >
                10s
              </button>
            </div>
          </div>

          {/* Aspect Ratio */}
          <div>
            <p className="text-black text-xs font-bold uppercase tracking-wider mb-3">Aspect Ratio</p>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => setAspectRatio('9:16')}
                className={`py-3 rounded-xl text-sm font-bold transition-colors ${
                  aspectRatio === '9:16' ? 'bg-black text-yellow-400' : 'bg-yellow-500 text-black hover:bg-yellow-400'
                }`}
              >
                9:16
              </button>
              <button
                onClick={() => setAspectRatio('16:9')}
                className={`py-3 rounded-xl text-sm font-bold transition-colors ${
                  aspectRatio === '16:9' ? 'bg-black text-yellow-400' : 'bg-yellow-500 text-black hover:bg-yellow-400'
                }`}
              >
                16:9
              </button>
              <button
                onClick={() => setAspectRatio('1:1')}
                className={`py-3 rounded-xl text-sm font-bold transition-colors ${
                  aspectRatio === '1:1' ? 'bg-black text-yellow-400' : 'bg-yellow-500 text-black hover:bg-yellow-400'
                }`}
              >
                1:1
              </button>
              <button
                onClick={() => setAspectRatio('4:3')}
                className={`py-3 rounded-xl text-sm font-bold transition-colors ${
                  aspectRatio === '4:3' ? 'bg-black text-yellow-400' : 'bg-yellow-500 text-black hover:bg-yellow-400'
                }`}
              >
                4:3
              </button>
            </div>
          </div>

          {/* Motion Prompt */}
          <div>
            <p className="text-black text-xs font-bold uppercase tracking-wider mb-3">Motion Prompt (optional)</p>
            <div className="bg-black rounded-2xl p-4">
              <textarea
                value={scenePrompt}
                onChange={e => setScenePrompt(e.target.value)}
                placeholder="Describe the motion... e.g. 'slow zoom in', 'hair blowing in the wind', 'camera pan left'"
                rows={3}
                className="w-full bg-transparent text-white text-sm placeholder-white/30 focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Audio */}
          <div>
            <p className="text-black text-xs font-bold uppercase tracking-wider mb-3">Audio (optional)</p>
            {audioUrl ? (
              <div className="relative rounded-2xl overflow-hidden bg-black/10 border border-black/20">
                <audio src={audioUrl} controls className="w-full" />
                <button
                  onClick={() => { setAudioFile(null); setAudioUrl(null); }}
                  className="absolute top-2 right-2 w-7 h-7 bg-black rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
                >
                  <X size={14} className="text-white" />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 border-2 border-dashed border-black/30 rounded-2xl cursor-pointer hover:border-black/50 transition-colors py-4 bg-yellow-500/30">
                <input type="file" accept="audio/*" className="hidden" onChange={e => {
                  const file = e.target.files[0];
                  if (file) {
                    setAudioFile(file);
                    setAudioUrl(URL.createObjectURL(file));
                  }
                }} />
                <Music size={20} className="text-black" />
                <span className="text-black text-sm font-medium">Add background audio / music</span>
              </label>
            )}
          </div>

          {/* Action Button */}
          <button
            onClick={async () => {
              let photoUrl = animateImageUrl;
              if (!photoUrl && animateImage?.file) { 
                const r = await base44.integrations.Core.UploadFile({ file: animateImage.file }); 
                photoUrl = r.file_url; 
              }
              if (!photoUrl) { setErrorMsg('Upload an image first.'); return; }
              setStatus('generating'); setErrorMsg('');
              try {
                let audioUrlForApi = audioUrl;
                if (audioFile && !audioUrlForApi) {
                  const r = await base44.integrations.Core.UploadFile({ file: audioFile });
                  audioUrlForApi = r.file_url;
                }
                const res = await base44.functions.invoke('replicateGenerate', { 
                  method: 'animate_image', 
                  photo_url: photoUrl, 
                  prompt_override: scenePrompt || undefined,
                  duration: duration,
                  aspect_ratio: aspectRatio,
                  audio_url: audioUrlForApi
                });
                if (res.data?.file_url) { setGeneratedMedia({ url: res.data.file_url, type: 'video' }); setStatus('preview'); }
                else { setErrorMsg(res.data?.error || 'Generation failed.'); setStatus('idle'); }
              } catch { setErrorMsg('Generation failed.'); setStatus('idle'); }
            }}
            disabled={!animateImageUrl && !animateImage}
            className="w-full py-4 bg-black hover:bg-black/80 disabled:opacity-40 disabled:cursor-not-allowed text-yellow-400 text-base font-bold rounded-2xl transition-colors flex items-center justify-center gap-2"
          >
            <Film size={18} />
            Animate Image
          </button>
        </div>
      )}

      {/* Animate with Reference - uses VideoTools in video mode */}
      {toolType === 'animate_with_reference' && (
        <VideoTools
          onComplete={(url) => onPublish(url, 'video', 'animate_with_reference', false)}
          onClose={onClose}
          referenceMedia={referenceMedia}
          initialMode="video"
        />
      )}

      {/* Vault Picker Modal */}
      {showVaultPicker && userEmail && (
        <VaultPickerModal
          userEmail={userEmail}
          onSelect={(url) => {
            if (vaultPickerFor === 'set') {
              const vaultSet = { id: `vault_${Date.now()}`, name: 'Vault Set', media: [url] };
              setSelectedSet(vaultSet);
            } else if (vaultPickerFor === 'animate_with_ref') {
              setAnimateWithRefImageUrl(url);
            } else {
              setAnimateImageUrl(url);
            }
            setShowVaultPicker(false);
            setVaultPickerFor(null);
          }}
          onClose={() => {
            setShowVaultPicker(false);
            setVaultPickerFor(null);
          }}
        />
      )}

      {/* AI Video Generation - uses VideoTools */}
      {isTextToVideo && (
        <VideoTools
          onComplete={(url) => onPublish(url, 'video', 'text_to_video', false)}
          onClose={onClose}
          referenceMedia={referenceMedia}
          initialMode="text"
        />
      )}

      {/* New Actor - Full Character Sheet form */}
      {isNewActorMode && (
        <NewActorPanel userEmail={userEmail} onClose={onClose} onPublish={onPublish} />
      )}

      {/* Voice Recorder - matches VoiceRecorder component exactly */}
      {isVoiceMode && (
        <VoicePanel onPublish={onPublish} onClose={onClose} />
      )}

      {/* New Set - Full form matching Studio's SetAssetEditor */}
      {isNewSetMode && <NewSetPanel userEmail={userEmail} onClose={onClose} />}

      {/* My Own Video - Upload a video directly */}
      {isFreeTimelineMode && (
        <div className="space-y-4">
          <p className="text-white text-xs font-bold uppercase tracking-widest mb-2">My Own Video</p>
          <p className="text-white text-xs">Upload your own finished video directly to this block.</p>
          {uploadedPhoto ? (
            <div className="relative rounded-2xl overflow-hidden border border-white/20">
              <video src={uploadedPhoto} controls className="w-full" />
              <button onClick={() => setUploadedPhoto(null)} className="absolute top-2 right-2 w-7 h-7 bg-black/70 rounded-full flex items-center justify-center">
                <X size={14} className="text-white" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-white/20 rounded-2xl cursor-pointer hover:border-emerald-500/50 transition-colors py-10 bg-white/5">
              <input type="file" accept="video/*" className="hidden" onChange={async e => {
                const f = e.target.files[0]; if (!f) return;
                const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
                setUploadedPhoto(file_url);
              }} />
              <Upload size={28} className="text-white" />
              <p className="text-white text-sm">Upload your video</p>
            </label>
          )}
          {errorMsg && <p className="text-red-400 text-xs">{errorMsg}</p>}
          <button
            disabled={!uploadedPhoto}
            onClick={() => { if (uploadedPhoto) onPublish(uploadedPhoto, 'video', 'my_own_video', false); }}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-base font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={18} />
            Publish to Timeline
          </button>
        </div>
      )}

      {errorMsg && !hasOwnPanel && <p className="text-red-400 text-xs text-center">{errorMsg}</p>}
    </div>
  );
}

export default function TimelineBlock({ block, character, hasUserVersion, onProduce, onEdit, kitPage, referenceMedia = [], episodePageId, user }) {
  const config = blockTypeConfig[block.block_type] || { icon: Film, color: 'bg-gray-500', label: block.block_type, recommended_tools: [] };
  const Icon = config.icon;
  console.log('🎬 TimelineBlock - block.id:', block.id, 'referenceMedia prop:', referenceMedia?.length, 'items:', referenceMedia);
  // Matching LabWorkspace tools exactly - all categories
  const allTools = [
    // Actor
    { id: 'dress_actor', category: 'Actor' },
    { id: 'new_actor', category: 'Actor' },
    // Sound & Voice
    { id: 'voice', category: 'Sound & Voice' },
    { id: 'dubbing', category: 'Sound & Voice' },
    { id: 'tts', category: 'Sound & Voice' },
    { id: 'lip_sync', category: 'Sound & Voice' },
    // Video
    { id: 'animate_image', category: 'Video' },
    { id: 'text_to_video', category: 'Video' },
    { id: 'animate_with_reference', category: 'Video' },
    // Timeline & Scene
    { id: 'my_own_video', category: 'Timeline & Scene' },
    { id: 'compose', category: 'Timeline & Scene' },
    { id: 'new_set', category: 'Timeline & Scene' },
  ];
  const [expandedTool, setExpandedTool] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [animateWithRefImageUrl, setAnimateWithRefImageUrl] = useState(referenceMedia?.[0] || block.reference_media?.[0] || null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const toolPanelRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(u => setUserEmail(u?.email)).catch(() => {});
    console.log('TimelineBlock - referenceMedia:', referenceMedia);
    console.log('TimelineBlock - block.reference_media:', block.reference_media);
  }, []);

  const handleToolPublish = (mediaUrl, mediaType, fromToolType, isForReference) => {
    // If composing for reference image, set it and close the tool
    if (isForReference && mediaType === 'image') {
      setAnimateWithRefImageUrl(mediaUrl);
      setExpandedTool(null);
      return;
    }
    // Otherwise, publish to timeline as normal
    onProduce?.(block, fromToolType, mediaUrl, mediaType);
    setExpandedTool(null);
  };

  return (
    <div className={`relative rounded-3xl border-2 overflow-hidden transition-all duration-300 ${hasUserVersion ? 'border-green-500/50 bg-gradient-to-br from-green-500/10 to-transparent' : 'border-white/10 bg-gradient-to-br from-white/5 to-transparent'}`}>
      <div className="p-5 space-y-4">
        {/* Header - Fun & Engaging */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/10 p-4">
          <div className="flex items-start gap-3">
            <div className={`w-14 h-14 ${config.color} rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg relative overflow-hidden`}>
              {referenceMedia?.[0] && !referenceMedia[0].match(/\.(mp4|webm|ogg|mov)(\?|$)/i) ? (
                <img src={referenceMedia[0]} alt="" className="w-full h-full object-cover" />
              ) : referenceMedia?.[0]?.match(/\.(mp4|webm|ogg|mov)(\?|$)/i) ? (
                <div className="w-full h-full relative">
                  <video src={referenceMedia[0]} className="w-full h-full object-cover" muted playsInline />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Icon size={20} className="text-white" />
                  </div>
                </div>
              ) : (
                <Icon size={24} className="text-black" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-black uppercase tracking-widest mb-1">{config.label}</p>
              <h3 className="text-white text-xl font-black truncate leading-tight">{block.title || 'Untitled Block'}</h3>
              {block.description && (
                <p className="text-white text-xs mt-1 line-clamp-2">{block.description}</p>
              )}
            </div>
          </div>
          
          {/* Status badge */}
          {hasUserVersion && (
            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-green-500/20 border border-green-500/50 rounded-full">
              <CheckCircle2 size={10} className="text-green-400" />
              <span className="text-green-400 text-[9px] font-bold">Ready</span>
            </div>
          )}
        </div>

        {/* Preview Media - right after header */}
        {referenceMedia && referenceMedia.filter(url => url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i)).length > 0 && (
          <button
            onClick={() => setShowPreview(true)}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 rounded-2xl text-white font-black transition-all shadow-lg shadow-red-500/30 group"
          >
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <Play size={16} className="fill-white text-white" />
            </div>
            <span className="text-base">Preview Block</span>
            <span className="text-white text-sm font-bold">({referenceMedia.filter(url => url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i)).length})</span>
          </button>
        )}

        {/* Character assignment - Prominent */}
        {character && (
          <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-red-500/20 to-red-500/10 border border-red-500/30 rounded-2xl">
            <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center">
              <Users size={18} className="text-black" />
            </div>
            <div className="flex-1">
              <p className="text-red-300/60 text-sm font-black uppercase tracking-wider">Playing</p>
              <p className="text-red-300 text-sm font-bold">{character.name}</p>
            </div>
          </div>
        )}

        {/* Dialogue - Visual */}
        {block.dialogue && (
          <div className="px-4 py-3 bg-gradient-to-r from-black/40 to-black/20 rounded-2xl border-l-4 border-red-500">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-red-500/20 rounded-full flex items-center justify-center">
                <Mic size={12} className="text-red-400" />
              </div>
              <span className="text-red-400 text-sm font-black uppercase tracking-wider">Dialogue</span>
            </div>
            <p className="text-white/80 text-sm italic font-medium">"{block.dialogue}"</p>
          </div>
        )}

        {/* Production Notes */}
        {block.production_instructions && (
          <div className="px-4 py-3 bg-gradient-to-r from-yellow-500/10 to-yellow-500/5 rounded-2xl border-l-4 border-yellow-500">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 bg-yellow-500/20 rounded-full flex items-center justify-center">
                <Clapperboard size={12} className="text-yellow-400" />
              </div>
              <span className="text-yellow-400 text-sm font-black uppercase tracking-wider">Production Notes</span>
            </div>
            <p className="text-white text-sm leading-relaxed">{block.production_instructions}</p>
          </div>
        )}

        {/* Tool Selection - accordion categories, tool rows inside */}
        <p className="text-white text-base font-black uppercase tracking-widest">🎬 Production Tools</p>
        {(() => {
          const toolConfigs = {
            'dress_actor':           { icon: Users,    label: 'Dress Actor',      color: 'bg-rose-600' },
            'new_actor':             { icon: Users,    label: 'New Actor',         color: 'bg-rose-600' },
            'voice':                 { icon: Mic,      label: 'Record Voice',      color: 'bg-blue-600' },
            'dubbing':               { icon: Music,    label: 'Dubbing Studio',    color: 'bg-blue-600' },
            'tts':                   { icon: Type,     label: 'Text to Speech',    color: 'bg-blue-600' },
            'lip_sync':              { icon: Mic,      label: 'Lip Sync',          color: 'bg-blue-600' },
            'animate_image':         { icon: Film,     label: 'Animate Image',     color: 'bg-violet-600' },
            'text_to_video':         { icon: Camera,   label: 'AI Video',          color: 'bg-violet-600' },
            'animate_with_reference':{ icon: Video,    label: 'Video Reference',   color: 'bg-violet-600' },
            'my_own_video':          { icon: ListVideo,label: 'My Own Video',      color: 'bg-emerald-600' },
            'compose':               { icon: Wand2,    label: 'Compose Scene',     color: 'bg-emerald-600' },
            'new_set':               { icon: Layers,   label: 'New Set',           color: 'bg-emerald-600' },
          };
          const categories = [
            { label: 'Actor',            icon: Users,  tools: ['dress_actor', 'new_actor'],                                          colorKey: 'rose' },
            { label: 'Sound & Voice',    icon: Mic,    tools: ['voice', 'dubbing', 'tts', 'lip_sync'],                              colorKey: 'blue' },
            { label: 'Video',            icon: Film,   tools: ['animate_image', 'text_to_video', 'animate_with_reference'],         colorKey: 'violet' },
            { label: 'Timeline & Scene', icon: Layers, tools: ['my_own_video', 'compose', 'new_set'],                             colorKey: 'emerald' },
          ];
          const catStyles = {
            rose:    { headerOpen: 'bg-rose-600',    headerClosed: 'bg-rose-900/40 hover:bg-rose-800/60',    iconBg: 'bg-rose-600',    text: 'text-rose-300',    border: 'border-rose-500' },
            blue:    { headerOpen: 'bg-blue-600',    headerClosed: 'bg-blue-900/40 hover:bg-blue-800/60',    iconBg: 'bg-blue-600',    text: 'text-blue-300',    border: 'border-blue-500' },
            violet:  { headerOpen: 'bg-violet-600',  headerClosed: 'bg-violet-900/40 hover:bg-violet-800/60',  iconBg: 'bg-violet-600',  text: 'text-violet-300',  border: 'border-violet-500' },
            emerald: { headerOpen: 'bg-emerald-600', headerClosed: 'bg-emerald-900/40 hover:bg-emerald-800/60', iconBg: 'bg-emerald-600', text: 'text-emerald-300', border: 'border-emerald-500' },
          };
          return (
            <div className="rounded-2xl overflow-hidden border border-white/10 divide-y divide-white/10">
              {categories.map(({ label, icon: CatIcon, tools: catTools, colorKey }) => {
                const isOpen = catTools.includes(expandedTool);
                const s = catStyles[colorKey];
                return (
                  <div key={label}>
                    <button
                      onClick={() => {
                        if (isOpen) { setExpandedTool(null); }
                        else { setExpandedTool(catTools[0]); setTimeout(() => toolPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3 transition-all ${isOpen ? s.headerOpen : s.headerClosed}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 ${isOpen ? 'bg-white/20' : s.iconBg} rounded-lg flex items-center justify-center transition-colors`}>
                          <CatIcon size={14} className="text-white" />
                        </div>
                        <span className={`text-sm font-black ${isOpen ? 'text-white' : s.text}`}>{label}</span>
                      </div>
                      <span className={`text-xs transition-transform ${isOpen ? 'rotate-180 text-white' : 'text-white'}`}>▾</span>
                    </button>
                    {/* Tool list — shown when category is open */}
                    {isOpen && (
                      <div className="bg-black/60 divide-y divide-white/5">
                        {catTools.map(toolId => {
                          const cfg = toolConfigs[toolId];
                          const Icon = cfg.icon;
                          const isActive = expandedTool === toolId;
                          return (
                            <button
                              key={toolId}
                              onClick={() => {
                                const next = isActive ? catTools[0] : toolId;
                                setExpandedTool(next);
                                setTimeout(() => toolPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${isActive ? `bg-white/10 border-l-4 ${s.border}` : `hover:bg-white/5 border-l-4 border-transparent`}`}
                            >
                              <div className={`w-8 h-8 ${cfg.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                                <Icon size={15} className="text-white" />
                              </div>
                              <span className={`text-sm font-semibold ${isActive ? s.text : 'text-white/80'}`}>{cfg.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Inline Tool Panel (expanded) - loads corresponding steps */}
        {expandedTool && (
          <div ref={toolPanelRef} className="p-4 bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-red-600 rounded-xl flex items-center justify-center">
                  <Play size={14} className="fill-white text-white" />
                </div>
                <p className="text-white text-sm font-bold uppercase tracking-wider">
                  {expandedTool.replace(/_/g, ' ')}
                </p>
              </div>
              <button onClick={() => setExpandedTool(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                <X size={16} className="text-white" />
              </button>
            </div>
            <InlineToolPanel 
              block={block}
              kitPage={kitPage}
              referenceMedia={referenceMedia}
              toolType={expandedTool}
              character={character}
              onPublish={handleToolPublish}
              onClose={() => setExpandedTool(null)}
              onSwitchTool={(newTool) => setExpandedTool(newTool)}
              userEmail={userEmail}
              animateWithRefImageUrl={animateWithRefImageUrl}
              setAnimateWithRefImageUrl={setAnimateWithRefImageUrl}
              animateImageUrl={animateWithRefImageUrl}
              setAnimateImageUrl={setAnimateWithRefImageUrl}
              episodePageId={episodePageId}
              user={user}
            />
          </div>
        )}



        {/* Preview Modal */}
        {showPreview && (() => {
          const videos = referenceMedia.filter(url => url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i));
          if (videos.length === 0) return null;
          const idx = Math.min(previewIndex, videos.length - 1);
          return (
            <div className="fixed inset-0 bg-black z-50 flex flex-col" onClick={() => setShowPreview(false)}>
              {/* Header */}
              <div className="flex items-center justify-between p-4 flex-shrink-0" onClick={e => e.stopPropagation()}>
                <h3 className="text-white text-lg font-black">{block.title || 'Block Preview'}</h3>
                <button onClick={() => setShowPreview(false)} className="w-12 h-12 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                  <X size={24} className="text-white" />
                </button>
              </div>
              {/* Player */}
              <div className="flex-1 flex items-center justify-center px-4" onClick={e => e.stopPropagation()}>
                <video key={videos[idx]} src={videos[idx]} controls autoPlay className="w-full h-auto rounded-2xl" style={{maxHeight: 'calc(100vh - 120px)'}} />
              </div>
              {/* Navigation */}
              {videos.length > 1 && (
                <div className="flex items-center justify-center gap-4 p-4 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setPreviewIndex(i => Math.max(0, i - 1))} disabled={idx === 0} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center disabled:opacity-30 text-white text-xl">‹</button>
                  <span className="text-white text-sm">{idx + 1} / {videos.length}</span>
                  <button onClick={() => setPreviewIndex(i => Math.min(videos.length - 1, i + 1))} disabled={idx === videos.length - 1} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center disabled:opacity-30 text-white text-xl">›</button>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
