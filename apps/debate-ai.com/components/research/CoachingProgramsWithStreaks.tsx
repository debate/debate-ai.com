"use client"

/**
 * @fileoverview Thin wrapper over `debate-team-collaboration`'s
 * `CoachingProgramsPanel` that resolves a roster member's quest streak for
 * its roster analytics dashboard — idea #13's "(b) a coach-facing roster
 * analytics dashboard (completion rates, streaks, standings in one place)"
 * follow-up in TODO.md. `debate-contributor-progress` (streak tracking)
 * already depends on `debate-team-collaboration`, so the panel itself can't
 * import it back without creating a cycle; it instead takes a
 * `getMemberStreak` lookup as a plain prop, and this is the one place that
 * composes both packages. Mirrors `GroupChallengesWithIdentity.tsx`'s
 * "the panel stays app-agnostic, this wrapper knows about the rest of the
 * app" convention.
 */

import { CoachingProgramsPanel } from "debate-team-collaboration"
import { buildPersistedContributorQuestStreak } from "debate-community"

function todayUtcDayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export function CoachingProgramsWithStreaks() {
  const getMemberStreak = (contributorId: string) => {
    const { streak } = buildPersistedContributorQuestStreak(contributorId, todayUtcDayKey())
    return streak.currentStreak > 0 || streak.longestStreak > 0 ? streak : undefined
  }

  return <CoachingProgramsPanel getMemberStreak={getMemberStreak} />
}
