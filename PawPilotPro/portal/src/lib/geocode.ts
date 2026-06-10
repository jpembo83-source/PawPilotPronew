/**
 * Reverse geocoding via Nominatim (the public OpenStreetMap service).
 *
 * We round coordinates to 4 decimals (~10 m precision) to dedupe nearby
 * pings, then cache the resolved name in localStorage for 30 days.  Calls are
 * serialized at the caller (≤ 1 req/sec) to respect Nominatim's usage policy.
 * If we ever outgrow this, swap to a self-hosted Nominatim instance or
 * MapTiler's geocoder — only this file changes.
 */

const CACHE_KEY = "ppp:geocode:v1";
const TTL_MS = 30 * 86_400_000;

interface CacheEntry {
  name: string | null;
  cachedAt: number;
}

type Cache = Record<string, CacheEntry>;

function readCache(): Cache {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeCache(c: Cache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* quota exceeded or private mode — silently ignore */
  }
}

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

/**
 * Return a friendly place name for a coordinate, or null if it can't be
 * resolved.  Cached in localStorage; the first lookup costs a network round
 * trip, subsequent lookups within 30 days are instant.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const k = cacheKey(lat, lng);
  const cache = readCache();
  const hit = cache[k];
  if (hit && Date.now() - hit.cachedAt < TTL_MS) {
    return hit.name;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`;
    const r = await fetch(url, {
      headers: {
        "Accept-Language": "en",
      },
    });
    if (!r.ok) {
      cache[k] = { name: null, cachedAt: Date.now() };
      writeCache(cache);
      return null;
    }
    const d: any = await r.json();
    const a = d.address ?? {};
    // Prefer the most-specific named locality: suburb / neighbourhood / village,
    // then city / town.  Fall back to the first comma-separated chunk of the
    // long display name as a graceful default.
    const place = a.suburb || a.neighbourhood || a.quarter || a.village || a.hamlet;
    const city  = a.city || a.town || a.municipality || a.county;
    const name =
      place && city && place !== city ? `${place}, ${city}`
      : (place || city || (d.display_name ?? "").split(",")[0]?.trim() || null);

    cache[k] = { name, cachedAt: Date.now() };
    writeCache(cache);
    return name;
  } catch {
    return null;
  }
}
