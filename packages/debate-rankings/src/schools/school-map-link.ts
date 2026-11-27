/**
 * @fileoverview The Google Maps link behind a school's location line: a map
 * search for the school, opened on the satellite layer.
 * @module schools/school-map-link
 */

import { US_STATE_NAMES, type SchoolLocation } from "./school-location"

/** Google Maps' search URL; `t=k` is its satellite basemap (`m` is the plain map). */
export const GOOGLE_MAPS_SATELLITE_URL = "https://www.google.com/maps"

/**
 * The text searched for: the school's name, then whatever of its street
 * address, city and state is known. Null when `school` is blank.
 */
export function schoolMapQuery(
  school: string,
  location?: Partial<SchoolLocation> & { address?: string | null } | null,
): string | null {
  const name = school.trim()
  if (!name) return null
  const state = location?.state ? US_STATE_NAMES[location.state] ?? location.state : null
  const place = location?.address?.trim()
    ? [location.address.trim(), location.city?.trim(), state]
    : [location?.city?.trim(), state]
  return [name, ...place].filter(Boolean).join(", ")
}

/** A Google Maps URL searching for the school on the satellite layer; null when `school` is blank. */
export function schoolMapUrl(
  school: string,
  location?: Partial<SchoolLocation> & { address?: string | null } | null,
): string | null {
  const query = schoolMapQuery(school, location)
  if (!query) return null
  const params = new URLSearchParams({ q: query, t: "k" })
  return `${GOOGLE_MAPS_SATELLITE_URL}?${params}`
}
