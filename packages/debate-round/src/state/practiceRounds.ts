/**
 * @fileoverview Persistent storage for a simulated practice round, keyed by
 * `roundId` — the "(c) persisting a simulated practice round (setup,
 * submitted speeches, and feedback) once round-state persistence exists"
 * follow-up named under "Practice Round Simulator" in TODO.md's Research
 * Crowdsourcing Organizer Features list. Round-state persistence now exists
 * via `aiVersusRounds.ts` (idea #3's submitted-speech store), so this store
 * only persists `practice-round-simulator.ts`'s own derived
 * `PracticeRoundSetup`, (once generated) `PracticeRoundFeedback`, and (once
 * requested) a `JudgeDecisionAiResult` from `judge-decision-ai.ts` — a
 * round's submitted speeches are looked up through `getAiVersusRound`
 * instead of being duplicated here. Stores records in localStorage,
 * mirroring the existing `aiVersusRounds.ts`/`drillSets.ts` persistence
 * convention (SSR/no-storage-safe, corrupt or missing JSON degrades to an
 * empty list rather than throwing). `buildPracticeRoundsPanelView` sorts the
 * stored list by `roundId` for a stable panel display order, mirroring the
 * same helper on `wordCountRounds.ts`/`aiVersusRounds.ts`.
 *
 * `buildPracticeRoundAttemptsComparison`/`buildPracticeRoundAttemptsComparisonText`
 * close the "comparison across a debater's past attempts" follow-up named
 * under the "🧪 Practice Round Simulator" bullet — a chronological win/loss
 * trend across every persisted round that has a `createdAt` (stamped by
 * `savePracticeRound` on a round's first save, mirroring
 * `wordCountRounds.ts`'s `createdAt` convention: not backfilled onto a round
 * saved before this field existed, and preserved rather than refreshed on a
 * later update to the same `roundId`).
 *
 * @module state/practiceRounds
 */

import type { Flow } from "../types/flow";
import { getAiVersusRound } from "./aiVersusRounds";
import type { AiVersusSide, AiVersusSpeechSlot, PriorSpeechRecord } from "../round/ai-versus-speech-order";
import type { JudgeDecisionAiResult } from "../round/judge-decision-ai";
import { buildPracticeRoundFeedback } from "../round/practice-round-simulator";
import type { PracticeRoundFeedback, PracticeRoundSetup } from "../round/practice-round-simulator";

export type PracticeRoundRecord = {
  roundId: string;
  setup: PracticeRoundSetup;
  /** Post-round feedback, once generated. Absent while the round is still in progress. */
  feedback?: PracticeRoundFeedback;
  /** An AI judge's verdict for the round, once requested. Absent until "Get AI judge decision" is used. */
  judgeDecision?: JudgeDecisionAiResult;
  /**
   * Epoch milliseconds this round was first saved. Stamped automatically by
   * `savePracticeRound` on a round's first save only (never refreshed on a
   * later update to the same `roundId`), so it reflects when the round was
   * created rather than last touched. Absent on a round saved before this
   * field existed; such a round is excluded from
   * `buildPracticeRoundAttemptsComparison` rather than sorted arbitrarily.
   */
  createdAt?: number;
};

const STORAGE_KEY = "practiceRounds";

function readAll(): PracticeRoundRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PracticeRoundRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: PracticeRoundRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Lists every persisted practice round. */
export function listPracticeRounds(): PracticeRoundRecord[] {
  return readAll();
}

/** Lists every persisted practice round sorted by `roundId`, for a stable panel display order. */
export function buildPracticeRoundsPanelView(): PracticeRoundRecord[] {
  return [...readAll()].sort((a, b) => a.roundId.localeCompare(b.roundId));
}

/** Looks up a round's persisted practice-round state, if any. */
export function getPracticeRound(roundId: string): PracticeRoundRecord | undefined {
  return readAll().find((record) => record.roundId === roundId);
}

/**
 * Saves a round's practice-round state, overwriting any existing record for
 * that `roundId`. Stamps `createdAt` with the current time on the round's
 * first save; a later save for the same `roundId` preserves whatever
 * `createdAt` is already stored instead of refreshing it (or stays absent,
 * for a round saved before this field existed).
 */
export function savePracticeRound(record: PracticeRoundRecord): void {
  const records = readAll();
  const index = records.findIndex((existing) => existing.roundId === record.roundId);
  if (index === -1) {
    records.push({ ...record, createdAt: record.createdAt ?? Date.now() });
  } else {
    records[index] = { ...record, createdAt: records[index].createdAt };
  }
  writeAll(records);
}

/** Deletes a round's persisted practice-round state; a no-op if it isn't stored. */
export function deletePracticeRound(roundId: string): void {
  writeAll(readAll().filter((record) => record.roundId !== roundId));
}

/**
 * Looks up the submitted speeches for a practice round through the existing
 * `aiVersusRounds.ts` store, so callers don't need to duplicate that lookup.
 * Returns an empty list if the round hasn't submitted any speeches (or isn't
 * persisted there) yet.
 */
export function getPracticeRoundSubmittedSpeeches(roundId: string): PriorSpeechRecord[] {
  return getAiVersusRound(roundId)?.submittedSpeeches ?? [];
}

/**
 * Derives post-round feedback from an already-flowed `Flow` (e.g. the round
 * workspace's currently selected flow) against a round's own already-saved
 * `setup.judgeParadigm`, and saves it onto that round's persisted record —
 * the "post-round feedback generation isn't wired to a live round flow"
 * Known gap named in `docs/features/practice-round-simulator.md`. Also
 * threads the round's own already-saved `setup.opponentPersona` through, so
 * a round played against a persona gets that persona's "Tips vs. …" feedback
 * section too (closing the "post-round feedback tips specific to the
 * persona faced" Next item on TODO.md's "🤖 AI Practice Opponent" idea).
 * Reuses the existing `buildPracticeRoundFeedback` directly rather than
 * reimplementing any of its coaching-session composition.
 *
 * Returns `undefined` (without writing anything) when no
 * `PracticeRoundRecord` is stored for `roundId` yet — feedback is only ever
 * generated for a round whose setup (and judge paradigm) has already been
 * saved via `savePracticeRound`.
 */
export function buildAndSavePracticeRoundFeedback(
  flow: Pick<Flow, "children" | "columns">,
  roundId: string,
  sideKey: string,
  options: { collapseLimit?: number } = {},
): PracticeRoundRecord | undefined {
  const existing = getPracticeRound(roundId);
  if (!existing) return undefined;

  const feedback = buildPracticeRoundFeedback(flow, sideKey, existing.setup.judgeParadigm, {
    ...options,
    opponentPersona: existing.setup.opponentPersona,
  });
  const record: PracticeRoundRecord = { ...existing, feedback };
  savePracticeRound(record);
  return record;
}

/**
 * Reads which side the user argued off an already-built speech order —
 * `PracticeRoundSetup` doesn't store `userSide` directly, only the speech
 * order `buildAiVersusSpeechOrder` already tagged by it. Falls back to
 * `"primary"` in the unreachable case of a speech order with no `"user"`
 * slot at all (every format has at least one primary-side speech, and
 * `buildAiVersusSpeechOrder` always tags the user's own side as `"user"`).
 */
function deriveUserSideFromSpeechOrder(speechOrder: AiVersusSpeechSlot[]): AiVersusSide {
  const userSlot = speechOrder.find((slot) => slot.speaker === "user");
  return userSlot?.secondary ? "secondary" : "primary";
}

export type PracticeRoundAttemptOutcome = "won" | "lost" | "pending";

/** One persisted round's outcome for the past-attempts comparison, in chronological order. */
export type PracticeRoundAttemptSummary = {
  roundId: string;
  createdAt: number;
  judgeParadigmName: string;
  opponentPersonaName: string;
  outcome: PracticeRoundAttemptOutcome;
  /** Number of coaching prompts flagged in this round's post-round feedback, if any has been generated yet. */
  feedbackIssueCount?: number;
};

export type PracticeRoundAttemptsComparison = {
  attempts: PracticeRoundAttemptSummary[];
  wins: number;
  losses: number;
  pending: number;
  /** Win rate among decided attempts (wins / (wins + losses)); `null` when no attempt has a judge decision yet. */
  winRate: number | null;
};

/**
 * Builds a chronological win/loss trend across every persisted practice
 * round that carries a `createdAt` — the "comparison across a debater's past
 * attempts" follow-up named under the "🧪 Practice Round Simulator" bullet
 * in TODO.md's Research Crowdsourcing Organizer Features list. A round's
 * outcome is derived by comparing its saved `judgeDecision.winner` against
 * the side the user actually argued (read off `setup.speechOrder`, via
 * `deriveUserSideFromSpeechOrder`) — `"pending"` until a judge decision has
 * been requested for that round. Reuses each round's already-persisted
 * `feedback`/`judgeDecision` directly; no new feedback or judging logic is
 * introduced here. A round saved before `createdAt` existed is excluded
 * rather than sorted arbitrarily, mirroring `wordCountRounds.ts`'s
 * `buildWordCountTrendData` convention.
 */
export function buildPracticeRoundAttemptsComparison(): PracticeRoundAttemptsComparison {
  const attempts = readAll()
    .filter((record): record is PracticeRoundRecord & { createdAt: number } => record.createdAt !== undefined)
    .map((record): PracticeRoundAttemptSummary => {
      const userSide = deriveUserSideFromSpeechOrder(record.setup.speechOrder);
      const outcome: PracticeRoundAttemptOutcome = !record.judgeDecision
        ? "pending"
        : record.judgeDecision.winner === userSide
          ? "won"
          : "lost";
      return {
        roundId: record.roundId,
        createdAt: record.createdAt,
        judgeParadigmName: record.setup.judgeParadigm.name,
        opponentPersonaName: record.setup.opponentPersona?.name ?? "No AI opponent",
        outcome,
        feedbackIssueCount: record.feedback?.coachingPrompts.length,
      };
    })
    .sort((a, b) => a.createdAt - b.createdAt);

  const wins = attempts.filter((attempt) => attempt.outcome === "won").length;
  const losses = attempts.filter((attempt) => attempt.outcome === "lost").length;
  const pending = attempts.filter((attempt) => attempt.outcome === "pending").length;
  const decided = wins + losses;

  return { attempts, wins, losses, pending, winRate: decided === 0 ? null : wins / decided };
}

function formatPracticeRoundAttemptLine(attempt: PracticeRoundAttemptSummary): string {
  const outcomeLabel = attempt.outcome === "pending" ? "Pending" : attempt.outcome === "won" ? "Won" : "Lost";
  const issuesLabel =
    attempt.feedbackIssueCount === undefined
      ? "no feedback yet"
      : `${attempt.feedbackIssueCount} feedback issue${attempt.feedbackIssueCount === 1 ? "" : "s"}`;
  const dateLabel = new Date(attempt.createdAt).toISOString().slice(0, 10);
  return `- Round ${attempt.roundId} (${dateLabel}): ${outcomeLabel} vs. ${attempt.opponentPersonaName}, judged under ${attempt.judgeParadigmName} — ${issuesLabel}`;
}

/**
 * Renders a `PracticeRoundAttemptsComparison` as a downloadable plain-text
 * document — a summary line (attempts logged, win/loss/pending counts, win
 * rate among decided attempts) followed by one line per attempt in
 * chronological order. Mirrors `pre-round-briefing.ts#buildPreRoundBriefingText`'s
 * plain heading-over-body shape.
 */
export function buildPracticeRoundAttemptsComparisonText(comparison: PracticeRoundAttemptsComparison): string {
  const { attempts, wins, losses, pending, winRate } = comparison;
  if (attempts.length === 0) {
    return "Practice Round Attempts Comparison\n\nNo practice round attempts logged yet.";
  }

  const winRateLabel = winRate === null ? "no decided rounds yet" : `${Math.round(winRate * 100)}%`;
  const summary = `${attempts.length} attempt${attempts.length === 1 ? "" : "s"} logged — ${wins} won, ${losses} lost, ${pending} pending (win rate: ${winRateLabel}).`;

  return `Practice Round Attempts Comparison\n\n${summary}\n\n${attempts.map(formatPracticeRoundAttemptLine).join("\n")}`;
}

/**
 * A filesystem-safe filename for a past-attempts comparison download. Static
 * (unlike `coachingSessionComparisonFilename`) since the comparison spans
 * every persisted round rather than a specific pair.
 */
export function practiceRoundAttemptsComparisonFilename(): string {
  return "practice-round-attempts-comparison.txt";
}
