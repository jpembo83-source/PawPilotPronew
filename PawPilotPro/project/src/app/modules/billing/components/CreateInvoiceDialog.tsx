// CreateInvoiceDialog — create a draft invoice for a household
// Wires the existing billing store createInvoice action (POST /invoices)
// to a minimal line-item form. Invoices are created as drafts; issuing
// remains a separate step.

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { Plus, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useBillingStore } from '../store';
import { useCustomerStore } from '../../customers/store';
import { useSettingsStore } from '../../settings/store';
import { useDashboardStore } from '../../dashboard/store';
import { useAuth } from '../../../context/AuthContext';
import { useCurrency } from '../../../utils/currency';

interface LineItemDraft {
  service_name: string;
  quantity: string;
  unit_price: string;
}

const EMPTY_LINE: LineItemDraft = { service_name: '', quantity: '1', unit_price: '' };

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateInvoiceDialog({ open, onOpenChange }: CreateInvoiceDialogProps) {
  const { createInvoice } = useBillingStore();
  const { households, fetchHouseholds } = useCustomerStore();
  const { locations } = useSettingsStore();
  const { selectedLocationId } = useDashboardStore();
  const { user } = useAuth();
  const { format: formatCurrency } = useCurrency();

  const [householdId, setHouseholdId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([{ ...EMPTY_LINE }]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const preselectedLocationId = selectedLocationId !== 'ALL' ? selectedLocationId : '';

  useEffect(() => {
    if (!open) return;
    if (households.length === 0) {
      void fetchHouseholds();
    }
    // Preselect the location the user is already working in
    if (preselectedLocationId) {
      setLocationId(preselectedLocationId);
    }
  }, [open, households.length, fetchHouseholds, preselectedLocationId]);

  const resetForm = () => {
    setHouseholdId('');
    setLocationId(preselectedLocationId);
    setLineItems([{ ...EMPTY_LINE }]);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && !isSubmitting) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  const updateLine = (index: number, field: keyof LineItemDraft, value: string) => {
    setLineItems(prev => prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  };

  const addLine = () => setLineItems(prev => [...prev, { ...EMPTY_LINE }]);

  const removeLine = (index: number) =>
    setLineItems(prev => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const total = lineItems.reduce((sum, line) => {
    const qty = parseFloat(line.quantity);
    const price = parseFloat(line.unit_price);
    if (isNaN(qty) || isNaN(price)) return sum;
    return sum + qty * price;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const household = households.find(h => h.id === householdId);
    if (!household) {
      toast.error('Please select a household');
      return;
    }
    const location = locations.find(l => l.id === locationId);
    if (!location) {
      toast.error('Please select a location');
      return;
    }
    for (const [i, line] of lineItems.entries()) {
      if (!line.service_name.trim()) {
        toast.error(`Line ${i + 1}: please enter a description`);
        return;
      }
      const qty = parseFloat(line.quantity);
      if (isNaN(qty) || qty <= 0) {
        toast.error(`Line ${i + 1}: quantity must be greater than zero`);
        return;
      }
      const price = parseFloat(line.unit_price);
      if (isNaN(price) || price < 0) {
        toast.error(`Line ${i + 1}: please enter a valid unit price`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const invoice = await createInvoice({
        household_id: household.id,
        household_name: household.name,
        location_id: location.id,
        location_name: location.name,
        line_items: lineItems.map(line => ({
          service_id: 'manual',
          service_name: line.service_name.trim(),
          module: 'billing',
          quantity: parseFloat(line.quantity),
          unit_price: parseFloat(line.unit_price),
        })),
        created_by: user?.email || user?.id || 'staff',
      });
      toast.success(`Draft invoice ${invoice.invoice_number} created for ${household.name}`);
      resetForm();
      onOpenChange(false);
    } catch {
      toast.error('Failed to create invoice — please try again');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
          <DialogDescription>
            Creates a draft invoice. You can review and issue it from the invoice list.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoice-household">
                Household <span className="text-red-500">*</span>
              </Label>
              <Select value={householdId} onValueChange={setHouseholdId}>
                <SelectTrigger id="invoice-household">
                  <SelectValue placeholder="Select household" />
                </SelectTrigger>
                <SelectContent>
                  {households.map(h => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice-location">
                Location <span className="text-red-500">*</span>
              </Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger id="invoice-location">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              Line items <span className="text-red-500">*</span>
            </Label>
            <div className="space-y-2">
              {lineItems.map((line, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <Input
                    value={line.service_name}
                    onChange={(e) => updateLine(index, 'service_name', e.target.value)}
                    placeholder="Description (e.g. Daycare — full day)"
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={line.quantity}
                    onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                    placeholder="Qty"
                    className="w-20"
                    aria-label={`Line ${index + 1} quantity`}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unit_price}
                    onChange={(e) => updateLine(index, 'unit_price', e.target.value)}
                    placeholder="Price"
                    className="w-28"
                    aria-label={`Line ${index + 1} unit price`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLine(index)}
                    disabled={lineItems.length === 1}
                    aria-label={`Remove line ${index + 1}`}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-4 w-4 mr-1" />
              Add line
            </Button>
          </div>

          <div className="flex justify-end text-sm text-slate-600">
            Total: <span className="font-semibold text-slate-900 ml-1">{formatCurrency(total)}</span>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create draft invoice'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
