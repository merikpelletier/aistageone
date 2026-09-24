import React, { useState } from 'react';
import { base44, supabase } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Upload, ExternalLink } from 'lucide-react';

export default function AdminProducts() {
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  const [paymentLink, setPaymentLink] = useState('');
  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ['adminProducts'],
    queryFn: async () => { const { data, error } = await supabase.from('products').select('*').order('order', { ascending: true }); if (error) throw error; return data || []; },
  });

  const { data: sections = [] } = useQuery({
    queryKey: ['shopSections'],
    queryFn: async () => { const { data, error } = await supabase.from('shop_sections').select('*').order('order', { ascending: true }); if (error) throw error; return data || []; },
  });

  const topLevelSections = sections.filter(s => !s.parent_section_id);
  const getSubsections = (parentId) => sections.filter(s => s.parent_section_id === parentId);

  const getSectionName = (id) => sections.find(s => s.id === id)?.name || '';

  const getProductCategoryLabels = (product) => {
    const section = sections.find(s => s.id === product.section_id);
    if (!section) return { category: '', subcategory: '' };
    if (section.parent_section_id) {
      return { category: getSectionName(section.parent_section_id), subcategory: section.name };
    }
    return { category: section.name, subcategory: '' };
  };

  const createSectionMutation = useMutation({
    mutationFn: async (data) => { const { data: saved, error } = await supabase.from('shop_sections').insert(data).select('*').single(); if (error) throw error; return saved; },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopSections'] });
      setEditingSection(null);
    },
    onError: (error) => {
      console.error('Gift Shop section create failed:', error);
      alert(error?.message || 'Unable to save category');
    }
  });

  const updateSectionMutation = useMutation({
    mutationFn: async ({ id, data }) => { const payload = { ...data }; delete payload.id; delete payload.created_date; delete payload.updated_date; delete payload.created_by_id; const { data: saved, error } = await supabase.from('shop_sections').update(payload).eq('id', id).select('*').single(); if (error) throw error; return saved; },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopSections'] });
      setEditingSection(null);
    },
    onError: (error) => {
      console.error('Gift Shop section update failed:', error);
      alert(error?.message || 'Unable to save category');
    }
  });

  const deleteSectionMutation = useMutation({
    mutationFn: async (id) => { const { error } = await supabase.from('shop_sections').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shopSections'] }),
    onError: (error) => {
      console.error('Gift Shop section delete failed:', error);
      alert(error?.message || 'Unable to delete category');
    }
  });

  const handleSaveSection = () => {
    if (editingSection.parent_section_id === editingSection.id) {
      alert('A section cannot be its own parent');
      return;
    }
    if (editingSection.id) {
      updateSectionMutation.mutate({ id: editingSection.id, data: editingSection });
    } else {
      createSectionMutation.mutate(editingSection);
    }
  };

  const { data: shopSettings = [] } = useQuery({
    queryKey: ['shopSettings'],
    queryFn: async () => { const { data, error } = await supabase.from('shop_settings').select('*').order('created_date', { ascending: true }); if (error) throw error; return data || []; },
  });

  React.useEffect(() => {
    if (shopSettings.length > 0) {
      setPaymentLink(shopSettings[0].payment_link || '');
    }
  }, [shopSettings]);

  const createProductMutation = useMutation({
    mutationFn: async (data) => { const { data: saved, error } = await supabase.from('products').insert(data).select('*').single(); if (error) throw error; return saved; },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
      setEditingProduct(null);
    },
    onError: (error) => {
      console.error('Gift Shop product create failed:', error);
      alert(error?.message || 'Unable to save product');
    }
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }) => { const payload = { ...data }; delete payload.id; delete payload.created_date; delete payload.updated_date; delete payload.created_by_id; const { data: saved, error } = await supabase.from('products').update(payload).eq('id', id).select('*').single(); if (error) throw error; return saved; },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
      setEditingProduct(null);
    },
    onError: (error) => {
      console.error('Gift Shop product update failed:', error);
      alert(error?.message || 'Unable to save product');
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id) => { const { error } = await supabase.from('products').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminProducts'] })
  });

  const savePaymentLinkMutation = useMutation({
    mutationFn: async (link) => {
      if (shopSettings.length > 0) {
        const { data, error } = await supabase.from('shop_settings').update({ payment_link: link }).eq('id', shopSettings[0].id).select('*').single(); if (error) throw error; return data;
      } else {
        const { data, error } = await supabase.from('shop_settings').insert({ payment_link: link }).select('*').single(); if (error) throw error; return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shopSettings'] });
      alert('Payment link saved');
    }
  });

  const handleSaveProduct = () => {
    if (editingProduct.id) {
      updateProductMutation.mutate({ id: editingProduct.id, data: editingProduct });
    } else {
      createProductMutation.mutate(editingProduct);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setEditingProduct({ ...editingProduct, image_url: file_url });
  };

  const handleSecondaryImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const existing = editingProduct.images || [];
    setEditingProduct({ ...editingProduct, images: [...existing, file_url] });
  };

  const handleSectionImageUpload = async (field, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setEditingSection((current) => current ? { ...current, [field]: file_url } : current);
  };

  const addProductOption = () => {
    setEditingProduct((current) => ({
      ...current,
      product_options: [...(current.product_options || []), { name: '', values: [] }],
    }));
  };

  const updateProductOption = (index, field, value) => {
    setEditingProduct((current) => {
      const options = [...(current.product_options || [])];
      options[index] = { ...options[index], [field]: value };
      return { ...current, product_options: options };
    });
  };

  const removeProductOption = (index) => {
    setEditingProduct((current) => ({
      ...current,
      product_options: (current.product_options || []).filter((_, optionIndex) => optionIndex !== index),
    }));
  };

  return (
    <div>
      {/* Categories & Subcategories Section */}
      <div className="mb-8 p-4 bg-neutral-950 border border-white/10 rounded-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white text-sm font-light">Categories & Subcategories</h3>
          <Button
            onClick={() => setEditingSection({ name: '', description: '', parent_section_id: null, order: sections.length + 1, is_active: true })}
            className="bg-white text-black hover:bg-white/90"
            size="sm"
          >
            <Plus size={14} className="mr-2" />
            New category
          </Button>
        </div>
        <div className="space-y-2">
          {topLevelSections.map((section) => (
            <div key={section.id} className={`border border-white/10 rounded-sm p-3 ${!section.is_active && 'opacity-50'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-white text-sm font-light">{section.name}</span>
                  <span className="text-white/40 text-xs ml-2">order: {section.order}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setEditingSection(section)} className="text-white hover:text-white">
                    <Edit2 size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteSectionMutation.mutate(section.id)} className="text-white hover:text-red-500">
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              {getSubsections(section.id).length > 0 && (
                <div className="mt-2 ml-4 space-y-1">
                  {getSubsections(section.id).map((sub) => (
                    <div key={sub.id} className={`flex items-center justify-between border border-white/5 rounded-sm p-2 ${!sub.is_active && 'opacity-50'}`}>
                      <div>
                        <span className="text-white text-xs font-light">{sub.name}</span>
                        <span className="text-white/40 text-xs ml-2">order: {sub.order}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => setEditingSection(sub)} className="text-white hover:text-white">
                          <Edit2 size={12} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteSectionMutation.mutate(sub.id)} className="text-white hover:text-red-500">
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Edit Section Dialog */}
      <Dialog open={!!editingSection} onOpenChange={() => setEditingSection(null)}>
        <DialogContent className="bg-neutral-950 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="font-light tracking-wide">
              {editingSection?.id ? 'Edit' : 'New'} Section
            </DialogTitle>
          </DialogHeader>
          {editingSection && (
            <div className="space-y-4 mt-4">
              <Input
                value={editingSection.name}
                onChange={(e) => setEditingSection({ ...editingSection, name: e.target.value })}
                placeholder="Name"
                className="bg-neutral-900 border-white/10 text-white"
              />
              <Textarea
                value={editingSection.description || ''}
                onChange={(e) => setEditingSection({ ...editingSection, description: e.target.value })}
                placeholder="Description"
                className="bg-neutral-900 border-white/10 text-white"
                rows={2}
              />
              <Select
                value={editingSection.parent_section_id || 'none'}
                onValueChange={(value) => setEditingSection({ ...editingSection, parent_section_id: value === 'none' ? null : value })}
              >
                <SelectTrigger className="bg-neutral-900 border-white/10 text-white">
                  <SelectValue placeholder="Parent category (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No parent (top-level category)</SelectItem>
                  {topLevelSections.filter(s => s.id !== editingSection.id).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div>
                <label className="block text-white text-sm mb-2">Banner image</label>
                {editingSection.banner_image && (
                  <img src={editingSection.banner_image} alt="" className="w-full h-32 object-cover rounded-sm mb-2" />
                )}
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleSectionImageUpload('banner_image', e)}
                    className="hidden"
                  />
                  <Button type="button" variant="outline" className="w-full !bg-neutral-900 !text-white !border-white/20 hover:!bg-neutral-800">
                    <Upload size={16} className="mr-2" />
                    Choose banner image
                  </Button>
                </label>
              </div>
              <Input
                value={editingSection.banner_video || ''}
                onChange={(e) => setEditingSection({ ...editingSection, banner_video: e.target.value })}
                placeholder="Banner video URL (optional)"
                className="bg-neutral-900 border-white/10 text-white"
              />
              <Textarea
                value={editingSection.promo_text || ''}
                onChange={(e) => setEditingSection({ ...editingSection, promo_text: e.target.value })}
                placeholder="Promo text (optional)"
                className="bg-neutral-900 border-white/10 text-white"
                rows={2}
              />
              <div>
                <label className="block text-white text-sm mb-2">Promo image</label>
                {editingSection.promo_image && (
                  <img src={editingSection.promo_image} alt="" className="w-full h-32 object-cover rounded-sm mb-2" />
                )}
                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleSectionImageUpload('promo_image', e)}
                    className="hidden"
                  />
                  <Button type="button" variant="outline" className="w-full !bg-neutral-900 !text-white !border-white/20 hover:!bg-neutral-800">
                    <Upload size={16} className="mr-2" />
                    Choose promo image
                  </Button>
                </label>
              </div>
              <Input
                type="number"
                value={editingSection.order}
                onChange={(e) => setEditingSection({ ...editingSection, order: parseInt(e.target.value) })}
                placeholder="Order"
                className="bg-neutral-900 border-white/10 text-white"
              />
              <div className="flex items-center justify-between">
                <span className="text-white text-sm">Active</span>
                <Switch
                  checked={editingSection.is_active !== false}
                  onCheckedChange={(checked) => setEditingSection({ ...editingSection, is_active: checked })}
                />
              </div>
              <Button
                onClick={handleSaveSection}
                className="w-full bg-white text-black hover:bg-white/90"
              >
                Save
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Link Section */}
      <div className="mb-8 p-4 bg-neutral-950 border border-white/10 rounded-sm">
        <h3 className="text-white text-sm font-light mb-3">Cart payment link</h3>
        <p className="text-white text-xs mb-3">
          This link will be used for payment for all products in the cart
        </p>
        <div className="flex gap-2">
          <Input
            value={paymentLink}
            onChange={(e) => setPaymentLink(e.target.value)}
            placeholder="https://your-payment-link.com"
            className="bg-neutral-900 border-white/10 text-white flex-1"
          />
          <Button
            onClick={() => savePaymentLinkMutation.mutate(paymentLink)}
            disabled={!paymentLink || savePaymentLinkMutation.isPending}
            className="bg-white text-black hover:bg-white/90"
          >
            Save
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-white text-lg font-light">Shop</h2>
        <Button
          onClick={() => setEditingProduct({ 
            name: '', 
            description: '', 
            price: '', 
            category: 'product',
            is_active: true, 
            order: products.length + 1 
          })}
          className="bg-white text-black hover:bg-white/90"
        >
          <Plus size={16} className="mr-2" />
          New product
        </Button>
      </div>

      {/* Product List */}
      <div className="space-y-3">
        {products.map((product) => (
          <div
            key={product.id}
            className={`bg-neutral-950 border border-white/10 rounded-sm p-4 ${
              !product.is_active && 'opacity-50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex gap-4">
                {product.image_url && (
                  <img
                    src={product.image_url}
                    alt=""
                    className="w-20 h-14 object-cover rounded-sm"
                  />
                )}
                <div>
                  <h3 className="text-white font-light">{product.name}</h3>
                  {product.description && (
                    <p className="text-white text-sm line-clamp-1">{product.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-white">{product.price}</span>
                    {getProductCategoryLabels(product).category && (
                      <span className="text-white text-xs px-2 py-0.5 bg-neutral-800 rounded">
                        {getProductCategoryLabels(product).category}
                      </span>
                    )}
                    {getProductCategoryLabels(product).subcategory && (
                      <span className="text-white text-xs px-2 py-0.5 bg-neutral-800 rounded">
                        {getProductCategoryLabels(product).subcategory}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {product.external_link && (
                  <a href={product.external_link} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="text-white hover:text-white">
                      <ExternalLink size={16} />
                    </Button>
                  </a>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditingProduct(product)}
                  className="text-white hover:text-white"
                >
                  <Edit2 size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteProductMutation.mutate(product.id)}
                  className="text-white hover:text-red-500"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Product Dialog */}
      <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
        <DialogContent className="bg-neutral-950 border-white/10 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-light tracking-wide">
              {editingProduct?.id ? 'Edit' : 'New'} Product
            </DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <div className="space-y-4 mt-4 pb-4">
              <Input
                value={editingProduct.name}
                onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                placeholder="Name"
                className="bg-neutral-900 border-white/10 text-white"
              />
              <Textarea
                value={editingProduct.description || ''}
                onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                placeholder="Description"
                className="bg-neutral-900 border-white/10 text-white"
                rows={3}
              />
              <Input
                value={editingProduct.price}
                onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })}
                placeholder="Price (e.g. $29.99)"
                className="bg-neutral-900 border-white/10 text-white"
              />
              <Input
                value={editingProduct.external_link || ''}
                onChange={(e) => setEditingProduct({ ...editingProduct, external_link: e.target.value })}
                placeholder="External link (payment)"
                className="bg-neutral-900 border-white/10 text-white"
              />
              <div>
                <label className="block text-white text-sm mb-2">Image</label>
                {editingProduct.image_url && (
                  <img src={editingProduct.image_url} alt="" className="w-full h-32 object-cover rounded-sm mb-2" />
                )}
                <label className="block">
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  <Button type="button" variant="outline" className="w-full !bg-neutral-900 !text-white !border-white/20 hover:!bg-neutral-800">
                    <Upload size={16} className="mr-2" />
                    Choose an image
                  </Button>
                </label>
              </div>
              <div>
                <label className="block text-white text-sm mb-2">Secondary images (optional)</label>
                {editingProduct.images && editingProduct.images.length > 0 && (
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {editingProduct.images.map((img, idx) => (
                      <img key={idx} src={img} alt="" className="w-16 h-16 object-cover rounded-sm" />
                    ))}
                  </div>
                )}
                <label className="block">
                  <input type="file" accept="image/*" onChange={handleSecondaryImageUpload} className="hidden" />
                  <Button type="button" variant="outline" className="w-full !bg-neutral-900 !text-white !border-white/20 hover:!bg-neutral-800">
                    <Upload size={16} className="mr-2" />
                    Add a secondary image
                  </Button>
                </label>
              </div>
              <div className="border border-white/10 bg-neutral-900/50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-white text-sm">Product options</p>
                    <p className="text-white/50 text-xs mt-1">Size, color, model, format, etc.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addProductOption}
                    className="!bg-neutral-900 !text-white !border-white/20 hover:!bg-neutral-800"
                  >
                    <Plus size={14} />
                    Add option
                  </Button>
                </div>

                {(editingProduct.product_options || []).map((option, index) => (
                  <div key={index} className="border border-white/10 p-3 space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={option.name || ''}
                        onChange={(e) => updateProductOption(index, 'name', e.target.value)}
                        placeholder="Option name (e.g. Size)"
                        className="bg-neutral-900 border-white/10 text-white flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeProductOption(index)}
                        className="text-white hover:text-red-500"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                    <Input
                      value={(option.values || []).join(', ')}
                      onChange={(e) => updateProductOption(
                        index,
                        'values',
                        e.target.value.split(',').map(value => value.trim()).filter(Boolean)
                      )}
                      placeholder="Values separated by commas (e.g. S, M, L, XL)"
                      className="bg-neutral-900 border-white/10 text-white"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between border border-white/10 bg-neutral-900/50 p-4">
                <div>
                  <span className="text-white text-sm">Downloadable product</span>
                  <p className="text-white/50 text-xs mt-1">Marks this item as a digital/downloadable product.</p>
                </div>
                <Switch
                  checked={editingProduct.is_digital === true}
                  onCheckedChange={(checked) => setEditingProduct({ ...editingProduct, is_digital: checked })}
                />
              </div>

              <Input
                value={editingProduct.dossier_id || ''}
                onChange={(e) => setEditingProduct({ ...editingProduct, dossier_id: e.target.value })}
                placeholder="Associated story/dossier ID (optional)"
                className="bg-neutral-900 border-white/10 text-white"
              />
              <Input
                value={editingProduct.product_type || ''}
                onChange={(e) => setEditingProduct({ ...editingProduct, product_type: e.target.value })}
                placeholder="Product type (optional)"
                className="bg-neutral-900 border-white/10 text-white"
              />
              <Input
                value={editingProduct.sku || ''}
                onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                placeholder="SKU (optional)"
                className="bg-neutral-900 border-white/10 text-white"
              />
              <Input
                type="number"
                value={editingProduct.stock ?? ''}
                onChange={(e) => setEditingProduct({ ...editingProduct, stock: e.target.value === '' ? '' : parseInt(e.target.value) })}
                placeholder="Stock (optional)"
                className="bg-neutral-900 border-white/10 text-white"
              />
              <Select
                value={(() => {
                  const current = sections.find(s => s.id === editingProduct.section_id);
                  if (!current) return '';
                  return current.parent_section_id || current.id;
                })()}
                onValueChange={(value) => setEditingProduct({ ...editingProduct, section_id: value })}
              >
                <SelectTrigger className="bg-neutral-900 border-white/10 text-white">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {topLevelSections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(() => {
                const current = sections.find(s => s.id === editingProduct.section_id);
                const selectedCategoryId = current ? (current.parent_section_id || current.id) : null;
                const subsections = selectedCategoryId ? getSubsections(selectedCategoryId) : [];
                if (subsections.length === 0) return null;
                return (
                  <Select
                    value={current && current.parent_section_id ? current.id : ''}
                    onValueChange={(value) => setEditingProduct({ ...editingProduct, section_id: value })}
                  >
                    <SelectTrigger className="bg-neutral-900 border-white/10 text-white">
                      <SelectValue placeholder="Subcategory (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {subsections.map((sub) => (
                        <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              })()}
              <div className="flex items-center justify-between">
                <span className="text-white text-sm">Active</span>
                <Switch
                  checked={editingProduct.is_active !== false}
                  onCheckedChange={(checked) => setEditingProduct({ ...editingProduct, is_active: checked })}
                />
              </div>
              <Input
                type="number"
                value={editingProduct.order}
                onChange={(e) => setEditingProduct({ ...editingProduct, order: parseInt(e.target.value) })}
                placeholder="Order"
                className="bg-neutral-900 border-white/10 text-white"
              />
              <Button
                onClick={handleSaveProduct}
                className="w-full bg-white text-black hover:bg-white/90"
              >
                Save
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}