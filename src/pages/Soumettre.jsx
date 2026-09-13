import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Upload, Clock, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Soumettre() {
  const [user, setUser] = useState(null);
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [todaySubmission, setTodaySubmission] = useState(null);
  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    description: '',
    author_name: '',
    duration_days: 7,
    cover_image: '',
    class: 'Videos',
  });

  useEffect(() => {
    const init = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (!isAuth) {
          base44.auth.redirectToLogin(window.location.href);
          return;
        }
        const me = await base44.auth.me();
        setUser(me);

        // Check approved membership
        const memberships = await base44.entities.Membership.filter({
          user_email: me.email,
          status: 'approved',
        });
        if (memberships.length > 0) {
          setMembership(memberships[0]);
        } else {
          // Fallback: treat as publisher if no membership record (e.g. admin or profile member)
          setMembership({ membership_type: 'publisher' });
        }

        // Check if already submitted today (skip for admins)
        if (me.role !== 'admin') {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const recent = await base44.entities.Dossier.filter({ submitted_by_email: me.email });
          const todayOne = recent.find(d => {
            if (!d.submitted_at) return false;
            const sub = new Date(d.submitted_at);
            sub.setHours(0, 0, 0, 0);
            return sub.getTime() === today.getTime();
          });
          setTodaySubmission(todayOne || null);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, cover_image: file_url }));
    } finally {
      setUploading(false);
    }
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const publishUntil = new Date(now);
      publishUntil.setDate(publishUntil.getDate() + form.duration_days);

      return base44.entities.Dossier.create({
        title: form.title,
        subtitle: form.subtitle,
        description: form.description,
        author_name: form.author_name || user.full_name,
        cover_image: form.cover_image,
        class: form.class,
        status: 'pending_review',
        order: 999,
        submitted_by_email: user.email,
        submitted_by_name: user.full_name,
        membership_type: membership.membership_type,
        duration_days: form.duration_days,
        publish_until: publishUntil.toISOString(),
        submitted_at: now.toISOString(),
        requires_payment: membership.membership_type === 'brand',
        payment_confirmed: false,
      });
    },
    onSuccess: () => setSubmitted(true),
  });

  const isValid = form.title.trim() && form.cover_image;

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!membership) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle size={40} className="text-yellow-400 mb-4" />
        <h2 className="text-white text-xl font-light mb-2">Membership Required</h2>
        <p className="text-white text-sm mb-6">You need an approved membership to submit content.</p>
        <Link to="/Membership" className="px-6 py-3 bg-white text-black text-sm rounded-lg hover:bg-white/90">
          Apply for Membership
        </Link>
      </div>
    );
  }

  if (todaySubmission) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 text-center">
        <Clock size={40} className="text-yellow-400 mb-4" />
        <h2 className="text-white text-xl font-light mb-2">Daily Limit Reached</h2>
        <p className="text-white text-sm mb-2">You have already submitted a dossier today.</p>
        <p className="text-white/20 text-xs">Come back tomorrow to submit new content.</p>
        <div className="mt-6 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-left max-w-sm w-full">
          <p className="text-white text-xs tracking-widest mb-1">TODAY'S SUBMISSION</p>
          <p className="text-white text-sm font-medium">{todaySubmission.title}</p>
          <p className="text-white text-xs mt-1 capitalize">{todaySubmission.status.replace('_', ' ')}</p>
        </div>
        <Link to="/" className="mt-6 text-white text-sm hover:text-white flex items-center gap-2">
          <ArrowLeft size={14} /> Back
        </Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
          <CheckCircle size={48} className="text-green-400 mb-4 mx-auto" />
        </motion.div>
        <h2 className="text-white text-xl font-light mb-2">Submission Sent!</h2>
        <p className="text-white text-sm mb-2">Your dossier is pending review.</p>
        {membership.membership_type === 'brand' && (
          <p className="text-yellow-400/70 text-xs mt-2">⚠️ Fees apply for Brand publications. An admin will contact you.</p>
        )}
        <Link to="/" className="mt-8 text-white text-sm hover:text-white flex items-center gap-2">
          <ArrowLeft size={14} /> Back to home
        </Link>
      </div>
    );
  }

  const membershipColors = {
    publisher: 'bg-black text-white border-white/20',
    influencer: 'bg-red-600/20 text-red-400 border-red-600/30',
    brand: 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30',
  };

  return (
    <div className="min-h-screen bg-black pb-20">
      {/* Header */}
      <div className="px-4 py-4 border-b border-white/10 flex items-center gap-4">
        <Link to="/" className="text-white hover:text-white">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-white text-lg font-extralight tracking-widest">SUBMIT A DOSSIER</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Membership badge */}
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${membershipColors[membership.membership_type]}`}>
          {membership.membership_type.toUpperCase()}
          {membership.membership_type === 'brand' && <span className="text-yellow-400/60">· Fees apply</span>}
        </div>

        {/* Title */}
        <div>
          <label className="text-white text-xs tracking-widest block mb-2">TITLE *</label>
          <input
            type="text"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Dossier title"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-white/30"
          />
        </div>

        {/* Subtitle */}
        <div>
          <label className="text-white text-xs tracking-widest block mb-2">SUBTITLE</label>
          <input
            type="text"
            value={form.subtitle}
            onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))}
            placeholder="Optional"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-white/30"
          />
        </div>

        {/* Author name */}
        <div>
          <label className="text-white text-xs tracking-widest block mb-2">AUTHOR NAME</label>
          <input
            type="text"
            value={form.author_name}
            onChange={e => setForm(f => ({ ...f, author_name: e.target.value }))}
            placeholder={user?.full_name || 'Your name'}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-white/30"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-white text-xs tracking-widest block mb-2">DESCRIPTION / PITCH</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={4}
            placeholder="Describe your content and artistic intention..."
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/20 focus:outline-none focus:border-white/30 resize-none"
          />
        </div>

        {/* Class */}
        <div>
          <label className="text-white text-xs tracking-widest block mb-2">CLASS</label>
          <select
            value={form.class}
            onChange={e => setForm(f => ({ ...f, class: e.target.value }))}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/30"
          >
            <option value="Videos" className="bg-black">Videos</option>
            <option value="Story" className="bg-black">Story</option>
            <option value="Assets" className="bg-black">Assets</option>
            <option value="Kits" className="bg-black">Kits</option>
            <option value="Merchandise" className="bg-black">Merchandise</option>
          </select>
        </div>

        {/* Cover image */}
        <div>
          <label className="text-white text-xs tracking-widest block mb-2">COVER IMAGE *</label>
          {form.cover_image ? (
            <div className="relative">
              <img src={form.cover_image} alt="" className="w-full h-48 object-cover rounded-xl" />
              <button
                onClick={() => setForm(f => ({ ...f, cover_image: '' }))}
                className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black"
              >
                ×
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-white/30 transition-colors">
              {uploading ? (
                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Upload size={24} className="text-white/20 mb-2" />
                  <span className="text-white text-sm">Upload an image</span>
                </>
              )}
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          )}
        </div>

        {/* Duration */}
        <div>
          <label className="text-white text-xs tracking-widest block mb-2">
            PUBLICATION DURATION — <span className="text-white">{form.duration_days} day{form.duration_days > 1 ? 's' : ''}</span>
          </label>
          <input
            type="range"
            min={1}
            max={user?.role === 'admin' ? 365 : 30}
            value={form.duration_days}
            onChange={e => setForm(f => ({ ...f, duration_days: parseInt(e.target.value) }))}
            className="w-full accent-white"
          />
          <div className="flex justify-between text-white/20 text-xs mt-1">
            <span>1 day</span>
            <span>{user?.role === 'admin' ? '365 days max' : '30 days max'}</span>
          </div>
        </div>

        {/* Brand warning */}
        {membership.membership_type === 'brand' && (
          <div className="flex gap-3 p-4 bg-yellow-400/10 border border-yellow-400/20 rounded-xl">
            <AlertCircle size={18} className="text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-400 text-sm font-medium">Fees apply</p>
              <p className="text-yellow-400/60 text-xs mt-1">As a Brand, publication fees apply. An admin will contact you after review to confirm payment before going live.</p>
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={() => submitMutation.mutate()}
          disabled={!isValid || submitMutation.isPending}
          className="w-full py-4 bg-white text-black text-sm font-medium rounded-xl hover:bg-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {submitMutation.isPending ? 'Submitting...' : 'Submit dossier'}
        </button>

        <p className="text-white/20 text-xs text-center">
          {user?.role === 'admin' ? 'Admin · No daily limit · Up to 365 days · Approval required' : 'Max 1 submission per day · Max 30 days publication · Approval required'}
        </p>
      </div>
    </div>
  );
}