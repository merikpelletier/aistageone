import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/base44Client';

export default function AdminFanDonations() {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['fan-donation-settings-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fan_donation_settings').select('*').eq('id', true).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: donations = [] } = useQuery({
    queryKey: ['fan-donations-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fan_donation').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const [form, setForm] = useState(null);
  useEffect(() => {
    if (settings) setForm({
      platform_fee_percent: settings.platform_fee_percent ?? 10,
      minimum_amount_cents: settings.minimum_amount_cents ?? 200,
      maximum_amount_cents: settings.maximum_amount_cents ?? 100000,
    });
  }, [settings]);

  const save = useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase.functions.invoke('admin-finance', {
        body: { action: 'save_donation_settings', ...payload },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fan-donation-settings-admin'] }),
  });

  if (isLoading || !form) return <p className="text-white/60 text-sm py-6">Loading donation settings…</p>;

  const paid = donations.filter(d => d.status === 'paid');
  const gross = paid.reduce((s,d)=>s + Number(d.amount_cents || 0), 0) / 100;
  const platform = paid.reduce((s,d)=>s + Number(d.platform_share_cents || 0), 0) / 100;
  const creators = paid.reduce((s,d)=>s + Number(d.creator_share_cents || 0), 0) / 100;

  return <div className="space-y-6">
    <div className="grid gap-3 md:grid-cols-3">
      <div className="bg-white/5 border border-white/10 rounded-xl p-4"><p className="text-white/40 text-xs uppercase">Paid donations</p><p className="text-white text-2xl font-semibold">{gross.toFixed(2)} CAD</p></div>
      <div className="bg-white/5 border border-white/10 rounded-xl p-4"><p className="text-white/40 text-xs uppercase">AISTAGE share</p><p className="text-yellow-400 text-2xl font-semibold">{platform.toFixed(2)} CAD</p></div>
      <div className="bg-white/5 border border-white/10 rounded-xl p-4"><p className="text-white/40 text-xs uppercase">Creators share</p><p className="text-green-400 text-2xl font-semibold">{creators.toFixed(2)} CAD</p></div>
    </div>

    <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-4">
      <h3 className="text-white font-semibold">Donation settings</h3>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-white/60 text-xs">AISTAGE share (%)
          <input className="mt-1 w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white" type="number" min="0" max="100" step="0.1" value={form.platform_fee_percent} onChange={e=>setForm({...form,platform_fee_percent:e.target.value})}/>
        </label>
        <label className="text-white/60 text-xs">Minimum donation (CAD)
          <input className="mt-1 w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white" type="number" min="1" step="1" value={Number(form.minimum_amount_cents||0)/100} onChange={e=>setForm({...form,minimum_amount_cents:Math.round(Number(e.target.value||0)*100)})}/>
        </label>
        <label className="text-white/60 text-xs">Maximum donation (CAD)
          <input className="mt-1 w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white" type="number" min="1" step="1" value={Number(form.maximum_amount_cents||0)/100} onChange={e=>setForm({...form,maximum_amount_cents:Math.round(Number(e.target.value||0)*100)})}/>
        </label>
      </div>
      <button onClick={()=>save.mutate(form)} disabled={save.isPending} className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg disabled:opacity-40">{save.isPending?'Saving…':'Save donation settings'}</button>
      {save.isSuccess && <span className="ml-3 text-green-400 text-xs">Saved.</span>}
    </div>

    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <h3 className="text-white font-semibold mb-3">Donation history</h3>
      {donations.length===0 ? <p className="text-white/40 text-sm">No fan donations yet.</p> :
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
        <thead><tr className="text-white/40 text-left"><th className="p-3">Date</th><th className="p-3">Fan</th><th className="p-3">Creator</th><th className="p-3">Gross</th><th className="p-3">AISTAGE</th><th className="p-3">Creator</th><th className="p-3">Status</th></tr></thead>
        <tbody>{donations.map(d=><tr key={d.id} className="border-t border-white/10 text-white"><td className="p-3">{new Date(d.paid_at||d.created_at).toLocaleDateString('en-CA')}</td><td className="p-3">{d.donor_email}</td><td className="p-3">{d.creator_email}</td><td className="p-3">{(Number(d.amount_cents||0)/100).toFixed(2)}</td><td className="p-3 text-yellow-400">{(Number(d.platform_share_cents||0)/100).toFixed(2)}</td><td className="p-3 text-green-400">{(Number(d.creator_share_cents||0)/100).toFixed(2)}</td><td className="p-3 uppercase text-xs">{d.status}</td></tr>)}</tbody>
      </table></div>}
    </div>
  </div>;
}
