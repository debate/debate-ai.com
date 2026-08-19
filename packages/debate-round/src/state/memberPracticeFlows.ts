/**
 * @fileoverview `roundId`-to-contributor mapping for a coaching-program
 * member's already-flowed practice round — the remaining half of the
 * "(b-continued)" follow-up named under idea #13 ("Coaching Programs and
 * Group Challenges") in TODO.md: "a `roundId`-to-contributor mapping so a
 * member's already-flowed practice round can generate a drill set on this
 * board," noted as the sole "Known gap" in
 * `docs/features/coaching-programs.md`.
 *
 * The live round editor already persists every `Round` (`localStorage` key
 * `rounds`, via `state/store.ts`'s `setRounds`) and every `Flow`
 * (`localStorage` key `flows`, written directly by
 * `dialogs/CreateRoundDialog/useRoundEditorForm.ts` when a round is
 * created, each carrying the owning round's id on `Flow.roundId` and
 * listed in `Round.flowIds`) — so a member's "already-flowed practice
 * round" is real, already-persisted data, not a new flow-content input this
 * module needs to invent. This module persists only the missing link —
 * which `roundId` belongs to which contributor, and which side they flowed
 * — and resolves that round's actual flow directly from the `rounds`/
 * `flows` storage, mirroring `hooks/useRoundFromSlug.ts`'s own
 * `round.flowIds.includes(f.id)` lookup.
 *
 * @module state/memberPracticeFlows
 */

import type { Flow, Round } from "debate-core/src/types/flow";
import type { CoachingProgramMemberFlow } from "../round/coaching-program";

/** One contributor's registered practice round — one active mapping per contributor. */
export type MemberPracticeFlowRecord = {
  contributorId: string;
  roundId: number;
  sideKey: string;
};

const RECORDS_KEY = "memberPracticeFlows";

function readAll(): MemberPracticeFlowRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MemberPracticeFlowRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: MemberPracticeFlowRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

/** Lists every persisted member-to-round mapping, across all contributors. */
export function listMemberPracticeFlows(): MemberPracticeFlowRecord[] {
  return readAll();
}

/** Looks up a single contributor's currently-registered practice round, if any. */
export function getMemberPracticeFlow(contributorId: string): MemberPracticeFlowRecord | undefined {
  return readAll().find((record) => record.contributorId === contributorId);
}

/** Registers (or replaces) a contributor's currently-flowed practice round. */
export function saveMemberPracticeFlow(record: MemberPracticeFlowRecord): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.contributorId === record.contributorId);
  if (index === -1) {
    records.push(record);
  } else {
    records[index] = record;
  }
  writeAll(records);
}

/** Clears a contributor's registered practice round; a no-op if none is stored. */
export function deleteMemberPracticeFlow(contributorId: string): void {
  writeAll(readAll().filter((record) => record.contributorId !== contributorId));
}

function readRounds(): Round[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem("rounds");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Round[]) : [];
  } catch {
    return [];
  }
}

function readFlows(): Flow[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem("flows");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Flow[]) : [];
  } catch {
    return [];
  }
}

/**
 * Resolves a round's actual flowed content directly from the live round
 * editor's own persisted storage — the same `rounds`/`flows` `localStorage`
 * keys `state/store.ts` and `hooks/useRoundFromSlug.ts` read/write.
 * Prefers the round's flow with the most flowed content when it has more
 * than one (e.g. an unused starter flow alongside the one actually
 * flowed). Returns `undefined` when the round, or none of its flows, are
 * stored.
 */
export function resolveFlowForRound(roundId: number): Pick<Flow, "children" | "columns"> | undefined {
  const round = readRounds().find((r) => r.id === roundId);
  if (!round) return undefined;

  const roundFlows = readFlows().filter((flow) => round.flowIds.includes(flow.id));
  if (roundFlows.length === 0) return undefined;

  const flow = roundFlows.reduce((best, candidate) => (candidate.children.length > best.children.length ? candidate : best));
  return { children: flow.children, columns: flow.columns };
}

/**
 * Every persisted mapping for the given roster, resolved into
 * `coaching-program.ts`'s `CoachingProgramMemberFlow[]` input — composed
 * directly by `state/persistedCoachingProgramBoard.ts` as the default for
 * its `memberFlows` argument. A contributor outside `memberIds`, or whose
 * registered round (or none of its flows) can't be resolved, is skipped
 * rather than included as an empty drill set.
 */
export function buildMemberPracticeFlowsForRoster(memberIds: string[]): CoachingProgramMemberFlow[] {
  const memberSet = new Set(memberIds);
  const result: CoachingProgramMemberFlow[] = [];
  for (const record of readAll()) {
    if (!memberSet.has(record.contributorId)) continue;
    const flow = resolveFlowForRound(record.roundId);
    if (!flow) continue;
    result.push({ contributorId: record.contributorId, sideKey: record.sideKey, flow });
  }
  return result.sort((a, b) => a.contributorId.localeCompare(b.contributorId));
}
