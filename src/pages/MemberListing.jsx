import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';

function MemberCard({ profile }) {
  return (
    <Link
      to={`/MemberDashboard?email=${encodeURIComponent(profile.user_email)}`}
      className="flex items-center gap-4 bg-neutral-900 border border-white/10 rounded-lg p-4 hover:border-white/25 hover:bg-neutral-800/80 transition-colors"
    >
      {profile.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={profile.display_name}
          className="w-12 h-12 rounded-full object-cover border border-white/15 flex-shrink-0"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0 text-white text-xl font-light">
          {profile.display_name?.charAt(0) || '?'}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold truncate">{profile.display_name || profile.user_email}</p>
        {profile.title && <p className="text-gray-400 text-sm truncate">{profile.title}</p>}
        {profile.bio && <p className="text-gray-500 text-xs truncate mt-0.5">{profile.bio}</p>}
      </div>
    </Link>
  );
}

export default function MemberListing() {
  const [search, setSearch] = useState('');

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['memberProfiles'],
    queryFn: () => base44.entities.MemberProfile.list('display_name'),
    staleTime: 2 * 60 * 1000,
  });

  const filtered = profiles.filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.display_name?.toLowerCase().includes(q) ||
      p.title?.toLowerCase().includes(q) ||
      p.bio?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-black pb-24 pt-8">
      <div className="px-6 mb-5">
        <h1 className="text-white text-3xl font-extralight tracking-widest">MEMBERS</h1>
        <div className="w-10 h-0.5 bg-red-600 mt-3" />
      </div>

      {/* Search */}
      <div className="px-6 mb-5">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-neutral-900 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-white/25"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-6 space-y-2.5">
          {filtered.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-10">No members found</p>
          ) : (
            filtered.map(profile => (
              <MemberCard key={profile.id} profile={profile} />
            ))
          )}
        </div>
      )}
    </div>
  );
}