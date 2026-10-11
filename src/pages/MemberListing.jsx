import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';

function MemberCard({ profile }) {
  const isAI = profile._memberKind === 'ai';

  const content = (
    <div className="h-full flex flex-col p-5">
      <div className="flex items-start gap-4">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.display_name}
            className="w-20 h-20 object-cover border border-white/15 flex-shrink-0 bg-neutral-800"
          />
        ) : (
          <div className="w-20 h-20 bg-neutral-800 border border-white/15 flex items-center justify-center flex-shrink-0 text-white text-2xl font-light">
            {profile.display_name?.charAt(0) || '?'}
          </div>
        )}

        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-white text-lg font-semibold leading-tight line-clamp-2">
              {profile.display_name || profile.user_email}
            </h2>
            {isAI && (
              <span className="flex-shrink-0 border border-teal-400/50 text-teal-300 text-[10px] font-semibold uppercase tracking-[0.12em] px-2 py-1">
                AI GENERATED
              </span>
            )}
          </div>

          {profile.title && (
            <p className="text-gray-300 text-sm leading-snug mt-2 line-clamp-2">
              {profile.title}
            </p>
          )}
        </div>
      </div>

      {profile.bio && (
        <p className="text-gray-500 text-sm leading-relaxed mt-5 line-clamp-3">
          {profile.bio}
        </p>
      )}

      <div className="mt-auto pt-5 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.12em] text-gray-600">
        <span>{isAI ? 'AI Stage One' : 'Member'}</span>
        <span className="text-gray-400">View profile</span>
      </div>
    </div>
  );

  const className = 'block h-full bg-neutral-950 border border-white/10 transition-colors hover:border-white/30 hover:bg-neutral-900';

  return (
    <Link
      to={isAI
        ? `/AIMemberProfile?id=${encodeURIComponent(profile.id)}`
        : `/MemberDashboard?email=${encodeURIComponent(profile.user_email)}`}
      className={className}
    >
      {content}
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

  const members = useMemo(() => {
    const regularMembers = profiles.map(profile => ({
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

  const filtered = members.filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.display_name?.toLowerCase().includes(q) ||
      p.title?.toLowerCase().includes(q) ||
      p.bio?.toLowerCase().includes(q) ||
      p.handle?.toLowerCase().includes(q) ||
      p.member_type?.toLowerCase().includes(q)
    );
  });

  const isLoading = profilesLoading || aiMembersLoading;

  return (
    <div className="min-h-screen bg-black pb-24 pt-10">
      <div className="max-w-7xl mx-auto px-5 sm:px-7 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
          <div>
            <h1 className="text-white text-3xl sm:text-4xl font-extralight tracking-[0.2em]">MEMBERS</h1>
            <div className="w-12 h-px bg-red-600 mt-4" />
            <p className="text-gray-500 text-sm mt-4 max-w-xl">
              Discover creators, collaborators and AI-generated members across AI Stage One.
            </p>
          </div>

          <div className="relative w-full lg:w-[420px]">
            <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search members..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-neutral-950 border border-white/15 pl-11 pr-4 py-3.5 text-white placeholder:text-gray-600 text-sm focus:outline-none focus:border-white/35"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-white/10 py-16 px-6 text-center">
            <p className="text-gray-400 text-sm">No members found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5">
            {filtered.map(profile => (
              <MemberCard key={profile._directoryKey} profile={profile} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
