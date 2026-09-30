import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Heart, Handshake } from 'lucide-react';
import { Link } from 'react-router-dom';
import FanSubscribeButton from '@/components/FanSubscribeButton';
import FanDonationButton from '@/components/FanDonationButton';

export default function ProfileFansSponsors({ profile, user }) {
  const email = profile?.user_email || user?.email;

  return (
    <div className="py-2 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <FanSubscribeButton memberEmail={email} />
        <FanDonationButton creatorEmail={email} />
      </div>
      <Link
        to={`/SponsorRequest?member=${encodeURIComponent(email || '')}`}
        className="flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/30 text-white text-xs font-medium rounded-lg hover:bg-white/20 transition-colors w-fit"
      >
        <Handshake size={13} />
        Sponsor
      </Link>
    </div>
  );
}