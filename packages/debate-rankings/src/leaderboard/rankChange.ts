/**
 * @fileoverview Year-over-year rank movement for the rankings tables: how many
 * places a team or school moved since the previous season's list.
 * @module leaderboard/rankChange
 */

/**
 * Places moved since last season: positive moved up (`+8`), negative dropped
 * (`-4`), `0` held its spot, `null` was not ranked last season ("new").
 */
export type RankChange = number | null

/** Rank changes keyed by {@link teamRankChangeKey} or {@link schoolRankChangeKey}. */
export type RankChanges = ReadonlyMap<string, RankChange>

/** Lower-cases, strips punctuation and collapses spaces so spellings line up across seasons. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9&\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Key matching a school across seasons. */
export function schoolRankChangeKey(row: { school: string }): string {
  return normalize(row.school)
}

/**
 * Key matching a team (or LD debater) across seasons: its school plus its
 * names, with the partners in a fixed order so "Smith & Lee" matches "Lee & Smith".
 */
export function teamRankChangeKey(entry: { school: string; name: string }): string {
  const names = normalize(entry.name)
    .split(/\s*&\s*/)
    .filter(Boolean)
    .sort()
    .join(" & ")
  return `${normalize(entry.school)}\u0000${names}`
}

/**
 * Compares this season's ranks with last season's. Every current row gets an
 * entry: last rank minus this rank, or `null` when it was not ranked last season.
 * A key listed twice keeps its first (best) rank, since rows arrive in rank order.
 *
 * @param current - This season's rows.
 * @param previous - Last season's rows.
 * @param keyOf - Matches a row across seasons ({@link teamRankChangeKey} or {@link schoolRankChangeKey}).
 */
export function buildRankChanges<T extends { rank: number }>(
  current: readonly T[],
  previous: readonly T[],
  keyOf: (row: T) => string,
): Map<string, RankChange> {
  const before = new Map<string, number>()
  for (const row of previous) {
    const key = keyOf(row)
    const seen = before.get(key)
    if (seen === undefined || row.rank < seen) before.set(key, row.rank)
  }
  const changes = new Map<string, RankChange>()
  for (const row of current) {
    const key = keyOf(row)
    if (changes.has(key)) continue
    const lastRank = before.get(key)
    changes.set(key, lastRank === undefined ? null : lastRank - row.rank)
  }
  return changes
}

/** Each debater's surname in a team name (`"Smith & Lee"`, or an LD debater's full name): the last word of each part. */
function surnames(name: string): string[] {
  return normalize(name)
    .split(/\s*&\s*/)
    .map((part) => part.split(" ").pop() ?? "")
    .filter(Boolean)
}

/**
 * {@link buildRankChanges} for teams, falling back to the debaters when the
 * pairing is new. A team whose exact pairing was ranked last season keeps
 * that rank. Otherwise each debater is looked up by surname and school
 * anywhere in last season's list (on whatever team they were on), taking
 * their best rank; the team's prior rank is the average of the debaters
 * found, or the one debater's rank when only one is. Only a team with no
 * debater found reads as `null` ("new").
 *
 * @param current - This season's team rows.
 * @param previous - Last season's team rows.
 */
export function buildTeamRankChanges<T extends { rank: number; school: string; name: string }>(
  current: readonly T[],
  previous: readonly T[],
): Map<string, RankChange> {
  const changes = buildRankChanges(current, previous, teamRankChangeKey)
  const debaterRank = new Map<string, number>()
  for (const row of previous) {
    const school = normalize(row.school)
    for (const surname of surnames(row.name)) {
      const key = `${school}\u0000${surname}`
      const seen = debaterRank.get(key)
      if (seen === undefined || row.rank < seen) debaterRank.set(key, row.rank)
    }
  }
  for (const row of current) {
    const key = teamRankChangeKey(row)
    if (changes.get(key) !== null) continue
    const school = normalize(row.school)
    const ranks = [...new Set(surnames(row.name))]
      .map((surname) => debaterRank.get(`${school}\u0000${surname}`))
      .filter((rank): rank is number => rank !== undefined)
    if (ranks.length === 0) continue
    const priorRank = Math.round(ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length)
    changes.set(key, priorRank - row.rank)
  }
  return changes
}

/**
 * Text for a rank change: `"+8"`, `"-4"`, `"0"` or `"new"`.
 *
 * @param change - From {@link buildRankChanges}.
 */
export function formatRankChange(change: RankChange): string {
  if (change === null) return "new"
  if (change > 0) return `+${change}`
  return String(change)
}

/** Tooltip text for the change column header. */
export const RANK_CHANGE_TOOLTIP =
  "Places moved since last season's rankings: +8 moved up eight places, -4 dropped four. \"new\" was not ranked last season."

/** Tooltip text for the team tables' change column, which credits re-paired debaters' past ranks. */
export const TEAM_RANK_CHANGE_TOOLTIP =
  "Places moved since last season's rankings: +8 moved up eight places, -4 dropped four. A team with a new partner is compared with the average of its debaters' best ranks last season (matched by last name and school). \"new\" means neither debater was ranked last season."
