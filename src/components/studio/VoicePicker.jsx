import React from 'react';
import { VOICE_NAMES, VOICE_LANGUAGES } from '@/lib/voiceCatalog.js';
import VoicePreviewButton from '@/components/studio/VoicePreviewButton';

export default function VoicePicker({ value, onChange, language, onLanguageChange, disabled = false, preview = true }) {
  return <div className="w-full min-w-0 space-y-2" data-voice-catalog="elevenlabs-v3-26">
    <div className="flex items-center gap-2">
      <label className="min-w-0 flex-1 text-xs">Voice · {VOICE_NAMES.length} choices
        <select aria-label="Voice" value={value || ''} onChange={event => onChange(event.target.value)} disabled={disabled} className="mt-1 w-full rounded-xl border border-neutral-500 bg-white px-3 py-2 text-sm font-semibold text-black disabled:opacity-50">
          {!value && <option value="">Choose voice</option>}
          {value && !VOICE_NAMES.includes(value) && <option value={value} disabled>{value} · unavailable</option>}
          {VOICE_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      {preview && value && <VoicePreviewButton voiceId={value} disabled={disabled} />}
    </div>
    {onLanguageChange && <label className="block text-xs">Speech language
      <select aria-label="Speech language" value={language || 'en'} onChange={event => onLanguageChange(event.target.value)} disabled={disabled} className="mt-1 w-full rounded-xl border border-neutral-500 bg-white px-3 py-2 text-sm text-black">
        {VOICE_LANGUAGES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
      </select>
    </label>}
    <p className="text-[10px] opacity-70">ElevenLabs via Replicate · voice previews in English. Language does not guarantee a regional accent.</p>
  </div>;
}

