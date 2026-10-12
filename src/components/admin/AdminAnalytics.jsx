import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  BarChart3,
  Bot,
  Boxes,
  CreditCard,
  FileText,
  Handshake,
  ShoppingBag,
  Users,
  WandSparkles,
} from 'lucide-react';
import { supabase } from '@/api/base44Client';

const sections = [
  ['overview', 'Overview'],
  ['traffic', 'Traffic'],
  ['content', 'Content'],
  ['members', 'Members'],
  ['studio', 'Studio'],
  ['sales', 'Sales & Credits'],
  ['sponsors', 'Sponsors'],
  ['commerce', 'Shop / 3D'],
  ['ai', 'AI Usage'],
];

const comingSoonCards = [
  ['Page Views', BarChart3],
  ['Published Content', FileText],
  ['Studio Sessions', WandSparkles],
  ['Credits Purchased', CreditCard],
  ['Revenue', Activity],
  ['Sponsors', Handshake],
  ['Shop / 3D', ShoppingBag],
  ['AI Runs', Bot],
];

function MetricCard({ label, value, icon: Icon, note }) {
  return (
    <div className="bg-neutral-950 border border-white/10 p-5 min-h-32">
      <div className="flex items-center justify-between gap-4">
        <span className="text-white/50 text-xs uppercase tracking-wider">{label}</span>
        <Icon size={17} className="text-white/55" />
      </div>
      <div className="text-white text-3xl font-extralight mt-5">{value}</div>
      {note && <div className="text-white/35 text-xs mt-2">{note}</div>}
    </div>
  );
}

function PendingPanel({ title, description, icon: Icon }) {
  return (
    <div className="border border-white/10 bg-neutral-950 p-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 border border-white/15 flex items-center justify-center shrink-0">
          <Icon size={18} className="text-white/60" />
        </div>
        <div>
          <h3 className="text-white font-light">{title}</h3>
          <p className="text-white/45 text-sm mt-1 leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminAnalytics() {
  const [section, setSection] = useState('overview');
  const [range, setRange] = useState('30d');

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['analyticsRegisteredMembers'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_member_profiles_v2');
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  const memberMetrics = useMemo(() => {
    const active = members.filter(m => (m.moderation_status || 'active') === 'active').length;
    return { total: members.length, active };
  }, [members]);

  const renderOverview = () => (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard label="Members" value={membersLoading ? '…' : memberMetrics.total} icon={Users} note="Live from Supabase" />
        <MetricCard label="Active Members" value={membersLoading ? '…' : memberMetrics.active} icon={Users} note="Live from Supabase" />
        {comingSoonCards.slice(0, 2).map(([label, Icon]) => (
          <MetricCard key={label} label={label} value="—" icon={Icon} note="Tracking connection next" />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PendingPanel title="Vercel traffic data" icon={BarChart3} description="Web Analytics is active on AISTAGE.ONE. This admin panel is ready for visitors, page views, countries, devices, referrers and top pages once the secure server-side data bridge is connected." />
        <PendingPanel title="AISTAGE.ONE activity events" icon={Activity} description="The business layer will record platform events such as publishing, dossier views, Studio usage, credit purchases, sponsor activity, shop activity, 3D downloads and AI usage in Supabase." />
      </div>

      <div>
        <h3 className="text-white text-sm font-light mb-3">Analytics coverage</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {comingSoonCards.slice(2).map(([label, Icon]) => (
            <MetricCard key={label} label={label} value="—" icon={Icon} note="Event tracking pending" />
          ))}
        </div>
      </div>
    </div>
  );

  const panels = {
    traffic: ['Traffic Analytics', 'Visitors, page views, countries, devices, referrers, UTM campaigns and top pages from Vercel Web Analytics.', BarChart3],
    content: ['Content Analytics', 'Views, opens, completion, publications, dossier performance and top-performing content.', FileText],
    members: ['Member Analytics', `Current member profiles are already available here (${membersLoading ? 'loading' : memberMetrics.total} total). New registrations, retention and activity trends will be added next.`, Users],
    studio: ['Studio Analytics', 'Tool launches, sessions, generated assets, publishes, failed runs and most-used production tools.', WandSparkles],
    sales: ['Sales & Credits', 'Credit purchases, credit consumption, revenue, platform fees, refunds and conversion by product or tool.', CreditCard],
    sponsors: ['Sponsor Analytics', 'Sponsor campaigns, content associations, impressions, clicks, conversions and sponsor revenue.', Handshake],
    commerce: ['Shop / 3D Analytics', 'Product views, purchases, downloads, 3D model activity and conversion performance.', Boxes],
    ai: ['AI Usage', 'Runs by provider and model, cost, credits charged, failures, average cost and usage by Studio tool.', Bot],
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <BarChart3 size={22} className="text-white" />
            <h2 className="text-white text-xl font-extralight tracking-wide">Analytics</h2>
          </div>
          <p className="text-white/45 text-sm mt-2">Traffic, audience, production activity and revenue performance in one admin module.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {['today', '7d', '30d', '90d'].map(value => (
            <button
              key={value}
              onClick={() => setRange(value)}
              className={`px-3 py-2 text-xs border ${range === value ? 'bg-white text-black border-white' : 'bg-black text-white/65 border-white/15 hover:border-white/35'}`}
            >
              {value === 'today' ? 'Today' : value.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {sections.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setSection(value)}
            className={`whitespace-nowrap px-4 py-2 text-xs border ${section === value ? 'bg-white text-black border-white' : 'bg-neutral-950 text-white/65 border-white/10 hover:border-white/30'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {section === 'overview' ? renderOverview() : (() => {
        const [title, description, Icon] = panels[section];
        return (
          <div className="space-y-4">
            <PendingPanel title={title} description={description} icon={Icon} />
            <div className="border border-dashed border-white/15 min-h-72 flex items-center justify-center text-center p-8">
              <div>
                <Icon size={28} className="text-white/25 mx-auto mb-4" />
                <p className="text-white/50 text-sm">The section is in place. No synthetic statistics are displayed.</p>
                <p className="text-white/30 text-xs mt-2">Live data will appear here as each tracking source is connected.</p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
