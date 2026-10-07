/**
 * @fileoverview "My team" — which ranked team the viewer debates on, coaches
 * or assists, one per rankings division, plus their partner's name. The
 * matchup simulator pre-fills side A with the division's team from here, so
 * "Simulate vs. this team" on any profile compares the viewer's own team.
 *
 * Saved to `localStorage` for every visitor and mirrored to the account as
 * `/api/settings`' `myRankedTeams` field (column `my_ranked_teams`) when
 * signed in — a whole-value replace, like `myTeamProfile`. This module holds
 * the shape, the validation the route runs, and the client calls.
 * @module lib/my-ranked-teams/my-ranked-teams
 */

import { RANKING_DATASETS, type RankingDatasetId } from "@debate/rankings-adapter"

/** How the viewer relates to the team they picked. */
export type MyTeamRole = "debater" | "coach" | "assistant"

/** Every role, in the order the settings select lists them. */
export const MY_TEAM_ROLES: readonly { id: MyTeamRole; label: string }[] = [
  { id: "debater", label: "I debate on it" },
  { id: "coach", label: "I coach it" },
  { id: "assistant", label: "I assist / judge for it" },
]

/** The viewer's team in each division, and who they debate with. */
export interface MyRankedTeams {
  role: MyTeamRole
  /** Partner's name, free text — blank for LD or when coaching. */
  partner: string
  /** Division → the team's `teamSlug`. A division absent here has no team set. */
  teams: Partial<Record<RankingDatasetId, string>>
}

/** No team anywhere — what a first-time visitor starts with. */
export const EMPTY_MY_RANKED_TEAMS: MyRankedTeams = { role: "debater", partner: "", teams: {} }

const STORAGE_KEY = "myRankedTeams"
/** Same-tab change notice, so an open simulator picks up a settings save. */
export const MY_RANKED_TEAMS_EVENT = "my-ranked-teams-change"
const MAX_TEXT = 160
const DATASET_IDS = new Set<string>(RANKING_DATASETS.map((d) => d.id))
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function isRole(value: unknown): value is MyTeamRole {
  return value === "debater" || value === "coach" || value === "assistant"
}

/**
 * Validates an untrusted value as {@link MyRankedTeams}. Unknown divisions
 * and malformed slugs are errors rather than silently dropped, so a client bug
 * shows up as a 400 instead of a team that never saves.
 */
export function validateMyRankedTeams(raw: unknown): { ok: true; value: MyRankedTeams } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: '"myRankedTeams" must be null or a { role, partner, teams } object.' }
  }
  const record = raw as Record<string, unknown>
  if (!isRole(record.role)) return { ok: false, error: '"myRankedTeams.role" must be "debater", "coach" or "assistant".' }
  if (typeof record.partner !== "string" || record.partner.length > MAX_TEXT) {
    return { ok: false, error: `"myRankedTeams.partner" must be a string of at most ${MAX_TEXT} characters.` }
  }
  const teamsRaw = record.teams
  if (!teamsRaw || typeof teamsRaw !== "object" || Array.isArray(teamsRaw)) {
    return { ok: false, error: '"myRankedTeams.teams" must be an object of division → team slug.' }
  }
  const teams: Partial<Record<RankingDatasetId, string>> = {}
  for (const [id, slug] of Object.entries(teamsRaw as Record<string, unknown>)) {
    if (!DATASET_IDS.has(id)) return { ok: false, error: `"myRankedTeams.teams" has an unknown division "${id}".` }
    if (typeof slug !== "string" || slug.length > MAX_TEXT || !SLUG.test(slug)) {
      return { ok: false, error: `"myRankedTeams.teams.${id}" must be a team slug.` }
    }
    teams[id as RankingDatasetId] = slug
  }
  return { ok: true, value: { role: record.role, partner: record.partner.trim(), teams } }
}

/**
 * The `/api/settings` PUT half: `{ valid: { myRankedTeams } }` when the body
 * names the field (`null` clears it), `{}` when it does not.
 */
export function normalizeMyRankedTeamsPatch(body: unknown): {
  valid: { myRankedTeams?: MyRankedTeams | null }
  errors: string[]
} {
  if (!body || typeof body !== "object" || !("myRankedTeams" in body)) return { valid: {}, errors: [] }
  const raw = (body as Record<string, unknown>).myRankedTeams
  if (raw === null) return { valid: { myRankedTeams: null }, errors: [] }
  const result = validateMyRankedTeams(raw)
  return result.ok ? { valid: { myRankedTeams: result.value }, errors: [] } : { valid: {}, errors: [result.error] }
}

/** Column value for a validated payload. */
export function serializeMyRankedTeams(value: MyRankedTeams | null): string | null {
  return value ? JSON.stringify(value) : null
}

/** Payload for a stored column value; `null` for absent or corrupt. */
export function parseMyRankedTeams(raw: string | null | undefined): MyRankedTeams | null {
  if (!raw) return null
  try {
    const result = validateMyRankedTeams(JSON.parse(raw))
    return result.ok ? result.value : null
  } catch {
    return null
  }
}

/** This browser's copy, or {@link EMPTY_MY_RANKED_TEAMS}. */
export function getMyRankedTeams(): MyRankedTeams {
  try {
    return parseMyRankedTeams(globalThis.localStorage?.getItem(STORAGE_KEY)) ?? EMPTY_MY_RANKED_TEAMS
  } catch {
    return EMPTY_MY_RANKED_TEAMS
  }
}

/** Saves this browser's copy and tells open simulators. */
export function saveMyRankedTeams(value: MyRankedTeams): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // Storage blocked (private window): the in-memory state still applies.
  }
  globalThis.dispatchEvent?.(new Event(MY_RANKED_TEAMS_EVENT))
}

/**
 * The account's copy: the value, `null` when the account has none, or
 * `undefined` when signed out or offline (keep the local copy).
 */
export async function fetchAccountMyRankedTeams(): Promise<MyRankedTeams | null | undefined> {
  try {
    const res = await fetch("/api/settings", { credentials: "same-origin" })
    if (!res.ok) return undefined
    const body = (await res.json()) as { myRankedTeams?: unknown }
    if (body.myRankedTeams == null) return null
    const result = validateMyRankedTeams(body.myRankedTeams)
    return result.ok ? result.value : null
  } catch {
    return undefined
  }
}

/** Mirrors `value` to the account; `false` when signed out or the save failed. */
export async function saveAccountMyRankedTeams(value: MyRankedTeams): Promise<boolean> {
  try {
    const res = await fetch("/api/settings", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ myRankedTeams: value }),
    })
    return res.ok
  } catch {
    return false
  }
}
