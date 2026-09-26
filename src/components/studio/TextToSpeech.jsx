import VoicePicker from '@/components/studio/VoicePicker.jsx';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Volume2, X, Loader2, Type, CheckCircle2, Sliders, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import ProductionContextInfo from '@/components/ProductionContextInfo';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';


const EMOTIONS = [
  { id: 'none', label: 'None', tag: '', icon: '😐' },
  { id: 'excited', label: 'Excited', tag: '[excited]', icon: '🤩' },
  { id: 'whispers', label: 'Whispers', tag: '[whispers]', icon: '🤫' },
  { id: 'sighs', label: 'Sighs', tag: '[sighs]', icon: '😮‍💨' },
  { id: 'laughs', label: 'Laughs', tag: '[laughs]', icon: '😂' },
  { id: 'sad', label: 'Sad', tag: '[sad]', icon: '😢' },
  { id: 'angry', label: 'Angry', tag: '[angry]', icon: '😠' },
];


export default function TextToSpeech({ onComplete, onClose, productionMethod = null, block = null, character = null, episodePageId, blockId, user, embedded = false }) {
  // Only show production context if coming from a Dossier production
  const showContext = productionMethod && block;
  const [voice, setVoice] = useState('Rachel');
  const [text, setText] = useState('');
  const [emotion, setEmotion] = useState('none');
  const [stability, setStability] = useState(0.5);
  const [style, setStyle] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [languageCode, setLanguageCode] = useState('en');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSaveVault, setShowSaveVault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleGenerate = async () => {
    if (!text.trim()) return;
    
    setIsGenerating(true);
    try {
      const emotionTag = EMOTIONS.find(e => e.id === emotion)?.tag || '';
      const directedText = emotionTag ? `${emotionTag} ${text}` : text;
      const response = await base44.functions.invoke('generateSpeech', {
        text: directedText,
        voice,
        stability,
        similarity_boost: 0.75,
        style,
        speed,
        language_code: languageCode,
      });
      
      if (response.data?.file_url) {
        setResult(response.data.file_url);
      }
    } catch (error) {
      const msg = error.response?.data?.message || error.response?.data?.error;
      toast.error(msg?.includes('Insufficient tokens') ? 'Not enough tokens. Please buy more.' : (msg || 'Failed to generate speech'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseAudio = () => {
    if (!result) return;
    if (!user?.email) { onComplete(result); return; }
    setShowSaveVault(true);
  };

  // After the user picks a folder & the audio is saved to the Vault,
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
            block_overrides: [{ block_id: blockId, user_media_url: result, status: 'uploaded', notes: 'audio' }],
          });
        } else {
          const existingOverrides = timeline.block_overrides || [];
          const otherBlocks = existingOverrides.filter(b => b.block_id !== blockId);
          const updatedOverrides = [...otherBlocks, { block_id: blockId, user_media_url: result, status: 'uploaded', notes: 'audio' }];
          await base44.entities.UserTimeline.update(timeline.id, { block_overrides: updatedOverrides });
        }
        toast.success('Audio saved to your Vault & episode!');
      } catch (err) {
        console.error('Error attaching audio to episode:', err);
        toast.error('Saved to Vault, but failed to attach to episode');
      } finally {
        setIsSaving(false);
      }
    }
    onComplete(result);
  };

  return (
    <div className={`fixed z-[100] ${embedded ? 'top-14 right-0 bottom-[64px] left-0 lg:bottom-0 lg:left-[var(--studio-toolbar-width)] bg-yellow-400 overflow-y-auto' : 'inset-0 bg-black/80 flex items-center justify-center p-4'}`}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={embedded ? 'bg-yellow-400 min-h-full w-full p-5 md:p-8 overflow-y-auto' : 'bg-yellow-400 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto'}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-black text-xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Text to Speech
            </h3>
            <p className="text-black text-sm">ElevenLabs v3 with emotions</p>
          </div>
          {!embedded && (
            <button onClick={onClose} className="p-2 hover:bg-black/10 rounded-full transition-colors">
              <X size={20} className="text-black" />
            </button>
          )}
        </div>

        {/* Production Context Info - Only show when in Dossier production mode */}
        {showContext && (
          <ProductionContextInfo
            productionMethod={productionMethod}
            block={block}
            character={character}
            referenceMedia={[]}
          />
        )}

        {/* Voice Selection */}
        <div className="mb-6 text-black"><VoicePicker value={voice} onChange={setVoice} language={languageCode} onLanguageChange={setLanguageCode} disabled={isGenerating} /></div>
        {/* Emotion Selection */}
        <div className="mb-6">
          <p className="text-black font-semibold mb-3 flex items-center gap-2">
            <Sparkles size={16} />
            Emotion
          </p>
          <div className="grid grid-cols-4 md:grid-cols-5 gap-2">
            {EMOTIONS.map((e) => (
              <button
                key={e.id}
                onClick={() => setEmotion(e.id)}
                className={`p-3 rounded-xl text-center transition-all ${
                  emotion === e.id 
                    ? 'bg-black text-yellow-400' 
                    : 'bg-black/10 text-black hover:bg-black/20'
                }`}
              >
                <p className="text-xl mb-1">{e.icon}</p>
                <p className="text-xs font-medium">{e.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Text Input */}
        <div className="mb-6">
          <p className="text-black font-semibold mb-3 flex items-center gap-2">
            <Type size={16} />
            Enter Text
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste your text here..."
            className="w-full bg-black text-white rounded-xl p-4 min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400"
            maxLength={5000}
          />
          <p className="text-black text-xs mt-2 text-right">{text.length}/5000 characters</p>
        </div>

        {/* Advanced Settings */}
        <div className="mb-6">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-black font-semibold mb-3 hover:opacity-70 transition-opacity"
          >
            <Sliders size={16} />
            Advanced Settings
            <span className="text-xs text-black ml-1">
              {showAdvanced ? '▼' : '▲'}
            </span>
          </button>
          
          {showAdvanced && (
            <div className="bg-black/10 rounded-xl p-4 space-y-4">
              {/* Stability */}
              <div>
                <div className="flex justify-between mb-2">
                  <p className="text-black text-sm font-medium">Stability</p>
                  <p className="text-black text-xs">{Math.round(stability * 100)}%</p>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={stability}
                  onChange={(e) => setStability(parseFloat(e.target.value))}
                  className="w-full accent-black"
                />
                <p className="text-black text-xs mt-1">Higher = more consistent, lower = more expressive</p>
              </div>

              {/* Style */}
              <div>
                <div className="flex justify-between mb-2">
                  <p className="text-black text-sm font-medium">Style Exaggeration</p>
                  <p className="text-black text-xs">{Math.round(style * 100)}%</p>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={style}
                  onChange={(e) => setStyle(parseFloat(e.target.value))}
                  className="w-full accent-black"
                />
                <p className="text-black text-xs mt-1">Higher = more dramatic delivery</p>
              </div>

              {/* Speed */}
              <div>
                <div className="flex justify-between mb-2">
                  <p className="text-black text-sm font-medium">Speed</p>
                  <p className="text-black text-xs">{speed}x</p>
                </div>
                <input
                  type="range"
                  min="0.7"
                  max="1.2"
                  step="0.1"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-full accent-black"
                />
                <p className="text-black text-xs mt-1">0.7x (slow) to 1.2x (fast)</p>
              </div>
            </div>
          )}
        </div>

        {/* Generate Button */}
        {!result && (
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !text.trim()}
            className="w-full bg-black hover:bg-black/90 text-yellow-400 font-bold py-4 rounded-2xl mb-4"
          >
            {isGenerating ? (
              <>
                <Loader2 size={20} className="mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Volume2 size={20} className="mr-2" />
                Generate Speech
              </>
            )}
          </Button>
        )}

        {/* Result */}
        {result && (
          <div className="bg-black rounded-2xl p-6 mb-4 text-center">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Volume2 size={28} className="text-white" />
            </div>
            <p className="text-white font-semibold mb-2">Speech Generated!</p>
            <p className="text-white text-sm mb-4">
              Voice: {voice}
              {emotion !== 'none' && ` • ${EMOTIONS.find(e => e.id === emotion)?.label}`}
            </p>
            <audio src={result} controls className="w-full" />
          </div>
        )}

        {/* Complete Button */}
        {result && (
          <Button
            onClick={handleUseAudio}
            disabled={isSaving}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-2xl disabled:opacity-50"
          >
            {isSaving ? <><Loader2 size={20} className="mr-2 animate-spin" /> Saving…</> : <><CheckCircle2 size={20} className="mr-2" /> Use This Audio</>}
          </Button>
        )}

        {/* Save-to-Vault folder picker */}
        {showSaveVault && (
          <SaveToVaultModal
            userEmail={user?.email}
            imageUrl={result}
            mediaType="audio"
            onClose={() => setShowSaveVault(false)}
            onSaved={handleVaultSaved}
          />
        )}
      </motion.div>
    </div>
  );
}
