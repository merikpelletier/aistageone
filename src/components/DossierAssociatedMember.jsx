import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';

export default function DossierAssociatedMember({ dossier, compact = false }) {
  const aiMemberId = dossier?.ai_member_id || null;
  const memberEmail = dossier?.submitted_by_email?.trim() || null;

  const { data: member, isLoading } = useQuery({
    queryKey: ['dossier-associated-member', aiMemberId || memberEmail],
    enabled: !!(aiMemberId || memberEmail),
    queryFn: async () => {
      if (aiMemberId) {
        const members = await base44.entities.AIMemberPublic.list('display_name', 500);
        const found = members.find(item => String(item.id) === String(aiMemberId));
        return found ? { ...found, _memberKind: 'ai' } : null;
      }

      const profiles = await base44.entities.MemberProfile.filter({ user_email: memberEmail });
      const found = profiles?.[0] || null;
      return found ? { ...found, _memberKind: 'regular' } : null;
    },
    staleTime: 60_000,
  });

  if (isLoading || !member) return null;

  const href = member._memberKind === 'ai'
    ? `/MemberDashboard?aiMemberId=${encodeURIComponent(member.id)}`
    : `/MemberDashboard?email=${encodeURIComponent(member.user_email || memberEmail)}`;

  const name = member.display_name || member.full_name || member.user_email || 'Member';
  const title = member.title || member.headline || '';

  return (
    <Link
      to={href}
      className={`group flex items-center gap-3 border border-white/15 bg-white/[0.035] hover:bg-white/[0.07] hover:border-white/30 transition-colors ${compact ? 'p-2.5' : 'p-3.5'}`}
      aria-label={`View ${name} profile`}
    >
      <div className={`${compact ? 'h-10 w-10' : 'h-12 w-12'} flex-shrink-0 overflow-hidden border border-white/15 bg-neutral-900`}>
        {member.avatar_url ? (
          <img src={member.avatar_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/45 font-semibold">
            {String(name).charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <p className={`${compact ? 'text-sm' : 'text-base'} text-white font-medium truncate`}>{name}</p>
          {member._memberKind === 'ai' && (
            <span className="flex-shrink-0 border border-teal-300/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-teal-200">AI</span>
          )}
        </div>
        {title && <p className="mt-0.5 text-xs text-white/45 truncate">{title}</p>}
      </div>

      <div className="flex-shrink-0 text-right">
        <p className="text-[9px] uppercase tracking-[0.18em] text-white/35">Associated with</p>
        <p className="mt-1 text-[11px] font-medium text-white/70 group-hover:text-white">View Profile →</p>
      </div>
    </Link>
  );
}
