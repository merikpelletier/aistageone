import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  FileText, 
  Shield, 
  BookOpen, 
  Mail, 
  ChevronRight,
  Check,
  Lock,
  ChevronDown,
  User
} from 'lucide-react';
import { Boxes } from 'lucide-react';

const DEFAULT_PLUS_SECTIONS = [
  { key: 'asset_catalog', label: 'Asset Catalog', visible: true, order: 0 },
  { key: 'admin', label: 'Admin', visible: true, order: 1 },
  { key: 'information', label: 'INFORMATION', visible: true, order: 2 },
  { key: 'contact', label: 'WRITE TO US', visible: true, order: 3 },
  { key: 'philosophy', label: 'Footer', visible: true, order: 4 },
];

export default function Plus() {
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState({ message: '', email: '' });
  const [submitted, setSubmitted] = useState(false);
  const [expandedContent, setExpandedContent] = useState(null);

  const { data: runtime } = useQuery({
    queryKey: ['admin-surface-runtime'],
    queryFn: async () => (await base44.functions.invoke('admin-pages-tools', { action: 'runtime' })).data,
    staleTime: 60_000,
    retry: false,
  });
  const plusSetting = runtime?.settings?.find((item) => item.surface_type === 'page' && item.surface_key === 'Plus');
  const mergedSections = DEFAULT_PLUS_SECTIONS.map((def) => ({ ...def, ...((plusSetting?.configuration?.plus_sections || []).find((item) => item.key === def.key) || {}) }));
  const sectionsMap = {};
  mergedSections.forEach((item) => { sectionsMap[item.key] = item; });
  const sortedSections = [...mergedSections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const isVisible = (key) => sectionsMap[key]?.visible !== false;
  const sectionLabel = (key, fallback) => sectionsMap[key]?.label || fallback;

  const { data: contents = [] } = useQuery({
    queryKey: ['editable-contents'],
    queryFn: () => base44.entities.EditableContent.list(),
  });

  const { data: appLabels = [] } = useQuery({
    queryKey: ['appLabels'],
    queryFn: () => base44.entities.AppLabel.list(),
  });

  const labelsMap = {};
  appLabels.forEach(l => { labelsMap[l.key] = l.value; });
  const L = (key, fallback) => labelsMap[key] ?? fallback;

  const submitContactMutation = useMutation({
    mutationFn: (data) => base44.functions.invoke('sendContactEmail', data),
    onSuccess: () => {
      setSubmitted(true);
      setContactForm({ message: '', email: '' });
      setTimeout(() => {
        setShowContactForm(false);
        setSubmitted(false);
      }, 2000);
    }
  });

  const handleSubmitContact = () => {
    if (!contactForm.message.trim()) return;
    submitContactMutation.mutate(contactForm);
  };

  return (
    <div className="min-h-screen bg-yellow-400 pb-20 pt-8">
      {/* Header */}
      <div className="px-6 mb-12">
        <h1 className="text-black text-3xl font-extralight tracking-widest">{L('plus_title', 'MORE')}</h1>
        <div className="w-12 h-0.5 bg-red-600 mt-4" />
      </div>

      {/* Admin Login Link */}
      {(isVisible('asset_catalog') || isVisible('admin')) && (
        <div className="px-6 mb-12">
          {isVisible('asset_catalog') && (
            <Link
              to={createPageUrl('Catalog')}
              className="flex items-center justify-between p-4 mb-3 bg-neutral-950 border border-white/10 rounded-sm group hover:bg-neutral-900 transition-colors"
            >
              <div className="flex items-center gap-4">
                <Boxes size={20} className="text-yellow-400" />
                <span className="text-white font-light tracking-wide">{sectionLabel('asset_catalog', 'Asset Catalog')}</span>
              </div>
              <ChevronRight size={18} className="text-white group-hover:text-yellow-400 transition-colors" />
            </Link>
          )}
          {isVisible('admin') && (
            <Link
              to={createPageUrl('Admin')}
              className="flex items-center justify-between p-4 bg-neutral-950 border border-white/10 rounded-sm group hover:bg-neutral-900 transition-colors"
            >
              <div className="flex items-center gap-4">
                <Lock size={20} className="text-white" />
                <span className="text-white font-light tracking-wide">{sectionLabel('admin', L('plus_admin_label', 'Admin'))}</span>
              </div>
              <ChevronRight size={18} className="text-white group-hover:text-white transition-colors" />
            </Link>
          )}
        </div>
      )}

      {/* Content Sections */}
      {isVisible('information') && (
      <div className="px-6 mb-12">
        <h2 className="text-white text-xs tracking-widest mb-6">{sectionLabel('information', L('plus_info_section', 'INFORMATION'))}</h2>
        <div className="space-y-3">
          {contents.map((content) => (
            <div key={content.id}>
              <button
                onClick={() => setExpandedContent(expandedContent === content.key ? null : content.key)}
                className="w-full flex items-center justify-between p-4 bg-neutral-950 border border-white/10 rounded-sm hover:bg-neutral-900 transition-colors"
              >
                <span className="text-white font-light tracking-wide">{content.title}</span>
                <ChevronDown 
                  size={18} 
                  className={`text-white transition-transform ${expandedContent === content.key ? 'rotate-180' : ''}`} 
                />
              </button>
              {expandedContent === content.key && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-neutral-950 border border-white/10 border-t-0 rounded-b-sm p-6"
                >
                  <div className="text-white font-light leading-relaxed whitespace-pre-wrap text-sm">
                    {content.content}
                  </div>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Contact Section */}
      {isVisible('contact') && (
      <div className="px-6">
        <h2 className="text-black text-2xl font-extralight tracking-widest mb-6">{sectionLabel('contact', L('plus_contact_section', 'WRITE TO US'))}</h2>
        <div className="w-12 h-0.5 bg-red-600 mb-6" />
        
        {!showContactForm ? (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setShowContactForm(true)}
            className="w-full flex items-center justify-between p-4 bg-neutral-950 border border-white/10 rounded-sm hover:bg-neutral-900 transition-colors"
          >
            <div className="flex items-center gap-4">
              <Mail size={20} className="text-white" />
              <span className="text-white font-light tracking-wide">{L('plus_contact_button', 'Contact Us')}</span>
            </div>
            <ChevronRight size={18} className="text-white" />
          </motion.button>
        ) : (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-neutral-950 border border-white/10 rounded-sm p-6"
          >
            {submitted ? (
              <div className="flex flex-col items-center py-8">
                <Check size={48} className="text-green-500 mb-4" />
                <p className="text-white font-light">Message sent</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Textarea
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  placeholder="Your message..."
                  className="bg-neutral-800 border border-white/20 text-white placeholder:text-white resize-none"
                  rows={4}
                />
                <Input
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  placeholder="Your email (optional, for a reply)"
                  className="bg-neutral-800 border border-white/20 text-white placeholder:text-white"
                />
                <div className="flex gap-3">
                   <button
                     onClick={() => setShowContactForm(false)}
                     className="flex-1 bg-neutral-700 text-white hover:bg-neutral-600 py-2 rounded-sm transition-colors font-light tracking-wide"
                   >
                     Cancel
                   </button>
                   <button
                      onClick={handleSubmitContact}
                      disabled={!contactForm.message.trim() || submitContactMutation.isPending}
                      style={{ color: '#ffffff', backgroundColor: '#dc2626' }}
                      className="flex-1 py-2 rounded-sm transition-colors font-light tracking-wide hover:brightness-110"
                    >
                      Send
                    </button>
                 </div>
              </div>
            )}
          </motion.div>
        )}
      </div>
      )}

      {/* Philosophy */}
      {isVisible('philosophy') && (
      <div className="px-6 mt-16">
        <div className="border-t border-white/10 pt-8">
          <p className="text-white text-xs leading-relaxed text-center font-light">
            {L('plus_footer', 'The Wise Pig is a temporary space, an unfiltered adult space, a living editorial project, without memory, without algorithm, without social competition.')}
          </p>
        </div>
      </div>
      )}
    </div>
  );
}
