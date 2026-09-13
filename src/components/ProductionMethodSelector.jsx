import React from 'react';
import { X } from 'lucide-react';

export default function ProductionMethodSelector({ onSelect, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4">
      <div className="bg-black border border-white/20 rounded-3xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-xl font-bold">Choose Your Production Method</h2>
          <button onClick={onCancel} className="text-white hover:text-white">
            <X size={20} />
          </button>
        </div>
        <p className="text-white text-sm mb-6">Select how you want to create this scene</p>
        
        <div className="space-y-3">
          <button
            onClick={() => onSelect('actor_replacement')}
            className="w-full text-left p-4 rounded-xl border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all"
          >
            <p className="text-white font-semibold mb-1">Actor Replacement</p>
            <p className="text-white text-xs">Replace the actor with your likeness</p>
          </button>
          
          <button
            onClick={() => onSelect('performance')}
            className="w-full text-left p-4 rounded-xl border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all"
          >
            <p className="text-white font-semibold mb-1">Performance Mode</p>
            <p className="text-white text-xs">Use your own movement and voice</p>
          </button>
          
          <button
            onClick={() => onSelect('voice_only')}
            className="w-full text-left p-4 rounded-xl border border-white/20 hover:border-white/40 hover:bg-white/5 transition-all"
          >
            <p className="text-white font-semibold mb-1">Voice Only</p>
            <p className="text-white text-xs">Just provide voice for the character</p>
          </button>
        </div>
        
        <button
          onClick={onCancel}
          className="w-full mt-4 py-3 text-white hover:text-white text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}