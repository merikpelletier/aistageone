import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Megaphone, Plus, X } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';

const emptyPackage = {
  name: '',
  description: '',
  price: '',
  currency: 'CAD',
  duration_days: 365,
  includes_featured: false,
  display_order: 0,
  is_active: true,
  stripe_tax_code: '',
};

export default function AdminProductPlacements() {
  const qc = useQueryClient();
  const [editingPackage, setEditingPackage] = useState(null);
  const [notes, setNotes] = useState({});
  const [errorMessage, setErrorMessage] = useState('');

  const { data: packages = [], isLoading: loadingPackages } = useQuery({
    queryKey: ['admin-product-placement-packages'],
    queryFn: async () => {
      const { data, error } = await supabase.from('product_placement_package').select('*').order('display_order');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: requests = [], isLoading: loadingRequests } = useQuery({
    queryKey: ['admin-product-placement-requests'],
    queryFn: async () => {
      const { data, error } = await supabase.from('product_placement_request').select('*').order('created_at', { ascending: false }).limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: ['admin-product-placement-packages'] }),
    qc.invalidateQueries({ queryKey: ['product-placement-packages'] }),
    qc.invalidateQueries({ queryKey: ['admin-product-placement-requests'] }),
    qc.invalidateQueries({ queryKey: ['olo-catalog-assets'] }),
    qc.invalidateQueries({ queryKey: ['admin-olo-inventory'] }),
  ]);

  const savePackage = useMutation({
    mutationFn: async (item) => {
      const payload = {
        name: item.name.trim(),
        description: item.description?.trim() || null,
        price: Number(item.price || 0),
        currency: String(item.currency || 'CAD').toUpperCase(),
        duration_days: 365,
        includes_featured: Boolean(item.includes_featured),
        display_order: Number(item.display_order || 0),
        is_active: Boolean(item.is_active),
        stripe_tax_code: item.stripe_tax_code?.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (!payload.name) throw new Error('Package name is required.');
      if (!(payload.price > 0)) throw new Error('Package price must be greater than zero.');
      const query = item.id
        ? supabase.from('product_placement_package').update(payload).eq('id', item.id)
        : supabase.from('product_placement_package').insert(payload);
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: async () => { setEditingPackage(null); setErrorMessage(''); await refresh(); },
    onError: (error) => setErrorMessage(error.message || 'Unable to save package.'),
  });

  const review = useMutation({
    mutationFn: async ({ id, action }) => {
      const { data, error } = await supabase.rpc('admin_review_product_placement', {
        p_request_id: id,
        p_action: action,
        p_notes: notes[id] || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => { setErrorMessage(''); await refresh(); },
    onError: (error) => setErrorMessage(error.message || 'Unable to review placement.'),
  });

  const expire = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('expire_product_placements');
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (error) => setErrorMessage(error.message || 'Unable to expire placements.'),
  });

  const pending = useMemo(() => requests.filter((item) => item.review_status === 'pending_review'), [requests]);
  const active = useMemo(() => requests.filter((item) => item.placement_status === 'active'), [requests]);

  return (
    <div className="text-white">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-300"><Megaphone size={15} /> Assets Shop</div>
          <h2 className="mt-2 text-3xl font-black">Product Placements</h2>
          <p className="mt-2 text-sm text-zinc-400">Paid brand/creator placements sold per item for one year. Members use approved products without paying for the placement.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => expire.mutate()} className="border border-white/15 bg-zinc-900 px-4 py-2 text-sm font-bold">Expire due placements</button>
          <button onClick={() => setEditingPackage({ ...emptyPackage })} className="flex items-center gap-2 bg-cyan-400 px-4 py-2 text-sm font-black text-black"><Plus size={16} /> New package</button>
        </div>
      </div>

      {errorMessage && <div className="mb-5 border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{errorMessage}</div>}

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <div className="border border-white/10 bg-zinc-950 p-4"><div className="text-xs uppercase tracking-wider text-zinc-500">Packages</div><div className="mt-2 text-3xl font-black">{packages.length}</div></div>
        <div className="border border-white/10 bg-zinc-950 p-4"><div className="text-xs uppercase tracking-wider text-zinc-500">Pending review</div><div className="mt-2 text-3xl font-black text-amber-300">{pending.length}</div></div>
        <div className="border border-white/10 bg-zinc-950 p-4"><div className="text-xs uppercase tracking-wider text-zinc-500">Active placements</div><div className="mt-2 text-3xl font-black text-emerald-300">{active.length}</div></div>
      </div>

      <section className="mb-9">
        <h3 className="mb-3 text-lg font-black">Placement packages</h3>
        {loadingPackages ? <Loader2 className="animate-spin" /> : (
          <div className="grid gap-3 md:grid-cols-3">
            {packages.map((item) => (
              <button key={item.id} onClick={() => setEditingPackage({ ...item })} className="border border-white/10 bg-zinc-950 p-4 text-left hover:border-cyan-400/40">
                <div className="flex items-start justify-between gap-3"><strong>{item.name}</strong><span className={item.is_active ? 'text-emerald-300' : 'text-zinc-600'}>{item.is_active ? 'Active' : 'Inactive'}</span></div>
                <div className="mt-2 text-2xl font-black text-cyan-300">${Number(item.price).toFixed(2)} {item.currency}</div>
                <div className="mt-1 text-sm text-zinc-400">1 year · per item{item.includes_featured ? ' · Featured' : ''}</div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-lg font-black">Submissions</h3>
        {loadingRequests ? <Loader2 className="animate-spin" /> : requests.length === 0 ? (
          <div className="border border-dashed border-white/15 p-8 text-center text-zinc-500">No placement submissions yet.</div>
        ) : (
          <div className="space-y-3">
            {requests.map((item) => (
              <div key={item.id} className="border border-white/10 bg-zinc-950 p-4">
                <div className="grid gap-4 lg:grid-cols-[90px_minmax(0,1fr)_180px_180px] lg:items-start">
                  <div className="h-20 w-20 overflow-hidden bg-zinc-900">
                    {item.featured_image ? <img src={item.featured_image} alt="" className="h-full w-full object-contain" /> : null}
                  </div>
                  <div>
                    <div className="font-black">{item.product_name}</div>
                    <div className="mt-1 text-sm text-zinc-400">{item.company_name || item.submitter_email}</div>
                    <div className="mt-2 text-xs text-zinc-500">{item.package_name || 'Package'} · {item.duration_days || 0} days · {Number(item.total_amount || item.subtotal || 0).toFixed(2)} {item.currency}</div>
                    {item.product_description && <p className="mt-3 text-sm text-zinc-400">{item.product_description}</p>}
                  </div>
                  <div className="text-sm">
                    <div>Payment: <strong className={item.payment_status === 'paid' ? 'text-emerald-300' : 'text-amber-300'}>{item.payment_status}</strong></div>
                    <div className="mt-1">Review: <strong>{item.review_status}</strong></div>
                    <div className="mt-1">Placement: <strong>{item.placement_status}</strong></div>
                    {item.expires_at && <div className="mt-1 text-zinc-500">Expires {new Date(item.expires_at).toLocaleDateString()}</div>}
                  </div>
                  <div>
                    {item.review_status === 'pending_review' ? (
                      <>
                        <textarea value={notes[item.id] || ''} onChange={(e) => setNotes((current) => ({ ...current, [item.id]: e.target.value }))} rows={2} placeholder="Admin note" className="w-full border border-white/10 bg-zinc-900 p-2 text-sm" />
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => review.mutate({ id: item.id, action: 'approve' })} disabled={review.isPending} className="flex flex-1 items-center justify-center gap-1 bg-emerald-500 px-3 py-2 text-xs font-black text-black"><Check size={14} /> Approve</button>
                          <button onClick={() => review.mutate({ id: item.id, action: 'reject' })} disabled={review.isPending} className="flex flex-1 items-center justify-center gap-1 bg-rose-500 px-3 py-2 text-xs font-black text-white"><X size={14} /> Reject</button>
                        </div>
                      </>
                    ) : <div className="text-xs text-zinc-500">{item.admin_notes || 'No action required.'}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {editingPackage && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg border border-white/10 bg-zinc-950 p-6">
            <h3 className="text-xl font-black">{editingPackage.id ? 'Edit package' : 'New package'}</h3>
            <div className="mt-5 space-y-3">
              <input value={editingPackage.name} onChange={(e) => setEditingPackage({ ...editingPackage, name: e.target.value })} placeholder="Package name" className="w-full border border-white/10 bg-black px-3 py-2" />
              <textarea value={editingPackage.description || ''} onChange={(e) => setEditingPackage({ ...editingPackage, description: e.target.value })} placeholder="Description" className="w-full border border-white/10 bg-black px-3 py-2" rows={3} />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" min="0" step="0.01" value={editingPackage.price} onChange={(e) => setEditingPackage({ ...editingPackage, price: e.target.value })} placeholder="Price" className="border border-white/10 bg-black px-3 py-2" />
                <input value={editingPackage.currency || 'CAD'} onChange={(e) => setEditingPackage({ ...editingPackage, currency: e.target.value })} placeholder="Currency" className="border border-white/10 bg-black px-3 py-2" />
                <div className="border border-white/10 bg-black px-3 py-2 text-sm text-zinc-300">Duration: <strong className="text-white">1 year (365 days)</strong></div>
                <input value={editingPackage.stripe_tax_code || ''} onChange={(e) => setEditingPackage({ ...editingPackage, stripe_tax_code: e.target.value })} placeholder="Stripe tax code (optional)" className="border border-white/10 bg-black px-3 py-2" />
                <input type="number" value={editingPackage.display_order} onChange={(e) => setEditingPackage({ ...editingPackage, display_order: e.target.value })} placeholder="Display order" className="border border-white/10 bg-black px-3 py-2" />
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editingPackage.includes_featured} onChange={(e) => setEditingPackage({ ...editingPackage, includes_featured: e.target.checked })} /> Includes featured placement</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editingPackage.is_active} onChange={(e) => setEditingPackage({ ...editingPackage, is_active: e.target.checked })} /> Active</label>
            </div>
            <div className="mt-6 flex gap-2">
              <button onClick={() => savePackage.mutate(editingPackage)} disabled={savePackage.isPending} className="flex-1 bg-cyan-400 px-4 py-3 font-black text-black">Save</button>
              <button onClick={() => setEditingPackage(null)} className="border border-white/15 px-4 py-3">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
