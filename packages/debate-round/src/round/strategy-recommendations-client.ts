/**
 * @fileoverview Network calls for the strategy-recommendation-history D1
 * sync (the "🧭 Scout-to-Strategy Workflow" bullet's "a history log of past
 * strategy recommendations per matchup" follow-up). Kept separate from
 * `state/savedStrategyRecommendations.ts`'s pure validation helpers so those
 * stay unit-testable without mocking the API client, mirroring
 * `round/judge-decisions-client.ts`'s split.
 *
 * Talks to `apps/debate-ai.com`'s `/api/strategy-recommendations` routes
 * (via `debate-api-client`), which require an authenticated session —
 * `listSavedStrategyRecommendations` resolves to `null` (rather than
 * throwing) on a `401`, letting the caller
 * (`hooks/useStrategyRecommendations.ts`) fall back to local-storage-only
 * history instead of showing an error. The write calls
 * (`saveStrategyRecommendationToAccount`,
 * `deleteSavedStrategyRecommendationFromAccount`) throw on failure since the
 * caller already has the recommendation in local state either way — a
 * failed cloud sync is reported but never blocks local saving.
 *
 * @module round/strategy-recommendations-client
 */

import {
  deleteStrategyRecommendation,
  listStrategyRecommendations,
  syncStrategyRecommendation,
  type Client,
} from "debate-api-client";
import { apiClient, httpStatus } from "../lib/api-client";
import type { StrategyRecommendationRecord } from "../state/strategyRecommendations";

/** Lists every strategy recommendation synced to the current user's account. Returns `null` when signed out (a `401` response). */
export async function listSavedStrategyRecommendations(
  client: Client = apiClient,
): Promise<StrategyRecommendationRecord[] | null> {
  const { data, error } = await listStrategyRecommendations({}, { client });
  if (error) {
    if (httpStatus(error) === 401) return null;
    throw new Error("Failed to load your synced strategy recommendations.");
  }
  return (data ?? []) as StrategyRecommendationRecord[];
}

/** Saves (upserts, keyed by `record.id`) a strategy recommendation to the current user's account. Throws on failure, `401` included. */
export async function saveStrategyRecommendationToAccount(
  record: StrategyRecommendationRecord,
  client: Client = apiClient,
): Promise<void> {
  const { error } = await syncStrategyRecommendation(
    { path: { recommendationId: record.id }, body: { record } },
    { client },
  );
  if (error) {
    throw new Error("Failed to sync this strategy recommendation to your account.");
  }
}

/** Deletes a synced strategy recommendation from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedStrategyRecommendationFromAccount(
  id: string,
  client: Client = apiClient,
): Promise<void> {
  const { error } = await deleteStrategyRecommendation({ path: { recommendationId: id } }, { client });
  if (error) {
    throw new Error("Failed to remove this synced strategy recommendation.");
  }
}
