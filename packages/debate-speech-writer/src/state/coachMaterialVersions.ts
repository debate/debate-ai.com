/**
 * @fileoverview Version history for a `CoachMaterial` that gets
 * re-uploaded/edited in place — the "Known gap" named in
 * `docs/features/coach-materials.md`: saving over an existing id silently
 * overwrote it with no way to see or restore a prior version. Stores a
 * snapshot of a material's fields every time `state/coachMaterials.ts`'s
 * `saveCoachMaterial` overwrites an existing record, mirroring this
 * package's own localStorage persistence convention (see
 * `state/coachMaterials.ts`). Local-only, matching the base
 * `state/coachMaterials.ts` store itself — no account sync exists for
 * coach materials yet.
 *
 * @module state/coachMaterialVersions
 */

import type { CoachMaterial } from "../coach/team-coach-materials";

/** A snapshot of a `CoachMaterial`'s fields as they stood just before being overwritten. */
export interface CoachMaterialVersion {
  id: string;
  materialId: string;
  kind: CoachMaterial["kind"];
  title: string;
  topic?: string;
  tags: string[];
  text: string;
  /** When this snapshot was superseded by the save that captured it. */
  replacedAt: number;
}

const STORAGE_KEY = "coachMaterialVersions";

/** Oldest versions beyond this count are dropped per material, newest kept. */
export const MAX_VERSIONS_PER_MATERIAL = 10;

function readAll(): CoachMaterialVersion[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CoachMaterialVersion[]) : [];
  } catch {
    return [];
  }
}

function writeAll(versions: CoachMaterialVersion[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(versions));
}

/**
 * Snapshots `previous` as a version of `previous.id`, called by
 * `saveCoachMaterial` right before it overwrites an existing record.
 * Trims the oldest snapshot for that material once its count exceeds
 * `MAX_VERSIONS_PER_MATERIAL`.
 */
export function appendMaterialVersion(
  previous: CoachMaterial,
  replacedAt: number = Date.now(),
): CoachMaterialVersion {
  const versions = readAll();
  // Suffix with the count of versions already stored for this material
  // (not just `replacedAt`) so two overwrites within the same millisecond
  // still get distinct ids.
  const priorCount = versions.filter((v) => v.materialId === previous.id).length;
  const version: CoachMaterialVersion = {
    id: `${previous.id}-v${replacedAt}-${priorCount}`,
    materialId: previous.id,
    kind: previous.kind,
    title: previous.title,
    topic: previous.topic,
    tags: previous.tags,
    text: previous.text,
    replacedAt,
  };

  versions.push(version);

  const forMaterial = versions.filter((v) => v.materialId === previous.id);
  if (forMaterial.length > MAX_VERSIONS_PER_MATERIAL) {
    const oldest = forMaterial.slice(0, forMaterial.length - MAX_VERSIONS_PER_MATERIAL);
    const oldestIds = new Set(oldest.map((v) => v.id));
    writeAll(versions.filter((v) => !oldestIds.has(v.id)));
  } else {
    writeAll(versions);
  }

  return version;
}

/**
 * Every persisted version of `materialId`, newest first. Reverses storage
 * (insertion) order rather than sorting by `replacedAt` directly, since two
 * overwrites in the same millisecond would otherwise tie and fall back to
 * an arbitrary order.
 */
export function listVersionsForMaterial(materialId: string): CoachMaterialVersion[] {
  return readAll()
    .filter((version) => version.materialId === materialId)
    .reverse();
}

/**
 * Every persisted version across every material, insertion order — feeds
 * `hooks/useCoachMaterialsSync.ts`'s account merge, which reconciles the
 * whole version history rather than one material at a time.
 */
export function listAllCoachMaterialVersions(): CoachMaterialVersion[] {
  return readAll();
}

/**
 * Deletes every persisted version of `materialId` — called when that
 * material itself is deleted. Returns the ids that were actually removed
 * so a caller (`hooks/useCoachMaterialsSync.ts`) knows exactly which ids to
 * also remove from the account sync; an empty array if none were stored.
 */
export function deleteVersionsForMaterial(materialId: string): string[] {
  const all = readAll();
  const removedIds = all.filter((version) => version.materialId === materialId).map((version) => version.id);
  if (removedIds.length > 0) {
    writeAll(all.filter((version) => version.materialId !== materialId));
  }
  return removedIds;
}

/**
 * Adopts a version snapshot as-is — e.g. one fetched from the account
 * during cross-device sync (`hooks/useCoachMaterialsSync.ts`) — upserting by
 * `id` rather than assigning a fresh one, so a version created on one
 * device doesn't duplicate when merged onto another. Unlike
 * `appendMaterialVersion`, this never trims against
 * `MAX_VERSIONS_PER_MATERIAL` — the device that originally snapshotted the
 * version already enforced that cap, and a remote version only reaches here
 * once per merge (see the hook's own accepted-edge-case note).
 */
export function adoptMaterialVersion(version: CoachMaterialVersion): void {
  const versions = readAll();
  const index = versions.findIndex((existing) => existing.id === version.id);
  if (index === -1) {
    versions.push(version);
  } else {
    versions[index] = version;
  }
  writeAll(versions);
}

/** Rebuilds a `CoachMaterial` from a snapshot, ready to pass back to `saveCoachMaterial` to restore it. */
export function materialFromVersion(version: CoachMaterialVersion): CoachMaterial {
  return {
    id: version.materialId,
    kind: version.kind,
    title: version.title,
    topic: version.topic,
    tags: version.tags,
    text: version.text,
  };
}
