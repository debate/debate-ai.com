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

import type { SavedArgumentCollection } from "./argument-library-collections";

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
 * Saves the full saved-collections list for the current user. Throws (with
 * the server's `{ error }` message when present) on a `401`/`400`/other
 * failure — the caller is expected to have already applied the change
 * locally, so a failed account sync is reported but not fatal to the UI.
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
