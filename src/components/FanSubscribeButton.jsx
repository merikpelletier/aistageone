import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Heart } from 'lucide-react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function FanSubscribeButton({ memberEmail }) {
  const [fanCount, setFanCount] = useState(0);
  const [myRecord, setMyRecord] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isActive = myRecord?.status === 'active';

  useEffect(() => {
    if (!memberEmail) return;
    base44.entities.ProfileFanSubscription.filter({ target_profile_id: memberEmail }).then(fans => {
      const active = fans.filter(f => f.status === 'active');
      setFanCount(active.length);
      const saved = localStorage.getItem('fan_email');
      if (saved) {
        setEmail(saved);
        const existing = fans.find(f => f.email === saved);
        if (existing) setMyRecord(existing);
      }
    }).catch(() => {});
  }, [memberEmail]);

  const handleSubscribe = async () => {
    setError('');
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    if (!EMAIL_RE.test(email.trim())) { setError('Invalid email address.'); return; }

    setLoading(true);
    try {
      const trimmed = email.trim().toLowerCase();
      const existing = await base44.entities.ProfileFanSubscription.filter({ target_profile_id: memberEmail, email: trimmed });

      if (existing.length > 0) {
        const rec = existing[0];
        if (rec.status === 'active') {
          setMyRecord(rec);
        } else {
          const updated = await base44.entities.ProfileFanSubscription.update(rec.id, {
            status: 'active',
            unsubscribed_at: null,
          });
          setMyRecord(updated);
          setFanCount(c => c + 1);
        }
      } else {
        const created = await base44.entities.ProfileFanSubscription.create({
          target_profile_id: memberEmail,
          email: trimmed,
          status: 'active',
          created_at: new Date().toISOString(),
        });
        setMyRecord(created);
        setFanCount(c => c + 1);
      }

      localStorage.setItem('fan_email', trimmed);
      setShowForm(false);
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!myRecord) return;
    setLoading(true);
    try {
      const updated = await base44.entities.ProfileFanSubscription.update(myRecord.id, {
        status: 'unsubscribed',
        unsubscribed_at: new Date().toISOString(),
      });
      setMyRecord(updated);
      setFanCount(c => Math.max(0, c - 1));
    } finally {
      setLoading(false);
    }
  };

  if (isActive) {
    return (
      <button
        onClick={handleUnsubscribe}
        disabled={loading}
        title="Unsubscribe"
        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
      >
        <Heart size={13} fill="white" />
        Fan · {fanCount}
      </button>
    );
  }

  if (showForm) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleSubscribe()}
            placeholder="your@email.com"
            className="text-xs border border-black/30 rounded-lg px-2.5 py-1.5 outline-none focus:border-red-500 w-44"
            autoFocus
          />
          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '…' : 'OK'}
          </button>
          <button
            onClick={() => { setShowForm(false); setError(''); }}
            className="text-black hover:text-black text-xs px-1"
          >
            ✕
          </button>
        </div>
        {error && <p className="text-red-600 text-xs">{error}</p>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowForm(true)}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 border border-white/30 text-white text-xs font-medium rounded-lg hover:bg-red-600 hover:border-red-600 transition-colors"
    >
      <Heart size={13} />
      Fan{fanCount > 0 ? ` · ${fanCount}` : ''}
    </button>
  );
}