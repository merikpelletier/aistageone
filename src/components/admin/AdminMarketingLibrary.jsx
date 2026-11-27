import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { fetchTranslationDictionary, translationLookup, translatedLabel, getPlatformLanguage } from '@/lib/translationDictionary';

const brands={aistage:'AISTAGE.ONE',leplateau:'LEPLATEAU.AI',both:'Both'};
const languages={en:'English',fr:'French',both:'Both'};
const types={image:'Image',video:'Video',audio:'Audio'};
const purposes={portrait:'Portrait',voice:'Reference',opening:'Opening clip',closing:'Closing clip',voiceover:'Voice-over',music:'Music',logo:'Logo',demo:'Demonstration',other:'Other'};
const allowed={portrait:['image'],voice:['audio'],opening:['video'],closing:['video'],voiceover:['audio'],music:['audio'],logo:['image','video'],demo:['image','video','audio'],other:['image','video','audio']};
const field='w-full bg-neutral-950 border border-white/20 px-3 py-2 text-sm text-white';
const btn='border border-white/20 px-3 py-2 text-sm disabled:opacity-40 hover:bg-white/10';
const primary='bg-white text-black px-3 py-2 text-sm font-medium disabled:opacity-40';
const speakerDefaults={name:'',brand:'both',description:'',appearance:'',wardrobe:'',setting:'',archived:false};
const mediaDefaults={name:'',brand:'both',language:'both',media_type:'image',purpose:'other',spokesperson_id:'',description:'',authorized:false,archived:false};
const keys=(defaults,row)=>Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k,row?.[k]??v]));
async function readRows(table){const {data,error}=await supabase.from(table).select('*').order('created_at',{ascending:false});if(error)throw error;return data;}
async function previewUrl(row){
 if(row.storage_path){const {data,error}=await supabase.storage.from('marketing-private').createSignedUrl(row.storage_path,3600);if(error)throw error;return data.signedUrl;}
 const {data,error}=await supabase.from('vault_asset').select('url').eq('id',row.vault_asset_id).single();if(error)throw error;return data.url;
}
function Preview({row,t}){
 const query=useQuery({queryKey:['marketing-preview',row.id,row.storage_path,row.vault_asset_id],queryFn:()=>previewUrl(row),staleTime:300000});
 if(!query.data)return <p className="text-xs text-white/50">{t(query.isPending?'Loading':'No preview available')}</p>;
 if(row.media_type==='image')return <img src={query.data} alt={row.name} className="w-full max-h-44 object-contain bg-black" loading="lazy"/>;
 if(row.media_type==='video')return <video src={query.data} controls preload="metadata" className="w-full max-h-44 bg-black"/>;
 return <audio src={query.data} controls preload="none" className="w-full"/>;
}
export default function AdminMarketingLibrary({section='media'}){
 const {user,isAuthenticated}=useAuth();
 const admin=isAuthenticated&&user?.role==='admin';
 const qc=useQueryClient();
 const [form,setForm]=useState(null),[editing,setEditing]=useState(null),[source,setSource]=useState('vault'),[selected,setSelected]=useState(null),[file,setFile]=useState(null),[search,setSearch]=useState(''),[filter,setFilter]=useState('all'),[brandFilter,setBrandFilter]=useState('all'),[langFilter,setLangFilter]=useState('all'),[typeFilter,setTypeFilter]=useState('all');
 const dictionary=useQuery({queryKey:['translationDictionary'],queryFn:fetchTranslationDictionary,enabled:admin});
 const lookup=translationLookup(dictionary.data),lang=getPlatformLanguage(),t=k=>translatedLabel(lookup,'ui',k,lang);
 const speakers=useQuery({queryKey:['marketing-speakers',user?.id],queryFn:()=>readRows('marketing_spokespersons'),enabled:admin});
 const media=useQuery({queryKey:['marketing-media',user?.id],queryFn:()=>readRows('marketing_media'),enabled:admin});
 const vault=useQuery({queryKey:['marketing-vault',user?.id,search,form?.media_type],enabled:admin&&!!form&&section==='media'&&source==='vault'&&!editing,queryFn:async()=>{
  let q=supabase.from('vault_asset').select('id,name,url,media_type').eq('media_type',form.media_type).order('created_date',{ascending:false}).limit(100);
  if(search.trim())q=q.ilike('name','%'+search.trim()+'%');
  const {data,error}=await q;if(error)throw error;return data;
 }});
 useEffect(()=>{setForm(null);setEditing(null);setSelected(null);setFile(null);},[section]);
 const isSpeaker=section==='speakers';
 const activeQuery=isSpeaker?speakers:media;
 const open=(row=null,speakerId='')=>{save.reset();setEditing(row);setForm(isSpeaker?keys(speakerDefaults,row):{...keys(mediaDefaults,row),spokesperson_id:row?.spokesperson_id||speakerId});setSelected(null);setFile(null);setSource('vault');setSearch('');};
 const change=(k,v)=>setForm(f=>({...f,[k]:v}));
 const save=useMutation({mutationFn:async()=>{
  if(!admin)throw Error('Admin access only');
  const table=isSpeaker?'marketing_spokespersons':'marketing_media';
  let payload={...form,name:form.name.trim()},uploaded=null;
  if(!isSpeaker){
   payload.spokesperson_id=payload.spokesperson_id||null;
   if(!editing){
    if(source==='vault'){if(!selected||selected.media_type!==form.media_type)throw Error(t('File required'));payload.vault_asset_id=selected.id;}
    else{
     if(!file||!file.type.startsWith(form.media_type+'/')||file.size>52428800)throw Error(t('File required'));
     const ext=file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,8)||'bin';
     uploaded=crypto.randomUUID()+'.'+ext;
     const {error}=await supabase.storage.from('marketing-private').upload(uploaded,file,{contentType:file.type,upsert:false});if(error)throw error;
     payload.storage_path=uploaded;
    }
   }
  }
  const request=editing?supabase.from(table).update(payload).eq('id',editing.id):supabase.from(table).insert(payload);
  const {error}=await request.select('id').single();
  if(error){if(uploaded)await supabase.storage.from('marketing-private').remove([uploaded]);throw error;}
 },onSuccess:async()=>{await Promise.all([qc.invalidateQueries({queryKey:['marketing-speakers']}),qc.invalidateQueries({queryKey:['marketing-media']})]);setForm(null);setEditing(null);}});
 if(!admin)return null;
 const speakerRows=speakers.data||[],mediaRows=media.data||[];
 const rows=(activeQuery.data||[]).filter(r=>(filter==='all'||(filter==='active'?!r.archived:r.archived))&&(brandFilter==='all'||r.brand===brandFilter||r.brand==='both')&&(isSpeaker||((langFilter==='all'||r.language===langFilter||r.language==='both')&&(typeFilter==='all'||r.media_type===typeFilter))));
 const select=(k,label,options,onChange)=> <label className="block text-xs text-white/70 space-y-1">{t(label)}<select className={field} value={form[k]} onChange={e=>onChange?onChange(e.target.value):change(k,e.target.value)}>{Object.entries(options).map(([v,l])=><option key={v} value={v}>{t(l)}</option>)}</select></label>;
 const input=(k,label,area=false)=><label className="block text-xs text-white/70 space-y-1">{t(label)}{area?<textarea className={field} rows={3} value={form[k]} onChange={e=>change(k,e.target.value)}/>:<input className={field} maxLength={200} required value={form[k]} onChange={e=>change(k,e.target.value)}/>}</label>;
 const valid=form&&form.name.trim()&&(isSpeaker||(form.authorized&&allowed[form.purpose]?.includes(form.media_type)&&(editing|| (source==='vault'?selected?.media_type===form.media_type:!!file&&file.type.startsWith(form.media_type+'/')&&file.size<=52428800))));
 const filterSelect=(value,onChange,options,label)=><select aria-label={t(label)} className={btn+' bg-neutral-950'} value={value} onChange={e=>onChange(e.target.value)}>{Object.entries(options).map(([v,l])=><option key={v} value={v}>{t(l)}</option>)}</select>;
 return <section className="space-y-4" data-marketing-library={section}>
  <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-medium">{t(isSpeaker?'Spokespersons':'Media Library')}</h2><button className={primary} disabled={!!form} onClick={()=>open()}>{t(isSpeaker?'New spokesperson':'New media')}</button></div>
  <div className="flex flex-wrap gap-2">{filterSelect(filter,setFilter,{all:'All',active:'Active',archived:'Archived'},'Status')}{filterSelect(brandFilter,setBrandFilter,{all:'All brands',...brands},'Brand')}{!isSpeaker&&filterSelect(langFilter,setLangFilter,{all:'All languages',...languages},'Language')}{!isSpeaker&&filterSelect(typeFilter,setTypeFilter,{all:'All types',...types},'Media type')}</div>
  {form&&<form className="border border-white/15 bg-neutral-950 p-4 space-y-3" onSubmit={e=>{e.preventDefault();if(valid&&!save.isPending)save.mutate();}}>
   <div className="grid gap-3 md:grid-cols-2">{input('name','Name')}{select('brand','Brand',brands)}
   {isSpeaker?<>{input('description','Description',true)}{input('appearance','Appearance',true)}{input('wardrobe','Wardrobe',true)}{input('setting','Setting',true)}</>:<>
   {select('language','Language',languages)}{select('purpose','Purpose',editing?Object.fromEntries(Object.entries(purposes).filter(([k])=>allowed[k].includes(form.media_type))):purposes,v=>{setForm(f=>({...f,purpose:v,media_type:allowed[v].includes(f.media_type)?f.media_type:allowed[v][0]}));setSelected(null);setFile(null);})}
   {editing?<label className="text-xs">{t('Media type')}<p>{t(types[form.media_type])}</p></label>:select('media_type','Media type',Object.fromEntries(Object.entries(types).filter(([k])=>allowed[form.purpose].includes(k))),v=>{change('media_type',v);setSelected(null);setFile(null);})}
   {select('spokesperson_id','Spokesperson',{'':'Unassigned',...Object.fromEntries(speakerRows.filter(s=>!s.archived||s.id===form.spokesperson_id).map(s=>[s.id,s.name]))})}{input('description','Description',true)}
   </>}
   <label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={form.archived} onChange={e=>change('archived',e.target.checked)}/>{t('Archived')}</label></div>
   {!isSpeaker&&!editing&&<div className="space-y-2 border-t border-white/10 pt-3">
    <div className="flex gap-2">{['vault','file'].map(s=><button key={s} type="button" className={source===s?primary:btn} onClick={()=>{setSource(s);setSelected(null);setFile(null);}}>{t(s==='vault'?'Select from Vault':'Import file')}</button>)}</div>
    {source==='vault'?<><input className={field} placeholder={t('Search Vault')} value={search} onChange={e=>setSearch(e.target.value)}/>
     {vault.error&&<p role="alert" className="text-red-300">{vault.error.message}</p>}
     <div className="max-h-48 overflow-y-auto grid gap-1 sm:grid-cols-2">{(vault.data||[]).map(v=><button type="button" key={v.id} className={(selected?.id===v.id?primary:btn)+' text-left truncate'} onClick={()=>{setSelected(v);if(!form.name)change('name',v.name||'');}}>{v.name||v.id}</button>)}</div>
     {selected&&<div className="text-xs text-white/80">{selected.name}{selected.media_type==='image'&&<img src={selected.url} className="max-h-24 mt-2" alt={selected.name}/>}</div>}
     {!vault.isPending&&!vault.error&&!vault.data?.length&&<p className="text-xs text-white/50">{t('No matching assets')}</p>}</>:<input className={field} type="file" accept={form.media_type+'/*'} onChange={e=>{const f=e.target.files?.[0];setFile(f||null);if(f&&!form.name)change('name',f.name.slice(0,200));}}/>}
   </div>}
   {!isSpeaker&&<label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={form.authorized} onChange={e=>change('authorized',e.target.checked)}/>{t('Authorized for promotion')}</label>}
   {save.error&&<p role="alert" className="text-red-300 text-sm">{save.error.message}</p>}
   <div className="flex gap-2"><button className={primary} disabled={!valid||save.isPending}>{t('Save')}</button><button type="button" className={btn} disabled={save.isPending} onClick={()=>{setForm(null);setEditing(null);}}>{t('Cancel')}</button></div>
  </form>}
  {(activeQuery.isPending||speakers.isPending||media.isPending)&&<p>{t('Loading')}</p>}
  {[speakers.error,media.error].filter(Boolean).map((e,i)=><p key={i} role="alert" className="text-red-300">{e.message}</p>)}
  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.map(r=><article key={r.id} className="border border-white/15 bg-neutral-950 p-3 space-y-2">
   {!isSpeaker&&<Preview row={r} t={t}/>}
   {isSpeaker&&mediaRows.filter(m=>m.spokesperson_id===r.id&&m.purpose==='portrait'&&!m.archived).slice(0,1).map(m=><Preview key={m.id} row={m} t={t}/>)}
   <div className="flex justify-between gap-2 items-start"><div><h3 className="font-medium">{r.name}</h3><p className="text-xs text-white/60">{t(brands[r.brand])}{!isSpeaker&&' · '+t(languages[r.language])+' · '+t(purposes[r.purpose])}{r.archived&&' · '+t('Archived')}</p></div><button className={btn} disabled={!!form} onClick={()=>open(r)}>{t('Edit')}</button></div>
   {r.description&&<p className="text-sm whitespace-pre-wrap">{r.description}</p>}
   {isSpeaker?<div className="space-y-1">{['appearance','wardrobe','setting'].map(k=>r[k]&&<p key={k} className="text-xs text-white/65">{t(k[0].toUpperCase()+k.slice(1))}: {r[k]}</p>)}{mediaRows.filter(m=>m.spokesperson_id===r.id&&!m.archived).map(m=><div key={m.id} className="border-t border-white/10 pt-2"><p className="text-xs">{t(purposes[m.purpose])} · {t(languages[m.language])} · {m.name}</p>{m.purpose!=='portrait'&&<Preview row={m} t={t}/>}</div>)}</div>:<p className="text-xs text-white/50">{speakerRows.find(s=>s.id===r.spokesperson_id)?.name||t('Unassigned')} · {t(r.vault_asset_id?'Vault':'Import file')}</p>}
  </article>)}</div>
  {!activeQuery.isPending&&!activeQuery.error&&!rows.length&&<p className="text-white/50 text-sm">{t(isSpeaker?'No spokespersons':'No media')}</p>}
 </section>;
}
