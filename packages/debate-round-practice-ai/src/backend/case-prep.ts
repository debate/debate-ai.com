/**
 * @fileoverview Pre-round case prep — the step between setup and the round
 * on the merged Practice vs AI page. Once the debater has picked a
 * difficulty, a topic and an opponent, the opponent "does the research":
 * the page finds evidence cards and caselist outlines for the topic, and
 * this module turns them into a short case brief — a one-paragraph summary
 * plus the main arguments each side is likely to run, each pointing back at
 * the cards that support it.
 *
 * Not a Go port; upstream `arguehub` had no prep step. Like the rest of
 * `./backend` it is plain functions over a `ModelClient`, so it runs on a
 * Worker, and it degrades to a brief built straight from the cards' tags
 * when no model is configured or the model's reply can't be parsed.
 *
 * @module backend/case-prep
 */

import { cleanModelOutput, type ModelClient } from "./model-client"
import { getBotPersonality } from "./personalities"

/** One evidence card the page found for the topic. */
export interface PrepCard {
  id?: string
  /** The card's tag line — its one-sentence claim. */
  tag: string
  cite?: string
  /** A short excerpt of the card's text, already trimmed by the caller. */
  excerpt?: string
  /** "aff" / "neg" when the corpus knows which side read it. */
  side?: string
}

/** One caselist outline (a whole case file) the page found for the topic. */
export interface PrepCaseDocument {
  id?: string
  title: string
  /** School and team, when known. */
  owner?: string
  side?: string
}

/** One argument in the brief. */
export interface BriefArgument {
  claim: string
  /** Why the claim is true, in a sentence or two. */
  warrant: string
  /** Indexes into the `cards` the brief was prepared from. */
  cardIndexes: number[]
}

/** The opponent's prep, shown before the round and kept beside it. */
export interface CaseBrief {
  /** A short paragraph summarizing the clash on this topic. */
  summary: string
  /** Arguments for the debater's own side. */
  yourArguments: BriefArgument[]
  /** Arguments the opponent is likely to run. */
  opponentArguments: BriefArgument[]
  /** False when the brief was built from the cards alone, with no model. */
  generated: boolean
}

export interface PrepareCaseInput {
  botName: string
  botLevel: string
  topic: string
  /** The debater's side: "for" or "against". */
  stance: string
  cards?: PrepCard[]
  cases?: PrepCaseDocument[]
}

/** Upper bounds, so a client can't send an unbounded prompt. */
export const MAX_PREP_CARDS = 12
export const MAX_PREP_CASES = 6
const MAX_FIELD_LENGTH = 600
const MAX_ARGUMENTS_PER_SIDE = 4

const clip = (value: unknown, max = MAX_FIELD_LENGTH): string =>
  typeof value === "string" ? value.trim().slice(0, max) : ""

/** Keep only well-formed cards and clip every field. */
export function sanitizePrepCards(cards: unknown): PrepCard[] {
  if (!Array.isArray(cards)) return []
  return cards
    .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
    .map((c) => ({
      id: clip(c.id, 64) || undefined,
      tag: clip(c.tag, 300),
      cite: clip(c.cite, 300) || undefined,
      excerpt: clip(c.excerpt) || undefined,
      side: clip(c.side, 16) || undefined,
    }))
    .filter((c) => c.tag)
    .slice(0, MAX_PREP_CARDS)
}

/** Keep only well-formed case documents and clip every field. */
export function sanitizePrepCases(cases: unknown): PrepCaseDocument[] {
  if (!Array.isArray(cases)) return []
  return cases
    .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
    .map((c) => ({
      id: clip(c.id, 64) || undefined,
      title: clip(c.title, 300),
      owner: clip(c.owner, 200) || undefined,
      side: clip(c.side, 16) || undefined,
    }))
    .filter((c) => c.title)
    .slice(0, MAX_PREP_CASES)
}

/** "for" / "against" as the side names the prompt and brief use. */
export function sideLabels(stance: string): { yours: string; theirs: string } {
  return stance.toLowerCase() === "against"
    ? { yours: "Against", theirs: "For" }
    : { yours: "For", theirs: "Against" }
}

/**
 * Build the prep prompt. The persona colours how the opponent frames its
 * own case, but the brief itself is neutral research for a student — the
 * same "adversarial about the resolution, never about the debater" line the
 * round prompt keeps.
 */
export function constructCasePrepPrompt(input: PrepareCaseInput, cards: PrepCard[], cases: PrepCaseDocument[]): string {
  const bot = getBotPersonality(input.botName)
  const { yours, theirs } = sideLabels(input.stance)
  const cardLines = cards.length
    ? cards
        .map(
          (c, i) =>
            `[${i}] ${c.tag}${c.side ? ` (${c.side})` : ""}${c.cite ? ` — ${c.cite}` : ""}${c.excerpt ? `\n    "${c.excerpt}"` : ""}`,
        )
        .join("\n")
    : "(no cards were found; argue from general knowledge)"
  const caseLines = cases.length
    ? cases.map((c) => `- ${c.title}${c.owner ? ` (${c.owner})` : ""}${c.side ? ` [${c.side}]` : ""}`).join("\n")
    : "(none found)"

  return `You are ${bot.name}, a ${input.botLevel || bot.level}-level debate opponent, preparing for a practice round.
Your intellectual approach: ${bot.intellectualApproach}
Your debate strategy: ${bot.debateStrategy}

Topic: "${input.topic}"
The student debates the ${yours} side. You will debate the ${theirs} side.

Evidence cards found for this topic (cite them by their [index]):
${cardLines}

Caselist outlines found for this topic:
${caseLines}

Write a short, neutral prep brief for the student — research, not trash talk. Return ONLY JSON in this exact shape:
{
  "summary": "3-4 sentences on where the clash on this topic lies",
  "yourArguments": [{ "claim": "...", "warrant": "...", "cardIndexes": [0] }],
  "opponentArguments": [{ "claim": "...", "warrant": "...", "cardIndexes": [1] }]
}
"yourArguments" are the 2-${MAX_ARGUMENTS_PER_SIDE} strongest arguments for the ${yours} side; "opponentArguments" are the 2-${MAX_ARGUMENTS_PER_SIDE} arguments you plan to run for the ${theirs} side, matching your difficulty level. Only cite card indexes listed above.`
}

function parseArguments(value: unknown, cardCount: number): BriefArgument[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((a): a is Record<string, unknown> => typeof a === "object" && a !== null)
    .map((a) => ({
      claim: clip(a.claim, 300),
      warrant: clip(a.warrant),
      cardIndexes: Array.isArray(a.cardIndexes)
        ? [...new Set(a.cardIndexes.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < cardCount))]
        : [],
    }))
    .filter((a) => a.claim)
    .slice(0, MAX_ARGUMENTS_PER_SIDE)
}

/**
 * Parse the model's reply into a brief. Returns `null` when the reply isn't
 * the JSON asked for, or carries no arguments, so the caller can fall back.
 */
export function parseCaseBrief(text: string, cardCount: number): CaseBrief | null {
  let parsed: unknown
  try {
    const cleaned = cleanModelOutput(text)
    // Models sometimes add a sentence before the object; take the outermost braces.
    const start = cleaned.indexOf("{")
    const end = cleaned.lastIndexOf("}")
    if (start === -1 || end <= start) return null
    parsed = JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    return null
  }
  if (typeof parsed !== "object" || parsed === null) return null
  const record = parsed as Record<string, unknown>
  const yourArguments = parseArguments(record.yourArguments, cardCount)
  const opponentArguments = parseArguments(record.opponentArguments, cardCount)
  if (yourArguments.length === 0 && opponentArguments.length === 0) return null
  return { summary: clip(record.summary, 1200), yourArguments, opponentArguments, generated: true }
}

/**
 * A brief built from the cards alone: each card's tag becomes an argument
 * on the side the corpus says read it, or alternately on each side when it
 * doesn't say. Used with no model, or when the model's reply is unusable.
 */
export function buildFallbackCaseBrief(input: PrepareCaseInput, cards: PrepCard[]): CaseBrief {
  const { yours, theirs } = sideLabels(input.stance)
  const yoursIsAff = yours === "For"
  const yourArguments: BriefArgument[] = []
  const opponentArguments: BriefArgument[] = []
  cards.forEach((card, index) => {
    const side = card.side?.toLowerCase()
    const isAff = side === "aff" || side === "a" ? true : side === "neg" || side === "n" ? false : index % 2 === 0
    const target = isAff === yoursIsAff ? yourArguments : opponentArguments
    if (target.length >= MAX_ARGUMENTS_PER_SIDE) return
    target.push({ claim: card.tag, warrant: card.excerpt ?? card.cite ?? "", cardIndexes: [index] })
  })
  const summary = cards.length
    ? `Found ${cards.length} card${cards.length === 1 ? "" : "s"} on "${input.topic}". Below, the cards are sorted into the ${yours} side you'll defend and the ${theirs} side ${input.botName} is likely to run.`
    : `No evidence cards matched "${input.topic}" yet. Expect ${input.botName} to argue the ${theirs} side from general knowledge; build your ${yours} case around the topic's core definitions and its biggest real-world impacts.`
  return { summary, yourArguments, opponentArguments, generated: false }
}

/** Prepare the brief: ask the model, fall back to the cards when it can't help. */
export async function prepareCaseBrief(client: ModelClient | null, input: PrepareCaseInput): Promise<CaseBrief> {
  const cards = sanitizePrepCards(input.cards)
  const cases = sanitizePrepCases(input.cases)
  if (!client) return buildFallbackCaseBrief(input, cards)

  try {
    const reply = await client.generateText(constructCasePrepPrompt(input, cards, cases))
    return parseCaseBrief(reply, cards.length) ?? buildFallbackCaseBrief(input, cards)
  } catch (error) {
    console.error("[practice-vs-ai] model error in prepareCaseBrief:", error)
    return buildFallbackCaseBrief(input, cards)
  }
}
