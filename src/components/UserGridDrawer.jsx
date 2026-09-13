import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { X, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ProfileViewer from '@/components/ProfileViewer';

export default function UserGridDrawer({ salon, isOpen, onClose }) {
  const [selectedUser, setSelectedUser] = useState(null);

  const { data: users = [] } = useQuery({
    queryKey: ['activeUsers', salon],
    queryFn: async () => {
      const allUsers = await base44.entities.TemporaryUser.filter({ is_active: true, expelled: false });
      // Filter users active in last 5 minutes
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      return allUsers.filter(u => new Date(u.last_activity) > fiveMinAgo);
    },
    enabled: isOpen,
    refetchInterval: 30000 // Refresh every 30s
  });

  const { data: placeholders = [] } = useQuery({
    queryKey: ['profilePlaceholders'],
    queryFn: () => base44.entities.ProfilePlaceholder.filter({ is_active: true }),
    enabled: isOpen
  });

  const getRandomPlaceholder = () => {
    if (placeholders.length === 0) return null;
    return placeholders[Math.floor(Math.random() * placeholders.length)]?.icon_url;
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/60 z-40"
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-neutral-950 border-l border-white/10 z-50 overflow-y-auto"
            >
              {/* Header */}
              <div className="sticky top-0 bg-neutral-950 border-b border-white/10 p-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <Users size={20} className="text-white" />
                  <h2 className="text-white font-light tracking-wide">
                    Utilisateurs actifs ({users.length})
                  </h2>
                </div>
                <button onClick={onClose} className="text-white hover:text-white">
                  <X size={24} />
                </button>
              </div>

              {/* User Grid */}
              <div className="p-4">
                {users.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Users size={48} className="text-white/20 mb-4" />
                    <p className="text-white text-sm">
                      Aucun utilisateur actif pour le moment
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {users.map((user) => {
                      const photo = user.photos?.[0] || getRandomPlaceholder();
                      return (
                        <button
                          key={user.id}
                          onClick={() => setSelectedUser(user)}
                          className="flex flex-col items-center gap-2 p-3 bg-neutral-900 border border-white/10 rounded-lg hover:border-white/30 transition-colors"
                        >
                          <div className="w-16 h-16 rounded-full overflow-hidden bg-neutral-800 flex items-center justify-center">
                            {photo ? (
                              <img src={photo} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Users size={24} className="text-white" />
                            )}
                          </div>
                          <span className="text-white text-xs truncate w-full text-center">
                            {user.identifier}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Profile Viewer */}
      {selectedUser && (
        <ProfileViewer
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </>
  );
}