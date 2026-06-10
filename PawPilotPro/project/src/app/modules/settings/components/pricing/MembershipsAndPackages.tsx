import React, { useState } from 'react';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { Switch } from '../../../../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../../components/ui/tabs';
import { Plus, PencilSimple, Trash, CreditCard, Package as PackageIcon } from '@phosphor-icons/react';
import { usePricingStore, Membership, Package } from '../../../pricing/store';
import { toast } from 'sonner';

export function MembershipsAndPackages() {
  const [activeTab, setActiveTab] = useState('memberships');

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="memberships">Memberships</TabsTrigger>
        <TabsTrigger value="packages">Packages</TabsTrigger>
      </TabsList>

      <TabsContent value="memberships" className="mt-6">
        <MembershipsTab />
      </TabsContent>

      <TabsContent value="packages" className="mt-6">
        <PackagesTab />
      </TabsContent>
    </Tabs>
  );
}

function MembershipsTab() {
  const { memberships, createMembership, updateMembership, deleteMembership } = usePricingStore();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedMembership, setSelectedMembership] = useState<Membership | null>(null);

  const handleCreate = async (data: Omit<Membership, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await createMembership(data);
      toast.success('Membership created successfully');
      setIsCreateDialogOpen(false);
    } catch (e) {
      toast.error('Failed to create membership');
    }
  };

  const handleUpdate = async (id: string, data: Partial<Membership>) => {
    try {
      await updateMembership(id, data);
      toast.success('Membership updated successfully');
      setIsEditDialogOpen(false);
      setSelectedMembership(null);
    } catch (e) {
      toast.error('Failed to update membership');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this membership?')) return;
    
    try {
      await deleteMembership(id);
      toast.success('Membership deleted successfully');
    } catch (e) {
      toast.error('Failed to delete membership');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Memberships</CardTitle>
            <CardDescription>
              Monthly plans with included credits and overage pricing.
            </CardDescription>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Membership
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Monthly Price</TableHead>
              <TableHead>Included Credits</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {memberships.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No memberships defined
                </TableCell>
              </TableRow>
            ) : (
              memberships.map((membership) => (
                <TableRow key={membership.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div>{membership.name}</div>
                        {membership.description && (
                          <div className="text-sm text-muted-foreground">{membership.description}</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>£{membership.monthlyPrice.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {membership.includedCredits.length} service(s)
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={membership.status === 'active' ? 'default' : 'secondary'}>
                      {membership.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedMembership(membership);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <PencilSimple className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(membership.id)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* Create Dialog */}
      <MembershipDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSave={handleCreate}
        title="Create Membership"
      />

      {/* PencilSimple Dialog */}
      {selectedMembership && (
        <MembershipDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSave={(data) => handleUpdate(selectedMembership.id, data)}
          initialData={selectedMembership}
          title="Edit Membership"
        />
      )}
    </Card>
  );
}

function PackagesTab() {
  const { packages, createPackage, updatePackage, deletePackage } = usePricingStore();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);

  const handleCreate = async (data: Omit<Package, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await createPackage(data);
      toast.success('Package created successfully');
      setIsCreateDialogOpen(false);
    } catch (e) {
      toast.error('Failed to create package');
    }
  };

  const handleUpdate = async (id: string, data: Partial<Package>) => {
    try {
      await updatePackage(id, data);
      toast.success('Package updated successfully');
      setIsEditDialogOpen(false);
      setSelectedPackage(null);
    } catch (e) {
      toast.error('Failed to update package');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this package?')) return;
    
    try {
      await deletePackage(id);
      toast.success('Package deleted successfully');
    } catch (e) {
      toast.error('Failed to delete package');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Packages</CardTitle>
            <CardDescription>
              Prepaid bundles with expiry and refund rules.
            </CardDescription>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Package
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Included Services</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No packages defined
                </TableCell>
              </TableRow>
            ) : (
              packages.map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <PackageIcon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div>{pkg.name}</div>
                        {pkg.description && (
                          <div className="text-sm text-muted-foreground">{pkg.description}</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>£{pkg.price.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {pkg.includedServices.length} service(s)
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {pkg.expiryDays ? `${pkg.expiryDays} days` : 'No expiry'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={pkg.status === 'active' ? 'default' : 'secondary'}>
                      {pkg.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedPackage(pkg);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <PencilSimple className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(pkg.id)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* Create Dialog */}
      <PackageDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSave={handleCreate}
        title="Create Package"
      />

      {/* PencilSimple Dialog */}
      {selectedPackage && (
        <PackageDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSave={(data) => handleUpdate(selectedPackage.id, data)}
          initialData={selectedPackage}
          title="Edit Package"
        />
      )}
    </Card>
  );
}

interface MembershipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => void;
  initialData?: Membership;
  title: string;
}

function MembershipDialog({ open, onOpenChange, onSave, initialData, title }: MembershipDialogProps) {
  const { services } = usePricingStore();
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    monthlyPrice: initialData?.monthlyPrice || 0,
    includedCredits: initialData?.includedCredits || [],
    overagePricing: initialData?.overagePricing || [],
    pauseRules: initialData?.pauseRules || '',
    prorationRules: initialData?.prorationRules || '',
    status: initialData?.status || 'active' as 'active' | 'inactive',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      pauseRules: formData.pauseRules || undefined,
      prorationRules: formData.prorationRules || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Monthly plans with included credits and overage pricing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Premium Daycare Membership"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description of the membership"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthlyPrice">Monthly Price (£) *</Label>
              <Input
                id="monthlyPrice"
                type="number"
                step="0.01"
                value={formData.monthlyPrice}
                onChange={(e) => setFormData({ ...formData, monthlyPrice: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Included Credits</Label>
              <div className="text-sm text-muted-foreground mb-2">
                Define which services and how many are included in this membership
              </div>
              <div className="text-sm text-muted-foreground">
                {formData.includedCredits.length === 0 ? (
                  'No credits defined (configure in production version)'
                ) : (
                  `${formData.includedCredits.length} service credits defined`
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pauseRules">Pause Rules</Label>
              <Textarea
                id="pauseRules"
                value={formData.pauseRules}
                onChange={(e) => setFormData({ ...formData, pauseRules: e.target.value })}
                placeholder="e.g., Members can pause for up to 30 days per year"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prorationRules">Proration Rules</Label>
              <Textarea
                id="prorationRules"
                value={formData.prorationRules}
                onChange={(e) => setFormData({ ...formData, prorationRules: e.target.value })}
                placeholder="e.g., Pro-rated refunds available in first 14 days"
                rows={2}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="status"
                checked={formData.status === 'active'}
                onCheckedChange={(checked) => setFormData({ ...formData, status: checked ? 'active' : 'inactive' })}
              />
              <Label htmlFor="status">Active</Label>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {initialData ? 'Update' : 'Create'} Membership
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface PackageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => void;
  initialData?: Package;
  title: string;
}

function PackageDialog({ open, onOpenChange, onSave, initialData, title }: PackageDialogProps) {
  const { services } = usePricingStore();
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    price: initialData?.price || 0,
    includedServices: initialData?.includedServices || [],
    expiryDays: initialData?.expiryDays || 0,
    isRefundable: initialData?.isRefundable || false,
    status: initialData?.status || 'active' as 'active' | 'inactive',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      expiryDays: formData.expiryDays || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Prepaid bundles with expiry and refund rules.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., 10-Day Daycare Package"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description of the package"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Price (£) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Included Services</Label>
              <div className="text-sm text-muted-foreground mb-2">
                Define which services and quantities are included in this package
              </div>
              <div className="text-sm text-muted-foreground">
                {formData.includedServices.length === 0 ? (
                  'No services defined (configure in production version)'
                ) : (
                  `${formData.includedServices.length} services included`
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiryDays">Expiry (days)</Label>
              <Input
                id="expiryDays"
                type="number"
                value={formData.expiryDays || ''}
                onChange={(e) => setFormData({ ...formData, expiryDays: parseInt(e.target.value) || 0 })}
                placeholder="Leave empty for no expiry"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isRefundable"
                checked={formData.isRefundable}
                onCheckedChange={(checked) => setFormData({ ...formData, isRefundable: checked })}
              />
              <Label htmlFor="isRefundable">Refundable</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="status"
                checked={formData.status === 'active'}
                onCheckedChange={(checked) => setFormData({ ...formData, status: checked ? 'active' : 'inactive' })}
              />
              <Label htmlFor="status">Active</Label>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {initialData ? 'Update' : 'Create'} Package
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
