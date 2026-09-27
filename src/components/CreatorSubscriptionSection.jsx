import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { CreditCard, ExternalLink, Loader2, LockKeyhole, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';

export default function CreatorSubscriptionSection({ creatorEmail, isOwnProfile }) {
  const [plan, setPlan] = useState(null);
  const [activeSubscription, setActiveSubscription] = useState(false);
  const [annualPrice, setAnnualPrice] = useState('');
  const [country, setCountry] = useState('CA');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState(true);

  const formattedPrice = useMemo(() => {
    if (!plan?.annual_price_cents) return null;
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: (plan.currency || 'cad').toUpperCase(),
      }).format(plan.annual_price_cents / 100);
    } catch {
      return `${(plan.annual_price_cents / 100).toFixed(2)} ${(plan.currency || 'CAD').toUpperCase()}`;
    }
  }, [plan]);

  const load = async () => {
    if (!creatorEmail) return;
    setLoading(true);
    try {
      const result = await base44.functions.invoke('creator-subscriptions', {
        action: 'get-plan',
        creator_email: creatorEmail,
      });
      const nextPlan = result.data?.plan || null;
      setPlan(nextPlan);
      setAnnualPrice(nextPlan?.annual_price_cents ? String(nextPlan.annual_price_cents / 100) : '');
      setCountry(nextPlan?.country || 'CA');

      if (!isOwnProfile && nextPlan?.active) {
        try {
          const sub = await base44.functions.invoke('creator-subscriptions', {
            action: 'subscription-status',
            creator_email: creatorEmail,
          });
          setActiveSubscription(Boolean(sub.data?.active));
        } catch {
          setActiveSubscription(false);
        }
      }
    } catch (error) {
      // The UI remains hidden until the subscription backend has been deployed.
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [creatorEmail, isOwnProfile]);

  if (!available || loading) return null;

  const savePlan = async () => {
    const amount = Number(annualPrice);
    if (!Number.isFinite(amount) || amount < 1) {
      toast.error('Enter a valid annual price.');
      return;
    }
    setBusy(true);
    try {
      const result = await base44.functions.invoke('creator-subscriptions', {
        action: 'save-plan',
        annual_price_cents: Math.round(amount * 100),
        currency: plan?.currency || 'cad',
        country,
        active: Boolean(plan?.active),
      });
      setPlan(result.data?.plan || plan);
      toast.success('Annual subscription price saved.');
    } catch (error) {
      toast.error(error.message || 'Unable to save subscription settings.');
    } finally {
      setBusy(false);
    }
  };

  const startOnboarding = async () => {
    setBusy(true);
    try {
      const result = await base44.functions.invoke('creator-subscriptions', { action: 'connect-onboarding' });
      if (result.data?.url) window.location.assign(result.data.url);
    } catch (error) {
      toast.error(error.message || 'Unable to start Stripe setup.');
      setBusy(false);
    }
  };

  const refreshStripe = async () => {
    setBusy(true);
    try {
      const result = await base44.functions.invoke('creator-subscriptions', { action: 'connect-status' });
      setPlan(result.data?.plan || plan);
    } catch (error) {
      toast.error(error.message || 'Unable to refresh Stripe status.');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async () => {
    setBusy(true);
    try {
      const result = await base44.functions.invoke('creator-subscriptions', {
        action: 'save-plan',
        annual_price_cents: plan?.annual_price_cents || Math.round(Number(annualPrice || 0) * 100),
        currency: plan?.currency || 'cad',
        country,
        active: !plan?.active,
      });
      setPlan(result.data?.plan || plan);
    } catch (error) {
      toast.error(error.message || 'Unable to update subscriptions.');
    } finally {
      setBusy(false);
    }
  };

  const subscribe = async () => {
    setBusy(true);
    try {
      const result = await base44.functions.invoke('creator-subscriptions', {
        action: 'checkout',
        creator_email: creatorEmail,
      });
      if (result.data?.url) window.location.assign(result.data.url);
    } catch (error) {
      toast.error(error.message || 'Unable to start subscription checkout.');
      setBusy(false);
    }
  };

  if (!isOwnProfile) {
    if (!plan?.active) return null;
    return (
      <div className="mx-4 mb-4 border border-white/10 bg-neutral-950 p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-red-600/15 flex items-center justify-center flex-shrink-0">
            <LockKeyhole size={19} className="text-red-500" />
          </div>
          <div className="flex-1">
            <p className="text-white text-lg font-semibold">Annual subscription</p>
            <p className="text-white/55 text-sm mt-1">
              Access this creator's subscriber-only publications for one year.
            </p>
            {formattedPrice && <p className="text-white text-2xl font-light mt-3">{formattedPrice}<span className="text-white/45 text-sm"> / year</span></p>}
          </div>
        </div>
        <button
          onClick={subscribe}
          disabled={busy || activeSubscription}
          className="mt-4 w-full py-3 bg-white text-black font-semibold disabled:opacity-60"
        >
          {busy ? 'Opening…' : activeSubscription ? 'Subscribed' : 'Subscribe for one year'}
        </button>
      </div>
    );
  }

  const stripeReady = Boolean(plan?.stripe_charges_enabled && plan?.stripe_payouts_enabled);

  return (
    <div className="mx-4 my-5 border border-white/10 bg-neutral-950 p-5">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-white text-lg font-semibold">Public subscriptions</p>
          <p className="text-white/50 text-sm mt-1">One annual subscription gives your audience access to your subscriber-only content.</p>
        </div>
        <CreditCard size={20} className="text-white/60" />
      </div>

      <div className="grid sm:grid-cols-[1fr_180px_auto] gap-3">
        <div>
          <label className="text-white/60 text-xs uppercase tracking-wider">Annual price (CAD)</label>
          <input
            type="number"
            min="1"
            step="0.01"
            value={annualPrice}
            onChange={e => setAnnualPrice(e.target.value)}
            className="mt-1 w-full bg-black border border-white/15 px-3 py-2.5 text-white"
            placeholder="49.00"
          />
        </div>
        <div>
          <label className="text-white/60 text-xs uppercase tracking-wider">Country</label>
          <select
            value={country}
            onChange={e => setCountry(e.target.value)}
            className="mt-1 w-full bg-black border border-white/15 px-3 py-2.5 text-white"
          >
            <option value="CA">Canada</option>
            <option value="US">United States</option>
            <option value="GB">United Kingdom</option>
            <option value="FR">France</option>
            <option value="BE">Belgium</option>
            <option value="CH">Switzerland</option>
            <option value="DE">Germany</option>
            <option value="ES">Spain</option>
            <option value="IT">Italy</option>
            <option value="AU">Australia</option>
          </select>
        </div>
        <button onClick={savePlan} disabled={busy} className="sm:self-end px-5 py-2.5 bg-white text-black font-semibold disabled:opacity-50">
          Save
        </button>
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className={`text-xs px-2 py-1 border ${stripeReady ? 'border-green-500/40 text-green-400' : 'border-white/15 text-white/55'}`}>
            {stripeReady ? 'Stripe ready' : plan?.stripe_account_id ? 'Stripe setup incomplete' : 'Stripe not connected'}
          </span>
          {plan?.active && <span className="text-xs px-2 py-1 border border-red-500/40 text-red-400">Subscriptions active</span>}
        </div>

        <div className="flex flex-wrap gap-2">
          {!plan?.stripe_account_id ? (
            <button onClick={startOnboarding} disabled={busy} className="px-4 py-2.5 bg-red-600 text-white font-semibold flex items-center gap-2">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={15} />}
              Connect Stripe
            </button>
          ) : (
            <>
              {!stripeReady && (
                <button onClick={startOnboarding} disabled={busy} className="px-4 py-2.5 bg-red-600 text-white font-semibold flex items-center gap-2">
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={15} />}
                  Continue Stripe setup
                </button>
              )}
              <button onClick={refreshStripe} disabled={busy} className="px-4 py-2.5 border border-white/20 text-white flex items-center gap-2">
                <RefreshCcw size={15} className={busy ? 'animate-spin' : ''} />
                Refresh Stripe status
              </button>
            </>
          )}

          {stripeReady && plan?.annual_price_cents > 0 && (
            <button
              onClick={toggleActive}
              disabled={busy}
              className={`px-4 py-2.5 font-semibold ${plan?.active ? 'bg-neutral-800 text-white' : 'bg-white text-black'}`}
            >
              {plan?.active ? 'Pause subscriptions' : 'Activate subscriptions'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
