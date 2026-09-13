import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Megaphone, Bell, ShoppingBag, Sparkles, Check, Loader2, Calendar, Coins } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

const BANNER_STYLES = {
  yellow: { bg: 'bg-yellow-400', text: 'text-black' },
  red: { bg: 'bg-red-500', text: 'text-white' },
  blue: { bg: 'bg-blue-500', text: 'text-white' },
  green: { bg: 'bg-green-500', text: 'text-white' },
  purple: { bg: 'bg-purple-500', text: 'text-white' },
  pink: { bg: 'bg-pink-500', text: 'text-white' },
};

export default function CampaignSubscribe() {
  const [searchParams] = useSearchParams();
  const campaignId = searchParams.get('campaign');
  const { user, isLoadingAuth } = useAuth();
  const [subscribed, setSubscribed] = useState(false);

  // Fetch campaign
  const { data: campaign, isLoading: campaignLoading } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: async () => {
      const results = await base44.entities.Campaign.filter({ id: campaignId });
      return results[0] || null;
    },
    enabled: !!campaignId,
  });

  // Fetch member profile
  const { data: profile } = useQuery({
    queryKey: ['campaignMemberProfile', campaign?.member_email],
    queryFn: async () => {
      const results = await base44.entities.MemberProfile.filter({ user_email: campaign.member_email });
      return results[0] || null;
    },
    enabled: !!campaign?.member_email,
  });

  // Check if already subscribed
  const { data: existingSub } = useQuery({
    queryKey: ['campaignSubscription', campaignId, user?.email],
    queryFn: async () => {
      const results = await base44.entities.CampaignSubscription.filter({
        campaign_id: campaignId,
        subscriber_email: user.email,
        status: 'active',
      });
      return results[0] || null;
    },
    enabled: !!campaignId && !!user,
  });

  useEffect(() => {
    if (existingSub) setSubscribed(true);
  }, [existingSub]);

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      return await base44.entities.CampaignSubscription.create({
        campaign_id: campaignId,
        subscriber_email: user.email,
        subscriber_name: user.full_name || user.email,
        campaign_title: campaign.title,
        fee_paid: campaign.subscription_fee || 0,
        status: 'active',
        subscribed_at: new Date().toISOString(),
      });
    },
    onSuccess: () => setSubscribed(true),
  });

  if (isLoadingAuth || campaignLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
        <Megaphone size={48} className="text-white/20 mb-4" />
        <p className="text-white/60 text-lg font-bold">Campaign not found</p>
        <Link to="/" className="mt-6 text-yellow-400 text-sm font-bold uppercase">Back Home</Link>
      </div>
    );
  }

  const style = BANNER_STYLES[campaign.banner_color] || BANNER_STYLES.yellow;
  const memberName = profile?.display_name || campaign.member_email;

  const notifOptions = [
    { active: campaign.notify_new_episodes, label: 'New Episode Notifications', icon: Bell },
    { active: campaign.notify_merch_releases, label: 'Merchandise Release Alerts', icon: ShoppingBag },
    { active: campaign.notify_upcoming_projects, label: 'Upcoming Project Updates', icon: Sparkles },
  ].filter(o => o.active);

  return (
    <div className="relative min-h-screen bg-black pb-20">
      {/* Header */}
      <div className="absolute left-0 right-0 z-10 px-6 pt-6" style={{ top: 'calc(52px + env(safe-area-inset-top))' }}>
        <Link to={`/MemberDashboard?email=${campaign.member_email}`}>
          <ArrowLeft size={22} className="text-white hover:text-white/70 transition-colors" />
        </Link>
      </div>

      <div className="max-w-2xl mx-auto px-6 pt-20">
        {/* Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-3xl p-8 ${style.bg} mb-6`}
        >
          <div className="flex items-center gap-3 mb-4">
            <Megaphone size={28} className={style.text} />
            <p className={`${style.text} text-sm font-bold uppercase tracking-widest`}>Campaign</p>
          </div>
          <h1 className={`${style.text} text-3xl font-bold mb-2`}>{campaign.title}</h1>
          {campaign.description && (
            <p className={`${style.text} text-sm opacity-80`}>{campaign.description}</p>
          )}
          <p className={`${style.text} text-sm font-medium opacity-70 mt-4`}>by {memberName}</p>
        </motion.div>

        {/* Details */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-5 mb-6">
          {/* Dates */}
          {(campaign.start_date || campaign.end_date) && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar size={16} className="text-white/40" />
              <span className="text-white/60">
                {campaign.start_date && new Date(campaign.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                {campaign.start_date && campaign.end_date && ' — '}
                {campaign.end_date && new Date(campaign.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          )}

          {/* Fee */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-400/15 rounded-xl flex items-center justify-center">
              <Coins size={20} className="text-green-400" />
            </div>
            <div>
              <p className="text-white/50 text-xs font-bold uppercase tracking-wide">Subscription</p>
              <p className="text-green-400 text-xl font-bold">
                {campaign.subscription_fee > 0 ? `$${campaign.subscription_fee}` : 'Free'}
              </p>
            </div>
          </div>

          {/* Notification Perks */}
          {notifOptions.length > 0 && (
            <div>
              <p className="text-white/50 text-xs font-bold uppercase tracking-wide mb-3">You'll get notified about</p>
              <div className="space-y-2">
                {notifOptions.map(({ label, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-yellow-400/15 rounded-lg flex items-center justify-center">
                      <Icon size={14} className="text-yellow-400" />
                    </div>
                    <span className="text-white/80 text-sm">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Subscribe Button / Success */}
        {subscribed ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-green-400/10 border border-green-400/30 rounded-3xl p-8 text-center"
          >
            <div className="w-16 h-16 bg-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-black" />
            </div>
            <p className="text-white text-xl font-bold mb-1">You're subscribed!</p>
            <p className="text-white/50 text-sm">You'll receive notifications for {campaign.title}.</p>
            <Link
              to={`/MemberDashboard?email=${campaign.member_email}`}
              className="inline-block mt-6 px-6 py-3 bg-white text-black rounded-xl font-bold text-sm uppercase tracking-wide hover:bg-white/90 transition-colors"
            >
              Back to Profile
            </Link>
          </motion.div>
        ) : !user ? (
          <div className="space-y-3">
            <button
              onClick={() => base44.auth.redirectToLogin(window.location.href)}
              className="w-full py-4 bg-yellow-400 text-black rounded-2xl font-bold text-sm uppercase tracking-wide hover:bg-yellow-500 transition-colors"
            >
              Log in to Subscribe
            </button>
            <p className="text-white/40 text-xs text-center">You need an account to subscribe to this campaign.</p>
          </div>
        ) : (
          <button
            onClick={() => subscribeMutation.mutate()}
            disabled={subscribeMutation.isPending}
            className={`w-full py-4 ${style.bg} ${style.text} rounded-2xl font-bold text-sm uppercase tracking-wide hover:opacity-90 transition-opacity flex items-center justify-center gap-2`}
          >
            {subscribeMutation.isPending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <Megaphone size={18} />
                {campaign.subscription_fee > 0 ? `Subscribe · $${campaign.subscription_fee}` : 'Subscribe for Free'}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}