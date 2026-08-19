/**
 * @fileoverview Persistent storage for a coaching program member's chosen
 * `roundId` (and the side they debated) — the `roundId`-to-contributor
 * mapping named as the remaining half of the "(b-continued)" follow-up under
 * idea #13 ("Coaching Programs and Group Challenges") in TODO.md: "a
 * `roundId`-to-contributor mapping so a member's already-flowed practice
 * round can generate a drill set on this board."
 *
 * `roundId` here is the same convention `hooks/useWordCountSpeechMode.ts`
 * already uses: the live flow editor's own `Flow.id`, stringified — not one
 * of this package's separate "practice round" session ids
 * (`aiVersusRounds.ts`/`practiceRounds.ts`). `state/liveFlows.ts` resolves
 * that id back to a real, already-flowed `Flow`.
 *
 * Scoped per `(programId, contributorId)` pair — the same member can be
 * assigned a different round in a different coaching program. Stores
 * assignments in localStorage, mirroring the existing
 * `argumentTreeFilters.ts`/`judgeParadigmSelections.ts` persistence
 * convention.
 *
 * @module state/memberRoundAssignments
 */

export type MemberRoundAssignment = {
  programId: string;
  contributorId: string;
  roundId: string;
  sideKey: string;
};

const STORAGE_KEY = "memberRoundAssignments";

function readAll(): MemberRoundAssignment[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MemberRoundAssignment[]) : [];
  } catch {
    return [];
  }
}

function writeAll(assignments: MemberRoundAssignment[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
}

/** Lists every persisted round assignment across every coaching program. */
export function listAllMemberRoundAssignments(): MemberRoundAssignment[] {
  return readAll();
}

/** Lists a coaching program's persisted member round assignments. */
export function listMemberRoundAssignments(programId: string): MemberRoundAssignment[] {
  return readAll().filter((assignment) => assignment.programId === programId);
}

/** Looks up a program member's persisted round assignment, if any. */
export function getMemberRoundAssignment(
  programId: string,
  contributorId: string,
): MemberRoundAssignment | undefined {
  return readAll().find(
    (assignment) => assignment.programId === programId && assignment.contributorId === contributorId,
  );
}

/**
 * Saves a program member's round assignment, overwriting any existing
 * assignment for that `(programId, contributorId)` pair.
 */
export function saveMemberRoundAssignment(assignment: MemberRoundAssignment): void {
  const assignments = readAll();
  const index = assignments.findIndex(
    (existing) =>
      existing.programId === assignment.programId && existing.contributorId === assignment.contributorId,
  );
  if (index === -1) {
    assignments.push(assignment);
  } else {
    assignments[index] = assignment;
  }
  writeAll(assignments);
}

/**
 * Deletes a program member's persisted round assignment; a no-op if it isn't
 * stored.
 */
export function deleteMemberRoundAssignment(programId: string, contributorId: string): void {
  writeAll(
    readAll().filter(
      (assignment) => !(assignment.programId === programId && assignment.contributorId === contributorId),
    ),
  );
}
