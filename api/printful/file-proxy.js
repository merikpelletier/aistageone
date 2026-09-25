const ALLOWED_HOSTS = new Set([
  'files.cdn.printful.com',
  'printful-upload.s3-accelerate.amazonaws.com',
  'images.printful.com',
  's3-printful.stage.printful.dev',
  's3-printful.prod.printful.dev',
]);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const rawUrl = Array.isArray(req.query?.url) ? req.query.url[0] : req.query?.url;
  if (!rawUrl) {
    res.status(400).json({ error: 'url is required' });
    return;
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    res.status(400).json({ error: 'Invalid url' });
    return;
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    res.status(400).json({ error: 'Host is not allowed' });
    return;
  }

  try {
    const response = await fetch(parsed.toString());
    if (!response.ok) {
      res.status(502).json({ error: `Unable to fetch source image (${response.status})` });
      return;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      const body = await response.text();
      res.status(502).json({
        error: 'Source URL did not return an image',
        detail: body.slice(0, 300),
      });
      return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).send(buffer);
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Unable to proxy source image' });
  }
}
