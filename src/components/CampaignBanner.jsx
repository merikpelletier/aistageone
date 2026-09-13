import React from 'react';
import { Link } from 'react-router-dom';
import { Megaphone } from 'lucide-react';

const BANNER_STYLES = {
  yellow: { bar: 'bg-yellow-400', text: 'text-black' },
  red: { bar: 'bg-red-500', text: 'text-white' },
  blue: { bar: 'bg-blue-500', text: 'text-white' },
  green: { bar: 'bg-green-500', text: 'text-white' },
  purple: { bar: 'bg-purple-500', text: 'text-white' },
  pink: { bar: 'bg-pink-500', text: 'text-white' },
};

export default function CampaignBanner({ campaign }) {
  if (!campaign || campaign.status !== 'active') return null;

  const style = BANNER_STYLES[campaign.banner_color] || BANNER_STYLES.yellow;

  return (
    <Link
      to={`/CampaignSubscribe?campaign=${campaign.id}`}
      onClick={e => e.stopPropagation()}
      className="absolute top-0 left-0 right-0 z-20 flex items-center gap-1.5 px-2 py-1 overflow-hidden"
      style={{ background: 'transparent' }}
    >
      <div className={`flex items-center gap-1 ${style.bar} ${style.text} px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide shadow-lg max-w-full`}>
        <Megaphone size={10} className="flex-shrink-0" />
        <span className="truncate">{campaign.title}</span>
        {campaign.subscription_fee > 0 && <span className="flex-shrink-0">· ${campaign.subscription_fee}</span>}
      </div>
    </Link>
  );
}