import React from 'react';

export default function ProfileGallery({ profile }) {
  if (!profile?.images || profile.images.length === 0) return null;

  return (
    <div className="py-2">
      <div className="grid grid-cols-3 gap-2">
        {profile.images.map((img, idx) => (
          <div key={idx} className="relative aspect-[3/4] overflow-hidden rounded-md">
            <img src={img} alt={`gallery-${idx}`} className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}