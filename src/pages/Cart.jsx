import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Trash2, ExternalLink, ShoppingBag, FileText } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Cart() {
  const [cart, setCart] = useState([]);

  const { data: shopSettings = [] } = useQuery({
    queryKey: ['shopSettings'],
    queryFn: () => base44.entities.ShopSettings.list(),
  });

  useEffect(() => {
    const stored = JSON.parse(sessionStorage.getItem('aistage_giftshop_cart') || '[]');
    setCart(stored);
  }, []);

  const updateCart = (newCart) => {
    setCart(newCart);
    sessionStorage.setItem('aistage_giftshop_cart', JSON.stringify(newCart));
  };

  const removeItem = (id, options) => {
    const optionsKey = JSON.stringify(options || {});
    updateCart(cart.filter(item => {
      const itemOptionsKey = JSON.stringify(item.options || {});
      return !(item.id === id && itemOptionsKey === optionsKey);
    }));
  };

  const updateQuantity = (id, options, delta) => {
    const optionsKey = JSON.stringify(options || {});
    updateCart(cart.map(item => {
      const itemOptionsKey = JSON.stringify(item.options || {});
      if (item.id === id && itemOptionsKey === optionsKey) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const getTotalItems = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => {
      const price = parseFloat(item.price.replace(/[^0-9.]/g, ''));
      return sum + (price * item.quantity);
    }, 0);
    
    const tps = subtotal * 0.05;
    const tvq = subtotal * 0.09975;
    const shipping = 0; // À configurer plus tard
    const total = subtotal + tps + tvq + shipping;
    
    return { subtotal, tps, tvq, shipping, total };
  };

  const [isProcessing, setIsProcessing] = useState(false);

  const proceedToCheckout = async () => {
    setIsProcessing(true);
    try {
      const totals = calculateTotals();
      const response = await base44.functions.invoke('createAuthorizeNetCheckout', { 
        cart,
        totals 
      });
      if (response.data.url) {
        window.location.href = response.data.url;
      } else {
        alert('Error creating payment');
      }
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-black pb-20 pt-8 flex flex-col items-center justify-center">
        <ShoppingBag size={48} className="text-white mb-4" />
        <h2 className="text-white text-xl font-light tracking-wide mb-2">Empty cart</h2>
        <p className="text-white text-sm">Add products from the Magazine</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20 pt-8">
    {/* Header */}
    <div className="px-6 mb-8">
      <h1 className="text-white text-3xl font-extralight tracking-widest">CART</h1>
      <div className="w-12 h-0.5 bg-red-600 mt-4" />
      <p className="text-white text-sm mt-4">{getTotalItems()} item(s)</p>
    </div>

      {/* Cart Items */}
      <div className="px-6 space-y-4 mb-24">
        {cart.map((item, idx) => (
          <motion.div
            key={`${item.id}-${idx}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-neutral-950 border border-white/10 rounded-sm overflow-hidden"
          >
            <div className="flex gap-4 p-4">
              {item.image_url && (
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-20 h-20 object-cover rounded"
                />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-light text-sm mb-1 truncate">{item.name}</h3>
                {item.options && Object.keys(item.options).length > 0 && (
                  <p className="text-white text-xs mb-1">
                    {Object.entries(item.options).map(([key, val]) => `${key}: ${val}`).join(' • ')}
                  </p>
                )}
                <p className="text-white text-lg font-light mb-2">{item.price}</p>
                
                {/* Quantity Controls */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => updateQuantity(item.id, item.options, -1)}
                    className="w-6 h-6 bg-neutral-800 text-white hover:text-white rounded flex items-center justify-center text-xs"
                  >
                    −
                  </button>
                  <span className="text-white text-sm w-6 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.options, 1)}
                    className="w-6 h-6 bg-neutral-800 text-white hover:text-white rounded flex items-center justify-center text-xs"
                  >
                    +
                  </button>
                </div>
              </div>
              
              <button
                onClick={() => removeItem(item.id, item.options)}
                className="text-white hover:text-red-500 transition-colors self-start"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Price Summary */}
      <div className="px-6 pb-4 space-y-2">
        <div className="bg-neutral-950 border border-white/10 rounded-sm p-4 space-y-2">
          <div className="flex justify-between text-white text-sm">
            <span>Subtotal</span>
            <span>{calculateTotals().subtotal.toFixed(2)} $</span>
          </div>
          <div className="flex justify-between text-white text-sm">
            <span>Tax (5%)</span>
            <span>{calculateTotals().tps.toFixed(2)} $</span>
          </div>
          <div className="flex justify-between text-white text-sm">
            <span>Tax (9.975%)</span>
            <span>{calculateTotals().tvq.toFixed(2)} $</span>
          </div>
          {calculateTotals().shipping > 0 && (
            <div className="flex justify-between text-white text-sm">
              <span>Shipping</span>
              <span>{calculateTotals().shipping.toFixed(2)} $</span>
            </div>
          )}
          <div className="border-t border-white/10 pt-2 mt-2">
            <div className="flex justify-between text-white text-lg font-light">
              <span>Total</span>
                <span>${calculateTotals().total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Checkout Buttons */}
      <div className="fixed bottom-20 left-0 right-0 px-6 pb-4 bg-gradient-to-t from-black via-black to-transparent pt-8 space-y-3">
        <Link to={createPageUrl('CartExport')}>
          <Button
            variant="outline"
            className="w-full border-white/20 text-white font-light tracking-wide py-6 text-base"
          >
            <FileText size={18} className="mr-2" />
            View order details
          </Button>
        </Link>
        <Button
          onClick={proceedToCheckout}
          disabled={isProcessing}
          className="w-full bg-white text-black hover:bg-white/90 font-light tracking-wide py-6 text-base disabled:opacity-50"
        >
          {isProcessing ? 'Processing...' : `Pay $${calculateTotals().total.toFixed(2)}`}
        </Button>
      </div>
    </div>
  );
}