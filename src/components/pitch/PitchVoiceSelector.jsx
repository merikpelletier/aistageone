import React from 'react';
import VoicePicker from '@/components/studio/VoicePicker.jsx';
export default function PitchVoiceSelector({ value, onChange, language, onLanguageChange }) {
 return <div className="w-52 text-zinc-200"><VoicePicker value={value} onChange={onChange} language={language} onLanguageChange={onLanguageChange} preview={false} /></div>;
}
