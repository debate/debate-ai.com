/**
 * @fileoverview Progress unlocks — UI over `lib/progress-unlocks.ts` and the
 * `lib/unlock-streak-status.ts` composition slice.
 *
 * Shows a contributor's tier, the skill level and badges that tier unlocks,
 * and the distance to the next tier. When daily mission results are supplied
 * the panel switches to the streak-aware composition so streak badges appear
 * alongside the tier badges.
 */

"use client";

import { useMemo } from "react";
import { Medal } from "lucide-react";

import {
  MeterBar,
  PanelSection,
  PanelShell,
  Pill,
  StatGrid,
  StatTile,
  SummaryText,
  type PanelTone,
} from "debate-ui/src/panels/panel-shell";
import { useStoreSnapshot } from "debate-ui/src/panels/use-store-snapshot";

import {
  DEFAULT_UNLOCK_TIER_REQUIREMENTS,
  buildContributorUnlockStatus,
  buildUnlockStatusText,
  type ContributorUnlockStatus,
  type UnlockTier,
  type UnlockTierRequirement,
} from "../lib/progress-unlocks";
import {
  buildContributorUnlockStatusWithStreak,
  buildUnlockStatusWithStreakText,
} from "../lib/unlock-streak-status";
import {
  DEFAULT_STREAK_MILESTONES,
  type DailyMissionResult,
  type StreakMilestone,
} from "../lib/gamified-quests";
import {
  buildContributorStats,
  type AttributedContribution,
  type ContributorStats,
} from "../lib/contribution-leaderboard";
import { getUtcDayKey } from "../lib/daily-best-card";
import { listContributionsByContributor } from "../state/contributions";

const TIER_TONE: Record<UnlockTier, PanelTone> = {
  novice: "neutral",
  apprentice: "info",
  veteran: "warning",
  expert: "positive",
};

/** Props for {@link ProgressUnlocksPanel}. */
export interface ProgressUnlocksPanelProps {
  /** Contributor whose unlock status is shown. */
  contributorId: string;
  /**
   * Pre-computed stats. When omitted the panel derives them from the
   * contributor's persisted contributions.
   */
  stats?: ContributorStats;
  /** Tier thresholds. */
  tierRequirements?: UnlockTierRequirement[];
  /** Daily mission history; supplying it enables the streak-aware status. */
  missionResults?: DailyMissionResult[];
  /** Streak milestones used when `missionResults` is supplied. */
  streakMilestones?: StreakMilestone[];
  /** "Now" in epoch ms, used to derive the as-of UTC day key. */
  now?: number;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Shows tier, unlocked skill level, badges and next-tier progress.
 *
 * @param props - See {@link ProgressUnlocksPanelProps}.
 * @returns The unlock status panel.
 */
export function ProgressUnlocksPanel({
  contributorId,
  stats,
  tierRequirements = DEFAULT_UNLOCK_TIER_REQUIREMENTS,
  missionResults,
  streakMilestones = DEFAULT_STREAK_MILESTONES,
  now = Date.now(),
  className,
}: ProgressUnlocksPanelProps) {
  const { data: persisted } = useStoreSnapshot<AttributedContribution[]>(
    () => listContributionsByContributor(contributorId),
    [],
  );

  const resolvedStats = useMemo(
    () => stats ?? buildContributorStats(contributorId, persisted),
    [stats, contributorId, persisted],
  );

  const withStreak = useMemo(
    () =>
      missionResults
        ? buildContributorUnlockStatusWithStreak(
            resolvedStats,
            missionResults,
            getUtcDayKey(now),
            tierRequirements,
            streakMilestones,
          )
        : null,
    [resolvedStats, missionResults, now, tierRequirements, streakMilestones],
  );
  const baseStatus = useMemo(
    () => buildContributorUnlockStatus(resolvedStats, tierRequirements),
    [resolvedStats, tierRequirements],
  );

  const status: ContributorUnlockStatus = withStreak ?? baseStatus;
  const streak = withStreak?.streak ?? null;
  const streakBadges = withStreak?.streakBadges ?? [];
  const summaryText = withStreak
    ? buildUnlockStatusWithStreakText(withStreak)
    : buildUnlockStatusText(baseStatus);

  const nextRequirement = useMemo(
    () => tierRequirements.find((requirement) => requirement.tier === status.nextTier?.tier) ?? null,
    [tierRequirements, status.nextTier],
  );

  return (
    <PanelShell
      title="Progress Unlocks"
      description={`Tier and unlocked privileges for ${contributorId}.`}
      icon={<Medal className="h-4 w-4" />}
      className={className}
      data-testid="progress-unlocks-panel"
      actions={<Pill tone={TIER_TONE[status.tier]}>{status.tier}</Pill>}
    >
      <StatGrid columns={streak ? 4 : 3}>
        <StatTile label="Contributions" value={resolvedStats.contributionCount} />
        <StatTile
          label="Helpfulness"
          value={resolvedStats.totalHelpfulnessScore.toFixed(2)}
          tone="info"
        />
        <StatTile label="Skill level" value={status.unlockedSkillLevel} tone={TIER_TONE[status.tier]} />
        {streak ? (
          <StatTile
            label="Current streak"
            value={streak.currentStreak}
            tone={streak.currentStreak > 0 ? "positive" : "neutral"}
            hint={`longest ${streak.longestStreak}`}
          />
        ) : null}
      </StatGrid>

      {status.nextTier && nextRequirement ? (
        <PanelSection title={`Next tier: ${status.nextTier.tier}`}>
          <MeterBar
            value={resolvedStats.contributionCount}
            max={nextRequirement.minContributionCount}
            tone="info"
            label="Contributions"
            caption={`${status.nextTier.contributionsNeeded} more`}
          />
          <MeterBar
            value={resolvedStats.totalHelpfulnessScore}
            max={nextRequirement.minTotalHelpfulnessScore}
            tone="warning"
            label="Helpfulness score"
            caption={`${status.nextTier.helpfulnessScoreNeeded.toFixed(2)} more`}
          />
        </PanelSection>
      ) : (
        <PanelSection title="Next tier">
          <p className="text-muted-foreground text-xs">Top tier reached — no further unlocks.</p>
        </PanelSection>
      )}

      <PanelSection title="Badges">
        <div className="flex flex-wrap gap-1.5">
          {status.badges.map((badge) => (
            <Pill key={badge} tone={TIER_TONE[status.tier]}>
              {badge}
            </Pill>
          ))}
          {streakBadges.map((badge) => (
            <Pill key={badge} tone="positive">
              {badge}
            </Pill>
          ))}
          {status.badges.length === 0 && streakBadges.length === 0 ? (
            <span className="text-muted-foreground text-xs">No badges unlocked yet.</span>
          ) : null}
        </div>
      </PanelSection>

      <SummaryText label="Plain-text summary" text={summaryText} />
    </PanelShell>
  );
}
