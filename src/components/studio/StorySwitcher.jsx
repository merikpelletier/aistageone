import React, { useState } from 'react';
import { Users, Sparkles, ChevronDown, ChevronUp, Check, RefreshCw } from 'lucide-react';

export default function StorySwitcher({
  theme,
  characters,
  topics,
  currentHeroId,
  currentTopicId,
  onSwitch,
  userId,
}) {
  const [open, setOpen] = useState(false);

  const linkedCharIds = theme?.story_character_ids || [];
  const linkedChars = characters.filter(c => linkedCharIds.includes(c.id) || (userId && c.created_by_id === userId));
  const themeTopics = topics.filter(tp => tp.theme_id === theme?.id);

  // Commit immediately on tap — the checkmark is the source of truth, no separate Apply step.
  const pickHero = (charId) => {
    if (charId === currentHeroId) return;
    onSwitch({ hero_character_id: charId, starting_topic_id: currentTopicId });
  };
  const pickTopic = (topicId) => {
    if (topicId === currentTopicId) return;
    onSwitch({ hero_character_id: currentHeroId, starting_topic_id: topicId });
  };

  if (linkedChars.length === 0 && themeTopics.length === 0) return null;

  return (
    <div className="bg-black rounded-2xl p-3 mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2"
      >
        <RefreshCw size={14} className="text-yellow-400" />
        <p className="text-yellow-400 text-xs uppercase tracking-wider font-bold flex-1 text-left">
          Switch Hero & Storyline
        </p>
        <span className="text-black text-[10px] font-bold bg-yellow-400 px-2 py-0.5 rounded-full">
          Next Chapter
        </span>
        {open ? <ChevronUp size={16} className="text-yellow-400" /> : <ChevronDown size={16} className="text-yellow-400" />}
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {/* Character picker */}
          {linkedChars.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Users size={12} className="text-yellow-400" />
                <p className="text-yellow-400 text-[11px] uppercase tracking-wider font-bold">Hero</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {linkedChars.map(char => {
                  const active = currentHeroId === char.id;
                  return (
                    <button
                      key={char.id}
                      onClick={() => pickHero(char.id)}
                      className={`relative rounded-xl overflow-hidden text-left active:scale-[0.97] transition-transform border-2 ${active ? 'border-yellow-400' : 'border-white/10'}`}
                    >
                      <div className="aspect-square bg-yellow-400">
                        {char.photos?.[0] ? (
                          <img src={char.photos[0]} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Users size={18} className="text-black" />
                          </div>
                        )}
                      </div>
                      <div className="absolute bottom-0 inset-x-0 bg-black/80 px-1.5 py-1">
                        <p className="text-white text-[10px] font-bold truncate">{char.name}</p>
                      </div>
                      {active && (
                        <div className="absolute top-1 right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center">
                          <Check size={11} className="text-black" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Topic / storyline picker */}
          {themeTopics.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={12} className="text-yellow-400" />
                <p className="text-yellow-400 text-[11px] uppercase tracking-wider font-bold">Storyline</p>
              </div>
              <div className="space-y-2">
                {themeTopics.map(topic => {
                  const active = currentTopicId === topic.id;
                  return (
                    <button
                      key={topic.id}
                      onClick={() => pickTopic(topic.id)}
                      className={`w-full text-left rounded-xl p-2.5 border-2 active:scale-[0.98] transition-transform ${active ? 'border-yellow-400 bg-yellow-400/10' : 'border-white/10 bg-white/5'}`}
                    >
                      <p className="text-yellow-400 text-xs font-bold truncate">{topic.title}</p>
                      <p className="text-white/70 text-[10px] mt-0.5 line-clamp-2">{topic.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-white/60 text-[10px] font-medium text-center">
            Tap to switch — the next chapter continues from here with the new hero & storyline.
          </p>
        </div>
      )}
    </div>
  );
}