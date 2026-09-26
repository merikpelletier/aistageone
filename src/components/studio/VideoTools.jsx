import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Film, X, Loader2, Type, CheckCircle2, Image as ImageIcon, Sparkles, Upload, Video, Play, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import ProductionContextInfo from '@/components/ProductionContextInfo';
import VaultPickerModal from '@/components/studio/VaultPickerModal';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';

const RATIOS = [
  { id: '16:9', label: 'Landscape', icon: '🎬' },
  { id: '9:16', label: 'Portrait', icon: '📱' },
  { id: '1:1', label: 'Square', icon: '🖼️' },
];

const MODES = [
  { id: 'text', label: 'Text to Video', icon: 'Type', desc: 'Describe your scene' },
  { id: 'image', label: 'Image to Video', icon: 'ImageIcon', desc: 'Animate an image' },
  { id: 'video', label: 'Video Reference', icon: 'Film', desc: 'Use video as reference' },
];

const DURATIONS = [
  { id: 5, label: '5s', credits: '~$0.50' },
  { id: 10, label: '10s', credits: '~$1.00' },
];

const RESOLUTIONS = [
  { id: '480p', label: '480p', quality: 'Fast' },
  { id: '720p', label: '720p', quality: 'HD' },
];

export default function VideoTools({ onComplete, onClose, recommendedTools = [], referenceMedia = [], productionMethod = null, block = null, character = null, initialMode = null, episodePageId, blockId, user, embedded = false }) {
  // Only show production context if coming from a Dossier production
  const showContext = productionMethod && block;
  const [mode, setMode] = useState(initialMode || 'text'); // 'text', 'image', or 'video'
  const [prompt, setPrompt] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [duration, setDuration] = useState(5);
  const [resolution, setResolution] = useState('480p');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [showVaultPicker, setShowVaultPicker] = useState(false);
  const [vaultPickerTarget, setVaultPickerTarget] = useState(null); // 'image' or 'video'
  const [showSaveVault, setShowSaveVault] = useState(false);
  const [userEmail, setUserEmail] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => setUserEmail(u?.email)).catch(() => {});
  }, []);
  
  // Auto-select mode based on recommended tools
  useEffect(() => {
    if (recommendedTools.length > 0) {
      if (recommendedTools.includes('text_to_video')) setMode('text');
      else if (recommendedTools.includes('image_to_video')) setMode('image');
      else if (recommendedTools.includes('video_reference')) setMode('video');
    }
  }, [recommendedTools]);

  const handleImageUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleVideoUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => setVideoPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleVaultImageSelect = async (assetUrl) => {
    setImagePreview(assetUrl);
    setVideoPreview(null);
  };

  const handleVaultVideoSelect = async (assetUrl) => {
    setVideoPreview(assetUrl);
    setImagePreview(null);
  };

  const handleGenerate = async () => {
    if (mode === 'text' && !prompt.trim()) return;
    if (mode === 'image' && !imagePreview) return;
    if (mode === 'video' && !videoPreview) return;
    
    setIsGenerating(true);
    try {
      const response = await base44.functions.invoke('generateVideo', {
        prompt: prompt || (mode === 'image' ? 'Animate this image' : 'Use as reference'),
        image_url: (mode === 'image' || mode === 'video') ? imagePreview : null,
        video_url: mode === 'video' ? videoPreview : null,
        duration,
        aspect_ratio: aspectRatio,
        resolution,
      });
      
      if (response.data?.file_url) {
        setResult(response.data.file_url);
      }
    } catch (error) {
      const msg = error.response?.data?.message || error.response?.data?.error;
      toast.error(msg?.includes('Insufficient tokens') ? 'Not enough tokens. Please buy more.' : (msg || 'Failed to generate video'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleComplete = () => {
    if (result) {
      onComplete(result);
    }
  };

  const handleUseVideo = () => {
    if (!result) return;
    if (!user?.email) { handleComplete(); return; }
    setShowSaveVault(true);
  };

  // After the user picks a folder & the video is saved to the Vault,
  // also attach it to the scene's episode block (if launched from one).
  const handleVaultSaved = async () => {
    setShowSaveVault(false);
    if (episodePageId && blockId && user?.email) {
      setIsSaving(true);
      try {
        const timelines = await base44.entities.UserTimeline.filter({ episode_page_id: episodePageId, user_email: user.email });
        let timeline = timelines[0];
        if (!timeline) {
          await base44.entities.UserTimeline.create({
            episode_page_id: episodePageId,
            user_email: user.email,
            block_overrides: [{ block_id: blockId, user_media_url: result, status: 'uploaded' }],
          });
        } else {
          const existingOverrides = timeline.block_overrides || [];
          const otherBlocks = existingOverrides.filter(b => b.block_id !== blockId);
          const updatedOverrides = [...otherBlocks, { block_id: blockId, user_media_url: result, status: 'uploaded' }];
          await base44.entities.UserTimeline.update(timeline.id, { block_overrides: updatedOverrides });
        }
        toast.success('Video saved to your Vault & episode!');
      } catch (err) {
        console.error('Error attaching video to episode:', err);
        toast.error('Saved to Vault, but failed to attach to episode');
      } finally {
        setIsSaving(false);
      }
    }
    handleComplete();
  };

  return (
    <div className={`fixed bg-black/80 z-[100] flex items-center justify-center p-4 ${embedded ? 'top-14 right-0 bottom-[64px] left-0 lg:bottom-0 lg:left-[var(--studio-toolbar-width)]' : 'inset-0'}`}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-yellow-400 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-black text-xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              AI Video Generation
            </h3>
            <p className="text-black text-sm">Replicate • Kling/Seedance models</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-black/10 rounded-full transition-colors">
            <X size={20} className="text-black" />
          </button>
        </div>

        {/* Production Context Info - Only show when in Dossier production mode */}
        {showContext && (
          <ProductionContextInfo
            productionMethod={productionMethod}
            block={block}
            character={character}
            referenceMedia={referenceMedia}
          />
        )}

        {/* Mode Selection — hidden when initialMode is locked */}
        {!initialMode && recommendedTools.length === 0 ? (
          <div className="mb-6">
            <p className="text-black font-semibold mb-3">Generation Mode</p>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setMode('text')}
                className={`p-4 rounded-xl flex flex-col items-center gap-2 transition-all ${
                  mode === 'text' ? 'bg-black text-yellow-400' : 'bg-black/10 text-black hover:bg-black/20'
                }`}
              >
                <Type size={24} />
                <span className="font-bold text-sm">Text to Video</span>
              </button>
              <button
                onClick={() => setMode('image')}
                className={`p-4 rounded-xl flex flex-col items-center gap-2 transition-all ${
                  mode === 'image' ? 'bg-black text-yellow-400' : 'bg-black/10 text-black hover:bg-black/20'
                }`}
              >
                <ImageIcon size={24} />
                <span className="font-bold text-sm">Image to Video</span>
              </button>
              <button
                onClick={() => setMode('video')}
                className={`p-4 rounded-xl flex flex-col items-center gap-2 transition-all ${
                  mode === 'video' ? 'bg-black text-yellow-400' : 'bg-black/10 text-black hover:bg-black/20'
                }`}
              >
                <Video size={24} />
                <span className="font-bold text-sm">Video Reference</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <p className="text-black font-semibold mb-3">Recommended Tools for This Block</p>
            <div className="space-y-2">
              {recommendedTools.map(tool => (
                <button
                  key={tool}
                  onClick={() => {
                    if (tool === 'text_to_video') setMode('text');
                    if (tool === 'image_to_video') setMode('image');
                    if (tool === 'video_reference') setMode('video');
                  }}
                  className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${
                    (tool === 'text_to_video' && mode === 'text') ||
                    (tool === 'image_to_video' && mode === 'image') ||
                    (tool === 'video_reference' && mode === 'video')
                      ? 'bg-black text-yellow-400'
                      : 'bg-black/10 text-black hover:bg-black/20'
                  }`}
                >
                  {tool === 'text_to_video' && <Type size={20} />}
                  {tool === 'image_to_video' && <ImageIcon size={20} />}
                  {tool === 'video_reference' && <Video size={20} />}
                  <span className="font-bold text-sm">
                    {tool === 'text_to_video' && 'Text to Video'}
                    {tool === 'image_to_video' && 'Image to Video'}
                    {tool === 'video_reference' && 'Video Reference'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Text Prompt */}
        {mode === 'text' && (
          <div className="mb-6">
            <p className="text-black font-semibold mb-3 flex items-center gap-2">
              <Type size={16} />
              Video Prompt
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your video scene in detail..."
              className="w-full bg-black text-white rounded-xl p-4 min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400"
              maxLength={1000}
            />
            <p className="text-black text-xs mt-2 text-right">{prompt.length}/1000 characters</p>
          </div>
        )}

        {/* Reference Media from Block */}
        {referenceMedia.length > 0 && (
          <div className="mb-6">
            <p className="text-black font-semibold mb-3 flex items-center gap-2">
              <Film size={16} />
              Block Reference Media
            </p>
            <div className="grid grid-cols-3 gap-2">
              {referenceMedia.map((url, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (url.match(/\.(mp4|webm|ogg|mov)$/i)) {
                      setVideoPreview(url);
                      setImagePreview(null);
                      setMode('video');
                    } else {
                      setImagePreview(url);
                      setVideoPreview(null);
                      setMode('image');
                    }
                  }}
                  className="relative aspect-square rounded-xl overflow-hidden border-2 border-black/20 hover:border-black transition-colors"
                >
                  {url.match(/\.(mp4|webm|ogg|mov)$/i) ? (
                    <video src={url} className="w-full h-full object-cover" />
                  ) : (
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Image Upload */}
        {mode === 'image' && (
          <div className="mb-6">
            <p className="text-black font-semibold mb-3 flex items-center gap-2">
              <ImageIcon size={16} />
              Reference Image
            </p>
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover rounded-xl" />
                <button
                  onClick={() => setImagePreview(null)}
                  className="absolute top-2 right-2 p-2 bg-black/70 rounded-full hover:bg-black transition-colors"
                >
                  <X size={16} className="text-white" />
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-black/30 rounded-xl p-8 text-center">
                <Upload size={32} className="mx-auto text-black mb-3" />
                <p className="text-black text-sm mb-2">Upload an image</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="inline-block px-4 py-2 bg-black text-yellow-400 rounded-lg text-sm font-bold cursor-pointer hover:bg-black/90 transition-colors"
                >
                  Choose File
                </label>
              </div>
            )}
          </div>
        )}

        {/* Video Reference — needs both an image (subject) and a video (motion reference) */}
        {mode === 'video' && (
          <div className="mb-6 space-y-4">
            {/* Subject Image */}
            <div>
              <p className="text-black font-semibold mb-1 flex items-center gap-2">
                <ImageIcon size={16} />
                Subject Image <span className="text-black font-normal text-sm">(your character / scene)</span>
              </p>
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover rounded-xl" />
                  <button onClick={() => setImagePreview(null)} className="absolute top-2 right-2 p-2 bg-black/70 rounded-full hover:bg-black transition-colors">
                    <X size={16} className="text-white" />
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-black/30 rounded-xl p-6 text-center space-y-3">
                  <ImageIcon size={28} className="mx-auto text-black mb-2" />
                  <p className="text-black text-sm">Upload your image or pick from Vault</p>
                  <div className="flex items-center justify-center gap-2">
                    <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} className="hidden" id="image-upload-vref" />
                    <label htmlFor="image-upload-vref" className="inline-flex items-center gap-2 px-4 py-2 bg-black text-yellow-400 rounded-lg text-sm font-bold cursor-pointer hover:bg-black/90 transition-colors">
                      <Upload size={14} /> Upload
                    </label>
                    <button onClick={() => { setVaultPickerTarget('image'); setShowVaultPicker(true); }} className="inline-flex items-center gap-2 px-4 py-2 bg-black text-yellow-400 rounded-lg text-sm font-bold hover:bg-black/90 transition-colors">
                      <Folder size={14} /> Vault
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Motion Reference Video */}
            <div>
              <p className="text-black font-semibold mb-1 flex items-center gap-2">
                <Video size={16} />
                Motion Reference Video <span className="text-black font-normal text-sm">(defines the movement)</span>
              </p>
              {videoPreview ? (
                <div className="relative">
                  <video src={videoPreview} controls className="w-full h-40 object-cover rounded-xl" />
                  <button onClick={() => setVideoPreview(null)} className="absolute top-2 right-2 p-2 bg-black/70 rounded-full hover:bg-black transition-colors">
                    <X size={16} className="text-white" />
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Series reference videos */}
                  {referenceMedia.filter(url => url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i)).length > 0 && (
                    <div>
                      <p className="text-black text-xs font-bold uppercase tracking-wider mb-2">From Series</p>
                      <div className="grid grid-cols-3 gap-2">
                        {referenceMedia.filter(url => url.match(/\.(mp4|webm|ogg|mov)(\?|$)/i)).map((url, i) => (
                          <button
                            key={i}
                            onClick={() => setVideoPreview(url)}
                            className="relative aspect-square rounded-xl overflow-hidden border-2 border-black/20 hover:border-black transition-colors"
                          >
                            <video src={url} className="w-full h-full object-cover" muted />
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                              <Play size={16} className="text-white fill-white" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Upload your own or from Vault */}
                  <div>
                    <p className="text-black text-xs font-bold uppercase tracking-wider mb-2">Or From Your Vault / Upload</p>
                    <div className="border-2 border-dashed border-black/30 rounded-xl p-6 text-center space-y-3">
                      <Video size={28} className="mx-auto text-black mb-2" />
                      <p className="text-black text-sm">Upload or pick from your Vault</p>
                      <div className="flex items-center justify-center gap-2">
                        <input type="file" accept="video/*" onChange={(e) => e.target.files?.[0] && handleVideoUpload(e.target.files[0])} className="hidden" id="video-upload" />
                        <label htmlFor="video-upload" className="inline-flex items-center gap-2 px-4 py-2 bg-black text-yellow-400 rounded-lg text-sm font-bold cursor-pointer hover:bg-black/90 transition-colors">
                          <Upload size={14} /> Upload
                        </label>
                        <button onClick={() => { setVaultPickerTarget('video'); setShowVaultPicker(true); }} className="inline-flex items-center gap-2 px-4 py-2 bg-black text-yellow-400 rounded-lg text-sm font-bold hover:bg-black/90 transition-colors">
                          <Folder size={14} /> Vault
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Advanced Settings */}
        <div className="mb-6 space-y-4">
          {/* Aspect Ratio */}
          <div>
            <p className="text-black text-sm font-medium mb-2">Aspect Ratio</p>
            <div className="grid grid-cols-3 gap-2">
              {RATIOS.map((ratio) => (
                <button
                  key={ratio.id}
                  onClick={() => setAspectRatio(ratio.id)}
                  className={`p-3 rounded-xl text-center transition-all ${
                    aspectRatio === ratio.id 
                      ? 'bg-black text-yellow-400' 
                      : 'bg-black/10 text-black hover:bg-black/20'
                  }`}
                >
                  <p className="text-2xl mb-1">{ratio.icon}</p>
                  <p className="text-xs font-medium">{ratio.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <p className="text-black text-sm font-medium mb-2">Duration</p>
            <div className="grid grid-cols-2 gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDuration(d.id)}
                  className={`p-3 rounded-xl text-center transition-all ${
                    duration === d.id 
                      ? 'bg-black text-yellow-400' 
                      : 'bg-black/10 text-black hover:bg-black/20'
                  }`}
                >
                  <p className="font-bold">{d.label}</p>
                  <p className="text-xs opacity-60">{d.credits}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Resolution */}
          <div>
            <p className="text-black text-sm font-medium mb-2">Resolution</p>
            <div className="grid grid-cols-2 gap-2">
              {RESOLUTIONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setResolution(r.id)}
                  className={`p-3 rounded-xl text-center transition-all ${
                    resolution === r.id 
                      ? 'bg-black text-yellow-400' 
                      : 'bg-black/10 text-black hover:bg-black/20'
                  }`}
                >
                  <p className="font-bold">{r.label}</p>
                  <p className="text-xs opacity-60">{r.quality}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Generate Button */}
        {!result && (
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || (mode === 'text' && !prompt.trim()) || (mode === 'image' && !imagePreview) || (mode === 'video' && (!imagePreview || !videoPreview))}
            className="w-full bg-black hover:bg-black/90 text-yellow-400 font-bold py-4 rounded-2xl mb-4"
          >
            {isGenerating ? (
              <>
                <Loader2 size={20} className="mr-2 animate-spin" />
                Generating... (~30-60s)
              </>
            ) : (
              <>
                <Film size={20} className="mr-2" />
                Generate Video
              </>
            )}
          </Button>
        )}

        {/* Result */}
        {result && (
          <div className="bg-black rounded-2xl p-6 mb-4 text-center">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Film size={28} className="text-white" />
            </div>
            <p className="text-white font-semibold mb-2">Video Generated!</p>
            <p className="text-white text-sm mb-4">
              {duration}s • {resolution} • {aspectRatio}
            </p>
            <video src={result} controls className="w-full rounded-lg" />
          </div>
        )}

        {/* Complete Button */}
        {result && (
          <Button
            onClick={handleUseVideo}
            disabled={isSaving}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-2xl disabled:opacity-50"
          >
            {isSaving ? <><Loader2 size={20} className="mr-2 animate-spin" /> Saving…</> : <><CheckCircle2 size={20} className="mr-2" /> Use This Video</>}
          </Button>
        )}
        {/* Save-to-Vault folder picker */}
        {showSaveVault && (
          <SaveToVaultModal
            userEmail={user?.email}
            imageUrl={result}
            mediaType="video"
            onClose={() => setShowSaveVault(false)}
            onSaved={handleVaultSaved}
          />
        )}

        {/* Vault Picker Modal */}
        {showVaultPicker && userEmail && (
          <VaultPickerModal
            userEmail={userEmail}
            onSelect={(url) => {
              if (vaultPickerTarget === 'video') {
                setVideoPreview(url);
              } else {
                setImagePreview(url);
              }
              setShowVaultPicker(false);
              setVaultPickerTarget(null);
            }}
            onClose={() => { setShowVaultPicker(false); setVaultPickerTarget(null); }}
          />
        )}
      </motion.div>
    </div>
  );
}