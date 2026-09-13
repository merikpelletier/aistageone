import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform, build } from 'esbuild';
import { webcrypto } from 'node:crypto';
import { AUDIO_TOOLS, audioInput, publicAudioJob } from '../supabase/functions/_shared/studioAudioInput.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => readFileSync(resolve(root, file), 'utf8');

test('music: three modes and strict limits', () => {
  assert.equal(audioInput('music', { mode: 'instrumental', prompt: 'Jazz' }).is_instrumental, true);
  assert.equal(audioInput('music', { mode: 'auto', prompt: 'Jazz' }).lyrics_optimizer, true);
  assert.equal(audioInput('music', { mode: 'lyrics', lyrics: 'Bonjour' }).lyrics, 'Bonjour');
  assert.throws(() => audioInput('music', { mode: 'lyrics' }), /lyrics/);
  assert.throws(() => audioInput('music', { mode: 'auto' }), /Describe/);
  assert.throws(() => audioInput('music', { mode: 'instrumental', prompt: 'a'.repeat(2001) }), /2000/);
  assert.throws(() => audioInput('music', { mode: 'lyrics', lyrics: 'a'.repeat(3501) }), /3500/);
});
test('Sound FX: prompt, duration, format', () => {
  assert.deepEqual(audioInput('sound_fx', { prompt: 'Rain', duration: 10, format: 'wav' }), { prompt: 'Rain', duration: 10, output_format: 'wav' });
  for (const duration of [0, 11, 'bad']) assert.throws(() => audioInput('sound_fx', { prompt: 'Rain', duration }));
  assert.throws(() => audioInput('sound_fx', { prompt: '' }));
  assert.throws(() => audioInput('sound_fx', { prompt: 'Rain', format: 'exe' }));
});
test('public response hides secrets, provider metadata and unfinished files', () => {
  const result = publicAudioJob({ id: 'a', callback_token: 'secret', input: {}, charge: { id: 'private', cost: 1 }, file_url: 'private', status: 'processing' });
  assert.equal(result.callback_token, undefined);
  assert.equal(result.charge, undefined);
  assert.equal(result.file_url, null);
  assert.equal(result.credit_cost, 1);
});

async function fixture({ unauthorized = false, postStatus = 201, uploadFails = false } = {}) {
  const rows = { studio_audio_job: [] };
  let posts = 0, charges = 0, completions = 0, refunds = 0, uploads = 0, providerStatus = 'processing', sent;
  const db = {
    from(table) {
      let filters = [], verb = 'select', values, single = false, claim = false;
      const q = {
        select() { return q; },
        eq(key, value) { filters.push(row => row[key] === value); return q; },
        in(key, values) { filters.push(row => values.includes(row[key])); return q; },
        or() { claim = true; return q; },
        order() { return q; }, limit() { return q; },
        insert(data) { verb = 'insert'; values = data; return q; },
        update(data) { verb = 'update'; values = data; return q; },
        single() { single = true; return q; }, maybeSingle() { single = true; return q; },
        then(resolve) {
          if (table !== 'studio_audio_job') return Promise.resolve({ data: { model_key: 'configured', enabled: true } }).then(resolve);
          let selected = rows[table].filter(row => filters.every(fn => fn(row)));
          if (claim) selected = selected.filter(row => ['processing', 'submitting'].includes(row.status));
          if (verb === 'insert') {
            if (rows[table].some(row => row.id === values.id)) return Promise.resolve({ error: { code: '23505' } }).then(resolve);
            const row = { ...values, created_at: new Date().toISOString() };
            rows[table].push(row); selected = [row];
          }
          if (verb === 'update') selected.forEach(row => Object.assign(row, values));
          return Promise.resolve({ data: structuredClone(single ? selected[0] || null : selected) }).then(resolve);
        },
      };
      return q;
    },
    rpc: async (name, args) => {
      assert.equal(name, 'refund_ai_credit_charge');
      assert.ok(args.p_error_message);
      refunds++;
      return { data: { ok: true } };
    },
    storage: { from: () => ({
      upload: async () => { uploads++; return uploadFails ? { error: new Error('storage unavailable') } : { data: {} }; },
      getPublicUrl: path => ({ data: { publicUrl: 'https://storage.test/' + path } }),
    }) },
  };
  const deps = {
    createClient: () => db,
    createCreditBillingContext: async () => {
      if (unauthorized) throw Object.assign(new Error('Unauthorized'), { status: 401 });
      return { service: db, user: { id: 'owner', email: 'owner@test' } };
    },
    reserveCredits: async () => { charges++; return { id: 'charge', cost: 1 }; },
    completeCreditCharge: async () => { completions++; },
    validateChoice: () => {}, adaptInput: input => input,
    AUDIO_TOOLS, audioInput, publicAudioJob, crypto: webcrypto,
    Deno: { env: { get: name => name === 'SUPABASE_URL' ? 'https://local.test' : 'test-token' } },
    fetch: async (url, options = {}) => {
      if (options.method === 'POST') {
        posts++; sent = JSON.parse(options.body);
        return Response.json({ id: 'prediction', status: 'processing' }, { status: postStatus });
      }
      if (String(url).includes('/predictions/')) return Response.json({ id: 'prediction', status: providerStatus, output: 'https://replicate.delivery/audio.mp3' });
      return new Response(new Blob(['audio']));
    },
  };
  const source = read('supabase/functions/_shared/studioAudio.ts').replace(/^import .*;\r?\n/gm, '');
  const compiled = await transform(source, { loader: 'ts', format: 'cjs' });
  const exports = {};
  const module = { exports };
  new Function('module', 'exports', ...Object.keys(deps), compiled.code)(module, exports, ...Object.values(deps));
  const handler = module.exports.audioHandler('music');
  return {
    rows, counts: () => ({ posts, charges, completions, refunds, uploads }), sent: () => sent,
    status: value => { providerStatus = value; },
    request: (body, suffix = '') => handler(new Request('https://local.test' + suffix, { method: 'POST', body: JSON.stringify(body) })),
  };
}
const requestBody = () => ({ id: webcrypto.randomUUID(), action: 'start', mode: 'instrumental', prompt: 'Jazz', format: 'mp3' });
test('unauthenticated caller cannot generate, list, or debit', async () => {
  const f = await fixture({ unauthorized: true });
  await assert.rejects(f.request(requestBody()), /Unauthorized/);
  await assert.rejects(f.request({ action: 'list' }), /Unauthorized/);
  assert.equal(f.counts().posts, 0);
  assert.equal(f.counts().charges, 0);
});
test('start, retry same ID, completion, durable file, no double billing', async () => {
  const f = await fixture(), body = requestBody();
  await f.request(body);
  await f.request(body);
  assert.equal(f.counts().posts, 1); assert.equal(f.counts().charges, 1);
  assert.ok(f.sent().webhook.includes('callback='));
  f.status('succeeded');
  const result = await (await f.request({ action: 'status', id: body.id })).json();
  assert.equal(result.job.status, 'succeeded');
  assert.match(result.job.file_url, /storage.test/);
  await f.request({ action: 'status', id: body.id });
  assert.equal(f.counts().completions, 1); assert.equal(f.counts().uploads, 1);
});
test('provider failure refunds without fallback', async () => {
  const f = await fixture(), body = requestBody();
  await f.request(body); f.status('failed');
  const result = await (await f.request({ action: 'status', id: body.id })).json();
  assert.equal(result.job.status, 'failed'); assert.equal(f.counts().refunds, 1); assert.equal(f.counts().posts, 1);
});
test('rejected start refunds; ambiguous server error never starts again', async () => {
  const rejected = await fixture({ postStatus: 422 }), body = requestBody();
  await rejected.request(body);
  assert.equal(rejected.counts().refunds, 1);
  const uncertain = await fixture({ postStatus: 503 }), another = requestBody();
  await assert.rejects(uncertain.request(another), /uncertain/);
  await uncertain.request(another);
  assert.equal(uncertain.counts().posts, 1);
  assert.equal(uncertain.counts().refunds, 0);
});
test('storage failure retains same prediction for recovery, not regeneration', async () => {
  const f = await fixture({ uploadFails: true }), body = requestBody();
  await f.request(body); f.status('succeeded');
  await assert.rejects(f.request({ action: 'status', id: body.id }), /storage/);
  assert.equal(f.rows.studio_audio_job[0].status, 'processing');
  assert.equal(f.counts().completions, 0); assert.equal(f.counts().posts, 1);
});
test('callback saves completed output without browser; wrong token denied', async () => {
  const f = await fixture(), body = requestBody();
  await f.request(body); f.status('succeeded');
  await assert.rejects(f.request({ id: 'prediction' }, '?callback=wrong'), /Unauthorized/);
  const token = f.rows.studio_audio_job[0].callback_token;
  await f.request({ id: 'prediction' }, '?callback=' + token);
  assert.equal(f.rows.studio_audio_job[0].status, 'succeeded');
});
test('another owner cannot read a job', async () => {
  const f = await fixture(), body = requestBody();
  await f.request(body);
  f.rows.studio_audio_job[0].user_id = 'someone-else';
  await assert.rejects(f.request({ action: 'status', id: body.id }), /not found/);
  assert.deepEqual((await (await f.request({ action: 'list' })).json()).jobs, []);
});
test('both functions bundle with all local imports; browser and migration contracts', async () => {
  for (const name of ['generateMusic', 'generateSoundFx']) {
    await build({
      entryPoints: [resolve(root, 'supabase/functions/' + name + '/index.ts')], bundle: true, write: false,
      platform: 'neutral', format: 'esm', tsconfigRaw: {},
      plugins: [{ name: 'read-source', setup(builder) {
        builder.onResolve({ filter: /^(npm:|node:|https:)/ }, args => ({ path: args.path, external: true }));
        builder.onResolve({ filter: /.*/ }, args => ({ path: args.importer ? resolve(dirname(args.importer), args.path) : args.path, namespace: 'source' }));
        builder.onLoad({ filter: /.*/, namespace: 'source' }, args => ({ contents: readFileSync(args.path, 'utf8'), loader: args.path.endsWith('.ts') ? 'ts' : 'js' }));
      } }],
    });
  }
  const ui = read('src/components/studio/StudioAudioTool.jsx');
  for (const text of ['Save to Vault', 'Download', '<audio', 'crypto.randomUUID()', "action: 'status'"]) assert.ok(ui.includes(text));
  const sql = read('supabase/migrations/20260909211206_studio_audio_tools.sql');
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all .* from public, anon, authenticated/);
  assert.match(sql, /on conflict \(route_key\) do nothing/);
});
