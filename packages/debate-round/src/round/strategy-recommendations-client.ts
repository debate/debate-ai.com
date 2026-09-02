/**
 * @fileoverview Network calls for the strategy-recommendation-history D1
 * sync (the "🧭 Scout-to-Strategy Workflow" bullet's "a history log of past
 * strategy recommendations per matchup" follow-up). Kept separate from
 * `state/savedStrategyRecommendations.ts`'s pure validation helpers so those
 * stay unit-testable without mocking `fetch`, mirroring
 * `round/judge-decisions-client.ts`'s split.
 *
 * Talks to `apps/debate-ai.com`'s `/api/strategy-recommendations` routes,
 * which require an authenticated session — `listSavedStrategyRecommendations`
 * resolves to `null` (rather than throwing) on a `401`, letting the caller
 * (`hooks/useStrategyRecommendations.ts`) fall back to local-storage-only
 * history instead of showing an error. The write calls
 * (`saveStrategyRecommendationToAccount`,
 * `deleteSavedStrategyRecommendationFromAccount`) throw on failure since the
 * caller already has the recommendation in local state either way — a
 * failed cloud sync is reported but never blocks local saving.
 *
 * @module round/strategy-recommendations-client
 */

import type { StrategyRecommendationRecord } from "../state/strategyRecommendations";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Lists every strategy recommendation synced to the current user's account. Returns `null` when signed out (a `401` response). */
export async function listSavedStrategyRecommendations(
  endpoint = "/api/strategy-recommendations",
): Promise<StrategyRecommendationRecord[] | null> {
  const res = await fetch(endpoint);
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to load your synced strategy recommendations."));
  }
  return (await res.json()) as StrategyRecommendationRecord[];
}

/** Saves (upserts, keyed by `record.id`) a strategy recommendation to the current user's account. Throws on failure, `401` included. */
export async function saveStrategyRecommendationToAccount(
  record: StrategyRecommendationRecord,
  endpoint = "/api/strategy-recommendations",
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(record.id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ record }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to sync this strategy recommendation to your account."));
  }
}

/** Deletes a synced strategy recommendation from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedStrategyRecommendationFromAccount(
  id: string,
  endpoint = "/api/strategy-recommendations",
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to remove this synced strategy recommendation."));
  }
}
