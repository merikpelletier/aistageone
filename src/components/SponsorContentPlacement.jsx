import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ExternalLink } from 'lucide-react';

export default function SponsorContentPlacement({ dossierId }) {
  const { data: sponsors = [] } = useQuery({
    queryKey: ['content-sponsors', dossierId],
    queryFn: () => base44.entities.ProfileSponsor.filter({
      target_content_id: String(dossierId),
      is_active: true,
    }, '-approved_at'),
    enabled: !!dossierId,
  });

  if (!sponsors.length) return null;

  return (
    <div className="absolute left-3 right-3 top-3 z-50 flex flex-col gap-2 pointer-events-auto">
      {sponsors.map((sponsor) => {
        const body = (
          <div className="flex items-center gap-3 border border-white/15 bg-black/85 px-3 py-2 shadow-xl backdrop-blur-sm">
            {sponsor.placement_logo && sponsor.logo_url && (
              <img
                src={sponsor.logo_url}
                alt={sponsor.sponsor_name || 'Sponsor'}
                className="h-9 w-auto max-w-24 object-contain bg-white/5 p-1"
              />
            )}
            <div className="min-w-0 flex-1">
              {sponsor.placement_mention && (
                <p className="text-[10px] uppercase tracking-widest text-white/45">Sponsored by</p>
              )}
              <p className="truncate text-xs font-semibold text-white">{sponsor.sponsor_name}</p>
              {sponsor.placement_promo && sponsor.promo_title && (
                <p className="truncate text-xs text-white/80">{sponsor.promo_title}</p>
              )}
              {sponsor.placement_promo && sponsor.promo_text && (
                <p className="line-clamp-2 text-[11px] text-white/55">{sponsor.promo_text}</p>
              )}
            </div>
            {sponsor.placement_link && sponsor.link && (
              <ExternalLink size={14} className="flex-shrink-0 text-white/70" />
            )}
          </div>
        );

        return sponsor.placement_link && sponsor.link ? (
          <a
            key={sponsor.id}
            href={sponsor.link}
            target="_blank"
            rel="noreferrer sponsored"
            className="block"
            onClick={(e) => e.stopPropagation()}
          >
            {body}
          </a>
        ) : (
          <div key={sponsor.id}>{body}</div>
        );
      })}
    </div>
  );
}
