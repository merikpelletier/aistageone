import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Package } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import AssetCard from '@/components/catalog/AssetCard';
import CatalogFilters from '@/components/catalog/CatalogFilters';
import QuickViewModal from '@/components/catalog/QuickViewModal';

const PAGE_SIZE = 20;

const DEFAULT_CATALOG_SECTIONS = [
  { key: 'filters', label: 'Selection Tools', visible: true, order: 0 },
  { key: 'grid', label: 'Asset Grid', visible: true, order: 1 },
  { key: 'load_more', label: 'Load More', visible: true, order: 2 },
  { key: 'quick_view', label: 'Quick View', visible: true, order: 3 },
];

const shuffle = (items) => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
};

export default function Catalog({ embedded = false, onOpenAsset = null }) {
  const initialCategory = new URLSearchParams(window.location.search).get('category') || 'all';
  const [filters, setFilters] = useState({ category: initialCategory, subcategory: 'all', creator: 'all', search: '', sort: 'random' });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [quickViewAsset, setQuickViewAsset] = useState(null);
  const [randomSeed, setRandomSeed] = useState(Date.now());

  const { data: runtime } = useQuery({
    queryKey: ['admin-surface-runtime'],
    queryFn: async () => {
      const { data, error: runtimeError } = await supabase.functions.invoke('admin-pages-tools', { body: { action: 'runtime' } });
      if (runtimeError) throw runtimeError;
      return data;
    },
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
  const showFilters = catalogSections.filters?.visible !== false;
  const showGrid = catalogSections.grid?.visible !== false;
  const showLoadMore = catalogSections.load_more?.visible !== false;
  const showQuickView = catalogSections.quick_view?.visible !== false;

  const { data: assets = [], isLoading, error } = useQuery({
    queryKey: ['olo-catalog-assets'],
    queryFn: async () => {
      const { data, error: catalogError } = await supabase.from('catalog_asset').select('*').eq('status', 'published').order('created_at', { ascending: false, nullsFirst: false }).limit(500);
      if (catalogError) throw catalogError;
      return (data || []).filter((asset) => !asset.is_product_placement || !asset.placement_expires_at || new Date(asset.placement_expires_at) > new Date());
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
    <div
      className={`${embedded ? 'h-[calc(100vh-3.5rem)] min-h-0 overflow-y-auto overscroll-contain' : 'min-h-screen'} bg-[#202328] pb-28 text-white`}
      style={catalogBackground ? { backgroundImage: `url(${catalogBackground})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: embedded ? 'scroll' : 'fixed' } : undefined}
    >
      <main className="mx-auto max-w-[1800px] px-4 py-4 md:px-5 lg:px-6">
        {showFilters && (
          <CatalogFilters
            filters={filters}
            onChange={setFilters}
            categories={categories}
            subcategories={subcategories}
            creators={creators}
            resultCount={filteredAssets.length}
          />
        )}

        {showGrid && <div className="mt-5">
          {isLoading ? <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-cyan-400" size={36} /></div>
          : error ? <div className="rounded-[4px] border border-rose-500/30 bg-rose-500/10 p-8 text-center text-rose-200">The shop could not load its assets.</div>
          : visibleAssets.length === 0 ? <div className="flex flex-col items-center py-24 text-center"><div className="flex h-20 w-20 items-center justify-center rounded-[4px] bg-zinc-900"><Package className="text-zinc-600" size={40} /></div><h2 className="mt-5 text-xl font-black">NO MATCHING ASSETS</h2><p className="mt-2 text-zinc-500">Try clearing one or more filters.</p></div>
          : <>
              <motion.div layout className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                <AnimatePresence>
                  {visibleAssets.map((asset) => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      category={categories.find((item) => item.id === asset.category_id)}
                      onQuickView={setQuickViewAsset}
                      onOpenAsset={onOpenAsset}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
              {showLoadMore && visibleCount < filteredAssets.length && <div className="mt-8 flex justify-center"><button onClick={() => setVisibleCount((count) => count + PAGE_SIZE)} className="rounded-[3px] bg-cyan-500 px-8 py-3 font-black text-black transition hover:bg-cyan-400">LOAD MORE ({visibleAssets.length} / {filteredAssets.length})</button></div>}
            </>}
        </div>}
      </main>

      {showQuickView && <QuickViewModal asset={quickViewAsset} category={categories.find((item) => item.id === quickViewAsset?.category_id)} onClose={() => setQuickViewAsset(null)} />}
    </div>
  );
}
