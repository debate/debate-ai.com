/**
 * @fileoverview Network calls for the saved-Argument-Library-collections
 * account sync (see `argument-library-collections.ts`). Talks directly to
 * `apps/debate-ai.com`'s `/api/settings` route via `fetch` rather than
 * importing `debate-round`'s `round/user-settings-client.ts` — that module
 * already imports from this package (for `NewsSyncPayload`), so importing it
 * back here would be a dependency cycle. Kept separate from
 * `argument-library-collections.ts`'s pure validation helpers so those stay
 * unit-testable without mocking `fetch`, mirroring
 * `round/user-settings-client.ts`'s own split.
 *
 * `/api/settings` requires an authenticated session — `fetchSavedArgumentCollections`
 * resolves to `null` (rather than throwing) on a `401`, letting the caller
 * fall back to `localStorage` for a signed-out browser.
 *
 * @module lib/argument-library-collections-client
 */

import type { SavedArgumentCollection, SavedArgumentCollectionOp } from "./argument-library-collections";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Fetches the current user's saved Argument Library collections. Returns
 * `null` when signed out (a `401` response) rather than throwing, since
 * that's an expected, recoverable state for this hook.
 */
export async function fetchSavedArgumentCollections(
  endpoint = "/api/settings",
): Promise<SavedArgumentCollection[] | null> {
  const res = await fetch(endpoint);
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to load account settings."));
  }
  const payload = (await res.json()) as { savedArgumentCollections?: SavedArgumentCollection[] };
  return payload.savedArgumentCollections ?? [];
}

/**
 * Saves the full saved-collections list for the current user. Kept for a
 * caller that genuinely needs a whole-list replace, but
 * `useSavedArgumentCollections.ts` sends {@link sendSavedArgumentCollectionOp}
 * instead — see that op's docstring for why a whole-list PUT loses a
 * concurrent change made from another tab/device. Throws (with the server's
 * `{ error }` message when present) on a `401`/`400`/other failure — the
 * caller is expected to have already applied the change locally, so a
 * failed account sync is reported but not fatal to the UI.
 */
export async function saveSavedArgumentCollections(
  list: SavedArgumentCollection[],
  endpoint = "/api/settings",
): Promise<void> {
  const res = await fetch(endpoint, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ savedArgumentCollections: list }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to save account settings."));
  }
}

/**
 * Applies a single add/remove/rename/tags-update op to the current user's
 * saved Argument Library collections, resolved server-side against the
 * row's *current* stored value (read-then-write) rather than a whole-list
 * replace of this browser's own — possibly already-stale — copy. This is
 * the fix for the "two tabs/devices edit saved collections at once" race
 * `packages/debate-help-docs/content/docs/features/argument-library-collections.mdx`'s
 * Known gaps named: a whole-list `saveSavedArgumentCollections` PUT from a
 * stale snapshot silently drops whatever the other tab/device just added,
 * renamed, or removed. Throws (with the server's `{ error }` message when
 * present, e.g. a business-rule refusal like a duplicate name introduced by
 * the other device in between) on a `401`/`400`/other failure — the caller
 * has already applied the change locally, so a failed sync is reported but
 * not fatal to the UI, matching {@link saveSavedArgumentCollections}'s own
 * convention.
 */
export async function sendSavedArgumentCollectionOp(
  op: SavedArgumentCollectionOp,
  endpoint = "/api/settings",
): Promise<void> {
  const res = await fetch(endpoint, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(op),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to save account settings."));
  }
}
