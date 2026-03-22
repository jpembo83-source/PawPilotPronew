import React, { useState, useEffect } from 'react';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { Textarea } from '../../../../components/ui/textarea';
import { Plus, Edit, Trash2, MapPin, TrendingUp, TrendingDown } from 'lucide-react';
import { usePricingStore, LocationPriceOverride } from '../../../pricing/store';
import { useSettingsStore, Location } from '../../store';
import { toast } from 'sonner';

interface LocationPricingOverridesProps {
  location: Location;
}

export function LocationPricingOverrides({ location }: LocationPricingOverridesProps) {
  const { 
    services, 
    locationOverrides, 
    getServicePrice,
    fetchLocationOverrides,
    createLocationOverride,
    updateLocationOverride,
    deleteLocationOverride
  } = usePricingStore();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedOverride, setSelectedOverride] = useState<LocationPriceOverride | null>(null);

  useEffect(() => {
    fetchLocationOverrides(location.id);
  }, [location.id]);

  const overrides = locationOverrides[location.id] || [];

  const handleCreateOverride = async (data: Omit<LocationPriceOverride, 'id' | 'locationId' | 'createdAt' | 'updatedAt'>) => {
    try {
      await createLocationOverride(location.id, data);
      toast.success('Price override created successfully');
      setIsCreateDialogOpen(false);
    } catch (e) {
      toast.error('Failed to create price override');
    }
  };

  const handleUpdateOverride = async (id: string, data: Partial<LocationPriceOverride>) => {
    try {
      await updateLocationOverride(location.id, id, data);
      toast.success('Price override updated successfully');
      setIsEditDialogOpen(false);
      setSelectedOverride(null);
    } catch (e) {
      toast.error('Failed to update price override');
    }
  };

  const handleDeleteOverride = async (id: string) => {
    if (!confirm('Are you sure you want to remove this price override? The service will revert to the base price.')) return;
    
    try {
      await deleteLocationOverride(location.id, id);
      toast.success('Price override removed successfully');
    } catch (e) {
      toast.error('Failed to remove price override');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Location Price Overrides</CardTitle>
              <CardDescription>
                Override base prices for {location.name}. Changes are logged and auditable.
              </CardDescription>
            </div>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Override
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service</TableHead>
              <TableHead>Base Price</TableHead>
              <TableHead>Override Price</TableHead>
              <TableHead>Difference</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overrides.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No price overrides for this location. Base prices apply.
                </TableCell>
              </TableRow>
            ) : (
              overrides.map((override) => {
                const service = services.find(s => s.id === override.serviceId);
                const basePrice = getServicePrice(override.serviceId) || 0;
                const difference = override.overridePrice - basePrice;
                const percentDiff = basePrice > 0 ? ((difference / basePrice) * 100).toFixed(1) : 0;
                const isIncrease = difference > 0;

                return (
                  <TableRow key={override.id}>
                    <TableCell>
                      <div>
                        <div>{service?.name || 'Unknown Service'}</div>
                        {service && (
                          <div className="text-xs text-muted-foreground">
                            {service.moduleId}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-muted-foreground">
                        £{basePrice.toFixed(2)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        £{override.overridePrice.toFixed(2)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {isIncrease ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                        <Badge variant={isIncrease ? 'default' : 'secondary'}>
                          {isIncrease ? '+' : ''}{percentDiff}%
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm max-w-xs truncate" title={override.reason}>
                        {override.reason || '—'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedOverride(override);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteOverride(override.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* Create Override Dialog */}
      <OverrideDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSave={handleCreateOverride}
        location={location}
        title="Create Price Override"
      />

      {/* Edit Override Dialog */}
      {selectedOverride && (
        <OverrideDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSave={(data) => handleUpdateOverride(selectedOverride.id, data)}
          location={location}
          initialData={selectedOverride}
          title="Edit Price Override"
        />
      )}
    </Card>
  );
}

interface OverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => void;
  location: Location;
  initialData?: LocationPriceOverride;
  title: string;
}

function OverrideDialog({ open, onOpenChange, onSave, location, initialData, title }: OverrideDialogProps) {
  const { services, getServicePrice } = usePricingStore();
  const [formData, setFormData] = useState({
    serviceId: initialData?.serviceId || '',
    overridePrice: initialData?.overridePrice || 0,
    taxRate: initialData?.taxRate || 20,
    reason: initialData?.reason || '',
  });

  const selectedService = services.find(s => s.id === formData.serviceId);
  const basePrice = formData.serviceId ? getServicePrice(formData.serviceId) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      reason: formData.reason || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Override the base price for a specific service at {location.name}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="serviceId">Service *</Label>
              <Select
                value={formData.serviceId}
                onValueChange={(value) => {
                  const service = services.find(s => s.id === value);
                  const price = getServicePrice(value);
                  setFormData({ 
                    ...formData, 
                    serviceId: value,
                    overridePrice: price || 0,
                  });
                }}
              >
                <SelectTrigger id="serviceId">
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {services.filter(s => s.status === 'active').map(service => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} ({service.moduleId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {basePrice !== null && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base Price:</span>
                  <span className="font-medium">£{basePrice.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="overridePrice">Override Price (£) *</Label>
                <Input
                  id="overridePrice"
                  type="number"
                  step="0.01"
                  value={formData.overridePrice}
                  onChange={(e) => setFormData({ ...formData, overridePrice: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxRate">Tax Rate (%) *</Label>
                <Input
                  id="taxRate"
                  type="number"
                  step="0.1"
                  value={formData.taxRate}
                  onChange={(e) => setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
            </div>

            {basePrice !== null && formData.overridePrice > 0 && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Difference:</span>
                  <div className="flex items-center gap-2">
                    {formData.overridePrice > basePrice ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                    <span className="font-medium">
                      £{Math.abs(formData.overridePrice - basePrice).toFixed(2)} 
                      ({((Math.abs(formData.overridePrice - basePrice) / basePrice) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Override</Label>
              <Textarea
                id="reason"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="e.g., Higher operating costs at this location"
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Optional but recommended for audit trail
              </p>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {initialData ? 'Update' : 'Create'} Override
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
