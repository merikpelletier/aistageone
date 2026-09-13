import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Check, X, Edit2 } from 'lucide-react';

const EMPTY_FORM = { name: '', price: '', duration: '', is_active: true };

function BracketForm({ initial = EMPTY_FORM, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial);
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
      <input
        type="text"
        placeholder="Name (e.g. Bronze, Silver, Gold)"
        value={form.name}
        onChange={e => setForm({ ...form, name: e.target.value })}
        className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30"
      />
      <div className="flex gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white text-sm">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Price"
            value={form.price}
            onChange={e => setForm({ ...form, price: e.target.value })}
            className="w-full pl-7 pr-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30"
          />
        </div>
        <input
          type="text"
          placeholder="Duration (e.g. 1 month)"
          value={form.duration}
          onChange={e => setForm({ ...form, duration: e.target.value })}
          className="flex-1 px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30"
        />
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={e => setForm({ ...form, is_active: e.target.checked })}
          className="w-4 h-4 accent-white"
        />
        <span className="text-white text-sm">Active (visible to members)</span>
      </label>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave({ ...form, price: parseFloat(form.price) || 0 })}
          disabled={!form.name || !form.price || !form.duration || saving}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm rounded-lg hover:bg-white/90 disabled:opacity-40 transition-colors"
        >
          <Check size={14} /> Save
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white text-sm rounded-lg hover:bg-white/20 transition-colors"
        >
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  );
}

export default function AdminSponsorBrackets() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const { data: brackets = [], isLoading } = useQuery({
    queryKey: ['sponsor-brackets'],
    queryFn: () => base44.entities.SponsorBracket.list('name'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SponsorBracket.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sponsor-brackets'] }); setAdding(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SponsorBracket.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sponsor-brackets'] }); setEditingId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SponsorBracket.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sponsor-brackets'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setAdding(!adding)}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 transition-colors"
        >
          <Plus size={15} /> Add Bracket
        </button>
      </div>

      {adding && (
        <BracketForm
          onSave={(data) => createMutation.mutate(data)}
          onCancel={() => setAdding(false)}
          saving={createMutation.isPending}
        />
      )}

      {isLoading && <p className="text-white text-sm text-center py-8">Loading...</p>}
      {!isLoading && brackets.length === 0 && (
        <p className="text-white text-sm text-center py-8">No pricing brackets yet.</p>
      )}

      <div className="space-y-3">
        {brackets.map(b => (
          <div key={b.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            {editingId === b.id ? (
              <BracketForm
                initial={{ name: b.name, price: b.price, duration: b.duration, is_active: b.is_active }}
                onSave={(data) => updateMutation.mutate({ id: b.id, data })}
                onCancel={() => setEditingId(null)}
                saving={updateMutation.isPending}
              />
            ) : (
              <div className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm">{b.name}</p>
                  <p className="text-white text-xs mt-0.5">{b.duration}</p>
                </div>
                <p className="text-white font-semibold text-base">${b.price.toLocaleString()}</p>
                <button
                  onClick={() => updateMutation.mutate({ id: b.id, data: { is_active: !b.is_active } })}
                  className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors flex-shrink-0 ${
                    b.is_active
                      ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {b.is_active ? 'Active' : 'Inactive'}
                </button>
                <button
                  onClick={() => setEditingId(b.id)}
                  className="text-white hover:text-white transition-colors"
                >
                  <Edit2 size={15} />
                </button>
                <button
                  onClick={() => deleteMutation.mutate(b.id)}
                  className="text-red-400/60 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}