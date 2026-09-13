import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { HandCoins, Users, TrendingUp, ChevronDown, ChevronRight, Mail, DollarSign } from 'lucide-react';

const statusStyles = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  approved: 'bg-green-500/20 text-green-400 border-green-500/40',
  active: 'bg-green-500/20 text-green-400 border-green-500/40',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/40',
  expired: 'bg-gray-500/20 text-gray-400 border-gray-500/40',
};

export default function SponsorsContributorsSection({ userEmail }) {
  const [expandedSection, setExpandedSection] = useState('sponsors');

  // Fetch sponsors
  const { data: sponsors = [], isLoading: sponsorsLoading } = useQuery({
    queryKey: ['profileSponsors', userEmail],
    queryFn: () => base44.entities.ProfileSponsor.filter({ member_email: userEmail }, '-submitted_at'),
    enabled: !!userEmail,
  });

  // Fetch sponsor sales
  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['sponsorSales', userEmail],
    queryFn: () => base44.entities.SponsorSale.filter({ member_email: userEmail }, '-sale_date'),
    enabled: !!userEmail,
  });

  // Fetch fan subscribers
  const { data: fans = [], isLoading: fansLoading } = useQuery({
    queryKey: ['fanSubscriptions', userEmail],
    queryFn: () => base44.entities.ProfileFanSubscription.filter({ target_profile_id: userEmail }, '-created_at'),
    enabled: !!userEmail,
  });

  // Fetch monthly earnings
  const { data: earnings = [] } = useQuery({
    queryKey: ['memberEarnings', userEmail],
    queryFn: () => base44.entities.MemberEarnings.filter({ member_email: userEmail }, '-payout_month'),
    enabled: !!userEmail,
  });

  const totalMemberEarnings = sales.reduce((sum, s) => sum + (s.member_share || 0), 0);
  const totalSalesAmount = sales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
  const activeSponsors = sponsors.filter(s => s.status === 'active' || s.status === 'approved');
  const activeFans = fans.filter(f => f.status === 'active');

  if (sponsorsLoading || salesLoading || fansLoading) return null;

  const toggleSection = (section) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  return (
    <div className="bg-black border border-white/10 rounded-3xl p-6 space-y-5 shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
          <HandCoins size={20} className="text-black" />
        </div>
        <div>
          <p className="text-white text-xl font-bold uppercase tracking-wider">Sponsors & Contributors</p>
          <p className="text-white/50 text-xs font-medium">Private — only you can see this</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/10">
          <DollarSign size={18} className="text-green-400 mx-auto mb-1" />
          <p className="text-green-400 text-2xl font-bold">${totalMemberEarnings.toFixed(2)}</p>
          <p className="text-white/50 text-xs font-bold uppercase tracking-wide mt-1">Earned</p>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/10">
          <HandCoins size={18} className="text-yellow-400 mx-auto mb-1" />
          <p className="text-yellow-400 text-2xl font-bold">{activeSponsors.length}</p>
          <p className="text-white/50 text-xs font-bold uppercase tracking-wide mt-1">Sponsors</p>
        </div>
        <div className="bg-white/5 rounded-2xl p-4 text-center border border-white/10">
          <Users size={18} className="text-blue-400 mx-auto mb-1" />
          <p className="text-blue-400 text-2xl font-bold">{activeFans.length}</p>
          <p className="text-white/50 text-xs font-bold uppercase tracking-wide mt-1">Fans</p>
        </div>
      </div>

      {/* Sponsors List */}
      <div className="space-y-2">
        <button
          onClick={() => toggleSection('sponsors')}
          className="w-full flex items-center justify-between px-4 py-3 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            {expandedSection === 'sponsors' ? <ChevronDown size={18} className="text-white/60" /> : <ChevronRight size={18} className="text-white/60" />}
            <HandCoins size={16} className="text-yellow-400" />
            <span className="text-white text-sm font-bold uppercase tracking-wide">Sponsors ({sponsors.length})</span>
          </div>
          <span className="text-green-400 text-sm font-bold">${totalSalesAmount.toFixed(2)}</span>
        </button>

        {expandedSection === 'sponsors' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 pl-2">
            {sponsors.length === 0 ? (
              <p className="text-white/40 text-sm font-medium py-4 text-center">No sponsors yet</p>
            ) : (
              sponsors.map((sponsor) => (
                <div key={sponsor.id} className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-2xl border border-white/10">
                  <div className="w-10 h-10 bg-yellow-400/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <HandCoins size={16} className="text-yellow-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-bold truncate">{sponsor.sponsor_name || 'Unknown Sponsor'}</p>
                    {sponsor.sponsor_email && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Mail size={10} className="text-white/40" />
                        <p className="text-white/40 text-xs truncate">{sponsor.sponsor_email}</p>
                      </div>
                    )}
                    {sponsor.bracket_name && (
                      <p className="text-white/50 text-xs mt-0.5">{sponsor.bracket_name} · {sponsor.bracket_duration}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {sponsor.bracket_price > 0 && (
                      <p className="text-green-400 text-sm font-bold">${sponsor.bracket_price.toFixed(2)}</p>
                    )}
                    {sponsor.member_share > 0 && (
                      <p className="text-white/40 text-xs">You: ${sponsor.member_share.toFixed(2)}</p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-lg border font-bold uppercase tracking-wide ${statusStyles[sponsor.status] || statusStyles.pending}`}>
                    {sponsor.status}
                  </span>
                </div>
              ))
            )}
          </motion.div>
        )}
      </div>

      {/* Sales History */}
      {sales.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => toggleSection('sales')}
            className="w-full flex items-center justify-between px-4 py-3 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              {expandedSection === 'sales' ? <ChevronDown size={18} className="text-white/60" /> : <ChevronRight size={18} className="text-white/60" />}
              <TrendingUp size={16} className="text-green-400" />
              <span className="text-white text-sm font-bold uppercase tracking-wide">Sales History ({sales.length})</span>
            </div>
            <span className="text-green-400 text-sm font-bold">${totalMemberEarnings.toFixed(2)}</span>
          </button>

          {expandedSection === 'sales' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 pl-2">
              {sales.map((sale) => (
                <div key={sale.id} className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-2xl border border-white/10">
                  <div className="w-10 h-10 bg-green-400/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <TrendingUp size={16} className="text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-bold truncate">{sale.bracket_name}</p>
                    <p className="text-white/40 text-xs mt-0.5">
                      {sale.sale_date ? new Date(sale.sale_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''} · {sale.duration}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-white text-sm font-bold">${sale.total_amount?.toFixed(2)}</p>
                    <p className="text-green-400 text-xs">You: ${sale.member_share?.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      )}

      {/* Monthly Earnings */}
      {earnings.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => toggleSection('earnings')}
            className="w-full flex items-center justify-between px-4 py-3 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              {expandedSection === 'earnings' ? <ChevronDown size={18} className="text-white/60" /> : <ChevronRight size={18} className="text-white/60" />}
              <DollarSign size={16} className="text-green-400" />
              <span className="text-white text-sm font-bold uppercase tracking-wide">Monthly Payouts ({earnings.length})</span>
            </div>
          </button>

          {expandedSection === 'earnings' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 pl-2">
              {earnings.map((earning) => (
                <div key={earning.id} className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-2xl border border-white/10">
                  <div className="w-10 h-10 bg-green-400/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <DollarSign size={16} className="text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-bold">{earning.payout_month}</p>
                    <p className="text-white/40 text-xs">Sales: ${earning.total_sales?.toFixed(2)} · Platform: ${earning.platform_total?.toFixed(2)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-green-400 text-sm font-bold">${earning.member_total?.toFixed(2)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-md font-bold uppercase ${earning.status === 'paid' ? 'text-green-400' : 'text-yellow-400'}`}>
                      {earning.status}
                    </span>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      )}

      {/* Fans / Contributors */}
      <div className="space-y-2">
        <button
          onClick={() => toggleSection('fans')}
          className="w-full flex items-center justify-between px-4 py-3 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors"
        >
          <div className="flex items-center gap-3">
            {expandedSection === 'fans' ? <ChevronDown size={18} className="text-white/60" /> : <ChevronRight size={18} className="text-white/60" />}
            <Users size={16} className="text-blue-400" />
            <span className="text-white text-sm font-bold uppercase tracking-wide">Fans ({fans.length})</span>
          </div>
          <span className="text-blue-400 text-sm font-bold">{activeFans.length} active</span>
        </button>

        {expandedSection === 'fans' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 pl-2">
            {fans.length === 0 ? (
              <p className="text-white/40 text-sm font-medium py-4 text-center">No fans yet</p>
            ) : (
              fans.map((fan) => (
                <div key={fan.id} className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-2xl border border-white/10">
                  <div className="w-10 h-10 bg-blue-400/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Users size={16} className="text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-bold truncate">{fan.email}</p>
                    {fan.created_at && (
                      <p className="text-white/40 text-xs mt-0.5">
                        Joined {new Date(fan.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-lg border font-bold uppercase tracking-wide ${fan.status === 'active' ? 'bg-green-500/20 text-green-400 border-green-500/40' : 'bg-gray-500/20 text-gray-400 border-gray-500/40'}`}>
                    {fan.status}
                  </span>
                </div>
              ))
            )}
          </motion.div>
        )}
      </div>

      {sponsors.length === 0 && sales.length === 0 && fans.length === 0 && (
        <div className="py-8 text-center">
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <HandCoins size={28} className="text-white/30" />
          </div>
          <p className="text-white/60 text-base font-medium">No sponsors or contributors yet</p>
          <p className="text-white/40 text-sm mt-2">When someone sponsors your profile or subscribes as a fan, they'll appear here with their contribution details</p>
        </div>
      )}
    </div>
  );
}