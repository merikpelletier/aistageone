import { createClient } from 'npm:@supabase/supabase-js@2';
import { serveWithCors } from '../_shared/cors.ts';

const STRIPE_API = 'https://api.stripe.com/v1';

function parsePrice(value: unknown) {
  const amount = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid product price');
  return amount;
}

function append(params: URLSearchParams, key: string, value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === '') return;
  params.append(key, String(value));
}

async function stripePost(path: string, params: URLSearchParams) {
  const secret = Deno.env.get('STRIPE_SECRET_KEY');
  if (!secret) throw new Error('STRIPE_SECRET_KEY is not configured');

  const response = await fetch(STRIPE_API + path, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(secret + ':'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || 'Stripe request failed');
  return data;
}

serveWithCors(async (req) => {
  const authHeader = req.headers.get('Authorization') || '';
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const scoped = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const service = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: { user }, error: userError } = await scoped.auth.getUser();
  if (userError || !user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { cart } = await req.json();
  if (!Array.isArray(cart) || cart.length === 0) {
    return Response.json({ error: 'Cart is empty' }, { status: 400 });
  }

  const ids = [...new Set(cart.map((item: any) => String(item?.id || '')).filter(Boolean))];
  const { data: products, error: productError } = await scoped
    .from('products')
    .select('id,name,price,image_url,is_active,is_digital,stripe_tax_code')
    .in('id', ids);
  if (productError) throw productError;

  const productMap = new Map((products || []).map((p: any) => [String(p.id), p]));
  const verifiedCart = cart.map((item: any) => {
    const product: any = productMap.get(String(item.id));
    if (!product || product.is_active === false) throw new Error('A cart item is no longer available');
    const quantity = Math.max(1, Math.min(99, Number(item.quantity) || 1));
    return {
      id: String(product.id),
      name: String(product.name || 'Product'),
      price: String(product.price || ''),
      image_url: product.image_url || null,
      is_digital: product.is_digital === true,
      stripe_tax_code: product.stripe_tax_code || null,
      options: item.options || {},
      quantity,
    };
  });

  const allDigital = verifiedCart.every((item: any) => item.is_digital);
  const hasPhysical = verifiedCart.some((item: any) => !item.is_digital);
  const paymentMode = allDigital ? 'stripe_managed_payments' : 'stripe_tax';

  const { data: checkoutId, error: checkoutError } = await service.rpc(
    'gift_shop_create_checkout_session',
    {
      p_user_id: user.id,
      p_user_email: user.email,
      p_cart: verifiedCart,
      p_payment_mode: paymentMode,
    },
  );
  if (checkoutError) throw checkoutError;

  const params = new URLSearchParams();
  append(params, 'mode', 'payment');
  append(params, 'customer_email', user.email);
  append(params, 'client_reference_id', checkoutId);
  append(params, 'billing_address_collection', 'required');

  const origin = req.headers.get('origin') || Deno.env.get('APP_URL') || 'https://aistage-one.vercel.app';
  append(params, 'success_url', origin + '/cart?payment=success&session_id={CHECKOUT_SESSION_ID}');
  append(params, 'cancel_url', origin + '/cart?payment=cancelled');

  append(params, 'metadata[checkout_session_id]', checkoutId);
  append(params, 'metadata[user_id]', user.id);
  append(params, 'metadata[user_email]', user.email);
  append(params, 'metadata[gift_shop]', 'true');
  append(params, 'metadata[payment_mode]', paymentMode);

  if (allDigital) {
    // Stripe becomes merchant of record for eligible digital transactions.
    append(params, 'managed_payments[enabled]', 'true');
  } else {
    // Physical or mixed carts remain Sckript sales; Stripe Tax calculates destination tax.
    append(params, 'automatic_tax[enabled]', 'true');
    const countries = ['CA','US','GB','FR','BE','CH','DE','ES','IT','NL','PT','IE','AT','DK','SE','NO','FI','AU','NZ','JP','SG','MX'];
    countries.forEach((country, index) => append(params, `shipping_address_collection[allowed_countries][${index}]`, country));
  }

  verifiedCart.forEach((item: any, index: number) => {
    append(params, `line_items[${index}][quantity]`, item.quantity);
    append(params, `line_items[${index}][price_data][currency]`, 'cad');
    append(params, `line_items[${index}][price_data][unit_amount]`, Math.round(parsePrice(item.price) * 100));
    append(params, `line_items[${index}][price_data][tax_behavior]`, 'exclusive');
    append(params, `line_items[${index}][price_data][product_data][name]`, item.name);
    append(params, `line_items[${index}][price_data][product_data][metadata][product_id]`, item.id);
    if (item.image_url) append(params, `line_items[${index}][price_data][product_data][images][0]`, item.image_url);

    if (!allDigital) {
      const taxCode = item.stripe_tax_code || (!item.is_digital ? 'txcd_99999999' : null);
      if (taxCode) append(params, `line_items[${index}][price_data][product_data][tax_code]`, taxCode);
    }
  });

  const session = await stripePost('/checkout/sessions', params);

  const { error: saveError } = await service.rpc('gift_shop_set_stripe_session', {
    p_id: checkoutId,
    p_stripe_checkout_session_id: session.id,
  });
  if (saveError) throw saveError;

  return Response.json({
    url: session.url,
    id: session.id,
    payment_mode: paymentMode,
    managed_payments: allDigital,
    automatic_tax: hasPhysical,
  });
});
