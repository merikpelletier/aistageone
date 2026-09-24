import { createClient } from 'npm:@supabase/supabase-js@2';
import { S3Client, PutObjectCommand } from 'npm:@aws-sdk/client-s3@3';
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function r2Client() {
  const accountId = Deno.env.get('CLOUDFLARE_R2_ACCOUNT_ID');
  const accessKeyId = Deno.env.get('CLOUDFLARE_R2_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY');
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Cloudflare R2 is not configured');
  }
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    if (user.app_metadata?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403, headers: corsHeaders });
    }

    const { filename, content_type } = await req.json();
    if (!filename) return Response.json({ error: 'Filename is required' }, { status: 400, headers: corsHeaders });

    const safeName = String(filename).replace(/[^A-Za-z0-9._-]+/g, '_').slice(-140);
    const objectKey = `gift-shop/${crypto.randomUUID()}-${safeName || 'download.bin'}`;
    const bucket = Deno.env.get('CLOUDFLARE_R2_BUCKET');
    if (!bucket) throw new Error('Cloudflare R2 bucket is not configured');

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: content_type || 'application/octet-stream',
    });
    const uploadUrl = await getSignedUrl(r2Client(), command, { expiresIn: 900 });

    return Response.json({ upload_url: uploadUrl, object_key: objectKey }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500, headers: corsHeaders });
  }
});
