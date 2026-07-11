// Per-location dashboard header images — private tenant-assets bucket,
// signed reads only. Pure module (no Deno imports) so it is unit-testable
// under vitest, mirroring lib/portal_link.ts and lib/pet_photos.ts:
// records store the STORAGE OBJECT PATH (`headerImagePath`), never a URL;
// every read mints a short-lived signed URL at response time.

export const TENANT_ASSETS_BUCKET = "tenant-assets";
export const HEADER_IMAGE_SIGNED_URL_TTL_SECONDS = 60 * 30;
export const MAX_HEADER_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
export const DEFAULT_HEADER_IMAGE_STRENGTH = 70;

/** Mirrors settings_rbac 'locations'/'update': admins and managers only.
 *  The route ALSO runs requirePermission('locations','update'); this pure
 *  copy exists so the gate is unit-testable outside Deno. */
export function canManageLocationHeader(role: unknown): boolean {
  return role === "admin" || role === "manager";
}

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function headerImageExt(contentType: unknown): string | null {
  if (typeof contentType !== "string") return null;
  return EXT_BY_CONTENT_TYPE[contentType.toLowerCase()] ?? null;
}

/** tenant/{tenantId}/locations/{locationId}/header.{ext} — ids are UUIDs /
 *  slugs; anything path-shaped is rejected rather than sanitised so a
 *  malformed id can never escape its tenant prefix. */
export function buildHeaderImagePath(
  tenantId: string,
  locationId: string,
  ext: string,
): string | null {
  const safe = (s: unknown): s is string =>
    typeof s === "string" && s.length > 0 && /^[A-Za-z0-9_-]+$/.test(s);
  if (!safe(tenantId) || !safe(locationId) || !safe(ext)) return null;
  return `tenant/${tenantId}/locations/${locationId}/header.${ext}`;
}

export function validateHeaderImageUpload(file: {
  type?: unknown;
  size?: unknown;
}): { ok: true; ext: string } | { ok: false; error: string } {
  const ext = headerImageExt(file?.type);
  if (!ext) return { ok: false, error: "File must be a JPEG, PNG, or WebP image" };
  const size = typeof file?.size === "number" ? file.size : Number.NaN;
  if (!Number.isFinite(size) || size <= 0) return { ok: false, error: "Empty upload" };
  if (size > MAX_HEADER_IMAGE_BYTES) {
    return { ok: false, error: "Image must be smaller than 8MB" };
  }
  return { ok: true, ext };
}

/** 0–100 integer; anything unusable becomes the 70 default. */
export function clampHeaderStrength(v: unknown): number {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return DEFAULT_HEADER_IMAGE_STRENGTH;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export interface FocalPoint {
  x: number;
  y: number;
}

/** {x,y} each 0–1; default dead centre. */
export function normalizeFocalPoint(v: unknown): FocalPoint {
  const p = v as { x?: unknown; y?: unknown } | null | undefined;
  const axis = (n: unknown): number => {
    const num = typeof n === "string" && n.trim() !== "" ? Number(n) : n;
    if (typeof num !== "number" || !Number.isFinite(num)) return 0.5;
    return Math.min(1, Math.max(0, num));
  };
  return { x: axis(p?.x), y: axis(p?.y) };
}

/** Injectable signer so the read path is unit-testable (same shape as
 *  lib/pet_updates.ts uses for moment photos). */
export type HeaderImageSigner = (
  bucket: string,
  path: string,
  ttlSeconds: number,
) => Promise<string | null>;

/** Adds `headerImageUrl` (short-lived signed URL, or null) next to the
 *  stored path. Never constructs a public URL — the only URL that can
 *  appear is whatever the signer minted. */
export async function withSignedHeaderImage<T extends Record<string, unknown>>(
  location: T,
  sign: HeaderImageSigner,
): Promise<T & { headerImageUrl: string | null }> {
  const path = location?.headerImagePath;
  if (typeof path !== "string" || !path.trim()) {
    return { ...location, headerImageUrl: null };
  }
  const url = await sign(TENANT_ASSETS_BUCKET, path.trim(), HEADER_IMAGE_SIGNED_URL_TTL_SECONDS);
  return { ...location, headerImageUrl: url ?? null };
}

export async function withSignedHeaderImages<T extends Record<string, unknown>>(
  locations: T[],
  sign: HeaderImageSigner,
): Promise<Array<T & { headerImageUrl: string | null }>> {
  return Promise.all(locations.map((l) => withSignedHeaderImage(l, sign)));
}
