// Matches the approved elevenlabs/v3 schema, verified 2026-09-09.
// Replicate exposes preset names, not verified nationality/accent metadata.
export const VOICE_NAMES = [
  "Rachel",
  "Drew",
  "Clyde",
  "Paul",
  "Aria",
  "Domi",
  "Dave",
  "Roger",
  "Fin",
  "Sarah",
  "Antoni",
  "Thomas",
  "Charlie",
  "George",
  "Emily",
  "Elli",
  "Callum",
  "Patrick",
  "Harry",
  "Liam",
  "Dorothy",
  "Josh",
  "Arnold",
  "Charlotte",
  "Matilda",
  "Gigi"
];
export const VOICE_LANGUAGES = [
  ['en', 'English'], ['af', 'Afrikaans'], ['ar', 'Arabic'], ['hy', 'Armenian'], ['as', 'Assamese'],
  ['az', 'Azerbaijani'], ['be', 'Belarusian'], ['bn', 'Bengali'], ['bs', 'Bosnian'], ['bg', 'Bulgarian'],
  ['ca', 'Catalan'], ['ceb', 'Cebuano'], ['ny', 'Chichewa'], ['hr', 'Croatian'], ['cs', 'Czech'],
  ['da', 'Danish'], ['nl', 'Dutch'], ['et', 'Estonian'], ['fil', 'Filipino'], ['fi', 'Finnish'],
  ['fr', 'French'], ['gl', 'Galician'], ['ka', 'Georgian'], ['de', 'German'], ['el', 'Greek'],
  ['gu', 'Gujarati'], ['ha', 'Hausa'], ['he', 'Hebrew'], ['hi', 'Hindi'], ['hu', 'Hungarian'],
  ['is', 'Icelandic'], ['id', 'Indonesian'], ['ga', 'Irish'], ['it', 'Italian'], ['ja', 'Japanese'],
  ['jv', 'Javanese'], ['kn', 'Kannada'], ['kk', 'Kazakh'], ['ky', 'Kirghiz'], ['ko', 'Korean'],
  ['lv', 'Latvian'], ['ln', 'Lingala'], ['lt', 'Lithuanian'], ['lb', 'Luxembourgish'], ['mk', 'Macedonian'],
  ['ms', 'Malay'], ['ml', 'Malayalam'], ['zh', 'Mandarin Chinese'], ['mr', 'Marathi'], ['ne', 'Nepali'],
  ['no', 'Norwegian'], ['ps', 'Pashto'], ['fa', 'Persian'], ['pl', 'Polish'], ['pt', 'Portuguese'],
  ['pa', 'Punjabi'], ['ro', 'Romanian'], ['ru', 'Russian'], ['sr', 'Serbian'], ['sd', 'Sindhi'],
  ['sk', 'Slovak'], ['sl', 'Slovenian'], ['so', 'Somali'], ['es', 'Spanish'], ['sw', 'Swahili'],
  ['sv', 'Swedish'], ['ta', 'Tamil'], ['te', 'Telugu'], ['th', 'Thai'], ['tr', 'Turkish'],
  ['uk', 'Ukrainian'], ['ur', 'Urdu'], ['vi', 'Vietnamese'], ['cy', 'Welsh'],
];
export function validateVoice(voice) {
  if (!VOICE_NAMES.includes(voice)) throw new Error('Unsupported voice. Choose a voice from the catalogue.');
  return voice;
}
export function validateVoiceLanguage(code = 'en') {
  if (!VOICE_LANGUAGES.some(([value]) => value === code)) throw new Error('Unsupported speech language.');
  return code;
}

