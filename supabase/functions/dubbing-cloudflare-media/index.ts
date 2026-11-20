import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    const apiToken = Deno.env.get('CLOUDFLARE_STREAM_API_TOKEN');
    if (!accountId || !apiToken) return json({ error: 'Cloudflare Stream not configured' }, 500);
    const authorization = req.headers.get('Authorization') || '';
    const scoped = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: { user }, error: authError } = await scoped.auth.getUser();
    if (authError || !user) return json({ error: 'Authentication required' }, 401);
    const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const body = await req.json();
    const action = body.action;
    if (action !== 'prepare' && action !== 'output_status') return json({ error: 'Unsupported action' }, 422);

    let asset;
    if (action === 'prepare') {
      const playbackUrl = typeof body.video_url === 'string' ? body.video_url : '';
      if (!playbackUrl || playbackUrl.length > 2048) return json({ error: 'Video URL required' }, 422);
      const { data, error } = await service.from('video_asset')
        .select('id,provider_video_id,status')
        .eq('owner_id', user.id).eq('provider', 'cloudflare_stream')
        .eq('playback_url', playbackUrl).maybeSingle();
      if (error || !data) return json({ error: 'Video not found in your Cloudflare library' }, 404);
      asset = data;
    } else {
      const assetId = typeof body.asset_id === 'string' ? body.asset_id : '';
      if (!/^[0-9a-f-]{36}$/i.test(assetId)) return json({ error: 'Valid output asset ID required' }, 422);
      const { data, error } = await service.from('video_asset')
        .select('id,provider_video_id,status,playback_url')
        .eq('id', assetId).eq('owner_id', user.id).eq('provider', 'cloudflare_stream')
        .eq('source_type', 'dubbing_output').maybeSingle();
      if (error || !data) return json({ error: 'Output video not found' }, 404);
      asset = data;
    }
    const uid = asset.provider_video_id;
    if (!uid || !/^[a-f0-9]{32}$/i.test(uid)) return json({ error: 'Invalid Cloudflare video identifier' }, 422);
    const headers = { Authorization: `Bearer ${apiToken}` };

    if (action === 'prepare') {
      const downloadEndpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}/downloads`;
      let response = await fetch(downloadEndpoint, { headers });
      let payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) return json({ error: payload?.errors?.[0]?.message || 'Cloudflare MP4 status unavailable' }, 502);
      if (!payload.result?.default) {
        response = await fetch(downloadEndpoint, { method: 'POST', headers });
        payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) return json({ error: payload?.errors?.[0]?.message || 'Cloudflare MP4 preparation failed' }, 502);
      }
      const download = payload.result?.default;
      if (download?.status === 'error') return json({ error: 'Cloudflare MP4 processing failed' }, 502);
      return json({ status: download?.status === 'ready' && download?.url ? 'ready' : 'processing', mp4_url: download?.status === 'ready' ? download.url : null });
    }

    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}`, { headers });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success || !payload.result) return json({ error: 'Cloudflare output video status unavailable' }, 502);
    const video = payload.result;
    if (video.status?.state === 'error') return json({ error: video.status?.errorReasonText || 'Cloudflare video processing failed' }, 502);
    if (!video.readyToStream) return json({ status: 'processing' });
    const playbackUrl = video.playback?.hls;
    if (!playbackUrl) return json({ error: 'Cloudflare playback URL missing' }, 502);
    const { error: updateError } = await service.from('video_asset').update({
      status: 'ready', playback_url: playbackUrl, duration_seconds: video.duration || null, updated_at: new Date().toISOString(),
    }).eq('id', asset.id).eq('owner_id', user.id);
    if (updateError) return json({ error: updateError.message }, 500);

    // Return an actual downloadable MP4, not an HLS playlist.
    const downloadEndpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}/downloads`;
    let list = await fetch(downloadEndpoint, { headers });
    let listed = await list.json().catch(() => null);
    if (!list.ok || !listed?.success) return json({ error: 'Dubbed MP4 status unavailable' }, 502);
    if (!listed.result?.default) {
      list = await fetch(downloadEndpoint, { method: 'POST', headers });
      listed = await list.json().catch(() => null);
      if (!list.ok || !listed?.success) return json({ error: listed?.errors?.[0]?.message || 'Could not prepare dubbed MP4' }, 502);
    }
    const download = listed.result?.default;
    if (download?.status === 'error') return json({ error: 'Cloudflare dubbed MP4 processing failed' }, 502);
    return json({
      status: download?.status === 'ready' && download?.url ? 'ready' : 'processing',
      file_url: download?.status === 'ready' ? download.url : null,
      stream_url: playbackUrl,
    });
  } catch (error) {
    console.error('dubbing-cloudflare-media:', error);
    return json({ error: error instanceof Error ? error.message : 'Cloudflare error' }, 500);
  }
});
