import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { transform, build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { webcrypto } from 'node:crypto';
import { VOICE_NAMES, VOICE_LANGUAGES, validateVoiceLanguage } from '../supabase/functions/_shared/voiceCatalog.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
async function handler(slug, overrides = {}) {
  let captured;
  let calls = [];
  let charges = 0;
  const rows = {
    pitch_project: { id: 'project', original_language: 'fr' },
    pitch_section: { id: 'section', title: 'Bonjour', body: 'Une histoire.', section_type: 'text' },
  };
  const storage = { from: () => ({ list: async () => ({ data: [{ name: 'Priyanka.mp3' }] }), upload: async () => ({}), getPublicUrl: () => ({ data: { publicUrl: 'https://audio.test/result.mp3' } }) }) };
  const client = { storage, auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) }, from: table => {
    const query = { select: () => query, eq: () => query, single: async () => ({ data: rows[table] }) }; return query;
  } };
  const base44 = {
    auth: { me: async () => ({ id: 'owner', email: 'owner@test' }) },
    entities: {
      StoryBlock: { get: async () => ({ session_id: 'session', segment_instructions: [{ narration_text: 'Bonjour' }] }), update: async () => ({}) },
      StorySession: { get: async () => ({ user_email: 'owner@test', narrator_language: 'fr' }), update: async () => ({}) },
    },
    integrations: { Core: { GenerateSpeech: async payload => { calls.push(payload); return { url: 'https://audio.test/result.mp3', file_url: 'https://audio.test/result.mp3' }; } } },
  };
  base44.asServiceRole = { integrations: base44.integrations };
  const deps = {
    serveWithCors: fn => { captured = fn; },
    installModelControl: () => {},
    createCreditBillingContext: async () => ({ service: client, user: { id: 'owner' } }),
    createClientFromRequest: () => base44,
    createClient: () => client,
    withCreditCharge: async (_options, fn) => { charges++; return { result: await fn(), charge: { cost: 2, balanceAfter: 100 } }; },
    generateSpeech: async payload => { calls.push(payload); return new Blob(['audio']); },
    VOICE_NAMES, validateVoiceLanguage,
    Deno: { env: { get: () => 'test' } }, crypto: webcrypto,
    ...overrides,
  };
  const source = read(`supabase/functions/${slug}/index.ts`).replace(/^import .*;\r?\n/gm, '');
  const compiled = await transform(source, { loader: 'ts', format: 'cjs' });
  new Function(...Object.keys(deps), compiled.code)(...Object.values(deps));
  return { request: body => captured(new Request('https://local.test', { method: 'POST', body: JSON.stringify(body) })), calls, charges: () => charges };
}

test('26 distinct approved presets and 74 language choices', () => {
  assert.equal(VOICE_NAMES.length, 26); assert.equal(new Set(VOICE_NAMES).size, 26);
  assert.equal(VOICE_LANGUAGES.length, 74);
  for (const code of ['fr', 'en', 'ja', 'hi', 'ar', 'es']) assert.equal(validateVoiceLanguage(code), code);
  assert.throws(() => validateVoiceLanguage('invented'), /Unsupported/);
});
test('real VoicePicker renders every voice and language', async () => {
  const source = read('src/components/studio/VoicePicker.jsx').replace(/^import .*;\r?\n/gm, '').replace('export default function', 'function');
  const compiled = await transform(source, { loader: 'jsx' });
  const Picker = new Function('React', 'VOICE_NAMES', 'VOICE_LANGUAGES', 'VoicePreviewButton', compiled.code + '\nreturn VoicePicker;')(React, VOICE_NAMES, VOICE_LANGUAGES, () => null);
  let selected;
  const tree = Picker({ value: 'Priyanka', onChange: value => { selected = value; }, language: 'fr', onLanguageChange() {} });
  const html = renderToStaticMarkup(tree);
  for (const voice of VOICE_NAMES) assert.ok(html.includes(`value="${voice}"`), voice);
  assert.ok(html.includes('value="fr" selected=""'));
  const flatten = node => !React.isValidElement(node) ? [] : [node, ...React.Children.toArray(node.props.children).flatMap(flatten)];
  const select = flatten(tree).find(node => node.type === 'select' && node.props['aria-label'] === 'Voice');
  select.props.onChange({ target: { value: 'Kuon' } }); assert.equal(selected, 'Kuon');
});
test('all tools mount the common picker, no truncated local lists remain', () => {
  for (const file of ['studio/AuthorProductionWorkspace.jsx', 'studio/StoryBlocks.jsx', 'studio/TextToSpeech.jsx', 'production/TimelineBlock.jsx', 'production/ProductionAssistantChat.jsx', 'admin/AdminAgentConfig.jsx', 'PersistentAIBar.jsx', 'pitch/PitchVoiceSelector.jsx']) {
    const source = read('src/components/' + file);
    assert.ok(source.includes('<VoicePicker'), file);
    assert.ok(!/const (?:VOICES|voices) = \[/.test(source), file);
  }
  assert.match(read('src/components/studio/AuthorProductionWorkspace.jsx'), /language_code: segment.narrator_language/);
  assert.match(read('src/hooks/usePitchVoiceReader.js'), /language_code: language/);
  assert.match(read('src/components/studio/StoryBlocks.jsx'), /narrator_language: narratorLanguage/);
});
test('generateSpeech accepts all 26 presets, sends language and both audio URL fields', async () => {
  const app = await handler('generateSpeech');
  for (const voice of VOICE_NAMES) {
    const response = await app.request({ text: 'Bonjour', voice, language_code: 'fr' });
    assert.equal(response.status, 200);
    const body = await response.json(); assert.equal(body.url, body.file_url);
    assert.equal(app.calls.at(-1).voice, voice); assert.equal(app.calls.at(-1).languageCode, 'fr');
  }
});
test('invalid voice/language rejected before simulated billing', async () => {
  const app = await handler('generateSpeech');
  assert.equal((await app.request({ text: 'Hello', voice: 'Unknown' })).status, 400);
  assert.equal((await app.request({ text: 'Hello', voice: 'Rachel', language_code: 'xx' })).status, 400);
  assert.equal(app.calls.length, 0); assert.equal(app.charges(), 0);
});
test('cached voice preview does not regenerate audio', async () => {
  const app = await handler('generateSpeech');
  assert.equal((await app.request({ voice: 'Priyanka', preview: true })).status, 200);
  assert.equal(app.calls.length, 0); assert.equal(app.charges(), 0);
});
test('regeneration accepts new voice and stored language', async () => {
  const app = await handler('regenerateNarration');
  assert.equal((await app.request({ block_id: 'block', voice: 'Kuon' })).status, 200);
  assert.equal(app.calls[0].voice, 'Kuon'); assert.equal(app.calls[0].languageCode, 'fr');
});
test('Pitch uses requested language and rejects unknown voices without fallback', async () => {
  const app = await handler('generatePitchSpeech');
  assert.equal((await app.request({ project_id: 'project', section_id: 'section', voice: 'Monika', language_code: 'hi' })).status, 200);
  assert.equal(app.calls[0].voice, 'Monika'); assert.equal(app.calls[0].languageCode, 'hi');
  assert.equal((await app.request({ project_id: 'project', section_id: 'section', voice: 'Unknown' })).status, 400);
  assert.equal(app.calls.length, 1);
});
test('automatic Story Blocks generation passes the saved language in both paths', () => {
  assert.equal((read('supabase/functions/generateBlockVideos/index.ts').match(/languageCode: session.narrator_language/g) || []).length, 2);
});

test('all five server bundles resolve their shared dependencies', async () => {
  for (const slug of ['generateSpeech', 'generatePitchSpeech', 'regenerateNarration', 'generateBlockVideos', 'generate-speech']) {
    await build({ entryPoints: [fileURLToPath(new URL(`../supabase/functions/${slug}/index.ts`, import.meta.url))], bundle: true, write: false, platform: 'neutral', format: 'esm', tsconfigRaw: {}, plugins: [{ name: 'read-local-deno-files', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => /^(npm:|node:|https:)/.test(args.path) ? { path: args.path, external: true } : { path: args.importer ? resolve(dirname(args.importer), args.path) : args.path, namespace: 'source' });
      builder.onLoad({ filter: /.*/, namespace: 'source' }, args => ({ contents: readFileSync(args.path, 'utf8'), loader: args.path.endsWith('.ts') ? 'ts' : 'js' }));
    } }] });
  }
});
