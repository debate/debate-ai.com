/**
 * @fileoverview Network calls for the coach-material D1 sync (TODO.md idea
 * #8's "Account sync for coach materials" follow-up). Kept separate from
 * `state/savedCoachMaterials.ts`'s pure validation helpers so those stay
 * unit-testable without mocking the API client, mirroring `debate-round`'s
 * `round/round-pairings-client.ts` split.
 *
 * Talks to `apps/debate-ai.com`'s `/api/coach-materials` routes (via
 * `debate-api-client`), which require an authenticated session —
 * `listSavedCoachMaterials` resolves to `null` (rather than throwing) on a
 * `401`, letting the caller (`hooks/useCoachMaterialsSync.ts`) fall back to
 * local-storage-only materials instead of showing an error. The write calls
 * (`saveCoachMaterialToAccount`, `deleteSavedCoachMaterialFromAccount`)
 * throw on failure since the caller already has the material in local state
 * either way — a failed cloud sync is reported but never blocks local
 * saving.
 *
 * @module coach/coach-materials-client
 */

import { deleteCoachMaterial, listCoachMaterials, syncCoachMaterial, type Client } from "debate-api-client";
import { apiClient, httpStatus } from "../lib/api-client";
import type { CoachMaterial } from "./team-coach-materials";

/** Lists every coach material synced to the current user's account. Returns `null` when signed out (a `401` response). */
export async function listSavedCoachMaterials(client: Client = apiClient): Promise<CoachMaterial[] | null> {
  const { data, error } = await listCoachMaterials({}, { client });
  if (error) {
    if (httpStatus(error) === 401) return null;
    throw new Error("Failed to load your synced coach materials.");
  }
  return (data ?? []) as unknown as CoachMaterial[];
}

/** Saves (upserts, keyed by `material.id`) a coach material to the current user's account. Throws on failure, `401` included. */
export async function saveCoachMaterialToAccount(
  material: CoachMaterial,
  client: Client = apiClient,
): Promise<void> {
  const { error } = await syncCoachMaterial(
    { path: { materialId: material.id }, body: { record: material as unknown as Record<string, unknown> & { id: string } } },
    { client },
  );
  if (error) {
    throw new Error("Failed to sync this material to your account.");
  }
}

/** Deletes a synced coach material from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedCoachMaterialFromAccount(id: string, client: Client = apiClient): Promise<void> {
  const { error } = await deleteCoachMaterial({ path: { materialId: id } }, { client });
  if (error) {
    throw new Error("Failed to remove this synced material.");
  }
}
