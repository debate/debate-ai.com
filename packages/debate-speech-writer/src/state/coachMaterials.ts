/**
 * @fileoverview Persistent storage for a team's `CoachMaterial` records
 * (id, kind, title, topic, tags, text) — the "(d) persisting a team's
 * `CoachMaterial`s" follow-up named in the `team-coach-materials.ts` slice
 * for idea #8 ("Video-Lecture-Training Coach AI") in TODO.md. Stores
 * materials in localStorage, mirroring `debate-round`'s
 * `coachingPrograms.ts`/`prepNotes.ts`/`flowAnnotations.ts` persistence
 * convention.
 *
 * `buildPersistedCoachMaterialLibrary`/`findRelevantPersistedMaterials`
 * compose `team-coach-materials.ts`'s pure `buildCoachMaterialLibrary`/
 * `findRelevantMaterials` directly against the persisted materials,
 * mirroring `debate-card-search`'s `evidenceLibraryEntries.ts`
 * `searchPersistedEvidenceLibrary` convention.
 *
 * @module state/coachMaterials
 */

import {
  buildCoachMaterialLibrary,
  findRelevantMaterials,
  type CoachMaterial,
  type CoachMaterialLibrary,
  type CoachMaterialMatch,
  type FindRelevantMaterialsOptions,
} from "../coach/team-coach-materials";

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

/** Builds the kind-grouped library from every persisted coach material. */
export function buildPersistedCoachMaterialLibrary(): CoachMaterialLibrary {
  return buildCoachMaterialLibrary(readAll());
}

/** Finds the persisted materials most relevant to `query`, reusing `findRelevantMaterials` directly. */
export function findRelevantPersistedMaterials(
  query: string,
  options: FindRelevantMaterialsOptions = {},
): CoachMaterialMatch[] {
  return findRelevantMaterials(readAll(), query, options);
}
