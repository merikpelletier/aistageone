import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowLeft, ShoppingCart, Check } from 'lucide-react';

export default function ProductDetail() {
  const [searchParams] = useSearchParams();
  const productId = searchParams.get('id');

  const [added, setAdded] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState({});
  const [activeImage, setActiveImage] = useState('');
  const [printfulData, setPrintfulData] = useState(null);
  const [generatedGallery, setGeneratedGallery] = useState([]);
  const [mockupLoading, setMockupLoading] = useState(false);

  const { data: rawProducts = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const product = rawProducts.find((item) => item.id === productId);

  useEffect(() => {
    let cancelled = false;

    const loadPrintfulData = async () => {
      if (!product?.sku || (product.description && (product.images || []).length > 0)) {
        setPrintfulData(null);
        return;
      }

      try {
        const response = await fetch(`/api/printful/products?sku=${encodeURIComponent(product.sku)}`);
        const data = await response.json();
        if (!response.ok) return;
        if (!cancelled) setPrintfulData(data?.result || null);
      } catch (error) {
        console.warn('Unable to load Printful product details:', error);
      }
    };

    loadPrintfulData();
    return () => {
      cancelled = true;
    };
  }, [product?.id, product?.sku, product?.description, product?.images]);
  const productOptions = product?.product_options || [];
  const isPrintfulProduct = productOptions.some((option) => option?.name === 'Printful variant');
  const allOptionsSelected = productOptions.every((option) => selectedOptions[option.name]);

  const livePrintfulGallery = printfulData?.gallery || [];
  const secondaryImages = isPrintfulProduct
    ? (generatedGallery.length > 0
        ? generatedGallery
        : (livePrintfulGallery.length > 1 ? livePrintfulGallery : []))
    : (product?.images || []);
  const galleryImages = [
    product?.image_url,
    ...secondaryImages,
  ].filter((url, index, list) => url && list.indexOf(url) === index);

  const productDescription =
    product?.description ||
    printfulData?.catalog_product?.description ||
    '';

  useEffect(() => {
    let cancelled = false;

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const loadGeneratedMockups = async () => {
      if (!isPrintfulProduct || !product?.sku) {
        setGeneratedGallery([]);
        return;
      }

      const cacheKey = `aistage_printful_mockups_${product.sku}`;
      try {
        const cached = JSON.parse(sessionStorage.getItem(cacheKey) || '[]');
        if (Array.isArray(cached) && cached.length > 0) {
          setGeneratedGallery(cached);
          return;
        }
      } catch {
        // Ignore invalid session cache.
      }

      if (livePrintfulGallery.length > 1) return;

      setMockupLoading(true);
      try {
        const startResponse = await fetch('/api/printful/mockups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sku: product.sku }),
        });
        const startData = await startResponse.json();
        if (!startResponse.ok || !startData?.task_id) return;

        for (let attempt = 0; attempt < 8; attempt += 1) {
          if (attempt > 0) await sleep(1500);
          const statusResponse = await fetch(
            `/api/printful/mockups?task_id=${encodeURIComponent(startData.task_id)}`
          );
          const statusData = await statusResponse.json();
          if (!statusResponse.ok) break;

          if (statusData?.status === 'completed') {
            const urls = Array.isArray(statusData?.urls) ? statusData.urls : [];
            if (!cancelled && urls.length > 0) {
              setGeneratedGallery(urls);
              sessionStorage.setItem(cacheKey, JSON.stringify(urls));
            }
            break;
          }

          if (statusData?.status === 'failed') break;
        }
      } catch (error) {
        console.warn('Unable to generate Printful mockup gallery:', error);
      } finally {
        if (!cancelled) setMockupLoading(false);
      }
    };

    loadGeneratedMockups();

    return () => {
      cancelled = true;
    };
  }, [isPrintfulProduct, product?.sku, livePrintfulGallery.length]);

  useEffect(() => {
    if (product?.image_url) setActiveImage(product.image_url);
  }, [product?.id, product?.image_url]);

  const addToCart = () => {
    if (!product || !allOptionsSelected) return;

    const cart = JSON.parse(sessionStorage.getItem('aistage_giftshop_cart') || '[]');
    const optionKey = JSON.stringify(selectedOptions);
    const existing = cart.find((item) =>
      item.id === product.id && JSON.stringify(item.options || {}) === optionKey
    );

    const newCart = existing
      ? cart.map((item) =>
          item.id === product.id && JSON.stringify(item.options || {}) === optionKey
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      : [...cart, { ...product, options: selectedOptions, quantity: 1 }];

    sessionStorage.setItem('aistage_giftshop_cart', JSON.stringify(newCart));
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-black pb-20 pt-8">
        <div className="px-6">
          <Link
            to={createPageUrl('Boutique')}
            className="inline-flex items-center gap-2 text-white mb-8 transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm tracking-wide">Retour</span>
          </Link>
          <p className="text-white text-center mt-20">Produit non trouvé</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20 pt-8">
      <div className="px-6 max-w-7xl mx-auto">
        <Link
          to={createPageUrl('Boutique')}
          className="inline-flex items-center gap-2 text-white mb-8 transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm tracking-wide">Retour</span>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)] gap-10 lg:gap-14 items-start">
          <div>
            {activeImage && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-neutral-950 border border-white/10 min-h-[420px] lg:min-h-[560px] flex items-center justify-center p-4"
              >
                <img
                  src={activeImage}
                  alt={product.name}
                  className="block max-w-full max-h-[720px] w-auto h-auto object-contain"
                />
              </motion.div>
            )}

            {mockupLoading && galleryImages.length <= 1 && (
              <p className="mt-4 text-white/40 text-xs tracking-wide">
                Préparation de la galerie…
              </p>
            )}

            {galleryImages.length > 1 && (
              <div className="mt-4 grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
                {galleryImages.map((img, idx) => {
                  const selected = img === activeImage;
                  return (
                    <button
                      key={img}
                      type="button"
                      onClick={() => setActiveImage(img)}
                      className={`border bg-neutral-950 p-1 aspect-square transition-colors ${
                        selected ? 'border-white' : 'border-white/20 hover:border-white/60'
                      }`}
                      aria-label={`Afficher l'image ${idx + 1}`}
                    >
                      <img
                        src={img}
                        alt={`${product.name} ${idx + 1}`}
                        className="w-full h-full object-contain"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            {product.dossier_id && (
              <span className="inline-block text-white text-[10px] tracking-widest uppercase bg-neutral-900 border border-white/10 px-3 py-1 mb-3">
                Collection: {product.dossier_id}
              </span>
            )}

            <h1 className="text-white text-3xl lg:text-4xl font-extralight tracking-widest mb-4">
              {product.name}
            </h1>
            <div className="w-12 h-0.5 bg-red-600 mb-8" />

            {(product.product_type || (product.stock !== undefined && product.stock !== null)) && (
              <div className="flex flex-wrap items-center gap-3 mb-4">
                {product.product_type && (
                  <span className="text-white text-xs tracking-wide">
                    {product.product_type}
                  </span>
                )}
                {product.stock !== undefined && product.stock !== null && (
                  <span className="text-white text-xs tracking-wide uppercase border border-white/20 px-2 py-0.5">
                    {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                  </span>
                )}
              </div>
            )}

            {product.sku && (
              <p className="text-white/40 text-[11px] tracking-wide mb-4">
                SKU: {product.sku}
              </p>
            )}

            {productDescription && (
              <p className="text-white/80 font-light leading-relaxed mb-8 whitespace-pre-line">
                {productDescription}
              </p>
            )}

            <div className="flex items-center justify-between mb-8">
              <span className="text-white text-3xl font-light">
                {product.price}
              </span>
            </div>

            {productOptions.length > 0 && (
              <div className="space-y-6 mb-8">
                {productOptions.map((option) => (
                  <div key={option.name}>
                    <p className="text-white text-xs uppercase tracking-widest mb-3">{option.name}</p>
                    <div className="flex flex-wrap gap-2">
                      {(option.values || []).map((value) => {
                        const selected = selectedOptions[option.name] === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() =>
                              setSelectedOptions((current) => ({ ...current, [option.name]: value }))
                            }
                            className={`px-4 py-2 border text-sm transition-colors ${
                              selected
                                ? 'bg-white text-black border-white'
                                : 'bg-neutral-900 text-white border-white/20 hover:border-white/50'
                            }`}
                          >
                            {value}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {product.is_digital && (
              <p className="text-white/60 text-xs uppercase tracking-widest mb-6">
                Digital / downloadable product
              </p>
            )}

            <button
              type="button"
              onClick={addToCart}
              disabled={added || !allOptionsSelected}
              className="w-full h-12 border border-white bg-white text-black font-light tracking-widest inline-flex items-center justify-center gap-2 hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {added ? (
                <>
                  <Check size={18} />
                  Ajouté au panier
                </>
              ) : (
                <>
                  <ShoppingCart size={18} />
                  {allOptionsSelected ? 'Ajouter au panier' : 'Sélectionnez les options'}
                </>
              )}
            </button>

            <Link
              to={createPageUrl('Cart')}
              className="w-full mt-4 h-12 border border-white/30 bg-black text-white font-light tracking-widest inline-flex items-center justify-center hover:bg-neutral-900"
            >
              Voir le panier
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
