/**
 * @fileoverview Network calls for the coach-material version-history D1
 * sync (the same TODO.md idea #8 follow-up as
 * `coach-materials-client.ts`). Mirrors that file's split and error-handling
 * conventions exactly, applied to `state/coachMaterialVersions.ts`'s
 * snapshots instead of the materials themselves.
 *
 * Talks to `apps/debate-ai.com`'s `/api/coach-material-versions` routes.
 *
 * @module coach/coach-material-versions-client
 */

import type { CoachMaterialVersion } from "../state/coachMaterialVersions";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Lists every coach-material version snapshot synced to the current user's account. Returns `null` when signed out (a `401` response). */
export async function listSavedCoachMaterialVersions(
  endpoint = "/api/coach-material-versions",
): Promise<CoachMaterialVersion[] | null> {
  const res = await fetch(endpoint);
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to load your synced coach-material version history."));
  }
  return (await res.json()) as CoachMaterialVersion[];
}

/** Saves (upserts, keyed by `version.id`) a version snapshot to the current user's account. Throws on failure, `401` included. */
export async function saveCoachMaterialVersionToAccount(
  version: CoachMaterialVersion,
  endpoint = "/api/coach-material-versions",
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(version.id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ record: version }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to sync this version to your account."));
  }
}

/** Deletes a synced version snapshot from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedCoachMaterialVersionFromAccount(
  id: string,
  endpoint = "/api/coach-material-versions",
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to remove this synced version."));
  }
}
