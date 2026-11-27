import React,{useState,useEffect,useRef} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {supabase} from '@/api/base44Client';
const callback='https://aistage.one/marketing-oauth-callback.html';
const providers=[['meta','Facebook / Instagram'],['youtube','YouTube']];
export default function AdminMarketingSocialAccounts({t}){
 const [brand,setBrand]=useState('aistage'),[provider,setProvider]=useState('meta'),[client,setClient]=useState(''),[secret,setSecret]=useState('');
 const qc=useQueryClient();
 const configs=useQuery({queryKey:['marketing-social-config'],queryFn:async()=>{const {data,error}=await supabase.rpc('marketing_social_list_config');if(error)throw error;return data;}});
 const current=configs.data?.find(x=>x.brand===brand&&x.provider===provider);
 const save=useMutation({mutationFn:async()=>{const {error}=await supabase.rpc('marketing_social_save_config',{p_brand:brand,p_provider:provider,p_client_id:client.trim(),p_secret:secret});if(error)throw Error(t('Unable to save configuration'));},onSuccess:()=>{setSecret('');setClient('');qc.invalidateQueries({queryKey:['marketing-social-config']});}});
 const [busy,setBusy]=useState(false),[problem,setProblem]=useState('');
 const popup=useRef(null);
 const invoke=async(action,extra={})=>{const {data,error}=await supabase.functions.invoke('marketing-social-oauth',{body:{action,brand,provider,...extra}});if(error||data?.error)throw Error('oauth');return data;};
 const accounts=useQuery({queryKey:['marketing-social-accounts',brand,provider],queryFn:()=>invoke('list'),enabled:!!current});
 const run=async(action,extra={})=>{setBusy(true);setProblem('');try{await invoke(action,extra);await accounts.refetch();}catch{setProblem(t('Social authorization failed'));}finally{setBusy(false);}};
 useEffect(()=>{const listener=e=>{if(e.origin!=='https://aistage.one'||e.source!==popup.current||e.data?.type!=='marketing-oauth-result')return;popup.current=null;if(e.data.error||!e.data.code){setBusy(false);setProblem(t('Social authorization canceled'));return;}run('finish',{code:e.data.code,state:e.data.state});};window.addEventListener('message',listener);return()=>window.removeEventListener('message',listener);},[brand,provider,t]);
 const authorize=async()=>{const w=window.open('about:blank','marketing-oauth','width=650,height=780');if(!w){setProblem(t('Allow popups to authorize'));return;}popup.current=w;setBusy(true);setProblem('');try{const r=await invoke('start');w.location.href=r.url;}catch{w.close();popup.current=null;setBusy(false);setProblem(t('Social authorization failed'));}};
 const select=(fn,v)=>{fn(v);setClient('');setSecret('');save.reset();};
 const field='w-full border border-white/20 bg-neutral-950 px-3 py-2 text-sm text-white';
 return <section className="min-w-0 space-y-4" data-marketing-social-accounts>
 <h2 className="text-lg font-medium">{t('Social Accounts')}</h2>
 <div className="flex flex-wrap gap-2">{['aistage','leplateau'].map(b=><button key={b} disabled={save.isPending||busy} className={'px-3 py-2 text-sm border '+(brand===b?'bg-white text-black':'border-white/20')} onClick={()=>select(setBrand,b)}>{b==='aistage'?'AISTAGE.ONE':'LEPLATEAU.AI'}</button>)}</div>
 <div className="flex gap-2">{providers.map(([p,label])=><button key={p} disabled={save.isPending||busy} className={'px-3 py-2 text-sm border '+(provider===p?'bg-white text-black':'border-white/20')} onClick={()=>select(setProvider,p)}>{label}</button>)}</div>
 {configs.isError?<p role="alert">{t('Unable to load configuration')}</p>:<p className="text-xs text-white/70">{t(configs.isPending?'Loading':current?'Configuration saved':'Not configured')}</p>}
 <form className="border border-white/15 p-4 space-y-3" onSubmit={e=>{e.preventDefault();if(client.trim()&&secret&&!save.isPending&&!busy)save.mutate();}}>
 <label className="block text-xs space-y-1">{provider==='meta'?'App ID':'OAuth Client ID'}<input autoComplete="off" required maxLength={512} className={field} value={client} placeholder={current?.client_id||''} onChange={e=>setClient(e.target.value)}/></label>
 <label className="block text-xs space-y-1">{provider==='meta'?'App Secret':'OAuth Client Secret'}<input type="password" autoComplete="new-password" required maxLength={4096} className={field} value={secret} onChange={e=>setSecret(e.target.value)}/></label>
 <button disabled={!client.trim()||!secret||save.isPending||busy} className="bg-white text-black px-3 py-2 text-sm disabled:opacity-50">{t('Save configuration')}</button>
 {save.isError&&<p role="alert" className="text-red-300 text-xs">{t('Unable to save configuration')}</p>}
 </form>
 <div className="border border-white/15 p-3 space-y-2"><p className="text-xs text-white/70">{t('Authorized redirect URI')}</p><code className="text-xs break-all">{callback}</code><button type="button" className="border border-white/20 px-2 py-1 text-xs ml-2" onClick={()=>navigator.clipboard.writeText(callback)}>{t('Copy')}</button></div>
 <div className="flex flex-wrap gap-2"><button disabled={!current||busy||save.isPending} className="bg-white text-black px-3 py-2 text-sm disabled:opacity-50" onClick={authorize}>{t('Authorize account')}</button>{busy&&<button className="border border-white/20 px-3 py-2 text-sm" onClick={()=>{if(popup.current){popup.current.close();popup.current=null;setBusy(false);}}}>{t('Cancel')}</button>}</div>
 {problem&&<p role="alert" className="text-red-300 text-sm">{problem}</p>}
 {accounts.isError&&<p role="alert" className="text-red-300">{t('Unable to load configuration')}</p>}
 {(accounts.data?.accounts||[]).map(a=><article key={a.network+':'+a.account_id} className="border border-white/15 p-3 flex flex-wrap items-center justify-between gap-2"><div><div className="font-medium">{a.account_name}</div><div className="text-xs text-white/70">{a.network} · {a.account_id}</div><div className="text-xs text-white/60">{t('Last verification')}: {new Date(a.verified_at).toLocaleString()}</div><div className="text-xs text-white/60">{t('Expiration')}: {a.expires_at?new Date(a.expires_at).toLocaleString():'—'}</div><div className="text-xs break-all text-white/60">{t('Permissions')}: {a.scopes||'—'}</div></div><div className="flex gap-2"><button disabled={busy} className="border border-white/20 px-2 py-1 text-xs" onClick={()=>run('verify',{network:a.network,account_id:a.account_id})}>{t('Verify connection')}</button><button disabled={busy} className="border border-white/20 px-2 py-1 text-xs" onClick={()=>{if(window.confirm(t('Disconnect this social account locally?')))run('disconnect',{network:a.network,account_id:a.account_id});}}>{t('Disconnect')}</button></div></article>)}
 <p className="text-xs text-white/60">{t('No social publication is performed by this module.')}</p>
 <a className="text-sm underline" target="_blank" rel="noreferrer" href={provider==='meta'?'https://developers.facebook.com/apps/':'https://console.cloud.google.com/apis/credentials'}>{t('Open developer console')}</a>
 </section>;
}
