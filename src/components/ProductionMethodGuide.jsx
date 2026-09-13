import React from 'react';
import { Film, Mic, Video, Music, Upload, Users, Wand2, X, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

const METHOD_GUIDES = {
  actor_replacement: {
    title: 'Replace the Actor',
    subtitle: 'Step into the role with your full appearance.',
    description: 'The original actor is replaced as a whole, not only the face. This allows the result to respect skin tone, body type, height, proportions, and overall likeness.',
    icon: Users,
    color: 'bg-red-600',
    tool: 'Video Generation',
    toolIcon: Film,
    toolDescription: 'Use Video Generation to create your scene with actor replacement',
    requiredMedia: [
      'Front portrait photo',
      'Full-body reference photo',
      'Optional additional references'
    ],
    steps: [
      'Upload your reference photos in the Character section',
      'Select your character from the kit or upload your own photo',
      'Use Video Generation tool to create the scene',
      'The AI will replace the actor with your likeness'
    ]
  },
  performance: {
    title: 'Performance Mode',
    subtitle: 'Use your body movement and performance.',
    description: 'Your physical performance drives the scene. Upload a video of yourself performing the action, and the AI will apply it to the character.',
    icon: Users,
    color: 'bg-amber-600',
    tool: 'Animate with Reference',
    toolIcon: Video,
    toolDescription: 'Use Animate with Reference to apply your performance',
    requiredMedia: [
      'Reference video of your performance',
      'Character reference photo (optional)'
    ],
    steps: [
      'Record yourself performing the action',
      'Upload the video in the Reference Video section',
      'Use Animate with Reference tool',
      'The AI will apply your movement to the character'
    ]
  },
  voice_only: {
    title: 'Voice Only',
    subtitle: 'Contribute with your voice.',
    description: 'Record or upload your voice for the character. Perfect for dubbing, narration, or dialogue scenes.',
    icon: Mic,
    color: 'bg-blue-600',
    tool: 'Voice Recorder',
    toolIcon: Mic,
    toolDescription: 'Use Voice Recorder to capture your performance',
    requiredMedia: [
      'Your voice recording',
      'Script or dialogue (optional)'
    ],
    steps: [
      'Click on Voice Recorder',
      'Record your dialogue or upload an audio file',
      'The audio will be attached to the scene'
    ]
  }
};

export default function ProductionMethodGuide({ productionMethod, block, character, onClose, onContinue }) {
  const guide = METHOD_GUIDES[productionMethod];
  
  if (!guide) return null;
  
  const Icon = guide.icon;
  const ToolIcon = guide.toolIcon;
  
  // Get reference media from block
  const referenceMedia = block?.reference_media || [];
  const hasDialogue = !!block?.dialogue;
  
  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] rounded-3xl max-w-lg w-full overflow-hidden border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 ${guide.color} rounded-2xl flex items-center justify-center`}>
              <Icon size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-white text-xl font-bold">{guide.title}</h2>
              <p className="text-white text-sm">{guide.subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white hover:text-white">
            <X size={24} />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Description */}
          <p className="text-white text-sm leading-relaxed">{guide.description}</p>
          
          {/* Scene Details */}
          {(block?.title || block?.description || character || hasDialogue) && (
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-3">
              <div className="flex items-center gap-2">
                <Film size={16} className="text-white" />
                <p className="text-white font-semibold text-sm">Scene Details</p>
              </div>
              
              {block?.title && (
                <div>
                  <p className="text-white text-[10px] uppercase tracking-wider mb-1">Title</p>
                  <p className="text-white text-sm font-medium">{block.title}</p>
                </div>
              )}
              
              {block?.description && (
                <div>
                  <p className="text-white text-[10px] uppercase tracking-wider mb-1">Description</p>
                  <p className="text-white text-sm">{block.description}</p>
                </div>
              )}
              
              {character && (
                <div>
                  <p className="text-white text-[10px] uppercase tracking-wider mb-1">Character</p>
                  <div className="flex items-center gap-2">
                    {character.photo_url && (
                      <img src={character.photo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                    )}
                    <div>
                      <p className="text-white text-sm font-medium">{character.name}</p>
                      {character.character_type && (
                        <p className="text-white text-xs">{character.character_type}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {hasDialogue && (
                <div>
                  <p className="text-white text-[10px] uppercase tracking-wider mb-1">Dialogue</p>
                  <div className="flex items-start gap-2 bg-black/30 rounded-lg p-3">
                    <MessageSquare size={14} className="text-white flex-shrink-0 mt-0.5" />
                    <p className="text-white text-sm italic">"{block.dialogue}"</p>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Reference Media */}
          {referenceMedia.length > 0 && (
            <div>
              <p className="text-white text-[10px] uppercase tracking-wider mb-3">Reference Media</p>
              <div className="grid grid-cols-3 gap-2">
                {referenceMedia.slice(0, 6).map((url, i) => (
                  <div key={i} className="aspect-square rounded-lg overflow-hidden bg-black/30">
                    {url.match(/\.(mp4|webm|ogg|mov)$/i) ? (
                      <video src={url} className="w-full h-full object-cover" muted />
                    ) : (
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Tool Info */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <ToolIcon size={20} className="text-white" />
              <p className="text-white font-semibold text-sm">Recommended Tool</p>
            </div>
            <p className="text-white text-sm">{guide.toolDescription}</p>
          </div>
          
          {/* Required Media */}
          <div>
            <p className="text-white text-xs uppercase tracking-wider mb-3">Required Media</p>
            <ul className="space-y-2">
              {guide.requiredMedia.map((media, i) => (
                <li key={i} className="flex items-center gap-2 text-white text-sm">
                  <span className="w-1 h-1 bg-white/40 rounded-full" />
                  {media}
                </li>
              ))}
            </ul>
          </div>
          
          {/* Steps */}
          <div>
            <p className="text-white text-xs uppercase tracking-wider mb-3">How to Use</p>
            <ol className="space-y-2">
              {guide.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-white text-sm">
                  <span className={`w-5 h-5 ${guide.color} rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white`}>
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
        
        {/* Action Button */}
        <div className="p-6 border-t border-white/10">
          <Button
            onClick={onContinue}
            className={`w-full ${guide.color} hover:opacity-90 text-white py-4 text-sm font-semibold`}
          >
            Continue to Studio →
          </Button>
        </div>
      </div>
    </div>
  );
}