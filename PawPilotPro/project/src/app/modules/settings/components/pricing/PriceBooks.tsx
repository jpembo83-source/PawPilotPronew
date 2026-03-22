import React, { useState } from 'react';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { Switch } from '../../../../components/ui/switch';
import { Plus, Edit, Trash2, FileText, DollarSign } from 'lucide-react';
import { usePricingStore, PriceBook, PriceBookEntry, PriceBookStatus, PriceBookScope } from '../../../pricing/store';
import { useSettingsStore } from '../../store';
import { toast } from 'sonner';

export function PriceBooks() {
  const { priceBooks, createPriceBook, updatePriceBook, deletePriceBook, services } = usePricingStore();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<PriceBook | null>(null);
  const [selectedBookForEntries, setSelectedBookForEntries] = useState<PriceBook | null>(null);

  const handleCreatePriceBook = async (data: Omit<PriceBook, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await createPriceBook(data);
      toast.success('Price book created successfully');
      setIsCreateDialogOpen(false);
    } catch (e) {
      toast.error('Failed to create price book');
    }
  };

  const handleUpdatePriceBook = async (id: string, data: Partial<PriceBook>) => {
    try {
      await updatePriceBook(id, data);
      toast.success('Price book updated successfully');
      setIsEditDialogOpen(false);
      setSelectedBook(null);
    } catch (e) {
      toast.error('Failed to update price book');
    }
  };

  const handleDeletePriceBook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this price book? All entries will be deleted.')) return;
    
    try {
      await deletePriceBook(id);
      toast.success('Price book deleted successfully');
    } catch (e) {
      toast.error('Failed to delete price book');
    }
  };

  const sortedBooks = [...priceBooks].sort((a, b) => {
    // Active first, then draft, then archived
    const statusOrder = { active: 0, draft: 1, archived: 2 };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Price Books</CardTitle>
              <CardDescription>
                Define pricing for services. Only one active price book per service per location at any time.
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Price Book
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedBooks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No price books defined. Create your first price book to get started.
                  </TableCell>
                </TableRow>
              ) : (
                sortedBooks.map((book) => (
                  <TableRow key={book.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {book.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {book.scope === 'organisation' ? 'Organisation-wide' : `Location-specific`}
                      </Badge>
                    </TableCell>
                    <TableCell>{book.currency}</TableCell>
                    <TableCell>{new Date(book.effectiveDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          book.status === 'active' ? 'default' : 
                          book.status === 'draft' ? 'secondary' : 
                          'outline'
                        }
                      >
                        {book.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedBookForEntries(book)}
                        >
                          <DollarSign className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedBook(book);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePriceBook(book.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Price Book Dialog */}
      <PriceBookDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSave={handleCreatePriceBook}
        title="Create Price Book"
      />

      {/* Edit Price Book Dialog */}
      {selectedBook && (
        <PriceBookDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSave={(data) => handleUpdatePriceBook(selectedBook.id, data)}
          initialData={selectedBook}
          title="Edit Price Book"
        />
      )}

      {/* Price Book Entries Dialog */}
      {selectedBookForEntries && (
        <PriceBookEntriesDialog
          book={selectedBookForEntries}
          onClose={() => setSelectedBookForEntries(null)}
        />
      )}
    </div>
  );
}

interface PriceBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => void;
  initialData?: PriceBook;
  title: string;
}

function PriceBookDialog({ open, onOpenChange, onSave, initialData, title }: PriceBookDialogProps) {
  const { locations } = useSettingsStore();
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    currency: initialData?.currency || 'GBP',
    effectiveDate: initialData?.effectiveDate || new Date().toISOString().split('T')[0],
    scope: initialData?.scope || 'organisation' as PriceBookScope,
    locationIds: initialData?.locationIds || [],
    status: initialData?.status || 'draft' as PriceBookStatus,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      locationIds: formData.scope === 'location' ? formData.locationIds : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Price books define how much services cost. Only one active price book per service per location.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Price Book Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Standard Pricing 2025"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currency">Currency *</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => setFormData({ ...formData, currency: value })}
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="effectiveDate">Effective Date *</Label>
                <Input
                  id="effectiveDate"
                  type="date"
                  value={formData.effectiveDate}
                  onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scope">Scope *</Label>
              <Select
                value={formData.scope}
                onValueChange={(value) => setFormData({ ...formData, scope: value as PriceBookScope })}
              >
                <SelectTrigger id="scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="organisation">Organisation-wide</SelectItem>
                  <SelectItem value="location">Location-specific</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.scope === 'location' && (
              <div className="space-y-2">
                <Label>Locations *</Label>
                <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                  {locations.map(location => (
                    <div key={location.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`location-${location.id}`}
                        checked={formData.locationIds.includes(location.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setFormData({
                            ...formData,
                            locationIds: checked
                              ? [...formData.locationIds, location.id]
                              : formData.locationIds.filter(id => id !== location.id)
                          });
                        }}
                      />
                      <Label htmlFor={`location-${location.id}`} className="cursor-pointer">
                        {location.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as PriceBookStatus })}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {initialData ? 'Update' : 'Create'} Price Book
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface PriceBookEntriesDialogProps {
  book: PriceBook;
  onClose: () => void;
}

function PriceBookEntriesDialog({ book, onClose }: PriceBookEntriesDialogProps) {
  const { 
    priceBookEntries, 
    services, 
    fetchPriceBookEntries, 
    createPriceBookEntry, 
    updatePriceBookEntry, 
    deletePriceBookEntry 
  } = usePricingStore();
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PriceBookEntry | null>(null);

  React.useEffect(() => {
    fetchPriceBookEntries(book.id);
  }, [book.id]);

  const entries = priceBookEntries[book.id] || [];

  const handleCreateEntry = async (data: Omit<PriceBookEntry, 'id' | 'priceBookId' | 'createdAt' | 'updatedAt'>) => {
    try {
      await createPriceBookEntry(book.id, data);
      toast.success('Price entry created successfully');
      setIsAddingEntry(false);
    } catch (e) {
      toast.error('Failed to create price entry');
    }
  };

  const handleUpdateEntry = async (id: string, data: Partial<PriceBookEntry>) => {
    try {
      await updatePriceBookEntry(book.id, id, data);
      toast.success('Price entry updated successfully');
      setEditingEntry(null);
    } catch (e) {
      toast.error('Failed to update price entry');
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Are you sure you want to delete this price entry?')) return;
    
    try {
      await deletePriceBookEntry(book.id, id);
      toast.success('Price entry deleted successfully');
    } catch (e) {
      toast.error('Failed to delete price entry');
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Price Entries: {book.name}</DialogTitle>
          <DialogDescription>
            Define prices for each service in this price book.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button onClick={() => setIsAddingEntry(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Price Entry
          </Button>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Base Price</TableHead>
                <TableHead>Tax Rate</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No price entries defined
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => {
                  const service = services.find(s => s.id === entry.serviceId);
                  return (
                    <TableRow key={entry.id}>
                      <TableCell>{service?.name || 'Unknown Service'}</TableCell>
                      <TableCell>{book.currency} {entry.basePrice.toFixed(2)}</TableCell>
                      <TableCell>{entry.taxRate}%</TableCell>
                      <TableCell>{entry.unit || '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingEntry(entry)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteEntry(entry.id)}
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
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>

      {/* Add Entry Dialog */}
      {isAddingEntry && (
        <PriceEntryDialog
          book={book}
          onClose={() => setIsAddingEntry(false)}
          onSave={handleCreateEntry}
        />
      )}

      {/* Edit Entry Dialog */}
      {editingEntry && (
        <PriceEntryDialog
          book={book}
          initialData={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSave={(data) => handleUpdateEntry(editingEntry.id, data)}
        />
      )}
    </Dialog>
  );
}

interface PriceEntryDialogProps {
  book: PriceBook;
  initialData?: PriceBookEntry;
  onClose: () => void;
  onSave: (data: any) => void;
}

function PriceEntryDialog({ book, initialData, onClose, onSave }: PriceEntryDialogProps) {
  const { services } = usePricingStore();
  const [formData, setFormData] = useState({
    serviceId: initialData?.serviceId || '',
    basePrice: initialData?.basePrice || 0,
    taxRate: initialData?.taxRate || 20,
    unit: initialData?.unit || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      unit: formData.unit || undefined,
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit' : 'Add'} Price Entry</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="serviceId">Service *</Label>
              <Select
                value={formData.serviceId}
                onValueChange={(value) => setFormData({ ...formData, serviceId: value })}
              >
                <SelectTrigger id="serviceId">
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {services.map(service => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="basePrice">Base Price ({book.currency}) *</Label>
                <Input
                  id="basePrice"
                  type="number"
                  step="0.01"
                  value={formData.basePrice}
                  onChange={(e) => setFormData({ ...formData, basePrice: parseFloat(e.target.value) || 0 })}
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

            <div className="space-y-2">
              <Label htmlFor="unit">Unit (optional)</Label>
              <Input
                id="unit"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="e.g., per day, per hour"
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {initialData ? 'Update' : 'Add'} Entry
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
