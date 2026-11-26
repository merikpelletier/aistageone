import React, { useMemo, useState } from 'react';
import { supabase } from '@/api/base44Client';
import { toast } from 'sonner';
import { Mic2, Sparkles, Loader2, RotateCcw, Save, Volume2, CheckCircle2 } from 'lucide-react';
import { useAiModelOptions } from '@/hooks/useAiModelOptions';
import { useAiPriceQuote } from '@/hooks/useAiPriceQuote';
import { useStudioTranslation } from '@/lib/useStudioTranslation';

const inputClass = 'w-full rounded-[3px] border border-white/15 bg-black/25 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#23c7be] disabled:opacity-50';
const fields = [
  ['age', 'Apparent age', 'Mature adult…'],
  ['gender', 'Vocal gender', 'Feminine, masculine, androgynous…'],
  ['accent', 'Accent', 'Québécois French, neutral Canadian English…'],
  ['timbre', 'Timbre & texture', 'Warm, rich, slightly husky…'],
  ['pitch', 'Pitch / register', 'Low, mid, high…'],
  ['personality', 'Personality & expressiveness', 'Confident, elegant, measured…'],
];

export default function VoiceCreator({ onClose }) {
  const t = useStudioTranslation();
  const [language, setLanguage] = useState('en');
  const [name, setName] = useState('');
  const [voice, setVoice] = useState({ age: '', gender: '', accent: '', timbre: '', pitch: '', personality: '' });
  const [previewText, setPreviewText] = useState('Hello. It is a pleasure to meet you. Today, I would like to share a little story with you. I hope you enjoy listening.');
  const [result, setResult] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const getSuggestedPreviewText = (lang) => lang === 'fr'
    ? t('voice_creator.reference_sample.fr', 'Bonjour. Je suis heureux de vous rencontrer. Aujourd’hui, j’aimerais vous raconter une petite histoire. J’espère que vous prendrez plaisir à l’écouter.')
    : t('voice_creator.reference_sample.en', 'Hello. It is a pleasure to meet you. Today, I would like to share a little story with you. I hope you enjoy listening.');
  const prompt = useMemo(() => [
    name.trim() ? 'Voice identity: ' + name.trim() : '',
    voice.age && 'Apparent age: ' + voice.age,
    voice.gender && 'Vocal gender: ' + voice.gender,
    voice.accent && 'Accent and pronunciation: ' + voice.accent,
    voice.timbre && 'Timbre and texture: ' + voice.timbre,
    voice.pitch && 'Pitch and register: ' + voice.pitch,
    voice.personality && 'Personality and expressiveness: ' + voice.personality,
  ].filter(Boolean).join('. '), [name, voice]);
  const pricingPrompt = useMemo(() => [
    prompt,
    'Speak the following exact dialogue in this voice: "' + previewText.trim() + '"',
    'Natural human phrasing and pronunciation. Clean studio recording, no music, no background noise.',
  ].join('. '), [prompt, previewText]);
  const pricingInput = useMemo(() => ({ prompt: pricingPrompt }), [pricingPrompt]);
  const { options: modelOptions, loading: modelsLoading } = useAiModelOptions({ service: 'designCharacterVoice', kind: 'speech', input: pricingInput, enabled: true });
  const effectiveModel = selectedModel || modelOptions.find(m => m.recommended)?.model_key || modelOptions[0]?.model_key || null;
  const { quote, loading: priceLoading } = useAiPriceQuote({ service: 'designCharacterVoice', kind: 'speech', input: pricingInput, modelKey: effectiveModel, enabled: Boolean(prompt.trim() && effectiveModel) });

  const generate = async () => {
    if (!prompt.trim() || !previewText.trim() || !effectiveModel || generating) return;
    setGenerating(true); setResult(null); setSaved(false);
    try {
      const { data, error } = await supabase.functions.invoke('designCharacterVoice', {
        body: { action: 'design', standalone: true, voice_prompt: prompt, language, preview_text: previewText.trim(), model_key: effectiveModel },
      });
      if (error) throw error;
      if (!data?.preview?.audio_url) throw new Error(data?.error || t('Voice generation returned no audio.', 'Voice generation returned no audio.'));
      setResult(data.preview);
    } catch (error) { toast.error(error?.message || t('Unable to generate this voice.', 'Unable to generate this voice.')); }
    finally { setGenerating(false); }
  };

  const saveToVault = async () => {
    if (!result?.audio_url || saving || saved) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('designCharacterVoice', {
        body: { action: 'save', standalone: true, audio_url: result.audio_url, preview_text: result.preview_text || previewText.trim(), language, name: name.trim() || t('Custom voice', 'Custom voice') },
      });
      if (error) throw error;
      if (!data?.vault_asset?.url) throw new Error(data?.error || t('The voice was not saved to Vault.', 'The voice was not saved to Vault.'));
      setResult(current => ({ ...current, audio_url: data.vault_asset.url }));
      setSaved(true); toast.success(t('Voice saved to Vault.', 'Voice saved to Vault.'));
    } catch (error) { toast.error(error?.message || t('Unable to save the voice to Vault.', 'Unable to save the voice to Vault.')); }
    finally { setSaving(false); }
  };

  return <div className="min-h-full w-full bg-[#202328] p-4 pb-28 text-white md:p-8 lg:pb-32">
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#17191d] px-4 py-4">
        <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-[3px] border border-[#23c7be]/30 bg-[#23c7be]/10 text-[#23c7be]"><Mic2 size={19} /></div><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#23c7be]">{t('Sound & Voice', 'Sound & Voice')}</p><h2 className="text-xl font-black">{t('Voice Creator', 'Voice Creator')}</h2><p className="text-xs text-white/45">{t('Create a voice sample and save it to your Vault.', 'Create a voice sample and save it to your Vault.')}</p></div></div>
        {onClose && <button onClick={onClose} className="rounded-[3px] border border-white/10 bg-white/[.04] px-3 py-2 text-xs font-bold text-white/70 hover:bg-white/10">{t('Close', 'Close')}</button>}
      </header>
      <section className="rounded-[4px] border border-white/10 bg-[#17191d] p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-black">{t('Voice identity', 'Voice identity')}</h3><p className="mt-1 text-xs text-white/40">{t('These details describe the stable sound of the voice.', 'These details describe the stable sound of the voice.')}</p></div><div className="flex gap-1 rounded-[3px] border border-white/10 p-1">{['en', 'fr'].map(lang => <button key={lang} type="button" onClick={() => { const currentSuggestion = getSuggestedPreviewText(language); const nextSuggestion = getSuggestedPreviewText(lang); setPreviewText(current => !current.trim() || current === currentSuggestion ? nextSuggestion : current); setLanguage(lang); setResult(null); setSaved(false); }} className={`px-3 py-2 text-xs font-bold ${language === lang ? 'bg-[#23c7be] text-[#071211]' : 'text-white/60 hover:bg-white/5'}`}>{lang === 'en' ? t('English', 'English') : t('French', 'French')}</button>)}</div></div>
        <label className="block space-y-1"><span className="text-xs font-bold text-white/70">{t('Voice name', 'Voice name')}</span><input className={inputClass} value={name} maxLength={100} onChange={e => setName(e.target.value)} placeholder={t('e.g. Francine — warm and curious', 'e.g. Francine — warm and curious')} /></label>
        <div className="grid gap-3 md:grid-cols-2">{fields.map(([key, label, placeholder]) => <label key={key} className="block space-y-1"><span className="text-xs font-bold text-white/70">{t(label, label)}</span><textarea className={inputClass + ' min-h-[76px] resize-y'} value={voice[key]} onChange={e => { setVoice(v => ({ ...v, [key]: e.target.value })); setResult(null); setSaved(false); }} placeholder={t(placeholder, placeholder)} rows={2} /></label>)}</div>
        <label className="block space-y-1"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold text-white/70">{t('Reference dialogue', 'Reference dialogue')}</span><button type="button" onClick={() => { setPreviewText(getSuggestedPreviewText(language)); setResult(null); setSaved(false); }} className="text-[11px] font-bold text-[#23c7be] hover:text-white">{t('voice_creator.insert_suggested_text', 'Insert suggested text')}</button></div><textarea className={inputClass + ' min-h-[104px] resize-y'} maxLength={1000} value={previewText} onChange={e => { setPreviewText(e.target.value); setResult(null); setSaved(false); }} placeholder={language === 'fr' ? t('Écrivez le texte exact que la voix doit prononcer…', 'Écrivez le texte exact que la voix doit prononcer…') : t('Write the exact text the voice should speak…', 'Write the exact text the voice should speak…')} rows={3} /><span className="text-[10px] text-white/35">{previewText.length}/1000</span></label>
      </section>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="rounded-[4px] border border-white/10 bg-[#17191d] p-4 space-y-3"><h3 className="text-sm font-black">{t('Voice preview', 'Voice preview')}</h3>
          {result?.audio_url ? <><audio controls preload="none" src={result.audio_url} className="w-full" /><div className="flex flex-wrap gap-2"><button onClick={generate} disabled={generating} className="inline-flex items-center gap-2 rounded-[3px] border border-[#23c7be]/35 bg-[#23c7be]/10 px-3 py-2 text-xs font-bold text-[#8ee9e4] disabled:opacity-50"><RotateCcw size={14} />{t('Regenerate', 'Regenerate')}</button><button onClick={saveToVault} disabled={saving || saved} className="inline-flex items-center gap-2 rounded-[3px] bg-[#23c7be] px-3 py-2 text-xs font-black text-[#071211] disabled:opacity-50">{saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}{saved ? t('Saved to Vault', 'Saved to Vault') : t('Save to Vault', 'Save to Vault')}</button></div></> : <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 text-center text-white/35"><Volume2 size={26} /><p className="text-xs">{t('Your generated voice sample will appear here.', 'Your generated voice sample will appear here.')}</p></div>}
        </div>
        <aside className="rounded-[4px] border border-white/10 bg-[#17191d] p-4 space-y-4"><div><label className="mb-2 block text-[10px] font-black uppercase tracking-[.12em] text-white/45">{t('AI Model', 'AI Model')}</label><select value={effectiveModel || ''} onChange={e => { setSelectedModel(e.target.value || null); setResult(null); setSaved(false); }} disabled={modelsLoading || modelOptions.length === 0 || generating} className={inputClass + ' font-bold'}>{modelsLoading && <option value="">{t('Loading models…', 'Loading models…')}</option>}{!modelsLoading && !modelOptions.length && <option value="">{t('No model configured', 'No model configured')}</option>}{modelOptions.map(m => <option key={m.model_key} value={m.model_key}>{m.name || m.model_key}{m.recommended ? ' — ' + t('Recommended', 'Recommended') : ''}</option>)}</select></div>
          <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-3 text-xs"><span className="text-white/45">{t('Generation cost', 'Generation cost')}</span><span className="font-black text-[#8ee9e4]">{priceLoading ? t('Calculating…', 'Calculating…') : quote?.credits ? quote.credits + ' ' + t('credits', 'credits') : t('Calculated automatically', 'Calculated automatically')}</span></div>
          <button onClick={generate} disabled={generating || !prompt.trim() || !previewText.trim() || !effectiveModel || modelsLoading} className="flex w-full items-center justify-center gap-2 rounded-[3px] bg-[#23c7be] px-4 py-3 text-sm font-black text-[#071211] hover:bg-[#35d8cf] disabled:bg-white/[.05] disabled:text-white/30">{generating ? <><Loader2 size={17} className="animate-spin" />{t('Generating…', 'Generating…')}</> : <><Sparkles size={17} />{t('Generate voice', 'Generate voice')}</>}</button>
          <p className="text-[10px] leading-relaxed text-white/35">{t('The selected model and its configured Replicate route determine the generation. Credits are calculated by the platform.', 'The selected model and its configured Replicate route determine the generation.')}</p>
        </aside>
      </section>
    </div>
  </div>;
}
