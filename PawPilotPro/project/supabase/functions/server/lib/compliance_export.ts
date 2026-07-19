// DSAR export worker: assembles EVERY piece of personal data held for one
// data subject (a household and its contacts/pets) across the app, writes a
// structured JSON export plus a human-readable summary to the PRIVATE
// compliance-exports bucket, and returns real metrics for the export record.
//
// Storage is injected (ExportStorage) so the assembly + file-build logic is
// unit-testable without Deno/Supabase (tests/unit/compliance-export.test.ts);
// the production implementation lives in lib/compliance_storage.ts. Files are
// only ever served via short-lived signed URLs minted at request time — the
// bucket is private and no URL is persisted (mirrors lib/pet_photos.ts).

import * as kv from "../kv_store.tsx";

export const COMPLIANCE_EXPORTS_BUCKET = "make-fc003b23-compliance-exports";
/** Download links are minted per request and expire quickly. */
export const EXPORT_SIGNED_URL_TTL_SECONDS = 60 * 10;

export interface ExportStorage {
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  createSignedUrl(path: string, ttlSeconds: number): Promise<string | null>;
}

type Rec = Record<string, unknown>;

export interface SubjectData {
  household: Rec | null;
  household_flags: Rec[];
  household_notes: Rec[];
  contacts: Rec[];
  contact_consents: Rec[];
  pets: Rec[];
  vaccinations: Rec[];
  documents: Rec[];
  activities: Rec[];
  daycare_bookings: Rec[];
  overnight_reservations: Rec[];
  grooming_appointments: Rec[];
  transport_jobs: Rec[];
  portal_bookings: Rec[];
  invoices: Rec[];
  invoice_lines: Rec[];
  payments: Rec[];
  credits: Rec[];
  message_threads: Rec[];
  messages: Rec[];
}

const isRecord = (v: unknown): v is Rec =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Booking/finance records reference the household under either naming
 *  convention depending on the module (household_id vs householdId). */
const belongsToHousehold = (rec: unknown, householdId: string): boolean =>
  isRecord(rec) &&
  (rec.household_id === householdId || rec.householdId === householdId);

/** getByPrefix over booking prefixes also returns index entries whose value
 *  is a plain id string — keep only real records. */
const onlyRecords = (rows: unknown[]): Rec[] => rows.filter(isRecord);

/**
 * Assemble ALL personal data held for one household across the app. Every
 * lookup is tenant-scoped where the key scheme supports it; the globally
 * keyed stores (daycare bookings, invoices, payments, messages) are filtered
 * by household reference — the deployment is single-tenant (demo-tenant-001).
 */
export async function collectSubjectData(
  tenantId: string,
  householdId: string,
): Promise<SubjectData> {
  const household = (await kv.get(
    `customer:${tenantId}:household:${householdId}`,
  )) as Rec | null;

  const [
    flags,
    notes,
    contacts,
    pets,
    documents,
    activities,
    daycareAll,
    overnightAll,
    groomingAll,
    transportAll,
    portalAll,
    invoicesAll,
    paymentsAll,
    creditsAll,
    householdThreadIds,
  ] = await Promise.all([
    kv.getByPrefix(`customer:${tenantId}:household:${householdId}:flag:`),
    kv.getByPrefix(`customer:${tenantId}:household:${householdId}:note:`),
    kv.getByPrefix(`customer:${tenantId}:contact:${householdId}:`),
    kv.getByPrefix(`customer:${tenantId}:pet:${householdId}:`),
    kv.getByPrefix(`customer:${tenantId}:document:${householdId}:`),
    kv.getByPrefix(`customer:${tenantId}:activity:${householdId}:`),
    kv.getByPrefix("daycare:booking:"),
    kv.getByPrefix(`overnight:${tenantId}:reservation:`),
    kv.getByPrefix(`grooming-apt:${tenantId}:`),
    kv.getByPrefix(`transport_job:${tenantId}:`),
    kv.getByPrefix(`portal_booking:${tenantId}:`),
    kv.getByPrefix("invoice:"),
    kv.getByPrefix("payment:"),
    kv.getByPrefix("credit:"),
    kv.get(`household_threads:${householdId}`),
  ]);

  const contactRecords = onlyRecords(contacts ?? []);
  const petRecords = onlyRecords(pets ?? []);

  const contactConsents = (
    await Promise.all(
      contactRecords.map(async (contact): Promise<Rec | null> => {
        const contactId = contact.id;
        if (typeof contactId !== "string" || !contactId) return null;
        const consent = await kv.get(`contact_consent:${contactId}`);
        return isRecord(consent) ? { contact_id: contactId, ...consent } : null;
      }),
    )
  ).filter((c): c is Rec => c !== null);

  const vaccinations = (
    await Promise.all(
      petRecords.map(async (pet) =>
        typeof pet.id === "string" && pet.id
          ? onlyRecords(
              (await kv.getByPrefix(`vaccination:${tenantId}:${pet.id}:`)) ?? [],
            )
          : [],
      ),
    )
  ).flat();

  const invoiceRecords = onlyRecords(invoicesAll ?? []).filter((r) =>
    belongsToHousehold(r, householdId),
  );
  const invoiceIds = new Set(
    invoiceRecords.map((inv) => inv.id).filter((id): id is string => typeof id === "string"),
  );
  const invoiceLines = (
    await Promise.all(
      [...invoiceIds].map(async (invoiceId) =>
        onlyRecords((await kv.getByPrefix(`invoice_line:${invoiceId}:`)) ?? []),
      ),
    )
  ).flat();

  const threadIds: string[] = Array.isArray(householdThreadIds)
    ? householdThreadIds.filter((t): t is string => typeof t === "string")
    : [];
  const messageThreads = (
    await Promise.all(threadIds.map((id) => kv.get(`message_thread:${id}`)))
  ).filter(isRecord);
  const messages = (
    await Promise.all(
      threadIds.map(async (threadId) => {
        const ids = (await kv.get(`thread_messages:${threadId}`)) ?? [];
        const list = Array.isArray(ids)
          ? ids.filter((m): m is string => typeof m === "string")
          : [];
        return (
          await Promise.all(list.map((id) => kv.get(`message:${id}`)))
        ).filter(isRecord);
      }),
    )
  ).flat();

  return {
    household: isRecord(household) ? household : null,
    household_flags: onlyRecords(flags ?? []),
    household_notes: onlyRecords(notes ?? []),
    contacts: contactRecords,
    contact_consents: contactConsents,
    pets: petRecords,
    vaccinations,
    documents: onlyRecords(documents ?? []),
    activities: onlyRecords(activities ?? []),
    daycare_bookings: onlyRecords(daycareAll ?? []).filter((r) =>
      belongsToHousehold(r, householdId),
    ),
    overnight_reservations: onlyRecords(overnightAll ?? []).filter((r) =>
      belongsToHousehold(r, householdId),
    ),
    grooming_appointments: onlyRecords(groomingAll ?? []).filter((r) =>
      belongsToHousehold(r, householdId),
    ),
    transport_jobs: onlyRecords(transportAll ?? []).filter((r) =>
      belongsToHousehold(r, householdId),
    ),
    portal_bookings: onlyRecords(portalAll ?? []).filter((r) =>
      belongsToHousehold(r, householdId),
    ),
    invoices: invoiceRecords,
    invoice_lines: invoiceLines,
    payments: onlyRecords(paymentsAll ?? []).filter((r) =>
      belongsToHousehold(r, householdId),
    ),
    credits: onlyRecords(creditsAll ?? []).filter((r) =>
      belongsToHousehold(r, householdId),
    ),
    message_threads: messageThreads,
    messages,
  };
}

export type SubjectDataCounts = Record<keyof SubjectData, number>;

export function countSubjectData(data: SubjectData): SubjectDataCounts {
  const counts = {} as SubjectDataCounts;
  for (const key of Object.keys(data) as (keyof SubjectData)[]) {
    const value = data[key];
    counts[key] = Array.isArray(value) ? value.length : value ? 1 : 0;
  }
  return counts;
}

export interface ExportMeta {
  tenantId: string;
  exportId: string;
  householdId: string;
  householdName: string;
  requestedBy: string;
  generatedAt: string;
}

export function buildExportJson(data: SubjectData, meta: ExportMeta): string {
  return JSON.stringify(
    {
      export_version: 1,
      kind: "data_subject_export",
      tenant_id: meta.tenantId,
      export_id: meta.exportId,
      subject: {
        household_id: meta.householdId,
        household_name: meta.householdName,
      },
      generated_at: meta.generatedAt,
      requested_by: meta.requestedBy,
      record_counts: countSubjectData(data),
      data,
    },
    null,
    2,
  );
}

const SECTION_LABELS: Record<keyof SubjectData, string> = {
  household: "Household profile",
  household_flags: "Household flags",
  household_notes: "Household notes",
  contacts: "Contacts",
  contact_consents: "Messaging consent records",
  pets: "Pets",
  vaccinations: "Vaccination records",
  documents: "Documents",
  activities: "Activity history",
  daycare_bookings: "Daycare bookings",
  overnight_reservations: "Overnight reservations",
  grooming_appointments: "Grooming appointments",
  transport_jobs: "Transport jobs",
  portal_bookings: "Portal booking requests",
  invoices: "Invoices",
  invoice_lines: "Invoice line items",
  payments: "Payments",
  credits: "Credits",
  message_threads: "Message threads",
  messages: "Messages",
};

/** Plain-text summary a person can read alongside the raw JSON. */
export function buildExportSummary(data: SubjectData, meta: ExportMeta): string {
  const counts = countSubjectData(data);
  const lines = [
    "DATA SUBJECT EXPORT — SUMMARY",
    "=============================",
    `Subject household: ${meta.householdName} (${meta.householdId})`,
    `Generated at:      ${meta.generatedAt}`,
    `Requested by:      ${meta.requestedBy}`,
    `Export id:         ${meta.exportId}`,
    "",
    "This export contains every category of personal data held about the",
    "subject in PawPilotPro at the time of generation. The full records are",
    "in export.json in this folder.",
    "",
    "Records included:",
  ];
  for (const key of Object.keys(SECTION_LABELS) as (keyof SubjectData)[]) {
    lines.push(`  - ${SECTION_LABELS[key]}: ${counts[key]}`);
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  lines.push("", `Total records: ${total}`);
  return lines.join("\n");
}

export interface SubjectExportResult {
  file_path: string;
  summary_path: string;
  file_size_bytes: number;
  record_counts: SubjectDataCounts;
  total_records: number;
}

/** Object path prefix inside the private bucket — always tenant-first. */
export function exportFolder(tenantId: string, exportId: string): string {
  return `${tenantId}/${exportId}`;
}

/**
 * Run the full DSAR export: collect → build JSON + summary → upload both to
 * the private bucket under a tenant-prefixed folder. Returns real file
 * metrics for the export record. Throws if the household does not exist.
 */
export async function runSubjectExport(opts: {
  tenantId: string;
  householdId: string;
  exportId: string;
  requestedBy: string;
  storage: ExportStorage;
  now?: Date;
}): Promise<SubjectExportResult> {
  const data = await collectSubjectData(opts.tenantId, opts.householdId);
  if (!data.household) {
    throw new Error(`household not found: ${opts.householdId}`);
  }

  const meta: ExportMeta = {
    tenantId: opts.tenantId,
    exportId: opts.exportId,
    householdId: opts.householdId,
    householdName:
      typeof data.household.name === "string" && data.household.name
        ? data.household.name
        : opts.householdId,
    requestedBy: opts.requestedBy,
    generatedAt: (opts.now ?? new Date()).toISOString(),
  };

  const json = buildExportJson(data, meta);
  const summary = buildExportSummary(data, meta);
  const encoder = new TextEncoder();
  const jsonBytes = encoder.encode(json);
  const summaryBytes = encoder.encode(summary);

  const folder = exportFolder(opts.tenantId, opts.exportId);
  const filePath = `${folder}/export.json`;
  const summaryPath = `${folder}/summary.txt`;
  await opts.storage.upload(filePath, jsonBytes, "application/json");
  await opts.storage.upload(summaryPath, summaryBytes, "text/plain; charset=utf-8");

  const counts = countSubjectData(data);
  return {
    file_path: filePath,
    summary_path: summaryPath,
    file_size_bytes: jsonBytes.byteLength,
    record_counts: counts,
    total_records: Object.values(counts).reduce((a, b) => a + b, 0),
  };
}
