import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { CheckCircle, ImagePlus, Link as LinkIcon, Mail, Megaphone, UserRound } from 'lucide-react';

const MAX_FILE_MB = 2;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function StepTitle({ number, title, subtitle }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center border border-[#23c7be]/35 bg-[#23c7be]/10 text-xs font-black text-[#8ee9e4]">{number}</div>
      <div>
        <h2 className="text-sm font-black uppercase tracking-[0.14em] text-white">{title}</h2>
        {subtitle && <p className="mt-1 text-xs leading-relaxed text-white/40">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function SponsorRequest() {
  const [searchParams] = useSearchParams();
  const preselectedEmail = searchParams.get('member') || '';
  const [profiles, setProfiles] = useState([]);
  const [brackets, setBrackets] = useState([]);
  const [contents, setContents] = useState([]);
  const [loadingContents, setLoadingContents] = useState(false);
  const [uploading, setUploading] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    member_email: preselectedEmail,
    target_content_id: '',
    bracket_id: '',
    sponsor_name: '',
    sponsor_email: '',
    logo_url: '',
    image_url: '',
    link: '',
    promo_title: '',
    promo_text: '',
    cta_label: 'Learn more',
    placement_logo: true,
    placement_link: true,
    placement_promo: false,
    placement_mention: false,
    terms_accepted: false,
  });

  useEffect(() => {
    Promise.all([
      base44.entities.MemberProfile.list('display_name'),
      base44.entities.SponsorBracket.filter({ is_active: true }, 'name'),
    ]).then(([p, b]) => {
      setProfiles(p || []);
      setBrackets(b || []);
    });
  }, []);

  useEffect(() => {
    if (!form.member_email) {
      setContents([]);
      return;
    }
    let cancelled = false;
    setLoadingContents(true);
    base44.functions.invoke('getMemberDossiers', { memberEmail: form.member_email })
      .then(res => { if (!cancelled) setContents(res.data?.dossiers || []); })
      .catch(() => { if (!cancelled) setContents([]); })
      .finally(() => { if (!cancelled) setLoadingContents(false); });
    return () => { cancelled = true; };
  }, [form.member_email]);

  const selectedProfile = useMemo(() => profiles.find(p => p.user_email === form.member_email), [profiles, form.member_email]);
  const selectedContent = useMemo(() => contents.find(d => String(d.id) === String(form.target_content_id)), [contents, form.target_content_id]);
  const selectedBracket = useMemo(() => brackets.find(b => b.id === form.bracket_id), [brackets, form.bracket_id]);
  const orderedBrackets = useMemo(() => [...brackets].sort((a, b) => Number(a.price || 0) - Number(b.price || 0)), [brackets]);

  const upload = async (event, field) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type) || file.size > MAX_FILE_MB * 1024 * 1024) {
      alert('Use JPG, PNG, WebP or GIF under 2 MB.');
      return;
    }
    setUploading(field);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, [field]: result.file_url }));
    } finally {
      setUploading('');
    }
  };

  const submit = async () => {
    if (!form.member_email || !selectedContent || !selectedBracket || !form.sponsor_name || !form.sponsor_email || !form.terms_accepted) return;
    const price = Number(selectedBracket.price || 0);
    setSubmitting(true);
    try {
      await base44.entities.ProfileSponsor.create({
        member_email: form.member_email,
        target_content_id: String(selectedContent.id),
        target_content_title: selectedContent.title || 'Untitled content',
        target_content_type: 'dossier',
        bracket_id: selectedBracket.id,
        bracket_name: selectedBracket.name || '',
        bracket_price: price,
        bracket_duration: '',
        platform_share: Number((price * 0.30).toFixed(2)),
        member_share: Number((price * 0.70).toFixed(2)),
        sponsor_name: form.sponsor_name,
        sponsor_email: form.sponsor_email,
        logo_url: form.logo_url,
        image_url: form.image_url,
        link: form.link ? (form.link.startsWith('http') ? form.link : 'https://' + form.link) : '',
        promo_title: form.promo_title,
        promo_text: form.promo_text,
        cta_label: form.cta_label || 'Learn more',
        placement_logo: form.placement_logo,
        placement_link: form.placement_link,
        placement_promo: form.placement_promo,
        placement_mention: form.placement_mention,
        is_active: false,
        status: 'pending',
        terms_accepted: true,
        submitted_at: new Date().toISOString(),
      });
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#202328] px-4 py-10 pb-32 text-white md:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl border border-white/10 bg-[#17191d] p-7 md:p-10">
          <CheckCircle size={48} className="mb-5 text-[#23c7be]" />
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#23c7be]">AISTAGE.ONE · Sponsorship</p>
          <h1 className="mt-2 text-3xl font-black tracking-[0.06em]">REQUEST SUBMITTED</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/50">Your sponsorship request for <strong className="text-white">{selectedContent?.title}</strong> is pending review.</p>
          <div className="mt-7 grid gap-4 border-t border-white/10 pt-6 text-sm sm:grid-cols-2">
            <div><span className="block text-[10px] font-black uppercase tracking-wider text-white/35">Creator</span><span className="mt-1 block font-bold">{selectedProfile?.display_name || form.member_email}</span></div>
            <div><span className="block text-[10px] font-black uppercase tracking-wider text-white/35">Content</span><span className="mt-1 block font-bold">{selectedContent?.title}</span></div>
            <div><span className="block text-[10px] font-black uppercase tracking-wider text-white/35">Package</span><span className="mt-1 block font-bold">{selectedBracket?.name}</span></div>
            <div><span className="block text-[10px] font-black uppercase tracking-wider text-white/35">Amount</span><span className="mt-1 block font-bold text-[#8ee9e4]">{selectedBracket?.price} CAD</span></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#202328] px-3 py-4 pb-32 text-white md:px-6 md:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1240px] border border-white/10 bg-[#17191d] shadow-[0_22px_70px_rgba(0,0,0,0.28)]">
        <header className="border-b border-white/10 px-5 py-6 md:px-8 md:py-8 lg:px-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[#23c7be]">AISTAGE.ONE · Sponsorship</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">Become a Sponsor</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/45">Support a creator by choosing the exact published work where your sponsor presence will appear.</p>
            </div>
            <div className="max-w-sm border-l border-[#23c7be]/30 pl-4 text-xs leading-relaxed text-white/40">Choose the creator, the content, the sponsorship level and the materials you want displayed. Requests are reviewed before activation.</div>
          </div>
        </header>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
          <main className="min-w-0 px-5 py-6 md:px-8 md:py-8 lg:px-10">
            <section className="border-b border-white/10 pb-8">
              <StepTitle number="1" title="Creator" subtitle="Select the creator whose published content you want to sponsor." />
              <div className="relative mt-5">
                <UserRound size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <select value={form.member_email} onChange={e => setForm(f => ({ ...f, member_email: e.target.value, target_content_id: '' }))} className="h-12 w-full border border-white/15 bg-[#101214] pl-11 pr-4 font-bold text-white outline-none focus:border-[#23c7be]">
                  <option value="">Choose a creator…</option>
                  {profiles.map(p => <option key={p.id} value={p.user_email}>{p.display_name || p.user_email}</option>)}
                </select>
              </div>
            </section>

            <section className="border-b border-white/10 py-8">
              <StepTitle number="2" title="Content to sponsor" subtitle="Choose the exact published dossier where your sponsor presence will appear." />
              <div className="mt-5">
                {!form.member_email ? <div className="border border-dashed border-white/15 bg-white/[0.02] p-5 text-sm text-white/35">Choose a creator first.</div> :
                  loadingContents ? <div className="border border-white/10 bg-white/[0.02] p-5 text-sm text-white/55">Loading published content…</div> :
                  contents.length === 0 ? <div className="border border-dashed border-white/15 bg-white/[0.02] p-5 text-sm text-white/35">This creator has no published content available.</div> :
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {contents.map(d => {
                      const active = String(form.target_content_id) === String(d.id);
                      return (
                        <button key={d.id} type="button" onClick={() => setForm(f => ({ ...f, target_content_id: String(d.id) }))} className={`overflow-hidden border text-left transition ${active ? 'border-[#23c7be] bg-[#202328] shadow-[inset_3px_0_0_#23c7be]' : 'border-white/10 bg-[#101214] hover:border-white/25'}`}>
                          <div className="aspect-[16/10] bg-[#0d0f11]">
                            {d.cover_image ? <img src={d.cover_image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs font-black uppercase tracking-wider text-white/20">No cover</div>}
                          </div>
                          <div className="p-3">
                            <p className="line-clamp-2 font-black leading-tight text-white">{d.title || 'Untitled content'}</p>
                            {d.category && <p className="mt-1 text-xs text-white/35">{d.category}</p>}
                          </div>
                        </button>
                      );
                    })}
                  </div>}
              </div>
            </section>

            <section className="border-b border-white/10 py-8">
              <StepTitle number="3" title="Sponsorship package" subtitle="Choose the level that fits your campaign." />
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {orderedBrackets.map(b => {
                  const active = form.bracket_id === b.id;
                  return (
                    <button key={b.id} type="button" onClick={() => setForm(f => ({ ...f, bracket_id: b.id }))} className={`min-h-[112px] border p-4 text-left transition ${active ? 'border-[#23c7be] bg-[#23c7be]/10 shadow-[inset_3px_0_0_#23c7be]' : 'border-white/10 bg-[#101214] hover:border-white/25'}`}>
                      <span className={`block text-[10px] font-black uppercase tracking-[0.16em] ${active ? 'text-[#8ee9e4]' : 'text-white/35'}`}>Sponsor level</span>
                      <span className="mt-2 block text-lg font-black uppercase tracking-[0.06em] text-white">{b.name}</span>
                      <span className="mt-4 block text-xl font-black text-[#8ee9e4]">{b.price} <span className="text-xs">CAD</span></span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="pt-8">
              <StepTitle number="4" title="Sponsor presence" subtitle="Choose what will appear with the sponsored content, then provide the sponsor material." />

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ['placement_logo', 'Logo'],
                  ['placement_link', 'Clickable link'],
                  ['placement_promo', 'Promo block'],
                  ['placement_mention', 'Sponsor mention'],
                ].map(([key, label]) => <label key={key} className={`flex cursor-pointer items-center gap-3 border p-3.5 text-sm font-bold transition ${form[key] ? 'border-[#23c7be]/50 bg-[#23c7be]/10 text-white' : 'border-white/10 bg-[#101214] text-white/65'}`}><input type="checkbox" checked={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} className="h-4 w-4 accent-[#23c7be]" /><span>{label}</span></label>)}
              </div>

              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                <label className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">Sponsor name
                  <div className="relative mt-2"><UserRound size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" /><input className="h-11 w-full border border-white/15 bg-[#101214] pl-10 pr-3 text-sm font-semibold normal-case tracking-normal text-white outline-none focus:border-[#23c7be]" value={form.sponsor_name} onChange={e => setForm(f => ({ ...f, sponsor_name: e.target.value }))} /></div>
                </label>
                <label className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">Sponsor email
                  <div className="relative mt-2"><Mail size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" /><input className="h-11 w-full border border-white/15 bg-[#101214] pl-10 pr-3 text-sm font-semibold normal-case tracking-normal text-white outline-none focus:border-[#23c7be]" type="email" value={form.sponsor_email} onChange={e => setForm(f => ({ ...f, sponsor_email: e.target.value }))} /></div>
                </label>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="border border-white/10 bg-[#101214] p-4 text-sm font-bold text-white">Logo
                  <div className="mt-3 flex min-h-[118px] items-center justify-center border border-dashed border-white/15 bg-[#0d0f11] p-3 text-center">
                    <div>
                      <ImagePlus size={25} className="mx-auto mb-2 text-[#23c7be]" />
                      <input className="block max-w-full text-xs text-white/45 file:mr-3 file:border-0 file:bg-[#23c7be] file:px-3 file:py-2 file:text-xs file:font-black file:text-[#071211]" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => upload(e, 'logo_url')} />
                      {uploading === 'logo_url' && <span className="mt-2 block text-xs text-white/40">Uploading…</span>}
                    </div>
                  </div>
                  {form.logo_url && <img src={form.logo_url} alt="Sponsor logo" className="mt-3 h-20 max-w-full border border-white/10 bg-white object-contain p-2" />}
                </label>
                <label className="border border-white/10 bg-[#101214] p-4 text-sm font-bold text-white">Promo image
                  <div className="mt-3 flex min-h-[118px] items-center justify-center border border-dashed border-white/15 bg-[#0d0f11] p-3 text-center">
                    <div>
                      <ImagePlus size={25} className="mx-auto mb-2 text-[#23c7be]" />
                      <input className="block max-w-full text-xs text-white/45 file:mr-3 file:border-0 file:bg-[#23c7be] file:px-3 file:py-2 file:text-xs file:font-black file:text-[#071211]" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => upload(e, 'image_url')} />
                      {uploading === 'image_url' && <span className="mt-2 block text-xs text-white/40">Uploading…</span>}
                    </div>
                  </div>
                  {form.image_url && <img src={form.image_url} alt="Promo" className="mt-3 h-24 w-full border border-white/10 object-cover" />}
                </label>
              </div>

              <div className="mt-6 grid gap-4">
                <label className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">Destination link
                  <div className="relative mt-2"><LinkIcon size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" /><input className="h-11 w-full border border-white/15 bg-[#101214] pl-10 pr-3 text-sm font-semibold normal-case tracking-normal text-white outline-none placeholder:text-white/20 focus:border-[#23c7be]" placeholder="https://…" value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} /></div>
                </label>
                <label className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">Promo title<input className="mt-2 h-11 w-full border border-white/15 bg-[#101214] px-3 text-sm font-semibold normal-case tracking-normal text-white outline-none focus:border-[#23c7be]" value={form.promo_title} onChange={e => setForm(f => ({ ...f, promo_title: e.target.value }))} /></label>
                <label className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">Promo text<textarea className="mt-2 w-full border border-white/15 bg-[#101214] p-3 text-sm font-semibold normal-case tracking-normal text-white outline-none focus:border-[#23c7be]" rows="4" value={form.promo_text} onChange={e => setForm(f => ({ ...f, promo_text: e.target.value }))} /></label>
                <label className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">CTA label<input className="mt-2 h-11 w-full border border-white/15 bg-[#101214] px-3 text-sm font-semibold normal-case tracking-normal text-white outline-none focus:border-[#23c7be]" value={form.cta_label} onChange={e => setForm(f => ({ ...f, cta_label: e.target.value }))} /></label>
              </div>
            </section>
          </main>

          <aside className="border-t border-white/10 bg-[#101214] px-5 py-6 md:px-8 lg:border-l lg:border-t-0 lg:px-6 lg:py-8">
            <div className="lg:sticky lg:top-6">
              <div className="flex items-center gap-2 text-[#8ee9e4]"><Megaphone size={18} /><h2 className="text-sm font-black uppercase tracking-[0.14em]">Sponsorship summary</h2></div>
              <div className="mt-5 space-y-4 text-sm">
                <div className="border-b border-white/10 pb-4"><span className="block text-[10px] font-black uppercase tracking-wider text-white/30">Creator</span><span className="mt-1 block font-bold text-white">{selectedProfile?.display_name || 'Not selected'}</span></div>
                <div className="border-b border-white/10 pb-4"><span className="block text-[10px] font-black uppercase tracking-wider text-white/30">Content</span><span className="mt-1 block font-bold text-white">{selectedContent?.title || 'Not selected'}</span></div>
                <div className="border-b border-white/10 pb-4"><span className="block text-[10px] font-black uppercase tracking-wider text-white/30">Package</span><span className="mt-1 block font-bold text-white">{selectedBracket?.name || 'Not selected'}</span></div>
              </div>

              {selectedBracket && (
                <div className="mt-5 border border-[#23c7be]/40 bg-[#23c7be]/10 p-4">
                  <div className="flex items-end justify-between gap-3"><span className="text-xs font-black uppercase tracking-wider text-white/40">Total</span><span className="text-2xl font-black text-[#8ee9e4]">{selectedBracket.price} <span className="text-xs">CAD</span></span></div>
                  <div className="mt-4 border-t border-[#23c7be]/20 pt-3 text-xs text-white/55">
                    <div className="flex justify-between"><span>AI Stage One</span><span>{(Number(selectedBracket.price) * 0.30).toFixed(2)} CAD</span></div>
                    <div className="mt-1 flex justify-between"><span>Creator</span><span>{(Number(selectedBracket.price) * 0.70).toFixed(2)} CAD</span></div>
                  </div>
                </div>
              )}

              <label className="mt-6 flex items-start gap-3 border border-white/10 bg-[#17191d] p-4 text-xs leading-relaxed text-white/55"><input type="checkbox" className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[#23c7be]" checked={form.terms_accepted} onChange={e => setForm(f => ({ ...f, terms_accepted: e.target.checked }))} /><span>I confirm that I have the rights to the logo, images, text and links submitted for this sponsorship.</span></label>

              <button type="button" onClick={submit} disabled={submitting || !form.member_email || !form.target_content_id || !form.bracket_id || !form.sponsor_name || !form.sponsor_email || !form.terms_accepted} className="mt-4 w-full bg-[#23c7be] px-4 py-4 text-sm font-black uppercase tracking-[0.12em] text-[#071211] transition hover:bg-[#35d8cf] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/25">
                {submitting ? 'SUBMITTING…' : 'SUBMIT SPONSORSHIP REQUEST'}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
