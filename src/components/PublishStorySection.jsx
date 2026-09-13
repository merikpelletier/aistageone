import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Send, CheckCircle2, Loader2, Film, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function PublishStorySection({ userEmail }) {
  const qc = useQueryClient();
  const [publishingId, setPublishingId] = useState(null);

  const { data: stories = [], isLoading } = useQuery({
    queryKey: ['userTimelineStories', userEmail],
    queryFn: () => base44.entities.TimelineStory.filter({ user_email: userEmail }),
    enabled: !!userEmail,
  });

  // Stories that have at least one block with media
  const publishableStories = stories.filter(s => s.blocks?.some(b => b.media_url));

  if (isLoading) return null;
  if (publishableStories.length === 0) return null;

  const handlePublish = async (story) => {
    setPublishingId(story.id);
    try {
      const res = await base44.functions.invoke('publishEpisode', {
        production_id: story.id,
        kit_page_id: story.kit_page_id,
        dossier_id: story.dossier_id,
      });
      if (res.data?.error) {
        toast.error(res.data.error);
      } else {
        toast.success('Story published!');
        qc.invalidateQueries({ queryKey: ['userTimelineStories', userEmail] });
        qc.invalidateQueries({ queryKey: ['memberDossiers'] });
      }
    } catch (err) {
      toast.error('Failed to publish story');
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-3 px-1">
        <div className="w-10 h-10 bg-green-400/20 rounded-xl flex items-center justify-center">
          <BookOpen size={20} className="text-green-400" />
        </div>
        <div>
          <p className="text-white text-xl font-bold uppercase tracking-wider">Publish Story</p>
          <p className="text-white/50 text-xs">{publishableStories.length} ready to publish</p>
        </div>
      </div>

      {/* Story Cards */}
      <div className="space-y-3">
        {publishableStories.map((story, idx) => {
          const readyBlocks = story.blocks?.filter(b => b.media_url).length || 0;
          const isPublished = story.is_published;
          const coverImage = story.poster_image || story.blocks?.find(b => b.media_url)?.media_url;

          return (
            <motion.div
              key={story.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-neutral-900 rounded-2xl overflow-hidden border border-white/10"
            >
              {/* Cover */}
              {coverImage && (
                <div className="relative h-32 overflow-hidden">
                  <img src={coverImage} alt="" className="w-full h-full object-cover opacity-60" />
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 to-transparent" />
                  {isPublished && (
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500 text-white text-xs font-bold shadow-lg">
                      <CheckCircle2 size={12} />
                      Published
                    </div>
                  )}
                </div>
              )}

              <div className="p-4 space-y-3">
                {/* Title & scene count */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-base font-bold truncate">
                      {story.production_name || story.episode_title || 'Untitled Story'}
                    </p>
                    {story.episode_title && story.production_name && (
                      <p className="text-white/50 text-xs truncate mt-0.5">{story.episode_title}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-white/60 text-xs">
                        <Film size={11} />
                        {readyBlocks} scene{readyBlocks !== 1 ? 's' : ''}
                      </span>
                      {story.category && (
                        <span className="text-white/60 text-xs">{story.category}</span>
                      )}
                    </div>
                  </div>
                  {!coverImage && isPublished && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-bold border border-green-500/30">
                      <CheckCircle2 size={11} />
                      Published
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePublish(story)}
                    disabled={publishingId === story.id}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                      isPublished
                        ? 'bg-white/10 text-white hover:bg-white/15'
                        : 'bg-green-500 text-white hover:bg-green-600'
                    } disabled:opacity-50`}
                  >
                    {publishingId === story.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Send size={14} />
                    )}
                    {isPublished ? 'Re-publish' : 'Publish'}
                  </button>
                  <Link
                    to={`/MyProjects`}
                    className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/10 text-white hover:bg-white/15 transition-colors flex-shrink-0"
                  >
                    <ChevronRight size={18} />
                  </Link>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}