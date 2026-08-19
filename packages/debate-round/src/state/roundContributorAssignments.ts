/**
 * @fileoverview Persistent storage for `round/coaching-program.ts`'s
 * `RoundContributorAssignment` records — the `roundId`-to-contributor mapping
 * named as the remaining half of the "(b-continued)" follow-up under idea #13
 * ("Coaching Programs and Group Challenges") in TODO.md, and the "Known
 * gaps" bullet in `docs/features/coaching-programs.md`. Stores assignments in
 * localStorage, mirroring the existing `state/coachingPrograms.ts`
 * persistence convention. One active assignment per `(programId,
 * contributorId)` pair — assigning a new `roundId` for a member replaces
 * their previous assignment in that program, matching
 * `CoachingProgramBoard.memberDrills`'s one-entry-per-contributor shape.
 *
 * @module state/roundContributorAssignments
 */

import type { RoundContributorAssignment } from "../round/coaching-program";

const STORAGE_KEY = "roundContributorAssignments";

function readAll(): RoundContributorAssignment[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RoundContributorAssignment[]) : [];
  } catch {
    return [];
  }
}

function writeAll(assignments: RoundContributorAssignment[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
}

/** Lists every persisted round-contributor assignment for one coaching program. */
export function listRoundContributorAssignments(programId: string): RoundContributorAssignment[] {
  return readAll().filter((assignment) => assignment.programId === programId);
}

/**
 * Assigns a `roundId` to a squad member within a coaching program, replacing
 * any existing assignment for that same `(programId, contributorId)` pair.
 */
export function assignRoundToContributor(assignment: RoundContributorAssignment): void {
  const assignments = readAll();
  const index = assignments.findIndex(
    (existing) => existing.programId === assignment.programId && existing.contributorId === assignment.contributorId,
  );
  if (index === -1) {
    assignments.push(assignment);
  } else {
    assignments[index] = assignment;
  }
  writeAll(assignments);
}

/** Clears a squad member's round assignment within a coaching program; a no-op if none is stored. */
export function unassignRoundFromContributor(programId: string, contributorId: string): void {
  writeAll(
    readAll().filter((assignment) => !(assignment.programId === programId && assignment.contributorId === contributorId)),
  );
}
