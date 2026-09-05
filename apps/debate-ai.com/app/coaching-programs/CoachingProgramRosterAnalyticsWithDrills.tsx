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
 * @module app/coaching-programs/CoachingProgramRosterAnalyticsWithDrills
 */

"use client"

import { useMemo } from "react"
import { CoachingProgramRosterAnalyticsPanel } from "debate-community"
import { useDrillSets } from "debate-practice-rounds"
import { buildDrillReviewCalendarEvents } from "debate-practice-rounds/src/state/drillSets"

export function CoachingProgramRosterAnalyticsWithDrills() {
  const { drillSets } = useDrillSets()
  const drillReviewEvents = useMemo(() => buildDrillReviewCalendarEvents(drillSets ?? []), [drillSets])
  return <CoachingProgramRosterAnalyticsPanel drillReviewEvents={drillReviewEvents} />
}
