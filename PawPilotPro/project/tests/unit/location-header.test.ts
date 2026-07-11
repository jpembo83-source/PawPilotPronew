// Location header images: permission gate, tenant-prefixed paths, upload
// validation, strength/focal normalisation, and the signed-URL read —
// private bucket only, no public URLs.
import { describe, it, expect, vi } from 'vitest';
import {
  TENANT_ASSETS_BUCKET,
  HEADER_IMAGE_SIGNED_URL_TTL_SECONDS,
  MAX_HEADER_IMAGE_BYTES,
  canManageLocationHeader,
  buildHeaderImagePath,
  validateHeaderImageUpload,
  clampHeaderStrength,
  normalizeFocalPoint,
  withSignedHeaderImage,
} from '../../supabase/functions/server/lib/location_header.ts';

describe('canManageLocationHeader (mirrors locations/update)', () => {
  it('allows admin and manager only', () => {
    expect(canManageLocationHeader('admin')).toBe(true);
    expect(canManageLocationHeader('manager')).toBe(true);
  });
  it('rejects everyone else — assistant managers, staff, garbage', () => {
    expect(canManageLocationHeader('assistant_manager')).toBe(false);
    expect(canManageLocationHeader('staff')).toBe(false);
    expect(canManageLocationHeader(undefined)).toBe(false);
    expect(canManageLocationHeader('')).toBe(false);
  });
});

describe('buildHeaderImagePath', () => {
  it('builds the tenant-prefixed path', () => {
    expect(buildHeaderImagePath('tenant-1', 'loc-9', 'jpg')).toBe(
      'tenant/tenant-1/locations/loc-9/header.jpg',
    );
  });
  it('rejects path-shaped ids instead of sanitising them', () => {
    expect(buildHeaderImagePath('../other-tenant', 'loc-1', 'jpg')).toBeNull();
    expect(buildHeaderImagePath('tenant-1', 'loc/1', 'jpg')).toBeNull();
    expect(buildHeaderImagePath('tenant-1', 'loc-1', 'jpg/../..')).toBeNull();
    expect(buildHeaderImagePath('', 'loc-1', 'jpg')).toBeNull();
  });
});

describe('validateHeaderImageUpload', () => {
  it('accepts jpeg/png/webp under the size cap', () => {
    expect(validateHeaderImageUpload({ type: 'image/jpeg', size: 1024 })).toEqual({ ok: true, ext: 'jpg' });
    expect(validateHeaderImageUpload({ type: 'image/webp', size: MAX_HEADER_IMAGE_BYTES })).toEqual({ ok: true, ext: 'webp' });
  });
  it('rejects non-images, oversized and empty files', () => {
    expect(validateHeaderImageUpload({ type: 'application/pdf', size: 10 }).ok).toBe(false);
    expect(validateHeaderImageUpload({ type: 'image/jpeg', size: MAX_HEADER_IMAGE_BYTES + 1 }).ok).toBe(false);
    expect(validateHeaderImageUpload({ type: 'image/jpeg', size: 0 }).ok).toBe(false);
    expect(validateHeaderImageUpload({ type: 'image/svg+xml', size: 10 }).ok).toBe(false);
  });
});

describe('clampHeaderStrength', () => {
  it('clamps to 0–100 and rounds', () => {
    expect(clampHeaderStrength(150)).toBe(100);
    expect(clampHeaderStrength(-3)).toBe(0);
    expect(clampHeaderStrength(41.6)).toBe(42);
    expect(clampHeaderStrength('55')).toBe(55);
  });
  it('defaults to 70 for garbage', () => {
    expect(clampHeaderStrength(undefined)).toBe(70);
    expect(clampHeaderStrength('abc')).toBe(70);
    expect(clampHeaderStrength(NaN)).toBe(70);
  });
});

describe('normalizeFocalPoint', () => {
  it('clamps each axis to 0–1 and defaults to centre', () => {
    expect(normalizeFocalPoint({ x: 0.2, y: 1.7 })).toEqual({ x: 0.2, y: 1 });
    expect(normalizeFocalPoint({ x: '-1', y: '0.25' })).toEqual({ x: 0, y: 0.25 });
    expect(normalizeFocalPoint(null)).toEqual({ x: 0.5, y: 0.5 });
    expect(normalizeFocalPoint({})).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe('withSignedHeaderImage', () => {
  it('signs the stored path against the private bucket with the short TTL', async () => {
    const sign = vi.fn().mockResolvedValue('https://signed.example/abc?token=t');
    const out = await withSignedHeaderImage(
      { id: 'loc-1', headerImagePath: 'tenant/t1/locations/loc-1/header.jpg' },
      sign,
    );
    expect(sign).toHaveBeenCalledWith(
      TENANT_ASSETS_BUCKET,
      'tenant/t1/locations/loc-1/header.jpg',
      HEADER_IMAGE_SIGNED_URL_TTL_SECONDS,
    );
    // The ONLY url on the record is the one the signer minted — never a
    // constructed public URL.
    expect(out.headerImageUrl).toBe('https://signed.example/abc?token=t');
    expect(out.headerImagePath).toBe('tenant/t1/locations/loc-1/header.jpg');
  });

  it('yields null url when there is no image or signing fails', async () => {
    const sign = vi.fn().mockResolvedValue(null);
    expect((await withSignedHeaderImage({ id: 'a' }, sign)).headerImageUrl).toBeNull();
    expect(sign).not.toHaveBeenCalled();
    expect(
      (await withSignedHeaderImage({ headerImagePath: 'tenant/t/locations/l/header.jpg' }, sign))
        .headerImageUrl,
    ).toBeNull();
  });
});
