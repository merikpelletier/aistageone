import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/base44Client';
import { Save, RefreshCw, ExternalLink } from 'lucide-react';

const input = "w-full border border-white/15 bg-black px-3 py-2 text-sm text-white outline-none focus:border-white/50";
const btn = "border border-white/25 bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-black disabled:opacity-50";

function SectionEditor({ section, onSaved }) {
  const [form, setForm] = useState(section);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('landing_sections').update({
      eyebrow: form.eyebrow, title: form.title, subtitle: form.subtitle, body: form.body,
      button_1_label: form.button_1_label, button_1_url: form.button_1_url,
      button_2_label: form.button_2_label, button_2_url: form.button_2_url,
      media_type: form.media_type, media_url: form.media_url, poster_url: form.poster_url,
      is_active: form.is_active, sort_order: Number(form.sort_order || 0), updated_at: new Date().toISOString()
    }).eq('id', form.id);
    setSaving(false);
    if (!error) onSaved();
    else alert(error.message);
  };
  return <div className="border border-white/15 bg-neutral-950 p-4">
    <div className="mb-4 flex items-center justify-between"><div><div className="text-[10px] font-black uppercase tracking-widest text-teal-300">{form.section_key}</div><div className="text-lg font-black">{form.title}</div></div><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/> Active</label></div>
    <div className="grid gap-3 md:grid-cols-2">
      <input className={input} value={form.eyebrow || ''} onChange={e=>setForm({...form,eyebrow:e.target.value})} placeholder="Eyebrow"/>
      <input className={input} value={form.title || ''} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Title"/>
      <input className={input} value={form.subtitle || ''} onChange={e=>setForm({...form,subtitle:e.target.value})} placeholder="Subtitle"/>
      <input className={input} type="number" value={form.sort_order || 0} onChange={e=>setForm({...form,sort_order:e.target.value})} placeholder="Order"/>
      <textarea className={input + " md:col-span-2"} rows="3" value={form.body || ''} onChange={e=>setForm({...form,body:e.target.value})} placeholder="Body"/>
      <input className={input} value={form.button_1_label || ''} onChange={e=>setForm({...form,button_1_label:e.target.value})} placeholder="Button 1 label"/>
      <input className={input} value={form.button_1_url || ''} onChange={e=>setForm({...form,button_1_url:e.target.value})} placeholder="Button 1 URL"/>
      <input className={input} value={form.button_2_label || ''} onChange={e=>setForm({...form,button_2_label:e.target.value})} placeholder="Button 2 label"/>
      <input className={input} value={form.button_2_url || ''} onChange={e=>setForm({...form,button_2_url:e.target.value})} placeholder="Button 2 URL"/>
      <select className={input} value={form.media_type || 'image'} onChange={e=>setForm({...form,media_type:e.target.value})}><option value="image">Image</option><option value="video">Video</option><option value="background_video">Background video</option><option value="embed">Embed</option></select>
      <input className={input} value={form.media_url || ''} onChange={e=>setForm({...form,media_url:e.target.value})} placeholder="Media URL"/>
      <input className={input + " md:col-span-2"} value={form.poster_url || ''} onChange={e=>setForm({...form,poster_url:e.target.value})} placeholder="Video poster URL (optional)"/>
    </div>
    <button disabled={saving} onClick={save} className={btn + " mt-4 inline-flex items-center gap-2"}><Save size={14}/>{saving ? 'Saving…' : 'Save section'}</button>
  </div>;
}

function ItemEditor({ item, onSaved }) {
  const [form, setForm] = useState(item);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('landing_section_items').update({
      title: form.title, body: form.body, media_type: form.media_type, media_url: form.media_url,
      poster_url: form.poster_url, link_label: form.link_label, link_url: form.link_url,
      is_active: form.is_active, sort_order: Number(form.sort_order || 0)
    }).eq('id', form.id);
    setSaving(false); if (!error) onSaved(); else alert(error.message);
  };
  return <div className="border border-white/10 bg-neutral-950 p-3">
    <div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-widest text-white/40">{form.section_key}</span><label className="text-xs"><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/> Active</label></div>
    <div className="grid gap-2 md:grid-cols-2">
      <input className={input} value={form.title || ''} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Title"/>
      <input className={input} type="number" value={form.sort_order || 0} onChange={e=>setForm({...form,sort_order:e.target.value})} placeholder="Order"/>
      <textarea className={input + " md:col-span-2"} rows="2" value={form.body || ''} onChange={e=>setForm({...form,body:e.target.value})} placeholder="Body"/>
      <select className={input} value={form.media_type || 'image'} onChange={e=>setForm({...form,media_type:e.target.value})}><option value="image">Image</option><option value="video">Video</option><option value="embed">Embed</option></select>
      <input className={input} value={form.media_url || ''} onChange={e=>setForm({...form,media_url:e.target.value})} placeholder="Media URL"/>
      <input className={input} value={form.link_label || ''} onChange={e=>setForm({...form,link_label:e.target.value})} placeholder="Link label"/>
      <input className={input} value={form.link_url || ''} onChange={e=>setForm({...form,link_url:e.target.value})} placeholder="Link URL"/>
    </div>
    <button disabled={saving} onClick={save} className={btn + " mt-3"}>{saving ? 'Saving…' : 'Save block'}</button>
  </div>;
}

export default function AdminPrelaunch() {
  const qc = useQueryClient();
  const [view, setView] = useState('content');
  const { data: sections = [], isFetching: fs } = useQuery({ queryKey:['admin-prelaunch-sections'], queryFn: async()=>{const {data,error}=await supabase.from('landing_sections').select('*').order('sort_order'); if(error) throw error; return data||[];}});
  const { data: items = [], isFetching: fi } = useQuery({ queryKey:['admin-prelaunch-items'], queryFn: async()=>{const {data,error}=await supabase.from('landing_section_items').select('*').order('section_key').order('sort_order'); if(error) throw error; return data||[];}});
  const { data: waitlist = [], isFetching: fw } = useQuery({ queryKey:['admin-waitlist'], queryFn: async()=>{const {data,error}=await supabase.from('waitlist_subscribers').select('*').order('created_at',{ascending:false}); if(error) throw error; return data||[];}});
  const { data: team = [], isFetching: ft } = useQuery({ queryKey:['admin-team-apps'], queryFn: async()=>{const {data,error}=await supabase.from('team_applications').select('*').order('created_at',{ascending:false}); if(error) throw error; return data||[];}});
  const refresh = ()=>qc.invalidateQueries({queryKey:['admin-prelaunch']});
  const refreshAll = ()=>{ ['admin-prelaunch-sections','admin-prelaunch-items','admin-waitlist','admin-team-apps','prelaunch-sections','prelaunch-items'].forEach(key=>qc.invalidateQueries({queryKey:[key]})); };
  const grouped = useMemo(()=>items.reduce((a,i)=>{(a[i.section_key] ||= []).push(i); return a;},{}),[items]);

  const updateWait = async (id, patch) => { const {error}=await supabase.from('waitlist_subscribers').update(patch).eq('id',id); if(error) alert(error.message); else qc.invalidateQueries({queryKey:['admin-waitlist']}); };
  const updateTeam = async (id, patch) => { const {error}=await supabase.from('team_applications').update(patch).eq('id',id); if(error) alert(error.message); else qc.invalidateQueries({queryKey:['admin-team-apps']}); };
  const exportWaitlist = () => {
    const rows=[['Name','Email','Language','Interest','Status','Priority','Created'],...waitlist.map(x=>[x.name,x.email,x.language,x.interest,x.status,x.priority?'yes':'no',x.created_at])];
    const csv=rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download='aistageone-prelaunch-waitlist.csv'; a.click(); URL.revokeObjectURL(a.href);
  };

  return <div className="text-white">
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {['content','waitlist','team'].map(v=><button key={v} onClick={()=>setView(v)} className={`border px-4 py-2 text-xs font-black uppercase tracking-wider ${view===v?'border-white bg-white text-black':'border-white/20 text-white'}`}>{v==='content'?'Landing content':v}</button>)}
      <a href="/" target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-2 border border-teal-300/50 px-3 py-2 text-xs font-black uppercase tracking-wider text-teal-200">Open landing <ExternalLink size={13}/></a>
      <button onClick={refreshAll} className="inline-flex items-center gap-2 border border-white/20 px-3 py-2 text-xs font-black uppercase tracking-wider"><RefreshCw size={13}/>Refresh</button>
    </div>

    {view==='content' && <div className="space-y-8">
      <section><h3 className="mb-3 text-xl font-black uppercase">Main sections</h3><div className="space-y-4">{sections.map(s=><SectionEditor key={s.id} section={s} onSaved={refreshAll}/>)}</div></section>
      {Object.entries(grouped).map(([key,list])=><section key={key}><h3 className="mb-3 text-xl font-black uppercase">{key.replaceAll('_',' ')}</h3><div className="grid gap-3 xl:grid-cols-2">{list.map(i=><ItemEditor key={i.id} item={i} onSaved={refreshAll}/>)}</div></section>)}
    </div>}

    {view==='waitlist' && <div>
      <div className="mb-4 flex items-center justify-between"><div><h3 className="text-xl font-black uppercase">Pre-registration list</h3><p className="text-sm text-white/50">{waitlist.length} people</p></div><button onClick={exportWaitlist} className={btn}>Export CSV</button></div>
      <div className="overflow-x-auto border border-white/10"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-white/5 text-[10px] uppercase tracking-wider text-white/50"><tr><th className="p-3">Name</th><th>Email</th><th>Interest</th><th>Status</th><th>Priority</th><th>Notes</th><th>Created</th></tr></thead><tbody>{waitlist.map(x=><tr key={x.id} className="border-t border-white/10"><td className="p-3 font-bold">{x.name}</td><td>{x.email}</td><td>{x.interest}</td><td><select value={x.status} onChange={e=>updateWait(x.id,{status:e.target.value})} className="bg-black border border-white/15 px-2 py-1"><option>new</option><option>contacted</option><option>approved</option><option>invited</option><option>archived</option></select></td><td><input type="checkbox" checked={x.priority} onChange={e=>updateWait(x.id,{priority:e.target.checked})}/></td><td><input defaultValue={x.notes||''} onBlur={e=>updateWait(x.id,{notes:e.target.value})} className="w-48 bg-black border border-white/15 px-2 py-1"/></td><td className="text-white/45">{new Date(x.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div>
    </div>}

    {view==='team' && <div>
      <div className="mb-4"><h3 className="text-xl font-black uppercase">Join the Team applications</h3><p className="text-sm text-white/50">{team.length} applications</p></div>
      <div className="space-y-3">{team.map(x=><div key={x.id} className="border border-white/10 bg-neutral-950 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-lg font-black">{x.name}</div><a href={`mailto:${x.email}`} className="text-sm text-teal-300">{x.email}</a><div className="mt-1 text-xs uppercase tracking-wider text-white/45">{x.role_interest||'No role specified'}</div>{x.portfolio_url&&<a href={x.portfolio_url} target="_blank" rel="noreferrer" className="mt-2 block text-xs text-[#d7b773]">{x.portfolio_url}</a>}</div><select value={x.status} onChange={e=>updateTeam(x.id,{status:e.target.value})} className="bg-black border border-white/15 px-2 py-1 text-sm"><option>new</option><option>reviewing</option><option>contacted</option><option>accepted</option><option>declined</option><option>archived</option></select></div>{x.message&&<p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-white/65">{x.message}</p>}<input defaultValue={x.notes||''} onBlur={e=>updateTeam(x.id,{notes:e.target.value})} placeholder="Admin notes" className={input+" mt-4"}/></div>)}</div>
    </div>}
  </div>;
}
