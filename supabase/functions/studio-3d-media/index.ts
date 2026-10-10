import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { S3Client, GetObjectCommand } from "npm:@aws-sdk/client-s3@3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

function text(message: string, status: number) {
  return new Response(message, { status, headers: corsHeaders });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return text("Method not allowed", 405);

  try {
    const url = new URL(req.url);
    const key = String(url.searchParams.get("key") || "");
    if (!key.startsWith("previews/") || key.includes("..")) return text("Invalid media key", 400);

    const accountId = Deno.env.get("R2_ACCOUNT_ID");
    const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const bucket = Deno.env.get("R2_BUCKET_3D_LIBRARY") || "aistage-3d-library";
    if (!accountId || !accessKeyId || !secretAccessKey) return text("R2 configuration is incomplete", 500);

    const r2 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    const signedUrl = await getSignedUrl(
      r2,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseCacheControl: "public, max-age=3600",
      }),
      { expiresIn: 3600 },
    );

    return Response.redirect(signedUrl, 302);
  } catch (error) {
    console.error(error);
    return text("Unable to load media", 500);
  }
});