import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Simplified version - just a link to Studio for production
// method: 'body_and_voice' | 'faceswitch' | 'voice_only'
// block: the timeline block (has reference_media)
// override: existing override object or null
// onDone(file_url): called when a result is ready

export default function BlockVersionUploader({ method, block, override, characterPhotoUrl, onDone }) {
  const navigate = useNavigate();
  
  const handleOpenInStudio = () => {
    const params = new URLSearchParams({
      mode: 'production',
      dossier_id: block.dossier_id || '',
      kit_page_id: block.kit_page_id || '',
      block_id: block.id,
      block_type: block.block_type,
    });
    navigate(`/Studio?${params.toString()}`);
  };

  // Show existing version if uploaded
  if (override?.user_media_url) {
    return (
      <div className="space-y-4">
        <div className="relative rounded-xl overflow-hidden">
          {override.user_media_url.match(/\.(mp4|webm|ogg|mov)$/i)
            ? <video src={override.user_media_url} controls className="w-full rounded-xl" />
            : override.user_media_url.match(/\.(mp3|wav|m4a|ogg|aac)$/i)
            ? <audio src={override.user_media_url} controls className="w-full" />
            : <img src={override.user_media_url} alt="" className="w-full rounded-xl object-contain max-h-64" />
          }
          <span className="absolute top-2 right-2 px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">Your version</span>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
          <p className="text-white text-sm mb-3">Want to improve or replace your version?</p>
          <Button
            onClick={handleOpenInStudio}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            <FlaskConical size={16} className="mr-2" />
            Open in Studio
            <ExternalLink size={14} className="ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  // No version yet - show prompt to open Studio
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center space-y-4">
      <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto">
        <FlaskConical size={32} className="text-red-400" />
      </div>
      <div>
        <p className="text-white text-sm font-medium mb-1">Produce in Studio</p>
        <p className="text-white text-xs">Use professional tools for dubbing, animation, and more</p>
      </div>
      <Button
        onClick={handleOpenInStudio}
        className="w-full bg-red-600 hover:bg-red-700 text-white"
      >
        <FlaskConical size={16} className="mr-2" />
        Open Studio
        <ExternalLink size={14} className="ml-2" />
      </Button>
    </div>
  );
}