import VoicePicker from '@/components/studio/VoicePicker.jsx';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Volume2, X, Loader2, Type, CheckCircle2, Sliders, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import ProductionContextInfo from '@/components/ProductionContextInfo';
import SaveToVaultModal from '@/components/studio/SaveToVaultModal';
import { useAiPriceQuote } from '@/hooks/useAiPriceQuote';
import { useAiModelOptions } from '@/hooks/useAiModelOptions';

const EMOTIONS = [
  { id: 'none', label: 'None', tag: '', icon: '😐' },
  { id: 'excited', label: 'Excited', tag: '[excited]', icon: '🤩' },
  { id: 'whispers', label: 'Whispers', tag: '[whispers]', icon: '🤫' },
  { id: 'sighs', label: 'Sighs', tag: '[sighs]', icon: '😮‍💨' },
  { id: 'laughs', label: 'Laughs', tag: '[laughs]', icon: '😂' },
  { id: 'sad', label: 'Sad', tag: '[sad]', icon: '😢' },
  { id: 'angry', label: 'Angry', tag: '[angry]', icon: '😠' },
];

export default function TextToSpeech({ onComplete, onClose, productionMethod = null, block = null, character = null, episodePageId, blockId, user, embedded = false, inline = false }) {
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
  const [selectedModel, setSelectedModel] = useState(null);

  const emotionTag = EMOTIONS.find(e => e.id === emotion)?.tag || '';
  const directedText = emotionTag ? `${emotionTag} ${text}` : text;
  const pricingInput = { text: directedText, voice, speed, stability, similarity_boost: 0.75, style, language_code: languageCode };
  const { options: modelOptions, loading: modelsLoading } = useAiModelOptions({ service: 'generateSpeech', kind: 'speech', input: pricingInput });
  const effectiveModel = selectedModel || modelOptions.find(m => m.recommended)?.model_key || modelOptions[0]?.model_key || null;
  const { quote: priceQuote, loading: priceLoading } = useAiPriceQuote({ service: 'generateSpeech', kind: 'speech', input: pricingInput, modelKey: effectiveModel });

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setIsGenerating(true);
    try {
      const response = await base44.functions.invoke('generateSpeech', {
        text: directedText,
        voice,
        stability,
        similarity_boost: 0.75,
        style,
        speed,
        language_code: languageCode,
        model_key: effectiveModel || undefined,
      });
      if (response.data?.file_url) setResult(response.data.file_url);
    } catch (error) {
      const msg = error.response?.data?.message || error.response?.data?.error;
      toast.error(msg?.includes('Insufficient tokens') ? 'Not enough tokens. Please buy more.' : (msg || 'Failed to generate speech'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseAudio = () => {
    if (!result) return;
    if (!user?.email) return onComplete(result);
    setShowSaveVault(true);
  };

  const handleVaultSaved = async () => {
    setShowSaveVault(false);
    if (episodePageId && blockId && user?.email) {
      setIsSaving(true);
      try {
        const timelines = await base44.entities.UserTimeline.filter({ episode_page_id: episodePageId, user_email: user.email });
        const timeline = timelines[0];
        const override = { block_id: blockId, user_media_url: result, status: 'uploaded', notes: 'audio' };
        if (!timeline) {
          await base44.entities.UserTimeline.create({ episode_page_id: episodePageId, user_email: user.email, block_overrides: [override] });
        } else {
          const others = (timeline.block_overrides || []).filter(b => b.block_id !== blockId);
          await base44.entities.UserTimeline.update(timeline.id, { block_overrides: [...others, override] });
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

  const shell = inline
    ? 'relative w-full'
    : `fixed z-[100] ${embedded ? 'top-14 right-0 bottom-[64px] left-0 lg:bottom-0 lg:left-[var(--studio-toolbar-width)] overflow-y-auto bg-[#202328]' : 'inset-0 flex items-center justify-center bg-black/80 p-4'}`;
  const panel = inline
    ? 'w-full bg-[#202328] p-4 text-white md:p-5'
    : embedded
      ? 'min-h-full w-full overflow-y-auto bg-[#202328] p-5 pb-28 text-white md:p-8 lg:pb-32'
      : 'max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[4px] border border-white/10 bg-[#202328] p-6 text-white';

  return (
    <div className={shell}>
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className={panel}>
        <div className="mx-auto max-w-5xl">
          <header className="mb-5 flex items-center justify-between border-b border-white/10 bg-[#17191d] px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[3px] border border-[#23c7be]/30 bg-[#23c7be]/10 text-[#23c7be]"><Sparkles size={19} /></div>
              <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#23c7be]">Sound & Voice</p><h3 className="text-xl font-black">Text to Speech</h3><p className="text-xs text-white/45">ElevenLabs v3 with emotions</p></div>
            </div>
            {!embedded && !inline && <button onClick={onClose} className="rounded-[3px] border border-white/10 bg-white/[.04] p-2 hover:bg-white/10"><X size={20} /></button>}
          </header>

          {showContext && <ProductionContextInfo productionMethod={productionMethod} block={block} character={character} referenceMedia={[]} />}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4 text-white">
                <VoicePicker value={voice} onChange={setVoice} language={languageCode} onLanguageChange={setLanguageCode} disabled={isGenerating} />
              </section>

              <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
                <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.12em] text-white/45"><Sparkles size={14} className="text-[#23c7be]" /> Emotion</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                  {EMOTIONS.map((e) => <button key={e.id} onClick={() => setEmotion(e.id)} className={`rounded-[3px] border p-3 text-center transition ${emotion === e.id ? 'border-[#23c7be]/40 bg-[#23c7be]/12 text-[#8ee9e4]' : 'border-white/10 bg-white/[.03] text-white/65 hover:bg-white/[.07]'}`}><div className="mb-1 text-xl">{e.icon}</div><div className="text-xs font-bold">{e.label}</div></button>)}
                </div>
              </section>

              <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
                <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.12em] text-white/45"><Type size={14} className="text-[#23c7be]" /> Enter Text</div><span className="text-[10px] text-white/30">{text.length}/5000</span></div>
                <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Type or paste your text here..." className="min-h-[160px] w-full resize-none rounded-[3px] border border-white/15 bg-black/25 p-4 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#23c7be]" maxLength={5000} />
              </section>

              <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4">
                <button onClick={() => setShowAdvanced(!showAdvanced)} className="flex w-full items-center justify-between text-left text-sm font-black text-white"><span className="flex items-center gap-2"><Sliders size={16} className="text-[#23c7be]" /> Advanced Settings</span><span className="text-xs text-white/40">{showAdvanced ? 'Hide' : 'Show'}</span></button>
                {showAdvanced && <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                  <div><div className="mb-2 flex justify-between text-xs"><span className="font-bold text-white/70">Stability</span><span className="text-[#8ee9e4]">{Math.round(stability * 100)}%</span></div><input type="range" min="0" max="1" step="0.1" value={stability} onChange={(e) => setStability(parseFloat(e.target.value))} className="w-full accent-[#23c7be]" /><p className="mt-1 text-[10px] text-white/35">Higher = more consistent, lower = more expressive</p></div>
                  <div><div className="mb-2 flex justify-between text-xs"><span className="font-bold text-white/70">Style Exaggeration</span><span className="text-[#8ee9e4]">{Math.round(style * 100)}%</span></div><input type="range" min="0" max="1" step="0.1" value={style} onChange={(e) => setStyle(parseFloat(e.target.value))} className="w-full accent-[#23c7be]" /><p className="mt-1 text-[10px] text-white/35">Higher = more dramatic delivery</p></div>
                  <div><div className="mb-2 flex justify-between text-xs"><span className="font-bold text-white/70">Speed</span><span className="text-[#8ee9e4]">{speed}x</span></div><input type="range" min="0.7" max="1.2" step="0.1" value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} className="w-full accent-[#23c7be]" /><p className="mt-1 text-[10px] text-white/35">0.7x slow to 1.2x fast</p></div>
                </div>}
              </section>

              {result && <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4"><div className="mb-3 flex items-center gap-2"><CheckCircle2 size={18} className="text-[#23c7be]" /><div><p className="text-sm font-black">Speech Generated</p><p className="text-xs text-white/40">Voice: {voice}{emotion !== 'none' && ` · ${EMOTIONS.find(e => e.id === emotion)?.label}`}</p></div></div><audio src={result} controls className="w-full" /></section>}
            </div>

            <aside className="space-y-4">
              <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4"><p className="mb-2 text-[10px] font-black uppercase tracking-[.12em] text-white/45">AI Model</p><select value={effectiveModel || ''} onChange={e => setSelectedModel(e.target.value || null)} disabled={modelsLoading || modelOptions.length === 0} className="w-full rounded-[3px] border border-white/15 bg-black/25 px-3 py-3 text-sm font-bold text-white outline-none focus:border-[#23c7be] disabled:opacity-50">{modelsLoading && <option value="">Loading models…</option>}{!modelsLoading && modelOptions.length === 0 && <option value="">No model available</option>}{modelOptions.map(m => <option key={m.model_key} value={m.model_key}>{m.name || m.model_key}{m.recommended ? ' — Recommended' : ''}{m.credits ? ` — ${m.credits} credits` : ''}</option>)}</select></section>

              <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4"><div className="mb-3 flex items-center justify-between text-xs"><span className="text-white/40">AI cost</span><span className="font-black text-[#8ee9e4]">{text.trim() ? (priceLoading ? 'Calculating…' : priceQuote?.credits ? `${priceQuote.credits} credits` : 'Unable to calculate') : 'Enter text first'}</span></div>{!result ? <button onClick={handleGenerate} disabled={isGenerating || !text.trim()} className="flex w-full items-center justify-center gap-2 rounded-[3px] bg-[#23c7be] py-3.5 text-sm font-black text-[#071211] hover:bg-[#35d8cf] disabled:bg-white/[.05] disabled:text-white/30">{isGenerating ? <><Loader2 size={18} className="animate-spin" /> Generating…</> : <><Volume2 size={18} /> Generate Speech{text.trim() && !priceLoading && priceQuote?.credits ? ` · ${priceQuote.credits} credits` : ''}</>}</button> : <button onClick={handleUseAudio} disabled={isSaving} className="flex w-full items-center justify-center gap-2 rounded-[3px] bg-[#23c7be] py-3.5 text-sm font-black text-[#071211] hover:bg-[#35d8cf] disabled:opacity-50">{isSaving ? <><Loader2 size={18} className="animate-spin" /> Saving…</> : <><CheckCircle2 size={18} /> Use This Audio</>}</button>}</section>
            </aside>
          </div>
        </div>

        {showSaveVault && <SaveToVaultModal userEmail={user?.email} imageUrl={result} mediaType="audio" onClose={() => setShowSaveVault(false)} onSaved={handleVaultSaved} />}
      </motion.div>
    </div>
  );
}
