import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Check, X, DollarSign, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';

const PLATFORM_CUT = 0.30;
const MEMBER_CUT = 0.70;

function getPayoutMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function AdminSponsorSales() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ member_email: '', bracket_id: '', notes: '' });
  const [activeMonth, setActiveMonth] = useState(getPayoutMonth());
  const [expandedMember, setExpandedMember] = useState(null);

  const { data: brackets = [] } = useQuery({
    queryKey: ['sponsor-brackets'],
    queryFn: () => base44.entities.SponsorBracket.filter({ is_active: true }, 'name'),
  });

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['sponsor-sales'],
    queryFn: () => base44.entities.SponsorSale.list('-sale_date'),
  });

  const { data: earnings = [], isLoading: earningsLoading } = useQuery({
    queryKey: ['member-earnings'],
    queryFn: () => base44.entities.MemberEarnings.list('-payout_month'),
  });

  const createSaleMutation = useMutation({
    mutationFn: async (saleData) => {
      // Create the sale record
      await base44.entities.SponsorSale.create(saleData);

      // Upsert MemberEarnings for the month
      const month = saleData.payout_month;
      const email = saleData.member_email;
      const existing = earnings.find(e => e.member_email === email && e.payout_month === month);

      if (existing) {
        await base44.entities.MemberEarnings.update(existing.id, {
          total_sales: existing.total_sales + saleData.total_amount,
          platform_total: existing.platform_total + saleData.platform_share,
          member_total: existing.member_total + saleData.member_share,
        });
      } else {
        await base44.entities.MemberEarnings.create({
          member_email: email,
          payout_month: month,
          total_sales: saleData.total_amount,
          platform_total: saleData.platform_share,
          member_total: saleData.member_share,
          status: 'pending',
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sponsor-sales'] });
      qc.invalidateQueries({ queryKey: ['member-earnings'] });
      setForm({ member_email: '', bracket_id: '', notes: '' });
      setAdding(false);
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ id }) => base44.entities.MemberEarnings.update(id, { status: 'paid', paid_at: new Date().toISOString() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['member-earnings'] }),
  });

  const selectedBracket = brackets.find(b => b.id === form.bracket_id);

  const handleRecord = () => {
    if (!form.member_email || !selectedBracket) return;
    const total = selectedBracket.price;
    const platform = parseFloat((total * PLATFORM_CUT).toFixed(2));
    const member = parseFloat((total * MEMBER_CUT).toFixed(2));
    const now = new Date();

    createSaleMutation.mutate({
      member_email: form.member_email,
      bracket_id: selectedBracket.id,
      bracket_name: selectedBracket.name,
      duration: selectedBracket.duration,
      total_amount: total,
      platform_share: platform,
      member_share: member,
      sale_date: now.toISOString(),
      payout_month: getPayoutMonth(now),
      notes: form.notes,
    });
  };

  // Group earnings by month for the summary view
  const monthEarnings = earnings.filter(e => e.payout_month === activeMonth);
  const availableMonths = [...new Set(earnings.map(e => e.payout_month))].sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">

      {/* Record a Sale */}
      <div className="flex justify-end">
        <button
          onClick={() => setAdding(!adding)}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 transition-colors"
        >
          <Plus size={15} /> Record Sale
        </button>
      </div>

      {adding && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
          <p className="text-white text-sm font-medium">New Sponsor Sale</p>
          <input
            type="text"
            placeholder="Member email"
            value={form.member_email}
            onChange={e => setForm({ ...form, member_email: e.target.value })}
            className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30"
          />
          <select
            value={form.bracket_id}
            onChange={e => setForm({ ...form, bracket_id: e.target.value })}
            className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/30"
          >
            <option value="">Select a pricing bracket</option>
            {brackets.map(b => (
              <option key={b.id} value={b.id}>{b.name} — ${b.price} / {b.duration}</option>
            ))}
          </select>

          {selectedBracket && (
            <div className="grid grid-cols-3 gap-2 bg-white/5 rounded-lg p-3">
              <div className="text-center">
                <p className="text-white text-xs mb-1">Total</p>
                <p className="text-white font-semibold">${selectedBracket.price}</p>
              </div>
              <div className="text-center">
                <p className="text-white text-xs mb-1">Platform (30%)</p>
                <p className="text-yellow-400 font-semibold">${(selectedBracket.price * 0.3).toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-white text-xs mb-1">Member (70%)</p>
                <p className="text-green-400 font-semibold">${(selectedBracket.price * 0.7).toFixed(2)}</p>
              </div>
            </div>
          )}

          <textarea
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30 resize-none"
          />

          <div className="flex gap-2">
            <button
              onClick={handleRecord}
              disabled={!form.member_email || !form.bracket_id || createSaleMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm rounded-lg hover:bg-white/90 disabled:opacity-40 transition-colors"
            >
              <Check size={14} /> {createSaleMutation.isPending ? 'Saving...' : 'Record'}
            </button>
            <button
              onClick={() => setAdding(false)}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white text-sm rounded-lg hover:bg-white/20 transition-colors"
            >
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Monthly Earnings Summary */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white text-sm font-medium flex items-center gap-2">
            <TrendingUp size={15} /> Monthly Earnings
          </h3>
          {availableMonths.length > 0 && (
            <select
              value={activeMonth}
              onChange={e => setActiveMonth(e.target.value)}
              className="px-3 py-1.5 bg-white/10 border border-white/10 rounded-lg text-white text-xs focus:outline-none"
            >
              {availableMonths.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
        </div>

        {earningsLoading && <p className="text-white text-sm text-center py-4">Loading...</p>}
        {!earningsLoading && monthEarnings.length === 0 && (
          <p className="text-white text-sm text-center py-4">No earnings for {activeMonth}.</p>
        )}

        <div className="space-y-2">
          {monthEarnings.map(e => (
            <div key={e.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{e.member_email}</p>
                  <div className="flex gap-3 mt-0.5">
                    <span className="text-white text-xs">Total: <span className="text-white">${e.total_sales.toFixed(2)}</span></span>
                    <span className="text-yellow-400/70 text-xs">Platform: <span className="text-yellow-400">${e.platform_total.toFixed(2)}</span></span>
                    <span className="text-green-400/70 text-xs">Member: <span className="text-green-400">${e.member_total.toFixed(2)}</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`px-2.5 py-1 text-xs rounded-full font-medium ${
                    e.status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {e.status === 'paid' ? 'Paid' : 'Pending'}
                  </span>
                  {e.status === 'pending' && (
                    <button
                      onClick={() => markPaidMutation.mutate({ id: e.id })}
                      className="flex items-center gap-1 px-3 py-1 bg-white text-black text-xs rounded-lg hover:bg-white/90 transition-colors"
                    >
                      <DollarSign size={12} /> Mark Paid
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedMember(expandedMember === e.id ? null : e.id)}
                    className="text-white hover:text-white transition-colors"
                  >
                    {expandedMember === e.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                </div>
              </div>

              {expandedMember === e.id && (
                <div className="border-t border-white/10 px-3 pb-3 pt-2">
                  <p className="text-white text-xs mb-2">Sales this month</p>
                  {sales
                    .filter(s => s.member_email === e.member_email && s.payout_month === e.payout_month)
                    .map(s => (
                      <div key={s.id} className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-xs">{s.bracket_name} <span className="text-white">({s.duration})</span></p>
                          {s.notes && <p className="text-white text-xs">{s.notes}</p>}
                          <p className="text-white text-xs">{format(new Date(s.sale_date), 'MMM d, yyyy')}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-white text-xs font-medium">${s.total_amount}</p>
                          <p className="text-green-400 text-xs">+${s.member_share} member</p>
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}