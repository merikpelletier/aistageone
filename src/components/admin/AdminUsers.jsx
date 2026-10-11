import React from 'react';
import { base44, supabase } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserX, Trash2, Clock, Snowflake, RotateCcw, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';

const statusStyles = {
  active: 'text-green-300 border-green-500/40 bg-green-500/10',
  frozen: 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10',
  expelled: 'text-red-300 border-red-500/40 bg-red-500/10',
};

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const [cleanupProgress, setCleanupProgress] = React.useState(null);
  const [moderationTarget, setModerationTarget] = React.useState(null);
  const [moderationAction, setModerationAction] = React.useState(null);
  const [reason, setReason] = React.useState('');
  const [internalNote, setInternalNote] = React.useState('');

  const { data: registeredMembers = [], isLoading: registeredLoading } = useQuery({
    queryKey: ['registeredMembersAdmin'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_member_profiles_v2');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: temporaryUsers = [] } = useQuery({
    queryKey: ['temporaryUsers'],
    queryFn: () => base44.entities.TemporaryUser.list('-last_activity'),
  });

  const moderationMutation = useMutation({
    mutationFn: async ({ profileId, status, reasonText, noteText }) => {
      const { error } = await supabase.rpc('admin_set_profile_moderation', {
        p_profile_id: profileId,
        p_status: status,
        p_reason: reasonText || null,
        p_internal_note: noteText || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registeredMembersAdmin'] });
      queryClient.invalidateQueries({ queryKey: ['memberProfiles'] });
      setModerationTarget(null);
      setModerationAction(null);
      setReason('');
      setInternalNote('');
    },
  });

  const expelUserMutation = useMutation({
    mutationFn: (id) => base44.entities.TemporaryUser.update(id, { expelled: true, is_active: false }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['temporaryUsers'] })
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id) => {
      const user = temporaryUsers.find(u => u.id === id);
      if (user) {
        const chatMsgs = await base44.entities.ChatMessage.filter({ session_id: user.session_id });
        await Promise.all(chatMsgs.map(m => base44.entities.ChatMessage.delete(m.id)));
        const sentMsgs = await base44.entities.PrivateMessage.filter({ from_session_id: user.session_id });
        await Promise.all(sentMsgs.map(m => base44.entities.PrivateMessage.delete(m.id)));
        const rcvMsgs = await base44.entities.PrivateMessage.filter({ to_session_id: user.session_id });
        await Promise.all(rcvMsgs.map(m => base44.entities.PrivateMessage.delete(m.id)));
      }
      return base44.entities.TemporaryUser.delete(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['temporaryUsers'] })
  });

  const openModeration = (member, action) => {
    setModerationTarget(member);
    setModerationAction(action);
    setReason(member.moderation_reason || '');
    setInternalNote(member.moderation_note || '');
  };

  const applyModeration = () => {
    if (!moderationTarget || !moderationAction) return;
    if (moderationAction !== 'active' && !reason.trim()) {
      alert('A reason is required.');
      return;
    }
    moderationMutation.mutate({
      profileId: moderationTarget.profile_id,
      status: moderationAction,
      reasonText: moderationAction === 'active' ? '' : reason.trim(),
      noteText: internalNote.trim(),
    });
  };

  const handleCleanup = async () => {
    if (!confirm(`Delete ${inactiveUsers.length} inactive user(s) and their messages?`)) return;
    setCleanupProgress('0');
    let deleted = 0;
    for (let i = 0; i < inactiveUsers.length; i++) {
      const user = inactiveUsers[i];
      setCleanupProgress(`${i + 1}/${inactiveUsers.length}`);
      try {
        const chatMsgs = await base44.entities.ChatMessage.filter({ session_id: user.session_id });
        await Promise.all(chatMsgs.map(m => base44.entities.ChatMessage.delete(m.id)));
        const sentMsgs = await base44.entities.PrivateMessage.filter({ from_session_id: user.session_id });
        await Promise.all(sentMsgs.map(m => base44.entities.PrivateMessage.delete(m.id)));
        const rcvMsgs = await base44.entities.PrivateMessage.filter({ to_session_id: user.session_id });
        await Promise.all(rcvMsgs.map(m => base44.entities.PrivateMessage.delete(m.id)));
        await base44.entities.TemporaryUser.delete(user.id);
        deleted++;
      } catch (error) {
        console.error('Error:', error);
      }
    }
    setCleanupProgress(null);
    queryClient.invalidateQueries({ queryKey: ['temporaryUsers'] });
    alert(`${deleted} user(s) deleted`);
  };

  const now = new Date();
  const inactiveUsers = temporaryUsers.filter(u => {
    if (u.expelled || !u.is_active) return true;
    if (!u.last_activity) return true;
    const lastActivity = new Date(u.last_activity);
    const minutesSinceActivity = (now - lastActivity) / (1000 * 60);
    return minutesSinceActivity > 30;
  });
  const activeUsers = temporaryUsers.filter(u => !inactiveUsers.includes(u));

  return (
    <div className="space-y-10">
      <section>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white text-lg font-light">Members</h2>
            <p className="text-white/45 text-xs mt-1">All public member profiles are managed here, including legacy profiles without a login account.</p>
          </div>
        </div>

        {registeredLoading ? (
          <p className="text-white/50 text-sm">Loading members…</p>
        ) : (
          <div className="space-y-2">
            {registeredMembers.map(member => {
              const status = member.moderation_status || 'active';
              const isAdmin = member.role === 'admin';
              return (
                <div key={member.profile_id} className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-4 bg-neutral-950 border border-white/10 rounded-sm">
                  <div className="flex items-center gap-4 min-w-0">
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center text-white/60 flex-shrink-0">
                        {(member.display_name || member.email || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-white font-medium truncate">{member.display_name || member.email}</span>
                        <Badge variant="outline" className={statusStyles[status] || statusStyles.active}>{status.toUpperCase()}</Badge>
                        {isAdmin && <Badge variant="outline" className="text-white/60 border-white/20">ADMIN</Badge>}
                        {!member.has_auth_account && <Badge variant="outline" className="text-white/45 border-white/15">PROFILE ONLY</Badge>}
                      </div>
                      <p className="text-white/50 text-xs truncate mt-1">{member.email}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[11px] text-white/35">
                        <span>Created {member.created_at ? format(new Date(member.created_at), 'yyyy-MM-dd') : '—'}</span>
                        {member.has_auth_account && <span>Last sign-in {member.last_sign_in_at ? format(new Date(member.last_sign_in_at), 'yyyy-MM-dd HH:mm') : '—'}</span>}
                      </div>
                      {status !== 'active' && member.moderation_reason && (
                        <p className="text-white/55 text-xs mt-2">Reason: {member.moderation_reason}</p>
                      )}
                      {status === 'expelled' && member.deletion_due_at && (
                        <p className="text-red-300 text-xs mt-1">Account closes automatically on {format(new Date(member.deletion_due_at), 'yyyy-MM-dd HH:mm')}</p>
                      )}
                    </div>
                  </div>

                  {!isAdmin && (
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {status !== 'frozen' && status !== 'expelled' && (
                        <Button variant="outline" onClick={() => openModeration(member, 'frozen')} className="border-cyan-700/60 text-cyan-300 bg-transparent hover:bg-cyan-950/40">
                          <Snowflake size={15} className="mr-2" /> Freeze
                        </Button>
                      )}
                      {status !== 'expelled' && (
                        <Button variant="outline" onClick={() => openModeration(member, 'expelled')} className="border-red-700/60 text-red-300 bg-transparent hover:bg-red-950/40">
                          <ShieldAlert size={15} className="mr-2" /> Expel
                        </Button>
                      )}
                      {status !== 'active' && (
                        <Button variant="outline" onClick={() => openModeration(member, 'active')} className="border-white/30 text-white bg-transparent hover:bg-white/10">
                          <RotateCcw size={15} className="mr-2" /> Restore
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {registeredMembers.length === 0 && <p className="text-white/50 text-sm py-4">No members.</p>}
          </div>
        )}
      </section>

      <section className="border-t border-white/10 pt-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-lg font-light">Temporary Users</h2>
          <button onClick={handleCleanup} className="px-4 py-2 bg-red-500 text-white rounded">TEST CLEANUP ({inactiveUsers.length})</button>
        </div>

        <div className="mb-8">
          <h3 className="text-white text-sm mb-4 flex items-center gap-2"><span className="w-2 h-2 bg-green-500 rounded-full"></span>Active users ({activeUsers.length})</h3>
          <div className="space-y-2">
            {activeUsers.map(user => (
              <div key={user.id} className="flex items-center justify-between p-4 bg-neutral-950 border border-white/10 rounded-sm">
                <div className="flex items-center gap-4">
                  {user.photos?.[0] ? <img src={user.photos[0]} alt="" className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center"><span className="text-white text-sm">{user.identifier_number}</span></div>}
                  <div><span className="text-white font-light">{user.identifier}</span>{user.location && <span className="text-white text-sm ml-2">• {user.location}</span>}{user.description && <p className="text-white text-sm truncate max-w-xs">{user.description}</p>}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white text-xs flex items-center gap-1"><Clock size={12} />{user.last_activity && format(new Date(user.last_activity), 'HH:mm')}</span>
                  <Button variant="ghost" size="icon" onClick={() => expelUserMutation.mutate(user.id)} className="text-white hover:text-red-500" title="Expel"><UserX size={16} /></Button>
                </div>
              </div>
            ))}
            {activeUsers.length === 0 && <p className="text-white text-sm text-center py-4">No active users</p>}
          </div>
        </div>

        <div>
          <h3 className="text-white text-sm mb-4 flex items-center gap-2"><span className="w-2 h-2 bg-red-500 rounded-full"></span>Inactive / Expelled ({inactiveUsers.length})</h3>
          <div className="space-y-2">
            {inactiveUsers.slice(0, 20).map(user => (
              <div key={user.id} className="flex items-center justify-between p-3 bg-neutral-900/50 rounded-sm opacity-60">
                <div className="flex items-center gap-3"><span className="text-white">{user.identifier}</span>{user.expelled && <Badge variant="outline" className="text-red-400 border-red-900/50">Expelled</Badge>}</div>
                <Button variant="ghost" size="icon" onClick={() => deleteUserMutation.mutate(user.id)} className="h-8 w-8 text-white hover:text-red-500"><Trash2 size={14} /></Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {moderationTarget && moderationAction && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-neutral-950 border border-white/20 p-6 shadow-2xl">
            <h3 className="text-white text-xl font-light">{moderationAction === 'frozen' ? 'Freeze member' : moderationAction === 'expelled' ? 'Expel member' : 'Restore member'}</h3>
            <p className="text-white/50 text-sm mt-2">{moderationTarget.display_name || moderationTarget.email} · {moderationTarget.email}</p>

            {moderationAction === 'expelled' && (
              <div className="mt-5 border border-red-500/40 bg-red-950/20 p-4 text-sm text-red-100 leading-relaxed">
                WARNING: Expelling this member starts a 30-day exit period. Their published content is removed immediately, they cannot publish or buy additional credits, and their account is scheduled for permanent closure 30 days from today. Any credits still unused at closure are recorded for accounting and are non-refundable.
              </div>
            )}

            {moderationAction !== 'active' && (
              <div className="mt-6">
                <label className="block text-white/70 text-xs uppercase tracking-wider mb-2">Reason *</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} className="w-full min-h-24 bg-black border border-white/20 text-white p-3 outline-none focus:border-white/50" placeholder="Complaint, policy violation, safety issue…" />
              </div>
            )}

            <div className="mt-4">
              <label className="block text-white/70 text-xs uppercase tracking-wider mb-2">Internal note</label>
              <textarea value={internalNote} onChange={e => setInternalNote(e.target.value)} className="w-full min-h-20 bg-black border border-white/20 text-white p-3 outline-none focus:border-white/50" placeholder="Visible only to admins" />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => { setModerationTarget(null); setModerationAction(null); }} className="border-white/20 text-white bg-transparent">Cancel</Button>
              <Button onClick={applyModeration} disabled={moderationMutation.isPending} className={moderationAction === 'expelled' ? 'bg-red-600 hover:bg-red-500 text-white' : moderationAction === 'frozen' ? 'bg-cyan-700 hover:bg-cyan-600 text-white' : 'bg-white text-black hover:bg-white/90'}>
                {moderationMutation.isPending ? 'Saving…' : 'Confirm'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
