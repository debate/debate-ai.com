/**
 * @fileoverview A school's info block on its page: city and state, public
 * or private, and a link to its website. The bundled list
 * ({@link SCHOOL_INFO_ROWS}) covers the top 50 schools in every rankings
 * division; elsewhere the state comes from {@link inferSchoolState} and the
 * type from the academics lists. A city or state the school's owners saved on
 * the page wins over both.
 * @module schools/school-info
 */

import { schoolHandle } from "../leaderboard/profile/rankingProfileHelpers"
import { findAcademicCategoryRank } from "./academic-category-ranks"
import { SCHOOL_INFO_ROWS, type SchoolInfoRow } from "./school-info-data"
import { normalizeStateCode, schoolLocation, type SchoolLocation } from "./school-location"

/** What a school page's info block shows; any part may be unknown. */
export interface SchoolInfo extends SchoolLocation {
  type: "Public" | "Private" | null
  /** Full `https://` URL of the school's website. */
  website: string | null
}

const BY_HANDLE: Map<string, SchoolInfoRow> = new Map(SCHOOL_INFO_ROWS.map((row) => [schoolHandle(row[0]), row]))

/** `"greenhill.org"` → `"https://greenhill.org"`; null for a blank domain. */
export function websiteUrl(domain: string | null | undefined): string | null {
  const value = domain?.trim()
  if (!value) return null
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

/** `"https://www.greenhill.org/"` → `"greenhill.org"`, for the link text. */
export function websiteLabel(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "")
}

/**
 * The info block for a school.
 *
 * @param school - The school as the rankings or a profile spell it.
 * @param saved - City and state the school's owners saved on its page.
 */
export function schoolInfo(school: string, saved?: Partial<SchoolLocation> | null): SchoolInfo {
  const row = BY_HANDLE.get(schoolHandle(school))
  const savedCity = saved?.city?.trim() || null
  const state = normalizeStateCode(saved?.state) ?? (row?.[2] || null) ?? schoolLocation(school).state
  // The bundled city only goes with its own state.
  const city = savedCity ?? (row?.[1] && (!row[2] || row[2] === state) ? row[1] : null)
  const type = row?.[3] ?? findAcademicCategoryRank(school)?.category ?? null
  return { city, state, type, website: websiteUrl(row?.[4]) }
}
