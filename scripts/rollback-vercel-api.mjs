import dns from 'node:dns';
import https from 'node:https';

dns.setDefaultResultOrder('ipv4first');

const projectId = 'prj_deYBjvVQdSDYLzwtzzIxEWWKbzSN';
const teamId = 'team_kK460pzf9l4meSOStD8Q2YO0';
const deploymentId = 'dpl_55Zs4eRMiJah6vKEaj4T4phWXzGn';

const authConfig = JSON.parse(process.env.AISTAGE_VERCEL_AUTH_JSON || '{}');

const request = (url, { method = 'GET', headers = {}, body } = {}) => new Promise((resolve, reject) => {
  const target = new URL(url);
  const req = https.request(target, { method, headers }, (response) => {
    const chunks = [];
    response.on('data', (chunk) => chunks.push(chunk));
    response.on('end', () => resolve({ status: response.statusCode || 0, text: Buffer.concat(chunks).toString('utf8') }));
  });
  req.setTimeout(30_000, () => req.destroy(new Error('La requête Vercel a expiré.')));
  req.on('error', reject);
  if (body) req.write(body);
  req.end();
});

let accessToken = authConfig.token || null;
if (authConfig.refreshToken) {
  const discovery = await request('https://vercel.com/.well-known/openid-configuration');
  if (discovery.status !== 200) throw new Error(`Découverte OAuth refusée (${discovery.status}).`);
  const endpoint = JSON.parse(discovery.text).token_endpoint;
  const form = new URLSearchParams({
    client_id: 'cl_HYyOPBNtFMfHhaUn9L4QPfTZz6TP47bp',
    grant_type: 'refresh_token',
    refresh_token: authConfig.refreshToken,
  }).toString();
  const refreshed = await request(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': Buffer.byteLength(form) },
    body: form,
  });
  if (refreshed.status !== 200) throw new Error(`Rafraîchissement Vercel refusé (${refreshed.status}).`);
  const tokens = JSON.parse(refreshed.text);
  accessToken = tokens.access_token;
}

if (!accessToken) throw new Error('Aucun accès Vercel utilisable.');
const response = await request(`https://api.vercel.com/v1/projects/${projectId}/rollback/${deploymentId}?teamId=${teamId}`, {
  method: 'POST',
  headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json', 'content-length': 2 },
  body: '{}',
});
accessToken = null;
if (![200, 201, 202].includes(response.status)) throw new Error(`Restauration refusée (${response.status}): ${response.text.slice(0, 600)}`);
console.log('RESTORED:https://aistage-one.vercel.app');
