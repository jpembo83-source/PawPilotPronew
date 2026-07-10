// Households list pipeline: filter → sort → page → enrich, extracted from
// GET /customers/households as pure functions so the composition of
// filters + sort + pagination is unit-testable without Deno/KV
// (tests/unit/household-list.test.ts).
//
// Pagination follows the messaging threads convention (limit/offset over
// the filtered, sorted set; total = filtered count before slicing), so
// filters compose with pagination server-side rather than post-filtering
// a page on the client.

export interface HouseholdRecord {
  id: string;
  name?: string;
  status?: string;
  vip?: boolean;
  payment_hold?: boolean;
  primary_location_id?: string;
  primary_contact_id?: string;
}

export interface ContactRecord {
  id: string;
  household_id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
}

export interface PetRecord {
  household_id: string;
  name?: string;
}

export interface HouseholdListQuery {
  search?: string;
  status?: string;
  vip?: boolean;
  payment_hold?: boolean;
  location_id?: string;
  sort?: 'name' | 'primary_contact';
  dir?: 'asc' | 'desc';
  /** Omit limit to return the full filtered set (legacy array response). */
  limit?: number;
  offset?: number;
}

export interface EnrichedHousehold<C> {
  contacts_count: number;
  pets_count: number;
  primary_contact: C | null;
}

export interface HouseholdListResult<H extends HouseholdRecord, C extends ContactRecord> {
  rows: Array<H & EnrichedHousehold<C>>;
  total: number;
}

function groupByHousehold<T extends { household_id: string }>(records: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const record of records) {
    const list = grouped.get(record.household_id);
    if (list) list.push(record);
    else grouped.set(record.household_id, [record]);
  }
  return grouped;
}

export function listHouseholds<H extends HouseholdRecord, C extends ContactRecord, P extends PetRecord>(
  households: H[],
  contacts: C[],
  pets: P[],
  query: HouseholdListQuery,
): HouseholdListResult<H, C> {
  const contactsByHousehold = groupByHousehold(contacts);
  const petsByHousehold = groupByHousehold(pets);

  const primaryContactOf = (h: H): C | null => {
    const householdContacts = contactsByHousehold.get(h.id) ?? [];
    return householdContacts.find((c) => c.id === h.primary_contact_id) ?? null;
  };

  // Filter (same matching rules the route always had)
  let filtered = households;

  if (query.search) {
    const searchLower = query.search.toLowerCase();
    filtered = filtered.filter((h) => {
      if (h.name?.toLowerCase().includes(searchLower)) return true;

      const householdContacts = contactsByHousehold.get(h.id) ?? [];
      const contactMatch = householdContacts.some((c) =>
        c.first_name?.toLowerCase().includes(searchLower) ||
        c.last_name?.toLowerCase().includes(searchLower) ||
        c.email?.toLowerCase().includes(searchLower) ||
        c.phone?.toLowerCase().includes(searchLower)
      );
      if (contactMatch) return true;

      const householdPets = petsByHousehold.get(h.id) ?? [];
      return householdPets.some((p) => p.name?.toLowerCase().includes(searchLower));
    });
  }

  if (query.status) {
    filtered = filtered.filter((h) => h.status === query.status);
  }
  if (query.vip) {
    filtered = filtered.filter((h) => h.vip === true);
  }
  if (query.payment_hold) {
    filtered = filtered.filter((h) => h.payment_hold === true);
  }
  if (query.location_id) {
    filtered = filtered.filter((h) => h.primary_location_id === query.location_id);
  }

  // Sort — always applied so paging is deterministic. Default: name asc.
  const sortValue = query.sort === 'primary_contact'
    ? (h: H) => {
        const contact = primaryContactOf(h);
        return contact ? `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() : '';
      }
    : (h: H) => h.name ?? '';

  const sorted = [...filtered].sort((a, b) =>
    sortValue(a).localeCompare(sortValue(b), undefined, { sensitivity: 'base' })
  );
  if (query.dir === 'desc') sorted.reverse();

  const total = sorted.length;

  // Page, then enrich only what is returned.
  const paged = query.limit === undefined
    ? sorted
    : sorted.slice(query.offset ?? 0, (query.offset ?? 0) + query.limit);

  const rows = paged.map((household) => ({
    ...household,
    contacts_count: (contactsByHousehold.get(household.id) ?? []).length,
    pets_count: (petsByHousehold.get(household.id) ?? []).length,
    primary_contact: primaryContactOf(household),
  }));

  return { rows, total };
}
