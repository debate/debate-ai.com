/**
 * @fileoverview Network calls for the saved-evidence-searches account sync
 * (see `saved-evidence-searches.ts`). Talks directly to `apps/debate-ai.com`'s
 * `/api/settings` route via `fetch`, mirroring
 * `argument-library-collections-client.ts` exactly.
 *
 * `/api/settings` requires an authenticated session —
 * `fetchSavedEvidenceSearches` resolves to `null` (rather than throwing) on a
 * `401`, letting the caller fall back to `localStorage` for a signed-out
 * browser.
 *
 * @module lib/saved-evidence-searches-client
 */

import type { SavedEvidenceSearch } from "./saved-evidence-searches";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Fetches the current user's saved evidence searches. Returns `null` when
 * signed out (a `401` response) rather than throwing, since that's an
 * expected, recoverable state for this hook.
 */
export async function fetchSavedEvidenceSearches(
  endpoint = "/api/settings",
): Promise<SavedEvidenceSearch[] | null> {
  const res = await fetch(endpoint);
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to load account settings."));
  }
  const payload = (await res.json()) as { savedEvidenceSearches?: SavedEvidenceSearch[] };
  return payload.savedEvidenceSearches ?? [];
}

/**
 * Saves the full saved-searches list for the current user. Throws (with the
 * server's `{ error }` message when present) on a `401`/`400`/other
 * failure — the caller is expected to have already applied the change
 * locally, so a failed account sync is reported but not fatal to the UI.
 */
export async function saveSavedEvidenceSearches(
  list: SavedEvidenceSearch[],
  endpoint = "/api/settings",
): Promise<void> {
  const res = await fetch(endpoint, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ savedEvidenceSearches: list }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to save account settings."));
  }
}
