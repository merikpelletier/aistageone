import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, Settings, Users, Star, X, DollarSign } from 'lucide-react';
import MembershipSettings from './MembershipSettings';
import AdminSponsors from './AdminSponsors';
import AdminMembershipPricing from './AdminMembershipPricing';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const TYPE_COLOR_OPTIONS = [
  'bg-black text-white',
  'bg-red-600 text-white',
  'bg-yellow-600 text-white',
  'bg-blue-600 text-white',
  'bg-green-600 text-white',
  'bg-purple-600 text-white',
  'bg-pink-600 text-white',
  'bg-indigo-600 text-white',
];

const getTypeColor = (type) => {
  const index = type.length % TYPE_COLOR_OPTIONS.length;
  return TYPE_COLOR_OPTIONS[index];
};

export default function AdminMemberships() {
  const qc = useQueryClient();
  const [view, setView] = useState('settings'); // 'settings' | 'requests' | 'sponsors' | 'pricing'
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [adminNotes, setAdminNotes] = useState({});
  const [showPreview, setShowPreview] = useState(false);

  const { data: memberships = [], isLoading } = useQuery({
    queryKey: ['memberships', filter],
    queryFn: () => filter === 'all'
      ? base44.entities.Membership.list('-created_date')
      : base44.entities.Membership.filter({ status: filter }, '-created_date'),
    enabled: view === 'requests',
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Membership.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['memberships'] }),
  });

  const approve = (m) => updateMutation.mutate({
    id: m.id,
    data: { status: 'approved', approved_at: new Date().toISOString(), admin_notes: adminNotes[m.id] || m.admin_notes }
  });

  const reject = (m) => updateMutation.mutate({
    id: m.id,
    data: { status: 'rejected', admin_notes: adminNotes[m.id] || m.admin_notes }
  });

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex gap-2 border-b border-white/10 pb-3">
        <button
          onClick={() => setView('settings')}
          className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
            view === 'settings' ? 'bg-white text-black font-medium' : 'text-white hover:text-white hover:bg-white/10'
          }`}
        >
          <Settings size={15} />
          Texts & Settings
        </button>
        <button
          onClick={() => setView('requests')}
          className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
            view === 'requests' ? 'bg-white text-black font-medium' : 'text-white hover:text-white hover:bg-white/10'
          }`}
        >
          <Users size={15} />
          Requests
        </button>
        <button
          onClick={() => setView('sponsors')}
          className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
            view === 'sponsors' ? 'bg-white text-black font-medium' : 'text-white hover:text-white hover:bg-white/10'
          }`}
        >
          <Star size={15} />
          Sponsors
        </button>
        <button
          onClick={() => setView('pricing')}
          className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
            view === 'pricing' ? 'bg-white text-black font-medium' : 'text-white hover:text-white hover:bg-white/10'
          }`}
        >
          <DollarSign size={15} />
          Pricing
        </button>
      </div>

      {/* Settings view */}
      {view === 'settings' && <MembershipSettings />}

      {/* Sponsors view */}
      {view === 'sponsors' && <AdminSponsors />}

      {/* Pricing view */}
      {view === 'pricing' && <AdminMembershipPricing />}

      {/* Requests view */}
      {view === 'requests' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap items-center">
            <button
              onClick={() => setShowPreview(true)}
              className="px-4 py-1.5 text-xs tracking-widest rounded-full bg-green-600 text-white border border-green-600 hover:bg-green-700 transition-colors font-medium"
            >
              👁 Preview Confirmation Message
            </button>
          </div>

          {/* Preview Modal */}
          {showPreview && (
            <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
              <div className="bg-white rounded-2xl max-w-md w-full p-8 relative" onClick={e => e.stopPropagation()}>
                <button onClick={() => setShowPreview(false)} className="absolute top-4 right-4 text-white hover:text-white">
                  <X size={20} />
                </button>
                <CheckCircle size={80} className="text-green-700 mx-auto mb-6" strokeWidth={1.5} />
                <h2 className="text-3xl font-bold text-black mb-3 text-center">Application Submitted</h2>
                <p className="text-white text-lg mb-8 text-center leading-relaxed">Thank you for your application. We'll review it and get back to you by email within 3-5 business days.</p>

                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-sm font-semibold text-black uppercase tracking-wider mb-3">What happens next</h3>
                  <div className="space-y-2 text-left">
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-700 mt-1.5 flex-shrink-0" />
                      <p className="text-white text-sm">Our team reviews your application</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-700 mt-1.5 flex-shrink-0" />
                      <p className="text-white text-sm">You'll receive an email with our decision</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-700 mt-1.5 flex-shrink-0" />
                      <p className="text-white text-sm">Once approved, you'll get full access to your membership benefits</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowPreview(false)}
                  className="mt-8 w-full py-3 bg-black text-white text-sm font-bold rounded-lg hover:bg-black/80 transition-colors"
                >
                  Close Preview
                </button>
              </div>
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            {['pending', 'approved', 'rejected', 'all'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 text-xs tracking-widest rounded-full border transition-colors ${
                  filter === f ? 'bg-white text-black border-white' : 'border-white/30 text-white hover:border-white'
                }`}
              >
                {f === 'all' ? 'ALL' : f.toUpperCase()}
              </button>
            ))}
          </div>

          {isLoading && <p className="text-center text-white py-8 text-sm">Loading...</p>}

          {!isLoading && memberships.length === 0 && (
            <p className="text-center text-white py-8 text-sm">No requests.</p>
          )}

          {memberships.map(m => (
            <div key={m.id} className="bg-white rounded-xl border border-black/10 overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-black/5 transition-colors"
              >
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getTypeColor(m.membership_type)}`}>
                  {m.membership_type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.user_name || m.user_email}</p>
                  <p className="text-xs text-black">{m.user_email}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[m.status]}`}>
                  {m.status}
                </span>
                {expanded === m.id ? <ChevronUp size={16} className="text-black" /> : <ChevronDown size={16} className="text-black" />}
              </button>

              {expanded === m.id && (
                <div className="px-4 pb-4 border-t border-black/10 pt-4 space-y-4">
                  {m.bio && (
                    <div>
                      <p className="text-xs tracking-widest text-black mb-1">BIO</p>
                      <p className="text-sm text-black/80">{m.bio}</p>
                    </div>
                  )}
                  {m.website && (
                    <div>
                      <p className="text-xs tracking-widest text-black mb-1">LINK</p>
                      <a href={m.website} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline break-all">{m.website}</a>
                    </div>
                  )}
                  <div>
                    <p className="text-xs tracking-widest text-black mb-1">ADMIN NOTES</p>
                    <textarea
                      value={adminNotes[m.id] ?? (m.admin_notes || '')}
                      onChange={e => setAdminNotes({ ...adminNotes, [m.id]: e.target.value })}
                      rows={2}
                      placeholder="Internal notes..."
                      className="w-full px-3 py-2 bg-black/5 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black resize-none"
                    />
                  </div>
                  {m.status === 'pending' && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => approve(m)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <CheckCircle size={16} /> Approve
                      </button>
                      <button
                        onClick={() => reject(m)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <XCircle size={16} /> Reject
                      </button>
                    </div>
                  )}
                  {m.status !== 'pending' && (
                    <button
                      onClick={() => updateMutation.mutate({ id: m.id, data: { status: 'pending' } })}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-black/10 text-black text-sm rounded-lg hover:bg-black/20 transition-colors"
                    >
                      <Clock size={16} /> Set back to pending
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}