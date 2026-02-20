/**
 * @fileoverview File name parsing utilities for debate documents.
 * Extracts metadata from structured file names.
 * @module card-parser/file-name-parser
 */

/**
 * @typedef {Object} FileNameParts
 * @property {string|null} category - Document category (e.g., "Aff", "Neg", "DA")
 * @property {string|null} topic - Document topic or title
 * @property {string|null} organization - Organization or team name
 * @property {number|null} year - Document year
 */

/**
 * Parses a debate document file name into its component parts.
 * Expects file names in format: "Category - Topic - Organization Year.docx"
 *
 * @param {string} fileName - File name or path to parse
 * @returns {FileNameParts} Parsed file name components
 *
 * @example
 * const parts = parseFileNameParts("Aff - Climate Change - Michigan 2023.docx");
 * // Returns {
 * //   category: "Aff",
 * //   topic: "Climate Change",
 * //   organization: "Michigan",
 * //   year: 2023
 * // }
 *
 * @example
 * const parts = parseFileNameParts("DA - Politics - Wake Forest.docx");
 * // Returns {
 * //   category: "DA",
 * //   topic: "Politics",
 * //   organization: "Wake Forest",
 * //   year: null
 * // }
 */
export function parseFileNameParts(fileName) {
  // Extract base name from path
  const base = String(fileName).split(/[\\/]/).pop()

  // Remove file extension
  const noExt = base.replace(/\.[^.]+$/, "")

  // Split by " - " delimiter
  const segments = noExt
    .split(" - ")
    .map((s) => s.trim())
    .filter(Boolean)

  // First segment is category
  const category = segments[0] || null

  // Last segment may contain organization and year
  const last = segments[segments.length - 1] || ""

  // Extract year from end of last segment
  const yearMatch = last.match(/\b(20\d{2}|19\d{2})\b$/)
  const year = yearMatch ? Number.parseInt(yearMatch[1]) : null

  // Organization is last segment minus year
  const organization = yearMatch ? last.slice(0, yearMatch.index).trim() : last || null

  // Middle segments form the topic
  const middle = segments.slice(1, Math.max(1, segments.length - 1))
  const topic = middle.length ? middle.join(" - ") : null

  return { category, topic, organization, year }
}
