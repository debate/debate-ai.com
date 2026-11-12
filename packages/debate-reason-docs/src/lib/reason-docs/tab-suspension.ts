/**
 * @fileoverview Which editor tabs above Debate Editor are kept live and which
 * are suspended to save memory.
 *
 * A live tab keeps everything it needs to come back instantly: its saved
 * ProseMirror `EditorState` (undo history, selection, read mode) inside the
 * Debate Editor singleton and the provider's copy of its latest HTML. Past
 * {@link MAX_LIVE_TABS} open tabs the least recently used ones are suspended:
 * that state is dropped, the tab stays in the strip (dimmed, and listed in
 * the strip's "Suspended" dropdown), and selecting it mounts it fresh from
 * its stored content — every edit kept, its undo history started over.
 *
 * Pure so the rule can be unit-tested without the provider;
 * `ReasonDocsProvider` holds the usage order and frees the memory.
 *
 * @module lib/reason-docs/tab-suspension
 */

/** How many open tabs keep their editor state in memory, the one on screen
 *  included. */
export const MAX_LIVE_TABS = 5

/**
 * `usage` (least recently used first) with `id` moved to the end, as the most
 * recently used. Unchanged — the same array — when `id` is already last or
 * null, so it can feed a state setter without re-rendering.
 */
export function touchTab(usage: readonly number[], id: number | null): readonly number[] {
  if (id == null || usage[usage.length - 1] === id) return usage
  return [...usage.filter((tabId) => tabId !== id), id]
}

/** `usage` without the tabs no longer open, so it can't grow for ever. */
export function pruneUsage(usage: readonly number[], openTabs: readonly number[]): readonly number[] {
  const kept = usage.filter((id) => openTabs.includes(id))
  return kept.length === usage.length ? usage : kept
}

/**
 * The open tabs to suspend, in strip order: every tab but the `max` most
 * recently used. The active tab is never suspended, however `usage` reads; a
 * tab that was never used (opened without being shown) counts as the least
 * recently used.
 */
export function suspendedTabIds(
  openTabs: readonly number[],
  usage: readonly number[],
  activeId: number | null,
  max: number = MAX_LIVE_TABS,
): number[] {
  if (openTabs.length <= max) return []
  const recent = [...usage].reverse().filter((id) => openTabs.includes(id) && id !== activeId)
  const live = new Set<number>(activeId != null && openTabs.includes(activeId) ? [activeId] : [])
  for (const id of recent) {
    if (live.size >= Math.max(1, max)) break
    live.add(id)
  }
  // Never-used tabs fill any slot left, in strip order.
  for (const id of openTabs) {
    if (live.size >= Math.max(1, max)) break
    live.add(id)
  }
  return openTabs.filter((id) => !live.has(id))
}
