/** @fileoverview Utility helpers for normalizing and validating parsed cards. */
import { extractMarked } from "./text-extractor"
import type { Card, FormatProfile, MutableCard } from "./types"

/** Maps a two-digit citation year to a yellow badge shade class. */
export const getYearShade = (year: string) => {
  const yearNum = Number.parseInt(year, 10)
  if (yearNum >= 24) return "bg-yellow-500 text-yellow-950"
  if (yearNum >= 23) return "bg-yellow-400 text-yellow-900"
  if (yearNum >= 22) return "bg-yellow-300 text-yellow-800"
  if (yearNum >= 21) return "bg-yellow-200 text-yellow-700"
  if (yearNum >= 20) return "bg-yellow-100 text-yellow-600"
  return "bg-yellow-50 text-yellow-500"
}

/** Removes a trailing four-digit year from a short citation label. */
export const extractAuthor = (citeShort: string) => {
  return citeShort.replace(/\s+\d{4}$/, "")
}

/** Returns the first four-digit year found in a citation label. */
export const extractYear = (citeShort: string) => {
  const match = citeShort.match(/\d{4}/)
  return match ? match[0] : ""
}

/** Maps quote count to a blue badge shade class. */
export const getBlueShade = (count: number) => {
  if (count >= 1000) return "bg-blue-600 text-white dark:bg-blue-600"
  if (count >= 500) return "bg-blue-500 text-white dark:bg-blue-500"
  if (count >= 250) return "bg-blue-400 text-white dark:bg-blue-400"
  if (count >= 100) return "bg-blue-300 text-blue-900 dark:bg-blue-300 dark:text-blue-900"
  if (count >= 50) return "bg-blue-200 text-blue-800 dark:bg-blue-200 dark:text-blue-800"
  return "bg-blue-100 text-blue-700 dark:bg-blue-100 dark:text-blue-700"
}

/** Maps card word count to a green badge shade class. */
export const getGreenShade = (wordCount: number) => {
  if (wordCount >= 2500) return "bg-green-600 text-white dark:bg-green-600"
  if (wordCount >= 2000) return "bg-green-500 text-white dark:bg-green-500"
  if (wordCount >= 1500) return "bg-green-400 text-white dark:bg-green-400"
  if (wordCount >= 1000) return "bg-green-300 text-green-900 dark:bg-green-300 dark:text-green-900"
  if (wordCount >= 500) return "bg-green-200 text-green-800 dark:bg-green-200 dark:text-green-800"
  return "bg-green-100 text-green-700 dark:bg-green-100 dark:text-green-700"
}

/** Converts lightweight card HTML to plain text for display/search. */
export const htmlToText = (html: string): string => {
  return html
    .replace(/<mark>(.*?)<\/mark>/g, "$1")
    .replace(/<u>(.*?)<\/u>/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim()
}

/**
 * Finalizes a mutable card by computing derived fields and validation errors.
 *
 * @param card - Mutable card being built during parsing.
 * @param useEllipsis - Whether highlighted snippets should be ellipsis-joined.
 */
export function finalizeCard(card: MutableCard, useEllipsis = false): void {
  // Start with a mutable error list and remove it later when no errors are found.
  card.error = []

  const body = card.body ?? []
  if (body.length > 0) {
    // Join captured paragraphs into the final HTML block for the card.
    card.html = body.join("\n")
    card.marked = extractMarked(card.html, useEllipsis)

    // Word count should reflect visible text, not tags/entities.
    const plainText = card.html
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;?/gi, " ")
      .replace(/[\t\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()

    card.words = countWords(plainText)

    // Ellipsis separators are not semantic words; normalize before counting.
    const markedText = typeof card.marked === "string" ? card.marked : ""
    const markedForCount = markedText.replace(/…/g, " ")
    card.wordsMarked = countWords(markedForCount)
  } else {
    card.html = ""
    card.marked = ""
    card.words = 0
    card.wordsMarked = 0
    card.error.push("missing_body")
  }

  if (!card.summary || card.summary.trim() === "") card.error.push("missing_summary")
  if (!card.cite || card.cite.trim() === "") card.error.push("missing_citation")
  if (!card.author || card.author.trim() === "") card.error.push("missing_author")
  if (!card.year || card.year === "ND") card.error.push("missing_year")

  if (card.year && typeof card.year === "number") {
    const currentYear = new Date().getFullYear()
    if (card.year < 1900 || card.year > currentYear + 1) card.error.push("invalid_year")
  }

  if (card.url && !card.url.match(/^https?:\/\//)) card.error.push("invalid_url_format")
  if (card.words === 0) card.error.push("empty_content")
  if (card.wordsMarked === 0 && card.marked) card.error.push("no_highlighted_text")

  if (card.error.length === 0) delete card.error

  delete card.htmlBuffer
  delete card.body
}

/**
 * Applies post-processing repairs to parsed cards.
 *
 * @param cards - Parsed cards.
 * @param _profile - Parsing profile (reserved for future repair rules).
 * @returns Repaired cards.
 */
export function repairCards(cards: Card[], _profile: FormatProfile): Card[] {
  const repaired: Card[] = []

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]

    // Merge tiny unlabeled fragments into the previous parsed card.
    if ((card.words ?? 0) < 20 && i > 0 && !card.cite && !card.author) {
      const prevCard = repaired[repaired.length - 1] as (Card & { body?: string[] }) | undefined
      if (prevCard?.html && card.html) {
        prevCard.html += "\n" + card.html
        if (prevCard.body) prevCard.body.push(...((card as Card & { body?: string[] }).body ?? []))
        prevCard.words = (prevCard.words ?? 0) + (card.words ?? 0)
        continue
      }
    }

    if (!card.summary || card.summary.trim().length === 0) {
      // Backfill missing summaries from the first visible line of card HTML.
      const firstLine = card.html
        ?.split("\n")[0]
        ?.replace(/<[^>]*>/g, "")
        .trim()
      if (firstLine && firstLine.length > 0) card.summary = firstLine.substring(0, 150)
    }

    repaired.push(card)
  }

  return repaired
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}
