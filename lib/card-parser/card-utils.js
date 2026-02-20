/**
 * @fileoverview Utility functions for debate card processing.
 * Includes card finalization, repair, and validation logic.
 * @module card-parser/card-utils
 */

import { extractMarked } from "./text-extractor.js"

/**
 * @typedef {Object} Card
 * @property {string} summary - Card tag/summary line
 * @property {string|null} author - Author last name
 * @property {string|null} author_type - Type of author (person, organization, etc.)
 * @property {string|null} cite - Full citation text
 * @property {string[]} body - Array of HTML paragraph strings
 * @property {number|string|null} year - Publication year or "ND"
 * @property {string|null} url - Source URL
 * @property {string} [htmlBuffer] - Temporary HTML accumulator (removed after finalization)
 * @property {string} [html] - Finalized HTML content
 * @property {string} [marked] - Extracted highlighted text
 * @property {number} [words] - Total word count
 * @property {number} [wordsMarked] - Word count of highlighted text
 * @property {string[]} [error] - Array of validation error codes
 */

/**
 * @typedef {Object} FormatProfile
 * @property {string[]} headingTags - HTML tags to treat as headings
 * @property {string[]} cardStartHeadings - Heading tags that can start a new card
 * @property {number} minBlankLinesForBoundary - Minimum blank lines to create card boundary
 * @property {boolean} trustParagraphTags - Whether to trust paragraph tags for structure
 * @property {RegExp[]} summaryPatterns - Patterns that indicate card summary lines
 */

/**
 * Finalizes a card by computing derived fields and validating content.
 * Joins body paragraphs, extracts highlighted text, counts words,
 * and identifies any validation errors.
 *
 * @param {Card} card - Card object to finalize (modified in place)
 * @param {boolean} [useEllipsis=false] - Whether to use ellipsis when joining marked text
 * @returns {void}
 *
 * @example
 * const card = {
 *   summary: "Impact Card",
 *   cite: "Smith 2023",
 *   body: ["<p>Evidence text here</p>"],
 *   author: "Smith",
 *   year: 2023,
 *   url: null
 * };
 * finalizeCard(card);
 * // card.html, card.words, card.marked are now populated
 */
export function finalizeCard(card, useEllipsis = false) {
  card.error = []

  if (card.body.length > 0) {
    card.html = card.body.join("\n")
    card.marked = extractMarked(card.html, useEllipsis)

    // Calculate word counts
    const plainText = card.html
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;?/gi, " ")
      .replace(/[\t\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()

    card.words = countWords(plainText)

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

  // Validate required fields
  if (!card.summary || card.summary.trim() === "") {
    card.error.push("missing_summary")
  }

  if (!card.cite || card.cite.trim() === "") {
    card.error.push("missing_citation")
  }

  if (!card.author || card.author.trim() === "") {
    card.error.push("missing_author")
  }

  if (!card.year || card.year === "ND") {
    card.error.push("missing_year")
  }

  // Validate year range
  if (card.year && typeof card.year === "number") {
    const currentYear = new Date().getFullYear()
    if (card.year < 1900 || card.year > currentYear + 1) {
      card.error.push("invalid_year")
    }
  }

  // Validate URL format
  if (card.url && !card.url?.match(/^https?:\/\//)) {
    card.error.push("invalid_url_format")
  }

  // Check for empty content
  if (card.words === 0) {
    card.error.push("empty_content")
  }

  // Check for missing highlighting
  if (card.wordsMarked === 0 && card.marked) {
    card.error.push("no_highlighted_text")
  }

  // Clean up error array if no errors
  if (card.error.length === 0) {
    delete card.error
  }

  // Remove temporary fields
  delete card.htmlBuffer
  delete card.body
}

/**
 * Repairs and consolidates an array of cards.
 * Merges small fragments into previous cards and ensures all cards have summaries.
 *
 * @param {Card[]} cards - Array of cards to repair
 * @param {FormatProfile} profile - Format profile (currently unused, reserved for future)
 * @returns {Card[]} Array of repaired cards
 *
 * @example
 * const cards = [
 *   { summary: "Card 1", html: "Content", words: 100, cite: "Smith", author: "Smith" },
 *   { summary: "", html: "Fragment", words: 10 }
 * ];
 * const repaired = repairCards(cards, profile);
 * // Fragment is merged into Card 1
 */
export function repairCards(cards, profile) {
  const repaired = []

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]

    // Merge small fragments without citation into previous card
    if (card.words < 20 && i > 0 && !card.cite && !card.author) {
      const prevCard = repaired[repaired.length - 1]
      if (prevCard && prevCard.html) {
        prevCard.html += "\n" + card.html
        prevCard.body.push(...(card.body || []))
        prevCard.words += card.words
        continue
      }
    }

    // Generate summary from first line if missing
    if (!card.summary || card.summary.trim().length === 0) {
      const firstLine = card.html
        ?.split("\n")[0]
        ?.replace(/<[^>]*>/g, "")
        .trim()
      if (firstLine && firstLine.length > 0) {
        card.summary = firstLine.substring(0, 150)
      }
    }

    repaired.push(card)
  }

  return repaired
}

/**
 * Counts words in a text string.
 *
 * @param {string} text - Text to count words in
 * @returns {number} Number of words
 * @private
 */
function countWords(text) {
  return text && text.trim() ? text.trim().split(/\s+/).length : 0
}
