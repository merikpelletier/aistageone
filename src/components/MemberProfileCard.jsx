import React, { useState, useEffect } from 'react';
import { Edit2, Handshake, Heart, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import FanSubscribeButton from '@/components/FanSubscribeButton';

export default function MemberProfileCard({ profile, user, isOwnProfile, onEdit, topAside }) {
  const [sponsor, setSponsor] = useState(null);
  const [sponsorLoaded, setSponsorLoaded] = useState(false);

  useEffect(() => {
    const email = profile?.user_email || user?.email;
    if (!email) return;
    base44.entities.ProfileSponsor.filter({ member_email: email, is_active: true })
      .then(sponsors => {
        if (sponsors.length > 0) {
          const random = sponsors[Math.floor(Math.random() * sponsors.length)];
          setSponsor(random);
        }
        setSponsorLoaded(true);
      })
      .catch(() => setSponsorLoaded(true));
  }, [profile?.user_email, user?.email]);

  if (!user) return null;

  const displayName = profile?.display_name || user?.full_name || '?';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full bg-black"
    >
      <div className="w-full lg:flex lg:items-start lg:gap-[2%]">
        <div className="lg:flex-1 lg:min-w-0">
          <div className="px-8 pt-8 pb-2 lg:px-0 lg:pt-[1.2%] lg:pb-[0.4%]">
            <div className="w-16 h-16 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center overflow-hidden lg:w-[4.5vw] lg:h-[4.5vw]">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <User size={28} className="text-white/50" />
              )}
            </div>
          </div>

          <div className="px-8 pt-4 pb-6 lg:px-0 lg:pt-[0.8%] lg:pb-[0.8%]">
            <div className="flex items-start justify-between mb-2 lg:mb-[0.6%]">
              <div className="flex-1 min-w-0">
                <h2 className="text-white text-4xl md:text-5xl lg:text-[2.1vw] lg:leading-[1.05] font-light tracking-tight mb-2 lg:mb-[0.5%]">{displayName}</h2>
                {profile?.title && (
                  <p className="text-red-500 text-xs font-bold tracking-widest uppercase lg:text-[0.72vw]">{profile.title}</p>
                )}
              </div>
              {isOwnProfile && (
                <button onClick={onEdit} className="w-11 h-11 rounded-full bg-neutral-900 flex items-center justify-center border border-white/10 hover:border-white/30 transition-colors ml-4 flex-shrink-0 lg:w-[3vw] lg:h-[3vw] lg:ml-[1%]">
                  <Edit2 className="text-white lg:w-[1vw] lg:h-[1vw]" size={17} />
                </button>
              )}
            </div>
          </div>

          {profile?.bio && (
            <div className="px-8 pb-8 lg:px-0 lg:pb-[1%]">
              <p className="text-white text-base leading-relaxed lg:text-[0.92vw] lg:leading-[1.45]">{profile.bio}</p>
            </div>
          )}

          {!isOwnProfile && (
            <div className="px-8 pb-10 lg:px-0 lg:pb-0 lg:pt-[0.6%]">
              <div className="flex flex-wrap gap-2.5 lg:gap-[0.6vw]">
                <button className="flex items-center gap-2 px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-semibold rounded-full transition-colors lg:px-[1vw] lg:py-[0.45vw] lg:text-[0.72vw]">
                  <Heart size={16} className="text-red-500" fill="#EF4444" />
                  <span>Fan · 1</span>
                </button>
                <Link
                  to={`/SponsorRequest?member=${encodeURIComponent(profile?.user_email || user?.email || '')}`}
                  className="flex items-center gap-2 px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-semibold rounded-full transition-colors lg:px-[1vw] lg:py-[0.45vw] lg:text-[0.72vw]"
                >
                  <Handshake size={16} />
                  <span>Sponsor</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {profile?.images && profile.images.length > 0 && (
          <div className="px-8 pb-8 lg:px-0 lg:pt-[1.2%] lg:pb-0 lg:flex-[1.8_1_0%] lg:min-w-0">
            <p className="text-white text-xs font-bold uppercase tracking-widest mb-5 lg:mb-[0.7%] lg:text-[0.72vw]">Gallery</p>
            <div className="grid grid-cols-3 gap-4 lg:flex lg:w-full lg:gap-[0.8vw] lg:overflow-x-auto lg:overflow-y-hidden lg:pb-[0.6%]">
              {profile.images.map((img, idx) => (
                <div key={idx} className="relative aspect-[3/4] group cursor-pointer overflow-hidden rounded-md lg:aspect-auto lg:h-[20vh] lg:min-h-[14vh] lg:max-h-[22vh] lg:flex-[0_0_auto] lg:w-auto">
                  <img src={img} alt={`gallery-${idx}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                </div>
              ))}
            </div>
          </div>
        )}

        {topAside && (
          <div className="px-8 pb-8 lg:px-0 lg:pt-[1.2%] lg:pb-0 lg:flex-1 lg:min-w-0">
            {topAside}
          </div>
        )}
      </div>
    </motion.div>
  );
}
