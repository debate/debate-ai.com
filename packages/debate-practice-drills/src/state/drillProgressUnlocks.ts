/**
 * @fileoverview Ties `state/drillSets.ts`'s local drill-completion tracking
 * into the separate `debate-card-search` "Progress Unlocks" tier/badge
 * system — the "tying completion into the Progress Unlocks tier system
 * (awarding tiers/badges for practiced drills)" follow-up named under the
 * "📚 AI Drill Generator" bullet in TODO.md's Research Crowdsourcing
 * Organizer Features section.
 *
 * `debate-card-search`'s `lib/progress-unlocks.ts` already resolves a
 * contributor's tier via *either* their scored contribution volume/quality
 * *or* their completed-task count alone
 * (`UnlockTierRequirement.minCompletedTaskCount`) — the same "either signal
 * qualifies" OR-path `lib/unlock-streak-status.ts` already uses to fold
 * `research-progress.ts`'s topic-checklist completions in (see that file's
 * own fileoverview). A practiced drill is the same kind of signal: real
 * completed practice work, just from a different tool. Rather than adding a
 * fourth parallel threshold field to `UnlockTierRequirement` — which every
 * existing caller across `debate-card-search`
 * (`unlock-celebration.ts`/`reviewer-permissions.ts`/`tiered-task-routing.ts`/
 * `community-research-hub.ts`/`unlock-streak-status.ts`/
 * `state/researchProgress.ts`/`state/peerReviews.ts`) would then need to
 * thread through — this reuses that same `completedTaskCount` path directly:
 * a synthetic, otherwise-all-zero `ContributorStats` whose only non-zero
 * field is `completedTaskCount`, set to the number of drills marked
 * practiced across every persisted `DrillSetRecord`.
 *
 * This is deliberately local-only, same as `state/drillSets.ts` itself: it
 * doesn't post a "drill-practice" row into the real, cross-tool
 * `state/contributions.ts`-backed Contribution Leaderboard/Progress Unlocks
 * roster (that roster's `contributorId`s come from a real signed-in session
 * via `lib/session-identity.ts`, which this package doesn't read) — it
 * renders its own, drill-set-scoped tier/badge summary in
 * `panels/DrillSetsPanel.tsx` instead, computed from the exact same shared
 * tier thresholds and badge names so a contributor's tier reads the same way
 * everywhere it's shown.
 *
 * @module state/drillProgressUnlocks
 */

import {
  buildContributorUnlockStatus,
  DEFAULT_UNLOCK_TIER_REQUIREMENTS,
  type ContributorUnlockStatus,
  type UnlockTierRequirement,
} from "debate-research-evidence/src/lib/progress-unlocks";
import type { ContributorStats } from "debate-research-evidence/src/lib/contribution-leaderboard";
import { getDrillSetCompletionStats, listDrillSets, type DrillSetRecord } from "./drillSets";

/**
 * Placeholder id for the local, drill-practice-only unlock status this
 * module builds — not a real cross-tool contributor id (see fileoverview).
 * Only used as the `contributorId` field of the synthetic `ContributorStats`
 * this module builds; `panels/DrillSetsPanel.tsx` doesn't render it.
 */
export const DRILL_PRACTICE_CONTRIBUTOR_ID = "drill-practice";

/**
 * Total drills marked practiced across every given `DrillSetRecord`, summed
 * round by round via the existing `getDrillSetCompletionStats` (which
 * already ignores any stale, out-of-range `completedDrillIndexes` entry).
 */
export function getTotalCompletedDrillCount(
  records: Pick<DrillSetRecord, "drills" | "completedDrillIndexes">[],
): number {
  return records.reduce((total, record) => total + getDrillSetCompletionStats(record).completed, 0);
}

/**
 * Builds a synthetic `ContributorStats` carrying only a completed-count
 * signal — every scored-contribution dimension (contribution count,
 * helpfulness score, outlier count) is zero, so a drill-only "contributor"
 * still qualifies for a tier purely off `totalCompletedDrillCount` via
 * `computeContributorTier`'s either-signal-qualifies OR-path.
 */
export function buildDrillPracticeContributorStats(
  totalCompletedDrillCount: number,
  contributorId: string = DRILL_PRACTICE_CONTRIBUTOR_ID,
): ContributorStats {
  return {
    contributorId,
    contributionCount: 0,
    totalHelpfulnessScore: 0,
    averageHelpfulnessScore: 0,
    bestContributionId: "",
    bestHelpfulnessScore: 0,
    popularityOnlyOutlierCount: 0,
    completedTaskCount: totalCompletedDrillCount,
  };
}

/**
 * Builds the Progress Unlocks tier/badge status for a given count of
 * practiced drills, via `debate-card-search`'s
 * `buildContributorUnlockStatus` — the same tier thresholds and badge names
 * (`Rising Researcher`/`Seasoned Contributor`/`Master Researcher`) shown on
 * the real Contribution Leaderboard-backed roster.
 */
export function buildDrillPracticeUnlockStatus(
  totalCompletedDrillCount: number,
  tierRequirements: UnlockTierRequirement[] = DEFAULT_UNLOCK_TIER_REQUIREMENTS,
  contributorId: string = DRILL_PRACTICE_CONTRIBUTOR_ID,
): ContributorUnlockStatus {
  return buildContributorUnlockStatus(
    buildDrillPracticeContributorStats(totalCompletedDrillCount, contributorId),
    tierRequirements,
  );
}

/**
 * Builds the Progress Unlocks status straight from every persisted
 * `DrillSetRecord` — what `panels/DrillSetsPanel.tsx` renders. A caller with
 * an already-loaded list of records (e.g. the panel's own `drillSets` state)
 * should prefer `buildDrillPracticeUnlockStatus(getTotalCompletedDrillCount(records))`
 * instead, to avoid a redundant `listDrillSets()` read.
 */
export function buildDrillPracticeUnlockStatusFromStore(
  tierRequirements: UnlockTierRequirement[] = DEFAULT_UNLOCK_TIER_REQUIREMENTS,
): ContributorUnlockStatus {
  return buildDrillPracticeUnlockStatus(getTotalCompletedDrillCount(listDrillSets()), tierRequirements);
}
