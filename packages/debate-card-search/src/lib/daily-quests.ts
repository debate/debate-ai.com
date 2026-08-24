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
 * @module lib/daily-quests
 */

import type { ContributionKind } from "./community-rating";
import type { AttributedContribution } from "./contribution-leaderboard";
import { getUtcDayKey } from "./daily-best-card";
import {
  DEFAULT_COVERAGE_THRESHOLDS,
  getUnderCoveredArguments,
  type CoverageThresholds,
  type TopicCoverageReport,
} from "./topic-coverage";

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

/** One daily goal: reach `targetCount` matching contributions to complete it. */
export interface QuestTemplate {
  id: string;
  description: string;
  target: QuestTarget;
  targetCount: number;
  /** Last UTC calendar day ("YYYY-MM-DD", same `getUtcDayKey` convention) this quest is still active on; omitted means it never expires. */
  expiresOn?: string;
}

/** One quest's progress for a given day. */
export interface QuestProgress {
  questId: string;
  description: string;
  targetCount: number;
  completedCount: number;
  remainingCount: number;
  isComplete: boolean;
}

/** Whether `template` has expired as of `dayKey` (a UTC calendar day formatted "YYYY-MM-DD") — a quest with no `expiresOn` never expires; one expires the day *after* `expiresOn`, so it still counts on that day itself. */
export function isQuestTemplateExpired(template: QuestTemplate, dayKey: string): boolean {
  return template.expiresOn !== undefined && dayKey > template.expiresOn;
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
  };
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

/**
 * Derives a ready-made daily quest set directly from a topic-coverage report:
 * one "find N more cards for X" quest per under-covered tracked argument
 * (via the existing `topic-coverage.ts` `getUnderCoveredArguments`), asking
 * for just enough additional cards to clear `thresholds.minCards`. Reuses
 * the coverage report's classification directly rather than introducing a
 * separate under-coverage signal.
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
    };
  });
}
