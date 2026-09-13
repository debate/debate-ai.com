/**
 * @fileoverview Account-linked favorite/pinned tools list — TODO.md idea
 * #17 ("User Settings — account-linked debate preferences"), "integrate
 * tools into user settings" follow-up. Lets a user star tools on `/tools`
 * and see them surfaced first there and managed from `/settings`, synced
 * to their account on the same `user_settings` row as every other field.
 * Pure validation helpers shared by the `/api/settings` D1-backed route
 * (`apps/debate-ai.com`) and the `/tools`/`/settings` favorite-toggle UI,
 * mirroring `state/userSettings.ts` and `state/themeSettings.ts`'s split.
 *
 * Unlike `debateStyle`/`colorTheme`, a tool's identity here is just its
 * route `href` (e.g. `/reason-editor`) — this package doesn't know the
 * app's tool catalog (labels/icons/descriptions live in
 * `apps/debate-ai.com/app/tools/tool-groups.tsx`), so validation is
 * necessarily generic: a same-origin absolute path shape, not membership
 * in a specific known list. The app-side UI is expected to skip rendering
 * any favorited href that no longer matches a real tool (e.g. after a tool
 * is renamed or removed from the catalog), and to prune it from the saved
 * list once loaded via `filterKnownFavoriteTools` below.
 *
 * @module state/favoriteTools
 */

export type FavoriteToolsPayload = {
  favoriteTools: string[];
};

/** Mirrors every other `DEFAULT_*` in this package: the value used when no saved row/value exists yet. */
export const DEFAULT_FAVORITE_TOOLS: FavoriteToolsPayload = {
  favoriteTools: [],
};

/** Generous but bounded, so a buggy or malicious client can't grow the row without limit. */
export const MAX_FAVORITE_TOOLS = 50;

/** An in-app tool route: `/`, then lowercase path segments — matches how every `Tool.href` in `app/tools/tool-groups.tsx` is written. No protocol, host, query, or hash. */
const TOOL_HREF_PATTERN = /^\/[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*$/;

export function isValidToolHref(value: unknown): value is string {
  return typeof value === "string" && value.length <= 200 && TOOL_HREF_PATTERN.test(value);
}

export function isValidFavoriteToolsList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_FAVORITE_TOOLS &&
    value.every(isValidToolHref) &&
    new Set(value).size === value.length
  );
}

export type FavoriteToolsPatchResult = {
  /** Only the field, if present in `input` *and* valid. */
  valid: Partial<FavoriteToolsPayload>;
  /** One message per rejected or malformed field. */
  errors: string[];
};

/**
 * Validates an untrusted (e.g. parsed request-body JSON) patch: the whole
 * `favoriteTools` array is accepted or rejected as one field, mirroring
 * `normalizeUserSettingsPatch`/`normalizeThemeSettingsPatch`'s per-field
 * shape. Kept for callers that legitimately need to replace the whole list
 * in one PUT (e.g. `pruneUnknown`'s bulk cleanup) — a single star/unstar
 * toggle should use `normalizeFavoriteToolOpPatch`/`applyFavoriteToolOp`
 * instead, which avoids this path's lost-update race (see their docstring).
 */
export function normalizeFavoriteToolsPatch(input: unknown): FavoriteToolsPatchResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: {}, errors: ["Request body must be a JSON object."] };
  }

  const record = input as Record<string, unknown>;
  const valid: Partial<FavoriteToolsPayload> = {};
  const errors: string[] = [];

  if ("favoriteTools" in record) {
    if (isValidFavoriteToolsList(record.favoriteTools)) {
      valid.favoriteTools = record.favoriteTools;
    } else {
      errors.push(
        `"favoriteTools" must be an array of up to ${MAX_FAVORITE_TOOLS} unique in-app paths (e.g. "/reason-editor"), with no duplicates.`,
      );
    }
  }

  return { valid, errors };
}

/**
 * A single star/unstar operation, or a batch prune, applied server-side
 * against the caller's currently stored list rather than a client-computed
 * whole-list replacement.
 */
export type FavoriteToolOp = {
  addFavoriteTool?: string;
  removeFavoriteTool?: string;
  removeFavoriteTools?: string[];
};

export type FavoriteToolOpPatchResult = {
  valid: FavoriteToolOp;
  errors: string[];
};

/**
 * Validates an untrusted `{ addFavoriteTool }` / `{ removeFavoriteTool }` /
 * `{ removeFavoriteTools }` patch — the fix for the "two tabs edit favorites
 * at once" lost-update race `normalizeFavoriteToolsPatch`'s whole-list
 * replace is exposed to (see `packages/debate-help-docs/content/docs/features/user-settings.mdx`'s Known
 * gaps): the caller sends just the href(s) being added or removed, and
 * `/api/settings`'s route resolves them against the row's current value
 * (read-then-write, mirroring how `editorPreferences` already merges onto
 * its existing stored map instead of replacing it) via
 * {@link applyFavoriteToolOp} rather than trusting a client-computed list
 * that may already be stale by the time it lands. `removeFavoriteTools` is
 * the batch form `pruneUnknown`'s bulk cleanup uses — it used to be the one
 * remaining caller of `normalizeFavoriteToolsPatch`'s racy whole-list
 * replace, since a single add/remove op didn't fit "drop N stale entries at
 * once".
 */
export function normalizeFavoriteToolOpPatch(input: unknown): FavoriteToolOpPatchResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: {}, errors: ["Request body must be a JSON object."] };
  }

  const record = input as Record<string, unknown>;
  const hasAdd = "addFavoriteTool" in record;
  const hasRemove = "removeFavoriteTool" in record;
  const hasRemoveMany = "removeFavoriteTools" in record;

  if ([hasAdd, hasRemove, hasRemoveMany].filter(Boolean).length > 1) {
    return {
      valid: {},
      errors: [
        'Provide only one of "addFavoriteTool", "removeFavoriteTool" or "removeFavoriteTools" per request.',
      ],
    };
  }
  if (hasAdd) {
    return isValidToolHref(record.addFavoriteTool)
      ? { valid: { addFavoriteTool: record.addFavoriteTool }, errors: [] }
      : { valid: {}, errors: ['"addFavoriteTool" must be a single in-app path (e.g. "/reason-editor").'] };
  }
  if (hasRemove) {
    return isValidToolHref(record.removeFavoriteTool)
      ? { valid: { removeFavoriteTool: record.removeFavoriteTool }, errors: [] }
      : { valid: {}, errors: ['"removeFavoriteTool" must be a single in-app path (e.g. "/reason-editor").'] };
  }
  if (hasRemoveMany) {
    const list = record.removeFavoriteTools;
    return Array.isArray(list) && list.length <= MAX_FAVORITE_TOOLS && list.every(isValidToolHref)
      ? { valid: { removeFavoriteTools: list }, errors: [] }
      : {
          valid: {},
          errors: [`"removeFavoriteTools" must be an array of up to ${MAX_FAVORITE_TOOLS} in-app paths.`],
        };
  }
  return { valid: {}, errors: [] };
}

/**
 * Applies one validated add/remove/prune op to a currently stored favorites
 * list. Pure and idempotent: adding an already-present href, or removing
 * absent one(s), returns the same array reference unchanged; adding past
 * {@link MAX_FAVORITE_TOOLS} is silently dropped, mirroring
 * `useFavoriteTools.ts#toggleFavorite`'s own client-side cap guard.
 */
export function applyFavoriteToolOp(current: string[], op: FavoriteToolOp): string[] {
  if (op.addFavoriteTool) {
    if (current.includes(op.addFavoriteTool) || current.length >= MAX_FAVORITE_TOOLS) return current;
    return [...current, op.addFavoriteTool];
  }
  if (op.removeFavoriteTool) {
    if (!current.includes(op.removeFavoriteTool)) return current;
    return current.filter((href) => href !== op.removeFavoriteTool);
  }
  if (op.removeFavoriteTools && op.removeFavoriteTools.length > 0) {
    const toRemove = new Set(op.removeFavoriteTools);
    if (!current.some((href) => toRemove.has(href))) return current;
    return current.filter((href) => !toRemove.has(href));
  }
  return current;
}

/** Serializes a favorites list for the `favorite_tools` D1 column: `null` when empty, matching the "no saved value yet" semantics every other nullable column here uses. */
export function serializeFavoriteTools(list: string[]): string | null {
  return list.length === 0 ? null : JSON.stringify(list);
}

/** Parses the `favorite_tools` D1 column back into a list. Never throws — a null, malformed, or invalid-shape value reads back as an empty list rather than erroring the request. */
export function parseFavoriteTools(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return isValidFavoriteToolsList(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Drops any favorited href that isn't in `validHrefs` (the app's current
 * tool catalog), preserving order — the fix for the "stale favorite" gap
 * this module's header comment describes: a tool renamed or removed from
 * the catalog after being starred used to sit inertly in the saved list
 * forever, since nothing ever removed it. The app layer (the only place
 * that knows the real catalog) calls this once loaded, syncing the pruned
 * list back like any other favorites change. Returns the same array
 * reference when nothing was pruned, so a caller can skip a write by
 * comparing length instead of doing a deep-equal.
 */
export function filterKnownFavoriteTools(favorites: string[], validHrefs: readonly string[]): string[] {
  const valid = new Set(validHrefs);
  const next = favorites.filter((href) => valid.has(href));
  return next.length === favorites.length ? favorites : next;
}
