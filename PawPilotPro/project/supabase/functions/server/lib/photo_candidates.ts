// Candidate dogs for the photo review queue's assign-at-approval flow.
//
// A bulk-captured photo knows its location and date but not its dog. The
// manager picks from a roster of dogs CHECKED IN at that location on that
// date (same source as daycare /attendance/today: the daycare:booking:* KV
// family), with a search-all-pets fallback for edge cases (dog checked in
// late, overnight guest, data mishap).
//
// Pure filters live here so they unit-test without KV; the route supplies
// the scanned records and signs profile-photo URLs (lib/pet_photos.ts).

export interface CandidatePet {
  pet_id: string;
  pet_name: string;
  household_id?: string;
  /** Stored photo reference (path or legacy URL) — sign before serving. */
  pet_photo_stored?: string;
  source: "checked_in" | "search";
}

/** Loose shape of a daycare booking KV record (see daycare_routes). */
interface BookingLike {
  pet_id?: unknown;
  pet_name?: unknown;
  household_id?: unknown;
  pet_photo_url?: unknown;
  booking_date?: unknown;
  date?: unknown;
  check_in_status?: unknown;
  location_id?: unknown;
}

/** Loose shape of a customer pet KV record (customer:{t}:pet:{hh}:{id}). */
interface PetRecordLike {
  id?: unknown;
  name?: unknown;
  household_id?: unknown;
  photo_path?: unknown;
  photo_url?: unknown;
  active?: unknown;
}

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

/** Dogs checked in at `locationId` on `date`, deduped by pet. Mirrors the
 *  /attendance/today filter (booking_date OR date; check_in_status). */
export function candidatesFromBookings(
  bookings: unknown[],
  opts: { date: string; locationId?: string },
): CandidatePet[] {
  const byPet = new Map<string, CandidatePet>();
  for (const raw of bookings) {
    if (!raw || typeof raw !== "object") continue;
    const b = raw as BookingLike;
    const bookingDate = str(b.booking_date) ?? str(b.date);
    if (bookingDate !== opts.date) continue;
    if (b.check_in_status !== "checked_in") continue;
    if (opts.locationId && opts.locationId !== "ALL" && str(b.location_id) !== opts.locationId) {
      continue;
    }
    const petId = str(b.pet_id);
    if (!petId || byPet.has(petId)) continue;
    byPet.set(petId, {
      pet_id: petId,
      pet_name: str(b.pet_name) ?? "Unknown",
      household_id: str(b.household_id),
      pet_photo_stored: str(b.pet_photo_url),
      source: "checked_in",
    });
  }
  return [...byPet.values()].sort((a, b) => a.pet_name.localeCompare(b.pet_name));
}

/** Name-search fallback across the tenant's pets (KV scan supplied by the
 *  route). Case-insensitive substring match, active pets first. */
export function searchPetCandidates(
  pets: unknown[],
  query: string,
  limit = 20,
): CandidatePet[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matches: Array<CandidatePet & { activeRank: number }> = [];
  for (const raw of pets) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as PetRecordLike;
    const id = str(p.id);
    const name = str(p.name);
    if (!id || !name || !name.toLowerCase().includes(q)) continue;
    matches.push({
      pet_id: id,
      pet_name: name,
      household_id: str(p.household_id),
      pet_photo_stored: str(p.photo_path) ?? str(p.photo_url),
      source: "search",
      activeRank: p.active === false ? 1 : 0,
    });
  }
  return matches
    .sort((a, b) => a.activeRank - b.activeRank || a.pet_name.localeCompare(b.pet_name))
    .slice(0, limit)
    .map(({ activeRank: _activeRank, ...candidate }) => candidate);
}

/** Resolve one pet by id from the tenant's pet records — the server-side
 *  source of truth for assignment (name + household are NEVER taken from the
 *  client). */
export function resolvePetById(
  pets: unknown[],
  petId: string,
): { petId: string; petName: string; householdId?: string } | null {
  for (const raw of pets) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as PetRecordLike;
    if (str(p.id) !== petId) continue;
    return {
      petId,
      petName: str(p.name) ?? "Unknown",
      householdId: str(p.household_id),
    };
  }
  return null;
}
