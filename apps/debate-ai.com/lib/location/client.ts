/**
 * @fileoverview Browser-side coarse location lookup: cached, deduplicated, and
 * never a hard dependency for the feature that asked for it.
 *
 * The rule this module exists to enforce is that a visitor's approximate
 * location is looked up *once per browser per half-day*, not once per render.
 * Calling a public IP-geolocation API (`ipapi.co/json/` and friends) from a
 * component is what produces a `429`: the free quota is shared by everyone on
 * the domain, and a few open tabs re-running the call on every refresh burn
 * through a day's allowance in minutes.
 *
 * So the chain here is, in order:
 *
 *  1. `localStorage`, for {@link VISITOR_LOCATION_MAX_AGE_SECONDS};
 *  2. this app's own `/api/location`, which reads Cloudflare's request
 *     metadata at the edge — same-origin, no CORS, no third-party quota, and
 *     invisible to ad blockers (see `./visitor-location`);
 *  3. `ipwho.is`, a keyless CORS-enabled fallback, which in practice only runs
 *     in local dev where there is no Cloudflare edge in front of the app;
 *  4. `null` — the caller renders without a location.
 *
 * Concurrent callers share one in-flight request, and a failed lookup is
 * remembered briefly so a provider that is down or rate-limiting is not
 * re-asked on every mount.
 *
 * Precise (GPS-level) location is deliberately *not* in that chain: it opens a
 * browser permission prompt, so it lives behind
 * {@link requestPreciseVisitorLocation}, to be called from a user gesture.
 *
 * @module lib/location/client
 */

import grab from "grab-url";

import {
  EMPTY_VISITOR_LOCATION,
  VISITOR_LOCATION_MAX_AGE_SECONDS,
  hasCoordinates,
  type VisitorLocation,
} from "./visitor-location";

/** Versioned so a change to the stored shape retires old entries instead of misreading them. */
const STORAGE_KEY = "visitorLocation:v1";

/**
 * How long a *failed* lookup is remembered, in seconds (30 minutes).
 *
 * Far shorter than a successful answer: the point is only to stop a provider
 * that is down, blocked or rate-limiting from being re-asked by every mount
 * for the rest of the session.
 */
const FAILURE_COOLDOWN_SECONDS = 30 * 60;

/** The app's own edge-served endpoint. `baseURL: ""` pins it to this origin. */
const LOCATION_ENDPOINT = "/api/location";

/**
 * Keyless, CORS-enabled IP lookup used only when the app's own endpoint has
 * nothing to say. Append `?rate=1` while debugging to have it report the
 * quota left on the current IP in the JSON body.
 */
const IPWHOIS_ENDPOINT = "https://ipwho.is/";

/** Seconds a third-party lookup may take before it is abandoned. */
const LOOKUP_TIMEOUT_SECONDS = 5;

interface CacheEntry {
  location: VisitorLocation;
  expiresAt: number;
}

/** Shared by every caller while a lookup is in flight, so N components make one request. */
let inFlight: Promise<VisitorLocation | null> | null = null;

function storage(): Storage | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage;
  } catch {
    // Some browsers throw on the property access itself when storage is blocked.
    return null;
  }
}

/**
 * The stored entry, or `null` when there is none, it is malformed, or it has
 * expired (in which case it is dropped). Never throws.
 */
function readEntry(): CacheEntry | null {
  const store = storage();
  if (!store) return null;

  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return null;

    const entry = JSON.parse(raw) as Partial<CacheEntry>;
    if (!entry || typeof entry.expiresAt !== "number" || !entry.location) {
      store.removeItem(STORAGE_KEY);
      return null;
    }
    if (Date.now() >= entry.expiresAt) {
      store.removeItem(STORAGE_KEY);
      return null;
    }

    return {
      location: { ...EMPTY_VISITOR_LOCATION, ...entry.location },
      expiresAt: entry.expiresAt,
    };
  } catch {
    return null;
  }
}

/** Whether an entry is the remembered failure rather than a real answer. */
function isFailureEntry(entry: CacheEntry): boolean {
  return !hasCoordinates(entry.location) && !entry.location.city;
}

/**
 * The cached location, or `null` when there is none, it has expired, or the
 * entry is a remembered failure rather than an answer.
 */
export function readCachedVisitorLocation(): VisitorLocation | null {
  const entry = readEntry();
  if (!entry || isFailureEntry(entry)) return null;
  return entry.location;
}

/** Stores a location (or a remembered failure) for `ttlSeconds`. Silent when storage is unavailable. */
function writeCache(location: VisitorLocation, ttlSeconds: number): void {
  const store = storage();
  if (!store) return;
  try {
    const entry: CacheEntry = {
      location,
      expiresAt: Date.now() + ttlSeconds * 1000,
    };
    store.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // A full or disabled store just means the next call looks the location up
    // again; it must never break the feature that asked for it.
  }
}

/** Drops the cached location, so the next call looks it up again. */
export function clearCachedVisitorLocation(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do — an unreadable store has nothing cached to clear.
  }
}

/** Narrows an unknown JSON body to the fields this module reads, dropping anything unusable. */
function normalize(body: unknown): VisitorLocation | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;

  const text = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null;
  // `Number(null)` is `0`, so an absent coordinate is ruled out before the
  // conversion rather than becoming a plausible-looking zero.
  const coordinate = (value: unknown, limit: number) => {
    if (typeof value !== "number") {
      const raw = text(value);
      if (raw === null) return null;
      value = Number(raw);
    }
    const parsed = value as number;
    return Number.isFinite(parsed) && Math.abs(parsed) <= limit ? parsed : null;
  };

  // `timezone` is a string on our endpoint and an object (`{ id }`) on
  // ipwho.is, so both shapes are accepted.
  const timezone =
    text(raw.timezone) ??
    text((raw.timezone as { id?: unknown } | null | undefined)?.id);

  const location: VisitorLocation = {
    city: text(raw.city),
    region: text(raw.region),
    country: text(raw.country_code) ?? text(raw.country),
    latitude: coordinate(raw.latitude, 90),
    longitude: coordinate(raw.longitude, 180),
    timezone,
  };

  return hasCoordinates(location) || location.city ? location : null;
}

/** This app's own endpoint. Returns `null` when the edge had no location to report. */
async function fromOwnEndpoint(): Promise<VisitorLocation | null> {
  try {
    const body = await grab<Record<string, unknown>>(LOCATION_ENDPOINT, {
      baseURL: "",
      timeout: LOOKUP_TIMEOUT_SECONDS,
    });
    if (body?.error) return null;
    return normalize(body);
  } catch {
    return null;
  }
}

/** The keyless third-party fallback. `success: false` covers its quota and error replies alike. */
async function fromIpWhoIs(): Promise<VisitorLocation | null> {
  try {
    const body = await grab<Record<string, unknown>>(IPWHOIS_ENDPOINT, {
      timeout: LOOKUP_TIMEOUT_SECONDS,
    });
    if (!body || body.error || body.success === false) return null;
    return normalize(body);
  } catch {
    return null;
  }
}

async function lookup(): Promise<VisitorLocation | null> {
  const location = (await fromOwnEndpoint()) ?? (await fromIpWhoIs());

  if (location) writeCache(location, VISITOR_LOCATION_MAX_AGE_SECONDS);
  else writeCache({ ...EMPTY_VISITOR_LOCATION }, FAILURE_COOLDOWN_SECONDS);

  return location;
}

/**
 * The visitor's coarse location, or `null` when it could not be determined.
 *
 * Safe to call from anywhere and as often as a component likes: repeat calls
 * within the cache window do no network work at all, and simultaneous calls
 * share a single request.
 *
 * @param options.refresh - Ignore (and replace) the cached entry.
 */
export async function getVisitorLocation(
  options: { refresh?: boolean } = {},
): Promise<VisitorLocation | null> {
  if (options.refresh) clearCachedVisitorLocation();
  else {
    const cached = readCachedVisitorLocation();
    if (cached) return cached;
  }

  // A remembered failure still inside its cooldown means "don't ask again
  // yet": report no location rather than re-running a lookup that just failed.
  if (!options.refresh) {
    const entry = readEntry();
    if (entry && isFailureEntry(entry)) return null;
  }

  inFlight ??= lookup().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

/**
 * Precise location from the browser's Geolocation API, for a visitor who has
 * asked for it — call this from a click, never on mount, since it raises a
 * permission prompt.
 *
 * A granted position replaces the cached coarse location, so everything else
 * reading {@link getVisitorLocation} picks it up. Returns `null` when the
 * visitor declines, the device cannot fix a position, or the API is absent.
 */
export function requestPreciseVisitorLocation(): Promise<VisitorLocation | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const cached = readCachedVisitorLocation() ?? { ...EMPTY_VISITOR_LOCATION };
        const location: VisitorLocation = {
          ...cached,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        writeCache(location, VISITOR_LOCATION_MAX_AGE_SECONDS);
        resolve(location);
      },
      () => resolve(null),
      { timeout: LOOKUP_TIMEOUT_SECONDS * 1000, maximumAge: VISITOR_LOCATION_MAX_AGE_SECONDS * 1000 },
    );
  });
}
