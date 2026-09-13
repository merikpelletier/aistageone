import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, ExternalLink, MessageCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function ProfileViewer({ isOpen, onClose, profile, onSendMessage }) {
  if (!profile) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-neutral-950 border border-white/10 rounded-sm max-w-md w-full max-h-[85vh] overflow-y-auto"
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-white text-xl font-extralight tracking-widest">
                  {profile.identifier}
                </h2>
                <div className="flex items-center gap-2">
                  {onSendMessage && (
                    <Button
                      onClick={() => {
                        onSendMessage(profile);
                        onClose();
                      }}
                      size="sm"
                      className="bg-white text-black hover:bg-white/90"
                    >
                      <MessageCircle size={16} className="mr-1" />
                      Message
                    </Button>
                  )}
                  <button onClick={onClose} className="text-white hover:text-white">
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Photos */}
              {profile.photos && profile.photos.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-6">
                  {profile.photos.map((photo, idx) => (
                    <img
                      key={idx}
                      src={photo}
                      alt=""
                      className="w-full aspect-square object-cover rounded-sm"
                    />
                  ))}
                </div>
              )}

              {/* Location */}
              {profile.location && (
                <div className="flex items-center gap-2 text-white text-sm mb-4">
                  <MapPin size={14} />
                  <span>{profile.location}</span>
                </div>
              )}

              {/* Description */}
              {profile.description && (
                <div className="mb-6">
                  <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">
                    {profile.description}
                  </p>
                </div>
              )}

              {/* External Links */}
              {profile.external_links && profile.external_links.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-white text-xs tracking-widest mb-3">LINKS</h3>
                  {profile.external_links.map((link, idx) => (
                    <a
                      key={idx}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-white hover:text-white text-sm transition-colors"
                    >
                      <ExternalLink size={14} />
                      <span className="truncate">{link}</span>
                    </a>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {!profile.description && 
               !profile.location && 
               (!profile.photos || profile.photos.length === 0) && 
               (!profile.external_links || profile.external_links.length === 0) && (
                <p className="text-white text-sm text-center py-8">
                  No profile information
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}