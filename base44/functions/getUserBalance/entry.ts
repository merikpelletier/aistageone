import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's token balance
    let balance = await base44.entities.UserTokenBalance.filter({ user_email: user.email }).then(r => r[0]);
    
    if (!balance) {
      balance = await base44.entities.UserTokenBalance.create({
        user_email: user.email,
        balance: 0,
        last_updated: new Date().toISOString()
      });
    }

    // Get active token packages
    const packages = await base44.entities.TokenPackage.filter({ is_active: true });

    return Response.json({
      balance: balance.balance,
      last_updated: balance.last_updated,
      packages: packages.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});