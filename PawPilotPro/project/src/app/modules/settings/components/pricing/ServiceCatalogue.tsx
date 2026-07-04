import React, { useState } from 'react';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { Textarea } from '../../../../components/ui/textarea';
import { Switch } from '../../../../components/ui/switch';
import { Plus, PencilSimple, Trash, Dog, Scissors, ShoppingBag, Car } from '@phosphor-icons/react';
import { usePricingStore, Service, ServiceType } from '../../../pricing/store';
import { toast } from 'sonner';
import { MODULES } from '../../constants/modules';
import { useConfirmDialog } from '../../../../hooks/useConfirmDialog';

const MODULE_ICONS = {
  daycare: Dog,
  grooming: Scissors,
  boutique: ShoppingBag,
  transport: Car,
};

const SERVICE_TYPES: Record<string, { label: string; types: { value: ServiceType; label: string }[] }> = {
  daycare: {
    label: 'Daycare',
    types: [
      { value: 'daycare-full', label: 'Full Day' },
      { value: 'daycare-half', label: 'Half Day' },
      { value: 'daycare-trial', label: 'Trial Day' },
      { value: 'daycare-extra-hours', label: 'Extra Hours / Late Pickup' },
      { value: 'daycare-adhoc', label: 'Ad-hoc Day' },
    ]
  },
  grooming: {
    label: 'Grooming',
    types: [
      { value: 'grooming-bath', label: 'Bath' },
      { value: 'grooming-cut', label: 'Cut' },
      { value: 'grooming-trim', label: 'Trim' },
      { value: 'grooming-addon', label: 'Add-on (nails, teeth, etc.)' },
      { value: 'grooming-penalty', label: 'Penalty (missed appointment)' },
    ]
  },
  boutique: {
    label: 'Boutique',
    types: [
      { value: 'boutique-product', label: 'Product (SKU-based)' },
      { value: 'boutique-bundle', label: 'Bundle' },
      { value: 'boutique-discount', label: 'Discounted Item' },
    ]
  },
  transport: {
    label: 'Transportation',
    types: [
      { value: 'transport-pickup', label: 'Pickup' },
      { value: 'transport-dropoff', label: 'Drop-off' },
      { value: 'transport-roundtrip', label: 'Round Trip' },
      { value: 'transport-penalty', label: 'Penalty (failed pickup)' },
    ]
  },
};

export function ServiceCatalogue() {
  const { services, createService, updateService, deleteService } = usePricingStore();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [filterModule, setFilterModule] = useState<string>('all');
  const { confirm, confirmDialog } = useConfirmDialog();

  const handleCreateService = async (data: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await createService(data);
      toast.success('Service created successfully');
      setIsCreateDialogOpen(false);
    } catch (e) {
      toast.error('Failed to create service');
    }
  };

  const handleUpdateService = async (id: string, data: Partial<Service>) => {
    try {
      await updateService(id, data);
      toast.success('Service updated successfully');
      setIsEditDialogOpen(false);
      setSelectedService(null);
    } catch (e) {
      toast.error('Failed to update service');
    }
  };

  const handleDeleteService = async (id: string) => {
    const confirmed = await confirm({
      title: 'Delete this service?',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;

    try {
      await deleteService(id);
      toast.success('Service deleted successfully');
    } catch (e) {
      toast.error('Failed to delete service');
    }
  };

  const filteredServices = filterModule === 'all' 
    ? services 
    : services.filter(s => s.moduleId === filterModule);

  const groupedServices = filteredServices.reduce((acc, service) => {
    if (!acc[service.moduleId]) acc[service.moduleId] = [];
    acc[service.moduleId].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Service Catalogue</CardTitle>
              <CardDescription>
                Define services across all modules. Each service can have pricing, operational attributes, and status.
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Service
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Label>Filter by Module</Label>
            <Select value={filterModule} onValueChange={setFilterModule}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {MODULES.filter(m => !m.isCore).map(module => (
                  <SelectItem key={module.id} value={module.id}>
                    {module.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-6">
            {Object.entries(groupedServices).map(([moduleId, moduleServices]) => {
              const module = MODULES.find(m => m.id === moduleId);
              if (!module) return null;
              const Icon = MODULE_ICONS[moduleId as keyof typeof MODULE_ICONS];

              return (
                <div key={moduleId} className="space-y-3">
                  <div className="flex items-center gap-2">
                    {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
                    <h3>{module.label}</h3>
                    <Badge variant="outline">{moduleServices.length} services</Badge>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Capacity Impact</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {moduleServices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            No services defined for this module
                          </TableCell>
                        </TableRow>
                      ) : (
                        moduleServices.map((service) => (
                          <TableRow key={service.id}>
                            <TableCell>
                              <div>
                                <div>{service.name}</div>
                                {service.description && (
                                  <div className="text-sm text-muted-foreground">{service.description}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {SERVICE_TYPES[moduleId]?.types.find(t => t.value === service.serviceType)?.label || service.serviceType}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {service.durationMinutes ? `${service.durationMinutes} min` : '—'}
                            </TableCell>
                            <TableCell>
                              {service.capacityImpact !== undefined ? service.capacityImpact : '—'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={service.status === 'active' ? 'default' : 'secondary'}>
                                {service.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedService(service);
                                    setIsEditDialogOpen(true);
                                  }}
                                >
                                  <PencilSimple className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteService(service.id)}
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
                </div>
              );
            })}

            {Object.keys(groupedServices).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No services found. Create your first service to get started.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create Service Dialog */}
      <ServiceDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSave={handleCreateService}
        title="Create Service"
      />

      {/* PencilSimple Service Dialog */}
      {selectedService && (
        <ServiceDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSave={(data) => handleUpdateService(selectedService.id, data)}
          initialData={selectedService}
          title="Edit Service"
        />
      )}

      {confirmDialog}
    </div>
  );
}

interface ServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => void;
  initialData?: Service;
  title: string;
}

function ServiceDialog({ open, onOpenChange, onSave, initialData, title }: ServiceDialogProps) {
  const [formData, setFormData] = useState({
    moduleId: initialData?.moduleId || 'daycare',
    name: initialData?.name || '',
    description: initialData?.description || '',
    customerFacingDescription: initialData?.customerFacingDescription || '',
    serviceType: initialData?.serviceType || 'daycare-full' as ServiceType,
    durationMinutes: initialData?.durationMinutes || 0,
    capacityImpact: initialData?.capacityImpact || 1,
    requiredStaffRole: initialData?.requiredStaffRole || '',
    status: initialData?.status || 'active' as 'active' | 'inactive',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      durationMinutes: formData.durationMinutes || undefined,
      capacityImpact: formData.capacityImpact || undefined,
      requiredStaffRole: formData.requiredStaffRole || undefined,
      customerFacingDescription: formData.customerFacingDescription || undefined,
    });
  };

  const availableServiceTypes = SERVICE_TYPES[formData.moduleId]?.types || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Define the service details, operational attributes, and status.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="moduleId">Module *</Label>
                <Select
                  value={formData.moduleId}
                  onValueChange={(value) => {
                    setFormData({ 
                      ...formData, 
                      moduleId: value,
                      serviceType: SERVICE_TYPES[value]?.types[0]?.value || 'daycare-full'
                    });
                  }}
                >
                  <SelectTrigger id="moduleId">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODULES.filter(m => !m.isCore).map(module => (
                      <SelectItem key={module.id} value={module.id}>
                        {module.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceType">Service Type *</Label>
                <Select
                  value={formData.serviceType}
                  onValueChange={(value) => setFormData({ ...formData, serviceType: value as ServiceType })}
                >
                  <SelectTrigger id="serviceType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableServiceTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Service Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Full Day Daycare"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Internal Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Internal notes and description"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerFacingDescription">Customer-Facing Description</Label>
              <Textarea
                id="customerFacingDescription"
                value={formData.customerFacingDescription}
                onChange={(e) => setFormData({ ...formData, customerFacingDescription: e.target.value })}
                placeholder="Description shown to customers"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="durationMinutes">Duration (minutes)</Label>
                <Input
                  id="durationMinutes"
                  type="number"
                  value={formData.durationMinutes || ''}
                  onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacityImpact">Capacity Impact</Label>
                <Input
                  id="capacityImpact"
                  type="number"
                  value={formData.capacityImpact || ''}
                  onChange={(e) => setFormData({ ...formData, capacityImpact: parseInt(e.target.value) || 0 })}
                  placeholder="1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="requiredStaffRole">Required Staff Role</Label>
                <Input
                  id="requiredStaffRole"
                  value={formData.requiredStaffRole}
                  onChange={(e) => setFormData({ ...formData, requiredStaffRole: e.target.value })}
                  placeholder="e.g., Groomer"
                />
              </div>
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
              {initialData ? 'Update' : 'Create'} Service
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
