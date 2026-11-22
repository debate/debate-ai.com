/**
 * @fileoverview Where a school is, for the line under its name on a school
 * page: "Houston, Texas", or just "Texas" when only the state is known.
 *
 * The city comes only from the school's page (owners and staff set it; there
 * is no city in any of the rankings data). The state comes from the page too,
 * else from a state tag in the school's name ("Greenhill School (TX)"), its
 * Tournament of Champions results, or its place on the Niche academics list.
 * @module schools/school-location
 */

import { findTocSchoolRecord, tocSchoolState } from "../sync/toc-champions"
import { findNicheAcademicsRank } from "./niche-academics"

/** US state (plus DC) names by postal code. */
export const US_STATE_NAMES: Readonly<Record<string, string>> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky",
  LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
}

/** Longest city accepted on a school page. */
export const MAX_SCHOOL_CITY_LENGTH = 80

/** A school's city and two-letter state, either possibly unknown. */
export interface SchoolLocation {
  city: string | null
  state: string | null
}

/** `"tx"` → `"TX"`; null for anything that isn't a US state code. */
export function normalizeStateCode(value: unknown): string | null {
  if (typeof value !== "string") return null
  const code = value.trim().toUpperCase()
  return US_STATE_NAMES[code] ? code : null
}

/** The state a school's name or records put it in, or null. */
export function inferSchoolState(school: string): string | null {
  const tagged = normalizeStateCode(tocSchoolState(school) ?? "")
  if (tagged) return tagged
  const toc = findTocSchoolRecord(school)
  const fromToc = toc ? normalizeStateCode(tocSchoolState(toc.school) ?? "") : null
  if (fromToc) return fromToc
  return normalizeStateCode(findNicheAcademicsRank(school)?.state ?? "")
}

/**
 * Where the school is: the page's own city and state first, then the state
 * {@link inferSchoolState} finds.
 */
export function schoolLocation(school: string, saved?: Partial<SchoolLocation> | null): SchoolLocation {
  const city = saved?.city?.trim() || null
  const state = normalizeStateCode(saved?.state) ?? inferSchoolState(school)
  return { city, state }
}

/** `"Houston, Texas"`, `"Texas"`, `"Houston"`, or null when nothing is known. */
export function formatSchoolLocation(location: SchoolLocation): string | null {
  const state = location.state ? US_STATE_NAMES[location.state] ?? location.state : null
  const parts = [location.city, state].filter(Boolean)
  return parts.length ? parts.join(", ") : null
}
