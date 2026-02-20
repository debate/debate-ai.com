/**
 * Quote View Helper - converts Lexical documents to quote cards HTML
 * Uses the robust html-to-cards parser from lib/card-parser
 */

import DOMPurify from "isomorphic-dompurify"
import { htmlToCards as parseHtmlToCards } from "../../lib/card-parser/html-to-cards"

export interface QuoteCard {
  id?: string
  summary: string | null
  author: string | null
  year: string | number | null
  cite: string | null
  url: string | null
  html: string
  words: number
  boldWords?: number
  highlightedWords?: number
  wordsRead?: number
}

export interface Heading {
  type: 1 | 2 | 3 // h1, h2, h3
  text: string
  id?: string
}

export interface HeadingSection {
  heading: Heading | null
  cards: QuoteCard[]
  subsections?: HeadingSection[]
}

/**
 * Count words in HTML elements with specific tags
 */
function countWordsByTag(html: string, tags: string[]): number {
  if (!html) return 0

  const tempDiv = typeof document !== "undefined" ? document.createElement("div") : null
  if (!tempDiv) {
    // Server-side: use simple regex matching
    let count = 0
    tags.forEach((tag) => {
      const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "gi")
      const matches = html.match(regex)
      if (matches) {
        matches.forEach((match) => {
          const text = match.replace(/<[^>]*>/g, "")
          const words = text.trim().split(/\s+/).filter((w) => w.length > 0)
          count += words.length
        })
      }
    })
    return count
  }

  // Client-side: use DOM parsing
  tempDiv.innerHTML = html
  let count = 0

  tags.forEach((tag) => {
    const elements = tempDiv.getElementsByTagName(tag)
    for (let i = 0; i < elements.length; i++) {
      const text = elements[i].textContent || ""
      const words = text.trim().split(/\s+/).filter((w) => w.length > 0)
      count += words.length
    }
  })

  return count
}

/**
 * Count words in a plain text string
 */
function countWords(text: string): number {
  if (!text) return 0
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0)
  return words.length
}

/**
 * Calculate word statistics for a card's HTML content
 */
function calculateWordStats(
  html: string,
  summary: string | null,
  author: string | null,
): {
  boldWords: number
  highlightedWords: number
  wordsRead: number
} {
  const boldWords = countWordsByTag(html, ["strong", "b"])
  const highlightedWords = countWordsByTag(html, ["mark"])
  const summaryWords = countWords(summary || "")
  const authorWords = countWords(author || "")

  // Words read = summary words + author words + highlighted words + bold words
  const wordsRead = summaryWords + authorWords + highlightedWords + boldWords

  return {
    boldWords,
    highlightedWords,
    wordsRead,
  }
}

/**
 * Organize outline items into hierarchical sections with headings
 */
function organizeIntoSections(outlineItems: any[]): HeadingSection[] {
  const sections: HeadingSection[] = []
  let currentH1Section: HeadingSection | null = null
  let currentH2Section: HeadingSection | null = null
  let currentH3Section: HeadingSection | null = null

  for (const item of outlineItems) {
    // Check if it's a heading (has type 1, 2, or 3)
    if (item.type === 1 || item.type === 2 || item.type === 3) {
      const heading: Heading = {
        type: item.type,
        text: item.text || "",
        id: `heading-${item.type}-${sections.length}`,
      }

      if (item.type === 1) {
        // H1 - create new top-level section
        currentH1Section = {
          heading,
          cards: [],
          subsections: [],
        }
        sections.push(currentH1Section)
        currentH2Section = null
        currentH3Section = null
      } else if (item.type === 2) {
        // H2 - create subsection under current H1
        const h2Section: HeadingSection = {
          heading,
          cards: [],
          subsections: [],
        }

        if (currentH1Section) {
          currentH1Section.subsections = currentH1Section.subsections || []
          currentH1Section.subsections.push(h2Section)
        } else {
          // No H1 exists, add as top-level section
          sections.push(h2Section)
        }

        currentH2Section = h2Section
        currentH3Section = null
      } else if (item.type === 3) {
        // H3 - create subsection under current H2 or H1
        const h3Section: HeadingSection = {
          heading,
          cards: [],
        }

        if (currentH2Section) {
          currentH2Section.subsections = currentH2Section.subsections || []
          currentH2Section.subsections.push(h3Section)
        } else if (currentH1Section) {
          currentH1Section.subsections = currentH1Section.subsections || []
          currentH1Section.subsections.push(h3Section)
        } else {
          // No H1 or H2 exists, add as top-level section
          sections.push(h3Section)
        }

        currentH3Section = h3Section
      }
    } else if (item.summary) {
      // It's a card - add to the most specific current section
      const card: QuoteCard = {
        id: item.id,
        summary: item.summary,
        author: item.author || null,
        year: item.year || null,
        cite: item.cite || null,
        url: item.url || null,
        html: item.html || item.htmlBuffer || "",
        words: item.words || 0,
        boldWords: item.boldWords,
        highlightedWords: item.highlightedWords,
      }

      if (currentH3Section) {
        currentH3Section.cards.push(card)
      } else if (currentH2Section) {
        currentH2Section.cards.push(card)
      } else if (currentH1Section) {
        currentH1Section.cards.push(card)
      } else {
        // No heading section exists, create an anonymous section
        const anonymousSection: HeadingSection = {
          heading: null,
          cards: [card],
        }
        sections.push(anonymousSection)
      }
    }
  }

  return sections
}

/**
 * Parse HTML content to extract quote cards using the robust parser
 */
export function htmlToCards(
  html: string,
  fileName?: string,
): {
  sections: HeadingSection[]
  outline: QuoteCard[] // Keep for backward compatibility
  metadata: { fileName?: string; cardCount: number; totalWords: number }
} {
  try {
    // Use the robust parser from lib/card-parser/html-to-cards.js
    const result = parseHtmlToCards(html, fileName, {
      profile: "ultraFlexible",
    })

    console.log("[v0] parseHtmlToCards result:", result)

    // Safety check: ensure result exists and has outline
    if (!result || typeof result !== "object") {
      console.warn("[v0] parseHtmlToCards returned invalid result:", result)
      return {
        sections: [],
        outline: [],
        metadata: {
          fileName,
          cardCount: 0,
          totalWords: 0,
        },
      }
    }

    // Safety check: ensure outline exists and is an array
    if (!Array.isArray(result.outline)) {
      console.warn("[v0] parseHtmlToCards outline is not an array:", result.outline)
      return {
        sections: [],
        outline: [],
        metadata: {
          fileName,
          cardCount: 0,
          totalWords: 0,
        },
      }
    }

    // Add word statistics to cards in the outline
    const outlineWithStats = result.outline.map((item: any, index: number) => {
      if (item.summary) {
        const html = item.html || item.htmlBuffer || ""
        const stats = calculateWordStats(html, item.summary, item.author)
        return {
          ...item,
          id: `quote-card-${index}`,
          boldWords: stats.boldWords,
          highlightedWords: stats.highlightedWords,
          wordsRead: stats.wordsRead,
        }
      }
      return item
    })

    // Organize into hierarchical sections
    const sections = organizeIntoSections(outlineWithStats)

    // Extract all cards for backward compatibility
    const allCards: QuoteCard[] = []
    function extractCards(section: HeadingSection) {
      allCards.push(...section.cards)
      if (section.subsections) {
        section.subsections.forEach(extractCards)
      }
    }
    sections.forEach(extractCards)

    const totalWords = allCards.reduce((sum, card) => sum + card.words, 0)

    return {
      sections,
      outline: allCards,
      metadata: {
        fileName,
        cardCount: allCards.length,
        totalWords,
      },
    }
  } catch (error) {
    console.error("[v0] Error in htmlToCards:", error)
    return {
      sections: [],
      outline: [],
      metadata: {
        fileName,
        cardCount: 0,
        totalWords: 0,
      },
    }
  }
}

/**
 * Encode HTML attribute values
 */
function encodeHtmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/**
 * Escape HTML for safe display
 */
function escapeHtml(value: string): string {
  return encodeHtmlAttr(value)
}

/**
 * Build quote cards HTML from a Lexical JSON document
 */
export function buildQuoteCardsHtml(
  html: string,
  fileName?: string,
): {
  html: string
  metadata: { fileName?: string; cardCount: number; totalWords: number }
} {
  try {
    // Parse HTML to extract cards using the robust parser
    const { outline, metadata } = htmlToCards(html, fileName)

    // Safety check
    if (!Array.isArray(outline)) {
      console.error("[v0] outline is not an array in buildQuoteCardsHtml:", outline)
      return {
        html: '<div class="quote-view-empty"><p>Error: Unable to parse quote cards.</p></div>',
        metadata: { fileName, cardCount: 0, totalWords: 0 },
      }
    }

    if (outline.length === 0) {
      return {
        html: '<div class="quote-view-empty"><p>No quote cards detected in this document.</p><p>Add blockquotes or highlighted text to see quote cards here.</p></div>',
        metadata,
      }
    }

    // Generate HTML for each card
    const cardsHtml = outline
      .map((card) => {
        return `
          <section class="quote-card" data-quote-id="${card.id}">
            <div class="quote-card-toolbar">
              <button type="button" data-role="toggle-key-points" class="quote-card-btn toggle-key-points-btn" title="Show only bold and highlighted text">
                ⚡ Key Points
              </button>
              <button type="button" data-role="copy" class="quote-card-btn copy-btn" title="Copy card to clipboard">
                📋 Copy
              </button>
              <button type="button" data-role="ai-analyze" class="quote-card-btn ai-btn" title="Analyze with AI">
                🤖 AI analyze
              </button>
            </div>
            <blockquote class="lexical-fancy-blockquote" data-type="custom-blockquote"
              data-summary="${encodeHtmlAttr(card.summary || "")}"
              data-author="${encodeHtmlAttr(card.author || "")}"
              data-year="${encodeHtmlAttr(String(card.year || ""))}"
              data-cite="${encodeHtmlAttr(card.cite || "")}"
              data-url="${encodeHtmlAttr(card.url || "")}"
              data-words="${card.words}"
              data-bold-words="${card.boldWords || 0}"
              data-highlighted-words="${card.highlightedWords || 0}"
              data-words-read="${card.wordsRead || 0}">
              <header class="quote-card-header">
                <h4 class="quote-summary">${escapeHtml(card.summary || "")}</h4>
                ${
                  card.author || card.year || card.cite
                    ? `<div class="quote-meta">
                  ${card.author ? `<span class="quote-author">${escapeHtml(card.author)}</span>` : ""}
                  ${card.year ? `<span class="quote-year">${escapeHtml(String(card.year))}</span>` : ""}
                  ${card.cite && card.cite !== card.author ? `<span class="quote-cite">${escapeHtml(card.cite)}</span>` : ""}
                </div>`
                    : ""
                }
              </header>
              <div class="quote-body">
                ${card.html}
              </div>
              <footer class="quote-footer">
                <div class="quote-stats">
                  <span class="quote-stat-item">${card.wordsRead || 0} words read</span>
                </div>
                ${card.url ? `<a href="${encodeHtmlAttr(card.url)}" target="_blank" rel="noopener noreferrer" class="quote-link">🔗 Source</a>` : ""}
              </footer>
            </blockquote>
          </section>
        `
      })
      .join("\n")

    const sanitizedHtml = DOMPurify.sanitize(`<div class="quote-view">${cardsHtml}</div>`)

    return {
      html: sanitizedHtml,
      metadata,
    }
  } catch (error) {
    console.error("[v0] Error in buildQuoteCardsHtml:", error)
    return {
      html: '<div class="quote-view-empty"><p>Error building quote cards view.</p></div>',
      metadata: { fileName, cardCount: 0, totalWords: 0 },
    }
  }
}
