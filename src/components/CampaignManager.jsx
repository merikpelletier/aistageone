import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, Plus, X, Calendar, Bell, ShoppingBag, Sparkles, Trash2, Power, Loader2 } from 'lucide-react';
import { createPageUrl } from '@/utils';

const BANNER_COLORS = {
  yellow: { bg: 'bg-yellow-400', text: 'text-black', label: 'Yellow' },
  red: { bg: 'bg-red-500', text: 'text-white', label: 'Red' },
  blue: { bg: 'bg-blue-500', text: 'text-white', label: 'Blue' },
  green: { bg: 'bg-green-500', text: 'text-white', label: 'Green' },
  purple: { bg: 'bg-purple-500', text: 'text-white', label: 'Purple' },
  pink: { bg: 'bg-pink-500', text: 'text-white', label: 'Pink' },
};

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'text-white/50', bg: 'bg-white/10', border: 'border-white/20' },
  active: { label: 'Active', color: 'text-green-400', bg: 'bg-green-400/15', border: 'border-green-400/30' },
  ended: { label: 'Ended', color: 'text-white/40', bg: 'bg-white/5', border: 'border-white/10' },
};

const EMPTY_FORM = {
  title: '',
  description: '',
  linked_story_id: '',
  start_date: '',
  end_date: '',
  subscription_fee: '',
  notify_new_episodes: true,
  notify_merch_releases: false,
  notify_upcoming_projects: false,
  banner_color: 'yellow',
  status: 'draft',
};

export default function CampaignManager({ userEmail }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // Fetch member's published stories
  const { data: stories = [] } = useQuery({
    queryKey: ['campaignStories', userEmail],
    queryFn: async () => {
      const results = await base44.entities.TimelineStory.filter({ user_email: userEmail, is_published: true });
      return results.filter(s => s.dossier_id);
    },
    enabled: !!userEmail,
  });

  // Fetch member's campaigns
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['memberCampaigns', userEmail],
    queryFn: async () => {
      const results = await base44.entities.Campaign.filter({ member_email: userEmail });
      return results.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!userEmail,
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const story = stories.find(s => s.id === data.linked_story_id);
      const payload = {
        member_email: userEmail,
        title: data.title,
        description: data.description,
        linked_story_id: data.linked_story_id,
        linked_dossier_id: story?.dossier_id || '',
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        subscription_fee: data.subscription_fee ? parseFloat(data.subscription_fee) : 0,
        notify_new_episodes: data.notify_new_episodes,
        notify_merch_releases: data.notify_merch_releases,
        notify_upcoming_projects: data.notify_upcoming_projects,
        banner_color: data.banner_color,
        status: data.status,
      };
      if (editingId) {
        return await base44.entities.Campaign.update(editingId, payload);
      }
      return await base44.entities.Campaign.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberCampaigns', userEmail] });
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => await base44.entities.Campaign.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['memberCampaigns', userEmail] }),
  });

  const toggleStatus = async (campaign) => {
    const nextStatus = campaign.status === 'active' ? 'ended' : campaign.status === 'draft' ? 'active' : 'draft';
    await base44.entities.Campaign.update(campaign.id, { status: nextStatus });
    queryClient.invalidateQueries({ queryKey: ['memberCampaigns', userEmail] });
  };

  const handleEdit = (campaign) => {
    setEditingId(campaign.id);
    setForm({
      title: campaign.title || '',
      description: campaign.description || '',
      linked_story_id: campaign.linked_story_id || '',
      start_date: campaign.start_date || '',
      end_date: campaign.end_date || '',
      subscription_fee: campaign.subscription_fee?.toString() || '',
      notify_new_episodes: campaign.notify_new_episodes ?? true,
      notify_merch_releases: campaign.notify_merch_releases ?? false,
      notify_upcoming_projects: campaign.notify_upcoming_projects ?? false,
      banner_color: campaign.banner_color || 'yellow',
      status: campaign.status || 'draft',
    });
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    saveMutation.mutate(form);
  };

  const toggle = (field) => setForm(f => ({ ...f, [field]: !f[field] }));

  return (
    <div className="bg-black border border-white/10 rounded-3xl p-6 space-y-5 shadow-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center">
            <Megaphone size={20} className="text-black" />
          </div>
          <div>
            <p className="text-white text-xl font-bold uppercase tracking-wider">Campaigns</p>
            <p className="text-white/50 text-xs font-medium">Create campaigns linked to your stories</p>
          </div>
        </div>
        {!showForm && (
          <button
            onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); }}
            className="w-9 h-9 bg-yellow-400 text-black rounded-full flex items-center justify-center hover:bg-yellow-500 transition-colors"
          >
            <Plus size={18} />
          </button>
        )}
      </div>

      {/* Create/Edit Form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="space-y-4 bg-white/5 rounded-2xl p-5 border border-white/10 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <p className="text-white font-bold text-sm uppercase tracking-wide">{editingId ? 'Edit Campaign' : 'New Campaign'}</p>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }}>
                <X size={18} className="text-white/50 hover:text-white" />
              </button>
            </div>

            {/* Title */}
            <div>
              <label className="text-white/50 text-xs font-bold uppercase tracking-wide mb-1 block">Campaign Title</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Season 1 Pass"
                className="w-full bg-black/40 text-white text-sm rounded-xl px-4 py-2.5 border border-white/10 focus:border-yellow-400/50 outline-none"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-white/50 text-xs font-bold uppercase tracking-wide mb-1 block">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What are subscribers getting?"
                rows={2}
                className="w-full bg-black/40 text-white text-sm rounded-xl px-4 py-2.5 border border-white/10 focus:border-yellow-400/50 outline-none resize-none"
              />
            </div>

            {/* Linked Story */}
            <div>
              <label className="text-white/50 text-xs font-bold uppercase tracking-wide mb-1 block">Linked Story</label>
              <select
                value={form.linked_story_id}
                onChange={e => setForm(f => ({ ...f, linked_story_id: e.target.value }))}
                className="w-full bg-black/40 text-white text-sm rounded-xl px-4 py-2.5 border border-white/10 focus:border-yellow-400/50 outline-none"
              >
                <option value="">Select a published story…</option>
                {stories.map(s => (
                  <option key={s.id} value={s.id}>{s.production_name || s.episode_title || 'Untitled'}</option>
                ))}
              </select>
              {stories.length === 0 && (
                <p className="text-white/30 text-xs mt-1">Publish a story first to link a campaign.</p>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-white/50 text-xs font-bold uppercase tracking-wide mb-1 flex items-center gap-1"><Calendar size={12} /> Start</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  className="w-full bg-black/40 text-white text-sm rounded-xl px-3 py-2.5 border border-white/10 focus:border-yellow-400/50 outline-none"
                />
              </div>
              <div>
                <label className="text-white/50 text-xs font-bold uppercase tracking-wide mb-1 flex items-center gap-1"><Calendar size={12} /> End</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  className="w-full bg-black/40 text-white text-sm rounded-xl px-3 py-2.5 border border-white/10 focus:border-yellow-400/50 outline-none"
                />
              </div>
            </div>

            {/* Subscription Fee */}
            <div>
              <label className="text-white/50 text-xs font-bold uppercase tracking-wide mb-1 block">Subscription Fee ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.subscription_fee}
                onChange={e => setForm(f => ({ ...f, subscription_fee: e.target.value }))}
                placeholder="0 for free"
                className="w-full bg-black/40 text-white text-sm rounded-xl px-4 py-2.5 border border-white/10 focus:border-yellow-400/50 outline-none"
              />
            </div>

            {/* Notification Options */}
            <div>
              <p className="text-white/50 text-xs font-bold uppercase tracking-wide mb-2">Subscriber Notifications</p>
              <div className="space-y-2">
                {[
                  { key: 'notify_new_episodes', label: 'New Episode Published', icon: Bell },
                  { key: 'notify_merch_releases', label: 'Merchandise Releases', icon: ShoppingBag },
                  { key: 'notify_upcoming_projects', label: 'Upcoming Projects', icon: Sparkles },
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggle(key)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                      form[key] ? 'bg-yellow-400/15 border-yellow-400/40' : 'bg-black/30 border-white/10'
                    }`}
                  >
                    <Icon size={16} className={form[key] ? 'text-yellow-400' : 'text-white/30'} />
                    <span className={`text-sm font-medium flex-1 text-left ${form[key] ? 'text-white' : 'text-white/40'}`}>{label}</span>
                    <div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${form[key] ? 'bg-yellow-400' : 'bg-white/20'}`}>
                      <div className={`w-4 h-4 rounded-full bg-black transition-transform ${form[key] ? 'translate-x-4' : ''}`} />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Banner Color */}
            <div>
              <p className="text-white/50 text-xs font-bold uppercase tracking-wide mb-2">Banner Color</p>
              <div className="flex gap-2">
                {Object.entries(BANNER_COLORS).map(([key, cfg]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, banner_color: key }))}
                    className={`w-8 h-8 rounded-lg ${cfg.bg} ${form.banner_color === key ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : ''}`}
                  />
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="text-white/50 text-xs font-bold uppercase tracking-wide mb-1 block">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full bg-black/40 text-white text-sm rounded-xl px-4 py-2.5 border border-white/10 focus:border-yellow-400/50 outline-none"
              >
                <option value="draft">Draft (hidden)</option>
                <option value="active">Active (visible)</option>
                <option value="ended">Ended</option>
              </select>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={saveMutation.isPending || !form.title.trim()}
              className="w-full py-3 bg-yellow-400 text-black rounded-xl font-bold text-sm uppercase tracking-wide hover:bg-yellow-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Megaphone size={16} />}
              {editingId ? 'Save Changes' : 'Create Campaign'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Campaign List */}
      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-white/30" /></div>
      ) : campaigns.length === 0 && !showForm ? (
        <div className="text-center py-6">
          <Megaphone size={32} className="text-white/20 mx-auto mb-2" />
          <p className="text-white/40 text-sm">No campaigns yet. Create one to engage your audience.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {campaigns.map(c => {
            const statusCfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.draft;
            const colorCfg = BANNER_COLORS[c.banner_color] || BANNER_COLORS.yellow;
            const story = stories.find(s => s.id === c.linked_story_id);
            return (
              <div key={c.id} className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg ${colorCfg.bg} flex items-center justify-center flex-shrink-0`}>
                    <Megaphone size={16} className={colorCfg.text} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-bold text-sm">{c.title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-md border font-bold uppercase ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
                        {statusCfg.label}
                      </span>
                    </div>
                    {c.description && <p className="text-white/40 text-xs mt-1 line-clamp-2">{c.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-white/40">
                      {c.subscription_fee > 0 && <span className="text-green-400 font-bold">${c.subscription_fee}</span>}
                      {c.start_date && <span>{new Date(c.start_date).toLocaleDateString()}</span>}
                      {c.end_date && <span>→ {new Date(c.end_date).toLocaleDateString()}</span>}
                      {story && <span className="truncate">{story.production_name || story.episode_title}</span>}
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      {c.notify_new_episodes && <span className="text-xs px-1.5 py-0.5 bg-white/10 text-white/50 rounded-md flex items-center gap-1"><Bell size={10} />Episodes</span>}
                      {c.notify_merch_releases && <span className="text-xs px-1.5 py-0.5 bg-white/10 text-white/50 rounded-md flex items-center gap-1"><ShoppingBag size={10} />Merch</span>}
                      {c.notify_upcoming_projects && <span className="text-xs px-1.5 py-0.5 bg-white/10 text-white/50 rounded-md flex items-center gap-1"><Sparkles size={10} />Projects</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button onClick={() => toggleStatus(c)} className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors" title={c.status === 'active' ? 'End' : 'Activate'}>
                      <Power size={13} className={c.status === 'active' ? 'text-green-400' : 'text-white/50'} />
                    </button>
                    <button onClick={() => handleEdit(c)} className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center hover:bg-white/20 transition-colors text-white/50 text-xs">✎</button>
                    <button onClick={() => deleteMutation.mutate(c.id)} className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center hover:bg-red-400/20 transition-colors">
                      <Trash2 size={13} className="text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}