import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Package, SlidersHorizontal, Sparkles } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { base44 } from '@/api/base44Client';
import AssetCard from '@/components/catalog/AssetCard';
import CatalogFilters from '@/components/catalog/CatalogFilters';
import QuickViewModal from '@/components/catalog/QuickViewModal';

const PAGE_SIZE = 20;

const DEFAULT_CATALOG_SECTIONS = [
  { key: 'hero', label: 'Marketplace Hero', visible: true, order: 0 },
  { key: 'filters', label: 'Selection Tools', visible: true, order: 1 },
  { key: 'grid', label: 'Asset Grid', visible: true, order: 2 },
  { key: 'load_more', label: 'Load More', visible: true, order: 3 },
  { key: 'quick_view', label: 'Quick View', visible: true, order: 4 },
];

const shuffle = (items) => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
};

export default function Catalog() {
  const initialCategory = new URLSearchParams(window.location.search).get('category') || 'all';
  const [filters, setFilters] = useState({ category: initialCategory, subcategory: 'all', creator: 'all', search: '', sort: 'random' });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [quickViewAsset, setQuickViewAsset] = useState(null);
  const [randomSeed, setRandomSeed] = useState(Date.now());

  const { data: runtime } = useQuery({
    queryKey: ['admin-surface-runtime'],
    queryFn: async () => (await base44.functions.invoke('admin-pages-tools', { action: 'runtime' })).data,
    staleTime: 60_000,
    retry: false,
  });
  const catalogSetting = runtime?.settings?.find((item) => item.surface_type === 'page' && item.surface_key === 'Catalog');
  const catalogSections = useMemo(() => {
    const saved = Array.isArray(catalogSetting?.configuration?.catalog_sections) ? catalogSetting.configuration.catalog_sections : [];
    const merged = DEFAULT_CATALOG_SECTIONS.map((def) => ({ ...def, ...(saved.find((item) => item.key === def.key) || {}) }));
    return merged.reduce((map, item) => { map[item.key] = item; return map; }, {});
  }, [catalogSetting]);
  const catalogBackground = catalogSetting?.configuration?.background_image || '';
  const showHero = catalogSections.hero?.visible !== false;
  const showFilters = catalogSections.filters?.visible !== false;
  const showGrid = catalogSections.grid?.visible !== false;
  const showLoadMore = catalogSections.load_more?.visible !== false;
  const showQuickView = catalogSections.quick_view?.visible !== false;
  const heroLabel = catalogSections.hero?.label || 'Marketplace Hero';
  const filtersLabel = catalogSections.filters?.label || 'Selection Tools';

  const { data: assets = [], isLoading, error } = useQuery({
    queryKey: ['olo-catalog-assets'],
    queryFn: async () => {
      const { data, error: catalogError } = await supabase.from('catalog_asset').select('*').eq('status', 'published').order('created_at', { ascending: false, nullsFirst: false }).limit(500);
      if (catalogError) throw catalogError;
      return data || [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['olo-asset-categories'],
    queryFn: async () => {
      const { data, error: categoryError } = await supabase.from('asset_category').select('*').eq('is_active', true).order('display_order', { ascending: true });
      if (categoryError) throw categoryError;
      return data || [];
    },
  });

  const { data: subcategories = [] } = useQuery({
    queryKey: ['olo-asset-subcategories'],
    queryFn: async () => {
      const { data, error: subcategoryError } = await supabase.from('asset_subcategory').select('*').eq('is_active', true).order('display_order', { ascending: true });
      if (subcategoryError) throw subcategoryError;
      return data || [];
    },
  });

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setFilters((current) => ({ ...current, subcategory: 'all' }));
  }, [filters.category]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    if (filters.sort === 'random') setRandomSeed(Date.now());
  }, [filters.search, filters.subcategory, filters.creator, filters.sort]);

  const creators = useMemo(() => [...new Set(assets.map((asset) => asset.creator_name?.trim()).filter(Boolean))].sort(), [assets]);

  const filteredAssets = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    let result = assets.filter((asset) => {
      if (filters.category !== 'all' && asset.category_id !== filters.category) return false;
      if (filters.subcategory !== 'all' && asset.subcategory_id !== filters.subcategory) return false;
      if (filters.creator !== 'all' && asset.creator_name !== filters.creator) return false;
      if (!term) return true;
      return [asset.title, asset.creator_name, asset.description, ...(Array.isArray(asset.tags) ? asset.tags : [])].some((value) => String(value || '').toLowerCase().includes(term));
    });
    if (filters.sort === 'random') return shuffle(result);
    result = [...result];
    if (filters.sort === 'oldest') result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    if (filters.sort === 'newest') result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (filters.sort === 'price_asc') result.sort((a, b) => (a.credit_cost || 0) - (b.credit_cost || 0));
    if (filters.sort === 'price_desc') result.sort((a, b) => (b.credit_cost || 0) - (a.credit_cost || 0));
    if (filters.sort === 'title') result.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    if (filters.sort === 'popular') result.sort((a, b) => (b.download_count || 0) - (a.download_count || 0));
    return result;
  }, [assets, filters, randomSeed]);

  const visibleAssets = filteredAssets.slice(0, visibleCount);

  return (
    <div className="min-h-screen bg-zinc-950 pb-28 text-white" style={catalogBackground ? { backgroundImage: `url(${catalogBackground})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' } : undefined}>
      {showHero && <section className="relative overflow-hidden border-b border-white/10 bg-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(6,182,212,0.22),transparent_38%),radial-gradient(circle_at_85%_10%,rgba(37,99,235,0.18),transparent_35%)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-14 md:py-20">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-cyan-300"><Sparkles size={14} /> AISTAGE.ONE Marketplace</div>
          <h1 className="text-5xl font-black tracking-tight md:text-7xl">OLO SHOP</h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-300 md:text-lg">Actors, characters, costumes, sets, props and production assets ready for your projects.</p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm font-bold text-zinc-300">
            <span className="rounded-lg border border-white/10 bg-white/5 px-4 py-2">{assets.length} assets</span>
            <span className="rounded-lg border border-white/10 bg-white/5 px-4 py-2">{categories.length} categories</span>
            <span className="rounded-lg border border-white/10 bg-white/5 px-4 py-2">Supabase secured</span>
          </div>
        </div>
      </section>}

      <main className="mx-auto max-w-7xl px-6 py-9">
        {showFilters && <>
          <div className="mb-5 flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-zinc-500"><SlidersHorizontal size={15} /> {filtersLabel}</div>
          <CatalogFilters filters={filters} onChange={setFilters} categories={categories} subcategories={subcategories} creators={creators} resultCount={filteredAssets.length} />
        </>}

        {showGrid && <div className="mt-9">
          {isLoading ? (
            <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-cyan-400" size={36} /></div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-center text-rose-200">The shop could not load its assets.</div>
          ) : visibleAssets.length === 0 ? (
            <div className="flex flex-col items-center py-24 text-center"><div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-zinc-900"><Package className="text-zinc-600" size={40} /></div><h2 className="mt-5 text-xl font-black">NO MATCHING ASSETS</h2><p className="mt-2 text-zinc-500">Try clearing one or more selection tools.</p></div>
          ) : (
            <>
              <motion.div layout className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <AnimatePresence>
                  {visibleAssets.map((asset) => <AssetCard key={asset.id} asset={asset} category={categories.find((item) => item.id === asset.category_id)} onQuickView={setQuickViewAsset} />)}
                </AnimatePresence>
              </motion.div>
              {showLoadMore && visibleCount < filteredAssets.length && <div className="mt-10 flex justify-center"><button onClick={() => setVisibleCount((count) => count + PAGE_SIZE)} className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-3 font-black text-black transition hover:brightness-110">LOAD MORE ({visibleAssets.length} / {filteredAssets.length})</button></div>}
            </>
          )}
        </div>}
      </main>

      {showQuickView && <QuickViewModal asset={quickViewAsset} category={categories.find((item) => item.id === quickViewAsset?.category_id)} onClose={() => setQuickViewAsset(null)} />}
    </div>
  );
}
