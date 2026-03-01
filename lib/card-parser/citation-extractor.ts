/** @fileoverview Citation parsing heuristics for extracting author/year metadata. */
import { extractHumanName } from "./human-name-recognizer"
import type { CitationInfo } from "./types"

const COMMON_SHORT_WORDS = [
  "in", "on", "at", "to", "for", "of", "with", "by", "from", "the", "a", "an", "and", "or",
  "but", "is", "are", "was", "were", "be", "been", "have", "has", "had", "do", "does", "did",
  "will", "would", "could", "should", "may", "might", "can", "must",
]

const EXTENDED_COMMON_WORDS = [...COMMON_SHORT_WORDS, "et", "al", "al.", "et al.", "et al"]

/**
 * Extracts structured citation metadata from a full citation line.
 *
 * @param fullCite - Full citation paragraph text.
 * @param boldText - Bolded fragment captured while parsing the paragraph.
 * @returns Parsed author/year/author-type fields.
 */
export function extractCiteInfo(fullCite: string, boldText: string): CitationInfo {
  const info: CitationInfo = { author: null, year: null, author_type: null }

  if (!info.author && boldText) {
    let authorExtracted = false

    // Fast-path: common "Lastname YYYY" pattern at citation start.
    const authorYearPattern = /^([A-Z][a-zA-Z'`-]+)\s+(\d{2,4})\b/
    const authorYearMatch = fullCite.match(authorYearPattern)

    if (authorYearMatch) {
      info.author = authorYearMatch[1]
      authorExtracted = true
      const year = authorYearMatch[2]
      if (year.length === 2) {
        const yearNum = Number.parseInt(year, 10)
        info.year = yearNum <= 30 ? 2000 + yearNum : 1900 + yearNum
      } else {
        info.year = Number.parseInt(year, 10)
      }
    }

    if (!authorExtracted) {
      // Fallback to broader human-name extraction for messier citation formats.
      const humanNameResult = extractHumanName(fullCite, { formatCiteShortenAuthor: false })

      if (humanNameResult?.author_cite) {
        info.author = humanNameResult.author_short || humanNameResult.author_cite
        info.author_type = humanNameResult.author_type
      }

      const apostropheYearMatch = boldText.match(/'(\d{2})\b/)
      if (apostropheYearMatch) {
        const yearNum = Number.parseInt(apostropheYearMatch[1], 10)
        if (!info.year) info.year = yearNum <= 30 ? 2000 + yearNum : 1900 + yearNum
      }

      if (boldText.trim() === "'" || boldText.trim() === "''") {
        // Some imports leave only a quote character bolded; recover name from context.
        const nameBeforeQuote = fullCite.match(/([A-Za-z][A-Za-z\s,.-]+?)\s*['"]/)
        if (nameBeforeQuote) {
          const name = nameBeforeQuote[1].trim()
          const nameParts = name.split(/\s+/).filter((part) => part.length > 0)
          if (nameParts.length > 0) info.author = cleanPunctuation(nameParts[nameParts.length - 1])
        }
      } else if (boldText.trim().length <= 2 && /['"]/.test(boldText)) {
        // Short bold fragments are often malformed year markers ('23), so use nearby text.
        const authorPatterns = [
          /([A-Za-z][A-Za-z\s,.-]+?)\s*['"]\d{2,4}/,
          /([A-Za-z][A-Za-z\s,.-]+?)\s*['"]/,
          /^([A-Za-z][A-Za-z\s,.-]+?)\s/,
          /([A-Za-z][A-Za-z\s,.-]+?)\s*['"]\d{2}/,
        ]

        for (const pattern of authorPatterns) {
          const match = fullCite.match(pattern)
          if (!match) continue
          const name = match[1].trim()
          const nameParts = name.split(/\s+/).filter((part) => part.length > 0)
          if (nameParts.length === 0) continue
          const lastName = cleanPunctuation(nameParts[nameParts.length - 1])
          if (lastName && lastName.length > 1) info.author = lastName
        }
      } else {
        // Clean role/title fragments from bold text and treat remaining tokens as author signal.
        const authorMatch = boldText
          .replace(/et\s+al\.?\s*/gi, "et al.")
          .replace(/[,\s]+[\d']+.*$/, "")
          .replace(/[,\s]+Director.*$/i, "")
          .replace(/[,\s]+PhD.*$/i, "")
          .replace(/[,\s]+Professor.*$/i, "")
          .replace(/\s+['"]?\d{2,4}['"]?.*$/, "")
          .replace(/\s+[''`]\d{2}.*$/, "")
          .replace(/\s*\d+.*$/, "")
          .trim()

        if (authorMatch) {
          const humanNameResult = extractHumanName(authorMatch, { formatCiteShortenAuthor: false })
          if (humanNameResult?.author_cite) {
            info.author = humanNameResult.author_short || humanNameResult.author_cite
            info.author_type = humanNameResult.author_type
          } else {
            const nameParts = authorMatch.split(/\s+/).filter((part) => part.length > 0)
            if (nameParts.length > 0) {
              const lastName = cleanPunctuation(nameParts[nameParts.length - 1])
              if (lastName && lastName.length > 1) info.author = lastName
            }
          }
        }
      }
    }

    if (!info.year) {
      // Accept both full and abbreviated year formats.
      const yearPatterns = [/\b20\d{2}\b/, /\b19\d{2}\b/, /\b'\d{2}\b/, /\b\d{2}(?=\.|,|\s|$)/]
      for (const pattern of yearPatterns) {
        const match = fullCite.match(pattern)
        if (!match) continue

        let year = match[0].replace("'", "")
        if (year.length === 2) {
          const yearNum = Number.parseInt(year, 10)
          year = yearNum <= 30 ? "20" + year : "19" + year
        }

        const yearNumber = Number.parseInt(year, 10)
        if (!Number.isNaN(yearNumber)) info.year = yearNumber
        break
      }
    }
  }

  if (!info.year && /\b(ND|No Date|no date)\b/i.test(fullCite)) info.year = "ND"

  if (!info.year) {
    // Last-resort heuristic: infer year from early numeric tokens in the citation.
    const words = fullCite.split(/\s+/).slice(0, 5)
    for (let i = 0; i < words.length; i++) {
      const numberMatch = words[i].match(/\b(\d{1,2})\b/)
      if (!numberMatch) continue

      const num = Number.parseInt(numberMatch[1], 10)
      info.year = num <= 30 ? 2000 + num : 1900 + num

      if (!info.author) {
        const startIndex = Math.max(0, i - 4)
        const authorWords = words.slice(startIndex, i)
        if (authorWords.length > 0) {
          const authorName = cleanPunctuation(authorWords.join(" "))
          if (authorName) {
            const humanNameResult = extractHumanName(authorName, { formatCiteShortenAuthor: false })
            if (humanNameResult?.author_cite) {
              info.author = humanNameResult.author_short || humanNameResult.author_cite
              info.author_type = humanNameResult.author_type
            } else {
              const nameParts = authorName.split(/\s+/).filter((part) => part.length > 0)
              if (nameParts.length > 0) info.author = cleanPunctuation(nameParts[nameParts.length - 1])
            }
          }
        }
      }
    }
  }

  if (info.author) {
    // Re-run author inference if the result looks like a phrase instead of a name.
    const authorWords = info.author.trim().split(/\s+/)
    const hasCommonShortWords = authorWords.some((word) => COMMON_SHORT_WORDS.includes(word.toLowerCase()))
    if (authorWords.length > 3 || hasCommonShortWords) {
      const recalculatedAuthor = recalculateAuthor(fullCite, boldText)
      if (recalculatedAuthor) info.author = recalculatedAuthor
    }
  }

  if (info.author && (info.author.trim().length <= 1 || /^['".,;:!?()]+$/.test(info.author.trim()))) {
    info.author = null
  }

  return info
}

/**
 * Re-runs author inference with stricter heuristics when initial extraction is noisy.
 *
 * @param fullCite - Full citation paragraph text.
 * @param _boldText - Bold fragment (unused).
 * @returns Best-guess author surname or `null`.
 */
export function recalculateAuthor(fullCite: string, _boldText: string): string | null {
  // Prefer explicit "Last, First" forms when available.
  const lastNameFirstPattern = /([A-Z][a-zA-Z'`-]+),\s*[A-Z][a-zA-Z'`-]+/
  const lastNameFirstMatch = fullCite.match(lastNameFirstPattern)
  if (lastNameFirstMatch) return lastNameFirstMatch[1]

  const firstLastPattern = /^([A-Z][a-zA-Z'`-]+)\s+([A-Z][a-zA-Z'`-]+)/
  const firstLastMatch = fullCite.match(firstLastPattern)
  if (firstLastMatch) return firstLastMatch[2]

  // Then try bracketed author mentions, e.g. "(Jane Smith)".
  const bracketPatterns = [
    /\[([A-Z][a-zA-Z'`-]+(?:\s+[A-Z][a-zA-Z'`-]+)*)\]/g,
    /\(([A-Z][a-zA-Z'`-]+(?:\s+[A-Z][a-zA-Z'`-]+)*)\)/g,
  ]

  for (const pattern of bracketPatterns) {
    const matches = [...fullCite.matchAll(pattern)]
    for (const match of matches) {
      const name = match[1].trim()
      const nameParts = name.split(/\s+/)
      if (nameParts.length >= 1 && nameParts.length <= 3) {
        const hasCommonWords = nameParts.some((part) => COMMON_SHORT_WORDS.includes(part.toLowerCase()))
        if (!hasCommonWords) return nameParts[nameParts.length - 1]
      }
    }
  }

  // Otherwise look for adjacent capitalized tokens that resemble a human name.
  const words = fullCite.split(/\s+/)
  for (let i = 0; i < words.length - 1; i++) {
    const word1 = cleanPunctuation(words[i])
    const word2 = cleanPunctuation(words[i + 1])

    if (
      word1.length > 1 &&
      word2.length > 1 &&
      /^[A-Z]/.test(word1) &&
      /^[A-Z]/.test(word2) &&
      !EXTENDED_COMMON_WORDS.includes(word1.toLowerCase()) &&
      !EXTENDED_COMMON_WORDS.includes(word2.toLowerCase())
    ) {
      return word2
    }
  }

  const humanNameResult = extractHumanName(fullCite, { formatCiteShortenAuthor: false })
  if (humanNameResult?.author_cite) {
    const authorName = humanNameResult.author_short || humanNameResult.author_cite
    const authorWords = authorName.split(/\s+/)
    if (authorWords.length <= 3) return authorWords[authorWords.length - 1]
  }

  return null
}

function cleanPunctuation(text: string): string {
  return text.replace(/[.,;:!?'"()]+$/, "").replace(/^[.,;:!?'"()]+/, "").trim()
}

/** Removes trailing punctuation commonly attached to copied URLs. */
export function cleanUrl(url: string): string {
  return url.replace(/[.,;:)\]}>]+$/, "")
}
