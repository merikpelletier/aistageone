import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingDown, TrendingUp, Scale } from 'lucide-react';
import { supabase } from '@/api/base44Client';

function credits(value) {
  return new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 0 }).format(Number(value || 0));
}

export default function MemberEconomicsSection({ ownerId, dossiers = [] }) {
  const { data: events = [], isLoading, error } = useQuery({
    queryKey: ['member-economics', ownerId],
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from('publication_economics_event')
        .select('id,dossier_id,asset_id,asset_type,direction,category,credits,source_type,source_id,occurred_at')
        .eq('owner_id', ownerId)
        .order('occurred_at', { ascending: false });
      if (queryError) throw queryError;
      return data || [];
    },
    enabled: !!ownerId,
    retry: false,
  });

  if (!ownerId) return null;

  const costs = events.filter(e => e.direction === 'cost').reduce((sum, e) => sum + Number(e.credits || 0), 0);
  const revenue = events.filter(e => e.direction === 'revenue').reduce((sum, e) => sum + Number(e.credits || 0), 0);
  const net = revenue - costs;
  const dossierTitles = Object.fromEntries(dossiers.map(d => [String(d.id), d.title || 'Untitled']));

  const byDossier = new Map();
  for (const event of events) {
    const key = event.dossier_id ? String(event.dossier_id) : 'unallocated';
    if (!byDossier.has(key)) byDossier.set(key, { costs: 0, revenue: 0, events: [] });
    const row = byDossier.get(key);
    if (event.direction === 'cost') row.costs += Number(event.credits || 0);
    if (event.direction === 'revenue') row.revenue += Number(event.credits || 0);
    row.events.push(event);
  }

  return (
    <div className="bg-black border border-white/10 rounded-3xl p-6 space-y-5 shadow-2xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-teal-400 rounded-xl flex items-center justify-center">
          <BarChart3 size={20} className="text-black" />
        </div>
        <div>
          <p className="text-white text-xl font-bold uppercase tracking-wider">Economics</p>
          <p className="text-white/50 text-xs font-medium">Private — only you can see this</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <TrendingDown size={20} className="text-white/55 mb-3" />
          <p className="text-white/50 text-xs font-bold uppercase tracking-wide">Costs</p>
          <p className="mt-1 text-white text-2xl font-bold">{credits(costs)} cr</p>
        </div>
        <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <TrendingUp size={20} className="text-teal-300 mb-3" />
          <p className="text-white/50 text-xs font-bold uppercase tracking-wide">Revenue</p>
          <p className="mt-1 text-white text-2xl font-bold">{credits(revenue)} cr</p>
        </div>
        <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <Scale size={20} className="text-white/70 mb-3" />
          <p className="text-white/50 text-xs font-bold uppercase tracking-wide">Net</p>
          <p className="mt-1 text-white text-2xl font-bold">{net > 0 ? '+' : ''}{credits(net)} cr</p>
        </div>
      </div>

      {isLoading && <p className="text-white/40 text-sm py-2">Loading economics…</p>}
      {error && <p className="text-red-300 text-sm py-2">Economics are temporarily unavailable.</p>}

      {!isLoading && !error && byDossier.size > 0 && (
        <div className="space-y-2">
          <p className="text-white/50 text-xs font-bold uppercase tracking-wider">By publication</p>
          {[...byDossier.entries()].map(([dossierId, row]) => {
            const rowNet = row.revenue - row.costs;
            return (
              <details key={dossierId} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <summary className="cursor-pointer list-none px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <span className="text-white text-sm font-semibold">
                    {dossierId === 'unallocated' ? 'Not yet assigned to a publication' : (dossierTitles[dossierId] || 'Publication')}
                  </span>
                  <span className="flex gap-4 text-xs text-white/55">
                    <span>Costs <strong className="text-white">{credits(row.costs)} cr</strong></span>
                    <span>Revenue <strong className="text-white">{credits(row.revenue)} cr</strong></span>
                    <span>Net <strong className="text-white">{rowNet > 0 ? '+' : ''}{credits(rowNet)} cr</strong></span>
                  </span>
                </summary>
                <div className="border-t border-white/10 px-4 py-3 space-y-2">
                  {row.events.map(event => (
                    <div key={event.id} className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="text-white/80 truncate">{event.category || event.asset_type || event.source_type || 'Activity'}</p>
                        {event.occurred_at && <p className="text-white/30 text-xs">{new Date(event.occurred_at).toLocaleDateString()}</p>}
                      </div>
                      <p className="text-white font-semibold flex-shrink-0">
                        {event.direction === 'revenue' ? '+' : '-'}{credits(event.credits)} cr
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      )}

      {!isLoading && !error && events.length === 0 && (
        <p className="text-white/40 text-sm text-center py-2">No economics activity yet.</p>
      )}
    </div>
  );
}
