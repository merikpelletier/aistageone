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

  const stats = [
    { label: 'Costs', value: `${credits(costs)} cr`, icon: TrendingDown, iconClass: 'text-white/55' },
    { label: 'Revenue', value: `${credits(revenue)} cr`, icon: TrendingUp, iconClass: 'text-teal-300' },
    { label: 'Net', value: `${net > 0 ? '+' : ''}${credits(net)} cr`, icon: Scale, iconClass: 'text-white/70' },
  ];

  return (
    <div className="bg-black border border-white/10 rounded-3xl p-6 space-y-5 shadow-2xl lg:rounded-[1vw] lg:p-[2%] lg:space-y-[2%]">
      <div className="flex items-center gap-3 lg:gap-[1.5%]">
        <div className="w-10 h-10 bg-teal-400 rounded-xl flex items-center justify-center lg:w-[5%] lg:aspect-square lg:h-auto lg:rounded-[20%]">
          <BarChart3 className="text-black w-1/2 h-1/2" />
        </div>
        <div>
          <p className="text-white text-xl font-bold uppercase tracking-wider lg:text-[1.15vw]">Economics</p>
          <p className="text-white/50 text-xs font-medium lg:text-[0.68vw]">Private — only you can see this</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:grid-cols-3 lg:gap-[1.5%] lg:border-y lg:border-white/10 lg:py-[1.5%]">
        {stats.map(({ label, value, icon: Icon, iconClass }) => (
          <div key={label} className="bg-white/5 rounded-2xl p-5 border border-white/10 lg:bg-transparent lg:border-0 lg:rounded-none lg:p-[1%] lg:flex lg:items-center lg:gap-[6%] lg:[&:not(:last-child)]:border-r lg:[&:not(:last-child)]:border-white/10">
            <Icon className={`${iconClass} w-5 h-5 mb-3 lg:mb-0 lg:w-[9%] lg:h-auto`} />
            <div>
              <p className="text-white/50 text-xs font-bold uppercase tracking-wide lg:text-[0.66vw]">{label}</p>
              <p className="mt-1 text-white text-2xl font-bold lg:mt-0 lg:text-[1.2vw]">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {isLoading && <p className="text-white/40 text-sm py-2 lg:text-[0.72vw] lg:py-[0.5%]">Loading economics…</p>}
      {error && <p className="text-red-300 text-sm py-2 lg:text-[0.72vw] lg:py-[0.5%]">Economics are temporarily unavailable.</p>}

      {!isLoading && !error && byDossier.size > 0 && (
        <div className="space-y-2 lg:space-y-[1%]">
          <p className="text-white/50 text-xs font-bold uppercase tracking-wider lg:text-[0.66vw]">By publication</p>
          {[...byDossier.entries()].map(([dossierId, row]) => {
            const rowNet = row.revenue - row.costs;
            return (
              <details key={dossierId} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden lg:rounded-[0.6vw]">
                <summary className="cursor-pointer list-none px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 lg:px-[2%] lg:py-[1.2%] lg:gap-[2%]">
                  <span className="text-white text-sm font-semibold lg:text-[0.74vw]">
                    {dossierId === 'unallocated' ? 'Not yet assigned to a publication' : (dossierTitles[dossierId] || 'Publication')}
                  </span>
                  <span className="flex gap-4 text-xs text-white/55 lg:gap-[1.5vw] lg:text-[0.66vw]">
                    <span>Costs <strong className="text-white">{credits(row.costs)} cr</strong></span>
                    <span>Revenue <strong className="text-white">{credits(row.revenue)} cr</strong></span>
                    <span>Net <strong className="text-white">{rowNet > 0 ? '+' : ''}{credits(rowNet)} cr</strong></span>
                  </span>
                </summary>
                <div className="border-t border-white/10 px-4 py-3 space-y-2 lg:px-[2%] lg:py-[1%] lg:space-y-[0.5%]">
                  {row.events.map(event => (
                    <div key={event.id} className="flex items-center justify-between gap-3 text-sm lg:gap-[2%] lg:text-[0.72vw]">
                      <div className="min-w-0">
                        <p className="text-white/80 truncate">{event.category || event.asset_type || event.source_type || 'Activity'}</p>
                        {event.occurred_at && <p className="text-white/30 text-xs lg:text-[0.62vw]">{new Date(event.occurred_at).toLocaleDateString()}</p>}
                      </div>
                      <p className="text-white font-semibold flex-shrink-0">{event.direction === 'revenue' ? '+' : '-'}{credits(event.credits)} cr</p>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      )}

      {!isLoading && !error && events.length === 0 && (
        <p className="text-white/40 text-sm text-center py-2 lg:text-[0.72vw] lg:py-[0.6%] lg:text-left">No economics activity yet.</p>
      )}
    </div>
  );
}
