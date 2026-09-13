import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, LogOut } from 'lucide-react';
import MemberProfileCard from '@/components/MemberProfileCard';
import DossierGallery from '@/components/DossierGallery';
import MemberProfileEditor from '@/components/MemberProfileEditor';
import MemberContactForm from '@/components/MemberContactForm';
import MemberSeriesParticipation from '@/components/MemberSeriesParticipation';
import SponsorsContributorsSection from '@/components/SponsorsContributorsSection';
import TokensMembershipSection from '@/components/TokensMembershipSection';
import ProfileLinksSection from '@/components/ProfileLinksSection';
import PublishStorySection from '@/components/PublishStorySection';
import CampaignManager from '@/components/CampaignManager';
import MemberInboxSection from '@/components/MemberInboxSection';
import BecomeSponsorBanner from '@/components/BecomeSponsorBanner';
import CollapsibleSection from '@/components/CollapsibleSection';
import ProfilePresentation from '@/components/ProfilePresentation';
import ProfileGallery from '@/components/ProfileGallery';
import ProfileFansSponsors from '@/components/ProfileFansSponsors';
import { Link, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';

export default function MemberDashboard() {
  const { user, isLoadingAuth } = useAuth();
  const [searchParams] = useSearchParams();
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [previewAsGuest, setPreviewAsGuest] = useState(false);
  const memberEmail = searchParams.get('email');
  const viewingEmail = memberEmail || user?.email;
  const isOwnProfile = !memberEmail || memberEmail === user?.email;
  const effectiveIsOwnProfile = isOwnProfile && !previewAsGuest;

  // Fetch the member's profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['memberProfile', viewingEmail],
    queryFn: async () => {
      if (!viewingEmail) return null;
      const profiles = await base44.entities.MemberProfile.filter({ user_email: viewingEmail });
      return profiles[0] || null;
    },
    enabled: !!viewingEmail,
  });

  // Fetch member's dossiers via backend function (works for guests too)
  const { data: dossiers = [], isLoading: dossiersLoading } = useQuery({
    queryKey: ['memberDossiers', viewingEmail],
    queryFn: async () => {
      const res = await base44.functions.invoke('getMemberDossiers', { memberEmail: viewingEmail });
      return res.data?.dossiers || [];
    },
    enabled: !!viewingEmail,
  });

  // Fetch active campaigns for this member (for banner display)
  const { data: campaigns = [] } = useQuery({
    queryKey: ['memberCampaigns', viewingEmail],
    queryFn: async () => {
      const results = await base44.entities.Campaign.filter({ member_email: viewingEmail, status: 'active' });
      return results;
    },
    enabled: !!viewingEmail,
  });

  // Build dossier_id -> campaign map for banner display
  const campaignsMap = {};
  for (const c of campaigns) {
    if (c.linked_dossier_id) {
      campaignsMap[c.linked_dossier_id] = c;
    }
  }

  // Fetch ratings for dossiers
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

  // Fetch comments for dossiers
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

  return (
    <div className="relative min-h-screen bg-black pb-20">
      {/* Your Stage stripe — below the AI agent chat bar */}
      {isOwnProfile && (
        <div
          className="w-full bg-yellow-400 text-right px-4 hover:bg-red-600 transition-colors"
          style={{ height: '20px', overflow: 'hidden' }}
        >
          <button
            onClick={() => setPreviewAsGuest(v => !v)}
            className="text-black font-extrabold text-lg uppercase tracking-widest"
            style={{ lineHeight: '20px', height: '20px', padding: 0, margin: 0, border: 'none', background: 'transparent', display: 'inline-block' }}
          >
            {previewAsGuest ? 'Exit Stage' : 'Your Stage'}
          </button>
        </div>
      )}

      <div className="max-w-5xl mx-auto">
        {/* Own profile — full MemberProfileCard */}
        {effectiveIsOwnProfile && viewingEmail && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <MemberProfileCard
              profile={profile}
              user={{ email: viewingEmail, full_name: profile?.display_name || user?.full_name || viewingEmail }}
              isOwnProfile={effectiveIsOwnProfile}
              onEdit={() => isOwnProfile && setShowProfileEditor(true)}
            />
          </motion.div>
        )}

        {/* Public profile — Published Work featured full-width, then masonry */}
        {!effectiveIsOwnProfile && viewingEmail && (
          <>
            {/* Published Work — the star, full-width and prominent */}
            <div className="px-4 pt-4">
              <CollapsibleSection label="Published Work" accent="work" defaultOpen>
                {!dossiersLoading && dossiers.length > 0 ? (
                  <DossierGallery
                    dossiers={dossiers}
                    ratingsMap={ratingsMap}
                    commentsMap={commentsMap}
                    campaignsMap={campaignsMap}
                  />
                ) : (
                  <p className="text-white/40 text-sm py-4">No published work yet.</p>
                )}
              </CollapsibleSection>
            </div>

            {/* Masonry columns */}
            <div className="px-4 pt-2 columns-1 sm:columns-2 lg:columns-3 gap-4">
              <CollapsibleSection label="Presentation" accent="presentation" defaultOpen>
                <ProfilePresentation
                  profile={profile}
                  user={{ email: viewingEmail, full_name: profile?.display_name || viewingEmail }}
                />
              </CollapsibleSection>

              {profile?.images && profile.images.length > 0 && (
                <CollapsibleSection label="Gallery" accent="gallery" defaultOpen>
                  <ProfileGallery profile={profile} />
                </CollapsibleSection>
              )}

              <CollapsibleSection label="Fans & Sponsors" accent="fans" defaultOpen>
                <ProfileFansSponsors
                  profile={profile}
                  user={{ email: viewingEmail }}
                />
              </CollapsibleSection>

              <CollapsibleSection label="Become a Sponsor" accent="sponsor" defaultOpen>
                <BecomeSponsorBanner memberEmail={viewingEmail} />
              </CollapsibleSection>

              <CollapsibleSection label="Contact" accent="contact" defaultOpen>
                <MemberContactForm
                  memberEmail={viewingEmail}
                  memberName={profile?.display_name}
                />
              </CollapsibleSection>

              <CollapsibleSection label="Links" accent="links" defaultOpen>
                <ProfileLinksSection profile={profile} isOwnProfile={effectiveIsOwnProfile} userEmail={viewingEmail} />
              </CollapsibleSection>

              <CollapsibleSection label="Series" accent="series">
                <MemberSeriesParticipation userEmail={viewingEmail} />
              </CollapsibleSection>
            </div>
          </>
        )}

        {/* Tokens & Membership — own profile only */}
        {effectiveIsOwnProfile && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <TokensMembershipSection userEmail={viewingEmail} />
          </motion.div>
        )}

        {/* Sponsors & Contributors — private, own profile only */}
        {effectiveIsOwnProfile && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <SponsorsContributorsSection userEmail={viewingEmail} />
          </motion.div>
        )}

        {/* Links — distinct section, owner can add/remove (own profile only; public view renders in masonry above) */}
        {effectiveIsOwnProfile && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <ProfileLinksSection profile={profile} isOwnProfile={effectiveIsOwnProfile} userEmail={viewingEmail} />
          </motion.div>
        )}

        {/* Publish Story — own profile only */}
        {effectiveIsOwnProfile && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <PublishStorySection userEmail={viewingEmail} />
          </motion.div>
        )}

        {/* Campaign Manager — own profile only */}
        {effectiveIsOwnProfile && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
            <CampaignManager userEmail={viewingEmail} />
          </motion.div>
        )}

        {/* Messages & Comments — own profile only */}
        {effectiveIsOwnProfile && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}>
            <MemberInboxSection userEmail={viewingEmail} />
          </motion.div>
        )}

        {/* Series Participation — own profile only; public view renders in masonry above */}
        {effectiveIsOwnProfile && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <MemberSeriesParticipation userEmail={viewingEmail} />
          </motion.div>
        )}

        {/* Dossiers Sliding Gallery — own profile only; public view renders in masonry above */}
        {effectiveIsOwnProfile && !dossiersLoading && dossiers.length > 0 && (
          <DossierGallery
            dossiers={dossiers}
            ratingsMap={ratingsMap}
            commentsMap={commentsMap}
            campaignsMap={campaignsMap}
            label="Published Work"
          />
        )}

        {/* Log Out */}
        {isOwnProfile && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <button
              onClick={() => base44.auth.logout('/')}
              className="w-full flex items-center justify-center gap-3 py-4 border border-white/60 text-white hover:text-white hover:border-white rounded-2xl font-bold tracking-widest text-sm transition-colors"
            >
              <LogOut size={16} />
              LOG OUT
            </button>
          </motion.div>
        )}
      </div>

      {/* Profile Editor Modal */}
      <AnimatePresence>
        {showProfileEditor && isOwnProfile && (
          <MemberProfileEditor
            profile={profile}
            user={user}
            onClose={() => setShowProfileEditor(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}