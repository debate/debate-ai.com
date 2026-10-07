/**
 * @fileoverview The next-season topic-area poll on the Topic Areas section of
 * `/practice/statistics`: which research area debaters would most like the
 * coming season's resolutions to come from.
 *
 * Shared by both halves — the explorer's poll panel and the app's
 * `/api/topic-area-poll` route — so the season being polled, the list of
 * areas a ballot may name and how a ballot is scored are decided in one place.
 * Anyone can read the tally; voting needs a session.
 *
 * It is a ranked-choice poll: each signed-in user submits one ballot per
 * season ranking up to {@link MAX_RANKED_CHOICES} areas, best first, and a
 * later ballot replaces the earlier one. An area scores Borda points — a first
 * choice is worth {@link MAX_RANKED_CHOICES} points, a second one fewer, down
 * to 1 for a fifth — and the tally ranks areas by points.
 *
 * @module lib/topic-areas/topic-area-poll
 */

import { TOPIC_AREAS } from "./topic-areas"

/** Where the poll API lives. */
export const TOPIC_AREA_POLL_PATH = "/api/topic-area-poll"

/**
 * The season label (its spring year) in progress on `now`. A season runs from
 * July to June, so July 2026 – June 2027 is the 2027 season — the same
 * labelling the debate-topics data uses.
 */
export function currentSeason(now: Date = new Date()): number {
  return now.getUTCMonth() >= 6 ? now.getUTCFullYear() + 1 : now.getUTCFullYear()
}

/** The season the poll asks about: the one after {@link currentSeason}. */
export function nextPollSeason(now: Date = new Date()): number {
  return currentSeason(now) + 1
}

/** `2028` → `"2027–28"`. */
export function seasonRangeLabel(season: number): string {
  return `${season - 1}–${String(season).slice(-2)}`
}

const AREA_NAMES = new Set(TOPIC_AREAS.map((a) => a.name))

/** True when `name` is one of the explorer's topic areas. */
export function isTopicArea(name: unknown): name is string {
  return typeof name === "string" && AREA_NAMES.has(name)
}

/** How many areas one ballot may rank. */
export const MAX_RANKED_CHOICES = 5

/** Borda points for the choice at `rank` (1-based): 5 for a first choice, down to 1 for a fifth. */
export function pointsForRank(rank: number): number {
  return Math.max(0, MAX_RANKED_CHOICES + 1 - rank)
}

/** What `GET` and `PUT /api/topic-area-poll` answer with. */
export interface TopicAreaPollResponse {
  season: number
  /** Borda points per area across every ballot; areas nobody ranked are absent. */
  points: Record<string, number>
  /** How many ballots ranked each area first; areas nobody ranked first are absent. */
  firstChoices: Record<string, number>
  /** Ballots cast this season. */
  total: number
  /** The viewer's ballot, best first — empty when they haven't voted. */
  myRanking: string[]
  /** False for a signed-out reader, who sees the tally but can't vote. */
  signedIn: boolean
}

/**
 * Validates a `PUT` body: `{ season, ranking }` for the season being polled,
 * where `ranking` is 1 to {@link MAX_RANKED_CHOICES} distinct known areas,
 * best first.
 */
export function parseVoteBody(
  body: unknown,
  now: Date = new Date(),
): { ok: true; season: number; ranking: string[] } | { ok: false; error: string } {
  const { season, ranking } = (body ?? {}) as { season?: unknown; ranking?: unknown }
  if (season !== nextPollSeason(now)) return { ok: false, error: "Voting is only open for next season." }
  if (!Array.isArray(ranking) || ranking.length === 0) return { ok: false, error: "Rank at least one topic area." }
  if (ranking.length > MAX_RANKED_CHOICES) {
    return { ok: false, error: `Rank at most ${MAX_RANKED_CHOICES} topic areas.` }
  }
  if (!ranking.every(isTopicArea)) return { ok: false, error: "Unknown topic area." }
  if (new Set(ranking).size !== ranking.length) return { ok: false, error: "Rank each topic area only once." }
  return { ok: true, season, ranking }
}

/**
 * Poll options, most points first, then most first choices, then in the
 * explorer's area order.
 */
export function rankPollOptions(
  points: Record<string, number>,
  firstChoices: Record<string, number> = {},
): { name: string; color: string; points: number; firstChoices: number }[] {
  return TOPIC_AREAS.map((a, i) => ({ ...a, points: points[a.name] ?? 0, firstChoices: firstChoices[a.name] ?? 0, i }))
    .sort((a, b) => b.points - a.points || b.firstChoices - a.firstChoices || a.i - b.i)
    .map(({ name, color, points, firstChoices }) => ({ name, color, points, firstChoices }))
}

async function readPoll(response: Response, fallback: string): Promise<TopicAreaPollResponse> {
  const payload = (await response.json().catch(() => null)) as (TopicAreaPollResponse & { error?: string }) | null
  if (!response.ok || !payload) throw new Error(payload?.error || fallback)
  return payload
}

/** Reads the tally (and the viewer's vote, when signed in) for `season`. */
export async function fetchTopicAreaPoll(season: number, fetchImpl: typeof fetch = fetch): Promise<TopicAreaPollResponse> {
  const response = await fetchImpl(`${TOPIC_AREA_POLL_PATH}?season=${season}`, { credentials: "same-origin" })
  return readPoll(response, "Couldn't load the poll.")
}

/** Casts or replaces the viewer's ranked ballot; answers with the updated tally. */
export async function castTopicAreaVote(
  season: number,
  ranking: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<TopicAreaPollResponse> {
  const response = await fetchImpl(TOPIC_AREA_POLL_PATH, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ season, ranking }),
  })
  return readPoll(response, "Couldn't save your vote.")
}
