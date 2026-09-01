/**
 * @fileoverview Network calls for the round-pairing D1 sync (idea #12's "A
 * manual pairing/room-assignment entry form as the practical stand-in"
 * follow-up in TODO.md). Kept separate from `state/savedRoundPairings.ts`'s
 * pure validation helpers so those stay unit-testable without mocking
 * `fetch`, mirroring `round/word-count-rounds-client.ts`'s split.
 *
 * Talks to `apps/debate-ai.com`'s `/api/round-pairings` routes, which
 * require an authenticated session — `listSavedRoundPairings` resolves to
 * `null` (rather than throwing) on a `401`, letting the caller
 * (`hooks/useRoundPairings.ts`) fall back to local-storage-only pairings
 * instead of showing an error. The write calls (`saveRoundPairingToAccount`,
 * `deleteSavedRoundPairingFromAccount`) throw on failure since the caller
 * already has the pairing in local state either way — a failed cloud sync
 * is reported but never blocks local saving.
 *
 * @module round/round-pairings-client
 */

import type { RoundPairingRecord } from "../state/roundPairings";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Lists every round pairing synced to the current user's account. Returns `null` when signed out (a `401` response). */
export async function listSavedRoundPairings(
  endpoint = "/api/round-pairings",
): Promise<RoundPairingRecord[] | null> {
  const res = await fetch(endpoint);
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to load your synced round pairings."));
  }
  return (await res.json()) as RoundPairingRecord[];
}

/** Saves (upserts, keyed by `record.roundId`) a round pairing to the current user's account. Throws on failure, `401` included. */
export async function saveRoundPairingToAccount(
  record: RoundPairingRecord,
  endpoint = "/api/round-pairings",
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(record.roundId)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ record }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to sync this pairing to your account."));
  }
}

/** Deletes a synced round pairing from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedRoundPairingFromAccount(
  roundId: string,
  endpoint = "/api/round-pairings",
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(roundId)}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to remove this synced pairing."));
  }
}
