/**
 * @fileoverview Network calls for the personal research-progress-goal
 * account sync (see `research-progress-goal-sync.ts`). Talks directly to
 * `apps/debate-ai.com`'s `/api/settings` route via `debate-api-client`,
 * mirroring `argument-library-collections-client.ts`'s split exactly (kept
 * separate from the pure validation helpers so those stay unit-testable
 * without mocking the API client).
 *
 * `/api/settings` requires an authenticated session — both functions resolve
 * to `null`/no-op-safe values rather than throwing on a `401`, letting the
 * caller fall back to `localStorage` for a signed-out browser.
 *
 * @module lib/research-progress-goal-sync-client
 */

import { getUserSettings, updateUserSettings, type Client } from "debate-api-client";
import { apiClient, httpStatus } from "./api-client";
import type { ResearchProgressGoalSyncPayload } from "./research-progress-goal-sync";

/**
 * Fetches the current user's synced research-progress goal. Returns `null`
 * when signed out (a `401` response) rather than throwing, since that's an
 * expected, recoverable state for this hook. A signed-in user with nothing
 * synced yet resolves to `{ goal: null }`, distinct from the signed-out case.
 */
export async function fetchResearchProgressGoal(
  client: Client = apiClient,
): Promise<{ goal: ResearchProgressGoalSyncPayload | null } | null> {
  const { data, error } = await getUserSettings({}, { client });
  if (error) {
    if (httpStatus(error) === 401) return null;
    throw new Error("Failed to load account settings.");
  }
  const payload = data as { researchProgressGoal?: ResearchProgressGoalSyncPayload | null };
  return { goal: payload.researchProgressGoal ?? null };
}

/**
 * Saves (or, with `null`, clears) the synced goal for the current user.
 * Throws on a `401`/`400`/other failure — the caller is expected to have
 * already applied the change locally, so a failed account sync is reported
 * but not fatal to the UI.
 */
export async function saveResearchProgressGoal(
  goal: ResearchProgressGoalSyncPayload | null,
  client: Client = apiClient,
): Promise<void> {
  const { error } = await updateUserSettings({ body: { researchProgressGoal: goal } }, { client });
  if (error) {
    throw new Error("Failed to save account settings.");
  }
}
