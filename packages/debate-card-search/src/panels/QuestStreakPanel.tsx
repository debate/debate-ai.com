/**
 * @fileoverview Gamified quest streaks — UI over `lib/gamified-quests.ts`.
 *
 * Turns a contributor's daily mission history into the current/longest streak,
 * the milestone badges earned so far and the next badge still to come.
 */

"use client";

import { useMemo } from "react";
import { Flame } from "lucide-react";

import {
  EmptyState,
  MeterBar,
  PanelSection,
  PanelShell,
  Pill,
  StatGrid,
  StatTile,
  SummaryText,
} from "debate-ui/src/panels/panel-shell";

import {
  DEFAULT_STREAK_MILESTONES,
  buildContributorQuestStreak,
  buildStreakSummaryText,
  computeDailyMissionResult,
  type DailyMissionResult,
  type StreakMilestone,
} from "../lib/gamified-quests";
import { getUtcDayKey } from "../lib/daily-best-card";
import type { QuestProgress } from "../lib/daily-quests";

/** Props for {@link QuestStreakPanel}. */
export interface QuestStreakPanelProps {
  /** Contributor the streak belongs to. */
  contributorId: string;
  /** One result per day the contributor has been active. */
  missionResults: DailyMissionResult[];
  /**
   * Today's quest board. When given, today's result is folded into the
   * history so the streak reflects work done since the last save.
   */
  todayBoard?: QuestProgress[];
  /** "Now" in epoch ms, used to derive the as-of UTC day key. */
  now?: number;
  /** Milestones that award badges. */
  milestones?: StreakMilestone[];
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Shows a contributor's quest streak and milestone badges.
 *
 * @param props - See {@link QuestStreakPanelProps}.
 * @returns The streak panel.
 */
export function QuestStreakPanel({
  contributorId,
  missionResults,
  todayBoard,
  now = Date.now(),
  milestones = DEFAULT_STREAK_MILESTONES,
  className,
}: QuestStreakPanelProps) {
  const asOfDayKey = getUtcDayKey(now);

  const results = useMemo(() => {
    if (!todayBoard) return missionResults;
    const today = computeDailyMissionResult(todayBoard, asOfDayKey);
    const withoutToday = missionResults.filter((result) => result.dayKey !== asOfDayKey);
    return [...withoutToday, today];
  }, [missionResults, todayBoard, asOfDayKey]);

  const status = useMemo(
    () => buildContributorQuestStreak(contributorId, results, asOfDayKey, milestones),
    [contributorId, results, asOfDayKey, milestones],
  );

  const nextMilestone = useMemo(
    () =>
      [...milestones]
        .sort((a, b) => a.streakLength - b.streakLength)
        .find((milestone) => milestone.streakLength > status.streak.currentStreak) ?? null,
    [milestones, status.streak.currentStreak],
  );

  const recent = useMemo(
    () => [...results].sort((a, b) => a.dayKey.localeCompare(b.dayKey)).slice(-14),
    [results],
  );

  return (
    <PanelShell
      title="Quest Streak"
      description={`Daily mission streak for ${contributorId}.`}
      icon={<Flame className="h-4 w-4" />}
      className={className}
      data-testid="quest-streak-panel"
    >
      <StatGrid columns={3}>
        <StatTile
          label="Current streak"
          value={status.streak.currentStreak}
          tone={status.streak.currentStreak > 0 ? "positive" : "neutral"}
          hint={`as of ${asOfDayKey}`}
        />
        <StatTile label="Longest streak" value={status.streak.longestStreak} />
        <StatTile
          label="Last complete day"
          value={status.streak.lastCompletedDayKey ?? "—"}
        />
      </StatGrid>

      {nextMilestone ? (
        <MeterBar
          value={status.streak.currentStreak}
          max={nextMilestone.streakLength}
          tone="warning"
          label={`Next badge: ${nextMilestone.badge}`}
          caption={`${status.streak.currentStreak} / ${nextMilestone.streakLength} days`}
        />
      ) : null}

      <PanelSection title="Badges earned">
        {status.earnedBadges.length === 0 ? (
          <EmptyState
            title="No badges yet"
            message={`Complete every quest for ${milestones[0]?.streakLength ?? 3} days in a row to earn the first badge.`}
          />
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {status.earnedBadges.map((badge) => (
              <Pill key={badge} tone="positive">
                {badge}
              </Pill>
            ))}
          </div>
        )}
      </PanelSection>

      {recent.length > 0 ? (
        <PanelSection title="Recent days">
          <div className="flex flex-wrap gap-1">
            {recent.map((result) => (
              <span
                key={result.dayKey}
                title={`${result.dayKey}: ${result.isComplete ? "complete" : "incomplete"}`}
                className={
                  result.isComplete
                    ? "h-5 w-5 rounded bg-emerald-500/70"
                    : "bg-muted h-5 w-5 rounded border"
                }
              />
            ))}
          </div>
        </PanelSection>
      ) : null}

      <SummaryText label="Plain-text summary" text={buildStreakSummaryText(status)} />
    </PanelShell>
  );
}
