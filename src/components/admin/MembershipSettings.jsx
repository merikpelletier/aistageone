import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, CheckCircle } from 'lucide-react';

export default function MembershipSettings() {
  const qc = useQueryClient();
  const [activeType, setActiveType] = useState('intro');
  const [saved, setSaved] = useState(false);
  const [membershipTypes, setMembershipTypes] = useState([]);
  const [form, setForm] = useState({
    intro: { intro_text: '', subtitle: '' },
  });

  const { data: contents = [] } = useQuery({
    queryKey: ['membership-settings'],
    queryFn: () => base44.entities.EditableContent.list(),
  });

  const { data: pricing = [] } = useQuery({
    queryKey: ['membership-pricing'],
    queryFn: () => base44.entities.MembershipPricing.list(),
  });

  useEffect(() => {
    if (!pricing.length) return;
    const types = pricing
      .filter(p => p.is_active)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(p => ({
        key: p.membership_type,
        label: p.membership_type,
        emoji: '💎'
      }));
    setMembershipTypes(types);
    
    const newForm = { intro: { intro_text: '', subtitle: '' } };
    types.forEach(({ key }) => {
      newForm[key] = { title: '', description: '' };
    });
    setForm(newForm);
  }, [pricing]);

  useEffect(() => {
    if (!contents.length || !membershipTypes.length) return;
    const newForm = { ...form };
    
    // Load intro
    const introItem = contents.find(c => c.key === 'membership_intro');
    if (introItem) {
      try {
        const parsed = JSON.parse(introItem.content);
        newForm.intro = { intro_text: '', subtitle: '', ...parsed };
      } catch {
        newForm.intro = { intro_text: introItem.content || '', subtitle: '' };
      }
    }
    
    // Load membership types
    membershipTypes.forEach(({ key }) => {
      const item = contents.find(c => c.key === `membership_${key}`);
      if (item) {
        try {
          const parsed = JSON.parse(item.content);
          newForm[key] = { title: '', description: '', ...parsed };
        } catch {
          newForm[key] = { title: item.title || '', description: item.content || '' };
        }
      }
    });
    setForm(newForm);
  }, [contents.length, membershipTypes.length]);

  const saveMutation = useMutation({
    mutationFn: async (type) => {
      const existing = contents.find(c => c.key === `membership_${type}`);
      let payload;
      
      if (type === 'intro') {
        payload = {
          key: 'membership_intro',
          title: 'Membership Introduction',
          content: JSON.stringify(form.intro),
        };
      } else {
        const typeObj = membershipTypes.find(t => t.key === type);
        payload = {
          key: `membership_${type}`,
          title: form[type].title || typeObj?.label || type,
          content: JSON.stringify(form[type]),
        };
      }
      
      return existing
        ? base44.entities.EditableContent.update(existing.id, payload)
        : base44.entities.EditableContent.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['membership-settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const cur = form[activeType];

  return (
    <div className="space-y-5">
      {/* Type tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => { setActiveType('intro'); setSaved(false); }}
          className={`px-4 py-2 text-sm rounded-lg font-medium transition-all border ${
            activeType === 'intro'
              ? 'bg-white text-black border-white'
              : 'border-white/20 text-white hover:text-white hover:border-white/40'
          }`}
        >
          📝 Introduction
        </button>
        {membershipTypes.map(t => (
          <button
            key={t.key}
            onClick={() => { setActiveType(t.key); setSaved(false); }}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-all border ${
              activeType === t.key
                ? 'bg-white text-black border-white'
                : 'border-white/20 text-white hover:text-white hover:border-white/40'
            }`}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-5">
        {activeType === 'intro' ? (
          <>
            {/* Intro Text */}
            <div>
              <label className="text-white text-xs tracking-widest block mb-1.5">MAIN INTRO TEXT</label>
              <textarea
                value={cur.intro_text}
                onChange={e => setForm({ ...form, intro: { ...cur, intro_text: e.target.value } })}
                rows={4}
                placeholder="Main paragraph to explain memberships..."
                className="w-full px-3 py-2.5 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/30 resize-none"
              />
            </div>

            {/* Subtitle */}
            <div>
              <label className="text-white text-xs tracking-widest block mb-1.5">SUBTITLE (OPTIONAL)</label>
              <input
                type="text"
                value={cur.subtitle}
                onChange={e => setForm({ ...form, intro: { ...cur, subtitle: e.target.value } })}
                placeholder="E.g. Select a membership type below to apply today."
                className="w-full px-3 py-2.5 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/30"
              />
            </div>
          </>
        ) : (
          <>
            {/* Title */}
            <div>
              <label className="text-white text-xs tracking-widest block mb-1.5">DISPLAYED TITLE</label>
              <input
                type="text"
                value={cur.title}
                onChange={e => setForm({ ...form, [activeType]: { ...cur, title: e.target.value } })}
                placeholder={`E.g. Become a ${membershipTypes.find(t => t.key === activeType)?.label || 'Member'}`}
                className="w-full px-3 py-2.5 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/30"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-white text-xs tracking-widest block mb-1.5">DESCRIPTION</label>
              <textarea
                value={cur.description}
                onChange={e => setForm({ ...form, [activeType]: { ...cur, description: e.target.value } })}
                rows={3}
                placeholder="Describe this membership type in a few sentences..."
                className="w-full px-3 py-2.5 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/30 resize-none"
              />
            </div>
          </>
        )}

        <button
          onClick={() => saveMutation.mutate(activeType)}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50"
        >
          {saved ? <CheckCircle size={16} className="text-green-600" /> : <Save size={16} />}
          {saved ? 'Saved!' : 'Save'}
        </button>
      </div>
    </div>
  );
}