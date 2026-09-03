/**
 * @fileoverview Network calls for the personal research-progress-goal
 * account sync (see `research-progress-goal-sync.ts`). Talks directly to
 * `apps/debate-ai.com`'s `/api/settings` route via `fetch`, mirroring
 * `argument-library-collections-client.ts`'s split exactly (kept separate
 * from the pure validation helpers so those stay unit-testable without
 * mocking `fetch`).
 *
 * `/api/settings` requires an authenticated session — both functions resolve
 * to `null`/no-op-safe values rather than throwing on a `401`, letting the
 * caller fall back to `localStorage` for a signed-out browser.
 *
 * @module lib/research-progress-goal-sync-client
 */

import type { ResearchProgressGoalSyncPayload } from "./research-progress-goal-sync";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Fetches the current user's synced research-progress goal. Returns `null`
 * when signed out (a `401` response) rather than throwing, since that's an
 * expected, recoverable state for this hook. A signed-in user with nothing
 * synced yet resolves to `{ goal: null }`, distinct from the signed-out case.
 */
export async function fetchResearchProgressGoal(
  endpoint = "/api/settings",
): Promise<{ goal: ResearchProgressGoalSyncPayload | null } | null> {
  const res = await fetch(endpoint);
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to load account settings."));
  }
  const payload = (await res.json()) as { researchProgressGoal?: ResearchProgressGoalSyncPayload | null };
  return { goal: payload.researchProgressGoal ?? null };
}

/**
 * Saves (or, with `null`, clears) the synced goal for the current user.
 * Throws (with the server's `{ error }` message when present) on a
 * `401`/`400`/other failure — the caller is expected to have already applied
 * the change locally, so a failed account sync is reported but not fatal to
 * the UI.
 */
export async function saveResearchProgressGoal(
  goal: ResearchProgressGoalSyncPayload | null,
  endpoint = "/api/settings",
): Promise<void> {
  const res = await fetch(endpoint, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ researchProgressGoal: goal }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to save account settings."));
  }
}
