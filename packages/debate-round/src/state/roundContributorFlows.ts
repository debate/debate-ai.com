/**
 * @fileoverview Persisted roundId-to-contributor mapping for a coaching
 * program member's already-flowed practice round — the "(b-continued,
 * remaining)" follow-up named under idea #13 ("Coaching Programs and Group
 * Challenges") in TODO.md: "a roundId-to-contributor mapping so a member's
 * already-flowed practice round can generate a drill set on this board."
 * Also closes `docs/features/coaching-programs.md`'s "Known gaps" entry.
 *
 * Mirrors the existing `argumentTrees.ts`/`vulnerabilityReports.ts`
 * `roundId`-keyed localStorage-store convention, but keyed by
 * `contributorId` instead — a contributor "records" whichever round is
 * currently their live flowed practice round, overwriting any earlier
 * record, so `state/persistedCoachingProgramBoard.ts` always resolves each
 * roster member's *current* flow (the input `round/coaching-program.ts`'s
 * `buildCoachingProgramBoard` actually needs, one flow per member) rather
 * than every round they've ever flowed.
 *
 * The same `roundId`-to-contributor mapping also resolves each roster
 * member's linked Practice Round Simulator round
 * (`buildCoachingProgramMemberPracticeRounds`), closing idea #13's remaining
 * follow-up (c) — "wiring a member's practice-round setup/feedback (Practice
 * Round Simulator) into the space."
 *
 * @module state/roundContributorFlows
 */

import type { Flow } from "debate-core/src/types/flow";
import type {
  CoachingProgramMemberFlow,
  CoachingProgramMemberPracticeRound,
} from "../round/coaching-program";
import { getPracticeRound } from "./practiceRounds";

/** A contributor's currently recorded, already-flowed practice round. */
export type RoundContributorFlowRecord = {
  contributorId: string;
  roundId: string;
  sideKey: string;
  flow: Pick<Flow, "children" | "columns">;
};

const STORAGE_KEY = "roundContributorFlows";

function readAll(): RoundContributorFlowRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RoundContributorFlowRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: RoundContributorFlowRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Lists every contributor's currently recorded flow. */
export function listRoundContributorFlows(): RoundContributorFlowRecord[] {
  return readAll();
}

/** Looks up a contributor's currently recorded flow, if any. */
export function getRoundContributorFlow(contributorId: string): RoundContributorFlowRecord | undefined {
  return readAll().find((record) => record.contributorId === contributorId);
}

/** Saves a contributor's currently flowed round, overwriting any existing record for that `contributorId`. */
export function saveRoundContributorFlow(record: RoundContributorFlowRecord): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.contributorId === record.contributorId);
  if (index === -1) {
    records.push(record);
  } else {
    records[index] = record;
  }
  writeAll(records);
}

/** Deletes a contributor's persisted flow record; a no-op if none is stored. */
export function deleteRoundContributorFlow(contributorId: string): void {
  writeAll(readAll().filter((record) => record.contributorId !== contributorId));
}

/**
 * Records a contributor's already-flowed practice round in one step — lets a
 * caller with a live `Flow` persist it as that contributor's current round
 * without hand-building the record.
 */
export function buildAndSaveRoundContributorFlow(
  flow: Pick<Flow, "children" | "columns">,
  roundId: string,
  contributorId: string,
  sideKey: string,
): RoundContributorFlowRecord {
  const record: RoundContributorFlowRecord = { contributorId, roundId, sideKey, flow };
  saveRoundContributorFlow(record);
  return record;
}

/**
 * Resolves a coaching program roster's member flows directly from persisted
 * state, for `state/persistedCoachingProgramBoard.ts`'s
 * `buildPersistedCoachingProgramBoard` to compose into
 * `round/coaching-program.ts`'s `buildCoachingProgramBoard` — the
 * `roundId`-to-contributor mapping named in idea #13's remaining follow-up.
 * Members outside `memberIds` are excluded; a member with no recorded flow
 * is simply absent, mirroring `buildCoachingProgramBoard`'s existing
 * "no flow, no drills" behavior.
 */
export function buildCoachingProgramMemberFlows(memberIds: string[]): CoachingProgramMemberFlow[] {
  const memberSet = new Set(memberIds);
  return readAll()
    .filter((record) => memberSet.has(record.contributorId))
    .map(({ contributorId, sideKey, flow }) => ({ contributorId, sideKey, flow }));
}

/**
 * Resolves a coaching program roster's member Practice Round Simulator
 * rounds directly from persisted state, for
 * `state/persistedCoachingProgramBoard.ts`'s `buildPersistedCoachingProgramBoard`
 * to compose into `round/coaching-program.ts`'s `buildCoachingProgramBoard` —
 * idea #13's remaining follow-up (c): "wiring a member's practice-round
 * setup/feedback (Practice Round Simulator) into the space." Reuses this
 * store's existing `roundId`-to-contributor mapping (the same one
 * `buildCoachingProgramMemberFlows` reads) to look up each roster member's
 * `roundId` against `state/practiceRounds.ts`'s `getPracticeRound`. Members
 * outside `memberIds`, without a recorded flow, or whose flowed `roundId`
 * has no persisted `PracticeRoundRecord` are simply absent.
 */
export function buildCoachingProgramMemberPracticeRounds(
  memberIds: string[],
): CoachingProgramMemberPracticeRound[] {
  const memberSet = new Set(memberIds);
  const results: CoachingProgramMemberPracticeRound[] = [];

  for (const { contributorId, roundId } of readAll()) {
    if (!memberSet.has(contributorId)) continue;
    const practiceRound = getPracticeRound(roundId);
    if (!practiceRound) continue;
    results.push({ contributorId, roundId, setup: practiceRound.setup, feedback: practiceRound.feedback });
  }

  return results;
}
