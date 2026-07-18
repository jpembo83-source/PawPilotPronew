// Customer membership assignment routes — the /customer-packages surface.
//
// This is the backend the packages module (AssignMembershipDialog,
// HouseholdDetailPage, CreateBookingDialog membership lookup) has been calling
// all along; until this module existed every call 404'd and the UI silently
// degraded to PAYG. Phase 1 of docs/MEMBERSHIP_SYSTEM_PLAN.md.
//
// Contract (fixed by src/app/modules/packages/store.ts):
//   GET  /customer-packages?customer_id=&status=   -> { packages: CustomerPackage[] }
//   POST /customer-packages { customer_id, package_id } -> CustomerPackage (201, unwrapped)
//   POST /customer-packages/:id/use { pet_id, credits, booking_id? } -> { package }
//   POST /customer-packages/:id/cancel -> { package }
//
// Keys are tenant-scoped like the customers module:
//   customer_membership:{tenantId}:{id}
//   membership_usage:{tenantId}:{membershipId}:{usageId}

import { Hono } from 'npm:hono';
import { z } from 'npm:zod';
import * as kv from './kv_store.tsx';
import { requireAuth, requireRole } from './_shared/auth.ts';
import { internalError, logInfo, logWarn } from './_shared/log.ts';
import {
  buildMembership,
  consumeCredits,
  getPlanById,
  normalizeCatalogPlan,
  type CustomerMembership,
  type MembershipPlan,
} from './lib/membership_catalog.ts';
import { recordMembershipInvoice, withDueRenewal } from './lib/membership_store.ts';

const app = new Hono();

app.use('*', requireAuth);

const membershipKey = (tenantId: string, id: string) =>
  `customer_membership:${tenantId}:${id}`;

/**
 * Resolve an assignable plan: the KV catalog (managed at Settings → Services
 * & Pricing → Memberships, stored at membership:{id}) is the source of truth;
 * the compiled MO01–MO05 catalog covers ids the KV has no record for. A KV
 * record that exists but is archived (isActive false) or can't drive
 * day-based coverage resolves to nothing — no silent fallback past an
 * explicit admin decision.
 */
async function resolveAssignablePlan(planId: string): Promise<MembershipPlan | undefined> {
  const kvPlan = await kv.get(`membership:${planId}`);
  if (kvPlan) {
    if ((kvPlan as { isActive?: boolean }).isActive === false) return undefined;
    return normalizeCatalogPlan(kvPlan) ?? undefined;
  }
  return getPlanById(planId);
}

const assignSchema = z.object({
  customer_id: z.string().min(1),
  package_id: z.string().min(1),
});

const useSchema = z.object({
  pet_id: z.string().min(1),
  credits: z.number().int().positive(),
  booking_id: z.string().optional(),
});

app.get('/customer-packages', async (c) => {
  try {
    const user = c.get('user');
    const { customer_id, status } = c.req.query();

    let memberships = (await kv.getByPrefix(
      `customer_membership:${user.tenantId}:`,
    )) as CustomerMembership[];
    if (customer_id) {
      memberships = memberships.filter((m) => m.customer_id === customer_id);
    }
    // Lazy renewal before any filtering — a due top-up can flip 'exhausted'
    // back to 'active', and status filters must see the post-renewal state.
    memberships = await Promise.all(
      memberships.map((m) => withDueRenewal(user.tenantId, m)),
    );
    if (status) {
      memberships = memberships.filter((m) => m.status === status);
    }
    memberships.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    return c.json({ packages: memberships });
  } catch (err) {
    return internalError(c, 'memberships.list', err);
  }
});

app.post('/customer-packages', requireRole('admin', 'manager'), async (c) => {
  try {
    const user = c.get('user');
    const parsed = assignSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: 'invalid_request' }, 400);
    }
    const { customer_id, package_id } = parsed.data;

    const plan = await resolveAssignablePlan(package_id);
    if (!plan) {
      return c.json({ error: 'unknown_plan' }, 400);
    }

    const household = await kv.get(
      `customer:${user.tenantId}:household:${customer_id}`,
    );
    if (!household) {
      return c.json({ error: 'household_not_found' }, 404);
    }

    const existing = (await kv.getByPrefix(
      `customer_membership:${user.tenantId}:`,
    )) as CustomerMembership[];
    // Exhausted blocks too: lazy renewal will top it back up next period, so
    // assigning a second plan alongside it would leave two live memberships.
    const alreadyLive = existing.find(
      (m) =>
        m.customer_id === customer_id && (m.status === 'active' || m.status === 'exhausted'),
    );
    if (alreadyLive) {
      return c.json({ error: 'membership_already_active' }, 409);
    }

    const membership = buildMembership({
      id: crypto.randomUUID(),
      customerId: customer_id,
      plan,
      createdBy: user.id,
      now: new Date(),
    });

    await kv.set(membershipKey(user.tenantId, membership.id), membership);
    logInfo('memberships.assigned', {
      membershipId: membership.id,
      planId: plan.id,
      householdId: customer_id,
    });
    // First billing period invoices at assignment; renewal invoices the rest.
    // Invoicing failure never rolls back the assignment (finance follow-up).
    try {
      await recordMembershipInvoice(user.tenantId, membership, 1, 'assignment');
    } catch (err) {
      logWarn('memberships.invoice_failed', {
        membershipId: membership.id,
        periods: 1,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }

    // Unwrapped object: purchasePackage() parses the body as CustomerPackage.
    return c.json(membership, 201);
  } catch (err) {
    return internalError(c, 'memberships.assign', err);
  }
});

app.post('/customer-packages/:id/use', async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    if (!id) {
      return c.json({ error: 'membership_not_found' }, 404);
    }
    const parsed = useSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: 'invalid_request' }, 400);
    }
    const { pet_id, credits, booking_id } = parsed.data;

    const key = membershipKey(user.tenantId, id);
    const stored = (await kv.get(key)) as CustomerMembership | undefined;
    if (!stored) {
      return c.json({ error: 'membership_not_found' }, 404);
    }
    const membership = await withDueRenewal(user.tenantId, stored);

    const result = consumeCredits(membership, credits, new Date());
    if (result === 'not_active') {
      return c.json({ error: 'membership_not_active' }, 409);
    }
    if (result === 'invalid_credits') {
      return c.json({ error: 'invalid_request' }, 400);
    }
    if (result === 'insufficient_credits') {
      return c.json({ error: 'insufficient_credits' }, 409);
    }

    const usageId = crypto.randomUUID();
    await kv.set(`membership_usage:${user.tenantId}:${id}:${usageId}`, {
      id: usageId,
      customer_package_id: id,
      booking_id: booking_id ?? null,
      pet_id,
      credits_used: credits,
      created_at: new Date().toISOString(),
      created_by: user.id,
    });
    await kv.set(key, result);
    logInfo('memberships.credits_used', {
      membershipId: id,
      credits,
      remaining: result.credits_remaining ?? 'unlimited',
    });

    return c.json({ package: result });
  } catch (err) {
    return internalError(c, 'memberships.useCredits', err);
  }
});

app.post('/customer-packages/:id/cancel', requireRole('admin', 'manager'), async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    if (!id) {
      return c.json({ error: 'membership_not_found' }, 404);
    }

    const key = membershipKey(user.tenantId, id);
    const membership = (await kv.get(key)) as CustomerMembership | undefined;
    if (!membership) {
      return c.json({ error: 'membership_not_found' }, 404);
    }
    if (membership.status === 'cancelled') {
      return c.json({ error: 'membership_already_cancelled' }, 409);
    }

    const cancelled: CustomerMembership = {
      ...membership,
      status: 'cancelled',
      subscription_status: 'cancelled',
      updated_at: new Date().toISOString(),
    };
    await kv.set(key, cancelled);
    logInfo('memberships.cancelled', { membershipId: id });

    return c.json({ package: cancelled });
  } catch (err) {
    return internalError(c, 'memberships.cancel', err);
  }
});

export default app;
