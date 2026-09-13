import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function TokenPurchaseModal({ onClose, onPurchased }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState(null);

  useEffect(() => {
    base44.functions.invoke('getUserBalance', {})
      .then((res) => { if (res.data?.packages) setPackages(res.data.packages); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleBuy = async (packageId) => {
    setBuyingId(packageId);
    try {
      const res = await base44.functions.invoke('purchaseTokens', { package_id: packageId });
      if (res.data?.url) {
        window.open(res.data.url, '_blank');
        onPurchased?.();
        onClose?.();
      } else {
        toast.error('Failed to start purchase');
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Purchase failed');
    } finally {
      setBuyingId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-yellow-400 rounded-3xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-black text-xl font-black">Buy Tokens</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20">
            <X size={16} className="text-black" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-black" /></div>
        ) : (
          <div className="space-y-3">
            {packages.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => handleBuy(pkg.id)}
                disabled={!!buyingId}
                className="w-full p-4 bg-black text-yellow-400 rounded-2xl flex items-center justify-between hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <div className="text-left">
                  <p className="font-bold text-lg">{pkg.name}</p>
                  <p className="text-white text-sm">{pkg.token_amount} tokens {pkg.bonus_percentage > 0 ? `+ ${pkg.bonus_percentage}% bonus` : ''}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-xl">${pkg.price}</p>
                  <p className="text-white text-xs">CAD</p>
                </div>
              </button>
            ))}
            {packages.length === 0 && (
              <p className="text-black text-center py-4">No packages available</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}