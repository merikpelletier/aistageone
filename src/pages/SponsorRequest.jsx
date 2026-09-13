import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, CheckCircle, ChevronDown, AlertCircle, ExternalLink, ArrowLeft, ArrowRight, Image, MessageSquare } from 'lucide-react';
import { addDays, addWeeks, addMonths, format } from 'date-fns';
import PromoMessageSection from '@/components/PromoMessageSection';

// ─── helpers ───────────────────────────────────────────────────────────────
const isValidUrl = (val) => {
  try { new URL(val.startsWith('http') ? val : `https://${val}`); return true; } catch { return false; }
};

const computeEndDate = (start, durationStr) => {
  if (!durationStr) return null;
  const s = durationStr.toLowerCase();
  if (s.includes('week')) { const n = parseInt(s) || 1; return addWeeks(start, n); }
  if (s.includes('month')) { const n = parseInt(s) || 1; return addMonths(start, n); }
  if (s.includes('day')) { const n = parseInt(s) || 7; return addDays(start, n); }
  return addDays(start, 30);
};

const MAX_FILE_MB = 2;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const STEPS = ['profile', 'package', 'banner', 'contact', 'review'];
const STEP_LABELS = { profile: 'Profile', package: 'Package', banner: 'Banner', contact: 'Contact', review: 'Review' };

// ─── Step indicator ─────────────────────────────────────────────────────────
function StepBar({ currentStep, skipProfile }) {
  const steps = skipProfile ? STEPS.filter(s => s !== 'profile') : STEPS;
  const idx = steps.indexOf(currentStep);
  return (
    <div className="flex items-center justify-center gap-1 mb-8">
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <div className={`flex flex-col items-center`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i < idx ? 'bg-black text-white' : i === idx ? 'bg-black text-white ring-4 ring-black/30' : 'bg-white border-2 border-black/30 text-black'}`}>
              {i < idx ? <CheckCircle size={14} /> : i + 1}
            </div>
            <span className={`text-xs mt-1 tracking-wide font-medium ${i === idx ? 'text-black' : i < idx ? 'text-black' : 'text-black'}`}>{STEP_LABELS[s]}</span>
          </div>
          {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-1 mb-5 transition-colors ${i < idx ? 'bg-black' : 'bg-black/20'}`} />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────
export default function SponsorRequest() {
  const [searchParams] = useSearchParams();
  const preselectedEmail = searchParams.get('member') || '';

  const [sponsorType, setSponsorType] = useState(''); // 'banner' | 'message'
  const [step, setStep] = useState(preselectedEmail ? 'package' : 'profile');
  const [profiles, setProfiles] = useState([]);
  const [brackets, setBrackets] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState('');
  const [linkError, setLinkError] = useState('');
  const [submitted, setSubmitted] = useState(null);
  const topRef = useRef(null);

  const [form, setForm] = useState({
    member_email: preselectedEmail,
    bracket_id: '',
    sponsor_name: '',
    sponsor_email: '',
    image_url: '',
    link: '',
    terms_accepted: false,
  });

  useEffect(() => {
    Promise.all([
      base44.entities.MemberProfile.list('display_name'),
      base44.entities.SponsorBracket.filter({ is_active: true }, 'name'),
    ]).then(([p, b]) => { setProfiles(p); setBrackets(b); setLoadingData(false); });
  }, []);

  const selectedBracket = brackets.find(b => b.id === form.bracket_id);
  const selectedProfile = profiles.find(p => p.user_email === form.member_email);

  const goTo = (s) => { setStep(s); topRef.current?.scrollIntoView({ behavior: 'smooth' }); };

  // ── image upload with validation ──
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError('');
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setImageError('Only JPG, PNG, WebP, or GIF files are accepted.');
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setImageError(`File must be under ${MAX_FILE_MB}MB.`);
      return;
    }
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, image_url: file_url }));
    } finally {
      setUploading(false);
    }
  };

  const validateLink = (val) => {
    if (!val) { setLinkError('Destination link is required.'); return false; }
    if (!isValidUrl(val)) { setLinkError('Please enter a valid URL (e.g. https://example.com)'); return false; }
    setLinkError('');
    return true;
  };

  // ── submit ──
  const handleSubmit = async () => {
    if (!form.terms_accepted) return;
    setSubmitting(true);
    try {
      const price = selectedBracket?.price || 0;
      const record = await base44.entities.ProfileSponsor.create({
        member_email: form.member_email,
        bracket_id: form.bracket_id,
        bracket_name: selectedBracket?.name || '',
        bracket_price: price,
        bracket_duration: selectedBracket?.duration || '',
        platform_share: parseFloat((price * 0.30).toFixed(2)),
        member_share: parseFloat((price * 0.70).toFixed(2)),
        sponsor_name: form.sponsor_name,
        sponsor_email: form.sponsor_email,
        image_url: form.image_url,
        link: form.link.startsWith('http') ? form.link : `https://${form.link}`,
        is_active: false,
        status: 'pending',
        terms_accepted: true,
        submitted_at: new Date().toISOString(),
      });
      setSubmitted(record);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingData) {
    return (
      <div className="min-h-screen bg-yellow-400 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-black/30 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  // ── Success screen ──
  if (submitted) {
    return (
      <div className="min-h-screen bg-yellow-400 flex items-center justify-center px-4 pb-20">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl p-10 text-center shadow-xl max-w-sm w-full">
          <CheckCircle size={52} className="text-green-500 mx-auto mb-5" />
          <h2 className="text-xl font-extralight tracking-widest mb-3">REQUEST SUBMITTED</h2>
          <p className="text-black text-sm leading-relaxed mb-6">
            Your sponsorship request is <strong className="text-black">pending review</strong>.<br />
            We'll contact you at <strong>{form.sponsor_email}</strong> once approved.
          </p>
          <div className="bg-black/5 rounded-xl p-4 text-left space-y-2 text-xs text-black">
            <div className="flex justify-between"><span>Profile</span><span className="text-black font-medium">{selectedProfile?.display_name || form.member_email}</span></div>
            <div className="flex justify-between"><span>Package</span><span className="text-black font-medium">{selectedBracket?.name} — {selectedBracket?.duration}</span></div>
            <div className="flex justify-between"><span>Amount</span><span className="text-black font-bold">${selectedBracket?.price}</span></div>
            <div className="flex justify-between pt-2 border-t border-black/10"><span>Status</span><span className="text-yellow-600 font-semibold">Pending Review</span></div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-yellow-400 pb-24 px-4 pt-8" ref={topRef}>
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-widest mb-2">BECOME A SPONSOR</h1>
          <p className="text-black text-sm">Choose how you'd like to reach our community.</p>
        </div>

        {/* ── Sponsor type selector ── */}
        {!sponsorType && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <button
              onClick={() => setSponsorType('banner')}
              className="w-full flex items-start gap-4 bg-white rounded-2xl p-5 border-2 border-transparent hover:border-black transition-all text-left"
            >
              <div className="w-12 h-12 bg-black/5 rounded-xl flex items-center justify-center flex-shrink-0">
                <Image size={22} className="text-black" />
              </div>
              <div>
                <p className="font-bold text-base">Profile Banner</p>
                <p className="text-black text-sm mt-0.5">Place your banner image on a member's profile page for a chosen duration.</p>
              </div>
            </button>
            <button
              onClick={() => setSponsorType('message')}
              className="w-full flex items-start gap-4 bg-white rounded-2xl p-5 border-2 border-transparent hover:border-black transition-all text-left"
            >
              <div className="w-12 h-12 bg-black/5 rounded-xl flex items-center justify-center flex-shrink-0">
                <MessageSquare size={22} className="text-black" />
              </div>
              <div>
                <p className="font-bold text-base">Promo Message</p>
                <p className="text-black text-sm mt-0.5">Send a scheduled promotional message directly in one of our chat rooms.</p>
              </div>
            </button>
          </motion.div>
        )}

        {/* ── Back to type selector ── */}
        {sponsorType && (
          <button
            onClick={() => setSponsorType('')}
            className="flex items-center gap-2 text-black hover:text-black text-sm mb-4 transition-colors"
          >
            <ArrowLeft size={14} /> Change type
          </button>
        )}

        {/* ── Promo Message Flow ── */}
        {sponsorType === 'message' && <PromoMessageSection />}

        {/* ── Banner Flow ── */}
        {sponsorType === 'banner' && <>
        <StepBar currentStep={step} skipProfile={!!preselectedEmail} />

        <AnimatePresence mode="wait">

          {/* ── STEP 1: Profile ── */}
          {step === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
              <div className="bg-white rounded-2xl p-5 space-y-4">
                <h2 className="text-sm font-semibold tracking-widest text-black">CHOOSE A PROFILE TO SPONSOR</h2>
                <div className="relative">
                  <select
                    value={form.member_email}
                    onChange={e => setForm(f => ({ ...f, member_email: e.target.value }))}
                    className="w-full px-4 py-3 bg-black/5 border border-black/10 rounded-xl text-sm appearance-none focus:outline-none focus:border-black pr-10"
                  >
                    <option value="">Select a member profile...</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.user_email}>
                        {p.display_name || p.user_email}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-black pointer-events-none" />
                </div>
                {selectedProfile && (
                  <div className="flex items-center gap-3 p-3 bg-black/5 rounded-xl">
                    {selectedProfile.avatar_url && <img src={selectedProfile.avatar_url} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />}
                    <div>
                      <p className="font-semibold text-sm">{selectedProfile.display_name}</p>
                      {selectedProfile.title && <p className="text-xs text-black">{selectedProfile.title}</p>}
                    </div>
                  </div>
                )}
              </div>
              <NavButtons
                onNext={() => goTo('package')}
                nextDisabled={!form.member_email}
                hideBack
              />
            </motion.div>
          )}

          {/* ── STEP 2: Package ── */}
          {step === 'package' && (
            <motion.div key="package" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
              <div className="bg-white rounded-2xl p-5 space-y-3">
                <h2 className="text-sm font-semibold tracking-widest text-black">CHOOSE A SPONSORSHIP PACKAGE</h2>
                {brackets.length === 0 && <p className="text-black text-sm py-4 text-center">No packages available at the moment.</p>}
                {brackets.map(b => {
                  const selected = form.bracket_id === b.id;
                  const startDate = new Date();
                  const endDate = computeEndDate(startDate, b.duration);
                  return (
                    <button
                      key={b.id}
                      onClick={() => setForm(f => ({ ...f, bracket_id: b.id }))}
                      className={`w-full text-left px-4 py-4 rounded-xl border-2 transition-all ${selected ? 'border-black bg-black text-white' : 'border-black/25 bg-white hover:border-black/60 hover:shadow-sm'}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-bold text-base">{b.name}</p>
                          <p className={`text-xs mt-0.5 font-medium ${selected ? 'text-white' : 'text-black/55'}`}>{b.duration}</p>
                        </div>
                        <span className="text-2xl font-bold">${b.price}</span>
                      </div>
                      {endDate && (
                        <div className={`text-xs mt-2 pt-2 border-t font-medium ${selected ? 'border-white/20 text-white' : 'border-black/15 text-black/55'}`}>
                          Active: {format(startDate, 'MMM d')} → {format(endDate, 'MMM d, yyyy')}
                        </div>
                      )}
                      <div className={`mt-1.5 flex gap-3 text-xs ${selected ? 'text-white' : 'text-black'}`}>
                        <span>Platform: ${(b.price * 0.30).toFixed(2)} (30%)</span>
                        <span>·</span>
                        <span>Member earns: ${(b.price * 0.70).toFixed(2)} (70%)</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <NavButtons onBack={() => goTo('profile')} onNext={() => goTo('banner')} nextDisabled={!form.bracket_id} />
            </motion.div>
          )}

          {/* ── STEP 3: Banner ── */}
          {step === 'banner' && (
            <motion.div key="banner" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
              <div className="bg-white rounded-2xl p-5 space-y-4">
                <div>
                  <h2 className="text-sm font-semibold tracking-widest text-black mb-1">UPLOAD YOUR BANNER</h2>
                  <p className="text-xs text-black">JPG, PNG, WebP or GIF · Max {MAX_FILE_MB}MB · Recommended: 1200×200px</p>
                </div>

                {form.image_url ? (
                  <div className="space-y-2">
                    <p className="text-xs text-black font-medium">Preview (as it appears on profile):</p>
                    <div className="bg-black/5 border border-black/10 rounded-xl overflow-hidden p-2">
                      <img src={form.image_url} alt="Banner preview" className="w-full h-20 object-contain rounded" />
                    </div>
                    <button onClick={() => { setForm(f => ({ ...f, image_url: '' })); setImageError(''); }} className="text-xs text-black hover:text-black underline">Remove & upload different image</button>
                  </div>
                ) : (
                  <>
                    <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${imageError ? 'border-red-400 bg-red-50' : 'border-black/20 hover:border-black/40 bg-black/3'}`}>
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImageUpload} className="hidden" />
                      {uploading ? (
                        <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      ) : (
                        <>
                          <Upload size={22} className="text-black mb-2" />
                          <span className="text-sm text-black">Click to upload</span>
                          <span className="text-xs text-black mt-1">JPG, PNG, WebP, GIF · Max {MAX_FILE_MB}MB</span>
                        </>
                      )}
                    </label>
                    {imageError && <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle size={12} /> {imageError}</p>}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-black/10" />
                      <span className="text-xs text-black">or paste URL</span>
                      <div className="flex-1 h-px bg-black/10" />
                    </div>
                    <input
                      type="text"
                      placeholder="https://example.com/banner.jpg"
                      value={form.image_url}
                      onChange={e => { setImageError(''); setForm(f => ({ ...f, image_url: e.target.value })); }}
                      className="w-full px-4 py-3 bg-black/5 border border-black/10 rounded-xl text-sm focus:outline-none focus:border-black"
                    />
                  </>
                )}

                <div>
                  <label className="block text-xs tracking-widest text-black mb-2">DESTINATION LINK *</label>
                  <input
                    type="text"
                    placeholder="https://yourwebsite.com"
                    value={form.link}
                    onChange={e => { setForm(f => ({ ...f, link: e.target.value })); if (linkError) validateLink(e.target.value); }}
                    onBlur={e => validateLink(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:outline-none ${linkError ? 'border-red-400 bg-red-50' : 'bg-black/5 border-black/10 focus:border-black'}`}
                  />
                  {linkError && <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12} /> {linkError}</p>}
                  {form.link && !linkError && isValidUrl(form.link) && (
                    <a href={form.link.startsWith('http') ? form.link : `https://${form.link}`} target="_blank" rel="noreferrer" className="mt-1 text-xs text-black hover:text-black flex items-center gap-1">
                      <ExternalLink size={10} /> Preview link
                    </a>
                  )}
                </div>
              </div>
              <NavButtons
                onBack={() => goTo('package')}
                onNext={() => {
                  if (!validateLink(form.link)) return;
                  if (!form.image_url) { setImageError('Please upload or paste a banner image.'); return; }
                  goTo('contact');
                }}
                nextDisabled={!form.image_url || !!linkError || !form.link}
              />
            </motion.div>
          )}

          {/* ── STEP 4: Contact ── */}
          {step === 'contact' && (
            <motion.div key="contact" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
              <div className="bg-white rounded-2xl p-5 space-y-4">
                <h2 className="text-sm font-semibold tracking-widest text-black">YOUR CONTACT INFO</h2>
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
              <NavButtons
                onBack={() => goTo('banner')}
                onNext={() => goTo('review')}
                nextDisabled={!form.sponsor_name || !form.sponsor_email || !form.sponsor_email.includes('@')}
              />
            </motion.div>
          )}

          {/* ── STEP 5: Review & Submit ── */}
          {step === 'review' && (
            <motion.div key="review" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">

              {/* Order summary */}
              <div className="bg-white rounded-2xl p-5 space-y-4">
                <h2 className="text-sm font-semibold tracking-widest text-black">ORDER SUMMARY</h2>

                <div className="flex items-center gap-3 p-3 bg-black/5 rounded-xl">
                  {selectedProfile?.avatar_url && <img src={selectedProfile.avatar_url} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />}
                  <div>
                    <p className="font-semibold text-sm">{selectedProfile?.display_name || form.member_email}</p>
                    {selectedProfile?.title && <p className="text-xs text-black">{selectedProfile.title}</p>}
                  </div>
                </div>

                {/* Banner preview */}
                <div>
                  <p className="text-xs text-black mb-1">Banner preview</p>
                  <div className="bg-black/5 border border-black/10 rounded-xl overflow-hidden p-2">
                    <img src={form.image_url} alt="Banner" className="w-full h-20 object-contain rounded" />
                  </div>
                  <a href={form.link.startsWith('http') ? form.link : `https://${form.link}`} target="_blank" rel="noreferrer" className="mt-1 text-xs text-black hover:text-black flex items-center gap-1">
                    <ExternalLink size={10} /> {form.link}
                  </a>
                </div>

                {/* Pricing breakdown */}
                {selectedBracket && (() => {
                  const start = new Date();
                  const end = computeEndDate(start, selectedBracket.duration);
                  return (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-black">Package</span><span>{selectedBracket.name}</span></div>
                      <div className="flex justify-between"><span className="text-black">Duration</span><span>{selectedBracket.duration}</span></div>
                      {end && <div className="flex justify-between"><span className="text-black">Active period</span><span>{format(start, 'MMM d')} – {format(end, 'MMM d, yyyy')}</span></div>}
                      <div className="flex justify-between text-xs text-black pt-1">
                        <span>Platform fee (30%)</span><span>${(selectedBracket.price * 0.30).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-black">
                        <span>Member earnings (70%)</span><span>${(selectedBracket.price * 0.70).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-base pt-2 border-t border-black/10">
                        <span>Total</span><span>${selectedBracket.price}</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="bg-black/5 rounded-xl p-3 space-y-1 text-xs text-black">
                  <p><span className="font-medium text-black">From:</span> {form.sponsor_name} ({form.sponsor_email})</p>
                </div>
              </div>

              {/* Sponsorship status info */}
              <div className="bg-white rounded-2xl p-5">
                <h2 className="text-sm font-semibold tracking-widest text-black mb-3">SUBMISSION STATUS</h2>
                <div className="flex gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-6 h-6 rounded-full bg-yellow-400 border-2 border-black flex items-center justify-center text-xs font-bold">1</div>
                    <div className="flex-1 w-px bg-black/10" />
                    <div className="w-6 h-6 rounded-full bg-black/10 border-2 border-black/20 flex items-center justify-center text-xs font-bold text-black">2</div>
                    <div className="flex-1 w-px bg-black/10" />
                    <div className="w-6 h-6 rounded-full bg-black/10 border-2 border-black/20 flex items-center justify-center text-xs font-bold text-black">3</div>
                  </div>
                  <div className="flex-1 space-y-4 text-xs">
                    <div>
                      <p className="font-semibold text-black">Pending Review</p>
                      <p className="text-black">Your request is submitted and waiting for admin approval.</p>
                    </div>
                    <div>
                      <p className="font-semibold text-black">Approved</p>
                      <p className="text-black">Admin approves and sets your banner live.</p>
                    </div>
                    <div>
                      <p className="font-semibold text-black">Active</p>
                      <p className="text-black">Your banner is displayed on the selected profile.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Terms */}
              <div className="bg-white rounded-2xl p-5">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.terms_accepted}
                    onChange={e => setForm(f => ({ ...f, terms_accepted: e.target.checked }))}
                    className="mt-1 w-4 h-4 accent-black cursor-pointer"
                  />
                  <span className="text-xs text-black leading-relaxed">
                    I agree that my banner submission is subject to review and approval. I confirm that the banner content is legal, not misleading, and I accept the sponsorship terms. Sponsorship fees are non-refundable once the banner goes live.
                  </span>
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => goTo('contact')}
                  className="flex items-center gap-2 px-5 py-3 bg-white text-black text-sm rounded-xl border border-black/10 hover:bg-black/5 transition-colors"
                >
                  <ArrowLeft size={15} /> Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!form.terms_accepted || submitting}
                  className="flex-1 py-3 bg-black text-white text-sm tracking-widest font-medium disabled:opacity-30 hover:bg-black/80 transition-colors rounded-xl"
                >
                  {submitting ? 'Submitting...' : 'SUBMIT REQUEST'}
                </button>
              </div>

              <p className="text-center text-xs text-black/35 pb-4">
                Payment will be arranged by our team after approval.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
        </>}
      </div>
    </div>
  );
}

function NavButtons({ onBack, onNext, nextDisabled, hideBack }) {
  return (
    <div className="flex gap-3">
      {!hideBack && (
        <button onClick={onBack} className="flex items-center gap-2 px-5 py-3 bg-white text-black text-sm rounded-xl border border-black/10 hover:bg-black/5 transition-colors">
          <ArrowLeft size={15} /> Back
        </button>
      )}
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className="flex-1 flex items-center justify-center gap-2 py-3 bg-black text-white text-sm tracking-widest font-medium disabled:opacity-30 hover:bg-black/80 transition-colors rounded-xl"
      >
        Continue <ArrowRight size={15} />
      </button>
    </div>
  );
}