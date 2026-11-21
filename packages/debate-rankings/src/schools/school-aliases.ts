/**
 * @fileoverview One page per college, whatever a source calls it. College
 * data names the same school several ways ("State University of New York -
 * Binghamton", "Binghamton University", "Binghamton"; "Dartmouth College
 * (NH)", "Dartmouth College", "Dartmouth"; "University of Texas - Dallas",
 * "UTD"), and each spelling used to make its own `@handle`, so a link from
 * one table opened an empty page. {@link buildCollegeAliases} groups every
 * spelling by {@link collegeSchoolKey} and picks one handle per school; the
 * result is checked in as `school-alias-data.ts` (regenerate with
 * `bun src/sync/school-aliases-cli.ts`; a test fails when it is stale), and
 * `schoolHandle` / `canonicalSchoolHandle` send every other spelling there.
 * @module @debate-ai/rankings/schools/school-aliases
 */

import { collegeSchoolKey } from "../college-history"

/** One school name as a source spells it. */
export interface SchoolNameSource {
  name: string
  /** True for the current season's rankings: their handles are the live pages (and follows) and win. */
  current?: boolean
}

/** Every spelling's handle mapped to the school's one handle, and every name each school goes by. */
export interface CollegeAliasTable {
  /** Variant handle → the school's handle; only handles that differ are listed. */
  handles: Record<string, string>
  /** The school's handle → every name sources use for it, sorted. Only schools with two or more names. */
  names: Record<string, string[]>
}

/** `"college"` or `"university"` when the name says so (not both), else `""`. */
function schoolKind(name: string): string {
  const college = /\bcollege\b/i.test(name)
  const university = /\buniversity\b/i.test(name)
  return college === university ? "" : college ? "college" : "university"
}

/** The name's trailing state tag (`"NH"` for `Dartmouth College (NH)`), or `""`. */
function stateTag(name: string): string {
  return /\(([A-Za-z]{2})\)\s*$/.exec(name)?.[1]?.toUpperCase() ?? ""
}

/**
 * Joins a key's subgroups (`kind|tag`) into schools: a blank kind or tag
 * joins the one subgroup that fills it in, when there is exactly one;
 * otherwise it stays apart rather than guess.
 */
function mergeSubgroups<T>(subgroups: Map<string, Map<string, T>>): Map<string, T>[] {
  const parts = [...subgroups.entries()].map(([subKey, names]) => {
    const [kind, tag] = subKey.split("|")
    return { kind, tag, names: new Map(names) }
  })
  const fits = (vague: string, sharp: string) => !vague || vague === sharp
  // Most specific first, so vaguer subgroups fold into them.
  parts.sort((a, b) => Number(!a.kind) + Number(!a.tag) - (Number(!b.kind) + Number(!b.tag)))
  const merged: typeof parts = []
  for (const part of parts) {
    const homes = merged.filter((home) => fits(part.kind, home.kind) && fits(part.tag, home.tag))
    if (homes.length === 1) {
      for (const [name, value] of part.names) homes[0].names.set(name, value)
      homes[0].kind ||= part.kind
      homes[0].tag ||= part.tag
    } else {
      merged.push(part)
    }
  }
  return merged.map((part) => part.names)
}

/** A handle ends in a state tag (`dartmouth-college-nh`) because its name did (`(NH)`). */
function hasStateTag(name: string): boolean {
  return /\([A-Za-z]{2}\)\s*$/.test(name)
}

/**
 * Groups `sources` by {@link collegeSchoolKey} and picks each school's handle:
 * the current rankings' handle when there is one (so live links and follows
 * stay put), else the shortest handle of a name without a state tag, else the
 * shortest.
 *
 * @param handleOf - The handle a name would get with no aliases (`rawSchoolHandle`).
 */
export function buildCollegeAliases(
  sources: readonly SchoolNameSource[],
  handleOf: (name: string) => string,
): CollegeAliasTable {
  type Spelling = { handle: string; current: boolean; tagged: boolean }
  // Group by key, then by kind ("college", "university", or neither) and state
  // tag, so Boston College and Boston University, or Augustana College (IL)
  // and Augustana University (SD), stay two schools though their keys match.
  const byKey = new Map<string, Map<string, Map<string, Spelling>>>()
  for (const { name, current } of sources) {
    const trimmed = name?.trim()
    if (!trimmed) continue
    const key = collegeSchoolKey(trimmed)
    const handle = handleOf(trimmed)
    if (!key || !handle) continue
    const subKey = `${schoolKind(trimmed)}|${stateTag(trimmed)}`
    const subgroups = byKey.get(key) ?? new Map<string, Map<string, Spelling>>()
    const group = subgroups.get(subKey) ?? new Map<string, Spelling>()
    const seen = group.get(trimmed)
    group.set(trimmed, { handle, current: Boolean(current) || Boolean(seen?.current), tagged: hasStateTag(trimmed) })
    subgroups.set(subKey, group)
    byKey.set(key, subgroups)
  }
  const groups = new Map<string, Map<string, Spelling>>()
  for (const key of [...byKey.keys()].sort()) {
    for (const [index, group] of mergeSubgroups(byKey.get(key)!).entries()) groups.set(`${key}#${index}`, group)
  }

  const handles: Record<string, string> = {}
  const names: Record<string, string[]> = {}
  const byLength = (a: string, b: string) => a.length - b.length || a.localeCompare(b)
  for (const group of [...groups.keys()].sort().map((key) => groups.get(key)!)) {
    const spellings = [...group.values()]
    const distinct = [...new Set(spellings.map((s) => s.handle))]
    const current = [...new Set(spellings.filter((s) => s.current).map((s) => s.handle))].sort(byLength)
    const untagged = [...new Set(spellings.filter((s) => !s.tagged).map((s) => s.handle))].sort(byLength)
    const canonical = current[0] ?? untagged[0] ?? distinct.sort(byLength)[0]
    for (const handle of distinct) if (handle !== canonical) handles[handle] = canonical
    if (group.size > 1) names[canonical] = [...group.keys()].sort((a, b) => a.localeCompare(b))
  }
  return { handles: sortKeys(handles), names: sortKeys(names) }
}

function sortKeys<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)))
}

/** The checked-in `school-alias-data.ts` for `table`. */
export function renderCollegeAliasData(table: CollegeAliasTable): string {
  return `/**
 * @fileoverview Generated by \`bun src/sync/school-aliases-cli.ts\` from the
 * college tables (current rankings, debatedata seasons, NDT, CEDA and Shirley
 * history); do not edit by hand. See \`school-aliases.ts\`.
 * @module @debate-ai/rankings/schools/school-alias-data
 */

/** A college spelling's handle → the one handle its page lives at. */
export const COLLEGE_HANDLE_ALIASES: Readonly<Record<string, string>> = ${JSON.stringify(table.handles, null, 2)}

/** A college's handle → every name the sources use for it. */
export const COLLEGE_SCHOOL_NAMES: Readonly<Record<string, readonly string[]>> = ${JSON.stringify(table.names, null, 2)}
`
}
