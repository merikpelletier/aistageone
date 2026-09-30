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
    <div className="relative min-h-screen overflow-hidden bg-[#070707] pb-24 text-white">
      {backgroundImage && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          />
          <div className="absolute inset-0 bg-black/70" />
        </>
      )}

      <div className="relative mx-auto w-full max-w-6xl px-5 pt-14 sm:px-8 md:px-10 md:pt-20 lg:px-14">
        <header className="mb-14 md:mb-20">
          <div className="flex items-start justify-between gap-6 border-b border-white/15 pb-8 md:pb-10">
            <div>
              <p className="mb-4 text-[10px] uppercase tracking-[0.34em] text-white/35">
                AISTAGE.ONE
              </p>
              <h1 className="text-5xl font-extralight leading-none tracking-[-0.04em] text-white sm:text-6xl md:text-8xl">
                {L('plus_title', 'MORE')}
              </h1>
              <div className="mt-6 h-px w-16 bg-red-600" />
            </div>

            {isVisible('admin') && (
              <Link
                to={createPageUrl('Admin')}
                className="group mt-1 hidden items-center gap-3 border border-white/15 px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-white/55 transition-colors hover:border-white/40 hover:text-white sm:flex"
              >
                <Lock size={14} strokeWidth={1.5} />
                <span>{sectionLabel('admin', L('plus_admin_label', 'Admin'))}</span>
                <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </div>

          {isVisible('admin') && (
            <Link
              to={createPageUrl('Admin')}
              className="mt-5 flex w-full items-center justify-between border-b border-white/15 py-4 text-sm font-light tracking-wide text-white/70 sm:hidden"
            >
              <span className="flex items-center gap-3">
                <Lock size={16} strokeWidth={1.5} />
                {sectionLabel('admin', L('plus_admin_label', 'Admin'))}
              </span>
              <ChevronRight size={16} />
            </Link>
          )}
        </header>

        {isVisible('information') && (
          <section className="mb-20 md:mb-28">
            <div className="mb-6 flex items-end justify-between border-b border-white/15 pb-4 md:mb-8">
              <h2 className="text-xs font-medium uppercase tracking-[0.3em] text-white/45">
                {sectionLabel('information', L('plus_info_section', 'INFORMATION'))}
              </h2>
              <span className="text-[10px] uppercase tracking-[0.22em] text-white/25">
                {String(contents.length).padStart(2, '0')}
              </span>
            </div>

            <div className="divide-y divide-white/15 border-b border-white/15">
              {contents.map((content, index) => {
                const expanded = expandedContent === content.key;
                return (
                  <div key={content.id}>
                    <button
                      onClick={() => setExpandedContent(expanded ? null : content.key)}
                      className="group grid w-full grid-cols-[42px_minmax(0,1fr)_28px] items-center gap-3 py-5 text-left md:grid-cols-[64px_minmax(0,1fr)_36px] md:py-7"
                    >
                      <span className="text-xs font-light tracking-[0.18em] text-white/25">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="text-lg font-extralight tracking-[-0.01em] text-white md:text-2xl">
                        {content.title}
                      </span>
                      <ChevronDown
                        size={18}
                        strokeWidth={1.4}
                        className={`justify-self-end text-white/35 transition-transform duration-300 group-hover:text-white ${expanded ? 'rotate-180' : ''}`}
                      />
                    </button>

                    <AnimatePresence initial={false}>
                      {expanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.22 }}
                          className="overflow-hidden"
                        >
                          <div className="pb-7 pl-[55px] pr-3 text-sm font-light leading-7 text-white/60 md:pb-9 md:pl-[88px] md:pr-16 md:text-base">
                            <div className="max-w-3xl whitespace-pre-wrap">
                              {content.content}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {isVisible('contact') && (
          <section className="mb-16 md:mb-24">
            <div className="mb-7 border-b border-white/15 pb-5">
              <p className="mb-3 text-[10px] uppercase tracking-[0.3em] text-white/35">
                Contact
              </p>
              <h2 className="text-3xl font-extralight tracking-[-0.025em] text-white md:text-5xl">
                {sectionLabel('contact', L('plus_contact_section', 'WRITE TO US'))}
              </h2>
            </div>

            {!showContactForm ? (
              <button
                onClick={() => setShowContactForm(true)}
                className="group flex w-full items-center justify-between border-y border-white/15 py-6 text-left transition-colors hover:border-white/35 md:py-8"
              >
                <div className="flex items-center gap-4 md:gap-5">
                  <Mail size={20} strokeWidth={1.35} className="text-white/45" />
                  <div>
                    <p className="text-lg font-extralight text-white md:text-2xl">
                      {L('plus_contact_button', 'Contact Us')}
                    </p>
                    <p className="mt-1 text-xs font-light text-white/35">
                      Questions, support, partnerships or general inquiries
                    </p>
                  </div>
                </div>
                <ChevronRight size={22} strokeWidth={1.3} className="text-white/35 transition-transform group-hover:translate-x-1 group-hover:text-white" />
              </button>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-y border-white/15 py-7 md:py-9"
              >
                {submitted ? (
                  <div className="flex min-h-40 flex-col items-center justify-center">
                    <Check size={38} strokeWidth={1.4} className="mb-4 text-white" />
                    <p className="font-light text-white">Message sent</p>
                  </div>
                ) : (
                  <div className="max-w-3xl space-y-4">
                    <Textarea
                      value={contactForm.message}
                      onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                      placeholder="Your message..."
                      className="min-h-36 rounded-none border-white/15 bg-white/[0.04] text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-white/30"
                      rows={5}
                    />
                    <Input
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      placeholder="Your email (optional, for a reply)"
                      className="h-12 rounded-none border-white/15 bg-white/[0.04] text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-white/30"
                    />
                    <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                      <button
                        onClick={() => setShowContactForm(false)}
                        className="border border-white/15 px-6 py-3 text-xs uppercase tracking-[0.2em] text-white/60 transition-colors hover:border-white/40 hover:text-white sm:min-w-36"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSubmitContact}
                        disabled={!contactForm.message.trim() || submitContactMutation.isPending}
                        className="bg-red-600 px-6 py-3 text-xs uppercase tracking-[0.2em] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35 sm:min-w-36"
                      >
                        {submitContactMutation.isPending ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </section>
        )}

        {isVisible('philosophy') && (
          <footer className="border-t border-white/10 py-8 md:py-10">
            <p className="max-w-2xl text-[11px] font-light leading-relaxed text-white/30">
              {L(
                'plus_footer',
                'The Wise Pig is a temporary space, an unfiltered adult space, a living editorial project, without memory, without algorithm, without social competition.'
              )}
            </p>
          </footer>
        )}
      </div>
    </div>
  );
}
