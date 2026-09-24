import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const scoped = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const service = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    const { data: { user }, error } = await scoped.auth.getUser();
    if (error || !user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

    const { data: orders, error: orderError } = await service
      .from('order')
      .select('order_id,items,payment_date')
      .eq('customer_email', user.email)
      .eq('status', 'completed')
      .order('payment_date', { ascending: false });
    if (orderError) throw orderError;

    const purchased = new Map<string, { order_id: string; payment_date: string | null }>();
    for (const order of orders || []) {
      for (const item of Array.isArray(order.items) ? order.items : []) {
        if (item?.id && !purchased.has(String(item.id))) {
          purchased.set(String(item.id), { order_id: order.order_id, payment_date: order.payment_date });
        }
      }
    }

    const ids = [...purchased.keys()];
    if (ids.length === 0) return Response.json({ downloads: [] }, { headers: corsHeaders });

    const { data: products, error: productError } = await service
      .from('products')
      .select('id,name,description,image_url,r2_object_key,is_digital')
      .in('id', ids)
      .eq('is_digital', true)
      .not('r2_object_key', 'is', null);
    if (productError) throw productError;

    const downloads = (products || []).map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      image_url: product.image_url,
      order_id: purchased.get(String(product.id))?.order_id || null,
      payment_date: purchased.get(String(product.id))?.payment_date || null,
    }));

    return Response.json({ downloads }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500, headers: corsHeaders });
  }
});
