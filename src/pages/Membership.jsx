import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { CheckCircle, Clock, XCircle } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

const MEMBERSHIP_TYPES = [
  {
    id: 'publisher',
    label: 'Publisher',
    description: 'Submit editorial articles and dossiers for publication in the magazine.',
    features: ['Submit dossiers', 'Dedicated editorial space', 'Visible author credits'],
    color: 'bg-black text-white',
    accent: 'border-black',
  },
  {
    id: 'influencer',
    label: 'Influencer',
    description: 'Public profile visible to the community, with photo gallery and links.',
    features: ['Public profile', 'Personalized gallery', 'Visible external links'],
    color: 'bg-red-600 text-white',
    accent: 'border-red-600',
  },
  {
    id: 'brand',
    label: 'Brand',
    description: 'Publish your offers and products in the shop.',
    features: ['Product listings', 'Dedicated shop page', 'Visible promotions'],
    color: 'bg-yellow-600 text-white',
    accent: 'border-yellow-600',
  },
];

const MEMBERSHIP_DESCRIPTIONS = {
  publisher: 'Submit editorial articles and dossiers for publication in the magazine.',
  influencer: 'Public profile visible to the community, with photo gallery and links.',
  brand: 'Publish your offers and products in the shop.',
};

export default function Membership() {
  const { user, isLoadingAuth } = useAuth();
  const [step, setStep] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('preview') === 'submitted') return 'submitted';
    return 'choose';
  });
  const [previewMode, setPreviewMode] = useState(false);
  const [showPreviewBtn, setShowPreviewBtn] = useState(true);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ bio: '', website: '' });
  const [loading, setLoading] = useState(false);
  const [existingMembership, setExistingMembership] = useState(null);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [membershipPricing, setMembershipPricing] = useState([]);
  const [loadingPricing, setLoadingPricing] = useState(true);
  const [tokenPackages, setTokenPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [showTokens, setShowTokens] = useState(false);

  useEffect(() => {
    if (!user || user.role === 'admin') return;
    setCheckingExisting(true);
    base44.entities.Membership.filter({ user_email: user.email })
      .then(memberships => { if (memberships.length > 0) setExistingMembership(memberships[0]); })
      .catch(() => {})
      .finally(() => setCheckingExisting(false));
  }, [user]);

  useEffect(() => {
    base44.entities.MembershipPricing.list()
      .then(pricing => {
        const sorted = [...pricing].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setMembershipPricing(sorted);
      })
      .catch(() => {})
      .finally(() => setLoadingPricing(false));
    
    base44.entities.TokenPackage.list()
      .then(packages => {
        const sorted = [...packages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setTokenPackages(sorted);
      })
      .catch(() => {})
      .finally(() => setLoadingPackages(false));
  }, []);

  const handleSubmit = async () => {
    if (!selected || !user) return;
    setLoading(true);
    try {
      await base44.entities.Membership.create({
        user_email: user.email,
        user_name: user.full_name,
        membership_type: selected,
        status: 'pending',
        bio: form.bio,
        website: form.website,
      });
      setStep('submitted');
    } finally {
      setLoading(false);
    }
  };

  // === PREVIEW MODE - SHOW CONFIRMATION DIRECTLY ===
  if (previewMode && step === 'submitted') {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center px-8 overflow-auto">
        <div className="max-w-md w-full text-center">
          <CheckCircle size={80} className="text-green-700 mx-auto mb-8" strokeWidth={1.5} />
          <h2 className="text-4xl font-bold text-black mb-4 tracking-tight">Application Submitted</h2>
          <p className="text-white text-lg mb-12 leading-relaxed">Thank you for your application. We'll review it and get back to you by email within 3-5 business days.</p>

          <div className="border-t border-gray-200 pt-8">
            <h3 className="text-sm font-semibold text-black uppercase tracking-wider mb-4">What happens next</h3>
            <div className="space-y-3 text-left">
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-green-700 mt-2 flex-shrink-0" />
                <p className="text-white text-sm">Our team reviews your application</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-green-700 mt-2 flex-shrink-0" />
                <p className="text-white text-sm">You'll receive an email with our decision</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-green-700 mt-2 flex-shrink-0" />
                <p className="text-white text-sm">Once approved, you'll get full access to your membership benefits</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setPreviewMode(false);
              setStep('choose');
            }}
            className="mt-12 text-white hover:text-black text-sm font-medium transition-colors"
          >
            Exit preview
          </button>
        </div>
      </motion.div>
    );
  }

  // === NOT LOGGED IN ===
  if (!user) {
    return (
      <div className="min-h-screen bg-yellow-400 flex flex-col items-center justify-center text-center px-8 pb-20">
        <h1 className="text-5xl font-black tracking-widest mb-4">ACCOUNT</h1>
        <p className="text-black text-lg font-bold mb-12">Sign in or create an account to continue</p>
        <div className="flex flex-col gap-5 w-full max-w-xs">
          <button
            onClick={() => base44.auth.redirectToLogin(window.location.href)}
            className="w-full py-5 bg-black text-yellow-400 text-xl tracking-widest font-black rounded-2xl"
          >
            LOG IN
          </button>
          <button
            onClick={() => base44.auth.redirectToLogin(window.location.href)}
            className="w-full py-5 bg-white text-black text-xl tracking-widest font-black rounded-2xl border-4 border-black"
          >
            CREATE ACCOUNT
          </button>
        </div>
      </div>
    );
  }

  // === LOADING (checking existing membership) ===
  if (checkingExisting) {
    return (
      <div className="min-h-screen bg-yellow-400 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-black/30 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  const statusConfig = {
    pending: { icon: Clock, label: 'Pending approval', color: 'text-yellow-700', bg: 'bg-yellow-200' },
    approved: { icon: CheckCircle, label: 'Active membership', color: 'text-green-800', bg: 'bg-green-200' },
    rejected: { icon: XCircle, label: 'Application rejected', color: 'text-red-800', bg: 'bg-red-200' },
  };

  // === MEMBERSHIP FORM ===
  return (
    <div className="min-h-screen bg-yellow-400 pb-24 px-4 pt-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-center gap-4 mb-6">
          <button
            onClick={() => setShowTokens(false)}
            className={`px-6 py-3 rounded-full font-black tracking-widest ${!showTokens ? 'bg-black text-white' : 'bg-white text-black border-2 border-black'}`}
          >
            MEMBERSHIPS
          </button>
          <button
            onClick={() => setShowTokens(true)}
            className={`px-6 py-3 rounded-full font-black tracking-widest ${showTokens ? 'bg-black text-white' : 'bg-white text-black border-2 border-black'}`}
          >
            TOKENS
          </button>
        </div>

        {/* Preview Toggle */}
        {showPreviewBtn && (
          <div className="text-center mb-6">
            {previewMode ? (
              <button
                onClick={() => {
                  setPreviewMode(false);
                  setStep('choose');
                }}
                className="text-xs bg-black text-white px-4 py-2 rounded-full hover:bg-black/80 font-bold"
              >
                Exit Preview Mode
              </button>
            ) : (
              <button
                onClick={() => {
                  setPreviewMode(true);
                  setStep('submitted');
                }}
                className="text-xs bg-white text-black px-4 py-2 rounded-full hover:bg-white/80 border-2 border-black font-bold"
              >
                Preview Confirmation Message
              </button>
            )}
          </div>
        )}

        {existingMembership && (() => {
          const cfg = statusConfig[existingMembership.status];
          const Icon = cfg.icon;
          const typeInfo = MEMBERSHIP_TYPES.find(t => t.id === existingMembership.membership_type);
          return (
            <div className={`flex items-center gap-3 px-5 py-4 rounded-2xl mb-6 ${cfg.bg}`}>
              <Icon size={22} className={cfg.color} />
              <div>
                <p className={`text-base font-black ${cfg.color}`}>{cfg.label} — {typeInfo?.label}</p>
                <p className="text-sm font-bold text-black">You can apply for a different membership below</p>
              </div>
            </div>
          );
        })()}

        <div className="flex items-center justify-center gap-3 mb-8">
          <span className="text-base font-bold text-black">{user.email}</span>
          <button onClick={() => base44.auth.logout(window.location.href)} className="text-base font-black text-white bg-red-600 px-4 py-2 rounded-lg">Log out</button>
        </div>

        {showTokens ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {loadingPackages ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-10 h-10 border-4 border-black/30 border-t-black rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {tokenPackages.length > 0 ? (
                  tokenPackages.map((pkg) => (
                    <div key={pkg.id} className="w-full p-6 rounded-2xl border-4 border-black/20 bg-white/80">
                      <div className="flex items-start justify-between mb-3">
                        <span className="inline-block px-4 py-2 rounded-full text-base font-black tracking-widest bg-black text-white">{pkg.name}</span>
                        {pkg.bonus_percentage > 0 && (
                          <span className="inline-block px-3 py-1 rounded-full text-sm font-black bg-yellow-400 text-black">+{pkg.bonus_percentage}% BONUS</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-3xl font-black text-black">${pkg.price}</span>
                        <span className="text-lg font-bold text-black">• {pkg.token_amount} tokens</span>
                        {pkg.bonus_percentage > 0 && (
                          <span className="text-sm font-bold text-green-700 bg-green-200 px-2 py-1 rounded">
                            +{Math.round(pkg.token_amount * (pkg.bonus_percentage / 100))} bonus tokens
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-black">
                        Total: <span className="font-black">{pkg.token_amount + Math.round(pkg.token_amount * (pkg.bonus_percentage / 100))} tokens</span>
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-black font-bold">No token packages available</div>
                )}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {loadingPricing ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-10 h-10 border-4 border-black/30 border-t-black rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {membershipPricing.length > 0 ? (
                    membershipPricing.map((pricing) => {
                      const typeInfo = MEMBERSHIP_TYPES.find(t => t.id === pricing.membership_type.toLowerCase());
                      const displayLabel = typeInfo?.label || pricing.membership_type;
                      const description = MEMBERSHIP_DESCRIPTIONS[pricing.membership_type.toLowerCase()] || typeInfo?.description || '';
                      const features = typeInfo?.features || [];
                      return (
                        <button key={pricing.id} onClick={() => setSelected(pricing.membership_type.toLowerCase())}
                          className={`w-full text-left p-6 rounded-2xl border-4 transition-all ${selected === pricing.membership_type.toLowerCase() ? (typeInfo?.accent || 'border-black') + ' bg-white shadow-lg' : 'border-black/20 bg-white/60 hover:bg-white/80'}`}>
                          <div className="flex items-start justify-between mb-2">
                            <span className={`inline-block px-4 py-2 rounded-full text-base font-black tracking-widest ${typeInfo?.color || 'bg-black text-white'}`}>{displayLabel}</span>
                            {selected === pricing.membership_type.toLowerCase() && <CheckCircle size={28} className="text-black flex-shrink-0" />}
                          </div>
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl font-black text-black">${pricing.price_monthly}<span className="text-sm font-bold text-black">/mo</span></span>
                            {pricing.tokens_included > 0 && (
                              <span className="text-sm font-bold text-black bg-black/10 px-2 py-1 rounded">• {pricing.tokens_included} tokens included</span>
                            )}
                          </div>
                          <p className="text-base font-bold text-black mt-3 mb-3">{description}</p>
                          <ul className="space-y-2">
                            {features.map(f => (
                              <li key={f} className="text-base font-bold text-black flex items-center gap-2">
                                <span className="w-2 h-2 bg-black/50 rounded-full" />{f}
                              </li>
                            ))}
                          </ul>
                        </button>
                      );
                    })
                  ) : (
                    MEMBERSHIP_TYPES.map((type) => (
                      <button key={type.id} onClick={() => setSelected(type.id)}
                        className={`w-full text-left p-6 rounded-2xl border-4 transition-all ${selected === type.id ? type.accent + ' bg-white shadow-lg' : 'border-black/20 bg-white/60 hover:bg-white/80'}`}>
                        <div className="flex items-start justify-between mb-2">
                          <span className={`inline-block px-4 py-2 rounded-full text-base font-black tracking-widest ${type.color}`}>{type.label}</span>
                          {selected === type.id && <CheckCircle size={28} className="text-black flex-shrink-0" />}
                        </div>
                        <p className="text-base font-bold text-black mt-3 mb-3">{type.description}</p>
                        <ul className="space-y-2">
                          {type.features.map(f => (
                            <li key={f} className="text-base font-bold text-black flex items-center gap-2">
                              <span className="w-2 h-2 bg-black/50 rounded-full" />{f}
                            </li>
                          ))}
                        </ul>
                      </button>
                    ))
                  )}
                </div>
                <button onClick={() => selected && setStep('form')} disabled={!selected}
                  className="w-full mt-10 py-5 bg-black text-white text-xl tracking-widest font-black disabled:opacity-40 rounded-xl">
                  CONTINUE
                </button>
              </>
            )}
          </motion.div>
        )}

        {step === 'form' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="bg-white/80 rounded-2xl p-6 mb-6">
              <button onClick={() => setStep('choose')} className="text-black font-black text-lg mb-6 block">← Back</button>
              <div className="space-y-5">
                <div>
                  <label className="block text-base font-black tracking-widest text-black mb-2">ABOUT YOU *</label>
                  <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })}
                    placeholder="Who are you? Why this membership?" rows={4}
                    className="w-full px-4 py-3 bg-white border-2 border-black/30 rounded-lg text-base font-bold focus:outline-none focus:border-black resize-none" />
                </div>
                <div>
                  <label className="block text-base font-black tracking-widest text-black mb-2">WEBSITE / SOCIAL LINK</label>
                  <input type="text" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-4 py-3 bg-white border-2 border-black/30 rounded-lg text-base font-bold focus:outline-none focus:border-black" />
                </div>
              </div>
            </div>
            <button onClick={handleSubmit} disabled={!form.bio.trim() || loading}
              className="w-full py-5 bg-black text-white text-xl tracking-widest font-black disabled:opacity-30 hover:bg-black/80 transition-colors rounded-xl">
              {loading ? 'Sending...' : 'SUBMIT APPLICATION'}
            </button>
          </motion.div>
        )}

        {step === 'submitted' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center px-8 overflow-auto">
            <div className="max-w-md w-full text-center">
              <CheckCircle size={80} className="text-green-700 mx-auto mb-8" strokeWidth={1.5} />
              <h2 className="text-4xl font-bold text-black mb-4 tracking-tight">Application Submitted</h2>
              <p className="text-white text-lg mb-12 leading-relaxed">Thank you for your application. We'll review it and get back to you by email within 3-5 business days.</p>

              <div className="border-t border-gray-200 pt-8">
                <h3 className="text-sm font-semibold text-black uppercase tracking-wider mb-4">What happens next</h3>
                <div className="space-y-3 text-left">
                  <div className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-700 mt-2 flex-shrink-0" />
                    <p className="text-white text-sm">Our team reviews your application</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-700 mt-2 flex-shrink-0" />
                    <p className="text-white text-sm">You'll receive an email with our decision</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-700 mt-2 flex-shrink-0" />
                    <p className="text-white text-sm">Once approved, you'll get full access to your membership benefits</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => base44.auth.logout(window.location.href)}
                className="mt-12 text-white hover:text-black text-sm font-medium transition-colors"
              >
                Return to home
              </button>
            </div>

            {previewMode && (
              <div className="fixed bottom-4 right-4 p-4 bg-gray-100 border border-gray-300 rounded-lg max-w-xs">
                <p className="text-xs font-semibold text-black mb-1">🎨 Preview Mode</p>
                <p className="text-xs text-white">Edit this confirmation message in pages/Membership (step === 'submitted' section)</p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}