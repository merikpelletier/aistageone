import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Image, MessageSquare, User } from 'lucide-react';

export default function BecomeSponsorBanner({ memberEmail }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full bg-yellow-400 px-4 py-8"
    >
      <div className="max-w-5xl mx-auto">
        <h2 className="text-black font-extrabold text-2xl uppercase tracking-wide mb-1">
          Become a Sponsor
        </h2>
        <p className="text-black text-sm font-medium mb-6">
          Choose how you'd like to reach our community.
        </p>

        <div className="flex flex-col gap-4">
          {/* Profile Banner card with mockup */}
          <Link
            to={`/SponsorRequest?email=${encodeURIComponent(memberEmail || '')}&type=banner`}
            className="bg-white rounded-2xl p-4 hover:bg-black/5 transition-colors shadow-lg"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-neutral-900 rounded-xl flex items-center justify-center flex-shrink-0">
                <Image size={24} className="text-white" strokeWidth={2} />
              </div>
              <div>
                <h3 className="text-black font-bold text-base">Profile Banner</h3>
                <p className="text-black/70 text-sm">Place your banner image on a member's profile page for a chosen duration.</p>
              </div>
            </div>

            {/* Placeholder mockup: profile with banner */}
            <div className="rounded-xl overflow-hidden border border-black/10 bg-neutral-50">
              {/* Banner zone */}
              <div className="h-20 bg-gradient-to-r from-neutral-300 to-neutral-200 flex items-center justify-center relative">
                <span className="text-neutral-500 text-xs font-bold uppercase tracking-widest">Your Banner Here</span>
              </div>
              {/* Profile row */}
              <div className="flex items-center gap-3 p-3 bg-white">
                <div className="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center flex-shrink-0">
                  <User size={20} className="text-neutral-400" />
                </div>
                <div className="flex-1">
                  <div className="h-2.5 w-24 bg-neutral-200 rounded-full" />
                  <div className="h-2 w-16 bg-neutral-100 rounded-full mt-1.5" />
                </div>
              </div>
            </div>
          </Link>

          {/* Promo Message card with mockup */}
          <Link
            to={`/SponsorRequest?email=${encodeURIComponent(memberEmail || '')}&type=promo`}
            className="bg-white rounded-2xl p-4 hover:bg-black/5 transition-colors shadow-lg"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-neutral-900 rounded-xl flex items-center justify-center flex-shrink-0">
                <MessageSquare size={24} className="text-white" strokeWidth={2} />
              </div>
              <div>
                <h3 className="text-black font-bold text-base">Promo Message</h3>
                <p className="text-black/70 text-sm">Send a scheduled promotional message directly in one of our chat rooms.</p>
              </div>
            </div>

            {/* Placeholder mockup: chat room with promo message */}
            <div className="rounded-xl overflow-hidden border border-black/10 bg-neutral-50 p-3">
              {/* Chat header */}
              <div className="flex items-center gap-2 pb-2 border-b border-black/10 mb-3">
                <div className="w-6 h-6 rounded-full bg-neutral-300" />
                <div className="h-2 w-20 bg-neutral-200 rounded-full" />
              </div>
              {/* Regular message */}
              <div className="flex gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-neutral-200 flex-shrink-0" />
                <div className="max-w-[70%]">
                  <div className="h-2 w-12 bg-neutral-200 rounded-full mb-1" />
                  <div className="bg-neutral-100 rounded-xl rounded-tl-sm px-3 py-2">
                    <div className="h-2 w-32 bg-neutral-200 rounded-full" />
                  </div>
                </div>
              </div>
              {/* Promo message highlighted */}
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-yellow-300 flex items-center justify-center flex-shrink-0">
                  <MessageSquare size={12} className="text-black" />
                </div>
                <div className="max-w-[75%]">
                  <div className="h-2 w-16 bg-yellow-300 rounded-full mb-1" />
                  <div className="bg-yellow-100 border border-yellow-400 rounded-xl rounded-tl-sm px-3 py-2">
                    <span className="text-[10px] font-bold text-yellow-700 uppercase tracking-wider">Promo</span>
                    <div className="h-2 w-40 bg-neutral-300 rounded-full mt-1" />
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}