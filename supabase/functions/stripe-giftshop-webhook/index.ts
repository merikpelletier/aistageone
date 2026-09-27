import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const webhookSecret = Deno.env.get('STRIPE_GIFTSHOP_WEBHOOK_SECRET') || '';

function hex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyStripeSignature(payload: string, signature: string) {
  if (!webhookSecret) throw new Error('Stripe webhook secret is not configured');

  const pairs = signature.split(',').map((part) => part.split('='));
  const timestamp = pairs.find(([key]) => key === 't')?.[1];
  const signatures = pairs.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!timestamp || signatures.length === 0) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`),
  );
  const actual = hex(digest);

  return signatures.some((expected) => {
    if (!expected || expected.length !== actual.length) return false;
    let mismatch = 0;
    for (let i = 0; i < actual.length; i++) mismatch |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
    return mismatch === 0;
  });
}

function money(cents: unknown) {
  const value = Number(cents || 0);
  return Number.isFinite(value) ? value / 100 : 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const payload = await req.text();
    const signature = req.headers.get('stripe-signature') || '';
    if (!(await verifyStripeSignature(payload, signature))) {
      return new Response('Invalid signature', { status: 400 });
    }

    const event = JSON.parse(payload);
    if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') {
      return Response.json({ received: true });
    }

    const session = event.data?.object || {};
    if (session.payment_status !== 'paid' && event.type !== 'checkout.session.async_payment_succeeded') {
      return Response.json({ received: true });
    }

    const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    if (session.metadata?.product_placement === 'true') {
      const requestId = session.metadata?.product_placement_request_id || session.client_reference_id;
      if (!requestId) throw new Error('Missing Product Placement request reference');

      const { error } = await service.rpc('complete_product_placement_stripe', {
        p_request_id: requestId,
        p_stripe_checkout_session_id: session.id,
        p_stripe_payment_intent_id: session.payment_intent || null,
        p_subtotal: money(session.amount_subtotal),
        p_tax_amount: money(session.total_details?.amount_tax),
        p_total_amount: money(session.amount_total),
        p_currency: String(session.currency || 'cad').toUpperCase(),
      });
      if (error) throw error;

      return Response.json({ received: true, product_placement_request_id: requestId });
    }

    if (session.metadata?.gift_shop !== 'true') {
      return Response.json({ received: true });
    }

    const checkoutSessionId = session.metadata?.checkout_session_id || session.client_reference_id;
    if (!checkoutSessionId) throw new Error('Missing Gift Shop checkout session reference');

    const { data: checkoutRows, error: checkoutError } = await service.rpc(
      'gift_shop_get_checkout_session',
      { p_id: checkoutSessionId },
    );
    if (checkoutError) throw checkoutError;

    const checkout = Array.isArray(checkoutRows) ? checkoutRows[0] : checkoutRows;
    if (!checkout) throw new Error('Gift Shop checkout session not found');

    const customerDetails = session.customer_details || {};
    const shippingDetails = session.collected_information?.shipping_details || session.shipping_details || {};
    const shippingAddress = shippingDetails.address || customerDetails.address || {};
    const subtotal = money(session.amount_subtotal);
    const total = money(session.amount_total);
    const taxTotal = money(session.total_details?.amount_tax);
    const shipping = money(session.total_details?.amount_shipping);

    const taxBreakdown = [{
      source: checkout.payment_mode === 'stripe_managed_payments' ? 'managed_payments' : 'stripe_tax',
      amount: taxTotal,
      currency: String(session.currency || 'cad').toUpperCase(),
    }];

    const { data: orderId, error: orderError } = await service.rpc(
      'gift_shop_complete_stripe_order',
      {
        p_checkout_session_id: checkoutSessionId,
        p_stripe_checkout_session_id: session.id,
        p_order_id: session.payment_intent || session.id,
        p_items: checkout.cart || [],
        p_subtotal: subtotal,
        p_tax_total: taxTotal,
        p_shipping: shipping,
        p_total: total,
        p_customer_email: customerDetails.email || checkout.user_email || '',
        p_customer_name: customerDetails.name || shippingDetails.name || '',
        p_shipping_address: {
          name: shippingDetails.name || customerDetails.name || '',
          line1: shippingAddress.line1 || '',
          line2: shippingAddress.line2 || '',
          city: shippingAddress.city || '',
          state: shippingAddress.state || '',
          postal_code: shippingAddress.postal_code || '',
          country: shippingAddress.country || '',
        },
        p_tax_breakdown: taxBreakdown,
      },
    );
    if (orderError) throw orderError;

    return Response.json({ received: true, order_id: orderId });
  } catch (error) {
    console.error('Stripe commerce webhook error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
});
