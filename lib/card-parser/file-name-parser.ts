/** @fileoverview File-name parsing helpers for extracting metadata from source files. */
import type { FileNameParts } from "./types"

/**
 * Parses a debate-file name in the format:
 * `Category - Topic - Organization YYYY.ext`.
 *
 * @param fileName - File path or file name.
 * @returns Parsed file-name metadata with missing values normalized to `null`.
 */
export function parseFileNameParts(fileName: string): FileNameParts {
  const base = String(fileName).split(/[\\/]/).pop() ?? ""
  const noExt = base.replace(/\.[^.]+$/, "")

  // Expect chunks like: Category - Topic - Organization 2024
  const segments = noExt
    .split(" - ")
    .map((s) => s.trim())
    .filter(Boolean)

  const category = segments[0] ?? null
  const last = segments[segments.length - 1] ?? ""

  const yearMatch = last.match(/\b(20\d{2}|19\d{2})\b$/)
  const year = yearMatch ? Number.parseInt(yearMatch[1], 10) : null

  // If a trailing year exists, everything before it is treated as organization.
  const organization = yearMatch
    ? last.slice(0, yearMatch.index ?? last.length).trim() || null
    : (last || null)

  const middle = segments.slice(1, Math.max(1, segments.length - 1))
  const topic = middle.length ? middle.join(" - ") : null

  return { category, topic, organization, year }
}
