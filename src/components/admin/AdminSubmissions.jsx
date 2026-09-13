import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, AlertCircle, CreditCard } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_COLORS = {
  pending_review: 'bg-yellow-100 text-yellow-800',
  published: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  unpublished: 'bg-gray-100 text-white',
};

const TYPE_COLORS = {
  publisher: 'bg-black text-white',
  influencer: 'bg-red-600 text-white',
  brand: 'bg-yellow-600 text-white',
};

export default function AdminSubmissions() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState('pending_review');
  const [rejectReason, setRejectReason] = useState({});

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['submissions', filter],
    queryFn: () => {
      if (filter === 'all') {
        return base44.entities.Dossier.filter({ submitted_by_email: { $exists: true } }, '-submitted_at');
      }
      return base44.entities.Dossier.filter({
        submitted_by_email: { $exists: true },
        status: filter,
      }, '-submitted_at');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Dossier.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['submissions'] }),
  });

  const approve = (s) => {
    const now = new Date();
    const publishUntil = new Date(now);
    publishUntil.setDate(publishUntil.getDate() + (s.duration_days || 7));

    updateMutation.mutate({
      id: s.id,
      data: {
        status: 'published',
        approved_at: now.toISOString(),
        publish_until: publishUntil.toISOString(),
        order: Date.now(),
      },
    });
  };

  const reject = (s) => {
    updateMutation.mutate({
      id: s.id,
      data: {
        status: 'rejected',
        rejection_reason: rejectReason[s.id] || '',
      },
    });
  };

  const confirmPayment = (s) => {
    updateMutation.mutate({
      id: s.id,
      data: { payment_confirmed: true },
    });
  };

  const pendingCount = submissions.filter(s => s.status === 'pending_review').length;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'pending_review', label: 'PENDING' },
          { key: 'published', label: 'PUBLISHED' },
          { key: 'rejected', label: 'REJECTED' },
          { key: 'unpublished', label: 'EXPIRED' },
          { key: 'all', label: 'ALL' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 text-xs tracking-widest rounded-full border transition-colors ${
              filter === f.key ? 'bg-white text-black border-white' : 'border-white/20 text-white hover:border-white/40 hover:text-white'
            }`}
          >
            {f.label}
            {f.key === 'pending_review' && pendingCount > 0 && (
              <span className="ml-1.5 bg-yellow-400 text-black text-xs rounded-full px-1.5 py-0.5 font-bold">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-center text-white py-8 text-sm">Loading...</p>}
      {!isLoading && submissions.length === 0 && (
        <p className="text-center text-white py-8 text-sm">No submissions.</p>
      )}

      {submissions.map(s => (
        <div key={s.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === s.id ? null : s.id)}
            className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors"
          >
            {/* Cover */}
            {s.cover_image && (
              <img src={s.cover_image} alt="" className="w-12 h-16 object-cover rounded-lg shrink-0" />
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[s.membership_type] || 'bg-white/10 text-white'}`}>
                  {s.membership_type || '—'}
                </span>
                {s.requires_payment && !s.payment_confirmed && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-400 border border-yellow-400/30 flex items-center gap-1">
                    <CreditCard size={10} /> Fees
                  </span>
                )}
                {s.requires_payment && s.payment_confirmed && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-400/20 text-green-400">
                    ✓ Paid
                  </span>
                )}
              </div>
              <p className="text-white text-sm font-medium truncate">{s.title}</p>
              <p className="text-white text-xs">{s.submitted_by_name || s.submitted_by_email}</p>
              {s.submitted_at && (
                <p className="text-white/20 text-xs">
                  Submitted {format(new Date(s.submitted_at), 'd MMM yyyy')} · {s.duration_days || '?'} day{s.duration_days > 1 ? 's' : ''}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[s.status] || 'bg-white/10 text-white'}`}>
                {s.status?.replace('_', ' ')}
              </span>
              {expanded === s.id ? <ChevronUp size={16} className="text-white" /> : <ChevronDown size={16} className="text-white" />}
            </div>
          </button>

          {expanded === s.id && (
            <div className="px-4 pb-4 border-t border-white/10 pt-4 space-y-4">
              {s.description && (
                <div>
                  <p className="text-white text-xs tracking-widest mb-1">PITCH</p>
                  <p className="text-white/80 text-sm">{s.description}</p>
                </div>
              )}

              {s.subtitle && (
                <div>
                  <p className="text-white text-xs tracking-widest mb-1">SUBTITLE</p>
                  <p className="text-white/80 text-sm">{s.subtitle}</p>
                </div>
              )}

              {s.publish_until && (
                <div>
                  <p className="text-white text-xs tracking-widest mb-1">EXPIRES ON</p>
                  <p className="text-white text-sm">{format(new Date(s.publish_until), "d MMMM yyyy 'at' HH:mm")}</p>
                </div>
              )}

              {/* Payment confirm for brand */}
              {s.requires_payment && !s.payment_confirmed && (
                <div className="flex gap-3 p-3 bg-yellow-400/10 border border-yellow-400/20 rounded-lg">
                  <AlertCircle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-yellow-400 text-sm">Brand fees to confirm</p>
                    <p className="text-yellow-400/50 text-xs">Confirm payment before approving.</p>
                  </div>
                  <button
                    onClick={() => confirmPayment(s)}
                    className="px-3 py-1.5 bg-yellow-400 text-black text-xs rounded-lg font-medium hover:bg-yellow-300"
                  >
                    Confirm
                  </button>
                </div>
              )}

              {/* Actions */}
              {s.status === 'pending_review' && (
                <div className="space-y-3">
                  <div>
                    <p className="text-white text-xs tracking-widest mb-1">REJECTION REASON (if refused)</p>
                    <textarea
                      value={rejectReason[s.id] || ''}
                      onChange={e => setRejectReason({ ...rejectReason, [s.id]: e.target.value })}
                      rows={2}
                      placeholder="Optional — visible to the member"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-white/30 resize-none placeholder-white/20"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => approve(s)}
                      disabled={s.requires_payment && !s.payment_confirmed}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <CheckCircle size={16} /> Approve
                    </button>
                    <button
                      onClick={() => reject(s)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <XCircle size={16} /> Reject
                    </button>
                  </div>
                </div>
              )}

              {s.status !== 'pending_review' && (
                <button
                  onClick={() => updateMutation.mutate({ id: s.id, data: { status: 'pending_review' } })}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/5 text-white text-sm rounded-lg hover:bg-white/10 transition-colors"
                >
                  <Clock size={16} /> Put back to pending
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}