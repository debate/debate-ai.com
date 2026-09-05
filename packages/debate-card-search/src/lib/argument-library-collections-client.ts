/**
 * @fileoverview Network calls for the saved-Argument-Library-collections
 * account sync (see `argument-library-collections.ts`). Talks directly to
 * `apps/debate-ai.com`'s `/api/settings` route via `debate-api-client`
 * rather than importing `debate-round`'s `round/user-settings-client.ts` —
 * that module already imports from this package (for `NewsSyncPayload`), so
 * importing it back here would be a dependency cycle. Kept separate from
 * `argument-library-collections.ts`'s pure validation helpers so those stay
 * unit-testable without mocking the API client, mirroring
 * `round/user-settings-client.ts`'s own split.
 *
 * `/api/settings` requires an authenticated session — `fetchSavedArgumentCollections`
 * resolves to `null` (rather than throwing) on a `401`, letting the caller
 * fall back to `localStorage` for a signed-out browser.
 *
 * @module lib/argument-library-collections-client
 */

import { getUserSettings, updateUserSettings, type Client } from "debate-api-client";
import { apiClient, httpStatus } from "./api-client";
import type { SavedArgumentCollection } from "./argument-library-collections";

/**
 * Fetches the current user's saved Argument Library collections. Returns
 * `null` when signed out (a `401` response) rather than throwing, since
 * that's an expected, recoverable state for this hook.
 */
export async function fetchSavedArgumentCollections(
  client: Client = apiClient,
): Promise<SavedArgumentCollection[] | null> {
  const { data, error } = await getUserSettings({}, { client });
  if (error) {
    if (httpStatus(error) === 401) return null;
    throw new Error("Failed to load account settings.");
  }
  const payload = data as { savedArgumentCollections?: SavedArgumentCollection[] };
  return payload.savedArgumentCollections ?? [];
}

/**
 * Saves the full saved-collections list for the current user. Throws on a
 * `401`/`400`/other failure — the caller is expected to have already
 * applied the change locally, so a failed account sync is reported but not
 * fatal to the UI.
 */
export async function saveSavedArgumentCollections(
  list: SavedArgumentCollection[],
  client: Client = apiClient,
): Promise<void> {
  const { error } = await updateUserSettings({ body: { savedArgumentCollections: list } }, { client });
  if (error) {
    throw new Error("Failed to save account settings.");
  }
}
