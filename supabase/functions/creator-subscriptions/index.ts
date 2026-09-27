import { createClient } from 'npm:@supabase/supabase-js@2';
import { serveWithCors } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') || '';
const appUrl = (Deno.env.get('APP_URL') || 'https://aistage.one').replace(/\/$/, '');
const platformFeePercent = Number(Deno.env.get('CREATOR_SUBSCRIPTION_PLATFORM_FEE_PERCENT') || '');

async function stripeRequest(path: string, options: {
  method?: string;
  body?: URLSearchParams | Record<string, unknown>;
  account?: string;
  v2?: boolean;
} = {}) {
  if (!stripeSecret) throw new Error('Stripe is not configured yet');
  const headers: Record<string, string> = {
    Authorization: `Bearer ${stripeSecret}`,
  };
  if (options.account) headers['Stripe-Account'] = options.account;
  let body: BodyInit | undefined;
  if (options.v2) {
    headers['Content-Type'] = 'application/json';
    headers['Stripe-Version'] = '2026-08-26.dahlia';
    body = JSON.stringify(options.body || {});
  } else if (options.body) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = options.body instanceof URLSearchParams ? options.body : new URLSearchParams(
      Object.entries(options.body).map(([key, value]) => [key, String(value)])
    );
  }
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: options.method || 'POST',
    headers,
    body,
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error?.message || json?.message || 'Stripe request failed');
  return json;
}

serveWithCors(async (req) => {
  const scoped = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    auth: { persistSession: false },
  });
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: authData } = await scoped.auth.getUser();
  const user = authData.user;
  if (!user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await req.json();
  const action = payload?.action;

  if (action === 'get-plan') {
    const creatorEmail = String(payload.creator_email || user.email).toLowerCase();
    const { data: plan } = await service.from('creator_subscription_plan')
      .select('*').eq('creator_email', creatorEmail).maybeSingle();
    return Response.json({ plan: plan || null });
  }

  if (action === 'save-plan') {
    const annualPriceCents = Math.round(Number(payload.annual_price_cents));
    if (!Number.isFinite(annualPriceCents) || annualPriceCents < 100) {
      return Response.json({ error: 'Annual price must be at least 1.00' }, { status: 400 });
    }
    const { data, error } = await service.from('creator_subscription_plan').upsert({
      creator_id: user.id,
      creator_email: user.email.toLowerCase(),
      annual_price_cents: annualPriceCents,
      currency: String(payload.currency || 'cad').toLowerCase(),
      active: Boolean(payload.active),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'creator_id' }).select('*').single();
    if (error) throw error;
    return Response.json({ plan: data });
  }

  if (action === 'connect-onboarding') {
    const { data: profile } = await service.from('member_profile')
      .select('display_name').eq('user_email', user.email).maybeSingle();
    let { data: plan } = await service.from('creator_subscription_plan')
      .select('*').eq('creator_id', user.id).maybeSingle();

    let accountId = plan?.stripe_account_id || null;

    if (!accountId) {
      const account = await stripeRequest('/v2/core/accounts', {
        v2: true,
        body: {
          contact_email: user.email,
          display_name: profile?.display_name || user.user_metadata?.full_name || user.email,
          configuration: {
            merchant: {
              capabilities: {
                card_payments: { requested: true }
              }
            }
          },
          defaults: {
            responsibilities: {
              fees_collector: 'stripe',
              losses_collector: 'stripe'
            }
          },
          dashboard: 'full',
          metadata: {
            aistage_creator_id: user.id,
            aistage_creator_email: user.email
          },
          include: ['configuration.merchant', 'defaults', 'requirements']
        }
      });
      accountId = account.id;
      const { data, error } = await service.from('creator_subscription_plan').upsert({
        creator_id: user.id,
        creator_email: user.email.toLowerCase(),
        annual_price_cents: plan?.annual_price_cents || 0,
        currency: plan?.currency || 'cad',
        active: false,
        stripe_account_id: accountId,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'creator_id' }).select('*').single();
      if (error) throw error;
      plan = data;
    }

    const params = new URLSearchParams();
    params.set('account', accountId);
    params.set('refresh_url', `${appUrl}/MemberDashboard?stripe=refresh`);
    params.set('return_url', `${appUrl}/MemberDashboard?stripe=return`);
    params.set('type', 'account_onboarding');
    params.set('collection_options[fields]', 'eventually_due');
    const link = await stripeRequest('/v1/account_links', { body: params });
    return Response.json({ url: link.url });
  }

  if (action === 'connect-status') {
    const { data: plan } = await service.from('creator_subscription_plan')
      .select('*').eq('creator_id', user.id).maybeSingle();
    if (!plan?.stripe_account_id) return Response.json({ plan: plan || null });

    const response = await fetch(
      `https://api.stripe.com/v2/core/accounts/${encodeURIComponent(plan.stripe_account_id)}?include[]=configuration.merchant&include[]=requirements&include[]=defaults`,
      {
        headers: {
          Authorization: `Bearer ${stripeSecret}`,
          'Stripe-Version': '2026-08-26.dahlia'
        }
      }
    );
    const account = await response.json();
    if (!response.ok) throw new Error(account?.error?.message || account?.message || 'Unable to read Stripe account');

    const cardStatus = account?.configuration?.merchant?.capabilities?.card_payments?.status;
    const payoutStatus = account?.configuration?.merchant?.capabilities?.stripe_balance?.payouts?.status;
    const requirementsStatus = account?.requirements?.summary?.minimum_deadline?.status;
    const ready = cardStatus === 'active' && payoutStatus === 'active';

    const { data: updated, error } = await service.from('creator_subscription_plan').update({
      stripe_details_submitted: requirementsStatus !== 'currently_due' && requirementsStatus !== 'past_due',
      stripe_charges_enabled: cardStatus === 'active',
      stripe_payouts_enabled: payoutStatus === 'active',
      active: Boolean(plan.active && ready),
      updated_at: new Date().toISOString(),
    }).eq('id', plan.id).select('*').single();
    if (error) throw error;
    return Response.json({ plan: updated, stripe: { card_status: cardStatus, payout_status: payoutStatus, requirements_status: requirementsStatus } });
  }

  if (action === 'subscription-status') {
    const creatorEmail = String(payload.creator_email || '').toLowerCase();
    if (!creatorEmail) return Response.json({ error: 'Missing creator_email' }, { status: 400 });
    const { data: subscription } = await service.from('creator_subscription')
      .select('*')
      .eq('subscriber_id', user.id)
      .eq('creator_email', creatorEmail)
      .in('status', ['active', 'trialing'])
      .gt('current_period_end', new Date().toISOString())
      .maybeSingle();
    return Response.json({ subscription: subscription || null, active: Boolean(subscription) });
  }

  if (action === 'checkout') {
    const creatorEmail = String(payload.creator_email || '').toLowerCase();
    if (!creatorEmail) return Response.json({ error: 'Missing creator_email' }, { status: 400 });
    if (creatorEmail === user.email.toLowerCase()) {
      return Response.json({ error: 'You cannot subscribe to yourself' }, { status: 400 });
    }
    if (!Number.isFinite(platformFeePercent) || platformFeePercent < 0 || platformFeePercent > 100) {
      return Response.json({ error: 'Platform subscription fee is not configured yet' }, { status: 503 });
    }

    const { data: plan } = await service.from('creator_subscription_plan')
      .select('*').eq('creator_email', creatorEmail).eq('active', true).maybeSingle();
    if (!plan?.stripe_account_id || !plan.stripe_charges_enabled) {
      return Response.json({ error: 'This creator is not ready to accept subscriptions yet' }, { status: 400 });
    }

    const params = new URLSearchParams();
    params.set('mode', 'subscription');
    params.set('success_url', `${appUrl}/MemberDashboard?email=${encodeURIComponent(creatorEmail)}&subscription=success`);
    params.set('cancel_url', `${appUrl}/MemberDashboard?email=${encodeURIComponent(creatorEmail)}&subscription=cancelled`);
    params.set('customer_email', user.email);
    params.set('line_items[0][quantity]', '1');
    params.set('line_items[0][price_data][currency]', plan.currency || 'cad');
    params.set('line_items[0][price_data][unit_amount]', String(plan.annual_price_cents));
    params.set('line_items[0][price_data][recurring][interval]', 'year');
    params.set('line_items[0][price_data][product_data][name]', 'Annual creator subscription');
    params.set('line_items[0][price_data][product_data][description]', `Annual access to subscriber content from ${creatorEmail}`);
    params.set('subscription_data[application_fee_percent]', String(platformFeePercent));
    params.set('subscription_data[metadata][aistage_creator_id]', plan.creator_id);
    params.set('subscription_data[metadata][aistage_creator_email]', creatorEmail);
    params.set('subscription_data[metadata][aistage_subscriber_id]', user.id);
    params.set('subscription_data[metadata][aistage_subscriber_email]', user.email);
    params.set('metadata[aistage_creator_id]', plan.creator_id);
    params.set('metadata[aistage_creator_email]', creatorEmail);
    params.set('metadata[aistage_subscriber_id]', user.id);
    params.set('metadata[aistage_subscriber_email]', user.email);

    const session = await stripeRequest('/v1/checkout/sessions', {
      body: params,
      account: plan.stripe_account_id
    });

    await service.from('creator_subscription').upsert({
      subscriber_id: user.id,
      subscriber_email: user.email.toLowerCase(),
      creator_id: plan.creator_id,
      creator_email: creatorEmail,
      stripe_account_id: plan.stripe_account_id,
      stripe_checkout_session_id: session.id,
      status: 'incomplete',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'subscriber_id,creator_id' });

    return Response.json({ url: session.url });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
});
