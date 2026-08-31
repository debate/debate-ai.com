/**
 * @fileoverview Account-linked News Stream read/like sync — closes
 * `docs/features/news-stream.md`'s "Read/like state is per-browser
 * (localStorage), not per-account" Known gap. Pure validation/serialization
 * helpers shared by the `/api/settings` D1-backed route
 * (`apps/debate-ai.com`) and `state/newsStream.ts`'s local viewer-state
 * store, mirroring `state/favoriteTools.ts`'s split (validation here, the
 * localStorage read/write side in `state/newsStream.ts`).
 *
 * Unlike `favoriteTools` (a small, user-curated list capped at 50), a news
 * item id is an opaque, system-generated string (e.g.
 * `daily-best-card-2026-08-30`, `sprint-note-note-1`) — there's no fixed
 * catalog to validate membership against, so validation here only checks
 * shape (non-empty, bounded length, printable) and the list-level bound
 * (`MAX_NEWS_SYNC_ITEMS`), the same "generous but bounded" posture
 * `MAX_FAVORITE_TOOLS` uses.
 *
 * @module lib/news-stream-sync
 */

export type NewsSyncPayload = {
  newsRead: string[];
  newsLiked: string[];
};

/** Mirrors every other `DEFAULT_*` in this repo's settings surfaces: the value used when no saved row/value exists yet. */
export const DEFAULT_NEWS_SYNC: NewsSyncPayload = {
  newsRead: [],
  newsLiked: [],
};

/** Generous but bounded, so a buggy or malicious client can't grow the row without limit — comfortably above the feed's real size (PRODUCT_NEWS + per-source community caps, see `state/newsStream.ts`'s `MAX_COMMUNITY_ITEMS_PER_SOURCE`). */
export const MAX_NEWS_SYNC_ITEMS = 500;

export function isValidNewsItemId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200 && /^[\x20-\x7E]+$/.test(value);
}

export function isValidNewsIdList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_NEWS_SYNC_ITEMS &&
    value.every(isValidNewsItemId) &&
    new Set(value).size === value.length
  );
}

export type NewsSyncPatchResult = {
  /** Only the field(s), if present in `input` *and* valid. */
  valid: Partial<NewsSyncPayload>;
  /** One message per rejected or malformed field. */
  errors: string[];
};

/**
 * Validates an untrusted (e.g. parsed request-body JSON) patch. Like
 * `normalizeFavoriteToolsPatch`, each field is accepted or rejected as a
 * whole list — a caller replaces its full read/liked id list in one PUT
 * (the current full contents of the client's local viewer state) rather
 * than this module diffing add/remove operations server-side.
 */
export function normalizeNewsSyncPatch(input: unknown): NewsSyncPatchResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: {}, errors: ["Request body must be a JSON object."] };
  }

  const record = input as Record<string, unknown>;
  const valid: Partial<NewsSyncPayload> = {};
  const errors: string[] = [];

  if ("newsRead" in record) {
    if (isValidNewsIdList(record.newsRead)) {
      valid.newsRead = record.newsRead;
    } else {
      errors.push(`"newsRead" must be an array of up to ${MAX_NEWS_SYNC_ITEMS} unique news-item ids.`);
    }
  }

  if ("newsLiked" in record) {
    if (isValidNewsIdList(record.newsLiked)) {
      valid.newsLiked = record.newsLiked;
    } else {
      errors.push(`"newsLiked" must be an array of up to ${MAX_NEWS_SYNC_ITEMS} unique news-item ids.`);
    }
  }

  return { valid, errors };
}

/** Serializes an id list for a `news_read`/`news_liked` D1 column: `null` when empty, matching the "no saved value yet" semantics every other nullable column here uses. */
export function serializeNewsIdList(list: string[]): string | null {
  return list.length === 0 ? null : JSON.stringify(list);
}

/** Parses a `news_read`/`news_liked` D1 column back into a list. Never throws — a null, malformed, or invalid-shape value reads back as an empty list rather than erroring the request. */
export function parseNewsIdList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return isValidNewsIdList(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
