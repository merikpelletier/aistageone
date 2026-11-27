import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, BarChart3, Bot, Boxes, CreditCard, FileText, Handshake, ShoppingBag, Users, WandSparkles, RefreshCw } from 'lucide-react';
import { supabase } from '@/api/base44Client';
import { fetchTranslationDictionary, translationLookup, translatedLabel, getPlatformLanguage } from '@/lib/translationDictionary';

const sections=[['overview','Overview'],['traffic','Traffic'],['content','Content'],['members','Members'],['studio','Studio'],['sales','Sales & Credits'],['sponsors','Sponsors'],['commerce','Shop / 3D'],['ai','AI Usage']];
const ranges=[['today','Today'],['7d','Last 7 days'],['30d','Last 30 days'],['90d','Last 90 days']];
export default function AdminAnalytics(){
 const [section,setSection]=useState('overview'),[range,setRange]=useState('30d');
 const dictionary=useQuery({queryKey:['translationDictionary'],queryFn:fetchTranslationDictionary});
 const lookup=translationLookup(dictionary.data),language=getPlatformLanguage(),t=k=>translatedLabel(lookup,'ui',k,language);
 const query=useQuery({queryKey:['admin-analytics-snapshot',range],queryFn:async()=>{const {data,error}=await supabase.rpc('admin_analytics_snapshot',{p_range:range});if(error)throw error;return data;},staleTime:60000});
 const trafficQuery=useQuery({queryKey:['admin-traffic-snapshot',range],queryFn:async()=>{const {data,error}=await supabase.rpc('admin_traffic_snapshot',{p_range:range});if(error)throw error;return data;},staleTime:60000});
 const d=query.data;
 const num=n=>n==null?'—':new Intl.NumberFormat(language==='fr'?'fr-CA':'en-CA',{maximumFractionDigits:2}).format(n);
 const money=n=>n==null?'—':new Intl.NumberFormat(language==='fr'?'fr-CA':'en-CA',{style:'currency',currency:'CAD'}).format(n);
 const date=v=>new Intl.DateTimeFormat(language==='fr'?'fr-CA':'en-CA',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Toronto'}).format(new Date(v));
 const card=(label,value,Icon,note='',currency=false)=><div key={label} className="bg-neutral-950 border border-white/10 p-4 min-h-28"><div className="flex items-center justify-between gap-3"><span className="text-white/70 text-xs uppercase tracking-wide">{t(label)}</span><Icon size={16} className="text-white/60"/></div><div className="text-white text-2xl mt-3 tabular-nums">{currency?money(value):num(value)}</div>{note&&<div className="text-white/60 text-xs mt-2">{t(note)}</div>}</div>;
 const grid=items=><div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">{items}</div>;
 const note=label=><p className="text-sm text-white/70 border border-white/10 p-3">{t(label)}</p>;
 const groups=d?{
 members:[card('Total members',d.members.total,Users,'Current total, independent of selected period'),card('New members',d.members.new,Users),card('Members signed in',d.members.signed_in,Users,'Sign-in date is not a measure of ongoing activity.')],
 content:[card('Published dossiers',d.content.published_total,FileText,'Current total, independent of selected period'),card('New dated publications',d.content.new_publications,FileText),card('Undated publications',d.content.undated,FileText,'Undated publications are excluded from period counts.')],
 studio:[card('Story projects created',d.studio.story_projects,WandSparkles),card('Slide projects created',d.studio.slide_projects,WandSparkles),card('Shoot projects created',d.studio.shoot_projects,WandSparkles)],
 sales:[card('Credit transactions',d.credits.transactions,CreditCard),card('Credits used',d.credits.usage,CreditCard),card('Credits refunded',d.credits.refunds,CreditCard)],
 sponsors:[card('Sponsor sales',d.sponsors.sales,Handshake),card('Recorded sponsor sales',d.sponsors.amount,Handshake,'',true)],
 commerce:[card('Asset downloads',d.commerce.downloads,Boxes),card('3D purchases',d.commerce.purchases_3d,Boxes),card('Orders with payment date',d.commerce.paid_orders,ShoppingBag)],
 ai:[card('Model call records',d.ai.calls,Bot),card('Recorded AI events',d.ai.events,Bot),card('Successful AI events',d.ai.succeeded,Bot),card('Failed AI events',d.ai.failed,Bot),card('Recorded AI cost (CAD)',d.ai.recorded_cost_cad,Activity,'',true)]
 }:null;
 const tr=trafficQuery.data;
 const trafficTable=(label,rows,columns)=><div className="border border-white/10 p-4 overflow-x-auto"><h3 className="text-white mb-3">{t(label)}</h3>{rows.length?<table className="w-full text-sm text-white"><thead><tr className="text-left border-b border-white/20">{columns.map(([key,title])=><th key={key} className="p-2">{t(title)}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i} className="border-b border-white/10">{columns.map(([key])=><td key={key} className="p-2">{typeof row[key]==='number'?num(row[key]):row[key]||'—'}</td>)}</tr>)}</tbody></table>:<p className="text-white/60">{t('No recorded events in this period')}</p>}</div>;
 const traffic=trafficQuery.error?<p role="alert" className="text-red-300">{t('Traffic data unavailable')}: {trafficQuery.error.message}</p>:!tr?<p className="text-white/70">{t('Loading')}</p>:<div className="space-y-4">
 {grid([card('Recorded page views',tr.page_views,BarChart3),card('Waitlist registrations',tr.waitlist_total,Users),card('Team applications',tr.team_total,Handshake)])}
 {note('Internal traffic collection starts with this release. Earlier page views are unavailable. Conversion totals come from database records; campaign attribution is observed client-side and may be incomplete.')}
 {trafficTable('Traffic by site',tr.by_site,[['site','Site'],['views','Page views'],['waitlist','Attributed registrations'],['team','Attributed applications']])}
 {section==='traffic'&&<>{trafficTable('Traffic by day',tr.by_day,[['event_day','Date'],['views','Page views']])}{trafficTable('Top pages',tr.by_route,[['route','Page'],['views','Page views']])}{trafficTable('Traffic sources',tr.by_source,[['source','Source'],['views','Page views'],['waitlist','Attributed registrations'],['team','Attributed applications']])}{trafficTable('Campaign attribution',tr.by_campaign,[['site','Site'],['source','Source'],['medium','Medium'],['campaign','Campaign'],['views','Page views'],['waitlist','Attributed registrations'],['team','Attributed applications']])}</>}
 </div>;
 return <section className="space-y-5" data-live-admin-analytics>
 <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-xl text-white"><BarChart3 size={22}/>{t('Analytics')}</h2><button type="button" onClick={()=>{query.refetch();trafficQuery.refetch();}} disabled={query.isFetching||trafficQuery.isFetching} className="flex items-center gap-2 border border-white/20 px-3 py-2 text-xs text-white disabled:opacity-50"><RefreshCw size={14}/>{t('Refresh')}</button></header>
 <div className="flex flex-wrap gap-2">{ranges.map(([v,l])=><button key={v} onClick={()=>setRange(v)} className={'px-3 py-2 text-xs border '+(range===v?'bg-white text-black border-white':'bg-neutral-950 text-white border-white/20')}>{t(l)}</button>)}</div>
 <div className="flex gap-2 overflow-x-auto pb-2">{sections.map(([v,l])=><button key={v} onClick={()=>setSection(v)} className={'whitespace-nowrap px-4 py-2 text-xs border '+(section===v?'bg-white text-black border-white':'bg-neutral-950 text-white border-white/20')}>{t(l)}</button>)}</div>
 {query.isPending&&<p className="text-white/70">{t('Loading')}</p>}
 {query.error&&<p role="alert" className="text-red-300">{t('Analytics unavailable')}: {query.error.message}</p>}
 {d&&<p className="text-xs text-white/70">{t('Reporting period')}: {date(d.from)} — {date(d.to)} · {t('Source: Supabase')}</p>}
 {section==='traffic'?traffic:groups&&(section==='overview'?<>{grid([groups.members[0],groups.members[1],groups.content[0],groups.ai[0],groups.studio[1],groups.sales[0],groups.sponsors[0],groups.commerce[0]])}{traffic}</>:<>
 {grid(groups[section])}
 {section==='studio'&&note('Projects created, not Studio sessions.')}
 {['sales','sponsors','commerce'].includes(section)&&note('Historical source records; not a complete revenue report.')}
 {section==='ai'&&<>{note('Recorded events only; call records and usage events are different measures.')}<div className="border border-white/10 p-4"><h3 className="text-white mb-3">{t('Usage by tool')}</h3>{d.ai.by_tool.length?<div className="overflow-x-auto"><table className="w-full text-sm text-white"><thead><tr className="border-b border-white/20 text-left"><th className="p-2">{t('Tool')}</th><th className="p-2">{t('Events')}</th><th className="p-2">{t('Recorded AI cost (CAD)')}</th></tr></thead><tbody>{d.ai.by_tool.map(r=><tr key={r.tool} className="border-b border-white/10"><td className="p-2">{r.tool}</td><td className="p-2">{num(r.events)}</td><td className="p-2">{money(r.cost_cad)}</td></tr>)}</tbody></table></div>:<p className="text-white/60 text-sm">{t('No recorded events in this period')}</p>}</div></>}
 </>)}
 </section>;
}
