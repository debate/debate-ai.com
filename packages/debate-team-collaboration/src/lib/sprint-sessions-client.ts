/**
 * @fileoverview Network calls for the scheduled-sprint-session D1 sync (the
 * "🤝 Team Collaboration Mode" bullet's "Scheduled sessions ... are ...
 * local-only (no account sync yet)" Known gap in TODO.md). Kept separate
 * from `state/sprintSessions.ts`'s pure validation/storage helpers so those
 * stay unit-testable without mocking `fetch`, mirroring `debate-community`'s
 * `lib/daily-best-card-comments-client.ts` split.
 *
 * Talks to `apps/debate-ai.com`'s `/api/sprint-sessions` routes, which
 * require an authenticated session — `listSavedSprintSessions` resolves to
 * `null` (rather than throwing) on a `401`, letting the caller
 * (`hooks/useSprintSessionsSync.ts`) fall back to local-storage-only
 * sessions instead of showing an error. The write calls
 * (`saveSprintSessionToAccount`, `deleteSavedSprintSessionFromAccount`)
 * throw on failure since the caller already has the session in local state
 * either way — a failed cloud sync is reported but never blocks scheduling.
 *
 * @module lib/sprint-sessions-client
 */

import type { SprintSession } from "./team-collaboration-mode";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Lists every sprint session synced to the current user's account, across every topic. Returns `null` when signed out (a `401` response). */
export async function listSavedSprintSessions(
  endpoint = "/api/sprint-sessions",
): Promise<SprintSession[] | null> {
  const res = await fetch(endpoint);
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to load your synced sprint sessions."));
  }
  return (await res.json()) as SprintSession[];
}

/** Saves (upserts, keyed by `session.id`) a sprint session to the current user's account. Throws on failure, `401` included. */
export async function saveSprintSessionToAccount(
  session: SprintSession,
  endpoint = "/api/sprint-sessions",
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(session.id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ session }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to sync this session to your account."));
  }
}

/** Deletes a synced sprint session from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedSprintSessionFromAccount(
  id: string,
  endpoint = "/api/sprint-sessions",
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to remove this synced session."));
  }
}
