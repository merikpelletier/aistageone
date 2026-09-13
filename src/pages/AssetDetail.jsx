import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Box, Download, ShieldCheck } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';

export default function AssetDetail() {
  const [params] = useSearchParams();
  const assetId = params.get('id');

  const { data: asset, isLoading, error } = useQuery({
    queryKey: ['catalog-asset', assetId],
    queryFn: async () => {
      const { data, error: assetError } = await supabase
        .from('catalog_asset')
        .select('*')
        .eq('id', assetId)
        .single();

      if (assetError) throw assetError;
      return data;
    },
    enabled: Boolean(assetId),
  });

  if (isLoading) return <div className="min-h-screen bg-yellow-400 flex items-center justify-center font-black">LOADING…</div>;

  if (!assetId || error || !asset) {
    return (
      <div className="min-h-screen bg-yellow-400 px-6 py-10">
        <Link to="/Catalog" className="inline-flex items-center gap-2 font-black"><ArrowLeft size={18} /> CATALOG</Link>
        <div className="mt-16 bg-neutral-950 text-white p-8 border-l-4 border-red-600">Asset not found.</div>
      </div>
    );
  }

  const images = [asset.featured_image, ...(Array.isArray(asset.preview_images) ? asset.preview_images : [])].filter(Boolean);

  return (
    <div className="min-h-screen bg-yellow-400 pb-24 pt-8 text-black">
      <div className="px-6 max-w-5xl mx-auto">
        <Link to="/Catalog" className="inline-flex items-center gap-2 font-black tracking-wide mb-8"><ArrowLeft size={18} /> CATALOG</Link>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-neutral-950 border-2 border-black aspect-square overflow-hidden">
            {images[0] ? <img src={images[0]} alt={asset.title} className="w-full h-full object-contain" /> : <div className="w-full h-full flex items-center justify-center text-white/30"><Box size={64} /></div>}
          </div>

          <div>
            <p className="text-xs font-black tracking-[0.25em] uppercase">Production asset</p>
            <h1 className="text-4xl font-black leading-none mt-3">{asset.title}</h1>
            <div className="w-14 h-1 bg-red-600 mt-5" />
            {asset.creator_name && <p className="mt-5 text-sm font-bold">Created by {asset.creator_name}</p>}
            {asset.description && <p className="mt-6 leading-relaxed font-bold">{asset.description}</p>}

            <div className="mt-8 bg-neutral-950 text-white p-5 space-y-3">
              <div className="flex items-center gap-3"><ShieldCheck className="text-yellow-400" size={20} /><span className="text-sm">Rights verified before delivery</span></div>
              <div className="flex items-center gap-3"><Download className="text-yellow-400" size={20} /><span className="text-sm">Secure temporary download after purchase</span></div>
            </div>

            <Button disabled className="w-full mt-5 h-12 bg-red-600 text-white hover:bg-red-600 disabled:opacity-60 font-black tracking-wider">
              PURCHASE COMING NEXT
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
