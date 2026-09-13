import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const REPLICATE_API = 'https://api.replicate.com/v1';
// lucataco/video-audio-merge — supports replace_audio: false to MIX both tracks
const MODEL_VERSION = '8c3d57c9c9a1aaa05feabafbcd2dff9f68a5cb394e54ec020c1c2dcc42bde109';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const TOKEN = Deno.env.get('REPLICATE_API_TOKEN');
    if (!TOKEN) throw new Error('REPLICATE_API_TOKEN not set');

    const { audio_url, video_url } = await req.json();
    if (!audio_url || !video_url) {
      return Response.json({ error: 'audio_url and video_url required' }, { status: 400 });
    }

    // Token check
    const toolPricing = await base44.entities.ToolPricing.filter({ tool_id: 'dubbing', is_active: true }).then(r => r[0]);
    const tokenCost = toolPricing?.token_cost || 0;
    const adminEmail = (Deno.env.get('ADMIN_EMAIL') || '').toLowerCase().trim();
    const fullUser = await base44.asServiceRole.entities.User.filter({ email: user.email }).then(r => r[0]).catch(() => null);
    const isAdmin = (fullUser?.role || user.role) === 'admin' || (user.email || '').toLowerCase().trim() === adminEmail;
    let balance = await base44.entities.UserTokenBalance.filter({ user_email: user.email }).then(r => r[0]);
    if (!balance) {
      balance = await base44.entities.UserTokenBalance.create({ user_email: user.email, balance: 0, last_updated: new Date().toISOString() });
    }
    if (!isAdmin && balance.balance < tokenCost) {
      return Response.json({ error: 'Insufficient tokens', required: tokenCost, balance: balance.balance, message: `This tool requires ${tokenCost} tokens. Your balance: ${balance.balance} tokens.` }, { status: 402 });
    }

    // Start prediction: replace_audio=false means MIX voice on top of the original video audio
    const startRes = await fetch(`${REPLICATE_API}/predictions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        Prefer: 'wait=5',
      },
      body: JSON.stringify({
        version: MODEL_VERSION,
        input: {
          audio_file: audio_url,
          video_file: video_url,
          replace_audio: false,  // MIX voice with original audio instead of replacing it
          audio_volume: 1.0,
        },
      }),
    });

    let predData = await startRes.json();
    if (!startRes.ok) throw new Error(`Replicate error (${startRes.status}): ${predData.detail || JSON.stringify(predData)}`);

    // Poll until done
    for (let i = 0; i < 60; i++) {
      if (predData.status === 'succeeded') break;
      if (predData.status === 'failed' || predData.status === 'canceled') {
        throw new Error(`Prediction ${predData.status}: ${predData.error}`);
      }
      await new Promise(r => setTimeout(r, 5000));
      const pollRes = await fetch(`${REPLICATE_API}/predictions/${predData.id}`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      predData = await pollRes.json();
    }

    if (predData.status !== 'succeeded') throw new Error('Prediction timed out');

    const output = predData.output;
    const outputUrl = typeof output === 'string' ? output
      : (output?.url ? (typeof output.url === 'function' ? output.url() : output.url) : null)
      || (Array.isArray(output) ? output[0] : null);

    if (!outputUrl) throw new Error(`No URL in output: ${JSON.stringify(output)}`);

    // Download and re-upload to Base44 storage
    const mediaRes = await fetch(outputUrl);
    if (!mediaRes.ok) throw new Error(`Failed to fetch result: ${mediaRes.status}`);
    const blob = await mediaRes.blob();
    const file = new File([blob], 'voice_performance.mp4', { type: 'video/mp4' });
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    // Deduct tokens (admins skip)
    let newBalance = balance.balance;
    if (!isAdmin) {
      newBalance = balance.balance - tokenCost;
      await base44.entities.UserTokenBalance.update(balance.id, { balance: newBalance, last_updated: new Date().toISOString() });
      await base44.entities.TokenTransaction.create({ user_email: user.email, transaction_type: 'usage', token_amount: -tokenCost, balance_after: newBalance, related_entity: 'mixAudioVideo', created_at: new Date().toISOString() });
    }

    return Response.json({ file_url });
  } catch (error) {
    console.error('mixAudioVideo error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});