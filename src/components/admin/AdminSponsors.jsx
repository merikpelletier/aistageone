import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ExternalLink, Check, X } from 'lucide-react';
import AdminSponsorBrackets from './AdminSponsorBrackets';
import AdminSponsorSales from './AdminSponsorSales';
import AdminSponsorRequests from './AdminSponsorRequests';

export default function AdminSponsors() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('requests'); // 'requests' | 'sponsors' | 'pricing' | 'sales'
  const [newForm, setNewForm] = useState({ member_email: '', image_url: '', link: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [adding, setAdding] = useState(false);

  const { data: sponsors = [], isLoading } = useQuery({
    queryKey: ['admin-sponsors'],
    queryFn: () => base44.entities.ProfileSponsor.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ProfileSponsor.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsors'] });
      setNewForm({ member_email: '', image_url: '', link: '' });
      setAdding(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProfileSponsor.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-sponsors'] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ProfileSponsor.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-sponsors'] }),
  });

  const startEdit = (s) => {
    setEditingId(s.id);
    setEditForm({ member_email: s.member_email, image_url: s.image_url, link: s.link, is_active: s.is_active });
  };

  return (
    <div className="space-y-4">
      {/* Sub-tab toggle */}
      <div className="flex gap-2 border-b border-white/10 pb-3">
        {[['requests', 'Requests'], ['sponsors', 'Active Sponsors'], ['pricing', 'Pricing Brackets'], ['sales', 'Sales & Payouts']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${
              tab === key ? 'bg-white text-black font-medium' : 'text-white hover:text-white hover:bg-white/10'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'requests' && <AdminSponsorRequests />}
      {tab === 'pricing' && <AdminSponsorBrackets />}
      {tab === 'sales' && <AdminSponsorSales />}

      {tab === 'sponsors' && <>
      {/* Add button */}
      <div className="flex justify-end">
        <button
          onClick={() => setAdding(!adding)}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 transition-colors"
        >
          <Plus size={15} />
          Add Sponsor
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
          <p className="text-white text-sm font-medium mb-2">New Sponsor</p>
          <input
            type="text"
            placeholder="Member email"
            value={newForm.member_email}
            onChange={e => setNewForm({ ...newForm, member_email: e.target.value })}
            className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30"
          />
          <input
            type="text"
            placeholder="Image URL"
            value={newForm.image_url}
            onChange={e => setNewForm({ ...newForm, image_url: e.target.value })}
            className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30"
          />
          <input
            type="text"
            placeholder="Link URL (https://...)"
            value={newForm.link}
            onChange={e => setNewForm({ ...newForm, link: e.target.value })}
            className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30"
          />
          <div className="flex gap-2">
            <button
              onClick={() => createMutation.mutate({ ...newForm, is_active: true })}
              disabled={!newForm.member_email || !newForm.image_url || !newForm.link || createMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm rounded-lg hover:bg-white/90 disabled:opacity-40 transition-colors"
            >
              <Check size={14} /> Save
            </button>
            <button
              onClick={() => setAdding(false)}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white text-sm rounded-lg hover:bg-white/20 transition-colors"
            >
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Sponsor list */}
      {isLoading && <p className="text-white text-sm text-center py-8">Loading...</p>}
      {!isLoading && sponsors.length === 0 && (
        <p className="text-white text-sm text-center py-8">No sponsors yet.</p>
      )}

      <div className="space-y-3">
        {sponsors.map(s => (
          <div key={s.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            {editingId === s.id ? (
              <div className="p-4 space-y-3">
                <input
                  type="text"
                  placeholder="Member email"
                  value={editForm.member_email}
                  onChange={e => setEditForm({ ...editForm, member_email: e.target.value })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30"
                />
                <input
                  type="text"
                  placeholder="Image URL"
                  value={editForm.image_url}
                  onChange={e => setEditForm({ ...editForm, image_url: e.target.value })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30"
                />
                <input
                  type="text"
                  placeholder="Link URL"
                  value={editForm.link}
                  onChange={e => setEditForm({ ...editForm, link: e.target.value })}
                  className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => updateMutation.mutate({ id: s.id, data: editForm })}
                    disabled={updateMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm rounded-lg hover:bg-white/90 transition-colors"
                  >
                    <Check size={14} /> Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white text-sm rounded-lg hover:bg-white/20 transition-colors"
                  >
                    <X size={14} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3">
                {s.image_url && (
                  <img src={s.image_url} alt="sponsor" className="w-16 h-10 object-contain rounded bg-white/10 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium truncate">{s.member_email}</p>
                  <a href={s.link} target="_blank" rel="noreferrer" className="text-white text-xs hover:text-white flex items-center gap-1 truncate">
                    <ExternalLink size={10} /> {s.link}
                  </a>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Active toggle */}
                  <button
                    onClick={() => updateMutation.mutate({ id: s.id, data: { is_active: !s.is_active } })}
                    className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                      s.is_active ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {s.is_active ? 'Active' : 'Inactive'}
                  </button>
                  {/* Edit */}
                  <button
                    onClick={() => startEdit(s)}
                    className="text-white hover:text-white text-xs px-2 py-1 rounded transition-colors"
                  >
                    Edit
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => deleteMutation.mutate(s.id)}
                    className="text-red-400/60 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      </>}
    </div>
  );
}