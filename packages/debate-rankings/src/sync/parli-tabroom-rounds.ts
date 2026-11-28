/**
 * @fileoverview Parli round pairings from Tabroom, for the "Who debated whom"
 * record sheets on the Parli rankings tab.
 *
 * The NPDL publishes points per team and nothing behind them, but the league's
 * sanctioned tournaments run on Tabroom (circuit 179), so the rounds are read
 * from there:
 *
 * - **Public pages, no login** (what the sync always reads): the circuit's
 *   calendar, each tournament's pairings index (its events and rounds) and
 *   each round's posting (room, Gov, Opp, judging panel). Tabroom puts every
 *   page that carries a *result* (round results, brackets, entry records)
 *   behind a login, so these rounds have sides and judges but no winner.
 * - **Elimination advancement** (inferred, no login): a team that reaches the
 *   next elimination round of its event beat the team it faced in this one, as
 *   long as exactly one of the two is in that next round.
 * - **Ballots** (only with `TABROOM_API_KEY`, the same session the video
 *   results lookup uses): `GET /v1/rest/tourns/:id/rounds` and
 *   `GET /v1/pages/invite/:id/:event/:round/results` give each judge's vote,
 *   which fills in every round's winner and its ballot count.
 *
 * Runtime-agnostic (global `fetch` and `linkedom` only), so the same code
 * serves the `bun run sync-parli-rounds` CLI that refreshes the bundled
 * `data/npdl-tabroom-rounds.json` snapshot and any Worker that wants it live.
 * @module sync/parli-tabroom-rounds
 */

import { parseHTML } from "linkedom"

/** The NPDL's Tabroom circuit. */
export const NPDL_CIRCUIT_ID = 179

/** Tabroom's site root. */
export const TABROOM_SITE = "https://www.tabroom.com"

/** Tabroom's JSON API root (needs a signed-in session). */
export const TABROOM_API = "https://api.tabroom.com/v1"

/** Generic client name, as the other rankings scrapers send. */
export const TABROOM_USER_AGENT = "Mozilla/5.0 (compatible; rankings-sync/1.0)"

/** How a round's winner was learned. */
export type ParliResultSource = "ballots" | "advancement"

/** One debate: two teams by Tabroom entry code, and what is known of its result. */
export interface ParliPairing {
  /** Government team's Tabroom entry code, e.g. `"Nueva AW"` (school plus last-name initials). */
  gov: string
  /** Opposition team's entry code. */
  opp: string
  room?: string
  /** Judging panel, as "First Last". */
  judges: string[]
  /** Who won, when known. */
  winner?: "gov" | "opp"
  /** Ballots for the winner and the loser (`"2-1"`), when ballots were read. */
  votes?: string
  resultSource?: ParliResultSource
}

/** One round of one event. */
export interface ParliRound {
  /** Tabroom round id. */
  id: string
  /** `"Round 3"`, `"Quarters"`. */
  label: string
  elim: boolean
  pairings: ParliPairing[]
}

/** A varsity parli event of a tournament. */
export interface ParliEvent {
  /** Tabroom event id. */
  id: string
  /** `"Open Parli"`. */
  name: string
  /** Rounds in Tabroom's order: prelims, then elims. */
  rounds: ParliRound[]
}

/** One sanctioned tournament. */
export interface ParliTournament {
  /** Tabroom tournament id. */
  id: string
  name: string
  /** `YYYY-MM-DD`; `null` when the calendar's dates could not be read. */
  start: string | null
  end: string | null
  location: string
  events: ParliEvent[]
}

/** A season's synced rounds: the shape of one entry of `data/npdl-tabroom-rounds.json`. */
export interface ParliRoundsSeason {
  /** `"2026-27"`, as the NPDL rankings name seasons. */
  season: string
  circuitId: number
  /** ISO time of the sync. */
  fetchedAt: string
  /** What the winners came from: `ballots` when a Tabroom login was used, else public pages only. */
  results: "ballots" | "public"
  /** Tournaments of the season that had parli pairings posted, oldest first. */
  tournaments: ParliTournament[]
  /** Calendar tournaments that were skipped, with the reason (no parli event, not run yet, ...). */
  skipped: { id: string; name: string; reason: string }[]
}

/** A tournament row of the circuit calendar. */
export interface CalendarTournament {
  id: string
  name: string
  location: string
  start: string | null
  end: string | null
  /** Event abbreviations the calendar lists. */
  events: string[]
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

const iso = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`

/**
 * Start and end of a calendar date cell: `"Sat Nov 14–15, 2026"`,
 * `"Fri Oct 30–Nov 1, 2026"`, `"Sat Sep 26, 2026"`.
 */
export function parseCalendarDates(text: string): { start: string | null; end: string | null } {
  const m = text.replace(/\s+/g, " ").match(/([A-Za-z]{3})[a-z]*\.? (\d{1,2})(?:\s*[–—-]\s*(?:([A-Za-z]{3})[a-z]*\.? )?(\d{1,2}))?,? (\d{4})/)
  if (!m) return { start: null, end: null }
  const startMonth = MONTHS[m[1].toLowerCase()]
  if (!startMonth) return { start: null, end: null }
  const year = Number(m[5])
  const start = iso(year, startMonth, Number(m[2]))
  if (!m[4]) return { start, end: start }
  const endMonth = m[3] ? MONTHS[m[3].toLowerCase()] ?? startMonth : startMonth
  // A range that crosses New Year ends in the next year.
  const endYear = endMonth < startMonth ? year + 1 : year
  return { start, end: iso(endYear, endMonth, Number(m[4])) }
}

const text = (node: Element | null | undefined) => (node?.textContent ?? "").replace(/\s+/g, " ").trim()

/** `"2026-2027 Calendar"` → `"2026-27"`. */
export function seasonFromCalendarHeading(heading: string): string | null {
  const m = heading.match(/(\d{4})\s*[-–]\s*(\d{4})/)
  return m ? `${m[1]}-${m[2].slice(2)}` : null
}

/** Reads the circuit calendar page (`index/circuit/calendar.mhtml?circuit_id=179`). */
export function parseCircuitCalendar(html: string): { season: string | null; tournaments: CalendarTournament[] } {
  const { document } = parseHTML(html)
  const season = seasonFromCalendarHeading([...document.querySelectorAll("h4")].map(text).find((t) => /calendar/i.test(t)) ?? "")
  const tournaments: CalendarTournament[] = []
  for (const row of document.querySelectorAll("tr")) {
    const link = row.querySelector('a[href*="tourn_id="]')
    const id = link?.getAttribute("href")?.match(/tourn_id=(\d+)/)?.[1]
    if (!link || !id) continue
    const cells = [...row.querySelectorAll("td")].map(text)
    const name = text(link)
    const dates = parseCalendarDates(cells[2] ?? "")
    tournaments.push({
      id,
      name,
      location: cells[1] ?? "",
      ...dates,
      events: (cells[3] ?? "").split(",").map((e) => e.trim()).filter(Boolean),
    })
  }
  return { season, tournaments }
}

/**
 * Whether an event is a varsity-level (NPDL points) parli event: it says
 * parli, and is not a novice, JV, middle school or college division.
 */
export function isVarsityParliEvent(name: string): boolean {
  if (!/\b(parli|parliamentary|npdl)\b|\bpd\b/i.test(name)) return false
  return !/\b(novice|nov|jv|junior|middle|ms|college|collegiate|beginner|rookie)\b/i.test(name)
}

/** Where an elimination round sits in its bracket. */
export interface ElimStage {
  /** Rounds before the final: Finals 0, Semis 1, Quarters 2, Octos 3, Doubles 4, Triples 5. */
  fromFinal: number
  /** Brackets that run side by side in one event: `"n"` for a novice bracket, `"v"` otherwise. */
  track: "n" | "v"
}

/**
 * The stage and bracket of an elimination round label, or `null` for a
 * prelim. Tabroom labels vary by tournament: `Quarters`, `Quarterfinals`,
 * `Quar`, `Open Octos`, and the NYPDL's `NQ` / `VS` / `OF` (a letter for the
 * bracket, one for the stage). `O1` is a prelim, not octos.
 */
export function elimStage(label: string): ElimStage | null {
  const l = label.trim().toLowerCase()
  const track = /^(n|nov)(ice)?\b|^n[oqsf]$/.test(l) ? "n" : "v"
  const stage = (fromFinal: number): ElimStage => ({ fromFinal, track })
  if (/triple/.test(l)) return stage(5)
  if (/double/.test(l)) return stage(4)
  if (/octo|octa/.test(l) || /^[vno]o$/.test(l)) return stage(3)
  if (/quar/.test(l) || /^[vno]q$/.test(l)) return stage(2)
  if (/semi/.test(l) || /^[vno]s$/.test(l)) return stage(1)
  if (/final/.test(l) || /^[vno]f$/.test(l)) return stage(0)
  return null
}

/** Whether a round label names an elimination round. */
export const isElimLabel = (label: string): boolean => elimStage(label) !== null

/** A round listed on a tournament's pairings index. */
export interface PostingRound {
  id: string
  label: string
}

/** An event listed on a tournament's pairings index. */
export interface PostingEvent {
  id: string
  name: string
  rounds: PostingRound[]
}

/**
 * Events and rounds from a tournament's pairings index
 * (`index/tourn/postings/index.mhtml`), which redirects to a round and carries
 * the tournament's whole round list in its sidebar.
 */
export function parsePostingsIndex(html: string): PostingEvent[] {
  const { document } = parseHTML(html)
  const events: PostingEvent[] = []
  for (const option of document.querySelectorAll("select#eventSelector option")) {
    const id = option.getAttribute("value")
    const name = text(option)
    if (!id || !name) continue
    const listing = document.getElementById(id)
    const rounds: PostingRound[] = []
    for (const a of listing?.querySelectorAll('a[href*="round_id="]') ?? []) {
      const roundId = a.getAttribute("href")?.match(/round_id=(\d+)/)?.[1]
      if (!roundId) continue
      // The link text is the event abbreviation, then the round's name, on separate lines.
      const lines = (a.textContent ?? "").split("\n").map((l) => l.trim()).filter(Boolean)
      const label = (lines.length > 1 ? lines.slice(1).join(" ") : lines[0] ?? "").trim()
      if (label) rounds.push({ id: roundId, label })
    }
    events.push({ id, name, rounds })
  }
  return events
}

/** Which side a pairing cell's note names, if any (`"Locked Gov"`, `"Opp"`, `"Aff"`). */
function sideNote(cell: Element): "gov" | "opp" | null {
  const note = [...cell.querySelectorAll("div")].map(text).join(" ")
  if (/\b(gov|government|aff|affirmative|pro)\b/i.test(note)) return "gov"
  if (/\b(opp|opposition|neg|negative|con)\b/i.test(note)) return "opp"
  return null
}

/**
 * One round's posting (`index/tourn/postings/round.mhtml`): a row per room
 * with the two teams and the judging panel. Rooms with fewer than two teams
 * (byes) are dropped. The first team is Gov unless its cell says Opp.
 */
export function parsePairings(html: string): ParliPairing[] {
  const { document } = parseHTML(html)
  const table = [...document.querySelectorAll("table")].find((t) => t.querySelector('a[href*="entry_id="]'))
  if (!table) return []
  const pairings: ParliPairing[] = []
  for (const row of table.querySelectorAll("tbody tr")) {
    const cells = [...row.querySelectorAll("td")]
    const teams = cells
      .map((cell) => ({ cell, code: text(cell.querySelector('a[href*="entry_id="]')) }))
      .filter((t) => t.code)
    if (teams.length < 2) continue
    let [first, second] = teams
    if (sideNote(first.cell) === "opp" || sideNote(second.cell) === "gov") [first, second] = [second, first]
    const room = text(cells[0]).replace(/^none$/i, "")
    const judgeCell = cells.find((cell) => cell.querySelector('a[href*="judge_id="]'))
    const judges = [...(judgeCell?.querySelectorAll('a[href*="judge_id="]') ?? [])].map((a) => judgeName(text(a)))
    pairings.push({ gov: first.code, opp: second.code, ...(room ? { room } : {}), judges })
  }
  return pairings
}

/** `"Berg, Zach"` → `"Zach Berg"`. */
export function judgeName(listed: string): string {
  const [last, ...first] = listed.split(",").map((p) => p.trim())
  return first.length ? `${first.join(" ")} ${last}`.trim() : last
}

/**
 * Marks each elimination pairing's winner from who reached the next round of
 * its bracket: exactly one of the two teams there means that team won.
 * Brackets (varsity and novice can share an event) and stages come from
 * {@link elimStage}; only a round whose next stage is present is read. Leaves
 * the final and any ambiguous pairing alone, and never overrides a winner read
 * from ballots. Returns how many it filled in.
 */
export function inferAdvancementResults(rounds: ParliRound[]): number {
  let filled = 0
  for (const round of rounds) {
    const stage = elimStage(round.label)
    if (!stage || stage.fromFinal === 0) continue
    const nextRound = rounds.find((r) => {
      const s = elimStage(r.label)
      return s && s.track === stage.track && s.fromFinal === stage.fromFinal - 1
    })
    if (!nextRound) continue
    const next = new Set(nextRound.pairings.flatMap((p) => [p.gov, p.opp]))
    for (const pairing of round.pairings) {
      if (pairing.winner) continue
      const govNext = next.has(pairing.gov)
      const oppNext = next.has(pairing.opp)
      if (govNext === oppNext) continue
      pairing.winner = govNext ? "gov" : "opp"
      pairing.resultSource = "advancement"
      filled++
    }
  }
  return filled
}

// ---------------------------------------------------------------------------
// Ballots (Tabroom login required)
// ---------------------------------------------------------------------------

/** A row of `GET /rest/tourns/:id/rounds`. */
export interface ApiRound {
  id: number
  name: number
  label?: string | null
  Event: { id: number; abbr?: string | null; name?: string | null }
}

/** `GET /pages/invite/:id/:event/:round/results`, as far as it is read. */
export interface ApiRoundResults {
  Event?: { Settings?: { affLabel?: string; negLabel?: string } }
  Sections?: Record<
    string,
    {
      bye?: number
      Judges?: Record<string, unknown>
      Entries?: Record<
        string,
        { code?: string; side?: number | string; Ballots?: Record<string, { winloss?: string | null }> }
      >
    }
  >
}

/** 1 / "Gov" / "Aff" → gov; 2 / "Opp" / "Neg" → opp. */
function apiSide(side: number | string | undefined): "gov" | "opp" | null {
  if (side === 1 || side === "1") return "gov"
  if (side === 2 || side === "2") return "opp"
  const s = String(side ?? "").trim().toLowerCase()
  if (["gov", "government", "aff", "affirmative", "pro"].includes(s)) return "gov"
  if (["opp", "opposition", "neg", "negative", "con"].includes(s)) return "opp"
  return null
}

/**
 * Applies a round's ballots to its pairings, matched by entry code: the side
 * with more judges' W votes wins; a tie or no ballots leaves the pairing
 * alone. Returns how many pairings got a winner.
 */
export function applyBallotResults(round: ParliRound, results: ApiRoundResults): number {
  let filled = 0
  for (const section of Object.values(results.Sections ?? {})) {
    if (section.bye) continue
    const entries = Object.values(section.Entries ?? {})
    const gov = entries.find((e) => apiSide(e.side) === "gov")
    const opp = entries.find((e) => apiSide(e.side) === "opp")
    if (!gov?.code || !opp?.code) continue
    const pairing = round.pairings.find((p) => p.gov === gov.code && p.opp === opp.code)
    if (!pairing) continue
    let govVotes = 0
    let oppVotes = 0
    const judgeIds = new Set([...Object.keys(gov.Ballots ?? {}), ...Object.keys(opp.Ballots ?? {})])
    for (const id of judgeIds) {
      const g = gov.Ballots?.[id]?.winloss?.toUpperCase()
      const o = opp.Ballots?.[id]?.winloss?.toUpperCase()
      const govWon = g === "W" || o === "L"
      const oppWon = o === "W" || g === "L"
      if (govWon === oppWon) continue
      if (govWon) govVotes++
      else oppVotes++
    }
    if (govVotes === oppVotes) continue
    pairing.winner = govVotes > oppVotes ? "gov" : "opp"
    pairing.votes = `${Math.max(govVotes, oppVotes)}-${Math.min(govVotes, oppVotes)}`
    pairing.resultSource = "ballots"
    filled++
  }
  return filled
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

/** Options of {@link fetchParliRoundsSeason}. */
export interface FetchParliOptions {
  fetchImpl?: typeof fetch
  /** `TabroomToken` cookie (`getTabroomCookie()`); with it, ballots are read too. */
  cookie?: string
  /** Today, to skip tournaments that have not started (default: now). */
  now?: Date
  /** Pause between requests in ms (default 400). */
  delayMs?: number
  /** Called with progress lines. */
  log?: (line: string) => void
  /** Sync only these tournament ids (default: every started tournament of the calendar). */
  only?: readonly string[]
}

async function getText(url: string, opts: FetchParliOptions, headers: Record<string, string> = {}): Promise<string> {
  const fetchImpl = opts.fetchImpl ?? fetch
  let last: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetchImpl(url, {
        headers: { "User-Agent": TABROOM_USER_AGENT, "Accept-Language": "en-US,en;q=0.9", ...headers },
        signal: AbortSignal.timeout(45_000),
        redirect: "follow",
      })
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} for ${url}`)
        if (![429, 500, 502, 503, 504].includes(res.status)) throw Object.assign(err, { final: true })
        throw err
      }
      const body = await res.text()
      // A login wall is a 200 page titled "Login to Tabroom" after a redirect.
      if (/user\/login\/login\.mhtml/.test(res.url ?? "")) throw Object.assign(new Error(`login required for ${url}`), { final: true })
      return body
    } catch (err) {
      last = err
      if ((err as { final?: boolean }).final || attempt === 2) break
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
    }
  }
  throw last instanceof Error ? last : new Error(String(last))
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** URL of a tournament's public pairings index. */
export const postingsIndexUrl = (tournId: string) => `${TABROOM_SITE}/index/tourn/postings/index.mhtml?tourn_id=${tournId}`

/** URL of a round's public pairing page. */
export const roundPostingUrl = (tournId: string, roundId: string) =>
  `${TABROOM_SITE}/index/tourn/postings/round.mhtml?tourn_id=${tournId}&round_id=${roundId}`

/**
 * Syncs the circuit's current season: the calendar, then for each started
 * tournament its varsity parli events' round postings. A tournament or round
 * that cannot be read is skipped (and listed in `skipped`) rather than
 * failing the sync.
 */
export async function fetchParliRoundsSeason(opts: FetchParliOptions = {}): Promise<ParliRoundsSeason> {
  const log = opts.log ?? (() => {})
  const delay = opts.delayMs ?? 400
  const now = opts.now ?? new Date()
  const calendarHtml = await getText(`${TABROOM_SITE}/index/circuit/calendar.mhtml?circuit_id=${NPDL_CIRCUIT_ID}`, opts)
  const { season, tournaments: calendar } = parseCircuitCalendar(calendarHtml)
  if (!season) throw new Error("could not read the season from the circuit calendar")
  log(`${season}: ${calendar.length} tournaments on the circuit calendar`)

  const out: ParliRoundsSeason = {
    season,
    circuitId: NPDL_CIRCUIT_ID,
    fetchedAt: now.toISOString(),
    results: opts.cookie ? "ballots" : "public",
    tournaments: [],
    skipped: [],
  }
  const today = now.toISOString().slice(0, 10)
  const skip = (t: CalendarTournament, reason: string) => {
    out.skipped.push({ id: t.id, name: t.name, reason })
    log(`  - ${t.name}: ${reason}`)
  }

  for (const t of [...calendar].sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))) {
    if (opts.only && !opts.only.includes(t.id)) continue
    if (/^cancel/i.test(t.name)) {
      skip(t, "cancelled")
      continue
    }
    if (!t.start || t.start > today) {
      skip(t, "not started")
      continue
    }
    try {
      await sleep(delay)
      const index = parsePostingsIndex(await getText(postingsIndexUrl(t.id), opts))
      const events: ParliEvent[] = []
      for (const event of index.filter((e) => isVarsityParliEvent(e.name))) {
        const rounds: ParliRound[] = []
        for (const round of event.rounds) {
          await sleep(delay)
          let pairings: ParliPairing[] = []
          try {
            pairings = parsePairings(await getText(roundPostingUrl(t.id, round.id), opts))
          } catch (err) {
            log(`    ! ${t.name} / ${event.name} / ${round.label}: ${(err as Error).message}`)
          }
          if (pairings.length) rounds.push({ id: round.id, label: round.label, elim: isElimLabel(round.label), pairings })
        }
        if (rounds.length) events.push({ id: event.id, name: event.name, rounds })
      }
      if (!events.length) {
        skip(t, index.length ? "no varsity parli pairings posted" : "no pairings posted")
        continue
      }
      if (opts.cookie) await applyTournamentBallots(t.id, events, opts, delay, log)
      for (const event of events) inferAdvancementResults(event.rounds)
      const pairings = events.reduce((n, e) => n + e.rounds.reduce((m, r) => m + r.pairings.length, 0), 0)
      log(`  + ${t.name}: ${events.map((e) => e.name).join(", ")} (${pairings} pairings)`)
      out.tournaments.push({ id: t.id, name: t.name, start: t.start, end: t.end, location: t.location, events })
    } catch (err) {
      skip(t, `unreadable: ${(err as Error).message}`)
    }
  }
  return out
}

/** Reads each round's ballots from Tabroom's API and applies them. */
async function applyTournamentBallots(
  tournId: string,
  events: ParliEvent[],
  opts: FetchParliOptions,
  delay: number,
  log: (line: string) => void,
): Promise<void> {
  const headers = { Cookie: opts.cookie ?? "", Accept: "application/json" }
  try {
    const apiRounds = JSON.parse(await getText(`${TABROOM_API}/rest/tourns/${tournId}/rounds`, opts, headers)) as ApiRound[]
    for (const event of events) {
      for (const round of event.rounds) {
        const api = apiRounds.find((r) => String(r.id) === round.id)
        if (!api?.Event.abbr) continue
        await sleep(delay)
        const url = `${TABROOM_API}/pages/invite/${tournId}/${encodeURIComponent(api.Event.abbr)}/${encodeURIComponent(String(api.name))}/results`
        try {
          applyBallotResults(round, JSON.parse(await getText(url, opts, headers)) as ApiRoundResults)
        } catch (err) {
          log(`    ! ballots for ${event.name} / ${round.label}: ${(err as Error).message}`)
        }
      }
    }
  } catch (err) {
    log(`    ! ballots for tournament ${tournId}: ${(err as Error).message}`)
  }
}
