import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import ProxiedImage from '@/components/ProxiedImage';
import { ChevronDown, ChevronUp, User, CheckCircle2, Clock, Image } from 'lucide-react';

const METHOD_LABELS = {
  body_and_voice: 'Body & Voice',
  faceswitch: 'FaceSwitch',
  voice_only: 'Voice Only',
};

const STATUS_COLORS = {
  uploaded: 'text-green-400',
  pending: 'text-yellow-400',
  approved: 'text-blue-400',
};

export default function AdminEpisodeParticipants({ episodePage, production }) {
  const [expanded, setExpanded] = useState(null);

  const { data: timelines = [], isLoading } = useQuery({
    queryKey: ['userTimelines', episodePage.id],
    queryFn: () => base44.entities.UserTimeline.filter({ episode_page_id: episodePage.id }),
  });

  const blocksById = Object.fromEntries(
    (production?.timeline || []).map(b => [b.id, b])
  );

  if (isLoading) return <div className="py-4 text-white text-sm">Loading...</div>;

  if (timelines.length === 0) {
    return <p className="text-white/20 text-sm text-center py-6">No participants yet.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-white text-xs tracking-widest uppercase">{timelines.length} Participant{timelines.length !== 1 ? 's' : ''}</p>

      {timelines.map(ut => {
        const isOpen = expanded === ut.id;
        const charName = production?.characters?.find(c => c.id === ut.selected_character_id)?.name || '—';
        const overrides = ut.block_overrides || [];
        const uploadedCount = overrides.filter(o => o.user_media_url).length;

        return (
          <div key={ut.id} className="border border-white/10 rounded-xl overflow-hidden">
            {/* Row header */}
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : ut.id)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/8 transition-colors text-left"
            >
              <User size={14} className="text-white flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm truncate">{ut.user_email}</p>
                <p className="text-white text-xs mt-0.5">
                  {charName} · {METHOD_LABELS[ut.selected_method] || '—'} · {uploadedCount}/{overrides.length} blocks
                </p>
              </div>
              {ut.character_photo_url && (
                <img src={ut.character_photo_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-white/20" />
              )}
              {isOpen ? <ChevronUp size={14} className="text-white flex-shrink-0" /> : <ChevronDown size={14} className="text-white flex-shrink-0" />}
            </button>

            {isOpen && (
              <div className="px-4 pb-4 pt-3 bg-black/30 space-y-4">

                {/* Character photo */}
                {ut.character_photo_url && (
                  <div>
                    <p className="text-white text-xs tracking-widest uppercase mb-2">Character Photo</p>
                    <img src={ut.character_photo_url} alt="" className="w-24 h-24 rounded-xl object-cover border border-white/10" />
                  </div>
                )}

                {/* Block overrides */}
                <div>
                  <p className="text-white text-xs tracking-widest uppercase mb-2">Block Submissions</p>
                  {overrides.length === 0 ? (
                    <p className="text-white/20 text-xs">No blocks submitted yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {overrides.map(o => {
                        const block = blocksById[o.block_id];
                        const hasMedia = !!o.user_media_url;
                        return (
                          <div key={o.block_id} className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                            {/* Block info */}
                            <div className="flex-1 min-w-0">
                              {block ? (
                                <p className="text-white text-xs font-mono">
                                  <span className="text-white mr-2">{String(block.order).padStart(2, '0')}</span>
                                  {block.title}
                                </p>
                              ) : (
                                <p className="text-white text-xs font-mono">Block ID: {o.block_id}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                {hasMedia ? (
                                  <CheckCircle2 size={11} className={STATUS_COLORS[o.status] || 'text-green-400'} />
                                ) : (
                                  <Clock size={11} className="text-white/20" />
                                )}
                                <span className={`text-xs ${STATUS_COLORS[o.status] || 'text-white'}`}>{o.status || 'pending'}</span>
                              </div>
                            </div>

                            {/* Media preview */}
                            {hasMedia && (
                              o.user_media_url.match(/\.(mp4|webm|ogg|mov)$/i) ? (
                                <video src={o.user_media_url} className="w-20 h-20 rounded-lg object-cover flex-shrink-0" muted />
                              ) : o.user_media_url.match(/\.(mp3|wav|m4a|ogg|aac)$/i) ? (
                                <audio src={o.user_media_url} controls className="flex-shrink-0 max-w-[120px]" />
                              ) : (
                                <img src={o.user_media_url} alt="" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}