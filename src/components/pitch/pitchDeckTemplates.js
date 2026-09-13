export const PITCH_TEMPLATES = [
  { id: 'cinematic_drama', name: 'Cinematic Drama', gradient: 'from-zinc-950 via-zinc-900 to-amber-950', accent: '#b8895a', serif: true },
  { id: 'premium_minimal', name: 'Premium Minimal', gradient: 'from-white via-zinc-100 to-zinc-300', accent: '#111111', light: true },
  { id: 'comedy_ensemble', name: 'Comedy Ensemble', gradient: 'from-orange-400 via-pink-400 to-yellow-300', accent: '#ff7a45', light: true },
  { id: 'supernatural_mystery', name: 'Supernatural Mystery', gradient: 'from-indigo-950 via-violet-900 to-cyan-900', accent: '#7c5cff' },
  { id: 'documentary_editorial', name: 'Documentary Editorial', gradient: 'from-stone-900 via-stone-700 to-amber-800', accent: '#c2410c', serif: true },
  { id: 'thriller', name: 'Thriller', gradient: 'from-zinc-950 via-zinc-900 to-red-950', accent: '#dc2626' },
  { id: 'romance', name: 'Romance', gradient: 'from-rose-300 via-pink-300 to-purple-300', accent: '#ec4899', light: true, serif: true },
  { id: 'science_fiction', name: 'Science Fiction', gradient: 'from-cyan-800 via-blue-800 to-indigo-950', accent: '#06b6d4' },
];

export const LAYOUT_OPTIONS = [
  ['hero', 'Hero full screen'],
  ['split', 'Split image / text'],
  ['gallery', 'Media gallery'],
  ['cards', 'Character cards'],
  ['timeline', 'Timeline'],
  ['text', 'Centered text'],
  ['video', 'Video'],
  ['audio', 'Audio'],
  ['banner', 'Image banner'],
];

export const TRANSITIONS = ['fade', 'slide', 'zoom', 'push_in', 'pan', 'reveal', 'glitch'];

export const getPitchTemplate = (id) => PITCH_TEMPLATES.find((template) => template.id === id) || PITCH_TEMPLATES[7];

