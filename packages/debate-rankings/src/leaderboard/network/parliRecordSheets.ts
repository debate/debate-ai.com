/**
 * @fileoverview "Who debated whom" record sheets for the top Parli teams: for
 * each ranked NPDL team, every round it debated on Tabroom (opponent, side,
 * tournament and round, judging panel, result where known) and an overall W-L.
 *
 * The NPDL publishes points per team, not pairings, so the rounds come from
 * the Tabroom sync (`sync/parli-tabroom-rounds.ts`, snapshot in
 * `data/npdl-tabroom-rounds.json`). Tabroom names a team by an entry *code*
 * (school plus the debaters' last-name initials, `"Nueva AW"`), while the
 * rankings name it by school and last names, so teams are matched by school
 * and initials; a code that two ranked teams could both own is left unmatched
 * rather than guessed.
 *
 * React-free and type-only imports from the sync module, so the browser never
 * pulls in its HTML parser.
 * @module @debate-ai/rankings/leaderboard/network/parliRecordSheets
 */

import type { NpdlRankingRow } from "../../sync/sync-npdl-rankings"
import type { ParliRoundsSeason } from "../../sync/parli-tabroom-rounds"

/** Teams that get a record sheet by default: the Parli table's preview. */
export const PARLI_SHEET_LIMIT = 25

/** Which side a team debated on. */
export type ParliSide = "Gov" | "Opp"

/** One round of a team's record sheet. */
export interface ParliSheetRound {
  tournamentId: string
  tournament: string
  /** `YYYY-MM-DD`, or `null` when the tournament's date was unreadable. */
  date: string | null
  event: string
  roundId: string
  /** `"Round 3"`, `"Quarters"`. */
  round: string
  elim: boolean
  side: ParliSide
  /** Opponent's Tabroom entry code. */
  opponentCode: string
  /** The opponent's ranking row when it is a ranked team. */
  opponent: NpdlRankingRow | null
  judges: string[]
  /** `W` / `L`, or `null` when the round's result is not public. */
  result: "W" | "L" | null
  /** Ballots for the winner and loser (`"2-1"`), when ballots were read. */
  votes?: string
  /** `ballots`: read from Tabroom's ballots; `advancement`: inferred from the next elimination round. */
  resultSource?: "ballots" | "advancement"
}

/** One team's sheet. */
export interface ParliRecordSheet {
  team: NpdlRankingRow
  /** Tabroom entry codes this team was matched to (one per tournament spelling). */
  codes: string[]
  rounds: ParliSheetRound[]
  wins: number
  losses: number
  /** Rounds whose result Tabroom does not make public. */
  unknown: number
}

/** Everything the card shows. */
export interface ParliRecordSheets {
  season: string
  sheets: ParliRecordSheet[]
  /** Top teams with no Tabroom rounds matched (no tournament synced, or a code that could not be told apart). */
  unmatched: NpdlRankingRow[]
  /** Tournaments and pairings the sheets draw on, for the source note. */
  tournaments: number
  pairings: number
  /** Whether every round of the data carries a result (a Tabroom login was used). */
  fullResults: boolean
  fetchedAt: string
}

/** First letter of a debater's last name: `"T. Greenleaf"` → `G`, `"Bollin-Small"` → `B`. */
function lastInitials(name: string): string[] {
  const words = name
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/gi, "")
    .split(/\s+/)
    .filter(Boolean)
  const last = words.at(-1) ?? ""
  const parts = last.split("-").filter(Boolean)
  const letters = [parts[0]?.[0], parts.at(-1)?.[0]].filter((c): c is string => !!c && /[a-z]/i.test(c))
  return [...new Set(letters.map((c) => c.toUpperCase()))]
}

/** The code suffixes a ranked team's debaters could produce, in either order. */
function initialSuffixes(row: Pick<NpdlRankingRow, "debater1" | "debater2">): { any: Set<string>; ordered: Set<string> } {
  const first = lastInitials(row.debater1 ?? "")
  const second = lastInitials(row.debater2 ?? "")
  const any = new Set<string>()
  const ordered = new Set<string>()
  for (const a of first) {
    for (const b of second) {
      ordered.add(`${a}${b}`)
      any.add(`${a}${b}`)
      any.add(`${b}${a}`)
    }
  }
  return { any, ordered }
}

/** A school name with punctuation and filler words dropped, for loose comparison. */
function schoolKey(school: string): string {
  return school
    .toLowerCase()
    .replace(/\b(independent|indepen|indep|high school|hs|academy|school|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "")
}

/**
 * `"Nueva AW"` → school `Nueva`, initials `AW`; `"Nueva Asudani & Wee"` →
 * the same initials plus the last names. `null` when the code has neither.
 */
export function splitEntryCode(code: string): { school: string; initials: string; lastNames?: [string, string] } | null {
  const trimmed = code.trim()
  const full = trimmed.match(/^(.*\S)\s+(\S+)\s*&\s*(\S+)$/)
  if (full) {
    const [, school, a, b] = full
    return { school, initials: `${a[0]}${b[0]}`.toUpperCase(), lastNames: [a, b] }
  }
  const m = trimmed.match(/^(.*\S)\s+([A-Z]{2,3})$/)
  return m ? { school: m[1], initials: m[2] } : null
}

/** Whether a code that spells out both last names is this ranked team, whatever school the entry listed. */
function lastNamesMatch(row: Pick<NpdlRankingRow, "debater1" | "debater2">, names: [string, string]): boolean {
  const last = (name: string | null) => (name ?? "").trim().split(/\s+/).at(-1)?.toLowerCase() ?? ""
  const [a, b] = [last(row.debater1), last(row.debater2)]
  const [x, y] = names.map((n) => n.toLowerCase())
  return !!a && !!b && ((a === x && b === y) || (a === y && b === x))
}

/** Whether a ranked team's school and a code's school name the same program. */
function schoolMatches(rankSchool: string, codeSchool: string): boolean {
  const independent = /\bindep/i
  if (independent.test(rankSchool)) return independent.test(codeSchool) || schoolKey(codeSchool) === ""
  const a = schoolKey(rankSchool)
  const b = schoolKey(codeSchool)
  if (!a || !b) return false
  if (a === b) return true
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  return short.length >= 4 && long.startsWith(short)
}

/**
 * Maps each Tabroom entry code to the ranked team it belongs to. A code that
 * fits two ranked teams goes to the one whose debaters' order spells it
 * exactly, if only one does, and to nobody otherwise.
 */
export function matchEntryCodes(rows: readonly NpdlRankingRow[], codes: Iterable<string>): Map<string, NpdlRankingRow> {
  const suffixes = rows.map((row) => initialSuffixes(row))
  const out = new Map<string, NpdlRankingRow>()
  for (const code of new Set(codes)) {
    const parts = splitEntryCode(code)
    if (!parts) continue
    const hits: number[] = []
    rows.forEach((row, i) => {
      if (parts.lastNames && lastNamesMatch(row, parts.lastNames)) hits.push(i)
      else if (suffixes[i].any.has(parts.initials) && schoolMatches(row.school, parts.school)) hits.push(i)
    })
    if (hits.length === 1) out.set(code, rows[hits[0]])
    else if (hits.length > 1) {
      const exact = hits.filter((i) => suffixes[i].ordered.has(parts.initials))
      if (exact.length === 1) out.set(code, rows[exact[0]])
    }
  }
  return out
}

/** `"Nueva Asudani & Wee"`: how a ranked team is named in a table. */
export function parliTeamLabel(row: Pick<NpdlRankingRow, "school" | "debater1" | "debater2">): string {
  const debaters = [row.debater1, row.debater2].filter(Boolean).join(" & ")
  return debaters ? `${row.school} ${debaters}` : row.school
}

/** A stable id for a ranked team (rank, school, debaters), for in-page links. */
export function parliTeamId(row: Pick<NpdlRankingRow, "rank" | "school" | "debater1" | "debater2">): string {
  return `parli-sheet-${row.rank}-${`${row.school}-${row.debater1 ?? ""}-${row.debater2 ?? ""}`.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`.replace(/-+$/, "")
}

/**
 * Builds the record sheets of the `limit` best-ranked teams from a season's
 * rankings and its synced Tabroom rounds. Rounds appear oldest first.
 */
export function buildParliRecordSheets(
  rows: readonly NpdlRankingRow[],
  data: ParliRoundsSeason,
  limit = PARLI_SHEET_LIMIT,
): ParliRecordSheets {
  const ranked = [...rows].sort((a, b) => a.rank - b.rank)
  const allCodes: string[] = []
  for (const t of data.tournaments) for (const e of t.events) for (const r of e.rounds) for (const p of r.pairings) allCodes.push(p.gov, p.opp)
  const owner = matchEntryCodes(ranked, allCodes)

  const top = ranked.slice(0, limit)
  const sheets = new Map<NpdlRankingRow, ParliRecordSheet>(
    top.map((team) => [team, { team, codes: [], rounds: [], wins: 0, losses: 0, unknown: 0 }]),
  )
  let pairings = 0
  for (const t of data.tournaments) {
    for (const e of t.events) {
      for (const r of e.rounds) {
        for (const p of r.pairings) {
          pairings++
          for (const side of ["gov", "opp"] as const) {
            const code = side === "gov" ? p.gov : p.opp
            const opponentCode = side === "gov" ? p.opp : p.gov
            const team = owner.get(code)
            const sheet = team ? sheets.get(team) : undefined
            if (!sheet) continue
            if (!sheet.codes.includes(code)) sheet.codes.push(code)
            const result = p.winner ? (p.winner === side ? "W" : "L") : null
            sheet.rounds.push({
              tournamentId: t.id,
              tournament: t.name,
              date: t.start,
              event: e.name,
              roundId: r.id,
              round: r.label,
              elim: r.elim,
              side: side === "gov" ? "Gov" : "Opp",
              opponentCode,
              opponent: owner.get(opponentCode) ?? null,
              judges: p.judges,
              result,
              ...(p.votes ? { votes: p.votes } : {}),
              ...(p.resultSource ? { resultSource: p.resultSource } : {}),
            })
            if (result === "W") sheet.wins++
            else if (result === "L") sheet.losses++
            else sheet.unknown++
          }
        }
      }
    }
  }
  for (const sheet of sheets.values()) {
    // Stable sort keeps a tournament's rounds in Tabroom's order within a date.
    sheet.rounds.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
  }
  const all = [...sheets.values()]
  return {
    season: data.season,
    sheets: all.filter((s) => s.rounds.length > 0),
    unmatched: all.filter((s) => s.rounds.length === 0).map((s) => s.team),
    tournaments: data.tournaments.length,
    pairings,
    fullResults: data.results === "ballots",
    fetchedAt: data.fetchedAt,
  }
}
