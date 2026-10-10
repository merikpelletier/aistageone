import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeFilename(filename: string) {
  return filename
    .replace(/[^A-Za-z0-9._ -]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(-180);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);
    if (user.app_metadata?.role !== "admin") return json({ error: "Admin access required" }, 403);

    const accountId = Deno.env.get("R2_ACCOUNT_ID");
    const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
    const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const bucket = Deno.env.get("R2_BUCKET_3D_LIBRARY") || "aistage-3d-library";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!accountId || !accessKeyId || !secretAccessKey || !supabaseUrl) {
      return json({ error: "R2 or Supabase configuration is incomplete" }, 500);
    }

    const r2 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    const body = await req.json();
    const filename = String(body.filename || "").trim();
    const contentType = String(body.content_type || "").trim() || "application/octet-stream";
    const kind = String(body.kind || "product").trim().toLowerCase();

    if (!filename) return json({ error: "Filename is required" }, 400);
    if (!["product", "preview"].includes(kind)) return json({ error: "Invalid upload kind" }, 400);
    if (kind === "product" && !(/zip/i.test(contentType) || filename.toLowerCase().endsWith(".zip"))) {
      return json({ error: "3D products must be ZIP files" }, 400);
    }
    if (kind === "preview" && !contentType.startsWith("image/")) {
      return json({ error: "Presentation files must be images" }, 400);
    }

    const cleaned = safeFilename(filename);
    const fallback = kind === "preview" ? "preview.jpg" : "asset.zip";
    const prefix = kind === "preview" ? "previews" : "products";
    const objectKey = `${prefix}/${crypto.randomUUID()}-${cleaned || fallback}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: contentType,
      ContentDisposition: kind === "preview"
        ? `inline; filename="${(cleaned || fallback).replace(/"/g, "")}"`
        : `attachment; filename="${(cleaned || fallback).replace(/"/g, "")}"`,
      CacheControl: kind === "preview" ? "public, max-age=31536000, immutable" : undefined,
    });

    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 1800 });
    const publicUrl = kind === "preview"
      ? `${supabaseUrl}/functions/v1/studio-3d-media?key=${encodeURIComponent(objectKey)}`
      : null;

    return json({ upload_url: uploadUrl, object_key: objectKey, bucket, public_url: publicUrl });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unexpected R2 upload error" }, 500);
  }
});