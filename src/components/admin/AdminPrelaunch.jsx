import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44, supabase } from '@/api/base44Client';
import { Save, RefreshCw, ExternalLink, Plus, Trash2, ChevronUp, ChevronDown, Upload } from 'lucide-react';

const input = 'w-full border border-white/15 bg-black px-3 py-2 text-sm text-white outline-none focus:border-white/50';
const btn = 'border border-white/25 bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-black disabled:opacity-50';
const darkBtn = 'border border-white/20 bg-black px-3 py-2 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50';

const SECTION_HELP = {
  header: 'Brand, desktop private-preview button and mobile login button.',
  hero: 'Main hero content and background media.',
  hero_note: 'Small access note displayed below the hero buttons.',
  pillars_section: 'Controls visibility and order of the Vision / pillars block.',
  studio: 'Studio introduction and CTA.',
  studio_preview: 'Label displayed on video previews in the Studio block.',
  join_cast: 'Join the Cast introduction, background and CTA buttons.',
  forms: 'Controls visibility and order of the full pre-launch forms block.',
  pre_register: 'Pre-registration heading, copy, submit labels and feedback messages.',
  pre_register_fields: 'Pre-registration name and email placeholders.',
  join_team: 'Join the Team heading, copy, submit labels and feedback messages.',
  join_team_fields: 'Join the Team field placeholders.',
  footer: 'Footer brand and tagline.',
};

function Field({ label, children, className = '' }) {
  return <label className={`block ${className}`}><span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-white/45">{label}</span>{children}</label>;
}

function UploadControl({ label, accept, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setMessage('');
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      if (!result?.file_url) throw new Error('Upload completed without a public URL.');
      onUploaded(result.file_url, file);
      setMessage('Uploaded');
    } catch (error) {
      setMessage(error?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return <div>
    <label className={`${darkBtn} inline-flex cursor-pointer items-center gap-2 ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
      <Upload size={13}/>{uploading ? 'Uploading…' : label}
      <input type="file" accept={accept} className="hidden" onChange={handleFile}/>
    </label>
    {message && <div className={`mt-1 text-[11px] ${message === 'Uploaded' ? 'text-teal-300' : 'text-red-300'}`}>{message}</div>}
  </div>;
}

function MediaPreview({ value, kind = 'auto' }) {
  if (!value) return null;
  const clean = value.split('?')[0].toLowerCase();
  const looksVideo = kind === 'video' || (kind === 'auto' && /\.(mp4|webm|mov|m4v|ogg)$/.test(clean));

  return <div className="overflow-hidden border border-white/10 bg-black">
    {looksVideo ? (
      <video src={value} controls preload="metadata" className="max-h-56 w-full bg-black object-contain" />
    ) : (
      <img src={value} alt="Current media preview" className="max-h-56 w-full bg-black object-contain" />
    )}
  </div>;
}

function MediaUrlEditor({ label, value, onChange, accept = 'image/*,video/*', uploadLabel = 'Upload media', onFileUploaded, previewKind = 'auto' }) {
  return <Field label={label}>
    <div className="space-y-2">
      <MediaPreview value={value} kind={previewKind}/>
      <input className={input} value={value || ''} onChange={e=>onChange(e.target.value)} placeholder="Paste URL or upload a file"/>
      <UploadControl
        label={uploadLabel}
        accept={accept}
        onUploaded={(url, file) => {
          onChange(url);
          onFileUploaded?.(file);
        }}
      />
    </div>
  </Field>;
}

function SectionEditor({ section, onSaved, onMove }) {
  const [form, setForm] = useState(section);
  const [saving, setSaving] = useState(false);
  const key = form.section_key;

  const labels = {
    title: key === 'hero_note' ? 'Access note' : key === 'studio_preview' ? 'Preview label' : key === 'pre_register_fields' || key === 'join_team_fields' ? 'Name placeholder' : 'Title / brand',
    subtitle: key === 'pre_register' || key === 'join_team' ? 'Sending label' : key === 'pre_register_fields' || key === 'join_team_fields' ? 'Email placeholder' : 'Subtitle',
    body: key === 'join_team_fields' ? 'Role / specialty placeholder' : 'Body / description',
    button1Label: key === 'join_team_fields' ? 'Portfolio placeholder' : key === 'pre_register' || key === 'join_team' ? 'Submit button label' : 'Button 1 label',
    button1Url: key === 'pre_register' || key === 'join_team' ? 'Success message' : 'Button 1 URL',
    button2Label: key === 'join_team_fields' ? 'Message placeholder' : key === 'pre_register' ? 'Already registered message' : key === 'join_team' ? 'Error message' : 'Button 2 label',
    button2Url: key === 'pre_register' ? 'Generic error message' : 'Button 2 URL',
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('landing_sections').update({
      eyebrow: form.eyebrow,
      title: form.title,
      subtitle: form.subtitle,
      body: form.body,
      button_1_label: form.button_1_label,
      button_1_url: form.button_1_url,
      button_2_label: form.button_2_label,
      button_2_url: form.button_2_url,
      media_type: form.media_type,
      media_url: form.media_url,
      poster_url: form.poster_url,
      is_active: form.is_active,
      sort_order: Number(form.sort_order || 0),
      updated_at: new Date().toISOString(),
    }).eq('id', form.id);
    setSaving(false);
    if (error) alert(error.message);
    else onSaved();
  };

  const showEyebrow = !['header','hero_note','pillars_section','studio_preview','forms','pre_register_fields','join_team_fields','footer'].includes(key);
  const showMedia = ['hero','studio','join_cast'].includes(key);
  const showBody = !['header','hero_note','pillars_section','studio_preview','forms','pre_register_fields'].includes(key);
  const showButtons = ['header','hero','studio','join_cast','pre_register','join_team','join_team_fields'].includes(key);
  const showSubtitle = !['header','hero_note','pillars_section','studio_preview','forms','footer'].includes(key);

  return <div className="border border-white/15 bg-neutral-950 p-4">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="text-[10px] font-black uppercase tracking-widest text-teal-300">{key.replaceAll('_',' ')}</div>
        <div className="mt-1 text-sm text-white/45">{SECTION_HELP[key] || 'Landing section'}</div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={()=>onMove(section,-10)} title="Move up" className={darkBtn}><ChevronUp size={13}/></button>
        <button onClick={()=>onMove(section,10)} title="Move down" className={darkBtn}><ChevronDown size={13}/></button>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/> Visible</label>
      </div>
    </div>

    <div className="grid gap-3 md:grid-cols-2">
      {showEyebrow && <Field label="Eyebrow"><input className={input} value={form.eyebrow || ''} onChange={e=>setForm({...form,eyebrow:e.target.value})}/></Field>}
      <Field label={labels.title}><input className={input} value={form.title || ''} onChange={e=>setForm({...form,title:e.target.value})}/></Field>
      {showSubtitle && <Field label={labels.subtitle}><input className={input} value={form.subtitle || ''} onChange={e=>setForm({...form,subtitle:e.target.value})}/></Field>}
      <Field label="Order"><input className={input} type="number" value={form.sort_order ?? 0} onChange={e=>setForm({...form,sort_order:e.target.value})}/></Field>
      {showBody && <Field label={labels.body} className="md:col-span-2"><textarea className={input} rows="3" value={form.body || ''} onChange={e=>setForm({...form,body:e.target.value})}/></Field>}
      {showButtons && <>
        <Field label={labels.button1Label}><input className={input} value={form.button_1_label || ''} onChange={e=>setForm({...form,button_1_label:e.target.value})}/></Field>
        <Field label={labels.button1Url}><input className={input} value={form.button_1_url || ''} onChange={e=>setForm({...form,button_1_url:e.target.value})}/></Field>
        <Field label={labels.button2Label}><input className={input} value={form.button_2_label || ''} onChange={e=>setForm({...form,button_2_label:e.target.value})}/></Field>
        {key !== 'join_team' && key !== 'join_team_fields' && <Field label={labels.button2Url}><input className={input} value={form.button_2_url || ''} onChange={e=>setForm({...form,button_2_url:e.target.value})}/></Field>}
      </>}
      {showMedia && <>
        <Field label="Media type"><select className={input} value={form.media_type || 'image'} onChange={e=>setForm({...form,media_type:e.target.value})}><option value="image">Image</option><option value="video">Video</option><option value="background_video">Background video</option><option value="embed">Embed</option></select></Field>
        <MediaUrlEditor
          label="Media URL"
          value={form.media_url}
          onChange={url=>setForm(v=>({...v,media_url:url}))}
          accept="image/*,video/*"
          previewKind={form.media_type === 'video' || form.media_type === 'background_video' ? 'video' : form.media_type === 'image' ? 'image' : 'auto'}
          onFileUploaded={file=>setForm(v=>({...v, media_type: file.type?.startsWith('video/') ? (v.media_type === 'background_video' ? 'background_video' : 'video') : 'image'}))}
        />
        <div className="md:col-span-2">
          <MediaUrlEditor label="Video poster URL" value={form.poster_url} onChange={url=>setForm(v=>({...v,poster_url:url}))} accept="image/*" uploadLabel="Upload poster" previewKind="image"/>
        </div>
      </>}
    </div>
    <button disabled={saving} onClick={save} className={`${btn} mt-4 inline-flex items-center gap-2`}><Save size={14}/>{saving ? 'Saving…' : 'Save section'}</button>
  </div>;
}

function ItemEditor({ item, onSaved, onDelete, onMove }) {
  const [form, setForm] = useState(item);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('landing_section_items').update({
      title: form.title,
      body: form.body,
      media_type: form.media_type,
      media_url: form.media_url,
      poster_url: form.poster_url,
      link_label: form.link_label,
      link_url: form.link_url,
      is_active: form.is_active,
      sort_order: Number(form.sort_order || 0),
    }).eq('id', form.id);
    setSaving(false);
    if (error) alert(error.message);
    else onSaved();
  };

  const optionGroup = ['waitlist_languages','waitlist_interests'].includes(form.section_key);
  const navGroup = ['header_nav','footer_nav'].includes(form.section_key);
  const roleGroup = form.section_key === 'join_cast_roles';
  const mediaGroup = ['pillars','studio_tools','join_cast_roles'].includes(form.section_key);

  return <div className="border border-white/10 bg-neutral-950 p-3">
    <div className="mb-3 flex items-center justify-between gap-2">
      <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{form.section_key.replaceAll('_',' ')}</span>
      <div className="flex items-center gap-1">
        <button onClick={()=>onMove(item,-10)} className={darkBtn} title="Move up"><ChevronUp size={12}/></button>
        <button onClick={()=>onMove(item,10)} className={darkBtn} title="Move down"><ChevronDown size={12}/></button>
        <label className="ml-2 text-xs"><input type="checkbox" checked={!!form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/> Visible</label>
      </div>
    </div>
    <div className="grid gap-2 md:grid-cols-2">
      <Field label={optionGroup ? 'Option label' : navGroup ? 'Link label' : 'Title'}><input className={input} value={form.title || ''} onChange={e=>setForm({...form,title:e.target.value})}/></Field>
      <Field label="Order"><input className={input} type="number" value={form.sort_order ?? 0} onChange={e=>setForm({...form,sort_order:e.target.value})}/></Field>
      {!optionGroup && !navGroup && <Field label={roleGroup ? 'Second line' : 'Description'} className="md:col-span-2"><textarea className={input} rows="2" value={form.body || ''} onChange={e=>setForm({...form,body:e.target.value})}/></Field>}
      {(navGroup || optionGroup) && <Field label={optionGroup ? 'Saved value' : 'Link / anchor'} className="md:col-span-2"><input className={input} value={form.link_url || ''} onChange={e=>setForm({...form,link_url:e.target.value})}/></Field>}
      {!optionGroup && !navGroup && <>
        <Field label="Link label"><input className={input} value={form.link_label || ''} onChange={e=>setForm({...form,link_label:e.target.value})}/></Field>
        <Field label="Link URL"><input className={input} value={form.link_url || ''} onChange={e=>setForm({...form,link_url:e.target.value})}/></Field>
      </>}
      {mediaGroup && <>
        <Field label="Media type"><select className={input} value={form.media_type || 'image'} onChange={e=>setForm({...form,media_type:e.target.value})}><option value="image">Image</option><option value="video">Video</option><option value="embed">Embed</option></select></Field>
        <MediaUrlEditor
          label="Media URL"
          value={form.media_url}
          onChange={url=>setForm(v=>({...v,media_url:url}))}
          accept="image/*,video/*"
          previewKind={form.media_type === 'video' ? 'video' : form.media_type === 'image' ? 'image' : 'auto'}
          onFileUploaded={file=>setForm(v=>({...v,media_type:file.type?.startsWith('video/') ? 'video' : 'image'}))}
        />
        <div className="md:col-span-2">
          <MediaUrlEditor label="Poster URL" value={form.poster_url} onChange={url=>setForm(v=>({...v,poster_url:url}))} accept="image/*" uploadLabel="Upload poster" previewKind="image"/>
        </div>
      </>}
    </div>
    <div className="mt-3 flex gap-2">
      <button disabled={saving} onClick={save} className={btn}>{saving ? 'Saving…' : 'Save block'}</button>
      <button onClick={()=>onDelete(item)} className="inline-flex items-center gap-2 border border-red-400/40 px-3 py-2 text-xs font-black uppercase tracking-wider text-red-200"><Trash2 size={13}/>Delete</button>
    </div>
  </div>;
}

function NewItem({ onCreated }) {
  const [sectionKey, setSectionKey] = useState('pillars');
  const [title, setTitle] = useState('New block');
  const [creating, setCreating] = useState(false);
  const groups = ['pillars','studio_tools','header_nav','footer_nav','join_cast_roles','waitlist_languages','waitlist_interests'];

  const create = async () => {
    if (!title.trim() || !sectionKey.trim()) return;
    setCreating(true);
    const { data: existing } = await supabase.from('landing_section_items').select('sort_order').eq('section_key', sectionKey).order('sort_order', { ascending: false }).limit(1);
    const nextOrder = (existing?.[0]?.sort_order || 0) + 10;
    const { error } = await supabase.from('landing_section_items').insert({ section_key: sectionKey, title: title.trim(), media_type: 'image', is_active: true, sort_order: nextOrder });
    setCreating(false);
    if (error) alert(error.message);
    else { setTitle('New block'); onCreated(); }
  };

  return <div className="border border-dashed border-white/20 bg-white/[.02] p-4">
    <div className="mb-3 text-xs font-black uppercase tracking-widest text-white/60">Add a repeating block</div>
    <div className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
      <select className={input} value={sectionKey} onChange={e=>setSectionKey(e.target.value)}>{groups.map(g=><option key={g} value={g}>{g.replaceAll('_',' ')}</option>)}</select>
      <input className={input} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title / label"/>
      <button disabled={creating} onClick={create} className={`${btn} inline-flex items-center justify-center gap-2`}><Plus size={13}/>{creating ? 'Adding…' : 'Add'}</button>
    </div>
  </div>;
}

export default function AdminPrelaunch() {
  const qc = useQueryClient();
  const [view, setView] = useState('content');
  const [guestEmail, setGuestEmail] = useState('');
  const [accessMessage, setAccessMessage] = useState('');

  const { data: sections = [] } = useQuery({ queryKey:['admin-prelaunch-sections'], queryFn: async()=>{ const {data,error}=await supabase.from('landing_sections').select('*').order('sort_order'); if(error) throw error; return data||[]; }});
  const { data: items = [] } = useQuery({ queryKey:['admin-prelaunch-items'], queryFn: async()=>{ const {data,error}=await supabase.from('landing_section_items').select('*').order('section_key').order('sort_order'); if(error) throw error; return data||[]; }});
  const { data: waitlist = [] } = useQuery({ queryKey:['admin-waitlist'], queryFn: async()=>{ const {data,error}=await supabase.from('waitlist_subscribers').select('*').order('created_at',{ascending:false}); if(error) throw error; return data||[]; }});
  const { data: team = [] } = useQuery({ queryKey:['admin-team-apps'], queryFn: async()=>{ const {data,error}=await supabase.from('team_applications').select('*').order('created_at',{ascending:false}); if(error) throw error; return data||[]; }});
  const { data: access = [] } = useQuery({ queryKey:['admin-prelaunch-access'], queryFn: async()=>{ const { data, error } = await supabase.functions.invoke('prelaunch-access', { body: { action: 'list' } }); if(error) throw error; if(data?.error) throw new Error(data.error); return data?.users || []; }});

  const refreshAll = () => {
    ['admin-prelaunch-sections','admin-prelaunch-items','admin-waitlist','admin-team-apps','admin-prelaunch-access','prelaunch-sections','prelaunch-items'].forEach(key=>qc.invalidateQueries({queryKey:[key]}));
  };

  const grouped = useMemo(()=>items.reduce((a,i)=>{ (a[i.section_key] ||= []).push(i); return a; },{}),[items]);

  const moveSection = async (section, delta) => {
    const { error } = await supabase.from('landing_sections').update({ sort_order: Number(section.sort_order || 0) + delta, updated_at: new Date().toISOString() }).eq('id', section.id);
    if (error) alert(error.message); else refreshAll();
  };
  const moveItem = async (item, delta) => {
    const { error } = await supabase.from('landing_section_items').update({ sort_order: Number(item.sort_order || 0) + delta }).eq('id', item.id);
    if (error) alert(error.message); else refreshAll();
  };
  const deleteItem = async (item) => {
    if (!window.confirm(`Delete “${item.title}”?`)) return;
    const { error } = await supabase.from('landing_section_items').delete().eq('id', item.id);
    if (error) alert(error.message); else refreshAll();
  };

  const updateWait = async (id, patch) => { const {error}=await supabase.from('waitlist_subscribers').update(patch).eq('id',id); if(error) alert(error.message); else qc.invalidateQueries({queryKey:['admin-waitlist']}); };
  const updateTeam = async (id, patch) => { const {error}=await supabase.from('team_applications').update(patch).eq('id',id); if(error) alert(error.message); else qc.invalidateQueries({queryKey:['admin-team-apps']}); };

  const inviteGuest = async (event) => {
    event.preventDefault();
    setAccessMessage('');
    const { data, error } = await supabase.functions.invoke('prelaunch-access', { body: { action: 'invite_guest', email: guestEmail, redirect_to: `${window.location.origin}/Login` } });
    if (error || data?.error) { setAccessMessage(data?.error || error?.message || 'Unable to invite guest.'); return; }
    setGuestEmail('');
    setAccessMessage('Guest access is ready. If this is a new account, an invitation email was sent.');
    qc.invalidateQueries({queryKey:['admin-prelaunch-access']});
  };

  const revokeGuest = async (userId) => {
    setAccessMessage('');
    const { data, error } = await supabase.functions.invoke('prelaunch-access', { body: { action: 'revoke_guest', user_id: userId } });
    if (error || data?.error) { setAccessMessage(data?.error || error?.message || 'Unable to revoke guest access.'); return; }
    setAccessMessage('Guest access removed.');
    qc.invalidateQueries({queryKey:['admin-prelaunch-access']});
  };

  const exportWaitlist = () => {
    const rows=[['Name','Email','Language','Interest','Status','Priority','Created'],...waitlist.map(x=>[x.name,x.email,x.language,x.interest,x.status,x.priority?'yes':'no',x.created_at])];
    const csv=rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download='aistageone-prelaunch-waitlist.csv'; a.click(); URL.revokeObjectURL(a.href);
  };

  return <div className="text-white">
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {['content','waitlist','team','access'].map(v=><button key={v} onClick={()=>setView(v)} className={`border px-4 py-2 text-xs font-black uppercase tracking-wider ${view===v?'border-white bg-white text-black':'border-white/20 text-white'}`}>{v==='content'?'Landing content':v==='access'?'Guest access':v}</button>)}
      <a href="/" target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-2 border border-teal-300/50 px-3 py-2 text-xs font-black uppercase tracking-wider text-teal-200">Open landing <ExternalLink size={13}/></a>
      <button onClick={refreshAll} className="inline-flex items-center gap-2 border border-white/20 px-3 py-2 text-xs font-black uppercase tracking-wider"><RefreshCw size={13}/>Refresh</button>
    </div>

    {view==='content' && <div className="space-y-8">
      <div className="border border-teal-300/20 bg-teal-300/[.04] p-4 text-sm text-white/70">Everything visible on the pre-launch landing is controlled here. Media can be uploaded directly from the admin; the public URL is filled automatically, while manual URLs remain available.</div>
      <section><h3 className="mb-3 text-xl font-black uppercase">Page sections</h3><div className="space-y-4">{sections.map(s=><SectionEditor key={s.id} section={s} onSaved={refreshAll} onMove={moveSection}/>)}</div></section>
      <NewItem onCreated={refreshAll}/>
      {Object.entries(grouped).map(([key,list])=><section key={key}><h3 className="mb-3 text-xl font-black uppercase">{key.replaceAll('_',' ')}</h3><div className="grid gap-3 xl:grid-cols-2">{list.map(i=><ItemEditor key={i.id} item={i} onSaved={refreshAll} onDelete={deleteItem} onMove={moveItem}/>)}</div></section>)}
    </div>}

    {view==='waitlist' && <div>
      <div className="mb-4 flex items-center justify-between"><div><h3 className="text-xl font-black uppercase">Pre-registration list</h3><p className="text-sm text-white/50">{waitlist.length} people</p></div><button onClick={exportWaitlist} className={btn}>Export CSV</button></div>
      <div className="overflow-x-auto border border-white/10"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-white/5 text-[10px] uppercase tracking-wider text-white/50"><tr><th className="p-3">Name</th><th>Email</th><th>Interest</th><th>Status</th><th>Priority</th><th>Notes</th><th>Created</th></tr></thead><tbody>{waitlist.map(x=><tr key={x.id} className="border-t border-white/10"><td className="p-3 font-bold">{x.name}</td><td>{x.email}</td><td>{x.interest}</td><td><select value={x.status} onChange={e=>updateWait(x.id,{status:e.target.value})} className="border border-white/15 bg-black px-2 py-1"><option>new</option><option>contacted</option><option>approved</option><option>invited</option><option>archived</option></select></td><td><input type="checkbox" checked={!!x.priority} onChange={e=>updateWait(x.id,{priority:e.target.checked})}/></td><td><input defaultValue={x.notes||''} onBlur={e=>updateWait(x.id,{notes:e.target.value})} className="w-48 border border-white/15 bg-black px-2 py-1"/></td><td className="text-white/45">{new Date(x.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div>
    </div>}

    {view==='team' && <div>
      <div className="mb-4"><h3 className="text-xl font-black uppercase">Team applications</h3><p className="text-sm text-white/50">{team.length} applications</p></div>
      <div className="overflow-x-auto border border-white/10"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-white/5 text-[10px] uppercase tracking-wider text-white/50"><tr><th className="p-3">Name</th><th>Email</th><th>Role</th><th>Portfolio</th><th>Message</th><th>Status</th><th>Notes</th><th>Created</th></tr></thead><tbody>{team.map(x=><tr key={x.id} className="border-t border-white/10 align-top"><td className="p-3 font-bold">{x.name}</td><td>{x.email}</td><td>{x.role_interest}</td><td>{x.portfolio_url ? <a href={x.portfolio_url} target="_blank" rel="noreferrer" className="text-teal-300 underline">Open</a> : ''}</td><td className="max-w-xs whitespace-pre-wrap text-white/65">{x.message}</td><td><select value={x.status} onChange={e=>updateTeam(x.id,{status:e.target.value})} className="border border-white/15 bg-black px-2 py-1"><option>new</option><option>reviewing</option><option>contacted</option><option>accepted</option><option>declined</option><option>archived</option></select></td><td><input defaultValue={x.notes||''} onBlur={e=>updateTeam(x.id,{notes:e.target.value})} className="w-48 border border-white/15 bg-black px-2 py-1"/></td><td className="text-white/45">{new Date(x.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div>
    </div>}

    {view==='access' && <div>
      <div className="mb-5"><h3 className="text-xl font-black uppercase">Private Preview Access</h3><p className="mt-1 text-sm text-white/50">Only Admin and Guest roles can enter the full platform during pre-launch.</p></div>
      <form onSubmit={inviteGuest} className="mb-6 flex max-w-2xl gap-2"><input required type="email" value={guestEmail} onChange={e=>setGuestEmail(e.target.value)} placeholder="guest@email.com" className={input}/><button className={`${btn} whitespace-nowrap`}>Invite / Grant Guest</button></form>
      {accessMessage && <p className="mb-5 text-sm font-semibold text-[#d7b773]">{accessMessage}</p>}
      <div className="overflow-x-auto border border-white/10"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-white/5 text-[10px] uppercase tracking-wider text-white/50"><tr><th className="p-3">Email</th><th>Role</th><th>Created</th><th>Last sign in</th><th></th></tr></thead><tbody>{access.map(x=><tr key={x.id} className="border-t border-white/10"><td className="p-3 font-bold">{x.email}</td><td className="uppercase text-[#7ec7c1]">{x.role}</td><td className="text-white/45">{x.created_at ? new Date(x.created_at).toLocaleDateString() : ''}</td><td className="text-white/45">{x.last_sign_in_at ? new Date(x.last_sign_in_at).toLocaleString() : '—'}</td><td>{x.role === 'guest' && <button onClick={()=>revokeGuest(x.id)} className="border border-red-400/40 px-3 py-1 text-xs font-black uppercase text-red-200">Revoke</button>}</td></tr>)}</tbody></table></div>
    </div>}
  </div>;
}
