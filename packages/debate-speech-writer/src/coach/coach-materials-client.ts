/**
 * @fileoverview Network calls for the coach-material D1 sync (TODO.md idea
 * #8's "Account sync for coach materials" follow-up). Kept separate from
 * `state/savedCoachMaterials.ts`'s pure validation helpers so those stay
 * unit-testable without mocking `fetch`, mirroring `debate-round`'s
 * `round/round-pairings-client.ts` split.
 *
 * Talks to `apps/debate-ai.com`'s `/api/coach-materials` routes, which
 * require an authenticated session — `listSavedCoachMaterials` resolves to
 * `null` (rather than throwing) on a `401`, letting the caller
 * (`hooks/useCoachMaterialsSync.ts`) fall back to local-storage-only
 * materials instead of showing an error. The write calls
 * (`saveCoachMaterialToAccount`, `deleteSavedCoachMaterialFromAccount`)
 * throw on failure since the caller already has the material in local state
 * either way — a failed cloud sync is reported but never blocks local
 * saving.
 *
 * @module coach/coach-materials-client
 */

import type { CoachMaterial } from "./team-coach-materials";

/**
 * A `CoachMaterial` as `GET /api/coach-materials` actually returns it: the
 * saved row's own `updatedAt` (ISO string) mixed in. `CoachMaterial` itself
 * has no timestamp field — `reviewedAt` only covers a review decision, not a
 * save — so this is what `debate-round`'s `cloudLibrary.ts` merge needs to
 * list a synced material without inventing one. `useCoachMaterialsSync.ts`'s
 * local-storage merge still treats the extra field as absent (it only reads
 * the `CoachMaterial` fields it already knows about).
 */
export type SyncedCoachMaterial = CoachMaterial & { updatedAt: string };

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { error?: string };
    return payload?.error ?? fallback;
  } catch {
    return fallback;
  }
}

/** Lists every coach material synced to the current user's account. Returns `null` when signed out (a `401` response). */
export async function listSavedCoachMaterials(
  endpoint = "/api/coach-materials",
): Promise<SyncedCoachMaterial[] | null> {
  const res = await fetch(endpoint);
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to load your synced coach materials."));
  }
  return (await res.json()) as SyncedCoachMaterial[];
}

/** Saves (upserts, keyed by `material.id`) a coach material to the current user's account. Throws on failure, `401` included. */
export async function saveCoachMaterialToAccount(
  material: CoachMaterial,
  endpoint = "/api/coach-materials",
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(material.id)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ record: material }),
  });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to sync this material to your account."));
  }
}

/** Deletes a synced coach material from the current user's account. Throws on failure, `401` included. */
export async function deleteSavedCoachMaterialFromAccount(
  id: string,
  endpoint = "/api/coach-materials",
): Promise<void> {
  const res = await fetch(`${endpoint}/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, "Failed to remove this synced material."));
  }
}
