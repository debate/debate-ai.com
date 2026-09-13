/**
 * @fileoverview Pure helpers for the command palette's "Recent" group — the
 * last few tools a user actually opened, most-recent-first. Local-only (no
 * `user_settings` column, no D1 round-trip): unlike `favoriteTools.ts`
 * (`debate-round`'s account-linked, server-validated list), recency is a
 * per-browser UI convenience, not preference data worth syncing across
 * devices, so this lives entirely in the app rather than a shared package.
 *
 * Addresses `command-palette.mdx`'s "Known gaps" entry: "No recent-items or
 * usage-based ranking — every open starts from the same static
 * favorites-then-catalog order regardless of what was picked last time."
 *
 * @module lib/recentTools
 */
import { isValidToolHref } from "debate-round"

/** Short enough that the group stays a quick glance, not a second favorites list. */
export const MAX_RECENT_TOOLS = 5

/**
 * Moves `href` to the front of `current`, dropping any earlier occurrence
 * and capping the result at {@link MAX_RECENT_TOOLS}. Returns the same array
 * reference when `href` is already the most recent entry, so a caller can
 * skip a write by reference-comparing. An invalid href is a no-op (returns
 * `current` unchanged) rather than corrupting the list.
 */
export function pushRecentTool(current: string[], href: string): string[] {
  if (!isValidToolHref(href)) return current
  if (current[0] === href) return current
  const next = [href, ...current.filter((h) => h !== href)]
  return next.length > MAX_RECENT_TOOLS ? next.slice(0, MAX_RECENT_TOOLS) : next
}

/**
 * Parses the `recent-tools` localStorage value back into a list. Never
 * throws — malformed JSON, a non-array, or an invalid-shape entry reads back
 * as an empty (or filtered-down) list rather than erroring the caller.
 */
export function parseRecentTools(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidToolHref).slice(0, MAX_RECENT_TOOLS)
  } catch {
    return []
  }
}
