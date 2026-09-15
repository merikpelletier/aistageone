import { readFileSync, readdirSync } from 'node:fs';
import { extname } from 'node:path';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const failures = [];

const requireMarker = (label, content, marker) => {
  if (!content.includes(marker)) failures.push(`${label}: missing ${marker}`);
};

const forbidMarker = (label, content, marker) => {
  if (content.toLowerCase().includes(marker.toLowerCase())) failures.push(`${label}: forbidden ${marker}`);
};

const dubbingUi = read('src/components/studio/DubbingStudio.jsx');
const studio = read('src/pages/Studio.jsx');
const dubbingServer = read('supabase/functions/mixAudioVideo/index.ts');
const dubbingBase44 = read('base44/functions/mixAudioVideo/entry.ts');

for (const marker of ['audio_url: voiceUrl', 'video_url: videoUrl', 'mediaType="video"', '<video src={mixedResult}']) {
  requireMarker('Dubbing UI', dubbingUi, marker);
}
for (const marker of ['background_music_url', 'instrumentalUrl', 'mediaType="audio"']) {
  forbidMarker('Dubbing UI', dubbingUi, marker);
}
requireMarker('Studio Dubbing output', studio, "setProducedMedia({ url: file_url, type: 'video' })");
for (const marker of ["const { audio_url, video_url }", 'audio_file: audio_url', 'video_file: video_url', "toolId: 'dubbing'", "'dubbed_video.mp4'"]) {
  requireMarker('Dubbing server', dubbingServer, marker);
}

const versionPattern = /MODEL_VERSION\s*=\s*'([^']+)'/;
const migratedVersion = dubbingServer.match(versionPattern)?.[1];
const historicalVersion = dubbingBase44.match(versionPattern)?.[1];
if (!migratedVersion || migratedVersion !== historicalVersion) {
  failures.push('Dubbing server: Replicate version differs from the Base44 export');
}

const replicateGenerate = read('supabase/functions/replicateGenerate/index.ts');
for (const marker of [
  "startModelPrediction('kwaivgi/kling-lip-sync'",
  'video_url: photo_url',
  'audio_file: audio_url',
  "startModelPrediction('kwaivgi/kling-v2.6'",
  "startModelPrediction('bytedance/seedream-4.5'",
  "startModelPrediction('google/nano-banana-2'",
]) requireMarker('Replicate tools', replicateGenerate, marker);

const generateVideo = read('supabase/functions/generateVideo/index.ts');
for (const marker of ["replicate.run('kwaivgi/kling-v2.6'", "replicate.run('kwaivgi/kling-v1.6-standard'", "replicate.run('bytedance/seedance-1-lite'"]) {
  requireMarker('AI Video baseline', generateVideo, marker);
}
forbidMarker('Video Reference', generateVideo, 'wan-video/');
const guardPosition = generateVideo.indexOf('Video Reference is temporarily unavailable');
const billingPosition = generateVideo.indexOf('creditCharge = await reserveCredits');
if (guardPosition < 0 || billingPosition < 0 || guardPosition > billingPosition) {
  failures.push('Video Reference: safety guard must run before credit reservation');
}

const speech = read('supabase/functions/_shared/replicateAi.ts');
requireMarker('Speech', speech, "SPEECH_MODEL = 'elevenlabs/v3'");
const speechEndpoint = read('supabase/functions/generateSpeech/index.ts');
for (const marker of [
  'ELEVENLABS_VOICES.has(voice)',
  "PREVIEW_CACHE_DIRECTORY = 'voice-previews/elevenlabs-v3-v1'",
  'credit_cost: 0',
  'voice,',
]) requireMarker('Speech endpoint', speechEndpoint, marker);
const base44Client = read('src/api/base44Client.js');
requireMarker('Speech client bridge', base44Client, "GenerateSpeech: (payload) => invokeCoreFunction('generateSpeech', payload)");
forbidMarker('Speech client bridge', base44Client, "GenerateSpeech: (payload) => invokeCoreFunction('generate-speech', payload)");
const voicePreview = read('src/components/studio/VoicePreviewButton.jsx');
for (const marker of ["base44.functions.invoke('generateSpeech'", 'voice: voiceId', 'preview: true']) {
  requireMarker('Voice preview', voicePreview, marker);
}

const pagesConfig = read('src/pages.config.js');
for (const marker of ["import PitchDecks from './pages/PitchDecks'", '"PitchDeckEditor": PitchDeckEditor', '"PitchDeckDetail": PitchDeckDetail']) {
  requireMarker('Pitch Deck routes', pagesConfig, marker);
}
const app = read('src/App.jsx');
requireMarker('Pitch Deck public route', app, '<Route path="/PitchDeckShare"');
const pitchWorkspace = read('src/components/studio/LabWorkspace.jsx');
for (const marker of ["id: 'pitch_deck'", "navigate('/PitchDecks')"]) requireMarker('Pitch Deck workspace', pitchWorkspace, marker);
for (const marker of ["id: 'olo_shop'", "label: 'OLO Shop'", "navigate('/Catalog')"]) requireMarker('OLO Shop workspace', pitchWorkspace, marker);
const catalogPage = read('src/pages/Catalog.jsx');
for (const marker of ["from '@/api/supabaseClient'", ".from('catalog_asset')", ".eq('status', 'published')", "from('asset_category')", "from('asset_subcategory')"]) requireMarker('OLO Shop catalog', catalogPage, marker);
forbidMarker('OLO Shop catalog', catalogPage, 'base44');
const catalogCard = read('src/components/catalog/AssetCard.jsx');
requireMarker('OLO Shop asset card', catalogCard, "to={`/AssetDetail?id=${encodeURIComponent(asset.id)}`}");
const assetDetailPage = read('src/pages/AssetDetail.jsx');
for (const marker of ["from '@/api/supabaseClient'", ".from('catalog_asset')", ".eq('id', assetId)"]) requireMarker('OLO Shop asset detail', assetDetailPage, marker);
forbidMarker('OLO Shop asset detail', assetDetailPage, 'base44');
const pitchReader = read('src/hooks/usePitchVoiceReader.js');
for (const marker of ['section.narration_audio_url']) requireMarker('Pitch Deck reader', pitchReader, marker);
for (const marker of ['speechSynthesis', 'generate-pitch-speech', "'honey'", "generatePitchSpeech"]) forbidMarker('Pitch Deck reader', pitchReader, marker);
const pitchEditor = read('src/pages/PitchDeckEditor.jsx');
for (const marker of ["supabase.functions.invoke('generatePitchSpeech'", 'voice: narrationVoice']) requireMarker('Pitch Deck editor narration generation', pitchEditor, marker);
const pitchSpeech = read('supabase/functions/generatePitchSpeech/index.ts');
for (const marker of ["from '../_shared/replicateAi.ts'", 'ELEVENLABS_VOICES.has(body.voice)', 'pitch-readers/elevenlabs-v3']) {
  requireMarker('Pitch Deck speech', pitchSpeech, marker);
}
forbidMarker('Pitch Deck speech', pitchSpeech, "from '../_shared/openai.ts'");

const authorStoryBlocks = read('src/components/studio/AuthorStoryBlocks.jsx');
for (const marker of ["from '@/api/supabaseClient'", ".from('catalog_asset')", ".from('asset_category')", "source: 'olo_shop'", 'Select image from OLO Shop', 'Search OLO Shop', 'All categories', 'All creators', 'Clear filters']) requireMarker('Story Blocks Author shop selection', authorStoryBlocks, marker);
for (const marker of ['platformCharacters', 'platformSets', "source: 'aistage'"]) forbidMarker('Story Blocks Author pack isolation', authorStoryBlocks, marker);
const authorProduction = read('src/components/studio/AuthorProductionWorkspace.jsx');
for (const marker of [
  'Voice for this segment',
  'Draft current segment',
  'Image ratio · entire chapter',
  'Story Block Preview',
  "base44.functions.invoke('publishAuthorStory'",
  'Visual format for this segment',
  'Generate missing panels',
  'assembleComicPage',
  'live-action cinematic production still',
  "AUTHOR'S INSTRUCTION FOR THIS FRAME",
  'IMMUTABLE LOCATION REFERENCE',
  'Never redesign, replace, extend, simplify, modernize or invent the location',
  "'visual instruction'",
  'Generate current segment',
  'Approve segment',
  'base44.integrations.Core.GenerateImage',
  "base44.functions.invoke('generateSpeech'",
  'narration_versions',
  'image_versions',
  'audio_versions',
]) requireMarker('Story Blocks Author guided production', authorProduction, marker);
forbidMarker('Story Blocks Author frame style', authorProduction, 'comic-book panels');
if (authorProduction.includes('COMIC PANEL ${')) failures.push('Story Blocks Author frame style: generation prompt must describe a cinematic frame, not a comic panel');
if (authorProduction.includes('const framePrompt = (panel, index) => `${segment.image_instruction}')) failures.push('Story Blocks Author frame direction: shared direction must not override the author prompt for an individual frame');
forbidMarker('Story Blocks Author image generator', authorProduction, "method: 'compose_scene'");
const storyImageEndpoint = read('supabase/functions/generate-image/index.ts');
for (const marker of ["models/google/nano-banana-2/predictions", 'image_input: referenceImages', 'reference_image_urls', 'referenceUrls.map(toDataUri)']) {
  requireMarker('Story Blocks Author image endpoint', storyImageEndpoint, marker);
}
const authorModel = read('src/components/studio/authorStoryModel.js');
requireMarker('Story Blocks Author exact chapter size', authorModel, "Array.from({ length: 9 }");

const saveToVault = read('src/components/studio/SaveToVaultModal.jsx');
requireMarker('Vault save', saveToVault, 'media_type: mediaType');
const vaultSection = read('src/components/VaultSection.jsx');
const vaultDrawer = read('src/components/VaultDrawer.jsx');
requireMarker('Vault page', vaultSection, "asset.media_type === 'audio'");
requireMarker('Vault drawer', vaultDrawer, "asset.media_type === 'audio'");

const activeRoots = ['src', 'supabase/functions'];
const activeExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.json']);
const forbiddenBase44Endpoints = ['base44.app', 'base44.com', 'api.base44', 'base44cdn'];
const visit = (directoryUrl) => {
  for (const entry of readdirSync(directoryUrl, { withFileTypes: true })) {
    const entryUrl = new URL(entry.isDirectory() ? `${entry.name}/` : entry.name, directoryUrl);
    if (entry.isDirectory()) visit(entryUrl);
    else if (activeExtensions.has(extname(entry.name))) {
      const content = readFileSync(entryUrl, 'utf8');

      for (const endpoint of forbiddenBase44Endpoints) forbidMarker(`Active source ${entryUrl.pathname}`, content, endpoint);
    }
  }
};
for (const directory of activeRoots) visit(new URL(`${directory}/`, root));

for (const slug of ["agent-conversations","checkStoryBlockPlan","generate-image","generate-speech","generateBlockVideos","generateCharacterSheet","generatePitchSpeech","generateSpeech","generateStoryBlock","generateVideo","invoke-llm","mixAudioVideo","proposeStoryArc","regenerateNarration","regenerateSegment","replicateGenerate","replicateWebhook","transcribe-audio"]) { requireMarker('Owner model control '+slug,read('supabase/functions/'+slug+'/index.ts'),"installModelControl('"+slug+"')"); }
const modelPolicy=read('supabase/functions/_shared/modelControlPolicy.ts');
requireMarker('Blocked model policy',modelPolicy,"BLOCKED_MODEL='bytedance/seedream-4.5'");
requireMarker('No automatic replacement',read('supabase/functions/_shared/modelControlRuntime.ts'),'if(context.failed)');
requireMarker('Chosen model validation',read('supabase/functions/_shared/modelControlRuntime.ts'),'validateChoice(assignment,model)');
if (failures.length > 0) {
  console.error('Build blocked: Studio tool contracts failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Studio tool contract check passed.');
