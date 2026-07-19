// Retention purge worker: finds records past a retention job's configured
// window and deletes or anonymises them. Destructive by design, so:
//   - DRY-RUN is the default everywhere: callers must explicitly opt into a
//     real purge, and the route additionally demands `confirm: true`.
//   - Referential integrity is never broken silently: records that cannot be
//     purged safely (outstanding invoice balance, financial records that must
//     outlive an erasure, active bookings) are reported as skips, not purged.
//   - Every execution — dry-run or real — writes a compliance audit entry
//     from inside this worker, so no caller can purge without an audit trail.
//
// Only kv_store is touched, so the whole worker is unit-testable with the
// standard kv mock (tests/unit/compliance-retention.test.ts).

import * as kv from "../kv_store.tsx";
import { collectSubjectData, type SubjectData } from "./compliance_export.ts";

type Rec = Record<string, unknown>;

export interface RetentionJobConfig {
  id: string;
  job_name?: string;
  job_type: "anonymisation" | "deletion" | "archival";
  data_categories: string[];
  retention_period_days: number;
}

export interface RetentionCandidate {
  key: string;
  entity_type: string;
  entity_id: string;
  record_date: string;
  action: "delete" | "anonymise";
  /** Index keys / child keys removed together with the primary record. */
  related_keys: string[];
}

export interface RetentionSkip {
  entity_type: string;
  entity_id: string;
  reason: string;
}

export interface RetentionResult {
  dry_run: boolean;
  cutoff: string;
  records_affected: number;
  records_failed: number;
  candidates: RetentionCandidate[];
  skipped: RetentionSkip[];
  categories_evaluated: string[];
  categories_unsupported: string[];
}

const SUPPORTED_CATEGORIES = new Set([
  "personal",
  "operational",
  "financial",
  "behavioural",
  "medical",
]);

const isRecord = (v: unknown): v is Rec =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v : null;

/** First parseable date among the given fields, as ISO string. */
function recordDate(rec: Rec, fields: string[]): string | null {
  for (const field of fields) {
    const raw = str(rec[field]);
    if (!raw) continue;
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

const olderThan = (dateIso: string | null, cutoffIso: string): boolean =>
  dateIso !== null && dateIso < cutoffIso;

/** Statuses that mean "still in progress" — never purge these regardless of dates. */
const ACTIVE_STATUSES = new Set([
  "active",
  "checked_in",
  "in_progress",
  "in_daycare",
  "scheduled",
  "confirmed",
  "pending",
  "pending_assignment",
]);

const isActive = (rec: Rec): boolean => {
  const status = str(rec.status);
  return status !== null && ACTIVE_STATUSES.has(status);
};

interface Collected {
  candidates: RetentionCandidate[];
  skipped: RetentionSkip[];
}

function candidate(
  key: string,
  entityType: string,
  entityId: string,
  date: string,
  action: "delete" | "anonymise",
  relatedKeys: string[] = [],
): RetentionCandidate {
  return {
    key,
    entity_type: entityType,
    entity_id: entityId,
    record_date: date,
    action,
    related_keys: relatedKeys,
  };
}

// --- operational: past bookings across all four service lines + portal requests ---

async function collectOperational(
  tenantId: string,
  cutoff: string,
): Promise<Collected> {
  const out: Collected = { candidates: [], skipped: [] };

  const push = (
    rec: Rec,
    entityType: string,
    key: string,
    date: string | null,
    relatedKeys: string[] = [],
  ) => {
    const id = str(rec.id);
    if (!id || !olderThan(date, cutoff)) return;
    if (isActive(rec)) {
      out.skipped.push({
        entity_type: entityType,
        entity_id: id,
        reason: `status "${str(rec.status)}" is still active`,
      });
      return;
    }
    out.candidates.push(candidate(key, entityType, id, date as string, "delete", relatedKeys));
  };

  const [daycare, overnight, grooming, transport, portal] = await Promise.all([
    kv.getByPrefix("daycare:booking:"),
    kv.getByPrefix(`overnight:${tenantId}:reservation:`),
    kv.getByPrefix(`grooming-apt:${tenantId}:`),
    kv.getByPrefix(`transport_job:${tenantId}:`),
    kv.getByPrefix(`portal_booking:${tenantId}:`),
  ]);

  for (const rec of (daycare ?? []).filter(isRecord)) {
    const id = str(rec.id);
    if (!id) continue; // index entries under the same prefix are plain strings
    const date = recordDate(rec, ["booking_date", "date", "created_at"]);
    // The write path maintains three index keys per booking — remove them too.
    const related: string[] = [];
    const bookingDate = str(rec.booking_date);
    const locationId = str(rec.location_id);
    const petId = str(rec.pet_id);
    const householdId = str(rec.household_id);
    if (locationId && bookingDate) {
      related.push(`daycare:booking:date:${locationId}:${bookingDate}:${id}`);
    }
    if (petId) related.push(`daycare:booking:pet:${petId}:${id}`);
    if (householdId) related.push(`daycare:booking:household:${householdId}:${id}`);
    push(rec, "daycare_booking", `daycare:booking:${id}`, date, related);
  }

  for (const rec of (overnight ?? []).filter(isRecord)) {
    const id = str(rec.id);
    if (!id) continue;
    const date = recordDate(rec, ["endDate", "end_date", "startDate", "start_date", "created_at"]);
    push(rec, "overnight_reservation", `overnight:${tenantId}:reservation:${id}`, date);
  }

  for (const rec of (grooming ?? []).filter(isRecord)) {
    const id = str(rec.id);
    if (!id) continue;
    const date = recordDate(rec, ["appointment_date", "created_at"]);
    push(rec, "grooming_appointment", `grooming-apt:${tenantId}:${id}`, date);
  }

  for (const rec of (transport ?? []).filter(isRecord)) {
    const id = str(rec.id);
    if (!id) continue;
    const date = recordDate(rec, ["date", "scheduled_date", "job_date", "created_at"]);
    push(rec, "transport_job", `transport_job:${tenantId}:${id}`, date);
  }

  for (const rec of (portal ?? []).filter(isRecord)) {
    const id = str(rec.id);
    if (!id) continue;
    const date = recordDate(rec, ["date", "booking_date", "startDate", "created_at"]);
    push(rec, "portal_booking", `portal_booking:${tenantId}:${id}`, date);
  }

  return out;
}

// --- financial: settled invoices (+ lines), their payments, spent credits ---

async function collectFinancial(cutoff: string): Promise<Collected> {
  const out: Collected = { candidates: [], skipped: [] };

  const [invoicesAll, payments, credits] = await Promise.all([
    kv.getByPrefix("invoice:"),
    kv.getByPrefix("payment:"),
    kv.getByPrefix("credit:"),
  ]);

  const TERMINAL_INVOICE_STATUSES = new Set(["paid", "void", "cancelled", "refunded", "written_off"]);
  const purgedInvoiceIds = new Set<string>();

  const invoices = (invoicesAll ?? []).filter(
    (r): r is Rec => isRecord(r) && str(r.id) !== null && "status" in r,
  );

  for (const inv of invoices) {
    const id = str(inv.id) as string;
    const date = recordDate(inv, ["created_at", "issued_at", "invoice_date"]);
    if (!olderThan(date, cutoff)) continue;
    const status = str(inv.status) ?? "unknown";
    const balance = typeof inv.balance === "number" ? inv.balance : 0;
    if (balance > 0 || !TERMINAL_INVOICE_STATUSES.has(status)) {
      out.skipped.push({
        entity_type: "invoice",
        entity_id: id,
        reason: `not purgeable: status "${status}", balance ${balance}`,
      });
      continue;
    }
    const lines = ((await kv.getByPrefix(`invoice_line:${id}:`)) ?? []).filter(isRecord);
    const lineKeys = lines
      .map((line) => (str(line.id) ? `invoice_line:${id}:${line.id}` : null))
      .filter((k): k is string => k !== null);
    purgedInvoiceIds.add(id);
    out.candidates.push(
      candidate(`invoice:${id}`, "invoice", id, date as string, "delete", lineKeys),
    );
  }

  for (const pay of (payments ?? []).filter(isRecord)) {
    const id = str(pay.id);
    if (!id) continue;
    const date = recordDate(pay, ["created_at", "paid_at", "payment_date"]);
    if (!olderThan(date, cutoff)) continue;
    const invoiceId = str(pay.invoice_id);
    if (invoiceId && !purgedInvoiceIds.has(invoiceId)) {
      const invoiceStillExists = invoices.some((inv) => str(inv.id) === invoiceId);
      if (invoiceStillExists) {
        // Deleting a payment while its invoice survives would corrupt balances.
        out.skipped.push({
          entity_type: "payment",
          entity_id: id,
          reason: `linked invoice ${invoiceId} is being retained`,
        });
        continue;
      }
    }
    out.candidates.push(candidate(`payment:${id}`, "payment", id, date as string, "delete"));
  }

  for (const credit of (credits ?? []).filter(isRecord)) {
    const id = str(credit.id);
    if (!id) continue;
    const date = recordDate(credit, ["created_at", "issued_at"]);
    if (!olderThan(date, cutoff)) continue;
    const remaining =
      typeof credit.balance === "number"
        ? credit.balance
        : typeof credit.remaining_amount === "number"
          ? credit.remaining_amount
          : 0;
    if (remaining > 0) {
      out.skipped.push({
        entity_type: "credit",
        entity_id: id,
        reason: `credit still holds a balance of ${remaining}`,
      });
      continue;
    }
    out.candidates.push(candidate(`credit:${id}`, "credit", id, date as string, "delete"));
  }

  return out;
}

// --- households: shared enumeration for behavioural/personal/medical passes ---

/** Household records under `customer:{t}:household:` — the same LIKE prefix
 *  also returns nested note/flag records, which carry a household_id field;
 *  true household records do not. */
async function listHouseholds(tenantId: string): Promise<Rec[]> {
  const rows = (await kv.getByPrefix(`customer:${tenantId}:household:`)) ?? [];
  return rows.filter(
    (r): r is Rec => isRecord(r) && str(r.id) !== null && !("household_id" in r),
  );
}

// --- behavioural: notes, flags, and activity history past the window ---

async function collectBehavioural(
  tenantId: string,
  cutoff: string,
): Promise<Collected> {
  const out: Collected = { candidates: [], skipped: [] };

  for (const household of await listHouseholds(tenantId)) {
    const hid = str(household.id) as string;
    const [notes, flags, activities] = await Promise.all([
      kv.getByPrefix(`customer:${tenantId}:household:${hid}:note:`),
      kv.getByPrefix(`customer:${tenantId}:household:${hid}:flag:`),
      kv.getByPrefix(`customer:${tenantId}:activity:${hid}:`),
    ]);

    for (const note of (notes ?? []).filter(isRecord)) {
      const id = str(note.id);
      const date = recordDate(note, ["created_at", "updated_at"]);
      if (!id || !olderThan(date, cutoff)) continue;
      out.candidates.push(
        candidate(
          `customer:${tenantId}:household:${hid}:note:${id}`,
          "household_note",
          id,
          date as string,
          "delete",
        ),
      );
    }
    for (const flag of (flags ?? []).filter(isRecord)) {
      const id = str(flag.id);
      const date = recordDate(flag, ["created_at", "updated_at"]);
      if (!id || !olderThan(date, cutoff)) continue;
      if (flag.active === true) {
        out.skipped.push({
          entity_type: "household_flag",
          entity_id: id,
          reason: "flag is still active",
        });
        continue;
      }
      out.candidates.push(
        candidate(
          `customer:${tenantId}:household:${hid}:flag:${id}`,
          "household_flag",
          id,
          date as string,
          "delete",
        ),
      );
    }
    for (const activity of (activities ?? []).filter(isRecord)) {
      const id = str(activity.id);
      const date = recordDate(activity, ["created_at", "timestamp", "occurred_at"]);
      if (!id || !olderThan(date, cutoff)) continue;
      out.candidates.push(
        candidate(
          `customer:${tenantId}:activity:${hid}:${id}`,
          "activity",
          id,
          date as string,
          "delete",
          // Legacy flat-keyed duplicate of the same activity record.
          [`customer:${tenantId}:activity:${id}`],
        ),
      );
    }
  }

  return out;
}

// --- medical: expired vaccination records ---

async function collectMedical(tenantId: string, cutoff: string): Promise<Collected> {
  const out: Collected = { candidates: [], skipped: [] };

  for (const household of await listHouseholds(tenantId)) {
    const hid = str(household.id) as string;
    const pets = ((await kv.getByPrefix(`customer:${tenantId}:pet:${hid}:`)) ?? []).filter(isRecord);
    for (const pet of pets) {
      const petId = str(pet.id);
      if (!petId) continue;
      const vaccinations = (
        (await kv.getByPrefix(`vaccination:${tenantId}:${petId}:`)) ?? []
      ).filter(isRecord);
      for (const vax of vaccinations) {
        const id = str(vax.id);
        const date = recordDate(vax, ["expiry_date", "administered_date", "date_administered", "created_at"]);
        if (!id || !olderThan(date, cutoff)) continue;
        out.candidates.push(
          candidate(
            `vaccination:${tenantId}:${petId}:${id}`,
            "vaccination",
            id,
            date as string,
            "delete",
          ),
        );
      }
    }
  }

  return out;
}

// --- personal: whole-household anonymisation or erasure ---

const REDACTED = "[REDACTED]";

const HOUSEHOLD_PII_FIELDS = [
  "name", "primary_contact_name", "email", "phone", "address", "address_line1",
  "address_line2", "city", "postcode", "notes",
];
const CONTACT_PII_FIELDS = [
  "name", "first_name", "last_name", "email", "phone", "mobile", "address",
  "address_line1", "address_line2", "city", "postcode", "emergency_contact",
  "notes",
];
const PET_PII_FIELDS = [
  "name", "microchip_number", "medical_notes", "behaviour_notes",
  "dietary_notes", "vet_name", "vet_phone", "vet_practice", "notes",
];

function redactFields(rec: Rec, fields: string[], anonymisedAt: string): Rec {
  const copy: Rec = { ...rec };
  for (const field of fields) {
    if (typeof copy[field] === "string" && (copy[field] as string).trim()) {
      copy[field] = REDACTED;
    }
  }
  copy.anonymised_at = anonymisedAt;
  return copy;
}

/** Latest activity date across everything held for the household — a
 *  household is only inactive (purgeable) when ALL of it is out of window. */
function latestActivityDate(household: Rec, data: SubjectData): string | null {
  const dates: string[] = [];
  const add = (rec: Rec, fields: string[]) => {
    const d = recordDate(rec, fields);
    if (d) dates.push(d);
  };
  add(household, ["updated_at", "created_at"]);
  for (const rec of data.daycare_bookings) add(rec, ["booking_date", "created_at"]);
  for (const rec of data.overnight_reservations) add(rec, ["endDate", "end_date", "created_at"]);
  for (const rec of data.grooming_appointments) add(rec, ["appointment_date", "created_at"]);
  for (const rec of data.transport_jobs) add(rec, ["date", "scheduled_date", "created_at"]);
  for (const rec of data.portal_bookings) add(rec, ["date", "created_at"]);
  for (const rec of data.invoices) add(rec, ["created_at"]);
  for (const rec of data.payments) add(rec, ["created_at"]);
  for (const rec of data.activities) add(rec, ["created_at", "timestamp"]);
  for (const rec of data.message_threads) add(rec, ["lastMessageAt", "updatedAt", "createdAt"]);
  return dates.length ? dates.sort().at(-1) as string : null;
}

interface PersonalPass {
  candidates: RetentionCandidate[];
  skipped: RetentionSkip[];
  /** Anonymise actions carry the redacted record to write back. */
  writes: Map<string, Rec>;
}

async function collectPersonal(
  tenantId: string,
  cutoff: string,
  jobType: RetentionJobConfig["job_type"],
  anonymisedAt: string,
): Promise<PersonalPass> {
  const out: PersonalPass = { candidates: [], skipped: [], writes: new Map() };

  for (const household of await listHouseholds(tenantId)) {
    const hid = str(household.id) as string;
    if (str(household.anonymised_at)) continue; // already processed
    const data = await collectSubjectData(tenantId, hid);
    const lastActive = latestActivityDate(household, data);
    if (!olderThan(lastActive, cutoff)) {
      out.skipped.push({
        entity_type: "household",
        entity_id: hid,
        reason: `household has activity after the cutoff (last: ${lastActive ?? "unknown"})`,
      });
      continue;
    }

    if (jobType === "deletion") {
      if (data.invoices.length > 0 || data.payments.length > 0) {
        // Financial records have their own statutory retention; erasing the
        // household they hang off would orphan them. Report, never silently purge.
        out.skipped.push({
          entity_type: "household",
          entity_id: hid,
          reason: `${data.invoices.length} invoice(s) / ${data.payments.length} payment(s) must be retained — anonymise instead`,
        });
        continue;
      }
      const related: string[] = [];
      const addKeys = (records: Rec[], toKey: (r: Rec) => string | null) => {
        for (const rec of records) {
          const key = toKey(rec);
          if (key) related.push(key);
        }
      };
      addKeys(data.household_flags, (r) =>
        str(r.id) ? `customer:${tenantId}:household:${hid}:flag:${r.id}` : null);
      addKeys(data.household_notes, (r) =>
        str(r.id) ? `customer:${tenantId}:household:${hid}:note:${r.id}` : null);
      addKeys(data.contacts, (r) =>
        str(r.id) ? `customer:${tenantId}:contact:${hid}:${r.id}` : null);
      addKeys(data.contacts, (r) => (str(r.id) ? `contact_consent:${r.id}` : null));
      addKeys(data.pets, (r) =>
        str(r.id) ? `customer:${tenantId}:pet:${hid}:${r.id}` : null);
      addKeys(data.vaccinations, (r) => {
        const petId = str(r.pet_id) ?? str(r.petId);
        return petId && str(r.id) ? `vaccination:${tenantId}:${petId}:${r.id}` : null;
      });
      addKeys(data.documents, (r) =>
        str(r.id) ? `customer:${tenantId}:document:${hid}:${r.id}` : null);
      addKeys(data.activities, (r) =>
        str(r.id) ? `customer:${tenantId}:activity:${hid}:${r.id}` : null);
      // Erasure takes the household's bookings with it — they carry the
      // subject's data and would dangle once the household is gone.
      for (const booking of data.daycare_bookings) {
        const id = str(booking.id);
        if (!id) continue;
        related.push(`daycare:booking:${id}`);
        const bookingDate = str(booking.booking_date);
        const locationId = str(booking.location_id);
        const petId = str(booking.pet_id);
        if (locationId && bookingDate) {
          related.push(`daycare:booking:date:${locationId}:${bookingDate}:${id}`);
        }
        if (petId) related.push(`daycare:booking:pet:${petId}:${id}`);
        related.push(`daycare:booking:household:${hid}:${id}`);
      }
      addKeys(data.overnight_reservations, (r) =>
        str(r.id) ? `overnight:${tenantId}:reservation:${r.id}` : null);
      addKeys(data.grooming_appointments, (r) =>
        str(r.id) ? `grooming-apt:${tenantId}:${r.id}` : null);
      addKeys(data.transport_jobs, (r) =>
        str(r.id) ? `transport_job:${tenantId}:${r.id}` : null);
      addKeys(data.portal_bookings, (r) =>
        str(r.id) ? `portal_booking:${tenantId}:${r.id}` : null);
      addKeys(data.message_threads, (r) => (str(r.id) ? `message_thread:${r.id}` : null));
      addKeys(data.message_threads, (r) => (str(r.id) ? `thread_messages:${r.id}` : null));
      addKeys(data.messages, (r) => (str(r.id) ? `message:${r.id}` : null));
      related.push(`household_threads:${hid}`);
      out.candidates.push(
        candidate(
          `customer:${tenantId}:household:${hid}`,
          "household",
          hid,
          lastActive as string,
          "delete",
          related,
        ),
      );
      continue;
    }

    if (jobType === "anonymisation") {
      const householdKey = `customer:${tenantId}:household:${hid}`;
      out.writes.set(
        householdKey,
        redactFields(household, HOUSEHOLD_PII_FIELDS, anonymisedAt),
      );
      const related: string[] = [];
      for (const contact of data.contacts) {
        const cid = str(contact.id);
        if (!cid) continue;
        const key = `customer:${tenantId}:contact:${hid}:${cid}`;
        out.writes.set(key, redactFields(contact, CONTACT_PII_FIELDS, anonymisedAt));
        related.push(key);
      }
      for (const pet of data.pets) {
        const pid = str(pet.id);
        if (!pid) continue;
        const key = `customer:${tenantId}:pet:${hid}:${pid}`;
        out.writes.set(key, redactFields(pet, PET_PII_FIELDS, anonymisedAt));
        related.push(key);
      }
      for (const consent of data.contact_consents) {
        const cid = str(consent.contact_id);
        if (!cid) continue;
        const key = `contact_consent:${cid}`;
        out.writes.set(
          key,
          redactFields(consent, ["email", "phone", "mobile"], anonymisedAt),
        );
        related.push(key);
      }
      out.candidates.push(
        candidate(householdKey, "household", hid, lastActive as string, "anonymise", related),
      );
    }
  }

  return out;
}

// --- the worker ---

function auditId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export interface RetentionActor {
  id: string;
  name: string;
  role: string;
}

/**
 * Evaluate (and, when dryRun is false, apply) a retention job. Always writes
 * a compliance audit entry describing what happened, including dry runs.
 */
export async function executeRetention(opts: {
  tenantId: string;
  job: RetentionJobConfig;
  dryRun: boolean;
  actor: RetentionActor;
  now?: Date;
}): Promise<RetentionResult> {
  const now = opts.now ?? new Date();
  const cutoff = new Date(
    now.getTime() - opts.job.retention_period_days * 24 * 60 * 60 * 1000,
  ).toISOString();

  const categories = Array.isArray(opts.job.data_categories)
    ? opts.job.data_categories
    : [];
  const evaluated = categories.filter((c) => SUPPORTED_CATEGORIES.has(c));
  const unsupported = categories.filter((c) => !SUPPORTED_CATEGORIES.has(c));

  const candidates: RetentionCandidate[] = [];
  const skipped: RetentionSkip[] = [];
  const anonymiseWrites = new Map<string, Rec>();

  for (const category of evaluated) {
    let collected: Collected;
    if (category === "operational") {
      collected = await collectOperational(opts.tenantId, cutoff);
    } else if (category === "financial") {
      collected = await collectFinancial(cutoff);
    } else if (category === "behavioural") {
      collected = await collectBehavioural(opts.tenantId, cutoff);
    } else if (category === "medical") {
      collected = await collectMedical(opts.tenantId, cutoff);
    } else {
      const personal = await collectPersonal(
        opts.tenantId,
        cutoff,
        opts.job.job_type,
        now.toISOString(),
      );
      for (const [key, value] of personal.writes) anonymiseWrites.set(key, value);
      collected = personal;
    }
    candidates.push(...collected.candidates);
    skipped.push(...collected.skipped);
  }

  // "archival" has no implementation — surface that instead of pretending.
  if (opts.job.job_type === "archival") {
    return {
      dry_run: opts.dryRun,
      cutoff,
      records_affected: 0,
      records_failed: 0,
      candidates: [],
      skipped: [
        {
          entity_type: "job",
          entity_id: opts.job.id,
          reason: "archival jobs are not supported; use anonymisation or deletion",
        },
      ],
      categories_evaluated: evaluated,
      categories_unsupported: unsupported,
    };
  }

  let affected = 0;
  let failed = 0;

  if (!opts.dryRun) {
    for (const c of candidates) {
      try {
        if (c.action === "anonymise") {
          for (const key of [c.key, ...c.related_keys]) {
            const write = anonymiseWrites.get(key);
            if (write) await kv.set(key, write);
          }
        } else {
          await kv.mdel([c.key, ...c.related_keys]);
        }
        affected += 1;
      } catch {
        failed += 1;
      }
    }
  }

  const result: RetentionResult = {
    dry_run: opts.dryRun,
    cutoff,
    records_affected: opts.dryRun ? 0 : affected,
    records_failed: failed,
    candidates,
    skipped,
    categories_evaluated: evaluated,
    categories_unsupported: unsupported,
  };

  // Audit from inside the worker: a purge (or its rehearsal) can never run
  // unlogged, whichever route or script invokes it. Entity ids only — no
  // personal data in the audit record.
  await kv.set(`compliance:audit:${auditId()}`, {
    action_type: "retention_action",
    entity_type: "job",
    entity_id: opts.job.id,
    user_id: opts.actor.id,
    user_name: opts.actor.name,
    user_role: opts.actor.role,
    action_description: opts.dryRun
      ? `DRY RUN of retention job "${opts.job.job_name ?? opts.job.id}": ${candidates.length} record(s) would be affected, ${skipped.length} skipped`
      : `Executed retention job "${opts.job.job_name ?? opts.job.id}": ${affected} record(s) ${opts.job.job_type === "anonymisation" ? "anonymised" : "deleted"}, ${failed} failed, ${skipped.length} skipped`,
    changes: {
      after: {
        dry_run: opts.dryRun,
        cutoff,
        candidate_summary: candidates.map((c) => ({
          entity_type: c.entity_type,
          entity_id: c.entity_id,
          action: c.action,
        })),
        skipped,
      },
    },
    created_at: now.toISOString(),
  });

  return result;
}
