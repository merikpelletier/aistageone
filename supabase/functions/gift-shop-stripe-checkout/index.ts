import Stripe from 'npm:stripe@18.5.0';
import { createClientFromRequest } from '../_shared/base44Compat.ts';
import { serveWithCors } from '../_shared/cors.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2025-06-30.basil',
});

const allowedCountries = [
  'US','CA','GB','FR','BE','CH','DE','ES','IT','NL','PT','IE','AT','DK','SE','NO','FI',
  'AU','NZ','JP','SG','MX','BR'
];

function parsePrice(value: unknown) {
  const n = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

serveWithCors(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { cart } = await req.json();
  if (!Array.isArray(cart) || cart.length === 0) {
    return Response.json({ error: 'Cart is empty' }, { status: 400 });
  }

  const productIds = [...new Set(cart.map((item: any) => String(item.id || '')).filter(Boolean))];
  const products = [];
  for (const id of productIds) {
    const rows = await base44.asServiceRole.entities.Product.filter({ id });
    if (rows[0]) products.push(rows[0]);
  }

  const productMap = new Map(products.map((p: any) => [String(p.id), p]));
  const verifiedCart = cart.map((item: any) => {
    const product = productMap.get(String(item.id));
    if (!product || product.is_active === false) throw new Error('A cart item is no longer available');
    const quantity = Math.max(1, Math.min(99, Number(item.quantity) || 1));
    return {
      id: String(product.id),
      name: product.name,
      price: product.price,
      image_url: product.image_url || null,
      is_digital: product.is_digital === true,
      options: item.options || {},
      quantity,
    };
  });

  const hasPhysical = verifiedCart.some((item: any) => !item.is_digital);
  const checkoutSession = await base44.asServiceRole.entities.GiftShopCheckoutSession.create({
    user_id: user.id,
    user_email: user.email,
    cart: verifiedCart,
    totals: {},
    payment_mode: hasPhysical ? 'stripe_tax_physical' : 'stripe_tax_digital',
  });

  const line_items = verifiedCart.map((item: any) => ({
    quantity: item.quantity,
    price_data: {
      currency: 'cad',
      unit_amount: Math.round(parsePrice(item.price) * 100),
      tax_behavior: 'exclusive',
      product_data: {
        name: item.name,
        metadata: { product_id: item.id },
        ...(item.image_url ? { images: [item.image_url] } : {}),
      },
    },
  }));

  const origin = req.headers.get('origin') || Deno.env.get('APP_URL') || 'https://aistage-one.vercel.app';
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items,
    automatic_tax: { enabled: true },
    billing_address_collection: 'required',
    ...(hasPhysical ? { shipping_address_collection: { allowed_countries: allowedCountries as any } } : {}),
    customer_email: user.email,
    client_reference_id: checkoutSession.id,
    success_url: origin + '/cart?payment=success&session_id={CHECKOUT_SESSION_ID}',
    cancel_url: origin + '/cart?payment=cancelled',
    metadata: {
      checkout_session_id: checkoutSession.id,
      user_id: user.id,
      user_email: user.email || '',
      gift_shop: 'true',
    },
  });

  await base44.asServiceRole.entities.GiftShopCheckoutSession.update(checkoutSession.id, {
    stripe_checkout_session_id: session.id,
  });

  return Response.json({ url: session.url, id: session.id });
});
