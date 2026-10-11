import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { base44, supabase } from '@/api/base44Client';

const EMPTY_EXTERNAL = {
  title: '',
  description: '',
  image_url: '',
  destination_url: '',
  button_label: 'View',
  promotion_type: 'product',
  open_in_new_tab: true,
};

export default function MerchantInlineTools({ profileKey }) {
  const qc = useQueryClient();
  const [external, setExternal] = useState(EMPTY_EXTERNAL);
  const [uploading, setUploading] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const { data: products = [] } = useQuery({
    queryKey: ['merchant-inline-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id,name,price,image_url,product_type,category,is_active')
        .eq('is_active', true)
        .order('order');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: promotions = [] } = useQuery({
    queryKey: ['merchant-inline-promotions', profileKey],
    enabled: !!profileKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('merchant_promotion')
        .select('*')
        .eq('profile_key', profileKey)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['merchant-inline-promotions', profileKey] });
    qc.invalidateQueries({ queryKey: ['merchant-promotions', profileKey] });
  };

  const linkedProductIds = new Set(
    promotions.filter(p => p.promotion_kind === 'giftshop').map(p => p.product_id)
  );

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(product => {
      const haystack = `${product.name || ''} ${product.product_type || ''} ${product.category || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [products, productSearch]);

  const addGiftShop = useMutation({
    mutationFn: async productId => {
      const nextOrder = promotions.length
        ? Math.max(...promotions.map(p => p.sort_order || 0)) + 1
        : 0;
      const { error } = await supabase.from('merchant_promotion').insert({
        profile_key: profileKey,
        promotion_kind: 'giftshop',
        product_id: productId,
        promotion_type: 'product',
        button_label: 'View Product',
        open_in_new_tab: false,
        sort_order: nextOrder,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const addExternal = useMutation({
    mutationFn: async () => {
      const nextOrder = promotions.length
        ? Math.max(...promotions.map(p => p.sort_order || 0)) + 1
        : 0;
      const { error } = await supabase.from('merchant_promotion').insert({
        profile_key: profileKey,
        promotion_kind: 'external',
        ...external,
        sort_order: nextOrder,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setExternal(EMPTY_EXTERNAL);
      refresh();
    },
  });

  const removePromotion = useMutation({
    mutationFn: async id => {
      const { error } = await supabase.from('merchant_promotion').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const uploadImage = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      setExternal(current => ({ ...current, image_url: result.file_url }));
    } finally {
      setUploading(false);
    }
  };

  if (!profileKey) {
    return (
      <div className="border border-white/15 bg-black/30 p-4 text-sm text-white/55">
        Save this Merchant first, then reopen the profile to attach Gift Shop products and visual promotions.
      </div>
    );
  }

  return (
    <div className="md:col-span-2 border border-teal-400/25 bg-teal-400/[0.03] p-4 space-y-5">
      <div>
        <p className="text-sm font-semibold text-white">Merchant — Shop & Promotions</p>
        <p className="text-xs text-white/50 mt-1">Choose Gift Shop products for this profile or add an external promotion with its own image.</p>
      </div>

      <div>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-3">
          <p className="text-xs uppercase tracking-[0.14em] text-white/55">Gift Shop Products</p>
          <div className="relative w-full sm:max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              placeholder="Search Gift Shop products..."
              className="input-ai w-full pl-9 pr-9"
            />
            {productSearch && (
              <button
                type="button"
                onClick={() => setProductSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                aria-label="Clear product search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {productSearch && (
          <p className="text-[11px] text-white/40 mb-3">
            {filteredProducts.length} result{filteredProducts.length === 1 ? '' : 's'}
          </p>
        )}

        {filteredProducts.length === 0 ? (
          <div className="border border-dashed border-white/15 p-5 text-center text-sm text-white/45">
            No Gift Shop product matches “{productSearch}”.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[640px] overflow-y-auto pr-1">
            {filteredProducts.map(product => {
              const linked = linkedProductIds.has(product.id);
              return (
                <div key={product.id} className="border border-white/10 bg-black">
                  <div className="aspect-square bg-white overflow-hidden">
                    {product.image_url && <img src={product.image_url} alt="" className="w-full h-full object-contain" />}
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs text-white line-clamp-2">{product.name}</p>
                    <p className="text-[11px] text-white/55 mt-1">{product.price}</p>
                    <button
                      type="button"
                      disabled={linked || addGiftShop.isPending}
                      onClick={() => addGiftShop.mutate(product.id)}
                      className="mt-2 w-full border border-white/20 px-2 py-1.5 text-[11px] text-white disabled:opacity-40"
                    >
                      {linked ? 'On profile' : 'Add to profile'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-white/10 pt-4 space-y-3">
        <p className="text-xs uppercase tracking-[0.14em] text-white/55">External Promotion</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input value={external.title} onChange={e => setExternal({ ...external, title: e.target.value })} placeholder="Title" className="input-ai w-full" />
          <input value={external.destination_url} onChange={e => setExternal({ ...external, destination_url: e.target.value })} placeholder="Destination URL" className="input-ai w-full" />
          <input value={external.button_label} onChange={e => setExternal({ ...external, button_label: e.target.value })} placeholder="Button label" className="input-ai w-full" />
          <select value={external.promotion_type} onChange={e => setExternal({ ...external, promotion_type: e.target.value })} className="input-ai w-full">
            {['product', 'service', 'store', 'campaign', 'event', 'other'].map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <textarea value={external.description} onChange={e => setExternal({ ...external, description: e.target.value })} rows={2} placeholder="Short description" className="input-ai w-full" />
        <div className="flex flex-wrap items-center gap-3">
          {external.image_url && <img src={external.image_url} alt="" className="w-24 h-24 object-contain bg-white" />}
          <label className="inline-flex items-center gap-2 px-3 py-2 border border-white/20 text-xs cursor-pointer hover:border-white/50">
            <Upload size={13} /> {uploading ? 'Uploading...' : 'Upload promo image'}
            <input type="file" accept="image/*" className="sr-only" onChange={uploadImage} disabled={uploading} />
          </label>
          <button
            type="button"
            onClick={() => addExternal.mutate()}
            disabled={!external.title.trim() || !external.destination_url.trim() || addExternal.isPending}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white text-black text-xs disabled:opacity-40"
          >
            <Plus size={13} /> Add promotion
          </button>
        </div>
      </div>

      <div className="border-t border-white/10 pt-4">
        <p className="text-xs uppercase tracking-[0.14em] text-white/55 mb-2">Currently on profile</p>
        {promotions.length === 0 ? (
          <p className="text-xs text-white/40">Nothing attached yet.</p>
        ) : (
          <div className="space-y-2">
            {promotions.map(promotion => {
              const product = products.find(item => item.id === promotion.product_id);
              const image = product?.image_url || promotion.image_url;
              return (
                <div key={promotion.id} className="flex items-center gap-3 border border-white/10 bg-black p-2">
                  {image && <img src={image} alt="" className="w-12 h-12 object-contain bg-white" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-white truncate">{product?.name || promotion.title}</p>
                    <p className="text-[10px] uppercase tracking-wider text-white/35">{promotion.promotion_kind}</p>
                  </div>
                  <button type="button" onClick={() => removePromotion.mutate(promotion.id)} className="p-2 text-red-400 hover:text-red-300">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
