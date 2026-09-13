import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Film, Sparkles, Users, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AvailableProjectsPortal({ onJoinProject }) {
  const [loadingId, setLoadingId] = useState(null);
  const { data: dossiers = [], isLoading } = useQuery({
    queryKey: ['availableProjectsStages'],
    queryFn: async () => {
      const all = await base44.entities.Dossier.filter({ status: 'published' }, '-created_date', 50);
      const withKits = await Promise.all(
        all.map(async (d) => {
          const pages = await base44.entities.DossierPage.filter({ dossier_id: d.id }).catch(() => []);
          const relevantPages = pages.filter(p => ['episode', 'join_cast'].includes(p.page_type));
          return relevantPages.length > 0 ? { ...d, kitPages: relevantPages } : null;
        })
      );
      return withKits.filter(Boolean);
    },
    staleTime: 0,
  });

  if (isLoading) return (
    <div className="mt-8 flex justify-center py-12">
      <Loader2 size={28} className="animate-spin text-black" />
    </div>
  );

  if (dossiers.length === 0) return (
    <div className="mt-8 bg-black/10 rounded-3xl p-10 text-center border-2 border-dashed border-black/20">
      <div className="w-20 h-20 bg-black/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <Film size={40} className="text-black" />
      </div>
      <p className="text-black text-lg font-bold mb-2">No available projects</p>
      <p className="text-black text-sm">Community projects will appear here when published</p>
    </div>
  );

  const handleJoinProject = async (dossier, kitPage) => {
    if (!onJoinProject || !kitPage?.id) return;
    setLoadingId(dossier.id);
    try {
      const fullKitPage = await base44.entities.DossierPage.get(kitPage.id);
      onJoinProject(dossier, fullKitPage || kitPage);
    } catch {
      onJoinProject(dossier, kitPage);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-8"
    >
      <div className="flex flex-col items-center mb-4">
        <div>
          <p className="text-black text-sm font-black tracking-widest uppercase text-center">Available Projects</p>
          <p className="text-black text-xs font-semibold text-center">Join ongoing productions from the community</p>
        </div>
      </div>

      <div className="grid gap-4">
        {dossiers.map((dossier) => (
          <motion.div
            key={dossier.id}
            whileTap={{ scale: 0.98 }}
            className="bg-black rounded-3xl p-6 shadow-xl cursor-pointer group"
            onClick={() => handleJoinProject(dossier, dossier.kitPages[0])}
          >
            {/* Dossier Header */}
            <div className="flex items-start gap-4">
              {dossier.cover_image ? (
                <img 
                  src={dossier.cover_image} 
                  alt={dossier.title}
                  className="w-20 h-20 rounded-2xl object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-20 h-20 bg-yellow-400/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Film size={28} className="text-yellow-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-yellow-400 font-bold text-base truncate">{dossier.title}</p>
                {dossier.subtitle && (
                  <p className="text-white text-sm truncate">{dossier.subtitle}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {dossier.kitPages?.some(p => p.page_type === 'production_kit') && (
                    <span className="text-white text-xs px-2 py-1 bg-yellow-400/10 rounded-lg flex items-center gap-1">
                      <Sparkles size={10} className="text-yellow-400" />
                      Production Kit
                    </span>
                  )}
                  {dossier.kitPages?.some(p => p.page_type === 'episode') && (
                    <span className="text-white text-xs px-2 py-1 bg-blue-400/10 rounded-lg flex items-center gap-1">
                      <Film size={10} className="text-blue-400" />
                      Episodes
                    </span>
                  )}
                  {dossier.kitPages?.some(p => p.page_type === 'join_cast') && (
                    <span className="text-white text-xs px-2 py-1 bg-purple-400/10 rounded-lg flex items-center gap-1">
                      <Users size={10} className="text-purple-400" />
                      Casting
                    </span>
                  )}
                </div>
              </div>
              {loadingId === dossier.id && (
                <Loader2 size={20} className="text-yellow-400 animate-spin flex-shrink-0" />
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}