import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import LegacyMemberDashboard from './MemberDashboard';
import DesktopAccountDashboard from '@/components/DesktopAccountDashboard';
import MemberProfileEditor from '@/components/MemberProfileEditor';

export default function MemberDashboardResponsive() {
  const { user, isLoadingAuth } = useAuth();
  const [searchParams] = useSearchParams();
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [previewAsGuest, setPreviewAsGuest] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);

  const memberEmail = searchParams.get('email');
  const aiMemberId = searchParams.get('aiMemberId');
  const isAIProfile = !!aiMemberId;
  const viewingEmail = isAIProfile ? `ai-member:${aiMemberId}` : (memberEmail || user?.email);
  const isOwnProfile = !isAIProfile && (!memberEmail || memberEmail === user?.email);
  const useNewDesktop = isDesktop && isOwnProfile && !previewAsGuest;

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['desktopMemberProfile', viewingEmail],
    queryFn: async () => {
      if (!viewingEmail) return null;
      const profiles = await base44.entities.MemberProfile.filter({ user_email: viewingEmail });
      return profiles[0] || null;
    },
    enabled: useNewDesktop && !!viewingEmail,
  });

  const { data: dossiers = [], isLoading: dossiersLoading } = useQuery({
    queryKey: ['desktopMemberDossiers', viewingEmail],
    queryFn: async () => {
      const res = await base44.functions.invoke('getMemberDossiers', { memberEmail: viewingEmail });
      return res.data?.dossiers || [];
    },
    enabled: useNewDesktop && !!viewingEmail,
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['desktopMemberCampaigns', viewingEmail],
    queryFn: async () => base44.entities.Campaign.filter({ member_email: viewingEmail, status: 'active' }),
    enabled: useNewDesktop && !!viewingEmail,
  });

  const campaignsMap = {};
  for (const campaign of campaigns) {
    if (campaign.linked_dossier_id) campaignsMap[campaign.linked_dossier_id] = campaign;
  }

  const { data: ratingsMap = {} } = useQuery({
    queryKey: ['desktopDossierRatings', dossiers.map(d => d.id)],
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
    enabled: useNewDesktop && dossiers.length > 0,
  });

  const { data: commentsMap = {} } = useQuery({
    queryKey: ['desktopDossierComments', dossiers.map(d => d.id)],
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
    enabled: useNewDesktop && dossiers.length > 0,
  });

  if (!isDesktop || !isOwnProfile || previewAsGuest) {
    return <LegacyMemberDashboard />;
  }

  if (!user && !isLoadingAuth) {
    base44.auth.redirectToLogin(window.location.href);
    return <div className="min-h-screen bg-black" />;
  }

  if (isLoadingAuth || profileLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  if (!profile) {
    return <LegacyMemberDashboard />;
  }

  return (
    <>
      <DesktopAccountDashboard
        profile={profile}
        user={user}
        viewingEmail={viewingEmail}
        dossiers={dossiers}
        dossiersLoading={dossiersLoading}
        ratingsMap={ratingsMap}
        commentsMap={commentsMap}
        campaignsMap={campaignsMap}
        onEdit={() => setShowProfileEditor(true)}
        onPreview={() => setPreviewAsGuest(true)}
        onLogout={() => base44.auth.logout('/')}
      />

      <AnimatePresence>
        {showProfileEditor && (
          <MemberProfileEditor
            profile={profile}
            user={user}
            onClose={() => setShowProfileEditor(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
