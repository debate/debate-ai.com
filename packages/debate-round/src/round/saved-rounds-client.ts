/**
 * @fileoverview Network calls for the round cloud save D1 sync (TODO.md idea
 * #17, follow-up (3)/(b), "rounds" half). Kept separate from
 * `state/savedRounds.ts`'s pure validation/derivation helpers so those stay
 * unit-testable without mocking `fetch`, mirroring
 * `round/saved-flows-client.ts`'s split.
 *
 * Talks to `apps/debate-ai.com`'s `/api/rounds` routes, which require an
 * authenticated session — the read calls (`listSavedRounds`,
 * `fetchSavedRound`) resolve to `null` (rather than throwing) on a `401`,
 * letting the caller fall back to "sign in to sync" UI instead of showing
 * an error. The write calls (`saveRoundToAccount`, `deleteSavedRound`) throw
 * on failure since the caller already has the round in local state either
 * way — a failed cloud sync is reported but never blocks local editing.
 * `saveRoundToAccount` resolves to a conflict result rather than throwing
 * on a 409 (see `hasRoundSaveConflict`), so an optimistic-concurrency
 * rejection can be surfaced as its own UI state instead of a generic error.
 *
 * @module round/saved-rounds-client
 */

import type { Round } from "../types/flow";
import type { SavedRoundSummary } from "../state/savedRounds";

/** Result of a `saveRoundToAccount` call: either it saved, or it hit a conflict (see `hasRoundSaveConflict`). */
export type SaveRoundResult =
  | { conflict: false; summary: SavedRoundSummary }
  | { conflict: true; current: SavedRoundSummary };

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Lists the current user's saved rounds (summaries only). Returns `null` when signed out (a `401` response). */
export async function listSavedRounds(endpoint = "/api/rounds"): Promise<SavedRoundSummary[] | null> {
  const res = await fetch(endpoint);
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to load your saved rounds."));
  }
  return (await res.json()) as SavedRoundSummary[];
}

/** Fetches the full saved `Round` for a given `clientId`. Returns `null` when signed out or not found. */
export async function fetchSavedRound(clientId: number, endpoint = "/api/rounds"): Promise<Round | null> {
  const res = await fetch(`${endpoint}/${clientId}`);
  if (res.status === 401 || res.status === 404) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to load this saved round."));
  }
  return (await res.json()) as Round;
}

/**
 * Saves (upserts, keyed by `round.id`) a round to the current user's account.
 * `baseUpdatedAt` should be the `updatedAt` of the last saved version the
 * caller knows about (`null`/omitted if it has no idea one exists); a
 * mismatch against what's actually saved resolves to `{ conflict: true }`
 * rather than overwriting it, unless `force` is set. Throws on any other
 * failure, `401` included.
 */
export async function saveRoundToAccount(
  round: Round,
  opts: { baseUpdatedAt?: string | null; force?: boolean } = {},
  endpoint = "/api/rounds",
): Promise<SaveRoundResult> {
  const res = await fetch(`${endpoint}/${round.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ round, baseUpdatedAt: opts.baseUpdatedAt ?? null, force: opts.force ?? false }),
  });
  if (res.status === 409) {
    const payload = (await res.json()) as { current: SavedRoundSummary };
    return { conflict: true, current: payload.current };
  }
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to save this round to your account."));
  }
  return { conflict: false, summary: (await res.json()) as SavedRoundSummary };
}

/** Deletes a saved round from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedRound(clientId: number, endpoint = "/api/rounds"): Promise<void> {
  const res = await fetch(`${endpoint}/${clientId}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to remove this saved round."));
  }
}
