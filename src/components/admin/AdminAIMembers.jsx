import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Bot,
  CalendarClock,
  Check,
  ImagePlus,
  Link2,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { AI_MEMBER_COHORT } from './aiMemberCohort';
import MerchantInlineTools from './MerchantInlineTools';

const MEMBER_TYPES = ['creator', 'talent', 'media', 'sponsor', 'merchant', 'producer', 'social'];
const ACTIVITY_TYPES = ['publish', 'comment', 'like', 'follow', 'sponsor', 'sell', 'collaborate', 'system'];
const RELATIONSHIP_TYPES = ['follows', 'collaborator', 'client', 'sponsor', 'represented_by', 'media_interest', 'friend', 'rival'];
const CAPABILITIES = ['publish', 'comment', 'like', 'follow', 'sponsor', 'sell', 'collaborate'];

const EMPTY_MEMBER = {
  display_name: '', handle: '', avatar_url: '', member_type: 'creator', headline: '', title: '', bio: '',
  images: [], links: [], custom_banner_url: '', custom_banner_link: '', language: 'en', location_label: '',
  persona: '', voice_style: '', visual_style: '', interests: [], content_types: [],
  capabilities: { publish: true, comment: true, like: true, follow: true, sponsor: false, sell: false, collaborate: true },
  automation_enabled: false, activity_frequency: 'manual', quiet_hours: '', is_active: true, is_ai_disclosed: true, notes: '',
};

const splitTags = value => String(value || '').split(',').map(v => v.trim()).filter(Boolean);
const memberName = (members, id) => members.find(m => m.id === id)?.display_name || 'Unknown member';

async function uploadImage(file) {
  if (!file) return null;
  if (!file.type?.startsWith('image/')) throw new Error('Please choose an image file.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Image must be 10 MB or smaller.');
  const result = await base44.integrations.Core.UploadFile({ file });
  return result.file_url;
}

export default function AdminAIMembers() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('members');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_MEMBER);
  const [uploading, setUploading] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [activityForm, setActivityForm] = useState({ ai_member_id: '', activity_type: 'publish', target_type: '', target_id: '', target_label: '', content: '', status: 'draft', scheduled_for: '' });
  const [relationshipForm, setRelationshipForm] = useState({ source_member_id: '', target_member_id: '', relationship_type: 'follows', strength: 'normal', notes: '', is_active: true });

  const { data: members = [], isLoading } = useQuery({ queryKey: ['ai-members'], queryFn: () => base44.entities.AIMember.list('-created_date', 200) });
  const { data: dossiers = [] } = useQuery({ queryKey: ['ai-member-dossiers'], queryFn: () => base44.entities.Dossier.list('order', 500) });
  const { data: activities = [] } = useQuery({ queryKey: ['ai-member-activities'], queryFn: () => base44.entities.AIMemberActivity.list('-created_date', 300) });
  const { data: relationships = [] } = useQuery({ queryKey: ['ai-member-relationships'], queryFn: () => base44.entities.AIMemberRelationship.list('-created_date', 300) });

  const refreshMembers = () => qc.invalidateQueries({ queryKey: ['ai-members'] });
  const createMember = useMutation({ mutationFn: data => base44.entities.AIMember.create(data), onSuccess: refreshMembers });
  const updateMember = useMutation({ mutationFn: ({ id, data }) => base44.entities.AIMember.update(id, data), onSuccess: refreshMembers });
  const deleteMember = useMutation({ mutationFn: id => base44.entities.AIMember.delete(id), onSuccess: refreshMembers });
  const updateDossier = useMutation({ mutationFn: ({ id, data }) => base44.entities.Dossier.update(id, data), onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-member-dossiers'] }) });
  const createActivity = useMutation({ mutationFn: data => base44.entities.AIMemberActivity.create(data), onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-member-activities'] }) });
  const deleteActivity = useMutation({ mutationFn: id => base44.entities.AIMemberActivity.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-member-activities'] }) });
  const createRelationship = useMutation({ mutationFn: data => base44.entities.AIMemberRelationship.create(data), onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-member-relationships'] }) });
  const deleteRelationship = useMutation({ mutationFn: id => base44.entities.AIMemberRelationship.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-member-relationships'] }) });

  const filteredMembers = useMemo(() => members.filter(member => {
    const matchesType = typeFilter === 'all' || member.member_type === typeFilter;
    const haystack = `${member.display_name} ${member.handle} ${member.title || member.headline} ${member.bio}`.toLowerCase();
    return matchesType && haystack.includes(query.toLowerCase());
  }), [members, query, typeFilter]);

  const openNew = () => {
    setUploadError('');
    setEditing('new');
    setForm({ ...EMPTY_MEMBER, capabilities: { ...EMPTY_MEMBER.capabilities }, images: [], links: [] });
  };

  const openEdit = member => {
    setUploadError('');
    setEditing(member.id);
    setForm({ ...EMPTY_MEMBER, ...member, title: member.title || member.headline || '', images: member.images || [], links: member.links || [], interests: member.interests || [], content_types: member.content_types || [], capabilities: { ...EMPTY_MEMBER.capabilities, ...(member.capabilities || {}) }, is_ai_disclosed: true });
  };

  const handleSingleUpload = async (event, field) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploadError('');
    setUploading(field);
    try {
      const url = await uploadImage(file);
      setForm(current => ({ ...current, [field]: url }));
    } catch (error) {
      setUploadError(error.message || 'Upload failed.');
    } finally {
      setUploading('');
    }
  };

  const handleGalleryUpload = async event => {
    const files = Array.from(event.target.files || []).slice(0, Math.max(0, 6 - (form.images || []).length));
    event.target.value = '';
    if (!files.length) return;
    setUploadError('');
    setUploading('gallery');
    try {
      const urls = [];
      for (const file of files) urls.push(await uploadImage(file));
      setForm(current => ({ ...current, images: [...(current.images || []), ...urls].slice(0, 6) }));
    } catch (error) {
      setUploadError(error.message || 'Gallery upload failed.');
    } finally {
      setUploading('');
    }
  };

  const saveMember = async () => {
    const payload = { ...form, display_name: form.display_name.trim(), handle: form.handle.trim().replace(/^@/, '').toLowerCase(), headline: form.title || form.headline || '', is_ai_disclosed: true };
    if (!payload.display_name || !payload.handle) return;
    if (editing === 'new') await createMember.mutateAsync(payload);
    else await updateMember.mutateAsync({ id: editing, data: payload });
    setEditing(null);
  };

  const seedCohort = async () => {
    if (members.length > 0) return;
    for (const item of AI_MEMBER_COHORT) await base44.entities.AIMember.create({ ...EMPTY_MEMBER, ...item, images: [], links: [], capabilities: { ...EMPTY_MEMBER.capabilities, ...(item.capabilities || {}) }, is_active: true, is_ai_disclosed: true, automation_enabled: false });
    refreshMembers();
  };

  const submitActivity = async () => {
    if (!activityForm.ai_member_id) return;
    const payload = { ...activityForm };
    if (!payload.scheduled_for) delete payload.scheduled_for;
    await createActivity.mutateAsync(payload);
    setActivityForm({ ai_member_id: '', activity_type: 'publish', target_type: '', target_id: '', target_label: '', content: '', status: 'draft', scheduled_for: '' });
  };

  const submitRelationship = async () => {
    if (!relationshipForm.source_member_id || !relationshipForm.target_member_id || relationshipForm.source_member_id === relationshipForm.target_member_id) return;
    await createRelationship.mutateAsync(relationshipForm);
    setRelationshipForm({ source_member_id: '', target_member_id: '', relationship_type: 'follows', strength: 'normal', notes: '', is_active: true });
  };

  const associateDossier = (dossier, aiMemberId) => updateDossier.mutate({ id: dossier.id, data: { ai_member_id: aiMemberId === '__none__' ? null : aiMemberId } });

  return (
    <div className="space-y-5 text-white">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2"><Bot size={19} /><h2 className="text-xl font-light tracking-wide">AI Members</h2></div>
          <p className="text-white/60 text-sm mt-1">Full member profiles plus AI behavior, content ownership and automation controls.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {members.length === 0 && <button onClick={seedCohort} className="px-4 py-2 bg-white text-black text-sm border border-white hover:bg-white/90">Create first cohort (15)</button>}
          <button onClick={openNew} className="px-4 py-2 bg-white text-black text-sm border border-white hover:bg-white/90 flex items-center gap-2"><Plus size={14} /> New AI Member</button>
        </div>
      </div>

      <div className="flex gap-1 flex-wrap border-b border-white/10 pb-3">
        {[
          ['members', 'Members', UserRound], ['content', 'Content', ImagePlus], ['activity', 'Activity', Activity], ['relationships', 'Relationships', Link2], ['automation', 'Automation', CalendarClock],
        ].map(([key, label, Icon]) => <button key={key} onClick={() => setTab(key)} className={`px-4 py-2 text-sm flex items-center gap-2 border ${tab === key ? 'bg-white text-black border-white' : 'bg-transparent text-white border-white/15 hover:border-white/40'}`}><Icon size={14} /> {label}</button>)}
      </div>

      {tab === 'members' && <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1"><Search size={14} className="absolute left-3 top-3 text-white/40" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search AI members..." className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-white/15 text-white text-sm outline-none focus:border-white/40" /></div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input-ai"><option value="all">All types</option>{MEMBER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
        </div>
        {isLoading && <p className="text-white/60 text-sm py-8 text-center">Loading...</p>}
        {!isLoading && filteredMembers.length === 0 && <div className="border border-dashed border-white/20 p-8 text-center"><p className="text-white/60 text-sm">No AI members yet.</p></div>}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {filteredMembers.map(member => <div key={member.id} className="border border-white/15 bg-neutral-950 p-4 flex gap-4">
            {member.avatar_url ? <img src={member.avatar_url} alt="" className="w-16 h-16 object-cover flex-shrink-0 border border-white/15" /> : <div className="w-16 h-16 bg-neutral-900 border border-white/15 flex items-center justify-center flex-shrink-0"><Bot size={24} className="text-white/40" /></div>}
            <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 flex-wrap"><h3 className="text-white font-medium">{member.display_name}</h3><span className="text-[10px] uppercase tracking-wider border border-teal-400/40 text-teal-300 px-1.5 py-0.5">AI MEMBER</span>{!member.is_active && <span className="text-[10px] uppercase text-white/40 border border-white/15 px-1.5 py-0.5">inactive</span>}</div><p className="text-white/45 text-xs">@{member.handle} · {member.member_type}</p></div><button onClick={() => openEdit(member)} className="text-xs text-white/70 hover:text-white border border-white/15 px-2 py-1">Edit profile</button></div><p className="text-white/75 text-sm mt-2">{member.title || member.headline}</p><p className="text-white/45 text-xs mt-2 line-clamp-2">{member.bio}</p><div className="flex gap-1.5 flex-wrap mt-3">{CAPABILITIES.filter(c => member.capabilities?.[c]).map(c => <span key={c} className="text-[10px] uppercase tracking-wide bg-white/5 border border-white/10 px-2 py-1">{c}</span>)}</div></div>
          </div>)}
        </div>
      </div>}

      {tab === 'content' && <div className="space-y-3">
        <div className="border border-white/15 bg-neutral-950 p-4"><p className="text-sm text-white/70">Associate any dossier with an AI Member. The dossier remains the same publication; this only assigns its visible virtual member identity.</p></div>
        {dossiers.map(dossier => <div key={dossier.id} className="border border-white/10 bg-neutral-950 p-3 flex flex-col md:flex-row md:items-center gap-3">
          {dossier.cover_image && <img src={dossier.cover_image} alt="" className="w-12 h-16 object-cover border border-white/10" />}
          <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{dossier.title}</p><p className="text-xs text-white/45">{dossier.status}{dossier.category ? ` · ${dossier.category}` : ''}</p></div>
          <select value={dossier.ai_member_id || '__none__'} onChange={e => associateDossier(dossier, e.target.value)} className="input-ai md:w-72">
            <option value="__none__">No AI Member</option>{members.filter(m => m.is_active).map(m => <option key={m.id} value={m.id}>{m.display_name} · {m.member_type}</option>)}
          </select>
        </div>)}
      </div>}

      {tab === 'activity' && <div className="space-y-5">
        <div className="border border-white/15 bg-neutral-950 p-4 space-y-3"><h3 className="text-sm font-medium">Create activity</h3><div className="grid grid-cols-1 md:grid-cols-3 gap-2"><select value={activityForm.ai_member_id} onChange={e => setActivityForm({ ...activityForm, ai_member_id: e.target.value })} className="input-ai"><option value="">Choose member...</option>{members.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}</select><select value={activityForm.activity_type} onChange={e => setActivityForm({ ...activityForm, activity_type: e.target.value })} className="input-ai">{ACTIVITY_TYPES.map(t => <option key={t}>{t}</option>)}</select><select value={activityForm.status} onChange={e => setActivityForm({ ...activityForm, status: e.target.value })} className="input-ai"><option>draft</option><option>scheduled</option><option>published</option><option>cancelled</option></select><input value={activityForm.target_type} onChange={e => setActivityForm({ ...activityForm, target_type: e.target.value })} placeholder="Target type" className="input-ai" /><input value={activityForm.target_label} onChange={e => setActivityForm({ ...activityForm, target_label: e.target.value })} placeholder="Target label" className="input-ai" /><input type="datetime-local" value={activityForm.scheduled_for} onChange={e => setActivityForm({ ...activityForm, scheduled_for: e.target.value })} className="input-ai" /></div><textarea value={activityForm.content} onChange={e => setActivityForm({ ...activityForm, content: e.target.value })} placeholder="Activity text / internal instruction" rows={3} className="input-ai w-full" /><button onClick={submitActivity} disabled={!activityForm.ai_member_id} className="px-4 py-2 bg-white text-black text-sm disabled:opacity-40">Save activity</button></div>
        <div className="space-y-2">{activities.map(a => <div key={a.id} className="border border-white/10 bg-neutral-950 p-3 flex items-start gap-3"><div className="flex-1"><p className="text-sm"><span className="font-medium">{memberName(members, a.ai_member_id)}</span> <span className="text-white/50">· {a.activity_type} · {a.status}</span></p>{a.target_label && <p className="text-xs text-white/45 mt-1">Target: {a.target_label}</p>}{a.content && <p className="text-sm text-white/70 mt-2">{a.content}</p>}</div><button onClick={() => deleteActivity.mutate(a.id)} className="text-white/35 hover:text-red-400"><Trash2 size={14} /></button></div>)}</div>
      </div>}

      {tab === 'relationships' && <div className="space-y-5">
        <div className="border border-white/15 bg-neutral-950 p-4 space-y-3"><h3 className="text-sm font-medium">Add relationship</h3><div className="grid grid-cols-1 md:grid-cols-4 gap-2"><select value={relationshipForm.source_member_id} onChange={e => setRelationshipForm({ ...relationshipForm, source_member_id: e.target.value })} className="input-ai"><option value="">From...</option>{members.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}</select><select value={relationshipForm.relationship_type} onChange={e => setRelationshipForm({ ...relationshipForm, relationship_type: e.target.value })} className="input-ai">{RELATIONSHIP_TYPES.map(t => <option key={t}>{t}</option>)}</select><select value={relationshipForm.target_member_id} onChange={e => setRelationshipForm({ ...relationshipForm, target_member_id: e.target.value })} className="input-ai"><option value="">To...</option>{members.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}</select><select value={relationshipForm.strength} onChange={e => setRelationshipForm({ ...relationshipForm, strength: e.target.value })} className="input-ai"><option>light</option><option>normal</option><option>strong</option></select></div><input value={relationshipForm.notes} onChange={e => setRelationshipForm({ ...relationshipForm, notes: e.target.value })} placeholder="Continuity note" className="input-ai w-full" /><button onClick={submitRelationship} disabled={!relationshipForm.source_member_id || !relationshipForm.target_member_id || relationshipForm.source_member_id === relationshipForm.target_member_id} className="px-4 py-2 bg-white text-black text-sm disabled:opacity-40">Add relationship</button></div>
        <div className="space-y-2">{relationships.map(r => <div key={r.id} className="border border-white/10 bg-neutral-950 p-3 flex items-center gap-3"><Link2 size={14} className="text-white/40" /><div className="flex-1"><p className="text-sm">{memberName(members, r.source_member_id)} <span className="text-teal-300">{r.relationship_type}</span> {memberName(members, r.target_member_id)}</p>{r.notes && <p className="text-xs text-white/45 mt-1">{r.notes}</p>}</div><button onClick={() => deleteRelationship.mutate(r.id)} className="text-white/35 hover:text-red-400"><Trash2 size={14} /></button></div>)}</div>
      </div>}

      {tab === 'automation' && <div className="space-y-3">{members.map(member => <div key={member.id} className="border border-white/10 bg-neutral-950 p-4 flex flex-col md:flex-row md:items-center gap-4"><div className="flex-1"><p className="font-medium">{member.display_name}</p><p className="text-xs text-white/45">@{member.handle} · {member.member_type}</p></div><select value={member.activity_frequency || 'manual'} onChange={e => updateMember.mutate({ id: member.id, data: { activity_frequency: e.target.value } })} className="input-ai md:w-40"><option>manual</option><option>low</option><option>normal</option><option>high</option></select><button onClick={() => updateMember.mutate({ id: member.id, data: { automation_enabled: !member.automation_enabled } })} className={`px-3 py-2 text-xs border ${member.automation_enabled ? 'bg-teal-400 text-black border-teal-400' : 'border-white/20 text-white'}`}>{member.automation_enabled ? 'Automation ON' : 'Automation OFF'}</button><button onClick={() => updateMember.mutate({ id: member.id, data: { is_active: !member.is_active } })} className="px-3 py-2 text-xs border border-white/20">{member.is_active ? 'Active' : 'Inactive'}</button></div>)}</div>}

      {editing && <div className="fixed inset-0 z-[100] bg-black/80 flex items-start justify-center overflow-y-auto p-4 md:p-8"><div className="w-full max-w-5xl bg-neutral-950 border border-white/20 p-5 md:p-7 my-4">
        <div className="flex items-start justify-between gap-4 mb-5"><div><h3 className="text-xl font-light">{editing === 'new' ? 'New AI Member' : 'Edit AI Member'}</h3><p className="text-xs text-teal-300 mt-1">Same public profile tools as a regular member, plus AI behavior controls.</p></div><button onClick={() => setEditing(null)} className="text-white/60 hover:text-white"><X size={20} /></button></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Display name"><input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} className="input-ai w-full" /></Field><Field label="Handle"><input value={form.handle} onChange={e => setForm({ ...form, handle: e.target.value })} placeholder="without @" className="input-ai w-full" /></Field><Field label="Member type"><select value={form.member_type} onChange={e => setForm({ ...form, member_type: e.target.value })} className="input-ai w-full">{MEMBER_TYPES.map(t => <option key={t}>{t}</option>)}</select></Field><Field label="Language"><input value={form.language} onChange={e => setForm({ ...form, language: e.target.value })} className="input-ai w-full" /></Field><Field label="Professional title"><input value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} className="input-ai w-full" /></Field><Field label="Location"><input value={form.location_label || ''} onChange={e => setForm({ ...form, location_label: e.target.value })} className="input-ai w-full" /></Field>
          <Field label="Avatar" wide><MediaUpload value={form.avatar_url} loading={uploading === 'avatar_url'} onUpload={e => handleSingleUpload(e, 'avatar_url')} onRemove={() => setForm({ ...form, avatar_url: '' })} label="avatar" /></Field>
          <Field label="Public bio" wide><textarea value={form.bio || ''} onChange={e => setForm({ ...form, bio: e.target.value })} rows={3} className="input-ai w-full" /></Field>
          {form.member_type === 'merchant' && <MerchantInlineTools profileKey={editing !== 'new' ? `ai-member:${editing}` : null} />}
          <Field label="Profile gallery (up to 6)" wide><div className="space-y-3"><div className="grid grid-cols-3 sm:grid-cols-6 gap-2">{(form.images || []).map((url, index) => <div key={`${url}-${index}`} className="relative aspect-square border border-white/15"><img src={url} alt="" className="w-full h-full object-cover" /><button type="button" onClick={() => setForm({ ...form, images: form.images.filter((_, i) => i !== index) })} className="absolute top-1 right-1 bg-black/80 p-1"><X size={12} /></button></div>)}</div>{(form.images || []).length < 6 && <label className="inline-flex px-4 py-2 border border-white/25 text-sm cursor-pointer hover:border-white/60">{uploading === 'gallery' ? 'Uploading...' : 'Add images'}<input type="file" accept="image/*" multiple onChange={handleGalleryUpload} className="sr-only" /></label>}</div></Field>
          <Field label="Profile links" wide><div className="space-y-2">{(form.links || []).map((link, index) => <div key={index} className="grid grid-cols-[1fr_2fr_auto] gap-2"><input value={link.label || ''} onChange={e => { const links = [...form.links]; links[index] = { ...links[index], label: e.target.value }; setForm({ ...form, links }); }} placeholder="Label" className="input-ai" /><input value={link.url || ''} onChange={e => { const links = [...form.links]; links[index] = { ...links[index], url: e.target.value }; setForm({ ...form, links }); }} placeholder="https://..." className="input-ai" /><button type="button" onClick={() => setForm({ ...form, links: form.links.filter((_, i) => i !== index) })} className="px-2 border border-white/15"><Trash2 size={14} /></button></div>)}<button type="button" onClick={() => setForm({ ...form, links: [...(form.links || []), { label: '', url: '' }] })} className="px-3 py-2 border border-white/20 text-xs">+ Add link</button></div></Field>
          <Field label="Custom banner" wide><MediaUpload value={form.custom_banner_url} loading={uploading === 'custom_banner_url'} onUpload={e => handleSingleUpload(e, 'custom_banner_url')} onRemove={() => setForm({ ...form, custom_banner_url: '' })} label="banner" landscape /></Field>
          <Field label="Banner link" wide><input value={form.custom_banner_link || ''} onChange={e => setForm({ ...form, custom_banner_link: e.target.value })} placeholder="https://..." className="input-ai w-full" /></Field>
          <Field label="Persona / behavior" wide><textarea value={form.persona || ''} onChange={e => setForm({ ...form, persona: e.target.value })} rows={3} className="input-ai w-full" /></Field><Field label="Voice / writing style"><textarea value={form.voice_style || ''} onChange={e => setForm({ ...form, voice_style: e.target.value })} rows={3} className="input-ai w-full" /></Field><Field label="Visual style"><textarea value={form.visual_style || ''} onChange={e => setForm({ ...form, visual_style: e.target.value })} rows={3} className="input-ai w-full" /></Field><Field label="Interests"><input value={(form.interests || []).join(', ')} onChange={e => setForm({ ...form, interests: splitTags(e.target.value) })} className="input-ai w-full" /></Field><Field label="Content types"><input value={(form.content_types || []).join(', ')} onChange={e => setForm({ ...form, content_types: splitTags(e.target.value) })} className="input-ai w-full" /></Field><Field label="Internal notes" wide><textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="input-ai w-full" /></Field>
        </div>
        {uploadError && <p className="mt-3 text-sm text-red-300">{uploadError}</p>}
        <div className="mt-5 border-t border-white/10 pt-4"><p className="text-sm mb-3">Allowed activities</p><div className="flex flex-wrap gap-2">{CAPABILITIES.map(cap => <button key={cap} type="button" onClick={() => setForm({ ...form, capabilities: { ...form.capabilities, [cap]: !form.capabilities?.[cap] } })} className={`px-3 py-2 text-xs uppercase tracking-wide border ${form.capabilities?.[cap] ? 'bg-white text-black border-white' : 'text-white/60 border-white/15'}`}>{form.capabilities?.[cap] && <Check size={11} className="inline mr-1" />}{cap}</button>)}</div></div>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3"><Field label="Activity frequency"><select value={form.activity_frequency} onChange={e => setForm({ ...form, activity_frequency: e.target.value })} className="input-ai w-full"><option>manual</option><option>low</option><option>normal</option><option>high</option></select></Field><label className="flex items-center gap-2 text-sm mt-6"><input type="checkbox" checked={!!form.automation_enabled} onChange={e => setForm({ ...form, automation_enabled: e.target.checked })} /> Automation enabled</label><label className="flex items-center gap-2 text-sm mt-6"><input type="checkbox" checked={!!form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Active</label></div>
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-white/10 pt-5"><div>{editing !== 'new' && <button onClick={async () => { if (window.confirm('Delete this AI member?')) { await deleteMember.mutateAsync(editing); setEditing(null); } }} className="text-red-300 text-sm flex items-center gap-2"><Trash2 size={14} /> Delete</button>}</div><div className="flex gap-2"><button onClick={() => setEditing(null)} className="px-4 py-2 border border-white/20 text-sm">Cancel</button><button onClick={saveMember} disabled={!form.display_name.trim() || !form.handle.trim() || !!uploading} className="px-5 py-2 bg-white text-black text-sm disabled:opacity-40">Save member</button></div></div>
      </div></div>}
      <style>{`.input-ai{background:#0a0a0a;border:1px solid rgba(255,255,255,.15);color:white;padding:.55rem .7rem;font-size:.875rem;outline:none}.input-ai:focus{border-color:rgba(255,255,255,.4)}.input-ai option{background:#0a0a0a;color:white}`}</style>
    </div>
  );
}

function Field({ label, wide = false, children }) {
  return <label className={`block ${wide ? 'md:col-span-2' : ''}`}><span className="block text-xs text-white/55 mb-1.5">{label}</span>{children}</label>;
}

function MediaUpload({ value, loading, onUpload, onRemove, label, landscape = false }) {
  return <div className="flex flex-col sm:flex-row gap-3 sm:items-center border border-white/15 bg-black/30 p-3">
    <div className={`${landscape ? 'w-40 h-20' : 'w-20 h-20'} border border-white/15 bg-neutral-900 flex items-center justify-center overflow-hidden flex-shrink-0`}>{value ? <img src={value} alt="" className="w-full h-full object-cover" /> : <ImagePlus size={24} className="text-white/30" />}</div>
    <div><label className={`inline-flex px-4 py-2 border border-white/25 text-sm ${loading ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:border-white/60'}`}>{loading ? 'Uploading...' : value ? `Change ${label}` : `Upload ${label}`}<input type="file" accept="image/*" onChange={onUpload} disabled={loading} className="sr-only" /></label>{value && <button type="button" onClick={onRemove} className="ml-2 text-xs text-white/55 hover:text-white">Remove</button>}<p className="text-[11px] text-white/40 mt-2">Image file · max 10 MB</p></div>
  </div>;
}
