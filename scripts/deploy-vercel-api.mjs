import { createHash } from 'node:crypto';
import dns from 'node:dns';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import https from 'node:https';
import { createRequire } from 'node:module';
import { basename, join, relative, resolve } from 'node:path';

dns.setDefaultResultOrder('ipv4first');

const projectRoot = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const distRoot = join(projectRoot, 'dist');
const projectId = 'prj_deYBjvVQdSDYLzwtzzIxEWWKbzSN';
const teamId = 'team_kK460pzf9l4meSOStD8Q2YO0';
const projectName = 'aistage-one';

if (!existsSync(join(distRoot, 'index.html'))) throw new Error('dist/index.html is missing; run the validated build first.');

const npxBase = join(process.env.LOCALAPPDATA, 'npm-cache', '_npx');
const cliRoots = readdirSync(npxBase, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => join(npxBase, entry.name, 'node_modules'))
  .filter(root => existsSync(join(root, '@vercel', 'cli-auth', 'credentials-store.js')))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);

if (cliRoots.length === 0) throw new Error('The authenticated Vercel CLI runtime was not found.');
const nodeModulesRoot = cliRoots[0];
const require = createRequire(join(nodeModulesRoot, 'vercel', 'package.json'));
const { readCliAuthConfig, persistCliAuthConfig } = require(join(nodeModulesRoot, '@vercel', 'cli-auth', 'credentials-store.js'));
const cliConfig = require(join(nodeModulesRoot, '@vercel', 'cli-config'));
const globalConfigPath = cliConfig.getGlobalPathConfig();
const authConfig = readCliAuthConfig(globalConfigPath);

const request = (url, { method = 'GET', headers = {}, body } = {}) => new Promise((resolveRequest, reject) => {
  const target = new URL(url);
  const req = https.request(target, { method, headers }, response => {
    const chunks = [];
    response.on('data', chunk => chunks.push(chunk));
    response.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const text = buffer.toString('utf8');
      let json = null;
      if (text) {
        try { json = JSON.parse(text); } catch { json = null; }
      }
      resolveRequest({ status: response.statusCode || 0, headers: response.headers, buffer, text, json });
    });
  });
  req.setTimeout(30_000, () => req.destroy(new Error(`Request timed out: ${target.hostname}`)));
  req.on('error', reject);
  if (body) req.write(body);
  req.end();
});

const requireSuccess = (response, label, accepted = [200, 201]) => {
  if (!accepted.includes(response.status)) {
    throw new Error(`${label} failed (${response.status}): ${response.text.slice(0, 2000)}`);
  }
  return response;
};

let accessToken = null;
if (authConfig.refreshToken) {
  const discovery = requireSuccess(await request('https://vercel.com/.well-known/openid-configuration'), 'Vercel OAuth discovery');
  const tokenEndpoint = discovery.json?.token_endpoint;
  if (!tokenEndpoint) throw new Error('Vercel OAuth discovery returned no token endpoint.');
  const form = new URLSearchParams({
    client_id: 'cl_HYyOPBNtFMfHhaUn9L4QPfTZz6TP47bp',
    grant_type: 'refresh_token',
    refresh_token: authConfig.refreshToken,
  }).toString();
  const tokenResponse = requireSuccess(await request(tokenEndpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'content-length': Buffer.byteLength(form),
      'user-agent': 'AISTAGE.ONE deployment recovery',
    },
    body: form,
  }), 'Vercel token refresh');
  accessToken = tokenResponse.json?.access_token;
  if (!accessToken) throw new Error('Vercel returned no access token.');
  if (tokenResponse.json?.refresh_token) {
    persistCliAuthConfig(globalConfigPath, { ...authConfig, refreshToken: tokenResponse.json.refresh_token });
  }
} else {
  accessToken = authConfig.token;
}
if (!accessToken) throw new Error('No usable Vercel session is stored on this computer.');

const collectFiles = directory => {
  const collected = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collected.push(...collectFiles(path));
    else collected.push(path);
  }
  return collected;
};

const sourceFiles = collectFiles(distRoot).map(path => ({
  file: relative(distRoot, path).replaceAll('\\', '/'),
  data: readFileSync(path),
}));
const routingConfig = JSON.parse(readFileSync(join(projectRoot, 'vercel.json'), 'utf8'));
delete routingConfig.$schema;
delete routingConfig.framework;
sourceFiles.push({ file: 'vercel.json', data: Buffer.from(JSON.stringify(routingConfig)) });

const deploymentFiles = [];
for (const source of sourceFiles) {
  const sha = createHash('sha1').update(source.data).digest('hex');
  const upload = await request(`https://api.vercel.com/v2/now/files?teamId=${encodeURIComponent(teamId)}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/octet-stream',
      'content-length': source.data.length,
      'x-vercel-digest': sha,
    },
    body: source.data,
  });
  requireSuccess(upload, `Upload ${basename(source.file)}`, [200, 201, 409]);
  deploymentFiles.push({ file: source.file, sha, size: source.data.length });
}

const deploymentPayload = JSON.stringify({
  name: projectName,
  project: projectId,
  target: 'production',
  files: deploymentFiles,
  projectSettings: {
    framework: null,
    buildCommand: '',
    installCommand: '',
    outputDirectory: '.',
  },
});
const create = requireSuccess(await request(`https://api.vercel.com/v13/deployments?forceNew=1&teamId=${encodeURIComponent(teamId)}`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${accessToken}`,
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(deploymentPayload),
  },
  body: deploymentPayload,
}), 'Create Vercel production deployment');

const deploymentId = create.json?.id;
let deploymentUrl = create.json?.url;
if (!deploymentId || !deploymentUrl) throw new Error(`Vercel returned an incomplete deployment response: ${create.text.slice(0, 1000)}`);

let state = create.json?.readyState || create.json?.status;
for (let attempt = 0; attempt < 60 && !['READY', 'ERROR', 'CANCELED'].includes(state); attempt += 1) {
  await new Promise(resolveDelay => setTimeout(resolveDelay, 2000));
  const status = requireSuccess(await request(`https://api.vercel.com/v13/deployments/${encodeURIComponent(deploymentId)}?teamId=${encodeURIComponent(teamId)}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  }), 'Read Vercel deployment status');
  state = status.json?.readyState || status.json?.status;
  deploymentUrl = status.json?.url || deploymentUrl;
}

accessToken = null;
if (state !== 'READY') throw new Error(`Vercel deployment ${deploymentId} ended with state ${state || 'unknown'}.`);
console.log(`DEPLOYED:https://${deploymentUrl}`);
