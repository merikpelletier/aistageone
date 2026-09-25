import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight, ShoppingCart } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Boutique() {
  const [cart] = useState(() => {
    const stored = sessionStorage.getItem('aistage_giftshop_cart');
    return stored ? JSON.parse(stored) : [];
  });

  const [activeCollectionId, setActiveCollectionId] = useState(null);
  const [activeProductType, setActiveProductType] = useState(null);

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.filter({ is_active: true }, 'order'),
    staleTime: 5 * 60 * 1000,
  });

  const { data: sections = [], isLoading: sectionsLoading } = useQuery({
    queryKey: ['shopSections'],
    queryFn: () => base44.entities.ShopSection.filter({ is_active: true }, 'order'),
    staleTime: 5 * 60 * 1000,
  });

  const topLevelSections = sections.filter(section => !section.parent_section_id);
  const productTypes = Array.from(
    new Set(products.map(product => product.product_type).filter(Boolean))
  );

  const sortedByOrder = [...products].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
  const featuredProducts = sortedByOrder.slice(0, 4);
  const popularProducts = sortedByOrder.slice(4, 8).length
    ? sortedByOrder.slice(4, 8)
    : sortedByOrder.slice(0, 4);
  const newArrivals = [...products]
    .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0))
    .slice(0, 4);

  const heroSection = topLevelSections.find(section => section.banner_image) || topLevelSections[0];
  const heroImage =
    heroSection?.banner_image ||
    products.find(product => product.image_url)?.image_url ||
    '';

  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const isLoading = productsLoading || sectionsLoading;

  const getCollectionProducts = (sectionId) =>
    products.filter(product => product.section_id === sectionId);

  const getCollectionImage = (section) =>
    section.banner_image ||
    section.promo_image ||
    getCollectionProducts(section.id).find(product => product.image_url)?.image_url ||
    '';

  const getTypeImage = (type) =>
    products.find(product => product.product_type === type && product.image_url)?.image_url || '';

  const renderProductCards = (items) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
      {items.map((product, idx) => (
        <Link
          key={product.id}
          to={`${createPageUrl('ProductDetail')}?id=${product.id}`}
          className="block"
        >
          <motion.article
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="h-full bg-neutral-950 border border-white/10 overflow-hidden group hover:border-white/30 transition-colors"
          >
            {product.image_url && (
              <div className="aspect-square bg-white overflow-hidden">
                <img
                  src={product.image_url}
                  alt={product.name || ''}
                  className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>
            )}
            <div className="p-4">
              <p className="text-white/45 text-[11px] uppercase tracking-[0.18em] mb-2">
                {product.product_type || 'Gift Shop'}
              </p>
              <h3 className="text-white text-base font-light leading-snug">
                {product.name}
              </h3>
              <div className="mt-3 text-white text-lg font-light">{product.price}</div>
            </div>
          </motion.article>
        </Link>
      ))}
    </div>
  );

  const scrollToCollections = () => {
    document.getElementById('shop-collections')?.scrollIntoView({ behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <header className="px-6 pt-6 pb-5 flex items-center justify-between border-b border-white/10">
        <div>
          <p className="text-white/45 text-[11px] uppercase tracking-[0.28em]">AISTAGE.ONE</p>
          <h1 className="text-2xl md:text-3xl font-extralight tracking-widest mt-1">Gift Shop</h1>
        </div>
        <Link to={createPageUrl('Cart')}>
          <Button
            variant="outline"
            className="border-white/20 text-white bg-neutral-900 hover:bg-neutral-800 relative"
          >
            <ShoppingCart size={18} />
            {cartItemsCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs w-5 h-5 flex items-center justify-center">
                {cartItemsCount}
              </span>
            )}
          </Button>
        </Link>
      </header>

      <section className="px-6 pt-6">
        <div className="relative min-h-[360px] md:min-h-[460px] overflow-hidden border border-white/10 bg-neutral-950">
          {heroImage && (
            <img
              src={heroImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/15" />
          <div className="relative z-10 min-h-[360px] md:min-h-[460px] flex items-center">
            <div className="max-w-2xl p-8 md:p-12">
              <p className="text-white/60 text-xs uppercase tracking-[0.24em] mb-4">
                Official merchandise
              </p>
              <h2 className="text-4xl md:text-6xl font-extralight leading-[1.02] tracking-tight">
                Wear the stories.
                <br />
                Collect the worlds.
              </h2>
              <p className="text-white/75 text-sm md:text-base leading-relaxed mt-5 max-w-xl">
                Discover apparel, objects and collectibles inspired by AISTAGE.ONE series,
                characters and original worlds.
              </p>
              <button
                type="button"
                onClick={scrollToCollections}
                className="mt-7 h-11 px-5 bg-white text-black text-sm inline-flex items-center gap-2 hover:bg-white/90"
              >
                Explore the shop
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {topLevelSections.length > 0 && (
        <section id="shop-collections" className="px-6 pt-14">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <p className="text-white/40 text-xs uppercase tracking-[0.22em]">Stories & worlds</p>
              <h2 className="text-2xl font-light mt-1">Shop by Collection</h2>
            </div>
            {activeCollectionId && (
              <button
                type="button"
                onClick={() => setActiveCollectionId(null)}
                className="text-white/55 text-xs hover:text-white"
              >
                Show all
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {topLevelSections.map((section) => {
              const image = getCollectionImage(section);
              const productCount = getCollectionProducts(section.id).length;
              return (
                <button
                  type="button"
                  key={section.id}
                  onClick={() =>
                    setActiveCollectionId(
                      activeCollectionId === section.id ? null : section.id
                    )
                  }
                  className={`relative text-left min-h-[220px] overflow-hidden border transition-colors ${
                    activeCollectionId === section.id
                      ? 'border-white'
                      : 'border-white/10 hover:border-white/35'
                  }`}
                >
                  {image && (
                    <img
                      src={image}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
                  <div className="relative z-10 min-h-[220px] flex flex-col justify-end p-5">
                    <h3 className="text-xl font-light">{section.name}</h3>
                    <p className="text-white/60 text-xs mt-1">
                      {productCount} {productCount === 1 ? 'product' : 'products'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {activeCollectionId && (
            <div className="mt-8 border-t border-white/10 pt-8">
              {renderProductCards(getCollectionProducts(activeCollectionId))}
            </div>
          )}
        </section>
      )}

      {productTypes.length > 0 && (
        <section className="px-6 pt-14">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <p className="text-white/40 text-xs uppercase tracking-[0.22em]">Browse the shop</p>
              <h2 className="text-2xl font-light mt-1">Shop by Product Type</h2>
            </div>
            {activeProductType && (
              <button
                type="button"
                onClick={() => setActiveProductType(null)}
                className="text-white/55 text-xs hover:text-white"
              >
                Show all
              </button>
            )}
          </div>

          <div className="flex gap-4 overflow-x-auto pb-3">
            {productTypes.map((type) => {
              const image = getTypeImage(type);
              return (
                <button
                  type="button"
                  key={type}
                  onClick={() => setActiveProductType(activeProductType === type ? null : type)}
                  className={`relative shrink-0 w-[210px] h-[170px] overflow-hidden border text-left ${
                    activeProductType === type
                      ? 'border-white'
                      : 'border-white/10 hover:border-white/35'
                  }`}
                >
                  {image && (
                    <img src={image} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                  <div className="relative z-10 h-full flex items-end p-4">
                    <span className="text-base font-light">{type}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {activeProductType && (
            <div className="mt-6">
              {renderProductCards(
                products.filter(product => product.product_type === activeProductType)
              )}
            </div>
          )}
        </section>
      )}

      {featuredProducts.length > 0 && (
        <section className="px-6 pt-14">
          <div className="mb-6">
            <p className="text-white/40 text-xs uppercase tracking-[0.22em]">Curated for the shop</p>
            <h2 className="text-2xl font-light mt-1">Featured Products</h2>
          </div>
          {renderProductCards(featuredProducts)}
        </section>
      )}

      {popularProducts.length > 0 && products.length > 4 && (
        <section className="px-6 pt-14">
          <div className="mb-6">
            <p className="text-white/40 text-xs uppercase tracking-[0.22em]">More to discover</p>
            <h2 className="text-2xl font-light mt-1">Popular Picks</h2>
          </div>
          {renderProductCards(popularProducts)}
        </section>
      )}

      {newArrivals.length > 0 && (
        <section className="px-6 pt-14">
          <div className="mb-6">
            <p className="text-white/40 text-xs uppercase tracking-[0.22em]">Recently added</p>
            <h2 className="text-2xl font-light mt-1">New Arrivals</h2>
          </div>
          {renderProductCards(newArrivals)}
        </section>
      )}

      {products.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-white text-sm">Shop coming soon...</p>
        </div>
      )}
    </div>
  );
}
