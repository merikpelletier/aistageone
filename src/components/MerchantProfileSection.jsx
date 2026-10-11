import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/base44Client';

export default function MerchantProfileSection({ profileKey }) {
  const { data: promotions = [], isLoading } = useQuery({
    queryKey: ['merchant-promotions', profileKey],
    enabled: !!profileKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('merchant_promotion')
        .select('*')
        .eq('profile_key', profileKey)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const productIds = promotions.filter(p => p.promotion_kind === 'giftshop' && p.product_id).map(p => p.product_id);

  const { data: products = [] } = useQuery({
    queryKey: ['merchant-promotion-products', productIds],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading || promotions.length === 0) return null;

  const productMap = Object.fromEntries(products.map(product => [product.id, product]));
  const cards = promotions.map(promotion => {
    if (promotion.promotion_kind === 'giftshop') {
      const product = productMap[promotion.product_id];
      if (!product) return null;
      return {
        id: promotion.id,
        kind: 'giftshop',
        image: product.image_url,
        eyebrow: product.product_type || product.category || 'Gift Shop',
        title: product.name,
        description: product.description,
        price: product.price,
        button: promotion.button_label || 'View Product',
        href: `/ProductDetail?id=${encodeURIComponent(product.id)}`,
        external: false,
      };
    }

    return {
      id: promotion.id,
      kind: 'external',
      image: promotion.image_url,
      eyebrow: promotion.promotion_type || 'Promotion',
      title: promotion.title,
      description: promotion.description,
      price: null,
      button: promotion.button_label || 'View',
      href: promotion.destination_url,
      external: promotion.open_in_new_tab !== false,
    };
  }).filter(Boolean);

  if (cards.length === 0) return null;

  return (
    <section className="px-4 pt-5 pb-2">
      <div className="flex items-end justify-between gap-4 mb-3">
        <div>
          <p className="text-white/40 text-[10px] uppercase tracking-[0.22em]">Merchant</p>
          <h2 className="text-white text-lg font-semibold tracking-tight">Shop & Promotions</h2>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map(card => {
          const body = (
            <article className="h-full border border-white/10 bg-neutral-950 group hover:border-white/30 transition-colors">
              <div className="aspect-square bg-white overflow-hidden">
                {card.image ? (
                  <img src={card.image} alt={card.title || ''} className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-[1.03]" />
                ) : (
                  <div className="w-full h-full bg-neutral-900 flex items-center justify-center text-white/30 text-xs px-4 text-center">{card.title}</div>
                )}
              </div>
              <div className="p-3">
                <p className="text-white/40 text-[9px] uppercase tracking-[0.16em] line-clamp-1">{card.eyebrow}</p>
                <h3 className="text-white text-sm font-medium leading-tight mt-1 line-clamp-2">{card.title}</h3>
                {card.price && <p className="text-white text-base mt-2">{card.price}</p>}
                {card.description && !card.price && <p className="text-white/55 text-xs mt-2 line-clamp-2">{card.description}</p>}
                <div className="mt-3 text-[10px] uppercase tracking-[0.12em] text-white/75 flex items-center gap-1">
                  {card.button}{card.external && <ExternalLink size={10} />}
                </div>
              </div>
            </article>
          );

          if (card.external) {
            return <a key={card.id} href={card.href} target="_blank" rel="noreferrer" className="block min-w-0">{body}</a>;
          }

          return <Link key={card.id} to={card.href} className="block min-w-0">{body}</Link>;
        })}
      </div>
    </section>
  );
}
