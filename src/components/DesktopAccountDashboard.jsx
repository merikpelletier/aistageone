import React from 'react';
import { Edit2, LogOut, User } from 'lucide-react';
import CreatorSubscriptionSection from '@/components/CreatorSubscriptionSection';
import TokensMembershipSection from '@/components/TokensMembershipSection';
import MemberEconomicsSection from '@/components/MemberEconomicsSection';
import SponsorsContributorsSection from '@/components/SponsorsContributorsSection';
import ProfileLinksSection from '@/components/ProfileLinksSection';
import CampaignManager from '@/components/CampaignManager';
import MemberInboxSection from '@/components/MemberInboxSection';
import DesktopDossierPublishing from '@/components/DesktopDossierPublishing';

function DesktopPanel({ children, className = '' }) {
  return <div className={`min-w-0 overflow-hidden [&>*]:!m-0 ${className}`}>{children}</div>;
}

export default function DesktopAccountDashboard({
  profile,
  user,
  viewingEmail,
  dossiers,
  onEdit,
  onPreview,
  onLogout,
}) {
  const displayName = profile?.display_name || user?.full_name || viewingEmail;
  const images = Array.isArray(profile?.images) ? profile.images : [];
  const bannerUrl = profile?.custom_banner_url || profile?.banner_url || profile?.cover_url || null;

  return (
    <div className="min-h-screen w-full bg-black pb-10 text-white">
      <div className="flex h-7 w-full items-center justify-end bg-yellow-400 px-7">
        <button onClick={onPreview} className="text-[15px] font-black uppercase leading-none tracking-[0.18em] text-black">Your Stage</button>
      </div>

      <main className="mx-auto w-full max-w-[1840px] px-6 py-5 xl:px-8">
        {bannerUrl && (
          <div className="relative mb-5 h-[150px] overflow-hidden border border-white/10 bg-neutral-950">
            <img src={bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/15 to-black/35" />
          </div>
        )}

        <section className="grid grid-cols-12 items-start gap-5">
          <div className="col-span-4 min-w-0 border-t border-white/15 pt-4 pr-5 2xl:col-span-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-[72px] w-[72px] flex-none items-center justify-center overflow-hidden rounded-full border border-white/15 bg-neutral-900">
                  {profile?.avatar_url ? <img src={profile.avatar_url} alt={displayName} className="h-full w-full object-cover" /> : <User size={28} className="text-white/45" />}
                </div>
                <div className="min-w-0 pt-1">
                  <h1 className="truncate text-[30px] font-light leading-[1.05] tracking-tight">{displayName}</h1>
                  {profile?.title && <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.15em] text-red-500">{profile.title}</p>}
                </div>
              </div>
              <button onClick={onEdit} className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-white/15 bg-neutral-900 hover:border-white/40" aria-label="Edit profile"><Edit2 size={14} /></button>
            </div>
            {profile?.bio && <p className="mt-5 max-w-[360px] text-[13px] leading-[1.55] text-white/80">{profile.bio}</p>}
          </div>

          <div className="col-span-8 min-w-0 border-t border-white/15 pt-4 2xl:col-span-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-white/80">Gallery</h2>
              <span className="text-[11px] text-white/35">{images.length} image{images.length === 1 ? '' : 's'}</span>
            </div>
            {images.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {images.map((img, idx) => <div key={idx} className="h-[190px] w-[142px] flex-[0_0_142px] overflow-hidden bg-neutral-950"><img src={img} alt={`gallery-${idx}`} className="h-full w-full object-cover" /></div>)}
              </div>
            ) : <div className="flex h-[190px] items-center justify-center border border-dashed border-white/10 text-xs text-white/30">No gallery images</div>}
          </div>

          <DesktopPanel className="col-span-12 2xl:col-span-4"><TokensMembershipSection userEmail={viewingEmail} variant="summary" desktopStacked /></DesktopPanel>
        </section>

        <section className="mt-5 grid grid-cols-12 items-start gap-4">
          <DesktopPanel className="col-span-12 xl:col-span-7"><CreatorSubscriptionSection creatorEmail={viewingEmail} isOwnProfile /></DesktopPanel>
          <DesktopPanel className="col-span-12 md:col-span-6 xl:col-span-5"><TokensMembershipSection userEmail={viewingEmail} variant="details" /></DesktopPanel>
          <DesktopPanel className="col-span-12 md:col-span-6 xl:col-span-4"><MemberEconomicsSection ownerId={user?.id} dossiers={dossiers} /></DesktopPanel>
          <DesktopPanel className="col-span-12 md:col-span-6 xl:col-span-4"><SponsorsContributorsSection userEmail={viewingEmail} /></DesktopPanel>
          <DesktopPanel className="col-span-12 md:col-span-6 xl:col-span-4"><ProfileLinksSection profile={profile} isOwnProfile userEmail={viewingEmail} /></DesktopPanel>
          <DesktopPanel className="col-span-12 xl:col-span-6"><CampaignManager userEmail={viewingEmail} /></DesktopPanel>
          <DesktopPanel className="col-span-12 xl:col-span-6"><MemberInboxSection userEmail={viewingEmail} /></DesktopPanel>
        </section>

        <DesktopDossierPublishing userEmail={viewingEmail} dossiers={dossiers} />

        <div className="mt-7 flex justify-end border-t border-white/10 pt-4">
          <button onClick={onLogout} className="flex items-center gap-2 border border-white/35 px-5 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white hover:border-white"><LogOut size={14} />Log out</button>
        </div>
      </main>
    </div>
  );
}
