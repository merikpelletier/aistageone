import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/api/base44Client';

const routes=new Set(['/','/index','/studio','/membership','/myprojects','/myaipilots','/mobile','/dossier']);
let attribution=null;
function context(){
 const host=window.location.hostname.toLowerCase();
 const site=host==='leplateau.ai'||host==='www.leplateau.ai'?'leplateau':host==='aistage.one'||host==='www.aistage.one'?'aistage':null;
 if(!site||navigator.globalPrivacyControl||navigator.doNotTrack==='1')return null;
 const clean=(v,n)=>typeof v==='string'&&/^[a-zA-Z0-9_.-]+$/.test(v)&&v.length<=n?v:'';
 const params=new URLSearchParams(window.location.search);
 const campaign=clean(params.get('utm_campaign'),120),source=clean(params.get('utm_source'),80),medium=clean(params.get('utm_medium'),80);
 if(!attribution||campaign||source||medium){
  let referrer='';
  try{const h=new URL(document.referrer).hostname;if(h!==host&&/^[a-zA-Z0-9.-]{1,253}$/.test(h))referrer=h;}catch{}
  attribution={p_source:source,p_medium:medium,p_campaign:campaign,p_referrer:referrer};
 }
 return {p_site:site,...attribution};
}
export function recordNavigationEvent(event,path='/'){
 try{
  const data=context();if(!data)return;
  const first='/'+path.toLowerCase().split('/').filter(Boolean).slice(0,1).join('');
  if(['/admin','/login','/resetpassword','/pitchdeckshare'].includes(first))return;
  const route=routes.has(first)?first:'/other';
  void supabase.rpc('record_analytics_navigation',{p_id:crypto.randomUUID(),p_event:event,p_route:route,...data}).then(({error})=>{if(error)console.warn('Analytics event unavailable',error.code);}).catch(()=>{});
 }catch{}
}
export default function NavigationTracker(){
 const location=useLocation(),last=useRef(null);
 useEffect(()=>{
  const key=location.key+':'+location.pathname;
  if(last.current===key)return;
  last.current=key;
  recordNavigationEvent('page_view',location.pathname);
 },[location.key,location.pathname]);
 return null;
}
