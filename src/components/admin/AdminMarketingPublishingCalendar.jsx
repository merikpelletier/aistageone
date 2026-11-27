import React,{useState} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {supabase} from '@/api/base44Client';
const field='bg-neutral-950 text-white border border-white/20 px-2 py-1 text-sm min-w-0';
const btn='border border-white/20 px-2 py-1 text-sm disabled:opacity-40';
const brands={aistage:'AISTAGE.ONE',leplateau:'LEPLATEAU.AI'};
const networks={facebook:'Facebook',instagram:'Instagram',youtube:'YouTube'};
const localDate=s=>{if(!s)return '';const d=new Date(s);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
export default function AdminMarketingPublishingCalendar({t}){
 const qc=useQueryClient();
 const [brand,setBrand]=useState('all'),[dates,setDates]=useState({}),[filter,setFilter]=useState('all');
 const rows=useQuery({queryKey:['marketing-publication-drafts'],queryFn:async()=>{const {data,error}=await supabase.from('marketing_publication_drafts').select('*').order('created_at',{ascending:false});if(error)throw error;return data;}});
 const update=useMutation({mutationFn:async({row,patch})=>{const {error}=await supabase.from('marketing_publication_drafts').update(patch).eq('id',row.id).eq('updated_at',row.updated_at).select('id').single();if(error)throw error;},onSuccess:async(_,args)=>{setDates(d=>{const n={...d};delete n[args.row.id];return n;});await qc.invalidateQueries({queryKey:['marketing-publication-drafts']});}});
 const status=r=>r.approved_at?(new Date(r.planned_at)<=new Date()?'Due':'Approved'):r.planned_at?'Planned':'Draft';
 const visible=(rows.data||[]).filter(r=>(brand==='all'||r.brand===brand)&&(filter==='all'||status(r)===filter)).sort((a,b)=>(a.planned_at||'9999').localeCompare(b.planned_at||'9999'));
 const now=new Date();
 const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
 return <section className="space-y-4 min-w-0" data-marketing-publishing-calendar>
 <header><h2 className="text-xl font-medium">{t('Publishing Calendar')}</h2><p className="text-xs text-white/60">{t('Planning and approval only — automatic publishing is disabled.')}</p><p className="text-xs text-white/60">{t('Time zone')}: {timezone}</p></header>
 <div className="flex flex-wrap gap-2">{['all',...Object.keys(brands)].map(b=><button key={b} className={brand===b?btn+' bg-white text-black':btn} onClick={()=>setBrand(b)}>{b==='all'?t('All brands'):brands[b]}</button>)}
 <select aria-label={t('Status')} style={{colorScheme:'dark'}} className={field} value={filter} onChange={e=>setFilter(e.target.value)}>{['all','Draft','Planned','Approved','Due'].map(s=><option key={s} value={s}>{t(s==='all'?'All':s)}</option>)}</select></div>
 {rows.isPending&&<p>{t('Loading')}</p>}{rows.isError&&<p role="alert">{t('Unable to load configuration')}</p>}{update.error&&<p role="alert" className="text-red-300 text-xs">{t('Unable to update publication schedule')}: {update.error.message}</p>}
 {visible.map(r=>{const date=dates[r.id]??localDate(r.planned_at),changed=date!==localDate(r.planned_at),future=!!date&&new Date(date)>now;return <article key={r.id} className="border border-white/15 p-3 space-y-2">
 <div className="flex flex-wrap justify-between gap-2"><div className="min-w-0"><h3 className="text-sm font-medium break-words">{r.title}</h3><p className="text-xs text-white/60">{brands[r.brand]} · {networks[r.network]} · {t(status(r))}</p></div>{r.approved_at&&<span className="text-xs text-white/60">{t('Approved')}: {new Date(r.approved_at).toLocaleString()}</span>}</div>
 <div className="flex flex-wrap gap-2 items-center"><input aria-label={t('Publication date and time')} type="datetime-local" style={{colorScheme:'dark'}} className={field} value={date} onChange={e=>setDates(d=>({...d,[r.id]:e.target.value}))}/>
 <button className={btn} disabled={update.isPending||!changed||(!future&&!!date)} onClick={()=>update.mutate({row:r,patch:{planned_at:date?new Date(date).toISOString():null}})}>{t('Save schedule')}</button>
 <button className={btn} disabled={update.isPending||!r.planned_at} onClick={()=>update.mutate({row:r,patch:{planned_at:null}})}>{t('Clear schedule')}</button>
 {r.approved_at?<button className={btn} disabled={update.isPending} onClick={()=>update.mutate({row:r,patch:{approved_at:null,approved_by:null}})}>{t('Withdraw approval')}</button>:<button className={btn+' bg-white text-black'} disabled={update.isPending||changed||!future||!r.planned_at||(['youtube','instagram'].includes(r.network)&&!r.media_ids.length)} onClick={()=>update.mutate({row:r,patch:{approved_at:new Date().toISOString()}})}>{t('Approve publication')}</button>}</div>
 {r.caption&&<p className="text-xs text-white/70 whitespace-pre-wrap break-words">{r.caption}</p>}
 <p className="text-xs text-white/50">{t('Selected media')}: {r.media_ids.length}</p>
 </article>;})}
 {!rows.isPending&&!rows.isError&&!visible.length&&<p className="text-sm text-white/50">{t('No publication drafts')}</p>}
 </section>;
}
