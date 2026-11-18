const SOUND_PRESETS = {
  none: { label: 'No sound' },
  chime: { label: 'Magic chime' },
  sparkle: { label: 'Sparkle' },
  pop: { label: 'Soft pop' },
  boing: { label: 'Funny boing' },
  applause: { label: 'Mini applause' },
  fanfare: { label: 'Little fanfare' },
  drumroll: { label: 'Tiny drumroll' },
};

export const QUIZ_SOUND_OPTIONS = Object.entries(SOUND_PRESETS).map(([value, sound]) => ({ value, label: sound.label }));

export function playQuizSound(name, volume = 0.35) {
  if (!SOUND_PRESETS[name] || name === 'none' || typeof window === 'undefined') return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  let context;
  try {
    context = new AudioContextClass();
    const now = context.currentTime;
    const level = Math.max(0.01, Math.min(1, volume));
    const master = context.createGain();
    master.gain.value = level * 0.48;
    master.connect(context.destination);

    const tone = (frequency, start, duration, options = {}) => {
      const osc = context.createOscillator();
      const amp = context.createGain();
      const filter = context.createBiquadFilter();
      osc.type = options.type || 'sine';
      osc.frequency.setValueAtTime(frequency, start);
      if (options.endFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(35, options.endFrequency), start + duration);
      filter.type = options.filter || 'lowpass';
      filter.frequency.value = options.cutoff || 5000;
      amp.gain.setValueAtTime(0.0001, start);
      amp.gain.exponentialRampToValueAtTime(options.peak || 0.45, start + Math.min(0.012, duration / 4));
      amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(filter); filter.connect(amp); amp.connect(master);
      osc.start(start); osc.stop(start + duration + 0.025);
    };
    const noise = (start, duration, options = {}) => {
      const length = Math.max(1, Math.floor(context.sampleRate * duration));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (options.roughness || 1);
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const amp = context.createGain();
      source.buffer = buffer;
      filter.type = options.filter || 'bandpass';
      filter.frequency.value = options.cutoff || 1600;
      filter.Q.value = options.q || 0.8;
      amp.gain.setValueAtTime(0.0001, start);
      amp.gain.linearRampToValueAtTime(options.peak || 0.25, start + Math.min(0.008, duration / 3));
      amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.connect(filter); filter.connect(amp); amp.connect(master);
      source.start(start); source.stop(start + duration);
    };

    if (name === 'chime') {
      [ [784,0,0.52], [1175,0.035,0.48], [1568,0.07,0.42] ].forEach(([f, offset, duration]) => {
        tone(f, now + offset, duration, { type: 'sine', peak: 0.28 });
        tone(f * 2.01, now + offset, duration * 0.58, { type: 'sine', peak: 0.07 });
      });
    } else if (name === 'sparkle') {
      [2093,2637,3136,3520,4186].forEach((f,i) => tone(f, now + i * 0.085, 0.19 + (i%2)*0.08, { peak: 0.16 }));
      noise(now + 0.02, 0.48, { filter: 'highpass', cutoff: 6500, peak: 0.055 });
    } else if (name === 'pop') {
      noise(now, 0.075, { filter: 'lowpass', cutoff: 850, peak: 0.7 });
      tone(210, now, 0.13, { endFrequency: 75, type: 'sine', peak: 0.48, cutoff: 500 });
      tone(620, now + 0.018, 0.045, { endFrequency: 280, peak: 0.12 });
    } else if (name === 'boing') {
      tone(190, now, 0.52, { endFrequency: 720, type: 'triangle', peak: 0.5, cutoff: 1300 });
      tone(380, now + 0.03, 0.43, { endFrequency: 1440, type: 'sine', peak: 0.12 });
      tone(115, now + 0.48, 0.16, { endFrequency: 70, type: 'triangle', peak: 0.26 });
    } else if (name === 'applause') {
      [0,0.11,0.23,0.36,0.51,0.67,0.84,1.02].forEach((offset,i) => {
        noise(now + offset, 0.12 + Math.random()*0.1, { filter: 'highpass', cutoff: 1000 + Math.random()*1800, peak: 0.16 + Math.random()*0.12 });
      });
      noise(now + 0.2, 0.8, { filter: 'bandpass', cutoff: 2400, q: 0.35, peak: 0.08 });
    } else if (name === 'fanfare') {
      [[523,0,0.28],[659,0.23,0.28],[784,0.46,0.3],[1047,0.7,0.65]].forEach(([f,offset,duration]) => {
        tone(f, now + offset, duration, { type: 'sawtooth', filter: 'lowpass', cutoff: 1800, peak: 0.19 });
        tone(f * 1.5, now + offset, duration * 0.8, { type: 'triangle', peak: 0.075 });
      });
    } else if (name === 'drumroll') {
      for (let i = 0; i < 15; i++) {
        const offset = i * 0.065;
        noise(now + offset, 0.055, { filter: 'lowpass', cutoff: 900 + i*100, peak: 0.22 + i*0.008 });
        tone(95 + i*5, now + offset, 0.05, { type: 'triangle', peak: 0.12, cutoff: 500 });
      }
      tone(180, now + 1.02, 0.24, { endFrequency: 65, type: 'sine', peak: 0.32 });
    }
    window.setTimeout(() => context.close().catch(() => {}), 2200);
  } catch (error) {
    if (context) context.close().catch(() => {});
    console.warn('Quiz sound playback unavailable', error);
  }
}
