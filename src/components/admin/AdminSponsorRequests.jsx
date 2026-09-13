import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { format, addDays, addWeeks, addMonths } from 'date-fns';

const computeEndDate = (start, durationStr) => {
  if (!durationStr) return null;
  const s = durationStr.toLowerCase();
  if (s.includes('week')) { const n = parseInt(s) || 1; return addWeeks(start, n); }
  if (s.includes('month')) { const n = parseInt(s) || 1; return addMonths(start, n); }
  if (s.includes('day')) { const n = parseInt(s) || 7; return addDays(start, n); }
  return addDays(start, 30);
};

const STATUS_COLORS = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  approved: 'bg-green-500/20 text-green-400',
  active: 'bg-blue-500/20 text-blue-400',
  rejected: 'bg-red-500/20 text-red-400',
  expired: 'bg-white/10 text-white',
};

export default function AdminSponsorRequests() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [notes, setNotes] = useState({});

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['sponsor-requests', filter],
    queryFn: () =>
      filter === 'all'
        ? base44.entities.ProfileSponsor.list('-submitted_at')
        : base44.entities.ProfileSponsor.filter({ status: filter }, '-submitted_at'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProfileSponsor.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sponsor-requests'] });
      qc.invalidateQueries({ queryKey: ['admin-sponsors'] });
    },
  });

  const approve = (r) => {
    const startDate = new Date();
    const endDate = computeEndDate(startDate, r.bracket_duration);
    updateMutation.mutate({
      id: r.id,
      data: {
        status: 'approved',
        is_active: true,
        approved_at: startDate.toISOString(),
        start_date: startDate.toISOString(),
        end_date: endDate ? endDate.toISOString() : null,
        admin_notes: notes[r.id] ?? r.admin_notes ?? '',
      },
    });
  };

  const reject = (r) => updateMutation.mutate({
    id: r.id,
    data: { status: 'rejected', is_active: false, admin_notes: notes[r.id] ?? r.admin_notes ?? '' },
  });

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {['pending', 'approved', 'active', 'rejected', 'expired', 'all'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              filter === f ? 'bg-white text-black border-white' : 'border-white/20 text-white hover:border-white/40 hover:text-white'
            }`}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-white text-sm text-center py-8">Loading...</p>}
      {!isLoading && requests.length === 0 && (
        <p className="text-white text-sm text-center py-8">No {filter} requests.</p>
      )}

      <div className="space-y-3">
        {requests.map(r => (
          <div key={r.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            {/* Header row */}
            <button
              onClick={() => setExpanded(expanded === r.id ? null : r.id)}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors"
            >
              {r.image_url && (
                <img src={r.image_url} alt="banner" className="w-16 h-10 object-contain rounded bg-white/10 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{r.sponsor_name || r.sponsor_email}</p>
                <p className="text-white text-xs truncate">→ {r.member_email}</p>
                {r.bracket_name && (
                  <p className="text-white text-xs">{r.bracket_name} · ${r.bracket_price}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${STATUS_COLORS[r.status] || 'bg-white/10 text-white'}`}>
                  {r.status || 'pending'}
                </span>
                {expanded === r.id ? <ChevronUp size={14} className="text-white" /> : <ChevronDown size={14} className="text-white" />}
              </div>
            </button>

            {/* Expanded detail */}
            {expanded === r.id && (
              <div className="border-t border-white/10 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-white mb-0.5">Sponsor</p>
                    <p className="text-white">{r.sponsor_name}</p>
                    <p className="text-white">{r.sponsor_email}</p>
                  </div>
                  <div>
                    <p className="text-white mb-0.5">Package</p>
                    <p className="text-white">{r.bracket_name || '—'}</p>
                    <p className="text-white">{r.bracket_duration} · ${r.bracket_price}</p>
                  </div>
                  <div>
                    <p className="text-white mb-0.5">Target profile</p>
                    <p className="text-white">{r.member_email}</p>
                  </div>
                  <div>
                    <p className="text-white mb-0.5">Submitted</p>
                    <p className="text-white">{r.submitted_at ? format(new Date(r.submitted_at), 'MMM d, yyyy') : '—'}</p>
                  </div>
                  <div>
                    <p className="text-white mb-0.5">Platform share (30%)</p>
                    <p className="text-white">${r.platform_share?.toFixed(2) ?? (r.bracket_price * 0.30).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-white mb-0.5">Member share (70%)</p>
                    <p className="text-white">${r.member_share?.toFixed(2) ?? (r.bracket_price * 0.70).toFixed(2)}</p>
                  </div>
                  {r.start_date && (
                    <div>
                      <p className="text-white mb-0.5">Start date</p>
                      <p className="text-white">{format(new Date(r.start_date), 'MMM d, yyyy')}</p>
                    </div>
                  )}
                  {r.end_date && (
                    <div>
                      <p className="text-white mb-0.5">End date</p>
                      <p className="text-white">{format(new Date(r.end_date), 'MMM d, yyyy')}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-white mb-0.5">Terms accepted</p>
                    <p className={r.terms_accepted ? 'text-green-400' : 'text-red-400'}>{r.terms_accepted ? 'Yes' : 'No'}</p>
                  </div>
                </div>

                {/* Banner preview */}
                {r.image_url && (
                  <div>
                    <p className="text-white text-xs mb-1">Banner preview</p>
                    <img src={r.image_url} alt="banner" className="w-full h-20 object-contain rounded bg-white/5 border border-white/10" />
                  </div>
                )}

                {/* Destination link */}
                {r.link && (
                  <a href={r.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-white hover:text-white transition-colors">
                    <ExternalLink size={11} /> {r.link}
                  </a>
                )}

                {/* Admin notes */}
                <div>
                  <p className="text-white text-xs mb-1">Admin notes</p>
                  <textarea
                    value={notes[r.id] ?? (r.admin_notes || '')}
                    onChange={e => setNotes({ ...notes, [r.id]: e.target.value })}
                    rows={2}
                    placeholder="Internal notes..."
                    className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-xs placeholder-white/20 focus:outline-none focus:border-white/30 resize-none"
                  />
                </div>

                {/* Actions */}
                {(r.status === 'pending' || !r.status) && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => approve(r)}
                      disabled={updateMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle size={14} /> Approve & Activate
                    </button>
                    <button
                      onClick={() => reject(r)}
                      disabled={updateMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                )}
                {(r.status === 'approved' || r.status === 'active') && (
                  <button
                    onClick={() => reject(r)}
                    className="w-full py-2 text-xs text-red-400/70 hover:text-red-400 transition-colors border border-red-400/20 rounded-lg"
                  >
                    Revoke & Deactivate
                  </button>
                )}
                {(r.status === 'rejected' || r.status === 'expired') && (
                  <button
                    onClick={() => approve(r)}
                    className="w-full py-2 text-xs text-green-400/70 hover:text-green-400 transition-colors border border-green-400/20 rounded-lg"
                  >
                    Approve & Activate
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}