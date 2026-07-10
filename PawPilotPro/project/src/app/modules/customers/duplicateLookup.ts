// Client side of the duplicate-detection nudge: normalisers + the call to
// the tenant-scoped /customers/lookup endpoint.
//
// FAIL SILENT BY DESIGN: lookupDuplicates resolves to null on any failure
// (network, auth, server error). A broken duplicate check must never break —
// or even visibly degrade — customer creation; callers treat null as
// "no matches" and move on.

import { getAuthHeaders } from '@/utils/supabase/authHeaders';
import { projectId } from '../../../../utils/supabase/info';

// Normalisation rules mirror the server's (customers_routes.tsx /lookup):
// emails trim + lowercase; phones digits-only. The server adds dial-code
// tolerance when comparing phones (same trailing 10 digits).
export const normaliseEmail = (value: string) => value.trim().toLowerCase();
export const normalisePhone = (value: string) => value.replace(/\D/g, '');

export interface DuplicateContactMatch {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  household_id: string;
  household_name: string;
  matched: Array<'email' | 'phone'>;
}

export interface DuplicateHouseholdMatch {
  id: string;
  name: string;
}

export interface DuplicateLookupResult {
  contacts: DuplicateContactMatch[];
  households: DuplicateHouseholdMatch[];
}

export interface DuplicateLookupParams {
  email?: string;
  phone?: string;
  name?: string;
}

const LOOKUP_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/customers/lookup`;

export async function lookupDuplicates(
  params: DuplicateLookupParams,
  signal?: AbortSignal,
): Promise<DuplicateLookupResult | null> {
  try {
    const query = new URLSearchParams();
    const email = normaliseEmail(params.email ?? '');
    const phone = normalisePhone(params.phone ?? '');
    const name = (params.name ?? '').trim();
    if (email) query.set('email', email);
    if (phone) query.set('phone', phone);
    if (name) query.set('name', name);
    if ([...query.keys()].length === 0) {
      return { contacts: [], households: [] };
    }

    const response = await fetch(`${LOOKUP_URL}?${query.toString()}`, {
      headers: await getAuthHeaders(),
      signal,
    });
    if (!response.ok) return null;

    const body = (await response.json()) as Partial<DuplicateLookupResult>;
    return {
      contacts: Array.isArray(body.contacts) ? body.contacts : [],
      households: Array.isArray(body.households) ? body.households : [],
    };
  } catch {
    // Aborted, offline, expired session, malformed body — all deliberately
    // swallowed; the nudge simply doesn't appear.
    return null;
  }
}
