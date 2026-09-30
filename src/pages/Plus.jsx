import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Mail,
  ChevronRight,
  Check,
  Lock,
  ChevronDown
} from 'lucide-react';

const DEFAULT_PLUS_SECTIONS = [
  { key: 'admin', label: 'Admin', visible: true, order: 0 },
  { key: 'information', label: 'INFORMATION', visible: true, order: 1 },
  { key: 'contact', label: 'WRITE TO US', visible: true, order: 2 },
  { key: 'philosophy', label: 'Footer', visible: true, order: 3 },
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
  const mergedSections = DEFAULT_PLUS_SECTIONS.map((def) => ({
    ...def,
    ...((plusSetting?.configuration?.plus_sections || []).find((item) => item.key === def.key) || {}),
  }));
  const sectionsMap = {};
  mergedSections.forEach((item) => { sectionsMap[item.key] = item; });
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
  appLabels.forEach((l) => { labelsMap[l.key] = l.value; });
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
    },
  });

  const handleSubmitContact = () => {
    if (!contactForm.message.trim()) return;
    submitContactMutation.mutate(contactForm);
  };

  const backgroundImage = plusSetting?.configuration?.background_image || '';

  return (
    <div className="relative min-h-screen bg-black pb-24 pt-10 text-white">
      {backgroundImage && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/80 to-black pointer-events-none" />

      <div className="relative mx-auto w-full max-w-5xl px-5 sm:px-8 md:px-10">
        <header className="border-b border-white/15 pb-8 md:pb-10">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="mb-3 text-[10px] uppercase tracking-[0.34em] text-white/40">AISTAGE.ONE</p>
              <h1 className="text-5xl font-extralight tracking-[-0.04em] md:text-7xl">
                {L('plus_title', 'MORE')}
              </h1>
            </div>

            {isVisible('admin') && (
              <Link
                to={createPageUrl('Admin')}
                className="group mb-1 hidden items-center gap-2 text-xs uppercase tracking-[0.24em] text-white/45 transition-colors hover:text-white sm:flex"
              >
                <Lock size={14} />
                <span>{sectionLabel('admin', L('plus_admin_label', 'Admin'))}</span>
                <ChevronRight size={14} className="transition-transform group-hover:translate-x-1" />
              </Link>
            )}
          </div>
        </header>

        {isVisible('information') && (
          <section className="py-8 md:py-10">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.28em] text-white/35">
                {sectionLabel('information', L('plus_info_section', 'INFORMATION'))}
              </h2>
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/25">
                {String(contents.length).padStart(2, '0')}
              </span>
            </div>

            <div className="divide-y divide-white/12 border-y border-white/12">
              {contents.map((content, index) => {
                const expanded = expandedContent === content.key;
                return (
                  <div key={content.id}>
                    <button
                      onClick={() => setExpandedContent(expanded ? null : content.key)}
                      className="group grid w-full grid-cols-[42px_minmax(0,1fr)_28px] items-center gap-3 py-5 text-left md:grid-cols-[58px_minmax(0,1fr)_32px] md:py-6"
                    >
                      <span className="text-xs font-light tracking-[0.14em] text-white/25">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="text-lg font-light tracking-[-0.01em] text-white md:text-2xl">
                        {content.title}
                      </span>
                      <ChevronDown
                        size={18}
                        className={`justify-self-end text-white/35 transition-transform duration-200 group-hover:text-white ${expanded ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {expanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="overflow-hidden"
                      >
                        <div className="pb-6 pl-[42px] pr-4 text-sm font-light leading-relaxed text-white/65 md:pb-8 md:pl-[58px] md:text-base">
                          <div className="max-w-3xl whitespace-pre-wrap">{content.content}</div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {isVisible('contact') && (
          <section className="border-t border-white/15 py-8 md:py-10">
            <div className="mb-6">
              <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/35">Contact</p>
              <h2 className="text-3xl font-extralight tracking-[-0.02em] md:text-5xl">
                {sectionLabel('contact', L('plus_contact_section', 'WRITE TO US'))}
              </h2>
            </div>

            {!showContactForm ? (
              <button
                onClick={() => setShowContactForm(true)}
                className="group flex w-full items-center justify-between border-y border-white/15 py-5 text-left transition-colors hover:border-white/35"
              >
                <div className="flex items-center gap-4">
                  <Mail size={18} className="text-red-500" />
                  <span className="text-base font-light md:text-lg">{L('plus_contact_button', 'Contact Us')}</span>
                </div>
                <ChevronRight size={18} className="text-white/40 transition-transform group-hover:translate-x-1 group-hover:text-white" />
              </button>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-y border-white/15 py-6"
              >
                {submitted ? (
                  <div className="flex items-center gap-3 py-6 text-white/80">
                    <Check size={22} className="text-green-500" />
                    <span className="font-light">Message sent</span>
                  </div>
                ) : (
                  <div className="max-w-2xl space-y-4">
                    <Textarea
                      value={contactForm.message}
                      onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                      placeholder="Your message..."
                      className="min-h-32 rounded-none border-white/15 bg-white/[0.03] text-white placeholder:text-white/30 focus-visible:ring-red-500"
                      rows={5}
                    />
                    <Input
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      placeholder="Your email (optional)"
                      className="rounded-none border-white/15 bg-white/[0.03] text-white placeholder:text-white/30 focus-visible:ring-red-500"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowContactForm(false)}
                        className="border border-white/15 px-5 py-3 text-xs uppercase tracking-[0.2em] text-white/60 transition-colors hover:border-white/35 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSubmitContact}
                        disabled={!contactForm.message.trim() || submitContactMutation.isPending}
                        className="bg-red-600 px-6 py-3 text-xs uppercase tracking-[0.2em] text-white transition-colors hover:bg-red-500 disabled:opacity-40"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </section>
        )}

        {isVisible('admin') && (
          <div className="pb-8 sm:hidden">
            <Link
              to={createPageUrl('Admin')}
              className="flex items-center justify-between border-y border-white/15 py-4 text-sm font-light text-white/60"
            >
              <span className="flex items-center gap-3"><Lock size={16} />{sectionLabel('admin', L('plus_admin_label', 'Admin'))}</span>
              <ChevronRight size={16} />
            </Link>
          </div>
        )}

        {isVisible('philosophy') && (
          <footer className="border-t border-white/10 py-8 text-center">
            <p className="mx-auto max-w-lg text-[11px] font-light leading-relaxed text-white/30">
              {L('plus_footer', 'The Wise Pig is a temporary space, an unfiltered adult space, a living editorial project, without memory, without algorithm, without social competition.')}
            </p>
          </footer>
        )}
      </div>
    </div>
  );}
