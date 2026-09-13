import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Eye, EyeOff, Layers, Upload, ChevronDown, ChevronRight } from 'lucide-react';
import AdminDossierCategories from './AdminDossierCategories';
import AdminEpisodeProduction from './AdminEpisodeProduction';
import SeriesPageEditor from './SeriesPageEditor';

function DossierPagesIndex({ pages, onManage }) {
  const sorted = [...pages].sort((a, b) => a.order - b.order);
  return (
    <div className="mt-3 pt-3 border-t border-white/10">
      {sorted.length === 0 ? (
        <p className="text-white text-xs px-1">No pages yet</p>
      ) : (
        <div className="flex flex-col gap-1">
          {sorted.map((page) => (
            <button
              key={page.id}
              onClick={onManage}
              className="flex items-center gap-2 text-left px-2 py-1.5 rounded hover:bg-white/5 transition-colors group"
            >
              <span className="text-white text-xs w-5 text-right">{page.order}</span>
              <span className="text-xs">{PAGE_TYPE_ICONS[page.page_type] || '📄'}</span>
              <span className="text-white text-xs group-hover:text-white/90 transition-colors">
                {page.episode_title || page.title || page.page_type}
              </span>
              <span className="text-white/20 text-xs ml-auto">{page.page_type}</span>
            </button>
          ))}
        </div>
      )}
      <button
        onClick={onManage}
        className="mt-2 text-xs text-white hover:text-white transition-colors flex items-center gap-1"
      >
        <Plus size={11} /> Add / manage pages
      </button>
    </div>
  );
}

const PAGE_TYPE_ICONS = {
  cover: '🖼️', text: '📝', image: '🎨', video: '🎬', mixed: '🗂️',
  join_cast: '🎭', episode: '🎬', series: '📺', member_episodes: '🌟', block_player: '▶',
};

export default function AdminDossiers() {
  const [editingDossier, setEditingDossier] = useState(null);
  const [showPageEditor, setShowPageEditor] = useState(null);
  const [subTab, setSubTab] = useState('list'); // 'list' | 'categories'
  const [expandedDossiers, setExpandedDossiers] = useState({});

  const toggleExpand = (id) => setExpandedDossiers(prev => ({ ...prev, [id]: !prev[id] }));
  const queryClient = useQueryClient();

  const { data: dossiers = [] } = useQuery({
    queryKey: ['adminDossiers'],
    queryFn: () => base44.entities.Dossier.list('order'),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['dossierCategories'],
    queryFn: () => base44.entities.DossierCategory.list('name'),
  });

  const { data: allPages = [] } = useQuery({
    queryKey: ['adminDossierPages'],
    queryFn: () => base44.entities.DossierPage.list('order'),
  });

  const createDossierMutation = useMutation({
    mutationFn: (data) => base44.entities.Dossier.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDossiers'] });
      setEditingDossier(null);
    }
  });

  const updateDossierMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Dossier.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDossiers'] });
      setEditingDossier(null);
    }
  });

  const deleteDossierMutation = useMutation({
    mutationFn: (id) => base44.entities.Dossier.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminDossiers'] })
  });

  const handleSaveDossier = () => {
    if (editingDossier.id) {
      updateDossierMutation.mutate({ id: editingDossier.id, data: editingDossier });
    } else {
      createDossierMutation.mutate(editingDossier);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setEditingDossier({ ...editingDossier, cover_image: file_url });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button onClick={() => setSubTab('list')} className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${subTab === 'list' ? 'bg-white text-black font-medium' : 'text-white hover:text-white hover:bg-white/10'}`}>Dossiers</button>
          <button onClick={() => setSubTab('categories')} className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${subTab === 'categories' ? 'bg-white text-black font-medium' : 'text-white hover:text-white hover:bg-white/10'}`}>Categories</button>
        </div>
        {subTab === 'list' && (
          <Button
            onClick={() => setEditingDossier({ title: '', subtitle: '', status: 'draft', order: dossiers.length + 1 })}
            className="bg-white text-black hover:bg-white/90"
          >
            <Plus size={16} className="mr-2" />
            New
          </Button>
        )}
      </div>

      {subTab === 'categories' && <AdminDossierCategories />}

      {/* Dossier List */}
      {subTab === 'list' && (
        <div className="space-y-3">
        {dossiers.map((dossier) => (
          <div
            key={dossier.id}
            className="bg-neutral-950 border border-white/10 rounded-sm p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const newOrder = Math.max(1, dossier.order - 1);
                      updateDossierMutation.mutate({ id: dossier.id, data: { ...dossier, order: newOrder } });
                    }}
                    className="h-6 w-6 text-white hover:text-white"
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      updateDossierMutation.mutate({ id: dossier.id, data: { ...dossier, order: dossier.order + 1 } });
                    }}
                    className="h-6 w-6 text-white hover:text-white"
                  >
                    ↓
                  </Button>
                </div>
                {dossier.cover_image && (
                  <img
                    src={dossier.cover_image}
                    alt=""
                    className="w-20 h-14 object-cover rounded-sm"
                  />
                )}
                <div>
                  <h3 className="text-white font-light">{dossier.title}</h3>
                  {dossier.subtitle && (
                    <p className="text-white text-sm">{dossier.subtitle}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      dossier.status === 'published' 
                        ? 'bg-green-900/50 text-green-400' 
                        : dossier.status === 'unpublished'
                        ? 'bg-red-900/50 text-red-400'
                        : 'bg-yellow-900/50 text-yellow-400'
                    }`}>
                      {dossier.status}
                    </span>

                    {dossier.category && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white">
                        {dossier.category}
                      </span>
                    )}
                    <button
                      onClick={() => toggleExpand(dossier.id)}
                      className="text-white text-xs hover:text-white flex items-center gap-1 transition-colors"
                    >
                      {expandedDossiers[dossier.id] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      {allPages.filter(p => p.dossier_id === dossier.id).length} pages
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPageEditor(dossier)}
                  className="text-white hover:text-white"
                >
                  <Layers size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditingDossier(dossier)}
                  className="text-white hover:text-white"
                >
                  <Edit2 size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteDossierMutation.mutate(dossier.id)}
                  className="text-white hover:text-red-500"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
            {/* Pages index */}
            {expandedDossiers[dossier.id] && (
              <DossierPagesIndex
                pages={allPages.filter(p => p.dossier_id === dossier.id)}
                onManage={() => setShowPageEditor(dossier)}
              />
            )}
          </div>
        ))}
        </div>
      )}

      {/* Edit Dossier Dialog */}
      <Dialog open={!!editingDossier} onOpenChange={() => setEditingDossier(null)}>
        <DialogContent className="bg-neutral-950 border-white/10 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-light tracking-wide">
              {editingDossier?.id ? 'Edit' : 'New'} Dossier
            </DialogTitle>
          </DialogHeader>
          {editingDossier && (
            <div className="space-y-4 mt-4">
              <Input
                value={editingDossier.title}
                onChange={(e) => setEditingDossier({ ...editingDossier, title: e.target.value })}
                placeholder="Title"
                className="bg-neutral-900 border-white/10 text-white"
              />
              <Input
                value={editingDossier.subtitle || ''}
                onChange={(e) => setEditingDossier({ ...editingDossier, subtitle: e.target.value })}
                placeholder="Subtitle"
                className="bg-neutral-900 border-white/10 text-white"
              />
              <Input
                value={editingDossier.author_name || ''}
                onChange={(e) => setEditingDossier({ ...editingDossier, author_name: e.target.value })}
                placeholder="Author"
                className="bg-neutral-900 border-white/10 text-white"
              />
              <Select
                value={editingDossier.category || ''}
                onValueChange={(value) => setEditingDossier({ ...editingDossier, category: value === '__none__' ? '' : value })}
              >
                <SelectTrigger className="bg-neutral-900 border-white/10 text-white">
                  <SelectValue placeholder="Select a category..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— No category —</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div>
                <label className="block text-white text-sm mb-2">Class</label>
                <Select
                  value={editingDossier.class || '__none__'}
                  onValueChange={(value) => setEditingDossier({ ...editingDossier, class: value === '__none__' ? '' : value })}
                >
                  <SelectTrigger className="bg-neutral-900 border-white/10 text-white">
                    <SelectValue placeholder="Select a class..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— No class —</SelectItem>
                    <SelectItem value="Videos">Videos</SelectItem>
                    <SelectItem value="Story">Story</SelectItem>
                    <SelectItem value="Assets">Assets</SelectItem>
                    <SelectItem value="Kits">Kits</SelectItem>
                    <SelectItem value="Merchandise">Merchandise</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingDossier.hide_text_on_cover || false}
                    onChange={(e) => setEditingDossier({ ...editingDossier, hide_text_on_cover: e.target.checked })}
                    className="w-5 h-5 accent-white cursor-pointer"
                  />
                  <span className="text-white text-sm">Hide title on cover</span>
                </label>
              </div>
              <div>
                <label className="block text-white text-sm mb-2">Cover</label>
                {editingDossier.cover_image && (
                  <img src={editingDossier.cover_image} alt="" className="w-full h-32 object-cover rounded-sm mb-2" />
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                  className="hidden" 
                  id="dossier-image-upload"
                />
                <label htmlFor="dossier-image-upload">
                 <Button type="button" className="w-full bg-neutral-800 border border-white/20 text-white hover:bg-neutral-700 mb-2" asChild>
                   <span>
                     <Upload size={16} className="mr-2" />
                     Choose an image
                   </span>
                 </Button>
                </label>
                <Input
                  value={editingDossier.cover_image || ''}
                  onChange={(e) => setEditingDossier({ ...editingDossier, cover_image: e.target.value })}
                  placeholder="Or paste an image URL"
                  className="bg-neutral-900 border-white/10 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-white text-sm mb-2">🖥️ Landscape Cover <span className="text-white text-xs">(optional, uses portrait if empty)</span></label>
                {editingDossier.cover_image_landscape && (
                  <img src={editingDossier.cover_image_landscape} alt="" className="w-full h-32 object-cover rounded-sm mb-2" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const { file_url } = await base44.integrations.Core.UploadFile({ file });
                    setEditingDossier({ ...editingDossier, cover_image_landscape: file_url });
                  }}
                  className="hidden"
                  id="dossier-image-landscape-upload"
                />
                <label htmlFor="dossier-image-landscape-upload">
                  <Button type="button" className="w-full bg-neutral-800 border border-white/20 text-white hover:bg-neutral-700 mb-2" asChild>
                    <span>
                      <Upload size={16} className="mr-2" />
                      Choose a landscape image
                    </span>
                  </Button>
                </label>
                <Input
                  value={editingDossier.cover_image_landscape || ''}
                  onChange={(e) => setEditingDossier({ ...editingDossier, cover_image_landscape: e.target.value })}
                  placeholder="Or paste a URL"
                  className="bg-neutral-900 border-white/10 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-white text-sm mb-2">Portrait cover video (optional)</label>
                <Input
                  value={editingDossier.cover_video || ''}
                  onChange={(e) => setEditingDossier({ ...editingDossier, cover_video: e.target.value })}
                  placeholder="Portrait video URL"
                  className="bg-neutral-900 border-white/10 text-white"
                />
              </div>
              <div>
                <label className="block text-white text-sm mb-2">Landscape cover video (optional)</label>
                <Input
                  value={editingDossier.cover_video_landscape || ''}
                  onChange={(e) => setEditingDossier({ ...editingDossier, cover_video_landscape: e.target.value })}
                  placeholder="Landscape video URL"
                  className="bg-neutral-900 border-white/10 text-white"
                />
              </div>
              <Select
                value={editingDossier.status}
                onValueChange={(value) => setEditingDossier({ ...editingDossier, status: value })}
              >
                <SelectTrigger className="bg-neutral-900 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="unpublished">Unpublished</SelectItem>
                </SelectContent>
              </Select>
              <div>
                <label className="block text-white text-sm mb-2">Display Order (Position)</label>
                <div className="flex items-end gap-2">
                  <Input
                    type="number"
                    value={editingDossier.order}
                    onChange={(e) => setEditingDossier({ ...editingDossier, order: parseInt(e.target.value) })}
                    placeholder="Position number..."
                    className="bg-neutral-900 border-white/10 text-white flex-1"
                  />
                  <Button
                    type="button"
                    onClick={() => setEditingDossier({ ...editingDossier, order: Math.max(1, editingDossier.order - 1) })}
                    className="bg-neutral-800 border border-white/20 text-white hover:bg-neutral-700 px-3"
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setEditingDossier({ ...editingDossier, order: editingDossier.order + 1 })}
                    className="bg-neutral-800 border border-white/20 text-white hover:bg-neutral-700 px-3"
                  >
                    ↓
                  </Button>
                </div>
                <p className="text-white text-xs mt-1.5">Lower = appears first</p>
              </div>
              <Button
                onClick={handleSaveDossier}
                className="w-full bg-white text-black hover:bg-white/90"
              >
                Save
              </Button>

              {editingDossier?.id && (
                <Button
                  type="button"
                  className="w-full bg-neutral-800 border border-white/20 text-white hover:bg-neutral-700"
                  onClick={() => {
                    setShowPageEditor(editingDossier);
                    setEditingDossier(null);
                  }}
                >
                  <Layers size={16} className="mr-2" />
                  Manage pages (portrait &amp; landscape)
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Page Editor Dialog */}
      {showPageEditor && (
        <PageEditor
          dossier={showPageEditor}
          pages={allPages.filter(p => p.dossier_id === showPageEditor.id)}
          onClose={() => setShowPageEditor(null)}
        />
      )}
    </div>
  );
}

function PageEditor({ dossier, pages, onClose }) {
  const [editingPage, setEditingPage] = useState(null);
  const queryClient = useQueryClient();

  const createPageMutation = useMutation({
    mutationFn: (data) => base44.entities.DossierPage.create(data),
    onSuccess: async (newPage) => {
      // If this is an episode page, auto-append it to the join_cast page's cast_episodes
      if (newPage.page_type === 'episode') {
        const joinCastPage = pages.find(p => p.page_type === 'join_cast');
        if (joinCastPage) {
          const newEpisode = {
            episode_title: newPage.episode_title || newPage.title || '',
            episode_description: newPage.episode_description || newPage.content || '',
            role: newPage.episode_role || '',
            tools_hint: newPage.episode_tools_hint || ''
          };
          const updatedEpisodes = [...(joinCastPage.cast_episodes || []), newEpisode];
          await base44.entities.DossierPage.update(joinCastPage.id, { cast_episodes: updatedEpisodes });
        }
      }
      queryClient.invalidateQueries({ queryKey: ['adminDossierPages'] });
      setEditingPage(null);
    }
  });

  const updatePageMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DossierPage.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminDossierPages'] });
    }
  });

  const deletePageMutation = useMutation({
    mutationFn: (id) => base44.entities.DossierPage.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminDossierPages'] })
  });

  // Sync series characters into episode productions when a series or episode page is saved.
  const syncPages = async (savedPage, allSiblings) => {
    const promises = [];

    const toEpChar = (sc, existingMap) => ({
      id: existingMap[sc.name]?.id || `char_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: sc.name,
      description: sc.description || existingMap[sc.name]?.description || '',
      photo_url: sc.photo_url || existingMap[sc.name]?.photo_url || '',
      character_type: sc.character_type || existingMap[sc.name]?.character_type || '',
      participation_methods: existingMap[sc.name]?.participation_methods || [],
      reference_images: existingMap[sc.name]?.reference_images || [],
    });

    if (savedPage.page_type === 'series') {
      const sourceChars = (savedPage.series_characters || []).filter(c => c.name);
      const episodePages = allSiblings.filter(p => p.page_type === 'episode');
      for (const ep of episodePages) {
        const prods = await base44.entities.EpisodeProduction.filter({ episode_page_id: ep.id });
        if (!prods.length) continue;
        const prod = prods[0];
        const existingMap = Object.fromEntries((prod.characters || []).map(c => [c.name, c]));
        promises.push(base44.entities.EpisodeProduction.update(prod.id, { characters: sourceChars.map(sc => toEpChar(sc, existingMap)) }));
      }
    } else if (savedPage.page_type === 'episode') {
      const seriesPage = allSiblings.find(p => p.page_type === 'series');
      if (!seriesPage) return;
      const sourceChars = seriesPage.series_characters || [];
      const prods = await base44.entities.EpisodeProduction.filter({ episode_page_id: savedPage.id });
      if (prods.length) {
        const prod = prods[0];
        const existingMap = Object.fromEntries((prod.characters || []).map(c => [c.name, c]));
        promises.push(base44.entities.EpisodeProduction.update(prod.id, { characters: sourceChars.map(sc => toEpChar(sc, existingMap)) }));
      }
    }

    await Promise.all(promises);
    queryClient.invalidateQueries({ queryKey: ['adminDossierPages'] });
  };

  const handleSavePage = async () => {
    if (editingPage.id) {
      await updatePageMutation.mutateAsync({ id: editingPage.id, data: editingPage });
      await queryClient.invalidateQueries({ queryKey: ['adminDossierPages'] });
      // Auto-sync on every save of series, kit, or episode pages
      // Use editingPage as the authoritative data (replaces stale pages[] entry)
      if (['series', 'episode'].includes(editingPage.page_type)) {
        const pagesWithCurrent = pages.map(p => p.id === editingPage.id ? editingPage : p);
        await syncPages(editingPage, pagesWithCurrent);
      }
      setEditingPage(null);
    } else {
      await createPageMutation.mutateAsync({ ...editingPage, dossier_id: dossier.id });
    }
  };

  const handleMediaUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setEditingPage({ ...editingPage, media_url: file_url });
  };

  const sortedPages = [...pages].sort((a, b) => a.order - b.order);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-neutral-950 border-white/10 text-white max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-light tracking-wide">
            Pages: {dossier.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Page List */}
          <div>
            <h3 className="text-white text-sm mb-3">Pages ({sortedPages.length})</h3>
            {sortedPages.length === 0 ? (
              <div className="text-center py-8 bg-neutral-900/50 rounded-sm border border-white/5">
                <p className="text-white text-sm">No pages created</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedPages.map((page) => (
                  <div
                    key={page.id}
                    className={`flex items-center justify-between p-3 rounded-sm ${page.is_locked ? 'bg-red-900/20 border border-red-600/30' : page.is_hidden_from_public ? 'bg-orange-900/20 border border-orange-600/30' : 'bg-neutral-900'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-white text-sm w-6">{page.order}</span>
                      {page.media_url && (
                        <img src={page.media_url} alt="" className="w-12 h-8 object-cover rounded-sm" />
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm">{page.page_type}</span>
                        {page.title && <span className="text-white text-sm ml-2">- {page.title}</span>}
                        {page.is_locked && (
                          <span className="text-red-400 text-xs flex items-center gap-1">
                            🔒 Locked
                          </span>
                        )}
                        {page.is_hidden_from_public && !page.is_locked && (
                          <span className="text-orange-400 text-xs flex items-center gap-1">
                            👁️ Hidden
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setEditingPage(page)} className="h-8 w-8 text-white">
                        <Edit2 size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deletePageMutation.mutate(page.id)} className="h-8 w-8 text-white hover:text-red-500">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            onClick={() => setEditingPage({ page_type: 'text', order: sortedPages.length + 1, text_position: 'center', text_color: 'white' })}
            className="w-full bg-neutral-800 border border-white/20 text-white hover:bg-neutral-700"
          >
            <Plus size={16} className="mr-2" />
            Add a page
          </Button>
        </div>

        {/* Page Edit Form */}
        {editingPage && (
          <div className="mt-6 pt-6 border-t border-white/10 space-y-4">
            <h3 className="text-white text-base font-light">
              {editingPage.id ? 'Edit' : 'New'} Page
            </h3>
            
            <div>
              <label className="text-white text-sm block mb-2">Page type</label>
              <Select
                value={editingPage.page_type}
                onValueChange={(value) => setEditingPage(prev => ({ ...prev, page_type: value }))}
              >
                <SelectTrigger className="bg-neutral-900 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cover">Cover</SelectItem>
                  <SelectItem value="text">Text only</SelectItem>
                  <SelectItem value="image">Image only</SelectItem>
                  <SelectItem value="video">Video only</SelectItem>
                  <SelectItem value="mixed">Text + Image/Video</SelectItem>
                  <SelectItem value="join_cast">🎬 Join the Cast</SelectItem>
                  <SelectItem value="episode">🎭 Episode</SelectItem>
                  <SelectItem value="series">📺 Series</SelectItem>
                  <SelectItem value="member_episodes">🌟 Member Episodes</SelectItem>
                  <SelectItem value="block_player">▶ Block Player</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Join the Cast: episode list preview */}
            {editingPage.page_type === 'join_cast' && (
              <div className="p-3 bg-neutral-800/50 border border-white/10 rounded space-y-2">
                <p className="text-white text-sm font-medium">🎭 Episodes in this cast page</p>
                {(editingPage.cast_episodes || []).length === 0 ? (
                  <p className="text-white text-xs">No episodes yet — create Episode pages and they'll appear here automatically.</p>
                ) : (
                  <div className="space-y-2">
                    {(editingPage.cast_episodes || []).map((ep, idx) => (
                      <div key={idx} className="flex items-start justify-between p-2 bg-neutral-900 rounded text-sm">
                        <div>
                          <p className="text-white font-medium">{ep.episode_title || '(untitled)'}</p>
                          {ep.role && <p className="text-white text-xs">Role: {ep.role}</p>}
                          {ep.episode_description && <p className="text-white text-xs mt-0.5 line-clamp-1">{ep.episode_description}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (editingPage.cast_episodes || []).filter((_, i) => i !== idx);
                            setEditingPage({ ...editingPage, cast_episodes: updated });
                          }}
                          className="text-white hover:text-red-500 ml-3 mt-0.5"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Series fields */}
            {editingPage.page_type === 'series' && (
              <div className="p-3 bg-neutral-800/50 border border-white/10 rounded">
                <p className="text-white text-sm font-medium mb-3">📺 Series content</p>
                <SeriesPageEditor page={editingPage} onChange={setEditingPage} />
              </div>
            )}

            {/* Block Player fields */}
            {editingPage.page_type === 'block_player' && (
              <div className="space-y-3">
                <div className="p-3 bg-neutral-800/50 border border-white/10 rounded">
                  <p className="text-white text-sm font-medium mb-2">▶ Block Player Configuration</p>
                  <p className="text-white text-xs mb-3">Select which episode's blocks to play in this page.</p>
                  <label className="text-white text-sm block mb-2">Episode</label>
                  <Select
                    value={editingPage.block_player_episode_page_id || ''}
                    onValueChange={(value) => setEditingPage({ ...editingPage, block_player_episode_page_id: value })}
                  >
                    <SelectTrigger className="bg-neutral-900 border-white/10 text-white">
                      <SelectValue placeholder="Select an episode..." />
                    </SelectTrigger>
                    <SelectContent>
                      {pages.filter(p => p.page_type === 'episode').length === 0 ? (
                        <SelectItem value={null} disabled>No episodes available</SelectItem>
                      ) : (
                        pages.filter(p => p.page_type === 'episode').map(ep => (
                          <SelectItem key={ep.id} value={ep.id}>{ep.episode_title || ep.title || 'Untitled Episode'}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Episode fields */}
            {editingPage.page_type === 'episode' && (
              <div className="space-y-3">
                {/* Lock Control - Admin Only */}
                <div className="flex items-center justify-between p-3 bg-red-900/20 border border-red-600/30 rounded">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="episode-locked"
                      checked={editingPage.is_locked || false}
                      onChange={(e) => setEditingPage({ ...editingPage, is_locked: e.target.checked })}
                      className="w-4 h-4 accent-red-500"
                    />
                    <label htmlFor="episode-locked" className="text-red-300 text-sm font-medium">🔒 Lock Episode</label>
                  </div>
                  <span className="text-red-400/60 text-xs">
                    {editingPage.is_locked ? 'Members cannot create scenes' : 'Members can create scenes'}
                  </span>
                </div>

                {/* Hide from Public - Admin Only */}
                <div className="flex items-center justify-between p-3 bg-orange-900/20 border border-orange-600/30 rounded">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="episode-hidden"
                      checked={editingPage.is_hidden_from_public || false}
                      onChange={(e) => setEditingPage({ ...editingPage, is_hidden_from_public: e.target.checked })}
                      className="w-4 h-4 accent-orange-500"
                    />
                    <label htmlFor="episode-hidden" className="text-orange-300 text-sm font-medium">👁️ Hide from Public</label>
                  </div>
                  <span className="text-orange-400/60 text-xs">
                    {editingPage.is_hidden_from_public ? 'Hidden from dossier' : 'Visible in dossier'}
                  </span>
                </div>

                <div className="p-3 bg-neutral-800/50 border border-white/10 rounded space-y-3">
                  <p className="text-white text-sm font-medium">🎭 Episode details</p>
                  <Input
                    value={editingPage.episode_title || ''}
                    onChange={(e) => setEditingPage({ ...editingPage, episode_title: e.target.value })}
                    placeholder="Episode title"
                    className="bg-neutral-900 border-white/10 text-white"
                  />
                  <Textarea
                    value={editingPage.episode_description || ''}
                    onChange={(e) => setEditingPage({ ...editingPage, episode_description: e.target.value })}
                    placeholder="Episode description / brief"
                    className="bg-neutral-900 border-white/10 text-white"
                    rows={3}
                  />
                  <Input
                    value={editingPage.episode_role || ''}
                    onChange={(e) => setEditingPage({ ...editingPage, episode_role: e.target.value })}
                    placeholder="Role / character available"
                    className="bg-neutral-900 border-white/10 text-white"
                  />
                  <Input
                    value={editingPage.episode_tools_hint || ''}
                    onChange={(e) => setEditingPage({ ...editingPage, episode_tools_hint: e.target.value })}
                    placeholder="Suggested AI tools (e.g. image, video)"
                    className="bg-neutral-900 border-white/10 text-white"
                  />
                </div>

                {/* Production Room Setup — only available after the page is saved */}
                {editingPage.id ? (
                  <div className="p-3 bg-neutral-900 border border-red-600/30 rounded space-y-3">
                    <p className="text-red-400 text-sm font-medium">🎬 Production Room Setup</p>
                    <p className="text-white text-xs">Configure characters, tools, and workflow instructions for this episode's Production Room.</p>
                    <AdminEpisodeProduction episodePage={{ ...editingPage, dossier_id: editingPage.dossier_id || dossier.id }} dossier={dossier} />
                  </div>
                ) : (
                  <p className="text-white text-xs px-1">💡 Save this page first to configure the Production Room setup.</p>
                )}
              </div>
            )}

            {editingPage.page_type !== 'join_cast' && editingPage.page_type !== 'episode' && editingPage.page_type !== 'series' && (
              <div className="p-3 bg-neutral-800/50 border border-white/10 rounded">
                <label className="text-white text-sm font-medium block mb-2">🖼️ Image layout <span className="text-white font-normal">(for Text + Image pages)</span></label>
                <Select
                  value={editingPage.image_layout || 'background'}
                  onValueChange={(value) => setEditingPage(prev => ({ ...prev, image_layout: value }))}
                >
                  <SelectTrigger className="bg-neutral-900 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="background">Image as background (behind text)</SelectItem>
                    <SelectItem value="above">Image above text</SelectItem>
                    <SelectItem value="below">Image below text</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Hide from Public toggle for non-episode pages */}
            {editingPage.page_type !== 'episode' && (
              <div className="flex items-center justify-between p-3 bg-orange-900/20 border border-orange-600/30 rounded">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="page-hidden"
                    checked={editingPage.is_hidden_from_public || false}
                    onChange={(e) => setEditingPage({ ...editingPage, is_hidden_from_public: e.target.checked })}
                    className="w-4 h-4 accent-orange-500"
                  />
                  <label htmlFor="page-hidden" className="text-orange-300 text-sm font-medium">👁️ Hide from Public</label>
                </div>
                <span className="text-orange-400/60 text-xs">
                  {editingPage.is_hidden_from_public ? 'Hidden from dossier' : 'Visible in dossier'}
                </span>
              </div>
            )}

            {editingPage.page_type !== 'join_cast' && (
              <div>
                <label className="text-white text-sm block mb-2">Title (optional)</label>
                <Input
                  value={editingPage.title || ''}
                  onChange={(e) => setEditingPage({ ...editingPage, title: e.target.value })}
                  placeholder="Page title..."
                  className="bg-neutral-900 border-white/10 text-white"
                />
              </div>
            )}

            {editingPage.page_type !== 'join_cast' && editingPage.page_type !== 'episode' && editingPage.page_type !== 'series' && (
              <div>
                <label className="text-white text-sm block mb-2">Text</label>
                <Textarea
                  value={editingPage.content || ''}
                  onChange={(e) => setEditingPage({ ...editingPage, content: e.target.value })}
                  placeholder="Page text content..."
                  className="bg-neutral-900 border-white/10 text-white min-h-[400px] text-base"
                  rows={20}
                />
              </div>
            )}

            {/* Product Configuration */}
            {editingPage.page_type !== 'join_cast' && editingPage.page_type !== 'episode' && editingPage.page_type !== 'series' && <><div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="page-is-product"
                checked={editingPage.is_product || false}
                onChange={(e) => setEditingPage({ ...editingPage, is_product: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="page-is-product" className="text-white text-sm">This page is a product</label>
            </div>
            
            {editingPage.is_product && (
              <>
                <Input
                  value={editingPage.price || ''}
                  onChange={(e) => setEditingPage({ ...editingPage, price: e.target.value })}
                  placeholder="Price (e.g. $25)"
                  className="bg-white text-black border-white font-medium placeholder:text-black"
                />
                
                {/* Product Gallery */}
                <div className="space-y-2">
                  <label className="text-white text-sm">Product gallery (max 12 images)</label>
                  <div className="grid grid-cols-4 gap-2">
                    {(editingPage.images || []).map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img src={img} alt="" className="w-full h-20 object-cover rounded" />
                        <button
                          type="button"
                          onClick={() => {
                            const newImages = editingPage.images.filter((_, i) => i !== idx);
                            setEditingPage({ ...editingPage, images: newImages });
                          }}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  {(!editingPage.images || editingPage.images.length < 12) && (
                    <>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const { file_url } = await base44.integrations.Core.UploadFile({ file });
                          const newImages = [...(editingPage.images || []), file_url];
                          setEditingPage({ ...editingPage, images: newImages });
                        }} 
                        className="hidden" 
                        id="gallery-image-upload"
                      />
                      <label htmlFor="gallery-image-upload">
                        <Button type="button" className="w-full bg-neutral-800 border border-white/20 text-white hover:bg-neutral-700" asChild>
                          <span>
                            <Upload size={14} className="mr-2" />
                            Add an image ({(editingPage.images || []).length}/12)
                          </span>
                        </Button>
                      </label>
                    </>
                  )}
                </div>
                
                {/* Product Options */}
                <div className="space-y-3 pt-2">
                  <label className="text-white text-sm">Product options (size, color...)</label>
                  {(editingPage.product_options || []).map((option, optIdx) => (
                    <div key={optIdx} className="p-3 bg-neutral-900/50 rounded border border-white/10 space-y-2">
                      <div className="flex gap-2">
                        <Input
                          value={option.name}
                          onChange={(e) => {
                            const newOptions = [...(editingPage.product_options || [])];
                            newOptions[optIdx].name = e.target.value;
                            setEditingPage({ ...editingPage, product_options: newOptions });
                          }}
                          placeholder="Name (e.g. Size, Color)"
                          className="bg-neutral-900 border-white/10 text-white flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const newOptions = editingPage.product_options.filter((_, i) => i !== optIdx);
                            setEditingPage({ ...editingPage, product_options: newOptions });
                          }}
                          className="text-white hover:text-red-500"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-white text-xs">Values:</label>
                        {(option.values || []).map((value, valIdx) => (
                          <div key={valIdx} className="flex gap-2">
                            <Input
                              value={value}
                              onChange={(e) => {
                                const newOptions = [...(editingPage.product_options || [])];
                                newOptions[optIdx].values[valIdx] = e.target.value;
                                setEditingPage({ ...editingPage, product_options: newOptions });
                              }}
                              placeholder="Value"
                              className="bg-neutral-900 border-white/10 text-white text-sm flex-1"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const newOptions = [...(editingPage.product_options || [])];
                                newOptions[optIdx].values = newOptions[optIdx].values.filter((_, i) => i !== valIdx);
                                setEditingPage({ ...editingPage, product_options: newOptions });
                              }}
                              className="h-9 w-9 text-white hover:text-red-500"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            const newOptions = [...(editingPage.product_options || [])];
                            if (!newOptions[optIdx].values) newOptions[optIdx].values = [];
                            newOptions[optIdx].values.push('');
                            setEditingPage({ ...editingPage, product_options: newOptions });
                          }}
                          className="w-full bg-neutral-600 border border-white/30 text-white hover:bg-neutral-500 h-8 text-xs"
                        >
                          <Plus size={12} className="mr-1" />
                          Add a value
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const newOptions = [...(editingPage.product_options || []), { name: '', values: [] }];
                      setEditingPage({ ...editingPage, product_options: newOptions });
                    }}
                    className="w-full bg-neutral-800 border border-white/20 text-white hover:bg-neutral-700"
                  >
                    <Plus size={14} className="mr-2" />
                    Add an option
                  </Button>
                </div>
              </>
            )}
            </>}

            {/* Portrait & Landscape media */}
            {editingPage.page_type !== 'join_cast' && (
              <>
                <div>
                  <label className="text-white text-sm block mb-2">📱 Image / Video — Portrait</label>
                  {editingPage.media_url && (
                    <div className="mb-2">
                      {editingPage.media_url.match(/\.(mp4|webm|ogg)$/i) ? (
                        <><video src={editingPage.media_url} controls allowFullScreen playsInline className="w-full h-32 rounded-sm" />
                        <a href={editingPage.media_url} target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-neutral-700 text-white text-xs py-1.5 rounded mt-1">
                          ⛶ Open fullscreen
                        </a></>

                      ) : (
                        <img src={editingPage.media_url} alt="" className="w-full max-h-64 object-contain rounded-sm bg-neutral-900" />
                      )}
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/*,video/*" 
                    onChange={handleMediaUpload} 
                    className="hidden" 
                    id="page-media-upload"
                  />
                  <label htmlFor="page-media-upload">
                    <Button type="button" className="w-full bg-neutral-800 border border-white/20 text-white hover:bg-neutral-700 mb-2" asChild>
                      <span>
                        <Upload size={16} className="mr-2" />
                        {editingPage.media_url ? 'Change' : 'Add image/video'}
                      </span>
                    </Button>
                  </label>
                  <Input
                    value={editingPage.media_url || ''}
                    onChange={(e) => setEditingPage({ ...editingPage, media_url: e.target.value })}
                    placeholder="Or paste a URL"
                    className="bg-neutral-900 border-white/10 text-white text-sm"
                  />
                </div>

                {/* Landscape media */}
                <div>
                  <label className="text-white text-sm block mb-2">🖥️ Image / Video — Landscape <span className="text-white">(optional, uses portrait if empty)</span></label>
                  {editingPage.media_url_landscape && (
                    <div className="mb-2">
                      {editingPage.media_url_landscape.match(/\.(mp4|webm|ogg)$/i) ? (
                        <><video src={editingPage.media_url_landscape} controls allowFullScreen playsInline className="w-full h-32 rounded-sm" />
                        <a href={editingPage.media_url_landscape} target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-neutral-700 text-white text-xs py-1.5 rounded mt-1">
                          ⛶ Open fullscreen
                        </a></>

                      ) : (
                        <img src={editingPage.media_url_landscape} alt="" className="w-full h-32 object-cover rounded-sm" />
                      )}
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/*,video/*" 
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const { file_url } = await base44.integrations.Core.UploadFile({ file });
                      setEditingPage({ ...editingPage, media_url_landscape: file_url });
                    }} 
                    className="hidden" 
                    id="page-media-landscape-upload"
                  />
                  <label htmlFor="page-media-landscape-upload">
                    <Button type="button" className="w-full bg-neutral-800 border border-white/20 text-white hover:bg-neutral-700 mb-2" asChild>
                      <span>
                        <Upload size={16} className="mr-2" />
                        {editingPage.media_url_landscape ? 'Change' : 'Add landscape image/video'}
                      </span>
                    </Button>
                  </label>
                  <Input
                    value={editingPage.media_url_landscape || ''}
                    onChange={(e) => setEditingPage({ ...editingPage, media_url_landscape: e.target.value })}
                    placeholder="Or paste a URL"
                    className="bg-neutral-900 border-white/10 text-white text-sm"
                  />
                </div>
              </>
            )}

            {/* Media Gallery — only for mixed (Text + Image/Video) pages */}
            {editingPage.page_type === 'mixed' && (
              <div className="space-y-2">
                <label className="text-white text-sm block">🖼️ Media gallery <span className="text-white text-xs">(optional extra images/videos)</span></label>
                <div className="grid grid-cols-4 gap-2">
                  {(editingPage.images || []).map((img, idx) => (
                    <div key={idx} className="relative group">
                      {img.match(/\.(mp4|webm|ogg)$/i) ? (
                        <video src={img} className="w-full h-20 object-cover rounded" />
                      ) : (
                        <img src={img} alt="" className="w-full h-20 object-cover rounded" />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const newImages = editingPage.images.filter((_, i) => i !== idx);
                          setEditingPage({ ...editingPage, images: newImages });
                        }}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    const urls = await Promise.all(files.map(async (file) => {
                      const { file_url } = await base44.integrations.Core.UploadFile({ file });
                      return file_url;
                    }));
                    setEditingPage({ ...editingPage, images: [...(editingPage.images || []), ...urls] });
                  }}
                  className="hidden"
                  id="mixed-gallery-upload"
                />
                <label htmlFor="mixed-gallery-upload">
                  <Button type="button" className="w-full bg-neutral-800 border border-white/20 text-white hover:bg-neutral-700" asChild>
                    <span>
                      <Upload size={14} className="mr-2" />
                      Add images/videos ({(editingPage.images || []).length})
                    </span>
                  </Button>
                </label>
              </div>
            )}

            {editingPage.page_type !== 'join_cast' && editingPage.page_type !== 'episode' && editingPage.page_type !== 'series' && <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white text-sm block mb-2">Text position</label>
                <Select
                  value={editingPage.text_position}
                  onValueChange={(value) => setEditingPage({ ...editingPage, text_position: value })}
                >
                  <SelectTrigger className="bg-neutral-900 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top">Top</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="bottom">Bottom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-white text-sm block mb-2">Text color</label>
                <Select
                  value={editingPage.text_color}
                  onValueChange={(value) => setEditingPage({ ...editingPage, text_color: value })}
                >
                  <SelectTrigger className="bg-neutral-900 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="white">White</SelectItem>
                    <SelectItem value="black">Black</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>}

            <div>
              <label className="text-white text-sm block mb-2">Display Order (Position)</label>
              <div className="flex items-end gap-2">
                <Input
                  type="number"
                  value={editingPage.order}
                  onChange={(e) => setEditingPage({ ...editingPage, order: parseInt(e.target.value) })}
                  placeholder="Position number..."
                  className="bg-neutral-900 border-white/10 text-white flex-1"
                />
                <Button
                  type="button"
                  onClick={() => setEditingPage({ ...editingPage, order: Math.max(1, editingPage.order - 1) })}
                  className="bg-neutral-800 border border-white/20 text-white hover:bg-neutral-700 px-3"
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  onClick={() => setEditingPage({ ...editingPage, order: editingPage.order + 1 })}
                  className="bg-neutral-800 border border-white/20 text-white hover:bg-neutral-700 px-3"
                >
                  ↓
                </Button>
              </div>
              <p className="text-white text-xs mt-1.5">Lower = appears first</p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={() => setEditingPage(null)} className="flex-1 bg-neutral-600 border border-white/30 text-white hover:bg-neutral-500">
                Cancel
              </Button>
              <Button onClick={handleSavePage} className="flex-1 bg-white text-black hover:bg-white/90">
                Save page
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}