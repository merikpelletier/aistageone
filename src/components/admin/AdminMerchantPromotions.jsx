import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Upload } from 'lucide-react';
import { base44, supabase } from '@/api/base44Client';

const emptyExternal = {
  title: '',
  description: '',
  image_url: '',
  destination_url: '',
  button_label: 'View',
  promotion_type: 'product',
  open_in_new_tab: true,
};

export default function AdminMerchantPromotions() {
  const qc = useQueryClient();
  const [profileKey, setProfileKey] = useState('');
  const [external, setExternal] = useState(emptyExternal);
  const [uploading, setUploading] = useState(false);

  const { data: aiMembers = [] } = useQuery({
    queryKey: ['merchant-ai-members'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ai_member').select('id,display_name,member_type').order('display_name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: regularMembers = [] } = useQuery({
    queryKey: ['merchant-regular-members'],
    queryFn: async () => {
      const { data, error } = await supabase.from('member_profile').select('id,user_email,display_name,member_type').order('display_name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ['merchant-products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('id,name,price,image_url,product_type,is_active').eq('is_active', true).order('order');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: promotions = [] } = useQuery({
    queryKey: ['merchant-promotions-admin', profileKey],
    enabled: !!profileKey,
    queryFn: async () => {
      const { data, error } = await supabase.from('merchant_promotion').select('*').eq('profile_key', profileKey).order('sort_order');
      if (error) throw error;
      return data || [];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['merchant-promotions-admin', profileKey] });
    qc.invalidateQueries({ queryKey: ['merchant-promotions', profileKey] });
  };

  const addGiftShop = useMutation({
    mutationFn: async (productId) => {
      const nextOrder = promotions.length ? Math.max(...promotions.map(p => p.sort_order || 0)) + 1 : 0;
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
      const nextOrder = promotions.length ? Math.max(...promotions.map(p => p.sort_order || 0)) + 1 : 0;
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
      setExternal(emptyExternal);
      refresh();
    },
  });

  const removePromotion = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('merchant_promotion').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const merchantOptions = useMemo(() => [
    ...aiMembers.filter(m => m.member_type === 'merchant').map(m => ({ key: `ai-member:${m.id}`, label: `${m.display_name} · AI Merchant` })),
    ...regularMembers.filter(m => m.member_type === 'merchant' && m.user_email).map(m => ({ key: m.user_email, label: `${m.display_name || m.user_email} · Merchant` })),
  ], [aiMembers, regularMembers]);

  const linkedProductIds = new Set(promotions.filter(p => p.promotion_kind === 'giftshop').map(p => p.product_id));

  const uploadImage = async (event) => {
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

  return (
    <div className="space-y-6 text-white">
      <div>
        <h2 className="text-xl font-light">Merchant Promotions</h2>
        <p className="text-sm text-white/55 mt-1">Connect Gift Shop products or visual external promotions to Merchant profiles.</p>
      </div>

      <select value={profileKey} onChange={e => setProfileKey(e.target.value)} className="w-full max-w-xl bg-neutral-950 border border-white/20 px-3 py-2 text-sm text-white">
        <option value="">Choose a Merchant...</option>
        {merchantOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
      </select>

      {profileKey && (
        <>
          <section className="border border-white/15 bg-neutral-950 p-4">
            <h3 className="text-sm font-semibold mb-3">Gift Shop Products</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {products.map(product => {
                const linked = linkedProductIds.has(product.id);
                return (
                  <div key={product.id} className="border border-white/10 bg-black">
                    <div className="aspect-square bg-white overflow-hidden">
                      {product.image_url && <img src={product.image_url} alt="" className="w-full h-full object-contain" />}
                    </div>
                    <div className="p-3">
                      <p className="text-sm line-clamp-2">{product.name}</p>
                      <p className="text-white/60 text-xs mt-1">{product.price}</p>
                      <button disabled={linked || addGiftShop.isPending} onClick={() => addGiftShop.mutate(product.id)} className="mt-3 w-full border border-white/20 px-2 py-2 text-xs disabled:opacity-40 hover:border-white/60">
                        {linked ? 'On profile' : '+ Add to profile'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="border border-white/15 bg-neutral-950 p-4 space-y-3">
            <h3 className="text-sm font-semibold">External Promotion</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={external.title} onChange={e => setExternal({ ...external, title: e.target.value })} placeholder="Title" className="bg-black border border-white/15 px-3 py-2 text-sm" />
              <input value={external.destination_url} onChange={e => setExternal({ ...external, destination_url: e.target.value })} placeholder="Destination URL" className="bg-black border border-white/15 px-3 py-2 text-sm" />
              <input value={external.button_label} onChange={e => setExternal({ ...external, button_label: e.target.value })} placeholder="Button label" className="bg-black border border-white/15 px-3 py-2 text-sm" />
              <select value={external.promotion_type} onChange={e => setExternal({ ...external, promotion_type: e.target.value })} className="bg-black border border-white/15 px-3 py-2 text-sm">
                {['product','service','store','campaign','event','other'].map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <textarea value={external.description} onChange={e => setExternal({ ...external, description: e.target.value })} placeholder="Short description" className="w-full min-h-20 bg-black border border-white/15 px-3 py-2 text-sm" />
            {external.image_url && <img src={external.image_url} alt="" className="w-40 aspect-square object-contain bg-white" />}
            <label className="inline-flex items-center gap-2 border border-white/20 px-3 py-2 text-xs cursor-pointer hover:border-white/60">
              <Upload size={14} /> {uploading ? 'Uploading...' : 'Upload image'}
              <input type="file" accept="image/*" className="hidden" onChange={uploadImage} disabled={uploading} />
            </label>
            <button
              onClick={() => addExternal.mutate()}
              disabled={!external.title.trim() || !external.destination_url.trim() || addExternal.isPending}
              className="ml-2 inline-flex items-center gap-2 bg-white text-black px-4 py-2 text-xs disabled:opacity-40"
            >
              <Plus size={14} /> Add promotion
            </button>
          </section>

          <section className="border border-white/15 bg-neutral-950 p-4">
            <h3 className="text-sm font-semibold mb-3">Currently on profile</h3>
            {promotions.length === 0 && <p className="text-white/45 text-sm">No products or promotions yet.</p>}
            <div className="space-y-2">
              {promotions.map(promotion => {
                const product = products.find(p => p.id === promotion.product_id);
                return (
                  <div key={promotion.id} className="flex items-center gap-3 border border-white/10 bg-black p-2">
                    {(product?.image_url || promotion.image_url) && <img src={product?.image_url || promotion.image_url} alt="" className="w-14 h-14 object-contain bg-white" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{product?.name || promotion.title}</p>
                      <p className="text-[10px] uppercase tracking-wider text-white/40">{promotion.promotion_kind}</p>
                    </div>
                    <button onClick={() => removePromotion.mutate(promotion.id)} className="p-2 text-red-400 hover:text-red-300"><Trash2 size={15} /></button>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
