/**
 * @fileoverview Network calls for the tournament-result-history D1 sync
 * (docs/features/team-rankings.md's "Standings data... stored in
 * localStorage only" Known gap). Kept separate from
 * `state/savedTournamentResults.ts`'s pure validation helpers so those stay
 * unit-testable without mocking `fetch`, mirroring
 * `debate-practice-drills`' `round/word-count-rounds-client.ts` split.
 *
 * Talks to `apps/debate-ai.com`'s `/api/tournament-results` routes, which
 * require an authenticated session — `listSavedTournamentResults` resolves
 * to `null` (rather than throwing) on a `401`, letting the caller
 * (`hooks/useStandingsAccountSync.ts`) fall back to local-storage-only
 * history instead of showing an error. The write calls throw on failure
 * since the caller already has the result in local state either way — a
 * failed cloud sync is reported but never blocks local saving.
 *
 * @module state/tournament-results-client
 */

import type { TournamentResultRecord } from "./tournamentResults";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Lists every tournament result synced to the current user's account. Returns `null` when signed out (a `401` response). */
export async function listSavedTournamentResults(
  endpoint = "/api/tournament-results",
): Promise<TournamentResultRecord[] | null> {
  const res = await fetch(endpoint);
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to load your synced tournament results."));
  }
  return (await res.json()) as TournamentResultRecord[];
}

/** Saves (upserts, keyed by `record.id`) a tournament result to the current user's account. Throws on failure, `401` included. */
export async function saveTournamentResultToAccount(
  record: TournamentResultRecord,
  endpoint = "/api/tournament-results",
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(record.id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ record }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to sync this result to your account."));
  }
}

/** Deletes a synced tournament result from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedTournamentResultFromAccount(
  id: string,
  endpoint = "/api/tournament-results",
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to remove this synced result."));
  }
}
