import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Heart, Handshake } from 'lucide-react';
import { Link } from 'react-router-dom';
import FanSubscribeButton from '@/components/FanSubscribeButton';

export default function ProfileFansSponsors({ profile, user }) {
  const email = profile?.user_email || user?.email;
  const [sponsor, setSponsor] = useState(null);

  useEffect(() => {
    if (!email) return;
    base44.entities.ProfileSponsor.filter({ member_email: email, is_active: true })
      .then(sponsors => {
        if (sponsors.length > 0) {
          setSponsor(sponsors[Math.floor(Math.random() * sponsors.length)]);
        }
      })
      .catch(() => {});
  }, [email]);

  return (
    <div className="py-2 space-y-3">
      <FanSubscribeButton memberEmail={email} />
      <Link
        to={`/SponsorRequest?member=${encodeURIComponent(email || '')}`}
        className="flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/30 text-white text-xs font-medium rounded-lg hover:bg-white/20 transition-colors w-fit"
      >
        <Handshake size={13} />
        Sponsor
      </Link>
      {sponsor && (
        <div className="text-white/50 text-xs">
          Sponsored by <span className="text-white/80 font-medium">{sponsor.sponsor_name || 'a partner'}</span>
        </div>
      )}
    </div>
  );
}