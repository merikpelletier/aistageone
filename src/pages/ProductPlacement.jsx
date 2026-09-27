import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Loader2, Megaphone } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/api/supabaseClient';

const splitList = (value) => String(value || '').split(/[\n,]/).map((item) => item.trim()).filter(Boolean);

export default function ProductPlacement() {
  const [params] = useSearchParams();
  const paymentState = params.get('payment');
  const [selectedPackage, setSelectedPackage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    product_name: '',
    product_description: '',
    product_url: '',
    featured_image: '',
    preview_images: '',
    tags: '',
    category_id: '',
    subcategory_id: '',
    rights_confirmed: false,
    terms_accepted: false,
  });

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['product-placement-packages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_placement_package')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['placement-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('asset_category').select('*').eq('is_active', true).order('display_order');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: subcategories = [] } = useQuery({
    queryKey: ['placement-subcategories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('asset_subcategory').select('*').eq('is_active', true).order('display_order');
      if (error) throw error;
      return data || [];
    },
  });

  const currentPackage = packages.find((item) => item.id === selectedPackage);
  const visibleSubcategories = useMemo(
    () => subcategories.filter((item) => !form.category_id || item.category_id === form.category_id),
    [subcategories, form.category_id],
  );

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const startCheckout = async () => {
    setErrorMessage('');
    if (!selectedPackage) return setErrorMessage('Choose a placement package.');
    if (!form.product_name.trim()) return setErrorMessage('Product name is required.');
    if (!form.featured_image.trim()) return setErrorMessage('A product image is required.');
    if (!form.rights_confirmed || !form.terms_accepted) return setErrorMessage('Rights and placement terms must be accepted.');

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('product-placement-checkout', {
        body: {
          package_id: selectedPackage,
          ...form,
          preview_images: splitList(form.preview_images),
          tags: splitList(form.tags),
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error(data?.error || 'Unable to start checkout.');
      window.location.assign(data.url);
    } catch (error) {
      setErrorMessage(error?.message || 'Unable to start checkout.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-24">
      <div className="border-b border-white/10 bg-black">
        <div className="mx-auto max-w-6xl px-5 py-8">
          <Link to="/Catalog" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-white">
            <ArrowLeft size={16} /> Assets Shop
          </Link>
          <div className="mt-7 flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center bg-cyan-400 text-black"><Megaphone size={24} /></div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">AISTAGE.ONE</p>
              <h1 className="mt-1 text-4xl font-black">Product Placement</h1>
              <p className="mt-3 max-w-2xl text-zinc-400">Place your brand or product in the Assets Shop so members can use it in their productions. The placement fee is paid by the brand or creator; members do not pay to use the placed product.</p>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-5 py-8">
        {paymentState === 'success' && (
          <div className="mb-7 flex items-start gap-3 border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-100">
            <CheckCircle2 className="mt-0.5 shrink-0" size={20} />
            <div><strong>Payment received.</strong> Your placement is now pending administrative review.</div>
          </div>
        )}

        <section>
          <h2 className="text-xl font-black">1. Choose a placement package</h2>
          {isLoading ? (
            <div className="py-10"><Loader2 className="animate-spin text-cyan-300" /></div>
          ) : packages.length === 0 ? (
            <div className="mt-4 border border-white/10 bg-zinc-900 p-6 text-zinc-400">No placement packages are currently available.</div>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {packages.map((item) => {
                const active = selectedPackage === item.id;
                return (
                  <button key={item.id} type="button" onClick={() => setSelectedPackage(item.id)}
                    className={`border p-5 text-left transition ${active ? 'border-cyan-400 bg-cyan-400/10' : 'border-white/10 bg-zinc-900 hover:border-white/30'}`}>
                    <div className="text-lg font-black">{item.name}</div>
                    <div className="mt-1 text-3xl font-black text-cyan-300">${Number(item.price).toFixed(2)} <span className="text-xs text-zinc-500">{item.currency}</span></div>
                    <div className="mt-2 text-sm text-zinc-400">1 year · per item{item.includes_featured ? ' · Featured placement included' : ''}</div>
                    {item.description && <p className="mt-3 text-sm leading-relaxed text-zinc-400">{item.description}</p>}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-10 border border-white/10 bg-zinc-900 p-6">
          <h2 className="text-xl font-black">2. Submit the product</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <input value={form.company_name} onChange={(e) => setField('company_name', e.target.value)} placeholder="Brand / company name" className="bg-black border border-white/10 px-4 py-3" />
            <input value={form.contact_name} onChange={(e) => setField('contact_name', e.target.value)} placeholder="Contact name" className="bg-black border border-white/10 px-4 py-3" />
            <input value={form.product_name} onChange={(e) => setField('product_name', e.target.value)} placeholder="Product name *" className="bg-black border border-white/10 px-4 py-3 md:col-span-2" />
            <textarea value={form.product_description} onChange={(e) => setField('product_description', e.target.value)} placeholder="Product description" rows={4} className="bg-black border border-white/10 px-4 py-3 md:col-span-2" />
            <input value={form.product_url} onChange={(e) => setField('product_url', e.target.value)} placeholder="Product / brand website URL" className="bg-black border border-white/10 px-4 py-3 md:col-span-2" />
            <input value={form.featured_image} onChange={(e) => setField('featured_image', e.target.value)} placeholder="Main product image URL *" className="bg-black border border-white/10 px-4 py-3 md:col-span-2" />
            <textarea value={form.preview_images} onChange={(e) => setField('preview_images', e.target.value)} placeholder="Additional image URLs — one per line" rows={3} className="bg-black border border-white/10 px-4 py-3 md:col-span-2" />
            <select value={form.category_id} onChange={(e) => setForm((current) => ({ ...current, category_id: e.target.value, subcategory_id: '' }))} className="bg-black border border-white/10 px-4 py-3">
              <option value="">Category</option>
              {categories.map((item) => <option key={item.id} value={item.id}>{item.label_en || item.label_fr}</option>)}
            </select>
            <select value={form.subcategory_id} onChange={(e) => setField('subcategory_id', e.target.value)} className="bg-black border border-white/10 px-4 py-3">
              <option value="">Subcategory</option>
              {visibleSubcategories.map((item) => <option key={item.id} value={item.id}>{item.label_en || item.label_fr}</option>)}
            </select>
            <input value={form.tags} onChange={(e) => setField('tags', e.target.value)} placeholder="Tags, separated by commas" className="bg-black border border-white/10 px-4 py-3 md:col-span-2" />
          </div>

          <div className="mt-6 space-y-3 text-sm text-zinc-300">
            <label className="flex items-start gap-3"><input type="checkbox" checked={form.rights_confirmed} onChange={(e) => setField('rights_confirmed', e.target.checked)} className="mt-1" /><span>I confirm that I am authorized to submit this brand/product and its supplied media for placement.</span></label>
            <label className="flex items-start gap-3"><input type="checkbox" checked={form.terms_accepted} onChange={(e) => setField('terms_accepted', e.target.checked)} className="mt-1" /><span>I accept that placement is subject to AISTAGE.ONE review and is sold per item for a one-year placement period.</span></label>
          </div>

          {errorMessage && <div className="mt-5 border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{errorMessage}</div>}

          <button type="button" onClick={startCheckout} disabled={submitting || !currentPackage}
            className="mt-6 w-full bg-cyan-400 px-5 py-4 font-black text-black disabled:opacity-40">
            {submitting ? 'OPENING SECURE CHECKOUT…' : currentPackage ? `CONTINUE TO SECURE CHECKOUT — $${Number(currentPackage.price).toFixed(2)} CAD + TAX` : 'SELECT A PACKAGE'}
          </button>
          <p className="mt-3 text-center text-xs text-zinc-500">Applicable taxes are calculated at checkout based on the purchaser’s billing location.</p>
        </section>
      </main>
    </div>
  );
}
