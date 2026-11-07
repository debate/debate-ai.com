/**
 * @fileoverview Resolves a ranked team (rankings dataset + school + team name)
 * to its openCaselist team page and shapes the rounds, open-source files and
 * wiki cites for the team profile's "Caselist" section.
 *
 * The scraping itself lives in `@debate-ai/research-evidence`
 * (`caselist/caselist-api.ts`); this file only picks the caselists for the
 * dataset, does the matching and trims the payload for the client.
 *
 * openCaselist answers only signed-in requests, so the route needs either a
 * `CASELIST_TOKEN` (a `caselist_token` cookie value) or `CASELIST_USERNAME` +
 * `CASELIST_PASSWORD` (a Tabroom login) as Worker secrets. Without them the
 * payload says `configured: false` and the profile falls back to the
 * documents already unpacked from the bulk archives.
 */

import {
  type CaselistCite,
  type CaselistClient,
  type CaselistInfo,
  type CaselistRound,
  caselistRoundLabel,
  caselistSideLabel,
  caselistsForFormat,
  matchCaselistSchool,
  matchCaselistTeam,
  openSourceFileName,
  rankedTeamLastNames,
  teamDebaters,
} from "@debate-ai/research-evidence/src/caselist/caselist-api"
import type { CaselistEvent, CaselistLevel } from "@debate-ai/research-evidence/src/caselist/caselist-config"
import { getCloudflareContext } from "@/lib/database/context"

/** The caselist format each rankings dataset is disclosed in. */
export const DATASET_CASELIST_FORMAT: Record<string, { event: CaselistEvent; level: CaselistLevel }> = {
  hspf: { event: "pf", level: "hs" },
  hsld: { event: "ld", level: "hs" },
  hsld_sepoct: { event: "ld", level: "hs" },
  hscx: { event: "policy", level: "hs" },
  cpd: { event: "policy", level: "college" },
}

/** How many seasons back to look for a team page (this season, then last). */
const SEASONS_TO_SEARCH = 2

export interface TeamCaselistFile {
  path: string
  name: string
  /** Our proxy for the download (the API needs a session). */
  url: string
  /** True when an admin sync stored the file (bytes and text) in R2. */
  stored?: boolean
  /** Where the stored document's converted text is read from. */
  textUrl?: string
}

export interface TeamCaselistRound {
  id: number
  side: string
  sideLabel: string
  tournament: string
  round: string
  roundLabel: string
  opponent: string | null
  judge: string | null
  report: string | null
  video: string | null
  file: TeamCaselistFile | null
}

export interface TeamCaselistCite {
  id: number
  roundId: number
  title: string
  cites: string
  side: string
  sideLabel: string
  tournament: string | null
  roundLabel: string
  opponent: string | null
  judge: string | null
  createdAt: string | null
}

/** One season's synced team page (see `team-caselist-sync.ts`). */
export interface TeamCaselistSeason {
  caselist: { name: string; displayName: string; event: string | null; level: string | null; year: number }
  school: { name: string; displayName: string }
  team: { name: string; displayName: string; debaters: string[] }
  pageUrl: string
  syncedAt: number
  rounds: TeamCaselistRound[]
  cites: TeamCaselistCite[]
}

export interface TeamCaselistPayload {
  /** False when no openCaselist session is configured on the server. */
  configured: boolean
  found: boolean
  caselist: { name: string; displayName: string; event: string | null; level: string | null; year: number } | null
  school: { name: string; displayName: string } | null
  team: { name: string; displayName: string; debaters: string[] } | null
  /** The team's page on opencaselist.com. */
  pageUrl: string | null
  rounds: TeamCaselistRound[]
  cites: TeamCaselistCite[]
  /** Set when the lookup failed upstream (e.g. an expired token). */
  error?: string
  /** True when the payload was read from an admin sync rather than live. */
  stored?: boolean
  /** Unix seconds of the newest season's sync. */
  syncedAt?: number
  /** Every synced season, newest first; the top-level fields repeat the first. */
  seasons?: TeamCaselistSeason[]
}

/** openCaselist credentials from the Worker env, falling back to `process.env`. */
export function caselistCredentials(): { token?: string; username?: string; password?: string } | null {
  const env = (getCloudflareContext()?.env ?? {}) as Record<string, unknown>
  const read = (key: string) => {
    const value = env[key] ?? process.env[key]
    return typeof value === "string" && value.trim() ? value.trim() : undefined
  }
  const token = read("CASELIST_TOKEN")
  const username = read("CASELIST_USERNAME")
  const password = read("CASELIST_PASSWORD")
  if (token) return { token }
  if (username && password) return { username, password }
  return null
}

/** The open-source path pattern rounds carry: `<caselist>/<school>/<team>/<file>`. */
const OPEN_SOURCE_PATH = /^[a-z]+\d{2}\/[^/]+\/[^/]+\/[^/]+\.[A-Za-z0-9]{2,5}$/

/** Whether `path` is a caselist open-source path we are willing to proxy. */
export function isOpenSourcePath(path: string): boolean {
  return !path.includes("..") && !path.startsWith("/") && OPEN_SOURCE_PATH.test(path)
}

/** The proxy URL a round's file is downloaded through. */
export function openSourceFileUrl(path: string): string {
  return `/api/caselist-team/file?path=${encodeURIComponent(path)}`
}

export function emptyPayload(configured: boolean, error?: string): TeamCaselistPayload {
  return {
    configured,
    found: false,
    caselist: null,
    school: null,
    team: null,
    pageUrl: null,
    rounds: [],
    cites: [],
    ...(error ? { error } : {}),
  }
}

export function shapeRound(round: CaselistRound, event: string | null): TeamCaselistRound {
  const path = round.opensource && isOpenSourcePath(round.opensource) ? round.opensource : null
  return {
    id: round.round_id,
    side: round.side,
    sideLabel: caselistSideLabel(round.side, event),
    tournament: round.tournament,
    round: round.round,
    roundLabel: caselistRoundLabel(round.round),
    opponent: round.opponent,
    judge: round.judge,
    report: round.report?.trim() || null,
    video: round.video,
    file: path ? { path, name: openSourceFileName(path), url: openSourceFileUrl(path) } : null,
  }
}

export function shapeCite(cite: CaselistCite, rounds: Map<number, CaselistRound>, event: string | null): TeamCaselistCite {
  const round = rounds.get(cite.round_id)
  const side = cite.side ?? round?.side ?? ""
  return {
    id: cite.cite_id,
    roundId: cite.round_id,
    title: cite.title?.trim() || "Untitled",
    cites: cite.cites ?? "",
    side,
    sideLabel: caselistSideLabel(side, event),
    tournament: cite.tournament ?? round?.tournament ?? null,
    roundLabel: caselistRoundLabel(cite.round ?? round?.round),
    opponent: cite.opponent ?? round?.opponent ?? null,
    judge: cite.judge ?? round?.judge ?? null,
    createdAt: cite.created_at ?? null,
  }
}

/** Newest-first rounds: by tournament then round, as openCaselist orders them, reversed by creation. */
function byNewest<T extends { created_at?: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
}

/**
 * Finds a ranked team's caselist page and returns its rounds and cites.
 *
 * Searches this season's caselist for the dataset's format, then last
 * season's, matching the school by name and the team by debater surnames.
 */
export async function lookupTeamCaselist(
  client: CaselistClient,
  query: { dataset: string; school: string; team: string },
): Promise<TeamCaselistPayload> {
  const format = DATASET_CASELIST_FORMAT[query.dataset]
  if (!format) return emptyPayload(true, `Unknown rankings dataset "${query.dataset}"`)

  const all: CaselistInfo[] = await client.caselists({ archived: true })
  const candidates = caselistsForFormat(all, format.event, format.level).slice(0, SEASONS_TO_SEARCH)
  const lastNames = rankedTeamLastNames(query.team)

  for (const caselist of candidates) {
    const school = matchCaselistSchool(await client.schools(caselist.name), query.school)
    if (!school) continue
    const team = matchCaselistTeam(await client.teams(caselist.name, school.name), lastNames)
    if (!team) continue

    const [rounds, cites] = await Promise.all([
      client.rounds(caselist.name, school.name, team.name),
      client.cites(caselist.name, school.name, team.name),
    ])
    const event = caselist.event
    const roundsById = new Map(rounds.map((round) => [round.round_id, round]))
    return {
      configured: true,
      found: true,
      caselist: {
        name: caselist.name,
        displayName: caselist.display_name,
        event: caselist.event,
        level: caselist.level,
        year: caselist.year,
      },
      school: { name: school.name, displayName: school.display_name ?? school.name },
      team: { name: team.name, displayName: team.display_name, debaters: teamDebaters(team) },
      pageUrl: `https://opencaselist.com/${encodeURIComponent(caselist.name)}/${encodeURIComponent(
        school.name,
      )}/${encodeURIComponent(team.name)}`,
      rounds: byNewest(rounds).map((round) => shapeRound(round, event)),
      cites: byNewest(cites)
        .filter((cite) => (cite.cites ?? "").trim() || cite.title)
        .map((cite) => shapeCite(cite, roundsById, event)),
    }
  }
  return emptyPayload(true)
}
