import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/base44Client';
import { fetchTranslationDictionary, translationLookup, translatedLabel, getPlatformLanguage } from '@/lib/translationDictionary';
import AdminMarketingPublishingStudio from './AdminMarketingPublishingStudio';
import AdminMarketingSocialAccounts from './AdminMarketingSocialAccounts';
import { useAuth } from '@/lib/AuthContext';

const brands = { aistage: 'AISTAGE.ONE', leplateau: 'LEPLATEAU.AI' };
const statuses = { draft: 'Draft', approved: 'Approved', archived: 'Archived' };
const empty = () => ({ name: '', brand: 'aistage', objective: '', audience: '', strategy: '', budget_cad: '0', starts_on: '', ends_on: '', status: 'draft' });
const field = 'w-full border border-white/20 bg-neutral-950 px-3 py-2 text-sm text-white';
const button = 'border border-white/20 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-50';
const primary = 'bg-white text-black px-3 py-2 text-sm font-medium disabled:opacity-50';

export default function AdminMarketing() {
  const { user, isAuthenticated } = useAuth();
  const admin = isAuthenticated && user?.role === 'admin';
  const qc = useQueryClient();
  const [tab,setTab]=useState('campaigns');
  const [brand, setBrand] = useState('all');
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(null);
  const lang = getPlatformLanguage();
  const dictionary = useQuery({queryKey:['translationDictionary'],queryFn:fetchTranslationDictionary,enabled:admin});
  const lookup = translationLookup(dictionary.data);
  const t = key => translatedLabel(lookup,'ui',key,lang);
  const campaigns = useQuery({
    queryKey:['adminMarketingCampaigns',user?.id],
    enabled:admin,
    queryFn:async () => {
      const {data,error} = await supabase.from('marketing_campaigns').select('*').order('created_at',{ascending:false});
      if(error) throw error;
      return data;
    }
  });
  const save = useMutation({
    mutationFn:async ({values,id}) => {
      const payload = {...values,name:values.name.trim(),budget_cad:Number(values.budget_cad),starts_on:values.starts_on||null,ends_on:values.ends_on||null};
      const request = id ? supabase.from('marketing_campaigns').update(payload).eq('id',id) : supabase.from('marketing_campaigns').insert(payload);
      const {error} = await request.select('id').single();
      if(error) throw error;
    },
    onSuccess:async () => { await qc.invalidateQueries({queryKey:['adminMarketingCampaigns']}); setForm(null); setEditing(null); }
  });
  if (!admin) return null;
  const rows = (campaigns.data||[]).filter(c=>brand==='all'||c.brand===brand);
  const budget = rows.filter(c=>c.status!=='archived').reduce((sum,c)=>sum+Number(c.budget_cad),0);
  const money = value => new Intl.NumberFormat(lang==='fr'?'fr-CA':'en-CA',{style:'currency',currency:'CAD'}).format(value);
  const change = (key,value) => setForm(f=>({...f,[key]:value}));
  const open = row => {
    save.reset();
    setEditing(row?.id||null);
    setForm(row ? Object.fromEntries(Object.keys(empty()).map(k=>[k,row[k]??''])) : {...empty(),brand:brand==='all'?'aistage':brand});
  };
  const valid = form && form.name.trim() && form.budget_cad!=='' && Number.isFinite(Number(form.budget_cad)) && Number(form.budget_cad)>=0 && Number(form.budget_cad)<=9999999999.99 && (!form.starts_on||!form.ends_on||form.ends_on>=form.starts_on);
  const input = (key,label,type='text',extra={}) => <label className="block space-y-1 text-xs text-white/70">{t(label)}<input className={field} type={type} value={form[key]} onChange={e=>change(key,e.target.value)} {...extra}/></label>;
  const area = (key,label) => <label className="block space-y-1 text-xs text-white/70">{t(label)}<textarea className={field} rows={3} value={form[key]} onChange={e=>change(key,e.target.value)}/></label>;
  return <section className="space-y-5" data-admin-marketing="true">
    <nav className="flex flex-wrap gap-2">{[['campaigns','Campaigns'],['social','Social Accounts'],['publishing','Publishing Studio']].map(([v,l])=><button key={v} className={tab===v?primary:button} onClick={()=>setTab(v)}>{t(l)}</button>)}</nav>
    {tab==='publishing'?<AdminMarketingPublishingStudio t={t} campaigns={campaigns.data||[]}/>:tab==='social'?<AdminMarketingSocialAccounts t={t}/>:<>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-medium">{t('Campaigns')}</h2><p className="mt-1 text-xs text-white/60">{t('Campaign planning only — no automatic publication or spending.')}</p></div>
      <button type="button" className={primary} disabled={!!form} onClick={()=>open(null)}>{t('New campaign')}</button>
    </div>
    <div className="flex flex-wrap gap-2 items-center">
      {['all',...Object.keys(brands)].map(b=><button key={b} type="button" className={brand===b?primary:button} onClick={()=>setBrand(b)}>{b==='all'?t('All brands'):brands[b]}</button>)}
    </div>
    {!campaigns.isError && !campaigns.isLoading && <div className="grid grid-cols-2 gap-3">
      <div className="border border-white/10 p-3"><div className="text-xs text-white/60">{t('Campaigns')}</div><div className="text-2xl">{rows.length}</div></div>
      <div className="border border-white/10 p-3"><div className="text-xs text-white/60">{t('Planned budget')}</div><div className="text-2xl">{money(budget)}</div></div>
    </div>}
    {form && <form className="border border-white/15 bg-neutral-950 p-4 space-y-4" onSubmit={e=>{e.preventDefault();if(valid&&!save.isPending)save.mutate({values:form,id:editing});}}>
      <h3 className="text-base">{t(editing?'Edit':'New campaign')}</h3>
      <div className="grid gap-3 md:grid-cols-2">
        {input('name','Campaign name','text',{required:true,maxLength:200})}
        <label className="block space-y-1 text-xs text-white/70">{t('Brand')}<select style={{colorScheme:"dark",color:"#fff",backgroundColor:"#171717"}} className={field} value={form.brand} onChange={e=>change('brand',e.target.value)}>{Object.entries(brands).map(([key,label])=><option style={{color:"#fff",backgroundColor:"#171717"}} key={key} value={key}>{label}</option>)}</select></label>
        {area('objective','Objective')}{area('audience','Target audience')}
        <div className="md:col-span-2">{area('strategy','Strategy')}</div>
        {input('budget_cad','Budget (CAD)','number',{required:true,min:0,max:9999999999.99,step:'0.01'})}
        <label className="block space-y-1 text-xs text-white/70">{t('Status')}<select style={{colorScheme:"dark",color:"#fff",backgroundColor:"#171717"}} className={field} value={form.status} onChange={e=>change('status',e.target.value)}>{Object.entries(statuses).map(([key,label])=><option style={{color:"#fff",backgroundColor:"#171717"}} key={key} value={key}>{t(label)}</option>)}</select></label>
        {input('starts_on','Start date','date')}{input('ends_on','End date','date',{min:form.starts_on||undefined})}
      </div>
      {save.error && <p role="alert" className="text-red-300 text-sm">{save.error.message}</p>}
      <div className="flex gap-2"><button className={primary} disabled={!valid||save.isPending}>{t('Save campaign')}</button><button type="button" className={button} disabled={save.isPending} onClick={()=>{setForm(null);setEditing(null);save.reset();}}>{t('Cancel')}</button></div>
    </form>}
    {campaigns.isLoading && <p role="status">{t('Loading')}</p>}
    {campaigns.error && <div role="alert" className="space-y-2 text-red-300"><p>{campaigns.error.message}</p><button className={button} onClick={()=>campaigns.refetch()}>{t('Retry')}</button></div>}
    {!campaigns.isLoading&&!campaigns.isError&&rows.length===0&&<p className="text-sm text-white/50">{t('No campaigns')}</p>}
    <div className="space-y-2">{rows.map(c=><article key={c.id} className="border border-white/10 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-medium">{c.name}</h3><p className="text-xs text-white/60">{brands[c.brand]} · {t(statuses[c.status])} · {money(c.budget_cad)}</p></div><button type="button" className={button} disabled={!!form} onClick={()=>open(c)}>{t('Edit')}</button></div>
      {c.objective&&<p className="text-sm whitespace-pre-wrap">{c.objective}</p>}
      {(c.starts_on||c.ends_on)&&<p className="text-xs text-white/60">{c.starts_on||'—'} – {c.ends_on||'—'}</p>}
    </article>)}</div>
    </>}
  </section>;
}
