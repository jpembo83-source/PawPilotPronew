// ============================================================================
// SHARED CLIENT AUTH HEADERS — the ONE place that builds outbound auth headers
// ============================================================================
// Returns the user's access token in Authorization. NEVER the ANON key — the
// ANON key cannot validate JWTs server-side, so sending it as the bearer
// silently breaks auth on routes that read Authorization. See 1B.1 in
// docs/remediation-prompt-book.md.
//
// X-User-Token mirrors the same user token for transitional compatibility with
// routes that still read it directly (customers/daycare/etc.). That header is
// removed once 1B.2 retrofits those routes onto the shared requireAuth.

import { supabase } from './client';

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw new Error('Authentication error. Please log in again.');
  }
  if (!session?.access_token) {
    throw new Error('Authentication required. Please log in.');
  }

  // Refresh proactively if the token expires within five minutes — keeps long
  // requests from racing the expiry boundary.
  const nowSec = Date.now() / 1000;
  const refreshWindowSec = 5 * 60;
  let accessToken = session.access_token;

  if ((session.expires_at ?? 0) < nowSec + refreshWindowSec) {
    const { data: { session: refreshed }, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed?.access_token) {
      throw new Error('Session expired. Please log in again.');
    }
    accessToken = refreshed.access_token;
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
    'X-User-Token': `Bearer ${accessToken}`,
  };
}
