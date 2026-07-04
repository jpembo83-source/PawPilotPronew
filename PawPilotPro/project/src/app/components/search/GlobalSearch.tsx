// Global dog search — a command palette mounted at the layout level.
// Cmd/Ctrl+K (desktop) or the mobile header search icon opens it from any
// screen. Reuses the daycare search endpoint (same debounced searchCustomers
// the walk-in panel uses) and the daycare check-in/check-out dialogs — no
// forked logic, no new backend.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Dog, House, Warning, FirstAidKit, SignIn, SignOut } from '@phosphor-icons/react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import { usePermissions } from '../../hooks/usePermissions';
import { useDaycareStore } from '../../modules/daycare/store';
import { CheckInDialog } from '../../modules/daycare/components/CheckInDialog';
import { CheckOutDialog } from '../../modules/daycare/components/CheckOutDialog';
import type {
  CustomerSearchPet,
  CustomerSearchResult,
  DaycareBooking,
  CheckInValidation,
} from '../../modules/daycare/types';

interface PetHit {
  pet: CustomerSearchPet;
  householdId: string;
  householdName: string;
}

type PetAction = { type: 'checkin' | 'checkout'; booking: DaycareBooking };

interface GlobalSearchProps {
  /** Controlled open state (used by MobileLayout's header button). Omit for uncontrolled (Cmd/Ctrl+K only). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function GlobalSearch({ open: controlledOpen, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate();
  const { canAccessModule } = usePermissions();
  const { searchCustomers, listBookings, validateCheckIn } = useDaycareStore();

  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (isControlled) onOpenChange?.(next);
    else setInternalOpen(next);
  };

  const [query, setQuery]                 = useState('');
  const [results, setResults]             = useState<CustomerSearchResult[]>([]);
  const [searching, setSearching]         = useState(false);
  const [todayBookings, setTodayBookings] = useState<DaycareBooking[]>([]);
  const debounceRef                       = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check-in/out dialog state — the exact daycare dialogs, hosted here
  const [checkInBooking, setCheckInBooking]       = useState<DaycareBooking | null>(null);
  const [checkInValidation, setCheckInValidation] = useState<CheckInValidation | null>(null);
  const [checkOutBooking, setCheckOutBooking]     = useState<DaycareBooking | null>(null);

  const canCustomers = canAccessModule('customers');
  const canDaycare   = canAccessModule('daycare');
  const enabled      = canCustomers || canDaycare;

  // Cmd/Ctrl+K toggles from anywhere
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  });

  // Reset when the palette closes
  useEffect(() => {
    if (!open) { setQuery(''); setResults([]); }
  }, [open]);

  // Live search with debounce — same endpoint and cadence as the walk-in panel
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      void (async () => {
        try {
          const res = await searchCustomers(query.trim());
          setResults(res);
        } catch { /* silent */ }
        finally { setSearching(false); }
      })();
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, open]);

  // Today's bookings tell us which pets can be checked in/out right now.
  // Reuses the existing bookings endpoint; fetched once per palette open.
  useEffect(() => {
    if (!open || !canDaycare) return;
    let cancelled = false;
    const today = new Date().toISOString().split('T')[0];
    listBookings({ date: today })
      .then(bookings => { if (!cancelled) setTodayBookings(bookings); })
      .catch(() => { /* actions just won't be offered */ });
    return () => { cancelled = true; };
  }, [open, canDaycare]);

  const actionByPet = useMemo(() => {
    const map = new Map<string, PetAction>();
    for (const b of todayBookings) {
      if (b.check_in_status === 'checked_in') {
        map.set(b.pet_id, { type: 'checkout', booking: b });
      } else if (
        b.check_in_status === 'not_checked_in' &&
        b.booking_status === 'confirmed' &&
        !map.has(b.pet_id)
      ) {
        map.set(b.pet_id, { type: 'checkin', booking: b });
      }
    }
    return map;
  }, [todayBookings]);

  // Flatten household results into pet rows, best name-matches first
  const petHits = useMemo((): PetHit[] => {
    const q = query.trim().toLowerCase();
    const seen = new Set<string>();
    const hits: PetHit[] = [];
    for (const result of results) {
      for (const pet of result.pets) {
        if (seen.has(pet.id)) continue;
        seen.add(pet.id);
        hits.push({ pet, householdId: result.household_id, householdName: result.household_name });
      }
    }
    const score = (h: PetHit) => {
      const name = h.pet.name.toLowerCase();
      return name.startsWith(q) ? 2 : name.includes(q) ? 1 : 0;
    };
    return hits.sort((a, b) => score(b) - score(a));
  }, [results, query]);

  const householdHits = useMemo(() => {
    const seen = new Set<string>();
    return results.filter(r => {
      if (seen.has(r.household_id)) return false;
      seen.add(r.household_id);
      return true;
    });
  }, [results]);

  // Without customers access, pet rows hide and only check-in/out actions
  // remain — don't render an empty group heading when there are none.
  const hasPetItems =
    petHits.length > 0 &&
    (canCustomers || petHits.some(h => actionByPet.has(h.pet.id)));

  const openPetProfile = (petId: string) => {
    setOpen(false);
    void navigate(`/customers/pets/${petId}`);
  };

  const openHousehold = (householdId: string) => {
    setOpen(false);
    void navigate(`/customers/${householdId}`);
  };

  // Same flow as the check-in page: validate first, then open the dialog
  const startCheckIn = async (booking: DaycareBooking) => {
    setOpen(false);
    try {
      const validation = await validateCheckIn(booking.id);
      setCheckInValidation(validation);
      setCheckInBooking(booking);
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Failed to validate check-in');
    }
  };

  const startCheckOut = (booking: DaycareBooking) => {
    setOpen(false);
    setCheckOutBooking(booking);
  };

  if (!enabled) return null;

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        shouldFilter={false}
        title="Search"
        description="Search pets and households"
      >
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search pets and households…"
        />
        <CommandList>
          <CommandEmpty>
            {query.trim().length < 2
              ? 'Type at least 2 letters to search…'
              : searching
                ? 'Searching…'
                : 'No matches found'}
          </CommandEmpty>

          {hasPetItems && (
            <CommandGroup heading="Pets">
              {petHits.map(({ pet, householdName }) => {
                const action = canDaycare ? actionByPet.get(pet.id) : undefined;
                return (
                  <React.Fragment key={pet.id}>
                    {canCustomers && (
                      <CommandItem value={`pet-${pet.id}`} onSelect={() => openPetProfile(pet.id)}>
                        <div
                          className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden text-xs font-bold"
                          style={{ background: 'var(--primary-tint)', color: 'var(--primary)' }}
                        >
                          {pet.photo_url ? (
                            <img src={pet.photo_url} alt={pet.name} className="h-full w-full object-cover" />
                          ) : (
                            pet.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-[#1C1916]">{pet.name}</span>
                            {pet.behaviour_notes && (
                              <Warning size={13} weight="fill" className="text-amber-500 flex-shrink-0" />
                            )}
                            {pet.medical_notes && (
                              <FirstAidKit size={13} weight="fill" className="text-red-500 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-[#6B6762] truncate">{householdName}</p>
                        </div>
                      </CommandItem>
                    )}
                    {action?.type === 'checkin' && (
                      <CommandItem
                        value={`checkin-${action.booking.id}`}
                        onSelect={() => void startCheckIn(action.booking)}
                      >
                        <SignIn size={16} weight="bold" className="ml-2" style={{ color: 'var(--primary)' }} />
                        <span className="text-sm">Check in {pet.name}</span>
                      </CommandItem>
                    )}
                    {action?.type === 'checkout' && (
                      <CommandItem
                        value={`checkout-${action.booking.id}`}
                        onSelect={() => startCheckOut(action.booking)}
                      >
                        <SignOut size={16} weight="bold" className="ml-2" style={{ color: 'var(--primary)' }} />
                        <span className="text-sm">Check out {pet.name}</span>
                      </CommandItem>
                    )}
                  </React.Fragment>
                );
              })}
            </CommandGroup>
          )}

          {canCustomers && householdHits.length > 0 && (
            <CommandGroup heading="Households">
              {householdHits.map(result => (
                <CommandItem
                  key={result.household_id}
                  value={`household-${result.household_id}`}
                  onSelect={() => openHousehold(result.household_id)}
                >
                  <House size={16} className="text-[#6B6762]" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-[#1C1916]">{result.household_name}</span>
                    <p className="text-xs text-[#6B6762] truncate">
                      {result.pets.length} {result.pets.length === 1 ? 'pet' : 'pets'}
                    </p>
                  </div>
                  <Dog size={14} className="text-[#C8C4BC]" />
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>

      {/* The exact daycare dialogs — store checkIn/checkOut keep state in sync */}
      <CheckInDialog
        open={checkInBooking !== null}
        onOpenChange={o => { if (!o) { setCheckInBooking(null); setCheckInValidation(null); } }}
        booking={checkInBooking}
        validation={checkInValidation}
      />
      <CheckOutDialog
        open={checkOutBooking !== null}
        onOpenChange={o => { if (!o) setCheckOutBooking(null); }}
        booking={checkOutBooking}
      />
    </>
  );
}
