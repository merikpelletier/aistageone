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
    const cart = JSON.parse(sessionStorage.getItem('cochon_cart') || '[]');
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
    
    sessionStorage.setItem('cochon_cart', JSON.stringify(newCart));
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

        {/* Product Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h1 className="text-white text-3xl font-extralight tracking-widest mb-4">
            {product.name}
          </h1>
          <div className="w-12 h-0.5 bg-red-600 mb-8" />

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
          <Link to={createPageUrl('Checkout')}>
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