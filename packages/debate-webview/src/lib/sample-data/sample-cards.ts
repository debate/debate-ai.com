/**
 * @fileoverview The real cards the "Load sample data" button fills the demo
 * workspaces with.
 *
 * `GET /api/search/sample` reads a small slice of the imported `debate_cards`
 * corpus and projects each row through {@link toSampleCard}, so the Coaching
 * and Research workspaces show evidence debaters actually read rather than
 * invented text. Everything built from these cards stays in this browser:
 * see `workspace-sample-data.ts`.
 *
 * @module lib/sample-data/sample-cards
 */

/** One card from the corpus, trimmed to what the sample builders use. */
export interface SampleCard {
  id: number
  /** The card's tag (its one-line claim). */
  tag: string
  /** Full citation. */
  cite: string
  /** Short cite, e.g. "Smith 24". */
  citeShort: string
  /** Plain-text card body, trimmed to {@link SAMPLE_CARD_TEXT_LIMIT} characters. */
  text: string
  /** Word count of the full card body. */
  wordCount: number
  /** Pocket > hat > block outline the card was filed under, or the tag. */
  argBlock: string
  /** Case area derived from the pocket: "Aff", "DA", "CP", "K", "T" or "Case". */
  caseArea: string
  side: "aff" | "neg"
  year: number
  event: string
  /** The caselist (school and team) the card came from. */
  school: string
}

/** Longest card body kept per sample card, so the seeded stores stay small. */
export const SAMPLE_CARD_TEXT_LIMIT = 1200

/** Cards the sample endpoint returns. */
export const SAMPLE_CARD_COUNT = 24

/** The `debate_cards` columns {@link toSampleCard} reads. */
export interface SampleCardRow {
  id: number
  tag?: string | null
  cite?: string | null
  fullcite?: string | null
  fulltext?: string | null
  markup?: string | null
  textLength?: number | null
  pocket?: string | null
  hat?: string | null
  block?: string | null
  side?: string | null
  year?: number | null
  event?: string | null
  caselistDisplayName?: string | null
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function caseAreaOf(pocket: string, side: "aff" | "neg"): string {
  if (/\bDAs?\b|disad/i.test(pocket)) return "DA"
  if (/\bCPs?\b|counterplan/i.test(pocket)) return "CP"
  if (/\bKs?\b|kritik|critique/i.test(pocket)) return "K"
  if (/^T\b|topicality/i.test(pocket)) return "T"
  return side === "aff" ? "Aff" : "Case"
}

function sideOf(raw: string, id: number): "aff" | "neg" {
  const value = raw.trim().toLowerCase()
  if (value.startsWith("a") || value === "pro") return "aff"
  if (value.startsWith("n") || value === "con") return "neg"
  return id % 2 === 0 ? "aff" : "neg"
}

/**
 * Projects a `debate_cards` row into a {@link SampleCard}.
 *
 * @param row - A row with at least an id; missing columns read as blank.
 * @returns The sample card, or `null` when the row has no tag or no body to show.
 */
export function toSampleCard(row: SampleCardRow): SampleCard | null {
  const tag = stripHtml(row.tag ?? "")
  const body = stripHtml(row.fulltext || row.markup || "")
  if (!tag || !body) return null
  const cite = stripHtml(row.cite || row.fullcite || "")
  const side = sideOf(row.side ?? "", row.id)
  const pocket = (row.pocket ?? "").trim()
  const argBlock = [pocket, row.hat?.trim(), row.block?.trim()].filter(Boolean).join(" > ") || tag
  const words = body.split(" ").filter(Boolean).length
  return {
    id: row.id,
    tag: tag.length > 200 ? `${tag.slice(0, 197)}…` : tag,
    cite,
    citeShort: (cite.split(/[.,(]/)[0] ?? cite).trim().slice(0, 60),
    text: body.length > SAMPLE_CARD_TEXT_LIMIT ? `${body.slice(0, SAMPLE_CARD_TEXT_LIMIT - 1)}…` : body,
    wordCount: Math.max(words, row.textLength ? Math.round(row.textLength / 5) : 0),
    argBlock,
    caseArea: caseAreaOf(pocket, side),
    side,
    year: Number(row.year) || 0,
    event: (row.event ?? "").trim() || "CX",
    school: (row.caselistDisplayName ?? "").trim(),
  }
}

/**
 * Picks up to `count` cards, alternating sides so both the aff and neg halves
 * of a sample round have evidence, and skipping repeated tags.
 *
 * @param cards - Candidate cards, in the order they were read.
 * @param count - How many to keep.
 * @returns The picked cards.
 */
export function pickSampleCards(cards: readonly SampleCard[], count = SAMPLE_CARD_COUNT): SampleCard[] {
  const seen = new Set<string>()
  const unique = cards.filter((card) => {
    const key = card.tag.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  const aff = unique.filter((card) => card.side === "aff")
  const neg = unique.filter((card) => card.side === "neg")
  const picked: SampleCard[] = []
  while (picked.length < count && (aff.length > 0 || neg.length > 0)) {
    const next = (picked.length % 2 === 0 ? aff.shift() ?? neg.shift() : neg.shift() ?? aff.shift()) as SampleCard
    picked.push(next)
  }
  return picked
}

/**
 * Fetches sample cards from the corpus.
 *
 * @param fetchImpl - The fetch to use (injectable for tests).
 * @returns The cards; throws when the request fails or the corpus is empty.
 */
export async function fetchSampleCards(fetchImpl: typeof fetch = fetch): Promise<SampleCard[]> {
  const response = await fetchImpl("/api/search/sample")
  if (!response.ok) throw new Error(`Couldn't load sample cards (HTTP ${response.status}).`)
  const body = (await response.json()) as { cards?: SampleCard[] }
  const cards = Array.isArray(body.cards) ? body.cards : []
  if (cards.length === 0) throw new Error("The card database has no cards to sample yet.")
  return cards
}
