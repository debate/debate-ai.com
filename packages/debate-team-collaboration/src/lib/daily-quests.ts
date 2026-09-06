/**
 * @fileoverview Pure daily-quest progress tracking for the "Daily Quests and
 * Targets" idea under Research Crowdsourcing Organizer Features in TODO.md
 * ("Set team goals like 'find 5 solvency cards' or 'add 3 frontline answers
 * today'"). Given a caller-supplied list of quest templates and the day's
 * attributed contributions, tallies how many contributions satisfy each
 * quest's kind/argument-block target and reports completion progress.
 * `buildUnderCoveredArgumentQuests` also derives a ready-made quest set
 * directly from the existing "Topic Coverage Dashboard" slice in
 * `topic-coverage.ts`, turning each under-covered tracked argument into a
 * "find N more cards for X" quest. This is the first slice only — it works
 * entirely off caller-supplied quest templates and contributions; it doesn't
 * track streaks, persist quest completion, or render a quest board UI. See
 * the follow-ups noted in TODO.md.
 *
 * `isQuestTemplateExpired`/`QuestTemplate.expiresOn` close the "a quest
 * template has no expiry" Known gap: a template can carry an optional
 * last-active UTC day key, and `buildDailyQuestBoard` excludes an expired
 * template from the board entirely rather than scoring it forever.
 *
 * `QuestTemplate.recurrence`/`rolloverRecurringQuestTemplate` close the "no
 * recurring-quest concept" Known gap left by the expiry addition above: an
 * expired template can now carry a recurrence cadence ("daily"/"weekly")
 * instead of just disappearing for good — the caller (see
 * `state/dailyQuests.ts`'s `rolloverExpiredRecurringQuestTemplates`) rolls its
 * `expiresOn` forward to the next cycle boundary so the same quest becomes
 * active again with a fresh 0-count (progress is always scored against just
 * today's contributions, so no separate "reset the count" step is needed).
 *
 * `QuestTemplate.difficulty`/`QUEST_DIFFICULTY_POINTS` close the "quest
 * difficulty tiers" follow-up named under the "🎯 Daily Quests and Targets"
 * bullet in TODO.md: a quest can carry an `easy`/`medium`/`hard` difficulty
 * (mirroring `drill-generator.ts`'s `DrillDifficulty` naming exactly), worth
 * an escalating point value once complete. A template with no `difficulty`
 * — every quest saved before this change — is treated as `"medium"` via
 * `getQuestDifficulty` rather than requiring a one-time backfill.
 * `buildUnderCoveredArgumentQuests` now rates each seeded quest by how many
 * more cards it still needs (`remainingCardsToQuestDifficulty`), and
 * `computeQuestProgress`/`buildQuestBoardPointsSummary` carry that through to
 * a point total a quest board can display.
 *
 * @module lib/daily-quests
 */

import type { ContributionKind } from "debate-research-evidence/src/lib/community-rating";
import type { AttributedContribution } from "debate-research-evidence/src/lib/contribution-leaderboard";
import { getUtcDayKey } from "debate-research-evidence/src/lib/daily-best-card";
import {
  DEFAULT_COVERAGE_THRESHOLDS,
  getUnderCoveredArguments,
  type CoverageThresholds,
  type TopicCoverageReport,
} from "debate-research-evidence/src/lib/topic-coverage";

/** A contribution counted toward daily quest progress. */
export interface QuestContribution extends AttributedContribution {
  /** Argument block this contribution supports, matching `topic-coverage.ts`'s `argBlock` tagging (omitted for contributions not tied to a tracked argument). */
  argBlock?: string;
  /** Submission time, as epoch milliseconds (UTC) — same convention as `daily-best-card.ts`. */
  submittedAt: number;
}

/**
 * What a quest requires a contribution to match. An omitted field matches
 * any value — e.g. `{ argBlock: "Solvency" }` alone counts any contribution
 * kind filed under the Solvency block.
 */
export interface QuestTarget {
  kind?: ContributionKind;
  argBlock?: string;
}

/** How often a recurring quest template's cycle resets, once its `expiresOn` passes. */
export type QuestRecurrence = "daily" | "weekly";

/** A rough effort rating for a quest, mirroring `drill-generator.ts`'s `DrillDifficulty` naming exactly. */
export type QuestDifficulty = "easy" | "medium" | "hard";

/** A template with no `difficulty` — every quest saved before this field existed — is treated as this. */
export const DEFAULT_QUEST_DIFFICULTY: QuestDifficulty = "medium";

/** Points a quest is worth once complete, by difficulty tier. */
export const QUEST_DIFFICULTY_POINTS: Record<QuestDifficulty, number> = {
  easy: 5,
  medium: 10,
  hard: 20,
};

/** One daily goal: reach `targetCount` matching contributions to complete it. */
export interface QuestTemplate {
  id: string;
  description: string;
  target: QuestTarget;
  targetCount: number;
  /** Last UTC calendar day ("YYYY-MM-DD", same `getUtcDayKey` convention) this quest is still active on; omitted means it never expires. */
  expiresOn?: string;
  /** When set alongside `expiresOn`, an expired cycle rolls `expiresOn` forward by this cadence instead of the quest disappearing for good. Has no effect without `expiresOn`. */
  recurrence?: QuestRecurrence;
  /** How much effort this quest is worth; omitted means `DEFAULT_QUEST_DIFFICULTY` (see `getQuestDifficulty`). */
  difficulty?: QuestDifficulty;
}

/** `template.difficulty`, defaulting to `DEFAULT_QUEST_DIFFICULTY` for a template saved before this field existed. */
export function getQuestDifficulty(template: QuestTemplate): QuestDifficulty {
  return template.difficulty ?? DEFAULT_QUEST_DIFFICULTY;
}

/** How many points completing `template` is worth, from `QUEST_DIFFICULTY_POINTS`. */
export function getQuestDifficultyPoints(template: QuestTemplate): number {
  return QUEST_DIFFICULTY_POINTS[getQuestDifficulty(template)];
}

/** One quest's progress for a given day. */
export interface QuestProgress {
  questId: string;
  description: string;
  targetCount: number;
  completedCount: number;
  remainingCount: number;
  isComplete: boolean;
  difficulty: QuestDifficulty;
  /** This quest's point value (from `QUEST_DIFFICULTY_POINTS`), regardless of whether it's complete yet. */
  points: number;
}

/** Whether `template` has expired as of `dayKey` (a UTC calendar day formatted "YYYY-MM-DD") — a quest with no `expiresOn` never expires; one expires the day *after* `expiresOn`, so it still counts on that day itself. */
export function isQuestTemplateExpired(template: QuestTemplate, dayKey: string): boolean {
  return template.expiresOn !== undefined && dayKey > template.expiresOn;
}

const RECURRENCE_CYCLE_DAYS: Record<QuestRecurrence, number> = { daily: 1, weekly: 7 };

/** Shifts a UTC calendar day key ("YYYY-MM-DD") forward by `days` whole days. */
function shiftDayKey(dayKey: string, days: number): string {
  return getUtcDayKey(Date.parse(`${dayKey}T00:00:00.000Z`) + days * 24 * 60 * 60 * 1000);
}

/**
 * If `template` carries a `recurrence` and has expired as of `dayKey` (via
 * `isQuestTemplateExpired`), returns a copy with `expiresOn` advanced forward
 * by whole recurrence cycles until it lands on or after `dayKey` — rolling
 * the quest into its next active cycle instead of leaving it expired.
 * A non-recurring, not-yet-expired, or `expiresOn`-less template (recurrence
 * has no anchor to roll from) is returned unchanged.
 */
export function rolloverRecurringQuestTemplate(template: QuestTemplate, dayKey: string): QuestTemplate {
  if (!template.recurrence || template.expiresOn === undefined || !isQuestTemplateExpired(template, dayKey)) {
    return template;
  }
  const cycleDays = RECURRENCE_CYCLE_DAYS[template.recurrence];
  let nextExpiresOn = template.expiresOn;
  while (nextExpiresOn < dayKey) {
    nextExpiresOn = shiftDayKey(nextExpiresOn, cycleDays);
  }
  return { ...template, expiresOn: nextExpiresOn };
}

/** Whether `contribution` satisfies `target` — an omitted target field matches any value. */
export function matchesQuestTarget(contribution: QuestContribution, target: QuestTarget): boolean {
  if (target.kind !== undefined && contribution.kind !== target.kind) return false;
  if (target.argBlock !== undefined && contribution.argBlock !== target.argBlock) return false;
  return true;
}

/**
 * Computes one quest's progress against contributions submitted on
 * `dayKey` (a UTC calendar day formatted "YYYY-MM-DD", as returned by
 * `getUtcDayKey`) that match the quest's target.
 */
export function computeQuestProgress(
  quest: QuestTemplate,
  contributions: QuestContribution[],
  dayKey: string,
): QuestProgress {
  const completedCount = contributions.filter(
    (contribution) =>
      getUtcDayKey(contribution.submittedAt) === dayKey && matchesQuestTarget(contribution, quest.target),
  ).length;

  return {
    questId: quest.id,
    description: quest.description,
    targetCount: quest.targetCount,
    completedCount,
    remainingCount: Math.max(0, quest.targetCount - completedCount),
    isComplete: completedCount >= quest.targetCount,
    difficulty: getQuestDifficulty(quest),
    points: getQuestDifficultyPoints(quest),
  };
}

/**
 * Narrows a quest board to one `difficulty`, or returns it unchanged for
 * `"all"` — mirrors `drill-generator.ts`'s `filterDrillsByDifficulty` exactly.
 */
export function filterQuestBoardByDifficulty(
  board: QuestProgress[],
  difficulty: QuestDifficulty | "all",
): QuestProgress[] {
  if (difficulty === "all") return board;
  return board.filter((quest) => quest.difficulty === difficulty);
}

/**
 * Builds the full quest board for the UTC calendar day of `now`
 * (caller-supplied epoch ms, keeping this pure and testable): every quest's
 * progress against that day's contributions, incomplete quests first, then
 * tie-broken by `id` for a stable, deterministic order.
 */
export function buildDailyQuestBoard(
  quests: QuestTemplate[],
  contributions: QuestContribution[],
  now: number,
): QuestProgress[] {
  const dayKey = getUtcDayKey(now);
  return quests
    .filter((quest) => !isQuestTemplateExpired(quest, dayKey))
    .map((quest) => computeQuestProgress(quest, contributions, dayKey))
    .sort((a, b) => Number(a.isComplete) - Number(b.isComplete) || a.questId.localeCompare(b.questId));
}

/** Renders a short summary line for a daily-quest board header. */
export function buildQuestBoardSummaryText(board: QuestProgress[]): string {
  const completeCount = board.filter((quest) => quest.isComplete).length;
  return `${completeCount}/${board.length} quests complete today`;
}

/** Points earned so far today (completed quests only) versus the board's full point value. */
export interface QuestBoardPointsSummary {
  earnedPoints: number;
  totalPoints: number;
}

/**
 * Tallies a quest board's points: `earnedPoints` from quests already
 * complete, `totalPoints` across every quest on the board regardless of
 * completion — the denominator for a "N/M points today" progress display.
 */
export function buildQuestBoardPointsSummary(board: QuestProgress[]): QuestBoardPointsSummary {
  return board.reduce(
    (summary, quest) => ({
      earnedPoints: summary.earnedPoints + (quest.isComplete ? quest.points : 0),
      totalPoints: summary.totalPoints + quest.points,
    }),
    { earnedPoints: 0, totalPoints: 0 },
  );
}

/** Renders a short "N/M points today" summary line, mirroring `buildQuestBoardSummaryText`. */
export function buildQuestBoardPointsSummaryText(board: QuestProgress[]): string {
  const { earnedPoints, totalPoints } = buildQuestBoardPointsSummary(board);
  return `${earnedPoints}/${totalPoints} points earned today`;
}

/**
 * Rates a seeded "find N more cards" quest by how many more cards it still
 * needs — the more still missing, the harder the quest — mirroring
 * `drill-generator.ts`'s `vulnerabilityScoreToDifficulty` banding style.
 */
export function remainingCardsToQuestDifficulty(remaining: number): QuestDifficulty {
  if (remaining <= 1) return "easy";
  if (remaining === 2) return "medium";
  return "hard";
}

/**
 * Derives a ready-made daily quest set directly from a topic-coverage report:
 * one "find N more cards for X" quest per under-covered tracked argument
 * (via the existing `topic-coverage.ts` `getUnderCoveredArguments`), asking
 * for just enough additional cards to clear `thresholds.minCards`. Reuses
 * the coverage report's classification directly rather than introducing a
 * separate under-coverage signal. Each quest's `difficulty` scales with how
 * many cards it's still short (`remainingCardsToQuestDifficulty`), so a
 * barely-thin argument seeds an easy quest while a wholly-missing one seeds
 * a hard one.
 */
export function buildUnderCoveredArgumentQuests(
  report: TopicCoverageReport,
  thresholds: CoverageThresholds = DEFAULT_COVERAGE_THRESHOLDS,
): QuestTemplate[] {
  return getUnderCoveredArguments(report).map((argument) => {
    const remaining = Math.max(1, thresholds.minCards - argument.cardCount);
    return {
      id: `argblock:${argument.argBlock}`,
      description: `Find ${remaining} more card${remaining === 1 ? "" : "s"} for "${argument.argBlock}"`,
      target: { kind: "card", argBlock: argument.argBlock },
      targetCount: remaining,
      difficulty: remainingCardsToQuestDifficulty(remaining),
    };
  });
}
