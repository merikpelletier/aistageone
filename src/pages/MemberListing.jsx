import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';

function MemberCard({ profile }) {
  return (
    <Link
      to={`/MemberDashboard?email=${encodeURIComponent(profile.user_email)}`}
      className="flex items-center gap-4 bg-white border-2 border-black rounded-lg p-4 hover:bg-yellow-50 transition-colors"
    >
      {profile.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={profile.display_name}
          className="w-12 h-12 rounded-full object-cover border-2 border-black flex-shrink-0"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0 text-white text-xl font-light">
          {profile.display_name?.charAt(0) || '?'}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-black font-semibold truncate">{profile.display_name || profile.user_email}</p>
        {profile.title && <p className="text-black text-sm truncate">{profile.title}</p>}
        {profile.bio && <p className="text-black text-xs truncate mt-0.5">{profile.bio}</p>}
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
    <div className="min-h-screen bg-yellow-400 pb-24 pt-8">
      <div className="px-6 mb-6">
        <h1 className="text-black text-3xl font-extralight tracking-widest">MEMBERS</h1>
        <div className="w-10 h-0.5 bg-red-600 mt-3" />
      </div>

      {/* Search */}
      <div className="px-6 mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-black" />
          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border-2 border-black rounded-lg pl-9 pr-4 py-2.5 text-black placeholder:text-black text-sm focus:outline-none"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-black/30 border-t-black rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-6 space-y-3">
          {filtered.length === 0 ? (
            <p className="text-black text-sm text-center py-10">No members found</p>
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