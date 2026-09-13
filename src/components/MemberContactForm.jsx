import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { motion } from 'framer-motion';

export default function MemberContactForm({ memberEmail, memberName }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const sendMutation = useMutation({
    mutationFn: async (data) => {
      return base44.integrations.Core.SendEmail({
        to: memberEmail,
        subject: `New message from ${data.name}: ${data.subject}`,
        body: `
          <h2>New Message from ${data.name}</h2>
          <p><strong>From:</strong> ${data.email}</p>
          <p><strong>Subject:</strong> ${data.subject}</p>
          <hr />
          <p>${data.message.replace(/\n/g, '<br>')}</p>
        `,
      });
    },
    onSuccess: () => {
      setSubmitted(true);
      setFormData({ name: '', email: '', subject: '', message: '' });
      setTimeout(() => setSubmitted(false), 3000);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.name && formData.email && formData.subject && formData.message) {
      sendMutation.mutate(formData);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border-2 border-black rounded-lg p-6"
    >
      <h3 className="text-black text-2xl font-semibold mb-1">Get in Touch</h3>
      <p className="text-black text-sm mb-6">Send a message to {memberName}</p>

      {submitted ? (
        <div className="bg-green-100 border border-green-600 text-green-800 p-4 rounded text-center">
          ✓ Message sent successfully!
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Your Name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="col-span-1 bg-yellow-50 border-2 border-black/20 rounded p-3 text-black placeholder:text-black focus:outline-none focus:border-black"
              required
            />
            <input
              type="email"
              placeholder="Your Email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="col-span-1 bg-yellow-50 border-2 border-black/20 rounded p-3 text-black placeholder:text-black focus:outline-none focus:border-black"
              required
            />
          </div>

          <input
            type="text"
            placeholder="Subject"
            value={formData.subject}
            onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
            className="w-full bg-yellow-50 border-2 border-black/20 rounded p-3 text-black placeholder:text-black focus:outline-none focus:border-black"
            required
          />

          <textarea
            placeholder="Your message..."
            value={formData.message}
            onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
            rows={5}
            className="w-full bg-yellow-50 border-2 border-black/20 rounded p-3 text-black placeholder:text-black focus:outline-none focus:border-black resize-none"
            required
          />

          <button
            type="submit"
            disabled={sendMutation.isPending}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <Send size={18} />
            {sendMutation.isPending ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      )}
    </motion.div>
  );
}