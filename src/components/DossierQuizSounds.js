const SOUND_PRESETS = {
  none: { label: 'No sound', notes: [] },
  chime: { label: 'Magic chime', notes: [659, 784, 1047] },
  sparkle: { label: 'Sparkle', notes: [1047, 1319, 1568] },
  pop: { label: 'Soft pop', notes: [440, 660] },
  boing: { label: 'Funny boing', notes: [330, 220, 440] },
  applause: { label: 'Mini applause', notes: [523, 659, 784, 659, 880] },
  fanfare: { label: 'Little fanfare', notes: [523, 659, 784, 1047] },
  drumroll: { label: 'Tiny drumroll', notes: [180, 210, 240, 300, 380] },
};

export const QUIZ_SOUND_OPTIONS = Object.entries(SOUND_PRESETS).map(([value, sound]) => ({ value, label: sound.label }));

export function playQuizSound(name, volume = 0.35) {
  const preset = SOUND_PRESETS[name];
  if (!preset || !preset.notes.length || typeof window === 'undefined') return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    const context = new AudioContextClass();
    const now = context.currentTime;
    preset.notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = now + index * (name === 'drumroll' ? 0.075 : 0.11);
      const duration = name === 'drumroll' ? 0.07 : 0.16;
      oscillator.type = name === 'boing' ? 'triangle' : name === 'drumroll' ? 'square' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      if (name === 'boing') oscillator.frequency.exponentialRampToValueAtTime(Math.max(90, frequency * 0.55), start + duration);
      gain.gain.setValueAtTime(Math.max(0.01, Math.min(1, volume)) * 0.18, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    });
    window.setTimeout(() => context.close().catch(() => {}), 1600);
  } catch (error) {
    console.warn('Quiz sound playback unavailable', error);
  }
}
