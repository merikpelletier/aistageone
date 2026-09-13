import { createClient } from 'npm:@supabase/supabase-js@2';
import { serveWithCors } from '../_shared/cors.ts';

serveWithCors(async (req) => {
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const authorization = req.headers.get('Authorization') || '';
    const scoped = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: authorization ? { Authorization: authorization } : {} },
      auth: { persistSession: false },
    });
    const { data: authData, error: authError } = await scoped.auth.getUser();
    const authUser = authData.user;
    if (authError || !authUser?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = { id: authUser.id, email: authUser.email };

    const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });
    const { data: balances, error: balanceError } = await service
      .from('user_token_balance')
      .select('balance,last_updated')
      .ilike('user_email', user.email)
      .limit(1);
    if (balanceError) throw balanceError;

    let balance = balances?.[0];
    if (!balance) {
      const { data: created, error: createError } = await service
        .from('user_token_balance')
        .insert({
          user_email: user.email,
          created_by_id: user.id,
          created_by: user.email,
          balance: 0,
          last_updated: new Date().toISOString(),
        })
        .select('balance,last_updated')
        .single();
      if (createError) throw createError;
      balance = created;
    }

    const { data: packages, error: packageError } = await service
      .from('token_package')
      .select('*')
      .eq('is_active', true)
      .order('order', { ascending: true });
    if (packageError) throw packageError;

    return Response.json({
      balance: Number(balance.balance || 0),
      last_updated: balance.last_updated,
      packages: packages || [],
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : (typeof error === 'object' ? JSON.stringify(error) : String(error));
    console.error('getUserBalance error:', message);
    return Response.json({ error: message }, { status: 500 });
  }
});
