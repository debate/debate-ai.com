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
  CoachMaterialLibrary,
  CoachMaterialMatch,
  FindRelevantMaterialsOptions,
} from "../coach/team-coach-materials";
import { buildCoachMaterialLibrary, findRelevantMaterials } from "../coach/team-coach-materials";

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

/** Saves a coach material, overwriting any existing record with the same id. */
export function saveCoachMaterial(material: CoachMaterial): void {
  const materials = readAll();
  const index = materials.findIndex((existing) => existing.id === material.id);
  if (index === -1) {
    materials.push(material);
  } else {
    materials[index] = material;
  }
  writeAll(materials);
}

/** Deletes a persisted coach material by id; a no-op if it isn't stored. */
export function deleteCoachMaterial(id: string): void {
  writeAll(readAll().filter((material) => material.id !== id));
}

/**
 * Builds the kind-grouped coach-material library directly from every
 * persisted material, composing this store with `team-coach-materials.ts`'s
 * pure `buildCoachMaterialLibrary` rather than requiring a caller to hold
 * and pass in the full material list themselves — mirroring
 * `debate-card-search`'s `buildTopContributorAwardsFromStore` "compose the
 * pure function directly against the persisted store" convention.
 */
export function buildCoachMaterialLibraryFromStore(): CoachMaterialLibrary {
  return buildCoachMaterialLibrary(readAll());
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
