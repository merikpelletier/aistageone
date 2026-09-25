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

  const contentType = response.headers.get('content-type') || '';
  let data = null;

  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    const error = new Error(text || `Printful request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }

  if (!response.ok) {
    const message =
      data?.detail ||
      data?.error?.message ||
      data?.message ||
      JSON.stringify(data);
    const error = new Error(message);
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

function collectTaskUrls(task) {
  const urls = [];

  for (const variantMockup of task?.catalog_variant_mockups || []) {
    for (const mockup of variantMockup?.mockups || []) {
      if (mockup?.mockup_url && !urls.includes(mockup.mockup_url)) {
        urls.push(mockup.mockup_url);
      }
    }
  }

  return urls;
}

function normalizePlacement(type) {
  const raw = type === 'default' ? 'front' : type;
  return raw
    .replace(/_dtf$/i, '')
    .replace(/_dtg$/i, '');
}

function buildPlacements(syncVariants, origin) {
  const map = new Map();

  for (const variant of syncVariants) {
    for (const file of variant?.files || []) {
      const type = file?.type || 'default';

      if (
        type === 'preview' ||
        type === 'mockup' ||
        type.startsWith('label_')
      ) {
        continue;
      }

      const sourceUrl = file?.url || file?.preview_url || file?.thumbnail_url;
      if (!sourceUrl) continue;

      const placement = normalizePlacement(type);
      if (map.has(placement)) continue;

      const proxiedUrl =
        `${origin}/api/printful/file-proxy?url=${encodeURIComponent(sourceUrl)}`;

      map.set(placement, {
        placement,
        layers: [
          {
            type: 'file',
            url: proxiedUrl,
          },
        ],
      });
    }
  }

  return [...map.values()];
}

async function loadMockupStyleIds(catalogProductId, token) {
  const stylesData = await pf(
    `/v2/catalog-products/${encodeURIComponent(
      catalogProductId
    )}/mockup-styles?default_mockup_styles=true&limit=100`,
    token
  );

  const styleIds = [];

  for (const placement of stylesData?.data || []) {
    for (const style of placement?.mockup_styles || []) {
      if (style?.id && !styleIds.includes(style.id)) {
        styleIds.push(style.id);
      }
      if (styleIds.length >= 6) break;
    }
    if (styleIds.length >= 6) break;
  }

  return styleIds;
}

export default async function handler(req, res) {
  const token = process.env.PRINTFUL_API_TOKEN;

  if (!token) {
    res.status(500).json({ error: 'PRINTFUL_API_TOKEN is not configured' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const taskId = Array.isArray(req.query?.task_id)
        ? req.query.task_id[0]
        : req.query?.task_id;

      if (!taskId) {
        res.status(400).json({ error: 'task_id is required' });
        return;
      }

      const result = await pf(
        `/v2/mockup-tasks?id=${encodeURIComponent(taskId)}`,
        token
      );

      const task = Array.isArray(result?.data) ? result.data[0] : null;

      if (!task) {
        res.status(404).json({ error: 'Mockup task not found' });
        return;
      }

      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({
        task_id: task.id,
        status: task.status,
        urls: collectTaskUrls(task),
        failure_reasons: task.failure_reasons || [],
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

    const syncVariants = (sync?.result?.sync_variants || [])
      .filter((variant) => variant?.variant_id);

    if (!syncVariants.length) {
      res.status(400).json({ error: 'No usable Printful variants found' });
      return;
    }

    const firstVariantId = syncVariants[0].variant_id;
    const variantData = await pf(
      `/products/variant/${encodeURIComponent(firstVariantId)}`,
      token
    );
    const catalogProductId = variantData?.result?.variant?.product_id;

    if (!catalogProductId) {
      res.status(400).json({ error: 'Unable to resolve Printful catalog product' });
      return;
    }

    const catalogVariantIds = [
      ...new Set(syncVariants.map((variant) => variant.variant_id)),
    ];

    const styleIds = await loadMockupStyleIds(catalogProductId, token);

    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = Array.isArray(forwardedProto)
      ? forwardedProto[0]
      : (forwardedProto || 'https');

    const origin = `${protocol}://${req.headers.host}`;
    const placements = buildPlacements(syncVariants, origin);

    if (!placements.length) {
      res.status(400).json({
        error: 'No usable design files were found for this Printful product',
      });
      return;
    }

    if (!styleIds.length) {
      res.status(400).json({
        error: 'No compatible Printful mockup styles were found',
      });
      return;
    }

    const payload = {
      format: 'jpg',
      mockup_width_px: 1200,
      products: [
        {
          source: 'catalog',
          catalog_product_id: catalogProductId,
          catalog_variant_ids: catalogVariantIds.slice(0, 10),
          mockup_style_ids: styleIds.slice(0, 4),
          placements,
        },
      ],
    };

    console.log('Printful v2 mockup payload', JSON.stringify({
      catalog_product_id: catalogProductId,
      catalog_variant_ids: payload.products[0].catalog_variant_ids,
      mockup_style_ids: payload.products[0].mockup_style_ids,
      placements: placements.map((placement) => ({
        placement: placement.placement,
        layer_count: placement.layers.length,
      })),
    }));

    const created = await pf('/v2/mockup-tasks', token, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const task = Array.isArray(created?.data) ? created.data[0] : null;

    if (!task?.id) {
      res.status(502).json({ error: 'Printful did not return a mockup task ID' });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      task_id: task.id,
      status: task.status || 'pending',
      urls: collectTaskUrls(task),
      failure_reasons: task.failure_reasons || [],
    });
  } catch (error) {
    console.error('Printful mockup generation failed:', error);
    res.status(error?.status || 500).json({
      error: error?.message || 'Unable to generate Printful gallery',
    });
  }
}
