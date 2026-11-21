/**
 * Place names for GPS points and typed landmarks, from OpenStreetMap (Nominatim).
 * Used only to show residents where their report was pinned and to place typed
 * landmarks on the map. Every call has a short timeout; on any failure the caller
 * carries on without it, so reporting never waits on this.
 */

const UA = "Nagrik-Kharghar-civic-pilot/1.0 (civic issue reporting; contact via Telegram bot)";
// Kharghar and its edges: left, top, right, bottom.
const KHARGHAR_VIEWBOX = "73.035,19.085,73.105,19.005";
const TIMEOUT_MS = 3000;

const g = globalThis as unknown as { __nagrikGeoCache?: Map<string, unknown> };
const cache: Map<string, unknown> = g.__nagrikGeoCache || (g.__nagrikGeoCache = new Map());

async function getJson(url: string): Promise<any | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "en" },
      signal: ctl.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Short human label for a point, e.g. "Raintree Marg, Kharghar Village". */
export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const key = `r:${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (cache.has(key)) return cache.get(key) as string | null;

  const j = await getJson(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`
  );
  let label: string | null = null;
  if (j?.address) {
    const a = j.address;
    const parts = [
      a.road || a.pedestrian || a.footway || a.amenity || a.building,
      a.neighbourhood || a.quarter || a.residential,
      a.suburb && a.suburb !== (a.neighbourhood || "") ? a.suburb : null,
    ].filter((x: unknown): x is string => typeof x === "string" && x.trim().length > 0);
    const unique = Array.from(new Set(parts)).slice(0, 3);
    label = unique.length ? unique.join(", ") : null;
  }
  if (cache.size > 2000) cache.clear();
  cache.set(key, label);
  return label;
}

/** Finds a typed landmark inside Kharghar. Returns null if it can't be placed. */
export async function geocodeKhargharLandmark(
  text: string
): Promise<{ lat: number; lon: number; label: string } | null> {
  const q = (text || "").replace(/^📍\s*/u, "").trim().slice(0, 120);
  if (q.length < 3) return null;
  const key = `f:${q.toLowerCase()}`;
  if (cache.has(key)) return cache.get(key) as { lat: number; lon: number; label: string } | null;

  const query = /kharghar/i.test(q) ? q : `${q}, Kharghar, Navi Mumbai`;
  const j = await getJson(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&bounded=1&viewbox=${KHARGHAR_VIEWBOX}&q=${encodeURIComponent(query)}`
  );
  const hit = Array.isArray(j) && j[0] ? j[0] : null;
  const result =
    hit && Number.isFinite(+hit.lat) && Number.isFinite(+hit.lon)
      ? { lat: +hit.lat, lon: +hit.lon, label: String(hit.name || hit.display_name || q).slice(0, 80) }
      : null;
  cache.set(key, result);
  return result;
}
