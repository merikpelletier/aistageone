import React,{useState} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {supabase} from '@/api/base44Client';
const callback='https://aistage.one';
const providers=[['meta','Facebook / Instagram'],['youtube','YouTube']];
export default function AdminMarketingSocialAccounts({t}){
 const [brand,setBrand]=useState('aistage'),[provider,setProvider]=useState('meta'),[client,setClient]=useState(''),[secret,setSecret]=useState('');
 const qc=useQueryClient();
 const configs=useQuery({queryKey:['marketing-social-config'],queryFn:async()=>{const {data,error}=await supabase.rpc('marketing_social_list_config');if(error)throw error;return data;}});
 const current=configs.data?.find(x=>x.brand===brand&&x.provider===provider);
 const save=useMutation({mutationFn:async()=>{const {error}=await supabase.rpc('marketing_social_save_config',{p_brand:brand,p_provider:provider,p_client_id:client.trim(),p_secret:secret});if(error)throw Error(t('Unable to save configuration'));},onSuccess:()=>{setSecret('');setClient('');qc.invalidateQueries({queryKey:['marketing-social-config']});}});
 const select=(fn,v)=>{fn(v);setClient('');setSecret('');save.reset();};
 const field='w-full border border-white/20 bg-neutral-950 px-3 py-2 text-sm text-white';
 return <section className="min-w-0 space-y-4" data-marketing-social-accounts>
 <h2 className="text-lg font-medium">{t('Social Accounts')}</h2>
 <div className="flex flex-wrap gap-2">{['aistage','leplateau'].map(b=><button key={b} disabled={save.isPending} className={'px-3 py-2 text-sm border '+(brand===b?'bg-white text-black':'border-white/20')} onClick={()=>select(setBrand,b)}>{b==='aistage'?'AISTAGE.ONE':'LEPLATEAU.AI'}</button>)}</div>
 <div className="flex gap-2">{providers.map(([p,label])=><button key={p} disabled={save.isPending} className={'px-3 py-2 text-sm border '+(provider===p?'bg-white text-black':'border-white/20')} onClick={()=>select(setProvider,p)}>{label}</button>)}</div>
 {configs.isError?<p role="alert">{t('Unable to load configuration')}</p>:<p className="text-xs text-white/70">{t(configs.isPending?'Loading':current?'Configuration saved — authorization pending':'Not configured')}</p>}
 <form className="border border-white/15 p-4 space-y-3" onSubmit={e=>{e.preventDefault();if(client.trim()&&secret&&!save.isPending)save.mutate();}}>
 <label className="block text-xs space-y-1">{provider==='meta'?'App ID':'OAuth Client ID'}<input autoComplete="off" required maxLength={512} className={field} value={client} placeholder={current?.client_id||''} onChange={e=>setClient(e.target.value)}/></label>
 <label className="block text-xs space-y-1">{provider==='meta'?'App Secret':'OAuth Client Secret'}<input type="password" autoComplete="new-password" required maxLength={4096} className={field} value={secret} onChange={e=>setSecret(e.target.value)}/></label>
 <button disabled={!client.trim()||!secret||save.isPending} className="bg-white text-black px-3 py-2 text-sm disabled:opacity-50">{t('Save configuration')}</button>
 {save.isError&&<p role="alert" className="text-red-300 text-xs">{t('Unable to save configuration')}</p>}
 </form>
 <p className="text-xs text-white/70">{t('OAuth authorization is not available until the provider integration is installed.')}</p>
 <a className="text-sm underline" target="_blank" rel="noreferrer" href={provider==='meta'?'https://developers.facebook.com/apps/':'https://console.cloud.google.com/apis/credentials'}>{t('Open developer console')}</a>
 </section>;
}
