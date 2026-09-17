import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Coins, BadgeCheck, ShoppingCart, Loader2, ArrowRight, History, TrendingUp, TrendingDown, Gift } from 'lucide-react';

const MEMBERSHIP_LABELS = {
  publisher: 'Publisher',
  influencer: 'Influencer',
  brand: 'Brand',
  base: 'Base',
};

const statusConfig = {
  pending: { label: 'Pending Review', color: 'text-yellow-400', bg: 'bg-yellow-400/20', border: 'border-yellow-400/40' },
  approved: { label: 'Active', color: 'text-green-400', bg: 'bg-green-400/20', border: 'border-green-400/40' },
  rejected: { label: 'Rejected', color: 'text-red-400', bg: 'bg-red-400/20', border: 'border-red-400/40' },
};

export default function TokensMembershipSection({ userEmail }) {
  const [purchasingId, setPurchasingId] = useState(null);

  // Fetch token balance + packages via backend function
  const { data: balanceData, isLoading: balanceLoading } = useQuery({
    queryKey: ['userBalance', userEmail],
    queryFn: async () => {
      const res = await base44.functions.invoke('getUserBalance', {});
      return res.data;
    },
    enabled: !!userEmail,
  });

  // Fetch membership
  const { data: membership, isLoading: membershipLoading } = useQuery({
    queryKey: ['userMembership', userEmail],
    queryFn: async () => {
      const results = await base44.entities.Membership.filter({ user_email: userEmail });
      return results[0] || null;
    },
    enabled: !!userEmail,
  });

  // Fetch transaction history
  const { data: transactions = [] } = useQuery({
    queryKey: ['tokenTransactions', userEmail],
    queryFn: async () => {
      const results = await base44.entities.TokenTransaction.filter({ user_email: userEmail });
      return results.sort((a, b) => {
        const da = new Date(a.created_at || a.created_date || 0);
        const db = new Date(b.created_at || b.created_date || 0);
        return db - da;
      }).slice(0, 50);
    },
    enabled: !!userEmail,
  });

  const handlePurchase = async (pkg) => {
    setPurchasingId(pkg.id);
    try {
      const res = await base44.functions.invoke('purchaseTokens', { package_id: pkg.id });
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch {
      // error handled silently
    } finally {
      setPurchasingId(null);
    }
  };

  if (balanceLoading || membershipLoading) return null;

  const balance = balanceData?.balance ?? 0;
  const packages = balanceData?.packages ?? [];
  const membershipType = membership?.membership_type;
  const membershipStatus = membership?.status || 'pending';
  const statusInfo = statusConfig[membershipStatus] || statusConfig.pending;

  return (
    <div className="bg-black border border-white/10 rounded-3xl p-6 space-y-5 shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center">
          <Coins size={20} className="text-black" />
        </div>
        <div>
          <p className="text-white text-xl font-bold uppercase tracking-wider">Tokens & Membership</p>
          <p className="text-white/50 text-xs font-medium">Private — only you can see this</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Token Balance Card */}
        <div className="bg-white/5 rounded-2xl p-5 border border-white/10 flex flex-col items-center justify-center">
          <Coins size={22} className="text-yellow-400 mb-2" />
          <p className="text-yellow-400 text-3xl font-bold">{balance}</p>
          <p className="text-white/50 text-xs font-bold uppercase tracking-wide mt-1">Tokens</p>
        </div>

        {/* Membership Status Card */}
        <div className="bg-white/5 rounded-2xl p-5 border border-white/10 flex flex-col items-center justify-center">
          <BadgeCheck size={22} className="text-blue-400 mb-2" />
          <p className="text-white text-lg font-bold text-center">{membershipType ? MEMBERSHIP_LABELS[membershipType] || membershipType : 'None'}</p>
          <span className={`text-xs px-2 py-0.5 rounded-md border font-bold uppercase mt-1 ${statusInfo.bg} ${statusInfo.border}`} style={{ color: '#1a1a1a' }}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* Change Membership Button */}
      <Link
        to="/Membership"
        className="w-full flex items-center justify-between px-5 py-3 bg-white text-black rounded-2xl font-bold text-sm uppercase tracking-wide hover:bg-white/90 transition-colors"
      >
        <span className="flex items-center gap-2">
          <BadgeCheck size={16} />
          {membership ? 'Change Membership' : 'Apply for Membership'}
        </span>
        <ArrowRight size={16} />
      </Link>

      {/* Token Packages */}
      {packages.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ShoppingCart size={16} className="text-white/60" />
            <p className="text-white/60 text-xs font-bold uppercase tracking-wider">Buy Tokens</p>
          </div>
          <div className="space-y-2">
            {packages.map((pkg) => {
              const totalTokens = pkg.token_amount + Math.round(pkg.token_amount * (pkg.bonus_percentage || 0) / 100);
              const isPurchasing = purchasingId === pkg.id;
              return (
                <div key={pkg.id} className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-2xl border border-white/10">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-bold">{pkg.name}</p>
                      {pkg.bonus_percentage > 0 && (
                        <span className="text-xs px-1.5 py-0.5 bg-yellow-400/20 text-yellow-400 rounded-md font-bold">+{pkg.bonus_percentage}%</span>
                      )}
                    </div>
                    <p className="text-white/50 text-xs mt-0.5">{totalTokens} tokens</p>
                  </div>
                  <p className="text-green-400 text-sm font-bold flex-shrink-0">${pkg.price}</p>
                  <button
                    onClick={() => handlePurchase(pkg)}
                    disabled={isPurchasing}
                    className="px-4 py-2 bg-yellow-400 text-black text-xs font-bold rounded-xl hover:bg-yellow-500 disabled:opacity-50 transition-colors flex items-center gap-1.5 flex-shrink-0"
                  >
                    {isPurchasing ? <Loader2 size={12} className="animate-spin" /> : <Coins size={12} />}
                    Buy
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transaction History */}
      {transactions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <History size={16} className="text-white/60" />
            <p className="text-white/60 text-xs font-bold uppercase tracking-wider">Credit History</p>
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {transactions.map((tx, idx) => {
              const isPositive = tx.token_amount >= 0;
              const typeLabels = {
                purchase: 'Token Purchase',
                usage: 'Token Usage',
                refund: 'Refund',
                membership_grant: 'Membership Grant',
              };
              const typeLabel = typeLabels[tx.transaction_type] || tx.transaction_type;
              const txDate = tx.created_at || tx.created_date;
              const Icon = isPositive ? (tx.transaction_type === 'refund' ? Gift : TrendingUp) : TrendingDown;

              return (
                <div key={tx.id || idx} className="flex items-center gap-3 px-3 py-2.5 bg-white/5 rounded-xl border border-white/5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isPositive ? 'bg-green-400/15' : 'bg-red-400/15'
                  }`}>
                    <Icon size={14} className={isPositive ? 'text-green-400' : 'text-red-400'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{typeLabel}</p>
                    {tx.related_entity && (
                      <p className="text-white/40 text-xs truncate">{tx.related_entity}</p>
                    )}
                    {txDate && (
                      <p className="text-white/30 text-xs">
                        {new Date(txDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {' · '}
                        {new Date(txDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold font-mono ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                      {isPositive ? '+' : ''}{tx.token_amount}
                    </p>
                    {tx.balance_after !== undefined && tx.balance_after !== null && (
                      <p className="text-white/30 text-xs">Bal: {tx.balance_after}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!membership && packages.length === 0 && transactions.length === 0 && (
        <p className="text-white/40 text-sm text-center py-2">No membership or token packages available yet</p>
      )}
    </div>
  );
}