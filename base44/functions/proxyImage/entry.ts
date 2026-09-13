import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const body = await req.json();
  const { url } = body;

  if (!url || !url.includes('base44.app')) {
    return Response.json({ error: 'Invalid URL' }, { status: 400 });
  }

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const response = await fetch(url);
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const buffer = await response.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

  return Response.json({ dataUrl: `data:${contentType};base64,${base64}` });
});