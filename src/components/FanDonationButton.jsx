import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { HeartHandshake, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

export default function FanDonationButton({ creatorEmail }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('10');
  const [settings, setSettings] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    base44.functions.invoke('fan-donations', { action: 'settings' })
      .then((res) => setSettings(res.data?.settings || null))
      .catch(() => setSettings(null));
  }, [open]);

  const donate = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Enter a valid donation amount.');
      return;
    }
    setBusy(true);
    try {
      const res = await base44.functions.invoke('fan-donations', {
        action: 'checkout',
        creator_email: creatorEmail,
        amount_cents: Math.round(value * 100),
      });
      if (res.data?.url) window.location.assign(res.data.url);
      else toast.error(res.data?.error || 'Unable to start donation.');
    } catch (error) {
      toast.error(error.message || 'Unable to start donation.');
    } finally {
      setBusy(false);
    }
  };

  if (!creatorEmail) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/30 text-white text-xs font-medium rounded-lg hover:bg-white/20 transition-colors"
      >
        <HeartHandshake size={13} />
        Donate
      </button>
    );
  }

  const minimum = Number(settings?.minimum_amount_cents || 200) / 100;
  const maximum = Number(settings?.maximum_amount_cents || 100000) / 100;

  return (
    <div className="w-full max-w-sm border border-white/15 bg-neutral-950 p-4 text-white">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Support this creator</p>
          <p className="mt-1 text-xs text-white/45">One-time donation · CAD</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-white/50 hover:text-white">
          <X size={16} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {[5, 10, 25, 50].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setAmount(String(value))}
            className="border border-white/15 bg-white/5 px-2 py-2 text-xs font-semibold hover:bg-white/10"
          >
            {'$'}{value}
          </button>
        ))}
      </div>

      <label className="mt-3 block text-xs text-white/60">
        Amount
        <div className="mt-1 flex items-center border border-white/15 bg-black">
          <span className="px-3 text-white/45">$</span>
          <input
            type="number"
            min={minimum}
            max={maximum}
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-transparent px-1 py-2.5 text-white outline-none"
          />
          <span className="px-3 text-white/45">CAD</span>
        </div>
      </label>

      <button
        type="button"
        onClick={donate}
        disabled={busy}
        className="mt-3 flex w-full items-center justify-center gap-2 bg-white px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <HeartHandshake size={15} />}
        {busy ? 'Opening checkout…' : 'Donate securely'}
      </button>
    </div>
  );
}
