/**
 * @fileoverview Network calls for the round cloud save D1 sync (TODO.md idea
 * #17, follow-up (3)/(b), "rounds" half). Kept separate from
 * `state/savedRounds.ts`'s pure validation/derivation helpers so those stay
 * unit-testable without mocking the API client, mirroring
 * `round/saved-flows-client.ts`'s split.
 *
 * Talks to `apps/debate-ai.com`'s `/api/rounds` routes (via `debate-api-client`),
 * which require an authenticated session — the read calls (`listSavedRounds`,
 * `fetchSavedRound`) resolve to `null` (rather than throwing) on a `401`,
 * letting the caller fall back to "sign in to sync" UI instead of showing
 * an error. The write calls (`saveRoundToAccount`, `deleteSavedRound`) throw
 * on failure since the caller already has the round in local state either
 * way — a failed cloud sync is reported but never blocks local editing.
 *
 * @module round/saved-rounds-client
 */

import { deleteRound, getRound, listRounds, syncRound, type Client } from "debate-api-client";
import { apiClient, httpStatus } from "../lib/api-client";
import type { Round } from "../types/flow";
import type { SavedRoundSummary } from "../state/savedRounds";

/** Lists the current user's saved rounds (summaries only). Returns `null` when signed out (a `401` response). */
export async function listSavedRounds(client: Client = apiClient): Promise<SavedRoundSummary[] | null> {
  const { data, error } = await listRounds({}, { client });
  if (error) {
    if (httpStatus(error) === 401) return null;
    throw new Error("Failed to load your saved rounds.");
  }
  return (data ?? []) as SavedRoundSummary[];
}

/** Fetches the full saved `Round` for a given `clientId`. Returns `null` when signed out or not found. */
export async function fetchSavedRound(clientId: number, client: Client = apiClient): Promise<Round | null> {
  const { data, error } = await getRound({ path: { clientId } }, { client });
  if (error) {
    const status = httpStatus(error);
    if (status === 401 || status === 404) return null;
    throw new Error("Failed to load this saved round.");
  }
  return data as Round;
}

/** Saves (upserts, keyed by `round.id`) a round to the current user's account. Throws on failure, `401` included. */
export async function saveRoundToAccount(round: Round, client: Client = apiClient): Promise<SavedRoundSummary> {
  const { data, error } = await syncRound({ path: { clientId: round.id }, body: { round } }, { client });
  if (error) {
    throw new Error("Failed to save this round to your account.");
  }
  return data as SavedRoundSummary;
}

/** Deletes a saved round from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedRound(clientId: number, client: Client = apiClient): Promise<void> {
  const { error } = await deleteRound({ path: { clientId } }, { client });
  if (error) {
    throw new Error("Failed to remove this saved round.");
  }
}
