/**
 * @fileoverview Pure helpers for the command palette's "Recent" group — the
 * last few tools a user actually opened, most-recent-first. Local-first
 * (always works signed out), best-effort account-synced via a
 * `recordRecentTool` op on the same `/api/settings` `user_settings` row
 * `favoriteTools` uses — closing `command-palette.mdx`'s "Known gaps" entry
 * that recents didn't follow a signed-in user across devices, unlike
 * favorites. This module keeps owning validation/serialization (rather than
 * moving it into `debate-round`, as `favoriteTools.ts` does) since it
 * already needs no catalog knowledge beyond `isValidToolHref`, mirroring
 * `editorPreferences`'s "app-specific `/api/settings` field" precedent.
 *
 * The op is append-to-front/dedupe/cap, resolved server-side against the
 * row's *current* stored list (see `applyRecentToolOp`) rather than a
 * client-computed whole-list replace — the same lost-update fix
 * `favoriteTools.ts#applyFavoriteToolOp` uses, since two tabs opening
 * different tools in quick succession would otherwise race.
 *
 * @module lib/recentTools
 */
import { isValidToolHref } from "debate-round"
import type { Tool } from "@/app/tools/tool-groups"

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
  return applyRecentToolOp(current, { recordRecentTool: href })
}

/**
 * Parses the `recent-tools` localStorage value — or the `recent_tools` D1
 * column, same shape — back into a list. Never throws — malformed JSON, a
 * non-array, or an invalid-shape entry reads back as an empty (or
 * filtered-down) list rather than erroring the caller.
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

/** Serializes a recents list for the `recent_tools` D1 column: `null` when empty, matching `favoriteTools.ts#serializeFavoriteTools`'s "no saved value yet" semantics. */
export function serializeRecentTools(list: string[]): string | null {
  return list.length === 0 ? null : JSON.stringify(list)
}

/** A single "just opened this tool" operation, applied against the caller's currently stored list rather than a client-computed whole-list replacement — mirrors `favoriteTools.ts#FavoriteToolOp`. */
export type RecentToolOp = { recordRecentTool: string }

export type RecentToolOpPatchResult = {
  /** Only the op, if present in `input` *and* valid. */
  valid: Partial<RecentToolOp>
  /** One message per rejected or malformed field. */
  errors: string[]
}

/**
 * Validates an untrusted (e.g. parsed request-body JSON) `{ recordRecentTool }`
 * patch, mirroring `favoriteTools.ts#normalizeFavoriteToolOpPatch`'s shape.
 */
export function normalizeRecentToolOpPatch(input: unknown): RecentToolOpPatchResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: {}, errors: ["Request body must be a JSON object."] }
  }

  const record = input as Record<string, unknown>
  if (!("recordRecentTool" in record)) return { valid: {}, errors: [] }

  return isValidToolHref(record.recordRecentTool)
    ? { valid: { recordRecentTool: record.recordRecentTool }, errors: [] }
    : { valid: {}, errors: ['"recordRecentTool" must be a single in-app path (e.g. "/reason-editor").'] }
}

/**
 * Applies one validated `recordRecentTool` op to a currently stored recents
 * list: moves the href to the front, dropping any earlier occurrence and
 * capping the result at {@link MAX_RECENT_TOOLS}. Pure and idempotent —
 * returns the same array reference when the href is already the most recent
 * entry or is invalid, so a caller can skip a write by reference-comparing.
 */
export function applyRecentToolOp(current: string[], op: RecentToolOp): string[] {
  if (!isValidToolHref(op.recordRecentTool)) return current
  if (current[0] === op.recordRecentTool) return current
  const next = [op.recordRecentTool, ...current.filter((h) => h !== op.recordRecentTool)]
  return next.length > MAX_RECENT_TOOLS ? next.slice(0, MAX_RECENT_TOOLS) : next
}

/**
 * Resolves recent hrefs (most-recent-first, as returned by
 * {@link parseRecentTools}/`useRecentTools`) back into their full `Tool`
 * records from the catalog. Drops any href whose tool was since renamed or
 * removed rather than rendering a broken entry for it — the same
 * `pruneUnknown`-style tolerance `useFavoriteTools` needs for the same
 * reason (see `FavoritesController.tsx`).
 */
export function resolveRecentTools(recent: string[], allTools: Tool[]): Tool[] {
  return recent
    .map((href) => allTools.find((tool) => tool.href === href))
    .filter((tool): tool is Tool => tool !== undefined)
}
