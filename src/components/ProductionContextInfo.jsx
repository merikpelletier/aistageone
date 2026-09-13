import React from 'react';
import { Film, Users, Mic, Clapperboard, X } from 'lucide-react';

const methodConfig = {
  actor_replacement: {
    title: 'Actor Replacement',
    icon: Users,
    color: 'bg-red-500',
    description: 'Replace an actor in existing footage using AI',
  },
  performance: {
    title: 'Performance Mode',
    icon: Film,
    color: 'bg-purple-500',
    description: 'Full performance capture with voice and movement',
  },
  voice_only: {
    title: 'Voice Only',
    icon: Mic,
    color: 'bg-blue-500',
    description: 'Record or generate voice without video',
  },
};

export default function ProductionContextInfo({ productionMethod, block, character, referenceMedia, onClose }) {
  const config = methodConfig[productionMethod] || { title: 'Production', icon: Clapperboard, color: 'bg-gray-500', description: '' };
  const Icon = config.icon;

  if (!productionMethod) return null;

  return (
    <div className="mb-6 bg-gradient-to-r from-white/10 to-white/5 border border-white/20 rounded-2xl p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 ${config.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
          <Icon size={20} className="text-black" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="text-white font-bold text-sm">{config.title}</p>
            {onClose && (
              <button onClick={onClose} className="text-white hover:text-white">
                <X size={16} />
              </button>
            )}
          </div>
          <p className="text-white text-xs mt-0.5">{config.description}</p>
        </div>
      </div>

      {/* Scene details */}
      {block && (
        <div className="space-y-2">
          <div className="px-3 py-2 bg-black/30 rounded-xl border border-white/10">
            <p className="text-white text-[10px] uppercase tracking-wider mb-1">Scene</p>
            <p className="text-white text-sm font-semibold">{block.title || 'Untitled'}</p>
            {block.description && (
              <p className="text-white text-xs mt-1">{block.description}</p>
            )}
          </div>

          {/* Character assignment */}
          {character && (
            <div className="px-3 py-2 bg-black/30 rounded-xl border border-white/10 flex items-center gap-2">
              <Users size={12} className="text-white" />
              <div>
                <p className="text-white text-[10px] uppercase tracking-wider">Character</p>
                <p className="text-white text-sm font-semibold">{character.name}</p>
              </div>
            </div>
          )}

          {/* Dialogue */}
          {block.dialogue && (
            <div className="px-3 py-2 bg-black/30 rounded-xl border-l-2 border-red-500/50">
              <div className="flex items-center gap-1.5 mb-1">
                <Mic size={10} className="text-red-400" />
                <span className="text-red-400 text-[10px] font-bold uppercase">Dialogue</span>
              </div>
              <p className="text-white/80 text-xs italic">"{block.dialogue}"</p>
            </div>
          )}
        </div>
      )}

      {/* Reference media */}
      {referenceMedia && referenceMedia.length > 0 && (
        <div className="mt-3">
          <p className="text-white text-[10px] uppercase tracking-wider mb-2">Reference Media</p>
          <div className="flex gap-2 overflow-x-auto">
            {referenceMedia.slice(0, 6).map((url, i) => (
              <div key={i} className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-black/30 border border-white/10">
                {url.match(/\.(mp4|webm|ogg|mov)$/i) ? (
                  <video src={url} className="w-full h-full object-cover" muted playsInline />
                ) : (
                  <img src={url} alt="" className="w-full h-full object-cover" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}