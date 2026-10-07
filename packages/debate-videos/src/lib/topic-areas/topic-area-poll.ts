/**
 * @fileoverview The next-season topic-area poll on the Topic Areas section of
 * `/practice/statistics`: which research area debaters would most like the
 * coming season's resolutions to come from.
 *
 * Shared by both halves — the explorer's poll panel and the app's
 * `/api/topic-area-poll` route — so the season being polled and the list of
 * areas a vote may name are decided in one place. Anyone can read the tally;
 * casting a vote needs a session, and each signed-in user holds one vote per
 * season that a later vote replaces.
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

/** What `GET` and `PUT /api/topic-area-poll` answer with. */
export interface TopicAreaPollResponse {
  season: number
  /** Votes per area; areas nobody picked are absent. */
  counts: Record<string, number>
  total: number
  /** The viewer's current pick, or `null` when they haven't voted. */
  myVote: string | null
  /** False for a signed-out reader, who sees the tally but can't vote. */
  signedIn: boolean
}

/** Validates a `PUT` body: `{ season, area }` for the season being polled. */
export function parseVoteBody(
  body: unknown,
  now: Date = new Date(),
): { ok: true; season: number; area: string } | { ok: false; error: string } {
  const { season, area } = (body ?? {}) as { season?: unknown; area?: unknown }
  if (season !== nextPollSeason(now)) return { ok: false, error: "Voting is only open for next season." }
  if (!isTopicArea(area)) return { ok: false, error: "Unknown topic area." }
  return { ok: true, season, area }
}

/** Poll options, most votes first, then in the explorer's area order. */
export function rankPollOptions(counts: Record<string, number>): { name: string; color: string; count: number }[] {
  return TOPIC_AREAS.map((a, i) => ({ ...a, count: counts[a.name] ?? 0, i }))
    .sort((a, b) => b.count - a.count || a.i - b.i)
    .map(({ name, color, count }) => ({ name, color, count }))
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

/** Casts or changes the viewer's vote; answers with the updated tally. */
export async function castTopicAreaVote(
  season: number,
  area: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TopicAreaPollResponse> {
  const response = await fetchImpl(TOPIC_AREA_POLL_PATH, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ season, area }),
  })
  return readPoll(response, "Couldn't save your vote.")
}
