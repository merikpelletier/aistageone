import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { text, voice = 'Rachel' } = await req.json();
    if (!text?.trim()) return Response.json({ error: 'Text is required' }, { status: 400 });

    // Token check
    const toolPricing = await base44.entities.ToolPricing.filter({ tool_id: 'tts', is_active: true }).then(r => r[0]);
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

    const res = await base44.asServiceRole.integrations.Core.GenerateSpeech({
      text: text.slice(0, 5000),
      voice,
    });

    // Deduct tokens (admins skip)
    let newBalance = balance.balance;
    if (!isAdmin) {
      newBalance = balance.balance - tokenCost;
      await base44.entities.UserTokenBalance.update(balance.id, { balance: newBalance, last_updated: new Date().toISOString() });
      await base44.entities.TokenTransaction.create({ user_email: user.email, transaction_type: 'usage', token_amount: -tokenCost, balance_after: newBalance, related_entity: 'generateSpeech', created_at: new Date().toISOString() });
    }

    return Response.json({ file_url: res.url });
  } catch (error) {
    console.error('TTS error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
