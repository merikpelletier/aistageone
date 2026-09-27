import { createClient } from 'npm:@supabase/supabase-js@2';

const STRIPE_API = 'https://api.stripe.com/v1';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function append(params: URLSearchParams, key: string, value: unknown) {
  if (value === undefined || value === null || value === '') return;
  params.append(key, String(value));
}

async function stripePost(path: string, params: URLSearchParams) {
  const secret = Deno.env.get('STRIPE_SECRET_KEY');
  if (!secret) throw new Error('STRIPE_SECRET_KEY is not configured');
  const response = await fetch(STRIPE_API + path, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(secret + ':'),
      'Stripe-Version': '2025-03-31.basil',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || 'Stripe request failed');
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const scoped = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: { user }, error: authError } = await scoped.auth.getUser();
    if (authError || !user?.email) return Response.json({ error: 'Authentication required' }, { status: 401, headers: cors });

    const payload = await req.json();
    const packageId = String(payload.package_id || '');
    if (!packageId) return Response.json({ error: 'Placement package is required' }, { status: 400, headers: cors });

    const { data: placementPackage, error: packageError } = await service
      .from('product_placement_package')
      .select('*')
      .eq('id', packageId)
      .eq('is_active', true)
      .single();
    if (packageError || !placementPackage) return Response.json({ error: 'Placement package unavailable' }, { status: 404, headers: cors });

    const productName = String(payload.product_name || '').trim();
    const featuredImage = String(payload.featured_image || '').trim();
    if (!productName || !featuredImage) return Response.json({ error: 'Product name and image are required' }, { status: 400, headers: cors });
    if (payload.rights_confirmed !== true || payload.terms_accepted !== true) {
      return Response.json({ error: 'Rights and placement terms must be accepted' }, { status: 400, headers: cors });
    }

    const subtotal = Number(placementPackage.price || 0);
    if (!(subtotal > 0)) return Response.json({ error: 'Invalid package price' }, { status: 400, headers: cors });

    const { data: requestRow, error: insertError } = await service
      .from('product_placement_request')
      .insert({
        submitter_id: user.id,
        submitter_email: user.email,
        company_name: String(payload.company_name || '').trim() || null,
        contact_name: String(payload.contact_name || '').trim() || null,
        product_name: productName,
        product_description: String(payload.product_description || '').trim() || null,
        product_url: String(payload.product_url || '').trim() || null,
        featured_image: featuredImage,
        preview_images: Array.isArray(payload.preview_images) ? payload.preview_images : [],
        tags: Array.isArray(payload.tags) ? payload.tags : [],
        category_id: payload.category_id || null,
        subcategory_id: payload.subcategory_id || null,
        package_id: placementPackage.id,
        package_name: placementPackage.name,
        duration_days: placementPackage.duration_days,
        includes_featured: placementPackage.includes_featured === true,
        subtotal,
        currency: String(placementPackage.currency || 'CAD').toUpperCase(),
        payment_status: 'pending',
        review_status: 'pending_payment',
        placement_status: 'pending',
        rights_confirmed: true,
        terms_accepted: true,
      })
      .select('*')
      .single();
    if (insertError) throw insertError;

    const origin = req.headers.get('origin') || Deno.env.get('APP_URL') || 'https://aistage-one.vercel.app';
    const params = new URLSearchParams();
    append(params, 'mode', 'payment');
    append(params, 'customer_email', user.email);
    append(params, 'client_reference_id', requestRow.id);
    append(params, 'billing_address_collection', 'required');
    append(params, 'automatic_tax[enabled]', 'true');
    append(params, 'success_url', origin + '/ProductPlacement?payment=success&session_id={CHECKOUT_SESSION_ID}');
    append(params, 'cancel_url', origin + '/ProductPlacement?payment=cancelled');
    append(params, 'metadata[product_placement]', 'true');
    append(params, 'metadata[product_placement_request_id]', requestRow.id);
    append(params, 'metadata[user_id]', user.id);
    append(params, 'metadata[user_email]', user.email);
    append(params, 'line_items[0][quantity]', 1);
    append(params, 'line_items[0][price_data][currency]', String(placementPackage.currency || 'CAD').toLowerCase());
    append(params, 'line_items[0][price_data][unit_amount]', Math.round(subtotal * 100));
    append(params, 'line_items[0][price_data][tax_behavior]', 'exclusive');
    append(params, 'line_items[0][price_data][product_data][name]', 'AISTAGE.ONE Product Placement — ' + placementPackage.name);
    append(params, 'line_items[0][price_data][product_data][description]', productName);
    append(params, 'line_items[0][price_data][product_data][tax_code]', 'txcd_10000000');

    const session = await stripePost('/checkout/sessions', params);

    const { error: saveError } = await service
      .from('product_placement_request')
      .update({ stripe_checkout_session_id: session.id, updated_at: new Date().toISOString() })
      .eq('id', requestRow.id);
    if (saveError) throw saveError;

    return Response.json({ id: session.id, url: session.url, request_id: requestRow.id }, { headers: cors });
  } catch (error) {
    console.error('product-placement-checkout error', error);
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500, headers: cors });
  }
});
