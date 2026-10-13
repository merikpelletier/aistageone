import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BookOpen, Send, CheckCircle2, Loader2, Film, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function PublishStorySection({ userEmail }) {
  const qc = useQueryClient();
  const [publishingId, setPublishingId] = useState(null);
  const [accessByStory, setAccessByStory] = useState({});

  const { data: stories = [], isLoading } = useQuery({
    queryKey: ['userTimelineStories', userEmail],
    queryFn: () => base44.entities.TimelineStory.filter({ user_email: userEmail }),
    enabled: !!userEmail,
  });

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
        access_level: accessByStory[story.id] || 'public',
      });
      if (res.data?.error) {
        toast.error(res.data.error);
      } else {
        toast.success('Story published!');
        qc.invalidateQueries({ queryKey: ['userTimelineStories', userEmail] });
        qc.invalidateQueries({ queryKey: ['memberDossiers'] });
      }
    } catch {
      toast.error('Failed to publish story');
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <div className="space-y-4 lg:space-y-[1.5%]">
      <div className="flex items-center gap-3 px-1 lg:gap-[1.5%] lg:px-0">
        <div className="w-10 h-10 bg-green-400/20 rounded-xl flex items-center justify-center lg:w-[5%] lg:aspect-square lg:h-auto lg:rounded-[20%]">
          <BookOpen className="text-green-400 w-1/2 h-1/2" />
        </div>
        <div>
          <p className="text-white text-xl font-bold uppercase tracking-wider lg:text-[1.15vw]">Publish Story</p>
          <p className="text-white/50 text-xs lg:text-[0.68vw]">{publishableStories.length} ready to publish</p>
        </div>
      </div>

      <div className="space-y-3 lg:space-y-[1.2%]">
        {publishableStories.map((story, idx) => {
          const readyBlocks = story.blocks?.filter(b => b.media_url).length || 0;
          const isPublished = story.is_published;
          const coverImage = story.poster_image || story.blocks?.find(b => b.media_url)?.media_url;
          const audience = accessByStory[story.id] || 'public';

          return (
            <motion.div
              key={story.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-neutral-900 rounded-2xl overflow-hidden border border-white/10 lg:rounded-[0.8vw] lg:grid lg:grid-cols-[28%_48%_24%] lg:items-stretch"
            >
              {coverImage && (
                <div className="relative h-32 overflow-hidden lg:h-auto lg:min-h-0">
                  <img src={coverImage} alt="" className="w-full h-full object-cover opacity-60" />
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-neutral-900/40" />
                  {isPublished && (
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500 text-white text-xs font-bold shadow-lg lg:top-[5%] lg:right-[5%] lg:px-[4%] lg:py-[1.5%] lg:text-[0.62vw]">
                      <CheckCircle2 className="w-[0.7vw] h-[0.7vw]" />
                      Published
                    </div>
                  )}
                </div>
              )}

              <div className={`p-4 space-y-3 lg:p-[3%] lg:space-y-[3%] ${coverImage ? '' : 'lg:col-span-2'}`}>
                <div>
                  <p className="text-white text-base font-bold truncate lg:text-[0.95vw]">{story.production_name || story.episode_title || 'Untitled Story'}</p>
                  {story.episode_title && story.production_name && (
                    <p className="text-white/50 text-xs truncate mt-0.5 lg:text-[0.66vw]">{story.episode_title}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 lg:gap-[4%] lg:mt-[2%]">
                    <span className="flex items-center gap-1 text-white/60 text-xs lg:text-[0.66vw]">
                      <Film className="w-[0.7vw] h-[0.7vw]" />
                      {readyBlocks} scene{readyBlocks !== 1 ? 's' : ''}
                    </span>
                    {story.category && <span className="text-white/60 text-xs lg:text-[0.66vw]">{story.category}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 lg:gap-[2%]">
                  <button
                    type="button"
                    onClick={() => setAccessByStory(prev => ({ ...prev, [story.id]: 'public' }))}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors lg:py-[2%] lg:text-[0.66vw] lg:rounded-[0.45vw] ${audience === 'public' ? 'bg-white text-black border-white' : 'bg-transparent text-white/70 border-white/20 hover:border-white/40'}`}
                  >Public</button>
                  <button
                    type="button"
                    onClick={() => setAccessByStory(prev => ({ ...prev, [story.id]: 'subscribers' }))}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors lg:py-[2%] lg:text-[0.66vw] lg:rounded-[0.45vw] ${audience === 'subscribers' ? 'bg-red-600 text-white border-red-600' : 'bg-transparent text-white/70 border-white/20 hover:border-white/40'}`}
                  >Subscribers only</button>
                </div>
              </div>

              <div className="p-4 pt-0 flex items-center gap-2 lg:p-[6%] lg:gap-[4%] lg:border-l lg:border-white/10">
                <button
                  onClick={() => handlePublish(story)}
                  disabled={publishingId === story.id}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 lg:py-[5%] lg:text-[0.72vw] lg:rounded-[0.5vw] ${isPublished ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-green-500 text-white hover:bg-green-600'}`}
                >
                  {publishingId === story.id ? <Loader2 className="w-[0.8vw] h-[0.8vw] animate-spin" /> : <Send className="w-[0.8vw] h-[0.8vw]" />}
                  {isPublished ? 'Re-publish' : 'Publish'}
                </button>
                <Link to="/MyProjects" className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/10 text-white hover:bg-white/15 transition-colors flex-shrink-0 lg:w-[18%] lg:aspect-square lg:h-auto lg:rounded-[20%]">
                  <ChevronRight className="w-2/5 h-2/5" />
                </Link>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
