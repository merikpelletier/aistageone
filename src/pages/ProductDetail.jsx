import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShoppingCart, Check } from 'lucide-react';

export default function ProductDetail() {
  const [searchParams] = useSearchParams();
  const productId = searchParams.get('id');
  
  const [added, setAdded] = useState(false);
  
  const { data: rawProducts = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const product = rawProducts.find(p => p.id === productId);

  const addToCart = () => {
    const cart = JSON.parse(sessionStorage.getItem('aistage_giftshop_cart') || '[]');
    const existing = cart.find(item => item.id === product.id);
    
    let newCart;
    if (existing) {
      newCart = cart.map(item => 
        item.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    } else {
      newCart = [...cart, { ...product, quantity: 1 }];
    }
    
    sessionStorage.setItem('aistage_giftshop_cart', JSON.stringify(newCart));
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  if (!product) {
    return (
      <div className="min-h-screen bg-black pb-20 pt-8">
        <div className="px-6">
          <Link
            to={createPageUrl('Boutique')}
            className="inline-flex items-center gap-2 text-white hover:text-white mb-8 transition-colors"
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
      <div className="px-6">
        {/* Back Button */}
        <Link
          to={createPageUrl('Boutique')}
          className="inline-flex items-center gap-2 text-white hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm tracking-wide">Retour</span>
        </Link>

        {/* Product Image */}
        {product.image_url && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 aspect-[4/3] rounded-sm overflow-hidden"
          >
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </motion.div>
        )}

        {/* Secondary Images Gallery */}
        {product.images && product.images.length > 0 && (
          <div className="mb-8 grid grid-cols-3 gap-2">
            {product.images.map((img, idx) => (
              <div key={idx} className="aspect-square rounded-sm overflow-hidden">
                <img
                  src={img}
                  alt={`${product.name} ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}

        {/* Product Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {product.dossier_id && (
            <span className="inline-block text-white text-[10px] tracking-widest uppercase bg-neutral-900 border border-white/10 rounded-full px-3 py-1 mb-3">
              Collection: {product.dossier_id}
            </span>
          )}

          <h1 className="text-white text-3xl font-extralight tracking-widest mb-4">
            {product.name}
          </h1>
          <div className="w-12 h-0.5 bg-red-600 mb-8" />

          {(product.product_type || product.stock !== undefined) && (
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {product.product_type && (
                <span className="text-white text-xs tracking-wide">
                  {product.product_type}
                </span>
              )}
              {product.stock !== undefined && product.stock !== null && (
                <span className="text-white text-xs tracking-wide uppercase border border-white/20 rounded px-2 py-0.5">
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

          {product.description && (
            <p className="text-white font-light leading-relaxed mb-8">
              {product.description}
            </p>
          )}

          <div className="flex items-center justify-between mb-8">
            <span className="text-white text-3xl font-light">
              {product.price}
            </span>
          </div>

          {/* Add to Cart Button */}
          <Button
            onClick={addToCart}
            className="w-full bg-white text-black hover:bg-white/90 font-light tracking-widest h-12"
            disabled={added}
          >
            {added ? (
              <>
                <Check size={18} className="mr-2" />
                Ajouté au panier
              </>
            ) : (
              <>
                <ShoppingCart size={18} className="mr-2" />
                Ajouter au panier
              </>
            )}
          </Button>

          {/* View Cart Link */}
          <Link to={createPageUrl('Cart')}>
            <Button
              variant="outline"
              className="w-full mt-4 border-white/20 text-white hover:bg-white hover:text-black"
            >
              Voir le panier
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}