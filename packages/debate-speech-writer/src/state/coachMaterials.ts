/**
 * @fileoverview Persistent storage for a team's `CoachMaterial` records
 * (id, kind, title, topic, tags, text) — the "(d) persisting a team's
 * `CoachMaterial`s" follow-up named in the `team-coach-materials.ts` slice
 * for idea #8 ("Video-Lecture-Training Coach AI") in TODO.md. Stores
 * materials in localStorage, mirroring `debate-round`'s
 * `coachingPrograms.ts`/`prepNotes.ts`/`flowAnnotations.ts` persistence
 * convention.
 *
 * @module state/coachMaterials
 */

import type {
  CoachMaterial,
  CoachMaterialFilterOptions,
  CoachMaterialLibrary,
  CoachMaterialMatch,
  FindRelevantMaterialsOptions,
} from "../coach/team-coach-materials";
import {
  buildCoachMaterialLibrary,
  filterCoachMaterials,
  findRelevantMaterials,
  listCoachMaterialTags,
} from "../coach/team-coach-materials";
import {
  appendMaterialVersion,
  deleteVersionsForMaterial,
  type CoachMaterialVersion,
} from "./coachMaterialVersions";

const STORAGE_KEY = "coachMaterials";

function readAll(): CoachMaterial[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CoachMaterial[]) : [];
  } catch {
    return [];
  }
}

function writeAll(materials: CoachMaterial[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(materials));
}

/** Lists every persisted coach material. */
export function listCoachMaterials(): CoachMaterial[] {
  return readAll();
}

/** Looks up a single persisted coach material by id, if any. */
export function getCoachMaterial(id: string): CoachMaterial | undefined {
  return readAll().find((material) => material.id === id);
}

/** Result of a `saveCoachMaterial` call — the saved material, plus the version snapshot it created, if any. */
export type SaveCoachMaterialResult = {
  material: CoachMaterial;
  /** The prior record's snapshot, present only when this save overwrote an existing id. */
  version?: CoachMaterialVersion;
};

/**
 * Saves a coach material, overwriting any existing record with the same id.
 * Overwriting snapshots the record it replaces into
 * `state/coachMaterialVersions.ts` first, so a re-upload/edit never loses
 * the prior version outright — see that module's `listVersionsForMaterial`.
 * Returns the snapshot it created (if any) so a caller
 * (`hooks/useCoachMaterialsSync.ts`) knows to also sync it to the account.
 */
export function saveCoachMaterial(material: CoachMaterial): SaveCoachMaterialResult {
  const materials = readAll();
  const index = materials.findIndex((existing) => existing.id === material.id);
  if (index === -1) {
    materials.push(material);
    writeAll(materials);
    return { material };
  }

  const version = appendMaterialVersion(materials[index] as CoachMaterial);
  materials[index] = material;
  writeAll(materials);
  return { material, version };
}

/**
 * Adopts a coach material as-is — e.g. one fetched from the account during
 * cross-device sync (`hooks/useCoachMaterialsSync.ts`) — upserting by `id`
 * rather than snapshotting a version, so merging in a material a device
 * doesn't yet have never fabricates version history for it. Only ever
 * called for an id the local store doesn't already have (see the hook's own
 * "fill gaps, don't resolve conflicts" merge rule).
 */
export function adoptCoachMaterial(material: CoachMaterial): void {
  const materials = readAll();
  const index = materials.findIndex((existing) => existing.id === material.id);
  if (index === -1) {
    materials.push(material);
  } else {
    materials[index] = material;
  }
  writeAll(materials);
}

/**
 * Deletes a persisted coach material by id; a no-op if it isn't stored.
 * Also drops its version history, since a restore action wouldn't have a
 * live material left to restore into. Returns the version ids that were
 * removed so a caller (`hooks/useCoachMaterialsSync.ts`) knows exactly which
 * ids to also remove from the account sync.
 */
export function deleteCoachMaterial(id: string): string[] {
  writeAll(readAll().filter((material) => material.id !== id));
  return deleteVersionsForMaterial(id);
}

/**
 * Builds the kind-grouped coach-material library directly from every
 * persisted material, composing this store with `team-coach-materials.ts`'s
 * pure `buildCoachMaterialLibrary` rather than requiring a caller to hold
 * and pass in the full material list themselves — mirroring
 * `debate-card-search`'s `buildTopContributorAwardsFromStore` "compose the
 * pure function directly against the persisted store" convention.
 */
export function buildCoachMaterialLibraryFromStore(
  filter: CoachMaterialFilterOptions = {},
): CoachMaterialLibrary {
  return buildCoachMaterialLibrary(filterCoachMaterials(readAll(), filter));
}

/**
 * Every distinct tag across every persisted material, alphabetically
 * sorted — populates a search/filter bar's tag dropdown independently of
 * whatever filter is currently applied to the library view.
 */
export function listCoachMaterialTagsFromStore(): string[] {
  return listCoachMaterialTags(readAll());
}

/**
 * Finds and ranks the persisted materials most relevant to `query`,
 * composing this store with `team-coach-materials.ts`'s pure
 * `findRelevantMaterials` the same way `buildCoachMaterialLibraryFromStore`
 * composes `buildCoachMaterialLibrary`.
 */
export function findRelevantMaterialsFromStore(
  query: string,
  options: FindRelevantMaterialsOptions = {},
): CoachMaterialMatch[] {
  return findRelevantMaterials(readAll(), query, options);
}
