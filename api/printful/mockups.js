const API = 'https://api.printful.com';

async function pf(path, token, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json();
  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.result ||
      data?.message ||
      `Printful request failed (${response.status})`;
    const error = new Error(typeof message === 'string' ? message : JSON.stringify(message));
    error.status = response.status;
    throw error;
  }

  return data;
}

async function findSyncProductBySku(sku, token) {
  const list = await pf('/store/products?status=all', token);

  for (const product of list?.result || []) {
    const detail = await pf(
      `/store/products/${encodeURIComponent(product.id)}`,
      token
    );

    if ((detail?.result?.sync_variants || []).some((variant) => variant?.sku === sku)) {
      return detail;
    }
  }

  return null;
}

function collectMockupUrls(result) {
  const urls = [];

  const add = (url) => {
    if (url && !urls.includes(url)) urls.push(url);
  };

  for (const mockup of result?.mockups || []) {
    add(mockup?.mockup_url);
    for (const extra of mockup?.extra || []) add(extra?.url);
  }

  return urls;
}

export default async function handler(req, res) {
  const token = process.env.PRINTFUL_API_TOKEN;

  if (!token) {
    res.status(500).json({ error: 'PRINTFUL_API_TOKEN is not configured' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const taskKey = Array.isArray(req.query?.task_id)
        ? req.query.task_id[0]
        : req.query?.task_id;

      if (!taskKey) {
        res.status(400).json({ error: 'task_id is required' });
        return;
      }

      const data = await pf(
        `/mockup-generator/task?task_key=${encodeURIComponent(taskKey)}`,
        token
      );
      const result = data?.result || {};

      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({
        task_id: result.task_key || taskKey,
        status: result.status || 'pending',
        urls: collectMockupUrls(result),
        error: result.error || null,
      });
      return;
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const sku = req.body?.sku;

    if (!sku) {
      res.status(400).json({ error: 'sku is required' });
      return;
    }

    const sync = await findSyncProductBySku(sku, token);

    if (!sync) {
      res.status(404).json({ error: 'Printful product not found for this SKU' });
      return;
    }

    const syncVariants = sync?.result?.sync_variants || [];
    const usableVariants = syncVariants.filter((variant) => variant?.variant_id);

    if (!usableVariants.length) {
      res.status(400).json({ error: 'Printful product has no usable variants' });
      return;
    }

    const catalogVariant = await pf(
      `/products/variant/${encodeURIComponent(usableVariants[0].variant_id)}`,
      token
    );
    const catalogProductId = catalogVariant?.result?.variant?.product_id;

    if (!catalogProductId) {
      res.status(400).json({ error: 'Unable to resolve Printful catalog product' });
      return;
    }

    const filesByPlacement = new Map();

    for (const variant of usableVariants) {
      for (const file of variant?.files || []) {
        const type = file?.type || 'default';
        const url = file?.url;

        if (!url || type === 'preview' || type === 'mockup') continue;
        if (!filesByPlacement.has(type)) {
          filesByPlacement.set(type, {
            placement: type === 'default' ? 'front' : type,
            image_url: url,
          });
        }
      }
    }

    const files = [...filesByPlacement.values()];

    if (!files.length) {
      res.status(400).json({
        error: 'No printable design files were returned for this Printful product',
      });
      return;
    }

    const variantIds = [...new Set(usableVariants.map((variant) => variant.variant_id))];

    const created = await pf(
      `/mockup-generator/create-task/${encodeURIComponent(catalogProductId)}`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          variant_ids: variantIds,
          format: 'jpg',
          width: 1200,
          files,
        }),
      }
    );

    const result = created?.result || {};

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      task_id: result.task_key,
      status: result.status || 'pending',
      urls: collectMockupUrls(result),
      error: result.error || null,
    });
  } catch (error) {
    console.error('Printful mockup generation failed:', error);
    res.status(error?.status || 500).json({
      error: error?.message || 'Unable to generate Printful gallery',
    });
  }
}
