/**
 * @fileoverview Per-contributor profile drill-down — the "Contribution
 * Leaderboard" bullet's next-named follow-up in TODO.md's Research
 * Crowdsourcing Organizer Features section ("a per-contributor profile
 * drill-down page"). Composes every existing per-contributor slice this repo
 * already has — leaderboard rank/stats (`contribution-leaderboard.ts`), tier/
 * badges/streak (`unlock-streak-status.ts`), Top Contributor Awards (both the
 * live standings and the all-time hall of fame, `contributor-awards.ts`), and
 * endorsement history (`state/contributions.ts`) — into one read model for a
 * single contributor, rather than introducing any new scoring/ranking logic
 * or a new persisted store.
 *
 * `buildContributorProfileFromStore` is the store-composed entry point,
 * mirroring `unlock-streak-status.ts`'s
 * `buildContributorUnlockStatusWithStreakFromStore` "compose the pure
 * function directly against the persisted store" convention. `exists` is
 * `false` only when the contributor has no footprint anywhere (no
 * contribution, completed task, award, or endorsement) — distinct from
 * `rank === null`, which can also happen for a contributor who has *only*
 * completed tasks, awards, or endorsements but no scored contribution yet.
 *
 * @module lib/contributor-profile
 */

import type { ContributorStats } from "debate-research-evidence/src/lib/contribution-leaderboard";
import {
  buildContributorAwardsHallOfFame,
  type ContributorAward,
  type HallOfFameEntry,
} from "debate-research-evidence/src/lib/contributor-awards";
import {
  listEndorsementsByContributor,
  type ContributorEndorsementHistoryEntry,
} from "debate-research-evidence/src/state/contributions";
import { buildPersistedLeaderboardWithCompletedTasks } from "debate-team-collaboration/src/state/researchProgress";
import {
  buildPersistedTopContributorAwards,
  listAnnouncedContributorAwards,
} from "../state/contributorAwardAnnouncements";
import {
  buildContributorUnlockStatusWithStreakFromStore,
  type ContributorUnlockStatusWithStreak,
} from "./unlock-streak-status";

/** A contributor with no leaderboard activity yet — same zeroed shape as `unlock-streak-status.ts`'s internal fallback. */
function buildEmptyContributorStats(contributorId: string): ContributorStats {
  return {
    contributorId,
    contributionCount: 0,
    totalHelpfulnessScore: 0,
    averageHelpfulnessScore: 0,
    bestContributionId: "",
    bestHelpfulnessScore: 0,
    popularityOnlyOutlierCount: 0,
    completedTaskCount: 0,
  };
}

/** One contributor's full cross-feature profile — the read model backing the leaderboard's per-contributor drill-down page. */
export interface ContributorProfile {
  contributorId: string;
  /** `false` only when this contributor has no footprint anywhere — no contribution, completed task, award, or endorsement. */
  exists: boolean;
  /** 1-based position on the all-time, all-category leaderboard, or `null` if absent from it. */
  rank: number | null;
  stats: ContributorStats;
  unlockStatus: ContributorUnlockStatusWithStreak;
  /** Award categories this contributor currently leads, from today's live (not-yet-announced) standings. */
  currentAwards: ContributorAward[];
  /** All-time Top Contributor Awards win record across every announced day, or `null` if they've never won one. */
  hallOfFame: HallOfFameEntry | null;
  /** Endorsements made on this contributor's own contributions, newest first. */
  endorsementsReceived: ContributorEndorsementHistoryEntry[];
  /** Endorsements this contributor made as a reviewer, across every contributor's contributions, newest first. */
  endorsementsGiven: ContributorEndorsementHistoryEntry[];
}

/**
 * Builds `contributorId`'s full cross-feature profile straight from
 * persisted state — the single call a profile page needs, instead of
 * requiring the caller to assemble the leaderboard rank, unlock/streak
 * status, awards, and endorsement history from five separate lookups
 * itself. Never throws: a contributor with no persisted activity anywhere
 * gets an all-zero, `exists: false` profile rather than an error.
 */
export function buildContributorProfileFromStore(contributorId: string, asOfDayKey: string): ContributorProfile {
  const leaderboard = buildPersistedLeaderboardWithCompletedTasks();
  const rankedIndex = leaderboard.findIndex((row) => row.contributorId === contributorId);
  const rank = rankedIndex === -1 ? null : rankedIndex + 1;
  const stats = rankedIndex === -1 ? buildEmptyContributorStats(contributorId) : leaderboard[rankedIndex];

  const unlockStatus = buildContributorUnlockStatusWithStreakFromStore(contributorId, asOfDayKey);

  const currentAwards = buildPersistedTopContributorAwards().filter((award) => award.contributorId === contributorId);
  const allAnnouncedAwards = listAnnouncedContributorAwards().flatMap((announcement) => announcement.awards);
  const hallOfFame =
    buildContributorAwardsHallOfFame(allAnnouncedAwards).find((entry) => entry.contributorId === contributorId) ??
    null;

  const endorsementsReceived = listEndorsementsByContributor(contributorId, "received");
  const endorsementsGiven = listEndorsementsByContributor(contributorId, "given");

  const exists =
    rank !== null ||
    stats.completedTaskCount > 0 ||
    currentAwards.length > 0 ||
    hallOfFame !== null ||
    endorsementsReceived.length > 0 ||
    endorsementsGiven.length > 0;

  return {
    contributorId,
    exists,
    rank,
    stats,
    unlockStatus,
    currentAwards,
    hallOfFame,
    endorsementsReceived,
    endorsementsGiven,
  };
}
