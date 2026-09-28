import React, { useEffect, useState } from 'react';
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
  const [activeImageIndex, setActiveImageIndex] = useState(0);
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

  if (isLoading) return <div className={`${embedded ? 'min-h-[calc(100vh-3.5rem)]' : 'min-h-screen'} bg-zinc-950 flex items-center justify-center font-black text-white`}>LOADING…</div>;

  if (!assetId || error || !asset) {
    return (
      <div className={`${embedded ? 'min-h-[calc(100vh-3.5rem)]' : 'min-h-screen'} bg-zinc-950 px-6 py-10 text-white`}>
        {embedded ? <button type="button" onClick={onBack} className="inline-flex items-center gap-2 font-black"><ArrowLeft size={18} /> ASSETS SHOP</button> : <Link to="/Catalog" className="inline-flex items-center gap-2 font-black"><ArrowLeft size={18} /> CATALOG</Link>}
        <div className="mt-16 bg-neutral-950 text-white p-8 border-l-4 border-red-600">Asset not found.</div>
      </div>
    );
  }

  const images = [...new Set([asset.featured_image, ...(Array.isArray(asset.preview_images) ? asset.preview_images : [])].filter(Boolean))];

  useEffect(() => {
    setActiveImageIndex(0);
  }, [assetId]);

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
        author_name: asset.creator_name || asset.placement_source_name || 'AISTAGE.ONE',
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
    <div className={`${embedded ? 'min-h-[calc(100vh-3.5rem)]' : 'min-h-screen'} bg-zinc-950 pb-28 pt-6 text-white`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {embedded ? (
          <button type="button" onClick={onBack} className="mb-6 inline-flex items-center gap-2 text-sm font-black tracking-wide text-zinc-300 hover:text-cyan-300"><ArrowLeft size={18} /> ASSETS SHOP</button>
        ) : (
          <Link to="/Catalog" className="mb-6 inline-flex items-center gap-2 text-sm font-black tracking-wide text-zinc-300 hover:text-cyan-300"><ArrowLeft size={18} /> ASSETS SHOP</Link>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)]">
          <section className="min-w-0">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
              <div className="flex min-h-[360px] items-center justify-center bg-black sm:min-h-[520px] lg:min-h-[620px]">
                {images[activeImageIndex] ? (
                  <img src={images[activeImageIndex]} alt={asset.title} className="max-h-[72vh] w-full object-contain" />
                ) : (
                  <div className="flex h-full min-h-[420px] w-full items-center justify-center text-zinc-700"><Box size={72} /></div>
                )}
              </div>
            </div>

            {images.length > 1 && (
              <div className="mt-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Files</p>
                  <p className="text-xs font-bold text-zinc-500">{activeImageIndex + 1} / {images.length}</p>
                </div>
                <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7">
                  {images.map((imageUrl, index) => (
                    <button
                      key={imageUrl}
                      type="button"
                      onClick={() => setActiveImageIndex(index)}
                      className={`aspect-square overflow-hidden rounded-xl border-2 bg-black transition ${activeImageIndex === index ? 'border-cyan-400' : 'border-white/10 hover:border-white/30'}`}
                      aria-label={`View file ${index + 1}`}
                    >
                      <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl border border-white/10 bg-zinc-900 p-6 sm:p-7">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-400">{asset.is_product_placement ? 'Product placement' : 'Production asset'}</p>
              <h1 className="mt-3 text-4xl font-black leading-none sm:text-5xl">{asset.title}</h1>
              <div className="mt-5 h-1 w-14 bg-cyan-400" />

              <div className="mt-5 space-y-1 text-sm font-bold text-zinc-400">
                <p><span className="text-zinc-200">Author:</span> {asset.creator_name || asset.placement_source_name || 'AISTAGE.ONE'}</p>
                {asset.created_at && <p><span className="text-zinc-200">Added:</span> {new Date(asset.created_at).toLocaleDateString()}</p>}
                {images.length > 0 && <p><span className="text-zinc-200">Files:</span> {images.length}</p>}
              </div>

              {asset.description && <p className="mt-6 leading-relaxed text-zinc-300">{asset.description}</p>}

              {Array.isArray(asset.tags) && asset.tags.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2">
                  {asset.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs font-bold uppercase tracking-wide text-zinc-300">{tag}</span>
                  ))}
                </div>
              )}

              <div className="mt-7 space-y-3 border-y border-white/10 py-5">
                <div className="flex items-center gap-3"><ShieldCheck className="text-cyan-400" size={20} /><span className="text-sm text-zinc-300">Rights verified before delivery</span></div>
                {!asset.is_product_placement && <div className="flex items-center gap-3"><Download className="text-cyan-400" size={20} /><span className="text-sm text-zinc-300">Secure temporary download after purchase</span></div>}
              </div>

              {asset.is_product_placement ? (
                <div className="mt-6 space-y-3">
                  <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-4 text-sm font-black text-cyan-200">
                    AVAILABLE FOR MEMBER PRODUCTIONS — NO PURCHASE REQUIRED
                  </div>
                  <Button
                    type="button"
                    onClick={addPlacementToVault}
                    disabled={addingToVault || addedToVault}
                    className="h-12 w-full bg-cyan-400 font-black tracking-wider text-black hover:bg-cyan-300"
                  >
                    {addedToVault ? <><Check size={18} className="mr-2" /> ADDED TO MY VAULT</> : <><BookmarkPlus size={18} className="mr-2" /> {addingToVault ? 'ADDING…' : 'ADD TO MY VAULT'}</>}
                  </Button>
                  {asset.placement_product_url && (
                    <a href={asset.placement_product_url} target="_blank" rel="noreferrer" className="block text-center text-sm font-bold text-cyan-300 underline underline-offset-4">
                      Visit brand / product website
                    </a>
                  )}
                  {vaultError && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-200">{vaultError}</div>}
                </div>
              ) : (
                <Button disabled className="mt-6 h-12 w-full bg-zinc-800 font-black tracking-wider text-zinc-400 disabled:opacity-100">
                  PURCHASE COMING NEXT
                </Button>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
