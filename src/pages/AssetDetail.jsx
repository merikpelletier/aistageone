import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Box, BookmarkPlus, Check, Download, ShieldCheck } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';

export default function AssetDetail({ assetId: assetIdProp = null, embedded = false, onBack = null }) {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [addingToVault, setAddingToVault] = useState(false);
  const [addedToVault, setAddedToVault] = useState(false);
  const [vaultError, setVaultError] = useState('');
  const assetId = assetIdProp || params.get('id');

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

  if (isLoading) return <div className={`${embedded ? 'min-h-[calc(100vh-3.5rem)]' : 'min-h-screen'} bg-yellow-400 flex items-center justify-center font-black`}>LOADING…</div>;

  if (!assetId || error || !asset) {
    return (
      <div className={`${embedded ? 'min-h-[calc(100vh-3.5rem)]' : 'min-h-screen'} bg-yellow-400 px-6 py-10`}>
        {embedded ? <button type="button" onClick={onBack} className="inline-flex items-center gap-2 font-black"><ArrowLeft size={18} /> ASSETS SHOP</button> : <Link to="/Catalog" className="inline-flex items-center gap-2 font-black"><ArrowLeft size={18} /> CATALOG</Link>}
        <div className="mt-16 bg-neutral-950 text-white p-8 border-l-4 border-red-600">Asset not found.</div>
      </div>
    );
  }

  const images = [asset.featured_image, ...(Array.isArray(asset.preview_images) ? asset.preview_images : [])].filter(Boolean);

  const addPlacementToVault = async () => {
    if (!asset.is_product_placement || !asset.featured_image) return;
    if (!user?.email) {
      window.location.assign(`/Login?returnTo=${encodeURIComponent(window.location.href)}`);
      return;
    }
    setAddingToVault(true);
    setVaultError('');
    try {
      const { data: existing, error: existingError } = await supabase
        .from('vault_asset')
        .select('id')
        .eq('user_email', user.email)
        .eq('source_asset_id', asset.id)
        .limit(1);
      if (existingError) throw existingError;
      if (existing?.length) {
        setAddedToVault(true);
        return;
      }
      const { error: insertError } = await supabase.from('vault_asset').insert({
        user_email: user.email,
        created_by_id: user.id,
        name: asset.title,
        url: asset.featured_image,
        media_type: 'image',
        asset_category: 'product_placement',
        source_asset_id: asset.id,
        source_dossier_id: '',
        tags: Array.isArray(asset.tags) ? asset.tags : [],
      });
      if (insertError) throw insertError;
      setAddedToVault(true);
    } catch (error) {
      setVaultError(error?.message || 'Unable to add this placement to your Vault.');
    } finally {
      setAddingToVault(false);
    }
  };

  return (
    <div className={`${embedded ? 'min-h-[calc(100vh-3.5rem)]' : 'min-h-screen'} bg-yellow-400 pb-24 pt-8 text-black`}>
      <div className="px-6 max-w-5xl mx-auto">
        {embedded ? <button type="button" onClick={onBack} className="inline-flex items-center gap-2 font-black tracking-wide mb-8"><ArrowLeft size={18} /> ASSETS SHOP</button> : <Link to="/Catalog" className="inline-flex items-center gap-2 font-black tracking-wide mb-8"><ArrowLeft size={18} /> CATALOG</Link>}

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-neutral-950 border-2 border-black aspect-square overflow-hidden">
            {images[0] ? <img src={images[0]} alt={asset.title} className="w-full h-full object-contain" /> : <div className="w-full h-full flex items-center justify-center text-white/30"><Box size={64} /></div>}
          </div>

          <div>
            <p className="text-xs font-black tracking-[0.25em] uppercase">{asset.is_product_placement ? 'Product placement' : 'Production asset'}</p>
            <h1 className="text-4xl font-black leading-none mt-3">{asset.title}</h1>
            <div className="w-14 h-1 bg-red-600 mt-5" />
            {asset.creator_name && <p className="mt-5 text-sm font-bold">Created by {asset.creator_name}</p>}
            {asset.description && <p className="mt-6 leading-relaxed font-bold">{asset.description}</p>}
            {Array.isArray(asset.tags) && asset.tags.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {asset.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-black/20 bg-white/70 px-3 py-1 text-xs font-black uppercase tracking-wide">{tag}</span>
                ))}
              </div>
            )}

            <div className="mt-8 bg-neutral-950 text-white p-5 space-y-3">
              <div className="flex items-center gap-3"><ShieldCheck className="text-yellow-400" size={20} /><span className="text-sm">Rights verified before delivery</span></div>
              <div className="flex items-center gap-3"><Download className="text-yellow-400" size={20} /><span className="text-sm">Secure temporary download after purchase</span></div>
            </div>

            {asset.is_product_placement ? (
              <div className="mt-5 space-y-3">
                <div className="border-2 border-black bg-white p-4 font-black">
                  AVAILABLE FOR MEMBER PRODUCTIONS — NO PURCHASE REQUIRED
                </div>
                <Button
                  type="button"
                  onClick={addPlacementToVault}
                  disabled={addingToVault || addedToVault}
                  className="w-full h-12 bg-black text-white hover:bg-neutral-800 font-black tracking-wider"
                >
                  {addedToVault ? <><Check size={18} className="mr-2" /> ADDED TO MY VAULT</> : <><BookmarkPlus size={18} className="mr-2" /> {addingToVault ? 'ADDING…' : 'ADD TO MY VAULT'}</>}
                </Button>
                {asset.placement_product_url && (
                  <a href={asset.placement_product_url} target="_blank" rel="noreferrer" className="block text-center text-sm font-bold underline underline-offset-4">
                    Visit brand / product website
                  </a>
                )}
                {vaultError && <div className="border border-red-600 bg-white p-3 text-sm font-bold text-red-700">{vaultError}</div>}
              </div>
            ) : (
              <Button disabled className="w-full mt-5 h-12 bg-red-600 text-white hover:bg-red-600 disabled:opacity-60 font-black tracking-wider">
                PURCHASE COMING NEXT
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
