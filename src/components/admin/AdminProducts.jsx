import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
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
  const [paymentLink, setPaymentLink] = useState('');
  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ['adminProducts'],
    queryFn: () => base44.entities.Product.list('order'),
  });

  const { data: shopSettings = [] } = useQuery({
    queryKey: ['shopSettings'],
    queryFn: () => base44.entities.ShopSettings.list(),
  });

  React.useEffect(() => {
    if (shopSettings.length > 0) {
      setPaymentLink(shopSettings[0].payment_link || '');
    }
  }, [shopSettings]);

  const createProductMutation = useMutation({
    mutationFn: (data) => base44.entities.Product.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
      setEditingProduct(null);
    }
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Product.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
      setEditingProduct(null);
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id) => base44.entities.Product.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminProducts'] })
  });

  const savePaymentLinkMutation = useMutation({
    mutationFn: async (link) => {
      if (shopSettings.length > 0) {
        return base44.entities.ShopSettings.update(shopSettings[0].id, { payment_link: link });
      } else {
        return base44.entities.ShopSettings.create({ payment_link: link });
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

  const categories = {
    product: 'Product',
    access: 'Access',
    support: 'Support'
  };

  return (
    <div>
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
                    <span className="text-white text-xs px-2 py-0.5 bg-neutral-800 rounded">
                      {categories[product.category]}
                    </span>
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
                  <Button type="button" variant="outline" className="w-full border-white/20 text-white">
                    <Upload size={16} className="mr-2" />
                    Choose an image
                  </Button>
                </label>
              </div>
              <Select
                value={editingProduct.category}
                onValueChange={(value) => setEditingProduct({ ...editingProduct, category: value })}
              >
                <SelectTrigger className="bg-neutral-900 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="access">Access</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                </SelectContent>
              </Select>
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