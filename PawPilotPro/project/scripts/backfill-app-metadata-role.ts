/**
 * Backfill app_metadata.role for every existing Supabase Auth user (1B.3).
 *
 * Why this script exists:
 *   The auth middleware now reads user.role from app_metadata (server-set,
 *   untamperable) instead of user_metadata (client-writable). If we flipped
 *   the reads without first copying every existing user's role into
 *   app_metadata, every user would default to 'staff' on their next request
 *   — locking admins out of the platform.
 *
 *   This script is the one-shot migration. It paginates every Supabase Auth
 *   user, reads their current user_metadata.role (the legacy source), and
 *   writes it to app_metadata.role iff app_metadata.role is missing or
 *   different. Idempotent — safe to re-run.
 *
 * Usage:
 *   SUPABASE_URL=https://<project>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   npx ts-node scripts/backfill-app-metadata-role.ts
 *
 *   Add --dry-run to print the plan without writing anything.
 *
 * Safety:
 *   - Requires SUPABASE_SERVICE_ROLE_KEY (admin SDK). Never run from a
 *     client environment.
 *   - Does NOT touch user_metadata — it only ADDS app_metadata.role.
 *     Existing user_metadata.role is left in place as a vestigial copy
 *     during the transition.
 *   - Falls back to 'staff' (the weakest role) if a user has no role set
 *     anywhere. That matches the post-flip middleware default and means a
 *     user with no role assigned gets the least privilege, not the most.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

const VALID_ROLES = new Set(['admin', 'manager', 'assistant_manager', 'staff']);

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    '[backfill] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. ' +
    'Refusing to run without the service-role client — there is no client-key fallback.'
  );
  process.exit(1);
}

interface Counts {
  scanned: number;
  alreadyOk: number;
  copied: number;
  defaulted: number;
  invalidRoleSeen: number;
  failed: number;
}

async function listAllUsers(supabase: SupabaseClient) {
  const users: any[] = [];
  let page = 1;
  const perPage = 1000;
  // listUsers returns at most perPage per call; paginate until empty.
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`[backfill] listUsers page ${page} failed: ${error.message}`);
    }
    if (!data?.users?.length) break;
    users.push(...data.users);
    if (data.users.length < perPage) break;
    page += 1;
  }
  return users;
}

function pickRole(user: any): string {
  const appRole = user.app_metadata?.role;
  if (typeof appRole === 'string' && VALID_ROLES.has(appRole)) return appRole;

  const userRole = user.user_metadata?.role;
  if (typeof userRole === 'string' && VALID_ROLES.has(userRole)) return userRole;

  return 'staff';
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`[backfill] starting${DRY_RUN ? ' (DRY RUN — no writes)' : ''}`);
  const users = await listAllUsers(supabase);
  console.log(`[backfill] scanned ${users.length} users`);

  const counts: Counts = {
    scanned: users.length,
    alreadyOk: 0,
    copied: 0,
    defaulted: 0,
    invalidRoleSeen: 0,
    failed: 0,
  };

  for (const user of users) {
    const currentAppRole = user.app_metadata?.role;
    const currentUserRole = user.user_metadata?.role;

    if (
      typeof currentAppRole === 'string' &&
      VALID_ROLES.has(currentAppRole) &&
      currentAppRole === currentUserRole
    ) {
      counts.alreadyOk += 1;
      continue;
    }

    const target = pickRole(user);
    const sourceLabel =
      currentAppRole === target ? 'app_metadata (already set)' :
      currentUserRole === target ? 'user_metadata' :
      'default(staff)';

    if (target === 'staff' && !VALID_ROLES.has(currentUserRole) && !VALID_ROLES.has(currentAppRole)) {
      counts.defaulted += 1;
    } else if (sourceLabel === 'user_metadata') {
      counts.copied += 1;
    }

    if (currentUserRole && !VALID_ROLES.has(currentUserRole)) {
      counts.invalidRoleSeen += 1;
      console.warn(
        `[backfill] user ${user.id} (${user.email}) has invalid user_metadata.role=${JSON.stringify(currentUserRole)} — defaulting to staff`
      );
    }

    if (DRY_RUN) {
      console.log(`[dry-run] would set app_metadata.role=${target} (from ${sourceLabel}) for ${user.email} (${user.id})`);
      continue;
    }

    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      app_metadata: { ...(user.app_metadata ?? {}), role: target },
    });
    if (error) {
      counts.failed += 1;
      console.error(`[backfill] FAILED ${user.email} (${user.id}): ${error.message}`);
      continue;
    }
    console.log(`[backfill] set app_metadata.role=${target} (from ${sourceLabel}) for ${user.email} (${user.id})`);
  }

  console.log('[backfill] done', counts);
  if (counts.failed > 0) {
    process.exit(2);
  }
}

main().catch((err) => {
  console.error('[backfill] fatal:', err);
  process.exit(1);
});
