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
    const error = new Error(data?.detail || data?.error?.message || data?.message || 'Printful request failed');
    error.status = response.status;
    throw error;
  }
  return data;
}

async function findSyncProductBySku(sku, token) {
  const list = await pf('/store/products?status=all', token);
  for (const product of list?.result || []) {
    const detail = await pf(`/store/products/${encodeURIComponent(product.id)}`, token);
    if ((detail?.result?.sync_variants || []).some((variant) => variant?.sku === sku)) {
      return detail;
    }
  }
  return null;
}

function taskFromResponse(data) {
  if (Array.isArray(data?.data)) return data.data[0] || null;
  return data?.data || data || null;
}

function mockupUrls(task) {
  const urls = [];
  for (const variant of task?.catalog_variant_mockups || []) {
    for (const mockup of variant?.mockups || []) {
      if (mockup?.mockup_url && !urls.includes(mockup.mockup_url)) urls.push(mockup.mockup_url);
    }
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
      const taskId = Array.isArray(req.query?.task_id) ? req.query.task_id[0] : req.query?.task_id;
      const imageIndexRaw = Array.isArray(req.query?.image_index) ? req.query.image_index[0] : req.query?.image_index;

      if (!taskId) {
        res.status(400).json({ error: 'task_id is required' });
        return;
      }

      const taskData = await pf(`/v2/mockup-tasks?id=${encodeURIComponent(taskId)}`, token);
      const task = taskFromResponse(taskData);
      const urls = mockupUrls(task);

      if (imageIndexRaw !== undefined) {
        const index = Number(imageIndexRaw);
        const url = Number.isInteger(index) ? urls[index] : null;
        if (!url) {
          res.status(404).json({ error: 'Mockup image not found' });
          return;
        }

        const imageResponse = await fetch(url);
        if (!imageResponse.ok) {
          res.status(502).json({ error: 'Unable to download generated Printful mockup' });
          return;
        }
        const buffer = Buffer.from(await imageResponse.arrayBuffer());
        res.setHeader('Content-Type', imageResponse.headers.get('content-type') || 'image/jpeg');
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).send(buffer);
        return;
      }

      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({
        task_id: task?.id || taskId,
        status: task?.status || 'pending',
        urls,
        failure_reasons: task?.failure_reasons || [],
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

    const syncProduct = sync?.result?.sync_product;
    const syncVariants = sync?.result?.sync_variants || [];
    const firstCatalogVariantId = syncVariants.find((variant) => variant?.variant_id)?.variant_id;
    if (!syncProduct?.id || !firstCatalogVariantId) {
      res.status(400).json({ error: 'Printful product is missing product/variant identifiers' });
      return;
    }

    const catalogVariant = await pf(
      `/products/variant/${encodeURIComponent(firstCatalogVariantId)}`,
      token
    );
    const catalogProductId = catalogVariant?.result?.variant?.product_id;
    if (!catalogProductId) {
      res.status(400).json({ error: 'Unable to resolve Printful catalog product' });
      return;
    }

    const productsV2 = await pf('/v2/products?limit=100', token);
    const myProduct = (productsV2?.data || []).find((product) =>
      (product?.published_to_stores || []).some((published) =>
        String(published?.sync_product_id) === String(syncProduct.id)
      )
    );

    if (!myProduct?.id) {
      res.status(404).json({
        error: 'This Printful Sync Product is not available as a V2 My Product for mockup generation',
      });
      return;
    }

    const variantsV2 = await pf(
      `/v2/products/${encodeURIComponent(myProduct.id)}/variants`,
      token
    );
    const variants = variantsV2?.data || [];
    const productVariantIds = variants.map((variant) => variant?.id).filter(Boolean);
    const catalogVariantIds = variants.map((variant) => variant?.catalog_variant_id).filter(Boolean);

    const stylesData = await pf(
      `/v2/catalog-products/${encodeURIComponent(catalogProductId)}/mockup-styles?default_mockup_styles=true&selling_region_name=canada&limit=100`,
      token
    );

    const styleIds = [];
    for (const placement of stylesData?.data || []) {
      for (const style of placement?.mockup_styles || []) {
        const restricted = style?.restricted_to_variants;
        const allowed =
          !restricted ||
          restricted.length === 0 ||
          restricted.some((id) => catalogVariantIds.includes(id));
        if (allowed && style?.id && !styleIds.includes(style.id)) styleIds.push(style.id);
        if (styleIds.length >= 4) break;
      }
      if (styleIds.length >= 4) break;
    }

    if (!productVariantIds.length || !styleIds.length) {
      res.status(400).json({ error: 'No compatible Printful variants or mockup styles were found' });
      return;
    }

    const created = await pf('/v2/mockup-tasks', token, {
      method: 'POST',
      body: JSON.stringify({
        format: 'jpg',
        mockup_width_px: 1200,
        products: [{
          source: 'product',
          product_id: myProduct.id,
          variant_ids: productVariantIds.slice(0, 10),
          mockup_style_ids: styleIds,
        }],
      }),
    });

    const task = taskFromResponse(created);
    if (!task?.id) {
      res.status(502).json({ error: 'Printful did not return a mockup task ID' });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ task_id: task.id, status: task.status || 'pending' });
  } catch (error) {
    console.error('Printful mockup generation failed:', error);
    res.status(error?.status || 500).json({
      error: error?.message || 'Unable to generate Printful gallery',
    });
  }
}
