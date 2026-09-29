/**
 * @fileoverview Coarse visitor location, read from Cloudflare's own request
 * metadata rather than a third-party IP-geolocation API.
 *
 * Every request that reaches this Worker has already been geolocated by the
 * edge, so the answer is sitting on the request object (`request.cf`) and, when
 * the "Add visitor location headers" managed transform is enabled, on the
 * `cf-ip*` request headers too. Reading it here costs nothing, works on the
 * Free plan, and avoids the failure modes of calling something like
 * `ipapi.co/json/` from the browser: a shared per-domain daily quota that
 * answers `429` once a few tabs refresh, a CORS dependency on a third party,
 * and an easy target for ad blockers.
 *
 * Both sources are consulted because neither is guaranteed: `request.cf` is
 * absent in local dev and in unit tests, and the headers exist only where the
 * managed transform is on. Whatever is missing comes back `null` — a caller
 * decides what to do without a city, and nothing here throws.
 *
 * @module lib/location/visitor-location
 */

/** Coarse, city-level location of the visitor who made a request. */
export interface VisitorLocation {
  city: string | null;
  region: string | null;
  /** ISO 3166-1 alpha-2, e.g. `"US"`. */
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  /** IANA name, e.g. `"America/Los_Angeles"`. */
  timezone: string | null;
}

/** Every field unknown — what an un-geolocated request resolves to. */
export const EMPTY_VISITOR_LOCATION: Readonly<VisitorLocation> = Object.freeze({
  city: null,
  region: null,
  country: null,
  latitude: null,
  longitude: null,
  timezone: null,
});

/**
 * How long a resolved location stays good for, in seconds (12 hours).
 *
 * Shared by the `Cache-Control` header on `/api/location` and the browser-side
 * cache in `./client`, so both sides expire together. Coarse location does not
 * move between page views, and treating it as per-render data is exactly what
 * exhausts a public IP API's quota.
 */
export const VISITOR_LOCATION_MAX_AGE_SECONDS = 12 * 60 * 60;

/**
 * Country codes Cloudflare uses for "this is not a real place": `XX` when the
 * country is unknown and `T1` for a request arriving over Tor. Both are
 * reported as no country rather than passed on as if they were one.
 */
const PLACEHOLDER_COUNTRIES = new Set(["XX", "T1"]);

/** The `cf` property Cloudflare attaches to an inbound request, as far as this module reads it. */
interface RequestCfProperties {
  city?: string;
  region?: string;
  country?: string;
  latitude?: string | number;
  longitude?: string | number;
  timezone?: string;
}

function readCf(request: Request): RequestCfProperties | undefined {
  return (request as Request & { cf?: RequestCfProperties }).cf;
}

/** Trims a candidate string, returning `null` for anything empty or non-string. */
function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Parses a coordinate. Cloudflare sends latitude/longitude as decimal strings,
 * so a numeric string is expected; anything that is not a finite number in
 * range is treated as missing rather than forwarded as `NaN`.
 *
 * The missing case is spelled out before `Number()` is reached, because
 * `Number(null)` is `0` — a silent "somewhere off the coast of Africa" that
 * would satisfy a `??` chain and mask the absent field.
 */
function coordinate(value: unknown, limit: number): number | null {
  if (typeof value !== "number") {
    const raw = text(value);
    if (raw === null) return null;
    value = Number(raw);
  }
  const parsed = value as number;
  if (!Number.isFinite(parsed)) return null;
  return Math.abs(parsed) <= limit ? parsed : null;
}

function country(value: unknown): string | null {
  const code = text(value)?.toUpperCase() ?? null;
  if (!code || PLACEHOLDER_COUNTRIES.has(code)) return null;
  return code;
}

/**
 * Reads the visitor's coarse location off an inbound request.
 *
 * `request.cf` wins where it exists; the `cf-*` headers fill in field by field
 * (not all-or-nothing), since a deployment can have the managed transform on
 * while some `cf` fields are still absent. Never throws: a request with no
 * Cloudflare metadata at all resolves to {@link EMPTY_VISITOR_LOCATION}.
 */
export function readVisitorLocation(request: Request): VisitorLocation {
  const cf = readCf(request);
  const header = (name: string) => request.headers.get(name);

  return {
    city: text(cf?.city) ?? text(header("cf-ipcity")),
    region: text(cf?.region) ?? text(header("cf-region")),
    country: country(cf?.country) ?? country(header("cf-ipcountry")),
    latitude: coordinate(cf?.latitude, 90) ?? coordinate(header("cf-iplatitude"), 90),
    longitude: coordinate(cf?.longitude, 180) ?? coordinate(header("cf-iplongitude"), 180),
    timezone: text(cf?.timezone) ?? text(header("cf-timezone")),
  };
}

/** Whether a location carries usable coordinates, the one field most callers actually need. */
export function hasCoordinates(location: VisitorLocation | null): boolean {
  return (
    location !== null && location.latitude !== null && location.longitude !== null
  );
}
