/**
 * @fileoverview Account-linked News Stream read/like sync — closes
 * `packages/debate-help-docs/content/docs/internals/news-stream.mdx`'s "Read/like state is per-browser
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
 * `normalizeFavoriteToolsPatch`'s own whole-list form, each field is
 * accepted or rejected as a whole list — a caller replaces its full
 * read/liked id list in one PUT (the current full contents of the client's
 * local viewer state) rather than this module diffing add/remove operations
 * server-side. Kept for a caller that genuinely needs a whole-list replace,
 * the same carve-out `normalizeFavoriteToolsPatch` documents — a single
 * mark-read/like-toggle should use
 * {@link normalizeNewsReadOpPatch}/{@link normalizeNewsLikedOpPatch} instead,
 * which avoid this path's lost-update race (see their docstrings).
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

/**
 * A single "mark read" operation, applied server-side against the caller's
 * *currently stored* `newsRead` list rather than a client-computed
 * whole-list replacement — the fix for the "two tabs/devices mark different
 * items read at once" lost-update race {@link normalizeNewsSyncPatch}'s
 * whole-list replace is exposed to (see
 * `packages/debate-help-docs/content/docs/internals/news-stream.mdx`'s
 * Known gaps): every prior `pushRead` call PUT the browser's *entire*
 * current read-id list, so a tab whose local list was already behind
 * another tab's latest write would silently overwrite that other tab's
 * newly-read item. Add-only, mirroring `recentTools.ts#RecentToolOp` —
 * marking an item read has no "unread" counterpart.
 */
export type NewsReadOp = { recordNewsRead: string };

export type NewsReadOpPatchResult = {
  /** Only the op, if present in `input` *and* valid. */
  valid: Partial<NewsReadOp>;
  /** One message per rejected or malformed field. */
  errors: string[];
};

/**
 * Validates an untrusted (e.g. parsed request-body JSON) `{ recordNewsRead }`
 * patch, mirroring `recentTools.ts#normalizeRecentToolOpPatch`'s shape.
 */
export function normalizeNewsReadOpPatch(input: unknown): NewsReadOpPatchResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: {}, errors: ["Request body must be a JSON object."] };
  }

  const record = input as Record<string, unknown>;
  if (!("recordNewsRead" in record)) return { valid: {}, errors: [] };

  return isValidNewsItemId(record.recordNewsRead)
    ? { valid: { recordNewsRead: record.recordNewsRead }, errors: [] }
    : { valid: {}, errors: ['"recordNewsRead" must be a single news-item id.'] };
}

/**
 * Applies one validated `recordNewsRead` op to a currently stored read-id
 * list: appends the id if not already present, capped at
 * {@link MAX_NEWS_SYNC_ITEMS}. Pure and idempotent — returns the same array
 * reference when the id is already read, the list is already at capacity, or
 * the id is invalid, so a caller can skip a write by reference-comparing.
 */
export function applyNewsReadOp(current: string[], op: NewsReadOp): string[] {
  if (!isValidNewsItemId(op.recordNewsRead)) return current;
  if (current.includes(op.recordNewsRead) || current.length >= MAX_NEWS_SYNC_ITEMS) return current;
  return [...current, op.recordNewsRead];
}

/**
 * A single like/unlike operation, applied server-side against the caller's
 * *currently stored* `newsLiked` list rather than a client-computed
 * whole-list replacement — the same lost-update fix {@link applyNewsReadOp}
 * above closes for `newsRead`, mirroring
 * `favoriteTools.ts#FavoriteToolOp`'s add/remove shape.
 */
export type NewsLikedOp = { addNewsLiked?: string; removeNewsLiked?: string };

export type NewsLikedOpPatchResult = {
  valid: NewsLikedOp;
  errors: string[];
};

/**
 * Validates an untrusted `{ addNewsLiked }` / `{ removeNewsLiked }` patch,
 * mirroring `favoriteTools.ts#normalizeFavoriteToolOpPatch`'s shape.
 */
export function normalizeNewsLikedOpPatch(input: unknown): NewsLikedOpPatchResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: {}, errors: ["Request body must be a JSON object."] };
  }

  const record = input as Record<string, unknown>;
  const hasAdd = "addNewsLiked" in record;
  const hasRemove = "removeNewsLiked" in record;

  if (hasAdd && hasRemove) {
    return { valid: {}, errors: ['Provide only one of "addNewsLiked" or "removeNewsLiked" per request.'] };
  }
  if (hasAdd) {
    return isValidNewsItemId(record.addNewsLiked)
      ? { valid: { addNewsLiked: record.addNewsLiked }, errors: [] }
      : { valid: {}, errors: ['"addNewsLiked" must be a single news-item id.'] };
  }
  if (hasRemove) {
    return isValidNewsItemId(record.removeNewsLiked)
      ? { valid: { removeNewsLiked: record.removeNewsLiked }, errors: [] }
      : { valid: {}, errors: ['"removeNewsLiked" must be a single news-item id.'] };
  }
  return { valid: {}, errors: [] };
}

/**
 * Applies one validated add/remove op to a currently stored liked-id list.
 * Pure and idempotent: adding an already-liked id, or removing an absent
 * one, returns the same array reference unchanged; adding past
 * {@link MAX_NEWS_SYNC_ITEMS} is silently dropped, mirroring
 * `applyFavoriteToolOp`'s own cap guard.
 */
export function applyNewsLikedOp(current: string[], op: NewsLikedOp): string[] {
  if (op.addNewsLiked) {
    if (current.includes(op.addNewsLiked) || current.length >= MAX_NEWS_SYNC_ITEMS) return current;
    return [...current, op.addNewsLiked];
  }
  if (op.removeNewsLiked) {
    if (!current.includes(op.removeNewsLiked)) return current;
    return current.filter((id) => id !== op.removeNewsLiked);
  }
  return current;
}
