import { installModelControl } from '../_shared/modelControlRuntime.ts';
import { serveWithCors } from '../generateSpeech/_legacy/cors.ts';
import { audioHandler } from '../_shared/studioAudio.ts';
installModelControl('generateSoundFx');
serveWithCors(audioHandler('sound_fx'));
