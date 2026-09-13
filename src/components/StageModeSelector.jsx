import React from 'react';
import { ChevronLeft } from 'lucide-react';

const MODES = [
  {
    id: 'actor_replacement',
    number: '1',
    title: 'Replace the Actor',
    subtitle: 'Step into the role with your full appearance.',
    description: 'The original actor is replaced as a whole, not only the face. This allows the result to respect skin tone, body type, height, proportions, and overall likeness.',
    media: [
      'front portrait photo',
      'full-body reference photo',
      'optional additional references',
    ],
    button: 'Continue with Actor Replacement',
  },
  {
    id: 'performance',
    number: '2',
    title: 'Perform the Scene',
    subtitle: 'Use your own movement, voice, and acting.',
    description: 'The scene structure remains, but your uploaded video drives the performance.',
    media: [
      'performance video',
      'voice/audio from the video',
      'optional likeness references',
    ],
    button: 'Continue with My Performance',
  },
  {
    id: 'voice_only',
    number: '3',
    title: 'Voice the Character',
    subtitle: 'Keep the original actor visually, but replace the voice.',
    description: null,
    media: [
      'voice recording or uploaded audio',
    ],
    button: 'Continue with Voice Only',
  },
];

export default function StageModeSelector({ episodePage, character, onSelect, onBack }) {
  const referenceImages = (character?.reference_images || []).map(r => typeof r === 'string' ? r : r.url);

  return (
    <div className="fixed inset-0 z-40 bg-black flex flex-col overflow-y-auto pointer-events-auto">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 px-5 pt-12 pb-2 text-white hover:text-white transition-colors self-start"
      >
        <ChevronLeft size={20} />
        <span className="text-xs tracking-widest uppercase">Back</span>
      </button>

      <div className="px-6 pb-12 flex flex-col gap-6">
        <div>
          <h2 className="text-white text-2xl font-extralight tracking-widest mb-3">
            Choose Your Stage Mode
          </h2>
          <p className="text-white text-sm font-light leading-relaxed">
            Before choosing a role, select how you want to take part in this production. Your choice determines which tools will be available next.
          </p>
        </div>

        {/* Character reference sheet */}
        {referenceImages.length > 0 && (
          <div className="border border-white/10 rounded-xl p-4 bg-white/5">
            <p className="text-white text-xs uppercase tracking-widest mb-3">Character Reference Sheet</p>
            {character?.name && <p className="text-white text-sm font-medium mb-3">{character.name}</p>}
            <div className="grid grid-cols-3 gap-2">
              {referenceImages.map((url, i) => (
                <img key={i} src={url} alt={`Reference ${i + 1}`}
                  className="w-full aspect-square object-cover rounded-lg" />
              ))}
            </div>
            <p className="text-white text-xs mt-3 leading-relaxed">
              Use these images as your reference when preparing your submission photos.
            </p>
          </div>
        )}

        {MODES.map((mode) => (
          <div
            key={mode.id}
            className="border border-white/10 rounded-xl p-5 bg-white/5 flex flex-col gap-3"
          >
            <div className="flex items-start gap-3">
              <span className="text-red-500 text-lg font-light leading-none mt-0.5">{mode.number}.</span>
              <div>
                <p className="text-white font-medium tracking-wide leading-tight">{mode.title}</p>
                <p className="text-white text-xs mt-1 font-light">{mode.subtitle}</p>
              </div>
            </div>

            {mode.description && (
              <p className="text-white text-xs leading-relaxed">{mode.description}</p>
            )}

            <div>
              <p className="text-white text-xs uppercase tracking-widest mb-2">Required media</p>
              <ul className="space-y-1">
                {mode.media.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-white text-xs">
                    <span className="text-white/20 mt-0.5">—</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => onSelect(mode.id)}
              className="w-full py-3 mt-1 bg-red-600 hover:bg-red-700 text-white text-xs font-light tracking-widest rounded-lg transition-colors"
            >
              {mode.button} →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}