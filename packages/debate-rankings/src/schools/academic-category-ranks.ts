/**
 * @fileoverview A high school's academics rank in its category: its place
 * among public or private schools nationally on the 2027 Best High Schools
 * in America lists (top 999 public, top 800 private;
 * {@link PUBLIC_ACADEMIC_ROWS}, {@link PRIVATE_ACADEMIC_ROWS}), and its place
 * among the listed schools of the same category in its state. The combined
 * top-200 position is `niche-academics.ts`.
 *
 * Names match on their identifying words (`nicheNameKey`, the same rule as
 * the combined list) or a known debate alias. A key that several listed
 * schools share (two "Westwood High School"s) matches only when the query's
 * state tag picks one, so a short ranking name never inherits another
 * state's school.
 * @module schools/academic-category-ranks
 */

import { PRIVATE_ACADEMIC_ROWS, PUBLIC_ACADEMIC_ROWS, type AcademicCategoryRow } from "./academic-category-data"
import { NICHE_ACADEMICS_ALIASES, nicheNameKey } from "./niche-academics"

/** One school's category ranks. */
export interface AcademicCategoryRank {
  name: string
  state: string
  category: "Public" | "Private"
  /** Rank among the category's schools nationally (the list's own number). */
  nationalRank: number
  /** How many schools of the category the list has. */
  nationalOf: number
  /** Place among the listed schools of the category in the same state, 1 = best. */
  stateRank: number
  /** How many listed schools of the category the state has. */
  stateOf: number
}

function build(rows: readonly AcademicCategoryRow[], category: AcademicCategoryRank["category"]): AcademicCategoryRank[] {
  const seenInState = new Map<string, number>()
  const out = rows.map(([rank, name, state]) => {
    const stateRank = (seenInState.get(state) ?? 0) + 1
    seenInState.set(state, stateRank)
    return { name, state, category, nationalRank: rank, nationalOf: rows.length, stateRank, stateOf: 0 }
  })
  for (const school of out) school.stateOf = seenInState.get(school.state) ?? 0
  return out
}

/** Every listed school, public first, each in list order. */
export const ACADEMIC_CATEGORY_RANKS: readonly AcademicCategoryRank[] = [
  ...build(PUBLIC_ACADEMIC_ROWS, "Public"),
  ...build(PRIVATE_ACADEMIC_ROWS, "Private"),
]

/**
 * Debate names for schools whose name several listed schools share, as
 * `[listed name, state]`: on the circuit, "Westlake" is Westlake in Austin and
 * "Peninsula" is Palos Verdes Peninsula.
 */
const DEBATE_ALIASES: Record<string, readonly [string, string]> = {
  "westlake": ["Westlake High School", "TX"],
  "walt whitman": ["Walt Whitman High School", "MD"],
  "whitman": ["Walt Whitman High School", "MD"],
  "lynbrook": ["Lynbrook High School", "CA"],
  "peninsula": ["Palos Verdes Peninsula High School", "CA"],
  "palos verdes peninsula": ["Palos Verdes Peninsula High School", "CA"],
}

/** Listed schools by name key; a key can hold several. */
const BY_KEY: Map<string, AcademicCategoryRank[]> = (() => {
  const map = new Map<string, AcademicCategoryRank[]>()
  for (const school of ACADEMIC_CATEGORY_RANKS) {
    const key = nicheNameKey(school.name)
    if (key) map.set(key, [...(map.get(key) ?? []), school])
  }
  return map
})()

/**
 * Debate aliases, each naming one school. They win over a name match for a
 * bare name ("Thomas Jefferson" is TJHSST in Virginia, not Thomas Jefferson
 * School in Missouri); a state tag still picks by name.
 */
const BY_ALIAS: Map<string, AcademicCategoryRank> = (() => {
  const map = new Map<string, AcademicCategoryRank>()
  for (const [from, name] of Object.entries(NICHE_ACADEMICS_ALIASES)) {
    const targets = BY_KEY.get(nicheNameKey(name))
    if (targets?.length === 1) map.set(nicheNameKey(from), targets[0])
  }
  for (const [from, [name, state]] of Object.entries(DEBATE_ALIASES)) {
    const school = ACADEMIC_CATEGORY_RANKS.find((s) => s.name === name && s.state === state)
    if (school) map.set(nicheNameKey(from), school)
  }
  return map
})()

/**
 * A high school's public or private academics rank, nationally and in its
 * state, or `null` when it isn't on either list, the name can't be matched,
 * or the name is shared by listed schools its state tag doesn't tell apart.
 *
 * @param school - The school as the rankings or a profile spell it, with or without a `(ST)` tag.
 */
export function findAcademicCategoryRank(school: string | null | undefined): AcademicCategoryRank | null {
  if (!school) return null
  const key = nicheNameKey(school)
  const state = school.match(/\(([A-Z]{2})\)\s*$/)?.[1]
  const alias = BY_ALIAS.get(key)
  if (alias && (!state || alias.state === state)) return alias
  const matches = BY_KEY.get(key) ?? []
  const picked = state ? matches.filter((m) => m.state === state) : matches
  return picked.length === 1 ? picked[0] : null
}
