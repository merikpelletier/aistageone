import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Play, Users, PenTool, Code2, Handshake } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/base44Client';

const ROLE_ICONS = [Users, PenTool, Code2, Handshake];

function Media({ item, className = '' }) {
  if (!item?.media_url) return <div className={`bg-neutral-900 ${className}`} />;
  if (item.media_type === 'background_video') {
    return <video src={item.media_url} poster={item.poster_url || undefined} muted loop autoPlay playsInline className={`h-full w-full object-cover ${className}`} />;
  }
  if (item.media_type === 'video') {
    return <video src={item.media_url} poster={item.poster_url || undefined} controls playsInline preload="metadata" className={`h-full w-full object-contain bg-black ${className}`} />;
  }
  if (item.media_type === 'embed') {
    return <iframe src={item.media_url} title={item.title || 'AI STAGE ONE media'} className={`h-full w-full ${className}`} allow="autoplay; fullscreen; picture-in-picture" />;
  }
  return <img src={item.media_url} alt="" className={`h-full w-full object-cover ${className}`} />;
}

function SmartLink({ to, children, className = '' }) {
  if (!to) return null;
  if (to.startsWith('#') || to.startsWith('http://') || to.startsWith('https://') || to.startsWith('mailto:')) {
    return <a href={to} className={className}>{children}</a>;
  }
  return <Link to={to} className={className}>{children}</Link>;
}

function OptionalLink({ to, children, className = '' }) {
  if (!to) return <div className={className}>{children}</div>;
  return <SmartLink to={to} className={className}>{children}</SmartLink>;
}

function CTA({ label, url, primary = false }) {
  if (!label || !url) return null;
  const cls = `inline-flex items-center justify-center gap-2 border px-5 py-3 text-xs font-black tracking-[.16em] transition hover:-translate-y-0.5 ${primary ? 'border-[#c8a45f] bg-[#c8a45f] text-black hover:bg-[#d7b773]' : 'border-white/30 bg-black/35 text-white hover:border-white'}`;
  return <SmartLink to={url} className={cls}>{label}<ArrowRight size={14}/></SmartLink>;
}

export default function PrelaunchLanding() {
  const [waitlist, setWaitlist] = useState({ name: '', email: '', language: 'English', interest: 'Creator / Performer' });
  const [team, setTeam] = useState({ name: '', email: '', role_interest: '', portfolio_url: '', message: '' });
  const [waitMessage, setWaitMessage] = useState('');
  const [teamMessage, setTeamMessage] = useState('');
  const [sendingWait, setSendingWait] = useState(false);
  const [sendingTeam, setSendingTeam] = useState(false);

  const { data: sections = [] } = useQuery({
    queryKey: ['prelaunch-sections'],
    queryFn: async () => {
      const { data, error } = await supabase.from('landing_sections').select('*').eq('is_active', true).order('sort_order');
      if (error) throw error;
      return data || [];
    },
    staleTime: 15_000,
  });

  const { data: items = [] } = useQuery({
    queryKey: ['prelaunch-items'],
    queryFn: async () => {
      const { data, error } = await supabase.from('landing_section_items').select('*').eq('is_active', true).order('sort_order');
      if (error) throw error;
      return data || [];
    },
    staleTime: 15_000,
  });

  const byKey = useMemo(() => Object.fromEntries(sections.map(s => [s.section_key, s])), [sections]);
  const grouped = useMemo(() => items.reduce((acc, item) => {
    (acc[item.section_key] ||= []).push(item);
    return acc;
  }, {}), [items]);

  const hero = byKey.hero;
  const heroNote = byKey.hero_note;
  const pillarsSection = byKey.pillars_section;
  const studio = byKey.studio;
  const studioPreview = byKey.studio_preview;
  const joinCast = byKey.join_cast;
  const forms = byKey.forms;
  const preRegister = byKey.pre_register;
  const preRegisterFields = byKey.pre_register_fields;
  const joinTeam = byKey.join_team;
  const joinTeamFields = byKey.join_team_fields;
  const header = byKey.header;
  const footer = byKey.footer;

  const pillars = grouped.pillars || [];
  const tools = grouped.studio_tools || [];
  const headerNav = grouped.header_nav || [];
  const footerNav = grouped.footer_nav || [];
  const castRoles = grouped.join_cast_roles || [];
  const languages = grouped.waitlist_languages || [];
  const interests = grouped.waitlist_interests || [];

  const languageOptions = languages.length ? languages : [{ id: 'en', title: 'English', link_url: 'English' }];
  const interestOptions = interests.length ? interests : [{ id: 'creator', title: 'Creator / Performer', link_url: 'Creator / Performer' }];

  const submitWaitlist = async (e) => {
    e.preventDefault();
    setSendingWait(true);
    setWaitMessage('');
    const { error } = await supabase.from('waitlist_subscribers').insert({ ...waitlist, source: 'landing' });
    setSendingWait(false);
    if (error) {
      if (error.code === '23505') setWaitMessage(preRegister?.button_2_label || 'You are already on the pre-launch list.');
      else setWaitMessage(preRegister?.button_2_url || error.message || 'Unable to register right now.');
      return;
    }
    setWaitMessage(preRegister?.button_1_url || 'You are on the list. We will keep you informed.');
    setWaitlist(v => ({ ...v, name: '', email: '' }));
  };

  const submitTeam = async (e) => {
    e.preventDefault();
    setSendingTeam(true);
    setTeamMessage('');
    const { error } = await supabase.from('team_applications').insert(team);
    setSendingTeam(false);
    if (error) {
      setTeamMessage(joinTeam?.button_2_label || error.message || 'Unable to send your application right now.');
      return;
    }
    setTeamMessage(joinTeam?.button_1_url || 'Thank you. Your application has been received.');
    setTeam({ name: '', email: '', role_interest: '', portfolio_url: '', message: '' });
  };

  const blockOrder = [
    hero && { key: 'hero', order: hero.sort_order ?? 10 },
    pillarsSection && { key: 'pillars', order: pillarsSection.sort_order ?? 20 },
    studio && { key: 'studio', order: studio.sort_order ?? 30 },
    joinCast && { key: 'join_cast', order: joinCast.sort_order ?? 40 },
    forms && { key: 'forms', order: forms.sort_order ?? 50 },
  ].filter(Boolean).sort((a, b) => a.order - b.order);

  const renderHero = () => (
    <section key="hero" className="relative min-h-[92vh] overflow-hidden pt-16">
      <div className="absolute inset-0"><Media item={hero} /><div className="absolute inset-0 bg-[linear-gradient(90deg,#070b0d_0%,rgba(7,11,13,.93)_35%,rgba(7,11,13,.38)_70%,rgba(7,11,13,.18)_100%)]" /><div className="absolute inset-0 bg-gradient-to-t from-[#070b0d] via-transparent to-transparent" /></div>
      <div className="relative mx-auto flex min-h-[calc(92vh-64px)] max-w-[1500px] items-center px-5 py-16 md:px-8">
        <div className="max-w-3xl">
          {hero.eyebrow && <p className="mb-6 text-[10px] font-black uppercase tracking-[.32em] text-[#7ec7c1]">{hero.eyebrow}</p>}
          <h1 className="text-5xl font-black uppercase leading-[.93] tracking-[-.04em] sm:text-7xl lg:text-[92px]">{hero.title}</h1>
          {hero.subtitle && <p className="mt-6 text-lg font-bold text-white">{hero.subtitle}</p>}
          {hero.body && <p className="mt-2 max-w-xl text-base font-medium leading-7 text-white/70">{hero.body}</p>}
          <div className="mt-8 flex flex-wrap gap-3"><CTA label={hero.button_1_label} url={hero.button_1_url} primary/><CTA label={hero.button_2_label} url={hero.button_2_url}/></div>
          {heroNote?.title && <p className="mt-5 text-[10px] font-bold uppercase tracking-[.16em] text-white/45">{heroNote.title}</p>}
        </div>
      </div>
    </section>
  );

  const renderPillars = () => (
    <section key="pillars" id="vision" className="mx-auto grid max-w-[1500px] grid-cols-1 border-l border-t border-white/10 md:grid-cols-2 lg:grid-cols-4">
      {pillars.map((item, index) => {
        const isVideo = item.media_type === 'video';
        return (
          <OptionalLink key={item.id} to={item.link_url} className="group relative block min-h-[440px] overflow-hidden border-b border-r border-white/10">
            <Media item={item} className={isVideo ? '' : 'transition duration-700 group-hover:scale-105'} />
            {!isVideo && <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/25 to-black/10" />}
            <div className={`pointer-events-none absolute inset-x-0 p-6 ${isVideo ? 'top-0 bg-gradient-to-b from-black/85 via-black/45 to-transparent' : 'bottom-0'}`}>
              <div className="text-[10px] font-black tracking-[.2em] text-[#7ec7c1]">{String(index + 1).padStart(2, '0')}</div>
              <h2 className="mt-2 text-4xl font-black uppercase">{item.title}</h2>
              {item.body && <p className="mt-2 max-w-xs text-sm font-medium leading-6 text-white/70">{item.body}</p>}
              {item.link_label && item.link_url && <span className="mt-5 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[.16em] text-[#e0c17e]">{item.link_label}<ArrowRight size={13}/></span>}
            </div>
          </OptionalLink>
        );
      })}
    </section>
  );

  const renderStudio = () => (
    <section key="studio" id="studio" className="border-b border-white/10 bg-[#0b1114]">
      <div className="mx-auto grid max-w-[1500px] gap-8 px-5 py-20 md:px-8 lg:grid-cols-[.75fr_1.55fr]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          {studio.eyebrow && <p className="text-[10px] font-black uppercase tracking-[.28em] text-[#7ec7c1]">{studio.eyebrow}</p>}
          <h2 className="mt-4 text-5xl font-black uppercase leading-[.94]">{studio.title}</h2>
          {studio.subtitle && <p className="mt-4 text-lg font-bold text-[#e0c17e]">{studio.subtitle}</p>}
          {studio.body && <p className="mt-4 max-w-md text-sm font-medium leading-7 text-white/65">{studio.body}</p>}
          <div className="mt-7"><CTA label={studio.button_1_label} url={studio.button_1_url}/></div>
        </div>
        <div className="grid gap-px bg-white/10 sm:grid-cols-2">
          {tools.map((item) => (
            <div key={item.id} className="group bg-[#080d0f]">
              <div className="aspect-video overflow-hidden"><Media item={item} className="transition duration-700 group-hover:scale-105" /></div>
              <div className="p-5"><h3 className="text-xl font-black">{item.title}</h3>{item.body && <p className="mt-2 text-sm font-medium text-white/55">{item.body}</p>}{item.media_type === 'video' && studioPreview?.title && <span className="mt-4 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#7ec7c1]"><Play size={12}/> {studioPreview.title}</span>}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  const renderJoinCast = () => (
    <section key="join_cast" className="relative overflow-hidden border-b border-white/10">
      <div className="absolute inset-0"><Media item={joinCast}/><div className="absolute inset-0 bg-black/72"/></div>
      <div className="relative mx-auto grid min-h-[560px] max-w-[1500px] items-center gap-12 px-5 py-20 md:px-8 lg:grid-cols-2">
        <div>
          {joinCast.eyebrow && <p className="text-[10px] font-black uppercase tracking-[.28em] text-[#7ec7c1]">{joinCast.eyebrow}</p>}
          <h2 className="mt-4 text-5xl font-black uppercase leading-[.95] sm:text-6xl">{joinCast.title}</h2>
          {joinCast.body && <p className="mt-5 max-w-xl text-base font-medium leading-7 text-white/70">{joinCast.body}</p>}
          <div className="mt-8 flex flex-wrap gap-3"><CTA label={joinCast.button_1_label} url={joinCast.button_1_url} primary/><CTA label={joinCast.button_2_label} url={joinCast.button_2_url}/></div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-white/10">
          {castRoles.map((item, index) => {
            const Icon = ROLE_ICONS[index % ROLE_ICONS.length];
            return <div key={item.id} className="bg-black/55 p-6">{item.media_url ? <img src={item.media_url} alt="" className="h-7 w-7 object-contain"/> : <Icon className="text-[#c8a45f]" size={24}/>}<div className="mt-6 text-lg font-black uppercase">{item.title}</div>{item.body && <div className="text-xs font-bold uppercase tracking-wider text-white/45">{item.body}</div>}</div>;
          })}
        </div>
      </div>
    </section>
  );

  const renderForms = () => (
    <section key="forms" id="pre-register" className="bg-[#f2f2ef] text-black">
      <div className={`mx-auto grid max-w-[1500px] gap-px bg-black/10 ${preRegister && joinTeam ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
        {preRegister && <div className="bg-[#f2f2ef] px-5 py-20 md:px-10">
          {preRegister.eyebrow && <p className="text-[10px] font-black uppercase tracking-[.28em] text-black/45">{preRegister.eyebrow}</p>}
          <h2 className="mt-4 max-w-lg text-5xl font-black uppercase leading-[.92]">{preRegister.title}</h2>
          {preRegister.body && <p className="mt-5 max-w-xl text-sm font-semibold leading-6 text-black/60">{preRegister.body}</p>}
          <form onSubmit={submitWaitlist} className="mt-8 grid gap-3 sm:grid-cols-2">
            <input required value={waitlist.name} onChange={e=>setWaitlist({...waitlist,name:e.target.value})} placeholder={preRegisterFields?.title || 'Your name'} className="border border-black/20 bg-white px-4 py-3 text-sm outline-none focus:border-black"/>
            <input required type="email" value={waitlist.email} onChange={e=>setWaitlist({...waitlist,email:e.target.value})} placeholder={preRegisterFields?.subtitle || 'Email'} className="border border-black/20 bg-white px-4 py-3 text-sm outline-none focus:border-black"/>
            <select value={waitlist.language} onChange={e=>setWaitlist({...waitlist,language:e.target.value})} className="border border-black/20 bg-white px-4 py-3 text-sm">{languageOptions.map(x=><option key={x.id} value={x.link_url || x.title}>{x.title}</option>)}</select>
            <select value={waitlist.interest} onChange={e=>setWaitlist({...waitlist,interest:e.target.value})} className="border border-black/20 bg-white px-4 py-3 text-sm">{interestOptions.map(x=><option key={x.id} value={x.link_url || x.title}>{x.title}</option>)}</select>
            <button disabled={sendingWait} className="sm:col-span-2 bg-[#091114] px-5 py-4 text-xs font-black uppercase tracking-[.16em] text-white disabled:opacity-50">{sendingWait ? (preRegister.subtitle || 'SENDING…') : (preRegister.button_1_label || 'PRE-REGISTER →')}</button>
            {waitMessage && <p className="sm:col-span-2 text-sm font-semibold text-black/65">{waitMessage}</p>}
          </form>
        </div>}

        {joinTeam && <div id="join-team" className="bg-[#081114] px-5 py-20 text-white md:px-10">
          {joinTeam.eyebrow && <p className="text-[10px] font-black uppercase tracking-[.28em] text-[#7ec7c1]">{joinTeam.eyebrow}</p>}
          <h2 className="mt-4 text-5xl font-black uppercase leading-[.92]">{joinTeam.title}</h2>
          {joinTeam.body && <p className="mt-5 max-w-xl text-sm font-medium leading-6 text-white/60">{joinTeam.body}</p>}
          <form onSubmit={submitTeam} className="mt-8 grid gap-3 sm:grid-cols-2">
            <input required value={team.name} onChange={e=>setTeam({...team,name:e.target.value})} placeholder={joinTeamFields?.title || 'Your name'} className="border border-white/20 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-white/60"/>
            <input required type="email" value={team.email} onChange={e=>setTeam({...team,email:e.target.value})} placeholder={joinTeamFields?.subtitle || 'Email'} className="border border-white/20 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-white/60"/>
            <input value={team.role_interest} onChange={e=>setTeam({...team,role_interest:e.target.value})} placeholder={joinTeamFields?.body || 'Role / specialty'} className="border border-white/20 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-white/60"/>
            <input value={team.portfolio_url} onChange={e=>setTeam({...team,portfolio_url:e.target.value})} placeholder={joinTeamFields?.button_1_label || 'Portfolio / website'} className="border border-white/20 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-white/60"/>
            <textarea value={team.message} onChange={e=>setTeam({...team,message:e.target.value})} placeholder={joinTeamFields?.button_2_label || 'Tell us what you would like to bring to AI STAGE ONE'} rows="4" className="sm:col-span-2 border border-white/20 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-white/60"/>
            <button disabled={sendingTeam} className="sm:col-span-2 border border-[#c8a45f] bg-[#c8a45f] px-5 py-4 text-xs font-black uppercase tracking-[.16em] text-black disabled:opacity-50">{sendingTeam ? (joinTeam.subtitle || 'SENDING…') : (joinTeam.button_1_label || 'SEND APPLICATION →')}</button>
            {teamMessage && <p className="sm:col-span-2 text-sm font-semibold text-white/65">{teamMessage}</p>}
          </form>
        </div>}
      </div>
    </section>
  );

  const renderBlock = (key) => {
    if (key === 'hero') return renderHero();
    if (key === 'pillars') return renderPillars();
    if (key === 'studio') return renderStudio();
    if (key === 'join_cast') return renderJoinCast();
    if (key === 'forms') return renderForms();
    return null;
  };

  return (
    <div className="min-h-screen bg-[#070b0d] text-white selection:bg-[#c8a45f]/35">
      {header && <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#070b0d]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-5 md:px-8">
          <a href="#top" className="text-lg font-black tracking-[.18em]">{header.title}</a>
          <nav className="hidden items-center gap-7 text-[11px] font-bold uppercase tracking-[.16em] text-white/70 md:flex">
            {headerNav.map(item=><SmartLink key={item.id} to={item.link_url} className="hover:text-white">{item.title}</SmartLink>)}
            <SmartLink to={header.button_1_url} className="border border-[#c8a45f]/70 px-3 py-2 text-[#e0c17e]">{header.button_1_label}</SmartLink>
          </nav>
          <SmartLink to={header.button_2_url || header.button_1_url} className="border border-[#c8a45f]/70 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#e0c17e] md:hidden">{header.button_2_label || header.button_1_label}</SmartLink>
        </div>
      </header>}

      <main id="top">{blockOrder.map(block => renderBlock(block.key))}</main>

      {footer && <footer className="border-t border-white/10 bg-[#050809]">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-5 py-10 md:flex-row md:items-end md:justify-between md:px-8">
          <div><div className="text-lg font-black tracking-[.18em]">{footer.title}</div>{footer.body && <p className="mt-2 text-[10px] font-bold uppercase tracking-[.18em] text-white/35">{footer.body}</p>}</div>
          <div className="flex flex-wrap gap-5 text-[10px] font-black uppercase tracking-wider text-white/50">{footerNav.map(item=><SmartLink key={item.id} to={item.link_url}>{item.title}</SmartLink>)}</div>
        </div>
      </footer>}
    </div>
  );
}