import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ShoppingCart } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Boutique() {
  const [cart, setCart] = useState(() => {
    const stored = sessionStorage.getItem('aistage_giftshop_cart');
    return stored ? JSON.parse(stored) : [];
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.filter({ is_active: true }, 'order'),
    staleTime: 5 * 60 * 1000,
  });

  const categories = {
    product: 'Products',
    access: 'Access',
    support: 'Support'
  };

  const groupedProducts = products.reduce((acc, product) => {
    const cat = product.category || 'product';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(product);
    return acc;
  }, {});

  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20 pt-8">
      <div className="px-6 mb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-3xl font-extralight tracking-widest">AISTAGE ONE Gift Shop</h1>
            <div className="w-12 h-0.5 bg-red-600 mt-4" />
          </div>
          <Link to={createPageUrl('Cart')}>
            <Button 
              variant="outline" 
              className="border-white/20 text-white hover:bg-white hover:text-black relative"
            >
              <ShoppingCart size={18} />
              {cartItemsCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {cartItemsCount}
                </span>
              )}
            </Button>
          </Link>
        </div>
        <p className="text-white text-sm mt-4 font-light">
          Add items to your cart and complete your order.
        </p>
      </div>

      {Object.entries(groupedProducts).map(([category, categoryProducts], catIdx) => (
        <div key={category} className="mb-12">
          <h2 className="px-6 text-white text-xs tracking-widest mb-6">
            {categories[category]?.toUpperCase()}
          </h2>
          
          <div className="px-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {categoryProducts.map((product, idx) => (
              <Link
                key={product.id}
                to={`${createPageUrl('ProductDetail')}?id=${product.id}`}
                className="block"
              >
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (catIdx * 0.1) + (idx * 0.1) }}
                  className="bg-neutral-950 border border-white/10 rounded-sm overflow-hidden group hover:border-white/30 transition-colors cursor-pointer"
                >
                  {product.image_url && (
                    <div className="aspect-[4/3] overflow-hidden">
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                  )}
                  
                  <div className="p-6">
                    <h3 className="text-white text-lg font-extralight tracking-wide mb-2">
                      {product.name}
                    </h3>
                    {product.description && (
                      <p className="text-white text-sm mb-4 font-light leading-relaxed line-clamp-2">
                        {product.description}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-white text-xl font-light">
                        {product.price}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {products.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-white text-sm">Shop coming soon...</p>
        </div>
      )}
    </div>
  );
}