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
 * Each ballot also names the voter's debate format (NDT, Policy, LD or PF),
 * so the tally comes back both overall and split by format. Ballots cast
 * before the format question existed count overall only.
 *
 * @module lib/topic-areas/topic-area-poll
 */

import { TOPIC_AREAS, TOPIC_FORMAT_FILTERS, type TopicFormat } from "./topic-areas"

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

/**
 * Area names the poll used before the areas were rebalanced to 40, mapped to
 * the area their ballots now count for. A split area maps to the part that
 * kept most of its resolutions. Applied when tallying, so a ballot saved under
 * an old name still counts and still shows as the voter's choice.
 */
export const LEGACY_AREA_RENAMES: Readonly<Record<string, string>> = {
  "Education & Youth": "School Funding & Education Policy",
  "Health & Bioethics": "Health Care & Insurance",
  "Labor & Business": "Labor, Wages & Unions",
  "Speech, Press & Information": "Press, Media & Information",
  "Regional & Bilateral Relations": "Europe, Russia & the Middle East",
  "Diplomacy & Regional Relations": "Europe, Russia & the Middle East",
  "Markets, Finance & Regulation": "Business, Markets & Regulation",
  "Industrial & Climate Economics": "Business, Markets & Regulation",
  "War Powers & Military Law": "Presidential & War Powers",
  "Government Powers & Security": "Presidential & War Powers",
  "Housing & Welfare": "Poverty, Welfare & Housing",
  "Inequality, Welfare & Redistribution": "Poverty, Welfare & Housing",
  "Technology, Cyber & AI": "Science, Space & Technology",
  "Space & Science Policy": "Science, Space & Technology",
  "Applied Ethics & Emerging Technology": "Bioethics, Public Health & Drugs",
  "Peacekeeping & Humanitarian Security": "Development, Aid & Peacekeeping",
  "Development & Humanitarian Aid": "Development, Aid & Peacekeeping",
  "Agriculture, Food & Rural Policy": "Infrastructure, Transport & Agriculture",
  "Transportation & Infrastructure": "Infrastructure, Transport & Agriculture",
  "Elections & Democracy": "Elections, Voting & Representation",
  "Domestic Policy & Society": "Equality, Identity & Inclusion",
}

/** The current name for a stored area: itself, or its {@link LEGACY_AREA_RENAMES} successor. */
export function currentAreaName(name: string): string {
  return LEGACY_AREA_RENAMES[name] ?? name
}

/** The formats a voter can pick, in the explorer's order. */
export const POLL_FORMATS: { id: TopicFormat; label: string }[] = TOPIC_FORMAT_FILTERS.filter(
  (f): f is { id: TopicFormat; label: string } => f.id !== "all",
)

/** True when `value` is one of {@link POLL_FORMATS}. */
export function isPollFormat(value: unknown): value is TopicFormat {
  return POLL_FORMATS.some((f) => f.id === value)
}

/** How many areas one ballot may rank. */
export const MAX_RANKED_CHOICES = 5

/** Borda points for the choice at `rank` (1-based): 5 for a first choice, down to 1 for a fifth. */
export function pointsForRank(rank: number): number {
  return Math.max(0, MAX_RANKED_CHOICES + 1 - rank)
}

/** One tally: every ballot, or the ballots from one format. */
export interface TopicAreaPollTally {
  /** Borda points per area; areas nobody ranked are absent. */
  points: Record<string, number>
  /** How many ballots ranked each area first; areas nobody ranked first are absent. */
  firstChoices: Record<string, number>
  /** Ballots in this tally. */
  total: number
}

/** What `GET` and `PUT /api/topic-area-poll` answer with. */
export interface TopicAreaPollResponse extends TopicAreaPollTally {
  season: number
  /** The same tally split by the format each voter named; formats with no ballots are absent. */
  byFormat: Partial<Record<TopicFormat, TopicAreaPollTally>>
  /** The viewer's ballot, best first — empty when they haven't voted. */
  myRanking: string[]
  /** The format the viewer named on their ballot, or null. */
  myFormat: TopicFormat | null
  /** False for a signed-out reader, who sees the tally but can't vote. */
  signedIn: boolean
}

/**
 * Validates a `PUT` body: `{ season, format, ranking }` for the season being
 * polled, where `format` is one of {@link POLL_FORMATS} and `ranking` is 1 to
 * {@link MAX_RANKED_CHOICES} distinct known areas, best first.
 */
export function parseVoteBody(
  body: unknown,
  now: Date = new Date(),
): { ok: true; season: number; format: TopicFormat; ranking: string[] } | { ok: false; error: string } {
  const { season, format, ranking } = (body ?? {}) as { season?: unknown; format?: unknown; ranking?: unknown }
  if (season !== nextPollSeason(now)) return { ok: false, error: "Voting is only open for next season." }
  if (!isPollFormat(format)) return { ok: false, error: "Pick the format you debate." }
  if (!Array.isArray(ranking) || ranking.length === 0) return { ok: false, error: "Rank at least one topic area." }
  if (ranking.length > MAX_RANKED_CHOICES) {
    return { ok: false, error: `Rank at most ${MAX_RANKED_CHOICES} topic areas.` }
  }
  if (!ranking.every(isTopicArea)) return { ok: false, error: "Unknown topic area." }
  if (new Set(ranking).size !== ranking.length) return { ok: false, error: "Rank each topic area only once." }
  return { ok: true, season, format, ranking }
}

/**
 * Poll options, most points first, then most first choices, then in the
 * explorer's area order.
 */
export function rankPollOptions(
  points: Record<string, number>,
  firstChoices: Record<string, number> = {},
): { name: string; emoji: string; color: string; points: number; firstChoices: number }[] {
  return TOPIC_AREAS.map((a, i) => ({ ...a, points: points[a.name] ?? 0, firstChoices: firstChoices[a.name] ?? 0, i }))
    .sort((a, b) => b.points - a.points || b.firstChoices - a.firstChoices || a.i - b.i)
    .map(({ name, emoji, color, points, firstChoices }) => ({ name, emoji, color, points, firstChoices }))
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
  format: TopicFormat,
  ranking: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<TopicAreaPollResponse> {
  const response = await fetchImpl(TOPIC_AREA_POLL_PATH, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ season, format, ranking }),
  })
  return readPoll(response, "Couldn't save your vote.")
}
