/**
 * @fileoverview Network calls for the brainstorm session-timer account sync
 * (see `brainstorm-session-timer-sync.ts`). Talks directly to
 * `apps/debate-ai.com`'s `/api/settings` route via `fetch`, mirroring
 * `research-progress-goal-sync-client.ts`'s split exactly (kept separate
 * from the pure validation helpers so those stay unit-testable without
 * mocking `fetch`).
 *
 * `/api/settings` requires an authenticated session — both functions resolve
 * to `null`/no-op-safe values rather than throwing on a `401`, letting the
 * caller fall back to `localStorage` for a signed-out browser.
 *
 * @module lib/brainstorm-session-timer-sync-client
 */

import type { BrainstormSessionTimerSyncPayload } from "./brainstorm-session-timer-sync";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Fetches the current user's synced brainstorm session timer. Returns `null`
 * when signed out (a `401` response) rather than throwing, since that's an
 * expected, recoverable state for this hook. A signed-in user with nothing
 * synced yet resolves to `{ timer: null }`, distinct from the signed-out case.
 */
export async function fetchBrainstormSessionTimer(
  endpoint = "/api/settings",
): Promise<{ timer: BrainstormSessionTimerSyncPayload | null } | null> {
  const res = await fetch(endpoint);
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to load account settings."));
  }
  const payload = (await res.json()) as { brainstormSessionTimer?: BrainstormSessionTimerSyncPayload | null };
  return { timer: payload.brainstormSessionTimer ?? null };
}

/**
 * Saves (or, with `null`, clears) the synced timer for the current user.
 * Throws (with the server's `{ error }` message when present) on a
 * `401`/`400`/other failure — the caller is expected to have already applied
 * the change locally, so a failed account sync is reported but not fatal to
 * the UI.
 */
export async function saveBrainstormSessionTimer(
  timer: BrainstormSessionTimerSyncPayload | null,
  endpoint = "/api/settings",
): Promise<void> {
  const res = await fetch(endpoint, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ brainstormSessionTimer: timer }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to save account settings."));
  }
}
