import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Download, Loader2, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Downloads() {
  const [downloadingId, setDownloadingId] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['giftShopDownloads'],
    queryFn: async () => {
      const response = await base44.functions.invoke('gift-shop-downloads', {});
      return response.data?.downloads || [];
    },
  });

  const handleDownload = async (productId) => {
    setDownloadingId(productId);
    try {
      const response = await base44.functions.invoke('gift-shop-r2-download', {
        product_id: productId,
      });
      const url = response.data?.url;
      if (!url) throw new Error('Download link unavailable');
      window.location.assign(url);
    } catch (downloadError) {
      alert(downloadError?.message || 'Unable to download this file');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-24 pt-8">
      <div className="px-6 max-w-4xl mx-auto">
        <div className="mb-10">
          <p className="text-white/50 text-xs uppercase tracking-[0.25em] mb-2">AISTAGE ONE Gift Shop</p>
          <h1 className="text-3xl font-extralight tracking-widest">MY DOWNLOADS</h1>
          <div className="w-12 h-0.5 bg-red-600 mt-4" />
        </div>

        {isLoading && (
          <div className="py-20 flex justify-center">
            <Loader2 className="animate-spin" size={28} />
          </div>
        )}

        {error && (
          <div className="border border-red-500/30 bg-red-500/10 p-4 text-sm">
            {error.message || 'Unable to load your downloads.'}
          </div>
        )}

        {!isLoading && !error && data?.length === 0 && (
          <div className="border border-white/10 bg-neutral-950 p-8 text-center">
            <ShoppingBag size={32} className="mx-auto mb-4 text-white/50" />
            <p className="text-white/70 mb-5">No downloadable purchases yet.</p>
            <Link to={createPageUrl('Boutique')}>
              <Button className="bg-white text-black hover:bg-white/90">Open Gift Shop</Button>
            </Link>
          </div>
        )}

        <div className="space-y-4">
          {(data || []).map((item) => (
            <div
              key={item.id}
              className="border border-white/10 bg-neutral-950 p-4 flex flex-col sm:flex-row gap-4 sm:items-center"
            >
              {item.image_url && (
                <img
                  src={item.image_url}
                  alt=""
                  className="w-full sm:w-28 h-24 object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-light">{item.name}</h2>
                {item.description && (
                  <p className="text-white/60 text-sm mt-1 line-clamp-2">{item.description}</p>
                )}
                {item.payment_date && (
                  <p className="text-white/40 text-xs mt-2">
                    Purchased {new Date(item.payment_date).toLocaleDateString()}
                  </p>
                )}
              </div>
              <Button
                type="button"
                onClick={() => handleDownload(item.id)}
                disabled={downloadingId === item.id}
                className="bg-white text-black hover:bg-white/90"
              >
                {downloadingId === item.id ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <Download size={16} className="mr-2" />
                )}
                Download
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
