import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const webhookSecret = Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET') || '';

function hex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyStripeSignature(payload: string, signature: string) {
  if (!webhookSecret) throw new Error('Stripe webhook secret is not configured');
  const parts = Object.fromEntries(signature.split(',').map(part => {
    const [k, v] = part.split('=');
    return [k, v];
  }));
  const timestamp = parts.t;
  const expected = parts.v1;
  if (!timestamp || !expected) return false;
  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const actual = hex(digest);
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < actual.length; i++) mismatch |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const payload = await req.text();
  const signature = req.headers.get('stripe-signature') || '';
  if (!(await verifyStripeSignature(payload, signature))) {
    return new Response('Invalid signature', { status: 400 });
  }

  const event = JSON.parse(payload);
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const accountId = event.account || null;
  const object = event.data?.object || {};
  const metadata = object.metadata || {};

  if (event.type === 'checkout.session.completed') {
    const creatorId = metadata.aistage_creator_id;
    const creatorEmail = metadata.aistage_creator_email;
    const subscriberId = metadata.aistage_subscriber_id;
    const subscriberEmail = metadata.aistage_subscriber_email;
    if (creatorId && creatorEmail && subscriberId && subscriberEmail) {
      await service.from('creator_subscription').upsert({
        subscriber_id: subscriberId,
        subscriber_email: subscriberEmail.toLowerCase(),
        creator_id: creatorId,
        creator_email: creatorEmail.toLowerCase(),
        stripe_account_id: accountId,
        stripe_checkout_session_id: object.id,
        stripe_subscription_id: object.subscription || null,
        stripe_customer_id: object.customer || null,
        status: object.payment_status === 'paid' ? 'active' : 'incomplete',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'subscriber_id,creator_id' });
    }
  }

  if (
    event.type === 'customer.subscription.created' ||
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted'
  ) {
    const creatorId = metadata.aistage_creator_id;
    const creatorEmail = metadata.aistage_creator_email;
    const subscriberId = metadata.aistage_subscriber_id;
    const subscriberEmail = metadata.aistage_subscriber_email;
    if (creatorId && creatorEmail && subscriberId && subscriberEmail) {
      const periodEnd = object.current_period_end
        ? new Date(object.current_period_end * 1000).toISOString()
        : null;
      await service.from('creator_subscription').upsert({
        subscriber_id: subscriberId,
        subscriber_email: subscriberEmail.toLowerCase(),
        creator_id: creatorId,
        creator_email: creatorEmail.toLowerCase(),
        stripe_account_id: accountId,
        stripe_subscription_id: object.id,
        stripe_customer_id: object.customer || null,
        status: object.status || 'incomplete',
        current_period_end: periodEnd,
        cancel_at_period_end: Boolean(object.cancel_at_period_end),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'subscriber_id,creator_id' });
    }
  }

  if (event.type === 'account.updated') {
    const creatorId = object.metadata?.aistage_creator_id;
    if (creatorId) {
      const cardStatus = object.configuration?.merchant?.capabilities?.card_payments?.status;
      const payoutStatus = object.configuration?.merchant?.capabilities?.stripe_balance?.payouts?.status;
      const requirementsStatus = object.requirements?.summary?.minimum_deadline?.status;
      await service.from('creator_subscription_plan').update({
        stripe_details_submitted: requirementsStatus !== 'currently_due' && requirementsStatus !== 'past_due',
        stripe_charges_enabled: cardStatus === 'active',
        stripe_payouts_enabled: payoutStatus === 'active',
        updated_at: new Date().toISOString(),
      }).eq('creator_id', creatorId);
    }
  }

  return Response.json({ received: true });
});
