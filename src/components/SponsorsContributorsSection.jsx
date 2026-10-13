import React, { useState } from 'react';
import { base44, supabase } from '@/api/base44Client';
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

  const { data: sponsors = [], isLoading: sponsorsLoading } = useQuery({
    queryKey: ['profileSponsors', userEmail],
    queryFn: () => base44.entities.ProfileSponsor.filter({ member_email: userEmail }, '-submitted_at'),
    enabled: !!userEmail,
  });

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['sponsorSales', userEmail],
    queryFn: () => base44.entities.SponsorSale.filter({ member_email: userEmail }, '-sale_date'),
    enabled: !!userEmail,
  });

  const { data: fans = [], isLoading: fansLoading } = useQuery({
    queryKey: ['fanSubscriptions', userEmail],
    queryFn: () => base44.entities.ProfileFanSubscription.filter({ target_profile_id: userEmail }, '-created_at'),
    enabled: !!userEmail,
  });

  const { data: donations = [], isLoading: donationsLoading } = useQuery({
    queryKey: ['fanDonations', userEmail],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fan_donation')
        .select('*')
        .eq('creator_email', String(userEmail || '').toLowerCase())
        .eq('status', 'paid')
        .order('paid_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userEmail,
  });

  const { data: earnings = [] } = useQuery({
    queryKey: ['memberEarnings', userEmail],
    queryFn: () => base44.entities.MemberEarnings.filter({ member_email: userEmail }, '-payout_month'),
    enabled: !!userEmail,
  });

  const donationCreatorEarnings = donations.reduce((sum, d) => sum + Number(d.creator_share_cents || 0) / 100, 0);
  const donationGross = donations.reduce((sum, d) => sum + Number(d.amount_cents || 0) / 100, 0);
  const totalMemberEarnings = sales.reduce((sum, s) => sum + (s.member_share || 0), 0) + donationCreatorEarnings;
  const totalSalesAmount = sales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
  const activeSponsors = sponsors.filter(s => s.status === 'active' || s.status === 'approved');
  const activeFans = fans.filter(f => f.status === 'active');

  if (sponsorsLoading || salesLoading || fansLoading || donationsLoading) return null;

  const toggleSection = (section) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  const statItems = [
    { label: 'Earned', value: `$${totalMemberEarnings.toFixed(2)}`, icon: DollarSign, color: 'text-green-400' },
    { label: 'Sponsors', value: activeSponsors.length, icon: HandCoins, color: 'text-yellow-400' },
    { label: 'Fans', value: activeFans.length, icon: Users, color: 'text-blue-400' },
  ];

  const rowClass = 'w-full flex items-center justify-between px-4 py-3 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors lg:px-[2%] lg:py-[1%] lg:rounded-[0.55vw]';

  return (
    <div className="bg-black border border-white/10 rounded-3xl p-6 space-y-5 shadow-2xl lg:rounded-[1vw] lg:p-[2%] lg:space-y-[2%]">
      <div className="flex items-center gap-3 lg:gap-[1.5%]">
        <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center lg:w-[5%] lg:aspect-square lg:h-auto lg:rounded-[20%]">
          <HandCoins className="text-black w-1/2 h-1/2" />
        </div>
        <div>
          <p className="text-white text-xl font-bold uppercase tracking-wider lg:text-[1.15vw]">Sponsors & Contributors</p>
          <p className="text-white/50 text-xs font-medium lg:text-[0.68vw]">Private — only you can see this</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 lg:gap-0 lg:border-y lg:border-white/10 lg:py-[1.2%]">
        {statItems.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white/5 rounded-2xl p-4 text-center border border-white/10 lg:bg-transparent lg:border-0 lg:rounded-none lg:p-[1%] lg:flex lg:items-center lg:justify-center lg:gap-[5%] lg:[&:not(:last-child)]:border-r lg:[&:not(:last-child)]:border-white/10">
            <Icon className={`${color} w-[18px] h-[18px] mx-auto mb-1 lg:mx-0 lg:mb-0 lg:w-[8%] lg:h-auto`} />
            <div className="lg:text-left">
              <p className={`${color} text-2xl font-bold lg:text-[1.2vw]`}>{value}</p>
              <p className="text-white/50 text-xs font-bold uppercase tracking-wide mt-1 lg:mt-0 lg:text-[0.66vw]">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 lg:space-y-[1%]">
        <button onClick={() => toggleSection('sponsors')} className={rowClass}>
          <div className="flex items-center gap-3 lg:gap-[0.8vw]">
            {expandedSection === 'sponsors' ? <ChevronDown className="text-white/60 w-[1vw] h-[1vw]" /> : <ChevronRight className="text-white/60 w-[1vw] h-[1vw]" />}
            <HandCoins className="text-yellow-400 w-[0.9vw] h-[0.9vw]" />
            <span className="text-white text-sm font-bold uppercase tracking-wide lg:text-[0.72vw]">Sponsors ({sponsors.length})</span>
          </div>
          <span className="text-green-400 text-sm font-bold lg:text-[0.72vw]">${totalSalesAmount.toFixed(2)}</span>
        </button>

        {expandedSection === 'sponsors' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 pl-2 lg:space-y-[0.7%] lg:pl-[1%]">
            {sponsors.length === 0 ? (
              <p className="text-white/40 text-sm font-medium py-4 text-center lg:text-[0.68vw] lg:py-[0.8%] lg:text-left lg:pl-[2%]">No sponsors yet</p>
            ) : (
              sponsors.map((sponsor) => (
                <div key={sponsor.id} className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-2xl border border-white/10 lg:gap-[1%] lg:px-[2%] lg:py-[0.8%] lg:rounded-[0.5vw]">
                  <div className="w-10 h-10 bg-yellow-400/20 rounded-xl flex items-center justify-center flex-shrink-0 lg:w-[5%] lg:aspect-square lg:h-auto lg:rounded-[15%]">
                    <HandCoins className="text-yellow-400 w-2/5 h-2/5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-bold truncate lg:text-[0.72vw]">{sponsor.sponsor_name || 'Unknown Sponsor'}</p>
                    {sponsor.sponsor_email && <div className="flex items-center gap-1 mt-0.5"><Mail className="text-white/40 w-[0.6vw] h-[0.6vw]" /><p className="text-white/40 text-xs truncate lg:text-[0.6vw]">{sponsor.sponsor_email}</p></div>}
                    {sponsor.bracket_name && <p className="text-white/50 text-xs mt-0.5 lg:text-[0.6vw]">{sponsor.bracket_name} · {sponsor.bracket_duration}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {sponsor.bracket_price > 0 && <p className="text-green-400 text-sm font-bold lg:text-[0.7vw]">${sponsor.bracket_price.toFixed(2)}</p>}
                    {sponsor.member_share > 0 && <p className="text-white/40 text-xs lg:text-[0.6vw]">You: ${sponsor.member_share.toFixed(2)}</p>}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-lg border font-bold uppercase tracking-wide lg:text-[0.58vw] lg:px-[1%] lg:py-[0.35%] lg:rounded-[0.35vw] ${statusStyles[sponsor.status] || statusStyles.pending}`}>{sponsor.status}</span>
                </div>
              ))
            )}
          </motion.div>
        )}
      </div>

      {sales.length > 0 && (
        <div className="space-y-2 lg:space-y-[1%]">
          <button onClick={() => toggleSection('sales')} className={rowClass}>
            <div className="flex items-center gap-3 lg:gap-[0.8vw]">
              {expandedSection === 'sales' ? <ChevronDown className="text-white/60 w-[1vw] h-[1vw]" /> : <ChevronRight className="text-white/60 w-[1vw] h-[1vw]" />}
              <TrendingUp className="text-green-400 w-[0.9vw] h-[0.9vw]" />
              <span className="text-white text-sm font-bold uppercase tracking-wide lg:text-[0.72vw]">Sales History ({sales.length})</span>
            </div>
            <span className="text-green-400 text-sm font-bold lg:text-[0.72vw]">${totalMemberEarnings.toFixed(2)}</span>
          </button>
          {expandedSection === 'sales' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 pl-2 lg:space-y-[0.7%] lg:pl-[1%]">
              {sales.map((sale) => (
                <div key={sale.id} className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-2xl border border-white/10 lg:gap-[1%] lg:px-[2%] lg:py-[0.8%] lg:rounded-[0.5vw]">
                  <div className="w-10 h-10 bg-green-400/20 rounded-xl flex items-center justify-center flex-shrink-0 lg:w-[5%] lg:aspect-square lg:h-auto lg:rounded-[15%]"><TrendingUp className="text-green-400 w-2/5 h-2/5" /></div>
                  <div className="flex-1 min-w-0"><p className="text-white text-sm font-bold truncate lg:text-[0.72vw]">{sale.bracket_name}</p><p className="text-white/40 text-xs mt-0.5 lg:text-[0.6vw]">{sale.sale_date ? new Date(sale.sale_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''} · {sale.duration}</p></div>
                  <div className="text-right flex-shrink-0"><p className="text-white text-sm font-bold lg:text-[0.7vw]">${sale.total_amount?.toFixed(2)}</p><p className="text-green-400 text-xs lg:text-[0.6vw]">You: ${sale.member_share?.toFixed(2)}</p></div>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      )}

      {earnings.length > 0 && (
        <div className="space-y-2 lg:space-y-[1%]">
          <button onClick={() => toggleSection('earnings')} className={rowClass}>
            <div className="flex items-center gap-3 lg:gap-[0.8vw]">
              {expandedSection === 'earnings' ? <ChevronDown className="text-white/60 w-[1vw] h-[1vw]" /> : <ChevronRight className="text-white/60 w-[1vw] h-[1vw]" />}
              <DollarSign className="text-green-400 w-[0.9vw] h-[0.9vw]" />
              <span className="text-white text-sm font-bold uppercase tracking-wide lg:text-[0.72vw]">Monthly Payouts ({earnings.length})</span>
            </div>
          </button>
          {expandedSection === 'earnings' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 pl-2 lg:space-y-[0.7%] lg:pl-[1%]">
              {earnings.map((earning) => (
                <div key={earning.id} className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-2xl border border-white/10 lg:gap-[1%] lg:px-[2%] lg:py-[0.8%] lg:rounded-[0.5vw]">
                  <div className="w-10 h-10 bg-green-400/20 rounded-xl flex items-center justify-center flex-shrink-0 lg:w-[5%] lg:aspect-square lg:h-auto lg:rounded-[15%]"><DollarSign className="text-green-400 w-2/5 h-2/5" /></div>
                  <div className="flex-1 min-w-0"><p className="text-white text-sm font-bold lg:text-[0.72vw]">{earning.payout_month}</p><p className="text-white/40 text-xs lg:text-[0.6vw]">Sales: ${earning.total_sales?.toFixed(2)} · Platform: ${earning.platform_total?.toFixed(2)}</p></div>
                  <div className="text-right flex-shrink-0"><p className="text-green-400 text-sm font-bold lg:text-[0.7vw]">${earning.member_total?.toFixed(2)}</p><span className={`text-xs px-2 py-0.5 rounded-md font-bold uppercase lg:text-[0.58vw] ${earning.status === 'paid' ? 'text-green-400' : 'text-yellow-400'}`}>{earning.status}</span></div>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      )}

      <div className="space-y-2 lg:space-y-[1%]">
        <button onClick={() => toggleSection('fans')} className={rowClass}>
          <div className="flex items-center gap-3 lg:gap-[0.8vw]">
            {expandedSection === 'fans' ? <ChevronDown className="text-white/60 w-[1vw] h-[1vw]" /> : <ChevronRight className="text-white/60 w-[1vw] h-[1vw]" />}
            <Users className="text-blue-400 w-[0.9vw] h-[0.9vw]" />
            <span className="text-white text-sm font-bold uppercase tracking-wide lg:text-[0.72vw]">Fans ({fans.length})</span>
          </div>
          <span className="text-blue-400 text-sm font-bold lg:text-[0.72vw]">{activeFans.length} active · ${donationGross.toFixed(2)} donated</span>
        </button>
        {expandedSection === 'fans' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 pl-2 lg:space-y-[0.7%] lg:pl-[1%]">
            {fans.length === 0 ? (
              <p className="text-white/40 text-sm font-medium py-4 text-center lg:text-[0.68vw] lg:py-[0.8%] lg:text-left lg:pl-[2%]">No fans yet</p>
            ) : (
              fans.map((fan) => (
                <div key={fan.id} className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-2xl border border-white/10 lg:gap-[1%] lg:px-[2%] lg:py-[0.8%] lg:rounded-[0.5vw]">
                  <div className="w-10 h-10 bg-blue-400/20 rounded-xl flex items-center justify-center flex-shrink-0 lg:w-[5%] lg:aspect-square lg:h-auto lg:rounded-[15%]"><Users className="text-blue-400 w-2/5 h-2/5" /></div>
                  <div className="flex-1 min-w-0"><p className="text-white text-sm font-bold truncate lg:text-[0.72vw]">{fan.email}</p>{fan.created_at && <p className="text-white/40 text-xs mt-0.5 lg:text-[0.6vw]">Joined {new Date(fan.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>}</div>
                  <span className={`text-xs px-2 py-1 rounded-lg border font-bold uppercase tracking-wide lg:text-[0.58vw] lg:px-[1%] lg:py-[0.35%] lg:rounded-[0.35vw] ${fan.status === 'active' ? 'bg-green-500/20 text-green-400 border-green-500/40' : 'bg-gray-500/20 text-gray-400 border-gray-500/40'}`}>{fan.status}</span>
                </div>
              ))
            )}
          </motion.div>
        )}
      </div>

      {sponsors.length === 0 && sales.length === 0 && fans.length === 0 && (
        <div className="py-8 text-center lg:py-[1%] lg:text-left lg:flex lg:items-center lg:gap-[2%]">
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 lg:w-[5%] lg:aspect-square lg:h-auto lg:mx-0 lg:mb-0 lg:rounded-[15%]"><HandCoins className="text-white/30 w-2/5 h-2/5" /></div>
          <div><p className="text-white/60 text-base font-medium lg:text-[0.72vw]">No sponsors or contributors yet</p><p className="text-white/40 text-sm mt-2 lg:text-[0.62vw] lg:mt-[0.3%]">When someone sponsors your profile or subscribes as a fan, they'll appear here with their contribution details</p></div>
        </div>
      )}
    </div>
  );
}
