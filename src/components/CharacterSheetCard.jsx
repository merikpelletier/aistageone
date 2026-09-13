import React from 'react';
import { User, Edit2 } from 'lucide-react';

const PHOTO_SLOTS = [
  { key: 'front',    label: 'Front' },
  { key: 'back',     label: 'Back' },
  { key: 'side',     label: 'Side' },
  { key: 'portrait', label: 'Portrait' },
  { key: 'profile',  label: 'Profile' },
];

function parsePhotos(raw) {
  if (!raw || raw.length === 0) return {};
  try { return JSON.parse(raw[0]); } catch { return {}; }
}

export default function CharacterSheetCard({ sheet, isOwnProfile, onEdit }) {
  if (!sheet && !isOwnProfile) return null;

  const photos = parsePhotos(sheet?.character_photos);
  const hasPhotos = Object.keys(photos).length > 0;

  return (
    <div className="bg-black rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div>
          <p className="text-white text-xs uppercase tracking-widest">Character Sheet</p>
          {sheet?.character_name && (
            <h3 className="text-white text-lg font-light tracking-wide mt-0.5">{sheet.character_name}</h3>
          )}
        </div>
        {isOwnProfile && (
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-colors"
          >
            <Edit2 size={12} />
            {sheet ? 'Edit' : 'Create'}
          </button>
        )}
      </div>

      {!sheet ? (
        <div className="px-5 py-8 text-center">
          <User size={32} className="text-white/20 mx-auto mb-3" />
          <p className="text-white text-sm">No character sheet yet.</p>
          {isOwnProfile && (
            <button onClick={onEdit} className="mt-4 text-red-400 text-xs underline">Create your character sheet →</button>
          )}
        </div>
      ) : (
        <div className="px-5 py-5 space-y-4">
          {/* Generated sheet */}
          {sheet.voice_sample_url && (
            <div className="rounded-xl overflow-hidden">
              <img src={sheet.voice_sample_url} alt="Character sheet" className="w-full object-contain" />
            </div>
          )}
          {hasPhotos ? (
            <div className="grid grid-cols-5 gap-1.5">
              {PHOTO_SLOTS.map(({ key, label }) => (
                <div key={key} className="flex flex-col gap-1">
                  {photos[key] ? (
                    <div className="aspect-[2/3] rounded-lg overflow-hidden bg-white/5">
                      <img src={photos[key]} alt={label} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="aspect-[2/3] rounded-lg bg-white/5 border border-dashed border-white/10" />
                  )}
                  <span className="text-white text-[9px] text-center uppercase tracking-wide">{label}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-white text-sm">No reference photos yet.</p>
              {isOwnProfile && (
                <button onClick={onEdit} className="mt-2 text-red-400 text-xs underline">Add photos →</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}