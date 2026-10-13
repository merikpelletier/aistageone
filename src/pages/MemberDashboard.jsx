import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut } from 'lucide-react';
import MemberProfileCard from '@/components/MemberProfileCard';
import DossierGallery from '@/components/DossierGallery';
import MemberProfileEditor from '@/components/MemberProfileEditor';
import MemberContactForm from '@/components/MemberContactForm';
import MemberSeriesParticipation from '@/components/MemberSeriesParticipation';
import SponsorsContributorsSection from '@/components/SponsorsContributorsSection';
import TokensMembershipSection from '@/components/TokensMembershipSection';
import MemberEconomicsSection from '@/components/MemberEconomicsSection';
import ProfileLinksSection from '@/components/ProfileLinksSection';
import PublishStorySection from '@/components/PublishStorySection';
import CampaignManager from '@/components/CampaignManager';
import MemberInboxSection from '@/components/MemberInboxSection';
import BecomeSponsorBanner from '@/components/BecomeSponsorBanner';
import CollapsibleSection from '@/components/CollapsibleSection';
import ProfilePresentation from '@/components/ProfilePresentation';
import ProfileGallery from '@/components/ProfileGallery';
import CreatorSubscriptionSection from '@/components/CreatorSubscriptionSection';
import ProfileFansSponsors from '@/components/ProfileFansSponsors';
import MerchantProfileSection from '@/components/MerchantProfileSection';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function MemberDashboard() {
  const { user, isLoadingAuth } = useAuth();
  const [searchParams] = useSearchParams();
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [previewAsGuest, setPreviewAsGuest] = useState(false);

  const memberEmail = searchParams.get('email');
  const aiMemberId = searchParams.get('aiMemberId');
  const isAIProfile = !!aiMemberId;
  const viewingEmail = isAIProfile ? `ai-member:${aiMemberId}` : (memberEmail || user?.email);
  const isOwnProfile = !isAIProfile && (!memberEmail || memberEmail === user?.email);
  const effectiveIsOwnProfile = isOwnProfile && !previewAsGuest;

  const { data: regularProfile, isLoading: regularProfileLoading } = useQuery({
    queryKey: ['memberProfile', viewingEmail],
    queryFn: async () => {
      if (!viewingEmail || isAIProfile) return null;
      const profiles = await base44.entities.MemberProfile.filter({ user_email: viewingEmail });
      return profiles[0] || null;
    },
    enabled: !!viewingEmail && !isAIProfile,
  });

  const { data: aiProfile, isLoading: aiProfileLoading } = useQuery({
    queryKey: ['aiMemberProfile', aiMemberId],
    queryFn: async () => {
      if (!aiMemberId) return null;
      const members = await base44.entities.AIMemberPublic.list('display_name', 500);
      const member = members.find(item => String(item.id) === String(aiMemberId)) || null;
      if (!member) return null;
      return {
        ...member,
        user_email: viewingEmail,
        title: member.title || member.headline || '',
        images: member.images || [],
        links: member.links || [],
        is_ai_generated: true,
      };
    },
    enabled: !!aiMemberId,
  });

  const profile = isAIProfile ? aiProfile : regularProfile;
  const profileLoading = isAIProfile ? aiProfileLoading : regularProfileLoading;
  const isMerchant = profile?.member_type === 'merchant';

  const { data: dossiers = [], isLoading: dossiersLoading } = useQuery({
    queryKey: isAIProfile ? ['aiMemberDossiers', aiMemberId] : ['memberDossiers', viewingEmail],
    queryFn: async () => {
      if (isAIProfile) return base44.entities.Dossier.filter({ ai_member_id: aiMemberId });
      const res = await base44.functions.invoke('getMemberDossiers', { memberEmail: viewingEmail });
      return res.data?.dossiers || [];
    },
    enabled: isAIProfile ? !!aiMemberId : !!viewingEmail,
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['memberCampaigns', viewingEmail],
    queryFn: async () => base44.entities.Campaign.filter({ member_email: viewingEmail, status: 'active' }),
    enabled: !!viewingEmail,
  });

  const campaignsMap = {};
  for (const c of campaigns) {
    if (c.linked_dossier_id) campaignsMap[c.linked_dossier_id] = c;
  }

  const { data: ratingsMap = {} } = useQuery({
    queryKey: ['dossierRatings', dossiers.map(d => d.id)],
    queryFn: async () => {
      const map = {};
      for (const dossier of dossiers) {
        try {
          const res = await base44.functions.invoke('getDossierRating', { dossierId: dossier.id });
          map[dossier.id] = { avg: res.data?.avg || 0, count: res.data?.count || 0 };
        } catch {
          map[dossier.id] = { avg: 0, count: 0 };
        }
      }
      return map;
    },
    enabled: dossiers.length > 0,
  });

  const { data: commentsMap = {} } = useQuery({
    queryKey: ['dossierComments', dossiers.map(d => d.id)],
    queryFn: async () => {
      const map = {};
      for (const dossier of dossiers) {
        try {
          const res = await base44.functions.invoke('getDossierComments', { dossierId: dossier.id });
          map[dossier.id] = res.data?.comments?.length || 0;
        } catch {
          map[dossier.id] = 0;
        }
      }
      return map;
    },
    enabled: dossiers.length > 0,
  });

  if (!user && !isLoadingAuth) {
    base44.auth.redirectToLogin(window.location.href);
    return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  }

  if (isLoadingAuth || profileLoading) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-white text-2xl font-light">Profile not found</h1>
          <p className="text-white/50 text-sm mt-2">This member profile is unavailable.</p>
        </div>
      </div>
    );
  }

  const presentationUser = {
    email: viewingEmail,
    full_name: profile?.display_name || viewingEmail,
  };

  const bannerUrl = profile?.custom_banner_url || profile?.banner_url || profile?.cover_url || null;
  const bannerLink = profile?.custom_banner_link || null;
  const bannerInner = bannerUrl ? (
    <div className="relative h-[180px] sm:h-[220px] lg:h-[220px] overflow-hidden border border-white/10 bg-neutral-950">
      <img src={bannerUrl} alt={`${profile?.display_name || 'Member'} banner`} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 p-5 sm:p-6 lg:p-5">
        <div className="h-16 w-16 sm:h-20 sm:w-20 lg:h-20 lg:w-20 flex-shrink-0 overflow-hidden border border-white/30 bg-black">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={profile?.display_name || 'Member'} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-2xl text-white/50">{(profile?.display_name || '?').charAt(0)}</div>
          )}
        </div>
        <div className="min-w-0 pb-1">
          <h1 className="text-2xl sm:text-3xl lg:text-3xl font-light text-white drop-shadow-lg">{profile?.display_name}</h1>
          {profile?.title && <p className="mt-1 text-[10px] sm:text-xs lg:text-xs font-semibold uppercase tracking-[0.14em] text-white/75">{profile.title}</p>}
          <div className="mt-2 flex items-center gap-2">
            {isMerchant && <span className="inline-block border border-white/40 bg-black/50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">MERCHANT</span>}
            {isAIProfile && <span className="inline-block border border-teal-300/60 bg-black/50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-teal-200">AI</span>}
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const ownerPanelClass = 'lg:min-w-0';

  return (
    <div className="relative min-h-screen w-full bg-black pb-20 lg:pb-8">
      {isOwnProfile && (
        <div className="w-full bg-yellow-400 text-right px-4 hover:bg-red-600 transition-colors" style={{ height: '20px', overflow: 'hidden' }}>
          <button onClick={() => setPreviewAsGuest(v => !v)} className="text-black font-extrabold text-lg uppercase tracking-widest" style={{ lineHeight: '20px', height: '20px', padding: 0, margin: 0, border: 'none', background: 'transparent', display: 'inline-block' }}>
            {previewAsGuest ? 'Exit Stage' : 'Your Stage'}
          </button>
        </div>
      )}

      <div className="w-full">
        {bannerInner && (
          <div className="px-4 pt-4 lg:mx-auto lg:max-w-[1500px] lg:px-6 lg:pt-5">
            {bannerLink ? <a href={bannerLink} target="_blank" rel="noreferrer" className="block">{bannerInner}</a> : bannerInner}
          </div>
        )}

        {effectiveIsOwnProfile && viewingEmail && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:px-6">
            <MemberProfileCard
              profile={profile}
              user={{ email: viewingEmail, full_name: profile?.display_name || user?.full_name || viewingEmail }}
              isOwnProfile={effectiveIsOwnProfile}
              onEdit={() => isOwnProfile && setShowProfileEditor(true)}
              topAside={<TokensMembershipSection userEmail={viewingEmail} variant="summary" />}
            />
          </motion.div>
        )}

        {isMerchant && viewingEmail && <MerchantProfileSection profileKey={viewingEmail} />}

        {!effectiveIsOwnProfile && viewingEmail && (
          <>
            <div className="px-4 pt-4 lg:mx-auto lg:max-w-[1500px] lg:px-6 lg:pt-5">
              <CollapsibleSection label="Published Work" accent="work" defaultOpen>
                {!dossiersLoading && dossiers.length > 0 ? (
                  <DossierGallery dossiers={dossiers} ratingsMap={ratingsMap} commentsMap={commentsMap} campaignsMap={campaignsMap} />
                ) : (
                  <p className="text-white/40 text-sm py-4">No published work yet.</p>
                )}
              </CollapsibleSection>
            </div>

            <div className="px-4 pt-2 columns-1 sm:columns-2 lg:mx-auto lg:max-w-[1500px] lg:columns-3 gap-4 lg:px-6 lg:gap-4">
              <CollapsibleSection label="Presentation" accent="presentation" defaultOpen><ProfilePresentation profile={profile} user={presentationUser} /></CollapsibleSection>
              {profile?.images && profile.images.length > 0 && <CollapsibleSection label="Gallery" accent="gallery" defaultOpen><ProfileGallery profile={profile} /></CollapsibleSection>}
              <CollapsibleSection label="Fans & Sponsors" accent="fans" defaultOpen><ProfileFansSponsors profile={profile} user={presentationUser} /></CollapsibleSection>
              <CollapsibleSection label="Become a Sponsor" accent="sponsor" defaultOpen><BecomeSponsorBanner memberEmail={viewingEmail} /></CollapsibleSection>
              <CollapsibleSection label="Contact" accent="contact" defaultOpen><MemberContactForm memberEmail={viewingEmail} memberName={profile?.display_name} aiMemberId={isAIProfile ? aiMemberId : null} /></CollapsibleSection>
              <CollapsibleSection label="Links" accent="links" defaultOpen><ProfileLinksSection profile={profile} isOwnProfile={effectiveIsOwnProfile} userEmail={viewingEmail} /></CollapsibleSection>
              <CollapsibleSection label="Series" accent="series"><MemberSeriesParticipation userEmail={viewingEmail} /></CollapsibleSection>
            </div>
          </>
        )}

        {effectiveIsOwnProfile ? (
          <>
            <div className="px-0 lg:mx-auto lg:grid lg:max-w-[1500px] lg:grid-cols-2 xl:grid-cols-3 lg:items-start lg:gap-4 lg:px-6">
              <div className={ownerPanelClass}>
                {viewingEmail && <CreatorSubscriptionSection creatorEmail={viewingEmail} isOwnProfile={effectiveIsOwnProfile} />}
              </div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className={ownerPanelClass}>
                <TokensMembershipSection userEmail={viewingEmail} variant="details" />
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className={ownerPanelClass}>
                <MemberEconomicsSection ownerId={user?.id} dossiers={dossiers} />
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className={ownerPanelClass}>
                <SponsorsContributorsSection userEmail={viewingEmail} />
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={ownerPanelClass}>
                <ProfileLinksSection profile={profile} isOwnProfile={effectiveIsOwnProfile} userEmail={viewingEmail} />
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }} className={ownerPanelClass}>
                <CampaignManager userEmail={viewingEmail} />
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }} className={ownerPanelClass}>
                <MemberInboxSection userEmail={viewingEmail} />
              </motion.div>
            </div>
          </>
        ) : (
          viewingEmail && <CreatorSubscriptionSection creatorEmail={viewingEmail} isOwnProfile={effectiveIsOwnProfile} />
        )}

        {isOwnProfile && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="px-4 pt-4 lg:mx-auto lg:flex lg:max-w-[1500px] lg:justify-end lg:px-6">
            <button onClick={() => base44.auth.logout('/')} className="w-full flex items-center justify-center gap-3 py-4 border border-white/60 text-white hover:text-white hover:border-white rounded-2xl font-bold tracking-widest text-sm transition-colors lg:w-auto lg:px-7 lg:py-2.5 lg:rounded-lg">
              <LogOut size={16} />
              LOG OUT
            </button>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showProfileEditor && isOwnProfile && <MemberProfileEditor profile={profile} user={user} onClose={() => setShowProfileEditor(false)} />}
      </AnimatePresence>
    </div>
  );
}
