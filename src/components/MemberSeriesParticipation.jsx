import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { Film, User, CheckCircle2, Clock, Video } from 'lucide-react';

const STATUS_CONFIG = {
  pending: { label: 'Pending', icon: Clock, color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' },
  uploaded: { label: 'Uploaded', icon: Video, color: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
  approved: { label: 'Approved', icon: CheckCircle2, color: 'text-green-400 bg-green-400/10 border-green-400/30' },
};

const METHOD_LABELS = {
  likeness_reference: 'Likeness Ref',
  likeness_performance: 'Likeness Perf',
  reference_performance: 'Ref Performance',
  body_and_voice: 'Body & Voice',
  faceswitch: 'Face Switch',
  voice_only: 'Voice Only',
};

export default function MemberSeriesParticipation({ userEmail }) {
  const { data: timelines = [], isLoading } = useQuery({
    queryKey: ['userTimelines', userEmail],
    queryFn: () => base44.entities.UserTimeline.filter({ user_email: userEmail }),
    enabled: !!userEmail,
  });

  const { data: episodePages = {} } = useQuery({
    queryKey: ['episodePagesForTimelines', timelines.map(t => t.episode_page_id)],
    queryFn: async () => {
      const map = {};
      await Promise.all(
        timelines.map(async (t) => {
          const pages = await base44.entities.DossierPage.filter({ id: t.episode_page_id });
          if (pages[0]) map[t.episode_page_id] = pages[0];
        })
      );
      return map;
    },
    enabled: timelines.length > 0,
  });

  const dossierIds = [...new Set(Object.values(episodePages).map(p => p.dossier_id).filter(Boolean))];
  const { data: dossiers = {} } = useQuery({
    queryKey: ['dossiersForSeries', dossierIds],
    queryFn: async () => {
      const map = {};
      await Promise.all(
        dossierIds.map(async (id) => {
          const list = await base44.entities.Dossier.filter({ id });
          if (list[0]) map[id] = list[0];
        })
      );
      return map;
    },
    enabled: dossierIds.length > 0,
  });

  if (isLoading) return null;
  if (timelines.length === 0) return null;

  return (
    <div className="space-y-4 lg:space-y-[2%]">
      <div className="flex items-center gap-3 px-1 lg:gap-[2%] lg:px-[1%]">
        <div className="w-10 h-10 bg-purple-400/20 rounded-xl flex items-center justify-center lg:w-[6%] lg:aspect-square lg:h-auto lg:rounded-[20%]">
          <Film className="text-purple-400 w-1/2 h-1/2" />
        </div>
        <div>
          <p className="text-white text-xl font-bold uppercase tracking-wider lg:text-[1.15vw]">Series Participation</p>
          <p className="text-white/50 text-xs lg:text-[0.68vw]">{timelines.length} episode{timelines.length > 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="space-y-3 lg:space-y-[1%]">
        {timelines.map((timeline, idx) => {
          const episodePage = episodePages[timeline.episode_page_id];
          const dossier = episodePage ? dossiers[episodePage.dossier_id] : null;
          const totalBlocks = timeline.block_overrides?.length || 0;
          const uploadedBlocks = timeline.block_overrides?.filter(b => b.status === 'uploaded' || b.status === 'approved').length || 0;
          const progress = totalBlocks > 0 ? (uploadedBlocks / totalBlocks) * 100 : 0;
          const hasCharacter = !!timeline.selected_character_id || !!timeline.character_photo_url;

          return (
            <motion.div
              key={timeline.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-neutral-900 rounded-2xl overflow-hidden border border-white/10 lg:rounded-[0.7vw] lg:grid lg:grid-cols-[18%_82%]"
            >
              {dossier?.cover_image ? (
                <div className="relative h-28 overflow-hidden lg:h-auto lg:min-h-0 lg:aspect-[4/3]">
                  <img src={dossier.cover_image} alt="" className="w-full h-full object-cover opacity-50" />
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 to-transparent lg:bg-gradient-to-r" />
                  <div className="absolute bottom-3 left-4 right-4 lg:left-[8%] lg:right-[5%] lg:bottom-[8%]">
                    <p className="text-white text-sm font-bold truncate lg:text-[0.72vw]">{dossier.title}</p>
                    {dossier.category && <p className="text-white/60 text-xs lg:text-[0.6vw]">{dossier.category}</p>}
                  </div>
                </div>
              ) : (
                <div className="hidden lg:flex items-center justify-center bg-white/[0.03]">
                  <Film className="text-white/20 w-[18%] h-auto" />
                </div>
              )}

              <div className="p-4 space-y-3 lg:p-[2%] lg:space-y-[1.5%]">
                {!dossier?.cover_image && dossier && <p className="text-white/60 text-xs font-bold truncate lg:text-[0.62vw]">{dossier.title}</p>}

                <div className="flex items-start justify-between gap-3 lg:gap-[2%]">
                  <div className="flex-1 min-w-0 lg:flex lg:items-center lg:gap-[2%]">
                    <p className="text-white text-base font-bold truncate lg:text-[0.8vw]">
                      {episodePage?.episode_title || episodePage?.title || 'Episode'}
                    </p>
                    {timeline.selected_method && (
                      <span className="inline-block mt-1.5 text-xs px-2.5 py-1 rounded-full bg-purple-400/15 text-purple-300 font-semibold border border-purple-400/20 lg:mt-0 lg:text-[0.62vw] lg:px-[1.5%] lg:py-[0.45%]">
                        {METHOD_LABELS[timeline.selected_method] || timeline.selected_method}
                      </span>
                    )}
                  </div>
                  {hasCharacter && timeline.character_photo_url && (
                    <img src={timeline.character_photo_url} alt="Character" className="w-12 h-12 rounded-xl object-cover border-2 border-white/20 flex-shrink-0 lg:w-[6%] lg:aspect-square lg:h-auto lg:rounded-[15%]" />
                  )}
                </div>

                {hasCharacter && !timeline.character_photo_url && (
                  <div className="flex items-center gap-2 text-white/60 text-xs lg:gap-[1%] lg:text-[0.62vw]">
                    <User className="w-[1.2%] h-auto" />
                    <span>Character selected</span>
                  </div>
                )}

                {totalBlocks > 0 && (
                  <div className="space-y-1.5 lg:space-y-[0.5%]">
                    <div className="flex items-center justify-between">
                      <span className="text-white/50 text-xs lg:text-[0.6vw]">Scene Progress</span>
                      <span className="text-white text-xs font-mono font-bold lg:text-[0.6vw]">{uploadedBlocks}/{totalBlocks}</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden lg:h-[0.22vw]">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.6, delay: idx * 0.05 }} className="h-full bg-gradient-to-r from-purple-400 to-blue-400 rounded-full" />
                    </div>
                  </div>
                )}

                {(timeline.block_overrides || []).length > 0 && (
                  <div className="flex gap-1.5 flex-wrap lg:gap-[0.7%]">
                    {timeline.block_overrides.map((b, i) => {
                      const cfg = STATUS_CONFIG[b.status] || { label: b.status, icon: Clock, color: 'text-white bg-white/5 border-white/10' };
                      const Icon = cfg.icon;
                      return (
                        <span key={i} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${cfg.color} lg:gap-[0.3vw] lg:text-[0.58vw] lg:px-[1%] lg:py-[0.35%]`}>
                          <Icon className="w-[0.6vw] h-[0.6vw]" />
                          {i + 1}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
