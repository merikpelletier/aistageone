import React, { useEffect, useMemo } from 'react';
import VoicePreviewButton from '@/components/studio/VoicePreviewButton';
import { VOICE_LANGUAGES, VOICE_NAMES } from '@/lib/voiceCatalog';

function inputSchema(model) {
  return model?.schema?.components?.schemas?.Input?.properties || {};
}

function enumFromSchema(model, propertyName) {
  const property = inputSchema(model)?.[propertyName];
  if (!property) return [];
  if (Array.isArray(property.enum)) return property.enum;
  const ref = property?.allOf?.[0]?.['$ref'];
  if (!ref) return [];
  const schemaName = String(ref).split('/').pop();
  return model?.schema?.components?.schemas?.[schemaName]?.enum || [];
}

function parseExamples(description = '') {
  const values = [];
  for (const match of String(description).matchAll(/['"]([^'"]+)['"]/g)) {
    if (!values.includes(match[1])) values.push(match[1]);
  }
  return values;
}

function modelVoiceInfo(model) {
  const props = inputSchema(model);
  if (props.voice) {
    const voices = enumFromSchema(model, 'voice').map(String);
    return { voices, defaultVoice: String(props.voice.default || voices[0] || ''), parameter: 'voice' };
  }
  if (props.voice_id) {
    const examples = parseExamples(props.voice_id.description || '').filter(v => !/custom|voice id/i.test(v));
    const voices = examples.length ? examples : [String(props.voice_id.default || '')].filter(Boolean);
    return { voices, defaultVoice: String(props.voice_id.default || voices[0] || ''), parameter: 'voice_id' };
  }
  return { voices: VOICE_NAMES, defaultVoice: VOICE_NAMES[0] || '', parameter: 'voice' };
}

function modelLanguages(model) {
  const props = inputSchema(model);
  const propertyName = props.language ? 'language' : props.language_code ? 'language_code' : null;
  if (!propertyName) return VOICE_LANGUAGES;
  const values = enumFromSchema(model, propertyName).map(String);
  if (!values.length) return VOICE_LANGUAGES;
  const labels = new Intl.DisplayNames(['en'], { type: 'language' });
  return values.map(code => [code, code === 'auto' ? 'Auto detect' : (labels.of(code) || code)]);
}

export default function VoicePicker({ value, onChange, language, onLanguageChange, disabled = false, preview = true, model = null }) {
  const voiceInfo = useMemo(() => modelVoiceInfo(model), [model]);
  const languages = useMemo(() => modelLanguages(model), [model]);
  const providerName = model?.model_key?.startsWith('inworld/') ? 'Inworld' : model?.model_key?.startsWith('elevenlabs/') ? 'ElevenLabs' : (model?.name || 'ElevenLabs');

  useEffect(() => {
    if (!voiceInfo.voices.length) return;
    if (!value || !voiceInfo.voices.includes(value)) onChange(voiceInfo.defaultVoice || voiceInfo.voices[0]);
  }, [voiceInfo.voices.join('|'), voiceInfo.defaultVoice, value, onChange]);

  useEffect(() => {
    if (!onLanguageChange || !languages.length) return;
    const allowed = languages.map(([code]) => code);
    if (!allowed.includes(language)) onLanguageChange(allowed.includes('auto') ? 'auto' : allowed[0]);
  }, [languages.map(([code]) => code).join('|'), language, onLanguageChange]);

  return <div className="w-full min-w-0 space-y-2" data-voice-catalog={model?.model_key || 'speech-model'}>
    <div className="flex items-center gap-2">
      <label className="min-w-0 flex-1 text-xs">Voice · {voiceInfo.voices.length} choices
        <select aria-label="Voice" value={voiceInfo.voices.includes(value) ? value : ''} onChange={event => onChange(event.target.value)} disabled={disabled || !voiceInfo.voices.length} className="mt-1 w-full rounded-xl border border-neutral-500 bg-white px-3 py-2 text-sm font-semibold text-black disabled:opacity-50">
          {!voiceInfo.voices.length && <option value="">No preset voices available</option>}
          {voiceInfo.voices.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      {preview && value && voiceInfo.voices.includes(value) && <VoicePreviewButton voiceId={value} modelKey={model?.model_key} language={language} disabled={disabled} />}
    </div>
    {onLanguageChange && <label className="block text-xs">Speech language
      <select aria-label="Speech language" value={language || languages[0]?.[0] || 'en'} onChange={event => onLanguageChange(event.target.value)} disabled={disabled} className="mt-1 w-full rounded-xl border border-neutral-500 bg-white px-3 py-2 text-sm text-black">
        {languages.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
      </select>
    </label>}
    <p className="text-[10px] opacity-70">{providerName} via Replicate · voices and languages follow the selected AI model when available.</p>
  </div>;
}
