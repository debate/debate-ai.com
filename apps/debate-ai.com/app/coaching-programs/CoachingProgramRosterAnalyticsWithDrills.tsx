/**
 * @fileoverview Client wrapper around `CoachingProgramRosterAnalyticsPanel`
 * that resolves the signed-in coach's own scheduled drill review reminders
 * (`debate-practice-rounds`' `useDrillSets()`) into the program calendar's
 * `drillReviewEvents` input — idea #13's ("Coaching Programs and Group
 * Challenges") own follow-up in TODO.md ("A calendar/schedule view across a
 * program's drills, sprints, and challenges"), closing the "drills" gap the
 * panel's first slice deliberately left open (`debate-practice-rounds`
 * already depends on `debate-community` for Progress Unlocks tiers, so
 * `debate-community` importing drill types back would be circular — this
 * app/page layer already depends on both, so it resolves the composition
 * instead). Split out of `page.tsx` so `page.tsx` stays a server component,
 * mirroring `CommunityHubPageContent.tsx`'s "For You" split for the same
 * reason.
 *
 * Also resolves the panel's `memberDrillPracticeStatus` prop — the other
 * Known-gaps follow-up ("the roster analytics table ... doesn't yet fold in
 * drill-completion rate or practice-round counts"). `debate-team-collaboration`'s
 * `state/roundContributorFlows.ts#listRoundContributorFlows` already maps
 * every roster member's currently recorded practice round to a `roundId`
 * (the same mapping `buildDrillReviewCalendarEvents`'s docs point at as
 * "already exists"); this layer joins that against `debate-practice-rounds`'
 * own persisted drill sets (`buildContributorDrillCompletionStats`, for
 * completion progress) and `debate-team-collaboration`'s
 * `buildCoachingProgramMemberPracticeRounds` (for Practice Round Simulator
 * status), the same two joins `CoachingProgramsPanel`'s own board already
 * performs — just resolved here since this layer, unlike `debate-community`,
 * can depend on both `debate-practice-rounds` and `debate-team-collaboration`
 * directly. See `docs/features/coaching-programs.md`'s "Per-member
 * drill/practice-round status" section.
 *
 * @module app/coaching-programs/CoachingProgramRosterAnalyticsWithDrills
 */

"use client"

import { useEffect, useMemo, useState } from "react"
import { CoachingProgramRosterAnalyticsPanel, type MemberDrillPracticeStatus } from "debate-community"
import { useDrillSets } from "debate-practice-rounds"
import { buildContributorDrillCompletionStats, buildDrillReviewCalendarEvents } from "debate-practice-rounds/src/state/drillSets"
import {
  buildCoachingProgramMemberPracticeRounds,
  listRoundContributorFlows,
} from "debate-team-collaboration/src/state/roundContributorFlows"

export function CoachingProgramRosterAnalyticsWithDrills() {
  const { drillSets } = useDrillSets()
  const [contributorRoundIds, setContributorRoundIds] = useState<{ contributorId: string; roundId: string }[]>([])

  useEffect(() => {
    setContributorRoundIds(
      listRoundContributorFlows().map(({ contributorId, roundId }) => ({ contributorId, roundId })),
    )
  }, [])

  const drillReviewEvents = useMemo(() => buildDrillReviewCalendarEvents(drillSets ?? []), [drillSets])

  const memberDrillPracticeStatus = useMemo(() => {
    const drillStats = buildContributorDrillCompletionStats(contributorRoundIds, drillSets ?? [])
    const practiceRoundByContributor = new Map(
      buildCoachingProgramMemberPracticeRounds(contributorRoundIds.map((entry) => entry.contributorId)).map(
        (practiceRound) => [practiceRound.contributorId, practiceRound],
      ),
    )

    const status: Record<string, MemberDrillPracticeStatus> = {}
    for (const { contributorId } of contributorRoundIds) {
      const stats = drillStats[contributorId]
      const practiceRound = practiceRoundByContributor.get(contributorId)
      status[contributorId] = {
        completedDrills: stats?.completed ?? 0,
        totalDrills: stats?.total ?? 0,
        practiceRoundRecorded: Boolean(practiceRound),
        practiceRoundHasFeedback: Boolean(practiceRound?.feedback),
      }
    }
    return status
  }, [contributorRoundIds, drillSets])

  return (
    <CoachingProgramRosterAnalyticsPanel
      drillReviewEvents={drillReviewEvents}
      memberDrillPracticeStatus={memberDrillPracticeStatus}
    />
  )
}
