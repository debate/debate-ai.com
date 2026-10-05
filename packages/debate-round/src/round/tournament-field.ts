/**
 * @fileoverview Live tournament data for the Create New Round dialog, read
 * through `@debate/tournaments`' API client: the tournaments running now or
 * coming up (the tournament field's suggestions), and the field of a picked
 * tournament in the round's format (its schools lead the school dropdown,
 * its entries become the team badges).
 *
 * Fetches go to `/api/tabroom-beta`, the app's read-only proxy to live
 * Tabroom. Every loader resolves to an empty result on failure so the dialog
 * falls back to its static lists.
 * @module round/tournament-field
 */

import {
  createTournamentsClient,
  type FieldEntry,
  type InviteEvent,
  type UpcomingTournament,
} from "@debate/tournaments/client"
import { schoolMatchScore } from "@debate/rankings-adapter"
import { MIN_SCHOOL_QUERY_LENGTH, stripSchoolState } from "./school-teams"

/** Where the app mounts its live Tabroom proxy. */
export const TABROOM_API_BASE = "/api/tabroom-beta"

/** At most this many events per format are read (e.g. VLD, JVLD, NLD). */
const MAX_EVENTS_PER_FORMAT = 3

/** A tournament's entries in one format, and the schools they come from. */
export interface TournamentField {
  /** School names, in the order their first entry appears. */
  schools: string[]
  /** Entries of the format's events, varsity events first. */
  entries: FieldEntry[]
}

const EMPTY_FIELD: TournamentField = { schools: [], entries: [] }

/** Event matchers per debate style, tested on an event's abbreviation and name. */
const EVENT_MATCHERS: Partial<Record<string, (abbr: string, name: string) => boolean>> = {
  lincolnDouglas: (abbr, name) => /LD$/i.test(abbr) || /lincoln/i.test(name),
  collegeLD: (abbr, name) => /LD$/i.test(abbr) || /lincoln/i.test(name),
  policy: (abbr, name) => /(CX|POL)$/i.test(abbr) || /policy/i.test(name),
  collegePolicy: (abbr, name) => /(CX|POL)$/i.test(abbr) || /policy/i.test(name),
  publicForum: (abbr, name) => /PF$/i.test(abbr) || /public forum/i.test(name),
  worldSchools: (abbr, name) => /WS(DC)?$/i.test(abbr) || /world/i.test(name),
  parlimentary: (abbr, name) => /PAR$/i.test(abbr) || /parli/i.test(name),
  bigQuestions: (abbr, name) => /BQ$/i.test(abbr) || /big questions/i.test(name),
}

/** True for novice, JV and middle-school events, which sort after varsity. */
function isSubVarsity(event: InviteEvent): boolean {
  return /^(N|JV|MS)/i.test(event.abbr ?? "") || /novice|\bjv\b|junior varsity|middle school/i.test(event.name ?? "")
}

/**
 * The tournaments worth suggesting at `now`: those running now first (latest
 * start first), then upcoming ones soonest first. Tournaments that list event
 * types but no debate event are left out.
 */
export function currentTournaments(list: readonly UpcomingTournament[], now: Date = new Date()): UpcomingTournament[] {
  const t = now.getTime()
  const live: UpcomingTournament[] = []
  const upcoming: UpcomingTournament[] = []
  for (const tourn of list) {
    if (tourn.eventTypes && !/debate|worlds/i.test(tourn.eventTypes)) continue
    const start = Date.parse(tourn.start)
    const end = Date.parse(tourn.end)
    if (Number.isNaN(start) || Number.isNaN(end) || end < t) continue
    ;(start <= t ? live : upcoming).push(tourn)
  }
  live.sort((a, b) => Date.parse(b.start) - Date.parse(a.start))
  upcoming.sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  return [...live, ...upcoming]
}

/** The events of `events` that run `styleKey`'s format, varsity first. */
export function eventsForStyle(events: readonly InviteEvent[], styleKey: string): InviteEvent[] {
  const matches = EVENT_MATCHERS[styleKey]
  if (!matches) return []
  return events
    .filter((e) => matches(e.abbr ?? "", e.name ?? ""))
    .sort((a, b) => Number(isSubVarsity(a)) - Number(isSubVarsity(b)))
}

/** Unique school names of `entries`, in order of first appearance. */
export function fieldSchools(entries: readonly FieldEntry[]): string[] {
  const seen = new Set<string>()
  const schools: string[] = []
  for (const entry of entries) {
    const name = entry.School?.name?.trim()
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase())
      schools.push(name)
    }
  }
  return schools
}

/**
 * The entries of `field` from the school closest to `school`, in field order.
 * Only the best-matching school name is kept, as in `findSchoolTeams`.
 */
export function findFieldTeams(entries: readonly FieldEntry[], school: string, limit = 5): FieldEntry[] {
  const name = stripSchoolState(school)
  if (name.length < MIN_SCHOOL_QUERY_LENGTH) return []
  let bestScore = 0
  let matches: FieldEntry[] = []
  for (const entry of entries) {
    const score = entry.School?.name ? schoolMatchScore(name, entry.School.name) : 0
    if (score === 0 || score < bestScore) continue
    if (score > bestScore) {
      bestScore = score
      matches = []
    }
    matches.push(entry)
  }
  return matches.slice(0, limit)
}

/**
 * `schools` ahead of `others`, without duplicates, keeping only those that
 * contain `query` (all of `schools` when the query is empty).
 */
export function mergeSchoolOptions(schools: readonly string[], others: readonly string[], query: string, limit: number): string[] {
  const q = query.trim().toLowerCase()
  const seen = new Set<string>()
  const out: string[] = []
  const add = (s: string) => {
    const key = stripSchoolState(s).toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(s)
  }
  for (const s of schools) if (!q || s.toLowerCase().includes(q)) add(s)
  for (const s of others) add(s)
  return out.slice(0, limit)
}

const client = createTournamentsClient(TABROOM_API_BASE)
let upcomingPromise: Promise<UpcomingTournament[]> | null = null
const fieldCache = new Map<string, Promise<TournamentField>>()

/** Tabroom's upcoming list (which includes tournaments running now), fetched once. */
export function loadUpcomingTournaments(): Promise<UpcomingTournament[]> {
  if (!upcomingPromise) {
    upcomingPromise = client.upcoming().catch((error: unknown) => {
      console.error("Unable to load current tournaments:", error)
      upcomingPromise = null
      return []
    })
  }
  return upcomingPromise
}

/** Names of current tournaments containing `query`, running ones first. */
export async function searchCurrentTournaments(query = "", limit = 10): Promise<string[]> {
  const q = query.trim().toLowerCase()
  const names = currentTournaments(await loadUpcomingTournaments()).map((t) => t.name)
  return [...new Set(q ? names.filter((n) => n.toLowerCase().includes(q)) : names)].slice(0, limit)
}

/** The current tournament named exactly `name` (case-insensitive), if any. */
export async function findCurrentTournament(name: string): Promise<UpcomingTournament | null> {
  const wanted = name.trim().toLowerCase()
  if (!wanted) return null
  const list = currentTournaments(await loadUpcomingTournaments())
  return list.find((t) => t.name.trim().toLowerCase() === wanted) ?? null
}

/**
 * The entries and schools of `tournId` in `styleKey`'s format. Empty when the
 * format has no event there or the tournament does not publish its field.
 */
export function loadTournamentField(tournId: number, styleKey: string): Promise<TournamentField> {
  const key = `${tournId}:${styleKey}`
  let pending = fieldCache.get(key)
  if (!pending) {
    pending = (async () => {
      const invite = await client.invite(tournId)
      const events = eventsForStyle(invite.Events ?? [], styleKey).slice(0, MAX_EVENTS_PER_FORMAT)
      const fields = await Promise.allSettled(events.map((e) => client.field(tournId, e.abbr)))
      const entries = fields.flatMap((r) => (r.status === "fulfilled" ? (r.value.Entries ?? []) : []))
      return { schools: fieldSchools(entries), entries }
    })().catch((error: unknown) => {
      console.error("Unable to load tournament field:", error)
      fieldCache.delete(key)
      return EMPTY_FIELD
    })
    fieldCache.set(key, pending)
  }
  return pending
}

/** The field of the current tournament named `tournamentName`, or an empty one. */
export async function loadFieldForTournamentName(tournamentName: string, styleKey: string): Promise<TournamentField> {
  const tourn = await findCurrentTournament(tournamentName)
  return tourn ? loadTournamentField(tourn.tournId, styleKey) : EMPTY_FIELD
}
