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

  try {
    if (!id) {
      const data = await printfulFetch('/store/products?status=all', token);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(data);
      return;
    }

    const data = await printfulFetch(`/store/products/${encodeURIComponent(id)}`, token);
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
          const productData = await printfulFetch(
            `/products/${encodeURIComponent(catalogProductId)}`,
            token
          );
          catalogProduct = productData?.result?.product || null;
        }
      } catch (catalogError) {
        console.warn('Unable to enrich Printful catalog product:', catalogError?.message);
      }
    }

    const gallery = [];
    const addImage = (url) => {
      if (url && !gallery.includes(url)) gallery.push(url);
    };

    addImage(data?.result?.sync_product?.thumbnail_url);
    syncVariants.forEach((variant) => {
      addImage(variant?.mockup_file_url);
      (variant?.files || []).forEach((file) => {
        addImage(file?.preview_url);
        addImage(file?.thumbnail_url);
      });
    });

    data.result.catalog_product = catalogProduct;
    data.result.gallery = gallery;

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(data);
  } catch (error) {
    res.status(error?.status || 500).json({
      error: error?.message || 'Unable to load Printful products',
    });
  }
}
