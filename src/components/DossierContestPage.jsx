import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';

function isVideo(url) {
  return /\.(mp4|webm|ogg)(\?|$)/i.test(url || '');
}

function formatDeadline(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

export default function DossierContestPage({ page, dossier }) {
  const [form, setForm] = useState({ name: '', email: '', portfolio: '', message: '' });
  const [mediaFile, setMediaFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const types = Array.isArray(page?.contest_submission_types)
    ? page.contest_submission_types
    : ['text', 'link', 'media'];

  const isClosed = useMemo(() => {
    if (page?.contest_status === 'closed') return true;
    if (!page?.contest_deadline) return false;
    const deadline = new Date(page.contest_deadline);
    return !Number.isNaN(deadline.getTime()) && deadline.getTime() < Date.now();
  }, [page?.contest_status, page?.contest_deadline]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    const authenticated = await base44.auth.isAuthenticated();
    if (!authenticated) {
      base44.auth.redirectToLogin(window.location.href);
      return;
    }

    setSubmitting(true);
    try {
      let mediaUrls = [];
      if (mediaFile) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: mediaFile });
        mediaUrls = file_url ? [file_url] : [];
      }

      await base44.entities.ContestSubmission.create({
        dossier_id: dossier?.id || page?.dossier_id || '',
        contest_page_id: page.id,
        applicant_name: form.name.trim(),
        applicant_email: form.email.trim(),
        portfolio_url: form.portfolio.trim(),
        message: form.message.trim(),
        media_urls: mediaUrls,
        status: 'submitted',
      });
      setSubmitted(true);
    } catch (err) {
      setError(err?.message || 'Unable to submit your entry.');
    } finally {
      setSubmitting(false);
    }
  };

  const hero = page?.media_url_landscape || page?.media_url;
  const mediaStyle = page?.contest_media_style || 'hero';
  const overlayOpacity = Math.min(90, Math.max(0, Number(page?.contest_overlay_opacity ?? 45))) / 100;
  const accent = page?.contest_accent_color || '#ffffff';

  return (
    <div className="absolute inset-0 bg-black overflow-y-auto pointer-events-auto">
      {hero && mediaStyle === 'background' && (
        <div className="fixed inset-0 z-0 pointer-events-none">
          {isVideo(hero) ? (
            <video src={hero} autoPlay muted loop playsInline className="w-full h-full object-cover" />
          ) : (
            <img src={hero} alt="" className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-black" style={{ opacity: overlayOpacity }} />
        </div>
      )}
      {hero && mediaStyle === 'hero' && (
        <div className="relative z-10 w-full h-[34vh] min-h-56 border-b border-white/15 overflow-hidden">
          {isVideo(hero) ? (
            <video src={hero} autoPlay muted loop playsInline controls className="w-full h-full object-cover" />
          ) : (
            <img src={hero} alt="" className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-black pointer-events-none" style={{ opacity: overlayOpacity * 0.6 }} />
        </div>
      )}

      <div className="relative z-10 max-w-5xl mx-auto px-5 md:px-10 pt-8 pb-32">
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="border border-white/25 px-3 py-1 text-white/70 text-[11px] uppercase tracking-[0.2em]">
            {page?.contest_category || 'Open Call'}
          </span>
          {page?.contest_deadline && (
            <span className="border border-white/15 px-3 py-1 text-white/55 text-[11px] uppercase tracking-[0.16em]">
              Deadline · {formatDeadline(page.contest_deadline)}
            </span>
          )}
          <span className={`border px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${isClosed ? 'border-red-500/40 text-red-300' : 'border-emerald-500/40 text-emerald-300'}`}>
            {isClosed ? 'Closed' : 'Open'}
          </span>
        </div>

        {!page?.hide_title && (
          <h2 className="text-white text-3xl md:text-5xl font-extralight tracking-wide leading-tight">
            {page?.title || 'Contest'}
          </h2>
        )}

        {page?.content && (
          <div
            className="text-white/75 text-sm md:text-base leading-relaxed mt-5 max-w-3xl"
            dangerouslySetInnerHTML={{ __html: page.content }}
          />
        )}

        {(page?.contest_reward || page?.contest_rules) && (
          <div className="grid md:grid-cols-2 gap-px bg-white/15 border border-white/15 mt-8">
            {page?.contest_reward && (
              <div className="bg-neutral-950 p-5">
                <p className="text-white/45 text-[11px] uppercase tracking-[0.2em] mb-2">Opportunity / Prize</p>
                <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{page.contest_reward}</p>
              </div>
            )}
            {page?.contest_rules && (
              <div className="bg-neutral-950 p-5">
                <p className="text-white/45 text-[11px] uppercase tracking-[0.2em] mb-2">How to enter</p>
                <p className="text-white/75 text-sm leading-relaxed whitespace-pre-wrap">{page.contest_rules}</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-9 border-t border-white/20 pt-7 max-w-3xl">
          <p className="text-white/50 text-xs uppercase tracking-[0.24em] mb-3">Submit your entry</p>

          {submitted ? (
            <div className="border border-emerald-500/35 bg-emerald-950/20 p-6">
              <p className="text-emerald-300 text-lg font-light">Entry received.</p>
              <p className="text-white/60 text-sm mt-2">Thank you for taking part in {page?.title || dossier?.title || 'this contest'}.</p>
            </div>
          ) : isClosed ? (
            <div className="border border-white/15 p-6 text-white/55 text-sm">Submissions are closed.</div>
          ) : (
            <form onSubmit={submit} className="space-y-4" onTouchStart={(event) => event.stopPropagation()}>
              <div className="grid md:grid-cols-2 gap-4">
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="Your name"
                  required
                  className="w-full bg-neutral-950 border border-white/20 text-white px-4 py-3 outline-none focus:border-white/50"
                />
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  placeholder="Email"
                  required
                  className="w-full bg-neutral-950 border border-white/20 text-white px-4 py-3 outline-none focus:border-white/50"
                />
              </div>

              {types.includes('link') && (
                <input
                  type="url"
                  value={form.portfolio}
                  onChange={(event) => setForm({ ...form, portfolio: event.target.value })}
                  placeholder="Portfolio / website / social link"
                  className="w-full bg-neutral-950 border border-white/20 text-white px-4 py-3 outline-none focus:border-white/50"
                />
              )}

              {types.includes('text') && (
                <textarea
                  value={form.message}
                  onChange={(event) => setForm({ ...form, message: event.target.value })}
                  placeholder="Tell us about your submission"
                  rows={5}
                  className="w-full bg-neutral-950 border border-white/20 text-white px-4 py-3 outline-none focus:border-white/50 resize-y"
                />
              )}

              {types.includes('media') && (
                <label className="block border border-dashed border-white/25 p-4 text-white/60 text-sm cursor-pointer hover:border-white/50 transition-colors">
                  <span>{mediaFile ? mediaFile.name : 'Add an image or video'}</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(event) => setMediaFile(event.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              )}

              {error && <p className="text-red-300 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full md:w-auto px-8 py-3 font-medium tracking-wide disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: accent, color: '#000000' }}
              >
                {submitting ? 'Submitting…' : (page?.contest_cta_label || 'Submit entry')}
              </button>
              <p className="text-white/35 text-xs">A member account is required to submit an entry.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
