import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Send, Image as ImageIcon, Loader2, CheckCircle2, Upload, ChevronDown, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

const DOSSIER_CLASSES = ['Story', 'Videos', 'Assets', 'Kits', 'Merchandise'];
const STORY_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
];

export default function PublishStoryModal({ open, onClose, session, blocks, hero, theme, user, onPublished }) {
  const [title, setTitle] = useState('');
  const [titleEdited, setTitleEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [dossierClass, setDossierClass] = useState('Story');
  const [contentRating, setContentRating] = useState('all');
  const [originalLanguage, setOriginalLanguage] = useState('en');
  const [publicConfirmed, setPublicConfirmed] = useState(false);
  const [authorName, setAuthorName] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [categories, setCategories] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedBlockIds, setSelectedBlockIds] = useState([]);
  const [uploadedCovers, setUploadedCovers] = useState([]);
  const fileInputRef = useRef(null);

  // Publishable chapters = blocks with at least one produced video segment
  const publishableBlocks = useMemo(() => {
    return blocks.filter(b => (b.video_segments || []).some(Boolean));
  }, [blocks]);

  // Cover options derived from selected chapters' scenes + hero/theme + uploads
  const coverOptions = useMemo(() => {
    const opts = [];
    const selected = publishableBlocks.filter(b => selectedBlockIds.includes(b.id));
    selected.forEach(block => {
      const bi = blocks.findIndex(b => b.id === block.id);
      (block.video_segments || []).forEach((url, si) => {
        if (url) opts.push({ url, label: `Chapter ${bi + 1} · Scene ${si + 1}` });
      });
    });
    if (hero?.photos?.length) {
      hero.photos.forEach((url, i) => opts.push({ url, label: i === 0 ? 'Hero Portrait' : `Hero Photo ${i + 1}` }));
    }
    if (theme?.cover_image) opts.push({ url: theme.cover_image, label: 'Theme Cover' });
    uploadedCovers.forEach((url, i) => opts.push({ url, label: i === 0 ? 'Uploaded' : `Uploaded ${i + 1}` }));
    return opts;
  }, [publishableBlocks, selectedBlockIds, blocks, hero, theme, uploadedCovers]);

  useEffect(() => {
    if (!open) return;
    const allIds = publishableBlocks.map(b => b.id);
    setSelectedBlockIds(allIds); // default: all chapters = full story
    setTitleEdited(false);
    setDescription(publishableBlocks[0]?.narrative_summary?.slice(0, 300) || theme?.description || '');
    setCategory('');
    setAuthorName(user?.full_name || user?.email || '');
    setContentRating('all');
    setOriginalLanguage('en');
    setPublicConfirmed(false);
    setUploadedCovers([]);
    setCoverImage('');
    base44.entities.DossierCategory.list('order', 50)
      .then(cats => setCategories(cats.map(c => c.name)))
      .catch(() => setCategories([]));
  }, [open]);

  // Auto-set title based on selection (unless the user edited it manually)
  useEffect(() => {
    if (!open || titleEdited) return;
    const heroName = hero?.name || 'My Story';
    const selected = publishableBlocks.filter(b => selectedBlockIds.includes(b.id));
    if (selected.length === 0 || selected.length === publishableBlocks.length) {
      setTitle(`${heroName}'s Story`);
    } else if (selected.length === 1) {
      const bi = blocks.findIndex(b => b.id === selected[0].id);
      setTitle(`${heroName}'s Story — Chapter ${bi + 1}`);
    } else {
      const nums = selected.map(b => blocks.findIndex(x => x.id === b.id) + 1).sort((a, b) => a - b);
      setTitle(`${heroName}'s Story — Chapters ${nums.join(', ')}`);
    }
  }, [selectedBlockIds, open, titleEdited, publishableBlocks, blocks, hero]);

  // Keep a valid cover image when the option set changes
  useEffect(() => {
    if (coverOptions.length === 0) {
      setCoverImage('');
      return;
    }
    if (!coverOptions.find(o => o.url === coverImage)) {
      setCoverImage(coverOptions[0].url);
    }
  }, [coverOptions]);

  const toggleBlock = (id) => {
    setSelectedBlockIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleAll = () => {
    setSelectedBlockIds(prev => prev.length === publishableBlocks.length ? [] : publishableBlocks.map(b => b.id));
  };

  const handleUploadCover = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setUploadedCovers(prev => [...prev, file_url]);
      setCoverImage(file_url);
      toast.success('Cover image uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePublish = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    if (selectedBlockIds.length === 0) {
      toast.error('Select at least one chapter');
      return;
    }
    if (!publicConfirmed) {
      toast.error('Confirm public Magazine publication');
      return;
    }
    setPublishing(true);
    try {
      const res = await base44.functions.invoke('publishStorySession', {
        session_id: session.id,
        block_ids: selectedBlockIds,
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        dossier_class: dossierClass,
        author_name: authorName.trim(),
        cover_image: coverImage,
        content_rating: contentRating,
        original_language: originalLanguage,
        public_promo_confirmed: publicConfirmed,
      });
      if (res.data?.error) {
        toast.error(res.data.error);
      } else {
        toast.success(`Published! ${res.data.scene_count} scenes are now live in the Magazine.`);
        onPublished(res.data.dossier_id);
        onClose();
      }
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Failed to publish';
      toast.error(msg);
    } finally {
      setPublishing(false);
    }
  };

  if (!open) return null;

  const allSelected = selectedBlockIds.length === publishableBlocks.length && publishableBlocks.length > 0;
  const noneSelected = selectedBlockIds.length === 0;
  const publishLabel = allSelected ? 'Publish Full Story' : `Publish ${selectedBlockIds.length} Chapter${selectedBlockIds.length > 1 ? 's' : ''}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%' }}
        className="bg-yellow-400 w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-yellow-400 px-5 pt-5 pb-3 flex items-center justify-between z-10">
          <div>
            <p className="text-black text-xs uppercase tracking-wider font-bold">Publish to Magazine</p>
            <h2 className="text-black text-xl font-bold">Story Details</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 bg-black rounded-full flex items-center justify-center flex-shrink-0">
            <X size={18} className="text-yellow-400" />
          </button>
        </div>

        <div className="px-5 pb-6 space-y-4">
          {/* Chapters selection */}
          {publishableBlocks.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-black text-xs uppercase tracking-wider font-bold">Chapters to publish</label>
                <button
                  onClick={toggleAll}
                  className="flex items-center gap-1.5 text-xs font-bold text-black active:scale-95 transition-transform"
                >
                  {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                  {allSelected ? 'Clear' : 'Select all'}
                </button>
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {publishableBlocks.map(block => {
                  const bi = blocks.findIndex(b => b.id === block.id);
                  const scenes = (block.video_segments || []).filter(Boolean).length;
                  const checked = selectedBlockIds.includes(block.id);
                  return (
                    <button
                      key={block.id}
                      onClick={() => toggleBlock(block.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${checked ? 'bg-black text-yellow-400' : 'bg-white text-black'}`}
                    >
                      <span className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${checked ? 'bg-yellow-400' : 'border-2 border-black/30'}`}>
                        {checked && <CheckCircle2 size={14} className="text-black" />}
                      </span>
                      <span className="flex-1 font-bold text-sm">Chapter {bi + 1}</span>
                      <span className={`text-xs font-bold ${checked ? 'text-yellow-400' : 'text-black/60'}`}>{scenes} scenes</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-black/60 text-xs font-bold mt-1.5">
                {allSelected ? 'All chapters selected — full story compilation' : `${selectedBlockIds.length} of ${publishableBlocks.length} selected`}
              </p>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="text-black text-xs uppercase tracking-wider font-bold block mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => { setTitle(e.target.value); setTitleEdited(true); }}
              placeholder="Story title"
              className="w-full bg-white rounded-2xl px-4 py-3 text-black font-bold focus:outline-none focus:ring-2 focus:ring-black/30"
            />
          </div>

          {/* Author */}
          <div>
            <label className="text-black text-xs uppercase tracking-wider font-bold block mb-1.5">Author</label>
            <input
              type="text"
              value={authorName}
              onChange={e => setAuthorName(e.target.value)}
              placeholder="Author name"
              className="w-full bg-white rounded-2xl px-4 py-3 text-black font-bold focus:outline-none focus:ring-2 focus:ring-black/30"
            />
          </div>

          {/* Class + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-black text-xs uppercase tracking-wider font-bold block mb-1.5">Class</label>
              <div className="relative">
                <select
                  value={dossierClass}
                  onChange={e => setDossierClass(e.target.value)}
                  className="w-full bg-white rounded-2xl px-4 py-3 text-black font-bold focus:outline-none focus:ring-2 focus:ring-black/30 appearance-none pr-9"
                >
                  {DOSSIER_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-black pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-black text-xs uppercase tracking-wider font-bold block mb-1.5">Category</label>
              <div className="relative">
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full bg-white rounded-2xl px-4 py-3 text-black font-bold focus:outline-none focus:ring-2 focus:ring-black/30 appearance-none pr-9"
                >
                  <option value="">{category || 'Select…'}</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-black pointer-events-none" />
              </div>
            </div>
          </div>
          {/* Custom category text input */}
          <input
            type="text"
            value={category}
            onChange={e => setCategory(e.target.value)}
            placeholder="…or type a custom category"
            className="w-full bg-white rounded-2xl px-4 py-2.5 text-black text-sm font-bold focus:outline-none focus:ring-2 focus:ring-black/30"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-black text-xs uppercase tracking-wider font-bold block mb-1.5">Content rating</label>
              <select
                value={contentRating}
                onChange={e => setContentRating(e.target.value)}
                className="w-full bg-white rounded-2xl px-4 py-3 text-black font-bold focus:outline-none focus:ring-2 focus:ring-black/30"
              >
                <option value="all">All audiences</option>
                <option value="13+">13+</option>
                <option value="18+">18+</option>
              </select>
            </div>
            <div>
              <label className="text-black text-xs uppercase tracking-wider font-bold block mb-1.5">Story language</label>
              <select
                value={originalLanguage}
                onChange={e => setOriginalLanguage(e.target.value)}
                className="w-full bg-white rounded-2xl px-4 py-3 text-black font-bold focus:outline-none focus:ring-2 focus:ring-black/30"
              >
                {STORY_LANGUAGES.map(language => (
                  <option key={language.value} value={language.value}>{language.label}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-start gap-3 bg-white rounded-2xl px-4 py-3 cursor-pointer">
            <input
              type="checkbox"
              checked={publicConfirmed}
              onChange={e => setPublicConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-black"
            />
            <span className="text-black text-xs font-bold">I confirm that this story may be published publicly in the AISTAGE.ONE Magazine.</span>
          </label>

          {/* Description */}
          <div>
            <label className="text-black text-xs uppercase tracking-wider font-bold block mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of your story"
              rows={4}
              className="w-full bg-white rounded-2xl px-4 py-3 text-black font-bold focus:outline-none focus:ring-2 focus:ring-black/30 resize-none"
            />
          </div>

          {/* Cover Image Picker */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-black text-xs uppercase tracking-wider font-bold">Cover Image</label>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 bg-black text-yellow-400 px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition-transform disabled:opacity-60"
              >
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                Upload
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadCover}
                className="hidden"
              />
            </div>
            {coverOptions.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-center">
                <ImageIcon size={28} className="text-black/40 mx-auto mb-2" />
                <p className="text-black text-xs font-bold">{noneSelected ? 'Select a chapter to see cover options' : 'No images available — upload one'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {coverOptions.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => setCoverImage(opt.url)}
                    className={`relative rounded-xl overflow-hidden aspect-[3/4] border-2 transition-all ${coverImage === opt.url ? 'border-black scale-[1.02]' : 'border-transparent opacity-70'}`}
                  >
                    <img src={opt.url} alt="" className="w-full h-full object-cover" />
                    {coverImage === opt.url && (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-black rounded-full flex items-center justify-center">
                        <CheckCircle2 size={12} className="text-yellow-400" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Publish button */}
          <button
            onClick={handlePublish}
            disabled={publishing || !title.trim() || noneSelected || !publicConfirmed}
            className="w-full py-4 bg-black text-yellow-400 font-bold rounded-3xl flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {publishing ? (
              <><Loader2 size={20} className="animate-spin" /> Publishing…</>
            ) : (
              <><Send size={20} /> {publishLabel}</>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
