/**
 * @fileoverview Network calls for the round-pairing D1 sync (idea #12's "A
 * manual pairing/room-assignment entry form as the practical stand-in"
 * follow-up in TODO.md). Kept separate from `state/savedRoundPairings.ts`'s
 * pure validation helpers so those stay unit-testable without mocking the
 * API client, mirroring `round/word-count-rounds-client.ts`'s split.
 *
 * Talks to `apps/debate-ai.com`'s `/api/round-pairings` routes (via
 * `debate-api-client`), which require an authenticated session —
 * `listSavedRoundPairings` resolves to `null` (rather than throwing) on a
 * `401`, letting the caller (`hooks/useRoundPairings.ts`) fall back to
 * local-storage-only pairings instead of showing an error. The write calls
 * (`saveRoundPairingToAccount`, `deleteSavedRoundPairingFromAccount`) throw
 * on failure since the caller already has the pairing in local state either
 * way — a failed cloud sync is reported but never blocks local saving.
 *
 * @module round/round-pairings-client
 */

import { deleteRoundPairing, listRoundPairings, syncRoundPairing, type Client } from "debate-api-client";
import { apiClient, httpStatus } from "../lib/api-client";
import type { RoundPairingRecord } from "../state/roundPairings";

/** Lists every round pairing synced to the current user's account. Returns `null` when signed out (a `401` response). */
export async function listSavedRoundPairings(client: Client = apiClient): Promise<RoundPairingRecord[] | null> {
  const { data, error } = await listRoundPairings({}, { client });
  if (error) {
    if (httpStatus(error) === 401) return null;
    throw new Error("Failed to load your synced round pairings.");
  }
  return (data ?? []) as RoundPairingRecord[];
}

/** Saves (upserts, keyed by `record.roundId`) a round pairing to the current user's account. Throws on failure, `401` included. */
export async function saveRoundPairingToAccount(
  record: RoundPairingRecord,
  client: Client = apiClient,
): Promise<void> {
  const { error } = await syncRoundPairing({ path: { pairingId: record.roundId }, body: { record } }, { client });
  if (error) {
    throw new Error("Failed to sync this pairing to your account.");
  }
}

/** Deletes a synced round pairing from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedRoundPairingFromAccount(roundId: string, client: Client = apiClient): Promise<void> {
  const { error } = await deleteRoundPairing({ path: { pairingId: roundId } }, { client });
  if (error) {
    throw new Error("Failed to remove this synced pairing.");
  }
}
