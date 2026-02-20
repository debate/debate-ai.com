/**
 * @fileoverview Citation extraction utilities for debate cards.
 * Extracts author names, years, and other citation metadata from text.
 * @module card-parser/citation-extractor
 */

import { extractHumanName } from "./human-name-recognizer.js"

/**
 * Common short words to filter when extracting author names.
 * @type {string[]}
 * @private
 */
const COMMON_SHORT_WORDS = [
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "can",
  "must",
]

/**
 * Extended common words including citation-specific terms.
 * @type {string[]}
 * @private
 */
const EXTENDED_COMMON_WORDS = [...COMMON_SHORT_WORDS, "et", "al", "al.", "et al.", "et al"]

/**
 * @typedef {Object} CitationInfo
 * @property {string|null} author - Extracted author name (typically last name)
 * @property {number|string|null} year - Publication year or "ND" for no date
 * @property {string|null} author_type - Type of author (person, organization, etc.)
 */

/**
 * Extracts citation information from text.
 * Parses author names, years, and other metadata from citation strings.
 *
 * @param {string} fullCite - Full citation text
 * @param {string} boldText - Bold/emphasized portion of the citation
 * @returns {CitationInfo} Extracted citation information
 *
 * @example
 * const info = extractCiteInfo("Smith 2023 - Climate Change Research", "Smith 2023");
 * // Returns { author: "Smith", year: 2023, author_type: null }
 */
export function extractCiteInfo(fullCite, boldText) {
  const info = {
    author: null,
    year: null,
    author_type: null,
  }

  if (!info.author && boldText) {
    let authorExtracted = false

    // Try author + year pattern first
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
      const humanNameResult = extractHumanName(fullCite, {
        formatCiteShortenAuthor: false,
      })

      if (humanNameResult && humanNameResult.author_cite) {
        info.author = humanNameResult.author_short || humanNameResult.author_cite
        info.author_type = humanNameResult.author_type
      }

      // Check for year in bold text with apostrophe format ('23)
      const authorYearMatch = boldText.match(/'(\d{2})\b/)
      if (authorYearMatch) {
        const twoDigitYear = authorYearMatch[1]
        const yearNum = Number.parseInt(twoDigitYear)
        if (!info.year) {
          info.year = yearNum <= 30 ? 2000 + yearNum : 1900 + yearNum
        }
      }

      // Handle edge case where bold text is just a quote character
      if (boldText.trim() === "'" || boldText.trim() === "'" || boldText.trim() === "''") {
        const nameBeforeQuote = fullCite.match(/([A-Za-z][A-Za-z\s,.-]+?)\s*['"]/)
        if (nameBeforeQuote) {
          const name = nameBeforeQuote[1].trim()
          const nameParts = name.split(/\s+/).filter((part) => part.length > 0)
          if (nameParts.length > 0) {
            const lastName = cleanPunctuation(nameParts[nameParts.length - 1])
            info.author = lastName
          }
        }
      } else if (boldText.trim().length <= 2 && /['"]/.test(boldText)) {
        // Short bold text with quotes - look for author before it
        const authorPatterns = [
          /([A-Za-z][A-Za-z\s,.-]+?)\s*['"]\d{2,4}/,
          /([A-Za-z][A-Za-z\s,.-]+?)\s*['"]/,
          /^([A-Za-z][A-Za-z\s,.-]+?)\s/,
          /([A-Za-z][A-Za-z\s,.-]+?)\s*['"]\d{2}/,
        ]

        for (const pattern of authorPatterns) {
          const match = fullCite.match(pattern)
          if (match) {
            const name = match[1].trim()
            const nameParts = name.split(/\s+/).filter((part) => part.length > 0)
            if (nameParts.length > 0) {
              const lastName = cleanPunctuation(nameParts[nameParts.length - 1])
              if (lastName && lastName.length > 1) {
                info.author = lastName
              }
            }
          }
        }
      } else {
        // Clean up bold text to extract author
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
          const humanNameResult = extractHumanName(authorMatch, {
            formatCiteShortenAuthor: false,
          })

          if (humanNameResult && humanNameResult.author_cite) {
            info.author = humanNameResult.author_short || humanNameResult.author_cite
            info.author_type = humanNameResult.author_type
          } else {
            const nameParts = authorMatch.split(/\s+/).filter((part) => part.length > 0)
            if (nameParts.length > 0) {
              const lastName = cleanPunctuation(nameParts[nameParts.length - 1])
              if (lastName && lastName.length > 1) {
                info.author = lastName
              }
            }
          }
        }
      }
    }

    // Extract year if not already found
    if (!info.year) {
      const yearPatterns = [/\b20\d{2}\b/, /\b19\d{2}\b/, /\b'\d{2}\b/, /\b\d{2}(?=\.|,|\s|$)/]

      for (const pattern of yearPatterns) {
        const match = fullCite.match(pattern)
        if (match) {
          let year = match[0].replace("'", "")

          if (year.length === 2) {
            const yearNum = Number.parseInt(year)
            year = yearNum <= 30 ? "20" + year : "19" + year
          }

          const yearNumber = Number.parseInt(year)
          if (!isNaN(yearNumber)) {
            info.year = yearNumber
          }
          break
        }
      }
    }
  }

  // Check for "No Date" indicator
  if (!info.year && /\b(ND|No Date|no date)\b/i.test(fullCite)) {
    info.year = "ND"
  }

  // Fallback: look for numbers in first few words
  if (!info.year) {
    const words = fullCite.split(/\s+/).slice(0, 5)
    for (let i = 0; i < words.length; i++) {
      const word = words[i]
      const numberMatch = word.match(/\b(\d{1,2})\b/)
      if (numberMatch) {
        const num = Number.parseInt(numberMatch[1])
        info.year = num <= 30 ? 2000 + num : 1900 + num

        // Try to extract author from words before the year
        if (!info.author) {
          const startIndex = Math.max(0, i - 4)
          const authorWords = words.slice(startIndex, i)
          if (authorWords.length > 0) {
            const authorName = cleanPunctuation(authorWords.join(" "))
            if (authorName) {
              const humanNameResult = extractHumanName(authorName, {
                formatCiteShortenAuthor: false,
              })

              if (humanNameResult && humanNameResult.author_cite) {
                info.author = humanNameResult.author_short || humanNameResult.author_cite
                info.author_type = humanNameResult.author_type
              } else {
                const nameParts = authorName.split(/\s+/).filter((part) => part.length > 0)
                if (nameParts.length > 0) {
                  const lastName = cleanPunctuation(nameParts[nameParts.length - 1])
                  info.author = lastName
                }
              }
            }
          }
        }
      }
    }
  }

  // Validate and potentially recalculate author
  if (info.author) {
    const authorWords = info.author.trim().split(/\s+/)
    const hasCommonShortWords = authorWords.some((word) => COMMON_SHORT_WORDS.includes(word.toLowerCase()))

    if (authorWords.length > 3 || hasCommonShortWords) {
      const recalculatedAuthor = recalculateAuthor(fullCite, boldText)
      if (recalculatedAuthor) {
        info.author = recalculatedAuthor
      }
    }
  }

  // Final validation: reject invalid authors
  if (info.author && (info.author.trim().length <= 1 || /^['".,;:!?()]+$/.test(info.author.trim()))) {
    info.author = null
  }

  return info
}

/**
 * Recalculates author name using various extraction strategies.
 * Used as a fallback when initial extraction produces poor results.
 *
 * @param {string} fullCite - Full citation text
 * @param {string} boldText - Bold/emphasized portion of the citation
 * @returns {string|null} Extracted author last name or null
 *
 * @example
 * const author = recalculateAuthor("Smith, John. 2023. Article Title", "Smith, John");
 * // Returns "Smith"
 */
export function recalculateAuthor(fullCite, boldText) {
  // Try "Last, First" pattern
  const lastNameFirstPattern = /([A-Z][a-zA-Z'`-]+),\s*[A-Z][a-zA-Z'`-]+/
  const lastNameFirstMatch = fullCite.match(lastNameFirstPattern)
  if (lastNameFirstMatch) {
    return lastNameFirstMatch[1]
  }

  // Try "First Last" pattern
  const firstLastPattern = /^([A-Z][a-zA-Z'`-]+)\s+([A-Z][a-zA-Z'`-]+)/
  const firstLastMatch = fullCite.match(firstLastPattern)
  if (firstLastMatch) {
    return firstLastMatch[2]
  }

  // Try bracket patterns [Name] or (Name)
  const bracketPatterns = [
    /\[([A-Z][a-zA-Z'`-]+(?:\s+[A-Z][a-zA-Z'`-]+)*)\]/g,
    /$$([A-Z][a-zA-Z'`-]+(?:\s+[A-Z][a-zA-Z'`-]+)*)$$/g,
  ]

  for (const pattern of bracketPatterns) {
    const matches = [...fullCite.matchAll(pattern)]
    for (const match of matches) {
      const name = match[1].trim()
      const nameParts = name.split(/\s+/)
      if (nameParts.length <= 3 && nameParts.length >= 1) {
        const hasCommonWords = nameParts.some((part) => COMMON_SHORT_WORDS.includes(part.toLowerCase()))
        if (!hasCommonWords) {
          return nameParts[nameParts.length - 1]
        }
      }
    }
  }

  // Try finding consecutive capitalized words
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

  // Fallback to human name extractor
  const humanNameResult = extractHumanName(fullCite, {
    formatCiteShortenAuthor: false,
  })

  if (humanNameResult && humanNameResult.author_cite) {
    const authorName = humanNameResult.author_short || humanNameResult.author_cite
    const authorWords = authorName.split(/\s+/)
    if (authorWords.length <= 3) {
      return authorWords[authorWords.length - 1]
    }
  }

  return null
}

/**
 * Cleans trailing and leading punctuation from a string.
 *
 * @param {string} text - Text to clean
 * @returns {string} Cleaned text
 * @private
 */
function cleanPunctuation(text) {
  return text
    .replace(/[.,;:!?'"()]+$/, "")
    .replace(/^[.,;:!?'"()]+/, "")
    .trim()
}

/**
 * Cleans a URL by removing trailing punctuation.
 *
 * @param {string} url - URL to clean
 * @returns {string} Cleaned URL
 *
 * @example
 * const cleaned = cleanUrl("https://example.com/page.");
 * // Returns "https://example.com/page"
 */
export function cleanUrl(url) {
  return url.replace(/[.,;:)\]}>]+$/, "")
}
