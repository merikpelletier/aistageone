import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function MemberProfileEditor({ profile, user, onClose }) {
  const [formData, setFormData] = useState({
    display_name: profile?.display_name || '',
    bio: profile?.bio || '',
    title: profile?.title || '',
    links: profile?.links || [],
    avatar_url: profile?.avatar_url || '',
    images: profile?.images || [],
    custom_banner_url: profile?.custom_banner_url || '',
    custom_banner_link: profile?.custom_banner_link || '',
  });
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => { if (u?.role === 'admin') setIsAdmin(true); }).catch(() => {});
  }, []);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (profile?.id) {
        return base44.entities.MemberProfile.update(profile.id, data);
      } else {
        return base44.entities.MemberProfile.create({
          user_email: user.email,
          ...data,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberProfile'] });
      onClose();
    },
  });

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, avatar_url: result.file_url }));
    } catch (error) {
      alert('Error uploading avatar');
    } finally {
      setUploading(false);
    }
  };

  const handleImagesUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (formData.images.length + files.length > 6) {
      alert('Maximum 6 images');
      return;
    }

    setUploading(true);
    try {
      const uploadedUrls = await Promise.all(
        files.map(file => base44.integrations.Core.UploadFile({ file }).then(res => res.file_url))
      );
      setFormData(prev => ({ ...prev, images: [...prev.images, ...uploadedUrls] }));
    } catch (error) {
      alert('Error uploading images');
    } finally {
      setUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden mb-24"
      >
        {/* Fixed Actions Footer - AT TOP */}
        <div className="border-b border-gray-200 bg-white p-3 flex gap-2 flex-shrink-0 rounded-t-2xl">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 text-black py-3 rounded hover:bg-gray-300 transition-colors font-light text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate(formData)}
            disabled={saveMutation.isPending}
            className="flex-1 bg-red-600 text-white py-3 rounded hover:bg-red-700 transition-colors disabled:opacity-50 font-semibold text-sm"
          >
            {saveMutation.isPending ? 'Saving...' : 'SAVE'}
          </button>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-black text-lg font-semibold">Edit Profile</h2>
          <button onClick={onClose} className="text-white hover:text-black transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {/* Display Name */}
          <div>
            <label className="text-black font-semibold text-sm block mb-2">Display Name</label>
            <Input
              placeholder="Your display name"
              value={formData.display_name}
              onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
              className="bg-gray-50 border-2 border-gray-300 text-black placeholder:text-white text-base py-3"
            />
          </div>

          {/* Avatar */}
          <div>
            <label className="text-black font-semibold text-sm block mb-3">Avatar</label>
            {formData.avatar_url && (
              <img src={formData.avatar_url} alt="avatar" className="w-20 h-20 rounded-full mb-3 object-cover border-2 border-gray-300" />
            )}
            <label className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={uploading}
                className="hidden"
              />
              <span className="text-black">{uploading ? 'Uploading...' : '+ Upload Avatar'}</span>
            </label>
          </div>

          {/* Title */}
          <div>
            <label className="text-black font-semibold text-sm block mb-2">Title/Role</label>
            <Input
              placeholder="e.g., Designer, Photographer"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="bg-gray-50 border-2 border-gray-300 text-black placeholder:text-white text-base py-3"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="text-black font-semibold text-sm block mb-2">Bio</label>
            <Textarea
              placeholder="Tell us about yourself..."
              value={formData.bio}
              onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
              className="bg-gray-50 border-2 border-gray-300 text-black placeholder:text-white text-base py-3"
              rows={4}
            />
          </div>

          {/* Gallery Images */}
          <div>
            <label className="text-black font-semibold text-sm block mb-3">Gallery Images ({formData.images.length}/6)</label>
            {formData.images.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {formData.images.map((img, idx) => (
                  <div key={idx} className="relative group">
                    <img src={img} alt={`img-${idx}`} className="w-full h-24 object-cover rounded border border-gray-300" />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        images: prev.images.filter((_, i) => i !== idx)
                      }))}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded"
                    >
                      <Trash2 size={18} className="text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {formData.images.length < 6 && (
              <label className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImagesUpload}
                  disabled={uploading}
                  className="hidden"
                />
                <span className="text-black">{uploading ? 'Uploading...' : 'Add Images'}</span>
              </label>
            )}
          </div>

          {/* Custom Banner (admin only) */}
          {isAdmin && (
            <div className="border-2 border-red-200 rounded-lg p-3 bg-red-50">
              <label className="text-red-700 font-semibold text-sm block mb-2">🔒 Admin — Custom Banner</label>
              {formData.custom_banner_url && (
                <img src={formData.custom_banner_url} alt="banner preview" className="w-full h-16 object-cover rounded mb-2" />
              )}
              <label className="flex items-center justify-center border-2 border-dashed border-red-300 rounded-lg p-3 cursor-pointer hover:bg-red-100 transition-colors mb-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    const result = await base44.integrations.Core.UploadFile({ file });
                    setFormData(prev => ({ ...prev, custom_banner_url: result.file_url }));
                    setUploading(false);
                  }}
                  disabled={uploading}
                  className="hidden"
                />
                <span className="text-red-600 text-sm">{uploading ? 'Uploading...' : '+ Upload Banner Image'}</span>
              </label>
              <Input
                placeholder="Or paste banner image URL"
                value={formData.custom_banner_url}
                onChange={(e) => setFormData(prev => ({ ...prev, custom_banner_url: e.target.value }))}
                className="bg-white border border-red-300 text-black text-sm mb-2"
              />
              <Input
                placeholder="Banner click URL (optional)"
                value={formData.custom_banner_link}
                onChange={(e) => setFormData(prev => ({ ...prev, custom_banner_link: e.target.value }))}
                className="bg-white border border-red-300 text-black text-sm"
              />
              {formData.custom_banner_url && (
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, custom_banner_url: '', custom_banner_link: '' }))}
                  className="mt-2 text-xs text-red-500 hover:text-red-700"
                >
                  Remove custom banner
                </button>
              )}
            </div>
          )}

          {/* Links */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-black font-semibold text-sm">Links</label>
              <button
                type="button"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  links: [...prev.links, { url: '', label: '' }]
                }))}
                className="flex items-center gap-1 text-white hover:text-black text-xs transition-colors"
              >
                <Plus size={14} />
                Add Link
              </button>
            </div>
            <div className="space-y-2">
              {formData.links.map((link, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    placeholder="Link label (e.g., Instagram)"
                    value={link.label}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      links: prev.links.map((l, i) => i === idx ? { ...l, label: e.target.value } : l)
                    }))}
                    className="flex-1 bg-gray-50 border border-gray-300 text-black placeholder:text-white text-sm"
                  />
                  <Input
                    placeholder="URL (https://...)"
                    value={link.url}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      links: prev.links.map((l, i) => i === idx ? { ...l, url: e.target.value } : l)
                    }))}
                    className="flex-1 bg-gray-50 border border-gray-300 text-black placeholder:text-white text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      links: prev.links.filter((_, i) => i !== idx)
                    }))}
                    className="text-red-600 hover:text-red-700 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
          </div>
          </motion.div>
          </motion.div>
          );
          }