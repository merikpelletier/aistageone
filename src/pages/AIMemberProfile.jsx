import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, MapPin } from 'lucide-react';
import DossierGallery from '@/components/DossierGallery';

export default function AIMemberProfile() {
  const [searchParams] = useSearchParams();
  const memberId = searchParams.get('id');

  const { data: member, isLoading } = useQuery({
    queryKey: ['publicAiMember', memberId],
    queryFn: async () => {
      if (!memberId) return null;
      const members = await base44.entities.AIMemberPublic.list('display_name', 500);
      return members.find(item => String(item.id) === String(memberId)) || null;
    },
    enabled: !!memberId,
  });

  const { data: dossiers = [], isLoading: dossiersLoading } = useQuery({
    queryKey: ['publicAiMemberDossiers', memberId],
    queryFn: async () => {
      if (!memberId) return [];
      return base44.entities.Dossier.filter({ ai_member_id: memberId });
    },
    enabled: !!memberId,
  });

  if (isLoading) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-5 px-6">
        <p className="text-white/60">AI generated member not found.</p>
        <Link to="/MemberListing" className="border border-white/20 px-4 py-2 text-sm hover:border-white/50">Back to members</Link>
      </div>
    );
  }

  const links = Array.isArray(member.links) ? member.links : [];
  const images = Array.isArray(member.images) ? member.images : [];
  const interests = Array.isArray(member.interests) ? member.interests : [];
  const contentTypes = Array.isArray(member.content_types) ? member.content_types : [];

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <div className="max-w-6xl mx-auto px-5 sm:px-7 lg:px-8 pt-8">
        <Link to="/MemberListing" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white mb-6">
          <ArrowLeft size={16} /> Members
        </Link>

        <section className="border border-white/10 bg-neutral-950 overflow-hidden">
          <div className="relative h-44 sm:h-56 bg-neutral-900">
            {member.custom_banner_url ? (
              <img src={member.custom_banner_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-950" />
            )}
            <div className="absolute top-4 right-4 border border-teal-400/50 bg-black/70 text-teal-300 text-[10px] font-semibold uppercase tracking-[0.14em] px-2.5 py-1.5">
              AI GENERATED
            </div>
          </div>

          <div className="px-5 sm:px-7 pb-7">
            <div className="flex flex-col sm:flex-row sm:items-end gap-5 -mt-12 relative z-10">
              {member.avatar_url ? (
                <img src={member.avatar_url} alt={member.display_name} className="w-28 h-28 object-cover border-4 border-black bg-neutral-800" />
              ) : (
                <div className="w-28 h-28 bg-neutral-800 border-4 border-black flex items-center justify-center text-3xl font-light">
                  {member.display_name?.charAt(0) || '?'}
                </div>
              )}

              <div className="min-w-0 flex-1 pb-1">
                <h1 className="text-3xl sm:text-4xl font-light tracking-tight">{member.display_name}</h1>
                {member.title && <p className="text-white/75 text-base sm:text-lg mt-1">{member.title}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-white/45">
                  {member.handle && <span>@{member.handle}</span>}
                  {member.location_label && <span className="inline-flex items-center gap-1"><MapPin size={13} />{member.location_label}</span>}
                  {member.member_type && <span className="capitalize">{member.member_type}</span>}
                </div>
              </div>
            </div>

            {member.bio && <p className="text-white/70 leading-relaxed mt-7 max-w-4xl">{member.bio}</p>}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-5">
          <div className="lg:col-span-2 space-y-5">
            <section className="border border-white/10 bg-neutral-950 p-5 sm:p-6">
              <h2 className="text-sm uppercase tracking-[0.16em] text-white/50 mb-4">Published work</h2>
              {dossiersLoading ? (
                <div className="py-8 text-white/40 text-sm">Loading...</div>
              ) : dossiers.length ? (
                <DossierGallery dossiers={dossiers} ratingsMap={{}} commentsMap={{}} campaignsMap={{}} />
              ) : (
                <p className="text-white/40 text-sm py-4">No published work yet.</p>
              )}
            </section>

            {images.length > 0 && (
              <section className="border border-white/10 bg-neutral-950 p-5 sm:p-6">
                <h2 className="text-sm uppercase tracking-[0.16em] text-white/50 mb-4">Gallery</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {images.map((url, index) => <img key={`${url}-${index}`} src={url} alt="" className="w-full aspect-square object-cover border border-white/10" />)}
                </div>
              </section>
            )}
          </div>

          <div className="space-y-5">
            {(interests.length > 0 || contentTypes.length > 0) && (
              <section className="border border-white/10 bg-neutral-950 p-5">
                {interests.length > 0 && (
                  <div>
                    <h2 className="text-xs uppercase tracking-[0.16em] text-white/45 mb-3">Interests</h2>
                    <div className="flex flex-wrap gap-2">{interests.map(item => <span key={item} className="border border-white/10 px-2.5 py-1.5 text-xs text-white/65">{item}</span>)}</div>
                  </div>
                )}
                {contentTypes.length > 0 && (
                  <div className={interests.length ? 'mt-5' : ''}>
                    <h2 className="text-xs uppercase tracking-[0.16em] text-white/45 mb-3">Content</h2>
                    <div className="flex flex-wrap gap-2">{contentTypes.map(item => <span key={item} className="border border-white/10 px-2.5 py-1.5 text-xs text-white/65">{item}</span>)}</div>
                  </div>
                )}
              </section>
            )}

            {links.length > 0 && (
              <section className="border border-white/10 bg-neutral-950 p-5">
                <h2 className="text-xs uppercase tracking-[0.16em] text-white/45 mb-3">Links</h2>
                <div className="space-y-2">
                  {links.map((link, index) => {
                    const href = typeof link === 'string' ? link : link?.url;
                    const label = typeof link === 'string' ? link : (link?.label || link?.title || link?.url);
                    if (!href) return null;
                    return <a key={`${href}-${index}`} href={href} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 border border-white/10 px-3 py-2 text-sm text-white/65 hover:text-white hover:border-white/30"><span className="truncate">{label}</span><ExternalLink size={13} /></a>;
                  })}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
