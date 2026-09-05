/**
 * @fileoverview Network calls for the coach-material version-history D1
 * sync (the same TODO.md idea #8 follow-up as
 * `coach-materials-client.ts`). Mirrors that file's split and error-handling
 * conventions exactly, applied to `state/coachMaterialVersions.ts`'s
 * snapshots instead of the materials themselves.
 *
 * Talks to `apps/debate-ai.com`'s `/api/coach-material-versions` routes via
 * `debate-api-client`.
 *
 * @module coach/coach-material-versions-client
 */

import {
  deleteCoachMaterialVersion,
  listCoachMaterialVersions,
  syncCoachMaterialVersion,
  type Client,
} from "debate-api-client";
import { apiClient, httpStatus } from "../lib/api-client";
import type { CoachMaterialVersion } from "../state/coachMaterialVersions";

/** Lists every coach-material version snapshot synced to the current user's account. Returns `null` when signed out (a `401` response). */
export async function listSavedCoachMaterialVersions(
  client: Client = apiClient,
): Promise<CoachMaterialVersion[] | null> {
  const { data, error } = await listCoachMaterialVersions({}, { client });
  if (error) {
    if (httpStatus(error) === 401) return null;
    throw new Error("Failed to load your synced coach-material version history.");
  }
  return (data ?? []) as unknown as CoachMaterialVersion[];
}

/** Saves (upserts, keyed by `version.id`) a version snapshot to the current user's account. Throws on failure, `401` included. */
export async function saveCoachMaterialVersionToAccount(
  version: CoachMaterialVersion,
  client: Client = apiClient,
): Promise<void> {
  const { error } = await syncCoachMaterialVersion(
    { path: { versionId: version.id }, body: { record: version as unknown as Record<string, unknown> & { id: string } } },
    { client },
  );
  if (error) {
    throw new Error("Failed to sync this version to your account.");
  }
}

/** Deletes a synced version snapshot from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedCoachMaterialVersionFromAccount(
  id: string,
  client: Client = apiClient,
): Promise<void> {
  const { error } = await deleteCoachMaterialVersion({ path: { versionId: id } }, { client });
  if (error) {
    throw new Error("Failed to remove this synced version.");
  }
}
