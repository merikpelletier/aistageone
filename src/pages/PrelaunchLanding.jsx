import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Play, Users, PenTool, Code2, Handshake } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/base44Client';

function Media({ item, className = '' }) {
  if (!item?.media_url) return <div className={`bg-neutral-900 ${className}`} />;
  if (item.media_type === 'video' || item.media_type === 'background_video') {
    return <video src={item.media_url} poster={item.poster_url || undefined} muted loop autoPlay playsInline className={`h-full w-full object-cover ${className}`} />;
  }
  if (item.media_type === 'embed') {
    return <iframe src={item.media_url} title={item.title || 'AI STAGE ONE media'} className={`h-full w-full ${className}`} allow="autoplay; fullscreen; picture-in-picture" />;
  }
  return <img src={item.media_url} alt="" className={`h-full w-full object-cover ${className}`} />;
}

function CTA({ label, url, primary = false }) {
  if (!label || !url) return null;
  const cls = `inline-flex items-center justify-center gap-2 border px-5 py-3 text-xs font-black tracking-[.16em] transition hover:-translate-y-0.5 ${primary ? 'border-[#c8a45f] bg-[#c8a45f] text-black hover:bg-[#d7b773]' : 'border-white/30 bg-black/35 text-white hover:border-white'}`;
  if (url.startsWith('#')) return <a href={url} className={cls}>{label}<ArrowRight size={14}/></a>;
  return <Link to={url} className={cls}>{label}<ArrowRight size={14}/></Link>;
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
    staleTime: 60_000,
  });

  const { data: items = [] } = useQuery({
    queryKey: ['prelaunch-items'],
    queryFn: async () => {
      const { data, error } = await supabase.from('landing_section_items').select('*').eq('is_active', true).order('sort_order');
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  const byKey = useMemo(() => Object.fromEntries(sections.map(s => [s.section_key, s])), [sections]);
  const pillars = items.filter(i => i.section_key === 'pillars');
  const tools = items.filter(i => i.section_key === 'studio_tools');
  const hero = byKey.hero || {};
  const studio = byKey.studio || {};
  const joinCast = byKey.join_cast || {};

  const submitWaitlist = async (e) => {
    e.preventDefault();
    setSendingWait(true); setWaitMessage('');
    const { error } = await supabase.from('waitlist_subscribers').insert({ ...waitlist, source: 'landing' });
    setSendingWait(false);
    if (error) {
      if (error.code === '23505') setWaitMessage('You are already on the pre-launch list.');
      else setWaitMessage(error.message || 'Unable to register right now.');
      return;
    }
    setWaitMessage('You are on the list. We will keep you informed.');
    setWaitlist(v => ({ ...v, name: '', email: '' }));
  };

  const submitTeam = async (e) => {
    e.preventDefault();
    setSendingTeam(true); setTeamMessage('');
    const { error } = await supabase.from('team_applications').insert(team);
    setSendingTeam(false);
    if (error) { setTeamMessage(error.message || 'Unable to send your application right now.'); return; }
    setTeamMessage('Thank you. Your application has been received.');
    setTeam({ name: '', email: '', role_interest: '', portfolio_url: '', message: '' });
  };

  return (
    <div className="min-h-screen bg-[#070b0d] text-white selection:bg-[#c8a45f]/35">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#070b0d]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-5 md:px-8">
          <a href="#top" className="text-lg font-black tracking-[.18em]"><span className="text-[#c8a45f]">AI</span> STAGE ONE</a>
          <nav className="hidden items-center gap-7 text-[11px] font-bold uppercase tracking-[.16em] text-white/70 md:flex">
            <a href="#vision" className="hover:text-white">Vision</a>
            <a href="#studio" className="hover:text-white">Studio</a>
            <a href="#pre-register" className="hover:text-white">Pre-register</a>
            <Link to="/Login" className="border border-[#c8a45f]/70 px-3 py-2 text-[#e0c17e]">Private Preview</Link>
          </nav>
          <Link to="/Login" className="border border-[#c8a45f]/70 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#e0c17e] md:hidden">Login</Link>
        </div>
      </header>

      <main id="top">
        <section className="relative min-h-[92vh] overflow-hidden pt-16">
          <div className="absolute inset-0"><Media item={hero} /><div className="absolute inset-0 bg-[linear-gradient(90deg,#070b0d_0%,rgba(7,11,13,.93)_35%,rgba(7,11,13,.38)_70%,rgba(7,11,13,.18)_100%)]" /><div className="absolute inset-0 bg-gradient-to-t from-[#070b0d] via-transparent to-transparent" /></div>
          <div className="relative mx-auto flex min-h-[calc(92vh-64px)] max-w-[1500px] items-center px-5 py-16 md:px-8">
            <div className="max-w-3xl">
              <p className="mb-6 text-[10px] font-black uppercase tracking-[.32em] text-[#7ec7c1]">{hero.eyebrow || 'PEOPLE × STORIES × AI × A GLOBAL STAGE'}</p>
              <h1 className="text-5xl font-black uppercase leading-[.93] tracking-[-.04em] sm:text-7xl lg:text-[92px]">{hero.title || 'THE STAGE IS ALMOST YOURS.'}</h1>
              <p className="mt-6 text-lg font-bold text-white">{hero.subtitle || 'Create. Perform. Publish.'}</p>
              <p className="mt-2 max-w-xl text-base font-medium leading-7 text-white/70">{hero.body}</p>
              <div className="mt-8 flex flex-wrap gap-3"><CTA label={hero.button_1_label} url={hero.button_1_url} primary/><CTA label={hero.button_2_label} url={hero.button_2_url}/></div>
              <p className="mt-5 text-[10px] font-bold uppercase tracking-[.16em] text-white/45">Full platform access is currently limited to Admins and invited Guests.</p>
            </div>
          </div>
        </section>

        <section id="vision" className="mx-auto grid max-w-[1500px] grid-cols-1 border-l border-t border-white/10 md:grid-cols-2 xl:grid-cols-4">
          {pillars.map((item, index) => (
            <a key={item.id} href={item.link_url || '#studio'} className="group relative min-h-[440px] overflow-hidden border-b border-r border-white/10">
              <Media item={item} className="transition duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-black/10" />
              <div className="absolute inset-x-0 bottom-0 p-6">
                <div className="text-[10px] font-black tracking-[.2em] text-[#7ec7c1]">0{index + 1}</div>
                <h2 className="mt-2 text-4xl font-black uppercase">{item.title}</h2>
                <p className="mt-2 max-w-xs text-sm font-medium leading-6 text-white/70">{item.body}</p>
                {item.link_label && <span className="mt-5 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[.16em] text-[#e0c17e]">{item.link_label}<ArrowRight size={13}/></span>}
              </div>
            </a>
          ))}
        </section>

        <section id="studio" className="border-b border-white/10 bg-[#0b1114]">
          <div className="mx-auto grid max-w-[1500px] gap-8 px-5 py-20 md:px-8 lg:grid-cols-[.75fr_1.55fr]">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <p className="text-[10px] font-black uppercase tracking-[.28em] text-[#7ec7c1]">{studio.eyebrow}</p>
              <h2 className="mt-4 text-5xl font-black uppercase leading-[.94]">{studio.title || 'INSIDE THE STUDIO'}</h2>
              <p className="mt-4 text-lg font-bold text-[#e0c17e]">{studio.subtitle}</p>
              <p className="mt-4 max-w-md text-sm font-medium leading-7 text-white/65">{studio.body}</p>
              <div className="mt-7"><CTA label={studio.button_1_label} url={studio.button_1_url}/></div>
            </div>
            <div className="grid gap-px bg-white/10 sm:grid-cols-2">
              {tools.map((item) => (
                <div key={item.id} className="group bg-[#080d0f]">
                  <div className="aspect-video overflow-hidden"><Media item={item} className="transition duration-700 group-hover:scale-105" /></div>
                  <div className="p-5"><h3 className="text-xl font-black">{item.title}</h3><p className="mt-2 text-sm font-medium text-white/55">{item.body}</p>{item.media_type === 'video' && <span className="mt-4 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#7ec7c1]"><Play size={12}/> Play preview</span>}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-b border-white/10">
          <div className="absolute inset-0"><Media item={joinCast}/><div className="absolute inset-0 bg-black/72"/></div>
          <div className="relative mx-auto grid min-h-[560px] max-w-[1500px] items-center gap-12 px-5 py-20 md:px-8 lg:grid-cols-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.28em] text-[#7ec7c1]">{joinCast.eyebrow}</p>
              <h2 className="mt-4 text-5xl font-black uppercase leading-[.95] sm:text-6xl">{joinCast.title || 'NOT JUST WATCH. JOIN THE CAST.'}</h2>
              <p className="mt-5 max-w-xl text-base font-medium leading-7 text-white/70">{joinCast.body}</p>
              <div className="mt-8 flex flex-wrap gap-3"><CTA label={joinCast.button_1_label} url={joinCast.button_1_url} primary/><CTA label={joinCast.button_2_label} url={joinCast.button_2_url}/></div>
            </div>
            <div className="grid grid-cols-2 gap-px bg-white/10">
              {[[Users,'Creators','& Performers'],[PenTool,'Writers','& Designers'],[Code2,'Developers','& Tech Talent'],[Handshake,'Partners','& Collaborators']].map(([Icon,a,b]) => (
                <div key={a} className="bg-black/55 p-6"><Icon className="text-[#c8a45f]" size={24}/><div className="mt-6 text-lg font-black uppercase">{a}</div><div className="text-xs font-bold uppercase tracking-wider text-white/45">{b}</div></div>
              ))}
            </div>
          </div>
        </section>

        <section id="pre-register" className="bg-[#f2f2ef] text-black">
          <div className="mx-auto grid max-w-[1500px] gap-px bg-black/10 lg:grid-cols-2">
            <div className="bg-[#f2f2ef] px-5 py-20 md:px-10">
              <p className="text-[10px] font-black uppercase tracking-[.28em] text-black/45">BE PART OF WHAT'S NEXT</p>
              <h2 className="mt-4 max-w-lg text-5xl font-black uppercase leading-[.92]">PRE-REGISTER FOR LAUNCH ACCESS</h2>
              <p className="mt-5 max-w-xl text-sm font-semibold leading-6 text-black/60">Get early updates, behind-the-scenes content and be among the first to know when we open the stage to more creators.</p>
              <form onSubmit={submitWaitlist} className="mt-8 grid gap-3 sm:grid-cols-2">
                <input required value={waitlist.name} onChange={e=>setWaitlist({...waitlist,name:e.target.value})} placeholder="Your name" className="border border-black/20 bg-white px-4 py-3 text-sm outline-none focus:border-black"/>
                <input required type="email" value={waitlist.email} onChange={e=>setWaitlist({...waitlist,email:e.target.value})} placeholder="Email" className="border border-black/20 bg-white px-4 py-3 text-sm outline-none focus:border-black"/>
                <select value={waitlist.language} onChange={e=>setWaitlist({...waitlist,language:e.target.value})} className="border border-black/20 bg-white px-4 py-3 text-sm"><option>English</option><option>Français</option><option>Español</option></select>
                <select value={waitlist.interest} onChange={e=>setWaitlist({...waitlist,interest:e.target.value})} className="border border-black/20 bg-white px-4 py-3 text-sm"><option>Creator / Performer</option><option>Writer / Designer</option><option>Developer / Tech</option><option>Brand / Partner</option><option>Viewer / Fan</option><option>Other</option></select>
                <button disabled={sendingWait} className="sm:col-span-2 bg-[#091114] px-5 py-4 text-xs font-black uppercase tracking-[.16em] text-white disabled:opacity-50">{sendingWait ? 'SENDING…' : 'PRE-REGISTER →'}</button>
                {waitMessage && <p className="sm:col-span-2 text-sm font-semibold text-black/65">{waitMessage}</p>}
              </form>
            </div>

            <div id="join-team" className="bg-[#081114] px-5 py-20 text-white md:px-10">
              <p className="text-[10px] font-black uppercase tracking-[.28em] text-[#7ec7c1]">CREATIVE PEOPLE. REAL IMPACT.</p>
              <h2 className="mt-4 text-5xl font-black uppercase leading-[.92]">JOIN THE TEAM</h2>
              <p className="mt-5 max-w-xl text-sm font-medium leading-6 text-white/60">We're looking for exceptional creatives, technologists and partners to help shape the future of AI-powered entertainment.</p>
              <form onSubmit={submitTeam} className="mt-8 grid gap-3 sm:grid-cols-2">
                <input required value={team.name} onChange={e=>setTeam({...team,name:e.target.value})} placeholder="Your name" className="border border-white/20 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-white/60"/>
                <input required type="email" value={team.email} onChange={e=>setTeam({...team,email:e.target.value})} placeholder="Email" className="border border-white/20 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-white/60"/>
                <input value={team.role_interest} onChange={e=>setTeam({...team,role_interest:e.target.value})} placeholder="Role / specialty" className="border border-white/20 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-white/60"/>
                <input value={team.portfolio_url} onChange={e=>setTeam({...team,portfolio_url:e.target.value})} placeholder="Portfolio / website" className="border border-white/20 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-white/60"/>
                <textarea value={team.message} onChange={e=>setTeam({...team,message:e.target.value})} placeholder="Tell us what you would like to bring to AI STAGE ONE" rows="4" className="sm:col-span-2 border border-white/20 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-white/60"/>
                <button disabled={sendingTeam} className="sm:col-span-2 border border-[#c8a45f] bg-[#c8a45f] px-5 py-4 text-xs font-black uppercase tracking-[.16em] text-black disabled:opacity-50">{sendingTeam ? 'SENDING…' : 'SEND APPLICATION →'}</button>
                {teamMessage && <p className="sm:col-span-2 text-sm font-semibold text-white/65">{teamMessage}</p>}
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#050809]">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-5 py-10 md:flex-row md:items-end md:justify-between md:px-8">
          <div><div className="text-lg font-black tracking-[.18em]"><span className="text-[#c8a45f]">AI</span> STAGE ONE</div><p className="mt-2 text-[10px] font-bold uppercase tracking-[.18em] text-white/35">A global stage for a new creative generation.</p></div>
          <div className="flex gap-5 text-[10px] font-black uppercase tracking-wider text-white/50"><a href="#vision">Vision</a><a href="#studio">Studio</a><a href="#pre-register">Pre-register</a><Link to="/Login">Login</Link></div>
        </div>
      </footer>
    </div>
  );
}
