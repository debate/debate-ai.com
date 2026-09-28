/**
 * @fileoverview Persistence for judge-given awards (`lib/judge-awards.ts`).
 * Local-first, mirroring `state/contributorAwardNominations.ts`: a JSON array
 * of `JudgeAward` records in localStorage, keyed by generated `id`, and
 * synced to the signed-in user's account as the `judgeAwards` collection in
 * `debate-data-sync`'s `TOOL_RECORD_COLLECTIONS`.
 *
 * `giveJudgeAward` enforces the once-per-judge-per-tournament rule against
 * every award already stored. Every write dispatches
 * `JUDGE_AWARDS_CHANGED_EVENT` so panels in the same tab refresh; other tabs
 * see the `storage` event on `JUDGE_AWARDS_STORAGE_KEY`.
 *
 * @module state/judgeAwards
 */

import {
  isJudgeAward,
  JUDGE_AWARD_REJECTION_MESSAGES,
  validateJudgeAward,
  type JudgeAward,
  type JudgeAwardInput,
  type JudgeAwardRejection,
} from "../lib/judge-awards";

/** localStorage key holding every `JudgeAward`. */
export const JUDGE_AWARDS_STORAGE_KEY = "judgeAwards";

/** Window event dispatched after any judge award is given or removed. */
export const JUDGE_AWARDS_CHANGED_EVENT = "debate-ai:judge-awards-changed";

/** Thrown by `giveJudgeAward` when `validateJudgeAward` refuses the award. */
export class JudgeAwardError extends Error {
  readonly reason: JudgeAwardRejection;

  constructor(reason: JudgeAwardRejection) {
    super(JUDGE_AWARD_REJECTION_MESSAGES[reason]);
    this.name = "JudgeAwardError";
    this.reason = reason;
  }
}

function readAll(): JudgeAward[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(JUDGE_AWARDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isJudgeAward) : [];
  } catch {
    return [];
  }
}

function writeAll(awards: JudgeAward[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(JUDGE_AWARDS_STORAGE_KEY, JSON.stringify(awards));
  if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") {
    window.dispatchEvent(new CustomEvent(JUDGE_AWARDS_CHANGED_EVENT));
  }
}

function generateJudgeAwardId(): string {
  return `judge-award-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Every stored judge award, newest first. */
export function listAllJudgeAwards(): JudgeAward[] {
  return [...readAll()].sort((a, b) => b.awardedAt - a.awardedAt);
}

/** The awards one debater has received, newest first. */
export function listJudgeAwardsForDebater(debaterId: string): JudgeAward[] {
  const id = debaterId.trim();
  return listAllJudgeAwards().filter((award) => award.debaterId === id);
}

/**
 * Give an award, trimming every name. Throws `JudgeAwardError` when the
 * fields are blank, the judge is the debater, or this judge already gave
 * this award at this tournament — callers surface `error.message` as a form
 * error.
 */
export function giveJudgeAward(input: JudgeAwardInput, nowMs: number = Date.now()): JudgeAward {
  const existing = readAll();
  const rejection = validateJudgeAward(existing, input);
  if (rejection) throw new JudgeAwardError(rejection);

  const award: JudgeAward = {
    id: generateJudgeAwardId(),
    kind: input.kind,
    debaterId: input.debaterId.trim(),
    judgeName: input.judgeName.trim().replace(/\s+/g, " "),
    tournament: input.tournament.trim().replace(/\s+/g, " "),
    awardedAt: nowMs,
  };
  writeAll([...existing, award]);
  return award;
}

/** Remove a stored award by id; a no-op if it isn't stored. */
export function deleteJudgeAward(id: string): void {
  const awards = readAll();
  const remaining = awards.filter((award) => award.id !== id);
  if (remaining.length !== awards.length) writeAll(remaining);
}
