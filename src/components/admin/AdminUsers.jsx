import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserX, Trash2, Eye, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const [cleanupProgress, setCleanupProgress] = React.useState(null);

  const { data: temporaryUsers = [] } = useQuery({
    queryKey: ['temporaryUsers'],
    queryFn: () => base44.entities.TemporaryUser.list('-last_activity'),
  });

  const expelUserMutation = useMutation({
    mutationFn: (id) => base44.entities.TemporaryUser.update(id, { expelled: true, is_active: false }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['temporaryUsers'] })
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id) => {
      const user = temporaryUsers.find(u => u.id === id);
      if (user) {
        // Delete all associated messages
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

  // Inactive = no activity for 30 min OR expelled OR is_active=false
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-white text-lg font-light">Temporary Users</h2>
        <button
          onClick={handleCleanup}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          TEST CLEANUP ({inactiveUsers.length})
        </button>
      </div>

      {/* Active Users */}
      <div className="mb-8">
        <h3 className="text-white text-sm mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          Active users ({activeUsers.length})
        </h3>
        <div className="space-y-2">
          {activeUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-4 bg-neutral-950 border border-white/10 rounded-sm"
            >
              <div className="flex items-center gap-4">
                {user.photos?.[0] ? (
                  <img src={user.photos[0]} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center">
                    <span className="text-white text-sm">{user.identifier_number}</span>
                  </div>
                )}
                <div>
                  <span className="text-white font-light">{user.identifier}</span>
                  {user.location && (
                    <span className="text-white text-sm ml-2">• {user.location}</span>
                  )}
                  {user.description && (
                    <p className="text-white text-sm truncate max-w-xs">{user.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white text-xs flex items-center gap-1">
                  <Clock size={12} />
                  {user.last_activity && format(new Date(user.last_activity), 'HH:mm')}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => expelUserMutation.mutate(user.id)}
                  className="text-white hover:text-red-500"
                  title="Expel"
                >
                  <UserX size={16} />
                </Button>
              </div>
            </div>
          ))}
          {activeUsers.length === 0 && (
            <p className="text-white text-sm text-center py-4">No active users</p>
          )}
        </div>
      </div>

      {/* Inactive/Expelled Users */}
      <div>
        <h3 className="text-white text-sm mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
          Inactive / Expelled ({inactiveUsers.length})
        </h3>
        <div className="space-y-2">
          {inactiveUsers.slice(0, 20).map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-3 bg-neutral-900/50 rounded-sm opacity-60"
            >
              <div className="flex items-center gap-3">
                <span className="text-white">{user.identifier}</span>
                {user.expelled && (
                  <Badge variant="outline" className="text-red-400 border-red-900/50">
                    Expelled
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteUserMutation.mutate(user.id)}
                className="h-8 w-8 text-white hover:text-red-500"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}