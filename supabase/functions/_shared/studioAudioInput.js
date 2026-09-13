export const AUDIO_TOOLS = {
  music: { service: 'generateMusic', model: 'minimax/music-2.6', label: 'Music' },
  sound_fx: { service: 'generateSoundFx', model: 'sepal/audiogen', label: 'Sound FX' },
};
export function audioInput(tool, body) {
  const bad = message => { throw Object.assign(new Error(message), { status: 400 }); };
  if (!AUDIO_TOOLS[tool]) bad('Unknown audio tool');
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const format = body.format || (tool === 'music' ? 'mp3' : 'wav');
  if (!['mp3', 'wav'].includes(format)) bad('Choose MP3 or WAV');
  if (prompt.length > 2000) bad('Description: maximum 2000 characters');
  if (tool === 'sound_fx') {
    if (!prompt) bad('Describe the sound');
    const duration = Number(body.duration ?? 3);
    if (!Number.isFinite(duration) || duration < 1 || duration > 10) bad('Duration must be between 1 and 10 seconds');
    return { prompt, duration, output_format: format };
  }
  if (!['lyrics', 'auto', 'instrumental'].includes(body.mode)) bad('Choose a music mode');
  const lyrics = typeof body.lyrics === 'string' ? body.lyrics.trim() : '';
  if (body.mode === 'lyrics' && !lyrics) bad('Enter your lyrics');
  if (lyrics.length > 3500) bad('Lyrics: maximum 3500 characters');
  if (body.mode !== 'lyrics' && !prompt) bad('Describe the music');
  return {
    prompt, lyrics: body.mode === 'lyrics' ? lyrics : '',
    is_instrumental: body.mode === 'instrumental',
    lyrics_optimizer: body.mode === 'auto',
    audio_format: format,
  };
}
export const publicAudioJob = job => ({
  id: job.id, tool: job.tool, status: job.status, title: job.title,
  format: job.format, file_url: job.status === 'succeeded' ? job.file_url : null,
  error: job.error, created_at: job.created_at, credit_cost: job.charge?.cost ?? null,
});
