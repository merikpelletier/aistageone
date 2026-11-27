import React,{useState} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {supabase} from '@/api/base44Client';
const empty=()=>({brand:'aistage',campaign_id:'',network:'facebook',title:'',caption:'',hashtags:'',destination_path:'/',media_ids:[]});
const brands={aistage:'AISTAGE.ONE',leplateau:'LEPLATEAU.AI'};
const networks={facebook:'Facebook',instagram:'Instagram',youtube:'YouTube'};
const field='w-full min-w-0 border border-white/20 bg-neutral-950 px-3 py-2 text-sm text-white';
const btn='border border-white/20 px-3 py-2 text-sm disabled:opacity-40';
const primary='bg-white text-black px-3 py-2 text-sm font-medium disabled:opacity-40';
async function read(table){const {data,error}=await supabase.from(table).select('*').order('created_at',{ascending:false});if(error)throw error;return data;}
function trackedLink(form){try{if(!/^\/(?!\/)[^?#\\]*$/.test(form.destination_path))return '';const base='https://'+(form.brand==='aistage'?'aistage.one':'leplateau.ai');const url=new URL(form.destination_path,base);if(url.origin!==base)return '';url.searchParams.set('utm_source',form.network);url.searchParams.set('utm_medium','social');url.searchParams.set('utm_campaign',form.campaign_id||'marketing');if(form.id)url.searchParams.set('utm_content',form.id);return url.href;}catch{return '';}}
function MediaPreview({row,t}){
 const q=useQuery({queryKey:['marketing-publishing-preview',row.id,row.storage_path,row.vault_asset_id],queryFn:async()=>{if(row.storage_path){const {data,error}=await supabase.storage.from('marketing-private').createSignedUrl(row.storage_path,3600);if(error)throw error;return data.signedUrl;}const {data,error}=await supabase.from('vault_asset').select('url').eq('id',row.vault_asset_id).single();if(error)throw error;return data.url;},staleTime:300000});
 if(!q.data)return <span className="text-xs text-white/50">{t(q.isPending?'Loading':'No preview available')}</span>;
 if(row.media_type==='image')return <img src={q.data} alt={row.name} className="max-h-40 w-full object-contain bg-black"/>;
 let stream=null;try{const u=new URL(q.data),id=u.pathname.split('/')[1];if(u.protocol==='https:'&&/^customer-[a-z0-9]+\.cloudflarestream\.com$/i.test(u.hostname)&&/^[a-z0-9_-]+$/i.test(id))stream=u.origin+'/'+id+'/iframe';}catch{}
 return stream?<iframe src={stream} title={row.name} allowFullScreen className="w-full aspect-video border-0"/>:<video src={q.data} controls preload="metadata" className="w-full max-h-48 bg-black"/>;
}
export default function AdminMarketingPublishingStudio({t,campaigns=[]}){
 const qc=useQueryClient();
 const [form,setForm]=useState(null),[brandFilter,setBrandFilter]=useState('all'),[search,setSearch]=useState(''),[copied,setCopied]=useState(false);
 const drafts=useQuery({queryKey:['marketing-publication-drafts'],queryFn:()=>read('marketing_publication_drafts')});
 const media=useQuery({queryKey:['marketing-publishing-media'],queryFn:()=>read('marketing_media')});
 const eligible=(media.data||[]).filter(a=>form&&a.authorized&&!a.archived&&[form.brand,'both'].includes(a.brand)&&[form.brand==='aistage'?'en':'fr','both'].includes(a.language)&&['image','video'].includes(a.media_type)&&(form.network!=='youtube'||a.media_type==='video'));
 const selected=form?.media_ids.map(id=>eligible.find(a=>a.id===id)).filter(Boolean)||[];
 const link=form?trackedLink(form):'';
 const save=useMutation({mutationFn:async()=>{const {id,created_at,updated_at,planned_at,approved_at,approved_by,...payload}=form;payload.title=payload.title.trim();payload.campaign_id=payload.campaign_id||null;const q=id?supabase.from('marketing_publication_drafts').update(payload).eq('id',id).eq('updated_at',updated_at):supabase.from('marketing_publication_drafts').insert(payload);const {data,error}=await q.select('*').single();if(error)throw error;return data;},onSuccess:async data=>{setForm(data);await qc.invalidateQueries({queryKey:['marketing-publication-drafts']});}});
 const open=r=>{save.reset();setCopied(false);setSearch('');setForm(r?{...r,campaign_id:r.campaign_id||''}:{...empty(),brand:brandFilter==='all'?'aistage':brandFilter});};
 const change=(k,v)=>{setCopied(false);setForm(f=>({...f,[k]:v}));};
 const pick=id=>setForm(f=>({...f,media_ids:f.media_ids.includes(id)?f.media_ids.filter(x=>x!==id):f.network==='youtube'?[id]:f.media_ids.length<10?[...f.media_ids,id]:f.media_ids}));
 const options=(items)=>Object.entries(items).map(([v,l])=><option key={v} value={v} className="bg-neutral-900 text-white">{l}</option>);
 const select=(label,value,onChange,children)=><label className="block space-y-1 text-xs text-white/70">{t(label)}<select style={{colorScheme:'dark'}} className={field} value={value} onChange={e=>onChange(e.target.value)}>{children}</select></label>;
 const valid=!!(form?.title.trim()&&link&&selected.length===form.media_ids.length&&!media.isError);
 return <section className="min-w-0 space-y-4" data-marketing-publishing-studio>
 <header className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xl font-medium">{t('Publishing Studio')}</h2><p className="text-xs text-white/60">{t('Draft preparation only — no social publication.')}</p></div><button className={primary} disabled={save.isPending} onClick={()=>open(null)}>{t('New publication')}</button></header>
 <div className="flex flex-wrap gap-2">{['all','aistage','leplateau'].map(b=><button key={b} className={brandFilter===b?primary:btn} onClick={()=>setBrandFilter(b)}>{b==='all'?t('All brands'):brands[b]}</button>)}</div>
 {form&&<form className="border border-white/15 p-3 space-y-3" onSubmit={e=>{e.preventDefault();if(valid&&!save.isPending)save.mutate();}}>
 <div className="grid gap-3 md:grid-cols-2">
 {select('Brand',form.brand,v=>{setCopied(false);setForm(f=>({...f,brand:v,campaign_id:'',media_ids:[]}));},options(brands))}
 {select('Social network',form.network,v=>{setCopied(false);setForm(f=>({...f,network:v,media_ids:v==='youtube'?f.media_ids.filter(id=>eligible.find(a=>a.id===id)?.media_type==='video').slice(0,1):f.media_ids}));},options(networks))}
 {select('Campaigns',form.campaign_id,v=>change('campaign_id',v),<><option value="">{t('No campaign')}</option>{campaigns.filter(c=>c.brand===form.brand&&c.status!=='archived').map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</>)}
 <label className="block space-y-1 text-xs text-white/70">{t('Title')}<input required maxLength={200} className={field} value={form.title} onChange={e=>change('title',e.target.value)}/></label>
 </div>
 <label className="block space-y-1 text-xs text-white/70">{t('Caption')}<textarea maxLength={10000} rows={4} className={field} value={form.caption} onChange={e=>change('caption',e.target.value)}/></label>
 <label className="block space-y-1 text-xs text-white/70">{t('Hashtags')}<input maxLength={1000} className={field} value={form.hashtags} onChange={e=>change('hashtags',e.target.value)}/></label>
 <label className="block space-y-1 text-xs text-white/70">{t('Destination path')}<input required maxLength={1000} className={field} value={form.destination_path} onChange={e=>change('destination_path',e.target.value)}/></label>
 <div className="border border-white/10 p-2"><div className="text-xs text-white/60">{t('Tracked link')}</div><div className="text-xs break-all">{link||'—'}</div><button type="button" className={btn} disabled={!link} onClick={async()=>{try{await navigator.clipboard.writeText(link);setCopied(true);}catch{setCopied(false);}}}>{t(copied?'Copied':'Copy')}</button></div>
 <div className="space-y-2"><h3 className="text-sm">{t('Media Library')} · {form.media_ids.length}</h3><input className={field} placeholder={t('Search media')} value={search} onChange={e=>setSearch(e.target.value)}/>
 {media.isError&&<p role="alert" className="text-red-300 text-xs">{t('Unable to load configuration')}</p>}
 <div className="max-h-48 overflow-y-auto border border-white/10">{eligible.filter(a=>a.name.toLowerCase().includes(search.toLowerCase())).map(a=><label key={a.id} className="flex items-center gap-2 border-b border-white/10 p-2 text-sm"><input type="checkbox" checked={form.media_ids.includes(a.id)} onChange={()=>pick(a.id)}/><span className="break-all">{a.name} · {t(a.media_type==='video'?'Video':'Image')}</span></label>)}</div>
 {form.media_ids.length!==selected.length&&<p className="text-red-300 text-xs">{t('Some selected media are no longer eligible.')} <button type="button" className="underline" onClick={()=>change('media_ids',selected.map(a=>a.id))}>{t('Remove unavailable media')}</button></p>}
 </div>
 <div className="border border-white/15 p-3 space-y-2"><h3 className="text-sm font-medium">{t('Publication preview')} · {networks[form.network]}</h3><div className="text-sm font-medium break-words">{form.title}</div><p className="text-sm whitespace-pre-wrap break-words">{form.caption}</p><p className="text-xs break-words text-white/70">{form.hashtags}</p><div className="grid grid-cols-2 gap-2">{selected.map(a=><MediaPreview key={a.id} row={a} t={t}/>)}</div><p className="text-xs break-all text-sky-300">{link}</p></div>
 {save.error&&<p role="alert" className="text-red-300 text-xs">{save.error.message}</p>}{save.isSuccess&&<p role="status" className="text-xs text-white/70">{t('Draft saved')}</p>}
 <div className="flex gap-2"><button className={primary} disabled={!valid||save.isPending}>{t('Save draft')}</button><button type="button" className={btn} disabled={save.isPending} onClick={()=>{setForm(null);save.reset();}}>{t('Close')}</button></div>
 </form>}
 {drafts.isError&&<p role="alert" className="text-red-300">{drafts.error.message}</p>}
 {drafts.isPending&&<p>{t('Loading')}</p>}
 <div className="space-y-1">{(drafts.data||[]).filter(r=>brandFilter==='all'||r.brand===brandFilter).map(r=><article key={r.id} className="border border-white/10 p-3 flex flex-wrap justify-between items-center gap-2"><div className="min-w-0"><div className="font-medium text-sm break-words">{r.title}</div><div className="text-xs text-white/60">{brands[r.brand]} · {networks[r.network]} · {t('Draft')}</div></div><button className={btn} disabled={save.isPending} onClick={()=>open(r)}>{t('Edit')}</button></article>)}</div>
 {!drafts.isPending&&!drafts.isError&&!(drafts.data||[]).some(r=>brandFilter==='all'||r.brand===brandFilter)&&<p className="text-xs text-white/60">{t('No publication drafts')}</p>}
 </section>;
}
