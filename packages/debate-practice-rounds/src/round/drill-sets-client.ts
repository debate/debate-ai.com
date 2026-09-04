/**
 * @fileoverview Network calls for the drill-set D1 sync (the "sharing the
 * 'Practice tier' status across devices for a signed-in user" follow-up
 * named under the "📚 AI Drill Generator" bullet in TODO.md). Kept separate
 * from `state/savedDrillSets.ts`'s pure validation helpers so those stay
 * unit-testable without mocking `fetch`, mirroring
 * `round/word-count-rounds-client.ts`'s split.
 *
 * Talks to `apps/debate-ai.com`'s `/api/drill-sets` routes, which require an
 * authenticated session — `listSavedDrillSets` resolves to `null` (rather
 * than throwing) on a `401`, letting the caller (`hooks/useDrillSets.ts`)
 * fall back to local-storage-only drill sets instead of showing an error.
 * The write calls (`saveDrillSetToAccount`,
 * `deleteSavedDrillSetFromAccount`) throw on failure since the caller
 * already has the drill set in local state either way — a failed cloud sync
 * is reported but never blocks local saving.
 *
 * @module round/drill-sets-client
 */

import type { DrillSetRecord } from "../state/drillSets";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Lists every drill set synced to the current user's account. Returns `null` when signed out (a `401` response). */
export async function listSavedDrillSets(endpoint = "/api/drill-sets"): Promise<DrillSetRecord[] | null> {
  const res = await fetch(endpoint);
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to load your synced drill sets."));
  }
  return (await res.json()) as DrillSetRecord[];
}

/** Saves (upserts, keyed by `record.roundId`) a drill set to the current user's account. Throws on failure, `401` included. */
export async function saveDrillSetToAccount(
  record: DrillSetRecord,
  endpoint = "/api/drill-sets",
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(record.roundId)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ record }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to sync this drill set to your account."));
  }
}

/** Deletes a synced drill set from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedDrillSetFromAccount(
  roundId: string,
  endpoint = "/api/drill-sets",
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(roundId)}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to remove this synced drill set."));
  }
}
