import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const ACCENTS = {
  sponsor: 'bg-yellow-400',
  contact: 'bg-red-600',
  links: 'bg-blue-600',
  series: 'bg-purple-600',
  work: 'bg-green-500',
  presentation: 'bg-white',
  gallery: 'bg-orange-500',
  fans: 'bg-pink-500',
};

export default function CollapsibleSection({ label, accent = 'sponsor', defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const accentClass = ACCENTS[accent] || 'bg-white';

  return (
    <div className="mb-2 break-inside-avoid">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 py-2"
      >
        <span className={`w-1 h-4 ${accentClass} rounded-full`} />
        <h3 className="text-white text-sm font-bold flex-1 text-left uppercase tracking-wide">{label}</h3>
        <ChevronDown
          size={16}
          className={`text-white/60 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="pb-2">{children}</div>}
    </div>
  );
}