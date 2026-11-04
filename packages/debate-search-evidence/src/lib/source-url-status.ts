/**
 * @fileoverview Turns a card's saved source-URL check into what the search UI
 * shows: a status, a short label and a tooltip.
 *
 * The admin "Validate debate card URLs" run HEAD-requests each card's stored
 * source URL and saves the outcome; the card search returns it as
 * `urlCheck` on each result. A card whose URL has not been checked yet has no
 * `urlCheck` and reads as "unchecked" — never as broken.
 *
 * React-free so the wording can be unit tested on its own.
 *
 * @module lib/source-url-status
 */

/** What the result list and reader show for a card's source link. */
export type SourceUrlStatus = "valid" | "invalid" | "error" | "unchecked"

/** A saved check, as the search API returns it on a result. */
export interface SourceUrlCheck {
  status: "valid" | "invalid" | "error"
  /** HTTP status code, when the server answered at all. */
  statusCode?: number
  /** Why the check failed — `HTTP 404`, `Timeout after 8000ms`, … */
  error?: string
  /** Unix seconds of the check. */
  checkedAt?: number
}

/** The status, its short label and the tooltip that explains it. */
export interface SourceUrlStatusInfo {
  status: SourceUrlStatus
  label: string
  description: string
}

const KNOWN = new Set(["valid", "invalid", "error"])

/** "on Nov 4, 2026", or "" when the time is unknown. */
function checkedOn(checkedAt: number | undefined): string {
  if (!checkedAt || !Number.isFinite(checkedAt)) return ""
  const date = new Date(checkedAt * 1000)
  if (Number.isNaN(date.getTime())) return ""
  return ` on ${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`
}

/**
 * Describes a card's source-URL check.
 *
 * @param check - The result's `urlCheck`, if any.
 * @returns Status, label and tooltip text.
 */
export function describeSourceUrlStatus(check: SourceUrlCheck | null | undefined): SourceUrlStatusInfo {
  if (!check || !KNOWN.has(check.status)) {
    return {
      status: "unchecked",
      label: "Not checked",
      description: "This source link has not been checked yet.",
    }
  }
  const when = checkedOn(check.checkedAt)
  if (check.status === "valid") {
    const code = check.statusCode ? ` (HTTP ${check.statusCode})` : ""
    return { status: "valid", label: "Link works", description: `Source link opened when checked${when}${code}.` }
  }
  if (check.status === "invalid") {
    const reason = check.statusCode ? `HTTP ${check.statusCode}` : check.error || "an error"
    return {
      status: "invalid",
      label: "Link broken",
      description: `Source link returned ${reason} when checked${when}.`,
    }
  }
  return {
    status: "error",
    label: "Link unreachable",
    description: `Source link could not be reached when checked${when}${check.error ? `: ${check.error}` : ""}.`,
  }
}
