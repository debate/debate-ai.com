/**
 * @fileoverview Network calls for the custom-opponent-persona-library D1
 * sync (the "🤖 AI Practice Opponent" idea's "share a custom-authored
 * persona across a team instead of per-user only" Next item in TODO.md).
 * Kept separate from `state/customOpponentPersonaLibrary.ts`'s pure
 * persistence/merge helpers so those stay unit-testable without mocking
 * `fetch`, mirroring `round/drill-sets-client.ts`'s split.
 *
 * Talks to `apps/debate-ai.com`'s `/api/custom-opponent-personas` routes.
 * The account-only endpoints (list/save/delete "my" library) require an
 * authenticated session, resolving to `null` (rather than throwing) on a
 * `401` so the caller (`hooks/useCustomOpponentPersonaLibrary.ts`) falls
 * back to local-storage-only entries instead of showing an error. The
 * `/shared` endpoint needs no session — it's the team-wide, read-only view
 * of every user's `shared: true` entries, mirroring
 * `GET /api/evidence-reuse-check/dashboard`'s no-auth team dashboard.
 *
 * @module round/custom-opponent-persona-library-client
 */

import type { SavedCustomOpponentPersona } from "debate-speech-writer/src/opponent/opponent-persona-library";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Lists every custom-persona library entry synced to the current user's account. Returns `null` when signed out (a `401` response). */
export async function listMyCustomOpponentPersonas(
  endpoint = "/api/custom-opponent-personas",
): Promise<SavedCustomOpponentPersona[] | null> {
  const res = await fetch(endpoint);
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to load your synced persona library."));
  }
  return (await res.json()) as SavedCustomOpponentPersona[];
}

/** Saves (upserts, keyed by `entry.id`) a custom-persona library entry to the current user's account. Throws on failure, `401` included. */
export async function saveCustomOpponentPersonaToAccount(
  entry: SavedCustomOpponentPersona,
  endpoint = "/api/custom-opponent-personas",
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(entry.id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ entry }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to sync this persona to your account."));
  }
}

/** Deletes a synced custom-persona library entry from the current user's account. Throws on failure, `401` included. */
export async function deleteCustomOpponentPersonaFromAccount(
  id: string,
  endpoint = "/api/custom-opponent-personas",
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to remove this synced persona."));
  }
}

/** Lists every other user's `shared: true` library entries — no session required. Throws on failure. */
export async function listSharedCustomOpponentPersonas(
  endpoint = "/api/custom-opponent-personas/shared",
): Promise<SavedCustomOpponentPersona[]> {
  const res = await fetch(endpoint);
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to load personas shared by your team."));
  }
  return (await res.json()) as SavedCustomOpponentPersona[];
}
