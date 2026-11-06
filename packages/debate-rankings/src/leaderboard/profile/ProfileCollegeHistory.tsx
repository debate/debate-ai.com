/**
 * @fileoverview College history block of a school profile: the program
 * strength chart across the top, then the NDT record, whose card lists CEDA
 * titles directly under NDT championships. A school with CEDA titles but no
 * NDT record gets the standalone CEDA card instead.
 * @module panels/leaderboard/profile/ProfileCollegeHistory
 */

"use client"

import { useMemo } from "react"
import { useNdtHistory } from "./ndtHistory"
import { ProfileCedaHistory } from "./ProfileCedaHistory"
import { ProfileNdtHistory } from "./ProfileNdtHistory"
import { ProfileProgramStrength } from "./ProfileProgramStrength"
import { findNdtSchoolHistory } from "./rankingProfileHelpers"

/**
 * @param props.school - School name as the rankings spell it.
 */
export function ProfileCollegeHistory({ school }: { school: string }) {
  const schools = useNdtHistory()
  const hasNdt = useMemo(() => (schools ? findNdtSchoolHistory(schools, school) !== null : false), [schools, school])
  return (
    <>
      <ProfileProgramStrength school={school} />
      <ProfileNdtHistory school={school} />
      {schools && !hasNdt && <ProfileCedaHistory school={school} />}
    </>
  )
}
