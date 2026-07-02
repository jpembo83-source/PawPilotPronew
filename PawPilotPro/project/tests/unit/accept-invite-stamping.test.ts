import { describe, it, expect, vi, beforeEach } from 'vitest';
import './setup';

// Phase 4 prerequisite (PHASE4_DATA_MIGRATION.md §7.1): accept-invite must
// stamp tenant_id + household_id into app_metadata (server-set, untamperable)
// — they are the JWT claims the customers RLS policies key on. These tests
// pin that behaviour on both the new-user and existing-account merge paths.

const kvStore = new Map<string, unknown>();
vi.mock('../../supabase/functions/server/kv_store.tsx', () => ({
  get: vi.fn((key: string) => Promise.resolve(kvStore.get(key) ?? null)),
  set: vi.fn((key: string, value: unknown) => Promise.resolve(void kvStore.set(key, value))),
  del: vi.fn((key: string) => Promise.resolve(void kvStore.delete(key))),
  mget: vi.fn((keys: string[]) => Promise.resolve(keys.map((k) => kvStore.get(k) ?? null))),
  mset: vi.fn(() => Promise.resolve()),
  mdel: vi.fn(() => Promise.resolve()),
  getByPrefix: vi.fn((prefix: string) =>
    Promise.resolve(
      [...kvStore.entries()].filter(([k]) => k.startsWith(prefix)).map(([, v]) => v),
    ),
  ),
}));

type AppMeta = Record<string, unknown>;
interface AuthUserStub {
  id: string;
  email?: string;
  app_metadata?: AppMeta;
}
interface AuthError {
  message: string;
}

const createUser = vi.fn<
  (attrs: {
    email: string;
    password?: string;
    email_confirm?: boolean;
    app_metadata?: AppMeta;
    user_metadata?: AppMeta;
  }) => Promise<{ data: { user: AuthUserStub | null }; error: AuthError | null }>
>();
const updateUserById = vi.fn<
  (
    id: string,
    update: { app_metadata?: AppMeta; password?: string; email_confirm?: boolean },
  ) => Promise<{ error: AuthError | null }>
>();
const listUsers = vi.fn<
  (opts: {
    page?: number;
    perPage?: number;
  }) => Promise<{ data: { users: AuthUserStub[] }; error: AuthError | null }>
>();
const signInWithPassword = vi.fn<
  (creds: {
    email: string;
    password: string;
  }) => Promise<{ data: { session: unknown }; error: AuthError | null }>
>();
vi.mock('npm:@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn(),
      signInWithPassword,
      admin: { createUser, updateUserById, listUsers, getUserById: vi.fn(), generateLink: vi.fn() },
    },
  }),
}));

import portal from '../../supabase/functions/server/portal_routes.tsx';

const TENANT = 'demo-tenant-001';
const HOUSEHOLD = 'hh_1717000000_ab12';
const TOKEN = 'a'.repeat(64);

function seedInvite() {
  kvStore.clear();
  kvStore.set(`portal_invites:${TENANT}:${TOKEN}`, {
    customerId: HOUSEHOLD,
    tenantId: TENANT,
    token: TOKEN,
    email: 'owner@example.com',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    consumedAt: null,
  });
}

function acceptInvite() {
  return portal.request('/auth/accept-invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: TOKEN, password: 'correct-horse-battery' }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  seedInvite();
  signInWithPassword.mockResolvedValue({ data: { session: null }, error: { message: 'smtp' } });
});

describe('accept-invite stamps portal claims into app_metadata', () => {
  it('new account: createUser carries tenant_id + household_id + portal_user in app_metadata', async () => {
    createUser.mockResolvedValue({ data: { user: { id: 'auth_new' } }, error: null });

    const res = await acceptInvite();
    expect(res.status).toBe(200);

    expect(createUser).toHaveBeenCalledTimes(1);
    const arg = createUser.mock.calls[0][0];
    expect(arg.app_metadata).toEqual({
      portal_user: true,
      tenant_id: TENANT,
      household_id: HOUSEHOLD,
    });
    // Claims must never land in client-writable user_metadata.
    expect(arg.user_metadata).toBeUndefined();

    // The server-written link the portal auth guard cross-checks against.
    const link = kvStore.get(`portal_users:${TENANT}:${HOUSEHOLD}`) as { authUserId: string };
    expect(link?.authUserId).toBe('auth_new');
  });

  it('existing account: merge preserves prior app_metadata and adds the claims', async () => {
    createUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'A user with this email address has already been registered' },
    });
    listUsers.mockResolvedValue({
      data: {
        users: [
          { id: 'auth_staff', email: 'owner@example.com', app_metadata: { role: 'staff' } },
        ],
      },
      error: null,
    });
    updateUserById.mockResolvedValue({ error: null });

    const res = await acceptInvite();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { reusedExistingAccount?: boolean };
    expect(body.reusedExistingAccount).toBe(true);

    expect(updateUserById).toHaveBeenCalledTimes(1);
    const [id, update] = updateUserById.mock.calls[0];
    expect(id).toBe('auth_staff');
    expect(update.app_metadata).toEqual({
      role: 'staff', // staff access untouched by the merge
      portal_user: true,
      tenant_id: TENANT,
      household_id: HOUSEHOLD,
    });
    expect(update.password).toBeUndefined(); // never overwrite an existing password
  });

  it('consumed invite is rejected without touching auth', async () => {
    kvStore.set(`portal_invites:${TENANT}:${TOKEN}`, {
      ...(kvStore.get(`portal_invites:${TENANT}:${TOKEN}`) as object),
      consumedAt: new Date().toISOString(),
    });

    const res = await acceptInvite();
    expect(res.status).toBe(410);
    expect(createUser).not.toHaveBeenCalled();
    expect(updateUserById).not.toHaveBeenCalled();
  });
});
