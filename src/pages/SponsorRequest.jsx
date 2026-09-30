import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { CheckCircle } from 'lucide-react';

const MAX_FILE_MB = 2;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

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
    return <div className="min-h-screen bg-yellow-400 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 text-center">
        <CheckCircle size={48} className="mx-auto mb-4 text-green-600" />
        <h1 className="text-2xl font-bold tracking-widest">REQUEST SUBMITTED</h1>
        <p className="mt-3 text-sm">Your sponsorship request for <strong>{selectedContent?.title}</strong> is pending review.</p>
        <div className="mt-5 border-t border-black/10 pt-4 text-left text-sm space-y-1">
          <p><strong>Creator:</strong> {selectedProfile?.display_name || form.member_email}</p>
          <p><strong>Content:</strong> {selectedContent?.title}</p>
          <p><strong>Package:</strong> {selectedBracket?.name}</p>
          <p><strong>Amount:</strong> {selectedBracket?.price} CAD</p>
        </div>
      </div>
    </div>;
  }

  return <div className="min-h-screen bg-yellow-400 p-4 pb-24">
    <div className="max-w-2xl mx-auto bg-white p-6 md:p-8 space-y-7">
      <div>
        <h1 className="text-3xl font-bold tracking-widest">BECOME A SPONSOR</h1>
        <p className="mt-2 text-sm text-black/70">Choose a creator and the exact content where your sponsor presence will appear.</p>
      </div>

      <section className="space-y-3">
        <h2 className="font-bold tracking-wider">1. CREATOR</h2>
        <select value={form.member_email} onChange={e => setForm(f => ({ ...f, member_email: e.target.value, target_content_id: '' }))} className="w-full border border-black/20 p-3">
          <option value="">Choose a creator…</option>
          {profiles.map(p => <option key={p.id} value={p.user_email}>{p.display_name || p.user_email}</option>)}
        </select>
      </section>

      <section className="space-y-3">
        <h2 className="font-bold tracking-wider">2. CONTENT TO SPONSOR</h2>
        {!form.member_email ? <p className="text-sm text-black/50">Choose a creator first.</p> :
          loadingContents ? <p className="text-sm">Loading published content…</p> :
          contents.length === 0 ? <p className="text-sm text-black/50">This creator has no published content available.</p> :
          <div className="grid gap-3 sm:grid-cols-2">
            {contents.map(d => <button key={d.id} type="button" onClick={() => setForm(f => ({ ...f, target_content_id: String(d.id) }))} className={'text-left border p-3 ' + (String(form.target_content_id) === String(d.id) ? 'border-black bg-black text-white' : 'border-black/20')}>
              {d.cover_image && <img src={d.cover_image} alt="" className="w-full h-28 object-cover mb-2" />}
              <p className="font-semibold">{d.title || 'Untitled content'}</p>
              {d.category && <p className="text-xs opacity-60 mt-1">{d.category}</p>}
            </button>)}
          </div>}
      </section>

      <section className="space-y-3">
        <h2 className="font-bold tracking-wider">3. SPONSORSHIP PACKAGE</h2>
        <div className="grid gap-2">
          {brackets.map(b => <button key={b.id} type="button" onClick={() => setForm(f => ({ ...f, bracket_id: b.id }))} className={'flex items-center justify-between border p-4 ' + (form.bracket_id === b.id ? 'border-black bg-black text-white' : 'border-black/20')}>
            <span className="font-semibold">{b.name}</span>
            <span className="font-bold">{b.price} CAD</span>
          </button>)}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-bold tracking-wider">4. SPONSOR PRESENCE</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['placement_logo','Logo'],
            ['placement_link','Clickable link'],
            ['placement_promo','Promo block'],
            ['placement_mention','Sponsor mention'],
          ].map(([key,label]) => <label key={key} className="flex items-center gap-2 border border-black/15 p-3"><input type="checkbox" checked={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}/><span>{label}</span></label>)}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">Sponsor name<input className="mt-1 w-full border border-black/20 p-3" value={form.sponsor_name} onChange={e=>setForm(f=>({...f,sponsor_name:e.target.value}))}/></label>
          <label className="text-sm">Sponsor email<input className="mt-1 w-full border border-black/20 p-3" type="email" value={form.sponsor_email} onChange={e=>setForm(f=>({...f,sponsor_email:e.target.value}))}/></label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">Logo
            <input className="mt-1 block w-full" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>upload(e,'logo_url')}/>
            {uploading==='logo_url' && <span className="text-xs">Uploading…</span>}
            {form.logo_url && <img src={form.logo_url} alt="Sponsor logo" className="mt-2 h-16 max-w-full object-contain border border-black/10 p-2"/>}
          </label>
          <label className="text-sm">Promo image
            <input className="mt-1 block w-full" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>upload(e,'image_url')}/>
            {uploading==='image_url' && <span className="text-xs">Uploading…</span>}
            {form.image_url && <img src={form.image_url} alt="Promo" className="mt-2 h-24 w-full object-cover border border-black/10"/>}
          </label>
        </div>

        <label className="text-sm block">Destination link<input className="mt-1 w-full border border-black/20 p-3" placeholder="https://…" value={form.link} onChange={e=>setForm(f=>({...f,link:e.target.value}))}/></label>
        <label className="text-sm block">Promo title<input className="mt-1 w-full border border-black/20 p-3" value={form.promo_title} onChange={e=>setForm(f=>({...f,promo_title:e.target.value}))}/></label>
        <label className="text-sm block">Promo text<textarea className="mt-1 w-full border border-black/20 p-3" rows="3" value={form.promo_text} onChange={e=>setForm(f=>({...f,promo_text:e.target.value}))}/></label>
        <label className="text-sm block">CTA label<input className="mt-1 w-full border border-black/20 p-3" value={form.cta_label} onChange={e=>setForm(f=>({...f,cta_label:e.target.value}))}/></label>
      </section>

      {selectedBracket && <div className="border-t border-black/15 pt-4 text-sm">
        <p>Total: <strong>{selectedBracket.price} CAD</strong></p>
        <p>AISTAGE: {(Number(selectedBracket.price) * 0.30).toFixed(2)} · Creator: {(Number(selectedBracket.price) * 0.70).toFixed(2)}</p>
      </div>}

      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={form.terms_accepted} onChange={e=>setForm(f=>({...f,terms_accepted:e.target.checked}))}/><span>I confirm that I have the rights to the logo, images, text and links submitted for this sponsorship.</span></label>

      <button type="button" onClick={submit} disabled={submitting || !form.member_email || !form.target_content_id || !form.bracket_id || !form.sponsor_name || !form.sponsor_email || !form.terms_accepted} className="w-full bg-black text-white py-4 font-bold tracking-wider disabled:opacity-30">
        {submitting ? 'SUBMITTING…' : 'SUBMIT SPONSORSHIP REQUEST'}
      </button>
    </div>
  </div>;
}
