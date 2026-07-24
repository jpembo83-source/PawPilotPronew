// Lightweight editor for a household's saved addresses (named transport
// pickup/drop-off points). Replace-all persistence: every add/edit/remove
// saves the whole working list through the store. When the household has no
// persisted list yet, the primary contact's address is shown as a derived
// "Home" seed — the first save materialises it, so nothing is lost and no
// migration runs.

import { useState } from 'react';
import { MapPin, PencilSimple, Plus, Trash, CircleNotch } from '@phosphor-icons/react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { useCustomerStore } from '../../store';
import type { Household, HouseholdContact, SavedAddress } from '../../types';
import {
  effectiveSavedAddresses,
  formatSavedAddress,
  validateSavedAddress,
  MAX_SAVED_ADDRESSES,
} from '../../savedAddresses';

interface SavedAddressesCardProps {
  household: Household & { contacts?: HouseholdContact[] };
}

const emptyAddress = (): SavedAddress => ({
  id: `addr-${crypto.randomUUID()}`,
  label: '',
  line1: '',
  line2: '',
  city: '',
  postcode: '',
  country: '',
});

export function SavedAddressesCard({ household }: SavedAddressesCardProps) {
  const { saveHouseholdAddresses } = useCustomerStore();
  const addresses = effectiveSavedAddresses(household, household.contacts);

  // editingIndex: null = closed, -1 = adding, >=0 = editing that row
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<SavedAddress | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const persist = async (next: SavedAddress[]) => {
    setIsSaving(true);
    try {
      await saveHouseholdAddresses(household.id, next);
      toast.success('Saved addresses updated');
      setEditingIndex(null);
      setDraft(null);
    } catch {
      toast.error('Failed to update saved addresses');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDraft = () => {
    if (!draft || editingIndex === null) return;
    const validationError = validateSavedAddress(draft);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    const next =
      editingIndex === -1
        ? [...addresses, draft]
        : addresses.map((a, i) => (i === editingIndex ? draft : a));
    void persist(next);
  };

  const setDraftField = (field: keyof SavedAddress, value: string) => {
    setDraft(prev => (prev ? { ...prev, [field]: value } : prev));
  };

  const draftFields: Array<{ field: keyof SavedAddress; label: string; placeholder: string }> = [
    { field: 'label', label: 'Label', placeholder: 'Home, Office, Vet…' },
    { field: 'line1', label: 'Address line 1', placeholder: '12 Meadow Lane' },
    { field: 'line2', label: 'Address line 2', placeholder: '' },
    { field: 'city', label: 'City', placeholder: '' },
    { field: 'postcode', label: 'Postcode', placeholder: '' },
    { field: 'country', label: 'Country', placeholder: '' },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Saved Addresses</CardTitle>
            <CardDescription>
              Pick-up and drop-off options offered when booking transport
            </CardDescription>
          </div>
          {editingIndex === null && addresses.length < MAX_SAVED_ADDRESSES && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDraft(emptyAddress());
                setEditingIndex(-1);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {addresses.length === 0 && editingIndex === null && (
          <div className="text-center py-6 text-slate-400">
            <MapPin className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">No addresses on file</p>
          </div>
        )}

        {addresses.map((address, index) => (
          <div
            key={address.id}
            className="flex items-start justify-between gap-3 p-3 border rounded-lg"
          >
            <div className="min-w-0">
              <p className="font-medium text-sm">{address.label}</p>
              <p className="text-sm text-slate-600">{formatSavedAddress(address)}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Edit ${address.label}`}
                disabled={isSaving || editingIndex !== null}
                onClick={() => {
                  setDraft({ ...address });
                  setEditingIndex(index);
                }}
              >
                <PencilSimple className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${address.label}`}
                disabled={isSaving || editingIndex !== null}
                onClick={() => void persist(addresses.filter((_, i) => i !== index))}
              >
                <Trash className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          </div>
        ))}

        {editingIndex !== null && draft && (
          <div className="p-3 border rounded-lg space-y-3 bg-slate-50">
            <div className="grid grid-cols-2 gap-3">
              {draftFields.map(({ field, label, placeholder }) => (
                <div key={field} className="space-y-1.5">
                  <Label htmlFor={`saved-address-${field}`}>{label}</Label>
                  <Input
                    id={`saved-address-${field}`}
                    value={draft[field] ?? ''}
                    onChange={e => setDraftField(field, e.target.value)}
                    placeholder={placeholder}
                    disabled={isSaving}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isSaving}
                onClick={() => {
                  setEditingIndex(null);
                  setDraft(null);
                }}
              >
                Cancel
              </Button>
              <Button size="sm" disabled={isSaving} onClick={handleSaveDraft}>
                {isSaving && <CircleNotch className="h-4 w-4 mr-1 animate-spin" />}
                {editingIndex === -1 ? 'Add Address' : 'Save Address'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
