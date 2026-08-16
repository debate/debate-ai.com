/**
 * @fileoverview Persistent storage for a coach's `CoachingProgramConfig`
 * records (id, name, squad roster) — the "(a) persisting a coaching
 * program's config and board inputs" follow-up named in the
 * `coaching-program.ts` slice (PR #99) for idea #13 ("Coaching Programs and
 * Group Challenges") in TODO.md. Stores configs (not a program's board
 * inputs, which are session-derived rather than config) in localStorage,
 * mirroring the existing `myTeamProfile.ts` persistence convention.
 *
 * @module state/coachingPrograms
 */

import type { CoachingProgramConfig } from "../round/coaching-program";

const STORAGE_KEY = "coachingPrograms";

function readAll(): CoachingProgramConfig[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CoachingProgramConfig[]) : [];
  } catch {
    return [];
  }
}

function writeAll(programs: CoachingProgramConfig[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(programs));
}

/** Lists every persisted coaching-program config. */
export function listCoachingPrograms(): CoachingProgramConfig[] {
  return readAll();
}

/** Looks up a single persisted coaching-program config by id, if any. */
export function getCoachingProgram(id: string): CoachingProgramConfig | undefined {
  return readAll().find((program) => program.id === id);
}

/** Saves a coaching-program config, overwriting any existing record with the same id. */
export function saveCoachingProgram(program: CoachingProgramConfig): void {
  const programs = readAll();
  const index = programs.findIndex((existing) => existing.id === program.id);
  if (index === -1) {
    programs.push(program);
  } else {
    programs[index] = program;
  }
  writeAll(programs);
}

/** Deletes a persisted coaching-program config by id; a no-op if it isn't stored. */
export function deleteCoachingProgram(id: string): void {
  writeAll(readAll().filter((program) => program.id !== id));
}
