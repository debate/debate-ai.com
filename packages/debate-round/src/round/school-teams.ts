/**
 * @fileoverview Looks up a school's teams in the rankings, for the Create
 * New Round dialog's team picker: once a school is entered, the dialog lists
 * that school's ranked entries in the round's format so the opponent can be
 * picked instead of typed.
 * @module round/school-teams
 */

import {
  loadRankingDataset,
  schoolMatchScore,
  type RankingDataset,
  type RankingDatasetId,
  type RankingEntry,
} from "@debate/rankings-adapter"

/**
 * The rankings dataset for each debate style that has one. Styles without
 * rankings (Congress, World Schools, college LD…) get no picker.
 */
const DATASET_FOR_STYLE: Partial<Record<string, RankingDatasetId>> = {
  publicForum: "hspf",
  lincolnDouglas: "hsld",
  policy: "hscx",
  collegePolicy: "cpd",
}

/** The rankings dataset for `styleKey`, or `null` when the style has none. */
export function rankingDatasetForStyle(styleKey: string): RankingDatasetId | null {
  return DATASET_FOR_STYLE[styleKey] ?? null
}

/** Shortest school text worth searching for; "St" matches half the field. */
export const MIN_SCHOOL_QUERY_LENGTH = 3

/**
 * `school` without the trailing state the school list adds
 * (`"Acton-Boxborough (MA)"`), which the rankings leave off.
 */
export function stripSchoolState(school: string): string {
  return school.replace(/\s*\([^)]*\)\s*$/, "").trim()
}

/**
 * The entries of `school`, best rank first. Only the closest-matching school
 * name is kept, so `"Harker"` does not also pull in every school that merely
 * shares a word with it.
 */
export function findSchoolTeams(
  entries: readonly RankingEntry[],
  school: string,
  limit = 12,
): RankingEntry[] {
  const name = stripSchoolState(school)
  if (name.length < MIN_SCHOOL_QUERY_LENGTH) return []
  let bestScore = 0
  let matches: RankingEntry[] = []
  for (const entry of entries) {
    const score = schoolMatchScore(name, entry.school)
    if (score === 0 || score < bestScore) continue
    if (score > bestScore) {
      bestScore = score
      matches = []
    }
    matches.push(entry)
  }
  return matches.sort((a, b) => a.rank - b.rank).slice(0, limit)
}

/**
 * Splits a rankings entry name into debater names: `"Falk & Sabnani"` gives
 * `["Falk", "Sabnani"]`, an LD debater `"Siddhartha Daswani"` stays whole.
 */
export function splitEntryDebaters(name: string): string[] {
  return name
    .split(/\s*(?:&|\/| and )\s*/i)
    .map((part) => part.trim())
    .filter(Boolean)
}

const datasetCache = new Map<RankingDatasetId, Promise<RankingDataset>>()

function loadDataset(id: RankingDatasetId): Promise<RankingDataset> {
  let pending = datasetCache.get(id)
  if (!pending) {
    pending = loadRankingDataset(id).catch((err: unknown) => {
      datasetCache.delete(id)
      throw err
    })
    datasetCache.set(id, pending)
  }
  return pending
}

/**
 * The ranked teams of `school` in `styleKey`'s format. Empty when the style
 * has no rankings, the school is too short to search, or the dataset fails
 * to load — the picker then simply stays hidden.
 */
export async function lookupSchoolTeams(styleKey: string, school: string): Promise<RankingEntry[]> {
  const id = rankingDatasetForStyle(styleKey)
  if (!id || school.trim().length < MIN_SCHOOL_QUERY_LENGTH) return []
  try {
    const dataset = await loadDataset(id)
    return findSchoolTeams(dataset.entries, school)
  } catch (error) {
    console.error("Unable to load rankings for school team lookup:", error)
    return []
  }
}
