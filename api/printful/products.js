async function printfulFetch(path, token) {
  const response = await fetch(`https://api.printful.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || data?.message || 'Printful request failed';
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function enrichSyncProduct(data, token) {
  const syncVariants = data?.result?.sync_variants || [];
  const firstCatalogVariantId = syncVariants.find((variant) => variant?.variant_id)?.variant_id;

  let catalogProduct = null;

  if (firstCatalogVariantId) {
    try {
      const variantData = await printfulFetch(
        `/products/variant/${encodeURIComponent(firstCatalogVariantId)}`,
        token
      );
      const catalogProductId = variantData?.result?.variant?.product_id;

      if (catalogProductId) {
        let productData = null;
        try {
          productData = await printfulFetch(
            `/v2/catalog-products/${encodeURIComponent(catalogProductId)}?selling_region_name=canada`,
            token
          );
        } catch (regionError) {
          productData = await printfulFetch(
            `/v2/catalog-products/${encodeURIComponent(catalogProductId)}?selling_region_name=all`,
            token
          );
        }
        catalogProduct = productData?.data || null;
      }
    } catch (catalogError) {
      console.warn('Unable to enrich Printful catalog product:', catalogError?.message);
    }
  }

  const gallery = [];
  const addImage = (url) => {
    if (url && !gallery.includes(url)) gallery.push(url);
  };

  // Storefront gallery must only contain mockups of this customized Sync Product.
  // Do not mix in blank catalog photography or print-file previews.
  addImage(data?.result?.sync_product?.thumbnail_url);
  syncVariants.forEach((variant) => {
    addImage(variant?.mockup_file_url);
  });

  data.result.catalog_product = catalogProduct;
  data.result.gallery = gallery;
  return data;
}

async function findSyncProductBySku(sku, token) {
  const listData = await printfulFetch('/store/products?status=all', token);
  const products = listData?.result || [];

  for (const product of products) {
    const detail = await printfulFetch(
      `/store/products/${encodeURIComponent(product.id)}`,
      token
    );
    const match = (detail?.result?.sync_variants || []).some(
      (variant) => variant?.sku && variant.sku === sku
    );
    if (match) return detail;
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const token = process.env.PRINTFUL_API_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'PRINTFUL_API_TOKEN is not configured' });
    return;
  }

  const id = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id;
  const sku = Array.isArray(req.query?.sku) ? req.query.sku[0] : req.query?.sku;

  try {
    if (sku) {
      const matched = await findSyncProductBySku(sku, token);
      if (!matched) {
        res.status(404).json({ error: 'Printful product not found for this SKU' });
        return;
      }
      const enriched = await enrichSyncProduct(matched, token);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(enriched);
      return;
    }

    if (!id) {
      const data = await printfulFetch('/store/products?status=all', token);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(data);
      return;
    }

    const data = await printfulFetch(
      `/store/products/${encodeURIComponent(id)}`,
      token
    );
    const enriched = await enrichSyncProduct(data, token);

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(enriched);
  } catch (error) {
    res.status(error?.status || 500).json({
      error: error?.message || 'Unable to load Printful products',
    });
  }
}
