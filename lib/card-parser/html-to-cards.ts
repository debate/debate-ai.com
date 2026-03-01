/** @fileoverview HTML-to-card parser with heading and citation boundary heuristics. */
import { Parser } from "htmlparser2"
import { FORMAT_PROFILES } from "./format-profiles"
import { extractCiteInfo, cleanUrl } from "./citation-extractor"
import { finalizeCard, repairCards } from "./card-utils"
import { parseFileNameParts } from "./file-name-parser"
import type { Card, FormatProfile, MutableCard, OutlineItem, ParseOptions, ParseResult } from "./types"

/** Type guard for discriminating outline headings from parsed cards. */
function isCardNode(node: Card | OutlineItem): node is Card {
  return "summary" in node && !("type" in node)
}

/**
 * Parses debate-document HTML into a normalized card outline and metadata.
 *
 * @param htmlString - Source HTML content.
 * @param fileName - Optional source file name used for metadata inference.
 * @param options - Parser profile and heuristic overrides.
 * @returns Structured parse output.
 */
export function htmlToCards(
  htmlString: string,
  fileName?: string,
  options: ParseOptions = {},
): ParseResult {
  const profileName = options.profile || "standard"
  const baseProfile = FORMAT_PROFILES[profileName] ?? FORMAT_PROFILES.standard
  // Allow per-call overrides while preserving base profile defaults.
  const profile: FormatProfile = { ...baseProfile, ...options }

  const outline: Array<Card | OutlineItem> = []
  const cards: Card[] = []

  let currentCard: MutableCard | null = null
  let textBuffer = ""
  let isInHeading = false
  let headingType = 0
  let isInParagraph = false
  let isInBold = false
  let boldText = ""
  let emptyBlockCount = 0
  let cardState: "OUTSIDE_CARD" | "SEEN_SUMMARY_LINE" | "IN_CARD" = "OUTSIDE_CARD"

  const normalizedHtml = normalizeHtmlForCards(htmlString)

  const parser = new Parser(
    {
      onopentag(name: string) {
        if (name === "p") {
          isInParagraph = true
          textBuffer = ""
        } else if (profile.headingTags.includes(name)) {
          isInHeading = true
          headingType =
            name === "h1" ? 1 : name === "h2" ? 2 : name === "h3" ? 3 : name === "h4" ? 4 : name === "h5" ? 5 : 6
          textBuffer = ""
        }

        if (name === "b" || name === "strong") {
          // Bold runs are later used as a strong hint for citation lines.
          isInBold = true
          boldText = ""
        }

        if (currentCard && isInParagraph) {
          // Reconstruct paragraph HTML so card body retains inline formatting.
          currentCard.htmlBuffer = (currentCard.htmlBuffer ?? "") + `<${name}>`
        }
      },

      ontext(text: string) {
        if (isInHeading || isInParagraph) textBuffer += text
        if (isInBold) boldText += text
        if (currentCard && isInParagraph) currentCard.htmlBuffer = (currentCard.htmlBuffer ?? "") + text
      },

      onclosetag(name: string) {
        if (currentCard && isInParagraph && name !== "p" && currentCard.htmlBuffer) {
          currentCard.htmlBuffer += `</${name}>`
        }

        if (profile.headingTags.includes(name) && isInHeading) {
          const headingText = textBuffer.trim()

          if (headingType === 1) outline.push({ type: 1, text: headingText })
          if (headingType === 2) outline.push({ type: 2, text: headingText })
          if (headingType === 3) outline.push({ type: 3, text: headingText })

          if (headingType >= 4) {
            if (currentCard) {
              // Starting a new card heading closes and emits the current card.
              finalizeCard(currentCard)
              if (currentCard.cite && currentCard.html) {
                cards.push(currentCard)
                outline.push(currentCard)
              } else {
                outline.push({ type: 5, text: currentCard.summary })
              }
            }

            currentCard = {
              summary: headingText,
              author: null,
              author_type: null,
              cite: null,
              body: [],
              year: null,
              url: null,
              htmlBuffer: "",
            }
            cardState = "SEEN_SUMMARY_LINE"
          }

          emptyBlockCount = 0
          isInHeading = false
          textBuffer = ""
        }

        if (name === "p" && isInParagraph) {
          const paragraphText = textBuffer.trim()

          if (!paragraphText) {
            emptyBlockCount++
            if (
              emptyBlockCount >= profile.minBlankLinesForBoundary &&
              currentCard &&
              (currentCard.cite || (currentCard.body?.length ?? 0) > 0)
            ) {
              // Enough blank lines implies a card boundary in looser HTML sources.
              finalizeCard(currentCard)
              if (currentCard.cite && currentCard.html) {
                cards.push(currentCard)
                outline.push(currentCard)
              } else if (currentCard.summary) {
                outline.push({ type: 5, text: currentCard.summary })
              }
              currentCard = null
              cardState = "OUTSIDE_CARD"
            }
          } else {
            emptyBlockCount = 0

            if (!currentCard && cardState === "OUTSIDE_CARD") {
              // Detect likely summary/tag lines before a citation/body sequence starts.
              const matchesSummaryPattern = profile.summaryPatterns.some((pattern) => pattern.test(paragraphText))
              if (matchesSummaryPattern || (boldText && paragraphText.length < 200)) {
                currentCard = {
                  summary: paragraphText,
                  author: null,
                  author_type: null,
                  cite: null,
                  body: [],
                  year: null,
                  url: null,
                  htmlBuffer: "",
                }
                cardState = "SEEN_SUMMARY_LINE"
                isInParagraph = false
                textBuffer = ""
                return
              }
            }

            if (currentCard) {
              currentCard.htmlBuffer = (currentCard.htmlBuffer ?? "") + `</${name}>`
              const paragraphHtml = currentCard.htmlBuffer

              if (boldText && !currentCard.cite) {
                // First bold-heavy paragraph is usually the citation line.
                const citeInfo = extractCiteInfo(paragraphText, boldText)
                currentCard.year = citeInfo.year
                currentCard.author = citeInfo.author
                currentCard.author_type = citeInfo.author_type
                currentCard.cite = paragraphText.replace(/'+$/, "")

                const urlMatch = paragraphText.match(/https?:\/\/[^\s<>]+/)
                if (urlMatch) currentCard.url = cleanUrl(urlMatch[0])
                cardState = "IN_CARD"
              } else if (paragraphText) {
                // Non-citation paragraphs are treated as quote body content.
                ;(currentCard.body ??= []).push(paragraphHtml)
                cardState = "IN_CARD"
              }

              currentCard.htmlBuffer = ""
            }
          }

          isInParagraph = false
          textBuffer = ""
        }

        if (name === "b" || name === "strong") isInBold = false
      },
    },
    { decodeEntities: true, lowerCaseTags: true },
  )

  parser.write(normalizedHtml)
  parser.end()

  const pendingCard = currentCard as MutableCard | null
  if (pendingCard) {
    // Flush the last in-progress card at end-of-document.
    finalizeCard(pendingCard)
    if (pendingCard.cite && pendingCard.html) {
      cards.push(pendingCard)
      outline.push(pendingCard)
    } else {
      outline.push({ type: 5, text: pendingCard.summary })
    }
  }

  const repairedCards = repairCards(cards, profile)
  const parsed = fileName ? parseFileNameParts(fileName) : null

  return {
    metadata: {
      category: parsed?.category ?? null,
      title: parsed?.topic ?? null,
      organization: parsed?.organization ?? null,
      year: parsed?.year ?? null,
      quotes: repairedCards.length,
      blocks: outline.filter((item) => !isCardNode(item) && item.type === 3).length,
    },
    outline: outline.map((item) => {
      if (!isCardNode(item)) return item
      // Replace transient card objects with repaired versions when available.
      return repairedCards.find((c) => c.summary === item.summary) ?? item
    }),
  }
}

/**
 * Normalizes line-break-heavy HTML/plaintext into paragraph-friendly markup.
 *
 * @param htmlString - Raw HTML or pasted text.
 * @returns Normalized HTML for downstream card parsing.
 */
export function normalizeHtmlForCards(htmlString: string): string {
  if (!htmlString) return ""

  // Convert common plaintext break patterns into paragraph boundaries.
  let normalized = htmlString
  normalized = normalized.replace(/\n{4,}/g, "</p><p></p><p></p><p>")
  normalized = normalized.replace(/\n{3}/g, "</p><p></p><p>")
  normalized = normalized.replace(/\n\n/g, "</p><p>")

  normalized = normalized.replace(/(<br\s*\/?>){4,}/gi, "</p><p></p><p></p><p>")
  normalized = normalized.replace(/(<br\s*\/?>){3}/gi, "</p><p></p><p>")
  normalized = normalized.replace(/(<br\s*\/?>){2}/gi, "</p><p>")
  normalized = normalized.replace(/<br\s*\/?>\s*\n\s*\n/gi, "</p><p>")

  // Remove noisy spacing/empty tags introduced by copy-paste from editors.
  normalized = normalized.replace(/[ \t]+/g, " ")
  normalized = normalized.replace(/<(h[1-6])\s*>/gi, "<$1>")
  normalized = normalized.replace(/<\/(h[1-6])>\s+/gi, "</$1>")
  normalized = normalized.replace(/<(p|div|span)\s*>\s*<\/\1>/gi, "")
  normalized = normalized.replace(/<br\s*\/?>/gi, " ")
  normalized = normalized.replace(/(\S)<(b|strong)>/gi, "$1</p><p><$2>")

  if (!normalized.startsWith("<")) normalized = "<p>" + normalized
  if (!normalized.endsWith(">")) normalized += "</p>"

  return normalized
}
