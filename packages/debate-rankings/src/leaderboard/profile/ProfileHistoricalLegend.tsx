/**
 * @fileoverview The "Historical legend" section of a school profile: every
 * record of a school's past, under one heading. A college lists its program
 * strength by season and its NDT and CEDA record; a high school lists its
 * program strength by season (each event's best ranked entries since
 * 2015-16), then its Tournament of Champions and NDCA national championship
 * finishes in one year-sorted list, then the greatest high school teams of
 * all time in Policy, LD and PF with this school's own highlighted.
 * @module leaderboard/profile/ProfileHistoricalLegend
 */

"use client"

import { History } from "lucide-react"
import { ProfileCollegeHistory } from "./ProfileCollegeHistory"
import { ProfileHsAllTimeTeams } from "./ProfileHsAllTimeTeams"
import { ProfileNationalsHistory } from "./ProfileNationalsHistory"
import { ProfileSchoolStrength } from "./ProfileSchoolStrength"
import type { ProfileEntry, SchoolLevels } from "./rankingProfileHelpers"

/**
 * @param props.school - School name as the rankings spell it.
 * @param props.levels - Which histories apply (college, high school).
 * @param props.entries - The school's rows in the current rankings.
 */
export function ProfileHistoricalLegend({
  school,
  levels,
  entries,
}: {
  school: string
  levels: SchoolLevels
  entries: readonly ProfileEntry[]
}) {
  if (!levels.college && !levels.highSchool) return null
  return (
    <section className="mt-6" aria-labelledby="historical-legend">
      <h2 id="historical-legend" className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <History className="h-5 w-5" aria-hidden />
        Historical legend
      </h2>
      {levels.college && <ProfileCollegeHistory school={school} />}
      {levels.highSchool && (
        <>
          <ProfileSchoolStrength school={school} entries={entries} />
          <ProfileNationalsHistory school={school} />
          <ProfileHsAllTimeTeams school={school} />
        </>
      )}
    </section>
  )
}
