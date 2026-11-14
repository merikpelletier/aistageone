import React from 'react';
import { useStudioTranslation } from '@/lib/useStudioTranslation';
import { X, User, Mic, Activity } from 'lucide-react';

export default function ProductionMethodSelector({ onSelect, onCancel }) {
  const tr = useStudioTranslation();
  return (
    <div className="fixed inset-0 bg-black/90 z-[250] flex items-center justify-center p-4">
      <div className="bg-[#111111] border border-[#333333] rounded-3xl p-6 max-w-md w-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-white text-xl font-bold mb-1">{tr("timeline.choose_your_production_method","Choose Your Production Method")}</h2>
            <p className="text-[#A0A0A0] text-sm">{tr("timeline.select_how_you_want_to_create_this_scene","Select how you want to create this scene")}</p>
          </div>
          <button onClick={onCancel} className="text-[#A0A0A0] hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        
        {/* Options */}
        <div className="space-y-3 mb-4">
          <button
            onClick={() => onSelect('actor_replacement')}
            className="w-full text-left p-4 rounded-xl border border-[#333333] hover:border-white/40 hover:bg-white/5 transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <User className="text-blue-400" size={16} />
              </div>
              <p className="text-white font-semibold">{tr("timeline.actor_replacement","Actor Replacement")}</p>
            </div>
            <p className="text-[#A0A0A0] text-xs ml-11">{tr("timeline.replace_the_actor_with_your_likeness","Replace the actor with your likeness")}</p>
          </button>
          
          <button
            onClick={() => onSelect('performance')}
            className="w-full text-left p-4 rounded-xl border border-[#333333] hover:border-white/40 hover:bg-white/5 transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                <Activity className="text-red-400" size={16} />
              </div>
              <p className="text-white font-semibold">{tr("timeline.performance_mode","Performance Mode")}</p>
            </div>
            <p className="text-[#A0A0A0] text-xs ml-11">{tr("timeline.use_your_own_movement_and_voice","Use your own movement and voice")}</p>
          </button>
          
          <button
            onClick={() => onSelect('voice_only')}
            className="w-full text-left p-4 rounded-xl border border-[#333333] hover:border-white/40 hover:bg-white/5 transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Mic className="text-amber-400" size={16} />
              </div>
              <p className="text-white font-semibold">{tr("timeline.voice_only","Voice Only")}</p>
            </div>
            <p className="text-[#A0A0A0] text-xs ml-11">{tr("timeline.just_provide_voice_for_the_character","Just provide voice for the character")}</p>
          </button>
        </div>
        
        {/* Cancel */}
        <button
          onClick={onCancel}
          className="w-full py-3 text-[#A0A0A0] hover:text-white text-sm transition-colors"
        >
          {tr("timeline.cancel","Cancel")}
        </button>
      </div>
    </div>
  );
}