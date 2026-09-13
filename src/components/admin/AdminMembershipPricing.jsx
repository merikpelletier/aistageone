import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, Edit, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function AdminMembershipPricing() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [membershipPricing, setMembershipPricing] = useState([]);
  const [tokenPackages, setTokenPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingMembership, setEditingMembership] = useState(null);
  const [editingPackage, setEditingPackage] = useState(null);
  const [activeTab, setActiveTab] = useState('memberships');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [pricing, packages] = await Promise.all([
        base44.entities.MembershipPricing.list(),
        base44.entities.TokenPackage.list()
      ]);
      // Sort by order field
      const sortedPricing = [...pricing].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const sortedPackages = [...packages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setMembershipPricing(sortedPricing);
      setTokenPackages(sortedPackages);
    } catch (error) {
      toast({
        title: 'Error loading data',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMembership = async (data) => {
    try {
      const saveData = { ...data };
      if (!data.id) {
        saveData.order = membershipPricing.length;
      }
      if (data.id) {
        await base44.entities.MembershipPricing.update(data.id, saveData);
      } else {
        await base44.entities.MembershipPricing.create(saveData);
      }
      await fetchData();
      setEditingMembership(null);
      qc.invalidateQueries({ queryKey: ['membership-pricing'] });
      toast({ title: 'Saved', description: 'Membership pricing updated' });
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleSavePackage = async (data) => {
    try {
      if (data.id) {
        await base44.entities.TokenPackage.update(data.id, data);
      } else {
        await base44.entities.TokenPackage.create(data);
      }
      await fetchData();
      setEditingPackage(null);
      toast({ title: 'Saved', description: 'Token package updated' });
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteMembership = async (id) => {
    if (!confirm('Delete this membership pricing?')) return;
    try {
      await base44.entities.MembershipPricing.delete(id);
      await fetchData();
      toast({ title: 'Deleted', description: 'Membership pricing deleted' });
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    
    const items = Array.from(membershipPricing);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Update UI immediately
    setMembershipPricing(items);
    
    try {
      const updates = items.map((item, index) => ({
        id: item.id,
        order: index
      }));
      await base44.entities.MembershipPricing.bulkUpdate(updates);
      qc.invalidateQueries({ queryKey: ['membership-pricing'] });
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      // Revert on error
      await fetchData();
    }
  };

  const handleDeletePackage = async (id) => {
    if (!confirm('Delete this token package?')) return;
    try {
      await base44.entities.TokenPackage.delete(id);
      await fetchData();
      toast({ title: 'Deleted', description: 'Token package deleted' });
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return <div className="text-white">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-white text-xl font-light tracking-widest">MEMBERSHIP & TOKEN PRICING</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-neutral-900 border border-white/20 text-white">
          <TabsTrigger value="memberships" className="text-white data-[state=inactive]:text-white">Membership Pricing</TabsTrigger>
          <TabsTrigger value="tokens" className="text-white data-[state=inactive]:text-white">Token Packages</TabsTrigger>
        </TabsList>

        {/* Membership Pricing Tab */}
        <TabsContent value="memberships" className="space-y-4">
          <Card className="bg-neutral-900 border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span>Membership Tiers</span>
                <Button
                  size="sm"
                  onClick={() => setEditingMembership({
                    membership_type: 'base',
                    price_monthly: 0,
                    tokens_included: 0,
                    is_active: true
                  })}
                >
                  <Plus size={16} className="mr-2" /> Add Tier
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {membershipPricing.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 bg-neutral-800 border border-white/20 rounded-lg"
                  >
                    <div className="cursor-grab p-1 hover:bg-white/10 rounded">
                      <GripVertical size={20} className="text-white" />
                    </div>
                    <span className="text-white text-xs w-6">{index}</span>
                    <div className="flex-1">
                      <span className="text-white capitalize font-medium">{item.membership_type}</span>
                      <span className="text-white text-xs ml-2">${item.price_monthly}/mo • {item.tokens_included} tokens</span>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${item.is_active ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                      {item.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingMembership(item)}
                        className="text-white hover:bg-white/10"
                      >
                        <Edit size={16} className="text-white" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteMembership(item.id)}
                        className="text-red-500 hover:bg-white/10"
                      >
                        <Trash2 size={16} className="text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
                {membershipPricing.length === 0 && (
                  <div className="text-white text-center py-8">
                    No membership pricing configured. Click "Add Tier" to create one.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Token Packages Tab */}
        <TabsContent value="tokens" className="space-y-4">
          <Card className="bg-neutral-900 border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span>Token Packages</span>
                <Button
                  size="sm"
                  onClick={() => setEditingPackage({
                    name: 'Starter Pack',
                    token_amount: 100,
                    price: 9.99,
                    bonus_percentage: 0,
                    is_active: true,
                    order: 0
                  })}
                >
                  <Plus size={16} className="mr-2" /> Add Package
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {tokenPackages.map((pkg, index) => (
                  <div key={pkg.id} className="flex items-center gap-3 p-3 bg-neutral-800 border border-white/20 rounded-lg">
                    <span className="text-white text-xs w-6">{index}</span>
                    <div className="flex-1">
                      <span className="text-white capitalize font-medium">{pkg.name}</span>
                      <span className="text-white text-xs ml-2">{pkg.token_amount} tokens • {pkg.bonus_percentage}% bonus • ${pkg.price}</span>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${pkg.is_active ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                      {pkg.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingPackage(pkg)}
                        className="text-white hover:bg-white/10"
                      >
                        <Edit size={16} className="text-white" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeletePackage(pkg.id)}
                        className="text-red-500 hover:bg-white/10"
                      >
                        <Trash2 size={16} className="text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
                {tokenPackages.length === 0 && (
                  <div className="text-white text-center py-8">
                    No token packages configured. Click "Add Package" to create one.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Membership Dialog */}
      <Dialog open={!!editingMembership} onOpenChange={(open) => !open && setEditingMembership(null)}>
        <DialogContent className="bg-neutral-900 border-white/20 text-white">
          <DialogHeader>
            <DialogTitle>{editingMembership?.id ? 'Edit' : 'Add'} Membership Pricing</DialogTitle>
          </DialogHeader>
          <MembershipForm
            data={editingMembership}
            onSave={handleSaveMembership}
            onCancel={() => setEditingMembership(null)}
          />
        </DialogContent>
      </Dialog>

      {/* Token Package Dialog */}
      <Dialog open={!!editingPackage} onOpenChange={(open) => !open && setEditingPackage(null)}>
        <DialogContent className="bg-neutral-900 border-white/20 text-white">
          <DialogHeader>
            <DialogTitle>{editingPackage?.id ? 'Edit' : 'Add'} Token Package</DialogTitle>
          </DialogHeader>
          <TokenPackageForm
            data={editingPackage}
            onSave={handleSavePackage}
            onCancel={() => setEditingPackage(null)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MembershipForm({ data, onSave, onCancel }) {
  const [form, setForm] = useState({
    membership_type: 'base',
    price_monthly: 0,
    tokens_included: 0,
    is_active: true,
    order: 0
  });

  React.useEffect(() => {
    setForm(data || {
      membership_type: 'base',
      price_monthly: 0,
      tokens_included: 0,
      is_active: true,
      order: 0
    });
  }, [data]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className="text-white">Membership Type Name</Label>
        <Input
          value={form.membership_type}
          onChange={(e) => setForm({ ...form, membership_type: e.target.value })}
          placeholder="e.g. VIP, Premium, Enterprise"
          className="bg-neutral-800 border-white/20 text-white"
        />
      </div>
      <div>
        <Label className="text-white">Monthly Price ($)</Label>
        <Input
          type="number"
          step="0.01"
          value={form.price_monthly}
          onChange={(e) => setForm({ ...form, price_monthly: parseFloat(e.target.value) || 0 })}
          className="bg-neutral-800 border-white/20 text-white"
        />
      </div>
      <div>
        <Label className="text-white">Tokens Included Per Month</Label>
        <Input
          type="number"
          value={form.tokens_included}
          onChange={(e) => setForm({ ...form, tokens_included: parseInt(e.target.value) || 0 })}
          className="bg-neutral-800 border-white/20 text-white"
        />
      </div>
      <div>
        <Label className="text-white">Display Order (0 = first, 1 = second, etc.)</Label>
        <Input
          type="number"
          value={form.order}
          onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
          className="bg-neutral-800 border-white/20 text-white"
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={form.is_active}
          onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
        />
        <Label className="text-white">Active</Label>
      </div>
      <div className="flex gap-2 pt-4">
        <Button type="submit" className="flex-1">Save</Button>
        <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">Cancel</Button>
      </div>
    </form>
  );
}

function TokenPackageForm({ data, onSave, onCancel }) {
  const [form, setForm] = useState(data || {
    name: '',
    token_amount: 0,
    price: 0,
    bonus_percentage: 0,
    is_active: true,
    order: 0
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label className="text-white">Package Name</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Starter Pack"
          className="bg-neutral-800 border-white/20 text-white"
        />
      </div>
      <div>
        <Label className="text-white">Token Amount</Label>
        <Input
          type="number"
          value={form.token_amount}
          onChange={(e) => setForm({ ...form, token_amount: parseInt(e.target.value) || 0 })}
          className="bg-neutral-800 border-white/20 text-white"
        />
      </div>
      <div>
        <Label className="text-white">Bonus Tokens (%)</Label>
        <Input
          type="number"
          value={form.bonus_percentage}
          onChange={(e) => setForm({ ...form, bonus_percentage: parseInt(e.target.value) || 0 })}
          className="bg-neutral-800 border-white/20 text-white"
        />
      </div>
      <div>
        <Label className="text-white">Price ($)</Label>
        <Input
          type="number"
          step="0.01"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
          className="bg-neutral-800 border-white/20 text-white"
        />
      </div>
      <div>
        <Label className="text-white">Display Order</Label>
        <Input
          type="number"
          value={form.order}
          onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
          className="bg-neutral-800 border-white/20 text-white"
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={form.is_active}
          onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
        />
        <Label className="text-white">Active</Label>
      </div>
      <div className="flex gap-2 pt-4">
        <Button type="submit" className="flex-1">Save</Button>
        <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">Cancel</Button>
      </div>
    </form>
  );
}