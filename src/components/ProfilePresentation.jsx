import React from 'react';
import { User } from 'lucide-react';

export default function ProfilePresentation({ profile, user }) {
  const displayName = profile?.display_name || user?.full_name || '?';

  return (
    <div className="py-2">
      <div className="w-16 h-16 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center overflow-hidden mb-3">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
        ) : (
          <User size={28} className="text-white/50" />
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <h2 className="text-white text-3xl font-light tracking-tight">{displayName}</h2>
        {profile?.is_ai_generated && (
          <span className="border border-teal-400/50 text-teal-300 text-[10px] font-semibold uppercase tracking-[0.12em] px-2 py-1">
            AI GENERATED
          </span>
        )}
      </div>
      {profile?.title && (
        <p className="text-red-500 text-xs font-bold tracking-widest uppercase mb-3">{profile.title}</p>
      )}
      {profile?.bio && (
        <p className="text-white/80 text-sm leading-relaxed">{profile.bio}</p>
      )}
    </div>
  );
}