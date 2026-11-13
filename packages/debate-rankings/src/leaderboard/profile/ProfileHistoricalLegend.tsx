/**
 * @fileoverview The "Historical legend" section of a school profile: every
 * record of a school's past, under one heading. A college lists its program
 * strength by season and its NDT and CEDA record; a high school lists its
 * program strength by season (each event's best ranked entries since
 * 2015-16), its Tournament of Champions record and its NDCA national
 * championship policy record.
 * @module leaderboard/profile/ProfileHistoricalLegend
 */

"use client"

import { History } from "lucide-react"
import { ProfileCollegeHistory } from "./ProfileCollegeHistory"
import { ProfileNdcaHistory } from "./ProfileNdcaHistory"
import { ProfileSchoolStrength } from "./ProfileSchoolStrength"
import { ProfileTocHistory } from "./ProfileTocHistory"
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
          <ProfileTocHistory school={school} />
          <ProfileNdcaHistory school={school} />
        </>
      )}
    </section>
  )
}
