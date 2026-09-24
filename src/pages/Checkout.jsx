import React from 'react';
import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Checkout() {
  return <Navigate to={createPageUrl('Cart')} replace />;
}

function LegacyCheckout() {
  const [cart, setCart] = React.useState([]);

  useEffect(() => {
    // Get cart from sessionStorage
    const stored = sessionStorage.getItem('cochon_cart');
    if (stored) {
      setCart(JSON.parse(stored));
    }
  }, []);

  useEffect(() => {
    // Save cart to sessionStorage
    sessionStorage.setItem('cochon_cart', JSON.stringify(cart));
  }, [cart]);

  const updateQuantity = (productId, change) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        const newQuantity = Math.max(0, item.quantity + change);
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : null;
      }
      return item;
    }).filter(Boolean));
  };

  const removeItem = (productId) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-black pb-20 pt-8">
        <div className="px-6">
          <Link to={createPageUrl('Boutique')}>
            <Button variant="ghost" className="text-white hover:text-white mb-6 -ml-4">
              <ArrowLeft size={18} className="mr-2" />
              Back
            </Button>
          </Link>

          <h1 className="text-white text-3xl font-extralight tracking-widest mb-4">CART</h1>
          <div className="w-12 h-0.5 bg-red-600 mb-12" />

          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-white text-sm mb-6">Your cart is empty</p>
            <Link to={createPageUrl('Boutique')}>
              <Button className="bg-white text-black hover:bg-white/90">
                View store
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20 pt-8">
      <div className="px-6">
        <Link to={createPageUrl('Boutique')}>
          <Button variant="ghost" className="text-white hover:text-white mb-6 -ml-4">
            <ArrowLeft size={18} className="mr-2" />
            Back
          </Button>
        </Link>

        <h1 className="text-white text-3xl font-extralight tracking-widest mb-4">CART</h1>
        <div className="w-12 h-0.5 bg-red-600 mb-8" />

        {/* Cart Items */}
        <div className="space-y-4 mb-8">
          {cart.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="bg-neutral-950 border border-white/10 rounded-sm p-4"
            >
              <div className="flex gap-4">
                {item.image_url && (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-20 h-20 object-cover rounded-sm"
                  />
                )}
                <div className="flex-1">
                  <h3 className="text-white font-light mb-1">{item.name}</h3>
                  <p className="text-white text-sm mb-3">{item.price}</p>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-neutral-900 rounded-sm">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="p-2 text-white hover:text-white"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="text-white text-sm w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="p-2 text-white hover:text-white"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-2 text-white hover:text-red-500 ml-auto"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Payment Links */}
        <div className="bg-neutral-950 border border-white/10 rounded-sm p-6 mb-6">
          <h2 className="text-white font-light text-lg mb-4 tracking-wide">COMPLETE ORDER</h2>
          <p className="text-white text-sm mb-6">
            Proceed to payment for each item on secure external pages.
          </p>
          
          <div className="space-y-3">
            {cart.map((item) => (
              <a
                key={item.id}
                href={item.external_link}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button
                  variant="outline"
                  className="w-full border-white/20 text-white hover:bg-white hover:text-black justify-between"
                >
                  <span>{item.name} (×{item.quantity})</span>
                  <ExternalLink size={16} />
                </Button>
              </a>
            ))}
          </div>

          <button
            onClick={clearCart}
            className="w-full mt-6 text-white hover:text-white text-sm py-2 transition-colors"
          >
            Clear cart
          </button>
        </div>

        <p className="text-white text-xs text-center">
          Payments are processed securely on external platforms.
        </p>
      </div>
    </div>
  );
}