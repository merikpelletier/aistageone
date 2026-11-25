import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useStudioTranslation } from '@/lib/useStudioTranslation';
import { resolveAppearance,appearanceStyle } from '@/lib/dossierAppearance';
import DossierViewer from '@/components/DossierViewer';

function escapeAudioUrl(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function addPageAudioToViewer(pages = []) {
  return pages.map((page) => {
    if (!page?.audio_url) return page;

    const audioMarkup = `
      <div data-dossier-page-audio="true" style="position:relative;z-index:60;width:min(520px,calc(100vw - 48px));margin:18px auto 0;pointer-events:auto;">
        <audio controls preload="metadata" style="display:block;width:100%;" src="${escapeAudioUrl(page.audio_url)}"></audio>
      </div>
    `;

    return {
      ...page,
      content: [page.content || '', audioMarkup].filter(Boolean).join('\n'),
    };
  });
}

async function loadDossier(id) {
  const { data: dossier, error } = await supabase.from('dossier')
    .select('id,title,subtitle,description,author_name,cover_image,cover_image_landscape,cover_video,cover_video_landscape,hide_text_on_cover,content_rating,access_level,access_model,default_language,original_language,product_placements,appearance')
    .eq('mobile_public_id', id).eq('mobile_enabled', true).eq('status', 'published')
    .or('publish_until.is.null,publish_until.gt.' + new Date().toISOString()).maybeSingle();
  if (error) throw error;
  if (!dossier) return null;
  const { data: allowed, error: accessError } = await supabase.rpc('can_access_dossier', { target_dossier_id: dossier.id });
  if (accessError) throw accessError;
  if (!allowed) return null;
  const { data: pages, error: pageError } = await supabase.from('dossier_page')
    .select('*')
    .eq('dossier_id', dossier.id).or('is_hidden_from_public.is.null,is_hidden_from_public.eq.false')
    .order('order').order('id');
  if (pageError) throw pageError;
  return { dossier, pages: pages || [] };
}

export default function MobileDossierPlayer() {
  const { mobileId } = useParams();
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const t = useStudioTranslation();
  const [reading,setReading] = useState(false);
  const [installed,setInstalled] = useState(()=>window.matchMedia('(display-mode: standalone)').matches || navigator.standalone===true);
  const [installHelp,setInstallHelp] = useState(false);
  useEffect(()=>{
    const done=()=>{setInstalled(true);setInstallHelp(false);window.dossierInstallPrompt=null;};
    window.addEventListener('appinstalled',done);
    return()=>window.removeEventListener('appinstalled',done);
  },[]);
  const install=async event=>{
    event.stopPropagation();
    const prompt=window.dossierInstallPrompt;
    if(!prompt){setInstallHelp(v=>!v);return;}
    window.dossierInstallPrompt=null;
    try { await prompt.prompt(); const choice=await prompt.userChoice;if(choice.outcome==='accepted')setInstallHelp(false); } catch {setInstallHelp(true);}
  };
  const [isLandscape,setIsLandscape] = useState(() => window.innerWidth / window.innerHeight > 1.2);
  const { data, isLoading, error } = useQuery({
    queryKey:['mobile-dossier-original',mobileId,user?.id,isAuthenticated],
    queryFn:()=>loadDossier(mobileId),
    enabled:!isLoadingAuth && /^MOB-[A-F0-9]+$/.test(mobileId || ''),
    retry:false, staleTime:0,
  });
  useEffect(()=>{setReading(false);},[mobileId,user?.id]);
  useEffect(()=>{
    const resize=()=>setIsLandscape(window.innerWidth / window.innerHeight > 1.2);
    window.addEventListener('resize',resize);
    window.addEventListener('orientationchange',resize);
    return()=>{window.removeEventListener('resize',resize);window.removeEventListener('orientationchange',resize);};
  },[]);
  useEffect(()=>{if(data?.dossier?.title)document.title=data.dossier.title+' | AISTAGE.ONE';},[data?.dossier?.title]);
  if(isLoadingAuth||isLoading)return <main className="min-h-[100dvh] bg-black text-white grid place-items-center"><Loader2 className="animate-spin" /></main>;
  if(error||!data?.dossier)return <main className="min-h-[100dvh] bg-black text-white grid place-items-center p-6 text-center"><div><h1 className="text-xl font-bold">{t('Dossier mobile indisponible','Mobile dossier unavailable')}</h1>{!isAuthenticated&&<Link className="mt-5 inline-block underline" to={'/Login?returnTo='+encodeURIComponent(window.location.pathname+window.location.search)}>{t('Sign in','Sign in')}</Link>}</div></main>;
  const currentDossier=data.dossier;
  const appearance=resolveAppearance(currentDossier.appearance);
  const activeCoverVideo=isLandscape?(currentDossier.cover_video_landscape||currentDossier.cover_video):currentDossier.cover_video;
  const activeCoverImage=isLandscape?(currentDossier.cover_image_landscape||currentDossier.cover_image):currentDossier.cover_image;
  const openDossier=()=>{if(data.pages.length)setReading(true);};
  return <main className={`fixed inset-0 bg-black text-white ${appearance ? 'dossier-themed' : ''}`} style={appearanceStyle(appearance)}>
    {!reading && !installed && <div className="absolute top-3 left-3 z-[70] max-w-[min(320px,85vw)]">
      <button type="button" onClick={install} className="rounded-md bg-black/80 border border-white/30 px-3 py-2 text-xs">{t('Install application','Install application')}</button>
      {installHelp&&<p className="mt-2 rounded-md bg-black/90 p-3 text-sm">{t('Install application instructions','In your browser menu, choose Add to Home Screen or Install app.')}</p>}
    </div>}
    {!reading && <motion.div key={currentDossier.id} initial={{opacity:0}} animate={{opacity:1}} className="absolute inset-0 bg-black" style={appearanceStyle(appearance)} onClick={openDossier}>
      {activeCoverVideo?<video src={activeCoverVideo} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-contain"/>:activeCoverImage?<img src={activeCoverImage} alt="" className="absolute inset-0 w-full h-full object-contain"/>:null}
      {(currentDossier.content_rating||currentDossier.default_language||currentDossier.original_language)&&<div className="absolute top-[60px] right-4 z-[60] flex items-center gap-2 lg:top-5 lg:right-[calc(50%-330px)] lg:gap-1.5">
        {currentDossier.content_rating&&<div className="dossier-cover-badge min-w-[52px] h-9 px-3 flex items-center justify-center border border-white bg-black text-white text-xs font-black tracking-[0.12em] uppercase lg:min-w-[44px] lg:h-8 lg:px-2 lg:text-[10px]">{currentDossier.content_rating==='all'?t('All','ALL'):currentDossier.content_rating}</div>}
        {(currentDossier.default_language||currentDossier.original_language)&&<div className="dossier-cover-badge h-9 px-3 flex items-center justify-center border border-white bg-black text-white text-xs font-black tracking-[0.12em] uppercase lg:h-8 lg:px-2 lg:text-[10px]">{String(currentDossier.default_language||currentDossier.original_language).toUpperCase()}</div>}
      </div>}
      {!currentDossier.hide_text_on_cover&&<div className="absolute top-[108px] left-0 right-0 px-6 lg:top-16 lg:left-1/2 lg:right-auto lg:w-[620px] lg:max-w-[calc(100vw-80px)] lg:-translate-x-1/2 lg:px-4">
        <motion.h1 initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:0.2}} className="text-white text-4xl md:text-6xl font-black tracking-wide mb-3 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] lg:text-3xl lg:mb-2">{currentDossier.title}</motion.h1>
        {currentDossier.subtitle&&<motion.p initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:0.3}} className="text-white text-lg font-light lg:text-sm">{currentDossier.subtitle}</motion.p>}
        {currentDossier.author_name&&<motion.p initial={{y:20,opacity:0}} animate={{y:0,opacity:1}} transition={{delay:0.4}} className="text-white text-sm mt-4 tracking-wide lg:text-xs lg:mt-2">{currentDossier.author_name}</motion.p>}
      </div>}
      {data.pages.length>0&&<div className="absolute bottom-8 left-1/2 -translate-x-1/2 lg:bottom-5"><motion.button initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.5}} onClick={e=>{e.stopPropagation();openDossier();}} className="group flex items-center gap-3 rounded-full px-7 py-3.5 transition-all lg:gap-2 lg:px-5 lg:py-2.5" style={{background:appearance?.accent||'rgba(255,255,255,0.90)',color:appearance?'var(--dossier-accent-text)':'#111',border:'1px solid rgba(0,0,0,0.18)',boxShadow:'0 4px 18px rgba(0,0,0,0.30)',backdropFilter:'blur(10px)',fontWeight:700}}><span className="text-sm tracking-[0.2em] uppercase lg:text-xs">{t('Ouvrir le dossier','Open dossier')}</span><span>→</span></motion.button></div>}
    </motion.div>}
    {reading&&data.pages.length>0&&<DossierViewer external key={currentDossier.id} pages={addPageAudioToViewer(data.pages)} dossier={currentDossier} onClose={()=>setReading(false)}/>}
  </main>;
}
