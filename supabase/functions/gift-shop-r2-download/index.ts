import { createClient } from 'npm:@supabase/supabase-js@2';
import { S3Client, GetObjectCommand } from 'npm:@aws-sdk/client-s3@3';
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function r2Client() {
  const accountId = Deno.env.get('CLOUDFLARE_R2_ACCOUNT_ID');
  const accessKeyId = Deno.env.get('CLOUDFLARE_R2_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY');
  if (!accountId || !accessKeyId || !secretAccessKey) throw new Error('Cloudflare R2 is not configured');
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

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

    const { product_id } = await req.json();
    if (!product_id) return Response.json({ error: 'Product ID is required' }, { status: 400, headers: corsHeaders });

    const { data: orders, error: orderError } = await service
      .from('order')
      .select('items')
      .eq('customer_email', user.email)
      .eq('status', 'completed');
    if (orderError) throw orderError;

    const purchased = (orders || []).some((order) =>
      (Array.isArray(order.items) ? order.items : []).some((item) => String(item?.id) === String(product_id))
    );
    if (!purchased) return Response.json({ error: 'No completed purchase found for this product' }, { status: 403, headers: corsHeaders });

    const { data: product, error: productError } = await service
      .from('products')
      .select('id,name,r2_object_key,is_digital')
      .eq('id', product_id)
      .eq('is_digital', true)
      .single();
    if (productError || !product?.r2_object_key) {
      return Response.json({ error: 'Digital file is not available' }, { status: 404, headers: corsHeaders });
    }

    const bucket = Deno.env.get('CLOUDFLARE_R2_BUCKET');
    if (!bucket) throw new Error('Cloudflare R2 bucket is not configured');

    const filename = product.r2_object_key.split('/').pop() || 'download';
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: product.r2_object_key,
      ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, '')}"`,
    });
    const url = await getSignedUrl(r2Client(), command, { expiresIn: 600 });

    return Response.json({ url, expires_in: 600 }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500, headers: corsHeaders });
  }
});
