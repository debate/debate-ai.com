/**
 * @fileoverview College history block of a school profile: the program
 * strength chart across the top, then the NDT record and CEDA titles side by
 * side on wide screens, each long list in its own capped-height scroll box.
 * @module panels/leaderboard/profile/ProfileCollegeHistory
 */

"use client"

import { useMemo } from "react"
import { findCedaSchoolTitles } from "../../sync/ceda-champions"
import { ProfileCedaHistory } from "./ProfileCedaHistory"
import { ProfileNdtHistory } from "./ProfileNdtHistory"
import { ProfileProgramStrength } from "./ProfileProgramStrength"

/**
 * @param props.school - School name as the rankings spell it.
 */
export function ProfileCollegeHistory({ school }: { school: string }) {
  const hasCeda = useMemo(() => findCedaSchoolTitles(school) !== null, [school])
  return (
    <>
      <ProfileProgramStrength school={school} />
      <div
        className={`grid items-start gap-x-4 [&>*]:min-w-0 ${hasCeda ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : ""}`}
      >
        <ProfileNdtHistory school={school} />
        <ProfileCedaHistory school={school} />
      </div>
    </>
  )
}
