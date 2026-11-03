import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Box, BookmarkPlus, Check, ChevronLeft, ChevronRight, Download, Music2, Play, ShieldCheck, Sparkles, X } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';

function MediaThumb({ item }) {
  if (item?.type === 'video') {
    return (
      <div className="relative h-full w-full bg-black">
        <video src={item.url} muted preload="metadata" className="h-full w-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/25"><Play size={24} className="text-white" /></div>
      </div>
    );
  }
  if (item?.type === 'audio') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-zinc-900 px-3 text-center">
        <Music2 size={26} className="text-cyan-300" />
        <span className="line-clamp-2 text-[11px] font-bold text-zinc-300">{item.title || 'Audio'}</span>
      </div>
    );
  }
  return <img src={item?.url} alt="" className="h-full w-full object-cover" />;
}

function MediaViewer({ item, index, count, onClose, onPrevious, onNext }) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Preview media viewer">
      <div className="flex items-center justify-between gap-4 pb-3 text-white">
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Preview</div>
          {item.title && <div className="mt-1 truncate text-sm font-bold text-zinc-200">{item.title}</div>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-zinc-400">{index + 1} / {count}</span>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Close preview"><X size={22} /></button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-black">
        {item.type === 'video' ? (
          <video key={item.url} src={item.url} controls autoPlay className="max-h-full max-w-full object-contain" />
        ) : item.type === 'audio' ? (
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-900 p-8 text-center">
            <Music2 size={54} className="mx-auto text-cyan-300" />
            <div className="mt-4 text-lg font-black text-white">{item.title || 'Audio preview'}</div>
            <audio key={item.url} src={item.url} controls autoPlay className="mt-6 w-full" />
          </div>
        ) : (
          <img src={item.url} alt={item.title || 'AI Pilot preview'} className="max-h-full max-w-full object-contain" />
        )}

        {count > 1 && (
          <>
            <button type="button" onClick={onPrevious} className="absolute left-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white hover:bg-black/85 sm:left-4" aria-label="Previous preview"><ChevronLeft size={28} /></button>
            <button type="button" onClick={onNext} className="absolute right-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white hover:bg-black/85 sm:right-4" aria-label="Next preview"><ChevronRight size={28} /></button>
          </>
        )}
      </div>
    </div>
  );
}

export default function AssetDetail({ assetId: assetIdProp = null, embedded = false, onBack = null }) {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const previewStripRef = useRef(null);
  const [addingToVault, setAddingToVault] = useState(false);
  const [addedToVault, setAddedToVault] = useState(false);
  const [vaultError, setVaultError] = useState('');
  const [acquiringPilot, setAcquiringPilot] = useState(false);
  const [pilotError, setPilotError] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(null);
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

  const { data: aiPilot, isLoading: pilotLoading } = useQuery({
    queryKey: ['catalog-ai-pilot', assetId],
    queryFn: async () => {
      const { data, error: pilotLookupError } = await supabase
        .from('ai_pilots')
        .select('id,name,status,distribution_mode,current_published_version_id,catalog_asset_id')
        .eq('catalog_asset_id', String(assetId))
        .eq('status', 'published')
        .eq('distribution_mode', 'assets_shop')
        .maybeSingle();
      if (pilotLookupError) throw pilotLookupError;
      return data || null;
    },
    enabled: Boolean(assetId),
  });

  const { data: ownedPilot, isLoading: ownershipLoading } = useQuery({
    queryKey: ['member-ai-pilot-ownership', user?.id, aiPilot?.id],
    queryFn: async () => {
      const { data, error: ownershipError } = await supabase
        .from('member_ai_pilots')
        .select('id,ai_pilot_id,version_id,source_asset_id')
        .eq('user_id', user.id)
        .eq('ai_pilot_id', aiPilot.id)
        .maybeSingle();
      if (ownershipError) throw ownershipError;
      return data || null;
    },
    enabled: Boolean(user?.id && aiPilot?.id),
  });

  const images = useMemo(() => [...new Set([asset?.featured_image, ...(Array.isArray(asset?.preview_images) ? asset.preview_images : [])].filter(Boolean))], [asset?.featured_image, asset?.preview_images]);
  const previewMedia = useMemo(() => {
    if (!aiPilot) return images.map((url) => ({ type: 'image', url, title: '' }));
    const stored = Array.isArray(asset?.preview_media) && asset.preview_media.length
      ? asset.preview_media.filter((item) => item?.url).map((item) => ({ type: item.type || 'image', url: item.url, title: item.title || '' }))
      : (Array.isArray(asset?.preview_images) ? asset.preview_images : []).filter(Boolean).map((url) => ({ type: 'image', url, title: '' }));
    const combined = asset?.featured_image ? [{ type: 'image', url: asset.featured_image, title: asset.title || '' }, ...stored] : stored;
    return combined.filter((item, index, list) => list.findIndex((candidate) => candidate.url === item.url) === index);
  }, [aiPilot, images, asset?.featured_image, asset?.preview_images, asset?.preview_media, asset?.title]);

  useEffect(() => {
    setActiveImageIndex(0);
    setPilotError('');
    setShowFullDescription(false);
    setViewerIndex(null);
  }, [assetId]);

  useEffect(() => {
    if (viewerIndex === null) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setViewerIndex(null);
      if (event.key === 'ArrowLeft' && previewMedia.length > 1) setViewerIndex((current) => (current - 1 + previewMedia.length) % previewMedia.length);
      if (event.key === 'ArrowRight' && previewMedia.length > 1) setViewerIndex((current) => (current + 1) % previewMedia.length);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [viewerIndex, previewMedia.length]);

  if (isLoading || pilotLoading) return <div className={`${embedded ? 'min-h-[calc(100vh-3.5rem)]' : 'min-h-screen'} bg-zinc-950 flex items-center justify-center font-black text-white`}>LOADING…</div>;

  if (!assetId || error || !asset) {
    return (
      <div className={`${embedded ? 'min-h-[calc(100vh-3.5rem)]' : 'min-h-screen'} bg-zinc-950 px-6 py-10 text-white`}>
        {embedded ? <button type="button" onClick={onBack} className="inline-flex items-center gap-2 font-black"><ArrowLeft size={18} /> ASSETS SHOP</button> : <Link to="/Catalog" className="inline-flex items-center gap-2 font-black"><ArrowLeft size={18} /> CATALOG</Link>}
        <div className="mt-16 bg-neutral-950 text-white p-8 border-l-4 border-red-600">Asset not found.</div>
      </div>
    );
  }

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

  const acquireAiPilot = async () => {
    if (!aiPilot?.id || !aiPilot.current_published_version_id) return;
    if (!user?.id || !user?.email) {
      window.location.assign(`/Login?returnTo=${encodeURIComponent(window.location.href)}`);
      return;
    }
    setAcquiringPilot(true);
    setPilotError('');
    try {
      const { error: insertError } = await supabase.from('member_ai_pilots').insert({
        user_id: user.id,
        user_email: user.email,
        ai_pilot_id: aiPilot.id,
        version_id: aiPilot.current_published_version_id,
        access_source: 'assets_shop',
        source_asset_id: String(asset.id),
      });
      if (insertError && insertError.code !== '23505') throw insertError;
      await queryClient.invalidateQueries({ queryKey: ['member-ai-pilot-ownership', user.id, aiPilot.id] });
      await queryClient.invalidateQueries({ queryKey: ['member-ai-pilots', user.id] });
    } catch (acquireError) {
      setPilotError(acquireError?.message || 'Unable to add this AI Pilot to your account.');
    } finally {
      setAcquiringPilot(false);
    }
  };

  const activeMedia = aiPilot ? previewMedia[activeImageIndex] : (images[activeImageIndex] ? { type: 'image', url: images[activeImageIndex], title: '' } : null);
  const scrollPreview = (direction) => {
    const strip = previewStripRef.current;
    if (!strip) return;
    strip.scrollBy({ left: direction * Math.max(strip.clientWidth * 0.75, 260), behavior: 'smooth' });
  };

  return (
    <div className={`${embedded ? 'min-h-[calc(100vh-3.5rem)]' : 'min-h-screen'} bg-zinc-950 pb-28 pt-6 text-white`}>
      {viewerIndex !== null && aiPilot && (
        <MediaViewer
          item={previewMedia[viewerIndex]}
          index={viewerIndex}
          count={previewMedia.length}
          onClose={() => setViewerIndex(null)}
          onPrevious={() => setViewerIndex((viewerIndex - 1 + previewMedia.length) % previewMedia.length)}
          onNext={() => setViewerIndex((viewerIndex + 1) % previewMedia.length)}
        />
      )}

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {embedded ? (
          <button type="button" onClick={onBack} className="mb-6 inline-flex items-center gap-2 text-sm font-black tracking-wide text-zinc-300 hover:text-cyan-300"><ArrowLeft size={18} /> ASSETS SHOP</button>
        ) : (
          <Link to="/Catalog" className="mb-6 inline-flex items-center gap-2 text-sm font-black tracking-wide text-zinc-300 hover:text-cyan-300"><ArrowLeft size={18} /> ASSETS SHOP</Link>
        )}

        <div className={`grid gap-8 ${aiPilot ? 'lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]' : 'lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.85fr)]'}`}>
          <section className="min-w-0">
            <button type="button" onClick={() => aiPilot && activeMedia && setViewerIndex(activeImageIndex)} className="block w-full overflow-hidden rounded-2xl border border-white/10 bg-black text-left" aria-label={aiPilot ? 'Open preview viewer' : undefined}>
              <div className={`flex items-center justify-center bg-black ${aiPilot ? 'min-h-[300px] sm:min-h-[420px] lg:min-h-[500px]' : 'min-h-[360px] sm:min-h-[520px] lg:min-h-[620px]'}`}>
                {activeMedia?.type === 'video' ? (
                  <div className="relative flex h-full w-full items-center justify-center"><video src={activeMedia.url} muted preload="metadata" className="max-h-[500px] w-full object-contain" /><div className="absolute inset-0 flex items-center justify-center bg-black/20"><span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-black/70"><Play size={30} className="ml-1 text-white" /></span></div></div>
                ) : activeMedia?.type === 'audio' ? (
                  <div className="flex min-h-[300px] w-full flex-col items-center justify-center gap-4 bg-zinc-900 px-6 text-center"><Music2 size={60} className="text-cyan-300" /><div className="text-lg font-black text-white">{activeMedia.title || 'Audio preview'}</div><div className="text-sm font-bold text-zinc-400">Open to listen</div></div>
                ) : activeMedia?.url ? (
                  <img src={activeMedia.url} alt={asset.title} className={`${aiPilot ? 'max-h-[500px]' : 'max-h-[72vh]'} w-full object-contain`} />
                ) : (
                  <div className="flex h-full min-h-[420px] w-full items-center justify-center text-zinc-700"><Box size={72} /></div>
                )}
              </div>
            </button>

            {(aiPilot ? previewMedia.length : images.length) > 1 && (
              <div className="mt-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">{aiPilot ? 'Preview' : 'Files'}</p>
                  <div className="flex items-center gap-2">
                    {aiPilot && (
                      <>
                        <button type="button" onClick={() => scrollPreview(-1)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.10]" aria-label="Scroll previews left"><ChevronLeft size={18} /></button>
                        <button type="button" onClick={() => scrollPreview(1)} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.10]" aria-label="Scroll previews right"><ChevronRight size={18} /></button>
                      </>
                    )}
                    <p className="min-w-[42px] text-right text-xs font-bold text-zinc-500">{activeImageIndex + 1} / {aiPilot ? previewMedia.length : images.length}</p>
                  </div>
                </div>
                <div ref={aiPilot ? previewStripRef : null} className={aiPilot ? 'flex scroll-smooth gap-3 overflow-x-auto pb-2' : 'grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7'}>
                  {aiPilot ? previewMedia.map((item, index) => (
                    <button key={`${item.type}-${item.url}`} type="button" onClick={() => { setActiveImageIndex(index); setViewerIndex(index); }} className={`h-24 w-36 shrink-0 overflow-hidden rounded-xl border-2 bg-black transition sm:h-28 sm:w-44 ${activeImageIndex === index ? 'border-cyan-400' : 'border-white/10 hover:border-white/30'}`} aria-label={`Open preview ${index + 1}`}>
                      <MediaThumb item={item} />
                    </button>
                  )) : images.map((imageUrl, index) => (
                    <button key={imageUrl} type="button" onClick={() => setActiveImageIndex(index)} className={`aspect-square overflow-hidden rounded-xl border-2 bg-black transition ${activeImageIndex === index ? 'border-cyan-400' : 'border-white/10 hover:border-white/30'}`} aria-label={`View file ${index + 1}`}>
                      <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl border border-white/10 bg-zinc-900 p-6 sm:p-7">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-400">{aiPilot ? 'AI Pilot' : asset.is_product_placement ? 'Product placement' : 'Production asset'}</p>
              <h1 className="mt-3 text-4xl font-black leading-none sm:text-5xl">{asset.title}</h1>
              <div className="mt-5 h-1 w-14 bg-cyan-400" />

              <div className="mt-5 space-y-1 text-sm font-bold text-zinc-400">
                <p><span className="text-zinc-200">Author:</span> {asset.creator_name || asset.placement_source_name || 'AISTAGE.ONE'}</p>
                {asset.created_at && <p><span className="text-zinc-200">Added:</span> {new Date(asset.created_at).toLocaleDateString()}</p>}
                {!aiPilot && images.length > 0 && <p><span className="text-zinc-200">Files:</span> {images.length}</p>}
              </div>

              {asset.description && (
                <div className="mt-6">
                  <p className={`${aiPilot && !showFullDescription ? 'line-clamp-4' : ''} leading-relaxed text-zinc-300`}>{asset.description}</p>
                  {aiPilot && asset.description.length > 220 && (
                    <button type="button" onClick={() => setShowFullDescription((current) => !current)} className="mt-3 text-sm font-black uppercase tracking-wide text-cyan-300 hover:text-cyan-200">
                      {showFullDescription ? 'Less' : 'More'}
                    </button>
                  )}
                </div>
              )}

              {Array.isArray(asset.tags) && asset.tags.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2">
                  {asset.tags.map((tag) => <span key={tag} className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs font-bold uppercase tracking-wide text-zinc-300">{tag}</span>)}
                </div>
              )}

              <div className="mt-7 space-y-3 border-y border-white/10 py-5">
                <div className="flex items-center gap-3"><ShieldCheck className="text-cyan-400" size={20} /><span className="text-sm text-zinc-300">Rights verified before delivery</span></div>
                {aiPilot ? <div className="flex items-center gap-3"><Sparkles className="text-cyan-400" size={20} /><span className="text-sm text-zinc-300">Connects to compatible AISTAGE.ONE Studio tools</span></div> : !asset.is_product_placement ? <div className="flex items-center gap-3"><Download className="text-cyan-400" size={20} /><span className="text-sm text-zinc-300">Secure temporary download after purchase</span></div> : null}
              </div>

              {aiPilot ? (
                <div className="mt-6 space-y-3">
                  <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-4 text-sm font-black text-cyan-200">AI PILOT — ADDED TO YOUR ACCOUNT, NOT YOUR VAULT</div>
                  <Button type="button" onClick={acquireAiPilot} disabled={acquiringPilot || ownershipLoading || Boolean(ownedPilot)} className="h-12 w-full bg-cyan-400 font-black tracking-wider text-black hover:bg-cyan-300 disabled:opacity-100">
                    {ownedPilot ? <><Check size={18} className="mr-2" /> IN MY AI PILOTS</> : <><Sparkles size={18} className="mr-2" /> {acquiringPilot ? 'ADDING…' : 'ADD TO MY AI PILOTS'}</>}
                  </Button>
                  {pilotError && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-200">{pilotError}</div>}
                </div>
              ) : asset.is_product_placement ? (
                <div className="mt-6 space-y-3">
                  <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-4 text-sm font-black text-cyan-200">AVAILABLE FOR MEMBER PRODUCTIONS — NO PURCHASE REQUIRED</div>
                  <Button type="button" onClick={addPlacementToVault} disabled={addingToVault || addedToVault} className="h-12 w-full bg-cyan-400 font-black tracking-wider text-black hover:bg-cyan-300">
                    {addedToVault ? <><Check size={18} className="mr-2" /> ADDED TO MY VAULT</> : <><BookmarkPlus size={18} className="mr-2" /> {addingToVault ? 'ADDING…' : 'ADD TO MY VAULT'}</>}
                  </Button>
                  {asset.placement_product_url && <a href={asset.placement_product_url} target="_blank" rel="noreferrer" className="block text-center text-sm font-bold text-cyan-300 underline underline-offset-4">Visit brand / product website</a>}
                  {vaultError && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-200">{vaultError}</div>}
                </div>
              ) : (
                <Button disabled className="mt-6 h-12 w-full bg-zinc-800 font-black tracking-wider text-zinc-400 disabled:opacity-100">PURCHASE COMING NEXT</Button>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
