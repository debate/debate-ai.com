/**
 * @fileoverview Every school of the last ten seasons, one row per `@handle`:
 * the name its page shows, every other name it goes by, the seasons it was
 * ranked in, and what its page is missing. The app's server builds it daily
 * from the saved seasons (`apps/debate-web/lib/rankings/school-directory-store.ts`);
 * a school page that no current ranking lists reads its row to show the
 * school anyway, and the admin "Schools with missing info" section lists the
 * rows with gaps and the names that look like one school split over two pages.
 * @module @debate-ai/rankings/schools/school-directory
 */

import { collegeSchoolKey } from "../college-history"
import { schoolAliases, schoolHandle } from "../leaderboard/profile/rankingProfileHelpers"

/** How many seasons back the directory reaches, the current one included. */
export const SCHOOL_DIRECTORY_SEASONS = 10

export type SchoolDirectoryLevel = "college" | "highSchool"

/** One school name seen in one season. */
export interface SchoolDirectoryRecord {
  /** The name, or `null` when only the handle was saved (older high school seasons). */
  name: string | null
  /** The page handle; worked out from `name` when left out. */
  handle?: string
  level: SchoolDirectoryLevel
  /** Season year (the year it ends in). */
  year: number
  /** From the current season's rankings. */
  current?: boolean
}

/** What a school's page can't show. */
export type SchoolMissingInfo =
  /** No name on record: the page has nothing to title itself with. */
  | "name"
  /** No logo in the logo map. */
  | "logo"

export interface SchoolDirectoryEntry {
  handle: string
  /** The name the page shows. */
  name: string
  level: SchoolDirectoryLevel
  /** Every other name it goes by, sorted. */
  aliases: string[]
  firstYear: number
  lastYear: number
  /** In the current season's rankings. */
  ranked: boolean
  missing: SchoolMissingInfo[]
}

/** Names that look like one school but sit at different handles. */
export interface SimilarSchoolGroup {
  key: string
  schools: { handle: string; name: string; lastYear: number }[]
}

/** `"harker-school-ca"` → `"Harker School Ca"`: a stand-in title for a handle with no saved name. */
function titleFromHandle(handle: string): string {
  return handle
    .split("-")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ")
}

/**
 * One entry per handle: current rankings' name first, then the most used,
 * then the longest; `hasLogo` says whether the logo map has the school.
 */
export function buildSchoolDirectory(
  records: readonly SchoolDirectoryRecord[],
  options: { hasLogo?: (name: string) => boolean } = {},
): SchoolDirectoryEntry[] {
  const groups = new Map<
    string,
    { level: SchoolDirectoryLevel; names: Map<string, { count: number; current: boolean }>; first: number; last: number; ranked: boolean }
  >()
  for (const record of records) {
    const name = record.name?.trim() || null
    const handle = record.handle || (name ? schoolHandle(name) : "")
    if (!handle) continue
    const group = groups.get(handle) ?? { level: record.level, names: new Map(), first: record.year, last: record.year, ranked: false }
    // A college record wins the level: a high school never shares a college's handle on purpose.
    if (record.level === "college") group.level = "college"
    group.first = Math.min(group.first, record.year)
    group.last = Math.max(group.last, record.year)
    group.ranked ||= Boolean(record.current)
    if (name) {
      const seen = group.names.get(name) ?? { count: 0, current: false }
      seen.count += 1
      seen.current ||= Boolean(record.current)
      group.names.set(name, seen)
    }
    groups.set(handle, group)
  }

  const entries: SchoolDirectoryEntry[] = []
  for (const [handle, group] of groups) {
    const ranked = [...group.names.entries()].sort(
      ([a, x], [b, y]) => Number(y.current) - Number(x.current) || y.count - x.count || b.length - a.length || a.localeCompare(b),
    )
    const name = ranked[0]?.[0] ?? null
    const known = new Set([...group.names.keys(), ...(group.level === "college" ? schoolAliases(handle) : [])])
    if (name) known.delete(name)
    const missing: SchoolMissingInfo[] = []
    if (!name) missing.push("name")
    if (options.hasLogo && !(name && options.hasLogo(name))) missing.push("logo")
    entries.push({
      handle,
      name: name ?? titleFromHandle(handle),
      level: group.level,
      aliases: [...known].sort((a, b) => a.localeCompare(b)),
      firstYear: group.first,
      lastYear: group.last,
      ranked: group.ranked,
      missing,
    })
  }
  return entries.sort((a, b) => a.handle.localeCompare(b.handle))
}

/** Words that don't tell high schools apart. */
const HIGH_SCHOOL_FILLER = new Set([
  "the", "high", "school", "hs", "senior", "sr", "academy", "prep", "preparatory", "college", "of", "and", "upper",
])

/**
 * What tells schools apart, for spotting one school under two names:
 * colleges use {@link collegeSchoolKey}; high schools drop the state tag and
 * words like "High School", "Academy" and "Prep" (`"Harker School (CA)"` and
 * `"The Harker School"` both become `"harker"`).
 */
export function schoolSimilarityKey(name: string, level: SchoolDirectoryLevel): string {
  if (level === "college") return `college:${collegeSchoolKey(name)}`
  const words = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)\s*$/, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word && !HIGH_SCHOOL_FILLER.has(word))
  return `hs:${words.join(" ")}`
}

/** Groups of two or more handles whose names share a {@link schoolSimilarityKey}. */
export function similarSchoolGroups(entries: readonly SchoolDirectoryEntry[]): SimilarSchoolGroup[] {
  const byKey = new Map<string, SchoolDirectoryEntry[]>()
  for (const entry of entries) {
    if (entry.missing.includes("name")) continue
    const key = schoolSimilarityKey(entry.name, entry.level)
    if (key.endsWith(":")) continue
    byKey.set(key, [...(byKey.get(key) ?? []), entry])
  }
  return [...byKey.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({
      key,
      schools: group.map(({ handle, name, lastYear }) => ({ handle, name, lastYear })),
    }))
    .sort((a, b) => a.key.localeCompare(b.key))
}

/** `GET /api/rankings/school-directory`'s body. */
export interface SchoolDirectoryResponse {
  school: SchoolDirectoryEntry | null
}

/** The admin report (`/api/admin/school-directory`). */
export interface SchoolDirectoryReport {
  builtAt: string | null
  total: number
  counts: Record<SchoolDirectoryLevel, number>
  missing: SchoolDirectoryEntry[]
  similar: SimilarSchoolGroup[]
}

/** One school's directory row for a page handle, or null (also on a network error). */
export async function fetchSchoolDirectoryEntry(handle: string, signal?: AbortSignal): Promise<SchoolDirectoryEntry | null> {
  try {
    const res = await fetch(`/api/rankings/school-directory?handle=${encodeURIComponent(handle)}`, { signal })
    if (!res.ok) return null
    return ((await res.json()) as SchoolDirectoryResponse).school ?? null
  } catch {
    return null
  }
}

/** The admin report; `rebuild` rebuilds the directory first. */
export async function fetchSchoolDirectoryReport(rebuild = false): Promise<SchoolDirectoryReport> {
  const res = await fetch("/api/admin/school-directory", { method: rebuild ? "POST" : "GET" })
  const body = (await res.json().catch(() => ({}))) as Partial<SchoolDirectoryReport> & { error?: string }
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`)
  return body as SchoolDirectoryReport
}
