import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, ArrowUpRight } from 'lucide-react';

function getMemberSponsorKey(profile) {
  return profile._memberKind === 'ai'
    ? `ai-member:${profile.id}`.toLowerCase()
    : String(profile.user_email || '').toLowerCase();
}

function MemberCard({ profile, sponsors = [] }) {
  const isAI = profile._memberKind === 'ai';
  const heroImage = profile.banner_url || profile.cover_url || profile.hero_image_url || profile.avatar_url;
  const activeSponsors = sponsors.filter(sponsor =>
    sponsor?.is_active === true || sponsor?.status === 'active' || sponsor?.status === 'approved'
  );
  const primarySponsor = activeSponsors[0];
  const extraSponsorCount = Math.max(0, activeSponsors.length - 1);

  return (
    <Link
      to={isAI
        ? `/MemberDashboard?aiMemberId=${encodeURIComponent(profile.id)}`
        : `/MemberDashboard?email=${encodeURIComponent(profile.user_email)}`}
      className="group relative block min-h-[520px] xl:min-h-[430px] 2xl:min-h-[410px] overflow-hidden border border-white/10 bg-neutral-950 transition-all duration-300 hover:-translate-y-1 hover:border-white/35"
    >
      <div className="absolute inset-0">
        {heroImage ? (
          <img
            src={heroImage}
            alt={profile.display_name || 'Member'}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.035]"
          />
        ) : (
          <div className="h-full w-full bg-neutral-900 flex items-center justify-center text-white/30 text-7xl font-light">
            {profile.display_name?.charAt(0) || '?'}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/5" />
        <div className="absolute inset-x-0 bottom-0 h-44 xl:h-36 bg-gradient-to-t from-black to-transparent" />
      </div>

      <div className="relative z-10 flex min-h-[520px] xl:min-h-[430px] 2xl:min-h-[410px] flex-col justify-between p-5 sm:p-6 xl:p-5">
        <div className="flex flex-wrap gap-2">
          {isAI && (
            <span className="border border-teal-300/70 bg-black/65 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-200 backdrop-blur-sm">
              AI
            </span>
          )}

          {primarySponsor && (
            <span className="border border-white/35 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-black">
              Sponsored{primarySponsor.sponsor_name ? ` · ${primarySponsor.sponsor_name}` : ''}{extraSponsorCount > 0 ? ` +${extraSponsorCount}` : ''}
            </span>
          )}
        </div>

        <div>
          <div className="mb-5 xl:mb-4 flex items-end justify-between gap-4 border-b border-white/20 pb-5 xl:pb-4">
            <div className="min-w-0">
              <h2 className="text-2xl sm:text-[28px] xl:text-[22px] 2xl:text-[21px] font-light leading-tight tracking-tight text-white">
                {profile.display_name || profile.user_email}
              </h2>
              {profile.title && (
                <p className="mt-2 text-[11px] sm:text-xs xl:text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70 line-clamp-2">
                  {profile.title}
                </p>
              )}
            </div>

            <div className="flex h-10 w-10 xl:h-9 xl:w-9 flex-shrink-0 items-center justify-center border border-white/25 bg-black/35 transition-colors group-hover:bg-white group-hover:text-black">
              <ArrowUpRight size={18} />
            </div>
          </div>

          {profile.bio && (
            <p className="max-w-xl text-sm xl:text-[13px] leading-relaxed text-white/70 line-clamp-3 xl:line-clamp-2">
              {profile.bio}
            </p>
          )}

          <div className="mt-5 xl:mt-4 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
            <span>View profile</span>
            {activeSponsors.length > 0 && <span>{activeSponsors.length} sponsor{activeSponsors.length > 1 ? 's' : ''}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function MemberListing() {
  const [search, setSearch] = useState('');

  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['memberProfiles'],
    queryFn: () => base44.entities.MemberProfile.list('display_name'),
    staleTime: 2 * 60 * 1000,
  });

  const { data: aiMembers = [], isLoading: aiMembersLoading } = useQuery({
    queryKey: ['publicAiMembers'],
    queryFn: () => base44.entities.AIMemberPublic.list('display_name', 200),
    staleTime: 2 * 60 * 1000,
  });

  const { data: profileSponsors = [], isLoading: sponsorsLoading } = useQuery({
    queryKey: ['memberDirectorySponsors'],
    queryFn: () => base44.entities.ProfileSponsor.list('-submitted_at', 500),
    staleTime: 60 * 1000,
  });

  const members = useMemo(() => {
    const regularMembers = profiles
      .filter(profile => profile.moderation_status !== 'expelled')
      .map(profile => ({
        ...profile,
        _memberKind: 'regular',
        _directoryKey: `member:${profile.id}`,
      }));

    const virtualMembers = aiMembers.map(profile => ({
      ...profile,
      _memberKind: 'ai',
      _directoryKey: `ai:${profile.id}`,
    }));

    return [...regularMembers, ...virtualMembers].sort((a, b) =>
      String(a.display_name || '').localeCompare(String(b.display_name || ''))
    );
  }, [profiles, aiMembers]);

  const sponsorsByMember = useMemo(() => {
    const map = new Map();
    for (const sponsor of profileSponsors) {
      const key = String(sponsor?.member_email || '').toLowerCase();
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(sponsor);
    }
    return map;
  }, [profileSponsors]);

  const filtered = members.filter(profile => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      profile.display_name?.toLowerCase().includes(q) ||
      profile.title?.toLowerCase().includes(q) ||
      profile.bio?.toLowerCase().includes(q) ||
      profile.handle?.toLowerCase().includes(q) ||
      profile.member_type?.toLowerCase().includes(q)
    );
  });

  const isLoading = profilesLoading || aiMembersLoading || sponsorsLoading;

  return (
    <div className="min-h-screen bg-black pb-24 pt-10">
      <div className="mx-auto max-w-[1500px] px-5 sm:px-7 lg:px-10">
        <div className="mb-10 border-b border-white/10 pb-8 lg:flex lg:items-end lg:justify-between lg:gap-12 xl:mb-8 xl:pb-6">
          <div className="max-w-2xl">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/40">AI Stage One Community</p>
            <h1 className="text-5xl font-extralight tracking-[0.17em] text-white sm:text-6xl xl:text-5xl">MEMBERS</h1>
            <div className="mt-5 h-px w-16 bg-red-600" />
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/55 sm:text-base xl:text-sm">
              Meet the creators, collaborators and specialists shaping the work published on AI Stage One.
            </p>
          </div>

          <div className="relative mt-7 w-full lg:mt-0 lg:w-[420px] xl:w-[360px]">
            <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Search members..."
              value={search}
              onChange={event => setSearch(event.target.value)}
              className="w-full border border-white/15 bg-black/80 py-4 xl:py-3.5 pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-white/40"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-white/10 px-6 py-16 text-center">
            <p className="text-sm text-white/45">No members found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 xl:gap-4">
            {filtered.map(profile => (
              <MemberCard
                key={profile._directoryKey}
                profile={profile}
                sponsors={sponsorsByMember.get(getMemberSponsorKey(profile)) || []}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
