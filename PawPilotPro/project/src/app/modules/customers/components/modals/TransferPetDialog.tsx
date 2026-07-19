// Move a pet to a new family (rehomed / adopted). Search the destination
// household, then confirm what travels with the dog: pet-scoped flags and
// documents, vaccination + visit history (pet-keyed, follows automatically),
// and upcoming bookings. Past visits and billing stay with the old family.
import { useEffect, useState } from 'react';
import { useCustomerStore } from '../../store';
import { useDaycareStore } from '../../../daycare/store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { MagnifyingGlass, CircleNotch, ArrowRight, House } from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { CustomerSearchResult } from '../../../daycare/types';

interface TransferPetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pet: { id: string; name: string; household_id: string };
  currentHouseholdName?: string;
  /** Called after a successful transfer so the page can refetch. */
  onTransferred: () => void;
}

export function TransferPetDialog({ open, onOpenChange, pet, currentHouseholdName, onTransferred }: TransferPetDialogProps) {
  const { transferPet } = useCustomerStore();
  const { searchCustomers } = useDaycareStore();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [target, setTarget] = useState<CustomerSearchResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setTarget(null);
      setSubmitting(false);
    }
  }, [open]);

  // Debounced live search, same pattern as the booking dialog. The current
  // household is filtered out — you can't move a dog to where it already is.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      setSearching(true);
      searchCustomers(query)
        .then(found => setResults(found.filter(r => r.household_id !== pet.household_id)))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query, pet.household_id]);

  const handleTransfer = async () => {
    if (!target) return;
    setSubmitting(true);
    try {
      const result = await transferPet(pet.id, target.household_id);
      const m = result.moved;
      const movedBits = [
        m.flags > 0 ? `${m.flags} flag${m.flags === 1 ? '' : 's'}` : null,
        m.documents > 0 ? `${m.documents} document${m.documents === 1 ? '' : 's'}` : null,
        m.daycare_bookings + m.overnight_reservations + m.grooming_appointments > 0
          ? `${m.daycare_bookings + m.overnight_reservations + m.grooming_appointments} upcoming booking(s)`
          : null,
      ].filter(Boolean).join(', ');
      toast.success(
        `${pet.name} moved to ${target.household_name}${movedBits ? ` — ${movedBits} transferred` : ''}`,
      );
      onOpenChange(false);
      onTransferred();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to move pet');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Move {pet.name} to a new family</DialogTitle>
          <DialogDescription>
            For a dog that has been rehomed or adopted. Flags and history move with the dog;
            past visits and billing stay with the previous family.
          </DialogDescription>
        </DialogHeader>

        {!target ? (
          <div className="space-y-3">
            <div className="relative">
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                autoFocus
                placeholder="Search for the new household…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10"
              />
              {searching && (
                <CircleNotch className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
              )}
            </div>

            {results.length > 0 && (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {results.map(r => (
                  <button
                    key={r.household_id}
                    type="button"
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3 min-h-[44px]"
                    onClick={() => setTarget(r)}
                  >
                    <House className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-900">{r.household_name}</span>
                  </button>
                ))}
              </div>
            )}
            {query.trim().length >= 2 && !searching && results.length === 0 && (
              <p className="text-sm text-slate-500 px-1">
                No other households found. The new family needs a customer record first —
                create it under Customers, then move {pet.name}.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3 py-2 text-sm font-medium">
              <span className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700">
                {currentHouseholdName || 'Current family'}
              </span>
              <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
                {target.household_name}
              </span>
            </div>

            <ul className="text-sm text-slate-600 space-y-1.5">
              <li>• {pet.name}'s flags (behaviour, medical) move to the new family</li>
              <li>• Vaccinations, photos and visit history follow the dog</li>
              <li>• Upcoming bookings are re-assigned to the new family</li>
              <li>• Past visits and billing stay with the previous family</li>
              <li>• The new family will need their own portal invite</li>
            </ul>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setTarget(null)} disabled={submitting}>
                Back
              </Button>
              <Button onClick={() => void handleTransfer()} disabled={submitting}>
                {submitting ? (
                  <>
                    <CircleNotch className="h-4 w-4 mr-2 animate-spin" />
                    Moving…
                  </>
                ) : (
                  `Move ${pet.name}`
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
