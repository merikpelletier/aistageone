import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, List, Share2, Loader2, Play } from 'lucide-react';
import { supabase } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useStudioTranslation } from '@/lib/useStudioTranslation';
import CloudflareStreamVideo, { isCloudflareStreamUrl } from '@/components/CloudflareStreamVideo';

const safeUrl = value => {
  try { const u = new URL(value); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : ''; } catch { return ''; }
};
const plainText = value => {
  if (!value) return '';
  const doc = new DOMParser().parseFromString(String(value), 'text/html');
  return doc.body.textContent || '';
};
async function loadDossier(id) {
  const { data: dossier, error } = await supabase.from('dossier')
    .select('id,title,subtitle,description,author_name,cover_image,cover_image_landscape,cover_video,cover_video_landscape,hide_text_on_cover,content_rating,access_level,access_model,default_language')
    .eq('mobile_public_id', id).eq('mobile_enabled', true).eq('status', 'published')
    .eq('access_level', 'public').eq('access_model', 'free').in('content_rating', ['all','13+'])
    .or('publish_until.is.null,publish_until.gt.' + new Date().toISOString()).maybeSingle();
  if (error) throw error;
  if (!dossier) return null;
  const { data: pages, error: pageError } = await supabase.from('dossier_page')
    .select('id,page_type,title,content,media_url,media_url_landscape,images,audio_url,episode_title,episode_description,hide_title,order')
    .eq('dossier_id', dossier.id).or('is_hidden_from_public.is.null,is_hidden_from_public.eq.false')
    .or('is_locked.is.null,is_locked.eq.false').order('order').order('id');
  if (pageError) throw pageError;
  return { dossier, pages: pages || [] };
}
export default function MobileDossierPlayer() {
  const { mobileId } = useParams();
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const t = useStudioTranslation();
  const [index,setIndex] = useState(-1);
  const [showIndex,setShowIndex] = useState(false);
  const [copied,setCopied] = useState(false);
  const [landscape,setLandscape] = useState(() => window.innerWidth > window.innerHeight);
  const { data, isLoading, error } = useQuery({
    queryKey:['mobile-dossier',mobileId,isAuthenticated], queryFn:()=>loadDossier(mobileId),
    enabled:!isLoadingAuth && /^MOB-[A-F0-9]+$/.test(mobileId || ''), retry:false, staleTime:0,
  });
  useEffect(()=>{setIndex(-1);setShowIndex(false);},[mobileId]);
  useEffect(()=>{const change=()=>setLandscape(window.innerWidth>window.innerHeight);window.addEventListener('resize',change);return()=>window.removeEventListener('resize',change);},[]);
  useEffect(()=>{if(data?.dossier?.title)document.title=data.dossier.title+' | AISTAGE.ONE';},[data?.dossier?.title]);
  const pages=data?.pages||[], dossier=data?.dossier, page=pages[index];
  const move = delta => setIndex(i=>Math.max(-1,Math.min(pages.length-1,i+delta)));
  useEffect(()=>{const key=e=>{if(e.target.closest('input,button,video,audio,iframe'))return;if(e.key==='ArrowRight')move(1);if(e.key==='ArrowLeft')move(-1);};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[pages.length]);
  const share=async()=>{try{if(navigator.share){await navigator.share({title:dossier.title,url:location.href});}else{await navigator.clipboard.writeText(location.href);setCopied(true);}}catch{}};
  if(isLoadingAuth||isLoading)return <main className="min-h-[100dvh] bg-black text-white grid place-items-center"><Loader2 className="animate-spin" /></main>;
  if(error||!dossier)return <main className="min-h-[100dvh] bg-black text-white grid place-items-center p-6 text-center"><div><h1 className="text-xl font-bold">{t('Dossier mobile indisponible','Mobile dossier unavailable')}</h1>{!isAuthenticated&&<Link className="mt-5 inline-block underline" to={'/Login?returnTo='+encodeURIComponent(location.pathname+location.search)}>{t('Sign in','Sign in')}</Link>}</div></main>;
  const media=safeUrl(landscape?(page?.media_url_landscape||page?.media_url):(page?.media_url||page?.media_url_landscape));
  const cover=safeUrl(landscape?(dossier.cover_image_landscape||dossier.cover_image):dossier.cover_image);
  const coverVideo=safeUrl(landscape?(dossier.cover_video_landscape||dossier.cover_video):dossier.cover_video);
  const renderMedia=(url,video=false)=>url&&(video||isCloudflareStreamUrl(url)||/\.(mp4|webm|mov)(\?|$)/i.test(url)?<CloudflareStreamVideo src={url} title={page?.title||dossier.title} className="w-full aspect-video max-h-[65dvh] object-contain" />:<img src={url} alt="" className="w-full max-h-[65dvh] object-contain"/>);
  return <main className="min-h-[100dvh] bg-black text-white flex flex-col" style={{paddingTop:'env(safe-area-inset-top)',paddingBottom:'env(safe-area-inset-bottom)'}}>
    <header className="sticky top-0 z-10 bg-black/95 border-b border-white/15 flex items-center justify-between gap-3 px-4 py-3">
      <button onClick={()=>{setIndex(-1);setShowIndex(false);}} className="truncate text-left font-semibold">{dossier.title}</button>
      <div className="flex gap-2"><button onClick={()=>setShowIndex(v=>!v)} aria-label={t('Index','Index')} className="p-3"><List size={20}/></button><button onClick={share} aria-label={t('Share','Share')} className="p-3"><Share2 size={20}/>{copied&&<span className="text-xs">{t('Copied','Copied')}</span>}</button></div>
    </header>
    {showIndex?<section className="w-full max-w-3xl mx-auto px-4 py-5"><button className="w-full text-left p-4 border-b border-white/10" onClick={()=>{setIndex(-1);setShowIndex(false);}}>{t('Couverture','Cover')}</button>{pages.map((p,i)=><button key={p.id} className="w-full text-left p-4 border-b border-white/10" onClick={()=>{setIndex(i);setShowIndex(false);}}>{i+1}. {p.episode_title||p.title||p.page_type}</button>)}</section>:<section key={index} className="flex-1 w-full max-w-5xl mx-auto flex flex-col justify-center px-3 py-4 gap-4">
      {index===-1?<>{renderMedia(coverVideo||cover,Boolean(coverVideo))}{!dossier.hide_text_on_cover&&<div className="text-center"><h1 className="text-2xl font-bold">{dossier.title}</h1><p className="text-white/65">{dossier.subtitle||dossier.author_name}</p><p className="mt-3 whitespace-pre-wrap text-sm text-white/75">{plainText(dossier.description)}</p></div>}{pages.length>0&&<button onClick={()=>setIndex(0)} className="self-center flex items-center gap-2 bg-white text-black font-semibold px-6 py-3 rounded-md"><Play size={18}/>{t('Ouvrir le dossier','Open dossier')}</button>}</>:page&&<>
        {renderMedia(media,page.page_type==='video')}
        {!page.hide_title&&(page.episode_title||page.title)&&<h2 className="text-xl font-semibold">{page.episode_title||page.title}</h2>}
        {page.content&&<p className="whitespace-pre-wrap leading-relaxed">{plainText(page.content)}</p>}
        {page.episode_description&&<p className="whitespace-pre-wrap text-white/70">{plainText(page.episode_description)}</p>}
        {safeUrl(page.audio_url)&&<audio controls preload="metadata" src={safeUrl(page.audio_url)} className="w-full"/>}
        {Array.isArray(page.images)&&page.images.map((url,i)=><React.Fragment key={i}>{renderMedia(safeUrl(url))}</React.Fragment>)}
        {!media&&!page.content&&!page.audio_url&&['block_player','series','quiz','contest','production_kit','member_episodes','join_cast','credits'].includes(page.page_type)&&<p className="text-white/60">{t('Ce type de page sera pris en charge dans une prochaine version.','This page type will be supported in a later version.')}</p>}
      </>}
    </section>}
    <footer className="sticky bottom-0 flex items-center justify-between bg-black border-t border-white/15 px-4 py-3"><button disabled={index<0} onClick={()=>{move(-1);setShowIndex(false);}} className="p-3 disabled:opacity-25" aria-label={t('Previous','Previous')}><ChevronLeft/></button><span className="text-sm tabular-nums text-white/60">{Math.max(0,index+1)} / {pages.length}</span><button disabled={index>=pages.length-1} onClick={()=>{move(1);setShowIndex(false);}} className="p-3 disabled:opacity-25" aria-label={t('Next','Next')}><ChevronRight/></button></footer>
  </main>;
}
