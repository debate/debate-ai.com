/**
 * @fileoverview Persistent storage for a coaching program's roster-member →
 * practice-round assignments — the "(c) wiring a member's practice-round
 * setup/feedback (Practice Round Simulator) into the space" follow-up named
 * under the "Coaching Programs and Group Challenges" bullet (idea #13) in
 * TODO.md.
 *
 * Stores, per `programId`, a `contributorId` → `roundId` map in localStorage
 * (mirroring the existing `coachingPrograms.ts`/`practiceRounds.ts`
 * persistence convention), and composes it against the real persisted
 * `practiceRounds.ts` store via `buildCoachingProgramMemberPracticeRoundsFromStores`
 * — mirroring `buildPreRoundBriefingFromStores`'s "resolve a composition
 * helper's inputs from their own persisted stores" pattern.
 *
 * @module state/coachingProgramMemberRounds
 */

import { buildCoachingProgramMemberPracticeRounds } from "../round/coaching-program-practice-rounds";
import type { CoachingProgramMemberPracticeRoundView } from "../round/coaching-program-practice-rounds";
import type { CoachingProgramConfig } from "../round/coaching-program";
import { listPracticeRounds } from "./practiceRounds";

const STORAGE_KEY = "coachingProgramMemberRounds";

/** `programId` → (`contributorId` → assigned `roundId`). */
type StoredAssignments = Record<string, Record<string, string>>;

function readAll(): StoredAssignments {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as StoredAssignments)
      : {};
  } catch {
    return {};
  }
}

function writeAll(assignments: StoredAssignments): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
}

/** Looks up a program's persisted `contributorId` → `roundId` assignment map. Empty if none is stored. */
export function getMemberRoundIds(programId: string): Record<string, string> {
  return readAll()[programId] ?? {};
}

/** Assigns (or reassigns) a roster member's practice round within a program. */
export function setMemberPracticeRound(programId: string, contributorId: string, roundId: string): void {
  const all = readAll();
  const forProgram = { ...(all[programId] ?? {}), [contributorId]: roundId };
  writeAll({ ...all, [programId]: forProgram });
}

/** Clears a roster member's assigned practice round within a program; a no-op if none is assigned. */
export function clearMemberPracticeRound(programId: string, contributorId: string): void {
  const all = readAll();
  const forProgram = { ...(all[programId] ?? {}) };
  delete forProgram[contributorId];
  writeAll({ ...all, [programId]: forProgram });
}

/**
 * Composes a program's persisted member-round assignments against the real,
 * persisted `practiceRounds.ts` store into rendered per-member setup/feedback
 * views — closing follow-up (c) named under idea #13 in TODO.md. Callers
 * don't need to pass in either store's contents themselves.
 */
export function buildCoachingProgramMemberPracticeRoundsFromStores(
  program: CoachingProgramConfig,
): CoachingProgramMemberPracticeRoundView[] {
  return buildCoachingProgramMemberPracticeRounds(
    program,
    getMemberRoundIds(program.id),
    listPracticeRounds(),
  );
}
