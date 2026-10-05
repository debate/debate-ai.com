/**
 * @fileoverview Built-in featured rounds: real, publicly shared rounds that
 * anyone can open from the `/debate` start screen's **Featured** section.
 *
 * A featured round is a catalog entry, not a stored round. Its speech docs
 * live in the public Topic Starter library (`topic_starter_items`, served by
 * `GET /api/topic-starters/by-path?path=<id>`), so the catalog only names
 * which library file is which speech. Opening one fetches those files,
 * decodes them to HTML, and builds an ordinary local round: one flow in the
 * round's format with every speech's doc filled in, and the timers switched
 * to that format. From then on it's the reader's own round, saved and synced
 * like any other; opening the card again reopens it instead of rebuilding.
 *
 * Every round gets a fixed slug, so `/debate/<slug>` is a shareable link that
 * builds the round for a reader who has never opened it.
 *
 * @module round/featured-rounds
 */

import { debateStyleMap, type DebateStyleKey } from "@debate/timer/src/formats/debate-format-times"
import { newFlow } from "../utils/flow-utils"
import type { Flow, Round } from "../types/flow"
import { storedDocumentHtml, type StoredDocument } from "./stored-document-html"

/** One speech of a featured round and the Topic Starter file that holds its doc. */
export interface FeaturedSpeechDoc {
  /** Flow column / speech name, e.g. `"1AC"`. */
  speech: string
  /** `topic_starter_items.id` of the published speech doc. */
  topicStarterId: number
}

/** A built-in featured round. */
export interface FeaturedRound {
  /** Stable identity, also used as the start screen card's key. */
  key: string
  /** Card and round title. */
  title: string
  /** One line under the title. */
  description: string
  tournamentName: string
  roundLevel: string
  /** Format the round's flow columns and timers follow. */
  debateStyle: DebateStyleKey
  debaters: { aff: [string, string]; neg: [string, string] }
  schools: { aff: [string, string]; neg: [string, string] }
  winner?: "aff" | "neg"
  /** Round slug, so `/debate/<slug>` opens it. */
  slug: string
  /** Speeches that have a published doc, in speaking order. */
  speechDocs: FeaturedSpeechDoc[]
}

/**
 * The featured rounds, in the order the start screen shows them.
 *
 * NDT 2015 Finals: Northwestern MV (aff) beat Michigan AP (neg) on a 3-2.
 * The library's "NDT 15 Finals Speech Doc" folder holds seven of the eight
 * speeches' docs; there is no 2AR doc, so that speech opens blank.
 */
export const FEATURED_ROUNDS: readonly FeaturedRound[] = [
  {
    key: "ndt-2015-finals",
    title: "NDT 2015 Finals",
    description: "Northwestern MV vs Michigan AP, college policy with the speech docs from the round",
    tournamentName: "2015 National Debate Tournament",
    roundLevel: "Finals",
    debateStyle: "collegePolicy",
    debaters: { aff: ["Alex Miles", "Arjun Vellayappan"], neg: ["Ellis Allen", "Alex Pappas"] },
    schools: { aff: ["Northwestern MV", "Northwestern MV"], neg: ["Michigan AP", "Michigan AP"] },
    winner: "aff",
    slug: "2015-ndt/northwestern-mv-michigan-ap",
    speechDocs: [
      { speech: "1AC", topicStarterId: 48 },
      { speech: "1NC", topicStarterId: 46 },
      { speech: "2AC", topicStarterId: 50 },
      { speech: "2NC", topicStarterId: 47 },
      { speech: "1NR", topicStarterId: 45 },
      { speech: "1AR", topicStarterId: 49 },
      { speech: "2NR", topicStarterId: 44 },
    ],
  },
]

/** The featured round whose slug is `slug`, if any. */
export function featuredRoundBySlug(slug: string): FeaturedRound | undefined {
  return FEATURED_ROUNDS.find((featured) => featured.slug === slug)
}

/**
 * The local round already built from `featured`, if the reader opened it
 * before and its flows still exist.
 */
export function findLocalFeaturedRound(
  featured: FeaturedRound,
  rounds: Round[],
  flows: Pick<Flow, "id">[],
): Round | undefined {
  const flowIds = new Set(flows.map((flow) => flow.id))
  return rounds.find(
    (round) => round.slug === featured.slug && round.flowIds.some((id) => flowIds.has(id)),
  )
}

/** Index of the round's format in `debateStyleMap` (the `debateStyle` setting's value). */
export function featuredRoundStyleIndex(featured: FeaturedRound): number {
  return debateStyleMap.indexOf(featured.debateStyle)
}

/** The speech docs that loaded, keyed by speech, and the speeches that didn't. */
export interface FeaturedSpeechDocsResult {
  docs: Record<string, string>
  missing: string[]
}

/**
 * Fetches and decodes every speech doc of `featured`. A doc that fails to
 * load is reported in `missing` rather than failing the round, so one
 * unpublished file still leaves the other speeches readable.
 *
 * @throws When not a single doc loaded.
 */
export async function loadFeaturedSpeechDocs(
  featured: FeaturedRound,
  {
    fetchImpl = fetch,
    toHtml = storedDocumentHtml,
  }: { fetchImpl?: typeof fetch; toHtml?: (doc: StoredDocument) => Promise<string> } = {},
): Promise<FeaturedSpeechDocsResult> {
  const results = await Promise.all(
    featured.speechDocs.map(async ({ speech, topicStarterId }) => {
      try {
        const res = await fetchImpl(`/api/topic-starters/by-path?path=${topicStarterId}`)
        if (!res.ok) return { speech, html: null }
        const body = (await res.json()) as { item?: StoredDocument }
        const html = body.item ? await toHtml(body.item) : ""
        return { speech, html: html || null }
      } catch {
        return { speech, html: null }
      }
    }),
  )
  const docs: Record<string, string> = {}
  const missing: string[] = []
  for (const { speech, html } of results) {
    if (html) docs[speech] = html
    else missing.push(speech)
  }
  if (Object.keys(docs).length === 0) {
    throw new Error(`None of the ${featured.title} speech docs could be loaded.`)
  }
  return { docs, missing }
}

/**
 * Builds the flow and round for `featured`: a blank flow in the round's
 * format whose `speechDocs` holds `docs`. The caller creates the round (which
 * assigns its id) and then sets the flow's `roundId`.
 *
 * @param index - Position the new flow takes in the flows array.
 * @param flowId - Id for the new flow.
 */
export function buildFeaturedRound(
  featured: FeaturedRound,
  docs: Record<string, string>,
  index: number,
  flowId: number = Date.now(),
): { flow: Flow; round: Omit<Round, "id" | "timestamp"> } {
  const base = newFlow(index, "primary", false, featuredRoundStyleIndex(featured))
  if (!base) throw new Error(`Unknown debate format "${featured.debateStyle}".`)
  const flow: Flow = {
    ...base,
    id: flowId,
    content: `${featured.title} - Aff`,
    speechDocs: { ...docs },
    archived: false,
    speechNumber: 1,
    ...(featured.winner ? { winner: featured.winner } : {}),
  }
  const round: Omit<Round, "id" | "timestamp"> = {
    tournamentName: featured.tournamentName,
    roundLevel: featured.roundLevel,
    debaters: { aff: [...featured.debaters.aff], neg: [...featured.debaters.neg] },
    schools: { aff: [...featured.schools.aff], neg: [...featured.schools.neg] },
    judges: [],
    flowIds: [flowId],
    status: "completed",
    ...(featured.winner ? { winner: featured.winner } : {}),
    title: featured.title,
    slug: featured.slug,
  }
  return { flow, round }
}
