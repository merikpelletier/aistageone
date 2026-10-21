import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, ArrowUpRight, MapPin, X } from 'lucide-react';

function getMemberSponsorKey(profile) {
  return profile._memberKind === 'ai'
    ? `ai-member:${profile.id}`.toLowerCase()
    : String(profile.user_email || '').toLowerCase();
}

function text(value) {
  return String(value || '').trim();
}

function lower(value) {
  return text(value).toLowerCase();
}

function valuesFrom(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(text).filter(Boolean);
    } catch {}
    return value.split(',').map(text).filter(Boolean);
  }
  return [];
}

function memberType(profile) {
  return text(profile.member_type || profile.title);
}

function memberLocation(profile) {
  return text(profile.location_label || profile.location);
}

function MemberCard({ profile, sponsors = [] }) {
  const isAI = profile._memberKind === 'ai';
  const heroImage = profile.banner_url || profile.cover_url || profile.hero_image_url || profile.avatar_url;
  const activeSponsors = sponsors.filter((sponsor) =>
    sponsor?.is_active === true || sponsor?.status === 'active' || sponsor?.status === 'approved'
  );
  const type = memberType(profile);
  const location = memberLocation(profile);
  const interests = valuesFrom(profile.interests).slice(0, 2);

  return (
    <Link
      to={isAI
        ? `/MemberDashboard?aiMemberId=${encodeURIComponent(profile.id)}`
        : `/MemberDashboard?email=${encodeURIComponent(profile.user_email)}`}
      className="group relative block min-h-[340px] overflow-hidden border border-white/10 bg-neutral-950 transition-colors hover:border-white/35 lg:min-h-[210px]"
    >
      <div className="absolute inset-0">
        {heroImage ? (
          <img
            src={heroImage}
            alt={profile.display_name || 'Member'}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-neutral-900 text-5xl font-light text-white/25 lg:text-4xl">
            {(profile.display_name || profile.user_email || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
      </div>

      <div className="relative z-10 flex min-h-[340px] flex-col justify-between p-4 lg:min-h-[210px] lg:p-3.5">
        <div className="flex flex-wrap gap-1.5">
          <span className={`border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] ${isAI ? 'border-teal-300/60 bg-black/70 text-teal-200' : 'border-white/25 bg-black/65 text-white/75'}`}>
            {isAI ? 'AI' : 'Human'}
          </span>
          {type && (
            <span className="border border-white/20 bg-black/65 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/70">
              {type}
            </span>
          )}
        </div>

        <div>
          <div className="flex items-end justify-between gap-3 border-b border-white/15 pb-3">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-light leading-tight text-white lg:text-[17px]">
                {profile.display_name || profile.user_email}
              </h2>
              {profile.title && profile.title !== type && (
                <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-white/60">
                  {profile.title}
                </p>
              )}
            </div>
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center border border-white/20 bg-black/40 transition-colors group-hover:bg-white group-hover:text-black lg:h-7 lg:w-7">
              <ArrowUpRight size={14} />
            </div>
          </div>

          <div className="mt-2 flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-white/55">
            {location && (
              <span className="flex items-center gap-1"><MapPin size={11} />{location}</span>
            )}
            {interests.map((interest) => (
              <span key={interest} className="border border-white/15 px-1.5 py-0.5">{interest}</span>
            ))}
          </div>

          {profile.bio && (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-white/65 lg:text-[11px]">
              {profile.bio}
            </p>
          )}

          <div className="mt-2 flex items-center justify-between text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">
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
  const [kindFilter, setKindFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [interestFilter, setInterestFilter] = useState('all');

  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ['memberProfiles', 'directory'],
    queryFn: () => base44.entities.MemberProfile.list('-created_date', 500),
    staleTime: 2 * 60 * 1000,
  });

  const { data: aiMembers = [], isLoading: aiMembersLoading } = useQuery({
    queryKey: ['publicAiMembers', 'directory'],
    queryFn: () => base44.entities.AIMemberPublic.list('-created_date', 500),
    staleTime: 2 * 60 * 1000,
  });

  const { data: profileSponsors = [], isLoading: sponsorsLoading } = useQuery({
    queryKey: ['memberDirectorySponsors'],
    queryFn: () => base44.entities.ProfileSponsor.list('-submitted_at', 500),
    staleTime: 60 * 1000,
  });

  const members = useMemo(() => {
    const regularMembers = profiles
      .filter((profile) => profile.moderation_status !== 'expelled')
      .map((profile) => ({ ...profile, _memberKind: 'human', _directoryKey: `member:${profile.id}` }));

    const virtualMembers = aiMembers.map((profile) => ({
      ...profile,
      _memberKind: 'ai',
      _directoryKey: `ai:${profile.id}`,
    }));

    return [...regularMembers, ...virtualMembers].sort((a, b) =>
      new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime()
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

  const typeOptions = useMemo(() => [...new Set(members.map(memberType).filter(Boolean))].sort(), [members]);
  const locationOptions = useMemo(() => [...new Set(members.map(memberLocation).filter(Boolean))].sort(), [members]);
  const interestOptions = useMemo(() => [...new Set(members.flatMap((profile) => valuesFrom(profile.interests)))].sort(), [members]);

  const filtersActive = !!search.trim() || kindFilter !== 'all' || typeFilter !== 'all' || locationFilter !== 'all' || interestFilter !== 'all';

  const filtered = useMemo(() => {
    const q = lower(search);
    const result = members.filter((profile) => {
      if (kindFilter !== 'all' && profile._memberKind !== kindFilter) return false;
      if (typeFilter !== 'all' && memberType(profile) !== typeFilter) return false;
      if (locationFilter !== 'all' && memberLocation(profile) !== locationFilter) return false;
      if (interestFilter !== 'all' && !valuesFrom(profile.interests).includes(interestFilter)) return false;

      if (q) {
        const searchable = [
          profile.display_name,
          profile.user_email,
          profile.handle,
          profile.title,
          profile.member_type,
          profile.location_label,
          profile.bio,
          ...valuesFrom(profile.interests),
        ].map(lower).join(' ');
        if (!searchable.includes(q)) return false;
      }

      return true;
    });

    return filtersActive ? result : result.slice(0, 50);
  }, [members, search, kindFilter, typeFilter, locationFilter, interestFilter, filtersActive]);

  const resetFilters = () => {
    setSearch('');
    setKindFilter('all');
    setTypeFilter('all');
    setLocationFilter('all');
    setInterestFilter('all');
  };

  const isLoading = profilesLoading || aiMembersLoading || sponsorsLoading;

  return (
    <div className="min-h-screen bg-black pb-24 pt-7 lg:pt-5">
      <div className="mx-auto max-w-[1700px] px-5 sm:px-7 lg:px-8">
        <div className="mb-5 border-b border-white/10 pb-5 lg:mb-4 lg:pb-4">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
            <div>
              <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.28em] text-white/40">AI Stage One Community</p>
              <h1 className="text-4xl font-extralight tracking-[0.15em] text-white lg:text-3xl">MEMBERS</h1>
              <div className="mt-3 h-px w-14 bg-red-600" />
              <p className="mt-3 max-w-xl text-xs leading-relaxed text-white/50 lg:text-[11px]">
                {filtersActive ? `${filtered.length} matching member${filtered.length === 1 ? '' : 's'}` : '50 most recent members'}
              </p>
            </div>

            <div className="relative w-full lg:max-w-[440px]">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" />
              <input
                type="text"
                placeholder="Search name, email, role, location, interest..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-10 w-full border border-white/15 bg-black/80 pl-10 pr-3 text-xs text-white outline-none placeholder:text-white/30 focus:border-white/40"
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:flex-wrap lg:items-center">
            <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} className="h-9 border border-white/15 bg-black px-3 text-xs text-white outline-none lg:min-w-[120px]">
              <option value="all">AI + Human</option>
              <option value="human">Human</option>
              <option value="ai">AI</option>
            </select>

            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-9 border border-white/15 bg-black px-3 text-xs text-white outline-none lg:min-w-[150px]">
              <option value="all">All types</option>
              {typeOptions.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>

            <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="h-9 border border-white/15 bg-black px-3 text-xs text-white outline-none lg:min-w-[150px]">
              <option value="all">All locations</option>
              {locationOptions.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>

            <select value={interestFilter} onChange={(e) => setInterestFilter(e.target.value)} className="h-9 border border-white/15 bg-black px-3 text-xs text-white outline-none lg:min-w-[150px]">
              <option value="all">All interests</option>
              {interestOptions.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>

            {filtersActive && (
              <button onClick={resetFilters} className="flex h-9 items-center justify-center gap-1.5 border border-white/15 px-3 text-xs text-white/65 hover:text-white">
                <X size={13} /> Reset
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-white/10 px-6 py-12 text-center">
            <p className="text-sm text-white/45">No members found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {filtered.map((profile) => (
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