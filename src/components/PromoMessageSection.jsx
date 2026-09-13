import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, CheckCircle, AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

const SALON_LABELS = { cochon: '🐷 Cochon', contact: '💬 Contact', commercial: '🛍️ Info' };

// ── Steps ────────────────────────────────────────────────────────────────────
const STEPS = ['package', 'message', 'contact', 'review'];
const STEP_LABELS = { package: 'Package', message: 'Message', contact: 'Contact', review: 'Review' };

function StepBar({ currentStep }) {
  const idx = STEPS.indexOf(currentStep);
  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {STEPS.map((s, i) => (
        <React.Fragment key={s}>
          <div className="flex flex-col items-center">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i < idx ? 'bg-black text-white' : i === idx ? 'bg-black text-white ring-4 ring-black/20' : 'bg-white border-2 border-black/20 text-black'}`}>
              {i < idx ? <CheckCircle size={13} /> : i + 1}
            </div>
            <span className={`text-xs mt-1 font-medium ${i === idx ? 'text-black' : i < idx ? 'text-black' : 'text-black'}`}>{STEP_LABELS[s]}</span>
          </div>
          {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-1 mb-5 ${i < idx ? 'bg-black' : 'bg-black/15'}`} />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function PromoMessageSection() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState('package');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    package_id: '',
    salon: 'contact',
    message: '',
    link: '',
    link_text: '',
    send_date: '',
    sponsor_name: '',
    sponsor_email: '',
  });

  useEffect(() => {
    base44.entities.PromoMessagePackage.filter({ is_active: true }, 'name')
      .then(setPackages)
      .finally(() => setLoading(false));
  }, []);

  const selectedPkg = packages.find(p => p.id === form.package_id);

  const goTo = (s) => setStep(s);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await base44.entities.PromoMessageRequest.create({
        package_id: form.package_id,
        package_name: selectedPkg?.name || '',
        package_price: selectedPkg?.price || 0,
        salon: form.salon,
        message: form.message,
        link: form.link,
        link_text: form.link_text,
        send_date: form.send_date ? new Date(form.send_date).toISOString() : '',
        sponsor_name: form.sponsor_name,
        sponsor_email: form.sponsor_email,
        status: 'pending',
        submitted_at: new Date().toISOString(),
      });
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="py-8 flex justify-center"><div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" /></div>;

  if (submitted) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl p-8 text-center">
        <CheckCircle size={44} className="text-green-500 mx-auto mb-4" />
        <h3 className="text-lg font-extralight tracking-widest mb-2">REQUEST SUBMITTED</h3>
        <p className="text-black text-sm leading-relaxed">
          Your promo message request is <strong className="text-black">pending review</strong>.<br />
          We'll contact you at <strong>{form.sponsor_email}</strong> once approved.
        </p>
        <div className="mt-4 bg-black/5 rounded-xl p-4 text-left text-xs text-black space-y-1">
          <div className="flex justify-between"><span>Package</span><span className="text-black font-medium">{selectedPkg?.name}</span></div>
          <div className="flex justify-between"><span>Salon</span><span className="text-black font-medium">{SALON_LABELS[form.salon]}</span></div>
          <div className="flex justify-between"><span>Amount</span><span className="text-black font-bold">${selectedPkg?.price}</span></div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      <StepBar currentStep={step} />

      <AnimatePresence mode="wait">

        {/* ── Package ── */}
        {step === 'package' && (
          <motion.div key="pkg" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <div className="bg-white rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold tracking-widest text-black">CHOOSE A PACKAGE</h3>
              {packages.length === 0 && <p className="text-black text-sm text-center py-4">No packages available.</p>}
              {packages.map(pkg => {
                const sel = form.package_id === pkg.id;
                return (
                  <button
                    key={pkg.id}
                    onClick={() => setForm(f => ({ ...f, package_id: pkg.id }))}
                    className={`w-full text-left px-4 py-4 rounded-xl border-2 transition-all ${sel ? 'border-black bg-black text-white' : 'border-black/20 bg-white hover:border-black/50'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold">{pkg.name}</p>
                        {pkg.description && <p className={`text-xs mt-0.5 ${sel ? 'text-white' : 'text-black'}`}>{pkg.description}</p>}
                      </div>
                      <span className="text-xl font-bold">${pkg.price}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <NavBtns onNext={() => goTo('message')} nextDisabled={!form.package_id} hideBack />
          </motion.div>
        )}

        {/* ── Message ── */}
        {step === 'message' && (
          <motion.div key="msg" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <div className="bg-white rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-semibold tracking-widest text-black">YOUR MESSAGE</h3>

              {/* Salon */}
              <div>
                <label className="text-xs tracking-widest text-black mb-1.5 block">SALON</label>
                <div className="relative">
                  <select
                    value={form.salon}
                    onChange={e => setForm(f => ({ ...f, salon: e.target.value }))}
                    className="w-full px-4 py-3 bg-black/5 border border-black/10 rounded-xl text-sm appearance-none focus:outline-none focus:border-black pr-10"
                  >
                    <option value="contact">💬 Contact</option>
                    <option value="cochon">🐷 Cochon</option>
                    <option value="commercial">🛍️ Info</option>
                  </select>
                  <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-black pointer-events-none" />
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="text-xs tracking-widest text-black mb-1.5 block">MESSAGE *</label>
                <textarea
                  rows={4}
                  placeholder="Your promotional message..."
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  className="w-full px-4 py-3 bg-black/5 border border-black/10 rounded-xl text-sm focus:outline-none focus:border-black resize-none"
                />
              </div>

              {/* Link */}
              <div>
                <label className="text-xs tracking-widest text-black mb-1.5 block">LINK (OPTIONAL)</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={form.link}
                  onChange={e => setForm(f => ({ ...f, link: e.target.value }))}
                  className="w-full px-4 py-3 bg-black/5 border border-black/10 rounded-xl text-sm focus:outline-none focus:border-black"
                />
              </div>

              {form.link && (
                <div>
                  <label className="text-xs tracking-widest text-black mb-1.5 block">LINK TEXT</label>
                  <input
                    type="text"
                    placeholder="Learn more"
                    value={form.link_text}
                    onChange={e => setForm(f => ({ ...f, link_text: e.target.value }))}
                    className="w-full px-4 py-3 bg-black/5 border border-black/10 rounded-xl text-sm focus:outline-none focus:border-black"
                  />
                </div>
              )}

              {/* Send date */}
              <div>
                <label className="text-xs tracking-widest text-black mb-1.5 block">PREFERRED SEND DATE & TIME</label>
                <input
                  type="datetime-local"
                  value={form.send_date}
                  onChange={e => setForm(f => ({ ...f, send_date: e.target.value }))}
                  className="w-full px-4 py-3 bg-black/5 border border-black/10 rounded-xl text-sm focus:outline-none focus:border-black"
                />
              </div>
            </div>
            <NavBtns onBack={() => goTo('package')} onNext={() => goTo('contact')} nextDisabled={!form.message} />
          </motion.div>
        )}

        {/* ── Contact ── */}
        {step === 'contact' && (
          <motion.div key="contact" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <div className="bg-white rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-semibold tracking-widest text-black">YOUR CONTACT INFO</h3>
              <input
                type="text"
                placeholder="Company or your name *"
                value={form.sponsor_name}
                onChange={e => setForm(f => ({ ...f, sponsor_name: e.target.value }))}
                className="w-full px-4 py-3 bg-black/5 border border-black/10 rounded-xl text-sm focus:outline-none focus:border-black"
              />
              <input
                type="email"
                placeholder="Email address *"
                value={form.sponsor_email}
                onChange={e => setForm(f => ({ ...f, sponsor_email: e.target.value }))}
                className="w-full px-4 py-3 bg-black/5 border border-black/10 rounded-xl text-sm focus:outline-none focus:border-black"
              />
            </div>
            <NavBtns onBack={() => goTo('message')} onNext={() => goTo('review')} nextDisabled={!form.sponsor_name || !form.sponsor_email || !form.sponsor_email.includes('@')} />
          </motion.div>
        )}

        {/* ── Review ── */}
        {step === 'review' && (
          <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
            <div className="bg-white rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-semibold tracking-widest text-black">REVIEW & SUBMIT</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-black">Package</span><span>{selectedPkg?.name}</span></div>
                <div className="flex justify-between"><span className="text-black">Salon</span><span>{SALON_LABELS[form.salon]}</span></div>
                {form.send_date && <div className="flex justify-between"><span className="text-black">Send date</span><span>{format(new Date(form.send_date), 'MMM d, yyyy HH:mm')}</span></div>}
                <div className="flex justify-between font-bold text-base pt-2 border-t border-black/10"><span>Total</span><span>${selectedPkg?.price}</span></div>
              </div>
              <div className="bg-black/5 rounded-xl p-4">
                <p className="text-sm text-black">{form.message}</p>
                {form.link && <p className="text-xs text-black mt-1">{form.link_text || form.link}</p>}
              </div>
              <p className="text-xs text-black">From: {form.sponsor_name} ({form.sponsor_email})</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => goTo('contact')} className="flex items-center gap-2 px-5 py-3 bg-white text-black text-sm rounded-xl border border-black/10 hover:bg-black/5">
                <ArrowLeft size={15} /> Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-3 bg-black text-white text-sm tracking-widest font-medium disabled:opacity-30 hover:bg-black/80 rounded-xl"
              >
                {submitting ? 'Submitting...' : 'SUBMIT REQUEST'}
              </button>
            </div>
            <p className="text-center text-xs text-black/35 pb-2">Payment will be arranged by our team after approval.</p>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

function NavBtns({ onBack, onNext, nextDisabled, hideBack }) {
  return (
    <div className="flex gap-3">
      {!hideBack && (
        <button onClick={onBack} className="flex items-center gap-2 px-5 py-3 bg-white text-black text-sm rounded-xl border border-black/10 hover:bg-black/5">
          <ArrowLeft size={15} /> Back
        </button>
      )}
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="flex-1 flex items-center justify-center gap-2 py-3 bg-black text-white text-sm tracking-widest font-medium disabled:opacity-30 hover:bg-black/80 rounded-xl"
      >
        Continue <ArrowRight size={15} />
      </button>
    </div>
  );
}